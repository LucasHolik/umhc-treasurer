// tests/backend/tags.test.js
//
// Pins the tag batch path: every operation type is applied to the Tags sheet,
// and to Finances and Split Transactions where it belongs; a write failure
// part-way through a batch rolls the whole batch back; and a rename reaches
// both the expense rows and the split-history rows that carry the tag.
//
// The harness's one-shot write fault is what makes a mid-batch failure
// reachable: it throws inside a real sheet write, so the backend's own
// rollback code runs rather than a test calling rollback directly.

import { test } from "node:test";
import assert from "node:assert/strict";

import { createBackend } from "./harness.js";

const NOW = 1_700_000_000_000;

const TAG_HEADERS = ["Trip/Event", "Type", "Status", "Category", "Type List"];

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

// Two trips, two categories and two types. "Food" is used by two expense rows
// and two split rows, so a rename or delete has more than one row to update.
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
  [
    "D2",
    "",
    "2026-01-02",
    "Bus",
    "Winter Trip",
    "Transport",
    "",
    3,
    "Manual",
    "",
  ],
  ["D3", "", "2026-01-03", "Donation", "", "Food", 100, "", "Manual", ""],
];

const SPLITS = [
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
    "G-1",
    "CHILD",
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
    3,
    "Manual",
    "G-1",
    "CHILD",
    "",
  ],
  [
    "D3",
    "",
    "2026-01-03",
    "Donation",
    "",
    "Food",
    100,
    "",
    "Manual",
    "G-1",
    "CHILD",
    "",
  ],
];

function createTestBackend(t, sheets = {}) {
  const backend = createBackend({
    now: NOW,
    sheets: {
      Tags: TAGS,
      Finances: FINANCES,
      "Split Transactions": SPLITS,
      ...sheets,
    },
  });
  t.after(() => backend.close());
  return backend;
}

test("processTagOperations applies add, rename, delete, trip type and trip status", (t) => {
  const backend = createTestBackend(t);
  const error = t.mock.method(console, "error", () => {});
  const warn = t.mock.method(console, "warn", () => {});

  const operations = [
    ["", "Travel", "add", "Category"],
    ["Food", "Meals", "rename", "Category"],
    ["Transport", null, "delete", "Category"],
    ["Winter Trip", "Social", "updateTripType", null],
    ["Winter Trip", "Completed", "updateTripStatus", null],
  ];

  const response = backend.request("processTagOperations", { operations });

  assert.equal(response.success, true);
  assert.equal(response.message, "Processed 5 operations successfully");
  assert.deepEqual(
    response.results,
    operations.map((operation, index) => ({
      index: index,
      operation: operation,
      status: "applied",
    })),
  );

  // The Tags sheet shows the add, rename, delete, trip type and trip status.
  // Category is sorted at the end of the batch, so Travel follows Meals.
  assert.deepEqual(backend.sheets.get("Tags"), [
    TAG_HEADERS,
    ["Winter Trip", "Social", "Completed", "Meals", "Competitive"],
    ["Summer Trip", "Social", "Completed", "Travel", "Social"],
  ]);

  // Renames and deletes reach the expense rows; the donation row is included
  // because it also carries Food.
  assert.deepEqual(backend.sheets.get("Finances"), [
    FINANCE_HEADERS,
    [
      "D1",
      "",
      "2026-01-01",
      "Lunch",
      "Winter Trip",
      "Meals",
      "",
      12.5,
      "Manual",
      "",
    ],
    ["D2", "", "2026-01-02", "Bus", "Winter Trip", "", "", 3, "Manual", ""],
    ["D3", "", "2026-01-03", "Donation", "", "Meals", 100, "", "Manual", ""],
  ]);

  // The same changes reach the split-history rows.
  assert.deepEqual(backend.sheets.get("Split Transactions"), [
    SPLIT_HEADERS,
    [
      "D1",
      "",
      "2026-01-01",
      "Lunch",
      "Winter Trip",
      "Meals",
      "",
      12.5,
      "Manual",
      "G-1",
      "CHILD",
      "",
    ],
    [
      "D2",
      "",
      "2026-01-02",
      "Bus",
      "Winter Trip",
      "",
      "",
      3,
      "Manual",
      "G-1",
      "CHILD",
      "",
    ],
    [
      "D3",
      "",
      "2026-01-03",
      "Donation",
      "",
      "Meals",
      100,
      "",
      "Manual",
      "G-1",
      "CHILD",
      "",
    ],
  ]);

  assert.equal(error.mock.calls.length, 0, "a successful batch logs no error");
  assert.equal(warn.mock.calls.length, 0, "a successful batch logs no warning");
});

