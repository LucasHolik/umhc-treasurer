// src/features/settings/selftest/tests.excel.js

import { test, assertEqual, assertThrows } from "./selftest.runner.js";
import {
  normalizeDateString,
  parseExcelNumber,
  parseAndCleanData,
} from "../../../services/excel.service.js";

const SUITE = "Excel parsing";

test(
  SUITE,
  "normalizeDateString formats Date objects as local YYYY-MM-DD",
  () => {
    assertEqual(normalizeDateString(new Date(2024, 0, 5)), "2024-01-05");
  },
);

test(SUITE, "normalizeDateString converts DD/MM/YYYY with padding", () => {
  assertEqual(normalizeDateString("31/01/2024"), "2024-01-31");
  assertEqual(normalizeDateString("5/3/2024"), "2024-03-05");
});

test(SUITE, "normalizeDateString rejects impossible rollover dates", () => {
  assertEqual(normalizeDateString("31/02/2024"), "31/02/2024");
});

test(SUITE, "normalizeDateString passes YYYY-MM-DD through", () => {
  assertEqual(normalizeDateString("2024-01-31"), "2024-01-31");
});

test(
  SUITE,
  "normalizeDateString strips time from ISO and datetime strings",
  () => {
    assertEqual(normalizeDateString("2024-10-19T23:00:00.000Z"), "2024-10-19");
    assertEqual(normalizeDateString("2024-10-19 23:00:00"), "2024-10-19");
  },
);

test(SUITE, "normalizeDateString handles empty values", () => {
  assertEqual(normalizeDateString(""), "");
  assertEqual(normalizeDateString(null), "");
  assertEqual(normalizeDateString(undefined), "");
});

test(SUITE, "parseExcelNumber strips currency symbols and commas", () => {
  assertEqual(parseExcelNumber(12.5), 12.5);
  assertEqual(parseExcelNumber("£1,234.56"), 1234.56);
  assertEqual(parseExcelNumber("$99"), 99);
  assertEqual(parseExcelNumber("12.50 GBP"), 12.5);
});

test(SUITE, "parseExcelNumber returns null for empty or invalid values", () => {
  assertEqual(parseExcelNumber(""), null);
  assertEqual(parseExcelNumber(null), null);
  assertEqual(parseExcelNumber("abc"), null);
});

test(SUITE, "parseAndCleanData finds the header after preamble rows", () => {
  const rows = [
    ["Some Bank Plc"],
    ["Statement for account 123"],
    ["Date", "Description", "Cash In", "Cash Out"],
    ["01/03/2024", "Membership fee", "£10.00", ""],
  ];
  const result = parseAndCleanData(rows);
  assertEqual(result.length, 1);
  assertEqual(result[0].date, "2024-03-01");
  assertEqual(result[0].description, "Membership fee");
  assertEqual(result[0].cashIn, 10);
  assertEqual(result[0].cashOut, null);
});

test(SUITE, "parseAndCleanData merges continuation rows without a date", () => {
  const rows = [
    ["Date", "Description", "Cash In", "Cash Out"],
    ["01/03/2024", "Bus hire", "", "50.00"],
    ["", "second leg", "", ""],
    ["02/03/2024", "Snacks", "", "5.00"],
  ];
  const result = parseAndCleanData(rows);
  assertEqual(result.length, 2);
  assertEqual(result[0].description, "Bus hire second leg");
  assertEqual(result[0].cashOut, 50);
  assertEqual(result[1].description, "Snacks");
});

test(
  SUITE,
  "parseAndCleanData stops at the pending-transactions footer",
  () => {
    const rows = [
      ["Date", "Description", "Cash In", "Cash Out"],
      ["01/03/2024", "Real transaction", "10.00", ""],
      ["", "Pending transactions are listed below", "", ""],
      ["02/03/2024", "Should not appear", "99.00", ""],
    ];
    const result = parseAndCleanData(rows);
    assertEqual(result.length, 1);
    assertEqual(result[0].description, "Real transaction");
  },
);

test(SUITE, "parseAndCleanData recognises credit/debit column names", () => {
  const rows = [
    ["Transaction Date", "Description", "Credit", "Debit"],
    ["01/03/2024", "Subs", "15.00", ""],
    ["02/03/2024", "Van fuel", "", "42.10"],
  ];
  const result = parseAndCleanData(rows);
  assertEqual(result[0].cashIn, 15);
  assertEqual(result[1].cashOut, 42.1);
});

test(
  SUITE,
  "parseAndCleanData throws when required parts are missing",
  async () => {
    await assertThrows(
      () => parseAndCleanData([["just"], ["noise"]]),
      "missing header row must throw",
    );
    await assertThrows(
      () =>
        parseAndCleanData([
          ["Date", "Description", "Notes"],
          ["01/03/2024", "x", "y"],
        ]),
      "missing cash in/out columns must throw",
    );
  },
);
