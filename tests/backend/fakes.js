// tests/backend/fakes.js
//
// In-memory stand-ins for the Google Apps Script globals the backend uses.
// They are deliberately small: cell values live in a ragged array and only
// the range operations the backend calls are implemented. If a later part
// needs more, add the method it needs rather than growing this into a
// spreadsheet engine.
//
// The fakes are private to tests/backend/harness.js. Tests must never import
// this file or touch a fake directly; they work through createBackend().

import { createHmac, randomUUID } from "node:crypto";

const MILLISECONDS_PER_SECOND = 1000;
const DEFAULT_CACHE_SECONDS = 600;
const UTF_8_CHARSET = "UTF_8";

// --- Cell and A1 helpers ---------------------------------------------------

function cloneCell(value) {
  return value instanceof Date ? new Date(value.getTime()) : value;
}

function normaliseCell(value) {
  if (value === null || value === undefined) return "";
  return cloneCell(value);
}

function isBlankCell(value) {
  return value === "" || value === null || value === undefined;
}

// "B1" -> { row: 1, column: 2 }. Only single-cell references are supported;
// the backend only ever passes CONFIG's cell constants ("A1", "B2", ...).
function parseA1(a1) {
  if (typeof a1 !== "string") {
    throw new TypeError("A1 reference must be a string");
  }
  const match = /^\$?([A-Za-z]{1,3})\$?([1-9][0-9]*)$/.exec(a1.trim());
  if (!match) {
    throw new Error(`Unsupported A1 reference: ${a1}`);
  }
  let column = 0;
  for (const letter of match[1].toUpperCase()) {
    column = column * 26 + (letter.charCodeAt(0) - 64);
  }
  return { row: Number(match[2]), column };
}

function assertPositiveInteger(value, name) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
}

// Google Sheets sorts blanks last; the backend only sorts tag names, so a
// case-insensitive string comparison is close enough to the real thing. The
// comparison below is locale-independent on purpose: a locale-aware compare
// would make the order depend on the host's ICU data, so a test could pass on
// one machine and fail on another.
function compareCells(a, b) {
  const aBlank = isBlankCell(a);
  const bBlank = isBlankCell(b);
  if (aBlank || bBlank) {
    if (aBlank && bBlank) return 0;
    return aBlank ? 1 : -1;
  }
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() - b.getTime();
  }
  const left = String(a).toLowerCase();
  const right = String(b).toLowerCase();
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

// --- Write-fault injection -------------------------------------------------

// The public methods that change a sheet, and therefore the only names a
// caller may schedule a fault against. deleteRow delegates to deleteRows, so
// scheduling "deleteRows" covers both.
const WRITE_METHODS = new Set([
  "setValue",
  "setValues",
  "clearContent",
  "copyTo",
  "appendRow",
  "insertRow",
  "deleteRows",
]);

// Test-only one-shot write faults. The harness schedules one; the next
// matching write throws before changing any cell, so the backend sees an
// ordinary Apps Script write failure and its rollback paths can run. Omitting
// the method matches any write to that sheet. `skip` lets a test target a
// later matching write, for example the split promotion after the PENDING
// append: the first `skip` matches pass through and the next one throws.
function createWriteFaults() {
  const pending = [];

  function matches(fault, sheetName, method) {
    return (
      fault.sheetName === sheetName &&
      (fault.method === null || fault.method === method)
    );
  }

  return {
    schedule(sheetName, method, options = {}) {
      if (typeof sheetName !== "string" || sheetName === "") {
        throw new TypeError(
          "Write-fault sheet name must be a non-empty string",
        );
      }
      if (method !== undefined && method !== null) {
        if (!WRITE_METHODS.has(method)) {
          throw new TypeError(`Unknown write method: ${String(method)}`);
        }
      }
      if (
        options === null ||
        typeof options !== "object" ||
        Array.isArray(options)
      ) {
        throw new TypeError("Write-fault options must be an object");
      }
      const skip = options.skip === undefined ? 0 : options.skip;
      if (!Number.isInteger(skip) || skip < 0) {
        throw new TypeError("Write-fault skip must be a non-negative integer");
      }
      pending.push({
        sheetName: sheetName,
        method: method === undefined || method === null ? null : method,
        skip: skip,
      });
    },

    // Returns the one-shot error to throw, or null when no fault matches.
    // A matching fault with a remaining skip count is consumed silently.
    take(sheetName, method) {
      const index = pending.findIndex((fault) =>
        matches(fault, sheetName, method),
      );
      if (index === -1) return null;
      const fault = pending[index];
      if (fault.skip > 0) {
        fault.skip -= 1;
        return null;
      }
      pending.splice(index, 1);
      return new Error(`Injected write failure: ${method} on ${sheetName}`);
    },

    clear() {
      pending.length = 0;
    },
  };
}