test("a mid-batch write failure rolls the whole batch back", (t) => {
  // The split rows deliberately do not carry "Food", so deleting Food does not
  // write to Split Transactions. The one-shot fault is therefore saved for the
  // rename's split update, after the delete has already changed the Tags sheet
  // and the expenses.
  const splitsWithoutFood = [
    SPLIT_HEADERS,
    [
      "D1",
      "",
      "2026-01-01",
      "Lunch",
      "Winter Trip",
      "Other",
      "",
      12.5,
      "Manual",
      "G-1",
      "CHILD",
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
      3,
      "Manual",
      "G-1",
      "CHILD",
      "",
    ],
    [
      "D3",
      "",
      "2026-01-03",
      "Donation",
      "",
      "Other",
      100,
      "",
      "Manual",
      "G-1",
      "CHILD",
      "",
    ],
  ];
  const backend = createTestBackend(t, {
    "Split Transactions": splitsWithoutFood,
  });
  const error = t.mock.method(console, "error", () => {});
  const warn = t.mock.method(console, "warn", () => {});

  const operations = [
    ["Food", null, "delete", "Category"],
    ["Transport", "Bus", "rename", "Category"],
  ];

  backend.helpers.failNextWrite("Split Transactions", "setValues");
  const response = backend.request("processTagOperations", { operations });

  assert.equal(response.success, false);
  assert.match(response.message, /Operation failed at index 1/);
  assert.match(response.message, /Changes reverted/);
  assert.deepEqual(response.appliedOperations, []);
  assert.equal(response.rollback.attempted, true);
  assert.equal(response.rollback.success, true);

  assert.deepEqual(
    response.results.map((result) => ({
      index: result.index,
      operation: result.operation,
      status: result.status,
    })),
    [
      { index: 0, operation: operations[0], status: "rolled_back" },
      { index: 1, operation: operations[1], status: "failed" },
    ],
  );
  assert.match(response.results[1].message, /Tag rename failed/);

  // The first delete was applied and then compensated; the rename failed and
  // reverted itself. Neither half of the batch may remain.
  assert.deepEqual(backend.sheets.get("Tags"), TAGS);
  assert.deepEqual(backend.sheets.get("Finances"), FINANCES);
  assert.deepEqual(backend.sheets.get("Split Transactions"), splitsWithoutFood);

  assert.ok(
    error.mock.calls.some((call) =>
      String(call.arguments[0]).includes("Rolling back"),
    ),
    "the rename reports that it is rolling back",
  );
  assert.equal(
    warn.mock.calls.length,
    0,
    "the rollback succeeds without warning",
  );

  // The injected fault is one-shot: a later batch writes to the split sheet
  // normally, so the rollback test cannot pass because writes stay broken.
  const retry = backend.request("processTagOperations", {
    operations: [["Transport", "Bus", "rename", "Category"]],
  });
  assert.equal(retry.success, true);
  assert.equal(
    backend.sheets.get("Split Transactions")[2][5],
    "Bus",
    "the split-history rename works after the injected fault",
  );
});

