// tests/features/transactions/transactions.suggestions.test.js
//
// Pure logic for AI tag suggestions. Every test uses in-memory fakes or plain
// objects; nothing here touches the network, timers or the store.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TAG_FIELDS,
  missingTagFields,
  filterRowsMissingTags,
  rowAmount,
  selectRowsForSuggestions,
  buildRequestRows,
  splitIntoBatches,
  reconcileSuggestions,
  toPendingChanges,
  filterStillMissing,
  mergeAcceptedIntoPending,
  collectSuggestions,
} from "../../../src/features/transactions/transactions.suggestions.js";

const row = (overrides = {}) => ({
  row: 2,
  Description: "TESCO STORES",
  Income: "",
  Expense: "12.34",
  "Trip/Event": "",
  Category: "",
  ...overrides,
});

const TAGS = {
  "Trip/Event": ["Winter Trip", "Summer Trip"],
  Category: ["Food", "Transport"],
};

const requestRow = (id) => ({
  row: id,
  description: `ROW ${id}`,
  amount: -1,
  missing: ["Trip/Event"],
});

const requestedRows = () => [
  {
    row: 2,
    description: "TESCO",
    amount: -12.34,
    missing: ["Trip/Event", "Category"],
  },
  { row: 3, description: "ALDI", amount: -5, missing: ["Category"] },
];

// Fresh copy for each test, so changing a current row cannot leak between tests.
const currentRows = () =>
  new Map([
    ["2", row({ row: 2, Description: "TESCO" })],
    [
      "3",
      row({
        row: 3,
        Description: "ALDI",
        Expense: "5",
        "Trip/Event": "Winter Trip",
      }),
    ],
  ]);

test("TAG_FIELDS lists the two fillable tag fields in a stable order", () => {
  assert.deepEqual(TAG_FIELDS, ["Trip/Event", "Category"]);
});

test("missingTagFields reports both fields when both tags are blank", () => {
  assert.deepEqual(missingTagFields({ "Trip/Event": "", Category: "" }), [
    "Trip/Event",
    "Category",
  ]);
});

test("missingTagFields reports only the blank field", () => {
  assert.deepEqual(
    missingTagFields({ "Trip/Event": "Winter Trip", Category: "" }),
    ["Category"],
  );
  assert.deepEqual(missingTagFields({ "Trip/Event": "", Category: "Food" }), [
    "Trip/Event",
  ]);
});

test("missingTagFields returns an empty list when both tags are set", () => {
  assert.deepEqual(
    missingTagFields({ "Trip/Event": "Winter Trip", Category: "Food" }),
    [],
  );
});

test("missingTagFields treats whitespace-only values as blank", () => {
  assert.deepEqual(missingTagFields({ "Trip/Event": " \t ", Category: "\n" }), [
    "Trip/Event",
    "Category",
  ]);
});

test("filterRowsMissingTags keeps a row whose tags are both blank", () => {
  const bothMissing = row({ row: 3 });

  assert.deepEqual(filterRowsMissingTags([bothMissing]), [bothMissing]);
});

test("filterRowsMissingTags keeps a row missing only one tag", () => {
  const missingTrip = row({
    row: 3,
    "Trip/Event": "",
    Category: "Food",
  });
  const missingCategory = row({
    row: 4,
    "Trip/Event": "Winter Trip",
    Category: "",
  });

  assert.deepEqual(filterRowsMissingTags([missingTrip, missingCategory]), [
    missingTrip,
    missingCategory,
  ]);
});

test("filterRowsMissingTags drops a row whose tags are both set", () => {
  const tagged = row({
    row: 3,
    "Trip/Event": "Winter Trip",
    Category: "Food",
  });
  const partial = row({ row: 4 });

  assert.deepEqual(filterRowsMissingTags([tagged, partial]), [partial]);
});

test("filterRowsMissingTags treats a whitespace-only tag as missing", () => {
  const spaced = row({ row: 3, "Trip/Event": " \t ", Category: "Food" });

  assert.deepEqual(filterRowsMissingTags([spaced]), [spaced]);
});

