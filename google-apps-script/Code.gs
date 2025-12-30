// Main entry point
function doGet(e) {
  try {
    const action = e?.parameter?.action || "login";
    const providedKey = e?.parameter?.apiKey;

    if (providedKey !== Service_Auth.getApiKey()) {
      return createJsonResponse(
        { success: false, message: "Invalid key" },
        e?.parameter?.callback
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
      case "splitTransaction":
        response = Service_Split.processSplit(e);
        break;
      case "revertSplit":
        response = Service_Split.revertSplit(e);
        break;
      case "editSplit":
        response = Service_Split.editSplit(e);
        break;
      case "getSplitGroup":
        response = Service_Split.getSplitGroup(e);
        break;
      case "getSplitHistory":
        response = Service_Split.getSplitHistory(e);
        break;
      default:
        response = { success: false, message: "Invalid action" };
    }

    return createJsonResponse(response, e?.parameter?.callback);
  } catch (error) {
    Logger.log("Server error in doGet: " + error.toString());
    return createJsonResponse(
      { success: false, message: "Server Error" },
      e?.parameter?.callback ? e.parameter.callback : "callback"
    );
  }
}

function getAppData() {
  try {
    const expenses = Service_Sheet.getData();
    if (!expenses.success) {
      throw new Error(expenses.message || "Failed to fetch expenses");
    }

    let tags = {
      "Trip/Event": [],
      Category: [],
      Type: [],
      TripTypeMap: {},
      TripStatusMap: {},
    };
    try {
      tags = Service_Tags.getTags();
    } catch (tagError) {
      console.error("Error fetching tags:", tagError.toString());
    }

    let openingBalance = { success: true, balance: 0 };
    try {
      openingBalance = Service_Sheet.getOpeningBalance();
    } catch (balanceError) {
      console.error("Error fetching opening balance:", balanceError.toString());
    }

    let splitTransactions = { success: true, data: [] };
    try {
      splitTransactions = Service_Split.getAllSplitHistory();
      if (!splitTransactions.success) {
        console.error(
          "Failed to fetch split transactions:",
          splitTransactions.message
        );
        // Don't throw, just log and return empty array for splits
        splitTransactions.data = [];
      }
    } catch (splitError) {
      console.error(
        "Error fetching split transactions:",
        splitError.toString()
      );
      splitTransactions.data = [];
    }

    return {
      success: true,
      data: {
        expenses: expenses.data,
        tags: tags,
        openingBalance: openingBalance.success ? openingBalance.balance : 0,
        splitTransactions: splitTransactions.data,
      },
    };
  } catch (error) {
    console.error("Error in getAppData: " + error.toString());
    return {
      success: false,
      message: "Error loading app data",
    };
  }
}

function createJsonResponse(data, callback) {
  // Validate callback to prevent XSS - only allow safe JavaScript identifiers
  const safeCallback = callback || "callback";
  const callbackRegex =
    /^[a-zA-Z_$][a-zA-Z0-9_$]*(\.[a-zA-Z_$][a-zA-Z0-9_$]*)*$/;

  if (!callbackRegex.test(safeCallback)) {
    // Log the attempt and use default callback
    Logger.log("Invalid callback parameter detected: " + safeCallback);
    callback = "callback";
  } else {
    callback = safeCallback;
  }

  const jsonp = callback + "(" + JSON.stringify(data) + ")";
  return ContentService.createTextOutput(jsonp).setMimeType(
    ContentService.MimeType.JAVASCRIPT
  );
}
