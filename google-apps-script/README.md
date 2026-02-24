# UMHC Treasurer - Google Apps Script Backend

This directory contains the server-side code that powers the UMHC Treasurer application. It uses Google Apps Script to turn a standard Google Sheet into a secure, REST-like API and database.

## 🚀 Deployment Instructions

Follow these steps to set up your own backend instance.

### 1. Create the Spreadsheet

1. Go to [Google Sheets](https://sheets.google.com) and create a new blank spreadsheet.
2. Rename it to **"UMHC Finances"** (or similar).

### 2. Install the Script

1. In the spreadsheet, go to **Extensions** > **Apps Script**.
2. Delete any default code in the `Code.gs` file.
3. Copy the contents of each `.gs` file in this directory into the Apps Script editor. You should create separate files in the editor for each:
   - `Code.gs`
   - `Config.gs`
   - `Service_Auth.gs`
   - `Service_Session.gs`
   - `Service_Sheet.gs`
   - `Service_Split.gs`
   - `Service_Tags.gs`
4. Click the **Save** icon (disk) or press `Cmd/Ctrl + S`.

### 3. Configure the Spreadsheet

The script requires a specific "Config" sheet to handle authentication and settings.

1. Rename the default "Sheet1" to **"Finances"** (This is where your transaction data will live).
2. Create a NEW sheet (tab) and name it **"Config"**.
3. In the **Config** sheet, set up the following cells:
   - **Cell A1:** `Passkey` (Label)
   - **Cell A2:** `[YOUR_FULL_ACCESS_PASSKEY]` (Admin/full-access login passkey)
   - **Cell B1:** `View Only Passkey` (Label)
   - **Cell B2:** `[YOUR_VIEW_ONLY_PASSKEY]` (Optional viewer login passkey)
   - **Cell C1:** `Initial Balance` (Label)
   - **Cell C2:** `0` (Or your starting account balance)

> **Migration note:** Existing deployments using legacy `B1/B2` for Initial Balance are auto-migrated to `C1/C2` on first run. The migration is idempotent.

> **Note:** The "Tags" sheet and other data structures will be created automatically by the script when needed.

### 4. Deploy as Web App

1. In the Apps Script editor, click the blue **Deploy** button > **New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Fill in the details:
   - **Description:** `v1` (or anything you like)
   - **Execute as:** `Me` (This is crucial - it ensures the script has permission to edit your sheet).
   - **Who has access:** `Anyone` (This allows the website to contact your script. Security is handled via the passkey/signature system, not Google's permissions).
4. Click **Deploy**.
5. You will be asked to **Authorize access**. Click "Review permissions", select your Google account, and likely click "Advanced" > "Go to (Script Name) (unsafe)" to proceed. This is normal for your own scripts.
6. **COPY THE WEB APP URL.** It will look like `https://script.google.com/macros/s/.../exec`. You will need this for the website.

## 🛡️ Security Architecture

This backend uses a custom security layer designed for "Serverless" static sites:

- **JSONP:** Used for cross-origin communication.
- **HMAC-SHA256 Signatures:** Every request is signed.
  - **Login:** Signed with a configured **Passkey** (full-access or view-only).
  - **Session:** After login, the server issues a temporary **Session Key** with an attached role (`admin` or `viewer`). Subsequent requests are signed with this session key.
- **Authorization:** `viewer` sessions are read-only; mutation actions are blocked server-side with `Forbidden`.
- **Replay Protection:** Timestamps are verified to prevent replay attacks.

## 📂 File Structure

- **`Code.gs`**: The main entry point (`doGet`). Routes requests to the appropriate service.
- **`Config.gs`**: Central configuration (Sheet names, column constants).
- **`Service_Auth.gs`**: Handles login, signature verification, and security checks.
- **`Service_Session.gs`**: Manages temporary session tokens.
- **`Service_Sheet.gs`**: Interactions with the main "Finances" ledger.
- **`Service_Tags.gs`**: Manages the "Tags" sheet (Categories, Trips, Types).
- **`Service_Split.gs`**: Logic for handling split transactions.
