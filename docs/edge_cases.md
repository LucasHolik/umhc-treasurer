# Edge cases

Known edge cases, grouped by module, with how each one is handled. Test names
are from the Node suite in [`tests/`](../tests/), which mirrors `src/`; run it
with `npm test`. "Backend only" means there is no automated test for it yet.

## Trip status

### E-001: A Trip/Event tag has no status, or an unrecognised one

**Situation.** `TripStatusMap` has no entry for a trip, or the sheet contains a
typo such as `completed`.

**Expected.** Treat it as Active, so the tag stays visible when tagging. A typo
must never hide a tag someone needs.

**Status.** Handled (`tests/core/trip-status.test.js`). Tests:
"normaliseTripStatus defaults missing/unknown to Active", "normaliseTripStatus
keeps known statuses".

### E-002: A trip is Completed or Completed Investment

**Situation.** The status marks the trip as past.

**Expected.** Keep the tag available but hide it behind the past-tags toggle in
the tag selector, rather than deleting it. The transaction and filter screens
can still show past trips explicitly.

**Status.** Handled (`tests/core/trip-status.test.js` and
`tests/features/transactions/transactions.logic.test.js`). Tests:
"partitionTripsByStatus splits current and past", "buildTripSelectorOptions
hides past trips behind hints".

### E-003: A non-string value appears in the trip list

**Situation.** Bad sheet data puts a number or object where a tag name should
be.

**Expected.** Drop the entry instead of rendering `[object Object]` or throwing.

**Status.** Handled (`tests/core/trip-status.test.js`). Test:
"partitionTripsByStatus drops non-strings and bad input".

## Financial logic

### E-004: The opening balance is a numeric string, empty or garbage

**Situation.** The Config sheet holds `"250.5"`, an empty cell, or text that is
not a number.

**Expected.** Parse a plain numeric string, and use 0 for anything unparseable.
The dashboard must still render.

**Status.** Handled (`tests/core/financial.logic.test.js`). Test: "opening
balance accepts strings, garbage becomes 0".

### E-005: The opening balance contains a thousands separator

**Situation.** Config!C2 is stored as text, for example `"1,200"`. The server
parses it with `parseFloat` in `Service_Sheet.getOpeningBalance()`, which stops
at the comma and returns 1.

**Expected.** Read it as 1200, or reject it clearly, rather than showing a
balance that is out by 1199.

**Status.** Handled. Test: "a text opening balance of 1,200 is read as 1200"
(`tests/backend/opening-balance.test.js`).

### E-006: Manual rows sit before the opening balance

**Situation.** `Type` is `Manual` for historical rows that are already reflected
in the opening balance.

**Expected.** Include them in income and expense totals, but invert their net
effect in the adjusted opening balance, so the current balance is not
double-counted.

**Status.** Handled (`tests/core/financial.logic.test.js`). Tests: "manual rows
cancel out of the current balance", "manual-only ledger returns to the opening
balance".

## State and store

### E-007: A subscriber throws during a notification

**Situation.** One component's render fails.

**Expected.** The remaining subscribers still run, so one broken view does not
freeze the others.

**Status.** Handled (`tests/core/state.test.js`). Test: "a throwing subscriber
does not block later subscribers".

### E-008: A caller tries to set a reserved or invalid key

**Situation.** `setState("__proto__", ...)`, `constructor`, `prototype`, a
non-string key, or a value that cannot be cloned.

**Expected.** Reject it (throw) rather than poisoning the store.

**Status.** Handled (`tests/core/state.test.js`). Test: "reserved and invalid
keys are rejected".

### E-009: State values contain circular references

**Situation.** A cloned or compared value refers back to itself.

**Expected.** Clone and compare without infinite recursion.

**Status.** Handled (`tests/core/utils.test.js`). Tests: "deepEqual handles
circular references", "deepClone clones Date, Map, Set and circular refs".

## Splits

### E-010: A SOURCE row has no CHILD rows

**Situation.** Split history has a SOURCE row but the children are missing, for
example after a failed write.

**Expected.** Keep the original Finances row, so the money does not disappear
from the ledger.

**Status.** Handled (`tests/services/transaction.service.test.js`). Test:
"mergeSplits keeps a SOURCE row that has no children".

### E-011: The same split group appears more than once

**Situation.** Raw expenses contain more than one row with the same
`Split Group ID`.

**Expected.** Inject the group's children once, not once per row.

**Status.** Handled (`tests/services/transaction.service.test.js`). Test:
"mergeSplits injects each group's children only once".

### E-012: A split write fails after the PENDING marker is written

**Situation.** The Apps Script execution dies between marking rows PENDING and
promoting them.

