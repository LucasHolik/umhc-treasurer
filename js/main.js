// js/main.js

import { UI } from "./modules/ui.js";
import { API } from "./modules/api.js";
import { Excel } from "./modules/excel.js";
import { Data } from "./modules/data.js";
import { Editor } from "./modules/editor.js";
import { Tags } from "./modules/tags.js";
import { RequestManager } from "./modules/request-manager.js";

// Make UI and Tags objects globally available for use in UI module
window.UI = UI;
window.Tags = Tags;

let parsedData = [];

function login() {
  const apiKey = UI.getApiKey();
  if (!apiKey) {
    UI.showLoginStatus("Please enter a key.", "error");
    return;
  }

  UI.showLoginStatus(null, "info", true);

  API.login(apiKey, (response) => {
    if (response.success) {
      setTimeout(() => {
        UI.showMainMenu();
        initializeTabNavigation(); // Initialize tab navigation first
        setupMainMenuListeners();
        // Force dashboard to be active - but only call global refresh, not individual loading
        showTabContent("dashboard");
        setActiveNavItem("dashboard", true); // Set as active without loading data individually during login
        // Trigger global refresh to load data for all tabs with consistent loading
        globalRefreshAllData();
      }, 1000);
    } else {
      UI.showLoginStatus(response.message, "error");
    }
  });
}

function setupMainMenuListeners() {
  // Set up event listeners for elements that exist in the current UI
  if (UI.fileUpload) UI.fileUpload.addEventListener("change", handleFileSelect);
  if (UI.uploadButton) UI.uploadButton.addEventListener("click", handleUpload);
  if (UI.loadDataButton)
    UI.loadDataButton.addEventListener("click", loadDataFromSheet);

  // Use document.getElementById for elements not in the UI object
  const viewEditExpensesBtn = document.getElementById(
    "view-edit-expenses-button"
  );
  if (viewEditExpensesBtn)
    viewEditExpensesBtn.addEventListener("click", handleViewEditExpenses);


  // Update the edit tags button to use the new functionality
  const editTagsBtn = document.getElementById("edit-tags-button");
  if (editTagsBtn) editTagsBtn.addEventListener("click", handleEditTags);

  const saveChangesBtn = document.getElementById("save-changes-button");
  if (saveChangesBtn)
    saveChangesBtn.addEventListener("click", handleSaveChanges);

  // NEW: Add event listeners for the new tags interface
  if (UI.cancelEditTagsButton) {
    UI.cancelEditTagsButton.addEventListener("click", function() {
      // Switch back to table view without saving changes
      const allTags = Tags.getTags();
      const tagExpenseCounts = calculateTagExpenseCounts(cachedData || []);
      UI.displayTagsTable(allTags, tagExpenseCounts);
      UI.showTagsTableView();
    });
  }

  if (UI.saveTagsChangesButton) {
    UI.saveTagsChangesButton.addEventListener("click", function() {
      // Save all tag changes to Google Sheets
      Tags.saveChangesToSheets((response) => {
        if (response.success) {
          // After saving, update the UI to show the new state
          const allTags = Tags.getTags();
          const tagExpenseCounts = calculateTagExpenseCounts(cachedData || []);
          UI.displayTagsTable(allTags, tagExpenseCounts);
          UI.showTagsTableView();
        } else {
          UI.showStatusMessage("tag-status", `Error saving tags: ${response.message}`, "error");
        }
      });
    });
  }

  if (UI.confirmAddTripEventButton) {
    UI.confirmAddTripEventButton.addEventListener("click", function() {
      const input = UI.addTripEventInput;
      const value = input.value.trim();
      if (value) {
        Tags.addTag("Trip/Event", value);
        input.value = "";
        // Update the UI to show the new tag
        const allTags = Tags.getTags();
        UI.displayTagsForEdit(allTags, handleTagChange);
      }
    });
  }

  if (UI.confirmAddCategoryButton) {
    UI.confirmAddCategoryButton.addEventListener("click", function() {
      const input = UI.addCategoryInput;
      const value = input.value.trim();
      if (value) {
        Tags.addTag("Category", value);
        input.value = "";
        // Update the UI to show the new tag
        const allTags = Tags.getTags();
        UI.displayTagsForEdit(allTags, handleTagChange);
      }
    });
  }

  // Handle Enter key in the add tag inputs
  if (UI.addTripEventInput) {
    UI.addTripEventInput.addEventListener("keydown", function(e) {
      if (e.key === "Enter") {
        UI.confirmAddTripEventButton.click();
      }
    });
  }

  if (UI.addCategoryInput) {
    UI.addCategoryInput.addEventListener("keydown", function(e) {
      if (e.key === "Enter") {
        UI.confirmAddCategoryButton.click();
      }
    });
  }

  // Add settings event listeners
  const saveOpeningBalanceBtn = document.getElementById("save-opening-balance");
  if (saveOpeningBalanceBtn)
    saveOpeningBalanceBtn.addEventListener("click", saveOpeningBalance);

  // Add timeframe selector event listener
  const timeframeSelect = document.getElementById("timeframe-select");
  if (timeframeSelect) {
    timeframeSelect.addEventListener("change", function () {
      loadDashboardData(this.value);
    });
  }
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
    const formattedDate = dateString.replace(/[-./]/g, "/");
    date = new Date(formattedDate);
  }

  // If still invalid, return null
  if (isNaN(date.getTime())) {
    return null;
  }

  return date;
}

