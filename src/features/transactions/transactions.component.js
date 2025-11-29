// src/features/transactions/transactions.component.js
import store from '../../core/state.js';
import ApiService from '../../services/api.service.js';

class TransactionsComponent {
  constructor(element) {
    this.element = element;
    this.transactionData = [];
    this.originalTransactionData = [];
    this.changes = {};
    this.sortState = { field: 'Date', ascending: false };
    this.selectionMode = false;
    this.selectedRows = new Set();
    this.render();
    store.subscribe('expenses', (data) => this.handleDataChange(data));
    store.subscribe('tags', () => this.updateFilterDropdowns());
    store.subscribe('isTagging', () => this.renderTransactionsDisplay());
    store.subscribe('taggingProgress', () => this.updateProgressDisplay());
  }

  render() {
    this.element.innerHTML = `
        <div id="transactions-display"></div>
    `;
    this.transactionsDisplay = this.element.querySelector('#transactions-display');
    this.renderTransactionsDisplay();
  }

  renderTransactionsDisplay() {
    const isTagging = store.getState('isTagging');
    const taggingProgress = store.getState('taggingProgress') || 'Initializing...';

    if (isTagging) {
        this.transactionsDisplay.innerHTML = `
            <div class="section" style="height: 400px; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                <div class="loader" style="width: 50px; height: 50px; margin-bottom: 20px;"></div>
                <h3 style="color: #f0ad4e; margin-bottom: 10px;">Applying Tags...</h3>
                <p id="tagging-progress-text" style="color: #fff; font-size: 1.1em;">${taggingProgress}</p>
            </div>
        `;
        return;
    }

    this.transactionsDisplay.innerHTML = `
        <div class="section">
            <div class="transactions-header">
                <h2>All Transactions</h2>
            </div>
            
            <!-- Controls Toolbar -->
            <div id="main-controls" class="transaction-controls">
                
                <!-- Filters -->
                <div class="control-group">
                    <label class="control-label">FILTER BY</label>
                    <div class="control-inputs">
                         <select id="filter-trip-event" class="theme-select wide">
                            <option value="">All Trips/Events</option>
                         </select>
                         <select id="filter-category" class="theme-select wide">
                            <option value="">All Categories</option>
                         </select>
                    </div>
                </div>

                <!-- Sorting -->
                <div class="control-group">
                    <label class="control-label">SORT BY</label>
                     <div class="control-inputs">
                        <select id="sort-field" class="theme-select">
                            <option value="Date">Date</option>
                            <option value="Income">Income</option>
                            <option value="Expense">Expense</option>
                        </select>
                        <select id="sort-order" class="theme-select">
                            <option value="desc">Desc (High-Low)</option>
                            <option value="asc">Asc (Low-High)</option>
                        </select>
                    </div>
                </div>
                
                <div style="flex-grow: 1;"></div>

                <div class="transaction-actions">
                    <button id="tag-transactions-btn" class="secondary-btn">Bulk Tagging Mode</button>
                </div>

            </div>

            <!-- Bulk Actions Toolbar (Hidden by default) -->
            <div id="bulk-actions-toolbar" class="bulk-actions-toolbar">
                <div class="bulk-actions-content">
                    <strong class="bulk-label">BULK ACTIONS:</strong>
                    <select id="bulk-trip-event" class="theme-select">
                        <option value="">Set Trip/Event...</option>
                    </select>
                    <select id="bulk-category" class="theme-select">
                        <option value="">Set Category...</option>
                    </select>
                    <div style="flex-grow: 1;"></div>
                    <span id="selection-count" class="selection-count">0 selected</span>
                    <button id="bulk-apply-btn" class="secondary-btn" style="background-color: #f0ad4e; color: white;">Apply Tags</button>
                    <button id="bulk-cancel-btn" class="secondary-btn" style="border-color: #d9534f; color: #d9534f;">Cancel</button>
                </div>
            </div>

            <table id="transactions-table" class="section-table">
                <thead>
                    <tr>
                        <th id="select-all-header"><input type="checkbox" id="select-all-checkbox"></th>
                        <th data-sort="Date" class="sortable" style="cursor: pointer;">Date</th>
                        <th data-sort="Description" class="sortable" style="cursor: pointer;">Description</th>
                        <th data-sort="Trip/Event" class="sortable" style="cursor: pointer;">Trip/Event</th>
                        <th data-sort="Category" class="sortable" style="cursor: pointer;">Category</th>
                        <th data-sort="Income" class="sortable" style="cursor: pointer;">Income</th>
                        <th data-sort="Expense" class="sortable" style="cursor: pointer;">Expense</th>
                    </tr>
                </thead>
                <tbody id="transactions-tbody"></tbody>
            </table>
        </div>
    `;
    this.tbody = this.element.querySelector('#transactions-tbody');
    
    // Filters
    this.filterTripEvent = this.element.querySelector('#filter-trip-event');
    this.filterCategory = this.element.querySelector('#filter-category');
    
    // Sorting
    this.sortField = this.element.querySelector('#sort-field');
    this.sortOrder = this.element.querySelector('#sort-order');
    
    // Bulk Actions
    this.tagTransactionsBtn = this.element.querySelector('#tag-transactions-btn');
    this.bulkToolbar = this.element.querySelector('#bulk-actions-toolbar');
    this.mainControls = this.element.querySelector('#main-controls');
    this.bulkTripEvent = this.element.querySelector('#bulk-trip-event');
    this.bulkCategory = this.element.querySelector('#bulk-category');
    this.selectAllHeader = this.element.querySelector('#select-all-header');
    this.selectAllCheckbox = this.element.querySelector('#select-all-checkbox');
    this.selectionCount = this.element.querySelector('#selection-count');

    // Event Listeners
    this.tagTransactionsBtn.addEventListener('click', () => this.toggleSelectionMode(true));
    
    this.element.querySelector('#bulk-cancel-btn').addEventListener('click', () => this.toggleSelectionMode(false));
    this.element.querySelector('#bulk-apply-btn').addEventListener('click', () => this.applyBulkTags());
    
    this.selectAllCheckbox.addEventListener('change', (e) => {
        const checked = e.target.checked;
        if (checked) {
             // Select all currently visible
             this.transactionData.forEach(item => this.selectedRows.add(item.row));
        } else {
             this.selectedRows.clear();
        }
        this.displayTransactions(this.transactionData);
        this.updateSelectionCount();
    });

    // Header click sorting
    this.element.querySelectorAll('#transactions-table th.sortable').forEach(th => {
        th.addEventListener('click', () => {
             const field = th.dataset.sort;
             if (['Date', 'Income', 'Expense'].includes(field)) {
                 this.sortField.value = field;
             }
             this.sortTransactions(field);
             this.sortOrder.value = this.sortState.ascending ? 'asc' : 'desc';
        });
    });

    this.filterTripEvent.addEventListener('change', () => this.filterTransactions());
    this.filterCategory.addEventListener('change', () => this.filterTransactions());
    
    this.sortField.addEventListener('change', () => this.sortTransactions(this.sortField.value, true));
    this.sortOrder.addEventListener('change', () => {
        this.sortState.ascending = this.sortOrder.value === 'asc';
        this.sortTransactions(this.sortField.value, true);
    });

    // Initialize dropdowns
    this.sortField.value = this.sortState.field;
    this.sortOrder.value = this.sortState.ascending ? 'asc' : 'desc';

    // If returning from tagging, these might be null initially if we just rendered the loading view
    if (this.selectionMode) {
         this.toggleSelectionMode(true); // Re-apply visual state
    } else {
         this.displayTransactions(this.transactionData);
    }
    
    this.updateFilterDropdowns();
  }

