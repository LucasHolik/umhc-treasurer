// google-apps-script/Service_AI.gs
//
// AI tag suggestions (Phase 6). This is the only file that reads the provider
// settings from Script Properties and the only file that calls UrlFetchApp, so
// the key stays server-side and the rest of the backend sees only validated
// proposals (D-019, D-020, D-021).
//
// The action takes no script lock and caches nothing: it writes no sheet, and
// holding the lock for the seconds a provider call takes would block every
// save.

// Used only when the deployment is missing Config.gs or the property: a
// present AI_CONFIG value always wins. The fallback is what lets getStatus
// report a usable limit instead of failing the whole read.
const AI_FALLBACK_MAX_ROWS = 25;

const Service_AI = {
  /**
   * Reports whether tag suggestions can run, without echoing the key. Used by
   * getAppData so the client can disable the button and explain why.
   *
   * This is total: a deployment that has Service_AI.gs and Code.gs but not
   * Config.gs must still answer, because getAppData fails as a whole if this
   * throws.
   *
   * @returns {{configured: boolean, provider: string|null, model: string|null, maxRows: number}}
   */
  getStatus: function () {
    try {
      const settings = _settings();
      return {
        configured: _configuredProvider(settings) !== null,
        provider: settings.provider || null,
        model: settings.model || null,
        maxRows: _maxRows(),
      };
    } catch (error) {
      return {
        configured: false,
        provider: null,
        model: null,
        maxRows: AI_FALLBACK_MAX_ROWS,
      };
    }
  },

  /**
   * Suggests Trip/Event and Category values for a batch of ledger rows. Only
   * the fields each row is missing can come back, and only values that exist
   * in the live tag lists are kept. The action writes nothing, so the browser
   * still saves suggestions through the normal tag path.
   *
   * @param {{parameter?: {rows?: string}}} e The JSONP request.
   * @returns {object} A success response with `suggestions`, or a failure with
   *   a validation message or an AI_* code.
   */
  suggestTags: function (e) {
    try {
      const request = _parseRequestRows(e?.parameter?.rows);
      if (!request.valid) return _failure(null, request.message);

      const settings = _settings();
      const provider = _configuredProvider(settings);
      if (!provider) {
        return _failure(
          "AI_NOT_CONFIGURED",
          "AI tag suggestions are not configured. Set AI_PROVIDER, AI_MODEL and AI_API_KEY in Script Properties.",
        );
      }

      // Validate the optional override before any fetch, including the
      // empty-batch shortcut, so a bad value is reported rather than ignored.
      const baseUrlProblem = _baseUrlProblem(settings.baseUrl, provider.path);
      if (baseUrlProblem) {
        return _failure("AI_NOT_CONFIGURED", baseUrlProblem);
      }

      // An empty batch means there is nothing to ask, so it is a success with
      // no provider call rather than a validation failure.
      if (request.rows.length === 0) return _success(settings, []);

      const tags = Service_Tags.getTags();
      const trips = Array.isArray(tags["Trip/Event"]) ? tags["Trip/Event"] : [];
      const categories = Array.isArray(tags.Category) ? tags.Category : [];
      if (trips.length === 0 && categories.length === 0) {
        return _success(settings, []);
      }

      const prompt = _buildPrompt(tags, request.rows);
      const call = _callProvider(settings, provider, prompt);
      if (!call.success) {
        _logFailure(settings, call.status, request.rows.length, call.detail);
        return _failure(call.code, call.message);
      }

      const reply = _parseSuggestions(call.text);
      if (reply === null) {
        _logFailure(settings, call.status, request.rows.length, call.detail);
        return _failure(
          "AI_BAD_RESPONSE",
          "The AI provider returned a reply that could not be read.",
        );
      }

      return _success(
        settings,
        _validateSuggestions(reply, request.rows, tags),
      );
    } catch (error) {
      return _failure(
        "AI_UNAVAILABLE",
        "The AI provider is unavailable. Please try again.",
      );
    }
  },
};

// --- Request parsing -------------------------------------------------------

const AI_TAG_FIELDS = ["Trip/Event", "Category"];

/**
 * Parses and validates the rows parameter. Everything rejected here is a
 * caller mistake, so the result carries a message and no AI_* code.
 *
 * @param {string|undefined} rawRows JSON array of request rows.
 * @returns {{valid: true, rows: Array<object>}|{valid: false, message: string}}
 */
