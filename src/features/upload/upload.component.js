// src/features/upload/upload.component.js
import store from '../../core/state.js';
import ApiService from '../../services/api.service.js';
import ExcelService from '../../services/excel.service.js';

class UploadComponent {
  constructor(element) {
    this.element = element;
    this.parsedData = [];
    this.render();
    this.attachEventListeners();
  }

  render() {
    this.element.innerHTML = `
      <div class="upload-container">
        <h3>Upload Excel File</h3>
        <p>Select an Excel file with transaction data to upload to the sheet.</p>
        <input type="file" id="file-upload" accept=".xlsx, .xls">
        <button id="upload-to-sheet-btn">Upload to Sheet</button>
        <div id="upload-status"></div>
        <div id="extracted-content-section" style="display: none;">
          <h4>Extracted Data</h4>
          <div class="view-toggle">
            <button id="table-view-btn" class="active">Table View</button>
            <button id="json-view-btn">JSON View</button>
          </div>
          <div id="table-view-content">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Document</th>
                  <th>Cash In</th>
                  <th>Cash Out</th>
                </tr>
              </thead>
              <tbody id="extracted-table-body"></tbody>
            </table>
          </div>
          <div id="json-view-content" style="display: none;">
            <pre><code id="file-content-json"></code></pre>
          </div>
        </div>
      </div>
    `;

    this.fileUpload = this.element.querySelector('#file-upload');
    this.uploadButton = this.element.querySelector('#upload-to-sheet-btn');
    this.uploadStatus = this.element.querySelector('#upload-status');
    this.extractedContentSection = this.element.querySelector('#extracted-content-section');
    this.tableViewContent = this.element.querySelector('#table-view-content');
    this.jsonViewContent = this.element.querySelector('#json-view-content');
    this.extractedTableBody = this.element.querySelector('#extracted-table-body');
    this.tableViewButton = this.element.querySelector('#table-view-btn');
    this.jsonViewButton = this.element.querySelector('#json-view-btn');
    this.fileContentJson = this.element.querySelector('#file-content-json');
  }

  attachEventListeners() {
    this.fileUpload.addEventListener('change', this.handleFileSelect.bind(this));
    this.uploadButton.addEventListener('click', this.handleUpload.bind(this));
    this.tableViewButton.addEventListener('click', this.switchToTableView.bind(this));
    this.jsonViewButton.addEventListener('click', this.switchToJsonView.bind(this));
  }

  async handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) {
      this.displayUploadStatus('Please select a file.', 'info');
      this.extractedContentSection.style.display = 'none';
      return;
    }

    try {
      this.parsedData = await ExcelService.parseFile(file);
      this.displayExtractedData();
      this.extractedContentSection.style.display = 'block';
    } catch (error) {
      console.error(error);
      this.displayUploadStatus(`Error reading file: ${error.message}`, 'error');
      this.extractedContentSection.style.display = 'none';
    }
  }

  displayExtractedData() {
    this.fileContentJson.textContent = JSON.stringify(this.parsedData, null, 2);
    
    this.extractedTableBody.innerHTML = '';
    if (!this.parsedData || this.parsedData.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.setAttribute("colspan", 5);
        cell.textContent = "No data available";
        row.appendChild(cell);
        this.extractedTableBody.appendChild(row);
        return;
    }

    this.parsedData.forEach((item) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${item.date || ""}</td>
            <td>${item.description || ""}</td>
            <td>${item.document || ""}</td>
            <td>${item.cashIn || ""}</td>
            <td>${item.cashOut || ""}</td>
        `;
        this.extractedTableBody.appendChild(row);
    });
    this.switchToTableView();
  }

  switchToTableView() {
    this.tableViewContent.style.display = 'block';
    this.jsonViewContent.style.display = 'none';
    this.tableViewButton.classList.add('active');
    this.jsonViewButton.classList.remove('active');
  }

  switchToJsonView() {
    this.jsonViewContent.style.display = 'block';
    this.tableViewContent.style.display = 'none';
    this.jsonViewButton.classList.add('active');
    this.tableViewButton.classList.remove('active');
  }

  async handleUpload() {
    if (!this.parsedData || this.parsedData.length === 0) {
      this.displayUploadStatus('No data to upload.', 'error');
      return;
    }

    this.displayUploadStatus('Checking for duplicates...', 'info');

    try {
      const existingData = store.getState('expenses') || [];
      const newRecords = this._findUniqueRecords(this.parsedData, existingData);

      if (newRecords.length === 0) {
        this.displayUploadStatus('No new records to upload.', 'success');
        return;
      }

      this.displayUploadStatus(`Uploading ${newRecords.length} new records...`, 'info');
      await this._uploadInChunks(newRecords);

    } catch (error) {
      this.displayUploadStatus(`Error uploading data: ${error.message}`, 'error');
    }
  }

  async _uploadInChunks(records) {
    const recordsPerChunk = 20;
    const totalChunks = Math.ceil(records.length / recordsPerChunk);

    for (let i = 0; i < totalChunks; i++) {
        const start = i * recordsPerChunk;
        const end = start + recordsPerChunk;
        const chunk = records.slice(start, end);
        this.displayUploadStatus(`Uploading chunk ${i + 1} of ${totalChunks}...`, 'info');
        await ApiService.saveData(chunk);
    }
    
    this.displayUploadStatus(`Successfully uploaded ${records.length} records!`, 'success');
    // Here we should trigger a refresh of the application data.
    // The main app component will listen for a 'dataUploaded' event or similar.
    document.dispatchEvent(new CustomEvent('dataUploaded'));
  }

  displayUploadStatus(message, type) {
    this.uploadStatus.innerHTML = `<div class="status-message ${type}">${message}</div>`;
  }

  // Moved from data.js
  _normalizeDateString(dateValue) {
    if (!dateValue) return "";
    let dateString = String(dateValue).trim();
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateString)) {
        const parts = dateString.split("/");
        return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }
    if (dateString.includes("T")) {
        return dateString.split("T")[0];
    }
    if (/\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/.test(dateString)) {
        return dateString.split(" ")[0];
    }
    return dateString;
  }

  _normalizeValue(value) {
    if (value === null || value === undefined) return "";
    return String(value).trim();
  }

  _formatNumberForComparison(value) {
    if (value === null || value === undefined || value === "") return "";
    return String(value).trim().replace(/,/g, "");
  }

  _findUniqueRecords(newData, existingData) {
    const existingKeys = new Set(existingData.map(row => {
      const dateStr = this._normalizeDateString(row.Date);
      const descriptionStr = this._normalizeValue(row.Description);
      const documentStr = this._normalizeValue(row.Document);
      const incomeStr = this._normalizeValue(this._formatNumberForComparison(row.Income));
      const expenseStr = this._normalizeValue(this._formatNumberForComparison(row.Expense));
      return `${dateStr}|${descriptionStr}|${documentStr}|${incomeStr}|${expenseStr}`;
    }));

    return newData.filter(row => {
      const dateStr = this._normalizeDateString(row.date);
      const descriptionStr = this._normalizeValue(row.description);
      const documentStr = this._normalizeValue(row.document);
      const incomeStr = this._normalizeValue(this._formatNumberForComparison(row.cashIn));
      const expenseStr = this._normalizeValue(this._formatNumberForComparison(row.cashOut));
      const key = `${dateStr}|${descriptionStr}|${documentStr}|${incomeStr}|${expenseStr}`;
      return !existingKeys.has(key);
    });
  }
}

export default UploadComponent;
