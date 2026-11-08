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
is merged, `pnpm format:check` is green on `main`, and a fresh agent can start
from `plan.md` without asking what happened last time.

### Phase 2: Run the test suite from the terminal (proposed, needs agreement)

The self-test suite exists but only runs inside the app in a browser, after a
login against a real backend. An agent therefore cannot prove that the full
suite passes before calling a part done. Choose an approach (D-003) and
implement it without rewriting the tests. Definition of done: one documented
command runs every test without a browser or backend and exits non-zero on
failure.

### Phase 3: Decide the future of backup and restore (proposed, needs agreement)

An unmerged backup and restore attempt lives on the `origin/test` branch. It
predates the current split, tag and security work, so it cannot be merged as it
stands. Decide whether the feature is still wanted and, if it is, plan it as its
own phase. Definition of done: a closed decision records the answer, and either
a phase is planned or the stale branch is removed.

### Phase 4 and beyond

To be agreed with the user. Features go here before any code is written, and
this file is updated whenever direction or scope changes.
