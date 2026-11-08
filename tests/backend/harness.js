// tests/backend/harness.js
//
// Loads the Apps Script backend into a private Node vm with in-memory fakes,
// then exposes one small interface for tests:
//
//   const backend = createBackend();
//   const response = await backend.request("ping");
//   backend.close();
//
// The vm and the fakes stay private; a small test-only surface (`request`,
// `requestRaw`, `login`, `sheets`, `cache` and `helpers`) is exposed instead.
// `request` behaves like the browser client: it logs in, signs the JSONP
// parameters with HMAC-SHA256, calls doGet and parses the reply. The signing
// code here is written independently of Service_Auth._buildPayload so the
// tests do not grade the server against itself.
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
    validateJsonParameter: validateJsonParameter,
    withScriptLock: Service_Lock.withScriptLock,
    getScriptLockDepth: function () {
      return _scriptLockDepth;
    }
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
 * Test-only fixed clock. The backend reads the current time in two places that
 * matter here: the five-minute timestamp window and the login lockout bucket
 * (`Math.floor(Date.now() / 600000)`). A test that drives ten failed logins
 * would otherwise flake if it straddled a ten-minute boundary. The fake cache
 * uses the same clock, so a run cannot expire a session or nonce behind the
 * test's back.
 *
 * @param {number} initialNow Milliseconds since the epoch.
 */
function createClock(initialNow) {
  if (!Number.isFinite(initialNow)) {
    throw new TypeError("now must be a finite number of milliseconds");
  }
  return {
    now() {
      return initialNow;
    },
  };
}

