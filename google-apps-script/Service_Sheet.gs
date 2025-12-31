var Service_Sheet = {
  saveData: function (e) {
    try {
      const data = JSON.parse(e.parameter.data || "[]");

      if (data.length === 0) {
        return { success: true, message: "No data to save.", added: 0 };
      }

      // Validate all dates before processing
      const invalidDates = data.filter(
        (row) => row.date && !/^\d{4}-\d{2}-\d{2}$/.test(row.date)
      );
      if (invalidDates.length > 0) {
        return {
          success: false,
          message: "Invalid date format. Expected yyyy-MM-dd.",
        };
      }

      const financeSheet = _getFinanceSheet();

      const startRow = financeSheet.getLastRow() + 1;
      const recordsToAdd = data.map((row) => [
        row.document || "",
        new Date(),
        row.date || "",
        row.description || "",
        "",
        "",
        row.cashIn || "",
        row.cashOut || "",
        row.isManual ? "Manual" : row.isUploaded ? "Uploaded" : "",
        "", // Split Group ID
      ]);

      if (recordsToAdd.length > 0) {
        // Format date column
        const dateCol = CONFIG.HEADERS.indexOf("Date") + 1;
        if (dateCol > 0) {
          const dateColumnRange = financeSheet.getRange(
            startRow,
            dateCol,
            recordsToAdd.length,
            1
          );
          dateColumnRange.setNumberFormat("@");
        }

        // Set values for all columns
        financeSheet
          .getRange(startRow, 1, recordsToAdd.length, CONFIG.HEADERS.length)
          .setValues(recordsToAdd);
      }

      _sortSheetByDate();

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
  },

  getData: function () {
    try {
      const financeSheet = _getFinanceSheet();
      const lastRow = financeSheet.getLastRow();

      if (lastRow <= 1) {
        return { success: true, data: [] };
      }

      const range = financeSheet.getRange(
        2,
        1,
        lastRow - 1,
        CONFIG.HEADERS.length
      );
      const values = range.getValues();

      const data = values.map((row, index) => {
        const obj = { row: index + 2 }; // Add row number for unique identification
        for (let i = 0; i < CONFIG.HEADERS.length; i++) {
          obj[CONFIG.HEADERS[i]] = row[i];
        }
        const tz = financeSheet.getParent().getSpreadsheetTimeZone();
        if (obj["Date"] instanceof Date) {
          obj["Date"] = Utilities.formatDate(obj["Date"], tz, "yyyy-MM-dd");
        } else if (typeof obj["Date"] === "string" && obj["Date"]) {
          // Date is already a string.
          if (/^\d{4}-\d{2}-\d{2}$/.test(obj["Date"])) {
            // If it matches YYYY-MM-DD, we leave it alone to preserve exact value (avoiding timezone shifts).
          } else if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(obj["Date"])) {
            // If it matches DD-MM-YYYY (or D-M-YYYY), parse it safely as UTC.
            const parts = obj["Date"].split("-");
            // Parse as UTC: parts[0] is Day, parts[1] is Month, parts[2] is Year
            const dateObj = new Date(
              Date.UTC(parts[2], parts[1] - 1, parts[0])
            );
            obj["Date"] = Utilities.formatDate(dateObj, "UTC", "yyyy-MM-dd");
          } else {
            console.warn(
              "Non-standard date format found:",
              obj["Date"],
              "at row",
              obj.row
            );
          }
        }
        return obj;
      });

      return { success: true, data: data, count: data.length };
    } catch (error) {
      console.error("Error getting data:", error);
      return {
        success: false,
        message: "Error getting data: " + error.message,
      };
    }
  },

  updateExpenses: function (e) {
    try {
      const updates = JSON.parse(e.parameter.data || "[]");
      if (updates.length === 0) {
        return { success: true, message: "No updates to save." };
      }

      const financeSheet = _getFinanceSheet();
      const tripEventCol = CONFIG.HEADERS.indexOf("Trip/Event") + 1;
      const categoryCol = CONFIG.HEADERS.indexOf("Category") + 1;

      for (const update of updates) {
        const row = update.row;
        if (typeof row === "string" && row.startsWith("S-")) {
          // Handle Split Transaction Row
          if (
            typeof Service_Split === "undefined" ||
            !Service_Split.updateSplitRowTag
          ) {
            console.error("Service_Split is not available");
            return {
              success: false,
              message: "Service_Split dependency not found",
            };
          }
          Service_Split.updateSplitRowTag(
            row,
            update.tripEvent,
            update.category
          );
        } else if (typeof row === "number" && row > 1) {
          // Handle Standard Row (numeric)
          if (tripEventCol > 0) {
            financeSheet.getRange(row, tripEventCol).setValue(update.tripEvent);
          } else {
            console.warn(
              "Trip/Event column not found, skipping update for row:",
              row
            );
          }
          if (categoryCol > 0) {
            financeSheet.getRange(row, categoryCol).setValue(update.category);
          } else {
            console.warn(
              "Category column not found, skipping update for row:",
              row
            );
          }
        } else if (row) {
          console.error("Invalid row identifier:", row);
        }
      }

      return { success: true, message: "Expenses updated successfully." };
    } catch (error) {
      console.error("Error updating expenses:", error);
      return {
        success: false,
        message: "Error updating expenses: " + error.message,
      };
    }
  },

  getOpeningBalance: function () {
    try {
      const configSheet = _getConfigSheet();

      const balanceCell = configSheet.getRange(CONFIG.OPENING_BALANCE_CELL);
      let balance = balanceCell.getValue();

      if (balance === "" || balance === null || balance === undefined) {
        balanceCell.setValue(0);
        balance = 0;
      }

      return { success: true, balance: parseFloat(balance) || 0 };
    } catch (error) {
      console.error("Error getting opening balance:", error);
      return {
        success: false,
        message: "Error getting opening balance: " + error.message,
      };
    }
  },

  saveOpeningBalance: function (e) {
    try {
      const balance = parseFloat(e.parameter.balance);
      if (isNaN(balance)) {
        return { success: false, message: "Invalid balance value" };
      }

      const configSheet = _getConfigSheet();
      configSheet.getRange(CONFIG.OPENING_BALANCE_CELL).setValue(balance);

      return { success: true, message: "Opening balance saved successfully" };
    } catch (error) {
      console.error("Error saving opening balance:", error);
      return {
        success: false,
        message: "Error saving opening balance: " + error.message,
      };
    }
  },

  removeTagFromExpenses: function (type, value) {
    try {
      const financeSheet = _getFinanceSheet();
      const lastRow = financeSheet.getLastRow();
      if (lastRow <= 1) {
        return { success: true, message: "No expenses to update." };
      }

      const column = CONFIG.HEADERS.indexOf(type) + 1;
      if (column <= 0) {
        return {
          success: false,
          message: "Invalid type parameter or column not found.",
        };
      }

      const range = financeSheet.getRange(2, column, lastRow - 1, 1);
      const values = range.getValues();

      for (let i = 0; i < values.length; i++) {
        if (values[i][0] === value) {
          values[i][0] = "";
        }
      }

      range.setValues(values);
      return { success: true, message: "Tag removed successfully." };
    } catch (error) {
      console.error("Error removing tag from expenses:", error);
      return {
        success: false,
        message: "Error removing tag: " + error.message,
      };
    }
  },

  updateExpensesWithTag: function (oldTag, newTag, type) {
    try {
      const financeSheet = _getFinanceSheet();
      const lastRow = financeSheet.getLastRow();

      if (lastRow <= 1) {
        return { success: true, message: "No expenses to update." };
      }

      const column = CONFIG.HEADERS.indexOf(type) + 1;
      if (column <= 0) {
        return {
          success: false,
          message: "Invalid type parameter or column not found.",
        };
      }

      const range = financeSheet.getRange(2, column, lastRow - 1, 1);
      const values = range.getValues();

      for (let i = 0; i < values.length; i++) {
        if (values[i][0] === oldTag) {
          values[i][0] = newTag;
        }
      }

      // Write the updated values back to the sheet
      range.setValues(values);
      return { success: true, message: "Expenses updated successfully." };
    } catch (error) {
      console.error("Error updating expenses with tag:", error);
      return {
        success: false,
        message: "Error updating expenses: " + error.message,
      };
    }
  },
};

