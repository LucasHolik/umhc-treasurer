// src/features/transactions/transactions.component.js
import store from '../../core/state.js';
import ApiService from '../../services/api.service.js';
import TransactionsTable from './transactions.table.js';
import TransactionsFilters from './transactions.filters.js';
import TransactionsBulk from './transactions.bulk.js';
import * as TransactionsLogic from './transactions.logic.js';

class TransactionsComponent {
  constructor(element) {
    this.element = element;
    this.transactionData = [];
    this.originalTransactionData = [];
    
    // State
    this.sortState = { field: 'Date', ascending: false };
    this.selectionMode = false;
    this.selectedRows = new Set();
    
    this.selectedCategories = new Set();
    this.selectedTrips = new Set();
    this.categorySearchTerm = '';
    this.tripSearchTerm = '';

    this.render();
    store.subscribe('expenses', (data) => this.handleDataChange(data));
    store.subscribe('tags', () => this.handleTagsChange());
    store.subscribe('isTagging', () => this.renderTransactionsDisplay());
    store.subscribe('taggingProgress', () => this.updateProgressDisplay());

    // Global click listener to close dropdowns
    document.addEventListener('click', (e) => this.handleGlobalClick(e));
  }

  handleGlobalClick(e) {
      if (this.selectionMode && this.bulkComponent) {
          this.bulkComponent.handleGlobalClick(e);
      }
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
                
                <!-- New Tag Filters (Analysis Style) -->
                <div class="control-group" style="flex-grow: 1;">
                    <label class="control-label">Filter Tags</label>
                    <div class="tag-filters-container">
                        <!-- Trip Filter -->
                        <div class="tag-filter-column">
                            <div class="tag-filter-header">Trips / Events</div>
                            <input type="text" id="trip-search" class="tag-search-input" placeholder="Search trips..." value="${this.tripSearchTerm}">
                            <div id="trip-selector-container" class="tag-selector">
                                <div style="padding: 5px; color: rgba(255,255,255,0.5);">Loading...</div>
                            </div>
                        </div>
                        
                        <!-- Category Filter -->
                        <div class="tag-filter-column">
                            <div class="tag-filter-header">Categories</div>
                            <input type="text" id="cat-search" class="tag-search-input" placeholder="Search categories..." value="${this.categorySearchTerm}">
                            <div id="category-selector-container" class="tag-selector">
                                <div style="padding: 5px; color: rgba(255,255,255,0.5);">Loading...</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Sorting -->
                <div class="control-group" style="min-width: 200px;">
                    <label class="control-label">SORT BY</label>
                     <div class="control-inputs" style="flex-direction: column;">
                        <select id="sort-field" class="theme-select" style="width: 100%;">
                            <option value="Date">Date</option>
                            <option value="Income">Income</option>
                            <option value="Expense">Expense</option>
                            <option value="Net">Money In/Out</option>
                        </select>
                        <select id="sort-order" class="theme-select" style="width: 100%;">
                            <option value="desc">Desc (High-Low)</option>
                            <option value="asc">Asc (Low-High)</option>
                        </select>
                    </div>
                </div>
                
                <div class="transaction-actions" style="align-self: flex-start; margin-top: 22px;">
                    <button id="tag-transactions-btn" class="secondary-btn">Bulk Tagging Mode</button>
                </div>

            </div>

            <!-- Bulk Actions Toolbar (Hidden by default) -->
            <div id="bulk-actions-toolbar" class="bulk-actions-toolbar">
                <div class="bulk-actions-content">
                    <strong class="bulk-label">BULK ACTIONS:</strong>
                    
                    <!-- Custom Trip Dropdown -->
                    <div class="custom-dropdown" id="bulk-trip-container">
                        <div class="dropdown-trigger" id="bulk-trip-trigger">Set Trip/Event...</div>
                        <div class="dropdown-content" id="bulk-trip-content" style="display:none;">
                            <input type="text" class="tag-search-input" id="bulk-trip-search" placeholder="Search trips...">
                            <div class="tag-selector" id="bulk-trip-list"></div>
                        </div>
                    </div>

                    <!-- Custom Category Dropdown -->
                    <div class="custom-dropdown" id="bulk-category-container">
                        <div class="dropdown-trigger" id="bulk-category-trigger">Set Category...</div>
                        <div class="dropdown-content" id="bulk-category-content" style="display:none;">
                            <input type="text" class="tag-search-input" id="bulk-category-search" placeholder="Search categories...">
                            <div class="tag-selector" id="bulk-category-list"></div>
                        </div>
                    </div>

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
    
    this.initializeSubComponents();
    this.initializeSorting();

    // Restore UI state if returning from loading
    if (this.selectionMode) {
        this.toggleSelectionMode(true);
    } else {
        this.applyFiltersAndSort();
    }
    
    this.handleTagsChange(); // Populate filters
  }

