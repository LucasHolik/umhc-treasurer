# Plan

Detailed plan for the current phase only. The grand plan is in
[`rough_plan.md`](rough_plan.md).

## Phase 6: AI tag suggestions

Let an editor select transactions that are missing a Trip/Event or Category and
ask an LLM for proposals, review them, and approve the ones worth keeping.
Approved values are saved through the normal pending-changes path, so there is
no second write route. The provider is called from the Apps Script backend and
the key lives in Script Properties (D-019). Providers are chosen through a
registry (D-020). Proposals never overwrite an existing tag and are never
applied without a tick (D-021).

Baseline before Part 1: 219 tests pass on macOS with Node 26.12.1, and
`npm run format:check` is clean.

### Part 1: backend action and provider seam

**Goal.** Add an admin-only `suggestTags` action that returns validated
proposals for the requested rows, with the provider and key read from Script
Properties. No frontend change, so the app behaves exactly as it does now.

**Changes.**

- `google-apps-script/Config.gs`: add `AI_CONFIG` holding
  - `PROPERTY_PROVIDER: "AI_PROVIDER"`, `PROPERTY_MODEL: "AI_MODEL"`,
    `PROPERTY_KEY: "AI_API_KEY"`, `PROPERTY_BASE_URL: "AI_BASE_URL"`.
  - `MAX_ROWS: 25`, `MAX_DESCRIPTION_LENGTH: 200`, `MAX_TOKENS: 800`,
    `TEMPERATURE: 0`.
  - `PROVIDERS`: a registry keyed by name, each `{ family, baseUrl, path }`.
    `deepseek` (`https://api.deepseek.com`), `openai`
    (`https://api.openai.com/v1`) and `openrouter`
    (`https://openrouter.ai/api/v1`) use family `openai` with path
    `/chat/completions`. `anthropic` uses family `anthropic` with baseUrl
    `https://api.anthropic.com/v1` and path `/messages`. There is no default
    model: the model comes from `AI_MODEL`, so no model id is hardcoded.
- New `google-apps-script/Service_AI.gs`, the only file that reads the
  properties or calls `UrlFetchApp`:
  - `getStatus()` returns `{configured, provider, model, maxRows}` and never
    throws. It is configured only when the provider is in the registry and the
    model and key are non-empty.
  - `suggestTags(e)` is the public action. It parses and validates
    `e.parameter.rows`, returns `AI_NOT_CONFIGURED` when settings are missing,
    returns `{suggestions: []}` without a provider call when there is nothing
    to ask (no valid rows, or no Trips and no Categories exist), and otherwise
    builds the prompt, calls the provider, parses and validates the reply.
  - Private helpers: `_settings`, `_buildPrompt`, `_callProvider`, `_replyText`,
    `_parseSuggestions`, `_validateSuggestions`, `_failure`, `_logFailure`.
  - No script lock is taken: the call writes nothing and holding the lock for
    seconds would block every save.
  - Failure logging names the provider, model, HTTP status and row count only.
    It never logs the key, the prompt, a description or the reply.
- `google-apps-script/Code.gs`: add `ADMIN_ACTIONS = new Set(["suggestTags"])`,
  include it in `isKnownAction`, and add a `case "suggestTags"` that validates
  `rows` with `validateJsonParameter(e.parameter.rows, "array")` before calling
  the service. `isActionAllowed` stays as it is, so an admin can call it and a
  viewer gets `Forbidden`. Extend the `getAppData` response with
  `ai: typeof Service_AI !== "undefined" ? Service_AI.getStatus() : null`.
  `getStatus` never throws, so this cannot fail the read. The null also lets an
  old backend work with a new client.
- `tests/backend/fakes.js`: add `PropertiesService` (an in-memory script
  properties store with `getProperty`, `setProperty`, `deleteProperty`,
  `getProperties`) and `UrlFetchApp` (`fetch` records `{url, options}`, returns
  a queued response, and can be told to throw). Add both to `globals`.
- `tests/backend/harness.js`: expose the property store and the provider calls
  through `createBackend()` so tests can seed settings and queue replies. The
  fakes stay private; tests use the harness.
- New `tests/backend/ai.test.js`.