test("an unexpected write throw rolls the whole batch back", (t) => {
  const backend = createTestBackend(t);
  const error = t.mock.method(console, "error", () => {});
  const warn = t.mock.method(console, "warn", () => {});
  const log = t.mock.method(console, "log", () => {});

  // The delete moves Tag cells with copyTo/clearContent, so the next Tags
  // setValue is the Travel add. The batch therefore reaches the add with the
  // delete already applied, and the throw must roll that delete back. The
  // trailing operation proves that operations after the failure are skipped.
  const operations = [
    ["Food", null, "delete", "Category"],
    ["", "Travel", "add", "Category"],
    ["Winter Trip", "Social", "updateTripType", null],
  ];

  backend.helpers.failNextWrite("Tags", "setValue");
  const response = backend.request("processTagOperations", { operations });

  assert.equal(response.success, false);
  assert.match(response.message, /Unexpected error/);
  assert.match(response.message, /Changes reverted/);
  assert.deepEqual(response.appliedOperations, []);
  assert.equal(response.rollback.attempted, true);
  assert.equal(response.rollback.success, true);
  assert.equal(response.rollback.message, undefined);

  assert.deepEqual(
    response.results.map(({ index, operation, status }) => ({
      index,
      operation,
      status,
    })),
    [
      { index: 0, operation: operations[0], status: "rolled_back" },
      { index: 1, operation: operations[1], status: "failed" },
      { index: 2, operation: operations[2], status: "skipped" },
    ],
  );
  assert.match(response.results[1].message, /Unexpected error at index 1/);

  // The delete changed Tags, Finances and Split Transactions before the add
  // threw, so every one of those writes must be undone.
  assert.deepEqual(backend.sheets.get("Tags"), TAGS);
  assert.deepEqual(backend.sheets.get("Finances"), FINANCES);
  assert.deepEqual(backend.sheets.get("Split Transactions"), SPLITS);

  // The rollback runs inside the lock, so the lock is free by the time the
  // response reaches the caller.
  assert.equal(backend.helpers.isScriptLockHeld(), false);
  assert.equal(backend.helpers.getScriptLockDepth(), 0);

  assert.equal(error.mock.calls.length, 0, "a clean rollback logs no error");
  assert.equal(warn.mock.calls.length, 0, "a clean rollback logs no warning");
  assert.equal(log.mock.calls.length, 0, "a clean rollback logs nothing");

  // The injected fault is one-shot, so the same batch succeeds on retry.
  const retry = backend.request("processTagOperations", { operations });
  assert.equal(retry.success, true);
  assert.deepEqual(
    retry.results.map((result) => result.status),
    ["applied", "applied", "applied"],
  );
  assert.deepEqual(backend.sheets.get("Tags"), [
    TAG_HEADERS,
    ["Winter Trip", "Social", "Active", "Transport", "Competitive"],
    ["Summer Trip", "Social", "Completed", "Travel", "Social"],
  ]);
  assert.equal(backend.sheets.get("Finances")[1][5], "");
  assert.equal(backend.sheets.get("Split Transactions")[1][5], "");
});

test("a missing split restore helper refuses the tag delete", (t) => {
  const backend = createTestBackend(t);
  const error = t.mock.method(console, "error", () => {});

  // Simulate a deployment whose Service_Split lost restoreTagInSplits. The
  // delete pre-flight must refuse before it clears any Split Transactions row:
  // those rows could not be restored if the batch failed later.
  backend.helpers.hideSplitRestore();

  const operations = [
    ["Food", null, "delete", "Category"],
    ["", "Travel", "add", "Category"],
  ];

  // No write fault is scheduled: the batch stops at the pre-flight, so the
  // cancelled-add path is not needed to reach this behaviour.
  const response = backend.request("processTagOperations", { operations });

  assert.equal(response.success, false);
  assert.match(response.message, /Service_Split dependency not available/);
  assert.match(response.message, /Tag NOT deleted/);
  assert.doesNotMatch(response.message, /Data is INCONSISTENT/);
  assert.deepEqual(response.appliedOperations, []);
  // The batch-level rollback finds nothing to undo, so it still appends
  // "Changes reverted." here. That is truthful because no row changed, so the
  // assertions below focus on the refusal and the unchanged sheets instead.

  // The delete is refused with the dependency message, and the add after it is
  // skipped rather than applied.
  assert.deepEqual(
    response.results.map(({ index, status }) => ({ index, status })),
    [
      { index: 0, status: "failed" },
      { index: 1, status: "skipped" },
    ],
  );
  assert.match(
    response.results[0].message,
    /Service_Split dependency not available/,
  );

  // Nothing was written anywhere: Food is still on the expense and split rows,
  // the Tags list still holds it, and no Travel category was added.
  assert.deepEqual(backend.sheets.get("Tags"), TAGS);
  assert.deepEqual(backend.sheets.get("Finances"), FINANCES);
  assert.deepEqual(backend.sheets.get("Split Transactions"), SPLITS);

  assert.equal(
    error.mock.calls.length,
    0,
    "a clean pre-flight refusal logs no error",
  );
});

