// See google-sheets/README.md for deployment instructions.

/**
 * Creates a ContentService.TextOutput object for JSON responses with CORS headers.
 *
 * @param {object} data The data to be returned as JSON.
 * @returns {GoogleAppsScript.Content.TextOutput} A TextOutput object formatted for web app responses.
 */
function createTextOutput(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON)
    .addHeader("Access-Control-Allow-Origin", "https://lucasholik.github.io");
  return output;
}