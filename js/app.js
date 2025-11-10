// This file contains the main application logic.

document.addEventListener("DOMContentLoaded", () => {
  const loginContainer = document.getElementById("login-container");
  const mainContent = document.getElementById("main-content");
  const loginForm = document.getElementById("login-form");
  const sharedKeyInput = document.getElementById("shared-key");
  const errorMessage = document.getElementById("error-message");
  const logoutButton = document.getElementById("logout-button");

  // Check if the user is already logged in
  const sessionKey = sessionStorage.getItem("sharedKey");
  if (sessionKey) {
    showMainContent();
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
    } else {
      errorMessage.textContent = "Invalid shared key. Please try again.";
    }
  });

  logoutButton.addEventListener("click", () => {
    sessionStorage.removeItem("sharedKey");
    showLogin();
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
});
