import store from "../core/state.js";
import { el, clear } from "../core/dom.js";
import { withSearchInputAttributes } from "./search-input.js";

function computePopoverPlacement(triggerRect, popoverSize, viewport, gap = 5) {
  const spaceBelow = viewport.height - triggerRect.bottom;
  const spaceAbove = triggerRect.top;
  const flipUp =
    popoverSize.height + gap > spaceBelow && spaceAbove > spaceBelow;

  const top = flipUp
    ? Math.max(gap, triggerRect.top - popoverSize.height - gap)
    : triggerRect.bottom + gap;

  let left = triggerRect.left;
  if (left + popoverSize.width > viewport.width) {
    left = Math.max(gap, viewport.width - popoverSize.width - gap);
  }

  return { top, left };
}

export default class TagSelector {
  constructor() {
    this.isOpen = false;
    this.currentConfig = null; // { type, onSelect, currentVal, customOptions, pastOptions }
    this.searchTerm = "";
    // View state for the open box only: resets every time it opens.
    this.showPast = false;

    this.element = el("div", {
      className: "tag-selector-popover",
      style: { display: "none" },
    });
    document.body.appendChild(this.element);

    this.globalClickHandler = (e) => {
      if (
        this.isOpen &&
        !this.element.contains(e.target) &&
        !e.target.closest(".tag-interactive-area") &&
        !e.target.closest(".tag-pill") &&
        !e.target.closest(".add-tag-placeholder")
      ) {
        this.close();
      }
    };

    this.repositionHandler = () => {
      if (this.isOpen) {
        this.updatePosition();
      }
    };

    // Global click to close
    document.addEventListener("click", this.globalClickHandler);

    // Render structure once
    const searchWrapper = el("div", { className: "tag-search-wrapper" });

    this.searchInput = el(
      "input",
      withSearchInputAttributes({
        "aria-label": "Search Tags",
        className: "tag-selector-search",
        placeholder: "Search...",
        oninput: (e) => {
          this.searchTerm = e.target.value.toLowerCase();
          this.renderList();
        },
      }),
    );

    const closeBtn = el(
      "button",
      {
        className: "tag-selector-close",
        type: "button",
        "aria-label": "Close",
        onclick: (e) => {
          e.stopPropagation();
          this.close();
        },
      },
      "×",
    );

    searchWrapper.appendChild(this.searchInput);
    searchWrapper.appendChild(closeBtn);

    this.listContainer = el("div", { className: "tag-selector-list" });

    // Built once so it keeps keyboard focus when the list re-renders.
    this.pastToggleBtn = el("button", {
      type: "button",
      className: "tag-selector-toggle-past",
      style: { display: "none" },
      onclick: () => {
        this.showPast = !this.showPast;
        this.renderList();
        this.updatePosition();
      },
    });

    this.element.appendChild(searchWrapper);
    this.element.appendChild(this.listContainer);
    this.element.appendChild(this.pastToggleBtn);

    // Prevent closing when clicking inside
    this.element.addEventListener("click", (e) => e.stopPropagation());

    // Escape to close
    this.element.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.close();
      }
    });
  }

  /**
   * @param {HTMLElement} targetElement - Element the box is anchored to.
   * @param {string} type - Tag type ("Trip/Event", "Category", ...).
   * @param {string} currentVal - The current value (unused by the list).
   * @param {function(string)} onSelect - Called with the chosen tag.
   * @param {string[]|null} customOptions - Tags to list; null reads the store.
   * @param {Object} [options]
   * @param {Array<{value: string, hint: string}>} [options.pastOptions] -
   *   Tags hidden behind a "See past tags" toggle. The hint explains why.
   */
  show(
    targetElement,
    type,
    currentVal,
    onSelect,
    customOptions = null,
    { pastOptions = [] } = {},
  ) {
    this.currentConfig = {
      type,
      onSelect,
      currentVal,
      customOptions,
      pastOptions: Array.isArray(pastOptions) ? pastOptions : [],
    };
    this.targetElement = targetElement;
    this.searchTerm = "";
    this.searchInput.value = "";
    this.showPast = false;

    this.renderList();

    this.element.style.display = "block";
    this.isOpen = true;

    this.updatePosition();

    this.searchInput.focus();

    // Attach listeners for scrolling/resizing
    window.addEventListener("scroll", this.repositionHandler, true); // Capture phase to catch all scrolls
    window.addEventListener("resize", this.repositionHandler);
  }

  updatePosition() {
    if (!this.targetElement) return;

    const triggerRect = this.targetElement.getBoundingClientRect();
    const popRect = this.element.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    const { top, left } = computePopoverPlacement(
      triggerRect,
      { width: popRect.width, height: popRect.height },
      { width: window.innerWidth, height: window.innerHeight },
    );

    this.element.style.top = `${top + scrollY}px`;
    this.element.style.left = `${left + scrollX}px`;
  }

  close() {
    this.isOpen = false;
    this.element.style.display = "none";
    this.currentConfig = null;
    this.targetElement = null;
    this.showPast = false;

    window.removeEventListener("scroll", this.repositionHandler, true);
    window.removeEventListener("resize", this.repositionHandler);
  }

  destroy() {
    this.close();
    document.removeEventListener("click", this.globalClickHandler);
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }

  renderList() {
    if (!this.currentConfig) return;

    const { type, onSelect, customOptions, pastOptions } = this.currentConfig;
    let tags = [];

    if (customOptions) {
      tags = customOptions;
    } else {
      const tagsData = store.getState("tags") || {};
      // Map 'Trip/Event' column key to 'Trip/Event' tag key (which matches)
      // Map 'Category' column key to 'Category' tag key
      tags = tagsData[type] || [];
    }

    const matchesSearch = (tag) =>
      typeof tag === "string" && tag.toLowerCase().includes(this.searchTerm);

    const currentItems = tags
      .filter(matchesSearch)
      .map((tag) => ({ value: tag, hint: null }));
    const pastItems = pastOptions
      .filter((option) => option && matchesSearch(option.value))
      .map((option) => ({ value: option.value, hint: option.hint || "" }));

    const visibleItems = (
      this.showPast ? [...currentItems, ...pastItems] : currentItems
    ).sort((a, b) => (a.value < b.value ? -1 : a.value > b.value ? 1 : 0));

    clear(this.listContainer);

    if (visibleItems.length === 0) {
      const hiddenMatches = this.showPast ? 0 : pastItems.length;
      this.listContainer.appendChild(
        el(
          "div",
          { className: "tag-selector-item empty" },
          hiddenMatches > 0
            ? `No current tags match — ${hiddenMatches} past tag${
                hiddenMatches === 1 ? " does" : "s do"
              }`
            : "No matching tags",
        ),
      );
    }

    visibleItems.forEach(({ value, hint }) => {
      const isPast = hint !== null;
      const item = el(
        "div",
        {
          className: `tag-selector-item${isPast ? " tag-selector-item--past" : ""}`,
          tabindex: "0",
          role: "button",
          onclick: () => {
            onSelect(value);
            this.close();
          },
          onkeydown: (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(value);
              this.close();
            }
          },
        },
        isPast
          ? [
              el("span", { className: "tag-selector-item-label" }, value),
              el("span", { className: "tag-selector-item-hint" }, hint),
            ]
          : value,
      );
      this.listContainer.appendChild(item);
    });

    this.renderPastToggle();
  }

  renderPastToggle() {
    const pastCount = this.currentConfig
      ? this.currentConfig.pastOptions.length
      : 0;

    if (pastCount === 0) {
      this.pastToggleBtn.style.display = "none";
      return;
    }

    this.pastToggleBtn.style.display = "";
    this.pastToggleBtn.setAttribute("aria-expanded", String(this.showPast));
    this.pastToggleBtn.textContent = this.showPast
      ? "Hide past tags"
      : `See past tags (${pastCount})`;
  }
}