test("a Tags write throw during delete restores the external rows", (t) => {
  const backend = createTestBackend(t);
  const error = t.mock.method(console, "error", () => {});
  const warn = t.mock.method(console, "warn", () => {});

  const operations = [
    ["Food", null, "delete", "Category"],
    ["", "Travel", "add", "Category"],
  ];

  // The delete clears Food from Finances and Split Transactions, then shuffles
  // the Tags category column with copyTo. The fault lands after both external
  // writes, which is the B-006 window: the delete must put those rows back
  // itself before it returns a structured failure.
  backend.helpers.failNextWrite("Tags", "copyTo");
  const response = backend.request("processTagOperations", { operations });

  assert.equal(response.success, false);

  // Both external sheets are back to their pre-batch state, not just Tags.
  // These checks come first so the regression is explicit about the data even
  // if the message assertions below drift.
  assert.deepEqual(backend.sheets.get("Tags"), TAGS);
  assert.deepEqual(backend.sheets.get("Finances"), FINANCES);
  assert.deepEqual(backend.sheets.get("Split Transactions"), SPLITS);

  assert.match(response.message, /Operation failed at index 0/);
  assert.equal(
    response.message.match(/Changes reverted/g).length,
    1,
    "the clean batch message reports the reverted state once",
  );
  assert.doesNotMatch(response.message, /\.\./);
  assert.deepEqual(response.appliedOperations, []);
  assert.equal(response.rollback.attempted, true);
  assert.equal(response.rollback.success, true);

  assert.ok(
    error.mock.calls.some((call) =>
      String(call.arguments[0]).includes("Rolling back external rows"),
    ),
    "the delete reports that it is restoring the external rows",
  );
  assert.equal(warn.mock.calls.length, 0, "a clean restore logs no warning");
  assert.equal(backend.helpers.isScriptLockHeld(), false);
  assert.equal(backend.helpers.getScriptLockDepth(), 0);

  // The fault is one-shot: the same batch applies cleanly on retry.
  const retry = backend.request("processTagOperations", { operations });
  assert.equal(retry.success, true);
  assert.deepEqual(
    retry.results.map((result) => result.status),
    ["applied", "applied"],
  );
  assert.deepEqual(backend.sheets.get("Tags"), [
    TAG_HEADERS,
    ["Winter Trip", "Competitive", "Active", "Transport", "Competitive"],
    ["Summer Trip", "Social", "Completed", "Travel", "Social"],
  ]);
  assert.deepEqual(
    backend.sheets.get("Finances").map((row) => row[5]),
    ["Category", "", "Transport", ""],
  );
  assert.deepEqual(
    backend.sheets.get("Split Transactions").map((row) => row[5]),
    ["Category", "", "Transport", ""],
  );
});

