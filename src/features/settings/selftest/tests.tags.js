// src/features/settings/selftest/tests.tags.js

import { test, assert, assertEqual, assertClose } from "./selftest.runner.js";
import {
  getVirtualTripTypeMap,
  getVirtualTagList,
  getVirtualTripStatusMap,
  calculateDetailStats,
  calculateTagStats,
  optimizeQueue,
  formatOperationsForApi,
} from "../../tags/tags.logic.js";

const SUITE = "Tags logic";

test(SUITE, "getVirtualTripTypeMap applies updateTripType ops", () => {
  const map = getVirtualTripTypeMap({ Snowdon: "Day Walk" }, [
    { type: "updateTripType", oldValue: "Snowdon", newValue: "Weekend" },
    { type: "updateTripType", oldValue: "Scafell", newValue: "Day Walk" },
  ]);
  assertEqual(map, { Snowdon: "Weekend", Scafell: "Day Walk" });
});

test(SUITE, "getVirtualTripTypeMap empty newValue removes the mapping", () => {
  const map = getVirtualTripTypeMap({ Snowdon: "Day Walk" }, [
    { type: "updateTripType", oldValue: "Snowdon", newValue: "" },
  ]);
  assertEqual(map, {});
});

test(SUITE, "getVirtualTripTypeMap follows trip renames and deletes", () => {
  const renamed = getVirtualTripTypeMap({ Snowdon: "Day Walk" }, [
    {
      type: "rename",
      tagType: "Trip/Event",
      oldValue: "Snowdon",
      newValue: "Yr Wyddfa",
    },
  ]);
  assertEqual(renamed, { "Yr Wyddfa": "Day Walk" });

  const deleted = getVirtualTripTypeMap({ Snowdon: "Day Walk" }, [
    { type: "delete", tagType: "Trip/Event", value: "Snowdon" },
  ]);
  assertEqual(deleted, {});
});

test(SUITE, "getVirtualTripTypeMap follows Type renames and deletes", () => {
  const original = {
    Snowdon: "Day Walk",
    Scafell: "Day Walk",
    Alps: "Expedition",
  };
  const renamed = getVirtualTripTypeMap(original, [
    { type: "rename", tagType: "Type", oldValue: "Day Walk", newValue: "Hike" },
  ]);
  assertEqual(renamed, {
    Snowdon: "Hike",
    Scafell: "Hike",
    Alps: "Expedition",
  });

  const deleted = getVirtualTripTypeMap(original, [
    { type: "delete", tagType: "Type", value: "Day Walk" },
  ]);
  assertEqual(deleted, { Alps: "Expedition" });
});

