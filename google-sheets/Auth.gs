// google-sheets/Auth.gs

function getApiKey() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
    CONFIG.CONFIG_SHEET
  );
  return sheet.getRange(CONFIG.API_KEY_CELL).getValue();
}

function handleLogin() {
  return { success: true };
}
