// src/core/utils.js

// Shared helper functions will be added here.

/**
 * Formats a number or string into a currency string with 2 decimal places.
 * e.g. 4 -> "4.00", "4.5" -> "4.50", "1,234" -> "1234.00"
 * @param {string|number} amount
 * @returns {string}
 */
export function formatCurrency(amount) {
  if (amount === null || amount === undefined || String(amount).trim() === "") {
    return "";
  }

  const num = parseAmount(amount);
  // If result is 0 but original input wasn't a valid numeric representation, return empty
  const cleaned = String(amount).replace(/,/g, "").trim();
  if (num === 0 && cleaned !== "" && parseFloat(cleaned) !== 0) {
    return "";
  }
  return num.toFixed(2);
}

/**
 * Parses a string or number into a float, handling commas and empty values.
 * @param {string|number} amount
 * @returns {number}
 */
export function parseAmount(amount) {
  if (amount === null || amount === undefined || amount === "") {
    return 0;
  }
  if (typeof amount === "number") {
    return Number.isFinite(amount) ? amount : 0;
  }
  const parsed = parseFloat(String(amount).replace(/,/g, ""));
  return isNaN(parsed) ? 0 : parsed;
}

export function parseDate(dateString) {
  if (!dateString) return null;
  if (dateString instanceof Date) return dateString;

  // If it's a YYYY-MM-DD string, parse it as local time to avoid UTC shifts
  if (
    typeof dateString === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(dateString)
  ) {
    const [year, month, day] = dateString.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  let date = new Date(dateString);
  if (isNaN(date.getTime())) {
    const formattedDate = String(dateString).replace(/[-.]/g, "/");
    date = new Date(formattedDate);
  }
  if (isNaN(date.getTime())) return null;
  return date;
}

export function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );
  return { start, end };
}

export function getPastDaysRange(days) {
  const now = new Date();
  const start = new Date();
  start.setDate(now.getDate() - days);
  return { start, end: now };
}

export function getPastMonthsRange(months) {
  const now = new Date();
  const start = new Date();
  // Set to the 1st of the month to avoid overflow issues on the 29th-31st.
  // e.g. March 31st - 1 month would otherwise overflow to March 2nd/3rd (skipping Feb).
  // This results in a range starting from the beginning of the month 'months' ago.
  start.setDate(1);
  start.setMonth(now.getMonth() - months);
  return { start, end: now };
}

export function getPastYearRange() {
  const now = new Date();
  const start = new Date();
  start.setFullYear(now.getFullYear() - 1);
  return { start, end: now };
}

export function getDateRange(timeframe) {
  switch (timeframe) {
    case "current_month":
      return getCurrentMonthRange();
    case "past_30_days":
      return getPastDaysRange(30);
    case "past_3_months":
      return getPastMonthsRange(3);
    case "past_6_months":
      return getPastMonthsRange(6);
    case "past_year":
      return getPastYearRange();
    default:
      return getPastDaysRange(30);
  }
}

export function filterTransactionsByTimeframe(transactions, timeframe) {
  if (!transactions || transactions.length === 0) return [];
  if (timeframe === "all_time") return transactions;

  const { start, end } = getDateRange(timeframe);

  return transactions.filter((transaction) => {
    const date = parseDate(transaction.Date);
    if (!date) return false;
    return date >= start && date <= end;
  });
}

/**
 * Formats a Date object to a YYYY-MM-DD string in local time.
 * @param {Date} date
 * @returns {string}
 */
export function formatDateForInput(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Escapes HTML special characters in a string to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (typeof str !== "string") {
    str = String(str);
  }
  const matchHtmlRegExp = /["'&<>]/;
  const match = matchHtmlRegExp.exec(str);

  if (!match) {
    return str;
  }

  let escape;
  let html = "";
  let index = 0;
  let lastIndex = 0;

  for (index = match.index; index < str.length; index++) {
    switch (str.charCodeAt(index)) {
      case 34: // "
        escape = "&quot;";
        break;
      case 38: // &
        escape = "&amp;";
        break;
      case 39: // '
        escape = "&#39;";
        break;
      case 60: // <
        escape = "&lt;";
        break;
      case 62: // >
        escape = "&gt;";
        break;
      default:
        continue;
    }

    if (lastIndex !== index) {
      html += str.substring(lastIndex, index);
    }

    lastIndex = index + 1;
    html += escape;
  }

  return lastIndex !== index ? html + str.substring(lastIndex, index) : html;
}

/**
 * Sanitizes a string for use in an HTML ID.
 * @param {string} str
 * @returns {string}
 */
export function sanitizeForId(str) {
  if (typeof str !== "string") {
    str = String(str || "");
  }
  return str
    .replace(/[^a-z0-9]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Performs a deep comparison between two values to determine if they are equivalent.
 * @param {*} x
 * @param {*} y
 * @returns {boolean}
 */
export function deepEqual(x, y, visited = new WeakSet()) {
  if (x === y) return true;

  if (x === null || x === undefined || y === null || y === undefined)
    return x === y;

  if (x.constructor !== y.constructor) return false;

  if (typeof x === "object" && visited.has(x)) {
    return true;
  }

  if (x instanceof Function) {
    return x === y;
  }

  if (x instanceof RegExp) {
    return x.source === y.source && x.flags === y.flags;
  }

  if (x === y || x.valueOf() === y.valueOf()) return true;

  if (Array.isArray(x) && x.length !== y.length) return false;

  if (x instanceof Date) return false;

  if (!(x instanceof Object)) return false;
  if (!(y instanceof Object)) return false;

  visited.add(x);

  const p = Object.keys(x);
  return (
    Object.keys(y).every((i) => p.indexOf(i) !== -1) &&
    p.every((i) => deepEqual(x[i], y[i], visited))
  );
}

// Check for structuredClone availability once at module initialization
const hasStructuredClone = typeof structuredClone === "function";

/**
 * Creates a deep copy of a value.
 * Uses structuredClone if available, otherwise falls back to a custom implementation.
 * @param {*} obj
 * @returns {*}
 */
export function deepClone(obj, visited = new WeakMap()) {
  if (hasStructuredClone) {
    return structuredClone(obj);
  }

  // Throw on functions/symbols to match structuredClone behavior
  if (typeof obj === "function" || typeof obj === "symbol") {
    throw new TypeError("Cannot clone functions or symbols");
  }

  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  // Check for circular reference
  if (visited.has(obj)) {
    return visited.get(obj);
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }

  if (Array.isArray(obj)) {
    const copy = [];
    visited.set(obj, copy);
    obj.forEach((item) => copy.push(deepClone(item, visited)));
    return copy;
  }

  if (obj instanceof RegExp) {
    return new RegExp(obj.source, obj.flags);
  }

  if (obj instanceof Map) {
    const copy = new Map();
    visited.set(obj, copy);
    obj.forEach((value, key) =>
      copy.set(deepClone(key, visited), deepClone(value, visited)),
    );
    return copy;
  }

  if (obj instanceof Set) {
    const copy = new Set();
    visited.set(obj, copy);
    obj.forEach((value) => copy.add(deepClone(value, visited)));
    return copy;
  }

  // Handle plain objects and objects created with Object.create(null)
  if (typeof obj === "object") {
    const proto = Object.getPrototypeOf(obj);
    const copy = proto === null ? Object.create(null) : {};
    visited.set(obj, copy);
    Object.keys(obj).forEach((key) => {
      copy[key] = deepClone(obj[key], visited);
    });
    return copy;
  }

  // Fallback for any other object types
  return obj;
}
