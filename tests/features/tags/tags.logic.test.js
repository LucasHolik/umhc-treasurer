// tests/features/tags/tags.logic.test.js

import { test } from "node:test";
import assert from "node:assert/strict";
import { assertClose } from "../../helpers/assert.js";
import {
  getVirtualTripTypeMap,
  getVirtualTagList,
  getVirtualTripStatusMap,
  calculateDetailStats,
  calculateTagStats,
  optimizeQueue,
  formatOperationsForApi,
  resolveSaveFailure,
} from "../../../src/features/tags/tags.logic.js";

test("getVirtualTripTypeMap applies updateTripType ops", () => {
  const map = getVirtualTripTypeMap({ Snowdon: "Day Walk" }, [
    { type: "updateTripType", oldValue: "Snowdon", newValue: "Weekend" },
    { type: "updateTripType", oldValue: "Scafell", newValue: "Day Walk" },
  ]);
  assert.deepEqual(map, { Snowdon: "Weekend", Scafell: "Day Walk" });
});

test("getVirtualTripTypeMap empty newValue removes the mapping", () => {
  const map = getVirtualTripTypeMap({ Snowdon: "Day Walk" }, [
    { type: "updateTripType", oldValue: "Snowdon", newValue: "" },
  ]);
  assert.deepEqual(map, {});
});

test("getVirtualTripTypeMap follows trip renames and deletes", () => {
  const renamed = getVirtualTripTypeMap({ Snowdon: "Day Walk" }, [
    {
      type: "rename",
      tagType: "Trip/Event",
      oldValue: "Snowdon",
      newValue: "Yr Wyddfa",
    },
  ]);
  assert.deepEqual(renamed, { "Yr Wyddfa": "Day Walk" });

  const deleted = getVirtualTripTypeMap({ Snowdon: "Day Walk" }, [
    { type: "delete", tagType: "Trip/Event", value: "Snowdon" },
  ]);
  assert.deepEqual(deleted, {});
});

test("getVirtualTripTypeMap follows Type renames and deletes", () => {
  const original = {
    Snowdon: "Day Walk",
    Scafell: "Day Walk",
    Alps: "Expedition",
  };
  const renamed = getVirtualTripTypeMap(original, [
    { type: "rename", tagType: "Type", oldValue: "Day Walk", newValue: "Hike" },
  ]);
  assert.deepEqual(renamed, {
    Snowdon: "Hike",
    Scafell: "Hike",
    Alps: "Expedition",
  });

  const deleted = getVirtualTripTypeMap(original, [
    { type: "delete", tagType: "Type", value: "Day Walk" },
  ]);
  assert.deepEqual(deleted, { Alps: "Expedition" });
});

test("getVirtualTagList applies add, delete and rename", () => {
  const base = ["Transport", "Food"];
  assert.deepEqual(
    getVirtualTagList(
      base,
      [{ type: "add", tagType: "Category", value: "Gear" }],
      "Category",
    ),
    ["Transport", "Food", "Gear"],
  );
  assert.deepEqual(
    getVirtualTagList(
      base,
      [{ type: "add", tagType: "Category", value: "Food" }],
      "Category",
    ),
    ["Transport", "Food"],
  );
  assert.deepEqual(
    getVirtualTagList(
      base,
      [{ type: "delete", tagType: "Category", value: "Food" }],
      "Category",
    ),
    ["Transport"],
  );
  assert.deepEqual(
    getVirtualTagList(
      base,
      [
        {
          type: "rename",
          tagType: "Category",
          oldValue: "Food",
          newValue: "Transport",
        },
      ],
      "Category",
    ),
    ["Transport"],
    "rename onto an existing tag must deduplicate",
  );
});

test("getVirtualTagList ignores ops for other tag types", () => {
  assert.deepEqual(
    getVirtualTagList(
      ["A"],
      [{ type: "add", tagType: "Type", value: "B" }],
      "Category",
    ),
    ["A"],
  );
});

