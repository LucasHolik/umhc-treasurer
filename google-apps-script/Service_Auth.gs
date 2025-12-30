var Service_Auth = {
  getApiKey: function() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
      CONFIG.CONFIG_SHEET
    );
    if (sheet) {
        return sheet.getRange(CONFIG.API_KEY_CELL).getValue();
    }
    return null;
  },

  login: function() {
    return { success: true };
  },

  verifyRequest: function(action, timestamp, signature) {
    const apiKey = this.getApiKey();
    if (!apiKey) return false;

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
    // Must match client-side construction: action + timestamp
    const payload = action + timestamp;

    // 3. Compute Expected Signature
    const signatureBytes = Utilities.computeHmacSha256Signature(payload, apiKey);
    
    // Convert bytes to hex string
    const expectedSignature = signatureBytes.reduce(function(str, byte) {
      const v = (byte < 0 ? byte + 256 : byte).toString(16);
      return str + (v.length == 1 ? "0" + v : v);
    }, "");

    // 4. Compare (case-insensitive)
    return signature && expectedSignature.toLowerCase() === signature.toLowerCase();
  }
};