// tests/backend/split.test.js
//
// Pins the split lifecycle: create, revert and edit, plus the PENDING staging
// that keeps a half-written group out of history. The tests assert the sheet
// writes, not only the returned objects, because the risk in this path is
// half-written state: a Finance row stamped with a group ID whose rows never
// arrived, or orphan rows that no Finance row points at.

import { test } from "node:test";
import assert from "node:assert/strict";

import { createBackend } from "./harness.js";

const NOW = 1_700_000_000_000;
const MINUTE = 60 * 1000;

const FINANCE_HEADERS = [
  "Document",
  "Time-uploaded",
  "Date",
  "Description",
  "Trip/Event",
  "Category",
  "Income",
  "Expense",
  "Type",
  "Split Group ID",
];

const SPLIT_HEADERS = [...FINANCE_HEADERS, "Split Type", "Split Date"];

const TAG_HEADERS = ["Trip/Event", "Type", "Status", "Category", "Type List"];

const TAGS = [
  TAG_HEADERS,
  ["Winter Trip", "Competitive", "Active", "Food", "Competitive"],
  ["Summer Trip", "Social", "Completed", "Transport", "Social"],
];

const FINANCES = [
  FINANCE_HEADERS,
  [
    "D1",
    "",
    "2026-01-01",
    "Lunch",
    "Winter Trip",
    "Food",
    "",
    12.5,
    "Manual",
    "",
  ],
];

// The expense children add up to the parent's 12.5; the promotion write is the
// second Split Transactions setValues in this scenario.
const LUNCH_SPLITS = [
  {
    Description: "Lunch - main",
    Amount: 10,
    Type: "Expense",
    TripEvent: "Winter Trip",
    Category: "Food",
  },
  {
    Description: "Lunch - drink",
    Amount: 2.5,
    Type: "Expense",
    TripEvent: "Winter Trip",
    Category: "Transport",
  },
];

function createTestBackend(t, sheets = {}) {
  const backend = createBackend({
    now: NOW,
    sheets: {
      Tags: TAGS,
      "Split Transactions": [SPLIT_HEADERS],
      ...sheets,
    },
  });
  t.after(() => backend.close());
  return backend;
}

function createSplit(backend, { row = 2, income = "", expense, splits }) {
  return backend.request("splitTransaction", {
    data: { original: { row, Income: income, Expense: expense }, splits },
  });
}

// The Split Date is generated from the clock, so assertions compare every
// column except that one and check its type separately.
function stripSplitDates(rows) {
  return rows.map((row, index) =>
    index === 0 ? row : row.slice(0, SPLIT_HEADERS.length - 1),
  );
}

function total(rows, columnIndex) {
  return rows.reduce((sum, row) => {
    const value = row[columnIndex];
    return sum + (value === "" ? 0 : Number(value));
  }, 0);
}

test("creating a split stamps the Finance row and writes SOURCE plus CHILD rows", (t) => {
  const backend = createTestBackend(t, { Finances: FINANCES });

  const response = createSplit(backend, {
    expense: 12.5,
    splits: LUNCH_SPLITS,
  });

  assert.equal(response.success, true);
  assert.equal(response.message, "Transaction split successfully.");
  const groupId = response.splitGroupId;
  assert.match(groupId, /^[0-9a-f-]{36}$/);

  // The Finances row keeps its amount and gains the group ID in the last
  // column.
  const financeRows = backend.sheets.get("Finances");
  assert.deepEqual(financeRows, [
    FINANCE_HEADERS,
    [
      "D1",
      "",
      "2026-01-01",
      "Lunch",
      "Winter Trip",
      "Food",
      "",
      12.5,
      "Manual",
      groupId,
    ],
  ]);

  // One SOURCE row copies the original transaction; each split adds a CHILD
  // row with its own description and amount.
  const splitRows = backend.sheets.get("Split Transactions");
  assert.deepEqual(stripSplitDates(splitRows), [
    SPLIT_HEADERS,
    [
      "D1",
      "",
      "2026-01-01",
      "Lunch",
      "Winter Trip",
      "Food",
      "",
      12.5,
      "Manual",
      groupId,
      "SOURCE",
    ],
    [
      "D1",
      "",
      "2026-01-01",
      "Lunch - main",
      "Winter Trip",
      "Food",
      "",
      10,
      "Manual",
      groupId,
      "CHILD",
    ],
    [
      "D1",
      "",
      "2026-01-01",
      "Lunch - drink",
      "Winter Trip",
      "Transport",
      "",
      2.5,
      "Manual",
      groupId,
      "CHILD",
    ],
  ]);
  assert.ok(
    splitRows
      .slice(1)
      .every((row) => row[SPLIT_HEADERS.length - 1] instanceof Date),
    "every split row records a Split Date",
  );

  // The money is unchanged: the parent row still carries the original
  // expense, and the children add back up to it.
  const parent = financeRows[1];
  const children = splitRows.filter((row) => row[10] === "CHILD");
  assert.equal(total(children, 6), parent[6] === "" ? 0 : parent[6]);
  assert.equal(total(children, 7), parent[7]);
});

