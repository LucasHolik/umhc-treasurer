// Main entry point
function doGet(e) {
  try {
    const action = e?.parameter?.action || "login";
    const timestamp = e?.parameter?.timestamp;
    const signature = e?.parameter?.signature;

    if (
      !Service_Auth.verifyRequest(action, timestamp, signature, e?.parameter)
    ) {
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
      case "ping":
        response = { success: true };
        break;
      case "saveData":
        if (!e?.parameter?.data) {
          response = {
            success: false,
            message: "Missing required parameter: data",
          };
        } else {
          response = Service_Sheet.saveData(e);
        }
        break;
      case "getData":
        response = Service_Sheet.getData();
        break;
      case "getAppData":
        response = getAppData();
        break;
      case "addTag":
        if (!e?.parameter?.type || !e?.parameter?.value) {
          response = {
            success: false,
            message: "Missing required parameters: type, value",
          };
        } else {
          response = Service_Tags.addTag(
            e?.parameter?.type,
            e?.parameter?.value,
            e?.parameter?.extraData
          );
        }
        break;
      case "updateExpenses":
        if (!e?.parameter?.data) {
          response = {
            success: false,
            message: "Missing required parameter: data",
          };
        } else {
          response = Service_Sheet.updateExpenses(e);
        }
        break;
      case "deleteTag":
        if (!e?.parameter?.type || !e?.parameter?.value) {
          response = {
            success: false,
            message: "Missing required parameters: type, value",
          };
        } else {
          response = Service_Tags.deleteTag(e);
        }
        break;
      case "renameTag":
        if (
          !e?.parameter?.type ||
          !e?.parameter?.oldValue ||
          !e?.parameter?.newValue
        ) {
          response = {
            success: false,
            message: "Missing required parameters: type, oldValue, newValue",
          };
        } else {
          response = Service_Tags.renameTag(e);
        }
        break;
      case "processTagOperations":
        if (!e?.parameter?.operations) {
          response = {
            success: false,
            message: "Missing required parameter: operations",
          };
        } else {
          response = Service_Tags.processTagOperations(e);
        }
        break;
      case "getOpeningBalance":
        response = Service_Sheet.getOpeningBalance();
        break;
      case "saveOpeningBalance":
        if (e?.parameter?.balance == null) {
          response = {
            success: false,
            message: "Missing required parameter: balance",
          };
        } else {
          response = Service_Sheet.saveOpeningBalance(e);
        }
        break;
      case "splitTransaction":
        if (!e?.parameter?.data) {
          response = {
            success: false,
            message: "Missing required parameter: data",
          };
        } else {
          response = Service_Split.processSplit(e);
        }
        break;
      case "revertSplit":
        if (!e?.parameter?.groupId) {
          response = {
            success: false,
            message: "Missing required parameter: groupId",
          };
        } else {
          response = Service_Split.revertSplit(e);
        }
        break;
      case "editSplit":
        if (!e?.parameter?.groupId || !e?.parameter?.data) {
          response = {
            success: false,
            message: "Missing required parameters: groupId, data",
          };
        } else {
          response = Service_Split.editSplit(e);
        }
        break;
      case "getSplitGroup":
        if (!e?.parameter?.groupId) {
          response = {
            success: false,
            message: "Missing required parameter: groupId",
          };
        } else {
          response = Service_Split.getSplitGroup(e);
        }
        break;
      case "getSplitHistory":
        // page and pageSize are optional (have defaults in service), so strictly checking them might break default behavior.
        // However, checking that parameters object exists is still good practice if we expect at least empty params.
        // But since the original check was just 'e?.parameter', and we want to be specific...
        // If no required params, we can skip check or check for existence of known optionals?
        // Let's assume the client always sends page.
        if (!e?.parameter) {
          response = { success: false, message: "Missing parameters" };
        } else {
          response = Service_Split.getSplitHistory(e);
        }
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
