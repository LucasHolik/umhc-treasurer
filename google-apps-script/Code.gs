const READ_ACTIONS = new Set([
  "ping",
  "logout",
  "getData",
  "getAppData",
  "getOpeningBalance",
  "getSplitGroup",
  "getSplitHistory",
]);

const WRITE_ACTIONS = new Set([
  "saveData",
  "addTag",
  "updateExpenses",
  "deleteTag",
  "renameTag",
  "processTagOperations",
  "saveOpeningBalance",
  "splitTransaction",
  "revertSplit",
  "editSplit",
]);

const AUTH_ACTIONS = new Set(["login"]);

function isKnownAction(action) {
  return (
    READ_ACTIONS.has(action) ||
    WRITE_ACTIONS.has(action) ||
    AUTH_ACTIONS.has(action)
  );
}

function isActionAllowed(action, role) {
  if (role === "admin") return true;
  if (role === "viewer") {
    return READ_ACTIONS.has(action) || AUTH_ACTIONS.has(action);
  }
  return false;
}

// Main entry point
function doGet(e) {
  try {
    const action = e?.parameter?.action || "login";
    const timestamp = e?.parameter?.timestamp;
    const signature = e?.parameter?.signature;

    const authResult = Service_Auth.verifyRequest(
      action,
      timestamp,
      signature,
      e?.parameter,
    );
    if (!authResult || !authResult.authorized) {
      return createJsonResponse(
        { success: false, message: "Unauthorized" },
        e?.parameter?.callback,
      );
    }
    // Least-privilege default: anything that isn't explicitly "admin" (missing,
    // misspelled, a future role, or a corrupted session) is treated as viewer.
    const role = authResult.role === "admin" ? "admin" : "viewer";

    if (isKnownAction(action) && !isActionAllowed(action, role)) {
      return createJsonResponse(
        { success: false, message: "Forbidden" },
        e?.parameter?.callback,
      );
    }

    let response;
    switch (action) {
      case "login":
        response = Service_Auth.login(role);
        break;
      case "ping":
        response = { success: true, role: role };
        break;
      case "logout":
        Service_Session.invalidateSession(e?.parameter?.sessionId);
        response = { success: true };
        break;
      case "saveData":
        if (!e?.parameter?.data) {
          response = {
            success: false,
            message: "Missing required parameter: data",
          };
        } else {
          const validation = validateJsonParameter(e.parameter.data, "array");
          if (!validation.valid) {
            response = {
              success: false,
              message: "Invalid data parameter: " + validation.message,
            };
          } else {
            response = Service_Sheet.saveData(e);
          }
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
            e?.parameter?.extraData,
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
          const validation = validateJsonParameter(e.parameter.data, "array");
          if (!validation.valid) {
            response = {
              success: false,
              message: "Invalid data parameter: " + validation.message,
            };
          } else {
            response = Service_Sheet.updateExpenses(e);
          }
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
          const validation = validateJsonParameter(
            e.parameter.operations,
            "array",
          );
          if (!validation.valid) {
            response = {
              success: false,
              message: "Invalid operations parameter: " + validation.message,
            };
          } else {
            response = Service_Tags.processTagOperations(e);
          }
        }
        break;
      case "getOpeningBalance":
        response = Service_Sheet.getOpeningBalance();
        break;
      case "saveOpeningBalance":
        if (
          e?.parameter?.balance === undefined ||
          e?.parameter?.balance === null
        ) {
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
          const validation = validateJsonParameter(e.parameter.data, "object");
          if (!validation.valid) {
            response = {
              success: false,
              message: "Invalid data parameter: " + validation.message,
            };
          } else {
            response = Service_Split.processSplit(e);
          }
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
          const validation = validateJsonParameter(e.parameter.data, "object");
          if (!validation.valid) {
            response = {
              success: false,
              message: "Invalid data parameter: " + validation.message,
            };
          } else {
            response = Service_Split.editSplit(e);
          }
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
    console.error("Server error in doGet:", error);
    return createJsonResponse(
      { success: false, message: "Server error. Please try again." },
      e?.parameter?.callback,
    );
  }
}

// Reads everything under ONE script lock so expenses, tags, opening balance
// and splits all come from the same moment: entirely before a write or
// entirely after it. The services' own locks nest inside it (Service_Lock).
// If any part fails, the whole load fails: the client keeps its last good
// state rather than showing partial data as if it were correct.
function getAppData() {
  return Service_Lock.withScriptLock(() => {
    let part = "expenses";
    try {
      const expenses = Service_Sheet.getData();
      if (!expenses.success) throw new Error(expenses.message);

      part = "tags";
      const tags = Service_Tags.getTags();

      part = "opening balance";
      const openingBalance = Service_Sheet.getOpeningBalance();
      if (!openingBalance.success) throw new Error(openingBalance.message);

      part = "split transactions";
      const splitTransactions = Service_Split.getAllSplitHistory();
      if (!splitTransactions.success) {
        throw new Error(splitTransactions.message);
      }

      return {
        success: true,
        data: {
          expenses: expenses.data,
          tags: tags,
          openingBalance: openingBalance.balance,
          splitTransactions: splitTransactions.data,
        },
      };
    } catch (error) {
      console.error("Error in getAppData (" + part + "): " + error.toString());
      return {
        success: false,
        message: "Error loading app data",
      };
    }
  });
}

function createJsonResponse(data, callback) {
  // Validate callback to prevent XSS - only allow safe JavaScript identifiers
  let safeCallback = callback || "callback";
  const callbackRegex = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

  if (!callbackRegex.test(safeCallback)) {
    // Log the attempt and use default callback
    console.warn("Invalid callback parameter detected: " + safeCallback);
    safeCallback = "callback";
  }

  const jsonp = safeCallback + "(" + JSON.stringify(data) + ")";
  return ContentService.createTextOutput(jsonp).setMimeType(
    ContentService.MimeType.JAVASCRIPT,
  );
}

/**
 * Sanitizes a user-supplied string before writing it to a Google Sheets cell.
 * Prefixes values that start with a formula character (=, +, -, @, tab, CR)
 * with an apostrophe so Sheets treats them as plain text, preventing formula injection.
 * @param {*} value
 * @returns {string}
 */
function _sanitizeForSheet(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (
    str.length > 0 &&
    ["=", "+", "-", "@", "\t", "\r", "\n"].includes(str[0])
  ) {
    return "'" + str;
  }
  return str;
}

/**
 * Applies _sanitizeForSheet to every string cell of a getValues()-style grid
 * before it is written back with setValues. getValues() returns stored text
 * without the protective apostrophe, so writing a grid back raw would turn a
 * value such as "-Misc" or "=..." into a formula (#ERROR! or worse) in every
 * untouched cell. Numbers, dates and booleans are left as they are, and
 * already-sanitised strings pass through unchanged.
 * @param {Array<Array<*>>} values
 * @returns {Array<Array<*>>}
 */
function _sanitizeGridForSheet(values) {
  return values.map((row) =>
    row.map((v) => (typeof v === "string" ? _sanitizeForSheet(v) : v)),
  );
}

function validateJsonParameter(jsonString, expectedType) {
  try {
    if (!jsonString) return { valid: false, message: "Missing content" };
    const parsed = JSON.parse(jsonString);
    if (expectedType === "array" && !Array.isArray(parsed)) {
      return { valid: false, message: "Expected array" };
    }
    if (
      expectedType === "object" &&
      (Array.isArray(parsed) || typeof parsed !== "object" || parsed === null)
    ) {
      return { valid: false, message: "Expected object" };
    }
    return { valid: true };
  } catch (e) {
    return { valid: false, message: "Invalid JSON format" };
  }
}
