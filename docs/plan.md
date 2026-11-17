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
  - Failure logging names the provider, model, HTTP status, row count and a
    redacted exception detail (the key is replaced and the text capped). The
    prompt, a description and the reply are never passed to the logger; the
    exception text itself is provider-controlled.
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
`rows=[{"row":42,"description":"TESCO STORES","date":"2026-11-01","amount":-12.34,"missing":["Trip/Event","Category"]}]`.

- `row`: a number, or `"S-<n>"` for a split child.
- `description`: non-empty string; the backend trims it and rejects anything
  over `MAX_DESCRIPTION_LENGTH`.
- `date`: optional local `YYYY-MM-DD`; added in the follow-up and used in the
  prompt. The amount stays in the request for the stale-row check but is not
  given to the model.
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
- The `max_tokens` values in those two examples were later raised to 10000 for
  the OpenAI-compatible family and 8192 for Anthropic; see the follow-up.
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

**Status.** done. Reviewed and approved on 2026-11-10 after two attempts. The
full suite is 316 tests and the format check passes locally on macOS.

**Review notes.** The first review found that reconciliation did not check
whether a proposed field was still blank on the current row, so a tag added
after selection could be overwritten; that is fixed and tested. The retry also
added the viewer-refusal test, reset `ai` on both failed-load paths, reports
progress from 0 of N, skips a null current row, and covers duplicate request
entries and a string reply id matching a numeric request. Remaining gaps: the
45 s timeout and `err.code` passthrough have no transport-level test, which is
the known API-service debt in `AGENTS.md` 10.5; the App reset is verified by
inspection only (E-043); and a falsy rejection reason or a whitespace-padded
live tag can mislead the client (E-047, E-048).

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
    merge the accepted proposals into `pendingChanges` and call the existing
    `savePendingChanges()`. That path already chunks at 20, shows progress,
    reloads after a failure and prunes pending entries on reload. A field the
    user has already edited by hand while the panel was open wins over the
    suggestion, and any proposal whose row changed description or amount since
    the request is dropped, because the panel can stay open while the ledger
    changes underneath it.
  - If a data reload arrives while the request is in flight, discard the reply
    and tell the user to try again.
- `src/features/transactions/transactions.bulk.js`:
  `toggleSelectionMode(active, selectedCount, purpose = "bulk")` shows
  `#bulk-actions-toolbar` only for `"bulk"`. The reset and count behaviour and
  the existing `Bulk Tagging Mode` entry point are unchanged.
- New `src/features/transactions/transactions.suggestions-modal.js`, following
  the `SplitTransactionModal` overlay pattern and reusing `modal.css`:
  - `open({ suggestions, rowsById, notice, returnFocus })` returns a promise of
    the accepted suggestions, or `null` on cancel.
  - One row per proposal with a tick (on by default), date, description,
    amount and the proposed pills. The field that was already tagged is shown
    as unchanged, not as a proposal.
  - Footer: selected count, one Select all / Clear toggle, Cancel and
    "Apply N suggestions". Apply is disabled when nothing is ticked.
  - The skipped-row counts from the request, and any partial-batch error,
    appear in the panel's notice, because the toolbar that showed them is
    hidden by the time the panel opens.
  - Escape, the close button and an overlay click all cancel. Focus moves into
    the dialog, Tab and Shift+Tab wrap inside it, and focus returns to the
    visible AI button on close. The list scrolls, and the layout stacks on a
    phone.
- `src/features/transactions/transactions.css`: styles for the button state,
  the suggest toolbar, the panel rows and pills, and the phone layout.
- Docs, after approval: `README.md`, `ARCHITECTURE.md`, `docs/edge_cases.md`
  and closing the decisions. The implementer does not edit docs.
- Manual check in a browser, listed in the report: connected backend, key
  configured, one page of untagged rows, one partially tagged row, cancel,
  apply, reload, and the viewer passkey.

**Tests.**

- Pure helpers added for the apply step (`filterStillMissing`, including the
  optional fingerprint re-check, and `mergeAcceptedIntoPending`) live in
  `transactions.suggestions.js` and are tested there.