test("getVirtualTripStatusMap applies status updates and defaults", () => {
  const updated = getVirtualTripStatusMap({ Snowdon: "Active" }, [
    { type: "updateTripStatus", oldValue: "Snowdon", newValue: "Completed" },
  ]);
  assert.deepEqual(updated, { Snowdon: "Completed" });

  const added = getVirtualTripStatusMap({}, [
    { type: "add", tagType: "Trip/Event", value: "Scafell" },
  ]);
  assert.deepEqual(added, { Scafell: "Active" });
});

test("getVirtualTripStatusMap carries status through renames", () => {
  const renamed = getVirtualTripStatusMap({ Snowdon: "Completed" }, [
    {
      type: "rename",
      tagType: "Trip/Event",
      oldValue: "Snowdon",
      newValue: "Yr Wyddfa",
    },
  ]);
  assert.deepEqual(renamed, { "Yr Wyddfa": "Completed" });

  const renamedUnknown = getVirtualTripStatusMap({}, [
    {
      type: "rename",
      tagType: "Trip/Event",
      oldValue: "Ghost",
      newValue: "Spirit",
    },
  ]);
  assert.deepEqual(
    renamedUnknown,
    { Spirit: "Active" },
    "unknown trips default to Active",
  );

  const deleted = getVirtualTripStatusMap({ Snowdon: "Active" }, [
    { type: "delete", tagType: "Trip/Event", value: "Snowdon" },
  ]);
  assert.deepEqual(deleted, {});
});

test("getVirtualTripStatusMap handles Completed Investment through a rename", () => {
  const updated = getVirtualTripStatusMap({ "Kit Fund": "Investment" }, [
    {
      type: "updateTripStatus",
      oldValue: "Kit Fund",
      newValue: "Completed Investment",
    },
    {
      type: "rename",
      tagType: "Trip/Event",
      oldValue: "Kit Fund",
      newValue: "Kit Fund 2023",
    },
  ]);
  assert.deepEqual(updated, { "Kit Fund 2023": "Completed Investment" });
});

test("calculateDetailStats sums count, income and expense", () => {
  const stats = calculateDetailStats([
    { Income: "10.50", Expense: 0 },
    { Income: 0, Expense: "5.25" },
  ]);
  assert.equal(stats.count, 2);
  assertClose(stats.income, 10.5);
  assertClose(stats.expense, 5.25);
});

const baseTagsData = () => ({
  "Trip/Event": ["Snowdon", "Scafell"],
  Category: ["Transport", "Food"],
  Type: ["Day Walk"],
  TripTypeMap: { Snowdon: "Day Walk", Scafell: "Day Walk" },
  TripStatusMap: { Snowdon: "Active", Scafell: "Completed" },
});

const baseExpenses = () => [
  {
    Date: "2024-01-01",
    "Trip/Event": "Snowdon",
    Category: "Transport",
    Income: 100,
    Expense: 0,
  },
  {
    Date: "2024-01-02",
    "Trip/Event": "Snowdon",
    Category: "Food",
    Income: 0,
    Expense: 40,
  },
  {
    Date: "2024-01-03",
    "Trip/Event": "Scafell",
    Category: "Transport",
    Income: 0,
    Expense: 25,
  },
];

test("calculateTagStats aggregates per trip and category", () => {
  const { stats } = calculateTagStats(
    baseExpenses(),
    baseTagsData(),
    "all_time",
  );
  assert.deepEqual(stats["Trip/Event"]["Snowdon"], {
    count: 2,
    income: 100,
    expense: 40,
  });
  assert.deepEqual(stats["Trip/Event"]["Scafell"], {
    count: 1,
    income: 0,
    expense: 25,
  });
  assert.deepEqual(stats["Category"]["Transport"], {
    count: 2,
    income: 100,
    expense: 25,
  });
});

test("calculateTagStats rolls trip stats up into Types", () => {
  const { stats } = calculateTagStats(
    baseExpenses(),
    baseTagsData(),
    "all_time",
  );
  assert.deepEqual(stats["Type"]["Day Walk"], {
    count: 3,
    income: 100,
    expense: 65,
  });
});

test("calculateTagStats backfills zero stats for unused Types", () => {
  const tags = baseTagsData();
  tags.Type.push("Expedition");
  const { stats } = calculateTagStats(baseExpenses(), tags, "all_time");
  assert.deepEqual(stats["Type"]["Expedition"], {
    count: 0,
    income: 0,
    expense: 0,
  });
});

