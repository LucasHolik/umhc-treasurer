// Main entry point
function doGet(e) {
  try {
    const action = e.parameter.action || "login";
    const providedKey = e.parameter.apiKey;

    if (providedKey !== Service_Auth.getApiKey()) {
      return createJsonResponse(
        { success: false, message: "Invalid key" },
        e.parameter.callback
      );
    }

    let response;
    switch (action) {
      case "login":
        response = Service_Auth.login();
        break;
      case "saveData":
        response = Service_Sheet.saveData(e);
        break;
      case "getData":
        response = Service_Sheet.getData();
        break;
      case "getAppData":
        response = getAppData();
        break;
      case "addTag":
        response = Service_Tags.addTag(e.parameter.type, e.parameter.value);
        break;
      case "updateExpenses":
        response = Service_Sheet.updateExpenses(e);
        break;
      case "deleteTag":
        response = Service_Tags.deleteTag(e);
        break;
      case "renameTag":
        response = Service_Tags.renameTag(e);
        break;
      case "processTagOperations":
        response = Service_Tags.processTagOperations(e);
        break;
      case "getOpeningBalance":
        response = Service_Sheet.getOpeningBalance();
        break;
      case "saveOpeningBalance":
        response = Service_Sheet.saveOpeningBalance(e);
        break;
      default:
        response = { success: false, message: "Invalid action" };
    }

    return createJsonResponse(response, e.parameter.callback);
  } catch (error) {
    return createJsonResponse(
      { success: false, message: "Server Error: " + error.toString() },
      e && e.parameter ? e.parameter.callback : "callback"
    );
  }
}

function getAppData() {
  try {
    const expenses = Service_Sheet.getData();
    if (!expenses.success) {
        throw new Error(expenses.message || "Failed to fetch expenses");
    }

    const tags = Service_Tags.getTags();
    const openingBalance = Service_Sheet.getOpeningBalance();
    
    return { 
      success: true, 
      data: { 
        expenses: expenses.data, 
        tags: tags,
        openingBalance: openingBalance.success ? openingBalance.balance : 0
      } 
    };
  } catch (error) {
    return { success: false, message: "Error loading app data: " + error.toString() };
  }
}

function createJsonResponse(data, callback) {
  const jsonp = (callback || "callback") + "(" + JSON.stringify(data) + ")";
  return ContentService.createTextOutput(jsonp).setMimeType(
    ContentService.MimeType.JAVASCRIPT
  );
}