  initializeSubComponents() {
      // Table
      this.tableComponent = new TransactionsTable(this.transactionsDisplay, {
          onSort: (field) => this.handleSort(field),
          onSelectAll: (checked) => this.handleSelectAll(checked),
          onRowSelect: (rowId, checked) => this.handleRowSelect(rowId, checked)
      });

      // Filters
      this.filtersComponent = new TransactionsFilters(this.transactionsDisplay, {
          onFilterChange: (type, tag, checked) => this.handleFilterChange(type, tag, checked),
          onFilterSelectAll: (type, tags, checked) => this.handleFilterSelectAll(type, tags, checked),
          onSearchChange: (type, term) => this.handleSearchChange(type, term)
      });

      // Bulk
      this.bulkComponent = new TransactionsBulk(this.transactionsDisplay, {
          onToggleMode: (active) => this.toggleSelectionMode(active),
          onApply: (tripVal, catVal) => this.applyBulkTags(tripVal, catVal)
      });
  }

  initializeSorting() {
    this.sortField = this.element.querySelector('#sort-field');
    this.sortOrder = this.element.querySelector('#sort-order');
    
    if (this.sortField && this.sortOrder) {
        this.sortField.value = this.sortState.field;
        this.updateSortDropdownOptions(); // Ensure correct options for Net/etc
        this.sortOrder.value = this.sortState.ascending ? 'asc' : 'desc';

        this.sortField.addEventListener('change', () => {
            this.updateSortDropdownOptions();
            this.handleSort(this.sortField.value, true);
        });
        this.sortOrder.addEventListener('change', () => {
            this.sortState.ascending = this.sortOrder.value === 'asc';
            this.handleSort(this.sortField.value, true);
        });
    }
  }

  updateSortDropdownOptions() {
      const field = this.sortField.value;
      const currentOrder = this.sortOrder.value;
      
      this.sortOrder.innerHTML = '';
      
      if (field === 'Net') {
          this.sortOrder.add(new Option('Money In First', 'desc'));
          this.sortOrder.add(new Option('Money Out First', 'asc'));
      } else {
          this.sortOrder.add(new Option('Desc (High-Low)', 'desc'));
          this.sortOrder.add(new Option('Asc (Low-High)', 'asc'));
      }
      this.sortOrder.value = currentOrder;
  }

  handleDataChange(data) {
    this.transactionData = [...data];
    this.originalTransactionData = [...data];
    this.applyFiltersAndSort(); 
  }

  handleTagsChange() {
      if (!this.filtersComponent || !this.bulkComponent) return;
      
      const tagsData = store.getState('tags') || {};
      
      // Update Main Filters
      this.filtersComponent.renderTagLists(
          tagsData, 
          this.selectedCategories, 
          this.selectedTrips, 
          this.categorySearchTerm, 
          this.tripSearchTerm
      );

      // Update Bulk Dropdowns
      this.bulkComponent.renderBulkTagLists();
  }

  // --- Filtering & Sorting ---

  handleSearchChange(type, term) {
      if (type === 'Category') this.categorySearchTerm = term.toLowerCase();
      if (type === 'Trip/Event') this.tripSearchTerm = term.toLowerCase();
      this.handleTagsChange(); // Re-render lists with new search term
  }

  handleFilterChange(type, tag, checked) {
      const set = type === 'Category' ? this.selectedCategories : this.selectedTrips;
      if (checked) set.add(tag);
      else set.delete(tag);
      
      // Update "Select All" state visuals by re-rendering lists? 
      // Or just rely on filter update. 
      // Ideally we re-render lists to update checkboxes, but that might lose focus on inputs?
      // The input is separate, checkboxes are separate.
      this.handleTagsChange(); 
      this.applyFiltersAndSort();
  }

  handleFilterSelectAll(type, tags, checked) {
      const set = type === 'Category' ? this.selectedCategories : this.selectedTrips;
      tags.forEach(tag => {
          if (checked) set.add(tag);
          else set.delete(tag);
      });
      this.handleTagsChange();
      this.applyFiltersAndSort();
  }

