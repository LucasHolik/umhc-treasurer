// tests/features/login/login.component.test.js
//
// Tests for LoginComponent loading, session-verification, and error state
// handling, including disabled controls, re-submission guards, and cleanup.

import { test, afterEach } from "node:test";
import assert from "node:assert/strict";

import LoginComponent from "../../../src/features/login/login.component.js";
import AuthService from "../../../src/services/auth.service.js";
import ApiService from "../../../src/services/api.service.js";
import store from "../../../src/core/state.js";

const TEST_SCRIPT_URL = "https://script.google.com/macros/s/test-deploy/exec";
const activeComponents = new Set();

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const mountLogin = ({ scriptUrl = TEST_SCRIPT_URL } = {}) => {
  if (scriptUrl) {
    ApiService.setScriptUrl(scriptUrl);
  } else {
    ApiService.setScriptUrl(null);
  }

  const root = document.createElement("div");
  document.body.appendChild(root);

  const component = new LoginComponent(root);
  activeComponents.add(component);
  return { root, component };
};

afterEach(() => {
  for (const component of activeComponents) {
    component.destroy();
  }
  activeComponents.clear();

  ApiService.clearSession();
  ApiService.setScriptUrl(null);
  localStorage.clear();
  sessionStorage.clear();

  store.setState("error", null);
  store.setState("isLoading", false);
  store.setState("isVerifyingSession", false);
  store.setState("currentUser", null);

  document.body.innerHTML = "";
});

test("disables controls and renders loader while AuthService.login is in flight", async (t) => {
  const deferred = createDeferred();
  t.mock.method(AuthService, "login", async () => {
    store.setState("error", null);
    store.setState("isLoading", true);
    try {
      return await deferred.promise;
    } finally {
      store.setState("isLoading", false);
    }
  });

  const { root } = mountLogin();
  const apiKeyInput = root.querySelector("#api-key");
  const loginButton = root.querySelector("#login-button");
  const changeUrlButton = root.querySelector("#change-url-button");
  const loginStatus = root.querySelector("#login-status");

  apiKeyInput.value = "secret-passkey";
  loginButton.click();

  assert.equal(apiKeyInput.disabled, true);
  assert.equal(loginButton.disabled, true);
  assert.equal(changeUrlButton.disabled, true);
  assert.ok(loginStatus.querySelector(".loader"));

  deferred.resolve(true);
  await deferred.promise;
  await Promise.resolve();
});

test("re-enables controls, preserves passkey value, and keeps error alert after failed login", async (t) => {
  const deferred = createDeferred();
  t.mock.method(AuthService, "login", async () => {
    store.setState("error", null);
    store.setState("isLoading", true);
    try {
      return await deferred.promise;
    } finally {
      store.setState("isLoading", false);
      store.setState("error", "The passkey was not accepted.");
    }
  });

  const { root } = mountLogin();
  const apiKeyInput = root.querySelector("#api-key");
  const loginButton = root.querySelector("#login-button");
  const changeUrlButton = root.querySelector("#change-url-button");
  const loginStatus = root.querySelector("#login-status");

  apiKeyInput.value = "wrong-passkey";
  const pending = root.querySelector("#login-button");
  pending.click();

  assert.equal(apiKeyInput.disabled, true);
  assert.ok(loginStatus.querySelector(".loader"));

  deferred.resolve(false);
  await deferred.promise;
  await Promise.resolve();

  assert.equal(apiKeyInput.disabled, false);
  assert.equal(loginButton.disabled, false);
  assert.equal(changeUrlButton.disabled, false);
  assert.equal(apiKeyInput.value, "wrong-passkey");

  const alert = loginStatus.querySelector('[role="alert"]');
  assert.ok(alert);
  assert.equal(alert.textContent, "The passkey was not accepted.");

  // Also ensure an error already set before isLoading drops to false is not wiped.
  store.setState("isLoading", true);
  assert.ok(loginStatus.querySelector(".loader"));
  store.setState("isLoading", false);
  const retainedAlert = loginStatus.querySelector('[role="alert"]');
  assert.ok(retainedAlert);
  assert.equal(retainedAlert.textContent, "The passkey was not accepted.");
});

test("re-enables controls and clears status when loading finishes without an error", () => {
  const { root } = mountLogin();
  const apiKeyInput = root.querySelector("#api-key");
  const loginButton = root.querySelector("#login-button");
  const changeUrlButton = root.querySelector("#change-url-button");
  const loginStatus = root.querySelector("#login-status");

  store.setState("isLoading", true);
  assert.equal(apiKeyInput.disabled, true);
  assert.equal(loginButton.disabled, true);
  assert.equal(changeUrlButton.disabled, true);
  assert.ok(loginStatus.querySelector(".loader"));

  store.setState("isLoading", false);
  assert.equal(apiKeyInput.disabled, false);
  assert.equal(loginButton.disabled, false);
  assert.equal(changeUrlButton.disabled, false);
  assert.equal(loginStatus.children.length, 0);
});