**Request shape.** `action=suggestTags`, plus
`rows=[{"row":42,"description":"TESCO STORES","amount":-12.34,"missing":["Trip/Event","Category"]}]`.

- `row`: a number, or `"S-<n>"` for a split child.
- `description`: non-empty string; the backend trims it and rejects anything
  over `MAX_DESCRIPTION_LENGTH`.
- `amount`: a finite number, signed (income positive, expense negative).
- `missing`: one or both of `"Trip/Event"` and `"Category"`.
- A batch larger than `MAX_ROWS`, an empty `missing`, or a blank description is
  rejected with `{success: false, message}` and no provider call.

**Response shape.**

```json
{
  "success": true,
  "provider": "deepseek",
  "model": "<AI_MODEL>",
  "suggestions": [{ "row": 42, "tripEvent": "Social", "category": "Food" }]
}
```

- Only fields named in that row's `missing` are present, and only when the
  value is a non-empty string from the live tag list.
- Failures are `{success: false, message, code}` with one of
  `AI_NOT_CONFIGURED`, `AI_RATE_LIMITED`, `AI_UNAVAILABLE`,
  `AI_BAD_RESPONSE`. Validation failures carry no code.
- `401` and `403` map to `AI_UNAVAILABLE` with a message that names
  `AI_API_KEY`, because the treasurer is the only person who can fix it.

**Provider rules.**

- The URL always comes from the registry (`AI_BASE_URL` may override the base
  URL, never the family or path), so a client cannot point the backend at an
  arbitrary host.
- `openai` family: `Authorization: Bearer <key>`, body
  `{model, messages: [{role: "system", content}, {role: "user", content}], temperature: 0, max_tokens: 800, stream: false}`,
  reply text at `choices[0].message.content`.
- `anthropic` family: headers `x-api-key` and
  `anthropic-version: 2023-06-01`, body
  `{model, max_tokens: 800, temperature: 0, system, messages: [{role: "user", content}]}`,
  reply text at `content[0].text`.
- `muteHttpExceptions: true`; the status code decides the error.
- The prompt asks for JSON only and carries the allowed Trips with their Types,
  the allowed Categories, and the rows. It states: choose only from the lists,
  omit a field when unsure, answer only the fields named in `missing`, one
  object per row with the same `row` id, and no prose.
- The reply is parsed defensively: code fences are stripped, the outermost JSON
  object or array is read, and `suggestions` is taken from an object or the
  array itself. Anything unparsable is `AI_BAD_RESPONSE`.
- A suggestion is dropped unless its row was requested, its field was missing,
  and its value is exactly in the live list. The first entry for a row wins.

**Tests.**

- An admin request reaches the configured URL and model with the key in the
  header, temperature 0 and the requested rows.
- Only requested fields come back; a returned Category for a row missing only
  Trip/Event is ignored.
- Unknown tags, rows that were not requested and duplicate entries are dropped.
- A description containing instructions cannot produce an out-of-list tag.
- Missing provider, model or key, and an unknown provider, each return
  `AI_NOT_CONFIGURED` without a provider call.
- `429` is `AI_RATE_LIMITED`; a thrown fetch and a `500` are `AI_UNAVAILABLE`;
  `401` is `AI_UNAVAILABLE` and the message names `AI_API_KEY`.
- A fenced JSON reply is accepted; a non-JSON reply is `AI_BAD_RESPONSE`.
- A viewer gets `Forbidden`.
- More than `MAX_ROWS` rows, a blank description and an empty `missing` are
  rejected before any provider call.
- With no Trips and no Categories, no provider call is made and the reply is an
  empty list.
- The key never appears in the action response or in `getAppData`.
- `getAppData` includes the `ai` status for an admin and a viewer.
- The Anthropic family sends `x-api-key` and `anthropic-version` and reads
  `content[0].text`.

**Acceptance criteria.**

- The action exists, is admin-only, and a viewer is refused by the router.
- No response, error or log line contains the key.
- Every value returned is in the live tag list and was requested.
- All four error codes are covered by a test.
- No new dependency.
- Full `npm test` and `npm run format:check` pass.
- Nothing outside the listed files changes, apart from the overseer's docs.

**Existing tests affected.** None. The `getAppData` change adds a field that no
test deep-equals, and the fakes only gain services.