// Function to convert timeframe value to readable label
function getTimeframeLabel(timeframe) {
  const labels = {
    current_month: "Current Month",
    past_30_days: "Past 30 Days",
    past_3_months: "Past 3 Months",
    past_6_months: "Past 6 Months",
    past_year: "Past Year",
    all_time: "All Time",
  };

  return labels[timeframe] || "Past 30 Days"; // Default fallback
}

function filterTransactionsByTimeframe(transactions, timeframe) {
  if (!transactions || transactions.length === 0) return [];

  // For all_time, return all transactions (dates are not required for this view)
  if (timeframe === "all_time") {
    return transactions; // Return all transactions without date filtering
  }

  let { start, end } = { start: null, end: new Date() };

  switch (timeframe) {
    case "current_month":
      ({ start, end } = getCurrentMonthRange());
      break;
    case "past_30_days":
      ({ start, end } = getPastDaysRange(30));
      break;
    case "past_3_months":
      ({ start, end } = getPastMonthsRange(3));
      break;
    case "past_6_months":
      ({ start, end } = getPastMonthsRange(6));
      break;
    case "past_year":
      ({ start, end } = getPastYearRange());
      break;
    default:
      ({ start, end } = getPastDaysRange(30)); // Default to past 30 days
  }

  // Filter transactions based on the date range (for all other timeframes)
  return transactions.filter((transaction) => {
    const date = parseDate(transaction.Date);
    if (!date) return false; // Skip transactions with invalid dates

    return date >= start && date <= end;
  });
}

// Cached data to avoid reloading from Google Sheets every time
let cachedData = null;
let cachedOpeningBalance = null;

function loadDashboardData(timeframe = "past_30_days") {
  // Don't load if global loading is active - only allow dashboard loading as part of global refresh
  if (UI.isGlobalLoading()) {
    // If global loading is active, ensure this tab shows the loading state
    UI.showLoadingInContainer("dashboard-content-wrapper", "Loading dashboard data...");
    return;
  }

  // For individual dashboard loading (e.g. timeframe change), don't use individual loading
  // Just use the existing dashboard loading placeholder mechanism
  // Show loading placeholder and hide loaded content
  showDashboardLoadingPlaceholder(true);
  // Hide the loaded content while loading
  const loadedContent = document.getElementById("dashboard-loaded-content");
  if (loadedContent) {
    loadedContent.style.display = "none";
  }

  // Update dashboard title with the selected timeframe
  updateDashboardTitle(timeframe);

  // Check if we already have cached data
  if (cachedData !== null && cachedOpeningBalance !== null) {
    // Use cached data
    showDashboardLoadingPlaceholder(false);
    if (loadedContent) {
      loadedContent.style.display = "block";
    }
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

    // Now load the complete app data (including expenses and tags)
    API.getAppData(UI.getApiKey(), (response) => {
      // Hide loading placeholder and show loaded content
      showDashboardLoadingPlaceholder(false);
      if (loadedContent) {
        loadedContent.style.display = "block";
      }

      if (response.success) {
        const data = response.data.expenses;
        cachedData = data; // Cache the data
        // Set the tags in the Tags module so they're available throughout the app
        Tags.setTags(response.data.tags);
        calculateAndDisplayStats(data, openingBalance, timeframe);
      } else {
        // Handle error case - still show the dashboard but with error info
        document.getElementById(
          "current-balance"
        ).textContent = `£${openingBalance.toFixed(2)}`;
        document.getElementById("total-income").textContent = "£0.00";
        document.getElementById("total-expenses").textContent = "£0.00";
        document.getElementById("recent-transactions").textContent = "0";

        const recentContainer = document.getElementById(
          "recent-transactions-content"
        );
        if (recentContainer) {
          recentContainer.innerHTML =
            "<p>Error loading data. Please try again later.</p>";
        }
      }
    });
  });
}

// Function to update the dashboard title with the selected timeframe
function updateDashboardTitle(timeframe) {
  const pageTitle = document.getElementById("page-title");
  if (pageTitle) {
    const timeframeLabel = getTimeframeLabel(timeframe);
    pageTitle.textContent = `Dashboard - ${timeframeLabel}`;
  }
}

// Function to manually refresh data from API
function refreshDashboardData(timeframe = "past_30_days") {
  cachedData = null; // Clear cache to force reload
  cachedOpeningBalance = null;
  loadDashboardData(timeframe);
}

