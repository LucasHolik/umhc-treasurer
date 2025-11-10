// See google-sheets/README.md for deployment instructions.

/**
 * Handles HTTP GET requests for testing deployment.
 */
function doGet(e) {
  return ContentService.createTextOutput("Hello from the correct script - version 2");
}

/**
 * Handles preflight requests for CORS.
 */
function doOptions(e) {
  return ContentService.createTextOutput()
    .addHeader("Access-Control-Allow-Origin", "https://lucasholik.github.io")
    .addHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
    .addHeader("Access-Control-Allow-Headers", "Content-Type");
}

/**
 * @OnlyCurrentDoc
 *
 * The main entry point for all web requests. This function acts as a router,
 * validating the request and directing it to the appropriate function based on the 'action' parameter.
 *
 * @param {Object} e The event parameter from the Apps Script web request.
 * @returns {GoogleAppsScript.Content.TextOutput} A JSON object with the result of the action.
 */
function doPost(e) {
  const sheetNameFinances = "Finances";
  const sheetNameConfig = "Config";
  const configKeyCell = "A1";

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const financesSheet = spreadsheet.getSheetByName(sheetNameFinances);
  const configSheet = spreadsheet.getSheetByName(sheetNameConfig);

  // Parse the incoming request body
  let params;
  try {
    params = JSON.parse(e.postData.contents);
  } catch (error) {
    return createTextOutput({ success: false, message: "Invalid JSON in request body." });
  }

  // Get the stored shared key from the Config sheet
  const storedKey = configSheet.getRange(configKeyCell).getValue();

  // Check for valid key
  if (params.sharedKey !== storedKey) {
    return createTextOutput({ success: false, message: "Unauthorized: Invalid shared key." });
  }

  // Use a "switch" statement on params.action to decide what to do
  switch (params.action) {
    case "getFinances":
      return createTextOutput(getFinances(financesSheet));
    case "addEntry":
      return createTextOutput(addEntry(financesSheet, params.payload));
    case "changeKey":
      return createTextOutput(changeKey(configSheet, configKeyCell, params.payload));
    default:
      return createTextOutput({ success: false, message: "Invalid action specified." });
  }
}