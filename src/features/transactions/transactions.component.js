// src/features/transactions/transactions.component.js
import store from '../../core/state.js';
import ApiService from '../../services/api.service.js';
import SortableTable from '../../shared/sortable-table.component.js';
import TransactionsFilters from './transactions.filters.js';
import TransactionsBulk from './transactions.bulk.js';
import TransactionsManualModal from './transactions.manual.js';
import * as TransactionsLogic from './transactions.logic.js';

import { formatCurrency } from '../../core/utils.js';

class TransactionsComponent {
  constructor(element) {
    this.element = element;
    this.transactionData = [];
    this.originalTransactionData = [];
    
    // State
    this.selectionMode = false;
    this.selectedRows = new Set();
    
    this.selectedCategories = new Set();
    this.selectedTrips = new Set();
    this.categorySearchTerm = '';
    this.tripSearchTerm = '';
    this.descriptionSearchTerm = '';

    this.render();
    store.subscribe('expenses', (data) => this.handleDataChange(data));
    store.subscribe('tags', () => this.handleTagsChange());
    store.subscribe('isTagging', () => this.renderTransactionsDisplay());
    store.subscribe('taggingProgress', () => this.updateProgressDisplay());
    store.subscribe('transactionParams', (params) => this.handleTransactionParams(params));

    // Global click listener to close dropdowns
    document.addEventListener('click', (e) => this.handleGlobalClick(e));
  }

  handleGlobalClick(e) {
      if (this.selectionMode && this.bulkComponent) {
          this.bulkComponent.handleGlobalClick(e);
      }
  }

