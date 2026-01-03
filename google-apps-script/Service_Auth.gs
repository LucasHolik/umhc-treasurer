var Service_Auth = {
  getApiKey: function () {
    try {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
        CONFIG.CONFIG_SHEET
      );
      if (sheet) {
        const apiKey = sheet.getRange(CONFIG.API_KEY_CELL).getValue();
        if (apiKey && typeof apiKey === "string" && apiKey.trim() !== "") {
          return apiKey.trim();
        }
      }
      return null;
    } catch (e) {
      console.error("Error retrieving API key: " + e.message);
      return null;
    }
  },

  login: function () {
    // 1. Verify Configuration (Defense in Depth)
    // Although verifyRequest() checks this, we ensure the key exists before confirming login.
    const apiKey = this.getApiKey();
    if (!apiKey) {
      console.error("Login failed: API Key not configured.");
      return { success: false, message: "Server misconfigured" };
    }

    // 2. Create Session
    const session = Service_Session.createSession(apiKey);

    return {
      success: true,
      sessionId: session.sessionId,
      sessionKey: session.sessionKey,
    };
  },

  verifyRequest: function (action, timestamp, signature, allParams) {
    try {
      let secretKey;

      if (action === "login") {
        // For login, we use the permanent API Key
        secretKey = this.getApiKey();
      } else {
        // For all other requests, we use the Session Key
        const sessionId = allParams ? allParams.sessionId : null;
        if (!sessionId) {
          console.warn("Request rejected: Missing sessionId");
          return false;
        }

        const session = Service_Session.getSession(sessionId);
        if (!session) {
          console.warn("Request rejected: Invalid or expired session");
          return false;
        }
        secretKey = session.sessionKey;
      }

      if (!secretKey) return false;

      // 1. Validate Timestamp (prevent replay attacks, allow 5 min drift)
      const now = Date.now();
      const reqTime = parseInt(timestamp, 10);
      if (isNaN(reqTime)) return false;

      // Check if timestamp is within 5 minutes (300000 ms)
      if (Math.abs(now - reqTime) > 300000) {
        console.warn("Request rejected: Timestamp out of bounds");
        return false;
      }

      // 2. Reconstruct Payload
      // Filter out control params to match client's sortedParams
      // callback is handled by GAS, but we filter it out just in case it's passed
      const ignoredKeys = ["action", "timestamp", "signature", "callback"];
      const paramKeys = Object.keys(allParams || {}).filter(
        (k) => !ignoredKeys.includes(k)
      );
      paramKeys.sort();

      const sortedParams = {};
      paramKeys.forEach((k) => (sortedParams[k] = allParams[k]));

      // Must match client-side construction: action + "|" + timestamp + JSON.stringify(sortedParams)
      const payload = action + "|" + timestamp + JSON.stringify(sortedParams);

      // 3. Compute Expected Signature
      const signatureBytes = Utilities.computeHmacSha256Signature(
        payload,
        secretKey
      );

      // Convert bytes to hex string
      const expectedSignature = signatureBytes.reduce(function (str, byte) {
        const v = (byte < 0 ? byte + 256 : byte).toString(16);
        return str + (v.length == 1 ? "0" + v : v);
      }, "");

      // 4. Compare (constant-time, case-insensitive)
      if (!signature) return false;

      const expected = expectedSignature.toLowerCase();
      const provided = signature.toLowerCase();

      // Ensure same length to prevent timing leaks
      if (expected.length !== provided.length) return false;

      // Constant-time comparison
      let mismatch = 0;
      for (let i = 0; i < expected.length; i++) {
        mismatch |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
      }
      return mismatch === 0;
    } catch (e) {
      console.error("Error in verifyRequest: " + e.message);
      return false;
    }
  },
};
