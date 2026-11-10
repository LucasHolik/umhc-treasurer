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

## AI tag suggestions

### E-035: A Trip/Event is named like an Object property

**Situation.** A tag is literally named `toString`, `constructor` or
`__proto__`, and `TripTypeMap` is a plain object, so `map[trip]` returns an
inherited value.

**Expected.** The prompt shows no Type for that tag.

**Status.** Not handled. `_buildPrompt` reads `TripTypeMap[trip]` without an
own-property check, so the prompt text for that tag is malformed. The reply is
still filtered against the live tag list, so no invalid tag can be returned.
An own-property guard would fix it.

### E-036: `Service_AI.gs` is deployed without the new `Config.gs`

**Situation.** A partial paste leaves `AI_CONFIG` undefined while `Service_AI.gs`
and `Code.gs` are current.

**Expected.** The app still loads, and suggestions report "not configured"
instead of the whole `getAppData` read failing.

**Status.** Handled by `_aiConfigValue` and the `getStatus` try/catch;
`suggestTags` returns `AI_NOT_CONFIGURED`. There is no automated test, because
the backend harness compiles every `.gs` file and a top-level `const` cannot be
hidden at runtime. Verified by inspection and an isolated `vm` run. The guards
cover absence only: a malformed value such as `MAX_DESCRIPTION_LENGTH: 0` is
used as-is, which is reachable only by hand-editing `Config.gs`.

### E-037: Only one tag list has entries

**Situation.** Trips exist but Categories are empty, and every selected row is
missing only a Category.

**Expected.** No provider call, because no valid proposal is possible.

**Status.** Not handled. The plan's shortcut needs both lists to be empty, so
the call happens and the reply is validated to an empty list. It costs one call
and returns no wrong data; a per-row reachability check would avoid it.

### E-038: The same row id appears twice in a batch

**Situation.** A client sends `42` twice, or `42` and `"42"`.

**Expected.** One proposal for the row, carrying the id type the request used.

**Status.** Handled. Reply entries are matched by string id and the first valid
entry wins. `reconcileSuggestions` keeps the first requested entry for a
duplicate id and matches a string reply id to a numeric request; both are tested
in `tests/features/transactions/transactions.suggestions.test.js`. Duplicate rows
inside one outgoing batch are still untested; the client sends each selected row
once.

### E-039: An empty batch on an unconfigured deployment

**Situation.** The action is called with `rows=[]` before any key is set.

**Expected.** `AI_NOT_CONFIGURED`, because configuration is checked before the
empty-batch shortcut.

**Status.** Handled by the order of the checks. Not separately tested, and the
planned client never sends an empty batch.

### E-040: A tag is renamed while a suggestion request is in flight

**Situation.** The prompt offered a tag that no longer exists when the reply is
used.

**Expected.** The stale value is dropped and the rest of the proposal survives.

**Status.** Handled at three layers: the server validates against the live list,
the client reconciles against the store, and `updateExpenses` validates again at
save time. No test covers a mid-flight rename; the unknown-tag tests cover the
outcome.

### E-041: A full batch makes a long JSONP URL

**Situation.** 25 rows with long descriptions travel as query parameters, since
JSONP cannot POST.

**Expected.** The request stays within what Apps Script accepts.

**Status.** Handled per row by `MAX_ROWS` (25) and `MAX_DESCRIPTION_LENGTH`
(200), with no total-size cap. Real bank descriptions are far shorter. If a
statement ever approaches the limit, lower `MAX_ROWS` in `Config.gs`.

### E-042: A tag is added to a row after it was selected

**Situation.** A row is selected while missing a Category. Before the proposal
is applied, a reload or another tab gives it a Category.

**Expected.** The Category proposal is dropped, and a Trip/Event proposal for
the same row still applies.

