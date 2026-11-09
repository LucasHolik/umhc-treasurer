# UMHC Treasurer Website

A modern, secure, and free financial management tool built for the UMHC Treasurer.

It is for the UMHC treasurer, and for helpers who need to look at the accounts without changing them. The treasurer imports bank statements, tags and splits transactions by category, trip and type, and analyses spending, without paying for hosting, a server or a database.

This project decouples the User Interface (the website) from the Data (Google Sheets), providing a way to manage finances without monthly fees or server costs.

## 🌟 Features

- **Dashboard:** Real-time overview of finances, including current balance and recent activity.
- **Responsive Phone Support:** Mobile-optimized layouts for core screens, including compressed controls and phone-friendly row/card views for dense data.
- **Transaction Management:**
  - Add, edit, and delete transactions (full-access mode).
  - **Split Transactions:** Break down a single bank entry into multiple categories or projects.
  - Bulk operations and filtering.
- **Tagging System:**
  - Robust categorization (Category, Trip/Event, Type).
  - "Smart" relationship mapping (e.g., specific Trips belong to specific Types).
- **Analysis:** Visual charts and data tables to track spending trends.
- **Excel Upload:** Drag-and-drop support for bank statement imports (Excel/CSV).
- **Role-Based Access:** Full-access and view-only passkeys on the same app URL.
- **Zero Cost Hosting:**
  - **Frontend:** Hosted on GitHub Pages (or any static host).
  - **Backend:** Google Apps Script (Serverless).
  - **Database:** Google Sheets.

## 🚀 Getting Started

### Prerequisites

1. A Google Account (for the backend).
2. A web browser.

### Installation & Setup

#### 1. Backend Setup

You must first set up your own private "Database".

1. Navigate to the `google-apps-script` folder in this repository.
2. Follow the detailed [Deployment Instructions](google-apps-script/README.md) to set up your Google Sheet and deploy the API.
3. **Keep your "Web App URL" and passkeys handy.**

#### 2. Frontend Usage

1. Open the hosted website (or run locally).
2. On the first visit, you will be prompted to **Configure Connection**.
3. Enter your **Google Script Web App URL**.
4. You will then be asked to **Login**. Enter either the full-access passkey or the view-only passkey from your Google Sheet's `Config` tab.

### Running Locally

This is a static client-side application. You can run it with any static file server.

```bash
# Clone the repository
git clone https://github.com/LucasHolik/umhc-treasurer.git

# Go to the project directory
cd umhc-treasurer

# Start a simple HTTP server (Python example)
python3 -m http.server
# OR using Node.js
npx serve .
```

Open your browser to `http://localhost:8000`.

The interface is responsive and supports both desktop and phone-sized screens when served locally.

### Running the Tests

The tests are for developers only; the app itself needs no install or build step.

```bash
npm install   # once
npm test
```

The suite runs in Node 22.6 or later and needs no browser, Google account or backend. Formatting is checked with `npm run format:check`.

See [AGENTS.md](AGENTS.md) for the workflow, design and testing rules.

## ⚠️ Limitations

- The app must be served over `localhost` or HTTPS. Opening `index.html` from `file://` fails because of ES modules, and a plain HTTP address on the local network fails because request signing needs `crypto.subtle`.
- Backend changes are not deployed automatically: changed `.gs` files must be pasted into the Apps Script editor and the web app redeployed.
- Google Sheets is the database, so large sheets are slower to load and Apps Script quotas apply.
- Interface checks are manual; the automated tests cover the logic, services and backend, not the screens. Known bugs are listed in [docs/bugs.md](docs/bugs.md).

## 🏗️ Architecture

- **Frontend:** vanilla JavaScript ES modules and plain CSS, with no framework and no build step. `src/core/` holds the store and pure logic, `src/services/` the API, auth, transaction and Excel services, and `src/features/` one folder per screen.
- **Backend:** Google Apps Script in `google-apps-script/`. Every request is signed with HMAC-SHA256 and sent as JSONP; `Code.gs` verifies the signature and role, then routes to the `Service_*` modules.
- **Database:** a Google Sheet with Finances, Tags, Split Transactions and Config tabs.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the module map, data flow and known design debt.

## 📚 Project documents

- [ARCHITECTURE.md](ARCHITECTURE.md): map of the code as it is now.
- [AGENTS.md](AGENTS.md): how work is planned, built, tested and reviewed. `CLAUDE.md` only loads it for Claude-based tools.
- [docs/rough_plan.md](docs/rough_plan.md): the end goal and phases; [docs/plan.md](docs/plan.md): the current phase; [docs/completed_plan.md](docs/completed_plan.md): finished phases.
- [docs/decisions.md](docs/decisions.md), [docs/bugs.md](docs/bugs.md) and [docs/edge_cases.md](docs/edge_cases.md): decisions, known bugs and edge cases.

## 🤝 Contributing

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

## 📄 License

CC-BY-NC-4.0 - Lucas Holik
