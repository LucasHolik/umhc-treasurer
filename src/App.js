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
import AnalysisComponent from './features/analysis/analysis.component.js';
import SettingsComponent from './features/settings/settings.component.js';
import LoaderComponent from './shared/loader.component.js';

class App {
  constructor(element) {
    this.element = element;
    AuthService.init();
    this.render();
    store.subscribe('currentUser', this.render.bind(this));
    store.subscribe('isLoading', () => this.handleLoadingState());
    store.subscribe('isUploading', () => this.handleLoadingState());
    store.subscribe('isTagging', () => this.handleLoadingState());
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
    store.setState('isLoading', true);
    this.element.innerHTML = `
      <div class="main-menu-container">
        <aside class="sidebar">
            <div class="logo-section">
                <img src="Logo.jpg" alt="UMHC Logo" class="sidebar-logo">
                <h2>UMHC Treasurer</h2>
            </div>
            <nav class="nav-menu">
                <ul>
                    <li class="nav-item active" data-tab="dashboard">
                        <a href="#dashboard">
                            <span class="nav-icon">📊</span>
                            <span class="nav-text">Dashboard</span>
                        </a>
                    </li>
                    <li class="nav-item" data-tab="transactions">
                        <a href="#transactions">
                            <span class="nav-icon">💳</span>
                            <span class="nav-text">Transactions</span>
                        </a>
                    </li>
                    <li class="nav-item" data-tab="upload">
                        <a href="#upload">
                            <span class="nav-icon">📤</span>
                            <span class="nav-text">Upload</span>
                        </a>
                    </li>
                    <li class="nav-item" data-tab="tags">
                        <a href="#tags">
                            <span class="nav-icon">🏷️</span>
                            <span class="nav-text">Tags</span>
                        </a>
                    </li>
                    <li class="nav-item" data-tab="analysis">
                        <a href="#analysis">
                            <span class="nav-icon">📈</span>
                            <span class="nav-text">Analysis</span>
                        </a>
                    </li>
                    <li class="nav-item" data-tab="settings">
                        <a href="#settings">
                            <span class="nav-icon">⚙️</span>
                            <span class="nav-text">Settings</span>
                        </a>
                    </li>
                </ul>
            </nav>
            <div class="sidebar-footer" style="padding: 20px; text-align: center;">
                <button id="logout-button" style="background-color: transparent; border: 1px solid #d9534f; color: #d9534f; padding: 8px 15px; border-radius: 4px; cursor: pointer;">Logout</button>
            </div>
        </aside>
        <main class="main-content">
            <header class="main-header">
              <div class="header-content">
                <h1 id="page-title">Dashboard</h1>
                <button class="refresh-btn" title="Refresh Data">🔄</button>
              </div>
            </header>
            <div id="global-loader-container" style="display: none; justify-content: center; align-items: center; height: 80%; width: 100%;">
                ${new LoaderComponent().render()}
            </div>
            <div class="content-wrapper">
                <section id="dashboard-content" class="tab-content"></section>
                <section id="transactions-content" class="tab-content"></section>
                <section id="upload-content" class="tab-content"></section>
                <section id="tags-content" class="tab-content"></section>
                <section id="analysis-content" class="tab-content"></section>
                <section id="settings-content" class="tab-content"></section>
            </div>
        </main>
      </div>
    `;
    this.initComponents();
    this.attachEventListeners();
    this.handleLoadingState();
    this.loadInitialData();
  }

  initComponents() {
    const dashboardEl = this.element.querySelector('#dashboard-content');
    const transactionsEl = this.element.querySelector('#transactions-content');
    const uploadEl = this.element.querySelector('#upload-content');
    const tagsEl = this.element.querySelector('#tags-content');
    const analysisEl = this.element.querySelector('#analysis-content');
    const settingsEl = this.element.querySelector('#settings-content');

    new DashboardComponent(dashboardEl);
    new TransactionsComponent(transactionsEl);
    new UploadComponent(uploadEl);
    new TagsComponent(tagsEl);
    new AnalysisComponent(analysisEl);
    new SettingsComponent(settingsEl);

    router.register('dashboard', dashboardEl);
    router.register('transactions', transactionsEl);
    router.register('upload', uploadEl);
    router.register('tags', tagsEl);
    router.register('analysis', analysisEl);
    router.register('settings', settingsEl);
    router.start();
  }

  handleLoadingState() {
    const isLoading = store.getState('isLoading');
    const isUploading = store.getState('isUploading');
    const isTagging = store.getState('isTagging');
    
    const activeNavItem = this.element.querySelector('.nav-item.active');
    const activeTab = activeNavItem ? activeNavItem.getAttribute('data-tab') : 'dashboard';

    const loaderContainer = this.element.querySelector('#global-loader-container');
    const contentWrapper = this.element.querySelector('.content-wrapper');
    const refreshBtn = this.element.querySelector('.refresh-btn');
    
    // Show global loader if loading (standard) 
    // OR if uploading and NOT on upload tab
    // OR if tagging and NOT on transactions tab
    const shouldShowGlobalLoader = isLoading || 
                                  (isUploading && activeTab !== 'upload') ||
                                  (isTagging && activeTab !== 'transactions');

    if (loaderContainer && contentWrapper) {
        if (shouldShowGlobalLoader) {
            loaderContainer.style.display = 'flex';
            contentWrapper.style.display = 'none';
            if (refreshBtn) refreshBtn.textContent = "⏳";
        } else {
            loaderContainer.style.display = 'none';
            contentWrapper.style.display = 'block';
            if (refreshBtn) refreshBtn.textContent = "🔄";
        }
    }
  }

  attachEventListeners() {
    this.element.querySelector('#logout-button').addEventListener('click', () => {
      AuthService.logout();
    });
    
    const refreshBtn = this.element.querySelector('.refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            this.loadInitialData();
        });
    }
    
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

            this.handleLoadingState();
        });
    });

    // Set initial active tab
    const initialTab = window.location.hash.slice(1) || 'dashboard';
    const activeNavItem = this.element.querySelector(`.nav-item[data-tab="${initialTab}"]`);
    if (activeNavItem) {
        activeNavItem.click();
    }
  }

  async loadInitialData() {
    try {
      console.log("Fetching initial data...");
      const appData = await ApiService.getAppData();
      console.log("API Response:", appData);

      if (appData.success) {
        console.log("Expenses loaded:", appData.data.expenses ? appData.data.expenses.length : 0);
        if (appData.data.expenses && appData.data.expenses.length > 0) {
            console.log("First expense sample:", appData.data.expenses[0]);
        }
        store.setState('expenses', appData.data.expenses);
        store.setState('tags', appData.data.tags);
        store.setState('openingBalance', appData.data.openingBalance);
      } else {
          console.error("API returned success: false", appData);
          store.setState('error', appData.message || "Failed to load data");
      }
    } catch (error) {
      console.error("Load initial data error:", error);
      store.setState('error', error.message);
    }
  }
}

new App(document.getElementById('app'));
