// tests/backend/sanitise.test.js
//
// Pins the sheet-write safety helpers in Code.gs: formula-injection prefixes,
// grid sanitisation that leaves typed values alone, and the JSON parameter
// validation the router runs before a write service sees the data.

import { test } from "node:test";
import assert from "node:assert/strict";

import { createBackend } from "./harness.js";

function createTestBackend(t) {
  const backend = createBackend();
  t.after(() => backend.close());
  return backend;
}

test("_sanitizeForSheet prefixes every formula-leading character", (t) => {
  const backend = createTestBackend(t);
  const { _sanitizeForSheet } = backend.helpers;

  for (const value of [
    "=SUM(A1:A2)",
    "+1",
    "-Misc",
    "@user",
    "\tTabbed",
    "\rCarriage return",
    "\nLine feed",
  ]) {
    assert.equal(_sanitizeForSheet(value), "'" + value);
  }
});

test("_sanitizeForSheet leaves ordinary strings and blanks alone", (t) => {
  const backend = createTestBackend(t);
  const { _sanitizeForSheet } = backend.helpers;

  assert.equal(_sanitizeForSheet("Café"), "Café");
  assert.equal(_sanitizeForSheet("hello"), "hello");
  assert.equal(_sanitizeForSheet("  leading space"), "  leading space");
  assert.equal(_sanitizeForSheet("1,200"), "1,200");
  assert.equal(_sanitizeForSheet(""), "");
  assert.equal(_sanitizeForSheet(null), "");
  assert.equal(_sanitizeForSheet(undefined), "");
});

test("_sanitizeGridForSheet sanitises strings and leaves other values untouched", (t) => {
  const backend = createTestBackend(t);
  const { _sanitizeGridForSheet } = backend.helpers;
  const date = new Date("2026-01-15T00:00:00.000Z");

  const grid = [
    ["=1+1", 42, date, true],
    ["Café", 3.5, false, null],
  ];

  const result = _sanitizeGridForSheet(grid);

  assert.equal(result.length, 2);
  assert.equal(result[0].length, 4);
  assert.equal(result[0][0], "'=1+1");
  assert.equal(result[1][0], "Café");
  assert.equal(result[0][1], 42);
  assert.equal(result[1][1], 3.5);
  assert.equal(result[0][2], date, "the Date instance passes through");
  assert.equal(result[0][3], true);
  assert.equal(result[1][2], false);
  assert.equal(result[1][3], null);
});

test("_sanitizeGridForSheet leaves already-prefixed values unchanged", (t) => {
  const backend = createTestBackend(t);
  const { _sanitizeGridForSheet } = backend.helpers;

  assert.deepEqual(_sanitizeGridForSheet([["'=1+1", "'-Misc"]]), [
    ["'=1+1", "'-Misc"],
  ]);
});

test("validateJsonParameter accepts arrays and objects of the expected shape", (t) => {
  const backend = createTestBackend(t);
  const { validateJsonParameter } = backend.helpers;

  assert.equal(validateJsonParameter('["a", 1]', "array").valid, true);
  assert.equal(validateJsonParameter('{"a":1}', "object").valid, true);
});

test("validateJsonParameter rejects the wrong shape", (t) => {
  const backend = createTestBackend(t);
  const { validateJsonParameter } = backend.helpers;

  const arrayExpected = validateJsonParameter('{"a":1}', "array");
  assert.equal(arrayExpected.valid, false);
  assert.equal(arrayExpected.message, "Expected array");

  const objectExpected = validateJsonParameter("[1]", "object");
  assert.equal(objectExpected.valid, false);
  assert.equal(objectExpected.message, "Expected object");

  const nullExpected = validateJsonParameter("null", "object");
  assert.equal(nullExpected.valid, false);
  assert.equal(nullExpected.message, "Expected object");
});

test("validateJsonParameter rejects invalid JSON and missing content", (t) => {
  const backend = createTestBackend(t);
  const { validateJsonParameter } = backend.helpers;

  const invalid = validateJsonParameter("{not json", "object");
  assert.equal(invalid.valid, false);
  assert.equal(invalid.message, "Invalid JSON format");

  const missing = validateJsonParameter("", "array");
  assert.equal(missing.valid, false);
  assert.equal(missing.message, "Missing content");
});
