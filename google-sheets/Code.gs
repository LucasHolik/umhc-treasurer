// The main entry point for the web app
function doGet(e) {
  const action = e.parameter.action || "login";
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Config");
  const storedKey = sheet.getRange("A1").getValue();
  const providedKey = e.parameter.apiKey;

  let response;

  if (providedKey !== storedKey) {
    response = { success: false, message: "Invalid key" };
  } else {
    switch (action) {
      case "login":
        response = { success: true };
        break;
      case "saveData":
        response = saveDataToSheet(e);
        break;
      case "getData":
        response = getDataFromSheet();
        break;
      default:
        response = { success: false, message: "Invalid action" };
    }
  }

  const callback = e.parameter.callback || "callback";
  const jsonp = callback + "(" + JSON.stringify(response) + ")";

  return ContentService.createTextOutput(jsonp).setMimeType(
    ContentService.MimeType.JAVASCRIPT
  );
}

function saveDataToSheet(e) {
  try {
    const data = JSON.parse(e.parameter.data || "[]");

    if (data.length === 0) {
      return {
        success: true,
        message: "No data to save.",
        added: 0,
      };
    }

    const financeSheet =
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Finances");

    // Create headers if the sheet is empty
    if (financeSheet.getLastRow() === 0) {
      financeSheet.appendRow([
        "Document",
        "Time-uploaded",
        "Date",
        "Description",
        "Trip/Event",
        "Category",
        "Income",
        "Expense",
      ]);
    }

    // Calculate starting row once to avoid multiple getLastRow() calls
    const startRow = financeSheet.getLastRow() + 1;

    // Prepare records to add - data is already filtered on the client side
    // Ensure dates are in consistent format (YYYY-MM-DD) to prevent auto-conversion in Google Sheets
    const recordsToAdd = data.map((row) => [
      row.document || "",
      new Date(), // Time-uploaded
      row.date || "", // Date - already normalized to YYYY-MM-DD format on client side
      row.description || "",
      "", // Trip/Event - to be filled later
      "", // Category - to be filled later
      row.cashIn || "", // Income
      row.cashOut || "", // Expense
    ]);

    // Batch add all new records at once (much faster than individual appends)
    if (recordsToAdd.length > 0) {
      // For very large datasets, we may need to chunk the operations
      const maxBatchSize = 999; // Google Sheets recommended batch size

      if (recordsToAdd.length <= maxBatchSize) {
        // Process all at once if under limit
        // Format the date column as text before adding values to prevent auto-conversion
        const dateColumnRange = financeSheet.getRange(startRow, 3, recordsToAdd.length, 1); // Column 3 is the Date column
        dateColumnRange.setNumberFormat('@'); // @ = text format in Google Sheets
        financeSheet.getRange(startRow, 1, recordsToAdd.length, 8).setValues(recordsToAdd);
      } else {
        // Process in chunks to avoid limits and timeout issues
        for (let i = 0; i < recordsToAdd.length; i += maxBatchSize) {
          const chunk = recordsToAdd.slice(i, i + maxBatchSize);
          const chunkStartRow = startRow + i;
          // Format the date column as text before adding values to prevent auto-conversion
          const dateColumnRange = financeSheet.getRange(chunkStartRow, 3, chunk.length, 1); // Column 3 is the Date column
          dateColumnRange.setNumberFormat('@'); // @ = text format in Google Sheets
          financeSheet.getRange(chunkStartRow, 1, chunk.length, 8).setValues(chunk);
        }
      }
    }

    return {
      success: true,
      message:
        "Successfully added " +
        recordsToAdd.length +
        " new records to the sheet.",
      added: recordsToAdd.length,
    };
  } catch (error) {
    console.error("Error saving data:", error);
    return { success: false, message: "Error saving data: " + error.message };
  }
}

function getDataFromSheet() {
  try {
    const financeSheet =
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Finances");
    const lastRow = financeSheet.getLastRow();

    if (lastRow <= 1) {
      return { success: true, data: [] }; // No data besides headers
    }

    const range = financeSheet.getRange(2, 1, lastRow - 1, 8); // From row 2 (after headers) to last row, all 8 columns
    const values = range.getValues();

    // Convert to objects with column names as properties - matching the actual column order: Document, Time-uploaded, Date, Description, Trip/Event, Category, Income, Expense
    const headers = [
      "Document",
      "Time-uploaded",
      "Date",
      "Description",
      "Trip/Event",
      "Category",
      "Income",
      "Expense",
    ];
    const data = values.map((row) => {
      const obj = {};
      for (let i = 0; i < headers.length; i++) {
        obj[headers[i]] = row[i];
      }
      // Ensure dates remain as consistent strings to prevent timezone conversion issues
      // Google Sheets may auto-convert string dates to Date objects, so we format them back to string
      if (obj["Date"] instanceof Date) {
        obj["Date"] = Utilities.formatDate(obj["Date"], "UTC", "yyyy-MM-dd");
      }
      return obj;
    });

    return { success: true, data: data, count: data.length };
  } catch (error) {
    console.error("Error getting data:", error);
    return { success: false, message: "Error getting data: " + error.message };
  }
}
