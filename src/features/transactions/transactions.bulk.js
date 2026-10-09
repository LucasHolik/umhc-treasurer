import store from "../../core/state.js";
import ModalComponent from "../../shared/modal.component.js";
import { el, replace } from "../../core/dom.js";
import { buildTripSelectorOptions } from "./transactions.logic.js";

export default class TransactionsBulk {
  static NO_TAG_VALUE = "__REMOVE__";

  constructor(element, callbacks) {
    this.element = element;
    this.callbacks = callbacks || {}; // { onToggleMode, onApply }

    // State
    this.bulkTripState = {
      value: null,
      search: "",
      isOpen: false,
      focusedIndex: -1,
      showPast: false,
    };
    this.bulkCategoryState = {
      value: null,
      search: "",
      isOpen: false,
      focusedIndex: -1,
    };
    this.isActive = false;
    this.dropdownHandlers = {};

    this.bindEvents();
  }

  bindEvents() {
    this.tagTransactionsBtn = this.element.querySelector(
      "#tag-transactions-btn",
    );
    this.bulkToolbar = this.element.querySelector("#bulk-actions-toolbar");
    this.mainControls = this.element.querySelector("#main-controls");
    this.selectionCount = this.element.querySelector("#selection-count");

    // Toggle Mode Handler
    this.toggleModeHandler = () => {
      if (this.callbacks.onToggleMode)
        this.callbacks.onToggleMode(!this.isActive);
    };

    if (this.tagTransactionsBtn) {
      this.tagTransactionsBtn.addEventListener("click", this.toggleModeHandler);
    }

    const cancelBtn = this.element.querySelector("#bulk-cancel-btn");
    // Cancel Handler
    this.cancelHandler = () => {
      if (this.callbacks.onToggleMode) this.callbacks.onToggleMode(false);
    };
    if (cancelBtn) {
      cancelBtn.addEventListener("click", this.cancelHandler);
    }

    const applyBtn = this.element.querySelector("#bulk-apply-btn");
    // Apply Handler
    this.applyHandler = () => this.handleApply();
    if (applyBtn) {
      applyBtn.addEventListener("click", this.applyHandler);
    }

    // Bulk Dropdown Listeners
    this.setupBulkDropdown(
      "trip",
      "#bulk-trip-container",
      "#bulk-trip-trigger",
      "#bulk-trip-content",
      "#bulk-trip-search",
      "Trip/Event",
    );
    this.setupBulkDropdown(
      "category",
      "#bulk-category-container",
      "#bulk-category-trigger",
      "#bulk-category-content",
      "#bulk-category-search",
      "Category",
    );
  }

  destroy() {
    if (this.boundGlobalClick) {
      document.removeEventListener("click", this.boundGlobalClick);
      this.boundGlobalClick = null;
    }

    if (this.tagTransactionsBtn && this.toggleModeHandler) {
      this.tagTransactionsBtn.removeEventListener(
        "click",
        this.toggleModeHandler,
      );
    }

    const cancelBtn = this.element.querySelector("#bulk-cancel-btn");
    if (cancelBtn && this.cancelHandler) {
      cancelBtn.removeEventListener("click", this.cancelHandler);
    }

    const applyBtn = this.element.querySelector("#bulk-apply-btn");
    if (applyBtn && this.applyHandler) {
      applyBtn.removeEventListener("click", this.applyHandler);
    }

    // Cleanup Dropdowns
    ["trip", "category"].forEach((type) => {
      const handlers = this.dropdownHandlers[type];
      if (!handlers) return;

      const {
        trigger,
        search,
        content,
        triggerClickHandler,
        triggerKeydownHandler,
        searchInputHandler,
        searchKeydownHandler,
        contentClickHandler,
        pastToggle,
        pastToggleClickHandler,
        pastToggleKeydownHandler,
      } = handlers;

      if (trigger) {
        trigger.removeEventListener("click", triggerClickHandler);
        trigger.removeEventListener("keydown", triggerKeydownHandler);
      }
      if (search) {
        search.removeEventListener("input", searchInputHandler);
        search.removeEventListener("keydown", searchKeydownHandler);
      }
      if (content) {
        content.removeEventListener("click", contentClickHandler);
      }
      if (pastToggle) {
        pastToggle.removeEventListener("click", pastToggleClickHandler);
        pastToggle.removeEventListener("keydown", pastToggleKeydownHandler);
      }
    });
    this.dropdownHandlers = {};
  }

  async handleApply() {
    const tripVal = this.bulkTripState.value;
    const catVal = this.bulkCategoryState.value;

    if (!tripVal && !catVal) {
      await new ModalComponent().alert(
        "Please select a Trip/Event or Category to apply.",
      );
      return;
    }

    if (this.callbacks.onApply) {
      this.callbacks.onApply(tripVal, catVal);
    }
  }