function showDashboardLoading(show) {
  const loaderOverlay = document.getElementById("dashboard-loader-overlay");
  if (loaderOverlay) {
    loaderOverlay.style.display = show ? "flex" : "none";
  }
}

function showDashboardLoadingPlaceholder(show) {
  const loadingPlaceholder = document.getElementById(
    "dashboard-loading-placeholder"
  );
  const loadedContent = document.getElementById("dashboard-loaded-content");

  if (loadingPlaceholder) {
    loadingPlaceholder.style.display = show ? "flex" : "none";
  }

  if (loadedContent) {
    loadedContent.style.display = show ? "none" : "block";
  }
}

function calculateAndDisplayStats(
  data,
  openingBalance = 0,
  timeframe = "past_30_days"
) {
  // Filter the data based on the selected timeframe
  const filteredData = filterTransactionsByTimeframe(data, timeframe);

  let totalIncome = 0;
  let totalExpenses = 0;

  filteredData.forEach((item) => {
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

  data.forEach((item) => {
    if (item.Income && !isNaN(parseFloat(item.Income))) {
      allTimeTotalIncome += parseFloat(item.Income);
    }
    if (item.Expense && !isNaN(parseFloat(item.Expense))) {
      allTimeTotalExpenses += parseFloat(item.Expense);
    }
  });

  const currentBalance =
    openingBalance + allTimeTotalIncome - allTimeTotalExpenses;
  const netChange = totalIncome - totalExpenses; // Net income/net change for the selected timeframe

  document.getElementById(
    "current-balance"
  ).textContent = `£${currentBalance.toFixed(2)}`;
  document.getElementById("total-income").textContent = `£${totalIncome.toFixed(
    2
  )}`;
  document.getElementById(
    "total-expenses"
  ).textContent = `£${totalExpenses.toFixed(2)}`;
  document.getElementById(
    "recent-transactions"
  ).textContent = `£${netChange.toFixed(2)}`; // Show net change instead of transaction count

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

  // For all time, show all transactions; for other timeframes, show all that match
  let displayTransactions = sortedTransactions;

  // Update the transaction count in the section header
  updateTransactionCountHeader(transactions.length, timeframe);

  const recentContainer = document.getElementById(
    "recent-transactions-content"
  );
  if (recentContainer) {
    recentContainer.innerHTML = "";

    if (displayTransactions.length > 0) {
      const table = document.createElement("table");
      table.innerHTML = `
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Amount (£)</th>
          </tr>
        </thead>
        <tbody>
          ${displayTransactions
            .map((item) => {
              const amount = item.Income
                ? `+${item.Income}`
                : `-${item.Expense}`;
              return `
              <tr>
                <td>${item.Date || "N/A"}</td>
                <td>${item.Description || "N/A"}</td>
                <td>${amount || "N/A"}</td>
              </tr>
            `;
            })
            .join("")}
        </tbody>
      `;
      recentContainer.appendChild(table);
    } else {
      recentContainer.textContent =
        "No transactions found in selected timeframe";
    }
  }
}

// Function to update the transaction count in the section header
function updateTransactionCountHeader(count, timeframe) {
  // Update the main header back to just "Transactions"
  const headerElement = document.querySelector(".transactions-header h2");
  if (headerElement) {
    headerElement.textContent = `Transactions`;
  }

  // Add the transaction count as a small italicized subtitle below
  const transactionsHeader = document.querySelector(".transactions-header");
  if (transactionsHeader) {
    // Remove any existing count element
    const existingCountElement = document.querySelector(
      ".transaction-count-subtitle"
    );
    if (existingCountElement) {
      existingCountElement.remove();
    }

    // Create new element for the count
    const countElement = document.createElement("div");
    countElement.className = "transaction-count-subtitle";

    const timeframeLabel = getTimeframeLabel(timeframe).toLowerCase();
    const transactionWord = count === 1 ? "transaction" : "transactions";
    countElement.textContent = `${count} ${transactionWord} in the ${timeframeLabel}`;

    // Insert after the h2 element
    transactionsHeader.appendChild(countElement);
  }
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) {
    UI.setFileContent("Please select a file.");
    UI.hideExtractedContent(); // Hide the extracted content section since no file was selected
    return;
  }

  Excel.parseFile(file)
    .then((data) => {
      parsedData = data;

      // Show the extracted content section after parsing
      UI.showExtractedContent();

      // Display data in table format by default
      UI.displayExtractedDataAsTable(data);

      // Also set the JSON version for the JSON view
      UI.fileContentJson.textContent = JSON.stringify(data, null, 2);

      // Set the table view as active by default
      UI.switchToTableView();
    })
    .catch((error) => {
      console.error(error);
      UI.setFileContent("Error reading the Excel file.");
      UI.hideExtractedContent(); // Hide if there's an error
    });
}

function handleUpload() {
  if (!parsedData || parsedData.length === 0) {
    UI.showStatusMessage(
      "upload-status",
      "No data to upload. Please select and parse an Excel file first.",
      "error"
    );
    return;
  }

  uploadDataToSheet(parsedData);
}

function uploadDataToSheet(data) {
  UI.showStatusMessage(
    "upload-status",
    "Checking for duplicates using cached data...",
    "info"
  );

  // Use cached data for duplicate checking instead of downloading again
  if (cachedData !== null) {
    UI.showStatusMessage(
      "upload-status",
      `Found ${cachedData.length} cached records. Checking for duplicates...`,
      "info"
    );

    const newRecords = Data.findUniqueRecords(data, cachedData);

    if (newRecords.length === 0) {
      UI.showStatusMessage(
        "upload-status",
        "No new records to upload - all records already exist in the sheet.",
        "success"
      );
      return;
    }

    uploadNewRecords(newRecords);
  } else {
    // If no cached data is available, download from Google Sheets
    UI.showStatusMessage(
      "upload-status",
      "Loading existing data from Google Sheet to check for duplicates...",
      "info"
    );

    API.getData(UI.getApiKey(), (response) => {
      if (response.success) {
        UI.showStatusMessage(
          "upload-status",
          `Found ${response.data.length} existing records. Checking for duplicates...`,
          "info"
        );

        const existingData = response.data;
        const newRecords = Data.findUniqueRecords(data, existingData);

        if (newRecords.length === 0) {
          UI.showStatusMessage(
            "upload-status",
            "No new records to upload - all records already exist in the sheet.",
            "success"
          );
          return;
        }

        uploadNewRecords(newRecords);
      } else {
        UI.showStatusMessage(
          "upload-status",
          `Error loading existing data: ${response.message}`,
          "error"
        );
      }
    });
  }
}

function uploadNewRecords(newRecords) {
  const recordsPerChunk = 20;
  const totalChunks = Math.ceil(newRecords.length / recordsPerChunk);

  console.log(
    `Uploading ${newRecords.length} records in ${totalChunks} chunks of ${recordsPerChunk} records each`
  );

  processChunk(
    0,
    newRecords,
    recordsPerChunk,
    totalChunks,
    "saveData",
    "upload-status"
  );
}

function processChunk(
  chunkIndex,
  allRecords,
  recordsPerChunk,
  totalChunks,
  action,
  statusElementId
) {
  if (chunkIndex >= totalChunks) {
    UI.showStatusMessage(
      statusElementId,
      `All ${allRecords.length} records processed successfully!`,
      "success"
    );
    if (action === "updateExpenses") {
      Editor.clearChanges();
    }

    // Refresh cached data after successful upload or update
    if (action === "saveData" || action === "updateExpenses") {
      // Only update the cache without triggering full dashboard reload to avoid loading conflicts
      // The global refresh handles the UI updates, so just update the cached values
      API.getAppData(UI.getApiKey(), (response) => {
        if (response.success) {
          cachedData = response.data.expenses;
          Tags.setTags(response.data.tags); // Update tags globally

          // Only calculate and display stats for the dashboard if it's the active tab
          const activeTab = document.querySelector('.nav-item.active');
          if (activeTab && activeTab.getAttribute('data-tab') === 'dashboard') {
            const timeframeSelect = document.getElementById("timeframe-select");
            const selectedTimeframe = timeframeSelect?.value || "past_30_days";
            calculateAndDisplayStats(cachedData, cachedOpeningBalance, selectedTimeframe);
          }

          // Update tags content if tags tab is active
          if (activeTab && activeTab.getAttribute('data-tab') === 'tags') {
            const tagExpenseCounts = calculateTagExpenseCounts(cachedData || []);
            UI.displayTagsTable(Tags.getTags(), tagExpenseCounts);
          }
        }
      });
    }

    return;
  }

  const startIdx = chunkIndex * recordsPerChunk;
  const endIdx = startIdx + recordsPerChunk;
  const recordsForThisChunk = allRecords.slice(startIdx, endIdx);

  UI.showStatusMessage(
    statusElementId,
    `Processing chunk ${chunkIndex + 1}/${totalChunks} (${
      recordsForThisChunk.length
    } records)...`,
    "info"
  );

  const apiFunction = action === "saveData" ? API.saveData : API.updateExpenses;

  apiFunction(UI.getApiKey(), recordsForThisChunk, (response) => {
    if (response.success) {
      console.log(`Chunk ${chunkIndex + 1} processed successfully`);
      setTimeout(() => {
        processChunk(
          chunkIndex + 1,
          allRecords,
          recordsPerChunk,
          totalChunks,
          action,
          statusElementId
        );
      }, 100);
    } else {
      UI.showStatusMessage(
        statusElementId,
        `Error processing chunk ${chunkIndex + 1}: ${response.message}`,
        "error"
      );
    }
  });
}

function loadDataFromSheet() {
  // Don't load if global loading is active
  if (UI.isGlobalLoading()) {
    // If global loading is active, ensure this tab shows the loading state
    // Remove any existing overlay first to avoid duplicates
    removeLoadingOverlay("transactions-content");

    // Use the UI module's overlay loading method which will apply the solid green background
    UI.showLoadingInContainer("transactions-content", "Loading transaction data...");
    return;
  }

  // For individual loading, show the overlay
  removeLoadingOverlay("transactions-content");
  UI.showLoadingInContainer("transactions-content", "Loading transaction data...");

  UI.showStatusMessage(
    "data-status",
    "Loading data from Google Sheet...",
    "info"
  );
  UI.hideDataDisplay();

  API.getData(UI.getApiKey(), (response) => {
    // Remove the loading overlay after loading completes
    removeLoadingOverlay("transactions-content");

    if (response.success) {
      UI.showStatusMessage(
        "data-status",
        `${response.data.length} records loaded successfully`,
        "success"
      );
      UI.displayDataInTable(response.data);
      UI.showDataDisplay();
      // Refresh cached data after loading new data
      cachedData = response.data;
      const timeframeSelect = document.getElementById("timeframe-select");
      const selectedTimeframe = timeframeSelect
        ? timeframeSelect.value
        : "past_30_days";
      calculateAndDisplayStats(
        cachedData,
        cachedOpeningBalance,
        selectedTimeframe
      );
    } else {
      UI.showStatusMessage("data-status", response.message, "error");
    }
  });
}

function handleViewEditExpenses() {
  UI.showStatusMessage("editor-status", "Loading app data...", "info");
  document.getElementById("editor-section").style.display = "block";

  API.getAppData(UI.getApiKey(), (response) => {
    if (response.success) {
      UI.showStatusMessage(
        "editor-status",
        "Data loaded successfully.",
        "success"
      );
      Tags.setTags(response.data.tags);
      Editor.render(response.data.expenses);
    } else {
      UI.showStatusMessage(
        "editor-status",
        `Error loading data: ${response.message}`,
        "error"
      );
    }
  });
}

function handleAddTag(type) {
  const inputId = type === "Trip/Event" ? "new-trip-event" : "new-category";
  const input = document.getElementById(inputId);
  const value = input.value.trim();
  if (value) {
    Tags.addTag(type, value);
    Editor.rerender();
    input.value = "";
  }
}

// NEW: Calculate expense counts for each tag
function calculateTagExpenseCounts(expensesData) {
  const expenseCounts = {
    "Trip/Event": {},
    "Category": {}
  };

  // Initialize the tag types to ensure they exist
  if (!expenseCounts["Trip/Event"]) expenseCounts["Trip/Event"] = {};
  if (!expenseCounts["Category"]) expenseCounts["Category"] = {};

  // Count expenses for each tag
  expensesData.forEach(item => {
    const tripEventTag = item["Trip/Event"];
    const categoryTag = item["Category"];

    // Count Trip/Event tags
    if (tripEventTag && tripEventTag.trim() !== "") {
      if (!expenseCounts["Trip/Event"][tripEventTag]) {
        expenseCounts["Trip/Event"][tripEventTag] = 0;
      }
      expenseCounts["Trip/Event"][tripEventTag]++;
    }

    // Count Category tags
    if (categoryTag && categoryTag.trim() !== "") {
      if (!expenseCounts["Category"][categoryTag]) {
        expenseCounts["Category"][categoryTag] = 0;
      }
      expenseCounts["Category"][categoryTag]++;
    }
  });

  return expenseCounts;
}

// NEW: Show tags in table view with expense counts
function showTagsTable() {
  const allTags = Tags.getTags();
  const tagExpenseCounts = calculateTagExpenseCounts(cachedData || []);
  UI.displayTagsTable(allTags, tagExpenseCounts);
  UI.showTagsTableView();
}

// NEW: Handle switching to edit mode for tags
function handleEditTags() {
  const allTags = Tags.getTags();
  UI.displayTagsForEdit(allTags, handleTagChange);
  UI.showTagsEditView();
}

// NEW: Handle tag changes (rename/delete) - tracks changes locally only
function handleTagChange(type, originalValue, newValue) {
  // If newValue is null, it's a delete operation
  if (newValue === null) {
    // For deletion, mark for deletion but don't sync to sheets yet
    Tags.deleteTag(type, originalValue);
    // Only update editor if it's currently visible/active
    if (document.getElementById("editor-body")) {
      Editor.updateTagInExpenses(type, originalValue);
    }
  } else if (newValue !== originalValue) {
    // If the value changed, it's a rename operation - track locally only
    Tags.renameTag(type, originalValue, newValue);
    // Only update editor if it's currently visible/active
    if (document.getElementById("editor-body")) {
      Editor.updateTagInExpenses(type, originalValue, newValue);
    }
  }
  // The changes will be synced to Google Sheets only when the main "Save Changes" button is clicked
}

function handleDeleteTag(type, value) {
  Tags.deleteTag(type, value);
  Editor.updateTagInExpenses(type, value);
  // After deleting a tag, we might want to refresh the edit tags UI
  setTimeout(() => handleEditTags(), 100);
}

function handleSaveChanges() {
  const changes = Editor.getChanges();
  const tagOperations = Tags.getOperations();

  // Save expense changes first
  if (changes.length > 0) {
    const recordsPerChunk = 20;
    const totalChunks = Math.ceil(changes.length / recordsPerChunk);

    console.log(
      `Saving ${changes.length} expense changes in ${totalChunks} chunks of ${recordsPerChunk} records each`
    );

    processChunk(
      0,
      changes,
      recordsPerChunk,
      totalChunks,
      "updateExpenses",
      "editor-status"
    );
  } else {
    UI.showStatusMessage("editor-status", "No expense changes to save.", "info");
  }

  // Then save tag operations
  if (tagOperations.length > 0) {
    console.log(`Saving ${tagOperations.length} tag operations`);

    // Call the function to save tag changes to sheets
    Tags.saveChangesToSheets((response) => {
      if (!response.success) {
        UI.showStatusMessage("tag-status", `Error saving tag changes: ${response.message}`, "error");
      }
    });
  } else {
    if (changes.length === 0) {
      UI.showStatusMessage("editor-status", "No changes to save.", "info");
    }
  }
}

function saveOpeningBalance() {
  const openingBalanceInput = document.getElementById("opening-balance");
  const balanceValue = openingBalanceInput.value;
  const settingsStatus = document.getElementById("settings-status");

  if (!balanceValue) {
    settingsStatus.textContent = "Please enter an opening balance.";
    settingsStatus.className = "status-message error";
    return;
  }

  // Validate that it's a number
  const balanceNum = parseFloat(balanceValue);
  if (isNaN(balanceNum)) {
    settingsStatus.textContent = "Please enter a valid number.";
    settingsStatus.className = "status-message error";
    return;
  }

  settingsStatus.textContent = "Saving...";
  settingsStatus.className = "status-message info";

  API.saveOpeningBalance(UI.getApiKey(), balanceValue, (response) => {
    if (response.success) {
      settingsStatus.textContent = "Opening balance saved successfully!";
      settingsStatus.className = "status-message success";
      // Update the cached opening balance
      cachedOpeningBalance = balanceNum;
      // Refresh the dashboard to show the updated balance
      const timeframeSelect = document.getElementById("timeframe-select");
      const selectedTimeframe = timeframeSelect
        ? timeframeSelect.value
        : "past_30_days";
      calculateAndDisplayStats(
        cachedData,
        cachedOpeningBalance,
        selectedTimeframe
      );
    } else {
      settingsStatus.textContent =
        response.message || "Error saving opening balance.";
      settingsStatus.className = "status-message error";
    }
  });
}

function loadOpeningBalance() {
  API.getOpeningBalance(UI.getApiKey(), (response) => {
    if (response.success) {
      const openingBalanceInput = document.getElementById("opening-balance");
      if (openingBalanceInput && response.balance !== undefined) {
        openingBalanceInput.value = response.balance;
      }
      // Update cached opening balance as well
      cachedOpeningBalance = parseFloat(response.balance) || 0;
    } else {
      console.log(
        "Could not load opening balance:",
        response.message || "Unknown error"
      );
    }
  });
}

// Initialize tab navigation for sidebar
function initializeTabNavigation() {
  const navItems = document.querySelectorAll(".nav-item");

  navItems.forEach((item) => {
    item.addEventListener("click", function (e) {
      e.preventDefault();

      const targetTab = this.getAttribute("data-tab");

      // Set active nav item and update content
      setActiveNavItem(targetTab);

      // Show target tab content
      showTabContent(targetTab);

      // Load opening balance if navigating to settings (only if not in global loading)
      if (targetTab === "settings" && !UI.isGlobalLoading()) {
        loadOpeningBalance();
      }
    });
  });
}

// Function to set active navigation item
function setActiveNavItem(tabName, skipDataLoad = false) {
  // Remove active class from all nav items
  document.querySelectorAll(".nav-item").forEach((navItem) => {
    navItem.classList.remove("active");
  });

  // Add active class to the selected nav item
  const targetNavItem = document.querySelector(
    `.nav-item[data-tab="${tabName}"]`
  );
  if (targetNavItem) {
    targetNavItem.classList.add("active");

    // Update page title to match the active tab
    const pageTitle = document.getElementById("page-title");
    if (pageTitle) {
      if (tabName === "dashboard") {
        // For dashboard, include the timeframe in the title
        const timeframeSelect = document.getElementById("timeframe-select");
        const selectedTimeframe = timeframeSelect
          ? timeframeSelect.value
          : "past_30_days";
        const timeframeLabel = getTimeframeLabel(selectedTimeframe);
        pageTitle.textContent = `Dashboard - ${timeframeLabel}`;
      } else {
        pageTitle.textContent =
          targetNavItem.querySelector(".nav-text").textContent;
      }
    }

    // Toggle the refresh button visibility based on the active tab
    toggleRefreshButton(tabName);

    // If global loading is active, just activate the tab without loading content
    if (UI.isGlobalLoading()) {
      // Tab will be activated and loading state will be shown by showTabContent
      return;
    }

    // If switching to dashboard, update the stats (only if not skipping data load)
    if (tabName === "dashboard" && !skipDataLoad) {
      const timeframeSelect = document.getElementById("timeframe-select");
      const selectedTimeframe = timeframeSelect
        ? timeframeSelect.value
        : "past_30_days";
      loadDashboardData(selectedTimeframe);
    }

    // If switching to tags, load and show the tags table (but not during global load)
    if (tabName === "tags") {
      const allTags = Tags.getTags();
      const tagExpenseCounts = calculateTagExpenseCounts(cachedData || []);
      UI.displayTagsTable(allTags, tagExpenseCounts);
      UI.showTagsTableView(); // Ensure we're in the table view by default
    }
  }
}

// Function to show specific tab content
function showTabContent(tabName) {
  // Hide all tab contents
  document.querySelectorAll(".tab-content").forEach((content) => {
    content.classList.remove("active");
  });

  // Show the selected tab content
  const targetContent = document.getElementById(`${tabName}-content`);
  if (targetContent) {
    // If global loading is active, show loading in this tab
    if (UI.isGlobalLoading()) {
      // For dashboard tab, use the existing dashboard loading mechanism
      if (tabName === 'dashboard') {
        showDashboardLoadingPlaceholder(true);
        const dashboardLoadedContent = document.getElementById("dashboard-loaded-content");
        if (dashboardLoadedContent) {
          dashboardLoadedContent.style.display = "none";
        }
      } else {
        // For other tabs, use the UI module's overlay loading method for consistency
        // Remove any existing overlay first to avoid duplicates
        removeLoadingOverlay(`${tabName}-content`);

        // Use the UI module method which will apply the solid green background
        let loadingText = "Loading...";
        switch(tabName) {
          case 'transactions':
            loadingText = "Loading transaction data...";
            break;
          case 'tags':
            loadingText = "Loading tag data...";
            break;
          case 'analysis':
            loadingText = "Loading analysis data...";
            break;
          case 'reports':
            loadingText = "Loading reports data...";
            break;
          default:
            loadingText = "Loading...";
        }

        UI.showLoadingInContainer(`${tabName}-content`, loadingText);
      }
    }

    targetContent.classList.add("active");
  }
}

function init() {
  UI.loginButton.addEventListener("click", login);
  UI.apiKeyInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      login();
    }
  });

  // Add event listeners for the view toggle buttons
  if (UI.tableViewButton) {
    UI.tableViewButton.addEventListener("click", function () {
      UI.switchToTableView();
    });
  }

  if (UI.jsonViewButton) {
    UI.jsonViewButton.addEventListener("click", function () {
      UI.switchToJsonView();
    });
  }

  // Add refresh button to dashboard header
  addRefreshButtonToDashboard();
}

