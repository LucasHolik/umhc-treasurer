import store from '../../core/state.js';
import { formatCurrency, filterTransactionsByTimeframe } from '../../core/utils.js';
import ModalComponent from '../../shared/modal.component.js';
import SortableTable from '../../shared/sortable-table.component.js';

export default class TagsList {
    constructor(element, callbacks) {
        this.element = element;
        this.callbacks = callbacks || {}; // { onEditModeToggle, onSave, onTagClick }
        
        // Local state for filtering/sorting within the list view
        this.searchTerms = {
            "Trip/Event": "",
            "Category": ""
        };
        this.timeframe = 'all_time';
        this.modal = new ModalComponent();
        
        // Table instances
        this.tripTable = null;
        this.categoryTable = null;
    }

    render(isEditMode, localTags, queue) {
        this.isEditMode = isEditMode;
        this.localTags = localTags; // Passed from parent if in edit mode
        this.queue = queue;         // Passed from parent

        this.element.innerHTML = `
            <div class="section">
                <style>
                    .tags-container {
                        display: flex;
                        gap: 20px;
                        overflow-x: auto; 
                        align-items: flex-start;
                    }
                    .tags-column {
                        flex: 1;
                        min-width: 480px;
                    }
                    @media (max-width: 768px) {
                        .tags-container {
                            flex-direction: column;
                        }
                        .tags-column {
                            min-width: 100%;
                        }
                    }
                </style>
                <div class="tags-header-actions" style="display: flex; justify-content: space-between; align-items: center;">
                    <h2>Manage Tags</h2>
                    <div class="header-controls-group">
                        <div class="header-sort-controls">
                            <div class="timeframe-selector">
                                <label for="tag-timeframe-select">Timeframe: </label>
                                <select id="tag-timeframe-select">
                                    <option value="current_month" ${this.timeframe === 'current_month' ? 'selected' : ''}>Current Month</option>
                                    <option value="past_30_days" ${this.timeframe === 'past_30_days' ? 'selected' : ''}>Past 30 Days</option>
                                    <option value="past_3_months" ${this.timeframe === 'past_3_months' ? 'selected' : ''}>Past 3 Months</option>
                                    <option value="past_6_months" ${this.timeframe === 'past_6_months' ? 'selected' : ''}>Past 6 Months</n>
                                    <option value="past_year" ${this.timeframe === 'past_year' ? 'selected' : ''}>Past Year</option>
                                    <option value="all_time" ${this.timeframe === 'all_time' ? 'selected' : ''}>All Time</option>
                                </select>
                            </div>
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
                    <div id="trip-tags-column" class="tags-column">
                         <h3>Trip/Event Tags</h3>
                         <div style="margin-bottom: 10px; display: flex; gap: 10px;">
                            <input type="text" class="tag-search-input column-search" style="flex: 1;" data-type="Trip/Event" placeholder="Search Trip/Event..." value="${this.searchTerms['Trip/Event']}">
                            ${this.isEditMode ? `<button class="secondary-btn add-tag-icon-btn" data-type="Trip/Event" style="width: 38px; padding: 0; display: flex; align-items: center; justify-content: center; font-size: 1.2em;" title="Add new Trip/Event tag">+</button>` : ''}
                         </div>
                         <div id="trip-tags-table-container"></div>
                    </div>
                    <div id="category-tags-column" class="tags-column">
                         <h3>Category Tags</h3>
                         <div style="margin-bottom: 10px; display: flex; gap: 10px;">
                            <input type="text" class="tag-search-input column-search" style="flex: 1;" data-type="Category" placeholder="Search Category..." value="${this.searchTerms['Category']}">
                            ${this.isEditMode ? `<button class="secondary-btn add-tag-icon-btn" data-type="Category" style="width: 38px; padding: 0; display: flex; align-items: center; justify-content: center; font-size: 1.2em;" title="Add new Category tag">+</button>` : ''}
                         </div>
                         <div id="category-tags-table-container"></div>
                    </div>
                </div>
            </div>
        `;

        this.attachEventListeners();
        this.renderTables();
    }

    renderTables() {
        const tagStats = this.calculateTagStats();
        this.renderSingleTable('Trip/Event', tagStats);
        this.renderSingleTable('Category', tagStats);
    }

