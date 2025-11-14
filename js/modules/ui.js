// js/modules/ui.js

export const UI = {
  loginButton: document.getElementById("login-button"),
  apiKeyInput: document.getElementById("api-key"),
  loginStatus: document.getElementById("login-status"),
  loginContainer: document.querySelector(".login-container"),
  mainMenu: document.getElementById("main-menu"),
  fileUpload: document.getElementById("file-upload"),
  fileContent: document.getElementById("file-content-json"), // Updated to point to the JSON view element
  uploadButton: document.getElementById("upload-to-sheet"),
  loadDataButton: document.getElementById("load-from-sheet"),
  dataDisplay: document.getElementById("data-display"),
  dataBody: document.getElementById("data-body"),
  tagStatus: document.getElementById("tag-status"),
  tagList: document.getElementById("tag-list"),
  tagsTableContainer: document.getElementById("tags-table-container"),
  tagsEditContainer: document.getElementById("tags-edit-container"),
  editTripEventTags: document.getElementById("edit-trip-event-tags"),
  editCategoryTags: document.getElementById("edit-category-tags"),
  editTagsButton: document.getElementById("edit-tags-button"),
  cancelEditTagsButton: document.getElementById("cancel-edit-tags"),
  saveTagsChangesButton: document.getElementById("save-tags-changes"),
  addTripEventInput: document.getElementById("add-trip-event"),
  addCategoryInput: document.getElementById("add-category"),
  confirmAddTripEventButton: document.getElementById("confirm-add-trip-event"),
  confirmAddCategoryButton: document.getElementById("confirm-add-category"),

  // New elements for extracted content
  extractedContentSection: document.getElementById("extracted-content-section"),
  tableViewContent: document.getElementById("table-view-content"),
  jsonViewContent: document.getElementById("json-view-content"),
  extractedTableBody: document.getElementById("extracted-table-body"),
  tableViewButton: document.getElementById("table-view-btn"),
  jsonViewButton: document.getElementById("json-view-btn"),
  fileContentJson: document.getElementById("file-content-json"),

  showMainMenu() {
    if (this.loginContainer) {
      this.loginContainer.style.display = "none";
    }
    this.mainMenu.style.display = "flex"; // Use flex to match the CSS display property
  },

  showLoginStatus(message, type, showLoader = false) {
    this.loginStatus.innerHTML = ""; // Clear previous content

    if (showLoader) {
      const loader = document.createElement("div");
      loader.className = "loader";
      this.loginStatus.appendChild(loader);
    }

    if (message) {
      const messageEl = document.createElement("div");
      messageEl.className = `status-message ${type}`;
      messageEl.textContent = message;
      this.loginStatus.appendChild(messageEl);
    }
  },

  hideLoginStatus() {
    this.loginStatus.innerHTML = ""; // Clear the content
  },

  showStatusMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = message;
      element.className = `status-message ${type}`;
      element.style.display = "block";
    }
  },

  // New methods for extracted content display
  showExtractedContent() {
    if (this.extractedContentSection) {
      this.extractedContentSection.style.display = "block";
    }
  },

  hideExtractedContent() {
    if (this.extractedContentSection) {
      this.extractedContentSection.style.display = "none";
    }
  },

  setFileContent(content) {
    // Updated to work with both table and JSON views
    if (typeof content === "string") {
      // JSON string content
      if (this.fileContentJson) {
        this.fileContentJson.textContent = content;
      }
    } else {
      // Object/array content - display as table
      this.displayExtractedDataAsTable(content);
    }
  },

  displayExtractedDataAsTable(data) {
    if (!this.extractedTableBody) return;

    // Clear existing content
    this.extractedTableBody.innerHTML = "";

    if (!data || (Array.isArray(data) && data.length === 0)) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.setAttribute("colspan", 5); // Number of table headers
      cell.textContent = "No data available";
      row.appendChild(cell);
      this.extractedTableBody.appendChild(row);
      return;
    }

    const dataArray = Array.isArray(data) ? data : [data];

    dataArray.forEach((item) => {
      const row = document.createElement("tr");

      // Create table cells for each property
      const dateCell = document.createElement("td");
      dateCell.textContent = item.date || "";
      row.appendChild(dateCell);

      const descriptionCell = document.createElement("td");
      descriptionCell.textContent = item.description || "";
      row.appendChild(descriptionCell);

      const documentCell = document.createElement("td");
      documentCell.textContent = item.document || "";
      row.appendChild(documentCell);

      const cashInCell = document.createElement("td");
      cashInCell.textContent = item.cashIn || "";
      row.appendChild(cashInCell);

      const cashOutCell = document.createElement("td");
      cashOutCell.textContent = item.cashOut || "";
      row.appendChild(cashOutCell);

      this.extractedTableBody.appendChild(row);
    });
  },

  switchToTableView() {
    if (this.tableViewContent) {
      this.tableViewContent.style.display = "block";
    }
    if (this.jsonViewContent) {
      this.jsonViewContent.style.display = "none";
    }
    if (this.tableViewButton) {
      this.tableViewButton.classList.add("active");
    }
    if (this.jsonViewButton) {
      this.jsonViewButton.classList.remove("active");
    }
  },

  switchToJsonView() {
    if (this.jsonViewContent) {
      this.jsonViewContent.style.display = "block";
    }
    if (this.tableViewContent) {
      this.tableViewContent.style.display = "none";
    }
    if (this.jsonViewButton) {
      this.jsonViewButton.classList.add("active");
    }
    if (this.tableViewButton) {
      this.tableViewButton.classList.remove("active");
    }
  },

  displayDataInTable(data) {
    if (this.dataBody) {
      this.dataBody.innerHTML = ""; // Clear existing data

      if (data.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.setAttribute("colspan", 8);
        cell.textContent = "No data available";
        row.appendChild(cell);
        this.dataBody.appendChild(row);
        return;
      }

      data.forEach((item) => {
        const row = document.createElement("tr");

        const columns = [
          "Document",
          "Date",
          "Description",
          "Trip/Event",
          "Category",
          "Income",
          "Expense",
          "Time-uploaded",
        ];
        columns.forEach((col) => {
          const cell = document.createElement("td");
          cell.textContent = item[col] || "";
          row.appendChild(cell);
        });

        this.dataBody.appendChild(row);
      });

      if (this.dataDisplay) {
        this.dataDisplay.style.display = "block";
      }
    }
  },

  displayTagsForEditing(tags, deleteHandler) {
    if (this.tagList) {
      this.tagList.innerHTML = "";
      this.tagList.style.display = "block";

      for (const type in tags) {
        const container = document.createElement("div");
        container.innerHTML = `<h4>${type}</h4>`;
        tags[type].forEach((tag) => {
          const tagEl = document.createElement("div");
          tagEl.textContent = tag;
          const deleteButton = document.createElement("button");
          deleteButton.textContent = "Delete";
          deleteButton.addEventListener("click", () =>
            deleteHandler(type, tag)
          );
          tagEl.appendChild(deleteButton);
          container.appendChild(tagEl);
        });
        this.tagList.appendChild(container);
      }
    }
  },

  // NEW: Display tags in table format with expense counts (dual column layout)
  displayTagsTable(tags, expenseCounts) {
    const tripEventTableBody = document.getElementById("trip-event-tags-table-body");
    const categoryTableBody = document.getElementById("category-tags-table-body");

    if (tripEventTableBody) {
      tripEventTableBody.innerHTML = "";

      const tripEventTags = tags["Trip/Event"] || [];

      if (tripEventTags.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.setAttribute("colspan", 2);
        cell.textContent = "No Trip/Event tags";
        cell.style.textAlign = "center";
        row.appendChild(cell);
        tripEventTableBody.appendChild(row);
      } else {
        tripEventTags.forEach(tag => {
          // Calculate expense count for this specific tag
          let count = 0;
          if (expenseCounts && expenseCounts["Trip/Event"] && expenseCounts["Trip/Event"][tag]) {
            count = expenseCounts["Trip/Event"][tag];
          }

          const row = document.createElement("tr");

          const valueCell = document.createElement("td");
          valueCell.textContent = tag;
          row.appendChild(valueCell);

          const countCell = document.createElement("td");
          countCell.textContent = count;
          row.appendChild(countCell);

          tripEventTableBody.appendChild(row);
        });
      }
    }

    if (categoryTableBody) {
      categoryTableBody.innerHTML = "";

      const categoryTags = tags["Category"] || [];

      if (categoryTags.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.setAttribute("colspan", 2);
        cell.textContent = "No Category tags";
        cell.style.textAlign = "center";
        row.appendChild(cell);
        categoryTableBody.appendChild(row);
      } else {
        categoryTags.forEach(tag => {
          // Calculate expense count for this specific tag
          let count = 0;
          if (expenseCounts && expenseCounts["Category"] && expenseCounts["Category"][tag]) {
            count = expenseCounts["Category"][tag];
          }

          const row = document.createElement("tr");

          const valueCell = document.createElement("td");
          valueCell.textContent = tag;
          row.appendChild(valueCell);

          const countCell = document.createElement("td");
          countCell.textContent = count;
          row.appendChild(countCell);

          categoryTableBody.appendChild(row);
        });
      }
    }
  },

  // NEW: Display tags in edit format with rename/delete buttons (not immediately editable)
  displayTagsForEdit(tags, changeHandler) {
    // Clean up any existing event listeners before clearing content
    if (this.editTripEventTags) {
      // Remove any previous event listeners
      const existingItems = this.editTripEventTags.querySelectorAll('.tag-edit-item');
      existingItems.forEach(item => {
        if (item.handleRenameClickOutside) {
          document.removeEventListener('click', item.handleRenameClickOutside);
        }
      });

      this.editTripEventTags.innerHTML = "";

      const tripEventTags = tags["Trip/Event"] || [];
      tripEventTags.forEach(tag => {
        const tagItem = document.createElement("div");
        tagItem.className = "tag-edit-item";
        tagItem.dataset.originalValue = tag;

        // Create a span to display the tag name (not editable by default)
        const tagSpan = document.createElement("span");
        tagSpan.textContent = tag;
        tagSpan.className = "tag-display";

        // Create rename button
        const renameButton = document.createElement("button");
        renameButton.textContent = "Rename";
        renameButton.className = "rename-btn";
        renameButton.addEventListener("click", function() {
          // Call the internal function with a reference to this UI object - need to get the UI context properly
          // Since this function is called on the UI object context, we need to access the UI object differently
          const uiRef = window.UI || this.constructor; // Try to get the UI object reference
          // For now, we'll use the window.UI approach since it's used in the startTagRename method too
          window.UI.startTagRename(tagItem, "Trip/Event", changeHandler);
        });

        // Create delete button
        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";
        deleteButton.className = "delete-btn";
        deleteButton.addEventListener("click", () => {
          // Remove the tag item from the UI
          tagItem.remove();
          // Call the change handler to track the deletion
          changeHandler("Trip/Event", tag, null);
        });

        tagItem.appendChild(tagSpan);
        tagItem.appendChild(renameButton);
        tagItem.appendChild(deleteButton);
        this.editTripEventTags.appendChild(tagItem);
      });
    }

    if (this.editCategoryTags) {
      // Clean up any existing event listeners before clearing content
      const existingItems = this.editCategoryTags.querySelectorAll('.tag-edit-item');
      existingItems.forEach(item => {
        if (item.handleRenameClickOutside) {
          document.removeEventListener('click', item.handleRenameClickOutside);
        }
      });

      this.editCategoryTags.innerHTML = "";

      const categoryTags = tags["Category"] || [];
      categoryTags.forEach(tag => {
        const tagItem = document.createElement("div");
        tagItem.className = "tag-edit-item";
        tagItem.dataset.originalValue = tag;

        // Create a span to display the tag name (not editable by default)
        const tagSpan = document.createElement("span");
        tagSpan.textContent = tag;
        tagSpan.className = "tag-display";

        // Create rename button
        const renameButton = document.createElement("button");
        renameButton.textContent = "Rename";
        renameButton.className = "rename-btn";
        renameButton.addEventListener("click", function() {
          // Call the internal function with a reference to this UI object - need to get the UI context properly
          window.UI.startTagRename(tagItem, "Category", changeHandler);
        });

        // Create delete button
        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";
        deleteButton.className = "delete-btn";
        deleteButton.addEventListener("click", () => {
          // Remove the tag item from the UI
          tagItem.remove();
          // Call the change handler to track the deletion
          changeHandler("Category", tag, null);
        });

        tagItem.appendChild(tagSpan);
        tagItem.appendChild(renameButton);
        tagItem.appendChild(deleteButton);
        this.editCategoryTags.appendChild(tagItem);
      });
    }
  },

  // NEW: Switch to table view
  showTagsTableView() {
    if (this.tagsTableContainer) {
      this.tagsTableContainer.style.display = "block";
    }
    if (this.tagsEditContainer) {
      this.tagsEditContainer.style.display = "none";
    }
  },

  // NEW: Switch to edit view
  showTagsEditView() {
    if (this.tagsEditContainer) {
      this.tagsEditContainer.style.display = "block";
    }
    if (this.tagsTableContainer) {
      this.tagsTableContainer.style.display = "none";
    }
  },

  getApiKey() {
    return this.apiKeyInput?.value;
  },

  showDataDisplay() {
    if (this.dataDisplay) {
      this.dataDisplay.style.display = "block";
    }
  },

  hideDataDisplay() {
    if (this.dataDisplay) {
      this.dataDisplay.style.display = "none";
    }
  },

  // NEW: Method to start tag renaming
  startTagRename: function(tagItem, type, changeHandler) {
    const originalValue = tagItem.dataset.originalValue;
    const tagSpan = tagItem.querySelector('.tag-display');
    const renameButton = tagItem.querySelector('.rename-btn');
    const deleteButton = tagItem.querySelector('.delete-btn');

    // Create input field with original value
    const input = document.createElement('input');
    input.type = 'text';
    input.value = originalValue;
    input.className = 'tag-input';

    // Create done button
    const doneButton = document.createElement('button');
    doneButton.textContent = 'Done';
    doneButton.className = 'done-btn';

    // Create cancel button
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.className = 'cancel-btn';

    // Replace the span with input and new buttons
    tagItem.innerHTML = '';
    tagItem.appendChild(input);
    tagItem.appendChild(doneButton);
    tagItem.appendChild(cancelButton);

    // Focus on the input
    input.focus();
    input.select();

    // Done button event - finalize the edit and revert to display mode
    doneButton.addEventListener('click', () => {
      if (input.value.trim() !== '' && input.value !== originalValue) {
        // Update the tag value in the Tags module (local only, tracked for later save)
        changeHandler(type, originalValue, input.value);
      }
      // Refresh the tag list to update the UI properly
      const allTags = window.Tags.getTags();
      this.displayTagsForEdit(allTags, changeHandler);
    });

    // Cancel button event
    cancelButton.addEventListener('click', () => {
      // Refresh the tag list to revert to original state
      const allTags = window.Tags.getTags();
      this.displayTagsForEdit(allTags, changeHandler);
    });

    // Enter key to finish editing (same as done button)
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (input.value.trim() !== '' && input.value !== originalValue) {
          // Update the tag value in the Tags module (local only, tracked for later save)
          changeHandler(type, originalValue, input.value);
        }
        // Refresh the tag list to update the UI properly
        const allTags = window.Tags.getTags();
        this.displayTagsForEdit(allTags, changeHandler);
      } else if (e.key === 'Escape') {
        // Cancel on Escape key
        const allTags = window.Tags.getTags();
        this.displayTagsForEdit(allTags, changeHandler);
      }
    });

    // Also cancel if clicked outside the element (treat as cancel)
    const self = this; // Capture the UI object context
    const handleClickOutside = function(event) {
      if (!tagItem.contains(event.target) &&
          event.target !== renameButton &&
          event.target !== deleteButton) {
        document.removeEventListener('click', handleClickOutside);
        // Refresh the tag list to revert to original state (cancel changes)
        const allTags = window.Tags.getTags();
        self.displayTagsForEdit(allTags, changeHandler);
      }
    };

    document.addEventListener('click', handleClickOutside);

    // Store the event listener function so we can remove it later
    tagItem.handleRenameClickOutside = handleClickOutside;
  }
};