function addRefreshButtonToDashboard() {
  const header = document.querySelector(".main-header");
  if (header && header.querySelector("#page-title")) {
    // Check if header content already exists to avoid duplication
    let headerContent = header.querySelector(".header-content");
    if (!headerContent) {
      headerContent = document.createElement("div");
      headerContent.className = "header-content";

      // Get the existing title without cloning to avoid duplication
      const title = document.getElementById("page-title");
      if (title) {
        // First make sure the title is not already in a header-content div
        if (!title.closest(".header-content")) {
          headerContent.appendChild(title);
        } else {
          // If title is already in a header-content, use that container
          headerContent = title.closest(".header-content");
        }
      }

      // Only append the headerContent if it's not already a child
      if (
        !header.contains(headerContent) &&
        headerContent.children.length > 0
      ) {
        header.appendChild(headerContent);
      }
    }

    // Create the refresh button if it doesn't exist
    let refreshBtn = document.getElementById("refresh-dashboard");
    if (!refreshBtn) {
      refreshBtn = document.createElement("button");
      refreshBtn.id = "refresh-dashboard";
      refreshBtn.className = "refresh-btn";
      refreshBtn.title = "Refresh All Data";
      refreshBtn.innerHTML = "🔄";

      // Add click event to refresh ALL data
      refreshBtn.addEventListener("click", function () {
        // Trigger global refresh across all tabs
        globalRefreshAllData();
      });

      // Only add refresh button if headerContent doesn't already have it
      if (!headerContent.querySelector(".refresh-btn")) {
        headerContent.appendChild(refreshBtn);
      }
    }
  }
}