- The dialog's tick, select-all, clear, count and Apply semantics are tested in
  `tests/features/transactions/transactions.suggestions-modal.test.js`.
- The rest of the DOM flow is checked by hand, as the project has no component
  tests. The report says where.

**Acceptance criteria.**

- An editor can press the button, select rows, see proposals, cancel with no
  write, and apply accepted proposals that survive a reload.
- A partially tagged row keeps its existing tag.
- A tag added after reconciliation is not overwritten when the panel is
  applied.
- A field the user edited by hand while the panel was open wins over the
  suggestion.
- A row whose description or amount changed while the panel was open is
  dropped.
- The skipped-row counts are visible in the panel, not only in a transient
  status line.
- Focus returns to the visible AI button on Cancel, Escape and close. After
  Apply the save flow takes over, so focus may end on the page body (E-049).
  Tab stays inside the panel while focus is inside it (E-052).
- A viewer never sees the button, and the action is refused if called.
- An unconfigured provider shows a disabled button explaining why.
- Unsaved manual changes block the flow with a clear message.
- The applied values appear through `updateExpenses`, not through a new action.
- Full `npm test` and `npm run format:check` pass, and the manual checks above
  are recorded in the report.
- No new dependency.

**Existing tests affected.** None.

**Status.** Merged in PR #16 on 2026-11-10. The live browser check in this part
(a configured backend and key, the viewer passkey, and the phone layout) was
still outstanding when the user merged, so the phase stays in this plan until
that check is reported. The full suite is 353 tests and the format check passes
locally on macOS. A follow-up on the same phase fixes DeepSeek's default
thinking mode (B-009) and adds provider examples to the backend guide.

**Review notes.** The first review found an alert after the component had been
destroyed, skipped-row counts overwritten before they could paint, a merge that
could overwrite a manual pending edit, focus restored to a hidden element with
no trap, and a stale selection count. The second found that `#main-controls`
kept its `disabled` class after a full render during selection, and that the
empty-string pending rule was not pinned by a test. All are fixed and tested
where a pure helper allowed it; the class fix was verified with a throwaway
harness and is inspection-only in the committed suite. Remaining, recorded as
E-049 to E-053: focus after Apply, no mid-request cancel, a tab switch during
the request, the Tab trap when focus is on the body, and first-open styling and
short-viewport clipping.

## Follow-up: login message, AI setup and output cap (done, merged in PR #18)

**Goal.** Fix B-010 (an undiagnosable provider fetch and a misleading setup
guide) and B-011 (a wrong passkey shown as a network failure), harden the new
`AI_BASE_URL` validation, change what the model is given, limit the AI
selection list to incomplete rows, and raise the suggestion output cap.

**Changes.**

- `src/services/api.service.js` and `src/services/auth.service.js`: classify an
  Unauthorized login reply as `UNAUTHORIZED`, map it to a passkey message, keep
  transport failures as the connection message, and stop a failed login from
  dispatching `sessionExpired`.
- `google-apps-script/Service_AI.gs`: log a key-redacted, capped exception
  detail; return an actionable message naming `authorizeAi` for a permission
  failure; add the top-level `authorizeAi()`; validate `AI_BASE_URL` (host
  required, https except loopback, no userinfo, bad port, query, fragment or
  duplicated endpoint path).
- `google-apps-script/Config.gs`: `MAX_TOKENS` from 800 to 10000, approved by
  the user on 2026-11-10. Anthropic keeps a per-provider cap of 8192, because
  older Claude models reject a larger `max_tokens`.
- `src/features/transactions/transactions.suggestions.js` and
  `google-apps-script/Service_AI.gs`: the prompt now carries each row's date and
  each trip's Status, excludes the amount, and tells the model to prefer an
  Active trip and to omit a tag when unsure. `_ownTagText` closes E-035.
- `src/features/transactions/transactions.suggestions.js` and
  `transactions.component.js`: AI selection mode displays only rows missing a
  Trip/Event, a Category, or both, through `filterRowsMissingTags`; leaving the
  mode restores the full ledger, and the toolbar hint says the list is already
  filtered.
