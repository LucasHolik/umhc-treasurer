// tests/services/auth.service.test.js
//
// Pins the login failure messages and the login flow's state changes, without
// a network: ApiService.login is replaced with a mock for each test.

import { test } from "node:test";
import assert from "node:assert/strict";

import AuthService, {
  describeLoginFailure,
} from "../../src/services/auth.service.js";
import ApiService from "../../src/services/api.service.js";
import store from "../../src/core/state.js";

const NETWORK_MESSAGE =
  "Could not reach server. Please check your connection and try again.";

// Restores the store and session state a test may change. The successful-login
// path writes real session storage through ApiService.setSession.
function cleanUp(t) {
  const previousUser = store.getState("currentUser");
  const previousError = store.getState("error");
  t.after(() => {
    ApiService.clearSession();
    store.setState("currentUser", previousUser);
    store.setState("error", previousError);
  });
}

test("describeLoginFailure reports a timeout as unreachable", () => {
  const error = Object.assign(new Error("Request timed out."), {
    code: "TIMEOUT",
  });

  assert.equal(describeLoginFailure(error), NETWORK_MESSAGE);
});

test("describeLoginFailure reports a network failure as unreachable", () => {
  const error = Object.assign(new Error("Network error during API request."), {
    code: "NETWORK",
  });

  assert.equal(describeLoginFailure(error), NETWORK_MESSAGE);
});

test("describeLoginFailure explains a rejected passkey", () => {
  const error = Object.assign(new Error("Unauthorized"), {
    code: "UNAUTHORIZED",
  });

  assert.equal(
    describeLoginFailure(error),
    "The passkey was not accepted. Please check it and try again, or wait a few minutes if it keeps failing.",
  );
});

test("describeLoginFailure surfaces a server reply message", () => {
  const error = Object.assign(new Error("Request failed."), {
    code: "BUSY",
    response: { success: false, message: "System is busy. Please try again." },
  });

  assert.equal(
    describeLoginFailure(error),
    "System is busy. Please try again.",
  );
});

test("describeLoginFailure falls back to the error message", () => {
  assert.equal(
    describeLoginFailure(new Error("Login refused.")),
    "Login refused.",
  );
});

test("describeLoginFailure falls back to a generic message", () => {
  assert.equal(describeLoginFailure({}), "Login failed. Please try again.");
});

test("a rejected passkey returns false and explains the passkey", async (t) => {
  cleanUp(t);
  const errorLog = t.mock.method(console, "error", () => {});
  t.mock.method(ApiService, "login", async () => {
    throw Object.assign(new Error("Unauthorized"), { code: "UNAUTHORIZED" });
  });

  const result = await AuthService.login("wrong-passkey");

  assert.equal(result, false);
  assert.equal(
    store.getState("error"),
    "The passkey was not accepted. Please check it and try again, or wait a few minutes if it keeps failing.",
  );
  assert.equal(errorLog.mock.calls.length, 1);
});

test("a timeout returns false with the network message", async (t) => {
  cleanUp(t);
  t.mock.method(console, "error", () => {});
  t.mock.method(ApiService, "login", async () => {
    throw Object.assign(new Error("Request timed out."), { code: "TIMEOUT" });
  });

  const result = await AuthService.login("any-passkey");

  assert.equal(result, false);
  assert.equal(store.getState("error"), NETWORK_MESSAGE);
});

test("a generic rejection with a server message surfaces that message", async (t) => {
  cleanUp(t);
  t.mock.method(console, "error", () => {});
  const serverMessage = "System is busy. Please try again.";
  t.mock.method(ApiService, "login", async () => {
    throw Object.assign(new Error("Request failed."), {
      code: "BUSY",
      response: { success: false, message: serverMessage },
    });
  });

  const result = await AuthService.login("any-passkey");

  assert.equal(result, false);
  assert.equal(store.getState("error"), serverMessage);
});

test("a successful login returns true and sets the current user", async (t) => {
  cleanUp(t);
  t.mock.method(ApiService, "login", async () => ({
    success: true,
    sessionId: "session-id",
    sessionKey: "session-key",
    role: "admin",
  }));

  const result = await AuthService.login("correct-passkey");

  assert.equal(result, true);
  assert.deepEqual(store.getState("currentUser"), {
    loggedIn: true,
    role: "admin",
    canEdit: true,
  });
});
