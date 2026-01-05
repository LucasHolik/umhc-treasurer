import { deepEqual, deepClone } from "./utils.js";

// src/core/state.js

/**
 * A simple Pub/Sub implementation for state management.
 */
const createStore = (initialState = {}) => {
  let state =
    initialState && typeof initialState === "object"
      ? deepClone(initialState)
      : initialState;
  const subscribers = {};

  /**
   * Subscribe to changes in a specific part of the state.
   * @param {string} key - The state key to subscribe to.
   * @param {function} callback - The function to call when the state changes.
   * @returns {object} - An object with an `unsubscribe` method.
   */
  const subscribe = (key, callback) => {
    if (typeof key !== "string" || key === "") {
      throw new TypeError("Key must be a non-empty string");
    }
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      throw new Error("Invalid key: reserved property name");
    }
    if (typeof callback !== "function") {
      throw new TypeError("Callback must be a function");
    }
    if (!subscribers[key]) {
      subscribers[key] = [];
    }
    subscribers[key].push(callback);

    // Return an unsubscribe function
    return {
      unsubscribe: () => {
        subscribers[key] = subscribers[key].filter((cb) => cb !== callback);
      },
    };
  };

  /**
   * Notify all subscribers of a change to a specific state key.
   * @param {string} key - The state key that has changed.
   */
  const notify = (key) => {
    if (typeof key !== "string" || key === "") {
      return; // Silently ignore invalid keys in notify
    }
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      return; // Silently ignore reserved keys
    }
    if (subscribers[key]) {
      const value = state[key];
      // Pass a deep copy to subscribers to prevent them from mutating internal state
      const valueToPass =
        value && typeof value === "object" ? deepClone(value) : value;

      subscribers[key].forEach((callback) => {
        try {
          callback(valueToPass);
        } catch (error) {
          console.error(
            `Error in subscriber callback for key "${key}":`,
            error
          );
        }
      });
    }
  };

  /**
   * Set a value in the state and notify subscribers.
   * @param {string} key - The state key to set.
   * @param {*} value - The new value.
   */
  const setState = (key, value) => {
    if (typeof key !== "string" || key === "") {
      throw new TypeError("Key must be a non-empty string");
    }
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      throw new Error("Invalid key: reserved property name");
    }
    // Deep clone the incoming value to ensure internal state is not linked to external objects
    const newValue =
      value && typeof value === "object" ? deepClone(value) : value;

    // Deep equality check
    if (deepEqual(state[key], newValue)) return;

    state[key] = newValue;
    notify(key);
  };

  /**
   * Get the current value of a state key.
   * @param {string} key - The state key to get.
   * @returns {*} - The current value of the state key.
   */
  const getState = (key) => {
    if (typeof key !== "string" || key === "") {
      throw new TypeError("Key must be a non-empty string");
    }
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      throw new Error("Invalid key: reserved property name");
    }
    const value = state[key];
    // Return deep copy for objects/arrays to prevent direct mutation of internal state
    if (value && typeof value === "object") {
      return deepClone(value);
    }
    return value;
  };

  return {
    subscribe,
    setState,
    getState,
  };
};

// Initialize the store with a default structure
const store = createStore({
  expenses: [],
  rawExpenses: [], // Stores the unprocessed data from API
  tags: {
    "Trip/Event": [],
    Category: [],
    Type: [],
    TripTypeMap: {},
    TripStatusMap: {},
  },
  isLoading: false,
  isUploading: false,
  isTagging: false,
  taggingSource: null,
  savingTags: false,
  savingSplitTransaction: false,
  splitTransactions: null,
  taggingProgress: null,
  error: null,
  currentUser: null,
  openingBalance: 0,
  settingsSyncing: false,
  accessibilityMode: false,
});

export default store;