test("filterRowsMissingTags returns an empty list for a non-array input", () => {
  for (const input of [null, undefined, {}, "not an array"]) {
    assert.deepEqual(filterRowsMissingTags(input), []);
  }
});

test("filterRowsMissingTags does not mutate its input and returns a new array", () => {
  const rows = [
    row({ row: 3, "Trip/Event": "Winter Trip", Category: "Food" }),
    row({ row: 4, "Trip/Event": "  ", Category: "" }),
    row({ row: 5, "Trip/Event": "Summer Trip", Category: "Transport" }),
  ];
  const before = structuredClone(rows);

  const filtered = filterRowsMissingTags(rows);

  assert.deepEqual(rows, before);
  assert.notEqual(filtered, rows);
  assert.deepEqual(filtered, [rows[1]]);
});

test("selectRowsForSuggestions skips fully tagged rows and counts them", () => {
  const tagged = row({
    row: 3,
    "Trip/Event": "Winter Trip",
    Category: "Food",
  });
  const partial = row({ row: 4 });

  const result = selectRowsForSuggestions([tagged, partial]);

  assert.deepEqual(result.rows, [partial]);
  assert.equal(result.alreadyTagged, 1);
  assert.equal(result.missingDescription, 0);
});

test("selectRowsForSuggestions skips blank descriptions and counts them", () => {
  const blank = row({ row: 3, Description: "   " });
  const partial = row({ row: 4 });

  const result = selectRowsForSuggestions([blank, partial]);

  assert.deepEqual(result.rows, [partial]);
  assert.equal(result.alreadyTagged, 0);
  assert.equal(result.missingDescription, 1);
});

test("selectRowsForSuggestions counts each skip reason separately", () => {
  const result = selectRowsForSuggestions([
    row({ row: 3, "Trip/Event": "Winter Trip", Category: "Food" }),
    row({ row: 4, Description: "" }),
    row({ row: 5 }),
  ]);

  assert.deepEqual(
    result.rows.map((entry) => entry.row),
    [5],
  );
  assert.equal(result.alreadyTagged, 1);
  assert.equal(result.missingDescription, 1);
});

test("selectRowsForSuggestions keeps a split row id unchanged", () => {
  const [selected] = selectRowsForSuggestions([row({ row: "S-2" })]).rows;

  assert.equal(selected.row, "S-2");
  assert.equal(typeof selected.row, "string");
});

test("selectRowsForSuggestions does not mutate its input", () => {
  const rows = [
    row({ row: 3, "Trip/Event": "Winter Trip", Category: "Food" }),
    row({ row: 4, Description: "  " }),
    row({ row: 5 }),
  ];
  const before = structuredClone(rows);

  selectRowsForSuggestions(rows);

  assert.deepEqual(rows, before);
});

test("rowAmount parses a comma string", () => {
  assert.equal(rowAmount({ Income: "1,234.50", Expense: "" }), 1234.5);
});

test("rowAmount returns a negative net for an expense", () => {
  assert.equal(rowAmount({ Income: "", Expense: "12.34" }), -12.34);
});

test("rowAmount returns the income for an income-only row", () => {
  assert.equal(rowAmount({ Income: "50", Expense: "" }), 50);
});

test("buildRequestRows trims the description and carries the date, missing fields and amount", () => {
  const requestRows = buildRequestRows([
    row({
      row: 7,
      Description: "  TESCO STORES  ",
      Date: "2024-01-15",
      Income: "100",
      Expense: "12.5",
      "Trip/Event": "",
      Category: "Food",
    }),
  ]);

  assert.deepEqual(requestRows, [
    {
      row: 7,
      description: "TESCO STORES",
      date: "2024-01-15",
      amount: 87.5,
      missing: ["Trip/Event"],
    },
  ]);
});

test("buildRequestRows passes a YYYY-MM-DD string through unchanged", () => {
  const [requestRow] = buildRequestRows([row({ Date: "2025-12-31" })]);

  assert.equal(requestRow.date, "2025-12-31");
});

