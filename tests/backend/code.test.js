// tests/backend/code.test.js
//
// Smoke tests for the Apps Script backend, run in Node through the private vm
// harness. These are the only backend tests in part 1: they prove the router,
// request signing and role check work end to end before later parts pin down
// auth, locking, tags and splits.

import { test } from "node:test";
import assert from "node:assert/strict";

import { createBackend } from "./harness.js";

// A well-formed SHA-256 signature (64 hex characters) that is not the correct
// one, so a presence-only check cannot accept it.
const WRONG_SIGNATURE = "a".repeat(64);

test("an unsigned request is rejected as Unauthorized", (t) => {
  const backend = createBackend();
  t.after(() => backend.close());
  const warn = t.mock.method(console, "warn", () => {});

  const response = backend.request("ping", {}, { signed: false });

  assert.deepEqual(response, { success: false, message: "Unauthorized" });
  // The session is valid, so the rejection must come from the missing
  // signature, not from a missing or expired session.
  assert.ok(
    warn.mock.calls.some((call) =>
      String(call.arguments[0]).includes("Signature mismatch"),
    ),
    "the missing signature is logged",
  );
});

test("a wrong signature on a read is rejected as Unauthorized", (t) => {
  const backend = createBackend();
  t.after(() => backend.close());
  const warn = t.mock.method(console, "warn", () => {});

  const response = backend.request("ping", {}, { signature: WRONG_SIGNATURE });

  assert.deepEqual(response, { success: false, message: "Unauthorized" });
  // A presence-only signature check would accept this request, so the test
  // also proves the comparison runs, not just the missing-signature branch.
  assert.ok(
    warn.mock.calls.some((call) =>
      String(call.arguments[0]).includes(
        "Request rejected: Signature mismatch for action ping",
      ),
    ),
    "the wrong signature is logged as a mismatch",
  );
});

test("a wrong signature on a write is rejected and changes nothing", (t) => {
  const backend = createBackend();
  t.after(() => backend.close());
  const warn = t.mock.method(console, "warn", () => {});

  const response = backend.request(
    "saveOpeningBalance",
    { balance: 500 },
    { signature: WRONG_SIGNATURE },
  );

  assert.deepEqual(response, { success: false, message: "Unauthorized" });
  assert.ok(
    warn.mock.calls.some((call) =>
      String(call.arguments[0]).includes(
        "Request rejected: Signature mismatch for action saveOpeningBalance",
      ),
    ),
    "the wrong write signature is logged as a mismatch",
  );
  assert.equal(
    backend.sheets.cell("Config", "C2"),
    0,
    "the rejected write must not reach the sheet",
  );
});

test("a signed admin ping returns success and the admin role", (t) => {
  const backend = createBackend();
  t.after(() => backend.close());

  const response = backend.request("ping");

  assert.deepEqual(response, { success: true, role: "admin" });
});

test("a signed viewer write is Forbidden", (t) => {
  const backend = createBackend();
  t.after(() => backend.close());

  const response = backend.request(
    "saveOpeningBalance",
    { balance: 500 },
    { role: "viewer" },
  );

  assert.deepEqual(response, { success: false, message: "Forbidden" });
  assert.equal(
    backend.sheets.cell("Config", "C2"),
    0,
    "the rejected write must not reach the sheet",
  );
});

test("a custom callback name is used verbatim in the raw JSONP wrapper", (t) => {
  const backend = createBackend();
  t.after(() => backend.close());

  const { raw, response } = backend.requestRaw(
    "ping",
    {},
    { callback: "myCallback" },
  );

  assert.equal(raw, 'myCallback({"success":true,"role":"admin"})');
  assert.deepEqual(response, { success: true, role: "admin" });
});

test("a JSONP reply uses the application/javascript MIME type", (t) => {
  const backend = createBackend();
  t.after(() => backend.close());

  const { mimeType } = backend.requestRaw(
    "ping",
    {},
    { callback: "myCallback" },
  );

  // The literal matters: ContentService.MimeType.JAVASCRIPT is a real MIME
  // type string, so asserting only that it equals the fake's own constant
  // would let a wrong fake pass.
  assert.equal(mimeType, "application/javascript");
});

test("an unsafe callback name still produces a callback JSONP wrapper", (t) => {
  const backend = createBackend();
  t.after(() => backend.close());
  const warn = t.mock.method(console, "warn", () => {});

  const { raw, response } = backend.requestRaw(
    "ping",
    {},
    { callback: "bad name()" },
  );

  assert.ok(
    raw.startsWith("callback("),
    "the server falls back to the default callback wrapper",
  );
  assert.deepEqual(response, { success: true, role: "admin" });
  assert.ok(
    warn.mock.calls.some((call) =>
      String(call.arguments[0]).includes(
        "Invalid callback parameter detected: bad name()",
      ),
    ),
    "the unsafe callback is replaced by the default",
  );
});
