import { el, replace } from "../../core/dom.js";
import { sanitizeForId } from "../../core/utils.js";

export default class TransactionsFilters {
  constructor(element, callbacks) {
    this.element = element;
    this.callbacks = callbacks || {}; // { onFilterChange, onFilterSelectAll, onSearchChange }
    this.bindEvents();
  }

  bindEvents() {
    const catSearch = this.element.querySelector("#transactions-cat-search");
    if (catSearch) {
      catSearch.addEventListener("input", (e) => {
        if (this.callbacks.onSearchChange) {
          this.callbacks.onSearchChange("Category", e.target.value);
        }
      });
    }

    const tripSearch = this.element.querySelector("#transactions-trip-search");
    if (tripSearch) {
      tripSearch.addEventListener("input", (e) => {
        if (this.callbacks.onSearchChange) {
          this.callbacks.onSearchChange("Trip/Event", e.target.value);
        }
      });
    }
  }

  renderTagLists(
    tagsData,
    selectedCategories,
    selectedTrips,
    categorySearch,
    tripSearch
  ) {
    this.populateTagList(
      "Category",
      tagsData["Category"] || [],
      selectedCategories,
      categorySearch,
      "#category-selector-container"
    );

    this.populateTagList(
      "Trip/Event",
      tagsData["Trip/Event"] || [],
      selectedTrips,
      tripSearch,
      "#trip-selector-container"
    );
  }

  populateTagList(type, tagsArray, selectionSet, searchTerm, containerId) {
    const container = this.element.querySelector(containerId);
    if (!container) return;

    const NO_TAG_VALUE = "__NO_TAG__";

    // 1. "No Tag" Option
    const noTagUid = `tx-notag-${sanitizeForId(type)}`;
    const noTagCheckbox = el("input", { type: "checkbox", id: noTagUid });
    noTagCheckbox.checked = selectionSet.has(NO_TAG_VALUE);
    noTagCheckbox.addEventListener("change", (e) => {
      if (this.callbacks.onFilterChange) {
        this.callbacks.onFilterChange(type, NO_TAG_VALUE, e.target.checked);
      }
    });

    const noTagDiv = el(
      "div",
      {
        className: "tag-checkbox-item",
        style: {
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          marginBottom: "5px",
          paddingBottom: "5px",
        },
      },
      noTagCheckbox,
      el("label", { for: noTagUid }, el("em", {}, "(No Tag)"))
    );

    const children = [noTagDiv];

    if (tagsArray.length === 0) {
      children.push(
        el(
          "div",
          {
            style: { padding: "5px" },
            role: "status",
            "aria-live": "polite",
          },
          "No tags found"
        )
      );
      replace(container, ...children);
      return;
    }

    const sortedTags = [...tagsArray].sort();
    const visibleTags = sortedTags.filter((tag) =>
      tag.toLowerCase().includes((searchTerm || "").toLowerCase())
    );

    // 2. Select All
    if (visibleTags.length > 0) {
      const selectAllUid = `tx-all-${sanitizeForId(type)}`;
      const allVisibleSelected = visibleTags.every((t) => selectionSet.has(t));

      const selectAllCheckbox = el("input", {
        type: "checkbox",
        id: selectAllUid,
      });
      selectAllCheckbox.checked = allVisibleSelected;
      selectAllCheckbox.addEventListener("change", (e) => {
        if (this.callbacks.onFilterSelectAll) {
          this.callbacks.onFilterSelectAll(type, visibleTags, e.target.checked);
        }
      });

      const selectAllDiv = el(
        "div",
        { className: "tag-checkbox-item" },
        selectAllCheckbox,
        el("label", { for: selectAllUid }, el("em", {}, "Select All"))
      );
      children.push(selectAllDiv);
    } else {
      children.push(
        el(
          "div",
          {
            style: { padding: "5px", color: "#ccc" },
            role: "status",
            "aria-live": "polite",
          },
          "No matches found"
        )
      );
    }

    // 3. Tags
    visibleTags.forEach((tag, index) => {
      const isChecked = selectionSet.has(tag);
      const uid = `tx-${sanitizeForId(type)}-${sanitizeForId(tag)}-${index}`;

      const tagCheckbox = el("input", {
        type: "checkbox",
        id: uid,
        value: tag,
        className: "tag-item-input",
      });
      if (isChecked) tagCheckbox.checked = true;

      tagCheckbox.addEventListener("change", (e) => {
        if (this.callbacks.onFilterChange) {
          this.callbacks.onFilterChange(type, tag, e.target.checked);
        }
      });

      const div = el(
        "div",
        { className: "tag-checkbox-item" },
        tagCheckbox,
        el("label", { for: uid }, tag)
      );
      children.push(div);
    });

    const previousScrollTop = container.scrollTop;
    replace(container, ...children);
    container.scrollTop = previousScrollTop;
  }

  destroy() {
    this.element = null;
    this.callbacks = {};
  }
}
