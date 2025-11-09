// See google-sheets/README.md for deployment instructions.

/**
 * Gets all data from the "Finances" sheet and formats it as an array of objects.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet The "Finances" sheet object.
 * @returns {object} A success object containing the financial data.
 */
function getFinances(sheet) {
  const range = sheet.getDataRange();
  const values = range.getValues();

  if (values.length < 2) { // Should have at least a header row
    return { success: true, data: [] };
  }

  const headers = values[0];
  const data = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const entry = {};
    for (let j = 0; j < headers.length; j++) {
      entry[headers[j]] = row[j];
    }
    data.push(entry);
  }
  return { success: true, data: data };
}

/**
 * Appends a new row to the "Finances" sheet based on the provided data.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet The "Finances" sheet object.
 * @param {object} entryData An object containing the entry details.
 * @returns {object} A success object with a confirmation message.
 */
function addEntry(sheet, entryData) {
  // Headers: Time-uploaded, Date, Description, Trip/Event, Category, Income, Expense
  const newRow = [
    new Date(), // Time-uploaded
    entryData.Date || "",
    entryData.Description || "",
    entryData["Trip/Event"] || "",
    entryData.Category || "",
    entryData.Income || "",
    entryData.Expense || ""
  ];
  sheet.appendRow(newRow);
  return { success: true, message: "Entry added successfully." };
}