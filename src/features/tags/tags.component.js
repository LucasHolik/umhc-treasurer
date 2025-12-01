// src/features/tags/tags.component.js
import store from '../../core/state.js';
import ApiService from '../../services/api.service.js';
import LoaderComponent from '../../shared/loader.component.js';
import ModalComponent from '../../shared/modal.component.js';
import { formatCurrency, filterTransactionsByTimeframe } from '../../core/utils.js';

class TagsComponent {
  constructor(element) {
    this.element = element;
    this.queue = [];
    this.localTags = null; // Used in edit mode
    this.isEditMode = false;
    this.modal = new ModalComponent();
    
    // State for filtering and sorting
    this.searchTerms = {
        "Trip/Event": "",
        "Category": ""
    };
    this.timeframe = 'all_time';
    this.sortOrder = "asc"; // 'asc' | 'desc'
    
    // Bind methods
    this.render = this.render.bind(this);
    this.handleEdit = this.handleEdit.bind(this);
    this.handleCancel = this.handleCancel.bind(this);
    this.handleSave = this.handleSave.bind(this);
    this.handleSearch = this.handleSearch.bind(this);
    this.handleSort = this.handleSort.bind(this);
    
    this.render();
    
    // Subscribe to relevant state changes
    store.subscribe('tags', () => {
        if (!this.isEditMode) this.render();
    });
    store.subscribe('expenses', this.render);
    store.subscribe('savingTags', this.render);
  }

  render() {
    const savingTags = store.getState('savingTags');
    
    if (savingTags) {
        this.renderSavingState();
        return;
    }

    this.element.innerHTML = `
      <style>
        .tags-container {
            display: flex;
            gap: 20px;
            /* No wrap to prevent stacking, but add scroll if needed */
            overflow-x: auto; 
            align-items: flex-start;
        }
        .tags-column {
            flex: 1;
            min-width: 480px;
        }
      </style>
      <div class="section">
        <div class="tags-header-actions" style="display: flex; justify-content: space-between; align-items: center;">
            <h2>Manage Tags</h2>
            <div class="header-controls-group">
                <div class="header-sort-controls">
                    <label style="margin-right: 5px; color: #f0ad4e;">Timeframe:</label>
                    <select id="tag-timeframe-select" class="theme-select" style="margin-right: 15px;">
                        <option value="current_month" ${this.timeframe === 'current_month' ? 'selected' : ''}>Current Month</option>
                        <option value="past_30_days" ${this.timeframe === 'past_30_days' ? 'selected' : ''}>Past 30 Days</option>
                        <option value="past_3_months" ${this.timeframe === 'past_3_months' ? 'selected' : ''}>Past 3 Months</option>
                        <option value="past_6_months" ${this.timeframe === 'past_6_months' ? 'selected' : ''}>Past 6 Months</option>
                        <option value="past_year" ${this.timeframe === 'past_year' ? 'selected' : ''}>Past Year</option>
                        <option value="all_time" ${this.timeframe === 'all_time' ? 'selected' : ''}>All Time</option>
                    </select>

                    <label style="margin-right: 5px; color: #f0ad4e;">Sort:</label>
                    <select id="tag-sort-select" class="theme-select">
                        <option value="asc" ${this.sortOrder === 'asc' ? 'selected' : ''}>Name (A-Z)</option>
                        <option value="desc" ${this.sortOrder === 'desc' ? 'selected' : ''}>Name (Z-A)</option>
                    </select>
                </div>
                <div class="actions">
                    ${this.isEditMode 
                        ? `
                            <button id="cancel-tags-btn" class="secondary-btn" style="border-color: #d9534f; color: #d9534f; margin-right: 10px;">Cancel</button>
                            <button id="save-tags-btn" class="secondary-btn" style="background-color: #f0ad4e; color: white;">Save Changes</button>
                          `
                        : `<button id="edit-tags-btn" class="secondary-btn">Edit Tags</button>`
                    }
                </div>
            </div>
        </div>
        
        <div class="tags-container">
            ${this.renderTagColumn('Trip/Event')}
            ${this.renderTagColumn('Category')}
        </div>
      </div>
    `;

    this.attachEventListeners();
  }
  
  renderSavingState() {
      this.element.innerHTML = `
        <div class="section" style="height: 400px; display: flex; flex-direction: column; justify-content: center; align-items: center;">
            <div class="loader" style="width: 50px; height: 50px; margin-bottom: 20px;"></div>
            <h3 style="color: #f0ad4e; margin-bottom: 10px;">Saving Tags...</h3>
            <p style="color: #fff; font-size: 1.1em;">Processing tag updates securely.</p>
        </div>
      `;
  }

