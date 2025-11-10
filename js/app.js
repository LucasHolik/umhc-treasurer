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
            let text = '';
            const promises = [];
            for (let i = 1; i <= pdf.numPages; i++) {
              promises.push(pdf.getPage(i).then(page => {
                return page.getTextContent().then(textContent => {
                  return textContent.items.map(item => item.str).join(' ');
                });
              }));
            }
            Promise.all(promises).then(pageTexts => {
              pdfContent.textContent = pageTexts.join('\n\n');
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