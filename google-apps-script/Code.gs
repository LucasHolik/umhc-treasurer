// Main entry point
function doGet(e) {
  try {
    const action = e?.parameter?.action || "login";
    const timestamp = e?.parameter?.timestamp;
    const signature = e?.parameter?.signature;

    if (!Service_Auth.verifyRequest(action, timestamp, signature)) {
      return createJsonResponse(
        { success: false, message: "Unauthorized" },
        e?.parameter?.callback
      );
    }

    let response;
    switch (action) {
      case "login":
        response = Service_Auth.login();
        break;
      case "saveData":
        response = e?.parameter
          ? Service_Sheet.saveData(e)
          : { success: false, message: "Missing parameters" };
        break;
      case "getData":
        response = Service_Sheet.getData();
        break;
      case "getAppData":
        response = getAppData();
        break;
      case "addTag":
        response = Service_Tags.addTag(
          e?.parameter?.type,
          e?.parameter?.value,
          e?.parameter?.extraData
        );
        break;
      case "updateExpenses":
        response = e?.parameter
          ? Service_Sheet.updateExpenses(e)
          : { success: false, message: "Missing parameters" };
        break;
      case "deleteTag":
        response = e?.parameter
          ? Service_Tags.deleteTag(e)
          : { success: false, message: "Missing parameters" };
        break;
      case "renameTag":
        response = e?.parameter
          ? Service_Tags.renameTag(e)
          : { success: false, message: "Missing parameters" };
        break;
      case "processTagOperations":
        response = e?.parameter
          ? Service_Tags.processTagOperations(e)
          : { success: false, message: "Missing parameters" };
        break;
      case "getOpeningBalance":
        response = Service_Sheet.getOpeningBalance();
        break;
      case "saveOpeningBalance":
        response = e?.parameter
          ? Service_Sheet.saveOpeningBalance(e)
          : { success: false, message: "Missing parameters" };
        break;
      case "splitTransaction":
        response = e?.parameter
          ? Service_Split.processSplit(e)
          : { success: false, message: "Missing parameters" };
        break;
      case "revertSplit":
        response = e?.parameter
          ? Service_Split.revertSplit(e)
          : { success: false, message: "Missing parameters" };
        break;
      case "editSplit":
        response = e?.parameter
          ? Service_Split.editSplit(e)
          : { success: false, message: "Missing parameters" };
        break;
      case "getSplitGroup":
        response = e?.parameter
          ? Service_Split.getSplitGroup(e)
          : { success: false, message: "Missing parameters" };
        break;
      case "getSplitHistory":
        response = e?.parameter
          ? Service_Split.getSplitHistory(e)
          : { success: false, message: "Missing parameters" };
        break;
      default:
        response = { success: false, message: "Invalid action" };
    }

    return createJsonResponse(response, e?.parameter?.callback);
  } catch (error) {
    console.error("Server error in doGet: " + error.toString());
    return createJsonResponse(
      { success: false, message: "Server Error" },
      e?.parameter?.callback
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
  let safeCallback = callback || "callback";
  const callbackRegex =
    /^[a-zA-Z_$][a-zA-Z0-9_$]*(\.[a-zA-Z_$][a-zA-Z0-9_$]*)*$/;

  if (!callbackRegex.test(safeCallback)) {
    // Log the attempt and use default callback
    console.warn("Invalid callback parameter detected: " + safeCallback);
    safeCallback = "callback";
  }

  const jsonp = safeCallback + "(" + JSON.stringify(data) + ")";
  return ContentService.createTextOutput(jsonp).setMimeType(
    ContentService.MimeType.JAVASCRIPT
  );
}
