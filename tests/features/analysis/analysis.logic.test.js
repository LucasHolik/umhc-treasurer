// tests/features/analysis/analysis.logic.test.js
//
// analysis.logic.js exports a singleton instance. All tests use fixed
// date windows and real arrays, so nothing here touches the store.

import { test } from "node:test";
import assert from "node:assert/strict";
import { assertClose } from "../../helpers/assert.js";
import analysis from "../../../src/features/analysis/analysis.logic.js";
import { calculateFinancials } from "../../../src/core/financial.logic.js";
import { formatDateForInput } from "../../../src/core/utils.js";

test("calculateDateRange returns null for custom", () => {
  assert.deepEqual(analysis.calculateDateRange("custom", []), null);
});

test("calculateDateRange all_time starts at the earliest transaction", () => {
  const range = analysis.calculateDateRange("all_time", [
    { Date: "2024-01-01" },
    { Date: "2023-05-10" },
  ]);
  assert.deepEqual(formatDateForInput(range.start), "2023-05-10");
});

test("calculateDateRange all_time with no data falls back to 2000", () => {
  const range = analysis.calculateDateRange("all_time", []);
  assert.deepEqual(formatDateForInput(range.start), "2000-01-01");
});

test("isTransactionInTripStatus truth table", () => {
  const map = { Snowdon: "Active" };
  assert.ok(
    analysis.isTransactionInTripStatus({ "Trip/Event": "Snowdon" }, map, "All"),
  );
  assert.ok(analysis.isTransactionInTripStatus({}, map, ""));
  assert.ok(
    analysis.isTransactionInTripStatus(
      { "Trip/Event": "Snowdon" },
      map,
      "Active",
    ),
  );
  assert.ok(
    !analysis.isTransactionInTripStatus(
      { "Trip/Event": "Snowdon" },
      map,
      "Completed",
    ),
  );
  assert.ok(
    !analysis.isTransactionInTripStatus({}, map, "Active"),
    "no trip name fails specific filters",
  );
  assert.ok(
    !analysis.isTransactionInTripStatus(
      { "Trip/Event": "Unknown" },
      map,
      "Active",
    ),
    "unmapped trip fails specific filters",
  );
});

test("isTransactionInTripStatus handles Completed Investment", () => {
  const map = { "Kit Fund": "Investment", "Old Kit": "Completed Investment" };
  assert.ok(
    analysis.isTransactionInTripStatus(
      { "Trip/Event": "Old Kit" },
      map,
      "Completed Investment",
    ),
  );
  assert.ok(
    !analysis.isTransactionInTripStatus(
      { "Trip/Event": "Old Kit" },
      map,
      "Investment",
    ),
    "Investment does not match Completed Investment",
  );
  assert.ok(
    !analysis.isTransactionInTripStatus(
      { "Trip/Event": "Kit Fund" },
      map,
      "Completed Investment",
    ),
  );
});

const emptyFilter = () => ({
  startDate: "2024-03-01",
  endDate: "2024-03-31",
  selectedCategories: new Set(),
  selectedTrips: new Set(),
  tripStatusFilter: "All",
});

test("getFilteredData includes both boundary days", () => {
  const expenses = [
    { Date: "2024-03-01" },
    { Date: "2024-03-31" },
    { Date: "2024-04-01" },
    { Date: "2024-02-29" },
  ];
  const result = analysis.getFilteredData(expenses, emptyFilter(), {});
  assert.deepEqual(
    result.map((r) => r.Date),
    ["2024-03-01", "2024-03-31"],
  );
});

