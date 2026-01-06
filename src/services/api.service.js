// src/services/api.service.js

import store from "../core/state.js";

const activeRequests = new Map();
const MAX_ACTIVE_REQUESTS = 100;
let loadingRequestCount = 0;
let callbackCounter = 0;

const SESSION_ID_KEY = "umhc_treasurer_session_id";
const SESSION_KEY_KEY = "umhc_treasurer_session_key";

// Private variables to hold session credentials
let _sessionId = null;
let _sessionKey = null;

const getScriptUrl = () => localStorage.getItem("script_url");

const setScriptUrl = (url) => {
  if (url) {
    localStorage.setItem("script_url", String(url).trim());
  } else {
    localStorage.removeItem("script_url");
  }
};

const hasScriptUrl = () => !!getScriptUrl();

/**
 * Initialize session from storage.
 * Should be called on app startup.
 */
const initSession = () => {
  _sessionId = sessionStorage.getItem(SESSION_ID_KEY);
  _sessionKey = sessionStorage.getItem(SESSION_KEY_KEY);
};

// Initialize immediately
initSession();

const setSession = (sessionId, sessionKey) => {
  _sessionId = sessionId;
  _sessionKey = sessionKey;
  if (sessionId) sessionStorage.setItem(SESSION_ID_KEY, sessionId);
  else sessionStorage.removeItem(SESSION_ID_KEY);

  if (sessionKey) sessionStorage.setItem(SESSION_KEY_KEY, sessionKey);
  else sessionStorage.removeItem(SESSION_KEY_KEY);
};

const clearSession = () => {
  _sessionId = null;
  _sessionKey = null;
  sessionStorage.removeItem(SESSION_ID_KEY);
  sessionStorage.removeItem(SESSION_KEY_KEY);
};

