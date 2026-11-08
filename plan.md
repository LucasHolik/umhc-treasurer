# Plan

Detailed plan for the current phase only. The grand plan is in
[`rough_plan.md`](rough_plan.md).

## Phase 4: Backend hardening

Approved by the user on 2026-11-08. Two parts, in this order. Part 1 is the
data-integrity fix; part 2 is two small response-shape fixes.

### Part 1: Roll back a tag batch after an unexpected write throw (B-004)

**Goal.** An uncaught write error inside `_runTagBatch` must roll the batch
back instead of leaving Tags, Finances and Split Transactions half-changed.

**Changes.** In `google-apps-script/Service_Tags.gs`, put a `try`/`catch`
inside the `withScriptLock` callback in `_runTagBatch`, after the snapshot and
the batch bookkeeping. Wrap the operation loop and the final `_sortTags`.
Track the current index. In the catch:

- build a failed result for the current index with a message such as
  `Unexpected error at index N: ...`;
- call `_rollbackTagBatch(snapshot, compensations, results, operations,
failedIndex, message)` and return its result;
- if the post-loop `_sortTags` throws, use the last index so every applied
  result flips to rolled back.

Keep `_snapshotTagSheet()` outside the `try`: if it throws, nothing has
changed. The catch is inside the lock so the rollback runs before the lock is
released. `_rollbackTagBatch` already protects its own restore and
compensations.

**Tests.** New test in `tests/backend/tags.test.js`. Use
`helpers.failNextWrite("Tags", "setValue")` on the delete Food plus add
Travel batch. Assert the response is a structured failure with
`/Unexpected error/` and `/Changes reverted/`, the result statuses are
rolled back or failed and skipped, `appliedOperations` is empty, the rollback
metadata says it succeeded, Tags, Finances and Split Transactions are
unchanged, the lock is released, and a one-shot retry succeeds.

**Acceptance criteria.** The new test fails before the fix and passes after
it. The lock is released on the error path. No existing test changes.

**Existing tests affected.** None.

**Status.** done

### Part 2: JSONP callback fallback and split history total (B-003, B-005)

**Goal.** A reserved-word callback must not produce a non-callable reply, and
`getSplitHistory` must stop returning a `total` that counts hidden PENDING
rows.

**Changes.**

- `google-apps-script/Code.gs`, `createJsonResponse`: add a reserved-name
  regex beside `callbackRegex`. Treat a match like any other invalid name and
  fall back to `callback`. Cover the keywords plus `undefined`, `NaN` and
  `Infinity`.
- `google-apps-script/Service_Split.gs`, `getSplitHistory`: remove `total`
  from the three returns (the empty case, the no-rows case and the normal
  return). Keep `totalRows` for the `pageSize` cap. This is D-017.

**Tests.**

- `tests/backend/code.test.js`: `requestRaw("ping", {},
{ callback: "false" })` returns a raw wrapper starting `callback(`, with
  the warning. Repeat for `"null"` and `"undefined"`. The valid custom name
  test already covers the normal path.
- `tests/backend/split.test.js`: seed one SOURCE and one PENDING row, request
  page 1 with a large page size, and assert one visible row, `hasMore` false
  and no `total` field. Before the fix `total` is 2.

**Acceptance criteria.** Both new tests fail before the fixes. The client
still paginates, since it reads only `hasMore`. No existing test changes.

**Existing tests affected.** None.

**Status.** todo

### Notes for the next session

- Part 1 is the only data-integrity change. Do not combine it with part 2.
- B-005 removes a wire field; the only known client ignores it (D-017).
- If a helper throws after changing expenses but before returning, the Tags
  snapshot restores while those rows stay changed. The fix narrows that
  window; it does not make the helpers atomic. Record it as an edge case.
