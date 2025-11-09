// See google-sheets/README.md for deployment instructions.

/**
 * Changes the shared key in the "Config" sheet.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet The "Config" sheet object.
 * @param {string} keyCell The cell where the key is stored (e.g., "A1").
 * @param {object} keyData An object containing oldKey and newKey.
 * @returns {object} A success object or an error object.
 */
function changeKey(sheet, keyCell, keyData) {
  const currentKey = sheet.getRange(keyCell).getValue();

  if (keyData.oldKey !== currentKey) {
    return { success: false, message: "Old key does not match." };
  }
  
  if (!keyData.newKey || keyData.newKey.length < 8) {
    return { success: false, message: "New key must be at least 8 characters long." };
  }

  sheet.getRange(keyCell).setValue(keyData.newKey);
  return { success: true, message: "Shared key updated successfully." };
}