test(SUITE, "getVirtualTagList applies add, delete and rename", () => {
  const base = ["Transport", "Food"];
  assertEqual(
    getVirtualTagList(
      base,
      [{ type: "add", tagType: "Category", value: "Gear" }],
      "Category",
    ),
    ["Transport", "Food", "Gear"],
  );
  assertEqual(
    getVirtualTagList(
      base,
      [{ type: "add", tagType: "Category", value: "Food" }],
      "Category",
    ),
    ["Transport", "Food"],
  );
  assertEqual(
    getVirtualTagList(
      base,
      [{ type: "delete", tagType: "Category", value: "Food" }],
      "Category",
    ),
    ["Transport"],
  );
  assertEqual(
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

test(SUITE, "getVirtualTagList ignores ops for other tag types", () => {
  assertEqual(
    getVirtualTagList(
      ["A"],
      [{ type: "add", tagType: "Type", value: "B" }],
      "Category",
    ),
    ["A"],
  );
});

test(
  SUITE,
  "getVirtualTripStatusMap applies status updates and defaults",
  () => {
    const updated = getVirtualTripStatusMap({ Snowdon: "Active" }, [
      { type: "updateTripStatus", oldValue: "Snowdon", newValue: "Completed" },
    ]);
    assertEqual(updated, { Snowdon: "Completed" });

    const added = getVirtualTripStatusMap({}, [
      { type: "add", tagType: "Trip/Event", value: "Scafell" },
    ]);
    assertEqual(added, { Scafell: "Active" });
  },
);

test(SUITE, "getVirtualTripStatusMap carries status through renames", () => {
  const renamed = getVirtualTripStatusMap({ Snowdon: "Completed" }, [
    {
      type: "rename",
      tagType: "Trip/Event",
      oldValue: "Snowdon",
      newValue: "Yr Wyddfa",
    },
  ]);
  assertEqual(renamed, { "Yr Wyddfa": "Completed" });

  const renamedUnknown = getVirtualTripStatusMap({}, [
    {
      type: "rename",
      tagType: "Trip/Event",
      oldValue: "Ghost",
      newValue: "Spirit",
    },
  ]);
  assertEqual(
    renamedUnknown,
    { Spirit: "Active" },
    "unknown trips default to Active",
  );

  const deleted = getVirtualTripStatusMap({ Snowdon: "Active" }, [
    { type: "delete", tagType: "Trip/Event", value: "Snowdon" },
  ]);
  assertEqual(deleted, {});
});

test(SUITE, "calculateDetailStats sums count, income and expense", () => {
  const stats = calculateDetailStats([
    { Income: "10.50", Expense: 0 },
    { Income: 0, Expense: "5.25" },
  ]);
  assertEqual(stats.count, 2);
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

test(SUITE, "calculateTagStats aggregates per trip and category", () => {
  const { stats } = calculateTagStats(
    baseExpenses(),
    baseTagsData(),
    "all_time",
  );
  assertEqual(stats["Trip/Event"]["Snowdon"], {
    count: 2,
    income: 100,
    expense: 40,
  });
  assertEqual(stats["Trip/Event"]["Scafell"], {
    count: 1,
    income: 0,
    expense: 25,
  });
  assertEqual(stats["Category"]["Transport"], {
    count: 2,
    income: 100,
    expense: 25,
  });
});

test(SUITE, "calculateTagStats rolls trip stats up into Types", () => {
  const { stats } = calculateTagStats(
    baseExpenses(),
    baseTagsData(),
    "all_time",
  );
  assertEqual(stats["Type"]["Day Walk"], {
    count: 3,
    income: 100,
    expense: 65,
  });
});

test(SUITE, "calculateTagStats backfills zero stats for unused Types", () => {
  const tags = baseTagsData();
  tags.Type.push("Expedition");
  const { stats } = calculateTagStats(baseExpenses(), tags, "all_time");
  assertEqual(stats["Type"]["Expedition"], { count: 0, income: 0, expense: 0 });
});

test(SUITE, "calculateTagStats rename merges into an existing tag", () => {
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
  assertEqual(stats["Category"]["Transport"], {
    count: 3,
    income: 100,
    expense: 65,
  });
  assertEqual(stats["Category"]["Food"], undefined);
});

test(SUITE, "calculateTagStats rename into a new tag moves the stats", () => {
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
  assertEqual(stats["Trip/Event"]["Yr Wyddfa"], {
    count: 2,
    income: 100,
    expense: 40,
  });
  assertEqual(stats["Trip/Event"]["Snowdon"], undefined);
  assertEqual(
    tripTypeMap["Yr Wyddfa"],
    "Day Walk",
    "type mapping must follow the rename",
  );
  assertEqual(
    stats["Type"]["Day Walk"].count,
    3,
    "type rollup must still see renamed trips",
  );
});

test(SUITE, "calculateTagStats delete removes a tag's stats", () => {
  const queue = [{ type: "delete", tagType: "Category", value: "Food" }];
  const { stats } = calculateTagStats(
    baseExpenses(),
    baseTagsData(),
    "all_time",
    queue,
  );
  assertEqual(stats["Category"]["Food"], undefined);
});

test(SUITE, "optimizeQueue cancels add followed by delete of a new tag", () => {
  const queue = [
    { type: "add", tagType: "Category", value: "Gear" },
    { type: "delete", tagType: "Category", value: "Gear" },
  ];
  assertEqual(optimizeQueue(queue), []);
});

test(
  SUITE,
  "optimizeQueue keeps delete when the tag existed originally",
  () => {
    const queue = [
      { type: "add", tagType: "Category", value: "Food" },
      { type: "delete", tagType: "Category", value: "Food" },
    ];
    const result = optimizeQueue(queue, { Category: ["Food"] });
    assertEqual(result.length, 1);
    assertEqual(result[0].type, "delete");
    assertEqual(result[0].value, "Food");
  },
);

test(SUITE, "optimizeQueue collapses chained renames", () => {
  const queue = [
    { type: "rename", tagType: "Category", oldValue: "A", newValue: "B" },
    { type: "rename", tagType: "Category", oldValue: "B", newValue: "C" },
  ];
  const result = optimizeQueue(queue);
  assertEqual(result.length, 1);
  assertEqual(result[0].oldValue, "A");
  assertEqual(result[0].newValue, "C");
});

test(SUITE, "optimizeQueue removes circular renames entirely", () => {
  const queue = [
    { type: "rename", tagType: "Category", oldValue: "A", newValue: "B" },
    { type: "rename", tagType: "Category", oldValue: "B", newValue: "A" },
  ];
  assertEqual(optimizeQueue(queue), []);
});

test(
  SUITE,
  "optimizeQueue turns rename+delete into delete of the original",
  () => {
    const queue = [
      { type: "rename", tagType: "Category", oldValue: "A", newValue: "B" },
      { type: "delete", tagType: "Category", value: "B" },
    ];
    const result = optimizeQueue(queue);
    assertEqual(result.length, 1);
    assertEqual(result[0].type, "delete");
    assertEqual(result[0].value, "A");
  },
);

test(SUITE, "optimizeQueue turns add+rename into add of the new name", () => {
  const queue = [
    { type: "add", tagType: "Category", value: "A" },
    { type: "rename", tagType: "Category", oldValue: "A", newValue: "B" },
  ];
  const result = optimizeQueue(queue);
  assertEqual(result.length, 1);
  assertEqual(result[0].type, "add");
  assertEqual(result[0].value, "B");
});

test(SUITE, "optimizeQueue keeps only the last trip type/status update", () => {
  const typeResult = optimizeQueue([
    { type: "updateTripType", oldValue: "Snowdon", newValue: "Day Walk" },
    { type: "updateTripType", oldValue: "Snowdon", newValue: "Weekend" },
  ]);
  assertEqual(typeResult.length, 1);
  assertEqual(typeResult[0].newValue, "Weekend");

  const statusResult = optimizeQueue([
    { type: "updateTripStatus", oldValue: "Snowdon", newValue: "Completed" },
    { type: "updateTripStatus", oldValue: "Snowdon", newValue: "Investment" },
  ]);
  assertEqual(statusResult.length, 1);
  assertEqual(statusResult[0].newValue, "Investment");
});

test(SUITE, "formatOperationsForApi produces positional arrays", () => {
  const ops = formatOperationsForApi([
    { type: "add", tagType: "Category", value: "Gear" },
    { type: "delete", tagType: "Type", value: "Old" },
    { type: "rename", tagType: "Category", oldValue: "A", newValue: "B" },
    { type: "updateTripType", oldValue: "Snowdon", newValue: "Day Walk" },
    { type: "updateTripStatus", oldValue: "Snowdon", newValue: "Completed" },
    { type: "bogus", value: "x" },
  ]);
  assertEqual(ops, [
    [null, "Gear", "add", "Category"],
    ["Old", null, "delete", "Type"],
    ["A", "B", "rename", "Category"],
    ["Snowdon", "Day Walk", "updateTripType", "Trip/Event"],
    ["Snowdon", "Completed", "updateTripStatus", "Trip/Event"],
  ]);
});
