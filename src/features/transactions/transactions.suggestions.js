// src/features/transactions/transactions.suggestions.js
//
// Pure logic for AI tag suggestions, plus the one orchestration function that
// sends batches. The provider call is injected, so this module imports no
// store, service or DOM.

import {
  formatDateForInput,
  parseAmount,
  parseDate,
} from "../../core/utils.js";

/**
 * The tag fields a suggestion can fill, in a stable order.
 * @type {string[]}
 */
export const TAG_FIELDS = ["Trip/Event", "Category"];

const DEFAULT_BATCH_SIZE = 25;

/**
 * Coerces a value to trimmed text. Missing values become an empty string.
 * @param {*} value
 * @returns {string}
 */
const trimText = (value) =>
  value === null || value === undefined ? "" : String(value).trim();

/**
 * Reports whether a tag value is missing or only whitespace.
 * @param {*} value
 * @returns {boolean}
 */
const isBlank = (value) => trimText(value) === "";

/**
 * Returns the tag fields on a row whose value is blank after trimming.
 * @param {object} row - a ledger row (or a split child row)
 * @returns {string[]} a subset of TAG_FIELDS
 */
export const missingTagFields = (row) => {
  const source = row || {};
  return TAG_FIELDS.filter((field) => isBlank(source[field]));
};

/**
 * Keeps only the rows that are missing at least one of the two tags. This is
 * the list shown while suggestion selection mode is active, because a fully
 * tagged row has nothing to suggest. Non-array input yields an empty list and
 * the input is not mutated.
 * @param {Array<object>} rows - ledger rows, normally the filtered visible rows
 * @returns {Array<object>} a new array of the rows whose missingTagFields is not
 *   empty, in input order
 */
export const filterRowsMissingTags = (rows) =>
  (Array.isArray(rows) ? rows : []).filter(
    (row) => missingTagFields(row).length > 0,
  );

/**
 * Returns a row's signed net amount: income minus expense. Comma strings and
 * blanks are handled by parseAmount.
 * @param {object} row - a ledger row (or a split child row)
 * @returns {number} the signed net, positive for income and negative for expense
 */
export const rowAmount = (row) => {
  const source = row || {};
  return parseAmount(source.Income) - parseAmount(source.Expense);
};

/**
 * Splits selected rows into the ones worth asking about and the counts of the
 * two reasons for skipping the rest. A row with no missing tag is already
 * tagged; a row with a missing tag but no description cannot be suggested.
 * @param {Array<object>} rows - the selected ledger rows
 * @returns {{rows: Array<object>, alreadyTagged: number, missingDescription: number}}
 *   the rows to send, plus one count per skip reason. The input is not mutated.
 */
export const selectRowsForSuggestions = (rows) => {
  const selected = [];
  let alreadyTagged = 0;
  let missingDescription = 0;

  for (const row of Array.isArray(rows) ? rows : []) {
    if (missingTagFields(row).length === 0) {
      alreadyTagged++;
      continue;
    }
    if (isBlank(row && row.Description)) {
      missingDescription++;
      continue;
    }
    selected.push(row);
  }

  return { rows: selected, alreadyTagged, missingDescription };
};

/**
 * Formats a row's date for the prompt as a local YYYY-MM-DD string. A missing
 * or invalid value becomes an empty string. Local formatting is deliberate:
 * toISOString would shift the day for dates late or early enough to cross the
 * UTC boundary in British Summer Time.
 * @param {*} value - a Date object, a date string, or a missing value
 * @returns {string}
 */
const promptDate = (value) => formatDateForInput(parseDate(value));

/**
 * Builds the compact request rows sent to the backend.
 * @param {Array<object>} rows - rows chosen by selectRowsForSuggestions
 * @returns {Array<{row: *, description: string, date: string, amount: number, missing: string[]}>}
 *   one entry per input row, with the description trimmed, the date formatted
 *   as local YYYY-MM-DD, and the missing fields and signed amount attached.
 *   The input is not mutated.
 */
