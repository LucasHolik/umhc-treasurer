// js/main.js

import { UI } from './modules/ui.js';
import { API } from './modules/api.js';
import { Excel } from './modules/excel.js';
import { Data } from './modules/data.js';

let parsedData = [];

function login() {
  const apiKey = UI.getApiKey();
  if (!apiKey) {
    UI.showStatusMessage('error-message', 'Please enter a key.', 'error');
    return;
  }

  API.login(apiKey, (response) => {
    if (response.success) {
      UI.showMainMenu();
      setupMainMenuListeners();
    } else {
      UI.showStatusMessage('error-message', response.message, 'error');
    }
  });
}

function setupMainMenuListeners() {
  UI.fileUpload.addEventListener('change', handleFileSelect);
  UI.uploadButton.addEventListener('click', handleUpload);
  UI.loadDataButton.addEventListener('click', loadDataFromSheet);
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) {
    UI.setFileContent('Please select a file.');
    return;
  }

  Excel.parseFile(file)
    .then(data => {
      parsedData = data;
      UI.setFileContent(JSON.stringify(data, null, 2));
    })
    .catch(error => {
      console.error(error);
      UI.setFileContent('Error reading the Excel file.');
    });
}

function handleUpload() {
  if (!parsedData || parsedData.length === 0) {
    UI.showStatusMessage('upload-status', 'No data to upload. Please select and parse an Excel file first.', 'error');
    return;
  }

  uploadDataToSheet(parsedData);
}

function uploadDataToSheet(data) {
  UI.showStatusMessage('upload-status', 'Loading existing data from Google Sheet to check for duplicates...', 'info');

  API.getData(UI.getApiKey(), (response) => {
    if (response.success) {
      UI.showStatusMessage('upload-status', `Found ${response.data.length} existing records. Checking for duplicates...`, 'info');
      
      const existingData = response.data;
      const newRecords = Data.findUniqueRecords(data, existingData);

      if (newRecords.length === 0) {
        UI.showStatusMessage('upload-status', 'No new records to upload - all records already exist in the sheet.', 'success');
        return;
      }

      uploadNewRecords(newRecords);
    } else {
      UI.showStatusMessage('upload-status', `Error loading existing data: ${response.message}`, 'error');
    }
  });
}

function uploadNewRecords(newRecords) {
  const recordsPerChunk = 20;
  const totalChunks = Math.ceil(newRecords.length / recordsPerChunk);

  console.log(`Uploading ${newRecords.length} records in ${totalChunks} chunks of ${recordsPerChunk} records each`);

  processChunk(0, newRecords, recordsPerChunk, totalChunks);
}

function processChunk(chunkIndex, allRecords, recordsPerChunk, totalChunks) {
  if (chunkIndex >= totalChunks) {
    UI.showStatusMessage('upload-status', `All ${allRecords.length} records uploaded successfully!`, 'success');
    return;
  }

  const startIdx = chunkIndex * recordsPerChunk;
  const endIdx = startIdx + recordsPerChunk;
  const recordsForThisChunk = allRecords.slice(startIdx, endIdx);

  UI.showStatusMessage('upload-status', `Uploading chunk ${chunkIndex + 1}/${totalChunks} (${recordsForThisChunk.length} records)...`, 'info');

  API.saveData(UI.getApiKey(), recordsForThisChunk, (response) => {
    if (response.success) {
      console.log(`Chunk ${chunkIndex + 1} uploaded successfully`);
      setTimeout(() => {
        processChunk(chunkIndex + 1, allRecords, recordsPerChunk, totalChunks);
      }, 100);
    } else {
      UI.showStatusMessage('upload-status', `Error uploading chunk ${chunkIndex + 1}: ${response.message}`, 'error');
    }
  });
}

function loadDataFromSheet() {
  UI.showStatusMessage('data-status', 'Loading data from Google Sheet...', 'info');
  UI.hideDataDisplay();

  API.getData(UI.getApiKey(), (response) => {
    if (response.success) {
      UI.showStatusMessage('data-status', `${response.data.length} records loaded successfully`, 'success');
      UI.displayDataInTable(response.data);
      UI.showDataDisplay();
    } else {
      UI.showStatusMessage('data-status', response.message, 'error');
    }
  });
}

function init() {
  UI.loginButton.addEventListener('click', login);
}

init();
