// src/services/api.service.js

import store from "../core/state.js";
import { Chunker } from "../core/chunking.js";

const CHUNK_MAX_URL_LENGTH = 2000;

const activeRequests = new Map();
let loadingRequestCount = 0;

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

  const apiKey = store.getState("apiKey");
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

  const promise = new Promise((resolve, reject) => {
    const url = new URL(SCRIPT_URL);
    url.searchParams.append("action", action);
    url.searchParams.append("apiKey", apiKey);
    for (const key in sortedParams) {
      url.searchParams.append(key, sortedParams[key]);
    }

    const callbackName = "jsonp_callback_" + Math.round(100000 * Math.random());
    url.searchParams.append("callback", callbackName);

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

  activeRequests.set(requestKey, promise);
  return promise;
};

const ApiService = {
  login: () => request("login"),
  getAppData: () => request("getAppData"),
  getData: () => request("getData"),
  saveData: (data, options = {}) =>
    Chunker.sendChunkedRequest(
      request,
      "saveData",
      {},
      data,
      "data",
      null,
      CHUNK_MAX_URL_LENGTH,
      getScriptUrl(),
      store.getState("apiKey")
    ),
  addTag: (type, value) => request("addTag", { type, value }),
  updateExpenses: (data, options = {}) =>
    Chunker.sendChunkedRequest(
      request,
      "updateExpenses",
      {},
      data,
      "data",
      null,
      CHUNK_MAX_URL_LENGTH,
      getScriptUrl(),
      store.getState("apiKey")
    ),
  deleteTag: (type, value) => request("deleteTag", { type, value }),
  renameTag: (type, oldValue, newValue) =>
    request("renameTag", { type, oldValue, newValue }),
  processTagOperations: (operations, options = {}) =>
    Chunker.sendChunkedRequest(
      request,
      "processTagOperations",
      {},
      operations,
      "operations",
      null,
      CHUNK_MAX_URL_LENGTH,
      getScriptUrl(),
      store.getState("apiKey")
    ),
  getOpeningBalance: () => request("getOpeningBalance"),
  saveOpeningBalance: (balance, options = {}) =>
    request("saveOpeningBalance", { balance }, options),
  
  restoreAppData: async (data) => {
    store.setState("isLoading", true);
    
    // 1. Create a safety backup of current data
    store.setState("taggingProgress", "Creating safety backup...");
    let originalData = null;
    try {
      const backupRes = await ApiService.getAppData();
      if (backupRes.success) {
        originalData = backupRes.data;
      } else {
        console.warn("Failed to create safety backup: " + backupRes.message);
        // We proceed, but without rollback capability. 
        // Ideally we might want to stop here, but user might want to force restore.
      }
    } catch (e) {
      console.warn("Failed to create safety backup: " + e.message);
    }

    const executeRestore = async (dataToRestore) => {
      // 1. Clear All
      store.setState("taggingProgress", "Clearing existing data...");
      const clearRes = await request("clearAllData");
      if (!clearRes.success) {
        throw new Error("Failed to clear data: " + clearRes.message);
      }

      // 2. Restore Tags
      const tagOps = [];
      if (dataToRestore.tags) {
        const {
          "Trip/Event": trips,
          Category: cats,
          Type: types,
          TripTypeMap,
          TripStatusMap,
        } = dataToRestore.tags;
        
        if (trips) {
          trips.forEach((t) =>
            tagOps.push({
              type: "Trip/Event",
              value: t,
              extra: TripTypeMap ? TripTypeMap[t] : "",
              status: TripStatusMap ? TripStatusMap[t] : "",
            })
          );
        }
        if (cats) {
          cats.forEach((t) => tagOps.push({ type: "Category", value: t }));
        }
        if (types) {
          types.forEach((t) => tagOps.push({ type: "Type", value: t }));
        }
      }
      
      await Chunker.sendChunkedRequest(
        request,
        "restoreTags",
        {},
        tagOps,
        "tags",
        (p, t) => store.setState("taggingProgress", `Restoring tags: ${p}/${t}`),
        CHUNK_MAX_URL_LENGTH,
        getScriptUrl(),
        store.getState("apiKey")
      );

      // 3. Restore Expenses
      await Chunker.sendChunkedRequest(
        request,
        "saveData",
        {},
        dataToRestore.expenses || [],
        "data",
        (p, t) =>
          store.setState("taggingProgress", `Restoring expenses: ${p}/${t}`),
        CHUNK_MAX_URL_LENGTH,
        getScriptUrl(),
        store.getState("apiKey")
      );

      // 4. Restore Splits
      await Chunker.sendChunkedRequest(
        request,
        "restoreSplits",
        {},
        dataToRestore.splitTransactions || [],
        "splits",
        (p, t) =>
          store.setState("taggingProgress", `Restoring splits: ${p}/${t}`),
        CHUNK_MAX_URL_LENGTH,
        getScriptUrl(),
        store.getState("apiKey")
      );

      // 5. Restore Balance
      if (dataToRestore.openingBalance !== undefined) {
        await request("saveOpeningBalance", { balance: dataToRestore.openingBalance });
      }
    };

    try {
      await executeRestore(data);
      store.setState("isLoading", false);
      store.setState("taggingProgress", null);
      return { success: true, message: "Restore completed successfully." };
    } catch (e) {
      console.error("Restore failed:", e);
      
      if (originalData) {
        store.setState("taggingProgress", `Restore failed. Rolling back...`);
        try {
          await executeRestore(originalData);
          store.setState("isLoading", false);
          store.setState("taggingProgress", null);
          return { 
            success: false, 
            message: `Restore failed: ${e.message}. Original data was restored.` 
          };
        } catch (rollbackError) {
          store.setState("isLoading", false);
          store.setState("taggingProgress", null);
          return { 
            success: false, 
            message: `CRITICAL FAILURE: Restore failed (${e.message}) AND Rollback failed (${rollbackError.message}). Data may be lost.` 
          };
        }
      } else {
        store.setState("isLoading", false);
        store.setState("taggingProgress", null);
        return { success: false, message: `Restore failed: ${e.message}. No backup was available for rollback.` };
      }
    }
  },

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
      { groupId, data: JSON.stringify({ groupId, original, splits }) },
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

    store.setState("isLoading", true);

    try {
      while (hasMore) {
        store.setState(
          "taggingProgress",
          `Loading split history (Page ${page})...`
        );
        const res = await request("getSplitHistory", { page, pageSize: 500 });

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
      store.setState("taggingProgress", null);
      store.setState("isLoading", false);
      return { success: true, data: allData };
    } catch (error) {
      store.setState("taggingProgress", null);
      store.setState("isLoading", false);
      return { success: false, message: error.message };
    }
  },

  getScriptUrl,
  setScriptUrl,
  hasScriptUrl,
};

export default ApiService;
