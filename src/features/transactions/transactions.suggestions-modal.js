// src/features/transactions/transactions.suggestions-modal.js
//
// Review dialog for AI tag suggestions. It is self-contained: it renders the
// proposals, tracks which ones are ticked and resolves with the ticked entries
// when Apply is pressed. It never writes anything, so cancelling costs nothing.

import { cleanup, el, replace } from "../../core/dom.js";
import store from "../../core/state.js";
import { formatCurrency, formatDateForInput } from "../../core/utils.js";
import ModalComponent from "../../shared/modal.component.js";
import TagSelector from "../../shared/tag-selector.component.js";
import { buildTagSelectorOptions } from "./transactions.logic.js";
import { rowAmount } from "./transactions.suggestions.js";

// The proposal key and the ledger row key for each fillable tag field.
const TAG_FIELDS = [
  { proposalKey: "tripEvent", rowKey: "Trip/Event", label: "Trip/Event" },
  { proposalKey: "category", rowKey: "Category", label: "Category" },
];

const hasAnyTag = (suggestion) =>
  Boolean(
    suggestion &&
    (suggestion.tripEvent !== undefined || suggestion.category !== undefined),
  );

const isElementVisible = (element) =>
  !element.hidden &&
  element.style.display !== "none" &&
  window.getComputedStyle(element).display !== "none";

/**
 * Converts a notice into display text. An Error or any object with a string
 * `message` shows that message; anything else is shown as a string.
 * @param {*} notice
 * @returns {string} the display text, or "" when there is no notice
 */
const noticeText = (notice) => {
  if (notice === null || notice === undefined) return "";
  if (typeof notice === "object" && typeof notice.message === "string") {
    return notice.message;
  }
  return String(notice);
};

export default class TransactionsSuggestionsModal {
  constructor() {
    // Constructing ModalComponent injects its shared modal.css once. This
    // dialog reuses those styles without opening the shared dialog.
    new ModalComponent();
    this.overlay = null;
    this.resolvePromise = null;
    this.suggestions = [];
    this.rowsById = new Map();
    this.tags = {};
    this.notice = null;
    this.selected = new Set();
    this.previouslyFocused = null;
    this.handleKeydown = null;
    this.tagSelector = null;
    this.listContainer = null;
    this.countLabel = null;
    this.toggleButton = null;
    this.applyButton = null;
  }

  /**
   * Opens the review dialog. Only one instance may be open at a time.
   * @param {object} [options]
   * @param {Array<{row: *, tripEvent?: string, category?: string}>} [options.suggestions]
   *   the review rows, one entry per transaction
   * @param {Map<string, object>} [options.rowsById] the current ledger rows keyed
   *   by String(row), used for the date, description, amount and kept field
   * @param {object} [options.tags] available tags (`Trip/Event`, `Category`,
   *   `TripStatusMap`). Defaults to `store.getState("tags") || {}` only when omitted.
   * @param {*} [options.notice] an optional warning shown above the list, for
   *   example skipped rows or a partial failure from an earlier batch
   * @param {HTMLElement} [options.returnFocus] the element to focus on close.
   *   Defaults to the element that was focused when the dialog opened. The
   *   body is focused when that element has left the document.
   * @returns {Promise<Array<{row: *, tripEvent?: string, category?: string}>|null>}
   *   the ticked proposals in list order, or null when the dialog is cancelled
   * @throws {Error} when this instance already has a dialog open
   */
  open({ suggestions, rowsById, tags, notice, returnFocus } = {}) {
    if (this.overlay) {
      throw new Error("Modal is already open");
    }

    this.suggestions = Array.isArray(suggestions)
      ? suggestions.map((entry) =>
          entry && typeof entry === "object" ? { ...entry } : entry,
        )
      : [];
    this.rowsById = rowsById instanceof Map ? rowsById : new Map();
    this.tags = tags !== undefined ? tags || {} : store.getState("tags") || {};
    this.notice = notice ?? null;
    this.selected = new Set();
    this.suggestions.forEach((suggestion, index) => {
      if (hasAnyTag(suggestion)) {
        this.selected.add(index);
      }
    });
    this.previouslyFocused = returnFocus ?? document.activeElement;
    this.tagSelector = new TagSelector();
    this.tagSelector.element.classList.add("tag-selector-popover--split-modal");

    return new Promise((resolve) => {
      this.resolvePromise = resolve;
      this.render();

      const firstTick = this.overlay.querySelector(
        ".suggest-row__tick:not(:disabled)",
      );
      if (firstTick) {
        firstTick.focus();
      } else {
        const [firstFocusable] = this.getFocusableElements();
        if (firstFocusable) {
          firstFocusable.focus();
        } else {
          this.overlay.querySelector(".modal-content").focus();
        }
      }
    });
  }

