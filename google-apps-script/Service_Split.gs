var Service_Split = {
  SPLIT_SHEET_NAME: "Split Transactions",

  /**
   * Processes a split transaction by archiving the original and creating child entries.
   * @param {Object} e - Event object with parameter.data containing JSON payload
   * @param {Object} e.parameter.data.original - Original transaction with row index
   * @param {Array} e.parameter.data.splits - Array of split transactions
   * @returns {Object} Response object with success, message, and optional splitGroupId
   */
  processSplit: function (e) {
    const lock = LockService.getScriptLock();
    let lockAcquired = false;
    try {
      if (!lock.tryLock(30000)) {
        return { success: false, message: "System is busy. Please try again." };
      }
      lockAcquired = true;

      if (!e || !e.parameter || !e.parameter.data) {
        return { success: false, message: "Missing request data." };
      }

      const data = JSON.parse(e.parameter.data);
      if (!data || !data.original || !data.splits) {
        return { success: false, message: "Invalid data structure." };
      }
      const original = data.original;
      const splits = data.splits;

      const financeSheet = _getFinanceSheet();
      const splitSheetRes = _getSplitSheet();
      if (!splitSheetRes.success) return splitSheetRes;
      const splitSheet = splitSheetRes.sheet;

      return _processSplitCore(financeSheet, splitSheet, original, splits);
    } catch (error) {
      console.error("Split error", error);
      return {
        success: false,
        message: "Error splitting transaction: " + error.message,
      };
    } finally {
      if (lockAcquired) {
        lock.releaseLock();
      }
    }
  },

  /**
   * Removes a specific tag from all split transactions.
   * @param {string} type - Type of tag ("Trip/Event" or "Category")
   * @param {string} value - Value of the tag to remove
   * @returns {Object} Response object with success and message
   */
  removeTagFromSplits: function (type, value) {
    const lock = LockService.getScriptLock();
    let lockAcquired = false;
    try {
      if (!lock.tryLock(30000)) {
        return { success: false, message: "System is busy. Please try again." };
      }
      lockAcquired = true;

      const splitSheetRes = _getSplitSheet();
      if (!splitSheetRes.success) return splitSheetRes;
      const splitSheet = splitSheetRes.sheet;
      const lastRow = splitSheet.getLastRow();
      if (lastRow <= 1)
        return { success: true, message: "No splits to check." };

      const configValidation = _validateConfig();
      if (!configValidation.success) return configValidation;

      let colIndex; // 1-based column index
      if (type === "Trip/Event") {
        const idx = CONFIG.HEADERS.indexOf("Trip/Event");
        if (idx === -1)
          return { success: false, message: "Trip/Event column not found." };
        colIndex = idx + 1;
      } else if (type === "Category") {
        const idx = CONFIG.HEADERS.indexOf("Category");
        if (idx === -1)
          return { success: false, message: "Category column not found." };
        colIndex = idx + 1;
      } else return { success: false, message: "Invalid tag type." };

      const range = splitSheet.getRange(2, colIndex, lastRow - 1, 1);
      const values = range.getValues();
      let changed = false;

      for (let i = 0; i < values.length; i++) {
        if (values[i][0] === value) {
          values[i][0] = "";
          changed = true;
        }
      }

      if (changed) {
        range.setValues(values);
      }
      return { success: true };
    } catch (error) {
      console.error("Remove tag error", error);
      return {
        success: false,
        message: "Error removing tag: " + error.message,
      };
    } finally {
      if (lockAcquired) {
        lock.releaseLock();
      }
    }
  },

  /**
   * Updates a specific tag in all split transactions.
   * @param {string} oldTag - The old tag value to be replaced
   * @param {string} newTag - The new tag value
   * @param {string} type - Type of tag ("Trip/Event" or "Category")
   * @returns {Object} Response object with success and message
   */
  updateTagInSplits: function (oldTag, newTag, type) {
    const lock = LockService.getScriptLock();
    let lockAcquired = false;
    try {
      if (!lock.tryLock(30000)) {
        return { success: false, message: "System is busy. Please try again." };
      }
      lockAcquired = true;

      const splitSheetRes = _getSplitSheet();
      if (!splitSheetRes.success) return splitSheetRes;
      const splitSheet = splitSheetRes.sheet;
      const lastRow = splitSheet.getLastRow();
      if (lastRow <= 1)
        return { success: true, message: "No splits to check." };

      const configValidation = _validateConfig();
      if (!configValidation.success) return configValidation;

      let colIndex; // 1-based column index
      if (type === "Trip/Event") {
        const idx = CONFIG.HEADERS.indexOf("Trip/Event");
        if (idx === -1)
          return { success: false, message: "Trip/Event column not found." };
        colIndex = idx + 1;
      } else if (type === "Category") {
        const idx = CONFIG.HEADERS.indexOf("Category");
        if (idx === -1)
          return { success: false, message: "Category column not found." };
        colIndex = idx + 1;
      } else return { success: false, message: "Invalid tag type." };

      const range = splitSheet.getRange(2, colIndex, lastRow - 1, 1);
      const values = range.getValues();
      let changed = false;

      for (let i = 0; i < values.length; i++) {
        if (values[i][0] === oldTag) {
          values[i][0] = newTag;
          changed = true;
        }
      }

      if (changed) {
        range.setValues(values);
      }
      return { success: true };
    } catch (error) {
      console.error("Update tag error", error);
      return {
        success: false,
        message: "Error updating tag: " + error.message,
      };
    } finally {
      if (lockAcquired) {
        lock.releaseLock();
      }
    }
  },

  /**
   * Updates tags for a specific split transaction row.
   * @param {string} rowId - The unique identifier for the split row (e.g., "S-2")
   * @param {string} tripEvent - The new Trip/Event tag value
   * @param {string} category - The new Category tag value
   * @returns {Object} Response object with success and message
   */
  updateSplitRowTag: function (rowId, tripEvent, category) {
    const lock = LockService.getScriptLock();
    let lockAcquired = false;
    try {
      if (!lock.tryLock(30000)) {
        return { success: false, message: "System is busy. Please try again." };
      }
      lockAcquired = true;

      const splitSheetRes = _getSplitSheet();
      if (!splitSheetRes.success) return splitSheetRes;
      const splitSheet = splitSheetRes.sheet;

      // rowId format: "S-<rowIndex>"
      const rowIndex = parseInt(rowId.replace("S-", ""), 10);

      if (
        isNaN(rowIndex) ||
        rowIndex < 2 ||
        rowIndex > splitSheet.getLastRow()
      ) {
        return { success: false, message: "Invalid split row index." };
      }

      const configValidation = _validateConfig();
      if (!configValidation.success) return configValidation;

      const tripEventIndex = CONFIG.HEADERS.indexOf("Trip/Event");
      const categoryIndex = CONFIG.HEADERS.indexOf("Category");

      if (tripEventIndex === -1 || categoryIndex === -1) {
        return {
          success: false,
          message:
            "Configuration Error: Required columns missing in CONFIG.HEADERS.",
        };
      }

      // Trip/Event is col tripEventIndex + 1, Category is col categoryIndex + 1
      splitSheet.getRange(rowIndex, tripEventIndex + 1).setValue(tripEvent);
      splitSheet.getRange(rowIndex, categoryIndex + 1).setValue(category);

      return { success: true };
    } catch (error) {
      console.error("Update split row tag error", error);
      return {
        success: false,
        message: "Error updating split row tag: " + error.message,
      };
    } finally {
      if (lockAcquired) {
        lock.releaseLock();
      }
    }
  },

  /**
   * Reverts a split transaction, removing child entries and clearing the split ID from the original.
   * @param {Object} e - Event object with parameter.groupId containing the split group ID
   * @returns {Object} Response object with success and message
   */
  revertSplit: function (e) {
    const lock = LockService.getScriptLock();
    let lockAcquired = false;
    try {
      if (!lock.tryLock(30000)) {
        return { success: false, message: "System is busy. Please try again." };
      }
      lockAcquired = true;
      const groupId = e.parameter.groupId;
      if (!groupId) return { success: false, message: "No Group ID provided." };

      const financeSheet = _getFinanceSheet();
      const splitSheetRes = _getSplitSheet();
      if (!splitSheetRes.success) return splitSheetRes;
      const splitSheet = splitSheetRes.sheet;

      return _revertSplitCore(financeSheet, splitSheet, groupId);
    } catch (error) {
      console.error("Revert error", error);
      return {
        success: false,
        message: "Error reverting split: " + error.message,
      };
    } finally {
      if (lockAcquired) {
        lock.releaseLock();
      }
    }
  },

  /**
   * Edits an existing split transaction by reverting the old one and processing the new one.
   * @param {Object} e - Event object with parameter.groupId and parameter.data (new split data)
   * @returns {Object} Response object with success, message, and optional splitGroupId
   */
  editSplit: function (e) {
    const lock = LockService.getScriptLock();
    let lockAcquired = false;
    try {
      if (!lock.tryLock(30000)) {
        return { success: false, message: "System is busy. Please try again." };
      }
      lockAcquired = true;

      const groupId = e.parameter.groupId;

      // 1. Resolve Finance Sheet Row Index
      const financeSheet = _getFinanceSheet();
      const configValidation = _validateConfig();
      if (!configValidation.success) return configValidation;
      const idIndex = CONFIG.HEADERS.indexOf("Split Group ID");

      if (idIndex === -1) {
        return {
          success: false,
          message: "Configuration Error: 'Split Group ID' column missing.",
        };
      }

      const financeData = financeSheet.getDataRange().getValues();
      let financeRowIndex = -1;

      // Skip header (index 0), row 1 is index 0 in array but Row 1 in sheet
      for (let i = 1; i < financeData.length; i++) {
        if (financeData[i][idIndex] === groupId) {
          financeRowIndex = i + 1; // 1-based index
          break;
        }
      }

      if (financeRowIndex === -1) {
        return {
          success: false,
          message:
            "Original transaction not found in Finance Sheet for ID: " +
            groupId,
        };
      }

      // 2. Inject Row Index into Data Payload
      if (!e || !e.parameter || !e.parameter.data) {
        return { success: false, message: "Missing request data." };
      }

      let data;
      try {
        data = JSON.parse(e.parameter.data);
        data.original.row = financeRowIndex;
      } catch (err) {
        return { success: false, message: "Invalid JSON data." };
      }

      // 3. Prepare New Split Data (VALIDATION & PREPARATION)
      // This step ensures we can successfully generate the new split data BEFORE destroying the old data.
      const splitSheetRes = _getSplitSheet();
      if (!splitSheetRes.success) return splitSheetRes;
      const splitSheet = splitSheetRes.sheet;

      const preparation = _prepareSplitData(
        financeSheet,
        data.original,
        data.splits
      );

      if (!preparation.success) {
        return preparation;
      }

      // 4. Capture existing split data for potential rollback
      const existingSplitData = _getSplitGroupData(splitSheet, groupId);

      // 5. Perform Revert (Clean up old split artifacts)
      // Now that preparation succeeded, we can safely remove the old data.
      const revertRes = _revertSplitCore(
        financeSheet,
        splitSheet,
        groupId,
        financeRowIndex
      );
      if (!revertRes.success) return revertRes;

      // 6. Perform Process (Write New Split)
      // Writing the prepared data.
      const writeRes = _writeSplitData(financeSheet, splitSheet, preparation);

      if (writeRes.success) {
        return {
          success: true,
          message: "Transaction split edited successfully.",
          splitGroupId: writeRes.splitGroupId,
        };
      } else {
        // Attempt to restore the old split data if write fails
        try {
          _restoreSplitData(
            financeSheet,
            splitSheet,
            existingSplitData,
            groupId,
            financeRowIndex
          );
        } catch (restoreError) {
          console.error(
            "Failed to restore split data after write failure",
            restoreError
          );
        }
        return writeRes;
      }
    } catch (error) {
      console.error("Edit split error", error);
      return {
        success: false,
        message: "Error editing split: " + error.message,
      };
    } finally {
      if (lockAcquired) {
        lock.releaseLock();
      }
    }
  },

  /**
   * Retrieves a split group (source transaction and child splits) by ID.
   * @param {Object} e - Event object with parameter.groupId
   * @returns {Object} Response object with success and data {source, children}
   */
  getSplitGroup: function (e) {
    const lock = LockService.getScriptLock();
    let lockAcquired = false;
    try {
      if (!lock.tryLock(30000)) {
        return { success: false, message: "System is busy. Please try again." };
      }
      lockAcquired = true;

      // Returns Source + Children for a specific Group ID from the Split Sheet
      const groupId = e.parameter.groupId;
      const splitSheetRes = _getSplitSheet(); // Use helper function
      if (!splitSheetRes.success) return splitSheetRes;
      const splitSheet = splitSheetRes.sheet;

      const data = splitSheet.getDataRange().getValues();
      if (data.length < 2)
        return { success: false, message: "Split group not found." };

      const configValidation = _validateConfig();
      if (!configValidation.success) return configValidation;

      const headers = data[0];
      const idIndex = headers.indexOf("Split Group ID");
      const typeIndex = headers.indexOf("Split Type");
      const dateIndex = headers.indexOf("Split Date");

      if (idIndex === -1 || typeIndex === -1) {
        return {
          success: false,
          message: "Split sheet corrupted: missing headers.",
        };
      }

      let source = null;
      const children = [];

      for (let i = 1; i < data.length; i++) {
        if (data[i][idIndex] === groupId) {
          const row = data[i];
          const obj = {};

          // Map based on CONFIG.HEADERS if present in sheet headers
          CONFIG.HEADERS.forEach((header) => {
            const hIndex = headers.indexOf(header);
            if (hIndex !== -1) {
              obj[header] = row[hIndex];
            }
          });

          if (obj["Date"] instanceof Date) {
            const tz = splitSheet.getParent().getSpreadsheetTimeZone();
            obj["Date"] = Utilities.formatDate(obj["Date"], tz, "yyyy-MM-dd");
          }

          // Map split headers
          if (typeIndex !== -1) obj["Split Type"] = row[typeIndex];
          if (dateIndex !== -1) {
            let sDate = row[dateIndex];
            if (sDate instanceof Date) {
              const tz = splitSheet.getParent().getSpreadsheetTimeZone();
              sDate = Utilities.formatDate(sDate, tz, "yyyy-MM-dd HH:mm:ss");
            }
            obj["Split Date"] = sDate;
          }

          if (row[typeIndex] === "SOURCE") {
            source = obj;
          } else if (row[typeIndex] === "CHILD") {
            children.push(obj);
          }
        }
      }

      if (!source) return { success: false, message: "Split group not found." };

      return { success: true, data: { source, children } };
    } catch (error) {
      console.error("Get split group error", error);
      return {
        success: false,
        message: "Error fetching split group: " + error.message,
      };
    } finally {
      if (lockAcquired) {
        lock.releaseLock();
      }
    }
  },

  /**
   * Retrieves a paginated history of split transactions.
   * @param {Object} e - Event object with parameter.page and parameter.pageSize
   * @returns {Object} Response object with success, data array, pagination info
   */
  getSplitHistory: function (e) {
    const lock = LockService.getScriptLock();
    let lockAcquired = false;
    try {
      if (!lock.tryLock(30000)) {
        return { success: false, message: "System is busy. Please try again." };
      }
      lockAcquired = true;

      const page = parseInt(e.parameter.page) || 1;
      const pageSize = parseInt(e.parameter.pageSize) || 500; // Default chunk size

      const splitSheetRes = _getSplitSheet(); // Use helper function
      if (!splitSheetRes.success) return splitSheetRes;
      const splitSheet = splitSheetRes.sheet;

      const lastRow = splitSheet.getLastRow();
      if (lastRow <= 1) {
        // Check if there's any data beyond headers
        return { success: true, data: [], hasMore: false, total: 0 };
      }

      const totalRows = lastRow - 1; // Exclude header

      // Calculate indices
      // 1-based rows. Data starts at row 2.
      // Page 1: start 2, end 2 + 500 - 1
      const startRowIndex = (page - 1) * pageSize + 2;
      const numRows = Math.min(pageSize, lastRow - startRowIndex + 1);

      if (numRows <= 0) {
        return { success: true, data: [], hasMore: false, total: totalRows };
      }

      const configValidation = _validateConfig();
      if (!configValidation.success) return configValidation;

      // Get Headers first to map correctly
      const headers = splitSheet
        .getRange(1, 1, 1, splitSheet.getLastColumn())
        .getValues()[0];
      const values = splitSheet
        .getRange(startRowIndex, 1, numRows, splitSheet.getLastColumn())
        .getValues();
      const data = [];

      const typeIndex = headers.indexOf("Split Type");
      const dateIndex = headers.indexOf("Split Date");

      for (let i = 0; i < values.length; i++) {
        const row = values[i];
        const obj = {};
        const currentRowIndex = startRowIndex + i;

        obj.row = "S-" + currentRowIndex; // Add unique Split Row ID

        // Map standard headers
        for (let h = 0; h < CONFIG.HEADERS.length; h++) {
          const headerName = CONFIG.HEADERS[h];
          const colIndex = headers.indexOf(headerName);
          if (colIndex !== -1) {
            obj[headerName] = row[colIndex];
          }
        }

        // Map split headers
        if (typeIndex !== -1) obj["Split Type"] = row[typeIndex];
        if (dateIndex !== -1) {
          let sDate = row[dateIndex];
          if (sDate instanceof Date) {
            const tz = splitSheet.getParent().getSpreadsheetTimeZone();
            sDate = Utilities.formatDate(sDate, tz, "yyyy-MM-dd HH:mm:ss");
          }
          obj["Split Date"] = sDate;
        }

        if (obj["Date"] instanceof Date) {
          const tz = splitSheet.getParent().getSpreadsheetTimeZone();
          obj["Date"] = Utilities.formatDate(obj["Date"], tz, "yyyy-MM-dd");
        }

        data.push(obj);
      }

      const hasMore = startRowIndex + numRows - 1 < lastRow;

      return {
        success: true,
        data: data,
        hasMore: hasMore,
        total: totalRows,
        page: page,
      };
    } catch (error) {
      console.error("Get split history error", error);
      return {
        success: false,
        message: "Error fetching split history: " + error.message,
      };
    } finally {
      if (lockAcquired) {
        lock.releaseLock();
      }
    }
  },

  /**
   * Retrieves the complete history of all split transactions.
   * @returns {Object} Response object with success and data array
   */
  getAllSplitHistory: function () {
    const lock = LockService.getScriptLock();
    let lockAcquired = false;
    try {
      if (!lock.tryLock(30000)) {
        return { success: false, message: "System is busy. Please try again." };
      }
      lockAcquired = true;

      const splitSheetRes = _getSplitSheet();
      if (!splitSheetRes.success) return splitSheetRes;
      const splitSheet = splitSheetRes.sheet;

      const lastRow = splitSheet.getLastRow();
      if (lastRow <= 1) {
        return { success: true, data: [] };
      }

      const configValidation = _validateConfig();
      if (!configValidation.success) return configValidation;

      const headers = splitSheet
        .getRange(1, 1, 1, splitSheet.getLastColumn())
        .getValues()[0];
      const values = splitSheet
        .getRange(2, 1, lastRow - 1, splitSheet.getLastColumn())
        .getValues();
      const data = [];

      const typeIndex = headers.indexOf("Split Type");
      const dateIndex = headers.indexOf("Split Date");

      for (let i = 0; i < values.length; i++) {
        const row = values[i];
        const obj = {};
        const currentRowIndex = i + 2; // Data starts at row 2, so add 2

        obj.row = "S-" + currentRowIndex; // Add unique Split Row ID

        // Map standard headers
        for (let h = 0; h < CONFIG.HEADERS.length; h++) {
          const headerName = CONFIG.HEADERS[h];
          const colIndex = headers.indexOf(headerName);
          if (colIndex !== -1) {
            obj[headerName] = row[colIndex];
          }
        }

        // Map split headers
        if (typeIndex !== -1) obj["Split Type"] = row[typeIndex];
        if (dateIndex !== -1) {
          let sDate = row[dateIndex];
          if (sDate instanceof Date) {
            const tz = splitSheet.getParent().getSpreadsheetTimeZone();
            sDate = Utilities.formatDate(sDate, tz, "yyyy-MM-dd HH:mm:ss");
          }
          obj["Split Date"] = sDate;
        }

        if (obj["Date"] instanceof Date) {
          const tz = splitSheet.getParent().getSpreadsheetTimeZone();
          obj["Date"] = Utilities.formatDate(obj["Date"], tz, "yyyy-MM-dd");
        }

        data.push(obj);
      }

      return { success: true, data: data };
    } catch (error) {
      console.error("Get all split history error", error);
      return {
        success: false,
        message: "Error fetching all split history: " + error.message,
      };
    } finally {
      if (lockAcquired) {
        lock.releaseLock();
      }
    }
  },
};

