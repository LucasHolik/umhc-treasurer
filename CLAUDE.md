# CLAUDE.md

How this project is designed and tested. `info.txt` describes the
architecture (what exists and how it fits together); this file sets the rules
for changing it. Both apply to people and to Claude.

## Design philosophy

### 1. Deep modules come first

A module should hide a lot of complexity behind a small, simple interface.

- **The interface is everything a caller must know**, not just the exports:
  arguments, return shapes, error codes, store keys the caller must set or
  watch, events it must fire, and the order calls must happen in. Keep all of
  that small.
- **Give callers whole jobs.** Prefer `saveTagChanges(changes)` to a set of
  functions the caller must sequence (build payload, chunk, send, report
  progress, classify errors, reload).
- **Hide decisions that are likely to change** (sheet columns, batch sizes,
  timeouts, wire formats, retry policy) inside exactly one module.
- **Define errors out of existence where it is safe.** Treat empty or missing
  input as an empty result, and normalise unknown values to a safe default
  (as `normaliseTripStatus` does). Throw only when the caller can act on it.
- **Warning signs of a shallow module:** callers that need its internal
  constants, functions that just pass arguments through, calls that must
  happen in a set order, and several small modules that cannot be used
  without each other.

A large file is not automatically deep. A 1,800-line component whose callers
and tests must know its store keys and events is large and shallow.

### 2. SOLID, applied where it pays

- **Single responsibility:** one module per concept (tagging, splitting,
  reconciliation, Excel import), not one per function. Never split a deep
  module into shallow pieces just to satisfy this rule.
- **Open/closed:** new features arrive as new files (see info.txt section 11).
  Prefer extending through data (status tables, column maps, config objects)
  over growing `if`/`switch` chains.
- **Liskov substitution:** anything that stands in for a real dependency,
  including test fakes, must honour the same contract: same return shapes,
  same error codes (`TIMEOUT`, `NETWORK`, `BUSY`), same edge-case behaviour.
- **Interface segregation:** export only what callers need. Pure helpers may
  be exported for tests; say so in a comment next to the export.
- **Dependency inversion (the one that matters most):** logic depends on
  what it is given, not on fixed instances. Pass the store, API, clock or
  storage in (constructor or argument), with the real one as the default, so
  tests can substitute fakes.

### 3. Layering rules

Dependencies point one way: `core` ← `services` ← `features`, and
`shared` ← `features`.

- `src/core/` and `*.logic.js` files are **pure**: no store, no API, no DOM,
  no storage. Take inputs, return outputs.
- `src/services/` and `src/core/` never import from `src/features/`.
- **Components are thin.** They render state and turn user actions into a
  single call on a service or logic module. Batching, retries, error
  classification and data shaping do not belong in components.
- Modules talk through the store or explicit callbacks. Do not add new global
  `document` events.
- Backend: `Code.gs` routes only, `Service_Sheet.gs` is the only file that
  touches `SpreadsheetApp`, and `Service_Lock.gs` is the only file that touches
  `LockService`.

### 4. Known debt

The code does not fully follow these rules yet. Do not rewrite everything at
once: when you change one of these areas, move it towards the rules, with
tests in place first.

- `src/features/transactions/transactions.component.js` holds business logic
  (building update payloads, batching saves, classifying errors). Similar
  batching is repeated in the bulk tagging and upload code.
- `src/features/analysis/analysis.logic.js` imports the store and calls
  `setState("error", ...)`, so it is not pure.
- `src/services/transaction.service.js` imports `sortData` from
  `src/features/transactions/transactions.logic.js` (wrong direction).
- Components coordinate reloads through the global `dataUploaded` event.
- Most components import the store and `ApiService` directly instead of
  receiving them.

## Testing

### Running

```bash
npm install          # once; dev-only tooling, never shipped to users
npm test             # run every test
npm run test:watch   # re-run on save
```

There is no CI, by choice (limited GitHub Actions minutes). Run `npm test`
locally before every commit and PR, and do not add a test workflow.

Tests and their dependencies are dev-only. Nothing in `src/` may import from
`tests/` or `node_modules/`; the app keeps no build step and no runtime
dependencies.

### Layout and style

- `tests/` mirrors `src/`: `src/core/utils.js` is tested in
  `tests/core/utils.test.js`.
- `tests/setup.js` is preloaded for every file and provides a browser-like
  global environment (happy-dom), so browser modules import cleanly.
- Shared helpers live in `tests/helpers/`.
- Use `node:test` and `node:assert/strict`. One test file per module. Name
  each test after the behaviour it checks.
- Test through the public interface. If a test needs a private detail, the
  interface is probably too shallow.
- Keep tests independent. Restore anything shared that a test changes (store
  keys, globals, storage); use a test-only store key.
- When code is expected to log, mock it with `t.mock.method(console, ...)`
  and assert the call, so a passing run prints nothing.
- Give `assert.throws` the expected error (a regex or class), so an
  unrelated error cannot make the test pass.
- Never wait on real time. Use `t.mock.timers` for timeouts and debounces,
  and pass dates in rather than relying on today's date where possible.
- At boundaries (API transport, storage, clock, spreadsheet), prefer small
  in-memory fakes that honour the real contract over call-by-call mocks.

### What needs tests

- **Every bug fix** comes with a test that fails without the fix.
- **Every new logic or service module** comes with tests.
- **Before refactoring code without tests,** add characterisation tests that
  pin down its current behaviour, then refactor.
- **Money and data integrity get the edge cases:** comma strings, blanks,
  negatives, manual rows, splits, renames, partial failures and timeouts.

### Planned coverage

- Services against fakes: `api.service.js` (signing, timeouts, error codes)
  with a fake JSONP transport, plus `auth.service.js`.
- Backend: load the `.gs` files into a Node `vm` context with in-memory fakes
  for `SpreadsheetApp`, `LockService` and `CacheService`. Priorities: split
  create, revert and edit; tag batch rollback; nested locking; signature and
  replay checks; sheet sanitisation.
- Contract tests: client signing and server verification checked against the
  same fixtures.
- A few end-to-end journeys in a real browser (Playwright) against a fake
  backend.

## Conventions

- Format with `npm run format` (Prettier 3).
- Keep `info.txt` in step with the code when the architecture changes.
