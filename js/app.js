const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyOuvUpzAAW2E75NjK7oeOixQRgxdyIRzl6c-qsX_8pyrwxbPK_w6SgQMdmsP1P8s8/exec";

const loginButton = document.getElementById('login-button');
const apiKeyInput = document.getElementById('api-key');
const errorMessage = document.getElementById('error-message');
const loginContainer = document.getElementById('login-container');
const mainMenu = document.getElementById('main-menu');

// Global variable to store parsed data
let parsedData = [];

loginButton.addEventListener('click', () => {
  const apiKey = apiKeyInput.value;
  if (!apiKey) {
    errorMessage.textContent = 'Please enter a key.';
    return;
  }

  // Create a unique callback function name
  const callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());

  // Create a script element
  const script = document.createElement('script');

  // Define the callback function
  window[callbackName] = function (data) {
    if (data.success) {
      loginContainer.style.display = 'none';
      mainMenu.style.display = 'block';

      // Set up file upload functionality
      const fileUpload = document.getElementById('file-upload');
      const fileContent = document.getElementById('file-content');

      fileUpload.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) {
          fileContent.textContent = 'Please select a file.';
          return;
        }

        readXlsxFile(file).then((rows) => {
          const cleanedData = parseAndCleanData(rows);
          parsedData = cleanedData; // Store for later upload
          fileContent.textContent = JSON.stringify(cleanedData, null, 2);
        }).catch(error => {
          console.error(error);
          fileContent.textContent = 'Error reading the Excel file.';
        });
      });

      // Set up upload to sheet functionality
      const uploadButton = document.getElementById('upload-to-sheet');
      uploadButton.addEventListener('click', () => {
        if (!parsedData || parsedData.length === 0) {
          showStatusMessage('upload-status', 'No data to upload. Please select and parse an Excel file first.', 'error');
          return;
        }
        
        uploadDataToSheet(parsedData);
      });
      
      // Set up load from sheet functionality
      const loadDataButton = document.getElementById('load-from-sheet');
      loadDataButton.addEventListener('click', () => {
        loadDataFromSheet();
      });
    } else {
      errorMessage.textContent = data.message;
    }

    // Clean up: remove the script tag and the callback function
    document.body.removeChild(script);
    delete window[callbackName];
  };

  // Set the script source to the Google Apps Script URL with the callback and api key
  script.src = SCRIPT_URL + '?callback=' + callbackName + '&apiKey=' + encodeURIComponent(apiKey);

  // Append the script to the body to make the request
  document.body.appendChild(script);
});

function parseAndCleanData(rows) {
  const transactions = [];
  let headerIndex = -1;

  // Find the header row index
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === 'Date' && rows[i][3] === 'Description') {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    return { error: "Couldn't find the header row." };
  }

  let currentTransaction = null;

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    const rowText = row.join('');

    if (rowText.includes('Please note recent transactions may not be included') || rowText.includes('Pending Transactions (Submitted, Waiting Approval)')) {
      break;
    }

    const date = row[0];

    if (date) {
      // If there's a date, it's a new transaction
      if (currentTransaction) {
        transactions.push(currentTransaction);
      }
      currentTransaction = {
        date: normalizeDateString(date),
        document: row[2] || '',
        description: row[3] || '',
        cashIn: row[12] || null,
        cashOut: row[15] || null,
      };
    } else if (currentTransaction) {
      // If there's no date, append the data to the current transaction
      if (row[2] && !currentTransaction.document.includes(row[2])) {
        currentTransaction.document += '\n' + row[2];
      }
      if (row[3] && !currentTransaction.description.includes(row[3])) {
        currentTransaction.description += ' ' + row[3];
      }
    }
  }

  // Add the last transaction
  if (currentTransaction) {
    transactions.push(currentTransaction);
  }

  return transactions;
}

function uploadDataToSheet(data) {
  showStatusMessage('upload-status', 'Loading existing data from Google Sheet to check for duplicates...', 'info');
  
  // First, load existing data from the sheet to check for duplicates locally
  // Create a unique callback function name
  const callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());

  // Create a script element
  const script = document.createElement('script');

  // Define the callback function
  window[callbackName] = function (response) {
    if (response.success) {
      showStatusMessage('upload-status', `Found ${response.data.length} existing records. Checking for duplicates...`, 'info');
      
      // Perform duplicate checking locally in the browser
      const existingData = response.data;
      const newRecords = findUniqueRecords(data, existingData);
      
      if (newRecords.length === 0) {
        showStatusMessage('upload-status', 'No new records to upload - all records already exist in the sheet.', 'success');
        // Clean up and return early
        document.body.removeChild(script);
        delete window[callbackName];
        return;
      }
      
      // Upload only the new, unique records
      uploadNewRecords(newRecords);
    } else {
      showStatusMessage('upload-status', `Error loading existing data: ${response.message}`, 'error');
    }

    // Clean up: remove the script tag and the callback function
    document.body.removeChild(script);
    delete window[callbackName];
  };

  // Set the script source to the Google Apps Script URL with the callback and api key
  const url = `${SCRIPT_URL}?action=getData&callback=${callbackName}&apiKey=${encodeURIComponent(getApiKey())}`;
  script.src = url;

  // Append the script to the body to make the request
  document.body.appendChild(script);
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

