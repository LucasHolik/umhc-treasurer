const Service_Tags = {
  getTags: function() {
    return _getTags();
  },

  addTag: function(type, value) {
    return _addTag(type, value);
  },

  deleteTag: function(e) {
    const type = e.parameter.type;
    const value = e.parameter.value;
    const deleteResult = _deleteTag(type, value);
    if (deleteResult.success) {
      Service_Sheet.removeTagFromExpenses(type, value);
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
    tagSheet.appendRow(["Trip/Event", "Category"]);
  }
  return tagSheet;
}

function _getTags() {
  const tagSheet = _getTagSheet();
  const lastRow = tagSheet.getLastRow();
  if (lastRow < 2) {
    return { "Trip/Event": [], Category: [] };
  }
  const tripEventTags = tagSheet
    .getRange(2, 1, lastRow - 1, 1)
    .getValues()
    .flat()
    .filter(String);
  const categoryTags = tagSheet
    .getRange(2, 2, lastRow - 1, 1)
    .getValues()
    .flat()
    .filter(String);

  return {
    "Trip/Event": tripEventTags,
    Category: categoryTags,
  };
}

function _addTag(type, value) {
  const tagSheet = _getTagSheet();
  const lastRow = tagSheet.getLastRow();
  let existingTags;
  let column;

  if (type === "Trip/Event") {
    column = 1;
  } else if (type === "Category") {
    column = 2;
  } else {
    return { success: false, message: "Invalid tag type." };
  }

  if (lastRow > 1) {
    existingTags = tagSheet
      .getRange(2, column, lastRow - 1, 1)
      .getValues()
      .flat();
    if (existingTags.includes(value)) {
      return { success: false, message: "Tag already exists." };
    }
  }

  const columnValues = tagSheet.getRange(1, column, lastRow, 1).getValues();
  let nextEmptyRow = columnValues.filter(String).length + 1;

  tagSheet.getRange(nextEmptyRow, column).setValue(value);

  return { success: true, message: "Tag added successfully." };
}

function _deleteTag(type, value) {
  const tagSheet = _getTagSheet();
  const lastRow = tagSheet.getLastRow();
  let column;

  if (type === "Trip/Event") {
    column = 1;
  } else if (type === "Category") {
    column = 2;
  } else {
    return { success: false, message: "Invalid tag type." };
  }

  if (lastRow < 2) {
    return { success: false, message: "No tags to delete." };
  }

  const tagsRange = tagSheet.getRange(2, column, lastRow - 1, 1);
  const tags = tagsRange.getValues().flat();
  const tagIndex = tags.indexOf(value);

  if (tagIndex === -1) {
    return { success: false, message: "Tag not found." };
  }

  const deleteRow = tagIndex + 2;

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

  return { success: true, message: "Tag deleted successfully." };
}

function _renameTag(type, oldValue, newValue) {
  const tagSheet = _getTagSheet();
  const lastRow = tagSheet.getLastRow();
  let column;

  if (type === "Trip/Event") {
    column = 1;
  } else if (type === "Category") {
    column = 2;
  } else {
    return { success: false, message: "Invalid tag type." };
  }

  if (lastRow < 2) {
    return { success: false, message: "No tags to rename." };
  }

  const tagsRange = tagSheet.getRange(2, column, lastRow - 1, 1);
  const tags = tagsRange.getValues().flat();
  if (tags.includes(newValue)) {
    return { success: false, message: "New tag value already exists." };
  }

  const tagIndex = tags.indexOf(oldValue);
  if (tagIndex === -1) {
    return { success: false, message: "Old tag value not found." };
  }

  const updateRow = tagIndex + 2;
  tagSheet.getRange(updateRow, column).setValue(newValue);

  Service_Sheet.updateExpensesWithTag(oldValue, newValue, type);

  return { success: true, message: "Tag renamed successfully." };
}

function _processTagOperations(operations) {
  if (!operations || !Array.isArray(operations)) {
    return { success: false, message: "Invalid operations array" };
  }

  for (let i = 0; i < operations.length; i++) {
    const operation = operations[i];
    if (!Array.isArray(operation) || operation.length !== 4) {
      return { success: false, message: `Invalid operation at index ${i}` };
    }

    const [oldValue, newValue, operationType, tagType] = operation;

    let result;
    switch (operationType) {
      case "add":
        result = _addTag(tagType, newValue);
        break;
      case "delete":
        result = _deleteTag(tagType, oldValue);
        if (result.success) {
          Service_Sheet.removeTagFromExpenses(tagType, oldValue);
        }
        break;
      case "rename":
        result = _renameTag(tagType, oldValue, newValue);
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

  return { success: true, message: `Processed ${operations.length} operations successfully` };
}