  renderTagColumn(type) {
    const tagsSource = this.isEditMode ? this.localTags : store.getState('tags');
    const tagsList = (tagsSource && tagsSource[type]) ? tagsSource[type] : [];
    const tagStats = this.calculateTagStats();
    const searchTerm = this.searchTerms[type] || "";
    
    // Filter
    let visibleTags = tagsList.filter(tag => 
        tag.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Sort
    visibleTags.sort((a, b) => {
        const valA = a.toLowerCase();
        const valB = b.toLowerCase();
        if (valA < valB) return this.sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return this.sortOrder === 'asc' ? 1 : -1;
        return 0;
    });

    let rows = '';
    if (visibleTags.length === 0) {
        const colspan = this.isEditMode ? 7 : 6;
        rows = `<tr><td colspan="${colspan}">No tags found matching filter.</td></tr>`;
    } else {
        rows = visibleTags.map(tag => {
            const stats = tagStats[type][tag] || { count: 0, income: 0, expense: 0 };
            const net = stats.income - stats.expense;
            
            // Format net: remove negative sign if needed, rely on color
            let netStr = formatCurrency(Math.abs(net));
            
            const actions = this.isEditMode ? `
                <td style="text-align: right;">
                    <button class="icon-btn rename-btn" data-tag="${tag}" data-type="${type}" title="Rename">✏️</button>
                    <button class="icon-btn delete-btn" data-tag="${tag}" data-type="${type}" title="Delete">🗑️</button>
                </td>
            ` : '';
            
            return `
                <tr>
                    <td>${tag}</td>
                    <td class="tags-table-num positive">${formatCurrency(stats.income)}</td>
                    <td class="tags-table-num negative">${formatCurrency(stats.expense)}</td>
                    <td class="tags-table-num ${net >= 0 ? 'positive' : 'negative'}">${netStr}</td>
                    <td style="text-align: center;">${stats.count}</td>
                    ${actions}
                </tr>
            `;
        }).join('');
    }

    const addForm = this.isEditMode ? `
        <div class="tag-input-group" style="margin-top: 10px;">
            <input type="text" class="add-tag-input" id="new-tag-${type.replace(/\W/g, '')}" placeholder="Add new ${type} tag...">
            <button class="secondary-btn add-tag-btn" data-type="${type}">Add</button>
        </div>
    ` : '';

    // Search Input
    const searchInput = `
        <div style="margin-bottom: 10px;">
            <input type="text" 
                class="tag-search-input column-search" 
                data-type="${type}" 
                placeholder="Search ${type}..." 
                value="${searchTerm}">
        </div>
    `;

    return `
        <div class="tags-column">
            <h3>${type} Tags</h3>
            ${searchInput}
            <div style="overflow-x: auto;">
                <table class="section-table">
                    <thead>
                        <tr>
                            <th>Tag Name</th>
                            <th style="text-align: right;">Income</th>
                            <th style="text-align: right;">Expense</th>
                            <th style="text-align: right;">Net</th>
                            <th style="text-align: center;">Uses</th>
                            ${this.isEditMode ? '<th style="width: 80px; text-align: right;">Actions</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
            ${addForm}
        </div>
    `;
  }

  calculateTagStats() {
    const allExpenses = store.getState('expenses') || [];
    const expenses = filterTransactionsByTimeframe(allExpenses, this.timeframe);
    const stats = { "Trip/Event": {}, "Category": {} };
    
    const parseAmount = (val) => {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        // Handle "1,234.56" -> 1234.56
        return parseFloat(val.toString().replace(/,/g, '')) || 0;
    };

    expenses.forEach(item => {
      const tripEventTag = item["Trip/Event"];
      const categoryTag = item["Category"];
      const income = parseAmount(item["Income"]);
      const expense = parseAmount(item["Expense"]);
      
      if (tripEventTag) {
          if (!stats["Trip/Event"][tripEventTag]) stats["Trip/Event"][tripEventTag] = { count: 0, income: 0, expense: 0 };
          stats["Trip/Event"][tripEventTag].count += 1;
          stats["Trip/Event"][tripEventTag].income += income;
          stats["Trip/Event"][tripEventTag].expense += expense;
      }
      if (categoryTag) {
          if (!stats["Category"][categoryTag]) stats["Category"][categoryTag] = { count: 0, income: 0, expense: 0 };
          stats["Category"][categoryTag].count += 1;
          stats["Category"][categoryTag].income += income;
          stats["Category"][categoryTag].expense += expense;
      }
    });

    if (this.isEditMode && this.queue.length > 0) {
        this.queue.forEach(op => {
            const type = op.tagType;
            if (!stats[type]) stats[type] = {};

            if (op.type === 'rename') {
                const oldStats = stats[type][op.oldValue] || { count: 0, income: 0, expense: 0 };
                if (stats[type][op.newValue]) {
                     stats[type][op.newValue].count += oldStats.count;
                     stats[type][op.newValue].income += oldStats.income;
                     stats[type][op.newValue].expense += oldStats.expense;
                } else {
                     stats[type][op.newValue] = { ...oldStats };
                }
                delete stats[type][op.oldValue];
            } else if (op.type === 'delete') {
                delete stats[type][op.value];
            } 
        });
    }

    return stats;
  }

  attachEventListeners() {
    const editBtn = this.element.querySelector('#edit-tags-btn');
    const cancelBtn = this.element.querySelector('#cancel-tags-btn');
    const saveBtn = this.element.querySelector('#save-tags-btn');
    const sortSelect = this.element.querySelector('#tag-sort-select');
    const timeframeSelect = this.element.querySelector('#tag-timeframe-select');

    if (editBtn) editBtn.addEventListener('click', this.handleEdit);
    if (cancelBtn) cancelBtn.addEventListener('click', this.handleCancel);
    if (saveBtn) saveBtn.addEventListener('click', this.handleSave);
    if (sortSelect) sortSelect.addEventListener('change', this.handleSort);
    if (timeframeSelect) timeframeSelect.addEventListener('change', (e) => {
        this.timeframe = e.target.value;
        this.render();
    });

    // Column Search Inputs
    this.element.querySelectorAll('.column-search').forEach(input => {
        input.addEventListener('input', this.handleSearch);
    });

    if (this.isEditMode) {
        // Add Tag
        this.element.querySelectorAll('.add-tag-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const type = e.target.dataset.type;
                const inputId = `new-tag-${type.replace(/\W/g, '')}`;
                const input = this.element.querySelector(`#${inputId}`);
                const value = input.value.trim();
                
                if (value) {
                    if (this.localTags[type].includes(value)) {
                        await this.modal.alert('Tag already exists!');
                        return;
                    }
                    this.localTags[type].push(value);
                    this.queue.push({ type: 'add', tagType: type, value: value });
                    this.render();
                }
            });
        });

