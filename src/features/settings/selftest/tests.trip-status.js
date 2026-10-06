// src/features/settings/selftest/tests.trip-status.js

import { test, assert, assertEqual } from "./selftest.runner.js";
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
} from "../../../core/trip-status.js";

const SUITE = "Trip status";

test(SUITE, "normaliseTripStatus keeps known statuses", () => {
  TRIP_STATUSES.forEach((status) => {
    assertEqual(normaliseTripStatus(status), status);
  });
});

test(SUITE, "normaliseTripStatus defaults missing/unknown to Active", () => {
  assertEqual(normaliseTripStatus(""), "Active");
  assertEqual(normaliseTripStatus(undefined), "Active");
  assertEqual(normaliseTripStatus(null), "Active");
  assertEqual(normaliseTripStatus("Foo"), "Active");
  assertEqual(normaliseTripStatus("completed"), "Active", "case-sensitive");
});

test(SUITE, "isPastTripStatus is true for the two past statuses only", () => {
  assert(isPastTripStatus("Completed"));
  assert(isPastTripStatus("Completed Investment"));
  assert(!isPastTripStatus("Active"));
  assert(!isPastTripStatus("Investment"));
  assert(!isPastTripStatus(""));
  assert(!isPastTripStatus(undefined));
  assert(!isPastTripStatus("Foo"));
});

test(SUITE, "partitionTripsByStatus splits current and past", () => {
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
  assertEqual(result.current, ["Scafell", "Kit Fund", "Ben Nevis", "Typo"]);
  assertEqual(result.past, ["Snowdon", "Old Kit"]);
});

test(SUITE, "partitionTripsByStatus drops non-strings and bad input", () => {
  const result = partitionTripsByStatus(["A", null, 3, { x: 1 }, "B"], {
    B: "Completed",
  });
  assertEqual(result, { current: ["A"], past: ["B"] });
  assertEqual(partitionTripsByStatus(undefined, undefined), {
    current: [],
    past: [],
  });
  assertEqual(partitionTripsByStatus(["toString"], {}), {
    current: ["toString"],
    past: [],
  });
});

test(SUITE, "NEXT_TRIP_STATUS cycles through all four statuses", () => {
  const seen = [];
  let status = TRIP_STATUS.ACTIVE;
  for (let i = 0; i < TRIP_STATUSES.length; i++) {
    seen.push(status);
    status = NEXT_TRIP_STATUS[status];
  }
  assertEqual(status, TRIP_STATUS.ACTIVE, "returns to Active");
  assertEqual(seen, [
    "Active",
    "Completed",
    "Investment",
    "Completed Investment",
  ]);
  assertEqual(getNextTripStatus("Foo"), "Completed", "unknown acts as Active");
});

test(SUITE, "every status has a style and all icons differ", () => {
  TRIP_STATUSES.forEach((status) => {
    const style = TRIP_STATUS_STYLES[status];
    assert(style, `missing style for ${status}`);
    assert(style.icon && style.color && style.label, `incomplete ${status}`);
  });
  const icons = TRIP_STATUSES.map((s) => TRIP_STATUS_STYLES[s].icon);
  assertEqual(new Set(icons).size, icons.length, "icons must be distinct");
  assertEqual(getTripStatusStyle("Foo"), TRIP_STATUS_STYLES.Active);
});
