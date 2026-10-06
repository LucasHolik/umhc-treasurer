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