test("a Split Transactions write failure during delete restores the expenses rows", (t) => {
  const backend = createTestBackend(t);
  const error = t.mock.method(console, "error", () => {});
  const warn = t.mock.method(console, "warn", () => {});

  // The delete clears Food from Finances first, then fails writing Split
  // Transactions. The split helper catches the write error itself, so the
  // delete sees a returned failure and must restore the expenses rows.
  backend.helpers.failNextWrite("Split Transactions", "setValues");
  const response = backend.request("processTagOperations", {
    operations: [["Food", null, "delete", "Category"]],
  });

  assert.equal(response.success, false);
  assert.match(response.message, /Changes reverted/);

  // The two Food expense rows are back, and no sheet kept a change.
  assert.equal(backend.sheets.get("Finances")[1][5], "Food");
  assert.equal(backend.sheets.get("Finances")[3][5], "Food");
  assert.deepEqual(backend.sheets.get("Tags"), TAGS);
  assert.deepEqual(backend.sheets.get("Finances"), FINANCES);
  assert.deepEqual(backend.sheets.get("Split Transactions"), SPLITS);

  assert.ok(
    error.mock.calls.some((call) =>
      String(call.arguments[0]).includes("Splits update failed"),
    ),
    "the delete reports the split failure",
  );
  assert.equal(warn.mock.calls.length, 0, "a clean restore logs no warning");
  assert.equal(backend.helpers.isScriptLockHeld(), false);
  assert.equal(backend.helpers.getScriptLockDepth(), 0);
});

test("the batch compensation retries a delete restore that failed", (t) => {
  const backend = createTestBackend(t);
  const error = t.mock.method(console, "error", () => {});
  const warn = t.mock.method(console, "warn", () => {});

  // The Tags copyTo throws after the external rows were cleared, and the
  // delete's own Expenses restore then fails too. The delete returns the rows
  // as unresolved, so the batch compensation must retry the restore: without
  // that retry the Food cells in Finances stay empty.
  backend.helpers.failNextWrite("Tags", "copyTo");
  backend.helpers.failNextWrite("Finances", "setValue");

  const response = backend.request("processTagOperations", {
    operations: [["Food", null, "delete", "Category"]],
  });

  assert.equal(response.success, false);
  // The delete's own restore failed, but the batch compensation retried it and
  // succeeded. The final message must reflect that outcome: no stale
  // inconsistency warning, and the reverted claim exactly once.
  assert.doesNotMatch(response.message, /Data is INCONSISTENT/);
  assert.equal(
    response.message.match(/Changes reverted/g).length,
    1,
    "the final message reports the reverted state once",
  );
  assert.equal(response.rollback.attempted, true);
  assert.equal(response.rollback.success, true);
  assert.deepEqual(backend.sheets.get("Tags"), TAGS);
  assert.deepEqual(backend.sheets.get("Finances"), FINANCES);
  assert.deepEqual(backend.sheets.get("Split Transactions"), SPLITS);
  assert.equal(backend.helpers.isScriptLockHeld(), false);
  assert.equal(backend.helpers.getScriptLockDepth(), 0);

  assert.ok(
    error.mock.calls.some((call) =>
      String(call.arguments[0]).includes("Failed to restore Expenses rows"),
    ),
    "the delete reports the unresolved Expenses restore",
  );
  assert.equal(
    warn.mock.calls.length,
    0,
    "the compensation retry logs nothing",
  );
});

test("a Tags write throw during a direct delete restores both external sheets", (t) => {
  const backend = createTestBackend(t);
  const error = t.mock.method(console, "error", () => {});
  const warn = t.mock.method(console, "warn", () => {});

  // The direct deleteTag endpoint has no batch compensation behind it: if
  // _deleteTag does not restore the Split Transactions rows itself, nothing
  // else will. The copyTo fault lands after both external sheets were cleared.
  backend.helpers.failNextWrite("Tags", "copyTo");
  const response = backend.request("deleteTag", {
    type: "Category",
    value: "Food",
  });

  assert.equal(response.success, false);
  assert.match(response.message, /Changes reverted/);
  assert.doesNotMatch(response.message, /Data is INCONSISTENT/);

  // Every sheet is exactly as it was before the delete, including the split
  // history the batch compensation would otherwise have repaired.
  assert.deepEqual(backend.sheets.get("Tags"), TAGS);
  assert.deepEqual(backend.sheets.get("Finances"), FINANCES);
  assert.deepEqual(backend.sheets.get("Split Transactions"), SPLITS);

  assert.ok(
    error.mock.calls.some((call) =>
      String(call.arguments[0]).includes("Rolling back external rows"),
    ),
    "the delete reports that it is restoring the external rows",
  );
  assert.equal(warn.mock.calls.length, 0, "a clean restore logs no warning");
  assert.equal(backend.helpers.isScriptLockHeld(), false);
  assert.equal(backend.helpers.getScriptLockDepth(), 0);

  // The fault is one-shot: the same direct delete applies cleanly on retry.
  const retry = backend.request("deleteTag", {
    type: "Category",
    value: "Food",
  });
  assert.equal(retry.success, true);
  assert.deepEqual(
    backend.sheets.get("Finances").map((row) => row[5]),
    ["Category", "", "Transport", ""],
  );
  assert.deepEqual(
    backend.sheets.get("Split Transactions").map((row) => row[5]),
    ["Category", "", "Transport", ""],
  );
});