**Expected.** History reads hide PENDING rows. The next split write sweeps
PENDING rows older than 10 minutes, so no orphan children remain.

**Status.** Handled. Test: "history reads hide PENDING rows and a later split
sweeps the stale ones" (`tests/backend/split.test.js`).

## Tags

### E-013: A tag save times out or the network drops

**Situation.** The server may or may not have applied some operations.

**Expected.** Do not guess. Reload from the server and tell the user how many
operations were saved and how many may be in flight. A timeout drops the queue
and leaves edit mode, because replaying an unknown chunk could fail and roll
the batch back; the unsent operations must be re-entered. A network error
keeps every unconfirmed operation pending, because replaying it is safe.

**Status.** Handled (`tests/features/tags/tags.logic.test.js`). Tests:
"resolveSaveFailure: TIMEOUT drops the queue, leaves edit mode, counts ops",
"resolveSaveFailure: TIMEOUT on the last chunk", "resolveSaveFailure: NETWORK
keeps every unconfirmed op pending".

### E-014: A new tag is added and then deleted before saving

**Situation.** The pending queue contains `add` then `delete` for a tag that
never existed on the server.

**Expected.** Cancel both operations.

**Status.** Handled (`tests/features/tags/tags.logic.test.js`). Test:
"optimizeQueue cancels add followed by delete of a new tag".

### E-015: Renames form a chain or a cycle

**Situation.** `A` becomes `B`, `B` becomes `C`, or `A` becomes `B` and `B`
becomes `A`.

**Expected.** Collapse a chain into one rename and drop a cycle entirely.

**Status.** Handled (`tests/features/tags/tags.logic.test.js`). Tests:
"optimizeQueue collapses chained renames", "optimizeQueue removes circular
renames entirely".

### E-016: A rename targets an existing tag

**Situation.** `Snowdon` is renamed to `Yr Wyddfa`, which already exists.

**Expected.** Merge the statistics into the existing tag instead of creating a
duplicate.

**Status.** Handled (`tests/features/tags/tags.logic.test.js`). Test:
"calculateTagStats rename merges into an existing tag".

### E-030: A tag helper throws after changing external rows

**Situation.** `_deleteTag` or `_renameTag` changes Finances or Split
Transactions, then its Tags write throws before the helper returns.

**Expected.** The batch restores every changed row, or the response admits
that the external rows were not reverted.

**Status.** Handled for the late Tags write during delete and for partial
external writes during rename (B-006). A throw inside `removeTagFromSplits`
after a partial split write still cannot report rows, and its guard is
unreachable today because the helper catches its own write errors. A missing
`restoreTagInSplits` helper now refuses the delete before any Split
Transactions row is cleared (B-008), with test "a missing split restore helper
refuses the tag delete" (`tests/backend/tags.test.js`). The B-007 rollback
guard remains as defence in depth for a state public actions no longer reach.

### E-031: The post-loop tag sort throws

**Situation.** Every operation applies, then `_sortTags` throws while writing
the Tags sheet.

**Expected.** The batch rolls back and the lock is released. The last applied
operation may appear once as rolled back and once as failed; that duplicate is
cosmetic and the client reads `appliedOperations`.

**Status.** Handled. Test: "a throw in the post-loop sort rolls the batch
back" (`tests/backend/tags.test.js`).

### E-033: A direct `deleteTag` leaks a partial Tags write

**Situation.** The direct `deleteTag` endpoint calls `_deleteTag` without the
batch snapshot. If the Tags `copyTo` succeeds and the following
`clearContent` throws, the Tags sheet is left partially changed.

**Expected.** Restore the Tags sheet, or report that the data is inconsistent.

**Status.** Not handled. The batch path restores Tags from its snapshot; the
direct endpoint has none. A fail-after-write test could use the harness's
`when: "after"` fault mode.

### E-034: A refused delete still rewrites the Tags sheet

**Situation.** A batch delete is refused by the `Service_Split` pre-flight
because `restoreTagInSplits` is missing. `_runTagBatch` still calls
`_rollbackTagBatch`, which restores the Tags snapshot and reports the rollback
as attempted and successful, appending "Changes reverted." to the message.

**Expected.** No data changes and the response is truthful. The extra write and
the sentence are cosmetic.

**Status.** Not handled, accepted. The refusal happens before any external
write, and the snapshot restore writes the same values back. Low impact; see
B-008.

## Excel import

### E-017: Dates arrive as DD/MM/YYYY, impossible dates, or ISO strings

**Situation.** Bank exports use different date formats.

**Expected.** Convert DD/MM/YYYY, pass YYYY-MM-DD through, and reject impossible
dates such as 31/02 instead of silently rolling them over.