function _parseRequestRows(rawRows) {
  let parsed;
  try {
    parsed = JSON.parse(rawRows);
  } catch (error) {
    return { valid: false, message: "Invalid rows parameter: invalid JSON." };
  }

  if (!Array.isArray(parsed)) {
    return {
      valid: false,
      message: "Invalid rows parameter: expected an array.",
    };
  }
  const maxRows = _maxRows();
  if (parsed.length > maxRows) {
    return {
      valid: false,
      message: "Too many rows. At most " + maxRows + " can be sent at once.",
    };
  }

  const rows = [];
  for (let index = 0; index < parsed.length; index++) {
    const row = parsed[index];
    if (row === null || typeof row !== "object" || Array.isArray(row)) {
      return {
        valid: false,
        message: "Row " + (index + 1) + " is not an object.",
      };
    }

    if (!_isValidRowId(row.row)) {
      return {
        valid: false,
        message: "Row " + (index + 1) + " has an invalid row id.",
      };
    }

    if (typeof row.description !== "string" || row.description.trim() === "") {
      return {
        valid: false,
        message: "Row " + (index + 1) + " has a blank description.",
      };
    }
    const description = row.description.trim();
    const maxDescriptionLength = _aiConfigValue("MAX_DESCRIPTION_LENGTH");
    if (
      typeof maxDescriptionLength === "number" &&
      description.length > maxDescriptionLength
    ) {
      return {
        valid: false,
        message:
          "Row " +
          (index + 1) +
          " has a description longer than " +
          maxDescriptionLength +
          " characters.",
      };
    }

    if (typeof row.amount !== "number" || !Number.isFinite(row.amount)) {
      return {
        valid: false,
        message: "Row " + (index + 1) + " has a non-finite amount.",
      };
    }

    const missing = _normaliseMissing(row.missing);
    if (!missing) {
      return {
        valid: false,
        message: "Row " + (index + 1) + " has no valid missing fields.",
      };
    }

    rows.push({
      row: row.row,
      description: description,
      amount: row.amount,
      missing: missing,
    });
  }

  return { valid: true, rows: rows };
}

/**
 * A valid row id is a ledger row number (an integer of at least 2, because row
 * 1 is the header) or a split child id of the form "S-<n>". Anything else is
 * rejected: in particular, String(undefined) and String(null) both compare
 * equal to an id-less reply entry, which would let a suggestion come back
 * without a row.
 *
 * @param {*} value
 * @returns {boolean}
 */
function _isValidRowId(value) {
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 2;
  }
  return typeof value === "string" && /^S-\d+$/.test(value);
}

/**
 * Returns the requested fields in a stable order, or null when the list is
 * empty or holds anything other than the two tag fields.
 *
 * @param {*} missing
 * @returns {string[]|null}
 */
function _normaliseMissing(missing) {
  if (!Array.isArray(missing) || missing.length === 0) return null;
  const output = [];
  for (const field of missing) {
    if (AI_TAG_FIELDS.indexOf(field) === -1) return null;
    if (output.indexOf(field) === -1) output.push(field);
  }
  return output;
}

// --- Configuration ---------------------------------------------------------

/**
 * Reads one AI_CONFIG value without throwing when the deployment is missing
 * Config.gs or the property. Undefined means "not configured here", which lets
 * getStatus stay total and lets suggestTags answer AI_NOT_CONFIGURED.
 *
 * @param {string} name
 * @returns {*} The configured value, or undefined.
 */
function _aiConfigValue(name) {
  try {
    if (typeof AI_CONFIG === "undefined" || AI_CONFIG === null) {
      return undefined;
    }
    return Object.prototype.hasOwnProperty.call(AI_CONFIG, name)
      ? AI_CONFIG[name]
      : undefined;
  } catch (error) {
    return undefined;
  }
}

/**
 * The configured batch limit, or the fallback when it is absent or malformed.
 *
 * @returns {number}
 */
function _maxRows() {
  const value = _aiConfigValue("MAX_ROWS");
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : AI_FALLBACK_MAX_ROWS;
}

// --- Settings --------------------------------------------------------------

/**
 * Reads the provider settings. It never throws and never returns anything but
 * trimmed strings: a missing or unreadable property is the empty string.
 *
 * @returns {{provider: string, model: string, key: string, baseUrl: string}}
 */
