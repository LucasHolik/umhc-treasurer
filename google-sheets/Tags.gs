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
    return { "Trip/Event": [], "Category": [] };
  }
  const tripEventTags = tagSheet.getRange(2, 1, lastRow - 1, 1).getValues().flat().filter(String);
  const categoryTags = tagSheet.getRange(2, 2, lastRow - 1, 1).getValues().flat().filter(String);

  return {
    "Trip/Event": tripEventTags,
    "Category": categoryTags
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
    existingTags = tagSheet.getRange(2, column, lastRow - 1, 1).getValues().flat();
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
