# UMHC Treasurer Website

A modern, secure, and free financial management tool built for the UMHC Treasurer.

This project decouples the User Interface (the website) from the Data (Google Sheets), providing a way to manage finances without monthly fees or server costs.

## 🌟 Features

- **Dashboard:** Real-time overview of finances, including current balance and recent activity.
- **Transaction Management:**
  - Add, edit, and delete transactions.
  - **Split Transactions:** Break down a single bank entry into multiple categories or projects.
  - Bulk operations and filtering.
- **Tagging System:**
  - Robust categorization (Category, Trip/Event, Type).
  - "Smart" relationship mapping (e.g., specific Trips belong to specific Types).
- **Analysis:** Visual charts and data tables to track spending trends.
- **Excel Upload:** Drag-and-drop support for bank statement imports (Excel/CSV).
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
3. **Keep your "Web App URL" and "API Key" handy.**

#### 2. Frontend Usage

1. Open the hosted website (or run locally).
2. On the first visit, you will be prompted to **Configure Connection**.
3. Enter your **Google Script Web App URL**.
4. You will then be asked to **Login**. Enter the **API Key** you saved in your Google Sheet's "Config" tab.

### Running Locally

This is a static client-side application. You can run it with any static file server.

```bash
# Clone the repository
git clone https://github.com/your-username/umhc-treasurer.git

# Go to the project directory
cd umhc-treasurer

# Start a simple HTTP server (Python example)
python3 -m http.server
# OR using Node.js
npx serve .
```

Open your browser to `http://localhost:8000`.

## 🏗️ Architecture

This project follows a strict **Separation of Concerns** philosophy to ensure stability and maintainability.

### Frontend (React-style Vanilla JS)

- **`src/core/state.js`**: Central Store using the Observer (Pub/Sub) pattern. The single source of truth.
- **`src/services/`**: The Logic Layer. Handles API calls, data transformation, and business rules. Components never call the API directly; they call Services.
- **`src/features/`**: UI Components grouped by domain (Dashboard, Tags, Transactions).
- **`src/services/api.service.js`**: Handles JSONP communication with Google Apps Script, including HMAC-SHA256 request signing for security.

### Backend (Google Apps Script)

- Acts as a REST-like API.
- Validates all requests using signature verification.
- Routes data to specific Service modules (`Service_Sheet`, `Service_Tags`, etc.) to keep `Code.gs` clean.

## 🤝 Contributing

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

## 📄 License

CC-BY-NC-4.0 - Lucas Holik