  setPrefill(prefill) {
    if (!prefill) return;

    if (prefill.type === "Trip/Event") {
      this.handleBulkSelection("Trip/Event", prefill.value, this.bulkTripState);
    } else if (prefill.type === "Category") {
      this.handleBulkSelection(
        "Category",
        prefill.value,
        this.bulkCategoryState,
      );
    }
  }

  toggleSelectionMode(active, selectedCount) {
    this.isActive = active;
    if (!active) {
      // Reset Bulk State
      this.bulkTripState = {
        value: null,
        search: "",
        isOpen: false,
        focusedIndex: -1,
        showPast: false,
      };
      this.bulkCategoryState = {
        value: null,
        search: "",
        isOpen: false,
        focusedIndex: -1,
      };
      this.closeBulkDropdown("trip");
      this.closeBulkDropdown("category");
      // Reset Triggers Text
      const tripTrigger = this.element.querySelector("#bulk-trip-trigger");
      const catTrigger = this.element.querySelector("#bulk-category-trigger");
      if (tripTrigger) tripTrigger.textContent = "Set Trip/Event...";
      if (catTrigger) catTrigger.textContent = "Set Category...";

      // Clear searches
      const tripSearch = this.element.querySelector("#bulk-trip-search");
      const catSearch = this.element.querySelector("#bulk-category-search");
      if (tripSearch) tripSearch.value = "";
      if (catSearch) catSearch.value = "";
    }

    this.updateSelectionCount(selectedCount);

    if (!this.bulkToolbar || !this.mainControls) return;

    if (active) {
      this.bulkToolbar.style.display = "block";
    } else {
      this.bulkToolbar.style.display = "none";
    }
  }

  updateSelectionCount(count) {
    if (this.selectionCount) {
      this.selectionCount.textContent = `${count} selected`;
    }
  }

  handleGlobalClick(e) {
    // Close Trip Dropdown if clicked outside
    if (!e.target.closest("#bulk-trip-container")) {
      this.closeBulkDropdown("trip");
    }

    // Close Category Dropdown if clicked outside
    if (!e.target.closest("#bulk-category-container")) {
      this.closeBulkDropdown("category");
    }
  }

