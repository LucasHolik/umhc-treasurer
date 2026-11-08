// tests/backend/harness.js
//
// Loads the Apps Script backend into a private Node vm with in-memory fakes,
// then exposes one small interface for tests:
//
//   const backend = createBackend();
//   const response = await backend.request("ping");
//   backend.close();
//
// The vm, the fakes and the backend's internals never leak out. `request`
// behaves like the browser client: it logs in, signs the JSONP parameters with
// HMAC-SHA256, calls doGet and parses the reply. The signing code here is
// written independently of Service_Auth._buildPayload so the tests do not
// grade the server against itself.
//
// Each createBackend() call gets a fresh spreadsheet, cache and lock, so tests
// stay independent. The compiled .gs script is shared, but each vm context
// gets its own top-level bindings.

import fs from "node:fs";
import vm from "node:vm";
import { createHmac, randomUUID } from "node:crypto";

import { createFakes } from "./fakes.js";

const BACKEND_DIRECTORY = new URL("../../google-apps-script/", import.meta.url);

const DEFAULT_SECRETS = Object.freeze({
  admin: "admin-pass",
  viewer: "viewer-pass",
});

// Mirrors the actions the browser signs with a nonce (requestMutating in
// src/services/api.service.js). Kept here rather than read from the backend so
// the harness has its own expectation of which actions are writes.
const WRITE_ACTIONS = new Set([
  "saveData",
  "addTag",
  "updateExpenses",
  "deleteTag",
  "renameTag",
  "processTagOperations",
  "saveOpeningBalance",
  "splitTransaction",
  "revertSplit",
  "editSplit",
]);

const VALID_ROLES = new Set(["admin", "viewer"]);

let compiledScript = null;

// Every .gs file is concatenated into one script, exactly as Apps Script gives
// them one shared global scope. The epilogue copies the handful of bindings
// the harness needs onto the context's global object.
function getBackendScript() {
  if (compiledScript) return compiledScript;

  const files = fs
    .readdirSync(BACKEND_DIRECTORY)
    .filter((file) => file.endsWith(".gs"))
    .sort();
  if (files.length === 0) {
    throw new Error("No .gs files found in google-apps-script/");
  }

  const source = files
    .map((file) => fs.readFileSync(new URL(file, BACKEND_DIRECTORY), "utf8"))
    .join("\n\n");

  const epilogue = `
globalThis.__UMHC_BACKEND__ = {
  CONFIG: CONFIG,
  doGet: doGet,
  helpers: {
    _sanitizeForSheet: _sanitizeForSheet,
    _sanitizeGridForSheet: _sanitizeGridForSheet,
    validateJsonParameter: validateJsonParameter
  }
};
`;

  compiledScript = new vm.Script(source + epilogue, {
    filename: "google-apps-script/backend.gs",
  });
  return compiledScript;
}

function canonicalise(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => canonicalise(item));
  const output = {};
  for (const key of Object.keys(value).sort()) {
    output[key] = canonicalise(value[key]);
  }
  return output;
}

function canonicalStringify(value) {
  return JSON.stringify(canonicalise(value));
}

// Matches the browser: object values are JSON-encoded, everything else is
// stringified. URL parameters in Apps Script arrive as strings.
function stringifyParams(params) {
  const output = {};
  for (const key of Object.keys(params)) {
    const value = params[key];
    output[key] =
      typeof value === "object" && value !== null
        ? canonicalStringify(value)
        : String(value);
  }
  return output;
}

function buildPayload(action, timestamp, params) {
  return action + "|" + timestamp + "|" + canonicalStringify(params);
}

