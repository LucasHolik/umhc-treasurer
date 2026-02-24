const Service_Session = {
  /**
   * Creates a new session for a validated user.
   * @param {string} role - "admin" or "viewer"
   * @returns {object} - { sessionId, sessionKey }
   */
  createSession: function (role) {
    const sessionId = Utilities.getUuid();
    const sessionKey = Utilities.getUuid(); // Use a UUID as a random session secret

    // Store in CacheService
    // We store the sessionKey keyed by sessionId.

    const cache = CacheService.getScriptCache();
    // Cache for 1 hour (3600 seconds)
    // We store a JSON object to allow for extensibility (e.g. user roles later)
    const sessionData = {
      sessionKey: sessionKey,
      role: role === "viewer" ? "viewer" : "admin",
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
   * @returns {object|null} - { sessionKey, role } or null if invalid/expired.
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
