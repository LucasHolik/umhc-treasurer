// src/App.js
import store from './core/state.js';
import router from './core/router.js';
import AuthService from './services/auth.service.js';
import ApiService from './services/api.service.js';
import TransactionService from './services/transaction.service.js';
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
    this.subscriptions = [];
    try {
      AuthService.init();
    } catch (error) {
      console.error('Failed to initialize authentication:', error);
      store.setState('error', 'Authentication initialization failed. Please refresh or contact support.');
    }
    this.render();
    
    this.subscriptions.push(store.subscribe('currentUser', this.render.bind(this)));
    this.subscriptions.push(store.subscribe('isLoading', () => this.handleLoadingState()));
    this.subscriptions.push(store.subscribe('isUploading', () => this.handleLoadingState()));
    this.subscriptions.push(store.subscribe('isTagging', () => this.handleLoadingState()));
    this.subscriptions.push(store.subscribe('savingTags', () => this.handleLoadingState()));
    this.subscriptions.push(store.subscribe('settingsSyncing', () => this.handleLoadingState()));
    
    // Reactive Transaction Processing
    const updateProcessedTransactions = () => {
        const raw = store.getState('rawExpenses') || [];
        const splits = store.getState('splitTransactions') || [];
        // Only process if we have data (or empty array)
        const processed = TransactionService.mergeSplits(raw, splits);
        store.setState('expenses', processed);
    };

    this.subscriptions.push(store.subscribe('rawExpenses', updateProcessedTransactions));
    this.subscriptions.push(store.subscribe('splitTransactions', updateProcessedTransactions));

    this.dataUploadedHandler = () => {
        store.setState('isLoading', true);
        this.loadInitialData();
    };
    document.addEventListener('dataUploaded', this.dataUploadedHandler);
    
    this.hashChangeHandler = () => {
        const hash = window.location.hash.slice(1) || 'dashboard';
        this.updateActiveTab(hash);
    };
  }

  render() {
    if (AuthService.isLoggedIn()) {
      this.renderMainApp();
    } else {
      this.renderLogin();
    }
  }

  cleanupComponents() {
    if (this.loginComponent?.destroy) {
      this.loginComponent.destroy();
    }
  }

  renderLogin() {
    this.cleanupComponents();
    this.element.innerHTML = '<div id="login-root"></div>';
    this.loginComponent = new LoginComponent(this.element.querySelector('#login-root'));
  }

  renderMainApp() {
    store.setState('isLoading', true);
    this.element.innerHTML = `
      <div class="main-menu-container">
        <aside class="sidebar">
            <div class="logo-section">
                <img src="logo.jpg" alt="UMHC Logo" class="sidebar-logo">
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
                            <span class="nav-text">Manage Tags</span>
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

  cleanupMainApp() {
    // Cleanup components if they have destroy methods
    if (this.components) {
      Object.values(this.components).forEach(component => {
        if (component?.destroy) component.destroy();
      });
    }
    // Reset router
    if (router.reset) router.reset();
    
    // Remove hashchange listener specifically added in attachEventListeners
    window.removeEventListener('hashchange', this.hashChangeHandler);
  }

  initComponents() {
    this.cleanupMainApp();
    this.components = {};
    
    const dashboardEl = this.element.querySelector('#dashboard-content');
    const transactionsEl = this.element.querySelector('#transactions-content');
    const uploadEl = this.element.querySelector('#upload-content');
    const tagsEl = this.element.querySelector('#tags-content');
    const analysisEl = this.element.querySelector('#analysis-content');
    const settingsEl = this.element.querySelector('#settings-content');

    this.components.dashboard = new DashboardComponent(dashboardEl);
    this.components.transactions = new TransactionsComponent(transactionsEl);
    this.components.upload = new UploadComponent(uploadEl);
    this.components.tags = new TagsComponent(tagsEl);
    this.components.analysis = new AnalysisComponent(analysisEl);
    this.components.settings = new SettingsComponent(settingsEl);

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
    const savingTags = store.getState('savingTags');
    const settingsSyncing = store.getState('settingsSyncing');
    
    const activeNavItem = this.element.querySelector('.nav-item.active');
    const activeTab = activeNavItem ? activeNavItem.getAttribute('data-tab') : 'dashboard';

    const loaderContainer = this.element.querySelector('#global-loader-container');
    const contentWrapper = this.element.querySelector('.content-wrapper');
    const refreshBtn = this.element.querySelector('.refresh-btn');
    
    // Show global loader if loading (standard) 
    // OR if uploading and NOT on upload tab
    // OR if tagging and NOT on transactions tab
    // OR if savingTags and NOT on tags tab
    // OR if settingsSyncing and NOT on settings tab
        const shouldShowGlobalLoader = isLoading || 
                                      (isUploading && activeTab !== 'upload') ||
                                      (isTagging && activeTab !== 'transactions' && activeTab !== 'tags') ||
                                      (savingTags && activeTab !== 'tags') ||
                                      (settingsSyncing && activeTab !== 'settings');
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
    const logoutBtn = this.element.querySelector('#logout-button');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        AuthService.logout();
      });
    }
    
    const refreshBtn = this.element.querySelector('.refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            this.loadInitialData();
        });
    }
    
    // Handle navigation via hash change (Unidirectional Flow)
    window.addEventListener('hashchange', this.hashChangeHandler);

    // Initial check
    const initialTab = window.location.hash.slice(1) || 'dashboard';
    this.updateActiveTab(initialTab);
  }

  updateActiveTab(tabName) {
      // 1. Update Sidebar Selection
      const navItems = this.element.querySelectorAll('.nav-item');
      navItems.forEach(i => {
          if (i.getAttribute('data-tab') === tabName) {
              i.classList.add('active');
          } else {
              i.classList.remove('active');
          }
      });

      // 2. Update Page Title
      const title = tabName.charAt(0).toUpperCase() + tabName.slice(1);
      const pageTitle = this.element.querySelector('#page-title');
      if (pageTitle) {
        pageTitle.textContent = title;
      }

      // 3. Handle Loading State specific to new tab
      this.handleLoadingState();
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
        // Store raw expenses. This triggers the subscription in constructor to process and update 'expenses'
        store.setState('rawExpenses', appData.data.expenses);
        store.setState('tags', appData.data.tags);
        store.setState('openingBalance', appData.data.openingBalance);
        // Set split transactions from the single API call
        store.setState('splitTransactions', appData.data.splitTransactions || []);

      } else {
          console.error("API returned success: false", appData);
          store.setState('error', appData.message || "Failed to load data");
      }

    } catch (error) {
      console.error("Load initial data error:", error);
      store.setState('error', error.message);
    } finally {
      store.setState('isLoading', false);
    }
  }

  destroy() {
    this.cleanupMainApp();
    this.cleanupComponents();
    
    if (this.dataUploadedHandler) {
      document.removeEventListener('dataUploaded', this.dataUploadedHandler);
    }
    
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
  }
}

new App(document.getElementById('app'));