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

Out of scope for part 1: the missing pre-flight check for
`restoreTagInSplits` in `_deleteTag` (B-008). It is handled in part 2.

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
- Part 1 adds no pre-flight check and the implementer changes no docs outside
  this plan.

**Existing tests affected.** None.

**Status.** done. Reviewed and approved. Commit `9a6ca19`; part 2 replaced its
regression test.

**Review notes.** The present-helper failure branch is unchanged and still has
no direct test. The original B-007 regression test was replaced in part 2
because B-008 refuses the delete before that branch can run; the guard remains
defence in depth.

### Part 2: refuse a tag delete without a split restore helper

**Goal.** Stop `_deleteTag` clearing a tag from Split Transactions when
`Service_Split.restoreTagInSplits` is missing, so a batch never reaches a state
it cannot undo (B-008).

**Changes.**

- `google-apps-script/Service_Tags.gs`, `_deleteTag`: add
  `!Service_Split.restoreTagInSplits` to the existing `Service_Split`
  pre-flight, keeping the "Service_Split dependency not available. Tag NOT
  deleted." response. Add a short comment at the B-007 rollback branch saying
  it is defence in depth now that the delete pre-flight refuses that
  deployment.
- `tests/backend/tags.test.js`: replace the unmerged B-007 test "a missing
  split restore helper reports an inconsistent rollback" with "a missing split
  restore helper refuses the tag delete". Hide the helper, send the same
  two-operation batch, and assert the delete fails with the dependency message,
  the add is skipped, `appliedOperations` is empty, and Tags, Finances and
  Split Transactions are unchanged. The B-007 rollback branch is no longer
  reachable through the public actions; it remains defence in depth.

**Tests.** The refusal test must fail without the pre-flight change, because
the delete then succeeds and clears Split Transactions. Full `npm test` and
`npm run format:check` must pass.

**Acceptance criteria.**

- Hiding `restoreTagInSplits` and deleting a used Category returns the
  dependency message and `success: false`.
- The batch reports the delete as failed and the following operation as
  skipped, with nothing changed on any sheet.
- The new test fails without the pre-flight change.
- No merged test is modified. Replacing the unmerged B-007 test is intentional
  and recorded here; the user approved B-008 on 2026-11-10.
- The B-007 guard stays in place as defence in depth.

**Existing tests affected.** The unmerged B-007 test is replaced, as described
above. No merged test changes.

**Status.** done. Reviewed and approved on 2026-11-10. Committed and pushed on
`fix/b007-rollback-claim`; awaiting the user's merge decision.

**Review notes.** The reviewer suggested a direct `deleteTag` refusal test and
pinning or rewording the vacuous "Changes reverted." on a no-change rollback;
both are nice-to-haves. The remove-missing and whole-`Service_Split`-undefined
operands are verified by inspection only, because the harness seam hides only
the restore helper. The extra snapshot rewrite on a refused batch delete is
recorded as E-034.