test("buildRequestRows formats a Date object in local time without shifting the day", () => {
  const [requestRow] = buildRequestRows([
    row({ Date: new Date(2024, 6, 1, 0, 30) }),
  ]);

  assert.equal(requestRow.date, "2024-07-01");
});

test("buildRequestRows leaves the date empty when it is missing or invalid", () => {
  const requestRows = buildRequestRows([
    row({ row: 2 }),
    row({ row: 3, Date: "" }),
    row({ row: 4, Date: "not a date" }),
    row({ row: 5, Date: null }),
  ]);

  assert.deepEqual(
    requestRows.map((requestRow) => requestRow.date),
    ["", "", "", ""],
  );
});

test("splitIntoBatches splits an exact multiple into equal batches", () => {
  assert.deepEqual(splitIntoBatches([1, 2, 3, 4], 2), [
    [1, 2],
    [3, 4],
  ]);
});

test("splitIntoBatches puts the remainder in a final batch", () => {
  assert.deepEqual(splitIntoBatches([1, 2, 3], 2), [[1, 2], [3]]);
});

test("splitIntoBatches returns no batches for an empty list", () => {
  assert.deepEqual(splitIntoBatches([], 5), []);
});

test("splitIntoBatches falls back to 25 for a missing or invalid size", () => {
  const items = Array.from({ length: 26 }, (_, index) => index);
  const sizes = (size) => splitIntoBatches(items, size).map((b) => b.length);

  assert.deepEqual(sizes(undefined), [25, 1]);
  assert.deepEqual(sizes(0), [25, 1]);
  assert.deepEqual(sizes(-3), [25, 1]);
  assert.deepEqual(sizes(2.5), [25, 1]);
});

test("reconcileSuggestions accepts requested fields that are in the live lists", () => {
  const accepted = reconcileSuggestions(
    [{ row: 2, tripEvent: "Winter Trip", category: "Food" }],
    requestedRows(),
    currentRows(),
    TAGS,
  );

  assert.deepEqual(accepted, [
    { row: 2, tripEvent: "Winter Trip", category: "Food" },
  ]);
});

test("reconcileSuggestions drops a value that is not in the live list", () => {
  const accepted = reconcileSuggestions(
    [{ row: 2, tripEvent: "Made Up Trip", category: "Food" }],
    requestedRows(),
    currentRows(),
    TAGS,
  );

  assert.deepEqual(accepted, [{ row: 2, category: "Food" }]);
});

test("reconcileSuggestions drops a field that was not requested", () => {
  const requested = [
    {
      row: 2,
      description: "TESCO",
      amount: -12.34,
      missing: ["Trip/Event"],
    },
  ];

  const accepted = reconcileSuggestions(
    [{ row: 2, tripEvent: "Winter Trip", category: "Food" }],
    requested,
    currentRows(),
    TAGS,
  );

  assert.deepEqual(accepted, [{ row: 2, tripEvent: "Winter Trip" }]);
});

test("reconcileSuggestions drops a row that was not requested", () => {
  const accepted = reconcileSuggestions(
    [
      { row: 99, tripEvent: "Winter Trip" },
      { row: 2, tripEvent: "Summer Trip" },
    ],
    requestedRows(),
    currentRows(),
    TAGS,
  );

  assert.deepEqual(accepted, [{ row: 2, tripEvent: "Summer Trip" }]);
});

test("reconcileSuggestions drops a row that no longer exists", () => {
  const rows = currentRows();
  rows.delete("2");

  const accepted = reconcileSuggestions(
    [{ row: 2, tripEvent: "Winter Trip" }],
    requestedRows(),
    rows,
    TAGS,
  );

  assert.deepEqual(accepted, []);
});

test("reconcileSuggestions drops a row whose description changed", () => {
  const rows = currentRows();
  rows.get("2").Description = "TESCO EXPRESS";

  const accepted = reconcileSuggestions(
    [{ row: 2, tripEvent: "Winter Trip" }],
    requestedRows(),
    rows,
    TAGS,
  );

  assert.deepEqual(accepted, []);
});

