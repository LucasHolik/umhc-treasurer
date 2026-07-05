// src/features/settings/selftest/tests.transactions.js

import { test, assert, assertEqual } from "./selftest.runner.js";
import { filterData, sortData } from "../../transactions/transactions.logic.js";
import TransactionService from "../../../services/transaction.service.js";

const SUITE = "Transactions logic";

const sample = () => [
  {
    Description: "Bus to Snowdon",
    Category: "Transport",
    "Trip/Event": "Snowdon",
  },
  {
    Description: "Hut fees",
    Category: "Accommodation",
    "Trip/Event": "Snowdon",
  },
  { Description: "Membership", Category: "", "Trip/Event": "" },
];

test(SUITE, "filterData matches description case-insensitively", () => {
  const result = filterData(sample(), { descriptionSearch: "bus to" });
  assertEqual(result.length, 1);
  assertEqual(result[0].Description, "Bus to Snowdon");
});

test(SUITE, "filterData filters by category set", () => {
  const result = filterData(sample(), {
    selectedCategories: new Set(["Transport"]),
  });
  assertEqual(result.length, 1);
  assertEqual(result[0].Category, "Transport");
});

test(SUITE, "filterData __NO_TAG__ matches untagged rows", () => {
  const byCat = filterData(sample(), {
    selectedCategories: new Set(["__NO_TAG__"]),
  });
  assertEqual(byCat.length, 1);
  assertEqual(byCat[0].Description, "Membership");

  const byTrip = filterData(sample(), {
    selectedTrips: new Set(["__NO_TAG__", "Snowdon"]),
  });
  assertEqual(byTrip.length, 3);
});

test(SUITE, "filterData combines all filters with AND", () => {
  const result = filterData(sample(), {
    selectedCategories: new Set(["Transport", "Accommodation"]),
    selectedTrips: new Set(["Snowdon"]),
    descriptionSearch: "hut",
  });
  assertEqual(result.length, 1);
  assertEqual(result[0].Description, "Hut fees");
});

test(SUITE, "filterData with empty filters passes everything", () => {
  assertEqual(
    filterData(sample(), {
      selectedCategories: new Set(),
      selectedTrips: new Set(),
      descriptionSearch: "",
    }).length,
    3,
  );
});

test(SUITE, "sortData returns a new array and keeps input order", () => {
  const data = [{ Date: "2024-02-01" }, { Date: "2024-01-01" }];
  const sorted = sortData(data, "Date", true);
  assert(sorted !== data, "must not return the input array");
  assertEqual(data[0].Date, "2024-02-01", "input order must be untouched");
  assertEqual(sorted[0].Date, "2024-01-01");
});

test(SUITE, "sortData sorts dates ascending and descending", () => {
  const data = [
    { Date: "2024-03-01" },
    { Date: "2024-01-01" },
    { Date: "2024-02-01" },
  ];
  assertEqual(
    sortData(data, "Date", true).map((r) => r.Date),
    ["2024-01-01", "2024-02-01", "2024-03-01"],
  );
  assertEqual(
    sortData(data, "Date", false).map((r) => r.Date),
    ["2024-03-01", "2024-02-01", "2024-01-01"],
  );
});

test(SUITE, "sortData puts unparseable dates last when ascending", () => {
  const data = [{ Date: "garbage" }, { Date: "2024-01-01" }];
  const sorted = sortData(data, "Date", true);
  assertEqual(sorted[0].Date, "2024-01-01");
  assertEqual(sorted[1].Date, "garbage");
});

test(SUITE, "sortData Net sorts by income minus expense", () => {
  const data = [
    { Description: "a", Income: 10, Expense: 0 },
    { Description: "b", Income: 0, Expense: 50 },
    { Description: "c", Income: 30, Expense: 5 },
  ];
  assertEqual(
    sortData(data, "Net", true).map((r) => r.Description),
    ["b", "a", "c"],
  );
});

test(SUITE, "sortData Income ranks positives first, then by expense", () => {
  const a = { Description: "A", Income: 100, Expense: 0 };
  const b = { Description: "B", Income: 50, Expense: 0 };
  const c = { Description: "C", Income: 0, Expense: 20 };
  const d = { Description: "D", Income: 0, Expense: 5 };
  assertEqual(
    sortData([a, b, c, d], "Income", true).map((r) => r.Description),
    ["B", "A", "D", "C"],
  );
});

test(SUITE, "sortData sorts plain text fields", () => {
  const data = [{ Description: "zebra" }, { Description: "apple" }];
  assertEqual(
    sortData(data, "Description", true).map((r) => r.Description),
    ["apple", "zebra"],
  );
});

const MERGE = "Split merging";

test(MERGE, "mergeSplits with no expenses returns empty list", () => {
  assertEqual(TransactionService.mergeSplits([], [{ x: 1 }]), []);
  assertEqual(TransactionService.mergeSplits(null, null), []);
});

test(MERGE, "mergeSplits with no history returns a fresh copy", () => {
  const raw = [{ Date: "2024-01-01", Description: "a" }];
  const result = TransactionService.mergeSplits(raw, []);
  assert(result !== raw, "must be a new array");
  assertEqual(result, raw);
});

test(MERGE, "mergeSplits replaces SOURCE rows with their children", () => {
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
  assert(!descriptions.includes("Split me"), "source row must be removed");
  assert(
    descriptions.includes("Part 1") && descriptions.includes("Part 2"),
    "child rows must be injected",
  );
  assertEqual(result.length, 3);
});

test(MERGE, "mergeSplits keeps a SOURCE row that has no children", () => {
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
  assertEqual(result.length, 1);
  assertEqual(result[0].Description, "Orphan source");
});

test(MERGE, "mergeSplits injects each group's children only once", () => {
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
  assertEqual(result.length, 1);
  assertEqual(result[0].Description, "Child");
});

test(MERGE, "mergeSplits sorts the merged list by date descending", () => {
  const raw = [
    { Date: "2024-01-01", Description: "old" },
    { Date: "2024-03-01", Description: "new" },
    { Date: "2024-02-01", Description: "mid" },
  ];
  const result = TransactionService.mergeSplits(raw, [{ ignored: true }]);
  assertEqual(
    result.map((r) => r.Description),
    ["new", "mid", "old"],
  );
});