**Status.** Handled (`tests/services/excel.service.test.js`). Tests:
"normalizeDateString converts DD/MM/YYYY with padding", "normalizeDateString
rejects impossible rollover dates".

### E-018: The header is not on the first row

**Situation.** The export has title or account preamble rows above the header.

**Expected.** Find the header row before parsing the data.

**Status.** Handled (`tests/services/excel.service.test.js`). Test:
"parseAndCleanData finds the header after preamble rows".

### E-019: A row continues the transaction above it

**Situation.** A description or note wraps onto the next row with no date.

**Expected.** Merge it into the previous transaction.

**Status.** Handled (`tests/services/excel.service.test.js`). Test:
"parseAndCleanData merges continuation rows without a date".

### E-020: The export uses credit and debit columns

**Situation.** A single amount column is labelled Credit/Debit instead of
separate Income/Expense columns.

**Expected.** Recognise the headers and map them to income and expense.

**Status.** Handled (`tests/services/excel.service.test.js`). Test:
"parseAndCleanData recognises credit/debit column names".

## API and sessions

### E-021: The stored script URL is tampered with

**Situation.** Local storage contains a URL that is not a Google Apps Script web
app.

**Expected.** Reject it at read time as well as at save time.

**Status.** Handled (`tests/services/api.service.test.js`). Tests:
"_validateScriptUrl accepts only Apps Script web app URLs", "_validateScriptUrl
rejects everything else".

### E-022: The server cannot get the script lock

**Situation.** Another write holds the lock for longer than 10 seconds.

**Expected.** Nothing runs. Return "System is busy", set `err.code` to `BUSY`,
and let the client retry or reload safely.

**Status.** Handled. Test: "a held lock makes withScriptLock return the busy
response" (`tests/backend/lock.test.js`).

### E-023: A request times out, so the outcome is unknown

**Situation.** The client gives up before the server answers.

**Expected.** Never apply optimistic state. Reload from the server and tell the
user what is known. For tag batches, a timeout drops the queue and a network
error keeps the unconfirmed operations (E-013).

**Status.** Handled (`tests/features/tags/tags.logic.test.js`). Covered
indirectly by the `resolveSaveFailure` tests above.

### E-024: A read queues behind a write

**Situation.** A read waits for the lock.

**Expected.** The read timeout (30 s) is longer than the lock wait (10 s), so the
user sees "System is busy" rather than a client timeout. Writes get 60 s.

**Status.** Handled (`tests/services/api.service.test.js`). Tests:
"resolveTimeout gives reads 30 s by default", "resolveTimeout gives mutating
requests 60 s".

### E-032: A valid-identifier callback is not callable

**Situation.** A caller sends `callback=arguments`, `callback=window`,
`callback=Math` or another identifier that passes the regex but is not a
function.

**Expected.** The reply is callable, or the name falls back to `callback`.

**Status.** Not handled. B-003 covers reserved words only; a finite denylist
cannot cover every non-callable global. The app always generates a safe name,
so this needs a hand-made or third-party caller.

## Roles

### E-025: The server reports an unknown role

**Situation.** A response contains a role other than `admin`.

**Expected.** Treat the user as a viewer, the least-privileged choice, so a bad
value can never grant edit rights.

**Status.** Handled in `AuthService.buildCurrentUser`; no automated test.

### E-026: A viewer opens the upload hash directly

**Situation.** A viewer types `#upload` or follows an old link.

**Expected.** Redirect to the dashboard, hide the upload nav item, and reject the
write on the server even if the request is made by hand.

**Status.** Handled in `App.js` and `Code.gs`; no automated test.

## Dates and timeframes

### E-027: A date filter boundary falls on a transaction day

**Situation.** A transaction is dated on the first or last day of a range.

**Expected.** Include both boundary days, using local midnight rather than UTC,
so the result does not shift by a day in British Summer Time.

**Status.** Handled (`tests/core/utils.test.js` and
`tests/features/analysis/analysis.logic.test.js`). Tests: "parseDate parses
YYYY-MM-DD as local midnight", "getFilteredData includes both boundary days".

### E-028: An unknown timeframe key reaches the date helper

**Situation.** A saved or malformed preset contains an unrecognised timeframe.

**Expected.** Fall back to the past 30 days instead of returning an empty or
invalid range.

**Status.** Handled (`tests/core/utils.test.js`). Test: "getDateRange falls back
to past 30 days for unknown keys".

## Configuration

### E-029: A sheet still uses the old Config layout

**Situation.** An existing deployment has the initial balance in B1/B2.

**Expected.** Migrate it to C1/C2 on login, idempotently, and do not run the
migration on every read.

**Status.** Handled in `Service_Sheet.gs`; backend only, no automated test.