test("reconcileSuggestions drops a row whose amount changed", () => {
  const rows = currentRows();
  rows.get("2").Expense = "13.34";

  const accepted = reconcileSuggestions(
    [{ row: 2, tripEvent: "Winter Trip" }],
    requestedRows(),
    rows,
    TAGS,
  );

  assert.deepEqual(accepted, []);
});

test("reconcileSuggestions keeps the requested field when the other is already tagged", () => {
  const accepted = reconcileSuggestions(
    [{ row: 3, tripEvent: "Summer Trip", category: "Transport" }],
    requestedRows(),
    currentRows(),
    TAGS,
  );

  assert.deepEqual(accepted, [{ row: 3, category: "Transport" }]);
});

test("reconcileSuggestions keeps the first entry when a row appears twice", () => {
  const accepted = reconcileSuggestions(
    [
      { row: 2, tripEvent: "Winter Trip", category: "Food" },
      { row: 2, tripEvent: "Summer Trip", category: "Transport" },
    ],
    requestedRows(),
    currentRows(),
    TAGS,
  );

  assert.deepEqual(accepted, [
    { row: 2, tripEvent: "Winter Trip", category: "Food" },
  ]);
});

test("reconcileSuggestions drops a field that is no longer blank on the current row", () => {
  const rows = currentRows();
  rows.get("2").Category = "Food";

  const accepted = reconcileSuggestions(
    [{ row: 2, tripEvent: "Winter Trip", category: "Transport" }],
    requestedRows(),
    rows,
    TAGS,
  );

  assert.deepEqual(accepted, [{ row: 2, tripEvent: "Winter Trip" }]);
});

test("reconcileSuggestions drops a row whose tags are now both filled", () => {
  const rows = currentRows();
  rows.get("2")["Trip/Event"] = "Winter Trip";
  rows.get("2").Category = "Food";

  const accepted = reconcileSuggestions(
    [{ row: 2, tripEvent: "Summer Trip", category: "Transport" }],
    requestedRows(),
    rows,
    TAGS,
  );

  assert.deepEqual(accepted, []);
});

test("reconcileSuggestions drops a row whose current entry is null", () => {
  const rows = currentRows();
  rows.set("2", null);

  const accepted = reconcileSuggestions(
    [{ row: 2, tripEvent: "Winter Trip" }],
    requestedRows(),
    rows,
    TAGS,
  );

  assert.deepEqual(accepted, []);
});

test("reconcileSuggestions keeps the first requested entry for a duplicate id", () => {
  const requested = [
    {
      row: 2,
      description: "TESCO",
      amount: -12.34,
      missing: ["Trip/Event"],
    },
    {
      row: 2,
      description: "SOMETHING ELSE",
      amount: -99,
      missing: ["Category"],
    },
  ];

  const accepted = reconcileSuggestions(
    [{ row: 2, tripEvent: "Winter Trip", category: "Food" }],
    requested,
    currentRows(),
    TAGS,
  );

  assert.deepEqual(accepted, [{ row: 2, tripEvent: "Winter Trip" }]);
});

test("reconcileSuggestions matches a string reply id to a numeric requested row and keeps the number type", () => {
  const accepted = reconcileSuggestions(
    [{ row: "2", tripEvent: "Winter Trip" }],
    requestedRows(),
    currentRows(),
    TAGS,
  );

  assert.deepEqual(accepted, [{ row: 2, tripEvent: "Winter Trip" }]);
  assert.equal(typeof accepted[0].row, "number");
});

test("reconcileSuggestions returns an empty list for a non-array reply", () => {
  for (const reply of [null, undefined, {}, "not an array"]) {
    assert.deepEqual(
      reconcileSuggestions(reply, requestedRows(), currentRows(), TAGS),
      [],
    );
  }
});

test("reconcileSuggestions treats missing tag lists as empty", () => {
  assert.deepEqual(
    reconcileSuggestions(
      [{ row: 2, tripEvent: "Winter Trip", category: "Food" }],
      requestedRows(),
      currentRows(),
      {},
    ),
    [],
  );
  assert.deepEqual(
    reconcileSuggestions(
      [{ row: 2, tripEvent: "Winter Trip", category: "Food" }],
      requestedRows(),
      currentRows(),
      undefined,
    ),
    [],
  );
});

