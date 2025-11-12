// js/modules/data.js

function normalizeDateString(dateValue) {
  if (dateValue === null || dateValue === undefined || dateValue === '') {
    return '';
  }

  // Convert to string and trim
  let dateString = String(dateValue).trim();

  // Handle DD/MM/YYYY format from Excel
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateString)) {
    try {
      const parts = dateString.split('/');
      if (parts.length === 3) {
        // Assuming DD/MM/YYYY format - convert to YYYY-MM-DD
        const day = parts[0];
        const month = parts[1];
        const year = parts[2];
        // Format to YYYY-MM-DD with leading zeros
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    } catch (e) {
      // If parsing fails, return the original string
      return dateString;
    }
  }

  // Handle YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString; // Already in correct format
  }
  
  // Handle ISO date strings (YYYY-MM-DDTHH:MM:SS.mmmZ)
  if (dateString.includes('T') && dateString.includes('Z')) {
    try {
      // Extract just the date part (YYYY-MM-DD) before the 'T'
      return dateString.split('T')[0];
    } catch (e) {
      return dateString;
    }
  }
  
  // Handle date-time strings that might have been converted by Google Sheets (e.g., "2024-10-19 23:00:00")
  if (/\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/.test(dateString)) {
    try {
      // Extract just the date part (YYYY-MM-DD) before the time
      return dateString.split(' ')[0];
    } catch (e) {
      return dateString;
    }
  }

  // For other formats, return as-is
  return dateString;
}

function normalizeValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  // Check if it's a date string from Google Sheets (ISO format) or Excel (DD/MM/YYYY)
  // Handle dates by converting to consistent YYYY-MM-DD format using normalizeDateString
  const strValue = String(value).trim();

  // Check if it looks like a date - if so, use normalizeDateString to ensure consistent format
  if (strValue.includes('T') && strValue.includes('Z')) {
    // This is an ISO date string from Google Sheets like "2025-11-07T00:00:00.000Z"
    return normalizeDateString(strValue);
  } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(strValue)) {
    // This is a DD/MM/YYYY date string from Excel like "07/11/2025"
    return normalizeDateString(strValue);
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(strValue)) {
    // This is a YYYY-MM-DD format date
    return normalizeDateString(strValue);
  }

  // For numeric values that might have formatting differences
  // Try to parse as number and reformat if it's a valid number
  const numValue = Number(strValue);
  if (!isNaN(numValue) && strValue !== '') {
    // Use toPrecision to handle floating point precision consistently
    return numValue.toString();
  }

  return strValue;
}

function findUniqueRecords(newData, existingData) {
  console.log('Starting duplicate check...');
  console.log('Sample of existing data:', existingData.slice(0, 2)); // Log first 2 records
  console.log('Sample of new data:', newData.slice(0, 2)); // Log first 2 records
  
  // Create a set of existing keys for fast lookup
  // Normalize values to ensure consistent comparison, handling potential formatting differences
  const existingKeys = new Set();
  for (const existingRow of existingData) {
    // Create normalized key components ensuring dates are strings in consistent format
    const dateStr = normalizeDateString(existingRow.Date);
    const descriptionStr = normalizeValue(existingRow.Description);
    const documentStr = normalizeValue(existingRow.Document);
    const incomeStr = normalizeValue(existingRow.Income);
    const expenseStr = normalizeValue(existingRow.Expense);
    
    // Join components with a delimiter that's unlikely to appear in the actual data
    const key = `${dateStr}|${descriptionStr}|${documentStr}|${incomeStr}|${expenseStr}`;
    
    // Debug: log an example key
    if (existingKeys.size < 2) { // Only log first few for debugging
      console.log('Existing sheet key components:', {
        date: existingRow.Date, normalizedDate: dateStr,
        description: existingRow.Description, normalizedDescription: descriptionStr,
        document: existingRow.Document, normalizedDocument: documentStr,
        income: existingRow.Income, normalizedIncome: incomeStr,
        expense: existingRow.Expense, normalizedExpense: expenseStr
      });
      console.log('Complete existing key:', key);
    }
    
    existingKeys.add(key);
  }
  
  // Filter new data to only include unique records
  const uniqueRecords = [];
  let duplicateCount = 0;
  
  for (const row of newData) {
    // Create normalized key components for the new row ensuring dates are strings in consistent format
    const dateStr = normalizeDateString(row.date);
    const descriptionStr = normalizeValue(row.description);
    const documentStr = normalizeValue(row.document);
    const incomeStr = normalizeValue(row.cashIn);
    const expenseStr = normalizeValue(row.cashOut);
    
    // Join components with the same delimiter
    const key = `${dateStr}|${descriptionStr}|${documentStr}|${incomeStr}|${expenseStr}`;
    
    // Debug: log an example key from new data
    if (duplicateCount + uniqueRecords.length < 2) { // Only log first few for debugging
      console.log('New data key components:', {
        date: row.date, normalizedDate: dateStr,
        description: row.description, normalizedDescription: descriptionStr,
        document: row.document, normalizedDocument: documentStr,
        cashIn: row.cashIn, normalizedIncome: incomeStr,
        cashOut: row.cashOut, normalizedExpense: expenseStr
      });
      console.log('Complete new key:', key);
    }
    
    // If key doesn't exist in the set, it's unique
    if (!existingKeys.has(key)) {
      uniqueRecords.push(row);
    } else {
      console.log('Duplicate found:', key);
      duplicateCount++;
    }
  }
  
  console.log(`Found ${uniqueRecords.length} unique records and ${duplicateCount} duplicates`);
  return uniqueRecords;
}

export const Data = {
  normalizeDateString,
  normalizeValue,
  findUniqueRecords
};
