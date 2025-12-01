// src/services/api.service.js

import store from '../core/state.js';

const activeRequests = new Map();
let loadingRequestCount = 0;

const getScriptUrl = () => localStorage.getItem('script_url');

const setScriptUrl = (url) => {
  if (url) {
    localStorage.setItem('script_url', url.trim());
  } else {
    localStorage.removeItem('script_url');
  }
};

const hasScriptUrl = () => !!getScriptUrl();

/**
 * Performs a JSONP request to the Google Apps Script backend.
 * This function is a Promisified version of the old jsonpRequest,
 * and it includes the request de-duplication logic.
 *
 * @param {string} action - The backend action to perform.
 * @param {object} params - The parameters for the action.
 * @param {object} options - Request options (e.g., { skipLoading: true }).
 * @returns {Promise<any>} - A promise that resolves with the response data.
 */
const request = (action, params = {}, options = {}) => {
  const SCRIPT_URL = getScriptUrl();
  if (!SCRIPT_URL) {
    return Promise.reject(new Error("Script URL is not configured."));
  }

  const apiKey = store.getState('apiKey');
  if (!apiKey) {
    return Promise.reject(new Error("API key is not set."));
  }

  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => ({ ...acc, [key]: params[key] }), {});

  const requestKey = `${action}-${JSON.stringify(sortedParams)}`;

  if (activeRequests.has(requestKey)) {
    return activeRequests.get(requestKey);
  }

  if (!options.skipLoading) {
    if (loadingRequestCount === 0) {
      store.setState('isLoading', true);
    }
    loadingRequestCount++;
  }

  const promise = new Promise((resolve, reject) => {
    const url = new URL(SCRIPT_URL);
    url.searchParams.append('action', action);
    url.searchParams.append('apiKey', apiKey);
    for (const key in sortedParams) {
      url.searchParams.append(key, sortedParams[key]);
    }

    const callbackName = "jsonp_callback_" + Math.round(100000 * Math.random());
    url.searchParams.append('callback', callbackName);

    const script = document.createElement("script");
    const timeout = 15000; // 15 seconds

    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error("Request timed out."));
    }, timeout);

    const cleanup = () => {
      clearTimeout(timeoutId);
      if (window[callbackName]) {
        delete window[callbackName];
      }
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
      activeRequests.delete(requestKey);
      
      if (!options.skipLoading) {
        loadingRequestCount--;
        if (loadingRequestCount === 0) {
          store.setState('isLoading', false);
        }
      }
    };

    window[callbackName] = (data) => {
      cleanup();
      if (data.success) {
        resolve(data);
      } else {
        reject(new Error(data.message || "API request failed."));
      }
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Network error during API request."));
    };

    script.src = url.toString();
    document.body.appendChild(script);
  });

  activeRequests.set(requestKey, promise);
  return promise;
};

const ApiService = {
  login: () => request('login'),
  getAppData: () => request('getAppData'),
  getData: () => request('getData'),
  saveData: (data, options = {}) => request('saveData', { data: JSON.stringify(data) }, options),
  addTag: (type, value) => request('addTag', { type, value }),
  updateExpenses: (data, options = {}) => request('updateExpenses', { data: JSON.stringify(data) }, options),
  deleteTag: (type, value) => request('deleteTag', { type, value }),
  renameTag: (type, oldValue, newValue) => request('renameTag', { type, oldValue, newValue }),
  processTagOperations: (operations, options = {}) => request('processTagOperations', { operations: JSON.stringify(operations) }, options),
  getOpeningBalance: () => request('getOpeningBalance'),
  saveOpeningBalance: (balance, options = {}) => request('saveOpeningBalance', { balance }, options),
  getScriptUrl,
  setScriptUrl,
  hasScriptUrl,
};

export default ApiService;
