import { el, clear, replace } from "../core/dom.js";

const normalizeChildren = (children) =>
  (Array.isArray(children) ? children : [children]).filter(
    (child) => child !== null && child !== undefined && child !== false,
  );

const renderSummaryItem = (item) => {
  if (item instanceof Node) return item;

  if (typeof item === "string" || typeof item === "number") {
    return el("span", { className: "mobile-summary-row__item" }, String(item));
  }

  if (item && typeof item === "object") {
    const toneClass = item.tone
      ? ` mobile-summary-row__item--${item.tone}`
      : "";
    return el(
      "span",
      { className: `mobile-summary-row__item${toneClass}` },
      item.label || "",
    );
  }

  return null;
};

export const createCompactSummaryRow = ({
  label = "",
  text = "",
  items = [],
  emptyText = "",
  className = "",
} = {}) => {
  const summaryChildren = [];

  if (label) {
    summaryChildren.push(
      el("span", { className: "mobile-summary-row__label" }, label),
    );
  }

  if (text) {
    summaryChildren.push(
      el("span", { className: "mobile-summary-row__text" }, text),
    );
  } else if (items.length > 0) {
    summaryChildren.push(...items.map(renderSummaryItem).filter(Boolean));
  } else if (emptyText) {
    summaryChildren.push(
      el("span", { className: "mobile-summary-row__empty" }, emptyText),
    );
  }

  return el(
    "div",
    {
      className: ["mobile-summary-row", className].filter(Boolean).join(" "),
    },
    ...summaryChildren,
  );
};

export const createMobileActionCluster = ({
  primary = [],
  secondary = [],
  className = "",
} = {}) =>
  el(
    "div",
    {
      className: ["mobile-action-cluster", className].filter(Boolean).join(" "),
    },
    el(
      "div",
      { className: "mobile-action-cluster__primary" },
      ...normalizeChildren(primary),
    ),
    el(
      "div",
      { className: "mobile-action-cluster__secondary" },
      ...normalizeChildren(secondary),
    ),
  );

export default class MobileDisclosureComponent {
  constructor(element, options = {}) {
    this.element = element;
    this.mobileMediaQuery = window.matchMedia("(max-width: 768px)");
    this.boundMediaQueryChange = () => this.syncState();
    if (typeof this.mobileMediaQuery.addEventListener === "function") {
      this.mobileMediaQuery.addEventListener(
        "change",
        this.boundMediaQueryChange,
      );
    } else if (typeof this.mobileMediaQuery.addListener === "function") {
      this.mobileMediaQuery.addListener(this.boundMediaQueryChange);
    }

    this.options = {
      title: "",
      summary: {},
      expanded: true,
      collapseMode: "mobile",
      className: "",
      bodyClassName: "",
      actionsClassName: "",
      showSummaryWhenExpanded: false,
      bodyChildren: [],
      actionsChildren: [],
      onToggle: null,
      ...options,
    };

    this.state = {
      expanded: this.options.expanded !== false,
    };

    this.render();
    this.update(this.options);
  }

  render() {
    this.titleElement = el("span", { className: "mobile-disclosure__title" });
    this.summaryElement = el("div", {
      className: "mobile-disclosure__summary",
    });
    this.actionsElement = el("div", {
      className: "mobile-disclosure__actions",
    });
    this.bodyElement = el("div", {
      className: "mobile-disclosure__body",
    });
    this.toggleIcon = el(
      "span",
      {
        className: "mobile-disclosure__icon",
        "aria-hidden": "true",
      },
      "⌄",
    );

    this.toggleButton = el(
      "button",
      {
        type: "button",
        className: "mobile-disclosure__toggle",
        onclick: () => this.toggle(),
      },
      el(
        "span",
        { className: "mobile-disclosure__heading" },
        this.titleElement,
        this.summaryElement,
      ),
      this.toggleIcon,
    );

    this.headerElement = el(
      "div",
      { className: "mobile-disclosure__header" },
      this.toggleButton,
      this.actionsElement,
    );

    this.root = el(
      "section",
      { className: "mobile-disclosure" },
      this.headerElement,
      this.bodyElement,
    );

    replace(this.element, this.root);
  }