export const buildRequestRows = (rows) =>
  (Array.isArray(rows) ? rows : []).map((row) => {
    const source = row || {};
    return {
      row: source.row,
      description: trimText(source.Description),
      date: promptDate(source.Date),
      amount: rowAmount(source),
      missing: missingTagFields(source),
    };
  });

/**
 * Splits items into batches of at most `size`. A size that is missing, not a
 * positive integer or below 1 falls back to 25. An empty input yields no
 * batches.
 * @param {Array<*>} items
 * @param {number} [size]
 * @returns {Array<Array<*>>} the batches, in input order
 */
export const splitIntoBatches = (items, size) => {
  const list = Array.isArray(items) ? items : [];
  const batchSize =
    Number.isInteger(size) && size > 0 ? size : DEFAULT_BATCH_SIZE;
  const batches = [];
  for (let index = 0; index < list.length; index += batchSize) {
    batches.push(list.slice(index, index + batchSize));
  }
  return batches;
};

/**
 * Keeps only the proposals that are still safe to apply. A proposal survives
 * when its row was requested, a current row still exists, the current row's
 * trimmed description and signed amount still match the request (the
 * fingerprint), the field was missing both at request time and on the current
 * row, and the trimmed value is in the live tag list. The first entry that
 * yields a valid field wins for a row. Missing tag lists are treated as empty.
 * @param {Array<*>} suggestions - the provider's reply entries
 * @param {Array<object>} requested - rows from buildRequestRows
 * @param {Map<string, object>} currentRowsById - current rows keyed by String(row)
 * @param {object} tagsData - the live tag lists, normally store.tags
 * @returns {Array<{row: *, tripEvent?: string, category?: string}>} accepted
 *   proposals, in request order, carrying the request row's original id type.
 *   The inputs are not mutated.
 */
export const reconcileSuggestions = (
  suggestions,
  requested,
  currentRowsById,
  tagsData,
) => {
  if (!Array.isArray(suggestions)) return [];

  const requestRows = Array.isArray(requested) ? requested : [];
  const requestedByKey = new Map();
  for (const requestRow of requestRows) {
    if (requestRow === null || typeof requestRow !== "object") continue;
    const key = String(requestRow.row);
    if (!requestedByKey.has(key)) requestedByKey.set(key, requestRow);
  }

  const tags = tagsData || {};
  const allowed = {
    "Trip/Event": new Set(
      Array.isArray(tags["Trip/Event"]) ? tags["Trip/Event"] : [],
    ),
    Category: new Set(Array.isArray(tags.Category) ? tags.Category : []),
  };

  const currentRowFor = (key) => {
    if (!currentRowsById || typeof currentRowsById.get !== "function") {
      return undefined;
    }
    return currentRowsById.get(key);
  };

  const isAllowedTag = (value, allowedValues) =>
    typeof value === "string" &&
    value.trim() !== "" &&
    allowedValues.has(value.trim());

  const acceptedByKey = new Map();
  for (const entry of suggestions) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }

    const key = String(entry.row);
    if (acceptedByKey.has(key)) continue;

    const requestRow = requestedByKey.get(key);
    if (!requestRow) continue;

    const currentRow = currentRowFor(key);
    if (currentRow === undefined || currentRow === null) continue;
    if (
      trimText(currentRow.Description) !== trimText(requestRow.description) ||
      rowAmount(currentRow) !== requestRow.amount
    ) {
      continue;
    }

    // The request-time `missing` list is only a snapshot. A tag the row gained
    // before the reply arrived must win over a proposal, so also require the
    // field to be blank on the current row (D-021).
    const missingAtRequest = Array.isArray(requestRow.missing)
      ? requestRow.missing
      : [];
    const missingNow = missingTagFields(currentRow);
    const accepted = { row: requestRow.row };
    if (
      missingAtRequest.includes("Trip/Event") &&
      missingNow.includes("Trip/Event") &&
      isAllowedTag(entry.tripEvent, allowed["Trip/Event"])
    ) {
      accepted.tripEvent = entry.tripEvent.trim();
    }
    if (
      missingAtRequest.includes("Category") &&
      missingNow.includes("Category") &&
      isAllowedTag(entry.category, allowed.Category)
    ) {
      accepted.category = entry.category.trim();
    }

    if (accepted.tripEvent !== undefined || accepted.category !== undefined) {
      acceptedByKey.set(key, accepted);
    }
  }

  const output = [];
  for (const key of requestedByKey.keys()) {
    const accepted = acceptedByKey.get(key);
    if (accepted) output.push(accepted);
  }
  return output;
};

