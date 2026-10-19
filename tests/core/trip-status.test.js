// tests/core/trip-status.test.js

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TRIP_STATUS,
  TRIP_STATUSES,
  TRIP_STATUS_STYLES,
  NEXT_TRIP_STATUS,
  normaliseTripStatus,
  isPastTripStatus,
  getTripStatusStyle,
  getNextTripStatus,
  partitionTripsByStatus,
} from "../../src/core/trip-status.js";

test("normaliseTripStatus keeps known statuses", () => {
  TRIP_STATUSES.forEach((status) => {
    assert.deepEqual(normaliseTripStatus(status), status);
  });
});

test("normaliseTripStatus defaults missing/unknown to Active", () => {
  assert.deepEqual(normaliseTripStatus(""), "Active");
  assert.deepEqual(normaliseTripStatus(undefined), "Active");
  assert.deepEqual(normaliseTripStatus(null), "Active");
  assert.deepEqual(normaliseTripStatus("Foo"), "Active");
  assert.deepEqual(
    normaliseTripStatus("completed"),
    "Active",
    "case-sensitive",
  );
});

test("isPastTripStatus is true for the two past statuses only", () => {
  assert.ok(isPastTripStatus("Completed"));
  assert.ok(isPastTripStatus("Completed Investment"));
  assert.ok(!isPastTripStatus("Active"));
  assert.ok(!isPastTripStatus("Investment"));
  assert.ok(!isPastTripStatus(""));
  assert.ok(!isPastTripStatus(undefined));
  assert.ok(!isPastTripStatus("Foo"));
});

test("partitionTripsByStatus splits current and past", () => {
  const result = partitionTripsByStatus(
    ["Snowdon", "Scafell", "Kit Fund", "Old Kit", "Ben Nevis", "Typo"],
    {
      Snowdon: "Completed",
      Scafell: "Active",
      "Kit Fund": "Investment",
      "Old Kit": "Completed Investment",
      Typo: "Complete",
    },
  );
  assert.deepEqual(result.current, [
    "Scafell",
    "Kit Fund",
    "Ben Nevis",
    "Typo",
  ]);
  assert.deepEqual(result.past, ["Snowdon", "Old Kit"]);
});

test("partitionTripsByStatus drops non-strings and bad input", () => {
  const result = partitionTripsByStatus(["A", null, 3, { x: 1 }, "B"], {
    B: "Completed",
  });
  assert.deepEqual(result, { current: ["A"], past: ["B"] });
  assert.deepEqual(partitionTripsByStatus(undefined, undefined), {
    current: [],
    past: [],
  });
  assert.deepEqual(partitionTripsByStatus(["toString"], {}), {
    current: ["toString"],
    past: [],
  });
});

test("NEXT_TRIP_STATUS cycles through all four statuses", () => {
  const seen = [];
  let status = TRIP_STATUS.ACTIVE;
  for (let i = 0; i < TRIP_STATUSES.length; i++) {
    seen.push(status);
    status = NEXT_TRIP_STATUS[status];
  }
  assert.deepEqual(status, TRIP_STATUS.ACTIVE, "returns to Active");
  assert.deepEqual(seen, [
    "Active",
    "Completed",
    "Investment",
    "Completed Investment",
  ]);
  assert.deepEqual(
    getNextTripStatus("Foo"),
    "Completed",
    "unknown acts as Active",
  );
});

test("every status has a style and all icons differ", () => {
  TRIP_STATUSES.forEach((status) => {
    const style = TRIP_STATUS_STYLES[status];
    assert.ok(style, `missing style for ${status}`);
    assert.ok(style.icon && style.color && style.label, `incomplete ${status}`);
  });
  const icons = TRIP_STATUSES.map((s) => TRIP_STATUS_STYLES[s].icon);
  assert.deepEqual(new Set(icons).size, icons.length, "icons must be distinct");
  assert.deepEqual(getTripStatusStyle("Foo"), TRIP_STATUS_STYLES.Active);
});
