# Plan

Detailed plan for the current phase only. The grand plan is in
[`rough_plan.md`](rough_plan.md).

## Phase 3: Backend test harness

Approved by the user on 2026-11-08.

**Why.** The 159 tests in `tests/` cover the frontend modules in `src/`. Nothing
exercises the Apps Script backend: the split, tag batch, lock and auth paths, or
the sheet sanitisation. B-002 lives there too. A Node harness that loads the `.gs` files
into a `vm` with in-memory fakes makes those paths testable without a Google
account or a deployed web app.

**Constraints.**

- No new dependencies: the harness uses Node's `vm`, `crypto` and `node:test`.
- Tests stay development only and fast; the whole suite should remain well under
  a few seconds.
- Parts 1 to 4 add tests and harness code only. Part 5 is the only production
  change, and it is the B-002 fix.
- Fakes must honour the real Apps Script contracts, including return shapes and
  error messages, so a passing test means something.

### Part 1: Harness and smoke tests

**Goal.** Load the backend in Node and make one end-to-end request through
`doGet`, with in-memory fakes for the Apps Script services.

**Changes.**

- New `tests/backend/fakes.js`. In-memory fakes for the services the backend
  uses:
  - `SpreadsheetApp`: `getActiveSpreadsheet()`, sheets by name, `insertSheet()`,
    `getParent().getSpreadsheetTimeZone()`.
  - Sheet and range: `getRange("B1")`, `getRange(row, col, rows, cols)`,
    `getDataRange()`, `getValue`, `getValues`, `setValue`, `setValues`,
    `appendRow`, `insertRow`, `deleteRow`, `getLastRow`, `getLastColumn`,
    `clearContent`, `offset`, `sort`, `setNumberFormat`.
  - `LockService`: `getScriptLock()` with `tryLock`, `releaseLock`.
  - `CacheService`: `getScriptCache()` with `get`, `put`, `remove` and TTL.
  - `Utilities`: `getUuid`, `computeHmacSha256Signature` (Node `crypto`),
    `formatDate`, `Charset`.
  - `ContentService`: `createTextOutput()` with `setMimeType`, and
    `MimeType.JAVASCRIPT`.
- New `tests/backend/harness.js`. Exports `createBackend(options)`:
  - `options.sheets` seeds the fake spreadsheet; the default has a Config sheet
    with test passkeys and opening balance 0, and a Finances sheet with headers.
  - `options.secrets` defaults to a known admin and viewer passkey.
  - Returns `{ request, requestRaw, sheets, cache, helpers, close }`.
  - `request(action, params, { role, signed, callback, signature })` builds the
    JSONP parameter object, signs it with HMAC-SHA256, calls `doGet`, parses the
    JSONP reply and returns the response object. `signature` is a test-only
    override for wrong-signature tests, and `signed: false` sends none.
  - `requestRaw` returns `{ raw, mimeType, response }` for exact JSONP and MIME
    assertions.
  - `helpers` exposes the pure backend functions the tests need, such as
    `_sanitizeForSheet`. Each export is marked in a comment as test-only.
  - Loads every `.gs` file into one `vm` script, so the files share scope
    exactly as they do in Apps Script. The `vm` is private to the harness.
- New `tests/backend/code.test.js`:
  - An unsigned request returns `Unauthorized`.
  - A signed admin `ping` returns success and role admin.
  - A signed viewer write returns `Forbidden`.
  - A wrong signature on a read is `Unauthorized`.
  - A wrong signature on a write is `Unauthorized` and changes no cell.
  - A valid custom callback is honoured, and the MIME type is
    `application/javascript`.
  - An unsafe JSONP callback name falls back to `callback`.
- No production changes.

**Tests.** The eight above, plus the existing 159.

**Acceptance criteria.**

- Tests interact only through `createBackend()`, never the `vm` or a fake class.
- The fakes support every method listed above.
- `npm test` is green and `npm run format:check` passes.
- The auth tests fail if signature checking is bypassed.

**Existing tests affected.** None.

**Status.** done

### Part 2: Auth, replay and sanitisation

**Goal.** Pin down the security boundary and sheet-write safety.

**Changes.**

