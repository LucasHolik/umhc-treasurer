// src/services/auth.service.js
import store from '../core/state.js';
import ApiService from './api.service.js';

const API_KEY_STORAGE_KEY = 'umhc_treasurer_api_key';

const AuthService = {
  /**
   * Check if there is an API key in local storage and initialize the app state.
   */
  init: function() {
    const apiKey = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (apiKey) {
      store.setState('apiKey', apiKey);
    }
  },

  /**
   * Attempt to log in with the provided API key.
   * @param {string} apiKey
   * @returns {Promise<boolean>} - True if login is successful, false otherwise.
   */
  login: async function(apiKey) {
    store.setState('error', null);
    store.setState('apiKey', apiKey); // Tentatively set the key

    try {
      const response = await ApiService.login();
      if (response.success) {
        localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
        store.setState('currentUser', { loggedIn: true });
        return true;
      } else {
        throw new Error(response.message || 'Login failed.');
      }
    } catch (error) {
      this.logout(); // Clear invalid key
      store.setState('error', error.message);
      store.setState('isLoading', false);
      return false;
    }
  },

  /**
   * Log the user out by clearing the API key and user state.
   */
  logout: function() {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
    store.setState('apiKey', null);
    store.setState('currentUser', null);
  },

  /**
   * Check if the user is currently logged in.
   * @returns {boolean}
   */
  isLoggedIn: function() {
    return !!store.getState('apiKey') && !!store.getState('currentUser') && ApiService.hasScriptUrl();
  }
};

export default AuthService;
