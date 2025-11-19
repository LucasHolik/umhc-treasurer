// src/features/login/login.component.js
import AuthService from '../../services/auth.service.js';
import store from '../../core/state.js';

class LoginComponent {
  constructor(element) {
    this.element = element;
    this.render();
    this.attachEventListeners();
    store.subscribe('error', this.handleError.bind(this));
    store.subscribe('isLoading', this.handleLoading.bind(this));
  }

  render() {
    this.element.innerHTML = `
      <div class="login-container">
        <div class="login-box">
          <img src="Logo.jpg" alt="UMHC Logo" class="login-logo">
          <h2>Treasurer's App</h2>
          <p>Please enter the API key to continue.</p>
          <input type="password" id="api-key-input" placeholder="API Key">
          <button id="login-button">Login</button>
          <div id="login-status"></div>
        </div>
      </div>
    `;
    this.apiKeyInput = this.element.querySelector('#api-key-input');
    this.loginButton = this.element.querySelector('#login-button');
    this.loginStatus = this.element.querySelector('#login-status');
  }

  attachEventListeners() {
    this.loginButton.addEventListener('click', this.handleLogin.bind(this));
    this.apiKeyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.handleLogin();
      }
    });
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
        this.loginStatus.innerHTML = error ? `<div class="status-message error">${error}</div>` : '';
    }
  }

  handleLoading(isLoading) {
    if (this.loginStatus) {
        if (isLoading) {
            this.loginStatus.innerHTML = `<div class="loader"></div>`;
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
