# Bugs

Known bugs, open and fixed. Bugs outside the current part's scope are recorded
here rather than fixed on the spot; `high` and `critical` bugs go to the user
straight away. A fixed bug names the regression test that covers it.

## Open

_None._

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

**Status.** Fixed in Phase 4, part 2. Test: "reserved-word callbacks fall back
to the default wrapper" (`tests/backend/code.test.js`). Reserved names now
fall back to `callback`, so the reply stays callable. Non-callable identifiers
that pass the identifier regex are a separate residual; see E-032.

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

**Status.** Fixed in Phase 4, part 1. Test: "an unexpected write throw rolls the
whole batch back" (`tests/backend/tags.test.js`). The operation loop and the
final sort are wrapped inside the lock, and an unexpected throw now calls
`_rollbackTagBatch` and returns its structured result. A helper that throws
after changing external rows but before returning is still a gap; see B-006.

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

**Status.** Fixed in Phase 4, part 2 (D-017). Test: "history has no total field
and paginates on hasMore alone" (`tests/backend/split.test.js`). `total` is
removed from all three returns; the client paginates on `hasMore` only.

### B-006: A late tag write can leave external rows changed

**Description.** `_deleteTag` removes the tag from Finances and Split
Transactions, then writes the Tags sheet. If that Tags write throws, the
helper never returns, so `_runTagBatch` records no compensation.
`_rollbackTagBatch` restores the Tags sheet and reports "Changes reverted",
while the external cells stay cleared. `_renameTag` has a narrower version:
if an external update throws after a partial write, its success flag is still
false, so the catch reverts the master but not the partially changed rows.

**Steps to reproduce.** In the backend harness, call
`failNextWrite("Tags", "copyTo")` with the batch
`[["Food", null, "delete", "Category"], ["", "Travel", "add", "Category"]]`.
Tags has Food back, but the Food Category cells in Finances and Split
Transactions are empty, and the response says the changes were reverted.

**Severity.** Medium. The window is narrow, but the response claims a complete
rollback when external rows are still changed.

**Where.** `google-apps-script/Service_Tags.gs`, `_deleteTag` Step 2 and the
external updates in `_renameTag`.

**Status.** Fixed in Phase 5. Regression tests (all in
`tests/backend/tags.test.js`): "a Tags write throw during delete restores the
external rows", "a Tags write throw during a direct delete restores both
external sheets", "a Finances write throw during rename reverts the external
rows", "a Split Transactions write throw during rename reverts the external
rows", "a failed compensation reports the rename as inconsistent" and "a
failed batch compensation reports the rename as inconsistent".

### B-007: Batch rollback treats a missing split restore helper as success

**Description.** In `_rollbackTagBatch`, when a compensation has non-empty
`splitRows` but `Service_Split.restoreTagInSplits` is missing, the restore was
skipped and `rollbackSuccess` stayed true. The response could say "Changes
reverted" while the Split Transactions rows were still cleared.

**Steps to reproduce.** Not reachable through the public actions after B-008.
Before B-008, hiding `Service_Split.restoreTagInSplits` and failing the Tags
write after a delete left the split rows cleared while the rollback claimed
success.

**Severity.** Low. It needs a missing dependency, but the claim was false.

**Where.** `google-apps-script/Service_Tags.gs`, `_rollbackTagBatch`.

**Status.** Fixed, with the rollback branch now defence in depth. When
`splitRows` is non-empty and the helper is missing, the rollback logs the
affected rows, sets `rollback.success: false` and returns the inconsistent
detail, so it no longer claims "Changes reverted". B-008 now refuses the delete
before any Split Transactions row is cleared, so public actions cannot reach
this branch. Its original regression test, "a missing split restore helper
reports an inconsistent rollback", was replaced by the B-008 test. The guard
stays so a future path that clears split rows still fails closed.

### B-008: A tag delete proceeds without a split restore helper

**Description.** `_deleteTag` checked that `Service_Split.removeTagFromSplits`
existed before clearing the tag from Split Transactions, but not that
`Service_Split.restoreTagInSplits` existed. A deployment that had the remove
helper but not the restore helper could still delete the tag from Split
Transactions. If the batch later failed, those rows could not be restored.
B-007 made the response honest about that state; B-008 prevents it.

**Steps to reproduce.** In the backend harness, call
`backend.helpers.hideSplitRestore()` and delete a Category that is used by
split rows. Before the fix, the delete succeeded and the Split Transactions
cells were cleared.

**Severity.** Low. It needs a mismatched deployment, but it cleared data that
the code then could not restore.

**Where.** `google-apps-script/Service_Tags.gs`, the `Service_Split` pre-flight
in `_deleteTag` (around line 377).

**Status.** Fixed. The pre-flight now requires `restoreTagInSplits` as well as
`removeTagFromSplits`, so a mismatched deployment returns "Service_Split
dependency not available. Tag NOT deleted." before any external write.
Regression test: "a missing split restore helper refuses the tag delete"
(`tests/backend/tags.test.js`). The B-007 rollback guard remains defence in
depth because public actions no longer reach it.

### B-009: DeepSeek requests run in thinking mode

**Description.** DeepSeek enables thinking mode by default with high effort. The
suggestion request sends `temperature: 0` and `max_tokens: 800` but no
`thinking` field, so the provider reasons before answering. Thinking mode
ignores the temperature, adds reasoning tokens before the JSON, and can use up
the output budget, so a batch can be slow, cost more, or come back without
readable JSON. Other providers are unaffected.

**Steps to reproduce.** Configure `AI_PROVIDER=deepseek` and
`AI_MODEL=deepseek-flash`, then request suggestions. The outgoing body has no
`thinking` field. A provider key is needed, so this cannot be reproduced in the
test suite; the fix is pinned by the request body instead.

**Severity.** Medium. It bills reasoning tokens for a classification task and
can make the feature slow or return an unreadable reply.

**Where.** `google-apps-script/Service_AI.gs`, `_callProvider`, and the
`deepseek` entry in `google-apps-script/Config.gs`.

**Status.** Fixed by adding `extraBody: { thinking: { type: "disabled" } }` to
the `deepseek` registry entry and merging a provider's `extraBody` into the
request body. Regression tests: "a DeepSeek request disables thinking mode" and
"an OpenAI-compatible provider sends no thinking field"
(`tests/backend/ai.test.js`).
