// tests/services/api.service.test.js
//
// Only network-free paths are tested: the pure helpers, plus the read-only
// refusal in suggestTags, which rejects before any JSONP request is built.
// Nothing here touches the network or the backend.

import { test } from "node:test";
import assert from "node:assert/strict";
import ApiService, {
  canonicalStringify,
  _validateScriptUrl,
  resolveTimeout,
  _responseError,
  _shouldExpireSession,
} from "../../src/services/api.service.js";
import store from "../../src/core/state.js";

test("canonicalStringify sorts object keys recursively", () => {
  assert.equal(
    canonicalStringify({ b: 1, a: { d: 2, c: 3 } }),
    '{"a":{"c":3,"d":2},"b":1}',
  );
});

test("canonicalStringify keeps array order, sorts nested objects", () => {
  assert.equal(
    canonicalStringify([{ b: 1, a: 2 }, 3, "x"]),
    '[{"a":2,"b":1},3,"x"]',
  );
});

test("canonicalStringify matches JSON.stringify for primitives", () => {
  assert.equal(canonicalStringify("text"), '"text"');
  assert.equal(canonicalStringify(42), "42");
  assert.equal(canonicalStringify(null), "null");
  assert.equal(canonicalStringify(true), "true");
});

test("canonicalStringify is stable regardless of insertion order", () => {
  const a = { x: 1, y: { b: 2, a: 3 } };
  const b = { y: { a: 3, b: 2 }, x: 1 };
  assert.deepEqual(canonicalStringify(a), canonicalStringify(b));
});

test("_validateScriptUrl accepts only Apps Script web app URLs", () => {
  const valid = "https://script.google.com/macros/s/ABC123/exec";
  assert.deepEqual(_validateScriptUrl(valid), valid);
});

test("_validateScriptUrl rejects everything else", () => {
  assert.equal(_validateScriptUrl("https://evil.com/macros/s/x"), null);
  assert.equal(
    _validateScriptUrl("https://evil.script.google.com/macros/s/x"),
    null,
  );
  assert.equal(
    _validateScriptUrl("https://script.google.com/other/path"),
    null,
  );
  assert.equal(_validateScriptUrl("not a url"), null);
  assert.equal(_validateScriptUrl(""), null);
  assert.equal(_validateScriptUrl(null), null);
});

test("resolveTimeout gives reads 30 s by default", () => {
  assert.equal(resolveTimeout(), 30000);
  assert.equal(resolveTimeout({ skipLoading: true }), 30000);
});

test("resolveTimeout gives mutating requests 60 s", () => {
  assert.equal(resolveTimeout({ withNonce: true }), 60000);
});

test("resolveTimeout honours an explicit timeoutMs", () => {
  assert.equal(resolveTimeout({ timeoutMs: 5000 }), 5000);
  assert.equal(resolveTimeout({ withNonce: true, timeoutMs: 90000 }), 90000);
});

test("ApiService.suggestTags refuses a viewer before any request is sent", async (t) => {
  const previousUser = store.getState("currentUser");
  t.after(() => store.setState("currentUser", previousUser));

  store.setState("currentUser", { loggedIn: true, canEdit: false });

  await assert.rejects(ApiService.suggestTags([{ row: 1 }]), {
    message: /^View-only mode:/,
  });
});

test("_responseError marks an Unauthorized reply as UNAUTHORIZED", () => {
  const error = _responseError({ success: false, message: "Unauthorized" });

  assert.equal(error.message, "Unauthorized");
  assert.equal(error.code, "UNAUTHORIZED");
});

test("_responseError marks the server-busy reply as BUSY", () => {
  const error = _responseError({
    success: false,
    message: "System is busy. Please try again.",
  });

  assert.equal(error.code, "BUSY");
});

test("_responseError leaves a generic reply without a code", () => {
  const error = _responseError({
    success: false,
    message: "Something failed.",
  });

  assert.equal(error.code, undefined);
  assert.equal(error.message, "Something failed.");
});

test("_responseError attaches the failure reply to the error", () => {
  const data = {
    success: false,
    message: "Partial failure",
    appliedOperations: [],
  };

  const error = _responseError(data);

  assert.deepEqual(error.response, data);
});

test("_responseError falls back to a default message", () => {
  const error = _responseError({ success: false });

  assert.equal(error.message, "API request failed.");
});

test("_shouldExpireSession ignores a failed login", () => {
  assert.equal(_shouldExpireSession("login", "UNAUTHORIZED"), false);
});

test("_shouldExpireSession expires the session for another action", () => {
  assert.equal(_shouldExpireSession("getAppData", "UNAUTHORIZED"), true);
});

test("_shouldExpireSession ignores codes other than UNAUTHORIZED", () => {
  assert.equal(_shouldExpireSession("getAppData", "BUSY"), false);
  assert.equal(_shouldExpireSession("getAppData", "TIMEOUT"), false);
  assert.equal(_shouldExpireSession("getAppData", undefined), false);
});
