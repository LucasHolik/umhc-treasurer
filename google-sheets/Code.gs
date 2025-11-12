// Main entry point
function doGet(e) {
  const action = e.parameter.action || "login";
  const providedKey = e.parameter.apiKey;

  if (providedKey !== getApiKey()) {
    return createJsonResponse({ success: false, message: "Invalid key" }, e.parameter.callback);
  }

  let response;
  switch (action) {
    case "login":
      response = handleLogin();
      break;
    case "saveData":
      response = handleSaveData(e);
      break;
    case "getData":
      response = handleGetData();
      break;
    default:
      response = { success: false, message: "Invalid action" };
  }

  return createJsonResponse(response, e.parameter.callback);
}

function createJsonResponse(data, callback) {
  const jsonp = (callback || "callback") + "(" + JSON.stringify(data) + ")";
  return ContentService.createTextOutput(jsonp).setMimeType(
    ContentService.MimeType.JAVASCRIPT
  );
}