test("a throw in the post-loop sort rolls the batch back", (t) => {
  const backend = createTestBackend(t);
  const error = t.mock.method(console, "error", () => {});
  const warn = t.mock.method(console, "warn", () => {});
  const log = t.mock.method(console, "log", () => {});

  // A single Category add writes its row with setValue. The post-loop sort then
  // clears and rewrites the Category column with setValues, so a setValues fault
  // lands in the sort after the add applied and the sort's clearContent ran.
  const operations = [["", "Travel", "add", "Category"]];

  backend.helpers.failNextWrite("Tags", "setValues");
  const response = backend.request("processTagOperations", { operations });

  assert.equal(response.success, false);
  assert.match(response.message, /Unexpected error/);
  assert.match(response.message, /Changes reverted/);
  assert.deepEqual(response.appliedOperations, []);
  assert.equal(response.rollback.attempted, true);
  assert.equal(response.rollback.success, true);

  // The sort throws after index 0 applied, so index 0 carries both the flipped
  // rolled_back result and the failed result for the sort. The duplicate is
  // cosmetic: appliedOperations stays empty.
  assert.deepEqual(
    response.results.map(({ index, status }) => ({ index, status })),
    [
      { index: 0, status: "rolled_back" },
      { index: 0, status: "failed" },
    ],
  );
  assert.match(response.results[1].message, /Unexpected error at index 0/);

  assert.deepEqual(backend.sheets.get("Tags"), TAGS);
  assert.equal(backend.helpers.isScriptLockHeld(), false);
  assert.equal(backend.helpers.getScriptLockDepth(), 0);

  assert.equal(error.mock.calls.length, 0, "a clean rollback logs no error");
  assert.equal(warn.mock.calls.length, 0, "a clean rollback logs no warning");
  assert.equal(log.mock.calls.length, 0, "a clean rollback logs nothing");
});

test("renaming a tag updates expense rows and split-history rows", (t) => {
  const backend = createTestBackend(t);

  const response = backend.request("renameTag", {
    type: "Category",
    oldValue: "Food",
    newValue: "Meals",
  });

  assert.deepEqual(response, {
    success: true,
    message: "Tag renamed successfully.",
    expensesUpdated: true,
    splitsUpdated: true,
  });

  // The master list keeps its order ("Meals" sorts before "Transport").
  assert.deepEqual(backend.sheets.get("Tags"), [
    TAG_HEADERS,
    ["Winter Trip", "Competitive", "Active", "Meals", "Competitive"],
    ["Summer Trip", "Social", "Completed", "Transport", "Social"],
  ]);

  // Both Food expense rows were renamed and the Transport row was left alone.
  assert.deepEqual(
    backend.sheets.get("Finances").map((row) => row[5]),
    ["Category", "Meals", "Transport", "Meals"],
  );

  // Split history carries the same tag and must move with it.
  assert.deepEqual(
    backend.sheets.get("Split Transactions").map((row) => row[5]),
    ["Category", "Meals", "Transport", "Meals"],
  );
});

