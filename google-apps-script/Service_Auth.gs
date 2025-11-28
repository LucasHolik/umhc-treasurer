var Service_Auth = {
  getApiKey: function() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
      CONFIG.CONFIG_SHEET
    );
    if (sheet) {
        return sheet.getRange(CONFIG.API_KEY_CELL).getValue();
    }
    return null;
  },

  login: function() {
    return { success: true };
  }
};