# Plan

Detailed plan for the current phase only. The grand plan is in
[`rough_plan.md`](rough_plan.md).

## Phase 5: Fix B-006, tag delete and rename rollback

Approved by the user on 2026-11-08. Two parts.

### Part 1: Restore external rows when the delete's Tags write fails

**Goal.** A throw while `_deleteTag` writes the Tags sheet must restore the
Finances and Split Transactions rows it already cleared, and the response must
not claim a clean rollback while rows remain changed.

**Changes.** In `google-apps-script/Service_Tags.gs`, `_deleteTag`:

- wrap the Tags-sheet mutation in Step 2 in a `try`/`catch`;
- on a throw, restore `modifiedExpenseRows` with
  `Service_Sheet.restoreTagInExpenses` and `modifiedSplitRows` with
  `Service_Split.restoreTagInSplits`, each guarded;
- return a structured failure with `Changes reverted` when both restores
  succeed, or a clear `Data is INCONSISTENT` message and the unresolved rows
  when one fails;
- wrap the `removeTagFromSplits` call in a `try`/`catch` so a throw restores
  the expenses rows; keep the existing failed-result rollback and add the
  split restore;
- include `modifiedExpenseRows` and `modifiedSplitRows` in the failure return
  when they are non-empty.

In `_runTagBatch`, record a delete compensation when the failed result carries
modified rows, so `_rollbackTagBatch` can retry an unresolved restore.

**Tests.** New test in `tests/backend/tags.test.js`. Use
`failNextWrite("Tags", "copyTo")` on the delete Food plus add Travel batch.
Assert the response is a structured failure with `/Changes reverted/`, Tags,
Finances and Split Transactions are unchanged, the lock is free, and a retry
succeeds. Add a guard test with `failNextWrite("Split Transactions",
"setValues")` that the expenses rows are restored and all three sheets are
unchanged.

**Acceptance criteria.** The copyTo test fails before the fix with external
rows changed and passes after it. No existing test changes.

**Existing tests affected.** None.

**Status.** done

### Part 2: Revert a partial external write during rename

**Goal.** If renaming a tag changes Finances or Split Transactions and the
update then fails or throws, the external rows return to the old tag, not just
the Tags master.

**Changes.**

- `google-apps-script/Service_Tags.gs`, `_renameTag`: set `expensesUpdated`
  before calling `updateExpensesWithTag` and `splitsUpdated` before calling
  `updateTagInSplits`, so the catch compensates even when the call throws after
  a partial write. Revert expenses and splits independently, each guarded.
- `tests/backend/harness.js` and `fakes.js`: add a test-only fail-after-write
  mode to `failNextWrite` (the write applies, then the fault throws), because
  the existing hook throws before mutating.

**Tests.** New tests in `tests/backend/tags.test.js`:

- rename `Food` to `Meals` with a fail-after-write on Finances `setValues`:
  the response fails, the Tags row is `Food`, and the Finances and Split rows
  still say `Food`;
- the same for a Split Transactions `setValues` failure;
- a normal rename still succeeds afterwards (the fault is one-shot).

**Acceptance criteria.** Both tests fail before the fix with `Meals` left in an
external sheet and pass after it. No existing test changes.

**Existing tests affected.** None.

**Status.** todo

### Notes for the next session

- Part 1 is the original B-006 repro; part 2 is the narrower rename gap.
- Restoration is best effort. If both the original write and the restore fail,
  the message must say the data is inconsistent and name the rows.
