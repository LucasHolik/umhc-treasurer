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

      const pdfUpload = document.getElementById('pdf-upload');
      const pdfContent = document.getElementById('pdf-content');

      pdfUpload.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file || file.type !== 'application/pdf') {
          pdfContent.textContent = 'Please select a PDF file.';
          return;
        }

        const fileReader = new FileReader();
        fileReader.onload = function() {
          const typedarray = new Uint8Array(this.result);
          pdfjsLib.getDocument(typedarray).promise.then(pdf => {
            const promises = [];
            for (let i = 1; i <= pdf.numPages; i++) {
              promises.push(pdf.getPage(i).then(page => page.getTextContent()));
            }
            Promise.all(promises).then(textContents => {
              const parsedData = parsePdfText(textContents);
              pdfContent.textContent = JSON.stringify(parsedData, null, 2);
            });
          });
        };
        fileReader.readAsArrayBuffer(file);
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

function parsePdfText(textContents) {
  const allItems = textContents.flatMap(content => content.items);

  // 1. Find header coordinates
  const headers = {};
  const headerNames = ["Date", "Description", "Cash In", "Cash Out"];
  allItems.forEach(item => {
    if (headerNames.includes(item.str)) {
      headers[item.str] = { x: item.transform[4], y: item.transform[5] };
    }
  });

  if (Object.keys(headers).length < headerNames.length) {
    return { error: "Could not find all headers.", found: Object.keys(headers) };
  }

  // 2. Group items by line
  const lines = {};
  allItems.forEach(item => {
    const y = item.transform[5];
    let foundLine = false;
    // Check if item belongs to an existing line (with a tolerance)
    for (const lineY in lines) {
      if (Math.abs(y - lineY) < 5) {
        lines[lineY].push(item);
        foundLine = true;
        break;
      }
    }
    if (!foundLine) {
      lines[y] = [item];
    }
  });

  // 3. Process each line
  const transactions = [];
  const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;

  for (const y in lines) {
    const lineItems = lines[y].sort((a, b) => a.transform[4] - b.transform[4]);
    const lineText = lineItems.map(item => item.str).join(' ').trim();

    // Skip empty lines, header lines, or footer lines
    if (!lineText || lineText.includes("Date   Description") || lineText.includes("Page")) continue;
    
    const firstItem = lineItems[0];
    if (firstItem && dateRegex.test(firstItem.str)) {
      const date = firstItem.str;
      let description = '';
      let cashIn = '';
      let cashOut = '';

      // Find description and amounts based on x-coordinates
      const descriptionItems = [];
      const amountItems = [];

      lineItems.slice(1).forEach(item => {
        const itemX = item.transform[4];
        // If item is before the "Cash In" column, it's part of the description
        if (itemX < headers["Cash In"].x - 10) {
          descriptionItems.push(item.str);
        } else {
          // It's a potential amount
          amountItems.push(item);
        }
      });
      
      description = descriptionItems.join(' ').trim();

      // Find the most likely cash in/out value
      let bestAmountItem = null;
      let minDistance = Infinity;

      amountItems.forEach(item => {
        const value = parseFloat(item.str.replace(/,/g, ''));
        if (!isNaN(value)) {
          const distToCashIn = Math.abs(item.transform[4] - headers["Cash In"].x);
          const distToCashOut = Math.abs(item.transform[4] - headers["Cash Out"].x);
          if (distToCashIn < minDistance) {
            minDistance = distToCashIn;
            bestAmountItem = { item, type: 'in' };
          }
          if (distToCashOut < minDistance) {
            minDistance = distToCashOut;
            bestAmountItem = { item, type: 'out' };
          }
        }
      });

      if (bestAmountItem) {
        if (bestAmountItem.type === 'in') {
          cashIn = bestAmountItem.item.str;
        } else {
          cashOut = bestAmountItem.item.str;
        }
      }

      transactions.push({
        date,
        description,
        cashIn,
        cashOut,
      });
    }
  }

  return transactions;
}