**Status.** Handled in `reconcileSuggestions`, which accepts a field only when it
is still blank on the current row, and again at the Part 3 merge. Test: "a field
that is no longer blank on the current row is dropped". A change made in another
session that this tab never reloads is the save path's existing last-write-wins
behaviour.

### E-043: A login to a different backend fails to load

**Situation.** The previous backend had AI configured, the next login points at
an older backend, and `getAppData` fails.

**Expected.** AI stays disabled rather than trusting the previous status.

**Status.** Handled by resetting `ai` to the default in both `loadInitialData`
failure paths. There is no App test; verified by inspection.

### E-044: A selected row has no usable id

**Situation.** A ledger row without a numeric or `S-<n>` id reaches the request.

**Expected.** The backend rejects the batch rather than returning a suggestion
without `row`.

**Status.** Handled on the backend. The client assumes every ledger row has an
id, which it does. Low.

### E-045: Income and expense change but the net does not

**Situation.** A row is edited from 10 income and 0 expense to 15 income and 5
expense between selection and apply.

**Expected.** Ideally the fingerprint notices the change.

**Status.** Not handled. The fingerprint is the net amount, as the plan
specifies, so an equal net passes. Rare and low risk.

### E-046: A provider call outlives the client timeout

**Situation.** The provider hangs past the 45 s client timeout.

**Expected.** No data changes, because the action writes nothing, but the
provider call may run to the Apps Script execution limit and be billed.

**Status.** Not handled. Apps Script offers no per-call deadline. Only cost and
latency are affected.

### E-047: An injected `suggest` rejects with a falsy value

**Situation.** A caller supplies a `suggest` function that rejects with
`undefined` or `null`.

**Expected.** The caller can tell that later batches were not sent.

**Status.** Not handled. `collectSuggestions` returns the raw rejection reason,
so `error: undefined` looks like success to a truthiness check. `ApiService`
always rejects with an `Error`, so the planned call cannot hit it. Low.

### E-048: A live tag has outer whitespace

**Situation.** A tag in the Tags sheet has leading or trailing spaces, which is
possible only by editing the sheet directly because the tag UI trims.

**Expected.** The client's match agrees with the backend's exact match.

**Status.** Not handled. `isAllowedTag` trims the proposal but matches the
untrimmed live list, so the backend would accept the tag and the client drops
it. That is a missed suggestion, never a wrong write. Low.

## AI tag suggestions: review panel

### E-049: Focus after Apply

**Situation.** The panel closes, the pending changes render and the save loader
replaces the AI button.

**Expected.** Focus lands somewhere sensible after the save.

**Status.** Not handled. Cancel, Escape and close restore focus to the AI
button; Apply hands over to the save flow and focus can fall back to the page
body. Low.

### E-050: No way to cancel a request in flight

**Situation.** A provider is slow and the user wants to stop.

**Expected.** A way out.

**Status.** Not handled. Both toolbar buttons are disabled while the request
runs, so the 45 s client timeout is the bound. Low.

### E-051: Switching tabs during the request

**Situation.** The user leaves the transactions tab while the provider is
answering.

**Expected.** The reply does not open a panel over another screen.

**Status.** Not handled. The component stays alive across tabs, so the panel can
open over whichever tab is showing, and the return-focus button is in a hidden
section. Low.

### E-052: Tab trap when focus is not inside the panel

**Situation.** A click on a non-focusable part of the panel leaves focus on the
body.

**Expected.** Tab stays inside the panel.

**Status.** Not handled. The trap wraps only when focus is on the first or last
focusable element, the same shape as the shared `ModalComponent`. Low.

### E-053: First-open styling and short viewports

**Situation.** The stylesheet has not loaded when the panel opens, or the
viewport is very short.

**Expected.** The panel is styled on first paint and the notice stays readable.

**Status.** Not handled. `modal.css` is injected at construction but not
awaited, though the panel only opens after a provider request. On a very short
viewport the body has `overflow: hidden` and the notice has no scroll. Phone
layout is unchecked. Low.
