// tests/backend/lock.test.js
//
// Pins Service_Lock.withScriptLock: the busy response while another execution
// holds the lock, re-entrant nesting that neither takes nor releases the outer
// lock, and release when fn throws. The harness exposes the real backend
// wrapper plus the fake lock's held state, so these tests check behaviour
// rather than a copy of the implementation.

import { test } from "node:test";
import assert from "node:assert/strict";

import { createBackend } from "./harness.js";

const NOW = 1_700_000_000_000;

const BUSY = { success: false, message: "System is busy. Please try again." };

function createTestBackend(t) {
  const backend = createBackend({ now: NOW });
  t.after(() => backend.close());
  return backend;
}

test("a held lock makes withScriptLock return the busy response", (t) => {
  const backend = createTestBackend(t);

  // Hold the lock the way a concurrent execution would, outside the backend.
  backend.helpers.holdScriptLock();
  assert.equal(backend.helpers.isScriptLockHeld(), true);

  let callbackRan = false;
  const busy = backend.helpers.withScriptLock(() => {
    callbackRan = true;
    return "ran";
  });
  assert.equal(busy.success, BUSY.success);
  assert.equal(busy.message, BUSY.message);
  assert.equal(
    callbackRan,
    false,
    "the callback never runs while another execution holds the lock",
  );
  assert.equal(
    backend.helpers.getScriptLockDepth(),
    0,
    "a busy attempt never enters the lock",
  );
  assert.equal(
    backend.helpers.isScriptLockHeld(),
    true,
    "the busy attempt leaves the holder's lock alone",
  );

  // Releasing it lets the next caller through.
  backend.helpers.releaseScriptLock();
  assert.equal(backend.helpers.isScriptLockHeld(), false);
  assert.equal(
    backend.helpers.withScriptLock(() => "ran"),
    "ran",
  );
  assert.equal(backend.helpers.getScriptLockDepth(), 0);
  assert.equal(backend.helpers.isScriptLockHeld(), false);
});

test("nested calls reuse the lock and the depth unwinds to zero", (t) => {
  const backend = createTestBackend(t);
  const seen = {};

  const result = backend.helpers.withScriptLock(() => {
    seen.outerDepth = backend.helpers.getScriptLockDepth();
    seen.heldDuringOuter = backend.helpers.isScriptLockHeld();

    const inner = backend.helpers.withScriptLock(() => {
      seen.innerDepth = backend.helpers.getScriptLockDepth();
      seen.heldDuringInner = backend.helpers.isScriptLockHeld();
      return "inner";
    });

    seen.inner = inner;
    seen.afterInnerDepth = backend.helpers.getScriptLockDepth();
    seen.heldAfterInner = backend.helpers.isScriptLockHeld();
    return "outer";
  });

  assert.equal(result, "outer");
  // If the nesting branch were gone, the inner call would see the outer lock
  // held, return the busy response and never run its fn.
  assert.equal(seen.inner, "inner", "the inner call runs through the lock");
  assert.equal(seen.outerDepth, 1);
  assert.equal(seen.innerDepth, 2);
  assert.equal(seen.heldDuringOuter, true);
  assert.equal(seen.heldDuringInner, true);
  assert.equal(
    seen.afterInnerDepth,
    1,
    "the inner call unwinds only its own level",
  );
  assert.equal(
    seen.heldAfterInner,
    true,
    "the inner call never releases the outer lock",
  );

  assert.equal(backend.helpers.getScriptLockDepth(), 0);
  assert.equal(
    backend.helpers.isScriptLockHeld(),
    false,
    "the outer lock is released once the outermost fn returns",
  );

  // The lock is usable again, which proves it was released rather than lost.
  assert.equal(
    backend.helpers.withScriptLock(() => "again"),
    "again",
  );
});

test("a throw in a nested call unwinds only the inner level", (t) => {
  const backend = createTestBackend(t);
  let depthInCatch;
  let heldInCatch;

  backend.helpers.withScriptLock(() => {
    try {
      backend.helpers.withScriptLock(() => {
        throw new Error("inner boom");
      });
    } catch (error) {
      assert.match(error.message, /inner boom/);
      depthInCatch = backend.helpers.getScriptLockDepth();
      heldInCatch = backend.helpers.isScriptLockHeld();
    }
  });

  assert.equal(
    depthInCatch,
    1,
    "the nested call unwinds its own level before the catch runs",
  );
  assert.equal(
    heldInCatch,
    true,
    "the outer call still holds the lock inside the catch",
  );
  assert.equal(backend.helpers.getScriptLockDepth(), 0);
  assert.equal(
    backend.helpers.isScriptLockHeld(),
    false,
    "the outer call releases the lock after its callback returns",
  );
});

test("a throw inside fn releases the lock for a later acquisition", (t) => {
  const backend = createTestBackend(t);

  assert.throws(
    () =>
      backend.helpers.withScriptLock(() => {
        throw new Error("boom");
      }),
    /boom/,
  );

  assert.equal(backend.helpers.getScriptLockDepth(), 0);
  assert.equal(
    backend.helpers.isScriptLockHeld(),
    false,
    "the throwing call released the lock",
  );

  // A later lock acquisition succeeds...
  assert.equal(
    backend.helpers.withScriptLock(() => "after"),
    "after",
  );

  // ...and so does a real request that takes the lock.
  const response = backend.request("addTag", {
    type: "Category",
    value: "After failure",
  });
  assert.deepEqual(response, {
    success: true,
    message: "Tag added successfully.",
  });
  assert.equal(backend.sheets.cell("Tags", "D2"), "After failure");
});