  handleTransactionParams(params) {
      if (!params) return;
      
      // Ensure we are rendered and components exist
      if (!this.bulkComponent) return;

      if (params.mode === 'bulk') {
          this.toggleSelectionMode(true);
          if (params.prefill) {
              this.bulkComponent.setPrefill(params.prefill);
          }
          // Clear params to prevent re-processing
          store.setState('transactionParams', null);
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
                
                <div class="transaction-actions" style="align-self: flex-start; margin-top: 22px;">
                    <button id="tag-transactions-btn" class="secondary-btn">Bulk Tagging Mode</button>
                    <button id="add-manual-btn" class="secondary-btn">Add Manual Transaction</button>
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
            
            <!-- Description Search (Full Width) -->
            <div style="margin-bottom: 15px;">
                <input type="text" id="desc-search" class="tag-search-input" style="width: 100%; padding: 12px; box-sizing: border-box; font-size: 1em; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2);" placeholder="Search transaction descriptions..." value="${this.descriptionSearchTerm}">
            </div>

            <div id="transactions-table-container"></div>
        </div>
    `;
    
    this.initializeSubComponents();

    // Restore UI state if returning from loading
    if (this.selectionMode) {
        this.toggleSelectionMode(true);
    } else {
        this.applyFilters();
    }
    
    this.handleTagsChange(); // Populate filters
  }

  initializeSubComponents() {
      // Table
      this.tableComponent = new SortableTable(this.transactionsDisplay.querySelector('#transactions-table-container'), {
          columns: [
            { key: 'Date', label: 'Date', type: 'date' },
            { key: 'Description', label: 'Description', type: 'text' },
            { key: 'Trip/Event', label: 'Trip/Event', type: 'text' },
            { key: 'Category', label: 'Category', type: 'text' },
            { 
                key: 'Amount', 
                label: 'Amount', 
                type: 'custom',
                sortValue: (item) => {
                    const income = item.Income ? parseFloat(String(item.Income).replace(/,/g, '')) : 0;
                    const expense = item.Expense ? parseFloat(String(item.Expense).replace(/,/g, '')) : 0;
                    const safeIncome = isNaN(income) ? 0 : income;
                    const safeExpense = isNaN(expense) ? 0 : expense;
                    return safeIncome - safeExpense;
                },
                render: (item) => {
                    // Parse values safely
                    const income = item.Income ? parseFloat(String(item.Income).replace(/,/g, '')) : 0;
                    const expense = item.Expense ? parseFloat(String(item.Expense).replace(/,/g, '')) : 0;
                    
                    const safeIncome = isNaN(income) ? 0 : income;
                    const safeExpense = isNaN(expense) ? 0 : expense;
                    
                    const net = safeIncome - safeExpense;
                    
                    const classType = net > 0 ? 'positive' : (net < 0 ? 'negative' : '');
                    return `<span class="${classType}">${formatCurrency(Math.abs(net))}</span>`;
                }
            }
          ],
          enableSelection: this.selectionMode,
          initialSortField: 'Date',
          initialSortAsc: false,
          onSelectionChange: (selectedIds) => this.handleSelectionChange(selectedIds)
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

      // Manual Transaction Button
      const manualBtn = this.transactionsDisplay.querySelector('#add-manual-btn');
      if (manualBtn) {
          manualBtn.addEventListener('click', () => this.openManualModal());
      }

      // Description Search Listener
      const descSearch = this.transactionsDisplay.querySelector('#desc-search');
      if (descSearch) {
          descSearch.addEventListener('input', (e) => {
              this.descriptionSearchTerm = e.target.value;
              this.applyFilters();
          });
      }
  }

  async openManualModal() {
      const modal = new TransactionsManualModal();
      const data = await modal.open();
      if (data) {
          this.handleManualAdd(data);
      }
  }

  async handleManualAdd(data) {
      store.setState('isLoading', true);
      try {
          // Wrap single object in array
          await ApiService.saveData([data]);
          document.dispatchEvent(new CustomEvent('dataUploaded'));
      } catch (error) {
          console.error("Failed to add manual transaction", error);
          alert("Failed to add transaction: " + error.message);
          store.setState('isLoading', false);
      }
  }

  handleDataChange(data) {
    this.transactionData = [...data];
    this.originalTransactionData = [...data];
    this.applyFilters(); 
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

  // --- Filtering ---

  handleSearchChange(type, term) {
      if (type === 'Category') this.categorySearchTerm = term.toLowerCase();
      if (type === 'Trip/Event') this.tripSearchTerm = term.toLowerCase();
      this.handleTagsChange(); // Re-render lists with new search term
  }

  handleFilterChange(type, tag, checked) {
      const set = type === 'Category' ? this.selectedCategories : this.selectedTrips;
      if (checked) set.add(tag);
      else set.delete(tag);
      this.handleTagsChange(); 
      this.applyFilters();
  }

  handleFilterSelectAll(type, tags, checked) {
      const set = type === 'Category' ? this.selectedCategories : this.selectedTrips;
      tags.forEach(tag => {
          if (checked) set.add(tag);
          else set.delete(tag);
      });
      this.handleTagsChange();
      this.applyFilters();
  }

  applyFilters() {
      // 1. Filter
      this.transactionData = TransactionsLogic.filterData(this.originalTransactionData, {
          selectedCategories: this.selectedCategories,
          selectedTrips: this.selectedTrips,
          descriptionSearch: this.descriptionSearchTerm
      });

      // 2. Render (SortableTable handles sorting)
      if (this.tableComponent) {
          this.tableComponent.update(this.transactionData);
      }
  }

  // --- Bulk Actions & Selection ---

  toggleSelectionMode(active) {
      this.selectionMode = active;
      
      if (!active) {
          this.selectedRows.clear();
          if(this.tableComponent) this.tableComponent.clearSelection();
      }

      if (this.bulkComponent) {
          this.bulkComponent.toggleSelectionMode(active, this.selectedRows.size);
      }
      
      if (this.tableComponent) {
          this.tableComponent.enableSelection = active;
          // Re-render to show/hide checkboxes
          this.tableComponent.render(); 
      }
  }

  handleSelectionChange(selectedIds) {
      this.selectedRows = new Set(selectedIds);
      this.updateSelectionUI();
  }

  updateSelectionUI() {
      if (this.bulkComponent) {
          this.bulkComponent.updateSelectionCount(this.selectedRows.size);
      }
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