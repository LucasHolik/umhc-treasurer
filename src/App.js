// src/App.js
import store from './core/state.js';
import router from './core/router.js';
import AuthService from './services/auth.service.js';
import ApiService from './services/api.service.js';
import LoginComponent from './features/login/login.component.js';
import DashboardComponent from './features/dashboard/dashboard.component.js';
import UploadComponent from './features/upload/upload.component.js';
import TransactionsComponent from './features/transactions/transactions.component.js';
import TagsComponent from './features/tags/tags.component.js';
import SettingsComponent from './features/settings/settings.component.js';

class App {
  constructor(element) {
    this.element = element;
    AuthService.init();
    this.render();
    store.subscribe('currentUser', this.render.bind(this));
    document.addEventListener('dataUploaded', this.loadInitialData.bind(this));
  }

  render() {
    if (AuthService.isLoggedIn()) {
      this.renderMainApp();
    } else {
      this.renderLogin();
    }
  }

  renderLogin() {
    this.element.innerHTML = '<div id="login-root"></div>';
    new LoginComponent(this.element.querySelector('#login-root'));
  }

  renderMainApp() {
    this.element.innerHTML = `
      <div class="main-container">
        <aside class="sidebar">
            <div class="sidebar-header">
                <img src="Logo.jpg" alt="UMHC Logo" class="logo">
                <h1>UMHC Treasurer</h1>
            </div>
            <nav class="main-nav">
                <ul>
                    <li class="nav-item active" data-tab="dashboard"><a href="#dashboard">Dashboard</a></li>
                    <li class="nav-item" data-tab="transactions"><a href="#transactions">Transactions</a></li>
                    <li class="nav-item" data-tab="upload"><a href="#upload">Upload</a></li>
                    <li class="nav-item" data-tab="tags"><a href="#tags">Tags</a></li>
                    <li class="nav-item" data-tab="settings"><a href="#settings">Settings</a></li>
                </ul>
            </nav>
            <div class="sidebar-footer">
                <button id="logout-button">Logout</button>
            </div>
        </aside>
        <main class="main-content">
            <header class="main-header">
              <h2 id="page-title">Dashboard</h2>
            </header>
            <section id="dashboard-content" class="tab-content"></section>
            <section id="transactions-content" class="tab-content"></section>
            <section id="upload-content" class="tab-content"></section>
            <section id="tags-content" class="tab-content"></section>
            <section id="settings-content" class="tab-content"></section>
        </main>
      </div>
    `;
    this.initComponents();
    this.attachEventListeners();
    this.loadInitialData();
  }

  initComponents() {
    const dashboardEl = this.element.querySelector('#dashboard-content');
    const transactionsEl = this.element.querySelector('#transactions-content');
    const uploadEl = this.element.querySelector('#upload-content');
    const tagsEl = this.element.querySelector('#tags-content');
    const settingsEl = this.element.querySelector('#settings-content');

    new DashboardComponent(dashboardEl);
    new TransactionsComponent(transactionsEl);
    new UploadComponent(uploadEl);
    new TagsComponent(tagsEl);
    new SettingsComponent(settingsEl);

    router.register('dashboard', dashboardEl);
    router.register('transactions', transactionsEl);
    router.register('upload', uploadEl);
    router.register('tags', tagsEl);
    router.register('settings', settingsEl);
    router.start();
  }

  attachEventListeners() {
    this.element.querySelector('#logout-button').addEventListener('click', () => {
      AuthService.logout();
    });
    
    const navItems = this.element.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            navItems.forEach(i => i.classList.remove('active'));
            e.currentTarget.classList.add('active');
            const tabName = e.currentTarget.getAttribute('data-tab');
            this.element.querySelector('#page-title').textContent = tabName.charAt(0).toUpperCase() + tabName.slice(1);
            
            // hide all tab content
            this.element.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
            // show current tab content
            this.element.querySelector(`#${tabName}-content`).classList.add('active');
        });
    });

    // Set initial active tab
    const initialTab = window.location.hash.slice(1) || 'dashboard';
    this.element.querySelector(`.nav-item[data-tab="${initialTab}"]`).click();

  }

  async loadInitialData() {
    store.setState('isLoading', true);
    try {
      const appData = await ApiService.getAppData();
      if (appData.success) {
        store.setState('expenses', appData.data.expenses);
        store.setState('tags', appData.data.tags);
      }
      const balanceData = await ApiService.getOpeningBalance();
      if (balanceData.success) {
        store.setState('openingBalance', balanceData.balance);
      }
    } catch (error) {
      store.setState('error', error.message);
    } finally {
      store.setState('isLoading', false);
    }
  }
}

new App(document.getElementById('app'));