test("a Finances write throw during rename reverts the external rows", (t) => {
  const backend = createTestBackend(t);
  const error = t.mock.method(console, "error", () => {});
  const warn = t.mock.method(console, "warn", () => {});

  // The expense update applies "Meals" and then throws on the way back. The
  // helper catches that and reports failure, so the rename cannot rely on the
  // call returning before it records that the external write was attempted.
  backend.helpers.failNextWrite("Finances", "setValues", { when: "after" });
  const response = backend.request("renameTag", {
    type: "Category",
    oldValue: "Food",
    newValue: "Meals",
  });

  assert.equal(response.success, false);
  assert.match(response.message, /Tag rename failed/);
  assert.match(response.message, /Changes reverted/);

  // Every sheet is back to its pre-rename state, including the partial
  // external write that landed before the fault.
  assert.deepEqual(backend.sheets.get("Tags"), TAGS);
  assert.deepEqual(backend.sheets.get("Finances"), FINANCES);
  assert.deepEqual(backend.sheets.get("Split Transactions"), SPLITS);

  assert.ok(
    error.mock.calls.some((call) =>
      call.arguments.some((argument) =>
        String(argument).includes("Expenses update failed"),
      ),
    ),
    "the rename reports the failed expense update",
  );
  assert.equal(warn.mock.calls.length, 0, "a clean rollback logs no warning");
  assert.equal(backend.helpers.isScriptLockHeld(), false);
  assert.equal(backend.helpers.getScriptLockDepth(), 0);

  // The fault is one-shot: a normal retry succeeds and sets Meals.
  const retry = backend.request("renameTag", {
    type: "Category",
    oldValue: "Food",
    newValue: "Meals",
  });
  assert.equal(retry.success, true);
  assert.deepEqual(backend.sheets.get("Tags"), [
    TAG_HEADERS,
    ["Winter Trip", "Competitive", "Active", "Meals", "Competitive"],
    ["Summer Trip", "Social", "Completed", "Transport", "Social"],
  ]);
  assert.deepEqual(
    backend.sheets.get("Finances").map((row) => row[5]),
    ["Category", "Meals", "Transport", "Meals"],
  );
  assert.deepEqual(
    backend.sheets.get("Split Transactions").map((row) => row[5]),
    ["Category", "Meals", "Transport", "Meals"],
  );
});

test("a failed compensation reports the rename as inconsistent", (t) => {
  const backend = createTestBackend(t);
  const error = t.mock.method(console, "error", () => {});

  // Two faults on the Finances column: the expense update applies "Meals" and
  // then throws, and the compensating write back to "Food" throws before
  // changing anything. The response must not claim the changes were reverted
  // while the partial write remains; this test pins that false-claim fix.
  backend.helpers.failNextWrite("Finances", "setValues", { when: "after" });
  backend.helpers.failNextWrite("Finances", "setValues");
  const response = backend.request("renameTag", {
    type: "Category",
    oldValue: "Food",
    newValue: "Meals",
  });

  assert.equal(response.success, false);
  assert.match(response.message, /Data is INCONSISTENT/);
  assert.doesNotMatch(response.message, /Changes reverted/);

  // The Tags master is back to Food and the split history was never reached,
  // but the partial expense write stays Meals because its revert failed.
  assert.deepEqual(backend.sheets.get("Tags"), TAGS);
  assert.deepEqual(
    backend.sheets.get("Finances").map((row) => row[5]),
    ["Category", "Meals", "Transport", "Meals"],
  );
  assert.deepEqual(backend.sheets.get("Split Transactions"), SPLITS);
  assert.equal(backend.helpers.isScriptLockHeld(), false);
  assert.equal(backend.helpers.getScriptLockDepth(), 0);

  assert.ok(
    error.mock.calls.some((call) =>
      String(call.arguments[0]).includes("Failed to rollback Expenses sheet"),
    ),
    "the failed expense compensation is logged",
  );
});

