// google-sheets/Tags.gs

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

  // Find the next empty row in the specified column
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

  // Check if the new tag value already exists
  const tagsRange = tagSheet.getRange(2, column, lastRow - 1, 1);
  const tags = tagsRange.getValues().flat();
  if (tags.includes(newValue)) {
    return { success: false, message: "New tag value already exists." };
  }

  // Find the row with the old tag value
  const tagIndex = tags.indexOf(oldValue);
  if (tagIndex === -1) {
    return { success: false, message: "Old tag value not found." };
  }

  // Update the tag value in the Tags sheet
  const updateRow = tagIndex + 2;
  tagSheet.getRange(updateRow, column).setValue(newValue);

  // Now update all expenses in the Finances sheet that have the old tag value
  _updateExpensesWithTag(oldValue, newValue, type);

  return { success: true, message: "Tag renamed successfully." };
}

function _updateExpensesWithTag(oldTag, newTag, type) {
  const financeSheet = _getFinanceSheet(); // Uses the function from Sheet.gs
  const lastRow = financeSheet.getLastRow();

  if (lastRow <= 1) {
    return; // No expenses to update
  }

  let column;
  if (type === "Trip/Event") {
    column = 5; // Column E
  } else if (type === "Category") {
    column = 6; // Column F
  } else {
    return;
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
}

/**
 * Process an array of tag operations in order
 * Each operation is [oldValue, newValue, operationType, tagType]
 * operationType can be "add", "delete", or "rename"
 */
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
          _removeTagFromExpenses(tagType, oldValue); // Use the existing function from Sheet.gs
        }
        break;
      case "rename":
        result = _renameTag(tagType, oldValue, newValue);
        break;
      default:
        return { success: false, message: `Unknown operation type: ${operationType}` };
    }

    // If any operation fails, stop processing and return the error
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