// google-sheets/Sheet.gs

function _getFinanceSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let financeSheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);
  if (!financeSheet) {
    financeSheet = spreadsheet.insertSheet(CONFIG.SHEET_NAME);
    financeSheet.appendRow(CONFIG.HEADERS);
  } else {
    const lastRow = financeSheet.getLastRow();
    if (lastRow === 0) {
      financeSheet.appendRow(CONFIG.HEADERS);
    } else {
      // Check if headers need update
      const currentHeadersRange = financeSheet.getRange(
        1,
        1,
        1,
        financeSheet.getLastColumn()
      );
      const currentHeaders = currentHeadersRange.getValues()[0];

      // Check if current headers match the beginning of CONFIG.HEADERS
      let match = true;
      const minLength = Math.min(currentHeaders.length, CONFIG.HEADERS.length);
      for (let i = 0; i < minLength; i++) {
        if (currentHeaders[i] !== CONFIG.HEADERS[i]) {
          match = false;
          break;
        }
      }

      if (!match) {
        // If complete mismatch, log error and throw
        console.error(
          "Header mismatch detected. Expected:",
          CONFIG.HEADERS,
          "Got:",
          currentHeaders
        );
        throw new Error(
          "Sheet headers do not match expected configuration. Manual intervention required."
        );
      } else if (currentHeaders.length !== CONFIG.HEADERS.length) {
        // If length mismatch, update the header row to ensure consistency
        financeSheet
          .getRange(1, 1, 1, CONFIG.HEADERS.length)
          .setValues([CONFIG.HEADERS]);
      }
    }
  }
  return financeSheet;
}