function _settings() {
  const empty = { provider: "", model: "", key: "", baseUrl: "" };
  try {
    const properties = PropertiesService.getScriptProperties();
    return {
      provider: _propertyText(properties, _aiConfigValue("PROPERTY_PROVIDER")),
      model: _propertyText(properties, _aiConfigValue("PROPERTY_MODEL")),
      key: _propertyText(properties, _aiConfigValue("PROPERTY_KEY")),
      baseUrl: _propertyText(properties, _aiConfigValue("PROPERTY_BASE_URL")),
    };
  } catch (error) {
    return empty;
  }
}

/**
 * @param {*} properties A Properties object.
 * @param {string} key
 * @returns {string}
 */
function _propertyText(properties, key) {
  if (typeof key !== "string" || key === "") return "";
  const value = properties.getProperty(key);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * The registry entry for a provider name, or null. The own-property check
 * keeps names such as "toString" from matching Object.prototype. A missing
 * registry (a deployment without Config.gs) means no configured provider.
 *
 * @param {string} name
 * @returns {{family: string, baseUrl: string, path: string}|null}
 */
function _providerEntry(name) {
  if (!name) return null;
  const providers = _aiConfigValue("PROVIDERS");
  if (
    providers === null ||
    typeof providers !== "object" ||
    !Object.prototype.hasOwnProperty.call(providers, name)
  ) {
    return null;
  }
  return providers[name];
}

/**
 * Returns the registry entry when the provider is known and the model and key
 * are set, otherwise null.
 *
 * @param {{provider: string, model: string, key: string}} settings
 * @returns {{family: string, baseUrl: string, path: string}|null}
 */
function _configuredProvider(settings) {
  const provider = _providerEntry(settings.provider);
  if (!provider || !settings.model || !settings.key) return null;
  return provider;
}

// --- Prompt ----------------------------------------------------------------

/**
 * Builds the system and user messages. The live tag lists and the rows are the
 * only data in the prompt; the key is never included.
 *
 * @param {object} tags The Service_Tags.getTags() reply.
 * @param {Array<object>} rows Validated request rows.
 * @returns {{system: string, user: string}}
 */
function _buildPrompt(tags, rows) {
  const trips = Array.isArray(tags["Trip/Event"]) ? tags["Trip/Event"] : [];
  const types = tags.TripTypeMap || {};
  const categories = Array.isArray(tags.Category) ? tags.Category : [];

  const tripLines = trips.map((trip) => {
    const type = types[trip];
    return type ? "- " + trip + " (Type: " + type + ")" : "- " + trip;
  });
  const categoryLines = categories.map((category) => "- " + category);

  const system = [
    "You suggest tags for a treasurer's ledger.",
    "Reply with JSON only and no prose.",
    "Choose Trip/Event and Category only from the allowed lists.",
    "Omit a field when you are unsure.",
    'Answer only the fields named in "missing" for each row.',
    'Return one object per row with the same "row" value.',
    'Use the keys "row", "tripEvent" and "category".',
    'The reply shape is {"suggestions":[{"row":42,"tripEvent":"...","category":"..."}]}.',
  ].join(" ");

  const user = [
    "Allowed Trip/Event values (with their Type):",
    tripLines.length > 0 ? tripLines.join("\n") : "(none)",
    "",
    "Allowed Category values:",
    categoryLines.length > 0 ? categoryLines.join("\n") : "(none)",
    "",
    "Rows:",
    JSON.stringify(rows),
  ].join("\n");

  return { system: system, user: user };
}

// --- Provider call ---------------------------------------------------------

/**
 * Grants the external-request scope once. Apps Script asks for scopes when a
 * function first needs them, and a web-app request cannot show the consent
 * screen, so run this by hand in the editor. It makes one harmless request and
 * never reads or sends AI_API_KEY. A throw is deliberately left to propagate so
 * the editor shows the consent screen or the permission error.
 *
 * Not routed from doGet: it is a one-off setup step, not an action.
 *
 * @returns {number} The HTTP status of the probe request.
 */
function authorizeAi() {
  const response = UrlFetchApp.fetch("https://www.google.com/", {
    method: "get",
    muteHttpExceptions: true,
  });
  const status = response.getResponseCode();
  console.log("authorizeAi probe status:", status);
  return status;
}

/**
 * Caps the configured output ceiling to a provider's own maximum. Providers
 * without `maxOutputTokens` keep the configured value, and a missing or
 * non-numeric value is returned unchanged, so a broken config behaves as it
 * did before.
 *
 * @param {*} configured
 * @param {{maxOutputTokens?: number}} provider
 * @returns {*}
 */
function _cappedMaxTokens(configured, provider) {
  if (typeof configured !== "number" || !Number.isFinite(configured)) {
    return configured;
  }
  const cap = provider.maxOutputTokens;
  return typeof cap === "number" && Number.isFinite(cap)
    ? Math.min(configured, cap)
    : configured;
}

/**
 * Sends one request to the configured provider and classifies the outcome.
 * The status code decides the error, and the reply body is never returned in
 * a message.
 *
 * @param {{provider: string, model: string, key: string, baseUrl: string}} settings
 * @param {{family: string, baseUrl: string, path: string, maxOutputTokens?: number}} provider
 * @param {{system: string, user: string}} prompt
 * @returns {{success: true, status: number, text: string}|{success: false, code: string, message: string, status: number, detail?: string}}
 */
function _callProvider(settings, provider, prompt) {
  const anthropic = provider.family === "anthropic";
  const maxTokens = _cappedMaxTokens(_aiConfigValue("MAX_TOKENS"), provider);
  const temperature = _aiConfigValue("TEMPERATURE");
  const headers = anthropic
    ? { "x-api-key": settings.key, "anthropic-version": "2023-06-01" }
    : { Authorization: "Bearer " + settings.key };
  const body = anthropic
    ? {
        model: settings.model,
        max_tokens: maxTokens,
        temperature: temperature,
        system: prompt.system,
        messages: [{ role: "user", content: prompt.user }],
      }
    : {
        model: settings.model,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
        temperature: temperature,
        max_tokens: maxTokens,
        stream: false,
        // Per-provider body extras, for example DeepSeek's thinking toggle.
        // Only the registry can set these, never a request parameter.
        ...(provider.extraBody || {}),
      };

  const url = _joinUrl(settings.baseUrl || provider.baseUrl, provider.path);

  let response;
  try {
    response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      headers: headers,
      payload: JSON.stringify(body),
      muteHttpExceptions: true,
    });
  } catch (error) {
    const detail = _redactError(error, settings.key);
    if (_isPermissionError(detail)) {
      return {
        success: false,
        code: "AI_UNAVAILABLE",
        message:
          "Google has not authorised this script to call an external service. Run authorizeAi in the Apps Script editor once, then try again.",
        status: 0,
        detail: detail,
      };
    }
    return {
      success: false,
      code: "AI_UNAVAILABLE",
      message: "Could not reach the AI provider. Please try again.",
      status: 0,
      detail: detail,
    };
  }

  const status = response.getResponseCode();
  if (status === 429) {
    return {
      success: false,
      code: "AI_RATE_LIMITED",
      message: "The AI provider is rate limited. Please try again shortly.",
      status: status,
    };
  }
  if (status === 401 || status === 403) {
    return {
      success: false,
      code: "AI_UNAVAILABLE",
      message:
        "The AI provider rejected AI_API_KEY. Check the key in Script Properties.",
      status: status,
    };
  }
  if (status < 200 || status >= 300) {
    return {
      success: false,
      code: "AI_UNAVAILABLE",
      message: "The AI provider returned an error. Please try again.",
      status: status,
    };
  }

  const text = _replyText(provider.family, response.getContentText());
  if (text === null) {
    return {
      success: false,
      code: "AI_BAD_RESPONSE",
      message: "The AI provider returned a reply that could not be read.",
      status: status,
    };
  }

  return { success: true, status: status, text: text };
}

