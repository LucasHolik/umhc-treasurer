// src/features/settings/settings.component.js
import store from '../../core/state.js';
import ApiService from '../../services/api.service.js';
import ModalComponent from '../../shared/modal.component.js';
import { formatCurrency } from '../../core/utils.js';

class SettingsComponent {
  constructor(element) {
    this.element = element;
    this.modal = new ModalComponent();
    this.render();
    this.attachEventListeners();
    store.subscribe('openingBalance', this.render.bind(this));
    store.subscribe('settingsSyncing', this.render.bind(this));
  }

  render() {
    const settingsSyncing = store.getState('settingsSyncing');

    if (settingsSyncing) {
        this.renderSavingState();
        return;
    }

    const currentBalance = store.getState('openingBalance') || 0;
    const formattedBalance = formatCurrency(currentBalance);

    this.element.innerHTML = `
      <div class="section">
        <div class="transactions-header">
            <h2>Settings</h2>
        </div>
        
        <div style="margin-top: 30px; padding: 20px; background-color: rgba(255, 255, 255, 0.05); border-radius: 8px;">
             <div style="display: flex; align-items: center; gap: 20px;">
                <div>
                    <label style="display: block; color: #f0ad4e; font-weight: bold; margin-bottom: 5px; text-transform: uppercase; font-size: 0.85em;">Opening Balance</label>
                    <div style="font-size: 1.5em;">${formattedBalance}</div>
                </div>
                <button id="edit-opening-balance" class="secondary-btn" title="Edit Opening Balance">✏️ Edit</button>
             </div>
        </div>
        
        <div id="settings-status" style="margin-top: 20px;"></div>
      </div>
    `;

    this.editButton = this.element.querySelector('#edit-opening-balance');
    this.status = this.element.querySelector('#settings-status');
    
    this.attachEventListeners();
  }

  renderSavingState() {
      this.element.innerHTML = `
        <div class="section" style="height: 400px; display: flex; flex-direction: column; justify-content: center; align-items: center;">
            <div class="loader" style="width: 50px; height: 50px; margin-bottom: 20px;"></div>
            <h3 style="color: #f0ad4e; margin-bottom: 10px;">Saving Settings...</h3>
            <p style="color: #fff; font-size: 1.1em;">Updating and syncing data.</p>
        </div>
      `;
  }

  attachEventListeners() {
    if (this.editButton) {
        this.editButton.addEventListener('click', this.handleEdit.bind(this));
    }
  }

  async handleEdit() {
    const currentBalance = store.getState('openingBalance') || 0;
    const newBalanceStr = await this.modal.prompt("Enter new Opening Balance (£):", currentBalance.toString(), "Edit Opening Balance");
    
    if (newBalanceStr === null) return; // Cancelled

    const newBalance = parseFloat(newBalanceStr);
    if (isNaN(newBalance)) {
        await this.modal.alert('Please enter a valid number.');
        return;
    }

    this.handleSave(newBalance);
  }

  async handleSave(balance) {
    store.setState('settingsSyncing', true);
    
    try {
      await ApiService.saveOpeningBalance(balance, { skipLoading: true });
      store.setState('openingBalance', balance); // Optimistic update before reload
      
      // Trigger full site refresh logic
      document.dispatchEvent(new CustomEvent('dataUploaded'));

      // We turn off the syncing state, but the global loader (from App.js responding to dataUploaded) 
      // will likely take over immediately.
      store.setState('settingsSyncing', false);

    } catch (error) {
      console.error("Settings save failed:", error);
      store.setState('settingsSyncing', false);
      // We need to re-render to show the error since we turned off the loading state
      this.render(); 
      // Use setTimeout to ensure DOM is ready after re-render
      setTimeout(() => this.displayStatus(`Error: ${error.message}`, 'error'), 0);
    }
  }

  displayStatus(message, type) {
    if (this.status) {
        const color = type === 'error' ? '#d9534f' : '#5cb85c';
        this.status.innerHTML = `<div style="color: ${color}; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 4px; display: inline-block;">${message}</div>`;
    }
  }
}

export default SettingsComponent;
