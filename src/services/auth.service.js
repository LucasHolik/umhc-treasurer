// src/services/auth.service.js
import store from "../core/state.js";
import ApiService from "./api.service.js";

/**
 * AUTHENTICATION SERVICE
 * Implements session-based authentication with short-lived tokens.
 *
 * Security Model:
 * 1. User enters Passkey (API Key).
 * 2. Passkey is sent to server ONCE to exchange for a Session.
 * 3. Server returns { sessionId, sessionKey }.
 * 4. We store sessionId/sessionKey in private variables in ApiService AND sessionStorage for persistence.
 * 5. We discard the Passkey.
 * 6. All subsequent requests are signed with sessionKey and include sessionId.
 */
const AuthService = {
  /**
   * Check if there is a session in local storage (via ApiService) and initialize the app state.
   */
  init: async function () {
    // ApiService initializes its session from sessionStorage automatically on import/load.
    // We just need to check if it has a valid session.
    if (ApiService.hasSession()) {
      try {
        // Validate session with server
        await ApiService.ping();
        store.setState("currentUser", { loggedIn: true });
      } catch (error) {
        console.warn("Session validation failed:", error);
        this.logout();
      }
    }
  },

  /**
   * Attempt to log in with the provided API key.
   * @param {string} apiKey
   * @returns {Promise<boolean>} - True if login is successful, false otherwise.
   */
  login: async function (apiKey) {
    store.setState("error", null);

    try {
      // 1. Exchange API Key for Session
      const response = await ApiService.login(apiKey);

      if (response.success && response.sessionId && response.sessionKey) {
        // 2. Set Session Credentials in ApiService (memory + sessionStorage)
        ApiService.setSession(response.sessionId, response.sessionKey);

        // 3. Update State (Auth status only, no credentials in store)
        store.setState("currentUser", { loggedIn: true });

        return true;
      } else {
        throw new Error(response.message || "Login failed.");
      }
    } catch (error) {
      this.logout(); // Clear any partial state
      store.setState("error", error.message);
      return false;
    }
  },

  /**
   * Log the user out by clearing session credentials and user state.
   */
  logout: function () {
    ApiService.clearSession();
    store.setState("currentUser", null);
  },

  /**
   * Check if the user is currently logged in.
   * @returns {boolean}
   */
  isLoggedIn: function () {
    return (
      ApiService.hasSession() &&
      !!store.getState("currentUser") &&
      ApiService.hasScriptUrl()
    );
  },
};

export default AuthService;
