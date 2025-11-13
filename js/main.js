// js/main.js

import { UI } from './modules/ui.js';
import { API } from './modules/api.js';
import { Excel } from './modules/excel.js';
import { Data } from './modules/data.js';
import { Editor } from './modules/editor.js';
import { Tags } from './modules/tags.js';

let parsedData = [];

function login() {
  const apiKey = UI.getApiKey();
  if (!apiKey) {
    UI.showLoginStatus('Please enter a key.', 'error');
    return;
  }

  UI.showLoginStatus(null, 'info', true);

  API.login(apiKey, (response) => {
    if (response.success) {
      UI.showLoginStatus('Success!', 'success');
      setTimeout(() => {
        UI.showMainMenu();
        initializeTabNavigation(); // Initialize tab navigation first
        setupMainMenuListeners();
        // Force dashboard to be active and refresh data
        showTabContent('dashboard');
        setActiveNavItem('dashboard');
        loadDashboardData();
      }, 1000);
    } else {
      UI.showLoginStatus(response.message, 'error');
    }
  });
}

function setupMainMenuListeners() {
  // Set up event listeners for elements that exist in the current UI
  if (UI.fileUpload) UI.fileUpload.addEventListener('change', handleFileSelect);
  if (UI.uploadButton) UI.uploadButton.addEventListener('click', handleUpload);
  if (UI.loadDataButton) UI.loadDataButton.addEventListener('click', loadDataFromSheet);
  
  // Use document.getElementById for elements not in the UI object
  const viewEditExpensesBtn = document.getElementById('view-edit-expenses-button');
  if (viewEditExpensesBtn) viewEditExpensesBtn.addEventListener('click', handleViewEditExpenses);
  
  const addTripEventBtn = document.getElementById('add-trip-event-button');
  if (addTripEventBtn) addTripEventBtn.addEventListener('click', () => handleAddTag('Trip/Event'));
  
  const addCategoryBtn = document.getElementById('add-category-button');
  if (addCategoryBtn) addCategoryBtn.addEventListener('click', () => handleAddTag('Category'));
  
  const editTagsBtn = document.getElementById('edit-tags-button');
  if (editTagsBtn) editTagsBtn.addEventListener('click', handleEditTags);
  
  const saveChangesBtn = document.getElementById('save-changes-button');
  if (saveChangesBtn) saveChangesBtn.addEventListener('click', handleSaveChanges);
  
  // Add settings event listeners
  const saveOpeningBalanceBtn = document.getElementById('save-opening-balance');
  if (saveOpeningBalanceBtn) saveOpeningBalanceBtn.addEventListener('click', saveOpeningBalance);
  
  // Initialize dashboard with stats
  loadDashboardData();
}

function loadDashboardData() {
  // Show loading indicator
  showDashboardLoading(true);
  
  // Load opening balance first, then the transaction data
  API.getOpeningBalance(UI.getApiKey(), (balanceResponse) => {
    let openingBalance = 0; // Default to 0 if not found
    
    if (balanceResponse.success) {
      openingBalance = parseFloat(balanceResponse.balance) || 0;
    }
    
    // Now load the transaction data
    API.getData(UI.getApiKey(), (response) => {
      // Hide loading indicator regardless of success or failure
      showDashboardLoading(false);
      
      if (response.success) {
        const data = response.data;
        calculateAndDisplayStats(data, openingBalance);
      } else {
        // Handle error case
        document.getElementById('current-balance').textContent = `£${openingBalance.toFixed(2)}`;
        document.getElementById('total-income').textContent = '£0.00';
        document.getElementById('total-expenses').textContent = '£0.00';
        document.getElementById('recent-transactions').textContent = '0';
        
        const recentContainer = document.getElementById('recent-transactions-content');
        if (recentContainer) {
          recentContainer.innerHTML = '<p>Error loading data. Please try again later.</p>';
        }
      }
    });
  });
}

function showDashboardLoading(show) {
  const loaderOverlay = document.getElementById('dashboard-loader-overlay');
  if (loaderOverlay) {
    loaderOverlay.style.display = show ? 'flex' : 'none';
  }
}

