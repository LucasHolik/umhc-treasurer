// tests/core/state.test.js
//
// Tests run against the app's store singleton, so they confine themselves
// to a dedicated scratch key and always reset it in finally blocks.

import { test } from "node:test";
import assert from "node:assert/strict";
import store from "../../src/core/state.js";

const KEY = "__test__";

test("setState/getState round-trips objects", () => {
  try {
    store.setState(KEY, { a: 1, nested: { b: [1, 2] } });
    assert.deepEqual(store.getState(KEY), { a: 1, nested: { b: [1, 2] } });
  } finally {
    store.setState(KEY, null);
  }
});

test("getState returns a clone, not the internal object", () => {
  try {
    store.setState(KEY, { a: 1 });
    const out = store.getState(KEY);
    out.a = 99;
    assert.deepEqual(store.getState(KEY).a, 1);
  } finally {
    store.setState(KEY, null);
  }
});

test("setState clones its input, detaching the caller's object", () => {
  try {
    const src = { a: 1 };
    store.setState(KEY, src);
    src.a = 99;
    assert.deepEqual(store.getState(KEY).a, 1);
  } finally {
    store.setState(KEY, null);
  }
});

test("primitives pass through unchanged", () => {
  try {
    store.setState(KEY, 42);
    assert.deepEqual(store.getState(KEY), 42);
    store.setState(KEY, "text");
    assert.deepEqual(store.getState(KEY), "text");
  } finally {
    store.setState(KEY, null);
  }
});

test("subscribers are notified once, deep-equal sets are skipped", () => {
  let sub;
  try {
    let calls = 0;
    let lastValue = null;
    sub = store.subscribe(KEY, (value) => {
      calls++;
      lastValue = value;
    });
    store.setState(KEY, { count: 1 });
    assert.deepEqual(calls, 1);
    assert.deepEqual(lastValue, { count: 1 });

    store.setState(KEY, { count: 1 });
    assert.deepEqual(calls, 1, "deep-equal value must not re-notify");

    store.setState(KEY, { count: 2 });
    assert.deepEqual(calls, 2);
  } finally {
    if (sub) sub.unsubscribe();
    store.setState(KEY, null);
  }
});

test("unsubscribe stops notifications and is idempotent", () => {
  try {
    let calls = 0;
    const sub = store.subscribe(KEY, () => calls++);
    sub.unsubscribe();
    sub.unsubscribe();
    store.setState(KEY, { fresh: Math.random() });
    assert.deepEqual(calls, 0);
  } finally {
    store.setState(KEY, null);
  }
});

test("reserved and invalid keys are rejected", async () => {
  assert.throws(() => store.setState("__proto__", { polluted: true }));
  assert.throws(() => store.getState("constructor"));
  assert.throws(() => store.subscribe("prototype", () => {}));
  assert.throws(() => store.setState("", 1));
  assert.throws(() => store.subscribe(KEY, "not a function"));
});

test("a throwing subscriber does not block later subscribers", (t) => {
  const consoleError = t.mock.method(console, "error", () => {});
  let sub1, sub2;
  try {
    let secondCalled = false;
    sub1 = store.subscribe(KEY, () => {
      throw new Error("intentional test error");
    });
    sub2 = store.subscribe(KEY, () => {
      secondCalled = true;
    });
    store.setState(KEY, { fresh: Math.random() });
    assert.ok(secondCalled, "second subscriber must still be called");
    assert.equal(consoleError.mock.callCount(), 1, "the error is logged");
  } finally {
    if (sub1) sub1.unsubscribe();
    if (sub2) sub2.unsubscribe();
    store.setState(KEY, null);
  }
});
