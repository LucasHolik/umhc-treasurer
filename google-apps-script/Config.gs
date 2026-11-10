// google-apps-script/Config.gs

const CONFIG = {
  SHEET_NAME: "Finances",
  CONFIG_SHEET: "Config",
  API_KEY_TITLE_CELL: "A1",
  API_KEY_CELL: "A2",
  VIEW_ONLY_API_KEY_TITLE_CELL: "B1",
  VIEW_ONLY_API_KEY_CELL: "B2",
  OPENING_BALANCE_TITLE_CELL: "C1",
  OPENING_BALANCE_CELL: "C2",
  API_KEY_TITLE: "Passkey",
  VIEW_ONLY_API_KEY_TITLE: "View Only Passkey",
  OPENING_BALANCE_TITLE: "Initial Balance",
  // How long a request waits for the script lock (Service_Lock). Must stay
  // well below the client timeouts in src/services/api.service.js
  // (30 s reads, 60 s writes).
  LOCK_TIMEOUT_MS: 10000,
  HEADERS: [
    "Document",
    "Time-uploaded",
    "Date",
    "Description",
    "Trip/Event",
    "Category",
    "Income",
    "Expense",
    "Type",
    "Split Group ID",
  ],
};

// AI tag suggestions (Phase 6). The provider name, model and key live in
// Script Properties so the key never reaches the sheet, the browser or the
// repository (D-019). AI_BASE_URL is optional and only replaces the registry
// base URL; the family and path always come from PROVIDERS (D-020). There is
// deliberately no default model: the deployment chooses it with AI_MODEL.
const AI_CONFIG = {
  PROPERTY_PROVIDER: "AI_PROVIDER",
  PROPERTY_MODEL: "AI_MODEL",
  PROPERTY_KEY: "AI_API_KEY",
  PROPERTY_BASE_URL: "AI_BASE_URL",
  MAX_ROWS: 25,
  MAX_DESCRIPTION_LENGTH: 200,
  MAX_TOKENS: 800,
  TEMPERATURE: 0,
  PROVIDERS: {
    deepseek: {
      family: "openai",
      baseUrl: "https://api.deepseek.com",
      path: "/chat/completions",
      // DeepSeek enables thinking mode by default. Suggestions are a short
      // classification, so reasoning tokens only add cost and latency and can
      // use up the small output budget before any JSON is produced.
      extraBody: { thinking: { type: "disabled" } },
    },
    openai: {
      family: "openai",
      baseUrl: "https://api.openai.com/v1",
      path: "/chat/completions",
    },
    openrouter: {
      family: "openai",
      baseUrl: "https://openrouter.ai/api/v1",
      path: "/chat/completions",
    },
    anthropic: {
      family: "anthropic",
      baseUrl: "https://api.anthropic.com/v1",
      path: "/messages",
    },
  },
};