// --- HELPER FUNCTIONS (Internal) ---

function _validateConfig() {
  if (
    typeof CONFIG === "undefined" ||
    !CONFIG ||
    !CONFIG.HEADERS ||
    !Array.isArray(CONFIG.HEADERS)
  ) {
    return {
      success: false,
      message: "Configuration error: CONFIG.HEADERS not defined.",
    };
  }
  return { success: true };
}

function _getSplitSheet() {
  const configValidation = _validateConfig();
  if (!configValidation.success) return configValidation;
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let splitSheet = spreadsheet.getSheetByName(Service_Split.SPLIT_SHEET_NAME);
  const expectedHeaders = [...CONFIG.HEADERS, "Split Type", "Split Date"];

  if (!splitSheet) {
    splitSheet = spreadsheet.insertSheet(Service_Split.SPLIT_SHEET_NAME);
    splitSheet.appendRow(expectedHeaders);
  } else {
    const lastRow = splitSheet.getLastRow();
    if (lastRow === 0) {
      // Empty sheet, just headers
      splitSheet.appendRow(expectedHeaders);
    } else {
      const currentHeadersRange = splitSheet.getRange(
        1,
        1,
        1,
        splitSheet.getLastColumn()
      );
      const currentHeaders = currentHeadersRange.getValues()[0];

      // Check if current headers are a prefix of expected headers
      let headersAreConsistent = true;
      for (let i = 0; i < expectedHeaders.length; i++) {
        // If current headers are shorter, or a specific header doesn't match
        if (
          i >= currentHeaders.length ||
          currentHeaders[i] !== expectedHeaders[i]
        ) {
          headersAreConsistent = false;
          break;
        }
      }

      // Also check if current headers are too long (contain extra columns not in expectedHeaders)
      if (currentHeaders.length > expectedHeaders.length) {
        headersAreConsistent = false;
      }

      // If headers don't match, update them
      if (!headersAreConsistent) {
        // Clear old headers and set new ones
        // Use clearContent() to remove any extra columns not in expectedHeaders
        splitSheet.getRange(1, 1, 1, splitSheet.getLastColumn()).clearContent();
        splitSheet
          .getRange(1, 1, 1, expectedHeaders.length)
          .setValues([expectedHeaders]);
      }
    }
  }
  return { success: true, sheet: splitSheet };
}