  handleSort(field, force = false) {
    if (!force) {
        if (this.sortState.field === field) {
            this.sortState.ascending = !this.sortState.ascending;
        } else {
            this.sortState.field = field;
            this.sortState.ascending = true;
        }
    }
    
    // Sync dropdowns if triggered from table header
    if (this.sortField && this.sortField.value !== this.sortState.field) {
        this.sortField.value = this.sortState.field;
        this.updateSortDropdownOptions();
    }
    if (this.sortOrder) {
        this.sortOrder.value = this.sortState.ascending ? 'asc' : 'desc';
    }

    this.applyFiltersAndSort();
  }

  applyFiltersAndSort() {
      // 1. Filter
      let data = TransactionsLogic.filterData(this.originalTransactionData, {
          selectedCategories: this.selectedCategories,
          selectedTrips: this.selectedTrips
      });

      // 2. Sort
      this.transactionData = TransactionsLogic.sortData(data, this.sortState.field, this.sortState.ascending);

      // 3. Render
      if (this.tableComponent) {
          this.tableComponent.render(this.transactionData, this.selectionMode, this.selectedRows);
      }
  }

  // --- Bulk Actions & Selection ---

  toggleSelectionMode(active) {
      this.selectionMode = active;
      
      if (!active) {
          this.selectedRows.clear();
      }

      if (this.bulkComponent) {
          this.bulkComponent.toggleSelectionMode(active, this.selectedRows.size);
      }
      
      if (this.tableComponent) {
          this.tableComponent.toggleSelectionMode(active);
          this.tableComponent.render(this.transactionData, active, this.selectedRows);
      }
  }

  handleSelectAll(checked) {
      if (checked) {
           // Select all currently visible
           this.transactionData.forEach(item => this.selectedRows.add(item.row));
      } else {
           this.selectedRows.clear();
      }
      this.updateSelectionUI();
  }

  handleRowSelect(rowId, checked) {
      if (checked) this.selectedRows.add(rowId);
      else this.selectedRows.delete(rowId);
      this.updateSelectionUI();
  }

  updateSelectionUI() {
      if (this.bulkComponent) {
          this.bulkComponent.updateSelectionCount(this.selectedRows.size);
      }
      // Re-render table to update checkbox states (inefficient but robust)
      // Or we could just let the checkbox state be managed by DOM, 
      // but re-render ensures consistency with data model.
      // Given DOM manipulation in `tableComponent` renders checked state based on set, we might not need full render if we just clicked one.
      // But "Select All" definitely needs it. 
      // Let's trust `tableComponent.render` is fast enough for now. 
      // Actually, `handleRowSelect` comes from a change event, so the checkbox is ALREADY checked. 
      // We don't need to re-render logic for single row select unless we want to update other UI.
  }

  async applyBulkTags(tripVal, catVal) {
      if (this.selectedRows.size === 0) return;

      const changesList = [];
      
      this.selectedRows.forEach(rowId => {
          const original = this.originalTransactionData.find(t => t.row == rowId);
          if (original) {
              let newTripEvent, newCategory;

              // Handle Trip/Event
              if (tripVal === '__REMOVE__') {
                  newTripEvent = ""; 
              } else if (tripVal) {
                  newTripEvent = tripVal; 
              } else {
                  newTripEvent = original['Trip/Event'] || "";
              }

              // Handle Category
              if (catVal === '__REMOVE__') {
                  newCategory = "";
              } else if (catVal) {
                  newCategory = catVal;
              } else {
                  newCategory = original['Category'] || "";
              }

              const currentTripEvent = original['Trip/Event'] || "";
              const currentCategory = original['Category'] || "";

              if (newTripEvent !== currentTripEvent || newCategory !== currentCategory) {
                  changesList.push({
                      row: rowId,
                      tripEvent: newTripEvent,
                      category: newCategory
                  });
              }
          }
      });

      if (changesList.length === 0) {
          alert("No changes detected.");
          return;
      }

      store.setState('isTagging', true);
      
      const CHUNK_SIZE = 20; 
      const totalChunks = Math.ceil(changesList.length / CHUNK_SIZE);

      try {
          for (let i = 0; i < totalChunks; i++) {
              const start = i * CHUNK_SIZE;
              const end = start + CHUNK_SIZE;
              const chunk = changesList.slice(start, end);
              
              store.setState('taggingProgress', `Uploading batch ${i + 1} of ${totalChunks}...`);
              await ApiService.updateExpenses(chunk, { skipLoading: true });
          }

          this.toggleSelectionMode(false);
          store.setState('taggingProgress', 'Completed!');
          
          setTimeout(() => {
               document.dispatchEvent(new CustomEvent('dataUploaded'));
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

  updateProgressDisplay() {
      const progressText = this.element.querySelector('#tagging-progress-text');
      if (progressText) {
          progressText.textContent = store.getState('taggingProgress');
      }
  }
}

export default TransactionsComponent;