test("getFilteredData applies category, trip and status filters", () => {
  const expenses = [
    { Date: "2024-03-05", Category: "A", "Trip/Event": "T1" },
    { Date: "2024-03-06", Category: "B", "Trip/Event": "T2" },
  ];
  const byCategory = analysis.getFilteredData(
    expenses,
    { ...emptyFilter(), selectedCategories: new Set(["A"]) },
    {},
  );
  assert.deepEqual(byCategory.length, 1);
  assert.deepEqual(byCategory[0].Category, "A");

  const byStatus = analysis.getFilteredData(
    expenses,
    {
      ...emptyFilter(),
      tripStatusFilter: "Active",
    },
    { T1: "Active" },
  );
  assert.deepEqual(byStatus.length, 1);
  assert.deepEqual(byStatus[0]["Trip/Event"], "T1");
});

test("getFilteredData returns empty list for an invalid window", (t) => {
  const consoleWarn = t.mock.method(console, "warn", () => {});
  assert.deepEqual(
    analysis.getFilteredData(
      [{ Date: "2024-03-05" }],
      {
        ...emptyFilter(),
        startDate: "garbage",
      },
      {},
    ),
    [],
  );
  assert.equal(consoleWarn.mock.callCount(), 1);
});

test("aggregateData fills empty days across the window", () => {
  const { labels, datasets } = analysis.aggregateData(
    [
      { Date: "2024-03-01", Income: 10, Expense: 0 },
      { Date: "2024-03-03", Income: 5, Expense: 0 },
    ],
    {
      primaryGroup: "date",
      secondaryGroup: "none",
      metric: "income",
      timeUnit: "day",
      startDate: "2024-03-01",
      endDate: "2024-03-03",
      skipEmptyPeriods: false,
    },
  );
  assert.deepEqual(labels, ["2024-03-01", "2024-03-02", "2024-03-03"]);
  assert.deepEqual(datasets[0].data, [10, 0, 5]);
});

test("aggregateData skipEmptyPeriods drops gap labels", () => {
  const { labels } = analysis.aggregateData(
    [
      { Date: "2024-03-01", Income: 10, Expense: 0 },
      { Date: "2024-03-03", Income: 5, Expense: 0 },
    ],
    {
      primaryGroup: "date",
      secondaryGroup: "none",
      metric: "income",
      timeUnit: "day",
      startDate: "2024-03-01",
      endDate: "2024-03-03",
      skipEmptyPeriods: true,
    },
  );
  assert.deepEqual(labels, ["2024-03-01", "2024-03-03"]);
});

test("aggregateData groups by month and computes net", () => {
  const { labels, datasets } = analysis.aggregateData(
    [
      { Date: "2024-01-15", Income: 10, Expense: 25 },
      { Date: "2024-03-10", Income: 40, Expense: 0 },
    ],
    {
      primaryGroup: "date",
      secondaryGroup: "none",
      metric: "net",
      timeUnit: "month",
      startDate: "2024-01-01",
      endDate: "2024-03-31",
      skipEmptyPeriods: false,
    },
  );
  assert.deepEqual(labels, ["2024-01", "2024-02", "2024-03"]);
  assert.deepEqual(datasets[0].data, [-15, 0, 40]);
});

test("aggregateData week grouping aligns to Monday", () => {
  // 2024-03-06 was a Wednesday; its week starts Monday 2024-03-04.
  const { labels } = analysis.aggregateData(
    [{ Date: "2024-03-06", Income: 1, Expense: 0 }],
    {
      primaryGroup: "date",
      secondaryGroup: "none",
      metric: "income",
      timeUnit: "week",
      startDate: "2024-03-04",
      endDate: "2024-03-10",
      skipEmptyPeriods: true,
    },
  );
  assert.deepEqual(labels, ["2024-03-04"]);
});