  update(options = {}) {
    this.options = {
      ...this.options,
      ...options,
    };

    if (options.expanded !== undefined) {
      this.state.expanded = options.expanded !== false;
    }

    this.root.className = ["mobile-disclosure", this.options.className]
      .filter(Boolean)
      .join(" ");
    this.root.dataset.collapseMode = this.options.collapseMode || "mobile";
    this.root.dataset.expanded = String(this.state.expanded);

    this.titleElement.textContent = this.options.title || "";
    this.bodyElement.className = [
      "mobile-disclosure__body",
      this.options.bodyClassName,
    ]
      .filter(Boolean)
      .join(" ");
    this.actionsElement.className = [
      "mobile-disclosure__actions",
      this.options.actionsClassName,
    ]
      .filter(Boolean)
      .join(" ");

    this.setSummary(this.options.summary);
    this.setActions(this.options.actionsChildren || []);
    this.setBody(this.options.bodyChildren || []);
    this.syncState();
  }

  setSummary(summaryConfig = {}) {
    this.options.summary = summaryConfig;
    this.renderSummary(summaryConfig);
  }

  renderSummary(summaryConfig = {}) {
    const summaryNode = createCompactSummaryRow(summaryConfig);
    replace(this.summaryElement, summaryNode);

    const hasSummary = Boolean(
      summaryConfig.text ||
      (Array.isArray(summaryConfig.items) && summaryConfig.items.length > 0) ||
      summaryConfig.emptyText,
    );

    this.root.dataset.hasSummary = String(hasSummary);
  }

  setBody(children) {
    clear(this.bodyElement);
    this.bodyElement.append(...normalizeChildren(children));
  }

  setActions(children) {
    clear(this.actionsElement);
    this.actionsElement.append(...normalizeChildren(children));
    this.root.dataset.hasActions = String(
      this.actionsElement.childNodes.length > 0,
    );
  }

  setExpanded(expanded) {
    if (!this.canCollapse()) return;

    this.state.expanded = Boolean(expanded);
    this.syncState();
    if (typeof this.options.onToggle === "function") {
      this.options.onToggle(this.state.expanded);
    }
  }

  toggle() {
    this.setExpanded(!this.state.expanded);
  }

  canCollapse() {
    if (this.options.collapseMode === "all") return true;
    if (this.options.collapseMode === "mobile") {
      return this.mobileMediaQuery.matches;
    }
    return false;
  }

  syncState() {
    const canCollapse = this.canCollapse();
    const expanded = this.state.expanded;
    this.root.dataset.expanded = String(expanded);
    this.root.dataset.canCollapse = String(canCollapse);
    this.toggleButton.setAttribute(
      "aria-expanded",
      String(canCollapse ? expanded : true),
    );
    this.toggleButton.setAttribute("aria-disabled", String(!canCollapse));
    this.toggleButton.setAttribute(
      "aria-label",
      canCollapse
        ? `${expanded ? "Collapse" : "Expand"} ${this.options.title || "section"}`
        : this.options.title || "section",
    );
    this.summaryElement.dataset.showWhenExpanded = String(
      this.options.showSummaryWhenExpanded === true,
    );
  }

  getBodyElement() {
    return this.bodyElement;
  }

  getActionsElement() {
    return this.actionsElement;
  }

  destroy() {
    if (typeof this.mobileMediaQuery.removeEventListener === "function") {
      this.mobileMediaQuery.removeEventListener(
        "change",
        this.boundMediaQueryChange,
      );
    } else if (typeof this.mobileMediaQuery.removeListener === "function") {
      this.mobileMediaQuery.removeListener(this.boundMediaQueryChange);
    }
  }
}
