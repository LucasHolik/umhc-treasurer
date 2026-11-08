// tests/backend/auth.test.js
//
// Pins the backend's security boundary through doGet: login and roles, the
// failed-login lockout, session invalidation, the timestamp window, write
// nonce replay and UTF-8 signing. The harness seeds a fresh cache and a fixed
// clock for each test, so the ten-minute lockout bucket cannot flake.

import { test } from "node:test";
import assert from "node:assert/strict";

import { createBackend } from "./harness.js";

// A fixed instant well away from any test-runner behaviour. Passing it through
// options.now is what makes the login lockout deterministic.
const NOW = 1_700_000_000_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

test("login as admin and as viewer returns the role and session credentials", (t) => {
  const backend = createBackend({ now: NOW });
  t.after(() => backend.close());

  const admin = backend.login("admin");
  assert.equal(admin.role, "admin");
  assert.match(admin.sessionId, UUID);
  assert.match(admin.sessionKey, UUID);

  const viewer = backend.login("viewer");
  assert.equal(viewer.role, "viewer");
  assert.match(viewer.sessionId, UUID);
  assert.match(viewer.sessionKey, UUID);

  // The credentials are only meaningful if they authorise a request, and the
  // role on ping proves which passkey verified the login.
  assert.deepEqual(backend.request("ping", {}, { session: admin }), {
    success: true,
    role: "admin",
  });
  assert.deepEqual(backend.request("ping", {}, { session: viewer }), {
    success: true,
    role: "viewer",
  });
});

test("a supplied session that contradicts an explicit role is rejected", (t) => {
  const backend = createBackend({ now: NOW });
  t.after(() => backend.close());
  const admin = backend.login("admin");
  const mismatch = {
    name: "TypeError",
    message: /session role "admin" does not match requested role "viewer"/,
  };

  assert.throws(
    () => backend.request("ping", {}, { role: "viewer", session: admin }),
    mismatch,
  );

  // The TypeError is raised before doGet, so even a mismatched write cannot
  // reach the sheet.
  assert.throws(
    () =>
      backend.request(
        "saveOpeningBalance",
        { balance: 500 },
        { role: "viewer", session: admin },
      ),
    mismatch,
  );
  assert.equal(backend.sheets.cell("Config", "C2"), 0);
});

test("a login signed with a wrong passkey is rejected", (t) => {
  const backend = createBackend({ now: NOW });
  t.after(() => backend.close());

  const response = backend.request(
    "login",
    {},
    { secret: "not-the-admin-passkey" },
  );

  assert.deepEqual(response, { success: false, message: "Unauthorized" });
});

test("login for a role whose passkey is missing is Unauthorized, not Server misconfigured", (t) => {
  // Only the viewer passkey is configured. A client presenting the admin
  // passkey cannot be verified, so doGet rejects the login before
  // Service_Auth.login runs its "Server misconfigured" branch (D-014).
  const backend = createBackend({ now: NOW, secrets: { admin: "" } });
  t.after(() => backend.close());
  const error = t.mock.method(console, "error", () => {});

  const response = backend.request(
    "login",
    {},
    { role: "admin", secret: "admin-pass" },
  );

  assert.deepEqual(response, { success: false, message: "Unauthorized" });
  assert.ok(
    !error.mock.calls.some((call) =>
      String(call.arguments[0]).includes("admin passkey not configured"),
    ),
    "Service_Auth.login must not run for the unconfigured role",
  );
});

test("ten failed logins lock out further attempts", (t) => {
  const backend = createBackend({ now: NOW });
  t.after(() => backend.close());
  const warn = t.mock.method(console, "warn", () => {});

  for (let attempt = 0; attempt < 10; attempt++) {
    assert.deepEqual(
      backend.request("login", {}, { secret: "wrong-passkey" }),
      { success: false, message: "Unauthorized" },
    );
  }

  // The correct passkey is refused once the counter reaches ten, so this would
  // succeed if the lockout check were removed.
  const lockedOut = backend.request("login", {}, { role: "admin" });
  assert.deepEqual(lockedOut, { success: false, message: "Unauthorized" });
  assert.ok(
    warn.mock.calls.some((call) =>
      String(call.arguments[0]).includes("too many failed attempts"),
    ),
    "the lockout is logged",
  );
});

