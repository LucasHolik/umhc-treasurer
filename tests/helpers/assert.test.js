// tests/helpers/assert.test.js

import { test } from "node:test";
import assert from "node:assert/strict";
import { assertClose } from "./assert.js";

test("assertClose accepts values within epsilon", () => {
  assertClose(0.1 + 0.2, 0.3);
  assertClose(10.004, 10, 0.01);
});

test("assertClose rejects values outside epsilon, NaN and non-numbers", () => {
  assert.throws(() => assertClose(0.31, 0.3), assert.AssertionError);
  assert.throws(() => assertClose(NaN, 0), assert.AssertionError);
  assert.throws(() => assertClose("0.3", 0.3), assert.AssertionError);
});
