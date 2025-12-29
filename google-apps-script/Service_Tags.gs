var Service_Tags = {
  getTags: function () {
    return _getTags();
  },

  addTag: function (type, value, extraData) {
    return _addTag(type, value, false, extraData);
  },

  deleteTag: function (e) {
    if (!e || !e.parameter) {
      return { success: false, message: "Invalid request parameters" };
    }
    const type = e.parameter.type;
    const value = e.parameter.value;
    const deleteResult = _deleteTag(type, value);
    return deleteResult;
  },

  renameTag: function (e) {
    if (!e || !e.parameter) {
      return { success: false, message: "Invalid request parameters" };
    }
    const type = e.parameter.type;
    const oldValue = e.parameter.oldValue;
    const newValue = e.parameter.newValue;
    return _renameTag(type, oldValue, newValue);
  },

  processTagOperations: function (e) {
    if (!e || !e.parameter) {
      return { success: false, message: "Invalid request parameters" };
    }
    try {
      const operationsParam = e.parameter.operations;
      if (!operationsParam) {
        return { success: false, message: "No operations parameter provided" };
      }
      const operations = JSON.parse(operationsParam);
      return _processTagOperations(operations);
    } catch (error) {
      console.error("Error processing tag operations:", error);
      return {
        success: false,
        message: "Error processing tag operations: " + error.message,
      };
    }
  },
};

function _getTagSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let tagSheet = spreadsheet.getSheetByName("Tags");

  if (!tagSheet) {
    tagSheet = spreadsheet.insertSheet("Tags");
    // New Header Structure: Trip/Event, Type, Status, Category, Type List
    tagSheet.appendRow([
      "Trip/Event",
      "Type",
      "Status",
      "Category",
      "Type List",
    ]);
    return tagSheet;
  }

  return tagSheet;
}

function _getTags() {
  const tagSheet = _getTagSheet();
  const lastRow = tagSheet.getLastRow();

  if (lastRow < 2) {
    return {
      "Trip/Event": [],
      Category: [],
      Type: [],
      TripTypeMap: {},
      TripStatusMap: {},
    };
  }

  // Get all data at once (Cols A to E) -> 5 columns now
  const data = tagSheet.getRange(2, 1, lastRow - 1, 5).getValues();

  const tripEventTags = [];
  const tripTypeMap = {};
  const tripStatusMap = {};
  const categoryTags = [];
  const typeTags = [];

  data.forEach((row) => {
    // Col A: Trip/Event
    if (row[0]) {
      const tripName = String(row[0]);
      tripEventTags.push(tripName);
      // Col B: Type
      if (row[1]) {
        tripTypeMap[tripName] = String(row[1]);
      }
      // Col C: Status
      if (row[2]) {
        tripStatusMap[tripName] = String(row[2]);
      } else {
        tripStatusMap[tripName] = "Active"; // Default
      }
    }

    // Col D: Category (was C)
    if (row[3]) {
      categoryTags.push(String(row[3]));
    }

    // Col E: Type List (was D)
    if (row[4]) {
      typeTags.push(String(row[4]));
    }
  });

  return {
    "Trip/Event": tripEventTags,
    Category: categoryTags,
    Type: typeTags,
    TripTypeMap: tripTypeMap,
    TripStatusMap: tripStatusMap,
  };
}