// --- HELPER FUNCTIONS (Internal) ---

function _validateSplitRequest(original, splits) {
  const configValidation = _validateConfig();
  if (!configValidation.success) return configValidation;

  if (!original || !splits || !Array.isArray(splits) || splits.length < 2) {
    return { success: false, message: "Invalid split data." };
  }

  for (let i = 0; i < splits.length; i++) {
    const split = splits[i];
    if (
      !split.Description ||
      split.Amount === undefined ||
      split.Amount === null ||
      split.Amount === ""
    ) {
      return {
        success: false,
        message: "Each split must have a description and amount.",
      };
    }
  }

  const rowIndex = parseInt(original.row);
  if (isNaN(rowIndex) || rowIndex < 2) {
    return { success: false, message: "Invalid row index." };
  }

  // Validate split amounts sum to original
  const incomeVal =
    original.Income != null && original.Income !== ""
      ? parseFloat(original.Income)
      : null;
  const expenseVal =
    original.Expense != null && original.Expense !== ""
      ? parseFloat(original.Expense)
      : null;
  const originalAmount =
    incomeVal !== null ? incomeVal : expenseVal !== null ? expenseVal : 0;

  const splitSum = splits.reduce(
    (sum, split) => sum + parseFloat(split.Amount || 0),
    0
  );
  const tolerance = 0.01; // Allow for rounding errors

  if (Math.abs(originalAmount - splitSum) > tolerance) {
    return {
      success: false,
      message: `Split amounts (${splitSum.toFixed(
        2
      )}) must sum to original amount (${originalAmount.toFixed(2)}).`,
    };
  }

  const idIndex = CONFIG.HEADERS.indexOf("Split Group ID");
  const descIndex = CONFIG.HEADERS.indexOf("Description");
  const tripEventIndex = CONFIG.HEADERS.indexOf("Trip/Event");
  const categoryIndex = CONFIG.HEADERS.indexOf("Category");
  const incomeIndex = CONFIG.HEADERS.indexOf("Income");
  const expenseIndex = CONFIG.HEADERS.indexOf("Expense");

  if (
    idIndex === -1 ||
    descIndex === -1 ||
    tripEventIndex === -1 ||
    categoryIndex === -1 ||
    incomeIndex === -1 ||
    expenseIndex === -1
  ) {
    return {
      success: false,
      message:
        "Configuration Error: Required columns missing in CONFIG.HEADERS.",
    };
  }

  return { success: true };
}

