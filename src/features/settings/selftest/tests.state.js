// src/features/settings/selftest/tests.state.js
//
// Tests run against the app's store singleton, so they confine themselves
// to a dedicated scratch key and always reset it in finally blocks.

import { test, assert, assertEqual, assertThrows } from "./selftest.runner.js";
import store from "../../../core/state.js";

const SUITE = "State store";
const KEY = "__selftest__";

test(SUITE, "setState/getState round-trips objects", () => {
  try {
    store.setState(KEY, { a: 1, nested: { b: [1, 2] } });
    assertEqual(store.getState(KEY), { a: 1, nested: { b: [1, 2] } });
  } finally {
    store.setState(KEY, null);
  }
});

test(SUITE, "getState returns a clone, not the internal object", () => {
  try {
    store.setState(KEY, { a: 1 });
    const out = store.getState(KEY);
    out.a = 99;
    assertEqual(store.getState(KEY).a, 1);
  } finally {
    store.setState(KEY, null);
  }
});

test(SUITE, "setState clones its input, detaching the caller's object", () => {
  try {
    const src = { a: 1 };
    store.setState(KEY, src);
    src.a = 99;
    assertEqual(store.getState(KEY).a, 1);
  } finally {
    store.setState(KEY, null);
  }
});

test(SUITE, "primitives pass through unchanged", () => {
  try {
    store.setState(KEY, 42);
    assertEqual(store.getState(KEY), 42);
    store.setState(KEY, "text");
    assertEqual(store.getState(KEY), "text");
  } finally {
    store.setState(KEY, null);
  }
});

test(
  SUITE,
  "subscribers are notified once, deep-equal sets are skipped",
  () => {
    let sub;
    try {
      let calls = 0;
      let lastValue = null;
      sub = store.subscribe(KEY, (value) => {
        calls++;
        lastValue = value;
      });
      store.setState(KEY, { count: 1 });
      assertEqual(calls, 1);
      assertEqual(lastValue, { count: 1 });

      store.setState(KEY, { count: 1 });
      assertEqual(calls, 1, "deep-equal value must not re-notify");

      store.setState(KEY, { count: 2 });
      assertEqual(calls, 2);
    } finally {
      if (sub) sub.unsubscribe();
      store.setState(KEY, null);
    }
  },
);

test(SUITE, "unsubscribe stops notifications and is idempotent", () => {
  try {
    let calls = 0;
    const sub = store.subscribe(KEY, () => calls++);
    sub.unsubscribe();
    sub.unsubscribe();
    store.setState(KEY, { fresh: Math.random() });
    assertEqual(calls, 0);
  } finally {
    store.setState(KEY, null);
  }
});

test(SUITE, "reserved and invalid keys are rejected", async () => {
  await assertThrows(() => store.setState("__proto__", { polluted: true }));
  await assertThrows(() => store.getState("constructor"));
  await assertThrows(() => store.subscribe("prototype", () => {}));
  await assertThrows(() => store.setState("", 1));
  await assertThrows(() => store.subscribe(KEY, "not a function"));
});

test(SUITE, "a throwing subscriber does not block later subscribers", () => {
  let sub1, sub2;
  try {
    let secondCalled = false;
    sub1 = store.subscribe(KEY, () => {
      throw new Error("intentional self-test error (expected in console)");
    });
    sub2 = store.subscribe(KEY, () => {
      secondCalled = true;
    });
    store.setState(KEY, { fresh: Math.random() });
    assert(secondCalled, "second subscriber must still be called");
  } finally {
    if (sub1) sub1.unsubscribe();
    if (sub2) sub2.unsubscribe();
    store.setState(KEY, null);
  }
});
