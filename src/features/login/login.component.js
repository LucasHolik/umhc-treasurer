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
    this.render();

    this.errorUnsubscribe = store.subscribe(
      "error",
      this.handleError.bind(this)
    );
    this.loadingUnsubscribe = store.subscribe(
      "isLoading",
      this.handleLoading.bind(this)
    );
  }

  destroy() {
    if (this.errorUnsubscribe) this.errorUnsubscribe.unsubscribe();
    if (this.loadingUnsubscribe) this.loadingUnsubscribe.unsubscribe();
  }

  render() {
    if (!ApiService.hasScriptUrl() || this.isEditingUrl) {
      this.renderSetup();
    } else {
      this.renderLogin();
    }
  }

  renderSetup() {
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
      "Save"
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
          "Cancel"
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
          : "Enter Google Apps Script URL"
      ),
      el("div", { className: "input-group" }, urlInput, saveButton),
      el("div", { className: "action-area" }, cancelButton),
      el("div", { className: "status-container" }, this.loginStatus)
    );

    replace(this.element, container);
  }

  renderLogin() {
    this.apiKeyInput = el("input", {
      type: "password",
      id: "api-key",
      "aria-label": "API Key",
      placeholder: "API Key",
    });

    this.apiKeyInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        this.handleLogin();
      }
    });

    const loginButton = el(
      "button",
      {
        id: "login-button",
        onclick: this.handleLogin.bind(this),
      },
      "Login"
    );

    const changeUrlButton = el(
      "button",
      {
        id: "change-url-button",
        onclick: () => {
          this.isEditingUrl = true;
          store.setState("error", null);
          this.render();
        },
      },
      "Change Script URL"
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
      el("div", { className: "instruction-text" }, "Please enter your API Key"),
      el("div", { className: "input-group" }, this.apiKeyInput, loginButton),
      el("div", { className: "action-area" }, changeUrlButton),
      el("div", { className: "status-container" }, this.loginStatus)
    );

    replace(this.element, container);
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

    try {
      new URL(cleanUrl); // Validation check
    } catch (e) {
      store.setState(
        "error",
        "Invalid URL format. Please check for spaces or typos."
      );
      return;
    }

    ApiService.setScriptUrl(cleanUrl);
    this.isEditingUrl = false;
    store.setState("error", null);
    this.render();
  }

  async handleLogin() {
    const apiKey = this.apiKeyInput.value.trim();
    if (!apiKey) {
      store.setState("error", "Please enter an API key.");
      return;
    }
    try {
      await AuthService.login(apiKey);
    } catch (error) {
      store.setState(
        "error",
        error.message || "Login failed. Please try again."
      );
    }
  }

  handleError(error) {
    if (this.loginStatus) {
      if (error) {
        replace(
          this.loginStatus,
          el("div", { className: "status-message error", role: "alert" }, error)
        );
      } else {
        // Only clear if we are NOT loading
        if (!store.getState("isLoading")) {
          replace(this.loginStatus);
        }
      }
    }
  }

  handleLoading(isLoading) {
    if (this.loginStatus) {
      if (isLoading) {
        replace(this.loginStatus, this.loader.render());
      } else {
        // Don't clear error messages when loading is finished
        if (!store.getState("error")) {
          replace(this.loginStatus);
        }
      }
    }
  }
}

export default LoginComponent;
