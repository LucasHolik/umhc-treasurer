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

  // Add timeframe selector event listener
  const timeframeSelect = document.getElementById('timeframe-select');
  if (timeframeSelect) {
    timeframeSelect.addEventListener('change', function() {
      loadDashboardData(this.value);
    });
  }

  // Initialize dashboard with stats
  loadDashboardData();
}

// Utility functions to calculate time-based date ranges
function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start, end };
}

function getPastDaysRange(days) {
  const now = new Date();
  const start = new Date();
  start.setDate(now.getDate() - days);
  const end = now;
  return { start, end };
}

function getPastMonthsRange(months) {
  const now = new Date();
  const start = new Date();
  start.setMonth(now.getMonth() - months);
  const end = now;
  return { start, end };
}

function getPastYearRange() {
  const now = new Date();
  const start = new Date();
  start.setFullYear(now.getFullYear() - 1);
  const end = now;
  return { start, end };
}

function parseDate(dateString) {
  // Convert date string to Date object for comparison
  if (!dateString) return null;

  // Handle different date formats
  let date = new Date(dateString);

  // If the date parsing failed, try different formats
  if (isNaN(date.getTime())) {
    // Try to replace various date separators and parse
    const formattedDate = dateString.replace(/[-./]/g, '/');
    date = new Date(formattedDate);
  }

  // If still invalid, return null
  if (isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function filterTransactionsByTimeframe(transactions, timeframe) {
  if (!transactions || transactions.length === 0) return [];

  let { start, end } = { start: null, end: new Date() };

  switch(timeframe) {
    case 'current_month':
      ({ start, end } = getCurrentMonthRange());
      break;
    case 'past_30_days':
      ({ start, end } = getPastDaysRange(30));
      break;
    case 'past_3_months':
      ({ start, end } = getPastMonthsRange(3));
      break;
    case 'past_6_months':
      ({ start, end } = getPastMonthsRange(6));
      break;
    case 'past_year':
      ({ start, end } = getPastYearRange());
      break;
    case 'all_time':
      // For all time, use the very first date possible
      start = new Date(0);
      break;
    default:
      ({ start, end } = getPastDaysRange(30)); // Default to past 30 days
  }

  // Filter transactions based on the date range
  return transactions.filter(transaction => {
    const date = parseDate(transaction.Date);
    if (!date) return false; // Skip transactions with invalid dates

    return date >= start && date <= end;
  });
}

// Cached data to avoid reloading from Google Sheets every time
let cachedData = null;
let cachedOpeningBalance = null;

function loadDashboardData(timeframe = 'past_30_days') {
  // Show loading placeholder and hide loaded content
  showDashboardLoadingPlaceholder(true);

  // Check if we already have cached data
  if (cachedData !== null && cachedOpeningBalance !== null) {
    // Use cached data
    showDashboardLoadingPlaceholder(false);
    calculateAndDisplayStats(cachedData, cachedOpeningBalance, timeframe);
    return;
  }

  // If no cached data, load from API
  API.getOpeningBalance(UI.getApiKey(), (balanceResponse) => {
    let openingBalance = 0; // Default to 0 if not found

    if (balanceResponse.success) {
      openingBalance = parseFloat(balanceResponse.balance) || 0;
      cachedOpeningBalance = openingBalance; // Cache the opening balance
    }

    // Now load the transaction data
    API.getData(UI.getApiKey(), (response) => {
      // Hide loading placeholder and show loaded content
      showDashboardLoadingPlaceholder(false);

      if (response.success) {
        const data = response.data;
        cachedData = data; // Cache the data
        calculateAndDisplayStats(data, openingBalance, timeframe);
      } else {
        // Handle error case - still show the dashboard but with error info
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

// Function to manually refresh data from API
function refreshDashboardData(timeframe = 'past_30_days') {
  cachedData = null;  // Clear cache to force reload
  cachedOpeningBalance = null;
  loadDashboardData(timeframe);
}

function showDashboardLoading(show) {
  const loaderOverlay = document.getElementById('dashboard-loader-overlay');
  if (loaderOverlay) {
    loaderOverlay.style.display = show ? 'flex' : 'none';
  }
}

function showDashboardLoadingPlaceholder(show) {
  const loadingPlaceholder = document.getElementById('dashboard-loading-placeholder');
  const loadedContent = document.getElementById('dashboard-loaded-content');

  if (loadingPlaceholder) {
    loadingPlaceholder.style.display = show ? 'flex' : 'none';
  }

  if (loadedContent) {
    loadedContent.style.display = show ? 'none' : 'block';
  }
}

function calculateAndDisplayStats(data, openingBalance = 0, timeframe = 'past_30_days') {
  // Filter the data based on the selected timeframe
  const filteredData = filterTransactionsByTimeframe(data, timeframe);

  let totalIncome = 0;
  let totalExpenses = 0;

  filteredData.forEach(item => {
    if (item.Income && !isNaN(parseFloat(item.Income))) {
      totalIncome += parseFloat(item.Income);
    }
    if (item.Expense && !isNaN(parseFloat(item.Expense))) {
      totalExpenses += parseFloat(item.Expense);
    }
  });

  // Calculate the current balance based on ALL transactions, not just the filtered ones
  let allTimeTotalIncome = 0;
  let allTimeTotalExpenses = 0;

  data.forEach(item => {
    if (item.Income && !isNaN(parseFloat(item.Income))) {
      allTimeTotalIncome += parseFloat(item.Income);
    }
    if (item.Expense && !isNaN(parseFloat(item.Expense))) {
      allTimeTotalExpenses += parseFloat(item.Expense);
    }
  });

  const currentBalance = openingBalance + allTimeTotalIncome - allTimeTotalExpenses;

  document.getElementById('current-balance').textContent = `£${currentBalance.toFixed(2)}`;
  document.getElementById('total-income').textContent = `£${totalIncome.toFixed(2)}`;
  document.getElementById('total-expenses').textContent = `£${totalExpenses.toFixed(2)}`;
  document.getElementById('recent-transactions').textContent = filteredData.length;

  // Display recent transactions based on the selected timeframe
  displayRecentTransactions(filteredData, timeframe);
}

function displayRecentTransactions(transactions, timeframe) {
  // Sort by date to get most recent first
  const sortedTransactions = transactions.sort((a, b) => {
    const dateA = parseDate(a.Date);
    const dateB = parseDate(b.Date);

    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;

    return dateB - dateA; // Sort descending (most recent first)
  });

  // For all time, show all transactions; otherwise, limit to reasonable number
  let displayTransactions;
  if (timeframe === 'all_time') {
    // Show first 20 transactions for all time to avoid overwhelming the UI
    displayTransactions = sortedTransactions.slice(0, 20);
  } else {
    displayTransactions = sortedTransactions; // Show all transactions in the selected timeframe
  }

  const recentContainer = document.getElementById('recent-transactions-content');
  if (recentContainer) {
    recentContainer.innerHTML = '';

    if (displayTransactions.length > 0) {
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
          ${displayTransactions.map(item => {
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
      recentContainer.textContent = 'No transactions found in selected timeframe';
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

    // Refresh cached data after successful upload or update
    if (action === 'saveData' || action === 'updateExpenses') {
      refreshDashboardData();
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
      // Refresh cached data after loading new data
      cachedData = response.data;
      const timeframeSelect = document.getElementById('timeframe-select');
      const selectedTimeframe = timeframeSelect ? timeframeSelect.value : 'past_30_days';
      calculateAndDisplayStats(cachedData, cachedOpeningBalance, selectedTimeframe);
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
      // Update the cached opening balance
      cachedOpeningBalance = balanceNum;
      // Refresh the dashboard to show the updated balance
      const timeframeSelect = document.getElementById('timeframe-select');
      const selectedTimeframe = timeframeSelect ? timeframeSelect.value : 'past_30_days';
      calculateAndDisplayStats(cachedData, cachedOpeningBalance, selectedTimeframe);
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
      // Update cached opening balance as well
      cachedOpeningBalance = parseFloat(response.balance) || 0;
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

    // If switching to dashboard, update the stats
    if (tabName === 'dashboard') {
      const timeframeSelect = document.getElementById('timeframe-select');
      const selectedTimeframe = timeframeSelect ? timeframeSelect.value : 'past_30_days';
      loadDashboardData(selectedTimeframe);
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
