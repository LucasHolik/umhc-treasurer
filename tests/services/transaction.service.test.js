// tests/services/transaction.service.test.js

import { test } from "node:test";
import assert from "node:assert/strict";
import TransactionService from "../../src/services/transaction.service.js";

test("mergeSplits with no expenses returns empty list", () => {
  assert.deepEqual(TransactionService.mergeSplits([], [{ x: 1 }]), []);
  assert.deepEqual(TransactionService.mergeSplits(null, null), []);
});

test("mergeSplits with no history returns a fresh copy", () => {
  const raw = [{ Date: "2024-01-01", Description: "a" }];
  const result = TransactionService.mergeSplits(raw, []);
  assert.ok(result !== raw, "must be a new array");
  assert.deepEqual(result, raw);
});

test("mergeSplits replaces SOURCE rows with their children", () => {
  const raw = [
    { Date: "2024-01-02", Description: "Split me", "Split Group ID": "G1" },
    { Date: "2024-01-01", Description: "Normal" },
  ];
  const history = [
    {
      Date: "2024-01-02",
      Description: "Split me",
      "Split Group ID": "G1",
      "Split Type": "SOURCE",
    },
    {
      Date: "2024-01-02",
      Description: "Part 1",
      "Split Group ID": "G1",
      "Split Type": "CHILD",
    },
    {
      Date: "2024-01-02",
      Description: "Part 2",
      "Split Group ID": "G1",
      "Split Type": "CHILD",
    },
  ];
  const result = TransactionService.mergeSplits(raw, history);
  const descriptions = result.map((r) => r.Description);
  assert.ok(!descriptions.includes("Split me"), "source row must be removed");
  assert.ok(
    descriptions.includes("Part 1") && descriptions.includes("Part 2"),
    "child rows must be injected",
  );
  assert.deepEqual(result.length, 3);
});

test("mergeSplits keeps a SOURCE row that has no children", (t) => {
  const consoleWarn = t.mock.method(console, "warn", () => {});
  const raw = [
    {
      Date: "2024-01-02",
      Description: "Orphan source",
      "Split Group ID": "G9",
    },
  ];
  const history = [
    {
      Date: "2024-01-02",
      Description: "Orphan source",
      "Split Group ID": "G9",
      "Split Type": "SOURCE",
    },
  ];
  const result = TransactionService.mergeSplits(raw, history);
  assert.deepEqual(result.length, 1);
  assert.deepEqual(result[0].Description, "Orphan source");
  assert.equal(consoleWarn.mock.callCount(), 1);
});

test("mergeSplits injects each group's children only once", () => {
  const raw = [
    { Date: "2024-01-02", Description: "dup A", "Split Group ID": "G1" },
    { Date: "2024-01-02", Description: "dup B", "Split Group ID": "G1" },
  ];
  const history = [
    { Date: "2024-01-02", "Split Group ID": "G1", "Split Type": "SOURCE" },
    {
      Date: "2024-01-02",
      Description: "Child",
      "Split Group ID": "G1",
      "Split Type": "CHILD",
    },
  ];
  const result = TransactionService.mergeSplits(raw, history);
  assert.deepEqual(result.length, 1);
  assert.deepEqual(result[0].Description, "Child");
});

test("mergeSplits sorts the merged list by date descending", () => {
  const raw = [
    { Date: "2024-01-01", Description: "old" },
    { Date: "2024-03-01", Description: "new" },
    { Date: "2024-02-01", Description: "mid" },
  ];
  const result = TransactionService.mergeSplits(raw, [{ ignored: true }]);
  assert.deepEqual(
    result.map((r) => r.Description),
    ["new", "mid", "old"],
  );
});
