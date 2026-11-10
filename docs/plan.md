# Plan

Detailed plan for the current phase only. The grand plan is in
[`rough_plan.md`](rough_plan.md).

No phase is planned yet. Phase 6 and beyond is to be agreed.

## Interim fix: B-007

### Part 1: report a missing split restore helper as a failed rollback

**Goal.** Stop `_rollbackTagBatch` claiming "Changes reverted" when it cannot
restore Split Transactions rows because `Service_Split.restoreTagInSplits` is
missing. The batch must report `rollback.success: false` and the
`Data is INCONSISTENT` detail instead.

**Changes.**

- `google-apps-script/Service_Tags.gs`, `_rollbackTagBatch`: when
  `comp.splitRows` is non-empty, branch on the helper being available. If it is
  missing, log a critical error and set `rollbackSuccess = false` with the
  inconsistent detail. Otherwise call the helper as now and keep the existing
  failure handling.
- `tests/backend/harness.js`: add a narrow test-only helper that removes
  `Service_Split.restoreTagInSplits` from the private vm context, so a
  deployment mismatch can be simulated. No production behaviour changes.
- `tests/backend/tags.test.js`: new regression test. Hide the helper, inject a
  Tags write fault on the operation after a successful Food category delete,
  then assert the rollback reports failure, names the missing helper, logs it,
  does not say "Changes reverted", leaves the split rows cleared (the helper is
  gone), and restores Tags and Finances.

Out of scope: the missing pre-flight check for `restoreTagInSplits` in
`_deleteTag`. It is recorded as B-008 for later.

**Tests.** The new test must fail on the unfixed code and pass after the fix.
Full `npm test` and `npm run format:check` must pass.

**Acceptance criteria.**

- A missing `restoreTagInSplits` with pending split rows produces
  `rollback.success: false`, a message containing `Data is INCONSISTENT`, and
  no "Changes reverted" claim.
- A present helper still restores the rows and reports success, as covered by
  the existing rollback tests.
- The new test fails without the `Service_Tags.gs` change.
- No existing test is modified.
- No pre-flight check is added and no docs outside this plan are changed by
  the implementer.

**Existing tests affected.** None.

**Status.** done. Reviewed and approved. Committed and pushed on
`fix/b007-rollback-claim`; awaiting the user's merge decision.

**Review notes.** The present-helper failure branch is unchanged and still has
no direct test. The new test deliberately asserts the log payload's `splitRows`,
so a future log-format change must update it. Both were accepted as
nice-to-haves, not blockers.
