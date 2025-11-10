// The main entry point for the web app
function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config');
  const storedKey = sheet.getRange('A1').getValue();
  const providedKey = e.parameter.apiKey;

  let response;
  if (providedKey === storedKey) {
    response = { success: true };
  } else {
    response = { success: false, message: 'Invalid key' };
  }

  const callback = e.parameter.callback || 'callback';
  const jsonp = `${callback}(${JSON.stringify(response)})`;

  return ContentService.createTextOutput(jsonp).setMimeType(ContentService.MimeType.JAVASCRIPT);
}
