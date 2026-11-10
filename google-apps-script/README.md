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
   - `Service_AI.gs`
   - `Service_Auth.gs`
   - `Service_Lock.gs`
   - `Service_Session.gs`
   - `Service_Sheet.gs`
   - `Service_Split.gs`
   - `Service_Tags.gs`
4. Click the **Save** icon (disk) or press `Cmd/Ctrl + S`.

> **Updating an existing deployment:** after pasting changed `.gs` files (or adding a new one such as `Service_Lock.gs`), the web app keeps serving the old code until you **redeploy**: **Deploy** > **Manage deployments** > edit (pencil) > **Version: New version** > **Deploy**. Editing the existing deployment keeps the same Web App URL. Afterwards, log out and back in once: login runs the Config sheet layout check (legacy balance migration and title cells), which reads no longer do.

> **Adding a file that uses a new Google service:** a redeploy does not grant new permissions and a web-app request cannot show a consent screen. `Service_AI.gs` uses `UrlFetchApp`, so after saving it run **`authorizeAi`** once from the editor (function dropdown > **Run**) and approve "Connect to an external service". The AI suggestions keep failing with a permission message until you do.

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

### 5. Configure AI tag suggestions (optional)

The "Suggest tags" feature is optional. Without these settings the rest of the
app works, the action answers "not configured", and the button stays disabled.

1. Get an API key from a supported provider. `AI_PROVIDER` can be `deepseek`,
   `openai`, `openrouter` or `anthropic`. Any OpenAI-compatible chat-completions
   endpoint also works with `AI_PROVIDER=openai` and `AI_BASE_URL` pointing at
   it.
2. In the Apps Script editor, open **Project Settings** > **Script properties**
   and add:
   - `AI_PROVIDER`: `deepseek`, `openai`, `openrouter` or `anthropic`.
   - `AI_MODEL`: the model id shown by that provider. There is no built-in
     default, so the deployment chooses it.
   - `AI_API_KEY`: your key.
   - `AI_BASE_URL`: optional, only for a gateway or self-hosted endpoint.
3. Save. No redeploy is needed, because the properties are read on every
   request. Grant the external-request permission once: in the editor choose
   `authorizeAi` from the function dropdown and click **Run**, then approve
   "Connect to an external service". Do this once per Google account that owns
   the deployment. If the project has an explicit `appsscript.json` with an
   `oauthScopes` list, add
   `https://www.googleapis.com/auth/script.external_request` there.
4. To rotate the key, edit the property. To turn the feature off, clear
   `AI_API_KEY`.

**Examples.** The model id is exact and has no default.

| Setup                     | `AI_PROVIDER` | `AI_MODEL`                                | `AI_BASE_URL`        |
| ------------------------- | ------------- | ----------------------------------------- | -------------------- |
| DeepSeek V4.1 Flash       | `deepseek`    | `deepseek-flash`                          | leave unset          |
| OpenAI                    | `openai`      | the model id from your OpenAI account     | leave unset          |
| OpenRouter                | `openrouter`  | the `<vendor>/<model>` id from OpenRouter | leave unset          |
| Anthropic                 | `anthropic`   | the Claude model id                       | leave unset          |
| OpenAI-compatible gateway | `openai`      | the id the gateway expects                | the gateway base URL |

For DeepSeek, the properties are:

```
AI_PROVIDER  = deepseek
AI_MODEL     = deepseek-flash
AI_API_KEY   = sk-...
AI_BASE_URL  = (leave this property unset)
```

`deepseek-flash` serves DeepSeek-V4.1-Flash-1017. The older `deepseek-v4-flash`
name is still accepted and billed as the same model, but `deepseek-flash` is the
current id. The provider's
[Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing) page is the
source of truth if a model name is rejected. The app switches DeepSeek's
thinking mode off for suggestions, because tagging is a short classification and
reasoning tokens only add cost and latency.

`AI_BASE_URL` is optional. Use the base URL, not the full endpoint, because the
app appends the provider path. It must be an `https://` URL with a host, must
not contain a username or password, and its port, if given, must be between 1
and 65535. `http://` is accepted only for a local gateway on `localhost`,
`127.0.0.1` or `[::1]`. A query string or fragment is not accepted.

**If suggestions fail.**

- "Could not reach the AI provider": the request got no HTTP reply. Run
  `authorizeAi` once as above, check that `AI_BASE_URL` is unset unless you use
  a gateway, and then read **Executions** for the latest `doGet` entry. Look for
  `Tag suggestion provider failure` and its `detail`; a caught permission or
  network throw is recorded as a completed execution, not a failed one.
- "Google has not authorised this script to call an external service": the
  external-request grant is missing. Run `authorizeAi` and approve it.
- "The AI provider rejected AI_API_KEY": the key is wrong, expired or has a
  stray quote or newline.
- "The AI provider is rate limited": wait and retry.
- "The AI provider returned an error": the provider rejected the request.
  Check `AI_MODEL` against the provider's current model list, and the
  `AI_BASE_URL` rules above.
- "AI_BASE_URL must ...": the override is malformed; the message names the
  problem.

The key is visible to anyone with edit access to the Apps Script project, so do
not share the project and set a spend limit on the provider account. When an
editor asks for suggestions, the selected rows' descriptions and dates and the
current tag lists are sent to the provider; amounts are not. The provider is
also told which trips are current and which are past, and it may decline to
suggest a tag. Nothing is sent until then, and viewers cannot use the feature.

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
- **`Config.gs`**: Central configuration (Sheet names, column constants, AI provider registry).
- **`Service_AI.gs`**: Tag suggestions. Reads the provider settings, builds the prompt, calls the provider and validates the reply. The only file that uses `PropertiesService` and `UrlFetchApp`.
- **`Service_Auth.gs`**: Handles login, signature verification, and security checks.
- **`Service_Lock.gs`**: The one place that takes the script lock (`withScriptLock`). Safe to nest, so a write that calls other locked helpers keeps a single lock throughout.
- **`Service_Session.gs`**: Manages temporary session tokens.
- **`Service_Sheet.gs`**: Interactions with the main "Finances" ledger.
- **`Service_Tags.gs`**: Manages the "Tags" sheet (Categories, Trips, Types).
- **`Service_Split.gs`**: Logic for handling split transactions.
