# AGENTS.md

How AI agents work in this repository. Read this file in full before doing anything else.

The user's direct instructions in the conversation take precedence over this file. This file takes precedence over the planning files.

## 0. Starting or resuming work

Sessions end, contexts get compacted and containers get reclaimed, so work must always be resumable by a fresh agent with no memory of what came before.

- **On start**, read `plan.md` to find the current phase and any part marked `in progress`, check the current branch and `git status`, and skim `architecture.md` and the open entries in `decisions.md` and `bugs.md`. Pick up where the last session left off rather than starting again.
- **The planning files are the memory.** Keep each part's status in `plan.md` current at all times, and note anything a successor would need (for example "attempt 2 of 3, reviewer flagged X") under the part.
- **Commit and push often.** Push at least after every approved part. In a cloud session, anything not pushed is lost when the session ends.

## 1. Roles

### The overseer (the main agent the user talks to)

- Owns planning, coordination, documentation and git.
- May commit, push, open PRs and merge PRs without asking.
- Does **not** write feature code or tests itself. All code changes go through the implement/review loop (section 4).
- May edit the planning and documentation files directly: `rough_plan.md`, `plan.md`, `completed_plan.md`, `architecture.md`, `decisions.md`, `bugs.md`, `edge_cases.md`.
- Keeps its own context lean. Broad codebase searches, large file reads and investigations go to subagents, which report back summaries. The overseer works from those summaries and the planning files, so it does not lose track over long phases.

### Subagents

- **Implementer**: builds one part of `plan.md`, including its tests.
- **Reviewer**: a separate, fresh subagent that checks the implementer's work. It never reviews its own code and never fixes code itself; it only reports.

## 2. Design philosophy

### Deep modules

Prefer modules with a **small, simple interface** that hide a **large amount of complexity** underneath.

- A caller should be able to use a module correctly by reading its signature and a short docstring, without knowing how it works inside.
- Fewer, more powerful functions beat many shallow ones that each do a little. Avoid pass-through layers and wrappers that add no abstraction.
- Hide implementation details (data formats, retries, caching, edge cases) inside the module. Do not leak them through parameters or return types.
- Pick sensible defaults so that the common case needs no configuration.
- If a change forces callers to learn more about a module's internals, treat that as a design smell and rethink the interface.

### Build for future expansion

- Design interfaces around the concept, not the current single use case, so new behaviour can be added without changing existing callers.
- Keep clear seams (well-defined interfaces between modules) where future features are likely to plug in. `rough_plan.md` is the guide to what is likely to come.
- Do **not** build speculative features. Leave room for them; do not implement them before they are planned.

### Dependencies

- Prefer the standard library and dependencies the project already uses.
- Adding a new dependency is a decision: record it in `decisions.md` with the reason and the alternatives considered, and ask the user first (section 8).
- Prefer well-maintained, widely used packages, and pin versions in the project's usual way.

## 3. Tests

- **Every feature must have tests.** A part of `plan.md` is not done until its tests exist and pass.
- **Existing tests are a contract.** Once written and merged, a test must not be edited, weakened, skipped or deleted unless we are intentionally changing past behaviour.
- An intentional behaviour change must be stated explicitly in `plan.md` (which tests change and why) and approved by the user before those tests are touched.
- If an existing test fails during implementation, the assumption is that the new code is wrong, not the test. Fix the code. If the implementer believes the test itself is wrong, it stops and reports; it does not change the test.
- Bug fixes must include a new test that fails without the fix.
- Run the full test suite, not just new tests, before any part is considered done.
- Linting, formatting and type checks (whichever the project uses, see section 10) must also pass before a part is done. Treat their failures like test failures.

### Run tests locally, not on CI

GitHub Actions minutes are limited, so tests run on the machine the agent is working on, not on CI.

- Do not add, enable or extend CI workflows unless the user explicitly asks.
- If a repo already has CI that runs on push or on pull requests, add `[skip ci]` to commit messages unless the user has asked for a CI run.
- "Tests pass" means they pass locally. Say in the report where they were run (for example "macOS, local" or "Linux cloud container").

### Test platforms

The user's machines are:

- **MacBook Pro, M5** (macOS, Apple Silicon, GPU via Metal/MPS).
- **Windows 11 PC**: Ryzen 7 5800X, 32 GB RAM, RTX 4080 with 16 GB VRAM (GPU via CUDA).

Agents may also be running in a Linux cloud container with no GPU.

- By default, tests should run on all of these. Avoid hard-coded paths, path separators, line-ending assumptions and shell-specific scripts; use the language's cross-platform tooling instead.
- Choose the target platforms for each project based on what it is built for, record the choice in `decisions.md`, and list it in section 10.
- Tests that genuinely need one platform or hardware (CUDA, Metal, a Windows-only API, a lot of memory) must be clearly marked and skipped automatically elsewhere, with the reason given in the skip message. Never let them fail just because the hardware is missing.
- Keep the default test suite quick enough to run after every part. Slow or heavy tests (large models, long benchmarks) go behind a separate marker or command, and the report says whether they were run.

## 4. The implement/review loop

For every part in `plan.md`:

0. **Check the baseline.** Before starting, run the test suite on the current branch. If anything already fails, record it in `bugs.md` and tell the user, so pre-existing failures are not blamed on the new part, and the implementer is not tempted to "fix" tests to get a green run.
1. **Brief the implementer.** Give it: the part's section of `plan.md`, the relevant excerpt of `architecture.md`, the files it is expected to touch, the relevant entries from `decisions.md`, `bugs.md` and `edge_cases.md`, and the rules in sections 2 and 3 of this file.
2. **Implementer** builds the part and its tests, runs the full test suite, and reports:
   - What it changed.
   - Any decisions it had to make that the plan did not cover. It makes only obvious ones; a non-obvious decision means it stops and reports instead of guessing.
   - Any bugs or edge cases it discovered, whether or not it handled them.
3. **Brief a fresh reviewer.** Give it: the same part of `plan.md`, the diff, the implementer's report, and this file. The reviewer checks:
   - The part's acceptance criteria are met.
   - Tests exist for the new behaviour, are meaningful, and pass, along with linting, formatting and type checks.
   - No existing test was modified unless `plan.md` explicitly sanctions it.
   - Platform- or hardware-specific code and tests follow the rules in section 3.
   - No secrets, credentials or local config files are in the diff.
   - Any new dependency has a closed entry in `decisions.md`.
   - The code follows the design philosophy (deep modules, clean interfaces, room for expansion).
   - Nothing outside the part's scope was changed.
   - Edge cases listed in `edge_cases.md` for this area are handled and tested.
   - Any significant choice in the code is either in `decisions.md` or listed in the implementer's report.
     The reviewer returns either **APPROVED** or **CHANGES REQUIRED** with a concrete list of issues, plus any bugs or edge cases it spotted.
4. **If changes are required**, send the reviewer's findings back to an implementer and repeat steps 2 to 3.
5. **Maximum three implementation attempts in total** (the first attempt plus two retries). If the third attempt is still rejected, stop, do not merge, and report to the user with: what was attempted, the reviewer's outstanding findings, and a suggested way forward. Then wait.
6. **On approval**, the overseer updates `architecture.md`, `decisions.md`, `bugs.md` and `edge_cases.md` from the implementer's and reviewer's reports, ticks the part off in `plan.md`, commits, pushes, and moves to the next part.

Retries on the same part should go to a fresh implementer, briefed with the reviewer's findings and the current diff, rather than relying on the previous one's context.

## 5. Planning files

All planning files live in the repository root.

| File                | Purpose                                                  | Who edits it                                           |
| ------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| `rough_plan.md`     | The grand plan: the end goal and the phases to get there | Overseer, with user agreement on direction changes     |
| `plan.md`           | Detailed plan for the **current phase only**             | Overseer                                               |
| `completed_plan.md` | Condensed record of every finished phase                 | Overseer (append only)                                 |
| `architecture.md`   | Map of the codebase as it is now                         | Overseer, after each approved part                     |
| `decisions.md`      | Open and closed design and code decisions                | Overseer; non-obvious decisions are closed by the user |
| `bugs.md`           | Known bugs, open and fixed                               | Overseer, whenever a bug is found or fixed             |
| `edge_cases.md`     | Known edge cases and how they are handled                | Overseer, whenever one is found or handled             |

