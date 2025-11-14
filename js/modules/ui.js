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
};
