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

### Phase 3: Backend test harness (approved, in progress)

Approved by the user on 2026-11-08; `plan.md` holds the five parts.

`AGENTS.md` section 10.5 plans tests for the Apps Script backend by loading the
`.gs` files into a Node `vm` with in-memory fakes for `SpreadsheetApp`,
`LockService` and `CacheService`. That harness is also where B-002's regression
test belongs, and where split, tag rollback and signature behaviour can be
pinned down. Definition of done: the harness exists, the first backend
behaviours are tested, and `npm test` runs them.

### Phase 4: Decide the future of backup and restore (proposed, needs agreement)

An unmerged backup and restore attempt lives on the `origin/test` branch. It
predates the current split, tag and security work, so it cannot be merged as it
stands. Decide whether the feature is still wanted and, if it is, plan it as its
own phase. Definition of done: a closed decision records the answer, and either
a phase is planned or the stale branch is removed.

### Phase 5 and beyond

To be agreed with the user. Features go here before any code is written, and
this file is updated whenever direction or scope changes.