for (const role of ["admin", "viewer"]) {
  test(`a successful ${role} login before the limit resets the failed-attempt counter`, (t) => {
    const backend = createBackend({ now: NOW });
    t.after(() => backend.close());
    const warn = t.mock.method(console, "warn", () => {});

    const failNineTimes = () => {
      for (let attempt = 0; attempt < 9; attempt++) {
        assert.deepEqual(
          backend.request("login", {}, { secret: "wrong-passkey" }),
          { success: false, message: "Unauthorized" },
        );
      }
    };

    failNineTimes();
    backend.login(role);
    failNineTimes();

    // Without the reset, the counter would still be 9 after the successful
    // login; the next batch of failures would reach 10 and lock this login
    // out, so it would be refused.
    const session = backend.login(role);
    assert.equal(session.role, role);
    assert.equal(warn.mock.calls.length, 0, "no lockout was logged");
  });
}

test("logout invalidates the session and the old credentials are rejected", (t) => {
  const backend = createBackend({ now: NOW });
  t.after(() => backend.close());

  const admin = backend.login("admin");
  assert.deepEqual(backend.request("ping", {}, { session: admin }), {
    success: true,
    role: "admin",
  });

  const warn = t.mock.method(console, "warn", () => {});
  assert.deepEqual(backend.request("logout", {}, { session: admin }), {
    success: true,
  });

  const rejected = backend.request("ping", {}, { session: admin });
  assert.deepEqual(rejected, { success: false, message: "Unauthorized" });
  assert.equal(
    backend.cache.get(admin.sessionId),
    null,
    "the session id is removed from the cache",
  );
  // "Invalid or expired session", not "Signature mismatch", proves the session
  // itself was removed rather than the key merely failing to match.
  assert.ok(
    warn.mock.calls.some((call) =>
      String(call.arguments[0]).includes("Invalid or expired session"),
    ),
    "the logged-out session is gone",
  );

  // Logging out one session must not stop the user logging in again.
  const fresh = backend.login("admin");
  assert.deepEqual(backend.request("ping", {}, { session: fresh }), {
    success: true,
    role: "admin",
  });
});

test("a timestamp outside the five-minute window is rejected", (t) => {
  const backend = createBackend({ now: NOW });
  t.after(() => backend.close());
  const warn = t.mock.method(console, "warn", () => {});

  const response = backend.request("ping", {}, { timestamp: NOW - 300_001 });

  assert.deepEqual(response, { success: false, message: "Unauthorized" });
  assert.ok(
    warn.mock.calls.some((call) =>
      String(call.arguments[0]).includes("Timestamp out of bounds"),
    ),
    "the rejection is the timestamp check, not the signature",
  );
});

test("a timestamp just inside the five-minute window is accepted", (t) => {
  const backend = createBackend({ now: NOW });
  t.after(() => backend.close());

  const response = backend.request("ping", {}, { timestamp: NOW - 299_999 });

  assert.deepEqual(response, { success: true, role: "admin" });
});

test("a replayed write nonce is rejected and a fresh nonce is accepted", (t) => {
  const backend = createBackend({ now: NOW });
  t.after(() => backend.close());
  const warn = t.mock.method(console, "warn", () => {});

  const nonce = "11111111-2222-4333-8444-555555555555";

  const first = backend.request(
    "saveOpeningBalance",
    { balance: 900 },
    { nonce },
  );
  assert.deepEqual(first, {
    success: true,
    message: "Opening balance saved successfully",
  });
  assert.equal(backend.sheets.cell("Config", "C2"), 900);

  const replay = backend.request(
    "saveOpeningBalance",
    { balance: 1000 },
    { nonce },
  );
  assert.deepEqual(replay, { success: false, message: "Unauthorized" });
  assert.equal(
    backend.sheets.cell("Config", "C2"),
    900,
    "the replayed write must not reach the sheet",
  );
  assert.ok(
    warn.mock.calls.some((call) =>
      String(call.arguments[0]).includes("nonce replay"),
    ),
    "the replay is logged as a nonce replay",
  );

  const fresh = backend.request(
    "saveOpeningBalance",
    { balance: 1000 },
    { nonce: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" },
  );
  assert.deepEqual(fresh, {
    success: true,
    message: "Opening balance saved successfully",
  });
  assert.equal(backend.sheets.cell("Config", "C2"), 1000);
});

test("a signed write with a non-ASCII value is accepted", (t) => {
  const backend = createBackend({ now: NOW });
  t.after(() => backend.close());

  // The non-ASCII value "Café" is part of the signed payload. The harness
  // signs with UTF-8, as the browser's TextEncoder does. The fake
  // Utilities.computeHmacSha256Signature deliberately treats the two-argument
  // overload as latin1, so this request is Unauthorized if production drops
  // Utilities.Charset.UTF_8.
  const response = backend.request("addTag", {
    type: "Category",
    value: "Café",
  });

  assert.deepEqual(response, {
    success: true,
    message: "Tag added successfully.",
  });
  assert.equal(backend.sheets.cell("Tags", "D2"), "Café");
});
