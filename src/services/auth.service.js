// src/services/auth.service.js
import store from "../core/state.js";
import ApiService from "./api.service.js";

const API_KEY_STORAGE_KEY = "umhc_treasurer_api_key";

/**
 * SECURITY WARNING:
 * Storing the API key in localStorage is vulnerable to XSS attacks.
 * Any malicious script running on this page can access the key.
 *
 * Recommended improvements:
 * 1. Use HttpOnly cookies (requires server-side support).
 * 2. Implement short-lived tokens with rotation.
 */
const AuthService = {
  /**
   * Check if there is an API key in local storage and initialize the app state.
   * NOTE: Access to the website requires both a valid Script URL and the correct API Key.
   */
  init: function () {
    // SECURITY RISK: XSS vulnerability - see file header
    const apiKey = sessionStorage.getItem(API_KEY_STORAGE_KEY);
    if (apiKey) {
      store.setState("apiKey", apiKey);
    }
  },

  /**
   * Attempt to log in with the provided API key.
   * @param {string} apiKey
   * @returns {Promise<boolean>} - True if login is successful, false otherwise.
   */
  login: async function (apiKey) {
    store.setState("error", null);
    // Note: We do NOT set the API key in the store yet to avoid a race condition
    // where isLoggedIn() returns true before the key is validated.

    try {
      const response = await ApiService.login(apiKey);
      if (response.success) {
        // SECURITY RISK: XSS vulnerability - see file header
        sessionStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
        store.setState("apiKey", apiKey); // Now definitively set
        store.setState("currentUser", { loggedIn: true });
        return true;
      } else {
        throw new Error(response.message || "Login failed.");
      }
    } catch (error) {
      this.logout(); // Clear invalid key
      store.setState("error", error.message);
      return false;
    }
  },

  /**
   * Log the user out by clearing the API key and user state.
   */
  logout: function () {
    // SECURITY RISK: XSS vulnerability - see file header
    sessionStorage.removeItem(API_KEY_STORAGE_KEY);
    store.setState("apiKey", null);
    store.setState("currentUser", null);
  },

  /**
   * Check if the user is currently logged in.
   *
   * NOTE: This is a client-side only check based on the presence of
   * local state (API Key and Current User). It does not validate
   * the key with the server. If the key is revoked on the server,
   * this method will still return true until an API call fails.
   *
   * @returns {boolean}
   */
  isLoggedIn: function () {
    return (
      !!store.getState("apiKey") &&
      !!store.getState("currentUser") &&
      ApiService.hasScriptUrl()
    );
  },
};

export default AuthService;
