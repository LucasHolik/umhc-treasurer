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
- **Quality**: the built-in self-test suite and Prettier formatting.

## Phase 1: Adopt the agent workflow

Merged in pull request #5 (merge commit `ef6814e`). What was built:

- `AGENTS.md` at the root, with section 10 filled in for this repository.
- The seven planning files, seeded from a fresh read of the code.
- `.archify/` added to `.prettierignore`, so `pnpm format:check` passes.

Key decisions: D-001 (adopt the workflow), D-002 (no `[skip ci]` on `main`),
D-004 (web target platforms), D-005 (ignore generated `.archify` output) and
D-006 (`architecture.md` is the maintained map). Deferred: D-003, how the
self-test suite should run outside a browser, which blocks Phase 2. B-002 (a
comma-formatted opening balance is read as 1) was found during review and
recorded, not fixed.
