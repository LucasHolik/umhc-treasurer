// js/modules/tags.js

import { API } from "./api.js";
import { UI } from "./ui.js";

let tags = {
  "Trip/Event": [],
  Category: [],
};

// Track operations that need to be saved to Google Sheets - in order of operations
let operationsToSave = []; // Array of [oldValue, newValue, operationType, tagType]
                          // e.g. [null, "dog", "add", "Category"], ["cat", "dog", "rename", "Trip/Event"], ["dog", null, "delete", "Category"]

function addTag(type, value) {
  if (!value) {
    UI.showStatusMessage(
      "tag-status",
      `Please enter a value for ${type}.`,
      "error"
    );
    return;
  }
  if (tags[type].includes(value)) {
    UI.showStatusMessage(
      "tag-status",
      `${type} tag '${value}' already exists locally.`,
      "info"
    );
    return;
  }

  // Add tag locally first for a responsive UI
  tags[type].push(value);

  // Track the addition for potential batch saving - [oldValue, newValue, operationType, tagType]
  operationsToSave.push([null, value, "add", type]);

  UI.showStatusMessage(
    "tag-status",
    `${type} tag '${value}' added locally. Remember to save to Google Sheets.`,
    "info"
  );
}

function deleteTag(type, value) {
  const index = tags[type].indexOf(value);
  if (index > -1) {
    tags[type].splice(index, 1);
  }

  // Track the deletion for potential batch saving - [oldValue, newValue, operationType, tagType]
  operationsToSave.push([value, null, "delete", type]);

  UI.showStatusMessage(
    "tag-status",
    `Tag '${value}' deleted locally. Remember to save to Google Sheets.`,
    "info"
  );
}

function renameTag(type, oldValue, newValue) {
  // First check if the new value already exists
  if (tags[type].includes(newValue)) {
    UI.showStatusMessage(
      "tag-status",
      `${type} tag '${newValue}' already exists. Cannot rename.`,
      "error"
    );
    return false;
  }

  // Remove the old tag
  const index = tags[type].indexOf(oldValue);
  if (index > -1) {
    tags[type].splice(index, 1);
  }

  // Add the new tag
  tags[type].push(newValue);

  // Track the rename for potential batch saving - [oldValue, newValue, operationType, tagType]
  operationsToSave.push([oldValue, newValue, "rename", type]);

  UI.showStatusMessage(
    "tag-status",
    `Tag '${oldValue}' renamed to '${newValue}' locally. Remember to save to Google Sheets.`,
    "info"
  );

  return true;
}

// NEW: Get all tracked operations
function getOperations() {
  return [...operationsToSave];
}

// NEW: Clear all tracked operations
function clearOperations() {
  operationsToSave = [];
}

// NEW: Process all changes and save to Google Sheets
function saveChangesToSheets(callback) {
  // If no operations, return immediately
  if (operationsToSave.length === 0) {
    UI.showStatusMessage("tag-status", "No changes to save.", "info");
    if (callback) callback({ success: true, message: "No changes to save." });
    return;
  }

  // Process the operations in chunks to respect URL length limits
  processOperationsInChunks(callback);
}

// Process operations in chunks to respect URL length limits (~1500 chars)
function processOperationsInChunks(callback) {
  const chunkSize = 20; // Approximate number of operations per chunk to stay under limit
  let currentChunk = 0;

  function processNextChunk() {
    if (currentChunk * chunkSize >= operationsToSave.length) {
      // All chunks processed
      clearOperations();
      UI.showStatusMessage("tag-status", "All tag changes saved to Google Sheets successfully.", "success");
      if (callback) callback({ success: true, message: "All tag changes saved successfully." });
      return;
    }

    const startIdx = currentChunk * chunkSize;
    const endIdx = Math.min(startIdx + chunkSize, operationsToSave.length);
    const chunk = operationsToSave.slice(startIdx, endIdx);

    // Serialize the chunk to check length
    const serializedChunk = JSON.stringify(chunk);

    // If the chunk is too large, try with a smaller size
    let effectiveChunk = chunk;
    let effectiveSize = chunkSize;

    if (serializedChunk.length > 1500) {
      // If single chunk is too large, reduce chunk size and try again
      effectiveSize = Math.max(1, Math.floor(chunkSize * 1500 / serializedChunk.length));
      const newEndIdx = Math.min(startIdx + effectiveSize, operationsToSave.length);
      effectiveChunk = operationsToSave.slice(startIdx, newEndIdx);
    }

    // Send the chunk to the server
    API.processTagOperations(UI.getApiKey(), effectiveChunk, (response) => {
      if (response.success) {
        console.log(`Processed chunk ${currentChunk + 1} with ${effectiveChunk.length} operations`);
        currentChunk++;
        setTimeout(processNextChunk, 100); // Delay to avoid rate limits
      } else {
        console.error(`Error processing tag operations chunk: ${response.message}`);
        UI.showStatusMessage(
          "tag-status",
          `Error processing tag operations: ${response.message}`,
          "error"
        );
        if (callback) callback({ success: false, message: response.message });
      }
    });
  }

  processNextChunk();
}

export const Tags = {
  getTags: () => tags,
  setTags: (newTags) => {
    tags = newTags;
  },
  addTag,
  deleteTag,
  renameTag,
  getOperations,
  clearOperations,
  saveChangesToSheets,
};