test("coordinates isVerifyingSession and isLoading without prematurely enabling controls or clearing loader", () => {
  const { root } = mountLogin();
  const apiKeyInput = root.querySelector("#api-key");
  const loginButton = root.querySelector("#login-button");
  const changeUrlButton = root.querySelector("#change-url-button");
  const loginStatus = root.querySelector("#login-status");

  store.setState("isVerifyingSession", true);
  assert.equal(apiKeyInput.disabled, true);
  assert.equal(loginButton.disabled, true);
  assert.equal(changeUrlButton.disabled, true);
  assert.equal(loginButton.textContent, "Verifying...");
  assert.equal(loginStatus.textContent, "Verifying session...");

  // Loading starts while session verification is still active: loader takes priority.
  store.setState("isLoading", true);
  assert.equal(apiKeyInput.disabled, true);
  assert.equal(loginButton.disabled, true);
  assert.equal(changeUrlButton.disabled, true);
  assert.ok(loginStatus.querySelector(".loader"));

  // Verification ends while loading continues: controls stay disabled and loader stays visible.
  store.setState("isVerifyingSession", false);
  assert.equal(apiKeyInput.disabled, true);
  assert.equal(loginButton.disabled, true);
  assert.equal(changeUrlButton.disabled, true);
  assert.equal(loginButton.textContent, "Login");
  assert.ok(loginStatus.querySelector(".loader"));

  // Loading ends: controls re-enable and status clears.
  store.setState("isLoading", false);
  assert.equal(apiKeyInput.disabled, false);
  assert.equal(loginButton.disabled, false);
  assert.equal(changeUrlButton.disabled, false);
  assert.equal(loginStatus.children.length, 0);
});

test("mounting LoginComponent while isLoading is already true disables controls and shows loader immediately", () => {
  store.setState("isLoading", true);

  const { root } = mountLogin();
  const apiKeyInput = root.querySelector("#api-key");
  const loginButton = root.querySelector("#login-button");
  const changeUrlButton = root.querySelector("#change-url-button");
  const loginStatus = root.querySelector("#login-status");

  assert.equal(apiKeyInput.disabled, true);
  assert.equal(loginButton.disabled, true);
  assert.equal(changeUrlButton.disabled, true);
  assert.ok(loginStatus.querySelector(".loader"));
});

test("guards handleLogin, button click, and Enter key against re-submission while busy", async (t) => {
  const loginMock = t.mock.method(AuthService, "login", async () => true);

  const { root, component } = mountLogin();
  const apiKeyInput = root.querySelector("#api-key");
  const loginButton = root.querySelector("#login-button");
  apiKeyInput.value = "my-passkey";

  store.setState("isLoading", true);
  await component.handleLogin();
  loginButton.click();
  apiKeyInput.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
  );
  assert.equal(loginMock.mock.callCount(), 0);

  store.setState("isLoading", false);
  store.setState("isVerifyingSession", true);
  await component.handleLogin();
  loginButton.click();
  apiKeyInput.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
  );
  assert.equal(loginMock.mock.callCount(), 0);

  store.setState("isVerifyingSession", false);
  await component.handleLogin();
  assert.equal(loginMock.mock.callCount(), 1);
  assert.deepEqual(loginMock.mock.calls[0].arguments, ["my-passkey"]);
});

test("switching to setup view clears detached login control references", () => {
  const { root, component } = mountLogin();
  const detachedInput = root.querySelector("#api-key");
  const changeUrlButton = root.querySelector("#change-url-button");

  changeUrlButton.click();

  assert.equal(component.apiKeyInput, null);
  assert.equal(component.loginButton, null);
  assert.equal(component.changeUrlButton, null);
  assert.ok(root.querySelector("#script-url-input"));

  store.setState("isLoading", true);
  assert.equal(detachedInput.disabled, false);
  assert.ok(root.querySelector("#login-status .loader"));
});

test("destroy() unsubscribes from store updates", () => {
  const { root, component } = mountLogin();
  const apiKeyInput = root.querySelector("#api-key");
  const loginButton = root.querySelector("#login-button");
  const changeUrlButton = root.querySelector("#change-url-button");
  const loginStatus = root.querySelector("#login-status");

  component.destroy();

  store.setState("isLoading", true);
  store.setState("isVerifyingSession", true);
  store.setState("error", "Should not render");

  assert.equal(apiKeyInput.disabled, false);
  assert.equal(loginButton.disabled, false);
  assert.equal(changeUrlButton.disabled, false);
  assert.equal(loginButton.textContent, "Login");
  assert.equal(loginStatus.children.length, 0);
});