  updateProgressDisplay() {
      const progressText = this.element.querySelector('#tagging-progress-text');
      if (progressText) {
          progressText.textContent = store.getState('taggingProgress');
      }
  }

  toggleSelectionMode(active) {
      this.selectionMode = active;
      if (!active) {
          this.selectedRows.clear();
      }
      
      // Elements might not exist if we are in "isTagging" view
      if (!this.bulkToolbar || !this.mainControls) return;

      this.updateSelectionCount();
      if (this.selectAllCheckbox) this.selectAllCheckbox.checked = false;

      if (active) {
          this.bulkToolbar.style.display = 'block';
          this.mainControls.classList.add('disabled');
          this.selectAllHeader.style.display = 'table-cell';
      } else {
          this.bulkToolbar.style.display = 'none';
          this.mainControls.classList.remove('disabled');
          this.selectAllHeader.style.display = 'none';
      }
      this.displayTransactions(this.transactionData);
  }

  updateSelectionCount() {
      if (this.selectionCount) {
          this.selectionCount.textContent = `${this.selectedRows.size} selected`;
      }
  }

  async applyBulkTags() {
      if (this.selectedRows.size === 0) return;

      const tripVal = this.bulkTripEvent.value;
      const catVal = this.bulkCategory.value;

      if (!tripVal && !catVal) return; 

      const changesList = [];
      
      this.selectedRows.forEach(rowId => {
          const original = this.originalTransactionData.find(t => t.row == rowId);
          if (original) {
              const update = { row: rowId }; 
              
              // Handle Trip/Event
              if (tripVal === '__REMOVE__') {
                  update.tripEvent = ""; 
              } else if (tripVal) {
                  update.tripEvent = tripVal; 
              } else {
                  update.tripEvent = original['Trip/Event'] || "";
              }

              // Handle Category
              if (catVal === '__REMOVE__') {
                  update.category = "";
              } else if (catVal) {
                  update.category = catVal;
              } else {
                  update.category = original['Category'] || "";
              }

              changesList.push(update);
          }
      });

      if (changesList.length === 0) return;

      store.setState('isTagging', true);
      
      // Chunking Logic - 20 to avoid URL length limits
      const CHUNK_SIZE = 20; 
      const totalChunks = Math.ceil(changesList.length / CHUNK_SIZE);

      try {
          for (let i = 0; i < totalChunks; i++) {
              const start = i * CHUNK_SIZE;
              const end = start + CHUNK_SIZE;
              const chunk = changesList.slice(start, end);
              
              store.setState('taggingProgress', `Uploading batch ${i + 1} of ${totalChunks}...`);
              
              // We use skipLoading: true because we handle the UI state manually here via isTagging
              await ApiService.updateExpenses(chunk, { skipLoading: true });
          }

          this.changes = {};
          this.toggleSelectionMode(false);
          store.setState('taggingProgress', 'Completed!');
          
          // Short delay to show completion message before triggering full refresh
          setTimeout(() => {
               // Trigger full refresh first (which sets isLoading=true and hides this view)
               document.dispatchEvent(new CustomEvent('dataUploaded'));
               // Then reset local state
               store.setState('isTagging', false);
          }, 1000);

      } catch (error) {
          console.error("Bulk tagging failed:", error);
          store.setState('taggingProgress', `Error: ${error.message}`);
          setTimeout(() => {
               store.setState('isTagging', false);
          }, 3000);
      }
  }

