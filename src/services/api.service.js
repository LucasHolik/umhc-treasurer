// src/services/api.service.js

import store from "../core/state.js";

const activeRequests = new Map();
let loadingRequestCount = 0;
let callbackCounter = 0;

const getScriptUrl = () => localStorage.getItem("script_url");

const setScriptUrl = (url) => {
  if (url) {
    localStorage.setItem("script_url", url.trim());
  } else {
    localStorage.removeItem("script_url");
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

  const apiKey = options.apiKey || store.getState("apiKey");
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
      store.setState("isLoading", true);
    }
    loadingRequestCount++;
  }

  // --- SIGNING HELPER ---
  async function signRequest(action, timestamp, apiKey) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(apiKey);
    const payload = encoder.encode(action + timestamp);

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
      const signature = await signRequest(action, timestamp, apiKey);

      return new Promise((resolve, reject) => {
        const url = new URL(SCRIPT_URL);
        url.searchParams.append("action", action);
        // url.searchParams.append("apiKey", apiKey); // REMOVED for security
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

        const timeoutId = setTimeout(() => {
          cleanup();
          reject(new Error("Request timed out."));
        }, timeout);

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

  activeRequests.set(requestKey, promise);
  return promise;
};

const ApiService = {
  login: (apiKey) => request("login", {}, { apiKey }),
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

    if (loadingRequestCount === 0) {
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
      if (loadingRequestCount === 0) {
        store.setState("isLoading", false);
      }
      store.setState("taggingProgress", null);
    }
  },

  getScriptUrl,
  setScriptUrl,
  hasScriptUrl,
};

export default ApiService;
