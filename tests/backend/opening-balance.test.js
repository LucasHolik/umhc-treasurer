// tests/backend/opening-balance.test.js
//
// Pins the opening balance read path against B-002: Config!C2 can hold text
// such as "1,200", and parseFloat stops at the comma, so the server used to
// return 1. The tests assert both the direct read and the value getAppData
// reports, so a regression in either path shows up here.

import { test } from "node:test";
import assert from "node:assert/strict";

import { createBackend } from "./harness.js";

const NOW = 1_700_000_000_000;

// A fresh Config sheet has 0 in C2, so each test sets the cell it cares about.
function balanceFor(t, cellValue) {
  const backend = createBackend({ now: NOW });
  t.after(() => backend.close());
  backend.sheets.setCell("Config", "C2", cellValue);
  return backend.request("getOpeningBalance");
}

test("a text opening balance of 1,200 is read as 1200", (t) => {
  const backend = createBackend({ now: NOW });
  t.after(() => backend.close());
  backend.sheets.setCell("Config", "C2", "1,200");

  assert.deepEqual(backend.request("getOpeningBalance"), {
    success: true,
    balance: 1200,
  });
  // The read stays read-only: parsing the value must not rewrite the cell.
  assert.equal(
    backend.sheets.cell("Config", "C2"),
    "1,200",
    "the text cell is left untouched",
  );
});

test("getAppData reports a comma-formatted opening balance as 1200", (t) => {
  const backend = createBackend({ now: NOW });
  t.after(() => backend.close());
  backend.sheets.setCell("Config", "C2", "1,200");

  const response = backend.request("getAppData");

  assert.equal(response.success, true);
  assert.equal(response.data.openingBalance, 1200);
});

test("a decimal text opening balance is read exactly", (t) => {
  assert.deepEqual(balanceFor(t, "250.5"), { success: true, balance: 250.5 });
});

test("a comma-formatted decimal opening balance is read exactly", (t) => {
  assert.deepEqual(balanceFor(t, "1,200.50"), {
    success: true,
    balance: 1200.5,
  });
});

test("a numeric opening balance cell is still read as a number", (t) => {
  assert.deepEqual(balanceFor(t, 1200), { success: true, balance: 1200 });
});

test("an empty opening balance cell is 0", (t) => {
  assert.deepEqual(balanceFor(t, ""), { success: true, balance: 0 });
});

test("a non-numeric opening balance cell is 0", (t) => {
  assert.deepEqual(balanceFor(t, "abc"), { success: true, balance: 0 });
});
