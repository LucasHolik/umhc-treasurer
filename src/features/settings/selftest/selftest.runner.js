// src/features/settings/selftest/selftest.runner.js
//
// Minimal test runner for the built-in self-test suite.
// Tests register via test(suite, name, fn); fn is sync or async and throws
// on failure. runAll() executes them sequentially, yielding to the event
// loop after each test so the results modal can repaint live.

import { deepEqual } from "../../../core/utils.js";

const registry = [];

export function test(suite, name, fn) {
  registry.push({ suite, name, fn });
}

const describeValue = (value) => {
  try {
    if (value instanceof Map) return `Map(${JSON.stringify([...value])})`;
    if (value instanceof Set) return `Set(${JSON.stringify([...value])})`;
    if (value instanceof Date) return `Date(${value.toISOString()})`;
    const json = JSON.stringify(value);
    return json === undefined ? String(value) : json;
  } catch (_) {
    return String(value);
  }
};

export function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

export function assertEqual(actual, expected, message) {
  if (!deepEqual(actual, expected)) {
    const prefix = message ? message + " — " : "";
    throw new Error(
      `${prefix}expected ${describeValue(expected)} but got ${describeValue(actual)}`,
    );
  }
}

export function assertClose(actual, expected, epsilon = 1e-9, message) {
  if (
    typeof actual !== "number" ||
    Number.isNaN(actual) ||
    Math.abs(actual - expected) > epsilon
  ) {
    const prefix = message ? message + " — " : "";
    throw new Error(
      `${prefix}expected ~${expected} (±${epsilon}) but got ${describeValue(actual)}`,
    );
  }
}

export async function assertThrows(fn, message) {
  try {
    await fn();
  } catch (_) {
    return;
  }
  throw new Error(message || "Expected function to throw, but it did not");
}

/**
 * Runs every registered test in order.
 * @param {Object} callbacks
 * @param {function(number)} callbacks.onStart - called with the total count.
 * @param {function(Object, number)} callbacks.onResult - per-test result.
 * @param {function(Object)} callbacks.onDone - summary when finished.
 * @param {function(): boolean} callbacks.isCancelled - polled between tests.
 */
export async function runAll({ onStart, onResult, onDone, isCancelled }) {
  const total = registry.length;
  if (onStart) onStart(total);

  let passed = 0;
  let failed = 0;
  const startedAt = performance.now();

  for (let i = 0; i < total; i++) {
    if (isCancelled && isCancelled()) return null;

    const { suite, name, fn } = registry[i];
    const testStart = performance.now();
    let error = null;
    try {
      await fn();
    } catch (e) {
      error = e instanceof Error ? e : new Error(String(e));
    }
    const ms = performance.now() - testStart;

    if (error) failed++;
    else passed++;

    if (onResult) {
      onResult({ suite, name, passed: !error, error, ms }, i);
    }

    // Yield so the modal can repaint between tests.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  const summary = {
    total,
    passed,
    failed,
    durationMs: performance.now() - startedAt,
  };
  if (onDone) onDone(summary);
  return summary;
}