const hasSession = () => !!_sessionId && !!_sessionKey;

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

  let signingKey;
  // Use local variable instead of store
  const sessionId = _sessionId;

  if (action === "login") {
    signingKey = options.apiKey;
  } else {
    // Use local variable instead of store
    signingKey = _sessionKey;
  }

  if (!signingKey) {
    return Promise.reject(new Error("Authentication credentials not found."));
  }

  // Include sessionId in params if it exists and action is not login
  const finalParams = { ...params };
  if (action !== "login" && sessionId) {
    finalParams.sessionId = sessionId;
  }

  const sortedParams = {};
  Object.keys(finalParams)
    .sort()
    .forEach((key) => {
      sortedParams[key] = String(finalParams[key]);
    });

  const requestKey = `${action}-${JSON.stringify(sortedParams)}`;

  if (activeRequests.has(requestKey)) {
    return activeRequests.get(requestKey);
  }

  if (!options.skipLoading) {
    if (loadingRequestCount === 0) {
      store.setState("isLoading", true);
    }
    loadingRequestCount++;
  }

  // --- SIGNING HELPER ---
  async function signRequest(action, timestamp, secret, params) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const payload = encoder.encode(
      action + "|" + timestamp + "|" + JSON.stringify(params)
    );

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      payload
    );
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    return signatureArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  const promise = (async () => {
    try {
      const timestamp = Date.now().toString();
      const signature = await signRequest(
        action,
        timestamp,
        signingKey,
        sortedParams
      );

      return new Promise((resolve, reject) => {
        const url = new URL(SCRIPT_URL);
        url.searchParams.append("action", action);

        // sessionId is already in sortedParams, so it will be added in the loop below

        url.searchParams.append("timestamp", timestamp);
        url.searchParams.append("signature", signature);

        for (const key in sortedParams) {
          url.searchParams.append(key, sortedParams[key]);
        }

        const callbackName = `jsonp_callback_${Date.now()}_${callbackCounter++}`;
        url.searchParams.append("callback", callbackName);

        const script = document.createElement("script");
        const timeout = 15000; // 15 seconds
        let cleanedUp = false;
        let timeoutId;

        const cleanup = () => {
          if (cleanedUp) return;
          cleanedUp = true;

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
              store.setState("isLoading", false);
            }
          }
        };

        timeoutId = setTimeout(() => {
          cleanup();
          reject(new Error("Request timed out."));
        }, timeout);

        window[callbackName] = (data) => {
          cleanup();
          if (data.success) {
            resolve(data);
          } else {
            if (data.message === "Unauthorized") {
              clearSession();
              document.dispatchEvent(new CustomEvent("sessionExpired"));
            }
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
    } catch (err) {
      // Handle signing errors or other prep errors
      activeRequests.delete(requestKey);
      if (!options.skipLoading) {
        loadingRequestCount--;
        if (loadingRequestCount === 0) {
          store.setState("isLoading", false);
        }
      }
      throw err;
    }
  })();

  // Safeguard against unbounded growth
  if (activeRequests.size >= MAX_ACTIVE_REQUESTS) {
    const firstKey = activeRequests.keys().next().value;
    const oldestPromise = activeRequests.get(firstKey);
    activeRequests.delete(firstKey);
    // Note: The cleanup will happen when the JSONP callback fires or times out
    console.warn(
      `Request queue full. Oldest request (${firstKey}) removed from tracking.`
    );
  }

  activeRequests.set(requestKey, promise);
  return promise;
};

const ApiService = {
  login: (apiKey) => request("login", {}, { apiKey }),
  ping: () => request("ping", {}, { skipLoading: true }),
  getAppData: () => request("getAppData"),
  getData: () => request("getData"),
  saveData: (data, options = {}) =>
    request("saveData", { data: JSON.stringify(data) }, options),
  addTag: (type, value) => request("addTag", { type, value }),
  updateExpenses: (data, options = {}) =>
    request("updateExpenses", { data: JSON.stringify(data) }, options),
  deleteTag: (type, value) => request("deleteTag", { type, value }),
  renameTag: (type, oldValue, newValue) =>
    request("renameTag", { type, oldValue, newValue }),
  processTagOperations: (operations, options = {}) =>
    request(
      "processTagOperations",
      { operations: JSON.stringify(operations) },
      options
    ),
  getOpeningBalance: () => request("getOpeningBalance"),
  saveOpeningBalance: (balance, options = {}) =>
    request("saveOpeningBalance", { balance }, options),

  splitTransaction: async (original, splits, options = {}) => {
    const res = await request(
      "splitTransaction",
      { data: JSON.stringify({ original, splits }) },
      options
    );
    store.setState("splitTransactions", null); // Invalidate cache
    return res;
  },
  revertSplit: async (groupId, options = {}) => {
    const res = await request("revertSplit", { groupId }, options);
    store.setState("splitTransactions", null); // Invalidate cache
    return res;
  },
  editSplit: async (groupId, splits, original, options = {}) => {
    const res = await request(
      "editSplit",
      { groupId, data: JSON.stringify({ original, splits }) },
      options
    );
    store.setState("splitTransactions", null); // Invalidate cache
    return res;
  },
  getSplitGroup: (groupId) => request("getSplitGroup", { groupId }),
  getSplitTransactions: async (options = {}) => {
    const cached = store.getState("splitTransactions");
    if (cached && !options.forceRefresh) {
      // Log if from cache
      const parents = cached.filter(
        (item) => item["Split Type"] === "SOURCE"
      ).length;
      const children = cached.filter(
        (item) => item["Split Type"] === "CHILD"
      ).length;
      console.log(
        `Loaded ${parents} split parents and ${children} split children (from cache).`
      );
      return { success: true, data: cached };
    }

    let allData = [];
    let page = 1;
    let hasMore = true;
    const wasLoading = loadingRequestCount > 0;

    if (!wasLoading) {
      store.setState("isLoading", true);
    }
    loadingRequestCount++;

    try {
      while (hasMore) {
        store.setState(
          "taggingProgress",
          `Loading split history (Page ${page})...`
        );
        // Use skipLoading: true because we are managing loading state manually for the whole loop
        const res = await request(
          "getSplitHistory",
          { page, pageSize: 500 },
          { skipLoading: true }
        );

        if (!res.success) {
          throw new Error(res.message);
        }

        allData = [...allData, ...res.data];
        hasMore = res.hasMore;
        page++;
      }

      const parents = allData.filter(
        (item) => item["Split Type"] === "SOURCE"
      ).length;
      const children = allData.filter(
        (item) => item["Split Type"] === "CHILD"
      ).length;
      console.log(
        `Loaded ${parents} split parents and ${children} split children.`
      );

      store.setState("splitTransactions", allData);
      return { success: true, data: allData };
    } finally {
      loadingRequestCount--;
      if (!wasLoading && loadingRequestCount === 0) {
        store.setState("isLoading", false);
      }
      store.setState("taggingProgress", null);
    }
  },

  getScriptUrl,
  setScriptUrl,
  hasScriptUrl,
  setSession,
  clearSession,
  hasSession,
};

export default ApiService;
