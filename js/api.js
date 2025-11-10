// This file will handle communication with the Google Sheets backend.

// IMPORTANT: Replace this with the actual Web App URL you got from deploying your Google Apps Script.
const WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbw5PW6p2DtKAuF6nWhUGHhynqpdm5F_EY8-W1_q1so50i5UdMgBt-9cb_uGu3DkoZWX/exec";

/**
 * Verifies the shared key with the backend.
 * @param {string} sharedKey The key to verify.
 * @returns {Promise<boolean>} True if the key is valid, false otherwise.
 */
async function verifySharedKey(sharedKey) {
  try {
    const response = await fetch(WEB_APP_URL, {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sharedKey: sharedKey,
        action: "getFinances", // We use getFinances as a way to "ping" the backend and validate the key.
      }),
    });

    const result = await response.json();

    // The key is considered valid if the request was successful.
    // The backend's doPost function will return success: false for an invalid key.
    return result.success === true;
  } catch (error) {
    console.error("Error verifying shared key:", error);
    return false;
  }
}