/**
 * Builds a short, single-line detail from a thrown error for diagnostics. It
 * redacts only the configured key, collapses whitespace and caps the result at
 * 300 characters; it does not inspect payload text. The prompt, descriptions
 * and reply are never passed to it deliberately.
 *
 * The failure log then contains the provider, model, status, row count and this
 * redacted exception detail.
 *
 * @param {*} error The thrown value.
 * @param {string} key The configured API key.
 * @returns {string}
 */
function _redactError(error, key) {
  const raw =
    error && typeof error.message === "string" ? error.message : String(error);
  const withoutKey =
    typeof key === "string" && key !== ""
      ? raw.split(key).join("[redacted]")
      : raw;
  return withoutKey.replace(/\s+/g, " ").trim().slice(0, 300);
}

/**
 * Whether a thrown fetch detail says the script lacks the external-request
 * scope.
 *
 * @param {string} detail A _redactError result.
 * @returns {boolean}
 */
function _isPermissionError(detail) {
  return /permission to call UrlFetchApp|script\.external_request/i.test(
    String(detail || ""),
  );
}

/**
 * Checks the optional AI_BASE_URL override. An empty value is fine because the
 * registry base URL is used. The value must be an http(s) URL with no
 * whitespace, query or fragment, and must not already include the provider's
 * endpoint path. Only https:// is accepted, except for http:// on a loopback
 * host, where the key cannot leave the machine.
 *
 * Google Apps Script V8 does not reliably provide the global URL, so the
 * authority is parsed here.
 *
 * @param {string} baseUrl The AI_BASE_URL property, already trimmed.
 * @param {string} providerPath The registry path, for example "/chat/completions".
 * @returns {string|null} A message naming AI_BASE_URL, or null when usable.
 */
