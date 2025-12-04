var Service_Tags = {
  getTags: function() {
    return _getTags();
  },

  addTag: function(type, value, extraData) {
    return _addTag(type, value, false, extraData);
  },

  deleteTag: function(e) {
    const type = e.parameter.type;
    const value = e.parameter.value;
    const deleteResult = _deleteTag(type, value);
    if (deleteResult.success) {
      Service_Sheet.removeTagFromExpenses(type, value);
      Service_Split.removeTagFromSplits(type, value);
    }
    return deleteResult;
  },

  renameTag: function(e) {
    const type = e.parameter.type;
    const oldValue = e.parameter.oldValue;
    const newValue = e.parameter.newValue;
    return _renameTag(type, oldValue, newValue);
  },

  processTagOperations: function(e) {
    try {
      const operationsParam = e.parameter.operations;
      if (!operationsParam) {
        return { success: false, message: "No operations parameter provided" };
      }
      const operations = JSON.parse(operationsParam);
      return _processTagOperations(operations);
    } catch (error) {
      console.error("Error processing tag operations:", error);
      return { success: false, message: "Error processing tag operations: " + error.message };
    }
  }
};

function _getTagSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let tagSheet = spreadsheet.getSheetByName("Tags");
  
  if (!tagSheet) {
    tagSheet = spreadsheet.insertSheet("Tags");
    tagSheet.appendRow(["Trip/Event", "Type", "Category", "Type List"]);
    return tagSheet;
  }

  return tagSheet;
}

function _getTags() {
  const tagSheet = _getTagSheet();
  const lastRow = tagSheet.getLastRow();
  
  if (lastRow < 2) {
    return { "Trip/Event": [], "Category": [], "Type": [], "TripTypeMap": {} };
  }
  
  // Get all data at once for efficiency
  const data = tagSheet.getRange(2, 1, lastRow - 1, 4).getValues();
  
  const tripEventTags = [];
  const tripTypeMap = {};
  const categoryTags = [];
  const typeTags = [];
  
  data.forEach(row => {
      // Col A: Trip/Event
      if (row[0]) {
          tripEventTags.push(String(row[0]));
          // Col B: Type (associated with Trip/Event)
          if (row[1]) {
              tripTypeMap[String(row[0])] = String(row[1]);
          }
      }
      
      // Col C: Category
      if (row[2]) {
          categoryTags.push(String(row[2]));
      }
      
      // Col D: Type List
      if (row[3]) {
          typeTags.push(String(row[3]));
      }
  });

  return {
    "Trip/Event": tripEventTags,
    "Category": categoryTags,
    "Type": typeTags,
    "TripTypeMap": tripTypeMap
  };
}

function _addTag(type, value, skipSort, extraData) {
  const tagSheet = _getTagSheet();
  const lastRow = tagSheet.getLastRow();
  let column;

  if (type === "Trip/Event") {
    column = 1;
  } else if (type === "Category") {
    column = 3; // Changed from 2
  } else if (type === "Type") {
    column = 4;
  } else {
    return { success: false, message: "Invalid tag type." };
  }

  let existingTags = [];
  if (lastRow > 1) {
    existingTags = tagSheet
      .getRange(2, column, lastRow - 1, 1)
      .getValues()
      .flat()
      .map(String);
      
    if (existingTags.includes(value)) {
      return { success: false, message: "Tag already exists." };
    }
  }

  const columnValues = tagSheet.getRange(1, column, Math.max(lastRow, 1), 1).getValues();
  let nextEmptyRow = columnValues.length + 1;
  
  // Find first empty cell in column
  for (let i = 1; i <= columnValues.length; i++) {
      if (!columnValues[i-1][0]) {
          nextEmptyRow = i;
          break;
      }
  }

  tagSheet.getRange(nextEmptyRow, column).setValue(value);

  // If adding a Trip/Event, we must set its Type (or clear it) to maintain 1:1 alignment
  if (type === "Trip/Event") {
      const typeValue = extraData || "";
      tagSheet.getRange(nextEmptyRow, 2).setValue(typeValue);
  }

  if (!skipSort) {
    _sortTags(type);
  }

  return { success: true, message: "Tag added successfully." };
}

function _deleteTag(type, value) {
  const tagSheet = _getTagSheet();
  const lastRow = tagSheet.getLastRow();
  let column;

  if (type === "Trip/Event") {
    column = 1;
  } else if (type === "Category") {
    column = 3;
  } else if (type === "Type") {
    column = 4;
  } else {
    return { success: false, message: "Invalid tag type." };
  }

  if (lastRow < 2) {
    return { success: false, message: "No tags to delete." };
  }

  const tagsRange = tagSheet.getRange(2, column, lastRow - 1, 1);
  const tags = tagsRange.getValues().flat().map(String);
  const tagIndex = tags.indexOf(value);

  if (tagIndex === -1) {
    return { success: false, message: "Tag not found." };
  }

  const deleteRow = tagIndex + 2;

  if (type === "Trip/Event") {
      // If deleting Trip/Event, we should also clear the Type in Col B for that row
      // Or rather, since we are moving cells up, we must move Col A AND Col B together.
      
      if (deleteRow < lastRow) {
          const rangeToMove = tagSheet.getRange(deleteRow + 1, 1, lastRow - deleteRow, 2); // A and B
          rangeToMove.copyTo(tagSheet.getRange(deleteRow, 1));
          // Clear last row of A and B
          tagSheet.getRange(lastRow, 1, 1, 2).clearContent();
      } else {
          tagSheet.getRange(deleteRow, 1, 1, 2).clearContent();
      }
  } else {
      // For Category (C) and Type (D), we just move that column
      if (deleteRow < lastRow) {
        const rangeToMove = tagSheet.getRange(
          deleteRow + 1,
          column,
          lastRow - deleteRow,
          1
        );
        rangeToMove.moveTo(tagSheet.getRange(deleteRow, column));
      } else {
        tagSheet.getRange(deleteRow, column).clearContent();
      }
  }

  return { success: true, message: "Tag deleted successfully." };
}

