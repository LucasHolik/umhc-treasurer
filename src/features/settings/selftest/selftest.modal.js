// src/features/settings/selftest/selftest.modal.js
//
// Live results popup for the self-test suite. Builds its own overlay
// (same pattern as split-transaction.modal.js) because ModalComponent
// only supports string-body alert/confirm/prompt and cannot stream
// per-test updates. Reuses the shared modal-* CSS classes; modal.css is
// already injected because SettingsComponent constructs a ModalComponent.

import { el, cleanup } from "../../../core/dom.js";

class SelfTestModal {
  constructor() {
    this.overlay = null;
    this.cancelled = false;
    this.lastSuite = null;
    this.previouslyFocused = null;
    this._injectStyles();
  }

  _injectStyles() {
    if (document.getElementById("selftest-styles")) return;
    const link = el("link", {
      id: "selftest-styles",
      rel: "stylesheet",
      href: new URL("./selftest.css", import.meta.url).href,
    });
    document.head.appendChild(link);
  }

  open() {
    if (this.overlay && document.body.contains(this.overlay)) {
      throw new Error("Self-test modal is already open");
    }
    this.cancelled = false;
    this.lastSuite = null;
    this.previouslyFocused = document.activeElement;

    this.progressEl = el(
      "div",
      { className: "selftest-progress", "aria-live": "polite" },
      "Preparing tests…",
    );
    this.resultsList = el("ul", { className: "selftest-results" });
    this.summaryEl = el("div", { className: "selftest-summary" });
    this.body = el(
      "div",
      { className: "modal-body selftest-body" },
      this.progressEl,
      this.resultsList,
      this.summaryEl,
    );

    const closeBtn = el(
      "button",
      {
        className: "modal-btn modal-btn-confirm",
        onclick: () => this.close(),
      },
      "Close",
    );

    const modalContent = el(
      "div",
      {
        className: "modal-content selftest-modal-content",
        role: "dialog",
        "aria-modal": "true",
        "aria-label": "Self-Test Results",
      },
      el(
        "div",
        { className: "modal-header" },
        el("h3", {}, "Self-Test"),
        el(
          "button",
          {
            className: "modal-close",
            "aria-label": "Close",
            onclick: () => this.close(),
          },
          "×",
        ),
      ),
      this.body,
      el("div", { className: "modal-footer" }, closeBtn),
    );

    this.overlay = el(
      "div",
      {
        className: "modal-overlay",
        onclick: (e) => {
          if (e.target === this.overlay) this.close();
        },
      },
      modalContent,
    );

    this.handleEscape = (e) => {
      if (e.key === "Escape") this.close();
    };
    document.addEventListener("keydown", this.handleEscape);

    document.body.appendChild(this.overlay);
    // Move focus into the dialog; otherwise the trigger button stays
    // focused behind the overlay and Enter/Space re-fires it, stacking
    // a second modal.
    closeBtn.focus();
  }

  setProgress(done, total) {
    if (!this.overlay) return;
    this.progressEl.textContent = `Running ${done} / ${total}…`;
  }

  addResult({ suite, name, passed, error, ms }) {
    if (!this.overlay) return;

    if (suite !== this.lastSuite) {
      this.resultsList.appendChild(
        el("li", { className: "selftest-suite" }, suite),
      );
      this.lastSuite = suite;
    }

    this.resultsList.appendChild(
      el(
        "li",
        {
          className: `selftest-row ${
            passed ? "selftest-row--pass" : "selftest-row--fail"
          }`,
        },
        el("span", { className: "selftest-row-mark" }, passed ? "✓" : "✗"),
        `${name} (${ms.toFixed(1)}ms)`,
        passed
          ? null
          : el(
              "div",
              { className: "selftest-error" },
              error && error.message ? error.message : String(error),
            ),
      ),
    );

    this.body.scrollTop = this.body.scrollHeight;
  }

  setSummary({ total, passed, failed, durationMs }) {
    if (!this.overlay) return;
    this.progressEl.textContent = `Finished ${total} tests in ${(durationMs / 1000).toFixed(1)}s`;
    this.summaryEl.className = `selftest-summary ${
      failed === 0 ? "selftest-summary--pass" : "selftest-summary--fail"
    }`;
    this.summaryEl.textContent =
      failed === 0
        ? `All ${passed} tests passed ✓`
        : `${failed} of ${total} tests FAILED — ${passed} passed`;
    this.body.scrollTop = this.body.scrollHeight;
  }

  isCancelled() {
    return this.cancelled;
  }

  close() {
    this.cancelled = true;
    if (this.handleEscape) {
      document.removeEventListener("keydown", this.handleEscape);
      this.handleEscape = null;
    }
    if (this.overlay) {
      cleanup(this.overlay);
      this.overlay.remove();
      this.overlay = null;
      if (
        this.previouslyFocused &&
        document.body.contains(this.previouslyFocused)
      ) {
        this.previouslyFocused.focus();
      }
      this.previouslyFocused = null;
    }
  }
}

export default SelfTestModal;