  handleDataChange(data) {
    this.transactionData = [...data];
    this.originalTransactionData = [...data];
    if (!store.getState('isTagging')) {
        this.renderTransactionsDisplay();
    }
  }
  
  displayTransactions(data) {
    if (!this.tbody) return;
    this.tbody.innerHTML = '';
    if (!data || data.length === 0) {
        const row = document.createElement('tr');
        const colSpan = this.selectionMode ? 7 : 6;
        row.innerHTML = `<td colspan="${colSpan}">No transactions found.</td>`;
        this.tbody.appendChild(row);
        return;
    }

    data.forEach(item => {
      const row = document.createElement('tr');
      const isSelected = this.selectedRows.has(item.row);
      
      let checkboxCell = '';
      if (this.selectionMode) {
          checkboxCell = `<td><input type="checkbox" class="row-select" data-row="${item.row}" ${isSelected ? 'checked' : ''}></td>`;
      }

      row.innerHTML = `
        ${checkboxCell}
        <td>${item.Date || ''}</td>
        <td>${item.Description || ''}</td>
        <td>${item['Trip/Event'] || ''}</td>
        <td>${item.Category || ''}</td>
        <td>${item.Income || ''}</td>
        <td>${item.Expense || ''}</td>
      `;
      
      if (this.selectionMode) {
          // Add click listener for the checkbox
          const checkbox = row.querySelector('.row-select');
          checkbox.addEventListener('change', (e) => {
              if (e.target.checked) {
                  this.selectedRows.add(item.row);
              } else {
                  this.selectedRows.delete(item.row);
              }
              this.updateSelectionCount();
          });
          
          // Click row to toggle
           row.addEventListener('click', (e) => {
               if (e.target !== checkbox) {
                   checkbox.checked = !checkbox.checked;
                   checkbox.dispatchEvent(new Event('change'));
               }
           });
           row.style.cursor = 'pointer';
      }

      this.tbody.appendChild(row);
    });
  }