function _renameTag(type, oldValue, newValue, skipSort) {
  const tagSheet = _getTagSheet();
  const lastRow = tagSheet.getLastRow();
  let column;

  if (type === "Trip/Event") {
    column = 1;
  } else if (type === "Category") {
    column = 3;
  } else if (type === "Type") {
    column = 4;
  } else {
    return { success: false, message: "Invalid tag type." };
  }

  if (lastRow < 2) {
    return { success: false, message: "No tags to rename." };
  }

  const tagsRange = tagSheet.getRange(2, column, lastRow - 1, 1);
  const tags = tagsRange.getValues().flat().map(String);
  if (tags.includes(newValue)) {
    return { success: false, message: "New tag value already exists." };
  }

  const tagIndex = tags.indexOf(oldValue);
  if (tagIndex === -1) {
    return { success: false, message: "Old tag value not found." };
  }

  const updateRow = tagIndex + 2;
  tagSheet.getRange(updateRow, column).setValue(newValue);
  
  // If renaming a "Type" (master list), we should update all Trip/Events (Col B) that use this type
  if (type === "Type") {
       const tripTypesRange = tagSheet.getRange(2, 2, lastRow - 1, 1);
       const tripTypes = tripTypesRange.getValues();
       let updated = false;
       const newTripTypes = tripTypes.map(r => {
           if (r[0] === oldValue) {
               updated = true;
               return [newValue];
           }
           return r;
       });
       if (updated) {
           tripTypesRange.setValues(newTripTypes);
       }
  }

  Service_Sheet.updateExpensesWithTag(oldValue, newValue, type);
  Service_Split.updateTagInSplits(oldValue, newValue, type);

  if (!skipSort) {
    _sortTags(type);
  }

  return { success: true, message: "Tag renamed successfully." };
}

function _updateTripType(tripName, typeName) {
    const tagSheet = _getTagSheet();
    const lastRow = tagSheet.getLastRow();
    
    // Find the Trip/Event in Col A
    const tripRange = tagSheet.getRange(2, 1, lastRow - 1, 1);
    const trips = tripRange.getValues().flat().map(String);
    const index = trips.indexOf(tripName);
    
    if (index === -1) {
        return { success: false, message: "Trip/Event not found." };
    }
    
    // Update Col B at row index+2
    tagSheet.getRange(index + 2, 2).setValue(typeName);
    return { success: true, message: "Trip type updated." };
}

function _processTagOperations(operations) {
  if (!operations || !Array.isArray(operations)) {
    return { success: false, message: "Invalid operations array" };
  }

  const modifiedTypes = new Set();

  for (let i = 0; i < operations.length; i++) {
    const operation = operations[i];
    // [oldValue, newValue, operationType, tagType]
    
    if (!Array.isArray(operation) || operation.length !== 4) {
      return { success: false, message: `Invalid operation at index ${i}` };
    }

    const [rawOldValue, rawNewValue, operationType, tagType] = operation;
    
    // Ensure values are strings to match sheet data (which is forced to string)
    const oldValue = rawOldValue !== null ? String(rawOldValue) : null;
    const newValue = rawNewValue !== null ? String(rawNewValue) : null;

    let result;
    switch (operationType) {
      case "add":
        result = _addTag(tagType, newValue, true);
        if (result.success) modifiedTypes.add(tagType);
        break;
      case "delete":
        result = _deleteTag(tagType, oldValue);
        if (result.success) {
          Service_Sheet.removeTagFromExpenses(tagType, oldValue);
          Service_Split.removeTagFromSplits(tagType, oldValue);
        }
        break;
      case "rename":
        result = _renameTag(tagType, oldValue, newValue, true);
        if (result.success) modifiedTypes.add(tagType);
        break;
      case "updateTripType":
        // oldValue = tripName, newValue = typeName
        result = _updateTripType(oldValue, newValue);
        break;
      default:
        return { success: false, message: `Unknown operation type: ${operationType}` };
    }

    if (!result.success) {
      return {
        success: false,
        message: `Operation failed at index ${i}: ${result.message}`,
        failedOperation: { index: i, operation: operation }
      };
    }
  }

  // Sort modified types after batch processing
  modifiedTypes.forEach(type => {
      _sortTags(type);
  });

  return { success: true, message: `Processed ${operations.length} operations successfully` };
}

function _sortTags(type) {
  const tagSheet = _getTagSheet();
  const lastRow = tagSheet.getLastRow();
  
  if (lastRow < 2) return;

  let column;
  if (type === "Trip/Event") {
    column = 1;
  } else if (type === "Category") {
    column = 3;
  } else if (type === "Type") {
    column = 4;
  } else {
    return;
  }

  if (type === "Trip/Event") {
      // Sort A and B together based on A
      const range = tagSheet.getRange(2, 1, lastRow - 1, 2);
      range.sort({ column: 1, ascending: true });
  } else {
      // Sort independent column
      const range = tagSheet.getRange(2, column, lastRow - 1, 1);
      const values = range.getValues().flat();
      const tags = values.filter(v => v !== "").map(String);
      
      if (tags.length === 0) {
           range.clearContent();
           return;
      }

      tags.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

      range.clearContent();
      const output = tags.map(t => [t]);
      tagSheet.getRange(2, column, output.length, 1).setValues(output);
  }
}
