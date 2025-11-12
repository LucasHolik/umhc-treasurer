// js/modules/tags.js

import { API } from './api.js';
import { UI } from './ui.js';

let tags = {
  "Trip/Event": [],
  "Category": []
};

function addTag(type, value) {
  if (!value) {
    UI.showStatusMessage('tag-status', `Please enter a value for ${type}.`, 'error');
    return;
  }
  if (tags[type].includes(value)) {
    UI.showStatusMessage('tag-status', `${type} tag '${value}' already exists locally.`, 'info');
    return;
  }

  // Add tag locally first for a responsive UI
  tags[type].push(value);

  // Save the new tag to the Google Sheet in the background
  API.addTag(UI.getApiKey(), type, value, (response) => {
    if (response.success) {
      console.log(`${type} tag saved to sheet: ${value}`);
      UI.showStatusMessage('tag-status', `${type} tag '${value}' added successfully.`, 'success');
    } else {
      console.error(`Error saving tag: ${response.message}`);
      UI.showStatusMessage('tag-status', `Error adding ${type} tag: ${response.message}`, 'error');
      // Optional: Implement logic to handle save failure, e.g., remove the tag locally
      // If the server rejected it, we should probably remove it from the local list too
      const index = tags[type].indexOf(value);
      if (index > -1) {
        tags[type].splice(index, 1);
      }
    }
  });
}

export const Tags = {
  getTags: () => tags,
  setTags: (newTags) => {
    tags = newTags;
  },
  addTag
};
