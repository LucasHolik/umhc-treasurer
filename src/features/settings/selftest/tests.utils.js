// src/features/settings/selftest/tests.utils.js

import { test, assert, assertEqual, assertClose } from "./selftest.runner.js";
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
} from "../../../core/utils.js";

const SUITE = "Utils";

test(SUITE, "formatCurrency formats numbers to 2dp", () => {
  assertEqual(formatCurrency(4), "4.00");
  assertEqual(formatCurrency("4.5"), "4.50");
  assertEqual(formatCurrency(-5), "-5.00");
  assertEqual(formatCurrency(0), "0.00");
});

test(SUITE, "formatCurrency strips thousand separators", () => {
  assertEqual(formatCurrency("1,234"), "1234.00");
  assertEqual(formatCurrency("1,234,567.89"), "1234567.89");
});

test(SUITE, "formatCurrency returns empty string for invalid input", () => {
  assertEqual(formatCurrency(null), "");
  assertEqual(formatCurrency(undefined), "");
  assertEqual(formatCurrency("   "), "");
  assertEqual(formatCurrency("abc"), "");
});

test(SUITE, "parseAmount handles numbers, strings and commas", () => {
  assertEqual(parseAmount(42.5), 42.5);
  assertEqual(parseAmount("1,234.56"), 1234.56);
  assertEqual(parseAmount("-10"), -10);
});

test(SUITE, "parseAmount returns 0 for empty or invalid input", () => {
  assertEqual(parseAmount(null), 0);
  assertEqual(parseAmount(undefined), 0);
  assertEqual(parseAmount(""), 0);
  assertEqual(parseAmount("abc"), 0);
  assertEqual(parseAmount(Infinity), 0);
  assertEqual(parseAmount(NaN), 0);
});

test(SUITE, "parseDate parses YYYY-MM-DD as local midnight", () => {
  const d = parseDate("2024-03-05");
  assertEqual(d.getFullYear(), 2024);
  assertEqual(d.getMonth(), 2);
  assertEqual(d.getDate(), 5);
  assertEqual(d.getHours(), 0);
});

test(SUITE, "parseDate passes Date instances through unchanged", () => {
  const d = new Date(2024, 5, 1);
  assert(parseDate(d) === d, "expected the same Date reference back");
});

test(SUITE, "parseDate handles slash formats and rejects garbage", () => {
  const d = parseDate("2024/03/05");
  assertEqual(formatDateForInput(d), "2024-03-05");
  assertEqual(parseDate("not a date"), null);
  assertEqual(parseDate(""), null);
  assertEqual(parseDate(null), null);
});

test(SUITE, "formatDateForInput pads and round-trips", () => {
  assertEqual(formatDateForInput(new Date(2024, 0, 5)), "2024-01-05");
  assertEqual(formatDateForInput(parseDate("2024-12-31")), "2024-12-31");
});

test(SUITE, "formatDateForInput returns empty string for invalid input", () => {
  assertEqual(formatDateForInput(new Date("garbage")), "");
  assertEqual(formatDateForInput("2024-01-01"), "");
  assertEqual(formatDateForInput(null), "");
});

test(SUITE, "getCurrentMonthRange spans the whole current month", () => {
  const { start, end } = getCurrentMonthRange();
  const now = new Date();
  assertEqual(start.getDate(), 1);
  assertEqual(start.getHours(), 0);
  assertEqual(end.getMilliseconds(), 999);
  assertEqual(end.getMonth(), start.getMonth());
  assert(start <= now && now <= end, "now should fall inside the range");
});

test(SUITE, "getPastDaysRange(30) starts 30 days back at midnight", () => {
  const { start, end } = getPastDaysRange(30);
  const expectedStart = new Date(
    end.getFullYear(),
    end.getMonth(),
    end.getDate() - 30,
  );
  assertEqual(start.getTime(), expectedStart.getTime());
  assertEqual(end.getHours(), 23);
  assertEqual(end.getMilliseconds(), 999);
});

test(SUITE, "getPastMonthsRange snaps to the 1st of the month", () => {
  const { start, end } = getPastMonthsRange(3);
  assertEqual(start.getDate(), 1);
  assertEqual(start.getHours(), 0);
  const monthsApart =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());
  assertEqual(monthsApart, 3);
});

test(SUITE, "getPastYearRange starts on the 1st, one year back", () => {
  const { start, end } = getPastYearRange();
  assertEqual(start.getDate(), 1);
  assertEqual(start.getMonth(), end.getMonth());
  assertEqual(start.getFullYear(), end.getFullYear() - 1);
});

test(SUITE, "getDateRange falls back to past 30 days for unknown keys", () => {
  const { start, end } = getDateRange("nonsense_timeframe");
  const expectedStart = new Date(
    end.getFullYear(),
    end.getMonth(),
    end.getDate() - 30,
  );
  assertEqual(start.getTime(), expectedStart.getTime());
});

test(SUITE, "getLocalDayBounds expands to full local days", () => {
  const bounds = getLocalDayBounds("2024-03-01", "2024-03-05");
  assertEqual(formatDateForInput(bounds.start), "2024-03-01");
  assertEqual(formatDateForInput(bounds.end), "2024-03-05");
  assertEqual(bounds.start.getHours(), 0);
  assertEqual(bounds.end.getHours(), 23);
  assertEqual(bounds.end.getMilliseconds(), 999);
});