test("aggregateData cumulative balance ends at the current balance", () => {
  const openingBalance = 100;
  const allExpenses = [
    { Date: "2023-12-15", Income: 20, Expense: 0 },
    { Date: "2024-01-10", Income: 50, Expense: 0 },
    { Date: "2024-01-20", Income: 0, Expense: 10, Type: "Manual" },
    { Date: "2024-02-05", Income: 0, Expense: 30 },
  ];
  const windowData = allExpenses.filter((t) => t.Date >= "2024-01-01");
  const { labels, datasets } = analysis.aggregateData(
    windowData,
    {
      primaryGroup: "date",
      secondaryGroup: "none",
      metric: "balance",
      timeUnit: "month",
      startDate: "2024-01-01",
      endDate: "2024-02-28",
      skipEmptyPeriods: true,
    },
    allExpenses,
    openingBalance,
  );
  assert.deepEqual(labels, ["2024-01", "2024-02"]);
  const finalBalance = datasets[0].data[datasets[0].data.length - 1];
  const expected = calculateFinancials(
    openingBalance,
    allExpenses,
  ).currentBalance;
  assertClose(
    finalBalance,
    expected,
    1e-9,
    "cumulative curve must land on the reconciled balance",
  );
});

test("aggregateData secondary grouping builds stacked datasets", () => {
  const { labels, datasets } = analysis.aggregateData(
    [
      { Date: "2024-01-05", Category: "Transport", Income: 10, Expense: 0 },
      { Date: "2024-01-06", Category: "Food", Income: 0, Expense: 5 },
      { Date: "2024-02-05", Category: "Transport", Income: 20, Expense: 0 },
    ],
    {
      primaryGroup: "date",
      secondaryGroup: "category",
      metric: "net",
      timeUnit: "month",
      startDate: "2024-01-01",
      endDate: "2024-02-28",
      skipEmptyPeriods: true,
    },
  );
  assert.deepEqual(labels, ["2024-01", "2024-02"]);
  assert.deepEqual(
    datasets.map((d) => d.label),
    ["Food", "Transport"],
  );
  assert.deepEqual(datasets[0].data, [-5, 0]);
  assert.deepEqual(datasets[1].data, [10, 20]);
  assert.deepEqual(datasets[0].stack, "stack1");
});

test("aggregateData prunes zero-value tags for non-date groups", () => {
  const { labels, datasets } = analysis.aggregateData(
    [
      { Date: "2024-01-05", Category: "OnlyIncome", Income: 100, Expense: 0 },
      { Date: "2024-01-06", Category: "HasExpense", Income: 0, Expense: 30 },
    ],
    {
      primaryGroup: "category",
      secondaryGroup: "none",
      metric: "expense",
      timeUnit: "month",
      startDate: "2024-01-01",
      endDate: "2024-01-31",
      skipEmptyPeriods: true,
    },
  );
  assert.deepEqual(labels, ["HasExpense"]);
  assert.deepEqual(datasets[0].data, [30]);
});

test("buildTripTypeOrderedKeys expands types and appends Unassigned", () => {
  const ordered = analysis.buildTripTypeOrderedKeys(
    { "Day Walk": 1, Alps: 1, Chamonix: 1, Unassigned: 1 },
    ["Expedition", "Day Walk"],
    { Alps: "Expedition", Chamonix: "Expedition", Snowdon: "Day Walk" },
    new Set(["Expedition"]),
    ["Chamonix", "Alps", "Snowdon"],
  );
  assert.deepEqual(ordered, ["Alps", "Chamonix", "Day Walk", "Unassigned"]);
});

test("calculateSummaryStats totals the filtered data", () => {
  const stats = analysis.calculateSummaryStats([
    { Income: "100.50", Expense: 0 },
    { Income: 0, Expense: 40 },
  ]);
  assertClose(stats.totalIncome, 100.5);
  assertClose(stats.totalExpense, 40);
  assertClose(stats.netChange, 60.5);
  assert.deepEqual(stats.transactionCount, 2);
});

test("calculateEffectiveBalance subtracts active-trip net only", () => {
  const expenses = [
    { "Trip/Event": "T1", Income: 200, Expense: 50 },
    { "Trip/Event": "T2", Income: 500, Expense: 0 },
    { Income: 100, Expense: 0 },
  ];
  const result = analysis.calculateEffectiveBalance(1000, expenses, {
    T1: "Active",
    T2: "Completed",
  });
  assertClose(result, 850, 1e-9, "only T1's net (150) should be subtracted");
});