test("reconcileSuggestions returns the request row's original id type", () => {
  const requested = [
    {
      row: "S-2",
      description: "REFUND",
      amount: 10,
      missing: ["Trip/Event"],
    },
  ];
  const rows = new Map([
    [
      "S-2",
      row({
        row: "S-2",
        Description: "REFUND",
        Income: "10",
        Expense: "",
      }),
    ],
  ]);

  const accepted = reconcileSuggestions(
    [{ row: "S-2", tripEvent: "Winter Trip" }],
    requested,
    rows,
    TAGS,
  );

  assert.deepEqual(accepted, [{ row: "S-2", tripEvent: "Winter Trip" }]);
  assert.equal(typeof accepted[0].row, "string");
});

test("reconcileSuggestions does not mutate its inputs", () => {
  const suggestions = [
    { row: 2, tripEvent: " Winter Trip ", category: "Food" },
  ];
  const requested = requestedRows();
  const rows = currentRows();
  const tags = structuredClone(TAGS);
  const before = {
    suggestions: structuredClone(suggestions),
    requested: structuredClone(requested),
    rows: structuredClone(rows),
    tags: structuredClone(tags),
  };

  const accepted = reconcileSuggestions(suggestions, requested, rows, tags);

  assert.ok(accepted.length > 0);
  assert.deepEqual(suggestions, before.suggestions);
  assert.deepEqual(requested, before.requested);
  assert.deepEqual(rows, before.rows);
  assert.deepEqual(tags, before.tags);
});

test("toPendingChanges keys changes by the string row id", () => {
  const changes = toPendingChanges([
    { row: 2, tripEvent: "Winter Trip", category: "Food" },
    { row: "S-2", tripEvent: "Summer Trip" },
  ]);

  assert.ok(changes instanceof Map);
  assert.deepEqual([...changes.keys()], ["2", "S-2"]);
  assert.deepEqual(changes.get("2"), {
    "Trip/Event": "Winter Trip",
    Category: "Food",
  });
  assert.deepEqual(changes.get("S-2"), { "Trip/Event": "Summer Trip" });
});

test("toPendingChanges carries only the fields present", () => {
  const changes = toPendingChanges([{ row: 2, category: "Food" }]);

  assert.deepEqual(changes.get("2"), { Category: "Food" });
  assert.equal("Trip/Event" in changes.get("2"), false);
});

test("toPendingChanges does not mutate its input", () => {
  const accepted = [{ row: 2, tripEvent: "Winter Trip", category: "Food" }];
  const before = structuredClone(accepted);

  toPendingChanges(accepted);

  assert.deepEqual(accepted, before);
});

test("filterStillMissing drops a field that gained a tag while the dialog was open", () => {
  const rows = new Map([
    ["2", row({ row: 2, "Trip/Event": "Winter Trip", Category: "" })],
  ]);

  const kept = filterStillMissing(
    [{ row: 2, tripEvent: "Summer Trip", category: "Food" }],
    rows,
  );

  assert.deepEqual(kept, [{ row: 2, category: "Food" }]);
});

test("filterStillMissing drops a row whose tags are now both filled", () => {
  const rows = new Map([
    ["2", row({ row: 2, "Trip/Event": "Winter Trip", Category: "Food" })],
  ]);

  const kept = filterStillMissing(
    [{ row: 2, tripEvent: "Summer Trip", category: "Transport" }],
    rows,
  );

  assert.deepEqual(kept, []);
});

test("filterStillMissing drops a proposal whose row no longer exists", () => {
  const kept = filterStillMissing(
    [{ row: 2, tripEvent: "Winter Trip" }],
    new Map(),
  );

  assert.deepEqual(kept, []);
});

test("filterStillMissing drops a proposal whose current row is null", () => {
  const rows = new Map([["2", null]]);

  const kept = filterStillMissing([{ row: 2, tripEvent: "Winter Trip" }], rows);

  assert.deepEqual(kept, []);
});