test(
  SUITE,
  "getLocalDayBounds rejects invalid input, keeps inputs intact",
  () => {
    assertEqual(getLocalDayBounds("garbage", "2024-03-05"), null);
    assertEqual(getLocalDayBounds(null, "2024-03-05"), null);
    const d = new Date(2024, 2, 5, 12, 30);
    getLocalDayBounds(d, d);
    assertEqual(d.getHours(), 12, "caller's Date must not be mutated");
  },
);

test(SUITE, "filterTransactionsByTimeframe all_time returns same array", () => {
  const txns = [{ Date: "2024-01-01" }];
  assert(
    filterTransactionsByTimeframe(txns, "all_time") === txns,
    "all_time should return the identical array reference",
  );
  assertEqual(filterTransactionsByTimeframe([], "all_time"), []);
  assertEqual(filterTransactionsByTimeframe(null, "current_month"), []);
});

test(
  SUITE,
  "filterTransactionsByTimeframe keeps in-range, drops the rest",
  () => {
    const today = formatDateForInput(new Date());
    const txns = [
      { Date: today },
      { Date: "1970-01-01" },
      { Date: "not a date" },
    ];
    const result = filterTransactionsByTimeframe(txns, "current_month");
    assertEqual(result.length, 1);
    assertEqual(result[0].Date, today);
  },
);

test(SUITE, "escapeHtml escapes all five special characters", () => {
  assertEqual(
    escapeHtml(`<a href="x">Tom & Jerry's</a>`),
    "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;",
  );
});

test(
  SUITE,
  "escapeHtml passes clean strings through, coerces non-strings",
  () => {
    assertEqual(escapeHtml("hello world"), "hello world");
    assertEqual(escapeHtml(5), "5");
  },
);

test(SUITE, "sanitizeForId strips and collapses special characters", () => {
  assertEqual(sanitizeForId("Hello, World!"), "Hello-World");
  assertEqual(sanitizeForId("--a--b--"), "a-b");
  assertEqual(sanitizeForId(null), "");
});

test(SUITE, "deepEqual compares nested objects and arrays", () => {
  assert(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }));
  assert(!deepEqual({ a: 1 }, { a: 1, b: 2 }), "extra key must not be equal");
  assert(!deepEqual({ a: 1, b: 2 }, { a: 1 }), "missing key must not be equal");
  assert(!deepEqual([1, 2], [1, 2, 3]), "length mismatch must not be equal");
  assert(!deepEqual(1, "1"), "different types must not be equal");
  assert(!deepEqual(null, undefined));
});

test(SUITE, "deepEqual handles Date and RegExp", () => {
  assert(deepEqual(new Date(2024, 0, 1), new Date(2024, 0, 1)));
  assert(!deepEqual(new Date(2024, 0, 1), new Date(2024, 0, 2)));
  assert(deepEqual(/ab/g, /ab/g));
  assert(!deepEqual(/ab/g, /ab/i));
});

test(SUITE, "deepEqual compares Map and Set order-independently", () => {
  assert(
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
  assert(deepEqual(new Set([1, 2, 3]), new Set([3, 2, 1])));
  assert(!deepEqual(new Set([1, 2]), new Set([1, 3])));
});

test(SUITE, "deepEqual handles circular references", () => {
  const a = { name: "x" };
  a.self = a;
  const b = { name: "x" };
  b.self = b;
  assert(deepEqual(a, b));
});

test(SUITE, "deepClone produces an independent copy", () => {
  const src = { a: { b: [1, 2, { c: 3 }] } };
  const copy = deepClone(src);
  copy.a.b[2].c = 99;
  assertEqual(src.a.b[2].c, 3, "source must be unaffected by clone mutation");
});

test(SUITE, "deepClone clones Date, Map, Set and circular refs", () => {
  const d = new Date(2024, 0, 1);
  const dCopy = deepClone(d);
  assert(dCopy !== d && dCopy.getTime() === d.getTime());

  const m = deepClone(new Map([["k", { v: 1 }]]));
  assertEqual(m.get("k"), { v: 1 });
  const s = deepClone(new Set([1, 2]));
  assert(s.has(1) && s.has(2));

  const c = { x: 1 };
  c.self = c;
  const cCopy = deepClone(c);
  assert(cCopy.self === cCopy, "circular structure must be preserved");
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test(SUITE, "debounce fires once with the last arguments", async () => {
  const calls = [];
  const d = debounce((v) => calls.push(v), 30);
  d(1);
  d(2);
  d(3);
  await sleep(80);
  assertEqual(calls, [3]);
});

test(SUITE, "debounce cancel prevents the pending call", async () => {
  const calls = [];
  const d = debounce((v) => calls.push(v), 30);
  d("x");
  d.cancel();
  await sleep(80);
  assertEqual(calls, []);
});

test(SUITE, "assertClose sanity check on float sums", () => {
  assertClose(0.1 + 0.2, 0.3);
});