        // Delete Tag
        this.element.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const tag = e.target.dataset.tag;
                const type = e.target.dataset.type;
                
                const confirmed = await this.modal.confirm(`Delete tag "${tag}"?`);
                if (confirmed) {
                    this.localTags[type] = this.localTags[type].filter(t => t !== tag);
                    this.queue.push({ type: 'delete', tagType: type, value: tag });
                    this.render();
                }
            });
        });

        // Rename Tag
        this.element.querySelectorAll('.rename-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const tag = e.target.dataset.tag;
                const type = e.target.dataset.type;
                const newName = await this.modal.prompt(`Rename "${tag}" to:`, tag, 'Rename Tag');
                
                if (newName && newName.trim() !== "" && newName !== tag) {
                    const trimmedName = newName.trim();
                    if (this.localTags[type].includes(trimmedName)) {
                        await this.modal.alert('Tag name already exists!');
                        return;
                    }
                    
                    const index = this.localTags[type].indexOf(tag);
                    if (index !== -1) {
                        this.localTags[type][index] = trimmedName;
                        this.queue.push({ type: 'rename', tagType: type, oldValue: tag, newValue: trimmedName });
                        this.render();
                    }
                }
            });
        });
    }
  }

  handleSearch(e) {
      const type = e.target.dataset.type;
      this.searchTerms[type] = e.target.value;
      this.render();
      
      // Restore focus
      const input = this.element.querySelector(`.column-search[data-type="${type}"]`);
      if (input) {
          input.focus();
          const val = input.value;
          input.value = '';
          input.value = val;
      }
  }

  handleSort(e) {
      this.sortOrder = e.target.value;
      this.render();
  }

  handleEdit() {
    // Deep copy tags to local state
    this.localTags = JSON.parse(JSON.stringify(store.getState('tags')));
    this.queue = [];
    this.isEditMode = true;
    this.render();
  }

  async handleCancel() {
    if (this.queue.length > 0) {
        const confirmed = await this.modal.confirm('You have unsaved changes. Are you sure you want to cancel?', 'Unsaved Changes');
        if (!confirmed) {
            return;
        }
    }
    this.isEditMode = false;
    this.localTags = null;
    this.queue = [];
    this.render();
  }

  async handleSave() {
    if (this.queue.length === 0) {
        this.isEditMode = false;
        this.render();
        return;
    }

    store.setState('savingTags', true);
    
    const chunkSize = 10;
    const chunks = [];
    
    const formattedOperations = this.queue.map(op => {
        if (op.type === 'add') return [null, op.value, 'add', op.tagType];
        if (op.type === 'delete') return [op.value, null, 'delete', op.tagType];
        if (op.type === 'rename') return [op.oldValue, op.newValue, 'rename', op.tagType];
        return null;
    }).filter(op => op !== null);

    for (let i = 0; i < formattedOperations.length; i += chunkSize) {
        chunks.push(formattedOperations.slice(i, i + chunkSize));
    }

    try {
        for (const chunk of chunks) {
            await ApiService.processTagOperations(chunk, { skipLoading: true });
        }
        
        // Refresh data to ensure everything is synced
        document.dispatchEvent(new CustomEvent('dataUploaded')); 
        
        this.isEditMode = false;
        this.localTags = null;
        this.queue = [];
    } catch (error) {
        console.error("Failed to save tags:", error);
        await this.modal.alert("Failed to save tags: " + error.message, 'Error');
    } finally {
        store.setState('savingTags', false);
    }
  }
}

export default TagsComponent;