function _revertSplitCore(financeSheet, splitSheet, groupId, financeRowIndex) {
  const configValidation = _validateConfig();
  if (!configValidation.success) return configValidation;
  const idIndex = CONFIG.HEADERS.indexOf("Split Group ID");
  if (idIndex === -1) {
    return {
      success: false,
      message: "Configuration Error: 'Split Group ID' column missing.",
    };
  }

  // 1. Remove ID from Finance Sheet
  if (!financeRowIndex || financeRowIndex === -1) {
    const financeData = financeSheet.getDataRange().getValues();
    financeRowIndex = -1;

    for (let i = 1; i < financeData.length; i++) {
      if (financeData[i][idIndex] === groupId) {
        financeRowIndex = i + 1;
        break;
      }
    }
  }

  if (financeRowIndex !== -1) {
    financeSheet.getRange(financeRowIndex, idIndex + 1).setValue("");
  }

  // 2. Remove from Split Sheet
  const splitData = splitSheet.getDataRange().getValues();
  const rowsToDelete = [];

  for (let i = splitData.length - 1; i >= 1; i--) {
    if (splitData[i][idIndex] === groupId) {
      rowsToDelete.push(i + 1);
    }
  }

  // Rows are collected in descending order (highest index first) due to the backward iteration above.
  // Deleting rows from bottom to top prevents index shifting from affecting subsequent deletions.

  for (const rowIndex of rowsToDelete) {
    splitSheet.deleteRow(rowIndex);
  }

  return { success: true, message: "Split reverted successfully." };
}