**Status.** done. Reviewed and approved on 2026-11-10 after two attempts. The
full suite is 268 tests and the format check passes locally on macOS.

**Review notes.** The first review found an empty batch rejected against the
plan, an id-less request row able to return a suggestion without `row`, and a
`getStatus` throw when `Config.gs` had not been updated. All three were fixed,
and tests now pin the empty-batch success, the seven invalid row-id cases, the
four bad-reply shapes, the unconfigured status strings and the JSON content
type. Remaining nice-to-haves: no regression test for the `AI_CONFIG`-absent
path (the harness cannot remove a top-level `const`), no test for an empty batch
on an unconfigured deployment, the validation table does not assert message
reasons or the 25-row and 200-character boundaries, and `_buildPrompt` reads
`TripTypeMap[trip]` without an own-property check (E-035). The `ai: null` branch
is testable by omitting `Service_AI.gs` from the concatenated source, contrary
to the implementer's report, and remains untested.

### Part 2: client service and suggestion logic

**Goal.** Turn selected ledger rows into provider requests, reconcile the
proposals against the current data and tag lists, and expose the result as
changes the existing save can take. No UI yet.

**Changes.**

- `src/services/api.service.js`:
  - `SUGGEST_TIMEOUT_MS = 45000`, with a comment: a provider call is slower
    than a read, the action writes nothing, and the limit stays under the Apps
    Script six-minute cap.
  - `suggestTags(rows)`: reject read-only sessions, then
    `request("suggestTags", { rows: JSON.stringify(rows) }, { timeoutMs: SUGGEST_TIMEOUT_MS })`.
  - In the JSONP callback, copy `data.code` onto the error (`err.code`) before
    rejecting, so `AI_*` codes reach callers. Keep the existing `BUSY`
    handling.
- New `src/features/transactions/transactions.suggestions.js`. Pure helpers
  plus one orchestration function, with the API injected so tests need no
  network:
  - `TAG_FIELDS`.
  - `missingTagFields(row)` returns the subset of `TAG_FIELDS` that is empty.
  - `rowAmount(row)` returns the signed net from `Income` and `Expense`, using
    the existing `parseAmount`.
  - `selectRowsForSuggestions(rows)` keeps rows with at least one missing tag
    and a non-blank description, and returns the reason counts the UI needs.
  - `buildRequestRows(rows)` returns the compact request rows.
  - `splitIntoBatches(items, size)` with a safe fallback when `size` is missing
    or below 1.
  - `reconcileSuggestions(suggestions, requested, currentRowsById, tagsData)`
    keeps only requested rows whose description and amount still match, only
    requested fields, and only values in the live lists. Keys are `row`,
    `tripEvent` and `category`.
  - `toPendingChanges(accepted)` returns a `Map` keyed by string row id whose
    values are `{"Trip/Event": value}` and/or `{Category: value}`.
  - `collectSuggestions(rows, { suggest, maxRows, onProgress })` returns
    `{suggestions, error}`. It sends one batch at a time, in order, calls
    `onProgress(done, total)`, and keeps the suggestions from earlier batches
    when a later one fails. No rows means no call.
- `src/core/state.js`: add the `ai` default
  `{configured: false, provider: null, model: null, maxRows: 25}`.
- `src/App.js`: set `ai` from `getAppData` after the initial load, falling back
  to the default when the field is null.
- New `tests/features/transactions/transactions.suggestions.test.js`.

**Tests.**

- `missingTagFields` for both, one and no tags.
- `selectRowsForSuggestions` drops fully tagged rows and blank descriptions,
  and keeps split row ids unchanged.
- `rowAmount` handles comma strings, negatives and income-only rows.
- `buildRequestRows` trims the description and carries the missing fields.
- `splitIntoBatches` for an exact multiple, a remainder, an empty list and a
  missing or zero size.
- `reconcileSuggestions` drops unknown tags, non-requested fields, rows that
  were not requested, rows that no longer exist and rows whose description or
  amount changed; it keeps a single field when the other is already tagged, and
  the first entry wins for a duplicate.
- `toPendingChanges` uses string row ids and does not mutate its input.
- `collectSuggestions` sends batches in order, reports progress, merges the
  results, returns the error from a failed second batch alongside the first
  batch's suggestions, and makes no call for an empty list.
