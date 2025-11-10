// This file contains the main application logic.

document.addEventListener("DOMContentLoaded", () => {
  const loginContainer = document.getElementById("login-container");
  const mainContent = document.getElementById("main-content");
  const loginForm = document.getElementById("login-form");
  const sharedKeyInput = document.getElementById("shared-key");
  const errorMessage = document.getElementById("error-message");
  const logoutButton = document.getElementById("logout-button");
  const a2ValueDisplay = document.getElementById("a2-value-display");

  // Check if the user is already logged in
  const sessionKey = sessionStorage.getItem("sharedKey");
  if (sessionKey) {
    showMainContent();
    fetchAndDisplayA2Value(sessionKey);
  } else {
    showLogin();
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const key = sharedKeyInput.value;
    errorMessage.textContent = "";

    const isValid = await verifySharedKey(key);

    if (isValid) {
      sessionStorage.setItem("sharedKey", key);
      showMainContent();
      fetchAndDisplayA2Value(key);
    } else {
      errorMessage.textContent = "Invalid shared key. Please try again.";
    }
  });

  logoutButton.addEventListener("click", () => {
    sessionStorage.removeItem("sharedKey");
    showLogin();
    if (a2ValueDisplay) {
      a2ValueDisplay.textContent = "";
    }
  });

  function showLogin() {
    loginContainer.style.display = "block";
    mainContent.style.display = "none";
    sharedKeyInput.value = "";
  }

  function showMainContent() {
    loginContainer.style.display = "none";
    mainContent.style.display = "block";
  }

  async function fetchAndDisplayA2Value(key) {
    if (a2ValueDisplay) {
      a2ValueDisplay.textContent = "Loading A2 value...";
      const a2Value = await getA2Value(key);
      if (a2Value !== null) {
        a2ValueDisplay.textContent = `Value from Config!A2: ${a2Value}`;
      } else {
        a2ValueDisplay.textContent = "Failed to load A2 value.";
      }
    }
  }
});