// A Date stand-in for the vm whose now() and no-argument constructor read the
// harness clock. Constructing with arguments (including Date.UTC and
// Date.parse results) behaves exactly like the host Date, and host-created
// dates still satisfy `instanceof Date` inside the vm because the proxy's
// target is the host Date.
function createClockDate(clock) {
  return new Proxy(Date, {
    get(target, property, receiver) {
      if (property === "now") return () => clock.now();
      return Reflect.get(target, property, receiver);
    },
    construct(target, args) {
      return args.length === 0 ? new target(clock.now()) : new target(...args);
    },
  });
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
 * @param {number} [options.now] Test-only: fixed clock in milliseconds since
 *   the epoch. It drives the backend's Date.now(), `new Date()`, the timestamp
 *   window and the cache TTL. Defaults to the real time at creation.
 * @returns {{
 *   request: Function,
 *   requestRaw: Function,
 *   login: Function,
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

  const clock = createClock(
    options.now === undefined ? Date.now() : options.now,
  );
  const secrets = { ...DEFAULT_SECRETS, ...(options.secrets || {}) };
  const fakes = createFakes({ timeZone: options.timeZone, now: clock.now });
  const sandbox = {
    ...fakes.globals,
    console,
    // The backend's only clock is Date. The proxy keeps the realm's Date
    // behaviour (including host-seeded dates satisfying `instanceof Date`)
    // while making Date.now() and `new Date()` follow the harness clock.
    Date: createClockDate(clock),
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
    { role, signed, callback, session, timestamp, nonce, secret, signature },
  ) {
    const transmitted = stringifyParams(params);
    if (action !== "login") {
      if (!session) throw new Error("Cannot sign a request without a session");
      transmitted.sessionId = session.sessionId;
    }
    if (WRITE_ACTIONS.has(action)) {
      // Test-only: a caller-supplied nonce lets a test replay the same write.
      transmitted.nonce = nonce === undefined ? randomUUID() : String(nonce);
    }

    // Test-only: a caller-supplied timestamp is signed as well as sent, so a
    // stale but otherwise correct request is rejected for its timestamp only.
    const timestampString =
      timestamp === undefined ? String(clock.now()) : String(timestamp);
    const callbackName =
      callback === undefined || callback === null
        ? "callback"
        : String(callback);

    const parameter = {
      action,
      timestamp: timestampString,
      ...transmitted,
      callback: callbackName,
    };

    if (signed) {
      if (signature !== undefined) {
        // Test-only: send exactly this string instead of signing. Used to
        // prove the server rejects a well-formed but wrong signature.
        parameter.signature = String(signature);
      } else {
        // Test-only: `secret` signs a login with a deliberately wrong passkey.
        const signingSecret =
          secret !== undefined
            ? secret
            : action === "login"
              ? secrets[role]
              : session.sessionKey;
        if (typeof signingSecret !== "string" || signingSecret === "") {
          throw new Error(`No signing secret available for ${role}`);
        }
        parameter.signature = computeSignature(
          buildPayload(action, timestampString, transmitted),
          signingSecret,
        );
      }
    }

    return { parameter, callbackName };
  }

  function callBackend(parameter) {
    return backendApi.doGet({ parameter });
  }

  function rememberSession(response) {
    const role = response.role === "viewer" ? "viewer" : "admin";
    const session = {
      sessionId: response.sessionId,
      sessionKey: response.sessionKey,
      role,
    };
    sessions.set(role, session);
    return session;
  }

  /**
   * Test-only: logs a role in and returns its session credentials, so a test
   * can log out and then reuse the old credentials to prove they are dead.
   * Unlike request(), this throws if the login fails.
   *
   * @param {"admin" | "viewer"} role
   * @returns {{ sessionId: string, sessionKey: string, role: string }}
   */
  function login(role) {
    assertOpen();
    if (!VALID_ROLES.has(role)) {
      throw new Error(`Unknown role: ${role}`);
    }
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
    return rememberSession(response);
  }

  function ensureSession(role) {
    return sessions.has(role) ? sessions.get(role) : login(role);
  }

  // Test-only: a supplied session must be a real login response, so a typo
  // fails loudly here rather than as a puzzling Unauthorized from the server.
  function resolveSession(session) {
    if (
      session === null ||
      typeof session !== "object" ||
      Array.isArray(session)
    ) {
      throw new TypeError(
        "session must be an object with sessionId, sessionKey and role",
      );
    }
    if (
      typeof session.sessionId !== "string" ||
      session.sessionId === "" ||
      typeof session.sessionKey !== "string" ||
      session.sessionKey === ""
    ) {
      throw new TypeError(
        "session must contain non-empty sessionId and sessionKey strings",
      );
    }
    if (!VALID_ROLES.has(session.role)) {
      throw new TypeError("session must contain a valid role");
    }
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

    const suppliedRole = requestOptions.role;
    if (suppliedRole !== undefined && !VALID_ROLES.has(suppliedRole)) {
      throw new Error(`Unknown role: ${suppliedRole}`);
    }
    const signed = requestOptions.signed !== false;
    const callback = requestOptions.callback;
    // Test-only overrides.
    const signature = requestOptions.signature;
    const timestamp = requestOptions.timestamp;
    const nonce = requestOptions.nonce;
    const secret = requestOptions.secret;
    const suppliedSession = requestOptions.session;

    let output;
    let callbackName;
    let response;

    if (action === "login") {
      const role = suppliedRole === undefined ? "admin" : suppliedRole;
      const built = buildParameter("login", params, {
        role,
        signed,
        callback,
        timestamp,
        nonce,
        secret,
        signature,
      });
      output = callBackend(built.parameter);
      callbackName = built.callbackName;
      ({ response } = parseJsonp(output, callbackName));
      if (response.success) rememberSession(response);
    } else {
      // Test-only: an explicit session sends those credentials instead of the
      // harness's cached login, so a test can prove a logged-out session dies.
      const session =
        suppliedSession === undefined
          ? ensureSession(suppliedRole === undefined ? "admin" : suppliedRole)
          : resolveSession(suppliedSession);
      // A session carries its own role. Silently ignoring a contradicting
      // explicit role would hide a test typo, so reject the pair instead.
      if (suppliedRole !== undefined && suppliedRole !== session.role) {
        throw new TypeError(
          `session role "${session.role}" does not match requested role "${suppliedRole}"`,
        );
      }
      const built = buildParameter(action, params, {
        role: session.role,
        signed,
        callback,
        session,
        timestamp,
        nonce,
        secret,
        signature,
      });
      output = callBackend(built.parameter);
      callbackName = built.callbackName;
      ({ response } = parseJsonp(output, callbackName));

      // Mirror the client: a successful logout drops the local session, so the
      // next request logs in again instead of reusing a revoked session.
      if (action === "logout" && response.success) {
        for (const [cachedRole, cached] of sessions) {
          if (cached.sessionId === session.sessionId) {
            sessions.delete(cachedRole);
          }
        }
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
   * The `signature`, `timestamp`, `nonce`, `secret` and `session` request
   * options are test-only. `signature` sends that exact string instead of
   * computing one; `timestamp` overrides the signed timestamp; `nonce`
   * overrides the generated write nonce so it can be replayed; `secret`
   * overrides the signing key (used to log in with a wrong passkey); and
   * `session` sends explicit credentials instead of the harness's own login.
   * A supplied session's own role is used, and an explicit `role` that
   * contradicts it is a TypeError. `signed: false` still sends no signature at
   * all.
   *
   * @param {string} action
   * @param {object} [params] Parameters to sign and transmit.
   * @param {{
   *   role?: "admin" | "viewer",
   *   signed?: boolean,
   *   callback?: string,
   *   signature?: string,
   *   timestamp?: number | string,
   *   nonce?: string,
   *   secret?: string,
   *   session?: {
   *     sessionId: string,
   *     sessionKey: string,
   *     role: "admin" | "viewer",
   *   },
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

    /** Test-only: run fn under the backend's re-entrant lock wrapper. */
    withScriptLock: backendApi.helpers.withScriptLock,
    /**
     * Test-only: the backend's current lock depth. It is 1 while this
     * execution holds the lock and grows for nested calls; 0 means no lock.
     */
    getScriptLockDepth: backendApi.helpers.getScriptLockDepth,
    /** Test-only: hold the fake script lock as another execution would. */
    holdScriptLock() {
      fakes.lock.hold();
    },
    /**
     * Test-only: release a lock the test took with holdScriptLock. It clears
     * the fake lock unconditionally, so it is only safe for that use.
     */
    releaseScriptLock() {
      fakes.lock.releaseLock();
    },
    /** Test-only: whether the fake script lock is currently held. */
    isScriptLockHeld() {
      return fakes.lock.hasLock();
    },
    /**
     * Test-only: make a matching sheet write throw once. `method` is one of
     * setValue, setValues, clearContent, copyTo, appendRow, insertRow or
     * deleteRows; omit it to match any write. The fake throws before changing
     * a cell, so the backend sees an ordinary write failure and its rollback
     * paths run.
     *
     * `skip` targets a later matching write: the first `skip` matches pass
     * through and the next one throws. It is how a split test reaches the
     * promotion write, which is the second Split Transactions setValues after
     * the PENDING append.
     */
    failNextWrite(sheetName, method, { skip = 0 } = {}) {
      fakes.writeFaults.schedule(sheetName, method, { skip });
    },
  });

  function close() {
    if (closed) return;
    closed = true;
    sessions.clear();
    fakes.cache.clear();
    fakes.writeFaults.clear();
    fakes.lock.releaseLock();
  }

  return {
    request,
    requestRaw,
    login,
    sheets,
    cache: fakes.cache,
    helpers,
    close,
  };
}