test("getVisibleTrips filters by trip status", () => {
  const trips = ["T1", "T2", "T3"];
  const map = { T1: "Active", T2: "Completed" };
  assert.deepEqual(analysis.getVisibleTrips(trips, map, "Active"), ["T1"]);
  assert.deepEqual(analysis.getVisibleTrips(trips, map, "All"), trips);
});

test("getVisibleTrips separates the two investment statuses", () => {
  const trips = ["T1", "T2", "T3"];
  const map = {
    T1: "Investment",
    T2: "Completed Investment",
    T3: "Completed",
  };
  assert.deepEqual(analysis.getVisibleTrips(trips, map, "Investment"), ["T1"]);
  assert.deepEqual(
    analysis.getVisibleTrips(trips, map, "Completed Investment"),
    ["T2"],
  );
  assert.deepEqual(analysis.getVisibleTrips(trips, map, "Completed"), ["T3"]);
});

test("calculateTagFilterState computes type checkbox states", () => {
  const tagsData = {
    "Trip/Event": ["T1", "T2", "T3"],
    Type: ["X", "Y"],
    TripTypeMap: { T1: "X", T2: "X", T3: "Y" },
    TripStatusMap: { T1: "Active", T2: "Active", T3: "Completed" },
  };
  const partial = analysis.calculateTagFilterState(
    tagsData,
    "Active",
    new Set(["T1"]),
  );
  assert.deepEqual(partial.visibleTrips, ["T1", "T2"]);
  assert.deepEqual(partial.visibleTypes, ["X"]);
  assert.deepEqual(partial.typeStatusMap["X"], "indeterminate");

  const all = analysis.calculateTagFilterState(
    tagsData,
    "Active",
    new Set(["T1", "T2"]),
  );
  assert.deepEqual(all.typeStatusMap["X"], "checked");

  const none = analysis.calculateTagFilterState(tagsData, "Active", new Set());
  assert.deepEqual(none.typeStatusMap["X"], "unchecked");
  assert.deepEqual(none.filteredTagsData["Trip/Event"], ["T1", "T2"]);
});

test("generateCSV writes headers and rows without secondary group", () => {
  const csv = analysis.generateCSV(
    ["2024-01"],
    [{ label: "INCOME", data: [10] }],
    {
      primaryGroup: "date",
      secondaryGroup: "none",
      metric: "income",
      timeUnit: "month",
    },
  );
  assert.deepEqual(csv, "Date (month),Income\n2024-01,10");
});

test("generateCSV escapes commas/quotes and adds a Total column", () => {
  const csv = analysis.generateCSV(
    ["A,B"],
    [
      { label: 'Cat "X"', data: [1] },
      { label: "Y", data: [2] },
    ],
    {
      primaryGroup: "category",
      secondaryGroup: "trip",
      metric: "net",
      timeUnit: "month",
    },
  );
  assert.deepEqual(csv, 'Category,"Cat ""X""",Y,Total\n"A,B",1,2,3');
});

test("getPresetState returns presets and fresh defaults", () => {
  const preset = analysis.getPresetState("monthly_trend");
  assert.deepEqual(preset.timeframe, "past_year");
  assert.deepEqual(preset.metric, "net");
  assert.deepEqual(preset.primaryGroup, "date");
  assert.deepEqual(preset.timeUnit, "month");

  const unknown = analysis.getPresetState("does_not_exist");
  assert.deepEqual(unknown.tripStatusFilter, "All");
  assert.deepEqual(unknown.secondaryGroup, "none");
  assert.deepEqual(unknown.selectedCategories.size, 0);

  const again = analysis.getPresetState("does_not_exist");
  assert.ok(
    unknown.selectedCategories !== again.selectedCategories,
    "each call must return fresh Set instances",
  );
});