// Function to show/hide the refresh button based on current tab
function toggleRefreshButton(tabName) {
  const refreshBtn = document.getElementById("refresh-dashboard");
  if (refreshBtn) {
    if (tabName === "dashboard" || tabName === "transactions" || tabName === "tags" || tabName === "analysis" || tabName === "reports") {
      refreshBtn.style.display = "flex";
    } else {
      refreshBtn.style.display = "none";
    }
  }
}

// Function to globally refresh data across all tabs
function globalRefreshAllData() {
  // Set global loading state
  UI.setGlobalLoadingState(true);

  // Update refresh button to show hourglass during loading
  const refreshBtn = document.getElementById("refresh-dashboard");
  if (refreshBtn) {
    refreshBtn.innerHTML = "⏳"; // Hourglass icon during loading
  }

  // Show the same loading style for all tabs using dashboard loading as the template
  // For dashboard, use the existing loading mechanism
  showDashboardLoadingPlaceholder(true);
  const dashboardLoadedContent = document.getElementById("dashboard-loaded-content");
  if (dashboardLoadedContent) {
    dashboardLoadedContent.style.display = "none";
  }

  // For other tabs, use the UI module's overlay loading method for consistency
  UI.showLoadingInContainer("transactions-content", "Loading transaction data...");
  UI.showLoadingInContainer("tags-content", "Loading tag data...");
  UI.showLoadingInContainer("analysis-content", "Loading analysis data...");
  UI.showLoadingInContainer("reports-content", "Loading reports data...");

  // Clear caches to force reload
  cachedData = null;
  cachedOpeningBalance = null;

  // Track completion of all async operations
  let completedOperations = 0;
  const totalOperations = 2; // Opening balance + app data (which includes expenses and tags), and separate transaction data

  // Operation 1: Refresh opening balance and app data (expenses + tags)
  API.getOpeningBalance(UI.getApiKey(), (balanceResponse) => {
    let openingBalance = 0;
    if (balanceResponse.success) {
      openingBalance = parseFloat(balanceResponse.balance) || 0;
      cachedOpeningBalance = openingBalance;
    }

    API.getAppData(UI.getApiKey(), (response) => {
      if (response.success) {
        cachedData = response.data.expenses;
        Tags.setTags(response.data.tags); // Update tags globally

        // Update dashboard content if dashboard is active
        const activeTab = document.querySelector('.nav-item.active');
        if (activeTab && activeTab.getAttribute('data-tab') === 'dashboard') {
          const timeframeSelect = document.getElementById("timeframe-select");
          const selectedTimeframe = timeframeSelect?.value || "past_30_days";
          calculateAndDisplayStats(cachedData, cachedOpeningBalance, selectedTimeframe);
        }

        // Update tags content
        const tagExpenseCounts = calculateTagExpenseCounts(cachedData || []);
        UI.displayTagsTable(Tags.getTags(), tagExpenseCounts);
        UI.showTagsTableView();
      }

      completedOperations++;
      checkGlobalRefreshComplete(completedOperations, totalOperations);
    });
  });

  // Operation 2: Refresh transaction data (this will also update cachedData)
  API.getData(UI.getApiKey(), (response) => {
    if (response.success) {
      // Update cached data with transaction data
      cachedData = response.data;

      // Update transactions content if transactions tab is active
      const activeTab = document.querySelector('.nav-item.active');
      if (activeTab && activeTab.getAttribute('data-tab') === 'transactions') {
        UI.displayDataInTable(response.data);
        UI.showDataDisplay();
      }
    }

    completedOperations++;
    checkGlobalRefreshComplete(completedOperations, totalOperations);
  });
}

