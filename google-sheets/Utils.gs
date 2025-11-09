// See google-sheets/README.md for deployment instructions.

/**
 * Creates a ContentService.TextOutput object for JSON responses.
 *
 * @param {object} data The data to be returned as JSON.
 * @returns {GoogleAppsScript.Content.TextOutput} A TextOutput object formatted for web app responses.
 */
function createTextOutput(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}