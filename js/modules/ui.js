// js/modules/ui.js

export const UI = {
  loginButton: document.getElementById('login-button'),
  apiKeyInput: document.getElementById('api-key'),
  errorMessage: document.getElementById('error-message'),
  loginContainer: document.getElementById('login-container'),
  mainMenu: document.getElementById('main-menu'),
  fileUpload: document.getElementById('file-upload'),
  fileContent: document.getElementById('file-content'),
  uploadButton: document.getElementById('upload-to-sheet'),
  loadDataButton: document.getElementById('load-from-sheet'),
  dataDisplay: document.getElementById('data-display'),
  dataBody: document.getElementById('data-body'),
  tagStatus: document.getElementById('tag-status'),
  tagList: document.getElementById('tag-list'),

  showLogin() {
    this.loginContainer.style.display = 'block';
    this.mainMenu.style.display = 'none';
  },

  showMainMenu() {
    this.loginContainer.style.display = 'none';
    this.mainMenu.style.display = 'block';
  },

  showStatusMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.className = `status-message ${type}`;
  },

  displayDataInTable(data) {
    this.dataBody.innerHTML = ''; // Clear existing data

    if (data.length === 0) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.setAttribute('colspan', 8);
      cell.textContent = 'No data available';
      row.appendChild(cell);
      this.dataBody.appendChild(row);
      return;
    }

    data.forEach(item => {
      const row = document.createElement('tr');

      const columns = ['Document', 'Date', 'Description', 'Trip/Event', 'Category', 'Income', 'Expense', 'Time-uploaded'];
      columns.forEach(col => {
        const cell = document.createElement('td');
        cell.textContent = item[col] || '';
        row.appendChild(cell);
      });

      this.dataBody.appendChild(row);
    });

    this.dataDisplay.style.display = 'block';
  },

  displayTagsForEditing(tags, deleteHandler) {
    this.tagList.innerHTML = '';
    this.tagList.style.display = 'block';

    for (const type in tags) {
      const container = document.createElement('div');
      container.innerHTML = `<h4>${type}</h4>`;
      tags[type].forEach(tag => {
        const tagEl = document.createElement('div');
        tagEl.textContent = tag;
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', () => deleteHandler(type, tag));
        tagEl.appendChild(deleteButton);
        container.appendChild(tagEl);
      });
      this.tagList.appendChild(container);
    }
  },

  getApiKey() {
    return this.apiKeyInput.value;
  },

  setFileContent(content) {
    this.fileContent.textContent = content;
  },

  showDataDisplay() {
    this.dataDisplay.style.display = 'block';
  },

  hideDataDisplay() {
    this.dataDisplay.style.display = 'none';
  }
};