  /** Renders the overlay, the proposal list and the footer, then focuses in. */
  render() {
    const titleId = "suggest-tags-title";
    const intro = el(
      "p",
      { className: "suggest-intro" },
      "Only ticked rows are saved. Nothing is written until you press Apply.",
    );

    const notice = noticeText(this.notice);
    const noticeEl = notice
      ? el("p", { className: "suggest-notice", role: "status" }, notice)
      : null;

    this.listContainer = el("div", { className: "suggest-list" });
    replace(
      this.listContainer,
      ...this.suggestions.map((suggestion, index) =>
        this.renderRow(suggestion, index),
      ),
    );

    this.countLabel = el("span", {
      className: "suggest-count",
      "aria-live": "polite",
    });
    this.toggleButton = el(
      "button",
      {
        type: "button",
        className: "secondary-btn suggest-toggle",
        onclick: () => this.toggleAll(),
      },
      "Clear all",
    );
    this.applyButton = el(
      "button",
      {
        type: "button",
        id: "suggest-apply-btn",
        className: "modal-btn modal-btn-confirm",
        onclick: () => this.apply(),
      },
      "",
    );

    const modalContent = el(
      "div",
      {
        className: "modal-content suggest-modal-content",
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": titleId,
        tabindex: "-1",
      },
      el(
        "div",
        { className: "modal-header" },
        el("h3", { id: titleId }, "Suggested tags"),
        el(
          "button",
          {
            type: "button",
            className: "modal-close",
            "aria-label": "Close",
            onclick: () => this.close(null),
          },
          "×",
        ),
      ),
      el(
        "div",
        { className: "modal-body suggest-modal-body" },
        intro,
        noticeEl,
        this.listContainer,
      ),
      el(
        "div",
        { className: "modal-footer suggest-modal-footer" },
        el(
          "div",
          { className: "suggest-footer-summary" },
          this.countLabel,
          this.toggleButton,
        ),
        el(
          "div",
          { className: "suggest-footer-actions" },
          el(
            "button",
            {
              type: "button",
              className: "modal-btn modal-btn-cancel",
              onclick: () => this.close(null),
            },
            "Cancel",
          ),
          this.applyButton,
        ),
      ),
    );

    const overlay = el("div", { className: "modal-overlay" });
    overlay.addEventListener("click", (event) => {
      if (event.target !== overlay) return;
      if (this.tagSelector && this.tagSelector.isOpen) {
        this.tagSelector.close();
        return;
      }
      this.close(null);
    });
    overlay.appendChild(modalContent);
    document.body.appendChild(overlay);
    this.overlay = overlay;

    this.handleKeydown = (event) => this.handleDialogKeydown(event);
    document.addEventListener("keydown", this.handleKeydown);

    this.updateFooter();
  }

