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

Not retired yet. The phase is in `plan.md`; it is retired here once its pull
request is merged.
