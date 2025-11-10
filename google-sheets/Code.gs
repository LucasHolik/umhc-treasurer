// The main entry point for the web app
function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config');
  const value = sheet.getRange('A2').getValue();
  
  const callback = e.parameter.callback || 'callback';
  const jsonp = `${callback}(${JSON.stringify({ value: value })})`;
  
  return ContentService.createTextOutput(jsonp).setMimeType(ContentService.MimeType.JAVASCRIPT);
}