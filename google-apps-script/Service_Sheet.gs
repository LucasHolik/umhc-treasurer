const Service_Sheet = {
  saveData: function (e) {
    try {
      if (!e || !e.parameter) {
        return { success: false, message: "Invalid request parameters." };
      }
      let data;
      try {
        data = JSON.parse(e.parameter.data || "[]");
      } catch (parseError) {
        return { success: false, message: "Invalid JSON data format." };
      }

      if (data.length === 0) {
        return { success: true, message: "No data to save.", added: 0 };
      }

      // Validate all dates before processing
      const invalidDates = data.filter((row) => {
        if (!row.date) return false;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) return true;

        const [year, month, day] = row.date.split("-").map(Number);
        if (month < 1 || month > 12 || day < 1 || day > 31) return true;

        // Check if date is valid by creating a Date object and comparing
        const date = new Date(year, month - 1, day);
        return (
          date.getFullYear() !== year ||
          date.getMonth() !== month - 1 ||
          date.getDate() !== day
        );
      });
      if (invalidDates.length > 0) {
        return {
          success: false,
          message: "Invalid date format. Expected yyyy-MM-dd.",
        };
      }

      const financeSheet = _getFinanceSheet();

      // Validate required columns exist
      const requiredColumns = [
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
      ];
      const missingColumns = requiredColumns.filter(
        (col) => !CONFIG.HEADERS.includes(col),
      );
      if (missingColumns.length > 0) {
        return {
          success: false,
          message: "Missing required columns: " + missingColumns.join(", "),
        };
      }

      const startRow = financeSheet.getLastRow() + 1;
      const recordsToAdd = data.map((row) => {
        const record = new Array(CONFIG.HEADERS.length).fill("");
        record[CONFIG.HEADERS.indexOf("Document")] = row.document || "";
        record[CONFIG.HEADERS.indexOf("Time-uploaded")] = new Date();
        record[CONFIG.HEADERS.indexOf("Date")] = row.date || "";
        record[CONFIG.HEADERS.indexOf("Description")] = row.description || "";
        record[CONFIG.HEADERS.indexOf("Trip/Event")] = row.tripEvent || "";
        record[CONFIG.HEADERS.indexOf("Category")] = row.category || "";
        record[CONFIG.HEADERS.indexOf("Income")] = row.cashIn || "";
        record[CONFIG.HEADERS.indexOf("Expense")] = row.cashOut || "";
        record[CONFIG.HEADERS.indexOf("Type")] = row.isManual
          ? "Manual"
          : row.isUploaded
            ? "Uploaded"
            : "";
        record[CONFIG.HEADERS.indexOf("Split Group ID")] =
          row.splitGroupId || "";
        return record;
      });

      if (recordsToAdd.length > 0) {
        // Format date column
        const dateCol = CONFIG.HEADERS.indexOf("Date") + 1;
        if (dateCol > 0) {
          const dateColumnRange = financeSheet.getRange(
            startRow,
            dateCol,
            recordsToAdd.length,
            1,
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
        CONFIG.HEADERS.length,
      );
      const values = range.getValues();
      const tz = financeSheet.getParent().getSpreadsheetTimeZone();

      const data = values.map((row, index) => {
        const obj = { row: index + 2 }; // Add row number for unique identification
        for (let i = 0; i < CONFIG.HEADERS.length; i++) {
          obj[CONFIG.HEADERS[i]] = row[i];
        }
        if (obj["Date"] instanceof Date) {
          obj["Date"] = Utilities.formatDate(obj["Date"], tz, "yyyy-MM-dd");
        } else if (typeof obj["Date"] === "string" && obj["Date"]) {
          // Date is already a string.
          const result = _parseAndNormalizeDateString(
            obj["Date"],
            "row " + obj.row,
          );
          if (result.normalized) {
            obj["Date"] = result.normalized;
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
      if (!e || !e.parameter) {
        return { success: false, message: "Invalid request parameters." };
      }
      let updates;
      try {
        updates = JSON.parse(e.parameter.data || "[]");
      } catch (parseError) {
        return { success: false, message: "Invalid JSON data format." };
      }
      if (updates.length === 0) {
        return { success: true, message: "No updates to save." };
      }

      const financeSheet = _getFinanceSheet();
      const tripEventCol = CONFIG.HEADERS.indexOf("Trip/Event") + 1;
      const categoryCol = CONFIG.HEADERS.indexOf("Category") + 1;
      const failures = [];

      for (const update of updates) {
        const row = update.row;
        if (typeof row === "string" && row.startsWith("S-")) {
          // Handle Split Transaction Row
          if (
            typeof Service_Split === "undefined" ||
            !Service_Split.updateSplitRowTag
          ) {
            console.warn(
              "Skipping split row update due to missing Service_Split:",
              row,
            );
            failures.push({ row, reason: "Service_Split unavailable" });
            continue;
          }
          Service_Split.updateSplitRowTag(
            row,
            update.tripEvent,
            update.category,
          );
        } else if (typeof row === "number" && row > 1) {
          // Handle Standard Row (numeric)
          if (tripEventCol > 0) {
            financeSheet.getRange(row, tripEventCol).setValue(update.tripEvent);
          } else {
            console.warn(
              "Trip/Event column not found, skipping update for row:",
              row,
            );
            failures.push({ row, reason: "Trip/Event column not found" });
          }
          if (categoryCol > 0) {
            financeSheet.getRange(row, categoryCol).setValue(update.category);
          } else {
            console.warn(
              "Category column not found, skipping update for row:",
              row,
            );
            failures.push({ row, reason: "Category column not found" });
          }
        } else if (row) {
          console.error("Invalid row identifier:", row);
          failures.push({ row, reason: "Invalid row identifier" });
        }
      }

      const message =
        failures.length > 0
          ? `Updated with ${failures.length} failures`
          : "Expenses updated successfully.";
      return { success: failures.length === 0, message, failures };
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
      if (!e || !e.parameter) {
        return { success: false, message: "Invalid request parameters." };
      }
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
        financeSheet.getLastColumn(),
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
          currentHeaders,
        );
        throw new Error(
          "Sheet headers do not match expected configuration. Manual intervention required.",
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
  const tz = financeSheet.getParent().getSpreadsheetTimeZone();
  const dataWithDateObjects = values.map((row) => {
    let dateVal = row[dateIndex];

    // Normalize Date objects to YYYY-MM-DD strings to ensure consistency and prevent timezone shifts
    if (dateVal instanceof Date) {
      dateVal = Utilities.formatDate(dateVal, tz, "yyyy-MM-dd");
      row[dateIndex] = dateVal; // Update row data so it's saved back as a string
    }

    let dateObject;
    if (typeof dateVal === "string" && dateVal) {
      const result = _parseAndNormalizeDateString(dateVal, "sort");
      dateObject = result.dateObject;
      if (result.normalized) {
        row[dateIndex] = result.normalized;
        dateVal = result.normalized;
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

  // Write sorted values directly (overwrites existing data atomically)
  const newRange = financeSheet.getRange(
    2,
    1,
    sortedValues.length,
    CONFIG.HEADERS.length,
  );
  newRange.setValues(sortedValues);
  newRange.offset(0, dateIndex, sortedValues.length, 1).setNumberFormat("@");

  // Clear any remaining rows if the data shrunk (shouldn't happen in sort, but good for robustness)
  const remainingRows = lastRow - 1 - sortedValues.length;
  if (remainingRows > 0) {
    financeSheet
      .getRange(
        2 + sortedValues.length,
        1,
        remainingRows,
        CONFIG.HEADERS.length,
      )
      .clearContent();
  }
}

function _getConfigSheet() {
  let configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
    CONFIG.CONFIG_SHEET,
  );
  if (!configSheet) {
    configSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(
      CONFIG.CONFIG_SHEET,
    );
  }

  // Legacy migration:
  // Old layout used B1/B2 for Initial Balance. New layout uses C1/C2.
  const legacyBalanceTitle = String(configSheet.getRange("B1").getValue() || "").trim();
  const isLegacyLayout = legacyBalanceTitle === CONFIG.OPENING_BALANCE_TITLE;
  if (isLegacyLayout) {
    const legacyBalanceCell = configSheet.getRange("B2");
    const legacyBalanceValue = legacyBalanceCell.getValue();
    const newBalanceCell = configSheet.getRange(CONFIG.OPENING_BALANCE_CELL);
    const newBalanceValue = newBalanceCell.getValue();
    const newBalanceIsEmpty =
      newBalanceValue === "" || newBalanceValue === null || newBalanceValue === undefined;

    if (
      newBalanceIsEmpty &&
      legacyBalanceValue !== "" &&
      legacyBalanceValue !== null &&
      legacyBalanceValue !== undefined
    ) {
      newBalanceCell.setValue(legacyBalanceValue);
      legacyBalanceCell.clearContent();
    }
  }

  // Ensure titles are correct in the new layout
  configSheet.getRange(CONFIG.API_KEY_TITLE_CELL).setValue(CONFIG.API_KEY_TITLE);
  configSheet
    .getRange(CONFIG.VIEW_ONLY_API_KEY_TITLE_CELL)
    .setValue(CONFIG.VIEW_ONLY_API_KEY_TITLE);
  configSheet
    .getRange(CONFIG.OPENING_BALANCE_TITLE_CELL)
    .setValue(CONFIG.OPENING_BALANCE_TITLE);

  return configSheet;
}

function _parseAndNormalizeDateString(dateStr, rowIdentifier) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const parts = dateStr.split("-");
    return {
      dateObject: new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])),
      normalized: dateStr,
    };
  } else if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(dateStr)) {
    const parts = dateStr.split("-");
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);

    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900) {
      console.warn("Invalid date components:", dateStr, "at", rowIdentifier);
      return { dateObject: new Date(0), normalized: "" };
    }

    const dateObject = new Date(Date.UTC(year, month - 1, day));
    const normalized = Utilities.formatDate(dateObject, "UTC", "yyyy-MM-dd");
    return { dateObject, normalized };
  } else {
    console.warn("Invalid date format:", dateStr, "at", rowIdentifier);
    return { dateObject: new Date(0), normalized: "" };
  }
}