// --- Spreadsheet -----------------------------------------------------------

class FakeRange {
  constructor(sheet, row, column, numRows, numColumns) {
    this.sheet = sheet;
    this.row = row;
    this.column = column;
    this.numRows = numRows;
    this.numColumns = numColumns;
  }

  // getValue and getValues return copies, as Apps Script does for dates.
  getValue() {
    return this.sheet._getCell(this.row, this.column);
  }

  getValues() {
    const values = [];
    for (let r = 0; r < this.numRows; r++) {
      const row = [];
      for (let c = 0; c < this.numColumns; c++) {
        row.push(this.sheet._getCell(this.row + r, this.column + c));
      }
      values.push(row);
    }
    return values;
  }

  setValue(value) {
    this.sheet._beforeWrite("setValue");
    this.sheet._setCell(this.row, this.column, value);
    return this;
  }

  setValues(values) {
    this.sheet._beforeWrite("setValues");
    if (!Array.isArray(values) || values.length !== this.numRows) {
      throw new Error(
        "The number of rows in the data does not match the number of rows in the range.",
      );
    }
    for (const row of values) {
      if (!Array.isArray(row) || row.length !== this.numColumns) {
        throw new Error(
          "The number of columns in the data does not match the number of columns in the range.",
        );
      }
    }
    this.sheet._setGrid(this.row, this.column, values);
    return this;
  }

  // Formats do not change the stored value in Sheets. They are recorded per
  // cell so a later test can inspect them through a fresh range, as the real
  // SpreadsheetApp does.
  setNumberFormat(format) {
    this.sheet._setNumberFormat(
      this.row,
      this.column,
      this.numRows,
      this.numColumns,
      format,
    );
    return this;
  }

  getNumberFormat() {
    return this.sheet._getNumberFormat(this.row, this.column);
  }

  clearContent() {
    this.sheet._beforeWrite("clearContent");
    for (let r = 0; r < this.numRows; r++) {
      for (let c = 0; c < this.numColumns; c++) {
        this.sheet._setCell(this.row + r, this.column + c, "");
      }
    }
    return this;
  }

  offset(rowOffset, columnOffset, numRows, numColumns) {
    const rows = numRows === undefined ? this.numRows : numRows;
    const columns = numColumns === undefined ? this.numColumns : numColumns;
    assertPositiveInteger(rows, "numRows");
    assertPositiveInteger(columns, "numColumns");
    const row = this.row + rowOffset;
    const column = this.column + columnOffset;
    assertPositiveInteger(row, "offset row");
    assertPositiveInteger(column, "offset column");
    return new FakeRange(this.sheet, row, column, rows, columns);
  }

  // Supports the single-specifier form the backend uses:
  // range.sort({ column: 1, ascending: true }). Column is 1-based within the
  // range, matching Apps Script.
  sort(sortSpec) {
    const specs = Array.isArray(sortSpec) ? sortSpec : [sortSpec];
    for (const spec of specs) {
      assertPositiveInteger(spec.column, "sort column");
      if (spec.column > this.numColumns) {
        throw new Error("Sort column is outside the range");
      }
    }
    const rows = this.getValues();
    rows.sort((a, b) => {
      for (const spec of specs) {
        const index = spec.column - 1;
        let comparison = compareCells(a[index], b[index]);
        if (spec.ascending === false) comparison = -comparison;
        if (comparison !== 0) return comparison;
      }
      return 0;
    });
    this.setValues(rows);
    return this;
  }

  // copyTo treats the destination as the top-left anchor and copies the
  // source's dimensions, which is how the tag-delete row shuffle uses it.
  // A scheduled write fault belongs to the destination sheet.
  copyTo(destination) {
    destination.sheet._beforeWrite("copyTo");
    const values = this.getValues();
    destination.sheet._setGrid(destination.row, destination.column, values);
  }
}

class FakeSheet {
  constructor(spreadsheet, name) {
    this.spreadsheet = spreadsheet;
    this.name = name;
    this._rows = [];
    this._numberFormats = new Map();
  }

  getName() {
    return this.name;
  }

  getParent() {
    return this.spreadsheet;
  }

  getLastRow() {
    for (let r = this._rows.length; r >= 1; r--) {
      const row = this._rows[r - 1];
      if (row && row.some((value) => !isBlankCell(value))) return r;
    }
    return 0;
  }

  getLastColumn() {
    let lastColumn = 0;
    for (const row of this._rows) {
      if (!row) continue;
      for (let c = row.length; c >= 1; c--) {
        if (!isBlankCell(row[c - 1])) {
          if (c > lastColumn) lastColumn = c;
          break;
        }
      }
    }
    return lastColumn;
  }

