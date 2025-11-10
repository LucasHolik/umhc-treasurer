const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyOuvUpzAAW2E75NjK7oeOixQRgxdyIRzl6c-qsX_8pyrwxbPK_w6SgQMdmsP1P8s8/exec";

// Create a unique callback function name
const callbackName = "jsonp_callback_" + Math.round(100000 * Math.random());

// Create a script element
const script = document.createElement("script");

// Define the callback function
window[callbackName] = function (data) {
  document.querySelector("h1").textContent = data.value;

  // Clean up: remove the script tag and the callback function
  document.body.removeChild(script);
  delete window[callbackName];
};

// Set the script source to the Google Apps Script URL with the callback
script.src = SCRIPT_URL + "?callback=" + callbackName;

// Append the script to the body to make the request
document.body.appendChild(script);
