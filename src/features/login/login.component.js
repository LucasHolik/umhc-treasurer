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
      <style>
        .login-box {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .login-logo {
          width: 80px;
          margin-bottom: 20px;
        }
        .input-group {
          display: flex;
          width: 100%;
        }
        #api-key-input {
          padding: 15px;
          border: 1px solid #f0ad4e;
          border-right: none;
          border-radius: 5px 0 0 5px;
          font-size: 16px;
          width: 100%;
          text-align: center;
          box-sizing: border-box;
          background-color: #1a6b10;
          color: #fff;
        }
        #api-key-input:focus {
          outline: none;
        }
        #login-button {
          padding: 15px 25px;
          border: 1px solid #f0ad4e;
          border-radius: 0 5px 5px 0;
          background-color: #f0ad4e;
          color: #fff;
          font-size: 16px;
          cursor: pointer;
          white-space: nowrap;
        }
      </style>
      <div class="login-container">
        <div class="login-box">
          <img src="Logo.jpg" alt="UMHC Logo" class="login-logo">
          <div class="input-group">
            <input type="password" id="api-key-input" placeholder="API Key">
            <button id="login-button">Login</button>
          </div>
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
