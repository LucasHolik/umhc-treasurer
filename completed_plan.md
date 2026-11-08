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
