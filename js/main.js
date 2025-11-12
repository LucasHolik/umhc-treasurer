// js/main.js

import { UI } from './modules/ui.js';
import { API } from './modules/api.js';
import { Excel } from './modules/excel.js';
import { Data } from './modules/data.js';
import { Editor } from './modules/editor.js';
import { Tags } from './modules/tags.js';

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
  document.getElementById('view-edit-expenses-button').addEventListener('click', handleViewEditExpenses);
  document.getElementById('add-trip-event-button').addEventListener('click', () => handleAddTag('Trip/Event'));
  document.getElementById('add-category-button').addEventListener('click', () => handleAddTag('Category'));
  document.getElementById('edit-tags-button').addEventListener('click', handleEditTags);
  document.getElementById('save-changes-button').addEventListener('click', handleSaveChanges);
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

  processChunk(0, newRecords, recordsPerChunk, totalChunks, 'saveData', 'upload-status');
}

function processChunk(chunkIndex, allRecords, recordsPerChunk, totalChunks, action, statusElementId) {
  if (chunkIndex >= totalChunks) {
    UI.showStatusMessage(statusElementId, `All ${allRecords.length} records processed successfully!`, 'success');
    if (action === 'updateExpenses') {
      Editor.clearChanges();
    }
    return;
  }

  const startIdx = chunkIndex * recordsPerChunk;
  const endIdx = startIdx + recordsPerChunk;
  const recordsForThisChunk = allRecords.slice(startIdx, endIdx);

  UI.showStatusMessage(statusElementId, `Processing chunk ${chunkIndex + 1}/${totalChunks} (${recordsForThisChunk.length} records)...`, 'info');

  const apiFunction = action === 'saveData' ? API.saveData : API.updateExpenses;

  apiFunction(UI.getApiKey(), recordsForThisChunk, (response) => {
    if (response.success) {
      console.log(`Chunk ${chunkIndex + 1} processed successfully`);
      setTimeout(() => {
        processChunk(chunkIndex + 1, allRecords, recordsPerChunk, totalChunks, action, statusElementId);
      }, 100);
    } else {
      UI.showStatusMessage(statusElementId, `Error processing chunk ${chunkIndex + 1}: ${response.message}`, 'error');
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

function handleViewEditExpenses() {
  UI.showStatusMessage('editor-status', 'Loading app data...', 'info');
  document.getElementById('editor-section').style.display = 'block';

  API.getAppData(UI.getApiKey(), (response) => {
    if (response.success) {
      UI.showStatusMessage('editor-status', 'Data loaded successfully.', 'success');
      Tags.setTags(response.data.tags);
      Editor.render(response.data.expenses);
    } else {
      UI.showStatusMessage('editor-status', `Error loading data: ${response.message}`, 'error');
    }
  });
}

function handleAddTag(type) {
  const inputId = type === 'Trip/Event' ? 'new-trip-event' : 'new-category';
  const input = document.getElementById(inputId);
  const value = input.value.trim();
  if (value) {
    Tags.addTag(type, value);
    Editor.rerender();
    input.value = '';
  }
}

function handleEditTags() {
  const allTags = Tags.getTags();
  UI.displayTagsForEditing(allTags, handleDeleteTag);
}

function handleDeleteTag(type, value) {
  Tags.deleteTag(type, value);
  Editor.updateTagInExpenses(type, value);
  // After deleting a tag, we might want to refresh the edit tags UI
  setTimeout(() => handleEditTags(), 100);
}

function handleSaveChanges() {
  const changes = Editor.getChanges();
  if (changes.length === 0) {
    UI.showStatusMessage('editor-status', 'No changes to save.', 'info');
    return;
  }

  const recordsPerChunk = 20;
  const totalChunks = Math.ceil(changes.length / recordsPerChunk);

  console.log(`Saving ${changes.length} changes in ${totalChunks} chunks of ${recordsPerChunk} records each`);

  processChunk(0, changes, recordsPerChunk, totalChunks, 'updateExpenses', 'editor-status');
}

function init() {
  UI.loginButton.addEventListener('click', login);
}

init();