test("calculateTagStats rename merges into an existing tag", () => {
  const queue = [
    {
      type: "rename",
      tagType: "Category",
      oldValue: "Food",
      newValue: "Transport",
    },
  ];
  const { stats } = calculateTagStats(
    baseExpenses(),
    baseTagsData(),
    "all_time",
    queue,
  );
  assert.deepEqual(stats["Category"]["Transport"], {
    count: 3,
    income: 100,
    expense: 65,
  });
  assert.equal(stats["Category"]["Food"], undefined);
});

test("calculateTagStats rename into a new tag moves the stats", () => {
  const queue = [
    {
      type: "rename",
      tagType: "Trip/Event",
      oldValue: "Snowdon",
      newValue: "Yr Wyddfa",
    },
  ];
  const { stats, tripTypeMap } = calculateTagStats(
    baseExpenses(),
    baseTagsData(),
    "all_time",
    queue,
  );
  assert.deepEqual(stats["Trip/Event"]["Yr Wyddfa"], {
    count: 2,
    income: 100,
    expense: 40,
  });
  assert.equal(stats["Trip/Event"]["Snowdon"], undefined);
  assert.equal(
    tripTypeMap["Yr Wyddfa"],
    "Day Walk",
    "type mapping must follow the rename",
  );
  assert.equal(
    stats["Type"]["Day Walk"].count,
    3,
    "type rollup must still see renamed trips",
  );
});

test("calculateTagStats delete removes a tag's stats", () => {
  const queue = [{ type: "delete", tagType: "Category", value: "Food" }];
  const { stats } = calculateTagStats(
    baseExpenses(),
    baseTagsData(),
    "all_time",
    queue,
  );
  assert.equal(stats["Category"]["Food"], undefined);
});

test("optimizeQueue cancels add followed by delete of a new tag", () => {
  const queue = [
    { type: "add", tagType: "Category", value: "Gear" },
    { type: "delete", tagType: "Category", value: "Gear" },
  ];
  assert.deepEqual(optimizeQueue(queue), []);
});

test("optimizeQueue keeps delete when the tag existed originally", () => {
  const queue = [
    { type: "add", tagType: "Category", value: "Food" },
    { type: "delete", tagType: "Category", value: "Food" },
  ];
  const result = optimizeQueue(queue, { Category: ["Food"] });
  assert.equal(result.length, 1);
  assert.equal(result[0].type, "delete");
  assert.equal(result[0].value, "Food");
});

test("optimizeQueue collapses chained renames", () => {
  const queue = [
    { type: "rename", tagType: "Category", oldValue: "A", newValue: "B" },
    { type: "rename", tagType: "Category", oldValue: "B", newValue: "C" },
  ];
  const result = optimizeQueue(queue);
  assert.equal(result.length, 1);
  assert.equal(result[0].oldValue, "A");
  assert.equal(result[0].newValue, "C");
});

test("optimizeQueue removes circular renames entirely", () => {
  const queue = [
    { type: "rename", tagType: "Category", oldValue: "A", newValue: "B" },
    { type: "rename", tagType: "Category", oldValue: "B", newValue: "A" },
  ];
  assert.deepEqual(optimizeQueue(queue), []);
});

test("optimizeQueue turns rename+delete into delete of the original", () => {
  const queue = [
    { type: "rename", tagType: "Category", oldValue: "A", newValue: "B" },
    { type: "delete", tagType: "Category", value: "B" },
  ];
  const result = optimizeQueue(queue);
  assert.equal(result.length, 1);
  assert.equal(result[0].type, "delete");
  assert.equal(result[0].value, "A");
});

test("optimizeQueue turns add+rename into add of the new name", () => {
  const queue = [
    { type: "add", tagType: "Category", value: "A" },
    { type: "rename", tagType: "Category", oldValue: "A", newValue: "B" },
  ];
  const result = optimizeQueue(queue);
  assert.equal(result.length, 1);
  assert.equal(result[0].type, "add");
  assert.equal(result[0].value, "B");
});

