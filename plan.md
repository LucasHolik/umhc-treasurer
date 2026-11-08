# Plan

Detailed plan for the current phase only. The grand plan is in
[`rough_plan.md`](rough_plan.md); a successor should start here.

## Phase 1: Adopt the agent workflow

**Baseline checked on `main`, 2026-11-08:**

- The working tree was clean and `main` was up to date with `origin/main`.
- `pnpm format:check` failed on four generated files under `.archify/` (B-001).
- `pnpm test` is a placeholder that exits 1. The real suite is the in-app
  self-test (156 tests), which needs a browser and a logged-in backend.
- No linter and no type checker exist.

A fresh reviewer approved the phase on 2026-11-08 after three attempts. The
review findings are reflected in the files, including B-002.

### Part 1: Add `AGENTS.md` with the project section filled in

**Goal.** Make the supplied agent workflow the repository's written policy.

**Changes.** New [`AGENTS.md`](AGENTS.md) at the root. The text is the supplied
document, formatted by Prettier, with section 10 completed for this repository:
what the app is, language and framework, target platforms, and the verified
install, test, format, type check and run commands. The unusual points cover the
manual Apps Script redeploy, the login requirement for the self-test, JSONP, and
the `[skip ci]` rule (D-002).

**Tests.** Documentation only. `pnpm format:check` must pass on the new file.

**Acceptance criteria.** The policy text matches what the user supplied, apart
from section 10 and Prettier whitespace. Every command in section 10 has been
checked on this machine. Section 10 mentions the missing automated test runner
rather than pretending one exists.

**Existing tests affected.** None.

**Status.** done

### Part 2: Create the seven planning files and seed them from the code

**Goal.** Give a fresh agent the memory it needs to resume work: where the
project is going, what the code looks like, what was decided, what is broken and
which edge cases matter.

**Changes.** New `rough_plan.md`, `plan.md`, `completed_plan.md`,
`architecture.md`, `decisions.md`, `bugs.md` and `edge_cases.md`.
`architecture.md` comes from a fresh read of the code, not from `info.txt`
alone, and records where the old write-up has drifted. `decisions.md` records
D-001 to D-006, including the open D-003 on running tests outside a browser.
`bugs.md` records the baseline formatting failure (B-001) and the
opening-balance comma bug found in review (B-002). `edge_cases.md` is
seeded with the cases already covered by the self-test suite, and marks the
backend-only ones that have no test.

**Tests.** Documentation only. Every link between the files resolves, and
`pnpm format:check` passes.

**Acceptance criteria.** A fresh agent can read `plan.md`, `architecture.md` and
the open entries and know what to do next. No statement in the new files
contradicts the code. D-003 is open and explains why Phase 2 cannot start yet.

**Existing tests affected.** None.

**Status.** done

### Part 3: Make the formatting gate pass on the whole repository

**Goal.** A documented check that agents and reviewers can actually trust.

**Changes.** Add `.archify/` to [`.prettierignore`](.prettierignore). No
application source changes. The generated diagram files stay byte-for-byte as
they were.

**Tests.** Run `pnpm format:check` before and after. It must fail before the
change and exit 0 after it. No unit test applies to a formatter configuration.

**Acceptance criteria.** `pnpm format:check` exits 0 for the whole repository.
`src/lib/` is still ignored. No generated file was edited or removed.

**Existing tests affected.** None.

**Status.** done

### Notes for the next session

- Phase 1 is retired into [`completed_plan.md`](completed_plan.md) once the pull
  request is merged.
- Phase 2 cannot start until the user answers D-003. Do not add a test runner
  before then. B-002 is open and low; schedule it or leave it recorded. Its fix
  needs a way to test the backend parser, or a pure helper it can call.
- The `origin/test` branch holds unmerged backup and restore work. Do not merge
  it; Phase 3 of `rough_plan.md` decides what to do with it.
