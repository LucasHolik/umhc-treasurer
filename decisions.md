# Decisions

Design and code decisions, open and closed. Each entry keeps the question, the
context, the options and the outcome, so the reasoning survives a change of
agent. A closed decision is only reopened by a new entry that supersedes it.

## Open

### D-003: How should the full test suite run outside a browser?

**Question.** What is the supported way for an agent to run every test on a
machine, with a pass or fail result it can trust?

**Context.** The suite lives in `src/features/settings/selftest/` and registers
tests with a small in-app runner. It covers pure helpers (utils, financial
logic, transactions, tags, trip status, analysis, state, API helpers, Excel
parsing) and DOM helpers. Today it is started from Settings, Diagnostics, Run
Self-Test, which needs a login against a real Apps Script backend. That means an
agent cannot run it from a terminal, cannot run it in a container without the
backend URL and a passkey, and cannot show a reviewer a pass. `pnpm test` is a
placeholder that exits 1. This blocks Phase 2 of `rough_plan.md`.

**Options.**

1. **Keep it browser-only.** No new dependency. An agent opens the app, logs in
   and clicks Run Self-Test by hand, then reports that it did. Cannot be
   automated, and a headless session cannot do it at all.
2. **Add a Node runner with a DOM library (for example jsdom).** One documented
   command imports the same test files and runs them outside a browser. All
   tests keep working, including the DOM ones. Cost: one dev dependency, plus a
   small entry script and a package script. The browser route stays for humans.
3. **Split the suite.** Run the pure tests under Node's built-in test runner and
   keep the DOM tests browser-only. No dependency for the pure majority, but two
   entry points, and the DOM tests still need a browser.
4. **Drive a real browser (for example Playwright).** Tests the real app, but
   adds a heavy dependency, still needs a backend login, and is slow.

**Recommendation.** Option 2. It is the only option that runs the whole existing
suite unchanged with one command, and the dependency is development-only. The
test files themselves would not be edited. This needs the user, because it adds
a dependency (section 2 and section 8 of `AGENTS.md`).

**Status.** Open, needs the user. Blocks Phase 2.

## Closed

### D-001: Adopt the agent workflow described in `AGENTS.md`

**Question.** Should this repository adopt the supplied agent workflow, with
`AGENTS.md` at the root and the seven planning files?

**Context.** The user supplied `AGENTS.md` and asked for it to be implemented in
the repository. The workflow depends on planning files that did not exist yet,
and on a project-specific section that was empty.

**Options.** (a) Keep the document outside the repository. (b) Commit it and
create the planning files it refers to.

**Choice.** Option (b). `AGENTS.md` is at the root, formatted with Prettier, with
section 10 filled in for this project. The seven planning files exist and are
seeded from the code as it is.

**Reason.** The user asked for it, and the planning files are what make work
resumable across sessions.

**Decided by.** User, 2026-11-08.

### D-002: `[skip ci]` and the mirror workflow

**Question.** `AGENTS.md` section 3 says to add `[skip ci]` to commits when a
repository already has CI that runs on push. Should commits here carry it?

**Context.** The only workflow is `.github/workflows/sync.yml`. It triggers on a
push to `main`, runs no tests, and force-pushes `main` to
`UMHC/umhc-treasury`, which is how the public site is updated. A push to any
other branch triggers nothing.

**Options.** (a) Add `[skip ci]` to every commit, as section 3 says. (b) Never
add it on `main`.

**Choice.** Option (b). Commits destined for `main` must not carry `[skip ci]`;
feature-branch commits need not carry it because they do not trigger the
workflow.

**Reason.** `[skip ci]` would silently stop the deployment mirror, leaving the
public site stale. The workflow is a deployment step, not a test run, so the
rule in section 3 does not serve its purpose here. Tests stay local. This
entry should be revisited if a test workflow is ever added.

**Decided by.** Overseer, 2026-11-08.

### D-004: Target platforms

**Question.** Which platforms must the app and its tests support?

**Context.** This is a static web app with no native code. It uses ES modules,
`SubtleCrypto`, `structuredClone` and modern CSS, so it needs a current browser.
The development machines are macOS (Apple Silicon), Windows 11 and a Linux
container, as described in `AGENTS.md` section 3. The app already ships phone
layouts.

**Options.** (a) Desktop browsers only. (b) Desktop plus phone browsers. (c) Add
a native or server component.

**Choice.** Option (b). Supported targets are current Chrome, Edge, Firefox and
Safari on desktop, and Chrome on Android and Safari on iOS. Development and
tests run on any of the three development machines with a current browser. There
are no GPU, CUDA or Metal tests and no hardware-specific skips.

**Reason.** The app already ships phone layouts, so excluding phones would drop
a supported way of using it. The browser APIs in use are available in all the
listed targets.

**Decided by.** Overseer, 2026-11-08.

### D-005: Formatting gate and generated `.archify` artefacts

**Question.** How should `pnpm format:check` be made to pass on `main`?

**Context.** The baseline check on `main` failed: four committed files under
`.archify/architecture-umhc-treasurer-20261005-162240/` are not
Prettier-formatted. They are generated output from the `archify` skill, not
hand-written source.

**Options.** (a) Reformat the generated files and commit the churn. (b) Add
`.archify/` to `.prettierignore`. (c) Remove `.archify/` from the repository.

**Choice.** Option (b).

**Reason.** Formatting generated files would churn on every regeneration without
changing anything a reader cares about. The folder is not edited by hand. The
rest of the repository stays in the formatting gate. Option (c) would lose the
diagram, which is still useful.

**Decided by.** Overseer, 2026-11-08.

### D-006: `architecture.md` and `info.txt`

**Question.** Which document is the maintained map of the codebase?

**Context.** `info.txt` is a 30 KB architecture write-up from an earlier session.
It is detailed and mostly accurate, but it is not part of the planning files and
would be expensive to keep current. `AGENTS.md` requires `architecture.md` to be
updated after every approved part.

**Options.** (a) Maintain `info.txt` as the map. (b) Maintain `architecture.md`
as the map and keep `info.txt` as a historical reference.

**Choice.** Option (b). `architecture.md` is the maintained map.
`info.txt` stays as a detailed historical snapshot, is not updated after each
part, and must not be trusted over the code or `architecture.md`.

**Reason.** The workflow already updates `architecture.md`. Two maintained maps
would drift apart, and a stale map is worse than a short current one.

**Decided by.** Overseer, 2026-11-08.