function _processSplitCore(financeSheet, splitSheet, original, splits) {
  // 1. Prepare Data
  const preparation = _prepareSplitData(financeSheet, original, splits);
  if (!preparation.success) return preparation;

  // 2. Write Data
  return _writeSplitData(financeSheet, splitSheet, preparation);
}

function _prepareSplitData(financeSheet, original, splits) {
  const validation = _validateSplitRequest(original, splits);
  if (!validation.success) return validation;

  const rowIndex = parseInt(original.row);
  const splitGroupId = Utilities.getUuid();
  const splitDate = new Date();

  const idIndex = CONFIG.HEADERS.indexOf("Split Group ID");
  const descIndex = CONFIG.HEADERS.indexOf("Description");
  const tripEventIndex = CONFIG.HEADERS.indexOf("Trip/Event");
  const categoryIndex = CONFIG.HEADERS.indexOf("Category");
  const incomeIndex = CONFIG.HEADERS.indexOf("Income");
  const expenseIndex = CONFIG.HEADERS.indexOf("Expense");

  // Get Finance Sheet Row Data
  const originalRowRange = financeSheet.getRange(
    rowIndex,
    1,
    1,
    CONFIG.HEADERS.length
  );
  const originalRowValues = originalRowRange.getValues()[0];

  // Update ID in the in-memory array for archive rows
  originalRowValues[idIndex] = splitGroupId;

  const archiveRows = [];
  archiveRows.push([...originalRowValues, "SOURCE", splitDate]);

  splits.forEach((split) => {
    const childRow = [...originalRowValues];
    childRow[descIndex] = split.Description;
    if (split.TripEvent !== undefined)
      childRow[tripEventIndex] = split.TripEvent;
    if (split.Category !== undefined) childRow[categoryIndex] = split.Category;

    const isIncome =
      originalRowValues[incomeIndex] != null &&
      originalRowValues[incomeIndex] !== "";
    if (isIncome) {
      childRow[incomeIndex] = split.Amount;
      childRow[expenseIndex] = "";
    } else {
      childRow[incomeIndex] = "";
      childRow[expenseIndex] = split.Amount;
    }
    archiveRows.push([...childRow, "CHILD", splitDate]);
  });

  return {
    success: true,
    splitGroupId: splitGroupId,
    rowIndex: rowIndex,
    archiveRows: archiveRows,
    idIndex: idIndex,
  };
}

