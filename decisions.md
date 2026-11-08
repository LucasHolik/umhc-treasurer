# Decisions

Design and code decisions, open and closed. Each entry keeps the question, the
context, the options and the outcome, so the reasoning survives a change of
agent. A closed decision is only reopened by a new entry that supersedes it.

## Open

None open.

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

### D-003: How should the full test suite run outside a browser?

**Question.** What is the supported way for an agent to run every test on a
machine, with a pass or fail result it can trust?

**Context.** The suite lived in `src/features/settings/selftest/` and only ran
inside the app from Settings, Diagnostics, Run Self-Test, which needed a login
against a real Apps Script backend. An agent could not run it from a terminal or
in a container without the backend URL and a passkey, and could not show a
reviewer a pass. `pnpm test` was a placeholder that exited 1. This blocked
Phase 2 of `rough_plan.md`.

**Options.**

1. **Keep it browser-only.** No new dependency. An agent opens the app, logs in
   and clicks Run Self-Test by hand, then reports that it did. Cannot be
   automated, and a headless session cannot do it at all.
2. **Add a Node runner with a DOM library.** One documented command imports the
   same test files and runs them outside a browser. All tests keep working,
   including the DOM ones. Cost: one dev dependency, plus a small entry script
   and a package script.
3. **Split the suite.** Run the pure tests under Node's built-in test runner and
   keep the DOM tests browser-only. No dependency for the pure majority, but two
   entry points, and the DOM tests still need a browser.
4. **Drive a real browser (for example Playwright).** Tests the real app, but
   adds a heavy dependency, still needs a backend login, and is slow.

**Recommendation.** Option 2, with jsdom named as the example.

**Choice.** Option 2, with happy-dom instead of jsdom. `npm test` runs
`node --test` over `tests/**/*.test.js`; `tests/setup.js` registers happy-dom's
browser globals. The existing tests were converted from the in-app runner to
`node:test`, and the in-app self-test and the Settings Diagnostics screen were
removed.

**Reason.** It runs the whole suite outside a browser with no backend, and the
DOM library is development-only. The coverage was carried over test by test
into `tests/`, which mirrors `src/`. It is the same approach the recommendation
described.

**Decided by.** User, 2026-11-08, merged in PR #4 (`14fa519`).

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

**Superseded in part by.** D-008, which updates where the tests run.

**Decided by.** Overseer, 2026-11-08.

### D-005: Formatting gate and generated `.archify` artefacts

**Question.** How should the formatting check (now `npm run format:check`) be
made to pass on `main`?

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

**Superseded by.** D-007, then D-013.

**Decided by.** Overseer, 2026-11-08.

### D-007: `info.txt` is maintained again

**Question.** Which document is the maintained map now that `CLAUDE.md` says to
keep `info.txt` in step with the code?

**Context.** D-006 made `architecture.md` the only maintained map and froze
`info.txt`. `CLAUDE.md`, merged in PR #4, says both apply and that `info.txt`
must be kept in step when the architecture changes. The later instruction takes
precedence.

**Options.** (a) Keep D-006 and drop the requirement from `CLAUDE.md`. (b)
Maintain both, with different roles.

**Choice.** Option (b). `architecture.md` stays the short agent map; `info.txt`
is the detailed reference and is updated when the architecture changes. Known
drift in `info.txt` is listed in `architecture.md` and fixed when that area is
next touched.

**Reason.** The user asked for `info.txt` to be maintained, and its detail is
useful. The two documents have different jobs, so they do not need to duplicate
each other.

**Decided by.** User, via `CLAUDE.md`, 2026-11-08. Supersedes D-006.

**Superseded by.** D-013.

### D-008: Test platforms after the Node suite

**Question.** Where do the tests run now that they live in Node?

**Context.** D-004 tied the tests to a current browser because the suite ran
inside the app. PR #4 moved it to `node --test` with happy-dom, so a browser is
no longer needed for the tests.

**Options.** (a) Keep the browser requirement for tests. (b) Run the tests under
Node on every development machine and keep browser checks manual.

**Choice.** Option (b). The app still targets the browsers in D-004. `npm test`
runs under Node 22.6 or later on macOS, Windows 11 and Linux. Node 20 does not
expand the quoted glob, and Node 22.0 to 22.5 fail three debounce tests in the
mock timers; `node --test tests/` passes on Node 20. Interface behaviour is
checked manually in a browser. There are no GPU or hardware-specific tests.

**Reason.** The suite is now plain Node, and keeping a browser requirement would
make it needlessly hard to run in a container. The interface still needs a
browser because the suite does not drive one.

**Decided by.** Overseer, 2026-11-08. Supersedes the test-platform part of
D-004.

### D-009: happy-dom as a development dependency

**Question.** Which DOM environment should the Node tests use?

**Context.** The tests import browser modules that need `document`, `window`
and storage. PR #4 added `@happy-dom/global-registrator` and `tests/setup.js` to
provide them.