  updateFilterDropdowns() {
    const tags = store.getState('tags');
    if (!tags || !this.filterTripEvent) return;

    const createOptions = (select, options) => {
        const currentValue = select.value;
        select.innerHTML = '<option value="">All</option>';
        (options || []).forEach(option => {
            const opt = document.createElement('option');
            opt.value = option;
            opt.textContent = option;
            select.appendChild(opt);
        });
        select.value = currentValue;
    };
    
    createOptions(this.filterTripEvent, tags['Trip/Event']);
    createOptions(this.filterCategory, tags['Category']);
    
    // Also update bulk dropdowns if they exist
    if (this.bulkTripEvent) {
        const populate = (select, options, defaultText) => {
            const current = select.value;
            select.innerHTML = `<option value="">${defaultText}</option>`;
            
            // Add No Tag option
            const noTag = document.createElement('option');
            noTag.value = '__REMOVE__';
            noTag.textContent = 'No tag';
            select.appendChild(noTag);
            
            (options || []).forEach(opt => {
                const el = document.createElement('option');
                el.value = opt;
                el.textContent = opt;
                select.appendChild(el);
            });
            select.value = current;
        }
        populate(this.bulkTripEvent, tags['Trip/Event'], 'Set Trip/Event...');
        populate(this.bulkCategory, tags['Category'], 'Set Category...');
    }
  }

  filterTransactions() {
    const tripEventFilter = this.filterTripEvent.value;
    const categoryFilter = this.filterCategory.value;

    this.transactionData = this.originalTransactionData.filter(item => {
        const tripEventMatch = !tripEventFilter || item['Trip/Event'] === tripEventFilter;
        const categoryMatch = !categoryFilter || item['Category'] === categoryFilter;
        return tripEventMatch && categoryMatch;
    });
    this.displayTransactions(this.transactionData);
  }

  sortTransactions(field, force = false) {
    if (!force) {
        if (this.sortState.field === field) {
            this.sortState.ascending = !this.sortState.ascending;
        } else {
            this.sortState.field = field;
            this.sortState.ascending = true;
        }
    }

    this.transactionData.sort((a, b) => {
        let valA = a[field] || '';
        let valB = b[field] || '';

        if (field === 'Date') {
            valA = new Date(valA);
            valB = new Date(valB);
        }

        // Number sorting for Income/Expense
        if (field === 'Income' || field === 'Expense') {
             valA = parseFloat(valA) || 0;
             valB = parseFloat(valB) || 0;
        }

        if (valA < valB) return this.sortState.ascending ? -1 : 1;
        if (valA > valB) return this.sortState.ascending ? 1 : -1;
        return 0;
    });

    this.displayTransactions(this.transactionData);
  }
}

export default TransactionsComponent;