// Check if all data refresh operations are complete
function checkGlobalRefreshComplete(completed, total) {
  if (completed >= total) {
    // Hide loading from all containers
    // For dashboard, use the existing mechanism
    showDashboardLoadingPlaceholder(false);
    const dashboardLoadedContent = document.getElementById("dashboard-loaded-content");
    if (dashboardLoadedContent) {
      dashboardLoadedContent.style.display = "block";
    }

    // For other tabs, use the UI module's method to hide loading
    UI.hideLoadingInContainer("transactions-content");
    UI.hideLoadingInContainer("tags-content");
    UI.hideLoadingInContainer("analysis-content");
    UI.hideLoadingInContainer("reports-content");

    // Reset global loading state
    UI.setGlobalLoadingState(false);

    // Restore refresh icon on the refresh button
    const refreshBtn = document.getElementById("refresh-dashboard");
    if (refreshBtn) {
      refreshBtn.innerHTML = "🔄"; // Refresh icon after loading complete
    }
  }
}

// Function to remove the loading overlay from a content area
function removeLoadingOverlay(contentId) {
  const content = document.getElementById(contentId);
  if (content) {
    const existingOverlay = content.querySelector('.loading-overlay');
    if (existingOverlay) {
      content.removeChild(existingOverlay);
    }
  }
}

// Initialize periodic cleanup of stale requests
function startRequestCleanup() {
  // Clean up stale requests every 30 seconds
  setInterval(() => {
    RequestManager.cleanupStaleRequests();
  }, 30000); // 30 seconds
}

// Function to clear all active requests (e.g., on logout)
function clearAllActiveRequests() {
  RequestManager.clearAllRequests();
}

// Start the cleanup process after initialization
init();
startRequestCleanup();
