// Main entry point
function doGet(e) {
  const action = e.parameter.action || "login";
  const providedKey = e.parameter.apiKey;

  if (providedKey !== getApiKey()) {
    return createJsonResponse(
      { success: false, message: "Invalid key" },
      e.parameter.callback
    );
  }

  let response;
  switch (action) {
    case "login":
      response = handleLogin();
      break;
    case "saveData":
      response = handleSaveData(e);
      break;
    case "getData":
      response = handleGetData();
      break;
    case "getAppData":
      response = handleGetAppData();
      break;
    case "addTag":
      response = _addTag(e.parameter.type, e.parameter.value);
      break;
    case "updateExpenses":
      response = handleUpdateExpenses(e);
      break;
    case "deleteTag":
      response = handleDeleteTag(e);
      break;
    case "renameTag":
      response = handleRenameTag(e);
      break;
    case "processTagOperations":
      response = handleProcessTagOperations(e);
      break;
    case "getOpeningBalance":
      response = handleGetOpeningBalance();
      break;
    case "saveOpeningBalance":
      response = handleSaveOpeningBalance(e);
      break;
    default:
      response = { success: false, message: "Invalid action" };
  }

  return createJsonResponse(response, e.parameter.callback);
}

function handleDeleteTag(e) {
  const type = e.parameter.type;
  const value = e.parameter.value;
  const deleteResult = _deleteTag(type, value);
  if (deleteResult.success) {
    _removeTagFromExpenses(type, value);
  }
  return deleteResult;
}

function handleRenameTag(e) {
  const type = e.parameter.type;
  const oldValue = e.parameter.oldValue;
  const newValue = e.parameter.newValue;
  return _renameTag(type, oldValue, newValue);
}

function handleProcessTagOperations(e) {
  try {
    // Parse the operations array from the parameter
    const operationsParam = e.parameter.operations;
    if (!operationsParam) {
      return { success: false, message: "No operations parameter provided" };
    }

    const operations = JSON.parse(operationsParam);
    return _processTagOperations(operations);
  } catch (error) {
    console.error("Error processing tag operations:", error);
    return { success: false, message: "Error processing tag operations: " + error.message };
  }
}

function handleGetAppData() {
  const expenses = handleGetData();
  const tags = _getTags();
  return { success: true, data: { expenses: expenses.data, tags: tags } };
}

function createJsonResponse(data, callback) {
  const jsonp = (callback || "callback") + "(" + JSON.stringify(data) + ")";
  return ContentService.createTextOutput(jsonp).setMimeType(
    ContentService.MimeType.JAVASCRIPT
  );
}

function handleGetOpeningBalance() {
  try {
    const configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
      CONFIG.CONFIG_SHEET
    );
    if (!configSheet) {
      // Create Config sheet if it doesn't exist
      const newSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(
        CONFIG.CONFIG_SHEET
      );
      // Initialize with default values - set opening balance to 0
      newSheet.getRange(CONFIG.API_KEY_CELL).setValue("API Key");
      newSheet.getRange(CONFIG.OPENING_BALANCE_CELL).setValue(0);
      return { success: true, balance: 0 };
    }

    // Get the value from the opening balance cell (B1)
    const balanceCell = configSheet.getRange(CONFIG.OPENING_BALANCE_CELL);
    const balance = balanceCell.getValue();

    // If balance is empty, set it to 0
    if (balance === "" || balance === null || balance === undefined) {
      balanceCell.setValue(0);
      return { success: true, balance: 0 };
    }

    return { success: true, balance: parseFloat(balance) || 0 };
  } catch (error) {
    console.error("Error getting opening balance:", error);
    return {
      success: false,
      message: "Error getting opening balance: " + error.message,
    };
  }
}

function handleSaveOpeningBalance(e) {
  try {
    const balance = parseFloat(e.parameter.balance);
    if (isNaN(balance)) {
      return { success: false, message: "Invalid balance value" };
    }

    // Get or create the Config sheet
    let configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
      CONFIG.CONFIG_SHEET
    );
    if (!configSheet) {
      configSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(
        CONFIG.CONFIG_SHEET
      );
      // Initialize with default values
      configSheet.getRange(CONFIG.API_KEY_CELL).setValue("API Key");
      configSheet.getRange(CONFIG.OPENING_BALANCE_CELL).setValue(""); // Will be set below
    }

    // Set the opening balance in the designated cell
    configSheet.getRange(CONFIG.OPENING_BALANCE_CELL).setValue(balance);

    return { success: true, message: "Opening balance saved successfully" };
  } catch (error) {
    console.error("Error saving opening balance:", error);
    return {
      success: false,
      message: "Error saving opening balance: " + error.message,
    };
  }
}
