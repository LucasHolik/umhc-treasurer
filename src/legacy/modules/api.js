// js/modules/api.js

import { RequestManager } from './request-manager.js';

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
    const requestKey = RequestManager.generateRequestKey('login', apiKey);

    if (!RequestManager.registerRequest(requestKey, callback)) {
      // Request is already in progress, callback will be called when it completes
      return;
    }

    const url = `${SCRIPT_URL}?apiKey=${encodeURIComponent(apiKey)}`;
    jsonpRequest(url, (response) => {
      RequestManager.completeRequest(requestKey, response);
    });
  },

  getData(apiKey, callback) {
    const requestKey = RequestManager.generateRequestKey('getData', apiKey);

    if (!RequestManager.registerRequest(requestKey, callback)) {
      // Request is already in progress, callback will be called when it completes
      return;
    }

    const url = `${SCRIPT_URL}?action=getData&apiKey=${encodeURIComponent(
      apiKey
    )}`;
    jsonpRequest(url, (response) => {
      RequestManager.completeRequest(requestKey, response);
    });
  },

  getAppData(apiKey, callback) {
    const requestKey = RequestManager.generateRequestKey('getAppData', apiKey);

    if (!RequestManager.registerRequest(requestKey, callback)) {
      // Request is already in progress, callback will be called when it completes
      return;
    }

    const url = `${SCRIPT_URL}?action=getAppData&apiKey=${encodeURIComponent(
      apiKey
    )}`;
    jsonpRequest(url, (response) => {
      RequestManager.completeRequest(requestKey, response);
    });
  },

  saveData(apiKey, data, callback) {
    const stringifiedData = JSON.stringify(data);
    const requestKey = RequestManager.generateRequestKey('saveData', apiKey, {data: stringifiedData});

    if (!RequestManager.registerRequest(requestKey, callback)) {
      // Request is already in progress, callback will be called when it completes
      return;
    }

    const url = `${SCRIPT_URL}?action=saveData&apiKey=${encodeURIComponent(
      apiKey
    )}&data=${encodeURIComponent(stringifiedData)}`;
    jsonpRequest(url, (response) => {
      RequestManager.completeRequest(requestKey, response);
    });
  },

  addTag(apiKey, type, value, callback) {
    const requestKey = RequestManager.generateRequestKey('addTag', apiKey, {type, value});

    if (!RequestManager.registerRequest(requestKey, callback)) {
      // Request is already in progress, callback will be called when it completes
      return;
    }

    const url = `${SCRIPT_URL}?action=addTag&apiKey=${encodeURIComponent(
      apiKey
    )}&type=${encodeURIComponent(type)}&value=${encodeURIComponent(value)}`;
    jsonpRequest(url, (response) => {
      RequestManager.completeRequest(requestKey, response);
    });
  },

  updateExpenses(apiKey, data, callback) {
    const stringifiedData = JSON.stringify(data);
    const requestKey = RequestManager.generateRequestKey('updateExpenses', apiKey, {data: stringifiedData});

    if (!RequestManager.registerRequest(requestKey, callback)) {
      // Request is already in progress, callback will be called when it completes
      return;
    }

    const url = `${SCRIPT_URL}?action=updateExpenses&apiKey=${encodeURIComponent(
      apiKey
    )}&data=${encodeURIComponent(stringifiedData)}`;
    jsonpRequest(url, (response) => {
      RequestManager.completeRequest(requestKey, response);
    });
  },

  deleteTag(apiKey, type, value, callback) {
    const requestKey = RequestManager.generateRequestKey('deleteTag', apiKey, {type, value});

    if (!RequestManager.registerRequest(requestKey, callback)) {
      // Request is already in progress, callback will be called when it completes
      return;
    }

    const url = `${SCRIPT_URL}?action=deleteTag&apiKey=${encodeURIComponent(
      apiKey
    )}&type=${encodeURIComponent(type)}&value=${encodeURIComponent(value)}`;
    jsonpRequest(url, (response) => {
      RequestManager.completeRequest(requestKey, response);
    });
  },

  renameTag(apiKey, type, oldValue, newValue, callback) {
    const requestKey = RequestManager.generateRequestKey('renameTag', apiKey, {type, oldValue, newValue});

    if (!RequestManager.registerRequest(requestKey, callback)) {
      // Request is already in progress, callback will be called when it completes
      return;
    }

    const url = `${SCRIPT_URL}?action=renameTag&apiKey=${encodeURIComponent(
      apiKey
    )}&type=${encodeURIComponent(type)}&oldValue=${encodeURIComponent(
      oldValue
    )}&newValue=${encodeURIComponent(newValue)}`;
    jsonpRequest(url, (response) => {
      RequestManager.completeRequest(requestKey, response);
    });
  },

  processTagOperations(apiKey, operations, callback) {
    const operationsString = JSON.stringify(operations);
    const requestKey = RequestManager.generateRequestKey('processTagOperations', apiKey, {operations: operationsString});

    if (!RequestManager.registerRequest(requestKey, callback)) {
      // Request is already in progress, callback will be called when it completes
      return;
    }

    const url = `${SCRIPT_URL}?action=processTagOperations&apiKey=${encodeURIComponent(
      apiKey
    )}&operations=${encodeURIComponent(operationsString)}`;
    jsonpRequest(url, (response) => {
      RequestManager.completeRequest(requestKey, response);
    });
  },

  // Get the opening balance from the Config sheet
  getOpeningBalance(apiKey, callback) {
    const requestKey = RequestManager.generateRequestKey('getOpeningBalance', apiKey);

    if (!RequestManager.registerRequest(requestKey, callback)) {
      // Request is already in progress, callback will be called when it completes
      return;
    }

    const url = `${SCRIPT_URL}?action=getOpeningBalance&apiKey=${encodeURIComponent(
      apiKey
    )}`;
    jsonpRequest(url, (response) => {
      RequestManager.completeRequest(requestKey, response);
    });
  },

  // Save the opening balance to the Config sheet
  saveOpeningBalance(apiKey, balance, callback) {
    const requestKey = RequestManager.generateRequestKey('saveOpeningBalance', apiKey, {balance});

    if (!RequestManager.registerRequest(requestKey, callback)) {
      // Request is already in progress, callback will be called when it completes
      return;
    }

    const url = `${SCRIPT_URL}?action=saveOpeningBalance&apiKey=${encodeURIComponent(
      apiKey
    )}&balance=${encodeURIComponent(balance)}`;
    jsonpRequest(url, (response) => {
      RequestManager.completeRequest(requestKey, response);
    });
  },
};