test("filterStillMissing keeps the proposal's original row id type", () => {
  const rows = new Map([
    [
      "S-2",
      row({
        row: "S-2",
        Description: "REFUND",
        Income: "10",
        Expense: "",
        "Trip/Event": "",
        Category: "Food",
      }),
    ],
  ]);

  const kept = filterStillMissing(
    [{ row: "S-2", tripEvent: "Winter Trip", category: "Transport" }],
    rows,
  );

  assert.deepEqual(kept, [{ row: "S-2", tripEvent: "Winter Trip" }]);
  assert.equal(typeof kept[0].row, "string");
});

test("filterStillMissing preserves the input order", () => {
  const rows = new Map([
    ["3", row({ row: 3 })],
    ["2", row({ row: 2 })],
  ]);

  const kept = filterStillMissing(
    [
      { row: 2, category: "Food" },
      { row: 3, tripEvent: "Winter Trip" },
    ],
    rows,
  );

  assert.deepEqual(kept, [
    { row: 2, category: "Food" },
    { row: 3, tripEvent: "Winter Trip" },
  ]);
});

test("filterStillMissing treats a whitespace-only current tag as missing", () => {
  const rows = new Map([
    ["2", row({ row: 2, "Trip/Event": "  ", Category: "" })],
  ]);

  const kept = filterStillMissing(
    [{ row: 2, tripEvent: "Winter Trip", category: "Food" }],
    rows,
  );

  assert.deepEqual(kept, [
    { row: 2, tripEvent: "Winter Trip", category: "Food" },
  ]);
});

test("filterStillMissing does not mutate its inputs", () => {
  const accepted = [
    { row: 2, tripEvent: "Winter Trip", category: "Food" },
    { row: 3, category: "Transport" },
  ];
  const rows = new Map([
    ["2", row({ row: 2 })],
    ["3", row({ row: 3, "Trip/Event": "Winter Trip" })],
  ]);
  const before = {
    accepted: structuredClone(accepted),
    rows: structuredClone(rows),
  };

  const kept = filterStillMissing(accepted, rows);

  assert.ok(kept.length > 0);
  assert.deepEqual(accepted, before.accepted);
  assert.deepEqual(rows, before.rows);
});

test("filterStillMissing returns an empty list for a non-array input", () => {
  for (const accepted of [null, undefined, {}, "not an array"]) {
    assert.deepEqual(filterStillMissing(accepted, new Map()), []);
  }
});

test("filterStillMissing with request rows drops a changed description", () => {
  const rows = new Map([["2", row({ row: 2, Description: "TESCO NEW" })]]);

  const kept = filterStillMissing(
    [{ row: 2, tripEvent: "Winter Trip" }],
    rows,
    [
      {
        row: 2,
        description: "TESCO",
        amount: -12.34,
        missing: ["Trip/Event"],
      },
    ],
  );

  assert.deepEqual(kept, []);
});

test("filterStillMissing with request rows drops a changed amount", () => {
  const rows = new Map([
    ["2", row({ row: 2, Description: "TESCO", Expense: "99" })],
  ]);

  const kept = filterStillMissing(
    [{ row: 2, tripEvent: "Winter Trip" }],
    rows,
    [
      {
        row: 2,
        description: "TESCO",
        amount: -12.34,
        missing: ["Trip/Event"],
      },
    ],
  );

  assert.deepEqual(kept, []);
});

test("filterStillMissing with request rows keeps an unchanged row", () => {
  const kept = filterStillMissing(
    [
      { row: 2, tripEvent: "Winter Trip" },
      { row: 3, category: "Transport" },
    ],
    currentRows(),
    requestedRows(),
  );

  assert.deepEqual(kept, [
    { row: 2, tripEvent: "Winter Trip" },
    { row: 3, category: "Transport" },
  ]);
});