function _writeSplitData(financeSheet, splitSheet, preparation) {
  let rowsWritten = false;
  let startRow = 0;
  let numRows = 0;

  try {
    const { splitGroupId, rowIndex, archiveRows, idIndex } = preparation;

    if (archiveRows.length > 0) {
      startRow = splitSheet.getLastRow() + 1;
      numRows = archiveRows.length;

      splitSheet
        .getRange(startRow, 1, numRows, archiveRows[0].length)
        .setValues(archiveRows);

      rowsWritten = true;
    }

    // Update Finance Sheet with new ID (after split sheet succeeds)
    financeSheet.getRange(rowIndex, idIndex + 1).setValue(splitGroupId);

    return {
      success: true,
      message: "Transaction split successfully.",
      splitGroupId: splitGroupId,
    };
  } catch (error) {
    console.error("Write split data error", error);

    // Rollback: Remove orphaned rows from split sheet if they were written
    if (rowsWritten && numRows > 0) {
      try {
        console.warn(
          `Rolling back split sheet write. Deleting ${numRows} rows starting at ${startRow}.`
        );
        splitSheet.deleteRows(startRow, numRows);
      } catch (rollbackError) {
        console.error("Rollback failed:", rollbackError);
        return {
          success: false,
          message:
            "Error writing split data: " +
            error.message +
            ". CRITICAL: Rollback also failed: " +
            rollbackError.message,
        };
      }
    }

    return {
      success: false,
      message: "Error writing split data: " + error.message,
    };
  }
}