test("a mixed income and expense split keeps each child's type and column", (t) => {
  const backend = createTestBackend(t, {
    Finances: [
      FINANCE_HEADERS,
      [
        "D1",
        "",
        "2026-01-05",
        "Club dinner",
        "Winter Trip",
        "Food",
        "",
        100,
        "Manual",
        "",
      ],
    ],
  });

  const response = createSplit(backend, {
    expense: 100,
    splits: [
      {
        Description: "Dinner",
        Amount: 150,
        Type: "Expense",
        TripEvent: "Winter Trip",
        Category: "Food",
      },
      {
        Description: "Refund",
        Amount: 50,
        Type: "Income",
        TripEvent: "Winter Trip",
        Category: "Transport",
      },
    ],
  });

  assert.equal(response.success, true);
  const groupId = response.splitGroupId;
  const splitRows = backend.sheets.get("Split Transactions");
  const source = splitRows.find((row) => row[10] === "SOURCE");
  const children = splitRows.filter((row) => row[10] === "CHILD");

  assert.deepEqual(
    splitRows.slice(1).map((row) => row[9]),
    [groupId, groupId, groupId],
  );

  // The SOURCE archive keeps the parent's own expense.
  assert.equal(source[6], "");
  assert.equal(source[7], 100);

  // The expense child lands in Expense and leaves Income blank; the income
  // child does the mirror image, even though the parent was an expense.
  assert.deepEqual(
    children.map((row) => ({
      description: row[3],
      income: row[6],
      expense: row[7],
    })),
    [
      { description: "Dinner", income: "", expense: 150 },
      { description: "Refund", income: 50, expense: "" },
    ],
  );

  // Signed net is still the parent's: 50 - 150 = -100.
  assert.equal(
    total(children, 6) - total(children, 7),
    -100,
    "the children net to the parent expense",
  );
});

test("reverting a split clears its group ID and removes only that group's rows", (t) => {
  const backend = createTestBackend(t, {
    Finances: [
      FINANCE_HEADERS,
      [
        "D1",
        "",
        "2026-01-01",
        "Lunch",
        "Winter Trip",
        "Food",
        "",
        12.5,
        "Manual",
        "",
      ],
      [
        "D2",
        "",
        "2026-01-02",
        "Bus",
        "Winter Trip",
        "Transport",
        "",
        20,
        "Manual",
        "",
      ],
    ],
  });

  const lunch = createSplit(backend, {
    row: 2,
    expense: 12.5,
    splits: LUNCH_SPLITS,
  });
  const bus = createSplit(backend, {
    row: 3,
    expense: 20,
    splits: [
      {
        Description: "Bus ticket",
        Amount: 15,
        Type: "Expense",
        Category: "Transport",
      },
      {
        Description: "Bus fare",
        Amount: 5,
        Type: "Expense",
        Category: "Transport",
      },
    ],
  });
  assert.equal(lunch.success, true);
  assert.equal(bus.success, true);

  const revert = backend.request("revertSplit", {
    groupId: lunch.splitGroupId,
  });
  assert.deepEqual(revert, {
    success: true,
    message: "Split reverted successfully.",
  });

  // Only the reverted group's ID is cleared. Every other Finance column,
  // including the Date, Description, Income, Expense and tags of both rows,
  // must survive the revert unchanged; the full-row assertion catches a revert
  // that also blanks an amount.
  const financeRows = backend.sheets.get("Finances");
  assert.deepEqual(financeRows, [
    FINANCE_HEADERS,
    [
      "D1",
      "",
      "2026-01-01",
      "Lunch",
      "Winter Trip",
      "Food",
      "",
      12.5,
      "Manual",
      "",
    ],
    [
      "D2",
      "",
      "2026-01-02",
      "Bus",
      "Winter Trip",
      "Transport",
      "",
      20,
      "Manual",
      bus.splitGroupId,
    ],
  ]);

  // The reverted group's SOURCE and CHILD rows are gone, and the other group
  // survives intact.
  const splitRows = backend.sheets.get("Split Transactions");
  assert.equal(
    splitRows.some((row) => row[9] === lunch.splitGroupId),
    false,
    "no row from the reverted group remains",
  );
  assert.deepEqual(
    splitRows.slice(1).map((row) => [row[9], row[10]]),
    [
      [bus.splitGroupId, "SOURCE"],
      [bus.splitGroupId, "CHILD"],
      [bus.splitGroupId, "CHILD"],
    ],
    "the other group's rows remain",
  );
});