/**
 * Drops proposals that are no longer safe to apply because the review dialog
 * stayed open while the ledger changed.
 *
 * A proposal survives only while its row still exists. When `requested` is
 * given, the row must also still match the request's description and signed
 * amount, so a row that kept its id but changed underneath the dialog is
 * dropped. Within a surviving proposal, `tripEvent` is kept only when the
 * current row still has no Trip/Event, and `category` only when it still has no
 * Category. A proposal left with neither field is dropped. Missing rows and
 * invalid entries are dropped. Order and the proposal's own row id type are
 * preserved, and the input is not mutated.
 *
 * @param {Array<{row: *, tripEvent?: string, category?: string}>} accepted -
 *   the ticked proposals from the review dialog
 * @param {Map<string, object>} currentRowsById - current rows keyed by String(row)
 * @param {Array<{row: *, description: string, amount: number}>} [requested] -
 *   the request rows from buildRequestRows. When omitted, only blankness is
 *   re-checked, which is the original behaviour.
 * @returns {Array<{row: *, tripEvent?: string, category?: string}>} the
 *   proposals whose fields are still blank on the current rows, in input order
 */
export const filterStillMissing = (accepted, currentRowsById, requested) => {
  if (!Array.isArray(accepted)) return [];

  const checkFingerprint = Array.isArray(requested);
  const requestedByKey = new Map();
  if (checkFingerprint) {
    for (const requestRow of requested) {
      if (requestRow === null || typeof requestRow !== "object") continue;
      const key = String(requestRow.row);
      if (!requestedByKey.has(key)) requestedByKey.set(key, requestRow);
    }
  }

  const currentRowFor = (key) => {
    if (!currentRowsById || typeof currentRowsById.get !== "function") {
      return undefined;
    }
    return currentRowsById.get(key);
  };

  const output = [];
  for (const proposal of accepted) {
    if (
      proposal === null ||
      typeof proposal !== "object" ||
      Array.isArray(proposal)
    ) {
      continue;
    }

    const key = String(proposal.row);
    const currentRow = currentRowFor(key);
    if (currentRow === undefined || currentRow === null) continue;

    // A row can keep its id while its description or amount changes, so when
    // the request rows are supplied the original fingerprint must still match.
    if (checkFingerprint) {
      const requestRow = requestedByKey.get(key);
      if (!requestRow) continue;
      if (
        trimText(currentRow.Description) !== trimText(requestRow.description) ||
        rowAmount(currentRow) !== requestRow.amount
      ) {
        continue;
      }
    }

    const missingNow = missingTagFields(currentRow);
    const kept = { row: proposal.row };
    if (proposal.tripEvent !== undefined && missingNow.includes("Trip/Event")) {
      kept.tripEvent = proposal.tripEvent;
    }
    if (proposal.category !== undefined && missingNow.includes("Category")) {
      kept.category = proposal.category;
    }

    if (kept.tripEvent !== undefined || kept.category !== undefined) {
      output.push(kept);
    }
  }

  return output;
};

/**
 * Turns accepted proposals into pending changes for the existing tag save.
 * @param {Array<{row: *, tripEvent?: string, category?: string}>} accepted -
 *   the output of reconcileSuggestions
 * @returns {Map<string, object>} a new Map keyed by String(row) whose values
 *   contain only the fields that were present. The input is not mutated.
 */