- `google-apps-script/README.md`: the real `authorizeAi` procedure, the base URL
  rules, a failure checklist and the provider data note. Bugs B-010 and B-011
  and edge cases E-054 to E-062 are recorded.

**Tests.** New auth-service tests, new AI tests (permission message, redaction,
`authorizeAi`, the base URL cases), the date formatting cases (including a local
early-morning date that `toISOString` would shift in a positive-offset zone),
the prompt date and absence of the amount, the
Active and Completed statuses, the prototype-key trip, the six
`filterRowsMissingTags` cases, and the request-body assertions. New `_responseError` and `_shouldExpireSession` tests in
`tests/services/api.service.test.js`, and an additive `authorizeAi` export in
the test harness.

**Existing tests affected.** The two `max_tokens` assertions in
`tests/backend/ai.test.js` change from 800 to 10000 for the OpenAI-compatible
family and to 8192 for Anthropic. This is an intentional behaviour change
approved by the user on 2026-11-10. The `buildRequestRows` expectation gains the
date, and the prompt assertion changes to
`Winter Trip (Type: Competitive, Status: Active)`, also approved by the user on
2026-11-10. `tests/backend/harness.js` gains a test-only `authorizeAi` export;
no existing test is changed by it.

**Acceptance.** Both bugs reproduce before the fix and pass their regression
tests after. A wrong passkey shows the passkey message, not the network one. A
permission failure names `authorizeAi`, and a malformed `AI_BASE_URL` names the
property without a provider call. AI selection mode shows only incomplete rows
and restores the full list on exit. The full suite and format check pass.

**Status.** Code complete, approved on 2026-11-10, and merged in PR #18 (`1ec2577`).
The suite is 407 tests and the format check passes locally on macOS. The user
confirmed the AI path works after granting the external-request permission.

### Part 4: editable suggestions and manual selection for missing tags

**Goal.** Let an editor edit or clear any suggested tag inside the review
dialog, show `"No tag"` for missing tag fields when the AI did not suggest one
and let the editor select a tag manually, and include every still-eligible
requested row in the review dialog even when the AI returned no suggestions for
it (D-022).

**Changes.**

- `src/features/transactions/transactions.suggestions.js`:
  - Add `buildReviewRows(reconciled, requested, currentRowsById)`: keeps rows in
    `requested` order (first entry wins per string id), uses the cloned entry
    from `reconciled` when present, and otherwise adds `{ row: requestRow.row }`
    when the current row still exists, matches the `(description, amount)`
    fingerprint, and still has at least one field in `requestRow.missing` blank.
    Does not mutate inputs.
- `src/shared/tag-selector.component.js`:
  - Call `e.stopPropagation()` on `Escape` inside `this.element` when closing,
    so closing the popover never bubbles `Escape` to a parent modal.
  - Accept an optional `onClose` callback in `show`'s options object, invoked
    when `close()` closes an open popover (before clearing `currentConfig`).
- `src/features/transactions/transactions.suggestions-modal.js`:
  - Accept `tags` in `open({ suggestions, rowsById, tags, notice, returnFocus })`
    (defaulting to `store.getState("tags") || {}` only when `tags === undefined`).
  - Clone incoming `suggestions` entries so edits never mutate caller objects.
  - Rows with at least one tag start ticked; rows with neither tag start
    unticked with their tick checkbox disabled and an explanatory `title`.
  - For each field in `TAG_FIELDS`:
    - When `proposed !== undefined`: render an interactive editable pill
      (`.suggest-pill`, without `.suggest-pill--kept`) showing
      `${field.label}: ${proposed}` with a trigger to open `TagSelector` and a
      clear (`×`) button to remove the field back to `"No tag"`.
    - When `proposed === undefined` and `row[field.rowKey]` is non-empty after
      trimming: keep the read-only `.suggest-pill.suggest-pill--kept`
      (`Already set`).
    - When `proposed === undefined` and the row field is blank: render an
      interactive `.suggest-pill.suggest-pill--empty` button showing
      `${field.label}: No tag` that opens `TagSelector` to pick a tag manually.
  - Choosing a tag uses `buildTagSelectorOptions(field.rowKey, this.tags)` for
    `"Trip/Event"` (keeping the past-tags toggle) and `this.tags.Category || []`
    for `"Category"`. Picking a tag sets the field, auto-ticks the row,
    re-renders that row in place, updates the footer, and focuses the refreshed
    field trigger. Clearing a field removes it, unticks and disables the row
    tick when no field remains, re-renders that row in place, updates the footer,
    and focuses the refreshed `"No tag"` button.
  - `toggleAll()` and `updateFooter()` operate on selectable rows (rows with at
    least one tag set); `toggleButton` is disabled when no row is selectable.
  - Create a `TagSelector` (styled with `tag-selector-popover--split-modal`)
    while the dialog is open and `destroy()` it in `close()`. Clicking the
    overlay while the popover is open closes only the popover; while the popover
    is open, `handleDialogKeydown` traps Tab inside `tagSelector.element` and
    does not close the dialog on `Escape`. Closing the popover without selecting
    returns focus to the trigger button. When all row ticks are disabled on
    open, focus the first enabled focusable element in the dialog.