function calculateAndDisplayStats(data, openingBalance = 0) {
  let totalIncome = 0;
  let totalExpenses = 0;
  
  data.forEach(item => {
    if (item.Income && !isNaN(parseFloat(item.Income))) {
      totalIncome += parseFloat(item.Income);
    }
    if (item.Expense && !isNaN(parseFloat(item.Expense))) {
      totalExpenses += parseFloat(item.Expense);
    }
  });
  
  const currentBalance = openingBalance + totalIncome - totalExpenses; // Include opening balance
  
  document.getElementById('current-balance').textContent = `£${currentBalance.toFixed(2)}`;
  document.getElementById('total-income').textContent = `£${totalIncome.toFixed(2)}`;
  document.getElementById('total-expenses').textContent = `£${totalExpenses.toFixed(2)}`;
  document.getElementById('recent-transactions').textContent = data.length;
  
  // Display recent transactions
  const recentContainer = document.getElementById('recent-transactions-content');
  if (recentContainer) {
    recentContainer.innerHTML = '';
    
    // Sort by date to get most recent first (simplified approach)
    const recentTransactions = data.slice(0, 5); // Get first 5 as example
    
    if (recentTransactions.length > 0) {
      const table = document.createElement('table');
      table.innerHTML = `
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Amount (£)</th>
          </tr>
        </thead>
        <tbody>
          ${recentTransactions.map(item => {
            const amount = item.Income ? `+${item.Income}` : `-${item.Expense}`;
            return `
              <tr>
                <td>${item.Date || 'N/A'}</td>
                <td>${item.Description || 'N/A'}</td>
                <td>${amount || 'N/A'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      `;
      recentContainer.appendChild(table);
    } else {
      recentContainer.textContent = 'No transactions found';
    }
  }
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) {
    UI.setFileContent('Please select a file.');
    return;
  }

  Excel.parseFile(file)
    .then(data => {
      parsedData = data;
      UI.setFileContent(JSON.stringify(data, null, 2));
    })
    .catch(error => {
      console.error(error);
      UI.setFileContent('Error reading the Excel file.');
    });
}

function handleUpload() {
  if (!parsedData || parsedData.length === 0) {
    UI.showStatusMessage('upload-status', 'No data to upload. Please select and parse an Excel file first.', 'error');
    return;
  }

  uploadDataToSheet(parsedData);
}

function uploadDataToSheet(data) {
  UI.showStatusMessage('upload-status', 'Loading existing data from Google Sheet to check for duplicates...', 'info');

  API.getData(UI.getApiKey(), (response) => {
    if (response.success) {
      UI.showStatusMessage('upload-status', `Found ${response.data.length} existing records. Checking for duplicates...`, 'info');
      
      const existingData = response.data;
      const newRecords = Data.findUniqueRecords(data, existingData);

      if (newRecords.length === 0) {
        UI.showStatusMessage('upload-status', 'No new records to upload - all records already exist in the sheet.', 'success');
        return;
      }

      uploadNewRecords(newRecords);
    } else {
      UI.showStatusMessage('upload-status', `Error loading existing data: ${response.message}`, 'error');
    }
  });
}

function uploadNewRecords(newRecords) {
  const recordsPerChunk = 20;
  const totalChunks = Math.ceil(newRecords.length / recordsPerChunk);

  console.log(`Uploading ${newRecords.length} records in ${totalChunks} chunks of ${recordsPerChunk} records each`);

  processChunk(0, newRecords, recordsPerChunk, totalChunks, 'saveData', 'upload-status');
}

function processChunk(chunkIndex, allRecords, recordsPerChunk, totalChunks, action, statusElementId) {
  if (chunkIndex >= totalChunks) {
    UI.showStatusMessage(statusElementId, `All ${allRecords.length} records processed successfully!`, 'success');
    if (action === 'updateExpenses') {
      Editor.clearChanges();
    }
    return;
  }

  const startIdx = chunkIndex * recordsPerChunk;
  const endIdx = startIdx + recordsPerChunk;
  const recordsForThisChunk = allRecords.slice(startIdx, endIdx);

  UI.showStatusMessage(statusElementId, `Processing chunk ${chunkIndex + 1}/${totalChunks} (${recordsForThisChunk.length} records)...`, 'info');

  const apiFunction = action === 'saveData' ? API.saveData : API.updateExpenses;

  apiFunction(UI.getApiKey(), recordsForThisChunk, (response) => {
    if (response.success) {
      console.log(`Chunk ${chunkIndex + 1} processed successfully`);
      setTimeout(() => {
        processChunk(chunkIndex + 1, allRecords, recordsPerChunk, totalChunks, action, statusElementId);
      }, 100);
    } else {
      UI.showStatusMessage(statusElementId, `Error processing chunk ${chunkIndex + 1}: ${response.message}`, 'error');
    }
  });
}

function loadDataFromSheet() {
  UI.showStatusMessage('data-status', 'Loading data from Google Sheet...', 'info');
  UI.hideDataDisplay();

  API.getData(UI.getApiKey(), (response) => {
    if (response.success) {
      UI.showStatusMessage('data-status', `${response.data.length} records loaded successfully`, 'success');
      UI.displayDataInTable(response.data);
      UI.showDataDisplay();
    } else {
      UI.showStatusMessage('data-status', response.message, 'error');
    }
  });
}

function handleViewEditExpenses() {
  UI.showStatusMessage('editor-status', 'Loading app data...', 'info');
  document.getElementById('editor-section').style.display = 'block';

  API.getAppData(UI.getApiKey(), (response) => {
    if (response.success) {
      UI.showStatusMessage('editor-status', 'Data loaded successfully.', 'success');
      Tags.setTags(response.data.tags);
      Editor.render(response.data.expenses);
    } else {
      UI.showStatusMessage('editor-status', `Error loading data: ${response.message}`, 'error');
    }
  });
}

function handleAddTag(type) {
  const inputId = type === 'Trip/Event' ? 'new-trip-event' : 'new-category';
  const input = document.getElementById(inputId);
  const value = input.value.trim();
  if (value) {
    Tags.addTag(type, value);
    Editor.rerender();
    input.value = '';
  }
}

function handleEditTags() {
  const allTags = Tags.getTags();
  UI.displayTagsForEditing(allTags, handleDeleteTag);
}

function handleDeleteTag(type, value) {
  Tags.deleteTag(type, value);
  Editor.updateTagInExpenses(type, value);
  // After deleting a tag, we might want to refresh the edit tags UI
  setTimeout(() => handleEditTags(), 100);
}

function handleSaveChanges() {
  const changes = Editor.getChanges();
  if (changes.length === 0) {
    UI.showStatusMessage('editor-status', 'No changes to save.', 'info');
    return;
  }

  const recordsPerChunk = 20;
  const totalChunks = Math.ceil(changes.length / recordsPerChunk);

  console.log(`Saving ${changes.length} changes in ${totalChunks} chunks of ${recordsPerChunk} records each`);

  processChunk(0, changes, recordsPerChunk, totalChunks, 'updateExpenses', 'editor-status');
}

function saveOpeningBalance() {
  const openingBalanceInput = document.getElementById('opening-balance');
  const balanceValue = openingBalanceInput.value;
  const settingsStatus = document.getElementById('settings-status');
  
  if (!balanceValue) {
    settingsStatus.textContent = 'Please enter an opening balance.';
    settingsStatus.className = 'status-message error';
    return;
  }
  
  // Validate that it's a number
  const balanceNum = parseFloat(balanceValue);
  if (isNaN(balanceNum)) {
    settingsStatus.textContent = 'Please enter a valid number.';
    settingsStatus.className = 'status-message error';
    return;
  }
  
  settingsStatus.textContent = 'Saving...';
  settingsStatus.className = 'status-message info';
  
  API.saveOpeningBalance(UI.getApiKey(), balanceValue, (response) => {
    if (response.success) {
      settingsStatus.textContent = 'Opening balance saved successfully!';
      settingsStatus.className = 'status-message success';
    } else {
      settingsStatus.textContent = response.message || 'Error saving opening balance.';
      settingsStatus.className = 'status-message error';
    }
  });
}

function loadOpeningBalance() {
  API.getOpeningBalance(UI.getApiKey(), (response) => {
    if (response.success) {
      const openingBalanceInput = document.getElementById('opening-balance');
      if (openingBalanceInput && response.balance !== undefined) {
        openingBalanceInput.value = response.balance;
      }
    } else {
      console.log('Could not load opening balance:', response.message || 'Unknown error');
    }
  });
}

// Initialize tab navigation for sidebar
function initializeTabNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  
  navItems.forEach(item => {
    item.addEventListener('click', function(e) {
      e.preventDefault();
      
      const targetTab = this.getAttribute('data-tab');
      
      // Set active nav item and update content
      setActiveNavItem(targetTab);
      
      // Show target tab content
      showTabContent(targetTab);
      
      // Load opening balance if navigating to settings
      if (targetTab === 'settings') {
        loadOpeningBalance();
      }
    });
  });
}

// Function to set active navigation item
function setActiveNavItem(tabName) {
  // Remove active class from all nav items
  document.querySelectorAll('.nav-item').forEach(navItem => {
    navItem.classList.remove('active');
  });
  
  // Add active class to the selected nav item
  const targetNavItem = document.querySelector(`.nav-item[data-tab="${tabName}"]`);
  if (targetNavItem) {
    targetNavItem.classList.add('active');
    
    // Update page title to match the active tab
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) {
      pageTitle.textContent = targetNavItem.querySelector('.nav-text').textContent;
    }
  }
}

// Function to show specific tab content
function showTabContent(tabName) {
  // Hide all tab contents
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  
  // Show the selected tab content
  const targetContent = document.getElementById(`${tabName}-content`);
  if (targetContent) {
    targetContent.classList.add('active');
  }
}

function init() {
  UI.loginButton.addEventListener('click', login);
  UI.apiKeyInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      login();
    }
  });
}

init();