- No test mutates a shared object.

**Acceptance criteria.**

- A selected row with both tags missing produces both fields; one with a tag
  already set produces only the other.
- A stale row, an unknown tag and a non-requested field never reach the panel.
- The orchestration is testable without a network or a DOM.
- Full `npm test` and `npm run format:check` pass.
- No new dependency, and no change to any existing test.

**Existing tests affected.** None.

**Status.** todo.

### Part 3: selection mode, review panel and apply

**Goal.** The end-to-end flow: press the button, select rows, get proposals,
approve them, and have them saved through the normal tagging path.

**Changes.**

- `src/features/transactions/transactions.component.js`:
  - Add a secondary button `#suggest-tags-btn`, "Auto Suggest Tags with AI",
    for editors only. Disabled with a title when
    `!store.getState("ai").configured`.
  - `selectionPurpose` (`"bulk"` or `"suggest"`), passed through
    `toggleSelectionMode`. Build a second toolbar,
    `#suggest-actions-toolbar`, hidden unless the purpose is `"suggest"`, with
    its own count, "Suggest tags" and "Cancel" buttons.
  - `startTagSuggestions()` refuses while `pendingChanges.size > 0`
    ("Save or discard your pending tag changes first."), then enters selection
    mode with the suggest purpose.
  - `submitTagSuggestions()` uses `selectRowsForSuggestions` and tells the user
    how many selected rows were skipped because they are already tagged or have
    no description. It calls `collectSuggestions` with
    `suggest: ApiService.suggestTags`, `maxRows: store.getState("ai").maxRows`
    and a progress callback that updates the button text.
  - After the request, exit selection mode, open the panel, and on acceptance
    merge `toPendingChanges(accepted)` into `pendingChanges`, re-render once and
    call the existing `savePendingChanges()`. That path already chunks at 20,
    shows progress, reloads after a failure and prunes pending entries on
    reload.
  - If a data reload arrives while the request is in flight, discard the reply
    and tell the user to try again.
- `src/features/transactions/transactions.bulk.js`:
  `toggleSelectionMode(active, selectedCount, purpose = "bulk")` shows
  `#bulk-actions-toolbar` only for `"bulk"`. The reset and count behaviour and
  the existing `Bulk Tagging Mode` entry point are unchanged.
- New `src/features/transactions/transactions.suggestions-modal.js`, following
  the `SplitTransactionModal` overlay pattern and reusing `modal.css`:
  - `open({ suggestions, rowsById })` returns a promise of the accepted
    suggestions, or `null` on cancel.
  - One row per proposal with a tick (on by default), date, description,
    amount and the proposed pills. The field that was already tagged is shown
    as unchanged, not as a proposal.
  - Footer: selected count, Select all, None, Cancel and "Apply N tags".
    Apply is disabled when nothing is ticked.
  - Escape, the close button and an overlay click all cancel. Focus moves into
    the dialog and is restored on close. The list scrolls, and the layout
    stacks on a phone.
- `src/features/transactions/transactions.css`: styles for the button state,
  the suggest toolbar, the panel rows and pills, and the phone layout.
- Docs, after approval: `README.md`, `ARCHITECTURE.md`, `docs/edge_cases.md`
  and closing the decisions. The implementer does not edit docs.
- Manual check in a browser, listed in the report: connected backend, key
  configured, one page of untagged rows, one partially tagged row, cancel,
  apply, reload, and the viewer passkey.

**Tests.**

- Any new pure helper in the panel or the toolbar (for example select all and
  the accepted count) lives in `transactions.suggestions.js` and is tested
  there.
- The DOM flow is checked by hand, as the project has no component tests. The
  report says where.

**Acceptance criteria.**

- An editor can press the button, select rows, see proposals, cancel with no
  write, and apply accepted proposals that survive a reload.
- A partially tagged row keeps its existing tag.
- A viewer never sees the button, and the action is refused if called.
- An unconfigured provider shows a disabled button explaining why.
- Unsaved manual changes block the flow with a clear message.
- The applied values appear through `updateExpenses`, not through a new action.
- Full `npm test` and `npm run format:check` pass, and the manual checks above
  are recorded in the report.
- No new dependency.

**Existing tests affected.** None.

**Status.** todo.