- `src/features/transactions/transactions.component.js`:
  - In `submitTagSuggestions()`: keep alerting `describeSuggestionError` when
    `reconciled.length === 0 && result.error`. Otherwise build
    `reviewRows = buildReviewRows(reconciled, requestRows, currentRowsById)`.
    Alert `"No suggestions were returned."` only when `reviewRows.length === 0`.
    When `reconciled.length === 0` (no error), include `"The AI did not suggest
any tags. You can still select tags manually below."` in the dialog notice.
    Pass `tags: store.getState("tags")` into `openSuggestionReview` and
    `this.suggestionsModal.open(...)`.
- `src/features/transactions/transactions.css`:
  - Styles for editable suggestion pills, the clear button, `"No tag"` empty
    pills, focus-visible rings and phone spacing.

**Tests.**

- `tests/features/transactions/transactions.suggestions.test.js`: unit tests for
  `buildReviewRows` (order, reconciled entries kept, unsuggested rows included
  with empty proposal, partial single-field rows kept, deleted/changed/fully
  tagged rows dropped, duplicate request ids deduplicated, id types preserved,
  inputs not mutated).
- `tests/features/transactions/transactions.suggestions-modal.test.js`: tests for
  editing a proposed tag via `TagSelector` (including past trips toggle),
  clearing a tag back to `"No tag"` and auto-unticking/disabling when empty,
  rendering `"No tag"` and picking a tag manually (auto-ticking and updating
  Apply), opening with 0 AI suggestions, keeping `.suggest-pill--kept`
  read-only, Escape and overlay-click closing only the open `TagSelector`,
  Cancel after edits returning `null` without mutating inputs, and cleanup of
  `.tag-selector-popover` on close.
- `tests/shared/tag-selector.component.test.js`: tests for `Escape` stopping
  propagation and `onClose` firing once when closing an open popover.

**Acceptance criteria.**

- An editor can edit or clear any suggested tag inside the review dialog, and
  Apply saves the edited selection through the existing `updateExpenses` path.
- Any missing field with no AI suggestion shows `"No tag"` and lets the editor
  pick a tag manually via `TagSelector` (with past trips behind the toggle).
- Requested rows where the AI suggested neither field appear in the dialog
  unticked with `"No tag"` pills and auto-tick when a tag is chosen.
- Already-set (`kept`) tags remain read-only and are never overwritten.
- Cancelling after edits writes nothing and leaves caller data untouched.
- Full `npm test` and `npm run format:check` pass.
- No new dependency.

**Existing tests affected.** None.

**Status.** done. Reviewed and approved on 2026-11-17 on the first attempt. The
full suite is 423 tests and the format check passes locally on macOS. Manual
browser verification of editing, `"No tag"` manual selection, and saving remains
with the user.

**Review notes.** Approved cleanly with three minor non-blocking edge cases
recorded as E-074 (clicking a non-pill control while `TagSelector` is open
returns focus to the trigger via `onClose`) and E-075 (a synthetic proposal for
an already-tagged field renders as editable before `filterStillMissing` drops
it), plus `onClose` intentionally skipping direct pill-to-pill switches.
