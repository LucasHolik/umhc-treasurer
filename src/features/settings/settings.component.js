// src/features/settings/settings.component.js
import store from '../../core/state.js';
import ApiService from '../../services/api.service.js';

class SettingsComponent {
  constructor(element) {
    this.element = element;
    this.render();
    this.attachEventListeners();
    store.subscribe('openingBalance', this.updateOpeningBalanceInput.bind(this));
  }

  render() {
    this.element.innerHTML = `
      <div class="settings-container">
        <h3>Settings</h3>
        <div class="setting-item">
          <label for="opening-balance">Opening Balance (£)</label>
          <input type="number" id="opening-balance" step="0.01">
          <button id="save-opening-balance">Save</button>
          <div id="settings-status"></div>
        </div>
      </div>
    `;
    this.openingBalanceInput = this.element.querySelector('#opening-balance');
    this.saveButton = this.element.querySelector('#save-opening-balance');
    this.status = this.element.querySelector('#settings-status');
  }

  attachEventListeners() {
    this.saveButton.addEventListener('click', this.handleSave.bind(this));
  }
  
  updateOpeningBalanceInput(balance) {
      if(this.openingBalanceInput) {
        this.openingBalanceInput.value = balance;
      }
  }

  async handleSave() {
    const balance = parseFloat(this.openingBalanceInput.value);
    if (isNaN(balance)) {
      this.displayStatus('Please enter a valid number.', 'error');
      return;
    }
    
    this.displayStatus('Saving...', 'info');
    try {
      await ApiService.saveOpeningBalance(balance);
      store.setState('openingBalance', balance);
      this.displayStatus('Opening balance saved successfully.', 'success');
    } catch (error) {
      this.displayStatus(`Error: ${error.message}`, 'error');
    }
  }

  displayStatus(message, type) {
    this.status.innerHTML = `<div class="status-message ${type}">${message}</div>`;
  }
}

export default SettingsComponent;
