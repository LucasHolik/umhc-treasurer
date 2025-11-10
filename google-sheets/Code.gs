// See google-sheets/README.md for deployment instructions.

/**
 * The main entry point for all JSONP web requests.
 * This function acts as a router, directing the request to the appropriate
 * function based on the 'action' parameter from the URL.
 *
 * It returns a JSONP response by wrapping the JSON result in a callback function.
 *
 * @param {Object} e The event parameter from the Apps Script web request.
 * @returns {GoogleAppsScript.Content.TextOutput} A JavaScript response for JSONP.
 */
function doGet(e) {
  const sheetNameFinances = "Finances";
  const sheetNameConfig = "Config";
  const configKeyCell = "A1";

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const financesSheet = spreadsheet.getSheetByName(sheetNameFinances);
  const configSheet = spreadsheet.getSheetByName(sheetNameConfig);

  let response = {};
  const action = e.parameter.action;
  const callback = e.parameter.callback;

  try {
    // Get the stored shared key from the Config sheet
    const storedKey = configSheet.getRange(configKeyCell).getValue();

    // Check for valid key for all actions
    if (e.parameter.sharedKey !== storedKey) {
      response = { success: false, message: "Unauthorized: Invalid shared key." };
    } else {
      // Use a "switch" statement on the action to decide what to do
      switch (action) {
        case "getFinances":
          response = getFinances(financesSheet);
          break;
        case "addEntry":
          // Pass the entire parameter object to addEntry
          response = addEntry(financesSheet, e.parameter);
          break;
        case "changeKey":
          // Pass the entire parameter object to changeKey
          response = changeKey(configSheet, configKeyCell, e.parameter);
          break;
        default:
          response = { success: false, message: "Invalid action specified." };
          break;
      }
    }
  } catch (error) {
    response = { success: false, message: "Server Error: " + error.message };
  }

  // --- The JSONP Response ---
  // Wrap the JSON response in the callback function and set the MIME type to JAVASCRIPT
  return ContentService
    .createTextOutput(callback + "(" + JSON.stringify(response) + ")")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}