function _baseUrlProblem(baseUrl, providerPath) {
  const value = typeof baseUrl === "string" ? baseUrl.trim() : "";
  if (value === "") return null;
  if (/\s/.test(value)) {
    return "AI_BASE_URL must not contain spaces.";
  }
  if (value.indexOf("?") !== -1 || value.indexOf("#") !== -1) {
    return "AI_BASE_URL must not contain a query or fragment.";
  }

  const malformed =
    "AI_BASE_URL must be a URL such as https://api.deepseek.com.";
  const match = /^(https?):\/\/([^/?#]+)(\/.*)?$/i.exec(value);
  if (!match) return malformed;

  const scheme = match[1].toLowerCase();
  const authority = match[2];
  if (authority.indexOf("@") !== -1) {
    return "AI_BASE_URL must not include a username or password.";
  }

  let host;
  let port = null;
  if (authority.charAt(0) === "[") {
    const close = authority.indexOf("]");
    if (close === -1) return malformed;
    host = authority.slice(0, close + 1);
    const rest = authority.slice(close + 1);
    if (rest !== "") {
      if (rest.charAt(0) !== ":") return malformed;
      port = rest.slice(1);
    }
  } else {
    const colon = authority.indexOf(":");
    host = colon === -1 ? authority : authority.slice(0, colon);
    port = colon === -1 ? null : authority.slice(colon + 1);
  }

  if (host === "") return malformed;
  if (port !== null) {
    if (port === "") return "AI_BASE_URL has an empty port.";
    if (!/^\d+$/.test(port)) return "AI_BASE_URL must have a numeric port.";
    const number = Number(port);
    if (number < 1 || number > 65535) {
      return "AI_BASE_URL must have a port from 1 to 65535.";
    }
  }

  if (
    scheme === "http" &&
    ["localhost", "127.0.0.1", "[::1]"].indexOf(host.toLowerCase()) === -1
  ) {
    return "AI_BASE_URL must use https://.";
  }

  const endpoint = String(providerPath || "").replace(/\/+$/, "");
  if (endpoint !== "" && value.replace(/\/+$/, "").endsWith(endpoint)) {
    return (
      "AI_BASE_URL must be the base URL, not the endpoint. Remove " +
      endpoint +
      "."
    );
  }
  return null;
}

/**
 * Joins a base URL and a registry path with exactly one slash, so an override
 * ending in "/" cannot produce a double slash.
 *
 * @param {string} base
 * @param {string} path
 * @returns {string}
 */
function _joinUrl(base, path) {
  const left = String(base || "").replace(/\/+$/, "");
  const right = String(path || "").replace(/^\/+/, "");
  return left + "/" + right;
}

/**
 * Extracts the model's text from a provider envelope.
 *
 * @param {string} family
 * @param {string} contentText
 * @returns {string|null}
 */
function _replyText(family, contentText) {
  let envelope;
  try {
    envelope = JSON.parse(contentText);
  } catch (error) {
    return null;
  }
  if (envelope === null || typeof envelope !== "object") return null;

  if (family === "anthropic") {
    const blocks = Array.isArray(envelope.content) ? envelope.content : [];
    for (const block of blocks) {
      if (block && block.type === "text" && typeof block.text === "string") {
        return block.text;
      }
    }
    return null;
  }

  const choice = Array.isArray(envelope.choices) ? envelope.choices[0] : null;
  if (!choice || !choice.message) return null;
  return typeof choice.message.content === "string"
    ? choice.message.content
    : null;
}

// --- Reply parsing and validation -----------------------------------------

/**
 * Reads the model's JSON from its text. Code fences are stripped and the
 * outermost object or array is tried, so a stray sentence around the JSON does
 * not lose an otherwise usable reply.
 *
 * @param {string} text
 * @returns {Array<*>|null}
 */
function _parseSuggestions(text) {
  const source = _stripCodeFences(text);
  const parsed = _parseJsonObjectOrArray(source);
  if (parsed === null) return null;
  if (Array.isArray(parsed)) return parsed;
  if (typeof parsed === "object" && Array.isArray(parsed.suggestions)) {
    return parsed.suggestions;
  }
  return null;
}

/**
 * @param {string} text
 * @returns {string}
 */
function _stripCodeFences(text) {
  const value = typeof text === "string" ? text : "";
  const match = /```(?:json)?\s*([\s\S]*?)```/i.exec(value);
  return match ? match[1].trim() : value.trim();
}

/**
 * @param {string} text
 * @returns {*} The parsed value, or null when there is no usable JSON.
 */
function _parseJsonObjectOrArray(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    // Fall through to the outermost object or array.
  }

  const objectStart = text.indexOf("{");
  const arrayStart = text.indexOf("[");
  if (objectStart === -1 && arrayStart === -1) return null;

  let start;
  let close;
  if (objectStart === -1 || (arrayStart !== -1 && arrayStart < objectStart)) {
    start = arrayStart;
    close = "]";
  } else {
    start = objectStart;
    close = "}";
  }

  const end = text.lastIndexOf(close);
  if (end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (error) {
    return null;
  }
}

/**
 * Keeps only suggestions that are usable: the row was requested, the field was
 * missing, and the value is exactly in the live list. The first entry that
 * yields at least one valid field wins for a row; later duplicates are
 * ignored. The reply is returned in request order.
 *
 * @param {Array<*>} entries The model's suggestion entries.
 * @param {Array<object>} rows Validated request rows.
 * @param {object} tags The live tag lists.
 * @returns {Array<object>}
 */
function _validateSuggestions(entries, rows, tags) {
  const tripValues = new Set(
    Array.isArray(tags["Trip/Event"]) ? tags["Trip/Event"] : [],
  );
  const categoryValues = new Set(
    Array.isArray(tags.Category) ? tags.Category : [],
  );

  const requested = new Map();
  for (const row of rows) {
    const key = String(row.row);
    if (!requested.has(key)) requested.set(key, row);
  }

  const accepted = new Map();
  for (const entry of entries) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }
    const row = requested.get(String(entry.row));
    if (!row) continue;

    const key = String(row.row);
    if (accepted.has(key)) continue;

    let suggestion = null;
    for (const field of row.missing) {
      if (field === "Trip/Event") {
        if (
          typeof entry.tripEvent === "string" &&
          tripValues.has(entry.tripEvent)
        ) {
          suggestion = suggestion || { row: row.row };
          suggestion.tripEvent = entry.tripEvent;
        }
      } else if (field === "Category") {
        if (
          typeof entry.category === "string" &&
          categoryValues.has(entry.category)
        ) {
          suggestion = suggestion || { row: row.row };
          suggestion.category = entry.category;
        }
      }
    }
    if (suggestion) accepted.set(key, suggestion);
  }

  const output = [];
  const seen = new Set();
  for (const row of rows) {
    const key = String(row.row);
    if (seen.has(key)) continue;
    seen.add(key);
    if (accepted.has(key)) output.push(accepted.get(key));
  }
  return output;
}

// --- Responses and logging -------------------------------------------------

/**
 * @param {{provider: string, model: string}} settings
 * @param {Array<object>} suggestions
 * @returns {object}
 */
function _success(settings, suggestions) {
  return {
    success: true,
    provider: settings.provider,
    model: settings.model,
    suggestions: suggestions,
  };
}

/**
 * Builds a failure response. A null code is a validation failure and is
 * omitted, as the contract distinguishes the two.
 *
 * @param {string|null} code
 * @param {string} message
 * @returns {object}
 */
function _failure(code, message) {
  const failure = { success: false, message: message };
  if (code) failure.code = code;
  return failure;
}

/**
 * Records a failed provider call. The log contains the provider, model, HTTP
 * status, row count and a redacted exception detail, and nothing else: the
 * prompt, descriptions and reply are never passed to it deliberately.
 *
 * @param {{provider: string, model: string}} settings
 * @param {number} status
 * @param {number} rowCount
 * @param {string} [detail] A _redactError result for a thrown fetch.
 */
function _logFailure(settings, status, rowCount, detail) {
  console.error("Tag suggestion provider failure", {
    provider: settings.provider,
    model: settings.model,
    status: status,
    rows: rowCount,
    detail: detail,
  });
}
