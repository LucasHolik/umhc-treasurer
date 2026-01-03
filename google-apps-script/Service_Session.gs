var Service_Session = {
  /**
   * Creates a new session for a validated user.
   * @param {string} apiKey - The permanent API key (used only to generate the session).
   * @returns {object} - { sessionId, sessionKey }
   */
  createSession: function (apiKey) {
    const sessionId = Utilities.getUuid();
    const sessionKey = Utilities.getUuid(); // Use a UUID as a random session secret

    // Store in CacheService
    // We store the sessionKey keyed by sessionId.
    // The apiKey is technically not needed for verification once we have the sessionKey,
    // but we might want to store it if we need to re-validate permissions later
    // (though currently permissions are just "has key").
    // For now, we just store the sessionKey.

    const cache = CacheService.getScriptCache();
    // Cache for 1 hour (3600 seconds)
    // We store a JSON object to allow for extensibility (e.g. user roles later)
    const sessionData = {
      sessionKey: sessionKey,
      apiKey: apiKey, // Storing apiKey if needed for any specific logic, though mostly we use sessionKey for signing.
    };

    cache.put(sessionId, JSON.stringify(sessionData), 3600);

    return {
      sessionId: sessionId,
      sessionKey: sessionKey,
    };
  },

  /**
   * Retrieves session data.
   * @param {string} sessionId
   * @returns {object|null} - { sessionKey, apiKey } or null if invalid/expired.
   */
  getSession: function (sessionId) {
    if (!sessionId) return null;

    const cache = CacheService.getScriptCache();
    const dataStr = cache.get(sessionId);

    if (!dataStr) return null;

    try {
      return JSON.parse(dataStr);
    } catch (e) {
      console.error("Error parsing session data: " + e.message);
      return null;
    }
  },
};
