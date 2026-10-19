// tests/core/utils.test.js

import { test } from "node:test";
import assert from "node:assert/strict";
import { assertClose } from "../helpers/assert.js";
import {
  formatCurrency,
  parseAmount,
  parseDate,
  formatDateForInput,
  getCurrentMonthRange,
  getPastDaysRange,
  getPastMonthsRange,
  getPastYearRange,
  getDateRange,
  getLocalDayBounds,
  filterTransactionsByTimeframe,
  escapeHtml,
  sanitizeForId,
  deepEqual,
  deepClone,
  debounce,
} from "../../src/core/utils.js";

test("formatCurrency formats numbers to 2dp", () => {
  assert.deepEqual(formatCurrency(4), "4.00");
  assert.deepEqual(formatCurrency("4.5"), "4.50");
  assert.deepEqual(formatCurrency(-5), "-5.00");
  assert.deepEqual(formatCurrency(0), "0.00");
});

test("formatCurrency strips thousand separators", () => {
  assert.deepEqual(formatCurrency("1,234"), "1234.00");
  assert.deepEqual(formatCurrency("1,234,567.89"), "1234567.89");
});

test("formatCurrency returns empty string for invalid input", () => {
  assert.deepEqual(formatCurrency(null), "");
  assert.deepEqual(formatCurrency(undefined), "");
  assert.deepEqual(formatCurrency("   "), "");
  assert.deepEqual(formatCurrency("abc"), "");
});

test("parseAmount handles numbers, strings and commas", () => {
  assert.deepEqual(parseAmount(42.5), 42.5);
  assert.deepEqual(parseAmount("1,234.56"), 1234.56);
  assert.deepEqual(parseAmount("-10"), -10);
});

test("parseAmount returns 0 for empty or invalid input", () => {
  assert.deepEqual(parseAmount(null), 0);
  assert.deepEqual(parseAmount(undefined), 0);
  assert.deepEqual(parseAmount(""), 0);
  assert.deepEqual(parseAmount("abc"), 0);
  assert.deepEqual(parseAmount(Infinity), 0);
  assert.deepEqual(parseAmount(NaN), 0);
});

test("parseDate parses YYYY-MM-DD as local midnight", () => {
  const d = parseDate("2024-03-05");
  assert.deepEqual(d.getFullYear(), 2024);
  assert.deepEqual(d.getMonth(), 2);
  assert.deepEqual(d.getDate(), 5);
  assert.deepEqual(d.getHours(), 0);
});

test("parseDate passes Date instances through unchanged", () => {
  const d = new Date(2024, 5, 1);
  assert.ok(parseDate(d) === d, "expected the same Date reference back");
});

test("parseDate handles slash formats and rejects garbage", () => {
  const d = parseDate("2024/03/05");
  assert.deepEqual(formatDateForInput(d), "2024-03-05");
  assert.deepEqual(parseDate("not a date"), null);
  assert.deepEqual(parseDate(""), null);
  assert.deepEqual(parseDate(null), null);
});

test("formatDateForInput pads and round-trips", () => {
  assert.deepEqual(formatDateForInput(new Date(2024, 0, 5)), "2024-01-05");
  assert.deepEqual(formatDateForInput(parseDate("2024-12-31")), "2024-12-31");
});

test("formatDateForInput returns empty string for invalid input", () => {
  assert.deepEqual(formatDateForInput(new Date("garbage")), "");
  assert.deepEqual(formatDateForInput("2024-01-01"), "");
  assert.deepEqual(formatDateForInput(null), "");
});

test("getCurrentMonthRange spans the whole current month", () => {
  const { start, end } = getCurrentMonthRange();
  const now = new Date();
  assert.deepEqual(start.getDate(), 1);
  assert.deepEqual(start.getHours(), 0);
  assert.deepEqual(end.getMilliseconds(), 999);
  assert.deepEqual(end.getMonth(), start.getMonth());
  assert.ok(start <= now && now <= end, "now should fall inside the range");
});

test("getPastDaysRange(30) starts 30 days back at midnight", () => {
  const { start, end } = getPastDaysRange(30);
  const expectedStart = new Date(
    end.getFullYear(),
    end.getMonth(),
    end.getDate() - 30,
  );
  assert.deepEqual(start.getTime(), expectedStart.getTime());
  assert.deepEqual(end.getHours(), 23);
  assert.deepEqual(end.getMilliseconds(), 999);
});

test("getPastMonthsRange snaps to the 1st of the month", () => {
  const { start, end } = getPastMonthsRange(3);
  assert.deepEqual(start.getDate(), 1);
  assert.deepEqual(start.getHours(), 0);
  const monthsApart =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());
  assert.deepEqual(monthsApart, 3);
});

test("getPastYearRange starts on the 1st, one year back", () => {
  const { start, end } = getPastYearRange();
  assert.deepEqual(start.getDate(), 1);
  assert.deepEqual(start.getMonth(), end.getMonth());
  assert.deepEqual(start.getFullYear(), end.getFullYear() - 1);
});

test("getDateRange falls back to past 30 days for unknown keys", () => {
  const { start, end } = getDateRange("nonsense_timeframe");
  const expectedStart = new Date(
    end.getFullYear(),
    end.getMonth(),
    end.getDate() - 30,
  );
  assert.deepEqual(start.getTime(), expectedStart.getTime());
});

