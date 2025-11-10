// This file will handle communication with the Google Sheets backend using JSONP.

const WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbxlUBfOPcHuI1VCL7ZBTnqABqu1V5CWXZrhqK09cLedLWFTXqToOhfwL-5g-8qg3yIM/exec";

/**
 * Makes a JSONP request to the Google Apps Script Web App.
 * @param {string} url The base URL of the Web App.
 * @param {object} params An object containing the parameters to send.
 * @returns {Promise<object>} A promise that resolves with the JSON response from the server.
 */
function jsonpFetch(url, params) {
  return new Promise((resolve, reject) => {
    // Create a unique callback function name
    const callbackName = "jsonp_callback_" + Math.round(100000 * Math.random());

    // Define the callback function on the window object
    window[callbackName] = (data) => {
      delete window[callbackName]; // Clean up the global function
      document.body.removeChild(script); // Clean up the script tag
      resolve(data);
    };

    // Add the callback name to the URL parameters
    params.callback = callbackName;

    // Build query string
    const queryString = Object.keys(params)
      .map(
        (key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`
      )
      .join("&");

    // Create and append the script tag
    const script = document.createElement("script");
    script.src = `${url}?${queryString}`;
    script.onerror = () => {
      delete window[callbackName];
      document.body.removeChild(script);
      reject(new Error("JSONP request failed"));
    };
    document.body.appendChild(script);
  });
}

/**
 * Verifies the shared key with the backend using JSONP.
 * @param {string} sharedKey The key to verify.
 * @returns {Promise<boolean>} True if the key is valid, false otherwise.
 */
async function verifySharedKey(sharedKey) {
  try {
    const result = await jsonpFetch(WEB_APP_URL, {
      sharedKey: sharedKey,
      action: "getFinances", // We use getFinances as a way to "ping" the backend and validate the key.
    });

    // The key is considered valid if the request was successful.
    // The backend's doGet function will return success: false for an invalid key.
    return result.success === true;
  } catch (error) {
    console.error("Error verifying shared key:", error);
    return false;
  }
}