**Options.** (a) happy-dom. (b) jsdom. (c) No DOM library and skip the DOM
tests. (d) Playwright against a real browser.

**Choice.** Option (a): `@happy-dom/global-registrator` `^21.0.3`, pinned in
`package-lock.json`, development only. happy-dom needs Node 20 or later; the
`npm test` script needs Node 22.6 or later for glob support and the mock-timer
fix.

**Reason.** It is fast, works with ES modules, and registers the browser globals
that `tests/setup.js` needs. It is never shipped: the app has no runtime
dependencies and imports nothing from `node_modules/`. jsdom would also work;
happy-dom was the one chosen. Option (c) would weaken the suite, and option (d)
is too heavy for unit tests.

**Note.** `npm` is now the documented package manager. Older entries that name
`pnpm` refer to the same `package.json` scripts and still work.

**Decided by.** User, 2026-11-08, merged in PR #4. Recorded by the overseer.

### D-010: How `AGENTS.md` and `CLAUDE.md` fit together

**Question.** Both files set rules. Which applies?

**Context.** `AGENTS.md` covers the workflow, roles, planning files and git.
`CLAUDE.md`, merged in PR #4, covers the design philosophy and test rules. They
overlap on design and testing.

**Options.** (a) Merge one into the other. (b) Keep both and give each a clear
job.

**Choice.** Option (b). `AGENTS.md` governs how work is planned, reviewed and
committed. `CLAUDE.md` governs how the code is designed and tested. Where they
overlap, the more specific `CLAUDE.md` test-style rules apply, and the
implement/review loop in `AGENTS.md` still governs the process. Section 10 of
`AGENTS.md` points to `CLAUDE.md`.

**Reason.** Merging them would make both longer and mix process with design.
Keeping them separate lets each stay readable.

**Decided by.** Overseer, 2026-11-08. The user can merge them later if the split
becomes annoying.

**Superseded by.** D-012.

### D-011: happy-dom 21.0.3 has a high-severity advisory

**Question.** How should the development dependency be handled?

**Context.** `npm audit` reports GHSA-834v-8h66-3h79 (CVE-2026-33943) for
happy-dom 17.0.0 to 21.0.3: an unsanitised import alias can lead to host code
execution. Version 21.0.4 is available, and `npm audit fix` updates to it
within the current `^21.0.3` range. happy-dom is development only, is never
shipped, and the tests import local modules rather than untrusted HTML.

**Options.** (a) Run `npm audit fix`, take 21.0.4 and re-run the tests. (b)
Stay on 21.0.3 and accept the development-only risk. (c) Replace happy-dom
with jsdom.

**Recommendation.** Option (a). It is a patch bump inside the existing range,
so no API change is expected. Options (b) and (c) are more work for a
development-only tool.

**Choice.** Option (a). `npm audit fix` updated happy-dom from 21.0.3 to 21.0.4
in `package-lock.json`; `package.json` did not change. `npm audit` reports no
vulnerabilities and `npm test` still passes 159 tests.

**Reason.** It is a lockfile-only patch that clears the advisory without
changing the API or the dependencies the app ships.

**Decided by.** User, 2026-11-08.

### D-012: Retire `CLAUDE.md` into `AGENTS.md`

**Question.** Should the separate `CLAUDE.md` remain?

**Context.** `CLAUDE.md`, added in PR #4, held the design and testing rules. It
overlapped `AGENTS.md` sections 2 and 3, pointed at `info.txt`, and split the
policy across two files. The user asked for one policy file with the repo
specifics inside `AGENTS.md`.

**Options.** (a) Keep both files. (b) Merge `CLAUDE.md` into `AGENTS.md` and
delete it.

**Choice.** Option (b). `AGENTS.md` section 2 gained the missing deep-module
rules, and section 10 now holds the layering and code rules, known debt, test
layout and style, what else needs tests, and planned coverage.
`CLAUDE.md` is deleted and `README.md` points at `AGENTS.md`.

**Reason.** One policy file is easier to keep current, and `CLAUDE.md` no longer
has a separate audience or job.

**Decided by.** User, 2026-11-08. Supersedes D-010.

### D-013: Retire `info.txt`

**Question.** Should `info.txt` remain as a second architecture document?

**Context.** `info.txt` was a 30 KB detailed write-up. D-007 had brought it back
into the maintained set, but it had already drifted in several places and
duplicated `architecture.md`. The user said there is no point in keeping it.

**Options.** (a) Keep and maintain both maps. (b) Delete `info.txt` and keep
`architecture.md` as the only map.

**Choice.** Option (b). `info.txt` is deleted. `architecture.md` is the only
architecture document, and `AGENTS.md` section 10 holds the rules. The facts
from `info.txt` that are still useful are in `architecture.md`. The old file
remains in git history if it is ever needed.

**Reason.** Two maps drifted apart, and the detailed one was stale. One current
map is more useful than two that disagree.

**Decided by.** User, 2026-11-08. Supersedes D-007 and D-006.
