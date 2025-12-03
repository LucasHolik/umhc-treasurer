var Service_Split = {
  SPLIT_SHEET_NAME: "Split Transactions",
  
  processSplit: function(e) {
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      
      const data = JSON.parse(e.parameter.data);
      const original = data.original;
      const splits = data.splits;
      
      if (!original || !splits || splits.length < 2) {
        return { success: false, message: "Invalid split data." };
      }
      
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const financeSheet = ss.getSheetByName(CONFIG.SHEET_NAME);
      const splitSheet = _getSplitSheet(); // Use helper function
      
      // 1. Verify Original Transaction
      const rowIndex = parseInt(original.row); // 1-based row index from sheet
      if (isNaN(rowIndex) || rowIndex < 2) {
         return { success: false, message: "Invalid row index." };
      }
      
      // 2. Generate Group ID
      const splitGroupId = Utilities.getUuid();
      const splitDate = new Date();
      
      // 3. Update Original Row in Finance Sheet (Add ID)
      // CONFIG.HEADERS has "Split Group ID" at the end.
      const idIndex = CONFIG.HEADERS.indexOf("Split Group ID");
      if (idIndex === -1) {
          return { success: false, message: "Configuration Error: 'Split Group ID' column missing." };
      }
      
      // Update ONLY the Split Group ID cell
      financeSheet.getRange(rowIndex, idIndex + 1).setValue(splitGroupId);
      
      // 4. Archive to Split Sheet
      // We need the full row values to archive.
      // Get the row from Finance Sheet *after* update (or before and add ID)
      const originalRowRange = financeSheet.getRange(rowIndex, 1, 1, CONFIG.HEADERS.length);
      const originalRowValues = originalRowRange.getValues()[0];
      
      // Ensure ID is in values (it should be since we just set it, but getValues might be cached? safer to set it in array)
      originalRowValues[idIndex] = splitGroupId; 
      
      const archiveRows = [];
      
      // A. Source Row
      archiveRows.push([...originalRowValues, 'SOURCE', splitDate]);
      
      // B. Child Rows
      splits.forEach(split => {
          const childRow = [...originalRowValues];
          childRow[3] = split.Description; // Description
          
          // Update Tags if provided (otherwise they inherit from originalRowValues)
          // Trip/Event is index 4, Category is index 5
          if (split.TripEvent !== undefined) childRow[4] = split.TripEvent;
          if (split.Category !== undefined) childRow[5] = split.Category;

          const isIncome = !!originalRowValues[6]; // Income column
          if (isIncome) {
              childRow[6] = split.Amount;
              childRow[7] = "";
          } else {
              childRow[6] = "";
              childRow[7] = split.Amount;
          }
          
          archiveRows.push([...childRow, 'CHILD', splitDate]);
      });
      
      // Write to Split Sheet
      if (archiveRows.length > 0) {
          const startRow = splitSheet.getLastRow() + 1;
          splitSheet.getRange(startRow, 1, archiveRows.length, archiveRows[0].length).setValues(archiveRows);
      }
      
      return { success: true, message: "Transaction split successfully.", splitGroupId: splitGroupId };
      
    } catch (error) {
      console.error("Split error", error);
      return { success: false, message: "Error splitting transaction: " + error.message };
    } finally {
      lock.releaseLock();
    }
  },
  
  removeTagFromSplits: function(type, value) {
      const splitSheet = _getSplitSheet();
      const lastRow = splitSheet.getLastRow();
      if (lastRow <= 1) return { success: true, message: "No splits to check." };
      
      let colIndex; // 1-based column index
      if (type === "Trip/Event") colIndex = 5; // Index 4 -> Col 5
      else if (type === "Category") colIndex = 6; // Index 5 -> Col 6
      else return { success: false, message: "Invalid tag type." };
      
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
  },
  
  updateTagInSplits: function(oldTag, newTag, type) {
      const splitSheet = _getSplitSheet();
      const lastRow = splitSheet.getLastRow();
      if (lastRow <= 1) return { success: true, message: "No splits to check." };
      
      let colIndex; // 1-based column index
      if (type === "Trip/Event") colIndex = 5;
      else if (type === "Category") colIndex = 6;
      else return { success: false, message: "Invalid tag type." };
      
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
  },

  updateSplitRowTag: function(rowId, tripEvent, category) {
      const splitSheet = _getSplitSheet();
      
      // rowId format: "S-<rowIndex>"
      const rowIndex = parseInt(rowId.replace('S-', ''));
      
      if (isNaN(rowIndex) || rowIndex < 2) {
          return { success: false, message: "Invalid split row index." };
      }

      // Trip/Event is col 5, Category is col 6
      splitSheet.getRange(rowIndex, 5).setValue(tripEvent);
      splitSheet.getRange(rowIndex, 6).setValue(category);
      
      return { success: true };
  },
  
  revertSplit: function(e) {
      const lock = LockService.getScriptLock();
      try {
          lock.waitLock(10000);
          const groupId = e.parameter.groupId;
          if (!groupId) return { success: false, message: "No Group ID provided." };
          
          const ss = SpreadsheetApp.getActiveSpreadsheet();
          const financeSheet = ss.getSheetByName(CONFIG.SHEET_NAME);
          const splitSheet = _getSplitSheet(); // Use helper function
          
          const idIndex = CONFIG.HEADERS.indexOf("Split Group ID");
          
          // 1. Remove ID from Finance Sheet
          // We need to find the row with this ID.
          const financeData = financeSheet.getDataRange().getValues();
          let financeRowIndex = -1;
          
          // financeData is 0-indexed (row 1 is index 0). Row number is index + 1.
          // Skip header (index 0)
          for (let i = 1; i < financeData.length; i++) {
              if (financeData[i][idIndex] === groupId) {
                  financeRowIndex = i + 1;
                  break;
              }
          }
          
          if (financeRowIndex !== -1) {
              financeSheet.getRange(financeRowIndex, idIndex + 1).setValue("");
          }
          
          // 2. Remove from Split Sheet
          // We need to delete ALL rows with this Group ID.
          // Iterate backwards to delete safely.
          const splitData = splitSheet.getDataRange().getValues();
          const rowsToDelete = [];
          
          for (let i = splitData.length - 1; i >= 1; i--) {
              if (splitData[i][idIndex] === groupId) {
                  // Store row index (1-based)
                  rowsToDelete.push(i + 1);
              }
          }
          
          // Deleting individually is slow, but safest if not contiguous.
          // If we assume they are contiguous (appended together), we can delete a block.
          // But let's just delete individually for now to be safe.
          rowsToDelete.forEach(r => splitSheet.deleteRow(r));
          
          return { success: true, message: "Split reverted successfully." };
          
      } catch (error) {
          console.error("Revert error", error);
          return { success: false, message: "Error reverting split: " + error.message };
      } finally {
          lock.releaseLock();
      }
  },
  
  editSplit: function(e) {
     const groupId = e.parameter.groupId;
     
     // 1. Resolve Finance Sheet Row Index
     const ss = SpreadsheetApp.getActiveSpreadsheet();
     const financeSheet = ss.getSheetByName(CONFIG.SHEET_NAME);
     const idIndex = CONFIG.HEADERS.indexOf("Split Group ID");
     
     if (idIndex === -1) {
         return { success: false, message: "Configuration Error: 'Split Group ID' column missing." };
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
         return { success: false, message: "Original transaction not found in Finance Sheet for ID: " + groupId };
     }

     // 2. Inject Row Index into Data Payload
     try {
        const data = JSON.parse(e.parameter.data);
        data.original.row = financeRowIndex;
        e.parameter.data = JSON.stringify(data);
     } catch (err) {
        return { success: false, message: "Invalid JSON data." };
     }
     
     // 3. Perform Revert (Clean up old split artifacts)
     const revertRes = this.revertSplit(e);
     if (!revertRes.success) return revertRes;
     
     // 4. Perform Process (New Split)
     return this.processSplit(e);
  },
  
  getSplitGroup: function(e) {
     // Returns Source + Children for a specific Group ID from the Split Sheet
     const groupId = e.parameter.groupId;
     const ss = SpreadsheetApp.getActiveSpreadsheet();
     const splitSheet = _getSplitSheet(); // Use helper function
     
     const data = splitSheet.getDataRange().getValues();
     if (data.length < 2) return { success: false, message: "Split group not found." };

     const headers = data[0];
     const idIndex = headers.indexOf("Split Group ID");
     const typeIndex = headers.indexOf("Split Type");
     
     if (idIndex === -1 || typeIndex === -1) {
         return { success: false, message: "Split sheet corrupted: missing headers." };
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
                obj["Date"] = Utilities.formatDate(obj["Date"], "UTC", "yyyy-MM-dd");
             }
             
             if (row[typeIndex] === 'SOURCE') {
                 source = obj;
             } else if (row[typeIndex] === 'CHILD') {
                 children.push(obj);
             }
         }
     }
     
     if (!source) return { success: false, message: "Split group not found." };
     
     return { success: true, data: { source, children } };
  },

  getSplitHistory: function(e) {
    const page = parseInt(e.parameter.page) || 1;
    const pageSize = parseInt(e.parameter.pageSize) || 500; // Default chunk size
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const splitSheet = _getSplitSheet(); // Use helper function
    
    const lastRow = splitSheet.getLastRow();
    if (lastRow <= 1) { // Check if there's any data beyond headers
        return { success: true, data: [], hasMore: false, total: 0 };
    }
    
    const totalRows = lastRow - 1; // Exclude header
    
    // Calculate indices
    // 1-based rows. Data starts at row 2.
    // Page 1: start 2, end 2 + 500 - 1
    const startRowIndex = (page - 1) * pageSize + 2;
    const numRows = Math.min(pageSize, (lastRow - startRowIndex + 1));
    
    if (numRows <= 0) {
         return { success: true, data: [], hasMore: false, total: totalRows };
    }
    
    // Get Headers first to map correctly
    const headers = splitSheet.getRange(1, 1, 1, splitSheet.getLastColumn()).getValues()[0];
    const values = splitSheet.getRange(startRowIndex, 1, numRows, splitSheet.getLastColumn()).getValues();
    const data = [];
    
    const typeIndex = headers.indexOf("Split Type");
    const dateIndex = headers.indexOf("Split Date");
    
    for (let i = 0; i < values.length; i++) {
        const row = values[i];
        const obj = {};
        const currentRowIndex = startRowIndex + i;
        
        obj.row = 'S-' + currentRowIndex; // Add unique Split Row ID

        // Map standard headers
        for (let h = 0; h < CONFIG.HEADERS.length; h++) {
            const headerName = CONFIG.HEADERS[h];
            const colIndex = headers.indexOf(headerName);
            if (colIndex !== -1) {
                obj[headerName] = row[colIndex];
            }
        }
        
        // Map split headers
        if (typeIndex !== -1) obj['Split Type'] = row[typeIndex];
        if (dateIndex !== -1) obj['Split Date'] = row[dateIndex];
        
        if (obj["Date"] instanceof Date) {
          obj["Date"] = Utilities.formatDate(obj["Date"], "UTC", "yyyy-MM-dd");
        }
        
        data.push(obj);
    }
    
    const hasMore = (startRowIndex + numRows - 1) < lastRow;
    
    return { success: true, data: data, hasMore: hasMore, total: totalRows, page: page };
  }
};

function _getSplitSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let splitSheet = spreadsheet.getSheetByName(Service_Split.SPLIT_SHEET_NAME);
  const expectedHeaders = [...CONFIG.HEADERS, "Split Type", "Split Date"];

  if (!splitSheet) {
    splitSheet = spreadsheet.insertSheet(Service_Split.SPLIT_SHEET_NAME);
    splitSheet.appendRow(expectedHeaders);
  } else {
    const lastRow = splitSheet.getLastRow();
    if (lastRow === 0) { // Empty sheet, just headers
      splitSheet.appendRow(expectedHeaders);
    } else {
      const currentHeadersRange = splitSheet.getRange(1, 1, 1, splitSheet.getLastColumn());
      const currentHeaders = currentHeadersRange.getValues()[0];

      // Check if current headers are a prefix of expected headers
      let headersAreConsistent = true;
      for (let i = 0; i < expectedHeaders.length; i++) {
        // If current headers are shorter, or a specific header doesn't match
        if (i >= currentHeaders.length || currentHeaders[i] !== expectedHeaders[i]) {
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
         splitSheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
      }
    }
  }
  return splitSheet;
}