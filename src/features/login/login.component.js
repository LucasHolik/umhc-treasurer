// src/features/login/login.component.js
import AuthService from "../../services/auth.service.js";
import ApiService from "../../services/api.service.js";
import store from "../../core/state.js";
import LoaderComponent from "../../shared/loader.component.js";
import { el, replace } from "../../core/dom.js";
import { CONFIG } from "../../core/config.js";

class LoginComponent {
  constructor(element) {
    this.element = element;
    this.loader = new LoaderComponent();
    this.isEditingUrl = false;
    this.apiKeyInput = null;
    this.loginButton = null;
    this.changeUrlButton = null;
    this.render();

    const sync = () => this.syncStatusAndControls();
    this.subscriptions = [
      store.subscribe("error", sync),
      store.subscribe("isLoading", sync),
      store.subscribe("isVerifyingSession", sync),
    ];

    // Sync initial store state (isLoading, isVerifyingSession, error).
    this.syncStatusAndControls();
  }

  destroy() {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions = [];
  }

  render() {
    if (!ApiService.hasScriptUrl() || this.isEditingUrl) {
      this.renderSetup();
    } else {
      this.renderLogin();
    }
  }

  renderSetup() {
    this.apiKeyInput = null;
    this.loginButton = null;
    this.changeUrlButton = null;

    const currentUrl = ApiService.getScriptUrl() || "";

    const urlInput = el("input", {
      type: "text",
      id: "script-url-input",
      "aria-label": "Script URL",
      placeholder: "Script URL",
      value: currentUrl,
    });

    const saveButton = el(
      "button",
      {
        id: "save-url-button",
        onclick: () => this.handleSaveUrl(urlInput.value),
      },
      "Save",
    );

    // Keydown listener for input
    urlInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        this.handleSaveUrl(urlInput.value);
      }
    });

    const cancelButton = this.isEditingUrl
      ? el(
          "button",
          {
            id: "cancel-url-button",
            onclick: () => {
              this.isEditingUrl = false;
              store.setState("error", null);
              this.render();
            },
          },
          "Cancel",
        )
      : null;

    this.loginStatus = el("div", { id: "login-status" });

    const container = el(
      "div",
      { className: "login-container" },
      el("img", {
        src: CONFIG.LOGO_PATH,
        alt: "UMHC Logo",
        className: "logo",
        onerror: (e) => (e.target.style.display = "none"),
      }),
      el(
        "div",
        { className: "instruction-text" },
        this.isEditingUrl
          ? "Update Google Apps Script URL"
          : "Enter Google Apps Script URL",
      ),
      el("div", { className: "input-group" }, urlInput, saveButton),
      el("div", { className: "action-area" }, cancelButton),
      el("div", { className: "status-container" }, this.loginStatus),
    );

    replace(this.element, container);
    this.syncStatusAndControls();
  }

  renderLogin() {
    this.apiKeyInput = el("input", {
      type: "password",
      id: "api-key",
      "aria-label": "Passkey",
      placeholder: "Passkey",
      onkeydown: (e) => {
        if (e.key === "Enter") {
          this.handleLogin();
        }
      },
    });

    this.loginButton = el(
      "button",
      {
        id: "login-button",
        onclick: this.handleLogin.bind(this),
      },
      "Login",
    );

    this.changeUrlButton = el(
      "button",
      {
        id: "change-url-button",
        onclick: () => {
          if (
            store.getState("isLoading") ||
            store.getState("isVerifyingSession")
          ) {
            return;
          }
          this.isEditingUrl = true;
          store.setState("error", null);
          this.render();
        },
      },
      "Change Script URL",
    );

    this.loginStatus = el("div", { id: "login-status" });

    const container = el(
      "div",
      { className: "login-container" },
      el("img", {
        src: CONFIG.LOGO_PATH,
        alt: "UMHC Logo",
        className: "logo",
        onerror: (e) => (e.target.style.display = "none"),
      }),
      el("div", { className: "instruction-text" }, "Please enter your Passkey"),
      el(
        "div",
        { className: "input-group" },
        this.apiKeyInput,
        this.loginButton,
      ),
      el("div", { className: "action-area" }, this.changeUrlButton),
      el("div", { className: "status-container" }, this.loginStatus),
    );

    replace(this.element, container);
    this.syncStatusAndControls();
  }

  handleSaveUrl(url) {
    if (!url) {
      store.setState("error", "Please enter a valid URL.");
      return;
    }

    let cleanUrl = url.trim();
    // Remove surrounding quotes if present (common copy-paste error)
    if (
      (cleanUrl.startsWith('"') && cleanUrl.endsWith('"')) ||
      (cleanUrl.startsWith("'") && cleanUrl.endsWith("'"))
    ) {
      cleanUrl = cleanUrl.slice(1, -1);
    }

    let parsed;
    try {
      parsed = new URL(cleanUrl);
    } catch (e) {
      store.setState(
        "error",
        "Invalid URL format. Please check for spaces or typos.",
      );
      return;
    }
    if (
      parsed.hostname !== "script.google.com" ||
      !parsed.pathname.startsWith("/macros/s/")
    ) {
      store.setState(
        "error",
        "URL must be a Google Apps Script URL (script.google.com/macros/s/...).",
      );
      return;
    }

    ApiService.setScriptUrl(cleanUrl);
    this.isEditingUrl = false;
    store.setState("error", null);
    this.render();
  }

  async handleLogin() {
    if (
      !this.apiKeyInput ||
      store.getState("isLoading") ||
      store.getState("isVerifyingSession")
    ) {
      return;
    }

    const apiKey = this.apiKeyInput.value.trim();
    if (!apiKey) {
      store.setState("error", "Please enter a passkey.");
      return;
    }
    try {
      await AuthService.login(apiKey);
    } catch (error) {
      store.setState(
        "error",
        error.message || "Login failed. Please try again.",
      );
    }
  }

  /**
   * Synchronises login controls and status feedback with the store's loading,
   * session-verification, and error state.
   */
  syncStatusAndControls() {
    const isLoading = Boolean(store.getState("isLoading"));
    const isVerifying = Boolean(store.getState("isVerifyingSession"));
    const isBusy = isLoading || isVerifying;
    const error = store.getState("error");

    if (this.apiKeyInput) {
      this.apiKeyInput.disabled = isBusy;
    }
    if (this.loginButton) {
      this.loginButton.disabled = isBusy;
      this.loginButton.textContent = isVerifying ? "Verifying..." : "Login";
    }
    if (this.changeUrlButton) {
      this.changeUrlButton.disabled = isBusy;
    }

    if (!this.loginStatus) return;

    if (isLoading) {
      replace(this.loginStatus, this.loader.render());
    } else if (isVerifying) {
      replace(
        this.loginStatus,
        el(
          "div",
          {
            className: "status-message",
            style: { color: "#f0ad4e", fontWeight: "bold" },
          },
          "Verifying session...",
        ),
      );
    } else if (error) {
      replace(
        this.loginStatus,
        el("div", { className: "status-message error", role: "alert" }, error),
      );
    } else {
      replace(this.loginStatus);
    }
  }
}

export default LoginComponent;