  /**
   * Handles Escape and traps Tab inside the dialog (or open TagSelector),
   * wrapping at both ends the same way the shared ModalComponent does.
   * @param {KeyboardEvent} event
   */
  handleDialogKeydown(event) {
    if (this.tagSelector && this.tagSelector.isOpen) {
      if (event.key === "Escape") {
        event.preventDefault();
        this.tagSelector.close();
        return;
      }
      if (event.key === "Tab") {
        this.trapFocusInElement(event, this.tagSelector.element);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      this.close(null);
      return;
    }

    if (event.key !== "Tab") return;

    const focusable = this.getFocusableElements();
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey) {
      if (document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    } else if (document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /**
   * Traps Tab / Shift+Tab inside the given container element.
   * @param {KeyboardEvent} event
   * @param {HTMLElement} container
   */
  trapFocusInElement(event, container) {
    const focusable = this.getFocusableElements(container);
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (!container.contains(active)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
      return;
    }

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /**
   * Collects visible, enabled focusable controls inside `root` in document order.
   * @param {HTMLElement|null} [root=this.overlay]
   * @returns {HTMLElement[]}
   */
  getFocusableElements(root = this.overlay) {
    if (!root) return [];
    const selector =
      'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"]), [contenteditable], audio[controls], video[controls]';
    return Array.from(root.querySelectorAll(selector)).filter(isElementVisible);
  }

  /**
   * Renders one review row: the tick, the transaction details, and the pills
   * for each field (editable proposal, read-only kept tag, or "No tag" trigger).
   * @param {{row: *, tripEvent?: string, category?: string}} suggestion
   * @param {number} index - position in the proposal list, used as the tick key
   * @returns {HTMLElement}
   */
  renderRow(suggestion, index) {
    const row = this.rowsById.get(String(suggestion.row));
    const description =
      row && row.Description
        ? String(row.Description)
        : `Row ${suggestion.row}`;
    const date = this.formatDate(row);
    const net = row ? rowAmount(row) : 0;
    const tone = net > 0 ? "positive" : net < 0 ? "negative" : "";
    const enabled = hasAnyTag(suggestion);

    const tick = el("input", {
      type: "checkbox",
      className: "suggest-row__tick",
      checked: enabled && this.selected.has(index),
      disabled: !enabled,
      title: enabled
        ? undefined
        : "Select at least one tag to include this row",
      "aria-label": `Include suggestion for ${description}${
        date ? ` on ${date}` : ""
      }`,
      onchange: (event) => this.toggleRow(index, event.target.checked),
    });

    const pills = [];
    for (const field of TAG_FIELDS) {
      const proposed = suggestion[field.proposalKey];
      if (proposed !== undefined) {
        const trigger = el(
          "button",
          {
            type: "button",
            className: "suggest-pill__trigger",
            title: `Change ${field.label}`,
            "aria-label": `Edit ${field.label}: ${proposed}`,
            onclick: (event) => {
              event.stopPropagation();
              this.openFieldSelector(trigger, index, field, proposed);
            },
          },
          `${field.label}: ${proposed}`,
        );
        const removeBtn = el(
          "button",
          {
            type: "button",
            className: "remove-btn suggest-pill__remove",
            title: `Clear ${field.label}`,
            "aria-label": `Clear ${field.label}`,
            onclick: (event) => {
              event.stopPropagation();
              this.clearSuggestionField(index, field);
            },
          },
          "×",
        );
        pills.push(
          el(
            "span",
            {
              className: "suggest-pill suggest-pill--editable",
              dataset: { field: field.proposalKey },
            },
            trigger,
            removeBtn,
          ),
        );
        continue;
      }

      // The field was already tagged when the row was selected. Show it as
      // unchanged and read-only, so existing tags are never overwritten (D-022).
      const rawCurrent = row ? row[field.rowKey] : "";
      const currentValue =
        rawCurrent === null || rawCurrent === undefined
          ? ""
          : String(rawCurrent).trim();
      if (currentValue) {
        pills.push(
          el(
            "span",
            {
              className: "suggest-pill suggest-pill--kept",
              dataset: { field: field.proposalKey },
              title: "Already set",
              "aria-label": `${field.label} already set to ${currentValue}`,
            },
            `${field.label}: ${currentValue}`,
          ),
        );
        continue;
      }

      const emptyBtn = el(
        "button",
        {
          type: "button",
          className: "suggest-pill suggest-pill--empty",
          dataset: { field: field.proposalKey },
          title: `Select ${field.label}`,
          "aria-label": `Select ${field.label}: No tag`,
          onclick: (event) => {
            event.stopPropagation();
            this.openFieldSelector(emptyBtn, index, field, "");
          },
        },
        `${field.label}: No tag`,
      );
      pills.push(emptyBtn);
    }

    return el(
      "div",
      { className: "suggest-row", dataset: { index: String(index) } },
      el("label", { className: "suggest-row__check" }, tick),
      el(
        "div",
        { className: "suggest-row__details" },
        el(
          "div",
          { className: "suggest-row__heading" },
          el("span", { className: "suggest-row__date" }, date),
          el("span", { className: "suggest-row__description" }, description),
          el(
            "span",
            { className: `suggest-row__amount ${tone}`.trim() },
            formatCurrency(net),
          ),
        ),
        el("div", { className: "suggest-tags" }, ...pills),
      ),
    );
  }

  /**
   * Opens the TagSelector popover anchored to `trigger` for one missing or
   * proposed field on a review row.
   * @param {HTMLElement} trigger
   * @param {number} index
   * @param {{proposalKey: string, rowKey: string, label: string}} field
   * @param {string} currentVal
   */
  openFieldSelector(trigger, index, field, currentVal) {
    if (!this.tagSelector) return;

    let customOptions;
    let pastOptions = [];
    if (field.rowKey === "Trip/Event") {
      ({ customOptions, pastOptions } = buildTagSelectorOptions(
        field.rowKey,
        this.tags,
      ));
    } else {
      const list = this.tags[field.rowKey];
      customOptions = Array.isArray(list) ? list : [];
    }

    let didSelect = false;
    this.tagSelector.show(
      trigger,
      field.rowKey,
      currentVal,
      (value) => {
        didSelect = true;
        this.setSuggestionField(index, field, value);
      },
      customOptions,
      {
        pastOptions,
        onClose: () => {
          if (!didSelect && document.contains(trigger)) {
            trigger.focus();
          }
        },
      },
    );
  }

  /**
   * Sets a tag field on a review row, ticks the row, refreshes it in place and
   * moves focus to the refreshed field trigger.
   * @param {number} index
   * @param {{proposalKey: string, rowKey: string, label: string}} field
   * @param {string} value
   */
  setSuggestionField(index, field, value) {
    const suggestion = this.suggestions[index];
    if (!suggestion) return;
    suggestion[field.proposalKey] = value;
    this.selected.add(index);
    this.refreshRow(
      index,
      `[data-field="${field.proposalKey}"] .suggest-pill__trigger`,
    );
    this.updateFooter();
  }

  /**
   * Clears a tag field back to undefined, unticks and disables the row when no
   * tag remains, refreshes it in place and focuses the "No tag" button.
   * @param {number} index
   * @param {{proposalKey: string, rowKey: string, label: string}} field
   */
  clearSuggestionField(index, field) {
    const suggestion = this.suggestions[index];
    if (!suggestion) return;
    if (this.tagSelector && this.tagSelector.isOpen) {
      this.tagSelector.close();
    }
    delete suggestion[field.proposalKey];
    if (!hasAnyTag(suggestion)) {
      this.selected.delete(index);
    }
    this.refreshRow(
      index,
      `.suggest-pill--empty[data-field="${field.proposalKey}"]`,
    );
    this.updateFooter();
  }

  /**
   * Re-renders one row in place in `listContainer` and optionally moves focus
   * to a matching control inside the new row.
   * @param {number} index
   * @param {string} [focusSelector]
   */
  refreshRow(index, focusSelector) {
    if (!this.listContainer) return;
    const oldRow = this.listContainer.children[index];
    if (!oldRow) return;
    const newRow = this.renderRow(this.suggestions[index], index);
    cleanup(oldRow);
    oldRow.replaceWith(newRow);
    if (focusSelector) {
      const target = newRow.querySelector(focusSelector);
      if (target && typeof target.focus === "function") {
        target.focus();
      }
    }
  }

  /**
   * Formats a row's Date for display.
   * @param {object|undefined} row
   * @returns {string}
   */
  formatDate(row) {
    const value = row ? row.Date : "";
    if (value instanceof Date) return formatDateForInput(value);
    return value === null || value === undefined ? "" : String(value);
  }

  /**
   * Returns the indices of rows that have at least one tag set and can be ticked.
   * @returns {number[]}
   */
  getSelectableIndices() {
    const indices = [];
    this.suggestions.forEach((suggestion, index) => {
      if (hasAnyTag(suggestion)) indices.push(index);
    });
    return indices;
  }

  /**
   * Records a row tick and refreshes the footer.
   * @param {number} index
   * @param {boolean} checked
   */
  toggleRow(index, checked) {
    if (checked && hasAnyTag(this.suggestions[index])) {
      this.selected.add(index);
    } else {
      this.selected.delete(index);
    }
    this.updateFooter();
  }

  /** Selects every selectable row, or clears them all when all are ticked. */
  toggleAll() {
    const selectable = this.getSelectableIndices();
    if (selectable.length === 0) return;

    if (this.selected.size === selectable.length) {
      this.selected.clear();
    } else {
      this.selected = new Set(selectable);
    }
    this.syncTicks();
    this.updateFooter();
  }

  /** Makes the rendered ticks match the selected indexes and row availability. */
  syncTicks() {
    if (!this.listContainer) return;
    this.listContainer
      .querySelectorAll(".suggest-row__tick")
      .forEach((tick, index) => {
        const enabled = hasAnyTag(this.suggestions[index]);
        tick.disabled = !enabled;
        tick.checked = enabled && this.selected.has(index);
      });
  }

  /** Refreshes the count, the select-all label and the Apply state. */
  updateFooter() {
    const count = this.selected.size;
    const total = this.suggestions.length;
    const selectableCount = this.getSelectableIndices().length;

    this.countLabel.textContent = `${count} of ${total} selected`;
    if (selectableCount === 0) {
      this.toggleButton.disabled = true;
      this.toggleButton.textContent = "Select all";
    } else {
      this.toggleButton.disabled = false;
      this.toggleButton.textContent =
        count === selectableCount ? "Clear all" : "Select all";
    }
    this.applyButton.textContent = `Apply ${count} ${
      count === 1 ? "suggestion" : "suggestions"
    }`;
    this.applyButton.disabled = count === 0;
    this.applyButton.classList.toggle("disabled", count === 0);
  }

  /** Resolves the dialog with the ticked proposals, in list order. */
  apply() {
    const accepted = this.suggestions
      .filter((_, index) => this.selected.has(index))
      .map((suggestion) => ({ ...suggestion }));
    this.close(accepted);
  }

  /**
   * Closes the dialog, destroying any open TagSelector, removing the overlay
   * and keydown listener, restoring focus, clearing state and resolving.
   * @param {*} [result] the ticked proposals, or null when cancelled
   */
  close(result = null) {
    if (this.tagSelector) {
      this.tagSelector.destroy();
      this.tagSelector = null;
    }

    if (this.handleKeydown) {
      document.removeEventListener("keydown", this.handleKeydown);
      this.handleKeydown = null;
    }

    if (this.overlay) {
      cleanup(this.overlay);
      this.overlay.remove();
      this.overlay = null;
    }

    const restoreTarget = this.previouslyFocused;
    this.previouslyFocused = null;
    if (
      restoreTarget &&
      typeof restoreTarget.focus === "function" &&
      document.contains(restoreTarget)
    ) {
      restoreTarget.focus();
    } else {
      document.body.focus();
    }

    this.suggestions = [];
    this.rowsById = new Map();
    this.tags = {};
    this.selected = new Set();

    const resolve = this.resolvePromise;
    this.resolvePromise = null;
    if (resolve) resolve(result);
  }
}
