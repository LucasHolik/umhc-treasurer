// js/modules/api.js

const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyOuvUpzAAW2E75NjK7oeOixQRgxdyIRzl6c-qsX_8pyrwxbPK_w6SgQMdmsP1P8s8/exec";

function jsonpRequest(url, callback, timeout = 10000) { // 10 second default timeout
  const callbackName = "jsonp_callback_" + Math.round(100000 * Math.random());
  const script = document.createElement("script");

  // Create a timeout to handle hanging requests
  const timeoutId = setTimeout(() => {
    // Clean up if request timed out
    if (window[callbackName]) {
      delete window[callbackName];
    }
    if (document.body.contains(script)) {
      document.body.removeChild(script);
    }

    // Call the callback with an error response
    callback({
      success: false,
      message: "Request timed out after " + (timeout/1000) + " seconds. Please try again."
    });
  }, timeout);

  window[callbackName] = function (data) {
    // Clear timeout since request completed successfully
    clearTimeout(timeoutId);

    // Make sure to clean up the script element
    if (document.body.contains(script)) {
      document.body.removeChild(script);
    }
    delete window[callbackName];

    callback(data);
  };

  script.onerror = function() {
    // Handle script loading errors
    clearTimeout(timeoutId);
    if (window[callbackName]) {
      delete window[callbackName];
    }
    if (document.body.contains(script)) {
      document.body.removeChild(script);
    }

    callback({
      success: false,
      message: "Network error occurred. Please check your connection and try again."
    });
  };

  script.src =
    url + (url.includes("?") ? "&" : "?") + "callback=" + callbackName;
  document.body.appendChild(script);
}

export const API = {
  login(apiKey, callback) {
    const url = `${SCRIPT_URL}?apiKey=${encodeURIComponent(apiKey)}`;
    jsonpRequest(url, callback);
  },

  getData(apiKey, callback) {
    const url = `${SCRIPT_URL}?action=getData&apiKey=${encodeURIComponent(
      apiKey
    )}`;
    jsonpRequest(url, callback);
  },

  getAppData(apiKey, callback) {
    const url = `${SCRIPT_URL}?action=getAppData&apiKey=${encodeURIComponent(
      apiKey
    )}`;
    jsonpRequest(url, callback);
  },

  saveData(apiKey, data, callback) {
    const stringifiedData = JSON.stringify(data);
    const url = `${SCRIPT_URL}?action=saveData&apiKey=${encodeURIComponent(
      apiKey
    )}&data=${encodeURIComponent(stringifiedData)}`;
    jsonpRequest(url, callback);
  },

  addTag(apiKey, type, value, callback) {
    const url = `${SCRIPT_URL}?action=addTag&apiKey=${encodeURIComponent(
      apiKey
    )}&type=${encodeURIComponent(type)}&value=${encodeURIComponent(value)}`;
    jsonpRequest(url, callback);
  },

  updateExpenses(apiKey, data, callback) {
    const stringifiedData = JSON.stringify(data);
    const url = `${SCRIPT_URL}?action=updateExpenses&apiKey=${encodeURIComponent(
      apiKey
    )}&data=${encodeURIComponent(stringifiedData)}`;
    jsonpRequest(url, callback);
  },

  deleteTag(apiKey, type, value, callback) {
    const url = `${SCRIPT_URL}?action=deleteTag&apiKey=${encodeURIComponent(
      apiKey
    )}&type=${encodeURIComponent(type)}&value=${encodeURIComponent(value)}`;
    jsonpRequest(url, callback);
  },

  renameTag(apiKey, type, oldValue, newValue, callback) {
    const url = `${SCRIPT_URL}?action=renameTag&apiKey=${encodeURIComponent(
      apiKey
    )}&type=${encodeURIComponent(type)}&oldValue=${encodeURIComponent(
      oldValue
    )}&newValue=${encodeURIComponent(newValue)}`;
    jsonpRequest(url, callback);
  },

  processTagOperations(apiKey, operations, callback) {
    const operationsString = JSON.stringify(operations);
    const url = `${SCRIPT_URL}?action=processTagOperations&apiKey=${encodeURIComponent(
      apiKey
    )}&operations=${encodeURIComponent(operationsString)}`;
    jsonpRequest(url, callback);
  },

  // Get the opening balance from the Config sheet
  getOpeningBalance(apiKey, callback) {
    const url = `${SCRIPT_URL}?action=getOpeningBalance&apiKey=${encodeURIComponent(
      apiKey
    )}`;
    jsonpRequest(url, callback);
  },

  // Save the opening balance to the Config sheet
  saveOpeningBalance(apiKey, balance, callback) {
    const url = `${SCRIPT_URL}?action=saveOpeningBalance&apiKey=${encodeURIComponent(
      apiKey
    )}&balance=${encodeURIComponent(balance)}`;
    jsonpRequest(url, callback);
  },
};
