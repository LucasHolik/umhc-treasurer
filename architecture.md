# Architecture

A quick map of the code as it is. Read this before changing anything, then
follow the links for detail. The design and testing rules are in
[`AGENTS.md`](AGENTS.md) sections 2, 3 and 10.

## Shape of the system

A static single-page app with no build step. [`index.html`](index.html) loads the
styles and two vendored libraries as classic scripts, then
[`src/App.js`](src/App.js) as an ES module. Chart.js and the Excel parser are
therefore globals (`Chart`, `readXlsxFile`).

Data lives in a Google Sheet. The only way to reach it is a Google Apps Script
web app, which verifies an HMAC-SHA256 signature on every request, checks the
role, and replies with JSONP.

```
Browser (static host)              Google Apps Script           Google Sheets
src/App.js + src/features  --JSONP--> Code.gs -> Service_*  -->  Finances
        |                                                          Tags
        v                                                          Split Transactions
  src/core/state.js                                                Config
```

## Layers

The intended rule is unidirectional: UI -> service -> store -> UI. Components
render what the store holds and fire events. Services do the API calls, signing
and parsing. The store is the single source of truth. In practice some feature
components call `ApiService` directly, so do not treat the rule as enforced.

### Core

| Module                                                       | Responsibility                                                                               | Main interface                                                                                                                    |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| [`src/core/state.js`](src/core/state.js)                     | Pub/sub store. Clones values in and out, compares before notifying.                          | `store.subscribe(key, fn)`, `store.setState(key, value)`, `store.getState(key)`                                                   |
| [`src/core/dom.js`](src/core/dom.js)                         | Declarative DOM building, no `innerHTML`. Tracks listeners so they can be removed.           | `el(tag, attrs, ...children)`, `replace(el, ...children)`, `cleanup(el)`, `clear(el)`                                             |
| [`src/core/router.js`](src/core/router.js)                   | Hash router. Toggles the `active` class; `App.js` owns nav state, titles and role redirects. | `router.register(hash, element)`, `navigate(hash)`, `start()`, `reset()`                                                          |
| [`src/core/utils.js`](src/core/utils.js)                     | Currency, dates, timeframes, deep clone and equality, escaping.                              | `formatCurrency`, `parseAmount`, `parseDate`, `filterTransactionsByTimeframe`, `deepClone`, `deepEqual`, `escapeHtml`, `debounce` |
| [`src/core/financial.logic.js`](src/core/financial.logic.js) | Balance maths, including the inversion for `Manual` historical rows.                         | `calculateFinancials(openingBalance, transactions)` -> totals and balance                                                         |
| [`src/core/trip-status.js`](src/core/trip-status.js)         | The four Trip/Event statuses and the rules for current versus past.                          | `normaliseTripStatus`, `isPastTripStatus`, `getTripStatusStyle`, `getNextTripStatus`, `partitionTripsByStatus(trips, statusMap)`  |
| [`src/core/config.js`](src/core/config.js)                   | Paths for the logo and the chart library.                                                    | `CONFIG`                                                                                                                          |

### Services

| Module                                                                       | Responsibility                                                                                                                | Main interface                                                                                         |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [`src/services/api.service.js`](src/services/api.service.js)                 | The only network layer: JSONP, HMAC signing, session storage, timeouts, request deduplication, cache invalidation for splits. | `ApiService`: login, app data, saves, tag operations, opening balance, split operations                |
| [`src/services/auth.service.js`](src/services/auth.service.js)               | Login, logout and session verification. Turns a role into `{loggedIn, role, canEdit}`.                                        | `AuthService.init()`, `login(apiKey)`, `logout()`, `isLoggedIn()`, `buildCurrentUser(role)`            |
| [`src/services/transaction.service.js`](src/services/transaction.service.js) | Bakes split children into the expense list: a `SOURCE` row is replaced by its `CHILD` rows.                                   | `mergeSplits(rawExpenses, splitHistory)`                                                               |
| [`src/services/excel.service.js`](src/services/excel.service.js)             | Parses an uploaded spreadsheet into clean rows using the global `readXlsxFile`.                                               | `parseFile(file)`, and the pure helpers `normalizeDateString`, `parseExcelNumber`, `parseAndCleanData` |

