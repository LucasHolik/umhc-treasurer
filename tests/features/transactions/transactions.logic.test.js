// tests/features/transactions/transactions.logic.test.js

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  filterData,
  sortData,
  buildTagSelectorOptions,
  buildTripSelectorOptions,
} from "../../../src/features/transactions/transactions.logic.js";

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

test("filterData matches description case-insensitively", () => {
  const result = filterData(sample(), { descriptionSearch: "bus to" });
  assert.equal(result.length, 1);
  assert.equal(result[0].Description, "Bus to Snowdon");
});

test("filterData filters by category set", () => {
  const result = filterData(sample(), {
    selectedCategories: new Set(["Transport"]),
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].Category, "Transport");
});

test("filterData __NO_TAG__ matches untagged rows", () => {
  const byCat = filterData(sample(), {
    selectedCategories: new Set(["__NO_TAG__"]),
  });
  assert.equal(byCat.length, 1);
  assert.equal(byCat[0].Description, "Membership");

  const byTrip = filterData(sample(), {
    selectedTrips: new Set(["__NO_TAG__", "Snowdon"]),
  });
  assert.equal(byTrip.length, 3);
});

test("filterData combines all filters with AND", () => {
  const result = filterData(sample(), {
    selectedCategories: new Set(["Transport", "Accommodation"]),
    selectedTrips: new Set(["Snowdon"]),
    descriptionSearch: "hut",
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].Description, "Hut fees");
});

test("buildTripSelectorOptions hides past trips behind hints", () => {
  const result = buildTripSelectorOptions({
    "Trip/Event": ["Snowdon", "Scafell", "Kit Fund", "Old Kit", "Ben Nevis"],
    TripStatusMap: {
      Snowdon: "Completed",
      Scafell: "Active",
      "Kit Fund": "Investment",
      "Old Kit": "Completed Investment",
    },
  });
  assert.deepEqual(result.customOptions, ["Scafell", "Kit Fund", "Ben Nevis"]);
  assert.deepEqual(result.pastOptions, [
    { value: "Snowdon", hint: "Completed" },
    { value: "Old Kit", hint: "Completed Investment" },
  ]);
});

test("buildTripSelectorOptions copes with missing tag data", () => {
  assert.deepEqual(buildTripSelectorOptions(undefined), {
    customOptions: [],
    pastOptions: [],
  });
  assert.deepEqual(buildTripSelectorOptions({ "Trip/Event": ["A"] }), {
    customOptions: ["A"],
    pastOptions: [],
  });
});

test("buildTagSelectorOptions leaves Category to the default", () => {
  const tagsData = {
    Category: ["Food"],
    "Trip/Event": ["Snowdon"],
    TripStatusMap: { Snowdon: "Completed" },
  };
  assert.deepEqual(buildTagSelectorOptions("Category", tagsData), {
    customOptions: null,
    pastOptions: [],
  });
  assert.deepEqual(
    buildTagSelectorOptions("Trip/Event", tagsData),
    buildTripSelectorOptions(tagsData),
  );
});

test("filterData with empty filters passes everything", () => {
  assert.equal(
    filterData(sample(), {
      selectedCategories: new Set(),
      selectedTrips: new Set(),
      descriptionSearch: "",
    }).length,
    3,
  );
});

test("sortData returns a new array and keeps input order", () => {
  const data = [{ Date: "2024-02-01" }, { Date: "2024-01-01" }];
  const sorted = sortData(data, "Date", true);
  assert.ok(sorted !== data, "must not return the input array");
  assert.equal(data[0].Date, "2024-02-01", "input order must be untouched");
  assert.equal(sorted[0].Date, "2024-01-01");
});

test("sortData sorts dates ascending and descending", () => {
  const data = [
    { Date: "2024-03-01" },
    { Date: "2024-01-01" },
    { Date: "2024-02-01" },
  ];
  assert.deepEqual(
    sortData(data, "Date", true).map((r) => r.Date),
    ["2024-01-01", "2024-02-01", "2024-03-01"],
  );
  assert.deepEqual(
    sortData(data, "Date", false).map((r) => r.Date),
    ["2024-03-01", "2024-02-01", "2024-01-01"],
  );
});

test("sortData puts unparseable dates last when ascending", () => {
  const data = [{ Date: "garbage" }, { Date: "2024-01-01" }];
  const sorted = sortData(data, "Date", true);
  assert.equal(sorted[0].Date, "2024-01-01");
  assert.equal(sorted[1].Date, "garbage");
});

test("sortData Net sorts by income minus expense", () => {
  const data = [
    { Description: "a", Income: 10, Expense: 0 },
    { Description: "b", Income: 0, Expense: 50 },
    { Description: "c", Income: 30, Expense: 5 },
  ];
  assert.deepEqual(
    sortData(data, "Net", true).map((r) => r.Description),
    ["b", "a", "c"],
  );
});

test("sortData Income ranks positives first, then by expense", () => {
  const a = { Description: "A", Income: 100, Expense: 0 };
  const b = { Description: "B", Income: 50, Expense: 0 };
  const c = { Description: "C", Income: 0, Expense: 20 };
  const d = { Description: "D", Income: 0, Expense: 5 };
  assert.deepEqual(
    sortData([a, b, c, d], "Income", true).map((r) => r.Description),
    ["B", "A", "D", "C"],
  );
});

test("sortData sorts plain text fields", () => {
  const data = [{ Description: "zebra" }, { Description: "apple" }];
  assert.deepEqual(
    sortData(data, "Description", true).map((r) => r.Description),
    ["apple", "zebra"],
  );
});
