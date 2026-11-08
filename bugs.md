# Bugs

Known bugs, open and fixed. Bugs outside the current part's scope are recorded
here rather than fixed on the spot; `high` and `critical` bugs go to the user
straight away. A fixed bug names the regression test that covers it.

## Open

### B-005: Split history total counts hidden PENDING rows

**Description.** `getSplitHistory` filters PENDING rows out of `data` but
returns `total` as `lastRow - 1`, which still counts them. A caller can see a
total larger than the rows that are ever returned, and pagination driven by
`total` overcounts.

**Steps to reproduce.** Seed a PENDING row in Split Transactions and call
`getSplitHistory`. The row is absent from `data` but included in `total`.

**Severity.** Low. No money or data is changed; the count is cosmetic and
affects pagination metadata.

**Where.** `google-apps-script/Service_Split.gs:580` and the return at line 661.

**Status.** Open. Found while writing the split tests; not fixed.

### B-004: An unexpected write error leaves a tag batch half-applied

**Description.** `_runTagBatch` has no `try`/`catch` around its operation
switch. An uncaught throw from `_addTag`, `_deleteTag`, `_renameTag`,
`_updateTripType`, `_updateTripStatus` or `_sortTags` escapes to the outer
catch in `processTagOperations` (lines 72 to 78), which returns a generic
failure without calling `_rollbackTagBatch`. The Tags sheet and the expense or
split rows can be left half-changed. `_snapshotTagSheet` fails before any
change, and `_restoreTagSheet` runs inside `_rollbackTagBatch`'s own
`try`/`catch`, so neither can escape this way.

**Steps to reproduce.** In the backend harness, fail the next `Tags`
`setValue` write and send `[["Food", null, "delete", "Category"],
["", "Travel", "add", "Category"]]`. The response is the generic failure,
Food is gone from Tags and Finances, and Travel was not added.

**Severity.** Medium. It needs a transient or quota-style write failure, but
the result is a half-applied batch.

**Where.** `google-apps-script/Service_Tags.gs:743` (`_runTagBatch`), with the
outer catch at `Service_Tags.gs:72`.

**Status.** Open. Found while building the part 3 rollback test; not fixed in
this phase. A fix should wrap the operation loop in a `try`/`catch` that calls
`_rollbackTagBatch`, with a regression test using `failNextWrite("Tags",
"setValue")`.

### B-003: A reserved-word JSONP callback is not replaced

**Description.** `createJsonResponse` validates the callback with a regex that
accepts JavaScript reserved words. A request with `callback=false` or
`callback=null` produces `false(json)` or `null(json)`, which is not a callable
wrapper, instead of falling back to `callback`.

**Steps to reproduce.** Call `doGet` with `callback=false`. The reply is not
valid JSONP.

**Severity.** Low. The browser client always generates a safe identifier, and
the result is a broken response rather than script injection.

**Where.** `google-apps-script/Code.gs:330`, the callback regex.

**Status.** Open. Found while building the backend harness; not fixed, because
production code is out of scope for Phase 3 part 1.

## Fixed

### B-001: `npm run format:check` fails on `main`

**Description.** The formatting gate failed before any change was made. Prettier
reported four files under `.archify/architecture-umhc-treasurer-20261005-162240/`
as badly formatted. The files are generated output from the `archify` skill.

**Steps to reproduce.** On `main`, run `npm run format:check`. It exits non-zero
with warnings for `candidate.json`, `umhc-treasurer.finalize.json`,
`umhc-treasurer.finalize-summary.json` and `umhc-treasurer.html`.

**Severity.** Low. Nothing in the app is affected; the documented check could
not pass.

**Where.** `.archify/architecture-umhc-treasurer-20261005-162240/`.

**Status.** Fixed in Phase 1, part 3 by adding `.archify/` to `.prettierignore`
(see D-005). There is no unit test for this: `npm run format:check` is the
check itself, and it now passes on the whole repository.

### B-002: A comma-formatted opening balance is read as 1

**Description.** `Service_Sheet.getOpeningBalance()` parses Config!C2 with
`parseFloat`, which stops at a comma. If the cell holds `"1,200"` as text, the
server returns 1. `calculateFinancials` then receives that number, so its own
`parseFloat` cannot recover the lost digits. Every balance is wrong by 1199.

**Steps to reproduce.** Format Config cell C2 as plain text, enter `1,200` and
reload. Settings shows the Base Opening Balance as 1, and the dashboard Current
Balance is 1 while there are no transactions.

**Severity.** Low. The settings form rejects a comma (it uses `Number()`), and
a General-format cell coerces `1,200` to a number, so this needs a manually
formatted text cell.

**Where.** The primary fault was `google-apps-script/Service_Sheet.gs:320`.
`src/core/financial.logic.js:29` is a secondary defensive parse and could not
fix the value on its own.

**Status.** Fixed in Phase 3, part 5. Regression tests: "a text opening balance
of 1,200 is read as 1200" and "getAppData reports a comma-formatted opening
balance as 1200" (`tests/backend/opening-balance.test.js`). The read strips
thousands separators before `parseFloat`; empty and non-numeric cells still
give 0, and the cell is not rewritten.