### Features

Each feature is a class that takes its mount element, subscribes to the store
and exposes `destroy()`. [`src/App.js`](src/App.js) builds the shell, chooses
login or app, owns the initial load and enforces role-based routing.

| Feature                                                               | Responsibility                                                                                                      |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [`login`](src/features/login/login.component.js)                      | Script URL setup and passkey login.                                                                                 |
| [`dashboard`](src/features/dashboard/dashboard.component.js)          | Balance cards, totals and recent transactions over a chosen timeframe.                                              |
| [`transactions`](src/features/transactions/transactions.component.js) | The ledger: filter, sort, inline tag edits, bulk tagging, manual add, split create, edit and revert, split history. |
| [`tags`](src/features/tags/tags.component.js)                         | Tag manager: list, drill into a tag, assign Types to a Trip, cycle trip status.                                     |
| [`analysis`](src/features/analysis/analysis.component.js)             | Charts, tables, CSV export and quick views. `analysis.css` is injected at runtime, not linked in `index.html`.      |
| [`upload`](src/features/upload/upload.component.js)                   | Drag and drop Excel import, duplicate detection, chunked save. Editor only.                                         |
| [`settings`](src/features/settings/settings.component.js)             | Opening balance and accessibility mode.                                                                             |

Pure helpers sit beside the components: `transactions.logic.js` (`filterData`,
`sortData`, `buildTagSelectorOptions`) and `tags.logic.js` (virtual tag lists,
stats, queue optimisation, `resolveSaveFailure`). `analysis.logic.js` (date
ranges, filtering, aggregation, CSV) imports the store, so it is not pure; see
`AGENTS.md` section 10.2.

### Shared UI

[`src/shared/`](src/shared/) holds the reusable pieces: `SortableTable`,
`ModalComponent`, `TagSelector` (including the optional past-tags toggle),
`LoaderComponent`, `MobileDataCard`, `MobileDisclosure` and `withSearchInputAttributes`.
There is no component framework; these are plain classes and functions.

### Backend

Eight `.gs` files deployed together as one Apps Script project. They share a
single global scope, so helpers are called across files and the "modules" are
conventions rather than enforced boundaries.

| File                                                          | Responsibility                                                                                                |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| [`Code.gs`](google-apps-script/Code.gs)                       | JSONP router (`doGet`), action allow-lists, the consistent `getAppData` read, response helpers, sanitisation. |
| [`Config.gs`](google-apps-script/Config.gs)                   | Sheet names, column headers, Config cell addresses, `LOCK_TIMEOUT_MS` (10 s).                                 |
| [`Service_Auth.gs`](google-apps-script/Service_Auth.gs)       | Login, signature verification, timestamp window, per-write nonce, brute-force lockout.                        |
| [`Service_Session.gs`](google-apps-script/Service_Session.gs) | Session creation, validation and invalidation, cached for 1 hour.                                             |
| [`Service_Lock.gs`](google-apps-script/Service_Lock.gs)       | `withScriptLock(fn, timeoutMs)`, the only LockService caller. Re-entrant.                                     |
| [`Service_Sheet.gs`](google-apps-script/Service_Sheet.gs)     | Finances rows, opening balance, Config layout migration, tag changes applied to expenses.                     |
| [`Service_Tags.gs`](google-apps-script/Service_Tags.gs)       | Tag lists, `TripTypeMap`, `TripStatusMap`, and batched tag operations.                                        |
| [`Service_Split.gs`](google-apps-script/Service_Split.gs)     | Split groups, revert, edit, history, stale `PENDING` cleanup.                                                 |

Actions routed by `Code.gs`:

