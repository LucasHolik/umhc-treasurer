// google-sheets/Sheet.gs

function _getFinanceSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let financeSheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);
  if (!financeSheet) {
    financeSheet = spreadsheet.insertSheet(CONFIG.SHEET_NAME);
    financeSheet.appendRow(CONFIG.HEADERS);
  }
  return financeSheet;
}

function handleSaveData(e) {
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
    ]);

    if (recordsToAdd.length > 0) {
      const dateColumnRange = financeSheet.getRange(startRow, 3, recordsToAdd.length, 1);
      dateColumnRange.setNumberFormat('@');
      financeSheet.getRange(startRow, 1, recordsToAdd.length, 8).setValues(recordsToAdd);
    }

    _sortSheetByDate();

    return {
      success: true,
      message: "Successfully added " + recordsToAdd.length + " new records to the sheet.",
      added: recordsToAdd.length,
    };
  } catch (error) {
    console.error("Error saving data:", error);
    return { success: false, message: "Error saving data: " + error.message };
  }
}

function _sortSheetByDate() {
  const financeSheet = _getFinanceSheet();
  const lastRow = financeSheet.getLastRow();

  if (lastRow <= 1) {
    return; // No data to sort
  }

  const range = financeSheet.getRange(2, 1, lastRow - 1, 8);
  const values = range.getValues();

  const dataWithDateObjects = values.map(row => {
    const dateString = row[2]; // Date is in the 3rd column (index 2)
    const parts = dateString.split('-');
    const dateObject = new Date(parts[0], parts[1] - 1, parts[2]);
    return {
      rowData: row,
      dateObject: dateObject
    };
  });

  dataWithDateObjects.sort((a, b) => b.dateObject - a.dateObject);

  const sortedValues = dataWithDateObjects.map(item => item.rowData);

  range.clearContent();
  const newRange = financeSheet.getRange(2, 1, sortedValues.length, 8);
  newRange.setValues(sortedValues);
  newRange.offset(0, 2, sortedValues.length, 1).setNumberFormat('@');
}

function handleGetData() {
  try {
    const financeSheet = _getFinanceSheet();
    const lastRow = financeSheet.getLastRow();

    if (lastRow <= 1) {
      return { success: true, data: [] };
    }

    const range = financeSheet.getRange(2, 1, lastRow - 1, 8);
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
    return { success: false, message: "Error getting data: " + error.message };
  }
}

function handleUpdateExpenses(e) {
  try {
    const updates = JSON.parse(e.parameter.data || "[]");
    if (updates.length === 0) {
      return { success: true, message: "No updates to save." };
    }

    const financeSheet = _getFinanceSheet();

    updates.forEach(update => {
      const row = update.row;
      if (row) {
        financeSheet.getRange(row, 5).setValue(update.tripEvent); // Column 5 is Trip/Event
        financeSheet.getRange(row, 6).setValue(update.category);  // Column 6 is Category
      }
    });

    return { success: true, message: "Expenses updated successfully." };
  } catch (error) {
    console.error("Error updating expenses:", error);
    return { success: false, message: "Error updating expenses: " + error.message };
  }
}
