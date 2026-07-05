// src/features/settings/selftest/tests.financial.js

import { test, assertEqual, assertClose } from "./selftest.runner.js";
import { calculateFinancials } from "../../../core/financial.logic.js";

const SUITE = "Financial logic";

test(SUITE, "empty transactions leave the opening balance untouched", () => {
  const r = calculateFinancials(100, []);
  assertEqual(r.totalIncome, 0);
  assertEqual(r.totalExpenses, 0);
  assertEqual(r.manualOffset, 0);
  assertEqual(r.adjustedOpeningBalance, 100);
  assertEqual(r.currentBalance, 100);
});

test(SUITE, "null transaction list is treated as empty", () => {
  assertEqual(calculateFinancials(50, null).currentBalance, 50);
});

test(SUITE, "opening balance accepts strings, garbage becomes 0", () => {
  assertEqual(calculateFinancials("250.5", []).currentBalance, 250.5);
  assertEqual(calculateFinancials("abc", []).currentBalance, 0);
  assertEqual(calculateFinancials(undefined, []).currentBalance, 0);
});

test(SUITE, "totals sum income and expenses including comma strings", () => {
  const r = calculateFinancials(0, [
    { Income: "1,000.50", Expense: 0 },
    { Income: 0, Expense: "200.25" },
  ]);
  assertClose(r.totalIncome, 1000.5);
  assertClose(r.totalExpenses, 200.25);
  assertClose(r.currentBalance, 800.25);
});

test(
  SUITE,
  "manual offset formula: offset = manualExpense - manualIncome",
  () => {
    const r = calculateFinancials(100, [
      { Income: 50, Expense: 0, Type: "Manual" },
      { Income: 0, Expense: 20, Type: "Manual" },
    ]);
    assertClose(r.manualOffset, -30);
    assertClose(r.adjustedOpeningBalance, 70);
    assertClose(r.totalIncome, 50);
    assertClose(r.totalExpenses, 20);
  },
);

test(SUITE, "manual rows cancel out of the current balance", () => {
  const regular = [
    { Income: 300, Expense: 0 },
    { Income: 0, Expense: 120.5 },
  ];
  const manual = [
    { Income: 75.25, Expense: 0, Type: "Manual" },
    { Income: 0, Expense: 40, Type: "Manual" },
  ];
  const withoutManual = calculateFinancials(500, regular);
  const withManual = calculateFinancials(500, [...regular, ...manual]);
  assertClose(withManual.currentBalance, withoutManual.currentBalance);
});

test(SUITE, "manual-only ledger returns to the opening balance", () => {
  const r = calculateFinancials(1000, [
    { Income: 12.34, Expense: 0, Type: "Manual" },
    { Income: 0, Expense: 56.78, Type: "Manual" },
  ]);
  assertClose(r.currentBalance, 1000);
});