- **Read (admin and viewer):** `ping`, `logout`, `getData`, `getAppData`,
  `getOpeningBalance`, `getSplitGroup`, `getSplitHistory`.
- **Write (admin only):** `saveData`, `addTag`, `updateExpenses`, `deleteTag`,
  `renameTag`, `processTagOperations`, `saveOpeningBalance`, `splitTransaction`,
  `revertSplit`, `editSplit`.
- **Auth:** `login`.

A viewer calling a write gets `Forbidden`. `getAppData` reads expenses, tags,
opening balance and splits under one lock, so the app never sees a half-finished
write.

## Data flow

1. `App` starts. `AuthService.init()` verifies any stored session with `ping`.
2. Login exchanges the passkey for a session id and key, kept in
   `sessionStorage`; the script URL is kept in `localStorage`.
3. `App.loadInitialData()` calls `ApiService.getAppData()`.
4. The reply populates `rawExpenses`, `tags`, `openingBalance` and
   `splitTransactions` in the store.
5. A subscription runs `TransactionService.mergeSplits` and sets `expenses`.
6. Each component's subscriber re-renders.
7. A user action goes back through a component, an `ApiService` method and a
   backend service. Most writes trigger a `dataUploaded` DOM event, which
   reloads everything from the server rather than patching the store by hand.
   Saving the opening balance is the exception: it updates the store directly.

## The store

Defaults live in [`src/core/state.js`](src/core/state.js).

- **Data:** `expenses`, `rawExpenses`, `splitTransactions`, `tags`,
  `openingBalance`.
- **User and settings:** `currentUser`, `accessibilityMode`.
- **Progress flags:** `isLoading`, `isUploading`, `isTagging`, `savingTags`,
  `savingSplitTransaction`, `settingsSyncing`, `isVerifyingSession`,
  `taggingSource`, `taggingProgress`.
- **Errors:** `error`.
- **Undeclared but written:** `transactionParams` (set by Tags and Transactions
  to prefill the ledger). It works because the store does not validate keys, but
  it is absent from the defaults.

## Tests

The suite is in [`tests/`](tests/), which mirrors `src/`. It has 159 tests
across 12 files, covering utils, financial logic, transactions, tags, trip
status, state, DOM, Excel parsing, API helpers, analysis and the test helpers
themselves. `tests/setup.js` registers a browser-like environment with
happy-dom, so browser modules import cleanly.

Run it with `npm install` once and then `npm test` (Node 22.6 or later);
`npm run test:watch` re-runs on change. The tests need no browser and no
backend. They are development only: nothing in `src/` imports `tests/` or
`node_modules/`, and the app still has no build step. There is no test CI, by
choice (see `AGENTS.md` section 10).

## Deployment and configuration

- Pushing to `main` triggers [`sync.yml`](.github/workflows/sync.yml), which
  force-pushes `main` to `UMHC/umhc-treasury`; that is the deployment step. It
  runs no tests, so commits to `main` must not carry `[skip ci]` (D-002).
- Frontend changes need only a push. Backend changes need the changed `.gs`
  files pasted into the Apps Script editor and the web app redeployed; editing
  the existing deployment keeps the URL.
- The script URL is entered by the user and stored in `localStorage`. Passkeys
  are entered by the user and stored in the sheet's Config tab, in plain text;
  they are not in this repository.

## Where the code and `AGENTS.md` disagree

These are rule violations, not behaviour to copy:

- `AGENTS.md` says `Service_Sheet.gs` is the only file that touches
  `SpreadsheetApp`. `Service_Tags.gs` and `Service_Split.gs` also call it
  directly.
- `AGENTS.md` says `Code.gs` routes only. It also holds `getAppData`, the action
  allow-lists and the sheet sanitisation helpers.

Both are listed under Known debt in `AGENTS.md` section 10.2, along with the
frontend debt. This section exists so the disagreement is visible from the
architecture map.
