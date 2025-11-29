// src/core/state.js

/**
 * A simple Pub/Sub implementation for state management.
 */
const createStore = (initialState = {}) => {
  let state = initialState;
  const subscribers = {};

  /**
   * Subscribe to changes in a specific part of the state.
   * @param {string} key - The state key to subscribe to.
   * @param {function} callback - The function to call when the state changes.
   * @returns {object} - An object with an `unsubscribe` method.
   */
  const subscribe = (key, callback) => {
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
    if (subscribers[key]) {
      subscribers[key].forEach((callback) => callback(state[key]));
    }
  };

  /**
   * Set a value in the state and notify subscribers.
   * @param {string} key - The state key to set.
   * @param {*} value - The new value.
   */
  const setState = (key, value) => {
    state[key] = value;
    notify(key);
  };

  /**
   * Get the current value of a state key.
   * @param {string} key - The state key to get.
   * @returns {*} - The current value of the state key.
   */
  const getState = (key) => {
    return state[key];
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
  tags: { "Trip/Event": [], Category: [] },
  isLoading: false,
  isUploading: false,
  isTagging: false,
  savingTags: false,
  taggingProgress: null,
  error: null,
  currentUser: null,
  openingBalance: 0,
});

export default store;
