import store from "../core/state.js";
import { el, clear } from "../core/dom.js";

export default class TagSelector {
  constructor() {
    this.isOpen = false;
    this.currentConfig = null; // { x, y, type, onSelect, currentVal }
    this.searchTerm = "";

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

    this.searchInput = el("input", {
      type: "text",
      name: "tag-selector-search",
      "aria-label": "Search Tags",
      className: "tag-selector-search",
      placeholder: "Search...",
      oninput: (e) => {
        this.searchTerm = e.target.value.toLowerCase();
        this.renderList();
      },
    });

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

    this.element.appendChild(searchWrapper);
    this.element.appendChild(this.listContainer);

    // Prevent closing when clicking inside
    this.element.addEventListener("click", (e) => e.stopPropagation());

    // Escape to close
    this.element.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.close();
      }
    });
  }

  show(targetElement, type, currentVal, onSelect, customOptions = null) {
    this.currentConfig = { type, onSelect, currentVal, customOptions };
    this.targetElement = targetElement;
    this.searchTerm = "";
    this.searchInput.value = "";

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

    const rect = this.targetElement.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    // Default position: below the element
    let top = rect.bottom + scrollY + 5;
    let left = rect.left + scrollX;

    // Boundary checks (simple)
    if (left + 200 > window.innerWidth) {
      left = window.innerWidth - 210;
    }

    this.element.style.top = `${top}px`;
    this.element.style.left = `${left}px`;
  }

  close() {
    this.isOpen = false;
    this.element.style.display = "none";
    this.currentConfig = null;
    this.targetElement = null;

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

    const { type, onSelect, customOptions } = this.currentConfig;
    let tags = [];

    if (customOptions) {
      tags = customOptions;
    } else {
      const tagsData = store.getState("tags") || {};
      // Map 'Trip/Event' column key to 'Trip/Event' tag key (which matches)
      // Map 'Category' column key to 'Category' tag key
      tags = tagsData[type] || [];
    }

    const filteredTags = tags
      .filter(
        (tag) =>
          typeof tag === "string" &&
          tag.toLowerCase().includes(this.searchTerm),
      )
      .sort();

    clear(this.listContainer);

    if (filteredTags.length === 0) {
      this.listContainer.appendChild(
        el("div", { className: "tag-selector-item empty" }, "No matching tags"),
      );
    }

    filteredTags.forEach((tag) => {
      const item = el(
        "div",
        {
          className: "tag-selector-item",
          tabindex: "0",
          role: "button",
          onclick: () => {
            onSelect(tag);
            this.close();
          },
          onkeydown: (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(tag);
              this.close();
            }
          },
        },
        tag,
      );
      this.listContainer.appendChild(item);
    });
  }
}
