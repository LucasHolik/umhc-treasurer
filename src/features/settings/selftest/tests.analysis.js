// src/features/settings/selftest/tests.analysis.js
//
// analysis.logic.js exports a singleton instance. All tests use fixed
// date windows and real arrays, so nothing here touches the store.

import { test, assert, assertEqual, assertClose } from "./selftest.runner.js";
import analysis from "../../analysis/analysis.logic.js";
import { calculateFinancials } from "../../../core/financial.logic.js";
import { formatDateForInput } from "../../../core/utils.js";

const SUITE = "Analysis logic";

test(SUITE, "calculateDateRange returns null for custom", () => {
  assertEqual(analysis.calculateDateRange("custom", []), null);
});

test(
  SUITE,
  "calculateDateRange all_time starts at the earliest transaction",
  () => {
    const range = analysis.calculateDateRange("all_time", [
      { Date: "2024-01-01" },
      { Date: "2023-05-10" },
    ]);
    assertEqual(formatDateForInput(range.start), "2023-05-10");
  },
);

test(
  SUITE,
  "calculateDateRange all_time with no data falls back to 2000",
  () => {
    const range = analysis.calculateDateRange("all_time", []);
    assertEqual(formatDateForInput(range.start), "2000-01-01");
  },
);

test(SUITE, "isTransactionInTripStatus truth table", () => {
  const map = { Snowdon: "Active" };
  assert(
    analysis.isTransactionInTripStatus({ "Trip/Event": "Snowdon" }, map, "All"),
  );
  assert(analysis.isTransactionInTripStatus({}, map, ""));
  assert(
    analysis.isTransactionInTripStatus(
      { "Trip/Event": "Snowdon" },
      map,
      "Active",
    ),
  );
  assert(
    !analysis.isTransactionInTripStatus(
      { "Trip/Event": "Snowdon" },
      map,
      "Completed",
    ),
  );
  assert(
    !analysis.isTransactionInTripStatus({}, map, "Active"),
    "no trip name fails specific filters",
  );
  assert(
    !analysis.isTransactionInTripStatus(
      { "Trip/Event": "Unknown" },
      map,
      "Active",
    ),
    "unmapped trip fails specific filters",
  );
});

const emptyFilter = () => ({
  startDate: "2024-03-01",
  endDate: "2024-03-31",
  selectedCategories: new Set(),
  selectedTrips: new Set(),
  tripStatusFilter: "All",
});

test(SUITE, "getFilteredData includes both boundary days", () => {
  const expenses = [
    { Date: "2024-03-01" },
    { Date: "2024-03-31" },
    { Date: "2024-04-01" },
    { Date: "2024-02-29" },
  ];
  const result = analysis.getFilteredData(expenses, emptyFilter(), {});
  assertEqual(
    result.map((r) => r.Date),
    ["2024-03-01", "2024-03-31"],
  );
});

test(SUITE, "getFilteredData applies category, trip and status filters", () => {
  const expenses = [
    { Date: "2024-03-05", Category: "A", "Trip/Event": "T1" },
    { Date: "2024-03-06", Category: "B", "Trip/Event": "T2" },
  ];
  const byCategory = analysis.getFilteredData(
    expenses,
    { ...emptyFilter(), selectedCategories: new Set(["A"]) },
    {},
  );
  assertEqual(byCategory.length, 1);
  assertEqual(byCategory[0].Category, "A");

  const byStatus = analysis.getFilteredData(
    expenses,
    {
      ...emptyFilter(),
      tripStatusFilter: "Active",
    },
    { T1: "Active" },
  );
  assertEqual(byStatus.length, 1);
  assertEqual(byStatus[0]["Trip/Event"], "T1");
});