test("editing a split replaces its rows, keeps one group ID and preserves the other tags", (t) => {
  const backend = createTestBackend(t, { Finances: FINANCES });

  const first = createSplit(backend, {
    expense: 12.5,
    splits: LUNCH_SPLITS,
  });
  assert.equal(first.success, true);
  const oldGroupId = first.splitGroupId;

  // The replacement splits carry no Trip/Event or Category, so each new CHILD
  // must inherit the original row's tags.
  const response = backend.request("editSplit", {
    groupId: oldGroupId,
    data: {
      original: { Income: "", Expense: 12.5 },
      splits: [
        { Description: "Lunch - starter", Amount: 4, Type: "Expense" },
        { Description: "Lunch - main", Amount: 5.5, Type: "Expense" },
        { Description: "Lunch - coffee", Amount: 3, Type: "Expense" },
      ],
    },
  });

  assert.equal(response.success, true);
  assert.equal(response.message, "Transaction split edited successfully.");
  const newGroupId = response.splitGroupId;

  // The Finance row points at the group the response reports and keeps its
  // tags. Whether edit reuses the old ID or issues a new one, the Finance row
  // and every split row must agree on it.
  const financeRows = backend.sheets.get("Finances");
  assert.deepEqual(financeRows, [
    FINANCE_HEADERS,
    [
      "D1",
      "",
      "2026-01-01",
      "Lunch",
      "Winter Trip",
      "Food",
      "",
      12.5,
      "Manual",
      newGroupId,
    ],
  ]);

  // The old children are replaced, not appended to.
  const splitRows = backend.sheets.get("Split Transactions");
  assert.equal(
    splitRows.some((row) => row[3] === "Lunch - drink"),
    false,
    "the old children are replaced, not appended to",
  );
  assert.deepEqual(stripSplitDates(splitRows), [
    SPLIT_HEADERS,
    [
      "D1",
      "",
      "2026-01-01",
      "Lunch",
      "Winter Trip",
      "Food",
      "",
      12.5,
      "Manual",
      newGroupId,
      "SOURCE",
    ],
    [
      "D1",
      "",
      "2026-01-01",
      "Lunch - starter",
      "Winter Trip",
      "Food",
      "",
      4,
      "Manual",
      newGroupId,
      "CHILD",
    ],
    [
      "D1",
      "",
      "2026-01-01",
      "Lunch - main",
      "Winter Trip",
      "Food",
      "",
      5.5,
      "Manual",
      newGroupId,
      "CHILD",
    ],
    [
      "D1",
      "",
      "2026-01-01",
      "Lunch - coffee",
      "Winter Trip",
      "Food",
      "",
      3,
      "Manual",
      newGroupId,
      "CHILD",
    ],
  ]);

  // Every row, including each inherited tag, carries the replacement group.
  assert.ok(
    splitRows
      .slice(1)
      .every(
        (row) =>
          row[9] === newGroupId &&
          row[4] === "Winter Trip" &&
          row[5] === "Food",
      ),
    "the group ID stays consistent and the other tags are preserved",
  );
});

test("history reads hide PENDING rows and a later split sweeps the stale ones", (t) => {
  const pendingRow = (groupId, splitDate) => [
    "D0",
    "",
    "2026-01-01",
    "Half-written",
    "Winter Trip",
    "Food",
    "",
    9.99,
    "Manual",
    groupId,
    "PENDING",
    splitDate,
  ];

  const backend = createTestBackend(t, {
    Finances: FINANCES,
    // The clock is fixed at NOW, so the stale row is just past the ten-minute
    // sweep window and the fresh one is well inside it.
    "Split Transactions": [
      SPLIT_HEADERS,
      pendingRow("STALE-GROUP", new Date(NOW - 11 * MINUTE)),
      pendingRow("FRESH-GROUP", new Date(NOW - 1 * MINUTE)),
    ],
  });

  // A history read treats PENDING rows as inert: they exist in the sheet but
  // are never returned, so a half-written group cannot appear in the UI.
  const history = backend.request("getSplitHistory", {
    page: 1,
    pageSize: 100,
  });
  assert.equal(history.success, true);
  assert.deepEqual(history.data, []);

  // The read filters PENDING rows out of the reply; it must not sweep them off
  // the sheet. A read that cleaned up here would change the sheet behind the
  // caller's back, so the stale row is still present until the next write.
  assert.ok(
    backend.sheets
      .get("Split Transactions")
      .some((row) => row[9] === "STALE-GROUP"),
    "the history read leaves the stale PENDING row in place",
  );

  const response = createSplit(backend, {
    expense: 12.5,
    splits: LUNCH_SPLITS,
  });
  assert.equal(response.success, true);
  const groupId = response.splitGroupId;

  // The next write sweeps the stale PENDING group but leaves the fresh one,
  // which is still inside the age window and may belong to an in-flight write.
  const splitRows = backend.sheets.get("Split Transactions");
  assert.equal(
    splitRows.some((row) => row[9] === "STALE-GROUP"),
    false,
    "the stale PENDING group is swept",
  );
  assert.ok(
    splitRows.some((row) => row[9] === "FRESH-GROUP" && row[10] === "PENDING"),
    "a PENDING row younger than the sweep window survives",
  );
  assert.deepEqual(
    splitRows.filter((row) => row[9] === groupId).map((row) => row[10]),
    ["SOURCE", "CHILD", "CHILD"],
  );

  const after = backend.request("getSplitHistory", {
    page: 1,
    pageSize: 100,
  });
  assert.equal(after.success, true);
  assert.equal(after.data.length, 3);
  assert.equal(
    after.data.some((row) => row["Split Type"] === "PENDING"),
    false,
  );
});