function _addTag(type, value, skipSort, extraData) {
  const tagSheet = _getTagSheet();
  const lastRow = tagSheet.getLastRow();
  let column;

  if (type === "Trip/Event") {
    column = 1;
  } else if (type === "Category") {
    column = 4; // Moved from 3
  } else if (type === "Type") {
    column = 5; // Moved from 4
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

  const columnValues = tagSheet
    .getRange(1, column, Math.max(lastRow, 1), 1)
    .getValues();
  let nextEmptyRow = columnValues.length + 1;

  // Find first empty cell in column
  for (let i = 1; i <= columnValues.length; i++) {
    if (!columnValues[i - 1][0]) {
      nextEmptyRow = i;
      break;
    }
  }

  tagSheet.getRange(nextEmptyRow, column).setValue(value);

  // If adding a Trip/Event, we must set its Type (Col 2) and Status (Col 3)
  if (type === "Trip/Event") {
    const typeValue = extraData || "";

    // Validate typeValue exists in Type List (Col 5)
    if (typeValue && lastRow > 1) {
      const existingTypes = tagSheet
        .getRange(2, 5, lastRow - 1, 1)
        .getValues()
        .flat()
        .map(String)
        .filter((t) => t !== "");
      if (!existingTypes.includes(typeValue)) {
        return {
          success: false,
          message: "Invalid type: " + typeValue + " not found in Type List",
        };
      }
    }

    tagSheet.getRange(nextEmptyRow, 2).setValue(typeValue);
    tagSheet.getRange(nextEmptyRow, 3).setValue("Active"); // Default status
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
    column = 4;
  } else if (type === "Type") {
    column = 5;
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

  // If deleting a "Type" (master list), we should clear this type from all Trip/Events (Col B)
  if (type === "Type") {
    const tripTypesRange = tagSheet.getRange(2, 2, lastRow - 1, 1);
    const tripTypes = tripTypesRange.getValues();
    let updated = false;
    const newTripTypes = tripTypes.map((r) => {
      if (r[0] === value) {
        updated = true;
        return [""]; // Clear the type
      }
      return r;
    });
    if (updated) {
      tripTypesRange.setValues(newTripTypes);
    }
  }

  if (type === "Trip/Event") {
    // If deleting Trip/Event, delete Cols A, B, C for that row
    if (deleteRow < lastRow) {
      // Move A, B, C (3 cols) up
      const rangeToMove = tagSheet.getRange(
        deleteRow + 1,
        1,
        lastRow - deleteRow,
        3
      );
      rangeToMove.copyTo(tagSheet.getRange(deleteRow, 1));
      // Clear last row of A, B, C
      tagSheet.getRange(lastRow, 1, 1, 3).clearContent();
    } else {
      tagSheet.getRange(deleteRow, 1, 1, 3).clearContent();
    }
  } else {
    // For Category (D) and Type List (E), we just move that column
    if (deleteRow < lastRow) {
      const rangeToMove = tagSheet.getRange(
        deleteRow + 1,
        column,
        lastRow - deleteRow,
        1
      );
      rangeToMove.copyTo(tagSheet.getRange(deleteRow, column));
      tagSheet.getRange(lastRow, column).clearContent();
    } else {
      tagSheet.getRange(deleteRow, column).clearContent();
    }
  }

  try {
    Service_Sheet.removeTagFromExpenses(type, value);
    Service_Split.removeTagFromSplits(type, value);
  } catch (error) {
    console.error("Error updating related data after tag deletion:", error);
    return {
      success: false,
      message:
        "Tag deleted from Tags sheet, but failed to update related expenses/splits: " +
        error.message,
      partial: true,
    };
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
    column = 4;
  } else if (type === "Type") {
    column = 5;
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

  // If renaming a "Type" (master list), update all Trip/Events (Col B) that use this type
  if (type === "Type") {
    const tripTypesRange = tagSheet.getRange(2, 2, lastRow - 1, 1);
    const tripTypes = tripTypesRange.getValues();
    let updated = false;
    const newTripTypes = tripTypes.map((r) => {
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

  // Renaming Trip/Event doesn't need to check "CompletedList" anymore since it's on the same row

  try {
    Service_Sheet.updateExpensesWithTag(oldValue, newValue, type);
    Service_Split.updateTagInSplits(oldValue, newValue, type);
  } catch (error) {
    console.error("Error updating related data after tag rename:", error);
    return {
      success: false,
      message:
        "Tag renamed in Tags sheet, but failed to update related data: " +
        error.message,
      partial: true,
    };
  }

  if (!skipSort) {
    _sortTags(type);
  }

  return { success: true, message: "Tag renamed successfully." };
}

function _updateTripType(tripName, typeName) {
  const tagSheet = _getTagSheet();
  const lastRow = tagSheet.getLastRow();

  if (lastRow < 2) {
    return { success: false, message: "No trips/events found." };
  }

  // Validate typeName exists in Type List (Col 5) if not empty
  if (typeName && typeName !== "") {
    const existingTypes = tagSheet
      .getRange(2, 5, lastRow - 1, 1)
      .getValues()
      .flat()
      .map(String)
      .filter((t) => t !== "");
    if (!existingTypes.includes(typeName)) {
      return {
        success: false,
        message: "Invalid type: " + typeName + " not found in Type List",
      };
    }
  }

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

function _updateTripStatus(tripName, status) {
  const tagSheet = _getTagSheet();
  const lastRow = tagSheet.getLastRow();

  if (lastRow < 2) {
    return { success: false, message: "No trips/events found." };
  }

  // Validate status value
  const validStatuses = ["Active", "Completed", "Investment"];
  if (!validStatuses.includes(status)) {
    return {
      success: false,
      message: "Invalid status. Must be one of: " + validStatuses.join(", "),
    };
  }

  const tripRange = tagSheet.getRange(2, 1, lastRow - 1, 1);
  const trips = tripRange.getValues().flat().map(String);
  const index = trips.indexOf(tripName);

  if (index === -1) {
    return { success: false, message: "Trip/Event not found." };
  }

  // Update Col C at row index+2
  tagSheet.getRange(index + 2, 3).setValue(status);
  return { success: true, message: "Trip status updated." };
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
        break;
      case "rename":
        result = _renameTag(tagType, oldValue, newValue, true);
        if (result.success) modifiedTypes.add(tagType);
        break;
      case "updateTripType":
        result = _updateTripType(oldValue, newValue);
        break;
      case "updateTripStatus":
        // oldValue = tripName, newValue = status ("Active", "Completed", "Investment")
        result = _updateTripStatus(oldValue, newValue);
        break;
      default:
        return {
          success: false,
          message: `Unknown operation type: ${operationType}`,
        };
    }

    if (!result.success) {
      return {
        success: false,
        message: `Operation failed at index ${i}: ${result.message}`,
        failedOperation: { index: i, operation: operation },
      };
    }
  }

  // Sort modified types after batch processing
  modifiedTypes.forEach((type) => {
    _sortTags(type);
  });

  return {
    success: true,
    message: `Processed ${operations.length} operations successfully`,
  };
}

function _sortTags(type) {
  const tagSheet = _getTagSheet();
  const lastRow = tagSheet.getLastRow();

  if (lastRow < 2) return;

  let column;
  if (type === "Trip/Event") {
    column = 1;
  } else if (type === "Category") {
    column = 4;
  } else if (type === "Type") {
    column = 5;
  } else {
    return;
  }

  if (type === "Trip/Event") {
    // Sort A, B, C together based on A
    const range = tagSheet.getRange(2, 1, lastRow - 1, 3);
    range.sort({ column: 1, ascending: true });
  } else {
    // Sort independent column
    const range = tagSheet.getRange(2, column, lastRow - 1, 1);
    const values = range.getValues().flat();
    const tags = values.filter((v) => v !== "").map(String);

    if (tags.length === 0) {
      range.clearContent();
      return;
    }

    tags.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

    range.clearContent();
    const output = tags.map((t) => [t]);
    tagSheet.getRange(2, column, output.length, 1).setValues(output);
  }
}
