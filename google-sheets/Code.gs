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
    case "getAppData":
      response = handleGetAppData();
      break;
    case "addTag":
      response = _addTag(e.parameter.type, e.parameter.value);
      break;
    case "updateExpenses":
      response = handleUpdateExpenses(e);
      break;
    case "deleteTag":
      response = handleDeleteTag(e);
      break;
    default:
      response = { success: false, message: "Invalid action" };
  }

  return createJsonResponse(response, e.parameter.callback);
}

function handleDeleteTag(e) {
  const type = e.parameter.type;
  const value = e.parameter.value;
  const deleteResult = _deleteTag(type, value);
  if (deleteResult.success) {
    _removeTagFromExpenses(type, value);
  }
  return deleteResult;
}

function handleGetAppData() {
  const expenses = handleGetData();
  const tags = _getTags();
  return { success: true, data: { expenses: expenses.data, tags: tags } };
}

function createJsonResponse(data, callback) {
  const jsonp = (callback || "callback") + "(" + JSON.stringify(data) + ")";
  return ContentService.createTextOutput(jsonp).setMimeType(
    ContentService.MimeType.JAVASCRIPT
  );
}
