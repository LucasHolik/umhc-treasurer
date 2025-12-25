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

    // Global click to close
    document.addEventListener("click", (e) => {
      if (
        this.isOpen &&
        !this.element.contains(e.target) &&
        !e.target.closest(".tag-interactive-area") &&
        !e.target.closest(".tag-pill") &&
        !e.target.closest(".add-tag-placeholder")
      ) {
        this.close();
      }
    });

    // Render structure once
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

    this.listContainer = el("div", { className: "tag-selector-list" });

    this.element.appendChild(this.searchInput);
    this.element.appendChild(this.listContainer);

    // Prevent closing when clicking inside
    this.element.addEventListener("click", (e) => e.stopPropagation());
  }

  show(rect, type, currentVal, onSelect, customOptions = null) {
    this.currentConfig = { type, onSelect, currentVal, customOptions };
    this.searchTerm = "";
    this.searchInput.value = "";

    this.renderList();

    this.element.style.display = "block";
    this.isOpen = true;

    // Position
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

    this.searchInput.focus();
  }

  close() {
    this.isOpen = false;
    this.element.style.display = "none";
    this.currentConfig = null;
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
      .filter((tag) => tag.toLowerCase().includes(this.searchTerm))
      .sort();

    clear(this.listContainer);

    if (filteredTags.length === 0) {
      this.listContainer.appendChild(
        el("div", { className: "tag-selector-item empty" }, "No matching tags")
      );
    }

    filteredTags.forEach((tag) => {
      const item = el(
        "div",
        {
          className: "tag-selector-item",
          onclick: () => {
            onSelect(tag);
            this.close();
          },
        },
        tag
      );
      this.listContainer.appendChild(item);
    });
  }
}
