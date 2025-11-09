# Google Apps Script Setup

This directory contains the code for the Google Apps Script that acts as the backend for the UMHC Finance Hub.

## Deployment Instructions

Follow these steps to deploy the script to your Google Sheet.

1.  **Open the Apps Script Editor:**
    *   Go to your "UMHC Finances" Google Sheet.
    *   Click on `Extensions` > `Apps Script`. This will open the script editor in a new tab.

2.  **Create the Script Files:**
    *   The editor will start with a default `Code.gs` file.
    *   Create three more script files by clicking the `+` icon in the "Files" sidebar and selecting "Script".
    *   You should have the following four files in your Apps Script project:
        - `Code.gs`
        - `Finances.gs`
        - `Config.gs`
        - `Utils.gs`

3.  **Copy and Paste the Code:**
    *   For each of the four files in this directory, copy its content and paste it into the corresponding file in your Apps Script editor.

4.  **Deploy the Web App:**
    *   Click the **Deploy** button and select **New deployment**.
    *   For "Select type," click the gear icon and choose **Web app**.
    *   In the configuration:
        - Give it a description (e.g., "UMHC Finance API v1").
        - Set "Who has access" to **Anyone**. This is critical for the web app to be reachable from the frontend.
    *   Click **Deploy**.
    *   **Important:** After deploying, Google will give you a **Web app URL**. Copy this URL and save it somewhere safe. You will need it for the frontend.
