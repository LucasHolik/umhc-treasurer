# Rough plan

The grand plan for the repository. It stays high level: the end goal and the
phases on the way there. `plan.md` holds the detail for the current phase only.

## End goal

A zero-cost, browser-based financial manager for the UMHC treasurer: a static
frontend on GitHub Pages, a Google Apps Script API and a Google Sheet as the
database. It should be quick enough to use after every training session, safe
enough to give helpers view-only access, and documented well enough that the
next treasurer, or a fresh agent, can take it over.

Success looks like: the treasurer can import a bank statement, tag, split and
analyse transactions, and trust the balance; a viewer can look without changing
anything; and nobody pays for hosting or a database.

## Phases

### Phase 1: Adopt the agent workflow (done)

Add `AGENTS.md` and the seven planning files, fill in the project-specific
section, and make the checks it documents pass. Definition of done: the change
is merged, `npm run format:check` is green on `main`, and a fresh agent can
start from `plan.md` without asking what happened last time.

### Phase 2: Move the test suite to Node (done)

Merged in pull request #4. The browser-only self-test suite and the Settings
Diagnostics screen were replaced by a Node suite in `tests/`, which mirrors
`src/` and runs on `node:test` with happy-dom. `npm test` runs every test
without a browser or backend. Definition of done met: one command runs all 159
tests. The planning files were aligned with the merged work afterwards.

### Phase 3: Backend test harness (done)

Approved on 2026-11-08 and completed in the Phase 3 pull request.
`tests/backend/` loads the `.gs` files into a Node `vm` with in-memory fakes
and has 47 tests covering the router, roles, auth, sanitisation, locking, tag
batches, splits and the B-002 fix.

### Phase 4: Backend hardening (done)

Completed in the Phase 4 pull request. Fixed B-004 (an unexpected write throw
now rolls the tag batch back inside the lock, including a sort throw), B-003
(reserved-word JSONP callbacks fall back to `callback`) and B-005
(`getSplitHistory` no longer returns `total`, which counted hidden PENDING
rows; D-017). B-006 records a residual tag-helper window.

### Phase 5: Fix B-006, tag delete and rename rollback (approved, in progress)

Make a late Tags write during deletion restore the external Finances and Split
Transactions rows, and make a partial external write during rename get
reverted. Definition of done: both regression tests pass, the full suite is
green, and B-006 is fixed.

### Phase 6 and beyond

To be agreed with the user. Backup and restore is dropped (D-016), and the
stale `origin/test` branch is left in place. Features go here before any code
is written, and this file is updated whenever direction or scope changes.
