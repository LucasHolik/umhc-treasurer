// src/shared/modal.component.js

import { el } from "../core/dom.js";

class ModalComponent {
  static _idCounter = 0;
  static _stylesLoaded = false;
  static _styleLoadPromise = null;

  constructor() {
    this._injectStyles();
  }

  _injectStyles() {
    const existing = document.getElementById("modal-styles");
    if (existing) {
      if (existing.sheet) {
        ModalComponent._stylesLoaded = true;
      }
      return;
    }

    const link = document.createElement("link");
    link.id = "modal-styles";
    link.rel = "stylesheet";
    link.href = new URL("./modal.css", import.meta.url).href;

    // Mark as loaded when done
    link.onload = () => {
      ModalComponent._stylesLoaded = true;
    };
    link.onerror = () => {
      console.warn("Modal stylesheet failed to load");
      ModalComponent._stylesLoaded = true;
    };

    document.head.appendChild(link);
  }

  /**
   * Shows a confirmation modal (like confirm()).
   * @param {string} message The message to display.
   * @param {string} [title="Confirm"] The modal title.
   * @returns {Promise<boolean>} Resolves to true if confirmed, false otherwise.
   */
  async confirm(message, title = "Confirm") {
    return this._show({
      title,
      body: message,
      confirmText: "Confirm",
      cancelText: "Cancel",
      type: "confirm",
    });
  }

  /**
   * Shows an alert modal (like alert()).
   * @param {string} message The message to display.
   * @param {string} [title="Alert"] The modal title.
   * @returns {Promise<void>} Resolves when closed.
   */
  async alert(message, title = "Alert") {
    return this._show({
      title,
      body: message,
      confirmText: "OK",
      type: "alert",
    });
  }

  /**
   * Shows a prompt modal with an input field (like prompt()).
   * @param {string} message The label/message for the input.
   * @param {string} defaultValue The default value for the input.
   * @param {string} [title="Input Required"] The modal title.
   * @returns {Promise<string|null>} Resolves to the input string or null if cancelled.
   */
  async prompt(message, defaultValue = "", title = "Input Required") {
    return this._show({
      title,
      body: message,
      defaultValue,
      confirmText: "OK",
      cancelText: "Cancel",
      type: "prompt",
    });
  }

  _ensureStylesLoaded() {
    if (ModalComponent._stylesLoaded) return Promise.resolve();
    if (ModalComponent._styleLoadPromise)
      return ModalComponent._styleLoadPromise;

    const existing = document.getElementById("modal-styles");

    // Optimization: Check if stylesheet is already parsed (has a sheet property)
    // This handles cases where the load event fired before we started listening.
    if (existing && existing.sheet) {
      ModalComponent._stylesLoaded = true;
      return Promise.resolve();
    }

    ModalComponent._styleLoadPromise = new Promise((resolve) => {
      if (!existing) {
        console.warn("Modal stylesheet element not found, re-injecting...");
        this._injectStyles();
        // _injectStyles appends to head, so we can grab it now
        // But we need to wait for it to load, which logic below handles if we fetched it again
        // However, _injectStyles adds it to DOM, let's just fall through to the logic below
        // assuming _injectStyles works synchronously to add the element.
      }

      const linkEl = document.getElementById("modal-styles");

      if (linkEl) {
        // If it's already loaded by the time we get here (race condition), check sheet again
        if (linkEl.sheet) {
          ModalComponent._stylesLoaded = true;
          resolve();
          return;
        }

        const timeout = setTimeout(() => {
          console.warn("Modal stylesheet load timed out");
          ModalComponent._stylesLoaded = true; // Set to true anyway to avoid repeated delays
          resolve();
        }, 2000); // 2s timeout fallback

        linkEl.addEventListener(
          "load",
          () => {
            clearTimeout(timeout);
            ModalComponent._stylesLoaded = true;
            resolve();
          },
          { once: true },
        );
        linkEl.addEventListener(
          "error",
          () => {
            clearTimeout(timeout);
            console.error("Failed to load modal stylesheet");
            ModalComponent._stylesLoaded = true; // Resolve anyway to avoid hanging UI
            resolve();
          },
          { once: true },
        );
      } else {
        // Should be unreachable now
        resolve();
      }
    }).finally(() => {
      ModalComponent._styleLoadPromise = null;
    });

    return ModalComponent._styleLoadPromise;
  }