function uploadNewRecords(newRecords) {
  // Calculate safe chunk size considering URL length limits (about 1500 characters to be safe)
  // Account for URL overhead: SCRIPT_URL + action + apiKey + other parameters
  const urlOverhead = `${SCRIPT_URL}?action=saveData&callback=callback12345&apiKey=abcd&data=`.length;
  // Estimate ~50 chars per data record (conservative estimate)
  const estimatedCharsPerRecord = 50; 
  const maxRecordsPerChunk = Math.floor((1500 - urlOverhead) / estimatedCharsPerRecord);
  
  // Ensure at least 1 record per chunk, but don't exceed a reasonable limit
  const recordsPerChunk = Math.max(1, Math.min(maxRecordsPerChunk, 20)); // Conservative limit
  const totalChunks = Math.ceil(newRecords.length / recordsPerChunk);
  
  console.log(`Uploading ${newRecords.length} records in ${totalChunks} chunks of ${recordsPerChunk} records each`);
  
  // Process chunks sequentially
  processChunk(0, newRecords, recordsPerChunk, totalChunks);
}

function processChunk(chunkIndex, allRecords, recordsPerChunk, totalChunks) {
  if (chunkIndex >= totalChunks) {
    // All chunks processed
    showStatusMessage('upload-status', `All ${allRecords.length} records uploaded successfully!`, 'success');
    return;
  }
  
  // Update progress
  const recordsInThisChunk = Math.min(recordsPerChunk, allRecords.length - (chunkIndex * recordsPerChunk));
  const startIdx = chunkIndex * recordsPerChunk;
  const endIdx = startIdx + recordsInThisChunk;
  const recordsForThisChunk = allRecords.slice(startIdx, endIdx);
  
  // Update status with progress
  showStatusMessage('upload-status', 
    `Uploading chunk ${chunkIndex + 1}/${totalChunks} (${recordsForThisChunk.length} records)...`, 'info');
  
  // Create a unique callback function name
  const callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());

  // Create a script element
  const script = document.createElement('script');
  
  // Stringify the data for this chunk
  const stringifiedData = JSON.stringify(recordsForThisChunk);

  // Define the callback function
  window[callbackName] = function (response) {
    if (response.success) {
      console.log(`Chunk ${chunkIndex + 1} uploaded successfully`);
      
      // Process the next chunk
      setTimeout(() => {
        processChunk(chunkIndex + 1, allRecords, recordsPerChunk, totalChunks);
      }, 100); // Small delay to avoid overwhelming the server
    } else {
      showStatusMessage('upload-status', `Error uploading chunk ${chunkIndex + 1}: ${response.message}`, 'error');
    }

    // Clean up: remove the script tag and the callback function
    document.body.removeChild(script);
    delete window[callbackName];
  };

  // Set the script source to the Google Apps Script URL with the callback and data
  const url = `${SCRIPT_URL}?action=saveData&callback=${callbackName}&apiKey=${encodeURIComponent(getApiKey())}&data=${encodeURIComponent(stringifiedData)}`;
  script.src = url;

  // Append the script to the body to make the request
  document.body.appendChild(script);
}

function loadDataFromSheet() {
  showStatusMessage('data-status', 'Loading data from Google Sheet...', 'info');
  document.getElementById('data-display').style.display = 'none';
  
  // Create a unique callback function name
  const callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());

  // Create a script element
  const script = document.createElement('script');

  // Define the callback function
  window[callbackName] = function (response) {
    if (response.success) {
      showStatusMessage('data-status', `${response.data.length} records loaded successfully`, 'success');
      displayDataInTable(response.data);
      document.getElementById('data-display').style.display = 'block';
    } else {
      showStatusMessage('data-status', response.message, 'error');
    }

    // Clean up: remove the script tag and the callback function
    document.body.removeChild(script);
    delete window[callbackName];
  };

  // Set the script source to the Google Apps Script URL with the callback and api key
  const url = `${SCRIPT_URL}?action=getData&callback=${callbackName}&apiKey=${encodeURIComponent(getApiKey())}`;
  script.src = url;

  // Append the script to the body to make the request
  document.body.appendChild(script);
}

function displayDataInTable(data) {
  const tableBody = document.getElementById('data-body');
  tableBody.innerHTML = ''; // Clear existing data
  
  if (data.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.setAttribute('colspan', 8);
    cell.textContent = 'No data available';
    row.appendChild(cell);
    tableBody.appendChild(row);
    return;
  }
  
  data.forEach(item => {
    const row = document.createElement('tr');
    
    // Create and append cells for each column
    const documentCell = document.createElement('td');
    documentCell.textContent = item.Document || '';
    row.appendChild(documentCell);
    
    const dateCell = document.createElement('td');
    dateCell.textContent = item.Date || '';
    row.appendChild(dateCell);
    
    const descriptionCell = document.createElement('td');
    descriptionCell.textContent = item.Description || '';
    row.appendChild(descriptionCell);
    
    const tripEventCell = document.createElement('td');
    tripEventCell.textContent = item['Trip/Event'] || '';
    row.appendChild(tripEventCell);
    
    const categoryCell = document.createElement('td');
    categoryCell.textContent = item.Category || '';
    row.appendChild(categoryCell);
    
    const incomeCell = document.createElement('td');
    incomeCell.textContent = item.Income || '';
    row.appendChild(incomeCell);
    
    const expenseCell = document.createElement('td');
    expenseCell.textContent = item.Expense || '';
    row.appendChild(expenseCell);
    
    const timeUploadedCell = document.createElement('td');
    timeUploadedCell.textContent = item['Time-uploaded'] || '';
    row.appendChild(timeUploadedCell);
    
    tableBody.appendChild(row);
  });
}

function showStatusMessage(elementId, message, type) {
  const element = document.getElementById(elementId);
  element.textContent = message;
  element.className = `status-message ${type}`;
}

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

function getApiKey() {
  return apiKeyInput.value;
}