    renderSingleTable(type, tagStats) {
        const containerId = type === 'Trip/Event' ? 'trip-tags-table-container' : 'category-tags-table-container';
        const container = this.element.querySelector(`#${containerId}`);
        if (!container) return;

        const tagsSource = this.isEditMode ? this.localTags : store.getState('tags');
        const tagsList = (tagsSource && tagsSource[type]) ? tagsSource[type] : [];
        const searchTerm = this.searchTerms[type] || "";
        
        let visibleTags = tagsList.filter(tag => 
            tag.toLowerCase().includes(searchTerm.toLowerCase())
        );

        const data = visibleTags.map(tag => {
            const stats = tagStats[type][tag] || { count: 0, income: 0, expense: 0 };
            const net = stats.income - stats.expense;
            return {
                tag: tag,
                type: type, // for actions
                income: stats.income,
                expense: stats.expense,
                net: net,
                count: stats.count
            };
        });

        const columns = [
            { key: 'tag', label: 'Tag Name', type: 'text' },
            { key: 'income', label: 'Income', type: 'currency', class: 'positive tags-table-num text-right' },
            { key: 'expense', label: 'Expense', type: 'currency', class: 'negative tags-table-num text-right' },
            { key: 'net', label: 'Net', type: 'currency', class: 'tags-table-num text-right', 
              render: (item) => `<span class="${item.net > 0 ? 'positive' : (item.net < 0 ? 'negative' : '')}">${formatCurrency(item.net)}</span>` 
            },
            { key: 'count', label: 'Uses', type: 'number', class: 'text-center' }
        ];

        if (this.isEditMode) {
            columns.push({
                key: 'actions',
                label: 'Actions',
                type: 'custom',
                sortable: false,
                class: 'text-right',
                render: (item) => `
                    <button class="icon-btn rename-btn" data-tag="${item.tag}" data-type="${item.type}" title="Rename">✏️</button>
                    <button class="icon-btn delete-btn" data-tag="${item.tag}" data-type="${item.type}" title="Delete">🗑️</button>
                `
            });
        }

        const table = new SortableTable(container, {
            columns: columns,
            initialSortField: 'tag',
            initialSortAsc: true,
            onRowClick: (item) => {
                if (!this.isEditMode && this.callbacks.onTagClick) {
                    this.callbacks.onTagClick(type, item.tag);
                }
            }
        });
        table.update(data);

        // Bind action buttons if in edit mode
        if (this.isEditMode) {
            container.querySelectorAll('.rename-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent row click
                    const tag = e.currentTarget.dataset.tag;
                    const t = e.currentTarget.dataset.type;
                    if (this.callbacks.onTagRename) this.callbacks.onTagRename(t, tag);
                });
            });
            container.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent row click
                    const tag = e.currentTarget.dataset.tag;
                    const t = e.currentTarget.dataset.type;
                    if (this.callbacks.onTagDelete) this.callbacks.onTagDelete(t, tag);
                });
            });
        }
    }

    calculateTagStats() {
        const allExpenses = store.getState('expenses') || [];
        const expenses = filterTransactionsByTimeframe(allExpenses, this.timeframe);
        const stats = { "Trip/Event": {}, "Category": {} };
        
        const parseAmount = (val) => {
            if (!val) return 0;
            if (typeof val === 'number') return val;
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

        if (this.isEditMode && this.queue && this.queue.length > 0) {
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
        const timeframeSelect = this.element.querySelector('#tag-timeframe-select');

        if (editBtn) editBtn.addEventListener('click', () => this.callbacks.onEditModeToggle(true));
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.callbacks.onEditModeToggle(false));
        if (saveBtn) saveBtn.addEventListener('click', () => this.callbacks.onSave());
        
        if (timeframeSelect) timeframeSelect.addEventListener('change', (e) => {
            this.timeframe = e.target.value;
            this.render(this.isEditMode, this.localTags, this.queue);
        });

        this.element.querySelectorAll('.column-search').forEach(input => {
            input.addEventListener('input', (e) => {
                const type = e.target.dataset.type;
                this.searchTerms[type] = e.target.value;
                const tagStats = this.calculateTagStats();
                this.renderSingleTable(type, tagStats);
            });
        });

        if (this.isEditMode) {
            this.element.querySelectorAll('.add-tag-icon-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const type = e.currentTarget.dataset.type;
                    const value = await this.modal.prompt(`Enter new name for ${type} tag:`, '', 'Add Tag');
                    if (value && value.trim() !== "") {
                         if (this.callbacks.onTagAdd) this.callbacks.onTagAdd(type, value.trim());
                    }
                });
            });
        }
    }
}