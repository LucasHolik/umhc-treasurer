// tests/services/api.service.test.js
//
// Only the pure, network-free helpers are tested. Nothing here touches
// the session, storage, or the backend.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canonicalStringify,
  _validateScriptUrl,
  resolveTimeout,
} from "../../src/services/api.service.js";

test("canonicalStringify sorts object keys recursively", () => {
  assert.deepEqual(
    canonicalStringify({ b: 1, a: { d: 2, c: 3 } }),
    '{"a":{"c":3,"d":2},"b":1}',
  );
});

test("canonicalStringify keeps array order, sorts nested objects", () => {
  assert.deepEqual(
    canonicalStringify([{ b: 1, a: 2 }, 3, "x"]),
    '[{"a":2,"b":1},3,"x"]',
  );
});

test("canonicalStringify matches JSON.stringify for primitives", () => {
  assert.deepEqual(canonicalStringify("text"), '"text"');
  assert.deepEqual(canonicalStringify(42), "42");
  assert.deepEqual(canonicalStringify(null), "null");
  assert.deepEqual(canonicalStringify(true), "true");
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
  assert.deepEqual(_validateScriptUrl("https://evil.com/macros/s/x"), null);
  assert.deepEqual(
    _validateScriptUrl("https://evil.script.google.com/macros/s/x"),
    null,
  );
  assert.deepEqual(
    _validateScriptUrl("https://script.google.com/other/path"),
    null,
  );
  assert.deepEqual(_validateScriptUrl("not a url"), null);
  assert.deepEqual(_validateScriptUrl(""), null);
  assert.deepEqual(_validateScriptUrl(null), null);
});

test("resolveTimeout gives reads 30 s by default", () => {
  assert.deepEqual(resolveTimeout(), 30000);
  assert.deepEqual(resolveTimeout({ skipLoading: true }), 30000);
});

test("resolveTimeout gives mutating requests 60 s", () => {
  assert.deepEqual(resolveTimeout({ withNonce: true }), 60000);
});

test("resolveTimeout honours an explicit timeoutMs", () => {
  assert.deepEqual(resolveTimeout({ timeoutMs: 5000 }), 5000);
  assert.deepEqual(
    resolveTimeout({ withNonce: true, timeoutMs: 90000 }),
    90000,
  );
});