These files are only useful if they are current. Updating them is part of finishing a part, not an optional extra. If code and these files disagree, the code is the truth: fix the file, and tell the user if the disagreement reveals a bug.

### `rough_plan.md`

- States the desired end goal in a few sentences.
- Breaks the route to that goal into **phases**, each with a one-paragraph description and a rough definition of done.
- Stays high level. No implementation detail.

### `plan.md`

- Covers one phase from `rough_plan.md` at a time.
- Splits the phase into numbered **parts**. Each part should be small enough that a subagent can build it in one go without mistakes, but large enough that the phase is not drowned in tiny steps. A good rule of thumb: one coherent change, reviewable as a single diff.
- Each part must be detailed enough to implement from directly, and includes:
  - **Goal**: what this part achieves.
  - **Changes**: files and modules to create or modify, and the interfaces (function signatures, types) to add or change.
  - **Tests**: what must be tested, including edge cases.
  - **Acceptance criteria**: how the reviewer decides it is done.
  - **Existing tests affected**: normally "none". Anything else needs user approval (section 3).
  - **Status**: `todo`, `in progress`, `done`.

### `completed_plan.md`

- When every part of the phase in `plan.md` is done and merged, condense the phase into a short summary and append it here: what was built, key decisions and why, and anything deferred.
- Then clear `plan.md` ready for the next phase.
- Never rewrite earlier entries.

### `architecture.md`

- A quick-orientation map for agents and humans: the main modules, what each is responsible for, its public interface, how modules depend on each other, and where data flows.
- Describes the code **as it is**, not as it is planned to be.
- Kept short enough to read in a couple of minutes. Link to files rather than duplicating code.
- Updated as part of every approved part that changes structure or interfaces.

### `decisions.md`

- Two sections: **Open** (not yet decided) and **Closed** (decided).
- Each entry has: an ID (`D-001`), the question, the context, the options considered with their trade-offs, and, once closed, the choice, the reason, who decided and the date.
- **If the best option is not obvious, ask the user.** Record it as open, set out the options and a recommendation, and do not build anything that depends on it until the user has decided.
- Obvious decisions may be made by the overseer, but still record any that shape the design (interfaces, data formats, dependencies, structure) so the reasoning is not lost.
- A closed decision is only reopened deliberately: add a new entry that supersedes the old one and links to it, rather than rewriting history.

### `bugs.md`

- Two sections: **Open** and **Fixed**.
- Each entry has: an ID (`B-001`), a description, steps to reproduce, severity (`low`, `medium`, `high`, `critical`), where it lives in the code, and its status.
- When a bug is fixed, move it to **Fixed** with the name of the regression test that covers it (section 3).
- Bugs found outside the current part's scope are recorded here, not fixed on the spot. The overseer decides whether to schedule them into `plan.md`; `high` or `critical` bugs are raised with the user straight away.

### `edge_cases.md`

- Grouped by module or feature.
- Each entry has: an ID (`E-001`), the situation, the expected behaviour, and its status: `handled` (with the test that covers it), `not handled`, or `needs decision` (with a link to the open entry in `decisions.md`).
- Planning a part in `plan.md` should start by checking this file for the area being changed, and the part's tests should cover the relevant entries.

## 6. Phase lifecycle

1. **Plan the phase**: break the next phase of `rough_plan.md` into parts in `plan.md`.
2. **Build it**: run the implement/review loop (section 4) for each part, in order.
3. **Retire it**: condense the phase into `completed_plan.md` and clear `plan.md`.
4. **Re-check the grand plan**: before planning the next phase, compare `rough_plan.md` against the actual codebase and `architecture.md`. Update it where it has drifted (completed phases, changed assumptions, new knowledge). Tell the user about any change to direction or scope; minor wording or status updates need no approval. At the same time, review `decisions.md`, `bugs.md` and `edge_cases.md`: close out anything resolved, and decide with the user whether open bugs or decisions belong in the next phase.
5. Go back to step 1.

If any of these files do not exist yet, create them. In a new repository, ask the user for the end goal before writing `rough_plan.md`.

## 7. Git workflow