function _sortSheetByDate() {
  const financeSheet = _getFinanceSheet();
  const lastRow = financeSheet.getLastRow();

  if (lastRow <= 1) {
    return; // No data to sort
  }

  // Sort all columns
  const range = financeSheet.getRange(2, 1, lastRow - 1, CONFIG.HEADERS.length);
  const values = range.getValues();

  const dateIndex = CONFIG.HEADERS.indexOf("Date");
  if (dateIndex < 0) {
    console.warn("Date column not found in headers, skipping sort");
    return;
  }
  const dataWithDateObjects = values.map((row) => {
    let dateVal = row[dateIndex];

    // Normalize Date objects to YYYY-MM-DD strings to ensure consistency and prevent timezone shifts
    if (dateVal instanceof Date) {
      const tz = financeSheet.getParent().getSpreadsheetTimeZone();
      dateVal = Utilities.formatDate(dateVal, tz, "yyyy-MM-dd");
      row[dateIndex] = dateVal; // Update row data so it's saved back as a string
    }

    let dateObject;
    if (typeof dateVal === "string" && dateVal) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
        const parts = dateVal.split("-");
        dateObject = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
      } else if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(dateVal)) {
        const parts = dateVal.split("-");
        // Normalize to YYYY-MM-DD for consistency
        dateObject = new Date(Date.UTC(parts[2], parts[1] - 1, parts[0]));
        const normalizedDate = Utilities.formatDate(
          dateObject,
          "UTC",
          "yyyy-MM-dd"
        );
        row[dateIndex] = normalizedDate; // Update row data so it's saved back as a normalized string
        dateVal = normalizedDate;
      } else {
        console.warn("Invalid date format:", dateVal);
        dateObject = new Date(0);
      }
    } else {
      console.warn("Invalid date value:", dateVal);
      dateObject = new Date(0);
    }
    return {
      rowData: row,
      dateObject: dateObject,
    };
  });

  dataWithDateObjects.sort((a, b) => b.dateObject - a.dateObject);

  const sortedValues = dataWithDateObjects.map((item) => item.rowData);

  range.clearContent();
  const newRange = financeSheet.getRange(
    2,
    1,
    sortedValues.length,
    CONFIG.HEADERS.length
  );
  newRange.setValues(sortedValues);
  newRange.offset(0, dateIndex, sortedValues.length, 1).setNumberFormat("@");
}

function _getConfigSheet() {
  let configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
    CONFIG.CONFIG_SHEET
  );
  if (!configSheet) {
    configSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(
      CONFIG.CONFIG_SHEET
    );
  }

  // Ensure titles are correct
  configSheet
    .getRange(CONFIG.API_KEY_TITLE_CELL)
    .setValue(CONFIG.API_KEY_TITLE);
  configSheet
    .getRange(CONFIG.OPENING_BALANCE_TITLE_CELL)
    .setValue(CONFIG.OPENING_BALANCE_TITLE);

  return configSheet;
}