test("filterStillMissing without request rows keeps the blankness-only behaviour", () => {
  const rows = new Map([["2", row({ row: 2, Description: "TESCO NEW" })]]);

  const kept = filterStillMissing([{ row: 2, tripEvent: "Winter Trip" }], rows);

  assert.deepEqual(kept, [{ row: 2, tripEvent: "Winter Trip" }]);
});

test("filterStillMissing with request rows drops a missing request entry", () => {
  const kept = filterStillMissing(
    [{ row: 2, tripEvent: "Winter Trip" }],
    currentRows(),
    [],
  );

  assert.deepEqual(kept, []);
});

test("mergeAcceptedIntoPending keeps an existing pending field", () => {
  const pending = new Map([["2", { "Trip/Event": "Manual Trip" }]]);

  const merged = mergeAcceptedIntoPending(pending, [
    { row: 2, tripEvent: "Winter Trip", category: "Food" },
  ]);

  assert.equal(merged.get("2")["Trip/Event"], "Manual Trip");
});

test("mergeAcceptedIntoPending keeps a pending empty string", () => {
  const merged = mergeAcceptedIntoPending(
    new Map([["2", { "Trip/Event": "" }]]),
    [{ row: 2, tripEvent: "Winter Trip", category: "Food" }],
  );

  assert.equal(merged.get("2")["Trip/Event"], "");
  assert.ok(
    Object.prototype.hasOwnProperty.call(merged.get("2"), "Trip/Event"),
  );
  assert.equal(merged.get("2").Category, "Food");

  const mergedCategory = mergeAcceptedIntoPending(
    new Map([["3", { Category: "" }]]),
    [{ row: 3, tripEvent: "Winter Trip", category: "Food" }],
  );

  assert.equal(mergedCategory.get("3").Category, "");
  assert.ok(
    Object.prototype.hasOwnProperty.call(mergedCategory.get("3"), "Category"),
  );
  assert.equal(mergedCategory.get("3")["Trip/Event"], "Winter Trip");
});

test("mergeAcceptedIntoPending adds the missing field and keeps other keys", () => {
  const pending = new Map([
    ["2", { Category: "Manual Category" }],
    ["9", { "Trip/Event": "Other Trip" }],
  ]);

  const merged = mergeAcceptedIntoPending(pending, [
    { row: 2, tripEvent: "Winter Trip", category: "Food" },
  ]);

  assert.deepEqual(merged.get("2"), {
    Category: "Manual Category",
    "Trip/Event": "Winter Trip",
  });
  assert.deepEqual(merged.get("9"), { "Trip/Event": "Other Trip" });
});

test("mergeAcceptedIntoPending creates a new row", () => {
  const merged = mergeAcceptedIntoPending(new Map(), [
    { row: 3, category: "Transport" },
  ]);

  assert.deepEqual(merged.get("3"), { Category: "Transport" });
});

test("mergeAcceptedIntoPending keys rows by string", () => {
  const merged = mergeAcceptedIntoPending(new Map(), [
    { row: 2, tripEvent: "Winter Trip" },
    { row: "S-2", category: "Food" },
  ]);

  assert.deepEqual([...merged.keys()], ["2", "S-2"]);
});

test("mergeAcceptedIntoPending does not mutate its inputs", () => {
  const pending = new Map([
    ["2", { "Trip/Event": "Manual Trip" }],
    ["9", { Category: "Other" }],
  ]);
  const accepted = [
    { row: 2, tripEvent: "Winter Trip", category: "Food" },
    { row: 3, category: "Transport" },
  ];
  const before = {
    pending: structuredClone(pending),
    accepted: structuredClone(accepted),
  };

  const merged = mergeAcceptedIntoPending(pending, accepted);

  assert.deepEqual(pending, before.pending);
  assert.deepEqual(accepted, before.accepted);
  assert.notEqual(merged.get("2"), pending.get("2"));
});

test("collectSuggestions sends batches in order, one at a time", async () => {
  const rows = [1, 2, 3, 4, 5].map(requestRow);
  const seen = [];
  let inFlight = 0;

  const suggest = async (batch) => {
    inFlight++;
    assert.equal(inFlight, 1, "a batch must not overlap another");
    seen.push(batch.map((entry) => entry.row));
    await Promise.resolve();
    inFlight--;
    return { suggestions: [] };
  };

  await collectSuggestions(rows, { suggest, maxRows: 2 });

  assert.deepEqual(seen, [[1, 2], [3, 4], [5]]);
});