  getRange(a, b, c, d) {
    if (typeof a === "string") {
      const { row, column } = parseA1(a);
      return new FakeRange(this, row, column, 1, 1);
    }
    const row = a;
    const column = b;
    const numRows = c === undefined ? 1 : c;
    const numColumns = d === undefined ? 1 : d;
    assertPositiveInteger(row, "row");
    assertPositiveInteger(column, "column");
    assertPositiveInteger(numRows, "numRows");
    assertPositiveInteger(numColumns, "numColumns");
    return new FakeRange(this, row, column, numRows, numColumns);
  }

  getDataRange() {
    const lastRow = Math.max(1, this.getLastRow());
    const lastColumn = Math.max(1, this.getLastColumn());
    return new FakeRange(this, 1, 1, lastRow, lastColumn);
  }

  appendRow(row) {
    this._beforeWrite("appendRow");
    if (!Array.isArray(row)) throw new TypeError("appendRow expects an array");
    const targetRow = this.getLastRow() + 1;
    this._setGrid(targetRow, 1, [row]);
    return this;
  }

  insertRow(rowIndex) {
    this._beforeWrite("insertRow");
    assertPositiveInteger(rowIndex, "rowIndex");
    if (rowIndex > this._rows.length + 1) {
      throw new Error("Row index is outside the sheet");
    }
    this._rows.splice(rowIndex - 1, 0, []);
    return this;
  }

  deleteRow(rowIndex) {
    this.deleteRows(rowIndex, 1);
  }

  deleteRows(rowIndex, numRows) {
    this._beforeWrite("deleteRows");
    assertPositiveInteger(rowIndex, "rowIndex");
    assertPositiveInteger(numRows, "numRows");
    // Apps Script throws rather than ignoring a range outside the sheet. Fail
    // loudly here too, so a split rollback that deletes the wrong range cannot
    // look like it worked just because the rows were already gone.
    if (rowIndex + numRows - 1 > this._rows.length) {
      throw new Error("Those rows are out of bounds.");
    }
    this._rows.splice(rowIndex - 1, numRows);
  }

  // --- Internal storage helpers -------------------------------------------

  _beforeWrite(method) {
    this.spreadsheet._throwIfWriteFault(this.name, method);
  }

  _getCell(row, column) {
    const line = this._rows[row - 1];
    return line ? normaliseCell(line[column - 1]) : "";
  }

  // Number formats are metadata, not values, so they live beside the cells and
  // survive clearContent. Apps Script's default format reads as "General".
  _setNumberFormat(row, column, numRows, numColumns, format) {
    const value = format === null || format === undefined ? "General" : format;
    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numColumns; c++) {
        this._numberFormats.set(`${row + r},${column + c}`, String(value));
      }
    }
  }

  _getNumberFormat(row, column) {
    return this._numberFormats.get(`${row},${column}`) || "General";
  }

  _setCell(row, column, value) {
    assertPositiveInteger(row, "row");
    assertPositiveInteger(column, "column");
    if (!this._rows[row - 1]) this._rows[row - 1] = [];
    this._rows[row - 1][column - 1] = normaliseCell(value);
  }

  _setGrid(row, column, grid) {
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        this._setCell(row + r, column + c, grid[r][c]);
      }
    }
  }

  // Used by the harness to seed a sheet. Values are copied in.
  _replaceRows(rows) {
    if (!Array.isArray(rows) || rows.some((row) => !Array.isArray(row))) {
      throw new TypeError("Sheet rows must be an array of arrays");
    }
    this._rows = rows.map((row) => row.map(normaliseCell));
  }
}

class FakeSpreadsheet {
  constructor(timeZone, writeFaults) {
    this._timeZone = timeZone;
    this._sheets = new Map();
    this._writeFaults = writeFaults || createWriteFaults();
  }

  _throwIfWriteFault(sheetName, method) {
    const error = this._writeFaults.take(sheetName, method);
    if (error) throw error;
  }

  getSpreadsheetTimeZone() {
    return this._timeZone;
  }

  getSheetByName(name) {
    return this._sheets.get(name) || null;
  }

  insertSheet(name) {
    if (this._sheets.has(name)) {
      throw new Error(`A sheet with the name "${name}" already exists`);
    }
    const sheet = new FakeSheet(this, name);
    this._sheets.set(name, sheet);
    return sheet;
  }

  getSheets() {
    return [...this._sheets.values()];
  }
}

// --- Cache -----------------------------------------------------------------