/**
 * Retrieves raw row data for a split group from the Split Sheet.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} splitSheet
 * @param {string} groupId
 * @returns {Array<Array>} Array of row values
 */
function _getSplitGroupData(splitSheet, groupId) {
  const data = splitSheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const headers = data[0];
  const idIndex = headers.indexOf("Split Group ID");
  if (idIndex === -1) return [];

  const groupRows = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIndex] === groupId) {
      groupRows.push(data[i]);
    }
  }
  return groupRows;
}

/**
 * Restores split data from captured row values.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} financeSheet
 * @param {GoogleAppsScript.Spreadsheet.Sheet} splitSheet
 * @param {Array<Array>} existingSplitData
 * @param {string} groupId
 * @param {number} financeRowIndex
 */
function _restoreSplitData(
  financeSheet,
  splitSheet,
  existingSplitData,
  groupId,
  financeRowIndex
) {
  if (existingSplitData && existingSplitData.length > 0) {
    const lastRow = splitSheet.getLastRow();
    splitSheet
      .getRange(
        lastRow + 1,
        1,
        existingSplitData.length,
        existingSplitData[0].length
      )
      .setValues(existingSplitData);
  }

  if (financeRowIndex && financeRowIndex !== -1) {
    const idIndex = CONFIG.HEADERS.indexOf("Split Group ID");
    if (idIndex !== -1) {
      financeSheet.getRange(financeRowIndex, idIndex + 1).setValue(groupId);
    }
  }
}
