# Completed plan

Condensed record of every finished phase, oldest first. Append only: never
rewrite an earlier entry.

## Before the planning files

The work below predates `AGENTS.md` and is recorded in git history. It is
summarised here so a successor knows what already exists.

- **Core app**: dashboard, transactions (manual entry, inline editing, bulk
  tagging), tags, analysis, Excel upload and settings.
- **Security**: no `innerHTML`, HMAC-SHA256 request signing, replay protection,
  dual passkeys with viewer and full-access roles, and login lockout.
- **Reliability**: a single script lock around reads and writes, per-request
  client timeouts, and save recovery that reloads after an unknown outcome.
- **Mobile**: phone layouts for dense tables and controls.
- **Trip statuses**: four statuses including "Completed Investment", with past
  Trip/Event tags hidden behind a toggle when tagging.
- **Quality**: Prettier formatting, and the test suite that grew from the
  in-app self-test into the Node suite in `tests/`.

## Phase 1: Adopt the agent workflow

Merged in pull request #5 (merge commit `ef6814e`). What was built:

- `AGENTS.md` at the root, with section 10 filled in for this repository.
- The seven planning files, seeded from a fresh read of the code.
- `.archify/` added to `.prettierignore`, so `npm run format:check` passes.

Key decisions: D-001 (adopt the workflow), D-002 (no `[skip ci]` on `main`),
D-004 (web target platforms), D-005 (ignore generated `.archify` output) and
D-006 (`architecture.md` is the maintained map). Deferred at the time: D-003,
how the self-test suite should run outside a browser, which blocked Phase 2.
Phase 2 closed it. B-002 (a comma-formatted opening balance is read as 1) was
found during review and recorded, not fixed.

## Phase 2: Move the test suite to Node

Merged in pull request #4 (`14fa519`), alongside `CLAUDE.md`. The in-app
self-test suite and the Settings Diagnostics screen were removed. Tests now live
in `tests/`, mirror `src/`, and run on `node:test` with happy-dom providing
browser globals. `npm test` runs 159 tests with no browser or backend on Node
22.6 or later, and `npm run test:watch` re-runs on change. `package-lock.json`
is committed and `@happy-dom/global-registrator` is the only direct development
dependency (D-009).

Key decisions: D-003 (Node runner), D-007 (`info.txt` maintained again), D-008
(test platforms), D-009 (happy-dom) and D-010 (how `AGENTS.md` and `CLAUDE.md`
fit together). `info.txt`, `README.md` and the package scripts were updated in
the same pull request. Deferred: backend `.gs` tests in a Node `vm`, service
contract tests and Playwright journeys, all listed as planned coverage in
`CLAUDE.md`. This phase was merged without a `plan.md` entry; the re-check in
section 6 of `AGENTS.md` caught the planning files up afterwards.

## Documentation consolidation

After Phase 2, the user retired the two supporting documents. `CLAUDE.md` was
merged into `AGENTS.md` and deleted (D-012): section 2 gained the missing rules
for deep modules, and section 10 now holds the layering and code rules, known
debt, test layout and style, what else needs tests, and planned coverage.
`info.txt` was deleted (D-013), leaving `architecture.md` as the only
architecture map. `README.md` now points at `AGENTS.md`.

In the same pass, the approved happy-dom advisory was fixed (D-011): `npm audit
fix` moved the lockfile to happy-dom 21.0.4, `npm audit` reports no
vulnerabilities, and the suite still passes 159 tests.

## Phase 3: Backend test harness

Merged in the Phase 3 pull request. Built `tests/backend/`: a private Node
`vm` harness that loads all `.gs` files into one script with in-memory fakes
for SpreadsheetApp, LockService, CacheService, Utilities and ContentService.
Tests sign requests independently of the server and use test-only clock, lock
and write-fault hooks.

The 47 backend tests cover the router and roles, signature, timestamp and
nonce checks, UTF-8 signing, login lockout and logout, sanitisation, lock
nesting and release, tag batch rollback, split create, revert, edit, stale
PENDING and promotion failure, and the B-002 opening balance fix (206 tests in
total).

Key decisions: D-015 (harness shape). Fixed B-002. Found and recorded B-003
(reserved-word JSONP callback), B-004 (half-applied tag batch on an unexpected
write throw) and B-005 (split history total counts PENDING). Deferred: the
service contract tests and Playwright journeys listed in `AGENTS.md` section
10.5.

## Phase 4: Backend hardening

Merged in the Phase 4 pull request. Fixed three backend bugs with regression
tests:

- B-004: an unexpected throw in `_runTagBatch` now rolls the batch back inside
  the lock; the post-loop sort is covered too.
- B-003: reserved-word JSONP callbacks fall back to `callback`, so the reply
  stays callable.
- B-005: `getSplitHistory` no longer returns `total`, which counted hidden
  PENDING rows (D-017).

The backend suite is now 51 tests and the full suite 210. Found and recorded
B-006 (a helper that throws after changing external rows can still leave them
changed). Residual non-callable callback identifiers are recorded as E-032.

## Phase 5: Fix B-006, tag delete and rename rollback

Merged in the Phase 5 pull request. Fixed B-006:

- `_deleteTag` restores external rows when the Tags write throws, reports
  inconsistency when a restore fails, and includes unresolved rows for the
  batch compensation.
- `_renameTag` marks expenses and splits as attempted before the calls,
  reverts independently, and reports `Data is INCONSISTENT` when a revert
  fails.
- `_runTagBatch` retries a failed delete or rename compensation.
- The backend harness gained a fail-after-write mode.

The backend suite is 59 tests and the full suite 218. Found B-007 (a missing
split restore helper is treated as a successful rollback) and recorded E-033
(a direct delete has no Tags snapshot); both are open or recorded.