function computeSignature(payload, secret) {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

// The browser turns the reply into a script that calls the requested name, so
// the name must be a callable identifier. The server's regex accepts reserved
// words such as `false`, which is B-003; the harness is deliberately stricter
// so a future fix can be regression-tested, and so request() never parses a
// wrapper that the browser could not call.
const CALLBACK_IDENTIFIER = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
const RESERVED_CALLBACK_NAMES = new Set([
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "let",
  "new",
  "null",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "undefined",
  "var",
  "void",
  "while",
  "with",
  "yield",
  "NaN",
  "Infinity",
]);

function safeCallbackName(callback) {
  return typeof callback === "string" &&
    CALLBACK_IDENTIFIER.test(callback) &&
    !RESERVED_CALLBACK_NAMES.has(callback)
    ? callback
    : "callback";
}

// Apps Script returns a TextOutput. Returns both the exact JSONP text (for
// requestRaw) and the parsed response.
function parseJsonp(output, requestedCallback) {
  const raw = output.getContent();
  const match = /^([a-zA-Z_$][a-zA-Z0-9_$]*)\(([\s\S]*)\)$/.exec(raw);
  if (!match) {
    throw new Error("Backend reply is not valid JSONP: " + raw);
  }

  const expectedCallback = safeCallbackName(requestedCallback);
  if (match[1] !== expectedCallback) {
    throw new Error(
      `Backend used JSONP callback "${match[1]}" instead of "${expectedCallback}"`,
    );
  }
  return { raw, response: JSON.parse(match[2]) };
}

/**
 * Builds a fresh backend harness.
 *
 * @param {object} [options]
 * @param {Record<string, Array<Array<*>>>} [options.sheets] Sheet name to rows
 *   (including the header row). These replace the matching default sheets;
 *   other defaults remain. Defaults: Config with the test passkeys and opening
 *   balance 0, and Finances with CONFIG.HEADERS.
 * @param {{ admin?: string, viewer?: string }} [options.secrets] Passkeys used
 *   for login, defaulting to "admin-pass" and "viewer-pass". They are also
 *   written into the default Config sheet.
 * @param {string} [options.timeZone] Spreadsheet time zone, default "UTC".
 * @returns {{
 *   request: Function,
 *   requestRaw: Function,
 *   sheets: object,
 *   cache: object,
 *   helpers: object,
 *   close: Function,
 * }}
 */
export function createBackend(options = {}) {
  if (options === null || typeof options !== "object") {
    throw new TypeError("createBackend options must be an object");
  }

  const secrets = { ...DEFAULT_SECRETS, ...(options.secrets || {}) };
  const fakes = createFakes({ timeZone: options.timeZone });
  const sandbox = {
    ...fakes.globals,
    console,
    // Share Node's Date with the vm so host-seeded dates satisfy the
    // backend's `instanceof Date` checks, and so tests can control the clock.
    Date,
  };
  const context = vm.createContext(sandbox, {
    name: "umhc-apps-script-backend",
  });
  getBackendScript().runInContext(context);

  const backendApi = sandbox.__UMHC_BACKEND__;
  if (!backendApi) {
    throw new Error("The backend script did not expose its entry points");
  }

  const sessions = new Map();
  let closed = false;

  const defaultSheets = {
    Config: [
      [
        backendApi.CONFIG.API_KEY_TITLE,
        backendApi.CONFIG.VIEW_ONLY_API_KEY_TITLE,
        backendApi.CONFIG.OPENING_BALANCE_TITLE,
      ],
      [secrets.admin, secrets.viewer, 0],
    ],
    Finances: [backendApi.CONFIG.HEADERS.slice()],
  };
  for (const [name, rows] of Object.entries({
    ...defaultSheets,
    ...(options.sheets || {}),
  })) {
    const sheet =
      fakes.spreadsheet.getSheetByName(name) ||
      fakes.spreadsheet.insertSheet(name);
    sheet._replaceRows(rows);
  }

  function assertOpen() {
    if (closed) throw new Error("Backend harness is closed");
  }

  function getSheet(name) {
    const sheet = fakes.spreadsheet.getSheetByName(name);
    if (!sheet) throw new Error(`Unknown sheet: ${name}`);
    return sheet;
  }

  function getOrCreateSheet(name) {
    return (
      fakes.spreadsheet.getSheetByName(name) ||
      fakes.spreadsheet.insertSheet(name)
    );
  }

  function buildParameter(
    action,
    params,
    { role, signed, callback, sessionId, sessionKey, signature },
  ) {
    const transmitted = stringifyParams(params);
    if (action !== "login") {
      if (!sessionId)
        throw new Error("Cannot sign a request without a session");
      transmitted.sessionId = sessionId;
    }
    if (WRITE_ACTIONS.has(action)) {
      transmitted.nonce = randomUUID();
    }

    const timestamp = String(Date.now());
    const callbackName =
      callback === undefined || callback === null
        ? "callback"
        : String(callback);

    const parameter = {
      action,
      timestamp,
      ...transmitted,
      callback: callbackName,
    };

    if (signed) {
      if (signature !== undefined) {
        // Test-only: send exactly this string instead of signing. Used to
        // prove the server rejects a well-formed but wrong signature.
        parameter.signature = String(signature);
      } else {
        const secret = action === "login" ? secrets[role] : sessionKey;
        if (typeof secret !== "string" || secret === "") {
          throw new Error(`No signing secret available for ${role}`);
        }
        parameter.signature = computeSignature(
          buildPayload(action, timestamp, transmitted),
          secret,
        );
      }
    }

    return { parameter, callbackName };
  }

  function callBackend(parameter) {
    return backendApi.doGet({ parameter });
  }

  function ensureSession(role) {
    if (sessions.has(role)) return sessions.get(role);

    const { parameter, callbackName } = buildParameter(
      "login",
      {},
      {
        role,
        signed: true,
        callback: "callback",
      },
    );
    const { response } = parseJsonp(callBackend(parameter), callbackName);
    if (!response.success) {
      const error = new Error(
        `Harness login failed for ${role}: ${response.message || "unknown error"}`,
      );
      error.response = response;
      throw error;
    }

    const session = {
      sessionId: response.sessionId,
      sessionKey: response.sessionKey,
    };
    sessions.set(response.role === "viewer" ? "viewer" : "admin", session);
    return session;
  }

  function sendRequest(action, params, requestOptions) {
    assertOpen();
    if (typeof action !== "string" || action === "") {
      throw new TypeError("action must be a non-empty string");
    }
    if (
      params === null ||
      typeof params !== "object" ||
      Array.isArray(params)
    ) {
      throw new TypeError("params must be an object");
    }
    if (
      requestOptions === null ||
      typeof requestOptions !== "object" ||
      Array.isArray(requestOptions)
    ) {
      throw new TypeError("request options must be an object");
    }

    const role =
      requestOptions.role === undefined ? "admin" : requestOptions.role;
    if (!VALID_ROLES.has(role)) {
      throw new Error(`Unknown role: ${role}`);
    }
    const signed = requestOptions.signed !== false;
    const callback = requestOptions.callback;
    // Test-only: a caller-supplied signature string replaces the computed one.
    const signature = requestOptions.signature;

    let output;
    let callbackName;
    let response;

    if (action === "login") {
      const built = buildParameter("login", params, {
        role,
        signed,
        callback,
        signature,
      });
      output = callBackend(built.parameter);
      callbackName = built.callbackName;
      ({ response } = parseJsonp(output, callbackName));
      if (response.success) {
        sessions.set(response.role === "viewer" ? "viewer" : "admin", {
          sessionId: response.sessionId,
          sessionKey: response.sessionKey,
        });
      }
    } else {
      const session = ensureSession(role);
      const built = buildParameter(action, params, {
        role,
        signed,
        callback,
        signature,
        sessionId: session.sessionId,
        sessionKey: session.sessionKey,
      });
      output = callBackend(built.parameter);
      callbackName = built.callbackName;
      ({ response } = parseJsonp(output, callbackName));

      // Mirror the client: a successful logout drops the local session, so the
      // next request logs in again instead of reusing a revoked session.
      if (action === "logout" && response.success) {
        sessions.delete(role);
      }
    }

    return {
      raw: output.getContent(),
      mimeType: output.getMimeType(),
      response,
    };
  }

  /**
   * Sends one request through doGet and returns the server's response object.
   *
   * The `signature` request option is test-only: it sends that exact string as
   * the signature instead of computing a correct one, so a test can prove the
   * server rejects a well-formed but wrong signature. `signed: false` still
   * sends no signature at all.
   *
   * @param {string} action
   * @param {object} [params] Parameters to sign and transmit.
   * @param {{
   *   role?: "admin" | "viewer",
   *   signed?: boolean,
   *   callback?: string,
   *   signature?: string,
   * }} [requestOptions]
   * @returns {object}
   */
  function request(action, params = {}, requestOptions = {}) {
    return sendRequest(action, params, requestOptions).response;
  }

  /**
   * Like request(), but also returns the exact JSONP text and the reply's MIME
   * type, so a test can assert the wrapper rather than only the parsed object.
   *
   * @param {string} action
   * @param {object} [params]
   * @param {object} [requestOptions] Same options as request().
   * @returns {{ raw: string, mimeType: string, response: object }}
   */
  function requestRaw(action, params = {}, requestOptions = {}) {
    return sendRequest(action, params, requestOptions);
  }

  const sheets = {
    names() {
      assertOpen();
      return fakes.spreadsheet.getSheets().map((sheet) => sheet.getName());
    },

    // Returns the used range, header included, as a 2D array. An empty sheet
    // returns []. Values are copies, so a test cannot mutate the fake by
    // editing what it read.
    get(name) {
      assertOpen();
      const sheet = getSheet(name);
      const lastRow = sheet.getLastRow();
      if (lastRow === 0) return [];
      const lastColumn = sheet.getLastColumn();
      return sheet.getRange(1, 1, lastRow, lastColumn).getValues();
    },

    // Replaces a sheet's contents. Rows include the header row.
    set(name, rows) {
      assertOpen();
      getOrCreateSheet(name)._replaceRows(rows);
    },

    cell(name, a1) {
      assertOpen();
      return getSheet(name).getRange(a1).getValue();
    },

    setCell(name, a1, value) {
      assertOpen();
      getOrCreateSheet(name).getRange(a1).setValue(value);
    },
  };

  const helpers = Object.freeze({
    /** Test-only: prefix a value before it is written to a sheet. */
    _sanitizeForSheet: backendApi.helpers._sanitizeForSheet,
    /** Test-only: sanitise a getValues()-style grid. */
    _sanitizeGridForSheet: backendApi.helpers._sanitizeGridForSheet,
    /** Test-only: classify a JSON parameter before a backend action uses it. */
    validateJsonParameter: backendApi.helpers.validateJsonParameter,
  });

  function close() {
    if (closed) return;
    closed = true;
    sessions.clear();
    fakes.cache.clear();
    fakes.lock.releaseLock();
  }

  return {
    request,
    requestRaw,
    sheets,
    cache: fakes.cache,
    helpers,
    close,
  };
}