test("collectSuggestions reports 0 of N before the first batch and once per batch", async () => {
  const rows = [1, 2, 3, 4].map(requestRow);
  const events = [];

  const suggest = async (batch) => {
    events.push(`batch:${batch[0].row}`);
    return { suggestions: [] };
  };

  await collectSuggestions(rows, {
    suggest,
    maxRows: 2,
    onProgress: (completed, total) =>
      events.push(`progress:${completed}/${total}`),
  });

  assert.deepEqual(events, [
    "progress:0/2",
    "batch:1",
    "progress:1/2",
    "batch:3",
    "progress:2/2",
  ]);
});

test("collectSuggestions still returns the suggestions when onProgress throws", async () => {
  const rows = [1, 2].map(requestRow);
  const suggest = async (batch) => ({
    suggestions: batch.map((entry) => ({
      row: entry.row,
      tripEvent: "Winter Trip",
    })),
  });

  const result = await collectSuggestions(rows, {
    suggest,
    maxRows: 1,
    onProgress: () => {
      throw new Error("progress failed");
    },
  });

  assert.deepEqual(result, {
    suggestions: [
      { row: 1, tripEvent: "Winter Trip" },
      { row: 2, tripEvent: "Winter Trip" },
    ],
    error: null,
  });
});

test("collectSuggestions merges the suggestions from every batch", async () => {
  const rows = [1, 2, 3].map(requestRow);
  const suggest = async (batch) => ({
    suggestions: batch.map((entry) => ({
      row: entry.row,
      tripEvent: "Winter Trip",
    })),
  });

  const result = await collectSuggestions(rows, { suggest, maxRows: 2 });

  assert.deepEqual(result, {
    suggestions: [
      { row: 1, tripEvent: "Winter Trip" },
      { row: 2, tripEvent: "Winter Trip" },
      { row: 3, tripEvent: "Winter Trip" },
    ],
    error: null,
  });
});

test("collectSuggestions ignores a reply whose suggestions is not an array", async () => {
  const rows = [1, 2].map(requestRow);
  const replies = [{ suggestions: "nope" }, { suggestions: [{ row: 2 }] }];
  let index = 0;

  const result = await collectSuggestions(rows, {
    suggest: async () => replies[index++],
    maxRows: 1,
  });

  assert.deepEqual(result, { suggestions: [{ row: 2 }], error: null });
});

test("collectSuggestions keeps earlier suggestions and returns the error when a later batch throws", async () => {
  const rows = [1, 2, 3].map(requestRow);
  const failure = new Error("AI_UNAVAILABLE");
  const calls = [];

  const suggest = async (batch) => {
    calls.push(batch.map((entry) => entry.row));
    if (batch[0].row === 2) throw failure;
    return {
      suggestions: [{ row: batch[0].row, tripEvent: "Winter Trip" }],
    };
  };

  const result = await collectSuggestions(rows, { suggest, maxRows: 1 });

  assert.deepEqual(result.suggestions, [{ row: 1, tripEvent: "Winter Trip" }]);
  assert.equal(result.error, failure);
  assert.deepEqual(calls, [[1], [2]], "the third batch must not be sent");
});

test("collectSuggestions makes no call for an empty list", async () => {
  let calls = 0;

  const result = await collectSuggestions([], {
    suggest: async () => {
      calls++;
      return { suggestions: [] };
    },
  });

  assert.deepEqual(result, { suggestions: [], error: null });
  assert.equal(calls, 0);
});

test("collectSuggestions requires a suggest function", async () => {
  await assert.rejects(collectSuggestions([], {}), {
    name: "TypeError",
    message: /injected suggest function/,
  });
  await assert.rejects(collectSuggestions([], { suggest: "not a function" }), {
    name: "TypeError",
    message: /injected suggest function/,
  });
});
