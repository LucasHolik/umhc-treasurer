// tests/services/excel.service.test.js

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeDateString,
  parseExcelNumber,
  parseAndCleanData,
} from "../../src/services/excel.service.js";

test("normalizeDateString formats Date objects as local YYYY-MM-DD", () => {
  assert.equal(normalizeDateString(new Date(2024, 0, 5)), "2024-01-05");
});

test("normalizeDateString converts DD/MM/YYYY with padding", () => {
  assert.equal(normalizeDateString("31/01/2024"), "2024-01-31");
  assert.equal(normalizeDateString("5/3/2024"), "2024-03-05");
});

test("normalizeDateString rejects impossible rollover dates", () => {
  assert.equal(normalizeDateString("31/02/2024"), "31/02/2024");
});

test("normalizeDateString passes YYYY-MM-DD through", () => {
  assert.equal(normalizeDateString("2024-01-31"), "2024-01-31");
});

test("normalizeDateString strips time from ISO and datetime strings", () => {
  assert.equal(normalizeDateString("2024-10-19T23:00:00.000Z"), "2024-10-19");
  assert.equal(normalizeDateString("2024-10-19 23:00:00"), "2024-10-19");
});

test("normalizeDateString handles empty values", () => {
  assert.equal(normalizeDateString(""), "");
  assert.equal(normalizeDateString(null), "");
  assert.equal(normalizeDateString(undefined), "");
});

test("parseExcelNumber strips currency symbols and commas", () => {
  assert.equal(parseExcelNumber(12.5), 12.5);
  assert.equal(parseExcelNumber("£1,234.56"), 1234.56);
  assert.equal(parseExcelNumber("$99"), 99);
  assert.equal(parseExcelNumber("12.50 GBP"), 12.5);
});

test("parseExcelNumber returns null for empty or invalid values", () => {
  assert.equal(parseExcelNumber(""), null);
  assert.equal(parseExcelNumber(null), null);
  assert.equal(parseExcelNumber("abc"), null);
});

test("parseAndCleanData finds the header after preamble rows", () => {
  const rows = [
    ["Some Bank Plc"],
    ["Statement for account 123"],
    ["Date", "Description", "Cash In", "Cash Out"],
    ["01/03/2024", "Membership fee", "£10.00", ""],
  ];
  const result = parseAndCleanData(rows);
  assert.equal(result.length, 1);
  assert.equal(result[0].date, "2024-03-01");
  assert.equal(result[0].description, "Membership fee");
  assert.equal(result[0].cashIn, 10);
  assert.equal(result[0].cashOut, null);
});

test("parseAndCleanData merges continuation rows without a date", () => {
  const rows = [
    ["Date", "Description", "Cash In", "Cash Out"],
    ["01/03/2024", "Bus hire", "", "50.00"],
    ["", "second leg", "", ""],
    ["02/03/2024", "Snacks", "", "5.00"],
  ];
  const result = parseAndCleanData(rows);
  assert.equal(result.length, 2);
  assert.equal(result[0].description, "Bus hire second leg");
  assert.equal(result[0].cashOut, 50);
  assert.equal(result[1].description, "Snacks");
});

test("parseAndCleanData stops at the pending-transactions footer", () => {
  const rows = [
    ["Date", "Description", "Cash In", "Cash Out"],
    ["01/03/2024", "Real transaction", "10.00", ""],
    ["", "Pending transactions are listed below", "", ""],
    ["02/03/2024", "Should not appear", "99.00", ""],
  ];
  const result = parseAndCleanData(rows);
  assert.equal(result.length, 1);
  assert.equal(result[0].description, "Real transaction");
});

test("parseAndCleanData recognises credit/debit column names", () => {
  const rows = [
    ["Transaction Date", "Description", "Credit", "Debit"],
    ["01/03/2024", "Subs", "15.00", ""],
    ["02/03/2024", "Van fuel", "", "42.10"],
  ];
  const result = parseAndCleanData(rows);
  assert.equal(result[0].cashIn, 15);
  assert.equal(result[1].cashOut, 42.1);
});

test("parseAndCleanData throws when required parts are missing", () => {
  assert.throws(
    () => parseAndCleanData([["just"], ["noise"]]),
    /Couldn't find the header row/,
  );
  assert.throws(
    () =>
      parseAndCleanData([
        ["Date", "Description", "Notes"],
        ["01/03/2024", "x", "y"],
      ]),
    /Neither 'cash in' nor 'cash out' columns found/,
  );
});