  async _show(options) {
    await this._ensureStylesLoaded();
    const modalId = ++ModalComponent._idCounter;
    const previouslyFocused = document.activeElement;

    return new Promise((resolve) => {
      let inputEl;
      if (options.type === "prompt") {
        inputEl = el("input", {
          type: "text",
          "aria-label": "Value",
          value: options.defaultValue || "",
        });
      }

      const confirmBtn = el(
        "button",
        {
          className: "modal-btn modal-btn-confirm",
        },
        options.confirmText || "OK",
      );

      const cancelBtn =
        options.type !== "alert"
          ? el(
              "button",
              {
                className: "modal-btn modal-btn-cancel",
              },
              options.cancelText || "Cancel",
            )
          : null;

      const closeX = el(
        "button",
        {
          className: "modal-close",
          "aria-label": "Close",
        },
        "×",
      );

      const titleId = `modal-title-${modalId}`;
      const bodyId = `modal-body-${modalId}`;

      const modalContent = el(
        "div",
        {
          className: "modal-content",
          role: "dialog",
          "aria-modal": "true",
          "aria-labelledby": titleId,
          "aria-describedby": bodyId,
        },
        el(
          "div",
          { className: "modal-header" },
          el("h3", { id: titleId }, options.title),
          closeX,
        ),
        el(
          "div",
          { className: "modal-body", id: bodyId },
          el("div", {}, options.body),
          inputEl,
        ),
        el("div", { className: "modal-footer" }, cancelBtn, confirmBtn),
      );

      const overlay = el("div", { className: "modal-overlay" }, modalContent);

      document.body.appendChild(overlay);

      // Focus Management and Keyboard Accessibility
      const focusableElementsString =
        'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"]), [contenteditable], audio[controls], video[controls]';
      let focusableElements = modalContent.querySelectorAll(
        focusableElementsString,
      );
      focusableElements = Array.from(focusableElements);
      const firstTabStop = focusableElements[0];
      const lastTabStop = focusableElements[focusableElements.length - 1];

      if (inputEl) {
        inputEl.focus();
        inputEl.select();
        inputEl.addEventListener("keydown", (e) => {
          if (e.key === "Enter") confirmBtn.click();
        });
      } else {
        // If no input, focus the first focusable element (usually cancel or confirm) or the modal itself
        if (firstTabStop) {
          firstTabStop.focus();
        } else {
          modalContent.setAttribute("tabindex", "-1");
          modalContent.focus();
        }
      }

      const trapTabKey = (e) => {
        if (
          e.key === "Tab" &&
          focusableElements.length > 0 &&
          firstTabStop &&
          lastTabStop
        ) {
          // SHIFT + TAB
          if (e.shiftKey) {
            if (document.activeElement === firstTabStop) {
              e.preventDefault();
              lastTabStop.focus();
            }
          } else {
            // TAB
            if (document.activeElement === lastTabStop) {
              e.preventDefault();
              firstTabStop.focus();
            }
          }
        }
        if (e.key === "Escape") {
          closeX.click();
        }
      };

      overlay.addEventListener("keydown", trapTabKey);

      const close = (result) => {
        overlay.removeEventListener("keydown", trapTabKey);
        overlay.style.opacity = "0"; // Fade out
        setTimeout(() => {
          if (document.body.contains(overlay)) {
            document.body.removeChild(overlay);
          }
          // Restore focus to the element that was focused before the modal opened
          if (previouslyFocused && previouslyFocused.focus) {
            previouslyFocused.focus();
          }
        }, 200);
        resolve(result);
      };

      confirmBtn.addEventListener("click", () => {
        let val;
        if (options.type === "prompt") {
          val = inputEl.value;
        } else if (options.type === "confirm") {
          val = true;
        } else if (options.type === "alert") {
          val = undefined;
        }
        close(val);
      });

      if (cancelBtn) {
        cancelBtn.addEventListener("click", () => {
          close(options.type === "confirm" ? false : null);
        });
      }

      closeX.addEventListener("click", () => {
        close(
          options.type === "confirm"
            ? false
            : options.type === "prompt"
              ? null
              : undefined,
        );
      });

      // Close on backdrop click
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          closeX.click();
        }
      });
    });
  }
}

export default ModalComponent;