// `now` lets the harness drive cache expiry from the same fixed clock as the
// backend's Date.now(), so a long test run cannot expire a session or nonce
// behind the test's back.
function createCache(now = Date.now) {
  const entries = new Map();
  const clock = typeof now === "function" ? now : Date.now;

  return {
    get(key) {
      const entry = entries.get(String(key));
      if (!entry) return null;
      if (entry.expiresAt <= clock()) {
        entries.delete(String(key));
        return null;
      }
      return entry.value;
    },

    put(key, value, seconds) {
      const ttl =
        seconds === undefined || seconds === null
          ? DEFAULT_CACHE_SECONDS
          : Number(seconds);
      entries.set(String(key), {
        value: String(value),
        expiresAt: clock() + ttl * MILLISECONDS_PER_SECOND,
      });
    },

    remove(key) {
      entries.delete(String(key));
    },

    // Test-only: a fresh backend keeps its own cache, but clearing is handy
    // when one test wants to simulate an expired session.
    clear() {
      entries.clear();
    },
  };
}

// --- Lock ------------------------------------------------------------------

function createLock() {
  let held = false;

  return {
    tryLock() {
      if (held) return false;
      held = true;
      return true;
    },

    hasLock() {
      return held;
    },

    releaseLock() {
      held = false;
    },

    // Test-only: hold the lock as if another execution had taken it, so a
    // test can force Service_Lock.withScriptLock down the busy path.
    hold() {
      held = true;
    },
  };
}

// --- Utilities -------------------------------------------------------------

function formatDate(date, timeZone, format) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError("formatDate expects a valid Date");
  }
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = {};
  for (const part of formatter.formatToParts(date)) {
    parts[part.type] = part.value;
  }
  const tokens = {
    yyyy: parts.year,
    MM: parts.month,
    dd: parts.day,
    HH: parts.hour,
    mm: parts.minute,
    ss: parts.second,
  };
  return String(format).replace(
    /yyyy|MM|dd|HH|mm|ss/g,
    (token) => tokens[token],
  );
}

// ASSUMPTION: the charset used by Apps Script's two-argument
// computeHmacSha256Signature overload is undocumented. latin1 stands in for
// that default so omitting Utilities.Charset.UTF_8 yields a different digest
// for non-ASCII text, which lets the part 2 UTF-8 test fail if production
// drops the charset argument. Production always passes Charset.UTF_8, which is
// modelled faithfully; the latin1 branch is a stand-in, not a claim about the
// real default.
function computeHmacSha256Signature(value, key, charset) {
  const encoding = charset === UTF_8_CHARSET ? "utf8" : "latin1";
  const digest = createHmac("sha256", Buffer.from(String(key), encoding))
    .update(Buffer.from(String(value), encoding))
    .digest();
  // Apps Script returns signed bytes, so a value above 127 is negative.
  return Array.from(digest, (byte) => (byte > 127 ? byte - 256 : byte));
}

const Utilities = {
  getUuid: randomUUID,
  computeHmacSha256Signature,
  formatDate,
  Charset: { UTF_8: UTF_8_CHARSET },
};

// --- ContentService --------------------------------------------------------

// Apps Script's MimeType enum values are real MIME type strings, not the enum
// field names. Code.gs sets JAVASCRIPT on every JSONP reply.
const MimeType = {
  JAVASCRIPT: "application/javascript",
  JSON: "application/json",
  TEXT: "text/plain",
};

function createTextOutput(content) {
  let text = content === undefined || content === null ? "" : String(content);
  let mimeType = MimeType.TEXT;
  const output = {
    getContent() {
      return text;
    },
    getMimeType() {
      return mimeType;
    },
    setMimeType(value) {
      mimeType = value;
      return output;
    },
  };
  return output;
}

const ContentService = { createTextOutput, MimeType };

// --- Factory ---------------------------------------------------------------

/**
 * Creates a fresh set of fakes for one harness instance.
 *
 * @param {{ timeZone?: string, now?: () => number }} [options]
 * @returns {{
 *   spreadsheet: FakeSpreadsheet,
 *   cache: object,
 *   lock: object,
 *   writeFaults: object,
 *   globals: object,
 * }}
 */
export function createFakes(options = {}) {
  const writeFaults = createWriteFaults();
  const spreadsheet = new FakeSpreadsheet(
    options.timeZone || "UTC",
    writeFaults,
  );
  const cache = createCache(options.now);
  const lock = createLock();

  return {
    spreadsheet,
    cache,
    lock,
    writeFaults,
    globals: {
      SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet },
      LockService: { getScriptLock: () => lock },
      CacheService: { getScriptCache: () => cache },
      Utilities,
      ContentService,
    },
  };
}