test("a failed batch compensation reports the rename as inconsistent", (t) => {
  const backend = createTestBackend(t);
  const error = t.mock.method(console, "error", () => {});

  // This pins the batch path: the rename's expense update applies "Meals" and
  // then throws, its own revert fails, and the batch's compensation retry
  // fails too. The batch must not turn the rename's inconsistency into a clean
  // "Changes reverted" claim.
  backend.helpers.failNextWrite("Finances", "setValues", { when: "after" });
  backend.helpers.failNextWrite("Finances", "setValues");
  backend.helpers.failNextWrite("Finances", "setValues");

  const response = backend.request("processTagOperations", {
    operations: [["Food", "Meals", "rename", "Category"]],
  });

  assert.equal(response.success, false);
  assert.match(response.message, /Data is INCONSISTENT/);
  assert.doesNotMatch(response.message, /Changes reverted/);
  assert.equal(response.rollback.attempted, true);
  assert.equal(response.rollback.success, false);

  // The Tags snapshot is restored; the partial expense write stays "Meals"
  // because both the rename's own revert and the batch retry failed, and the
  // split history was never reached.
  assert.deepEqual(backend.sheets.get("Tags"), TAGS);
  assert.deepEqual(
    backend.sheets.get("Finances").map((row) => row[5]),
    ["Category", "Meals", "Transport", "Meals"],
  );
  assert.deepEqual(backend.sheets.get("Split Transactions"), SPLITS);
  assert.equal(backend.helpers.isScriptLockHeld(), false);
  assert.equal(backend.helpers.getScriptLockDepth(), 0);

  assert.ok(
    error.mock.calls.some((call) =>
      String(call.arguments[0]).includes("Expenses rename rollback failed"),
    ),
    "the batch reports the failed rename rollback",
  );
});

test("a Split Transactions write throw during rename reverts the external rows", (t) => {
  const backend = createTestBackend(t);
  const error = t.mock.method(console, "error", () => {});
  const warn = t.mock.method(console, "warn", () => {});

  // The expense update succeeds, then the split update applies "Meals" and
  // throws on the way back. The split helper catches that and reports failure,
  // so the split revert must not be guarded by the expense flag.
  backend.helpers.failNextWrite("Split Transactions", "setValues", {
    when: "after",
  });
  const response = backend.request("renameTag", {
    type: "Category",
    oldValue: "Food",
    newValue: "Meals",
  });

  assert.equal(response.success, false);
  assert.match(response.message, /Tag rename failed/);
  assert.match(response.message, /Changes reverted/);

  // The Tags master, the expense rows and the partial split write all return
  // to the old tag.
  assert.deepEqual(backend.sheets.get("Tags"), TAGS);
  assert.deepEqual(backend.sheets.get("Finances"), FINANCES);
  assert.deepEqual(backend.sheets.get("Split Transactions"), SPLITS);

  assert.ok(
    error.mock.calls.some((call) =>
      call.arguments.some((argument) =>
        String(argument).includes("Splits update failed"),
      ),
    ),
    "the rename reports the failed split update",
  );
  assert.equal(warn.mock.calls.length, 0, "a clean rollback logs no warning");
  assert.equal(backend.helpers.isScriptLockHeld(), false);
  assert.equal(backend.helpers.getScriptLockDepth(), 0);

  // The fault is one-shot: a normal retry succeeds and sets Meals.
  const retry = backend.request("renameTag", {
    type: "Category",
    oldValue: "Food",
    newValue: "Meals",
  });
  assert.equal(retry.success, true);
  assert.deepEqual(backend.sheets.get("Tags"), [
    TAG_HEADERS,
    ["Winter Trip", "Competitive", "Active", "Meals", "Competitive"],
    ["Summer Trip", "Social", "Completed", "Transport", "Social"],
  ]);
  assert.deepEqual(
    backend.sheets.get("Finances").map((row) => row[5]),
    ["Category", "Meals", "Transport", "Meals"],
  );
  assert.deepEqual(
    backend.sheets.get("Split Transactions").map((row) => row[5]),
    ["Category", "Meals", "Transport", "Meals"],
  );
});
