// src/features/transactions/transactions.suggestions-modal.js
//
// Review dialog for AI tag suggestions. It is self-contained: it renders the
// proposals, tracks which ones are ticked and resolves with the ticked entries
// when Apply is pressed. It never writes anything, so cancelling costs nothing.

import { el, replace } from "../../core/dom.js";
import { formatCurrency, formatDateForInput } from "../../core/utils.js";
import ModalComponent from "../../shared/modal.component.js";
import { rowAmount } from "./transactions.suggestions.js";

// The proposal key and the ledger row key for each fillable tag field.
const TAG_FIELDS = [
  { proposalKey: "tripEvent", rowKey: "Trip/Event", label: "Trip/Event" },
  { proposalKey: "category", rowKey: "Category", label: "Category" },
];

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
    this.notice = null;
    this.selected = new Set();
    this.previouslyFocused = null;
    this.handleKeydown = null;
    this.listContainer = null;
    this.countLabel = null;
    this.toggleButton = null;
    this.applyButton = null;
  }

  /**
   * Opens the review dialog. Only one instance may be open at a time.
   * @param {object} [options]
   * @param {Array<{row: *, tripEvent?: string, category?: string}>} [options.suggestions]
   *   the reconciled proposals, one entry per transaction
   * @param {Map<string, object>} [options.rowsById] the current ledger rows keyed
   *   by String(row), used for the date, description, amount and kept field
   * @param {*} [options.notice] an optional warning shown above the list, for
   *   example skipped rows or a partial failure from an earlier batch
   * @param {HTMLElement} [options.returnFocus] the element to focus on close.
   *   Defaults to the element that was focused when the dialog opened. The
   *   body is focused when that element has left the document.
   * @returns {Promise<Array<{row: *, tripEvent?: string, category?: string}>|null>}
   *   the ticked proposals in list order, or null when the dialog is cancelled
   * @throws {Error} when this instance already has a dialog open
   */
  open({ suggestions, rowsById, notice, returnFocus } = {}) {
    if (this.overlay) {
      throw new Error("Modal is already open");
    }

    this.suggestions = Array.isArray(suggestions) ? suggestions : [];
    this.rowsById = rowsById instanceof Map ? rowsById : new Map();
    this.notice = notice ?? null;
    this.selected = new Set(this.suggestions.map((_, index) => index));
    this.previouslyFocused = returnFocus ?? document.activeElement;

    return new Promise((resolve) => {
      this.resolvePromise = resolve;
      this.render();

      const firstTick = this.overlay.querySelector(".suggest-row__tick");
      if (firstTick) {
        firstTick.focus();
      } else {
        this.overlay.querySelector(".modal-content").focus();
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
      if (event.target === overlay) this.close(null);
    });
    overlay.appendChild(modalContent);
    document.body.appendChild(overlay);
    this.overlay = overlay;

    this.handleKeydown = (event) => this.handleDialogKeydown(event);
    document.addEventListener("keydown", this.handleKeydown);

    this.updateFooter();
  }

  /**
   * Handles Escape and traps Tab inside the dialog, wrapping at both ends the
   * same way the shared ModalComponent does.
   * @param {KeyboardEvent} event
   */
  handleDialogKeydown(event) {
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
   * Collects the dialog's focusable controls in document order.
   * @returns {HTMLElement[]}
   */
  getFocusableElements() {
    if (!this.overlay) return [];
    const selector =
      'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"]), [contenteditable], audio[controls], video[controls]';
    return Array.from(this.overlay.querySelectorAll(selector));
  }

  /**
   * Renders one proposal row: the tick, the transaction details, the proposed
   * pills and, when only one field is proposed, the kept field as muted text.
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

    const tick = el("input", {
      type: "checkbox",
      className: "suggest-row__tick",
      checked: this.selected.has(index),
      "aria-label": `Include suggestion for ${description}${
        date ? ` on ${date}` : ""
      }`,
      onchange: (event) => this.toggleRow(index, event.target.checked),
    });

    const pills = [];
    for (const field of TAG_FIELDS) {
      const proposed = suggestion[field.proposalKey];
      if (proposed !== undefined) {
        pills.push(
          el(
            "span",
            {
              className: "suggest-pill",
              dataset: { field: field.proposalKey },
            },
            `${field.label}: ${proposed}`,
          ),
        );
        continue;
      }

      // The field was already tagged when the row was selected. Show it as
      // unchanged rather than as a proposal, so the user can see both halves.
      const currentValue = row ? row[field.rowKey] : "";
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
      }
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
   * Records a row tick and refreshes the footer.
   * @param {number} index
   * @param {boolean} checked
   */
  toggleRow(index, checked) {
    if (checked) {
      this.selected.add(index);
    } else {
      this.selected.delete(index);
    }
    this.updateFooter();
  }

  /** Selects every proposal, or clears them all when all are already ticked. */
  toggleAll() {
    if (this.selected.size === this.suggestions.length) {
      this.selected.clear();
    } else {
      this.selected = new Set(this.suggestions.map((_, index) => index));
    }
    this.syncTicks();
    this.updateFooter();
  }

  /** Makes the rendered ticks match the selected indexes. */
  syncTicks() {
    if (!this.listContainer) return;
    this.listContainer
      .querySelectorAll(".suggest-row__tick")
      .forEach((tick, index) => {
        tick.checked = this.selected.has(index);
      });
  }

  /** Refreshes the count, the select-all label and the Apply state. */
  updateFooter() {
    const count = this.selected.size;
    const total = this.suggestions.length;

    this.countLabel.textContent = `${count} of ${total} selected`;
    this.toggleButton.textContent =
      count === total ? "Clear all" : "Select all";
    this.applyButton.textContent = `Apply ${count} ${
      count === 1 ? "suggestion" : "suggestions"
    }`;
    this.applyButton.disabled = count === 0;
    this.applyButton.classList.toggle("disabled", count === 0);
  }

  /** Resolves the dialog with the ticked proposals, in list order. */
  apply() {
    const accepted = this.suggestions.filter((_, index) =>
      this.selected.has(index),
    );
    this.close(accepted);
  }

  /**
   * Closes the dialog, removing the overlay and the keydown listener, restoring
   * focus, clearing the proposal state and resolving the open promise.
   * @param {*} [result] the ticked proposals, or null when cancelled
   */
  close(result = null) {
    if (this.handleKeydown) {
      document.removeEventListener("keydown", this.handleKeydown);
      this.handleKeydown = null;
    }

    if (this.overlay) {
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
    this.selected = new Set();

    const resolve = this.resolvePromise;
    this.resolvePromise = null;
    if (resolve) resolve(result);
  }
}
