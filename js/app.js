const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyOuvUpzAAW2E75NjK7oeOixQRgxdyIRzl6c-qsX_8pyrwxbPK_w6SgQMdmsP1P8s8/exec";

const loginButton = document.getElementById('login-button');
const apiKeyInput = document.getElementById('api-key');
const errorMessage = document.getElementById('error-message');
const loginContainer = document.getElementById('login-container');
const mainMenu = document.getElementById('main-menu');

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
          fileContent.textContent = JSON.stringify(cleanedData, null, 2);
        }).catch(error => {
          console.error(error);
          fileContent.textContent = 'Error reading the Excel file.';
        });
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
        date: date,
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