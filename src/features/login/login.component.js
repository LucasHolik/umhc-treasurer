// src/features/login/login.component.js
import AuthService from '../../services/auth.service.js';
import ApiService from '../../services/api.service.js';
import store from '../../core/state.js';
import LoaderComponent from '../../shared/loader.component.js';

class LoginComponent {
  constructor(element) {
    this.element = element;
    this.loader = new LoaderComponent();
    this.isEditingUrl = false;
    this.render();
    
    store.subscribe('error', this.handleError.bind(this));
    store.subscribe('isLoading', this.handleLoading.bind(this));
  }

  render() {
    if (!ApiService.hasScriptUrl() || this.isEditingUrl) {
      this.renderSetup();
    } else {
      this.renderLogin();
    }
  }

  renderSetup() {
    const currentUrl = ApiService.getScriptUrl() || '';
    
    this.element.innerHTML = `
      <div class="login-container">
        <img src="logo.jpg" alt="UMHC Logo" class="logo">
        <div class="instruction-text">${this.isEditingUrl ? 'Update' : 'Enter'} Google Apps Script URL</div>
        <div class="input-group">
          <input type="text" id="script-url-input" aria-label="Script URL" placeholder="Script URL" value="${currentUrl}">
          <button id="save-url-button">Save</button>
        </div>
        <div class="action-area">
             ${this.isEditingUrl ? '<button id="cancel-url-button">Cancel</button>' : ''}
        </div>
        <div class="status-container">
             <div id="login-status"></div>
        </div>
      </div>
    `;

    const urlInput = this.element.querySelector('#script-url-input');
    const saveButton = this.element.querySelector('#save-url-button');
    this.loginStatus = this.element.querySelector('#login-status');
    
    if (this.isEditingUrl) {
        const cancelButton = this.element.querySelector('#cancel-url-button');
        cancelButton.addEventListener('click', () => {
            this.isEditingUrl = false;
            store.setState('error', null);
            this.render();
        });
    }

    saveButton.addEventListener('click', () => this.handleSaveUrl(urlInput.value));
    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.handleSaveUrl(urlInput.value);
      }
    });
  }

  renderLogin() {
    this.element.innerHTML = `
      <div class="login-container">
        <img src="logo.jpg" alt="UMHC Logo" class="logo">
        <div class="instruction-text">Please enter your API Key</div>
        <div class="input-group">
          <input type="password" id="api-key" aria-label="API Key" placeholder="API Key">
          <button id="login-button">Login</button>
        </div>
        <div class="action-area">
            <button id="change-url-button">Change Script URL</button>
        </div>
        <div class="status-container">
          <div id="login-status"></div>
        </div>
      </div>
    `;
    
    this.apiKeyInput = this.element.querySelector('#api-key');
    const loginButton = this.element.querySelector('#login-button');
    const changeUrlButton = this.element.querySelector('#change-url-button');
    this.loginStatus = this.element.querySelector('#login-status');

    loginButton.addEventListener('click', this.handleLogin.bind(this));
    this.apiKeyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.handleLogin();
      }
    });
    
    changeUrlButton.addEventListener('click', () => {
        this.isEditingUrl = true;
        store.setState('error', null);
        this.render();
    });
  }

  handleSaveUrl(url) {
    if (!url) {
       store.setState('error', 'Please enter a valid URL.');
       return;
    }

    let cleanUrl = url.trim();
    // Remove surrounding quotes if present (common copy-paste error)
    if ((cleanUrl.startsWith('"') && cleanUrl.endsWith('"')) || 
        (cleanUrl.startsWith("'") && cleanUrl.endsWith("'"))) {
        cleanUrl = cleanUrl.slice(1, -1);
    }

    try {
        new URL(cleanUrl); // Validation check
    } catch (e) {
        store.setState('error', 'Invalid URL format. Please check for spaces or typos.');
        return;
    }

    ApiService.setScriptUrl(cleanUrl);
    this.isEditingUrl = false;
    store.setState('error', null);
    this.render();
  }

  async handleLogin() {
    const apiKey = this.apiKeyInput.value.trim();
    if (!apiKey) {
      store.setState('error', 'Please enter an API key.');
      return;
    }
    await AuthService.login(apiKey);
  }

  handleError(error) {
    if (this.loginStatus) {
        if (error) {
            this.loginStatus.innerHTML = `<div class="status-message error">${error}</div>`;
        } else {
            // Only clear if we are NOT loading
            if (!store.getState('isLoading')) {
                this.loginStatus.innerHTML = '';
            }
        }
    }
  }

  handleLoading(isLoading) {
    if (this.loginStatus) {
        if (isLoading) {
            this.loginStatus.replaceChildren(this.loader.render());
        } else {
            // Don't clear error messages when loading is finished
            if (!store.getState('error')) {
                this.loginStatus.innerHTML = '';
            }
        }
    }
  }
}

export default LoginComponent;