test(SUITE, "getFilteredData returns empty list for an invalid window", () => {
  assertEqual(
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
});

test(SUITE, "aggregateData fills empty days across the window", () => {
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
  assertEqual(labels, ["2024-03-01", "2024-03-02", "2024-03-03"]);
  assertEqual(datasets[0].data, [10, 0, 5]);
});

test(SUITE, "aggregateData skipEmptyPeriods drops gap labels", () => {
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
  assertEqual(labels, ["2024-03-01", "2024-03-03"]);
});

test(SUITE, "aggregateData groups by month and computes net", () => {
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
  assertEqual(labels, ["2024-01", "2024-02", "2024-03"]);
  assertEqual(datasets[0].data, [-15, 0, 40]);
});

test(SUITE, "aggregateData week grouping aligns to Monday", () => {
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
  assertEqual(labels, ["2024-03-04"]);
});

test(
  SUITE,
  "aggregateData cumulative balance ends at the current balance",
  () => {
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
    assertEqual(labels, ["2024-01", "2024-02"]);
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
  },
);

test(SUITE, "aggregateData secondary grouping builds stacked datasets", () => {
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
  assertEqual(labels, ["2024-01", "2024-02"]);
  assertEqual(
    datasets.map((d) => d.label),
    ["Food", "Transport"],
  );
  assertEqual(datasets[0].data, [-5, 0]);
  assertEqual(datasets[1].data, [10, 20]);
  assertEqual(datasets[0].stack, "stack1");
});

test(SUITE, "aggregateData prunes zero-value tags for non-date groups", () => {
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
  assertEqual(labels, ["HasExpense"]);
  assertEqual(datasets[0].data, [30]);
});

test(
  SUITE,
  "buildTripTypeOrderedKeys expands types and appends Unassigned",
  () => {
    const ordered = analysis.buildTripTypeOrderedKeys(
      { "Day Walk": 1, Alps: 1, Chamonix: 1, Unassigned: 1 },
      ["Expedition", "Day Walk"],
      { Alps: "Expedition", Chamonix: "Expedition", Snowdon: "Day Walk" },
      new Set(["Expedition"]),
      ["Chamonix", "Alps", "Snowdon"],
    );
    assertEqual(ordered, ["Alps", "Chamonix", "Day Walk", "Unassigned"]);
  },
);

test(SUITE, "calculateSummaryStats totals the filtered data", () => {
  const stats = analysis.calculateSummaryStats([
    { Income: "100.50", Expense: 0 },
    { Income: 0, Expense: 40 },
  ]);
  assertClose(stats.totalIncome, 100.5);
  assertClose(stats.totalExpense, 40);
  assertClose(stats.netChange, 60.5);
  assertEqual(stats.transactionCount, 2);
});

test(SUITE, "calculateEffectiveBalance subtracts active-trip net only", () => {
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

test(SUITE, "getVisibleTrips filters by trip status", () => {
  const trips = ["T1", "T2", "T3"];
  const map = { T1: "Active", T2: "Completed" };
  assertEqual(analysis.getVisibleTrips(trips, map, "Active"), ["T1"]);
  assertEqual(analysis.getVisibleTrips(trips, map, "All"), trips);
});

test(SUITE, "calculateTagFilterState computes type checkbox states", () => {
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
  assertEqual(partial.visibleTrips, ["T1", "T2"]);
  assertEqual(partial.visibleTypes, ["X"]);
  assertEqual(partial.typeStatusMap["X"], "indeterminate");

  const all = analysis.calculateTagFilterState(
    tagsData,
    "Active",
    new Set(["T1", "T2"]),
  );
  assertEqual(all.typeStatusMap["X"], "checked");

  const none = analysis.calculateTagFilterState(tagsData, "Active", new Set());
  assertEqual(none.typeStatusMap["X"], "unchecked");
  assertEqual(none.filteredTagsData["Trip/Event"], ["T1", "T2"]);
});

test(
  SUITE,
  "generateCSV writes headers and rows without secondary group",
  () => {
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
    assertEqual(csv, "Date (month),Income\n2024-01,10");
  },
);

test(SUITE, "generateCSV escapes commas/quotes and adds a Total column", () => {
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
  assertEqual(csv, 'Category,"Cat ""X""",Y,Total\n"A,B",1,2,3');
});

test(SUITE, "getPresetState returns presets and fresh defaults", () => {
  const preset = analysis.getPresetState("monthly_trend");
  assertEqual(preset.timeframe, "past_year");
  assertEqual(preset.metric, "net");
  assertEqual(preset.primaryGroup, "date");
  assertEqual(preset.timeUnit, "month");

  const unknown = analysis.getPresetState("does_not_exist");
  assertEqual(unknown.tripStatusFilter, "All");
  assertEqual(unknown.secondaryGroup, "none");
  assertEqual(unknown.selectedCategories.size, 0);

  const again = analysis.getPresetState("does_not_exist");
  assert(
    unknown.selectedCategories !== again.selectedCategories,
    "each call must return fresh Set instances",
  );
});