- Never commit directly to the default branch. Work on a branch per phase (or per part, for larger parts).
- Commit after each approved part, with a message that names the phase and part, e.g. `Phase 2, part 3: add retry logic to fetch client`. Add `[skip ci]` where section 3 says to.
- Open a PR when a phase (or a self-contained group of parts) is complete. The PR description summarises the parts, links to the plan, and says where the tests were run.
- Merge only when the full test suite, linting and type checks pass locally and every part has been approved by a reviewer. Do not wait for, or trigger, CI unless the user has asked for it.
- Never force-push to the default branch or rewrite shared history.

### Secrets

- Never commit API keys, tokens, passwords, `.env` files, private keys or other credentials, even temporarily or in tests.
- Use environment variables or the project's config mechanism for secrets, with a committed example file (such as `.env.example`) containing placeholder values only.
- Make sure `.gitignore` covers local secret and config files.
- If a secret is ever committed, stop and tell the user straight away. Removing it in a later commit is not enough, because it stays in the history and must be revoked.

## 8. When to stop and ask the user

- The implement/review loop has failed three times on a part.
- The best option for a decision is not obvious (record it as open in `decisions.md` first).
- A `high` or `critical` bug has been found.
- An existing test would need to change.
- The work would change the direction or scope of `rough_plan.md`.
- A decision involves a new external dependency, a breaking interface change, data loss, or anything hard to reverse.
- Requirements are ambiguous in a way that the plan files and codebase cannot resolve.

## 9. Communication

- Use British English in all code comments, documentation and messages. Do not use em dashes.
- Report outcomes honestly: if tests fail or a step was skipped, say so.

### Reporting back to the user

Every report to the user, at the end of a part, a phase or a session, uses this shape:

- **Done**: what was completed, briefly, with links to PRs or commits.
- **Not done, and why**: anything planned that was not finished, skipped or only partly done, with the reason (blocked, failed review three times, waiting on a decision, out of scope, and so on).
- **Needs your input**: open decisions, behaviour changes needing approval, and new `high` or `critical` bugs. Leave this out if there is nothing.

Keep it short. The detail lives in the planning files; the report should point to them rather than repeat them.

## 10. Project specifics

- **What it is**: A browser app for the UMHC treasurer: dashboard, transactions, tags, analysis and Excel import for the club's accounts. The frontend is static, the API is Google Apps Script and the database is a Google Sheet.
- **Language and framework**: Vanilla JavaScript (ES modules), no framework and no build step; plain CSS. Backend: Google Apps Script (V8). No TypeScript.
- **Target platforms**: Web. Current Chrome, Edge, Firefox and Safari on desktop, and Chrome on Android and Safari on iOS (about Safari 14.1 and later). Development and tests on macOS (Apple Silicon), Windows 11 and Linux containers with a current browser; no GPU or hardware-specific tests (D-004).
- **Install dependencies**: `pnpm install` (there are no runtime dependencies; Prettier 3 is fetched by `npx` on first use).
- **Run tests**: Open the app in a browser (see Build or run), log in, then Settings, Diagnostics, Run Self-Test. `pnpm test` is a placeholder that exits 1. There is no terminal or headless runner yet (D-003).
- **Run slow or hardware-specific tests**: None. The suite takes a few seconds.
- **Lint and format**: `pnpm format:check` to check, `pnpm format` to write (Prettier 3). There is no linter.
- **Type check**: None. Plain JavaScript with JSDoc comments only.
- **Build or run**: No build step. Serve the repository root over HTTP, for example `python3 -m http.server`, then open `http://localhost:8000`. `pnpm start` only prints a message. `file://` will not work because of ES modules, and a plain HTTP address on the local network will not work because `crypto.subtle` needs a secure context (HTTPS or localhost).
- **Anything unusual**: Google Apps Script changes need the changed `.gs` files pasted into the editor and the web app redeployed; the app needs a script URL and passkey to log in, so the self-test needs a working backend. Requests are JSONP and signed with HMAC-SHA256. Commits to `main` must not carry `[skip ci]`, because the only workflow mirrors `main` to `UMHC/umhc-treasury` and tests run locally (D-002). `src/lib/` is vendored and not formatted; generated `.archify/` output is not formatted either (D-005).