test("getLocalDayBounds expands to full local days", () => {
  const bounds = getLocalDayBounds("2024-03-01", "2024-03-05");
  assert.deepEqual(formatDateForInput(bounds.start), "2024-03-01");
  assert.deepEqual(formatDateForInput(bounds.end), "2024-03-05");
  assert.deepEqual(bounds.start.getHours(), 0);
  assert.deepEqual(bounds.end.getHours(), 23);
  assert.deepEqual(bounds.end.getMilliseconds(), 999);
});

test("getLocalDayBounds rejects invalid input, keeps inputs intact", () => {
  assert.deepEqual(getLocalDayBounds("garbage", "2024-03-05"), null);
  assert.deepEqual(getLocalDayBounds(null, "2024-03-05"), null);
  const d = new Date(2024, 2, 5, 12, 30);
  getLocalDayBounds(d, d);
  assert.deepEqual(d.getHours(), 12, "caller's Date must not be mutated");
});

test("filterTransactionsByTimeframe all_time returns same array", () => {
  const txns = [{ Date: "2024-01-01" }];
  assert.ok(
    filterTransactionsByTimeframe(txns, "all_time") === txns,
    "all_time should return the identical array reference",
  );
  assert.deepEqual(filterTransactionsByTimeframe([], "all_time"), []);
  assert.deepEqual(filterTransactionsByTimeframe(null, "current_month"), []);
});

test("filterTransactionsByTimeframe keeps in-range, drops the rest", () => {
  const today = formatDateForInput(new Date());
  const txns = [
    { Date: today },
    { Date: "1970-01-01" },
    { Date: "not a date" },
  ];
  const result = filterTransactionsByTimeframe(txns, "current_month");
  assert.deepEqual(result.length, 1);
  assert.deepEqual(result[0].Date, today);
});

test("escapeHtml escapes all five special characters", () => {
  assert.deepEqual(
    escapeHtml(`<a href="x">Tom & Jerry's</a>`),
    "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;",
  );
});

test("escapeHtml passes clean strings through, coerces non-strings", () => {
  assert.deepEqual(escapeHtml("hello world"), "hello world");
  assert.deepEqual(escapeHtml(5), "5");
});

test("sanitizeForId strips and collapses special characters", () => {
  assert.deepEqual(sanitizeForId("Hello, World!"), "Hello-World");
  assert.deepEqual(sanitizeForId("--a--b--"), "a-b");
  assert.deepEqual(sanitizeForId(null), "");
});

test("deepEqual compares nested objects and arrays", () => {
  assert.ok(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }));
  assert.ok(
    !deepEqual({ a: 1 }, { a: 1, b: 2 }),
    "extra key must not be equal",
  );
  assert.ok(
    !deepEqual({ a: 1, b: 2 }, { a: 1 }),
    "missing key must not be equal",
  );
  assert.ok(!deepEqual([1, 2], [1, 2, 3]), "length mismatch must not be equal");
  assert.ok(!deepEqual(1, "1"), "different types must not be equal");
  assert.ok(!deepEqual(null, undefined));
});

test("deepEqual handles Date and RegExp", () => {
  assert.ok(deepEqual(new Date(2024, 0, 1), new Date(2024, 0, 1)));
  assert.ok(!deepEqual(new Date(2024, 0, 1), new Date(2024, 0, 2)));
  assert.ok(deepEqual(/ab/g, /ab/g));
  assert.ok(!deepEqual(/ab/g, /ab/i));
});

test("deepEqual compares Map and Set order-independently", () => {
  assert.ok(
    deepEqual(
      new Map([
        ["a", 1],
        ["b", 2],
      ]),
      new Map([
        ["b", 2],
        ["a", 1],
      ]),
    ),
  );
  assert.ok(deepEqual(new Set([1, 2, 3]), new Set([3, 2, 1])));
  assert.ok(!deepEqual(new Set([1, 2]), new Set([1, 3])));
});

test("deepEqual handles circular references", () => {
  const a = { name: "x" };
  a.self = a;
  const b = { name: "x" };
  b.self = b;
  assert.ok(deepEqual(a, b));
});

test("deepClone produces an independent copy", () => {
  const src = { a: { b: [1, 2, { c: 3 }] } };
  const copy = deepClone(src);
  copy.a.b[2].c = 99;
  assert.deepEqual(
    src.a.b[2].c,
    3,
    "source must be unaffected by clone mutation",
  );
});

test("deepClone clones Date, Map, Set and circular refs", () => {
  const d = new Date(2024, 0, 1);
  const dCopy = deepClone(d);
  assert.ok(dCopy !== d && dCopy.getTime() === d.getTime());

  const m = deepClone(new Map([["k", { v: 1 }]]));
  assert.deepEqual(m.get("k"), { v: 1 });
  const s = deepClone(new Set([1, 2]));
  assert.ok(s.has(1) && s.has(2));

  const c = { x: 1 };
  c.self = c;
  const cCopy = deepClone(c);
  assert.ok(cCopy.self === cCopy, "circular structure must be preserved");
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("debounce fires once with the last arguments", async () => {
  const calls = [];
  const d = debounce((v) => calls.push(v), 30);
  d(1);
  d(2);
  d(3);
  await sleep(80);
  assert.deepEqual(calls, [3]);
});

test("debounce cancel prevents the pending call", async () => {
  const calls = [];
  const d = debounce((v) => calls.push(v), 30);
  d("x");
  d.cancel();
  await sleep(80);
  assert.deepEqual(calls, []);
});

test("assertClose sanity check on float sums", () => {
  assertClose(0.1 + 0.2, 0.3);
});