  setupBulkDropdown(
    type,
    containerId,
    triggerId,
    contentId,
    searchId,
    tagName,
  ) {
    const container = this.element.querySelector(containerId);
    const trigger = this.element.querySelector(triggerId);
    const content = this.element.querySelector(contentId);
    const search = this.element.querySelector(searchId);

    if (!container || !trigger || !content || !search) return;

    // Accessibility Init
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("tabindex", "0");
    trigger.setAttribute("role", "button");

    search.setAttribute("aria-autocomplete", "list");
    search.setAttribute("aria-controls", `bulk-${type}-list`);

    // Toggle Dropdown
    const triggerClickHandler = (e) => {
      e.stopPropagation();
      e.preventDefault(); // Prevent default for both click and keyboard events
      const state =
        type === "trip" ? this.bulkTripState : this.bulkCategoryState;
      if (state.isOpen) {
        this.closeBulkDropdown(type);
        trigger.focus();
      } else {
        // Close other dropdown first
        if (type === "trip") this.closeBulkDropdown("category");
        else this.closeBulkDropdown("trip");

        this.openBulkDropdown(type);
      }
    };

    const triggerKeydownHandler = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        triggerClickHandler(e);
      }
    };

    trigger.addEventListener("click", triggerClickHandler);
    trigger.addEventListener("keydown", triggerKeydownHandler);

    // Search Input
    const searchInputHandler = (e) => {
      const state =
        type === "trip" ? this.bulkTripState : this.bulkCategoryState;
      state.search = e.target.value.toLowerCase();
      state.focusedIndex = -1; // Reset focus on search
      this.renderBulkTagList(
        tagName,
        type === "trip" ? "#bulk-trip-list" : "#bulk-category-list",
        state,
        type, // pass type for ID generation
      );
    };

    search.addEventListener("input", searchInputHandler);

    // Keyboard Navigation in Search
    const searchKeydownHandler = (e) => {
      const state =
        type === "trip" ? this.bulkTripState : this.bulkCategoryState;
      const listId =
        type === "trip" ? "#bulk-trip-list" : "#bulk-category-list";
      const listContainer = this.element.querySelector(listId);
      if (!listContainer) return;

      const options = listContainer.querySelectorAll(".tag-item-option");
      if (options.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        state.focusedIndex++;
        if (state.focusedIndex >= options.length) {
          state.focusedIndex = 0; // Wrap around
        }
        this.updateFocusedOption(options, state.focusedIndex, search);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        state.focusedIndex--;
        if (state.focusedIndex < 0) {
          state.focusedIndex = options.length - 1; // Wrap around
        }
        this.updateFocusedOption(options, state.focusedIndex, search);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (state.focusedIndex >= 0 && state.focusedIndex < options.length) {
          options[state.focusedIndex].click();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.closeBulkDropdown(type);
        trigger.focus();
      }
    };

    search.addEventListener("keydown", searchKeydownHandler);

    // Prevent closing when clicking inside the dropdown content
    const contentClickHandler = (e) => {
      e.stopPropagation();
    };
    content.addEventListener("click", contentClickHandler);

    // "See past tags" toggle (Trip/Event only). It sits outside the listbox
    // so arrow-key option indices only ever count real options.
    const pastToggle = this.element.querySelector(`#bulk-${type}-toggle-past`);
    let pastToggleClickHandler = null;
    let pastToggleKeydownHandler = null;
    if (pastToggle) {
      pastToggleClickHandler = () => {
        const state =
          type === "trip" ? this.bulkTripState : this.bulkCategoryState;
        state.showPast = !state.showPast;
        // The option list changes length, so any arrow-key focus is stale.
        state.focusedIndex = -1;
        search.removeAttribute("aria-activedescendant");
        this.renderBulkTagList(
          tagName,
          type === "trip" ? "#bulk-trip-list" : "#bulk-category-list",
          state,
          type,
        );
      };
      pastToggleKeydownHandler = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          this.closeBulkDropdown(type);
          trigger.focus();
        }
      };
      pastToggle.addEventListener("click", pastToggleClickHandler);
      pastToggle.addEventListener("keydown", pastToggleKeydownHandler);
    }

    // Store handlers for cleanup
    this.dropdownHandlers[type] = {
      trigger,
      search,
      content,
      triggerClickHandler,
      triggerKeydownHandler,
      searchInputHandler,
      searchKeydownHandler,
      contentClickHandler,
      pastToggle,
      pastToggleClickHandler,
      pastToggleKeydownHandler,
    };
  }

  updateFocusedOption(options, index, searchInput) {
    options.forEach((opt, i) => {
      if (i === index) {
        opt.classList.add("focused");
        opt.setAttribute("aria-selected", "true");
        opt.scrollIntoView({ block: "nearest" });
        searchInput.setAttribute("aria-activedescendant", opt.id);
      } else {
        opt.classList.remove("focused");
        opt.setAttribute("aria-selected", "false");
      }
    });
  }

  openBulkDropdown(type) {
    const state = type === "trip" ? this.bulkTripState : this.bulkCategoryState;
    const contentId =
      type === "trip" ? "#bulk-trip-content" : "#bulk-category-content";
    const content = this.element.querySelector(contentId);
    const searchId =
      type === "trip" ? "#bulk-trip-search" : "#bulk-category-search";
    const triggerId =
      type === "trip" ? "#bulk-trip-trigger" : "#bulk-category-trigger";
    const trigger = this.element.querySelector(triggerId);

    if (content) {
      content.style.display = "block";
      state.isOpen = true;
      if (type === "trip") {
        // A past trip already chosen (e.g. via prefill) must stay visible
        // and highlighted, so open with past tags shown.
        const { pastOptions } = buildTripSelectorOptions(
          store.getState("tags") || {},
        );
        state.showPast = pastOptions.some(
          (option) => option.value === state.value,
        );
      }
      if (trigger) trigger.setAttribute("aria-expanded", "true");

      // Register global click handler if not already
      if (!this.boundGlobalClick) {
        this.boundGlobalClick = this.handleGlobalClick.bind(this);
        document.addEventListener("click", this.boundGlobalClick);
      }

      // Render list immediately to ensure options exist
      this.renderBulkTagLists();

      // Focus search
      setTimeout(() => {
        const search = this.element.querySelector(searchId);
        if (search) search.focus();
      }, 50);
    }
  }

  closeBulkDropdown(type) {
    const state = type === "trip" ? this.bulkTripState : this.bulkCategoryState;
    const contentId =
      type === "trip" ? "#bulk-trip-content" : "#bulk-category-content";
    const content = this.element.querySelector(contentId);
    const triggerId =
      type === "trip" ? "#bulk-trip-trigger" : "#bulk-category-trigger";
    const trigger = this.element.querySelector(triggerId);

    if (content) {
      content.style.display = "none";
      state.isOpen = false;
      state.focusedIndex = -1; // Reset focus
      state.showPast = false;
      if (trigger) trigger.setAttribute("aria-expanded", "false");
    }
  }

  renderBulkTagLists() {
    this.renderBulkTagList(
      "Trip/Event",
      "#bulk-trip-list",
      this.bulkTripState,
      "trip",
    );
    this.renderBulkTagList(
      "Category",
      "#bulk-category-list",
      this.bulkCategoryState,
      "category",
    );
  }

  renderBulkTagList(tagName, listId, stateObj, typePrefix) {
    const container = this.element.querySelector(listId);
    if (!container) return;

    container.setAttribute("role", "listbox");
    // ID already matches (bulk-trip-list / bulk-category-list)

    const tagsData = store.getState("tags") || {};
    const { customOptions, pastOptions } =
      tagName === "Trip/Event"
        ? buildTripSelectorOptions(tagsData)
        : { customOptions: tagsData[tagName] || [], pastOptions: [] };

    const matchesSearch = (tag) =>
      typeof tag === "string" && tag.toLowerCase().includes(stateObj.search);
    const currentItems = customOptions
      .filter(matchesSearch)
      .map((tag) => ({ value: tag, hint: null }));
    const pastItems = pastOptions.filter((option) =>
      matchesSearch(option.value),
    );
    const visibleItems = (
      stateObj.showPast ? [...currentItems, ...pastItems] : currentItems
    ).sort((a, b) => (a.value < b.value ? -1 : a.value > b.value ? 1 : 0));

    const children = [];

    // "No Tag" Option
    const noTagId = `${typePrefix}-option-remove`;
    const noTagDiv = el(
      "div",
      {
        id: noTagId,
        className: `tag-item-option ${
          stateObj.value === TransactionsBulk.NO_TAG_VALUE ? "selected" : ""
        }`,
        role: "option",
        "aria-selected":
          stateObj.value === TransactionsBulk.NO_TAG_VALUE ? "true" : "false",
        onclick: () =>
          this.handleBulkSelection(
            tagName,
            TransactionsBulk.NO_TAG_VALUE,
            stateObj,
          ),
      },
      el("em", {}, "(No Tag)"),
    );
    children.push(noTagDiv);

    if (visibleItems.length === 0) {
      const hiddenMatches = stateObj.showPast ? 0 : pastItems.length;
      children.push(
        el(
          "div",
          { style: { padding: "5px", color: "#ccc" } },
          hiddenMatches > 0
            ? `No current tags match — ${hiddenMatches} past tag${
                hiddenMatches === 1 ? " does" : "s do"
              }`
            : "No matches found",
        ),
      );
    }

    visibleItems.forEach(({ value, hint }, index) => {
      const isPast = hint !== null;
      const optionId = `${typePrefix}-option-${index}`;
      const div = el(
        "div",
        {
          id: optionId,
          className: `tag-item-option${isPast ? " tag-item-option--past" : ""} ${
            stateObj.value === value ? "selected" : ""
          }`,
          role: "option",
          "aria-selected": stateObj.value === value ? "true" : "false",
          onclick: () => this.handleBulkSelection(tagName, value, stateObj),
        },
        isPast
          ? [
              el("span", { className: "tag-selector-item-label" }, value),
              el("span", { className: "tag-selector-item-hint" }, hint),
            ]
          : value,
      );
      children.push(div);
    });

    replace(container, ...children);
    this.renderPastToggle(typePrefix, pastOptions.length, stateObj);
  }

  renderPastToggle(typePrefix, pastCount, stateObj) {
    const toggle = this.element.querySelector(
      `#bulk-${typePrefix}-toggle-past`,
    );
    if (!toggle) return;

    if (pastCount === 0) {
      toggle.style.display = "none";
      return;
    }

    toggle.style.display = "";
    toggle.setAttribute("aria-expanded", String(stateObj.showPast));
    toggle.textContent = stateObj.showPast
      ? "Hide past tags"
      : `See past tags (${pastCount})`;
  }

  handleBulkSelection(tagName, value, stateObj) {
    stateObj.value = value;

    // Update Trigger Text
    const triggerId =
      tagName === "Category" ? "#bulk-category-trigger" : "#bulk-trip-trigger";
    const trigger = this.element.querySelector(triggerId);

    if (trigger) {
      if (value === TransactionsBulk.NO_TAG_VALUE) {
        replace(trigger, el("em", {}, "(No Tag)"));
      } else {
        trigger.textContent = value;
      }
    }

    // Close Dropdown
    if (tagName === "Category") {
      this.closeBulkDropdown("category");
      const t = this.element.querySelector("#bulk-category-trigger");
      if (t) t.focus();
    } else {
      this.closeBulkDropdown("trip");
      const t = this.element.querySelector("#bulk-trip-trigger");
      if (t) t.focus();
    }

    // Re-render list to show selection state (highlighting)
    const listId =
      tagName === "Category" ? "#bulk-category-list" : "#bulk-trip-list";
    const typePrefix = tagName === "Category" ? "category" : "trip";
    this.renderBulkTagList(tagName, listId, stateObj, typePrefix);
  }
}