export const toPendingChanges = (accepted) => {
  const changes = new Map();

  for (const suggestion of Array.isArray(accepted) ? accepted : []) {
    if (suggestion === null || typeof suggestion !== "object") continue;

    const fields = {};
    if (suggestion.tripEvent !== undefined) {
      fields["Trip/Event"] = suggestion.tripEvent;
    }
    if (suggestion.category !== undefined) {
      fields.Category = suggestion.category;
    }
    if (Object.keys(fields).length > 0) {
      changes.set(String(suggestion.row), fields);
    }
  }

  return changes;
};

/**
 * Merges accepted proposals into existing pending tag changes.
 *
 * The result is a new Map, keyed by String(row). A field that is already
 * pending for a row wins over the proposal, because the user may have edited
 * that row in the background while the review dialog was open. Only the
 * missing fields are added, other pending fields and rows survive, and neither
 * input is mutated.
 *
 * @param {Map<string, object>} pending - the component's pendingChanges map
 * @param {Array<{row: *, tripEvent?: string, category?: string}>} accepted -
 *   the proposals to add, normally the output of filterStillMissing
 * @returns {Map<string, object>} a new Map with the merged pending changes
 */
export const mergeAcceptedIntoPending = (pending, accepted) => {
  const merged = new Map();
  if (pending instanceof Map) {
    for (const [rowId, fields] of pending) {
      const source = fields && typeof fields === "object" ? fields : {};
      merged.set(rowId, { ...source });
    }
  }

  for (const [rowId, fields] of toPendingChanges(accepted)) {
    const existing = merged.get(rowId);
    if (!existing) {
      merged.set(rowId, { ...fields });
      continue;
    }
    for (const [field, value] of Object.entries(fields)) {
      if (!Object.prototype.hasOwnProperty.call(existing, field)) {
        existing[field] = value;
      }
    }
  }

  return merged;
};

/**
 * Sends request rows to the suggestion provider, one batch at a time and in
 * order, and merges the replies. Nothing is reconciled here.
 *
 * `onProgress` is called once before the first batch as
 * `onProgress(0, total)`, then after each batch resolves as
 * `onProgress(completed, total)`, where `completed` counts finished batches
 * from 1. It is not called for a batch that throws. A throwing callback is
 * ignored, because progress is cosmetic and must not affect the result.
 *
 * @param {Array<object>} rows - rows from buildRequestRows
 * @param {object} [options]
 * @param {function(Array<object>): Promise<{suggestions?: Array<object>}>} options.suggest -
 *   the injected provider call, normally ApiService.suggestTags
 * @param {number} [options.maxRows] - batch size; invalid values fall back to 25
 * @param {function(number, number): void} [options.onProgress] - progress callback
 * @returns {Promise<{suggestions: Array<object>, error: *}>} every suggestion
 *   from the completed batches, plus the first thrown error or null. Batches
 *   after a failure are not sent.
 * @throws {TypeError} when suggest is not a function
 */
export const collectSuggestions = async (rows, options = {}) => {
  const { suggest, maxRows, onProgress } = options || {};
  if (typeof suggest !== "function") {
    throw new TypeError(
      "collectSuggestions requires an injected suggest function.",
    );
  }

  const batches = splitIntoBatches(rows, maxRows);
  const total = batches.length;
  const suggestions = [];
  if (total === 0) return { suggestions, error: null };

  // Progress is cosmetic: a throwing callback must not reject this promise or
  // discard suggestions that other batches have already returned.
  const reportProgress = (completed) => {
    if (typeof onProgress !== "function") return;
    try {
      onProgress(completed, total);
    } catch {
      // Ignored on purpose.
    }
  };

  reportProgress(0);
  let completed = 0;
  for (const batch of batches) {
    let reply;
    try {
      reply = await suggest(batch);
    } catch (error) {
      return { suggestions, error };
    }
    if (reply && Array.isArray(reply.suggestions)) {
      suggestions.push(...reply.suggestions);
    }
    completed++;
    reportProgress(completed);
  }

  return { suggestions, error: null };
};