- New `tests/backend/auth.test.js`:
  - Login as admin and as viewer; a wrong passkey is rejected; the login for a
    role whose passkey is missing is rejected as `Unauthorized` before
    `Service_Auth.login` runs (its "Server misconfigured" branch is
    unreachable for that role through `doGet`; see D-014).
  - Ten failed logins lock out further attempts; a successful login resets the
    counter.
  - Logout invalidates the session, and the old session key stops working.
  - A timestamp outside the five-minute window is rejected.
  - A replayed write nonce is rejected; a fresh nonce is accepted.
  - HMAC over UTF-8: a signed write with a non-ASCII value (for example a tag
    name) verifies, so the payload does not have to be ASCII.
- New `tests/backend/sanitise.test.js`:
  - `_sanitizeForSheet` prefixes `=`, `+`, `-`, `@`, tab, CR and LF, and leaves
    other strings alone.
  - `_sanitizeGridForSheet` sanitises strings and leaves numbers, dates and
    booleans untouched; already-prefixed values are unchanged.
  - `validateJsonParameter` accepts arrays and objects, and rejects the wrong
    shape or invalid JSON.
- Extend the harness only where these tests need it.

**Tests.** As above.

**Acceptance criteria.** Each test fails if the corresponding check is removed.
No production changes. `npm test` and `npm run format:check` pass.

**Existing tests affected.** None.

**Status.** done

### Part 3: Locking and tag rollback

**Goal.** Prove the lock is re-entrant and that a failed tag batch rolls back.

**Changes.**

- New `tests/backend/lock.test.js`:
  - A lock that cannot be taken returns the busy response.
  - Nested `withScriptLock` calls reuse the lock, and the depth counter unwinds.
  - A throw inside `fn` releases the lock.
- New `tests/backend/tags.test.js`:
  - `processTagOperations` applies add, rename, delete, trip type and trip
    status changes.
  - A failure part-way rolls the whole batch back, so no tag is half-applied.
  - Renaming a tag updates expenses and split history.
- Extend the harness only where these tests need it.

**Tests.** As above.

**Acceptance criteria.** Tests fail if the depth counter or the rollback is
removed. No production changes. `npm test` and `npm run format:check` pass.

**Existing tests affected.** None.

**Status.** todo

### Part 4: Split lifecycle

**Goal.** Cover create, revert and edit, the riskiest data path.

**Changes.**

- New `tests/backend/split.test.js`:
  - Create writes the group ID to the Finances row and SOURCE plus CHILD rows to
    Split Transactions; the totals do not change.
  - A mixed income and expense split keeps the per-child type.
  - Revert clears the group ID and removes the group's rows.
  - Edit replaces the splits and keeps the other tags.
  - A stale PENDING group is swept, and a failure after PENDING leaves no
    orphan rows.

**Tests.** As above.

**Acceptance criteria.** The tests assert the sheet writes, not just the return
values. No production changes. `npm test` and `npm run format:check` pass.

**Existing tests affected.** None.

**Status.** todo

### Part 5: Fix B-002 and add its regression test

**Goal.** A text `1,200` in Config!C2 is read as 1200, not 1.

**Changes.**

- `google-apps-script/Service_Sheet.gs`: in `getOpeningBalance`, parse the cell
  with commas removed before `parseFloat`, or add one small parse helper used
  by the read path. Keep the save path unchanged unless a test shows it is
  affected.
- New `tests/backend/opening-balance.test.js`: text `"1,200"` gives 1200;
  `"250.5"` gives 250.5; empty gives 0; garbage gives 0; a numeric cell still
  works; `getAppData` returns the corrected value.
- `bugs.md`: move B-002 to Fixed with the test name.

**Tests.** The new regression test must fail before the fix and pass after it.

**Acceptance criteria.** `npm test` and `npm run format:check` pass. No other
balance behaviour changes.

**Existing tests affected.** None.

**Status.** todo

### Notes for the next session

- Run the parts in order; each is a separate commit on the phase branch.
- B-002 is the only production change in this phase.
- If a fake needs to grow beyond a small in-memory structure, stop and report
  rather than building a spreadsheet engine.
