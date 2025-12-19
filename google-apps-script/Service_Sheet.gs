var Service_Sheet = {
  saveData: function (e) {
    try {
      const data = JSON.parse(e.parameter.data || "[]");

      if (data.length === 0) {
        return { success: true, message: "No data to save.", added: 0 };
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
        // Format date column (Column 3 / C)
        const dateColumnRange = financeSheet.getRange(
          startRow,
          3,
          recordsToAdd.length,
          1
        );
        dateColumnRange.setNumberFormat("@");

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
        if (obj["Date"] instanceof Date) {
          obj["Date"] = Utilities.formatDate(obj["Date"], "UTC", "yyyy-MM-dd");
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

      updates.forEach((update) => {
        const row = update.row;
        if (typeof row === "string" && row.startsWith("S-")) {
          // Handle Split Transaction Row
          Service_Split.updateSplitRowTag(
            row,
            update.tripEvent,
            update.category
          );
        } else if (typeof row === "number" && row > 1) {
          // Handle Standard Row (numeric)
          financeSheet.getRange(row, 5).setValue(update.tripEvent); // Column 5 is Trip/Event
          financeSheet.getRange(row, 6).setValue(update.category); // Column 6 is Category
        } else if (row) {
          console.error("Invalid row identifier:", row);
        }
      });

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
      configSheet.getRange(CONFIG.OPENING_BALANCE_CELL).setValue(balance);
      configSheet
        .getRange(CONFIG.OPENING_BALANCE_TITLE_CELL)
        .setValue(CONFIG.OPENING_BALANCE_TITLE);

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

      let column;
      if (type === "Trip/Event") {
        column = 5; // Column E
      } else if (type === "Category") {
        column = 6; // Column F
      } else {
        return { success: false, message: "Invalid type parameter." };
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

      let column;
      if (type === "Trip/Event") {
        column = 5; // Column E
      } else if (type === "Category") {
        column = 6; // Column F
      } else {
        return { success: false, message: "Invalid type parameter." };
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
      for (let i = 0; i < currentHeaders.length; i++) {
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
      } else if (currentHeaders.length < CONFIG.HEADERS.length) {
        // If partial match (subset), just update the header row to include new columns
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

  const dataWithDateObjects = values.map((row) => {
    const dateString = row[2]; // Date is in the 3rd column (index 2)
    let dateObject;
    if (typeof dateString === "string" && dateString) {
      const parts = dateString.split("-");
      if (parts.length === 3) {
        dateObject = new Date(parts[0], parts[1] - 1, parts[2]);
      } else {
        console.warn("Invalid date format:", dateString);
        dateObject = new Date(0); // Fallback to epoch
      }
    } else {
      console.warn("Invalid date value:", dateString);
      dateObject = new Date(0); // Fallback to epoch
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
  newRange.offset(0, 2, sortedValues.length, 1).setNumberFormat("@");
}
