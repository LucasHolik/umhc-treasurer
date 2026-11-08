// tests/helpers/assert.js
//
// Assertions that node:assert does not provide.

import assert from "node:assert/strict";

export function assertClose(actual, expected, epsilon = 1e-9, message) {
  const prefix = message ? message + ": " : "";
  assert.ok(
    typeof actual === "number" &&
      !Number.isNaN(actual) &&
      Math.abs(actual - expected) <= epsilon,
    `${prefix}expected ~${expected} (±${epsilon}) but got ${actual}`,
  );
}