test("optimizeQueue keeps only the last trip type/status update", () => {
  const typeResult = optimizeQueue([
    { type: "updateTripType", oldValue: "Snowdon", newValue: "Day Walk" },
    { type: "updateTripType", oldValue: "Snowdon", newValue: "Weekend" },
  ]);
  assert.equal(typeResult.length, 1);
  assert.equal(typeResult[0].newValue, "Weekend");

  const statusResult = optimizeQueue([
    { type: "updateTripStatus", oldValue: "Snowdon", newValue: "Completed" },
    { type: "updateTripStatus", oldValue: "Snowdon", newValue: "Investment" },
  ]);
  assert.equal(statusResult.length, 1);
  assert.equal(statusResult[0].newValue, "Investment");
});

test("formatOperationsForApi produces positional arrays", () => {
  const ops = formatOperationsForApi([
    { type: "add", tagType: "Category", value: "Gear" },
    { type: "delete", tagType: "Type", value: "Old" },
    { type: "rename", tagType: "Category", oldValue: "A", newValue: "B" },
    { type: "updateTripType", oldValue: "Snowdon", newValue: "Day Walk" },
    { type: "updateTripStatus", oldValue: "Snowdon", newValue: "Completed" },
    { type: "bogus", value: "x" },
  ]);
  assert.deepEqual(ops, [
    [null, "Gear", "add", "Category"],
    ["Old", null, "delete", "Type"],
    ["A", "B", "rename", "Category"],
    ["Snowdon", "Day Walk", "updateTripType", "Trip/Event"],
    ["Snowdon", "Completed", "updateTripStatus", "Trip/Event"],
  ]);
});

const SAVE_QUEUE = [
  { type: "add", tagType: "Category", value: "A" },
  { type: "add", tagType: "Category", value: "B" },
  { type: "add", tagType: "Category", value: "C" },
  { type: "add", tagType: "Category", value: "D" },
];

const timeoutError = () => {
  const err = new Error("Request timed out.");
  err.code = "TIMEOUT";
  return err;
};

test("resolveSaveFailure: TIMEOUT drops the queue, leaves edit mode, counts ops", () => {
  const queue = [...SAVE_QUEUE, ...SAVE_QUEUE]; // 8 ops, chunks of 3
  const result = resolveSaveFailure(queue, 3, 3, timeoutError());
  assert.deepEqual(result.remainingQueue, []);
  assert.equal(result.exitEditMode, true);
  assert.match(result.message, /3 of 8 operations were saved/);
  assert.match(result.message, /next 3 may or may not/);
  assert.match(result.message, /2 were never sent/);
});

test("resolveSaveFailure: TIMEOUT on the last chunk", () => {
  const result = resolveSaveFailure(SAVE_QUEUE, 2, 10, timeoutError());
  assert.match(result.message, /next 2 may or may not/);
  assert.match(result.message, /0 were never sent/);
});

test("resolveSaveFailure: rejection with appliedOperations keeps the right tail", () => {
  const err = new Error("Operation failed at index 1");
  err.response = { success: false, appliedOperations: [{ index: 0 }] };
  const result = resolveSaveFailure(SAVE_QUEUE, 2, 2, err);
  assert.deepEqual(result.remainingQueue, SAVE_QUEUE.slice(3));
  assert.equal(result.exitEditMode, false);
  assert.match(result.message, /3 of 4 operations were saved/);
});

test("resolveSaveFailure: rejection with no applied ops keeps the unprocessed tail", () => {
  const result = resolveSaveFailure(
    SAVE_QUEUE,
    2,
    2,
    new Error("Tag already exists."),
  );
  assert.deepEqual(result.remainingQueue, SAVE_QUEUE.slice(2));
  assert.equal(result.exitEditMode, false);
  assert.match(result.message, /Tag already exists/);
});

test("resolveSaveFailure: NETWORK keeps every unconfirmed op pending", () => {
  const err = new Error("Network error during API request.");
  err.code = "NETWORK";
  const queue = [...SAVE_QUEUE, ...SAVE_QUEUE]; // 8 ops, chunks of 3
  const result = resolveSaveFailure(queue, 3, 3, err);
  assert.deepEqual(result.remainingQueue, queue.slice(3));
  assert.equal(result.exitEditMode, false);
  assert.match(result.message, /3 of 8 operations were saved/);
  assert.match(result.message, /next 3 may or may not/);
});