test("history has no total field and paginates on hasMore alone", (t) => {
  // One visible SOURCE row and one hidden PENDING row: a physical-row total
  // would count both and overstate what a caller can ever see (B-005).
  const backend = createTestBackend(t, {
    "Split Transactions": [
      SPLIT_HEADERS,
      [
        "D1",
        "",
        "2026-01-01",
        "Lunch",
        "Winter Trip",
        "Food",
        "",
        12.5,
        "Manual",
        "GROUP-1",
        "SOURCE",
        "2026-01-01 10:00:00",
      ],
      [
        "D0",
        "",
        "2026-01-01",
        "Half-written",
        "Winter Trip",
        "Food",
        "",
        9.99,
        "Manual",
        "GROUP-2",
        "PENDING",
        "2026-01-01 10:05:00",
      ],
    ],
  });

  const response = backend.request("getSplitHistory", {
    page: 1,
    pageSize: 100,
  });

  assert.equal(response.success, true);
  assert.equal(response.data.length, 1, "only the SOURCE row is visible");
  assert.equal(response.data[0]["Split Type"], "SOURCE");
  assert.equal(response.hasMore, false);
  assert.equal(
    "total" in response,
    false,
    "the reply must not carry a total that counts PENDING rows",
  );
});

test("a failure after the PENDING append leaves no orphan rows and no Finance group ID", (t) => {
  const backend = createTestBackend(t, { Finances: FINANCES });
  const error = t.mock.method(console, "error", () => {});
  const warn = t.mock.method(console, "warn", () => {});

  const request = {
    data: {
      original: { row: 2, Income: "", Expense: 12.5 },
      splits: LUNCH_SPLITS,
    },
  };

  // The PENDING append is the first Split Transactions setValues; skip it so
  // the promotion write is the one that fails. That is the dangerous point:
  // the rows and the Finance group ID are already on the sheet.
  backend.helpers.failNextWrite("Split Transactions", "setValues", {
    skip: 1,
  });
  const response = backend.request("splitTransaction", request);

  assert.equal(response.success, false);
  assert.equal(
    response.message,
    "Failed to write split data. Please try again.",
  );

  // The rollback removes the staged rows and clears the Finance ID, so the
  // user can retry from a clean state.
  assert.deepEqual(
    backend.sheets.get("Split Transactions"),
    [SPLIT_HEADERS],
    "the PENDING rows are rolled back",
  );
  assert.equal(
    backend.sheets.get("Finances")[1][9],
    "",
    "the Finance group ID is cleared",
  );

  assert.ok(
    error.mock.calls.some((call) =>
      String(call.arguments[0]).includes("Phase 3 (promote) failed"),
    ),
    "the failure is the promotion write, not the PENDING append",
  );
  assert.equal(warn.mock.calls.length, 0);

  // The injected fault is one-shot: the same request now writes a complete
  // group, which proves the earlier cleanup did not leave the sheet broken.
  const retry = backend.request("splitTransaction", request);
  assert.equal(retry.success, true);
  const groupId = retry.splitGroupId;
  assert.equal(backend.sheets.get("Finances")[1][9], groupId);
  assert.deepEqual(
    backend.sheets
      .get("Split Transactions")
      .slice(1)
      .map((row) => [row[9], row[10]]),
    [
      [groupId, "SOURCE"],
      [groupId, "CHILD"],
      [groupId, "CHILD"],
    ],
  );
});
