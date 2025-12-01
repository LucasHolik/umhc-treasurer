import store from '../../core/state.js';
import { formatCurrency, filterTransactionsByTimeframe } from '../../core/utils.js';
import ModalComponent from '../../shared/modal.component.js';

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
        this.sortOrder = "asc"; 
        this.modal = new ModalComponent();
    }

    render(isEditMode, localTags, queue) {
        this.isEditMode = isEditMode;
        this.localTags = localTags; // Passed from parent if in edit mode
        this.queue = queue;         // Passed from parent

        this.element.innerHTML = `
            <div class="section"> <!-- Added .section wrapper here -->
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
            </div> <!-- End .section wrapper -->
        `;

        this.attachEventListeners();
    }

    renderTagColumn(type) {
        const tagsSource = this.isEditMode ? this.localTags : store.getState('tags');
        const tagsList = (tagsSource && tagsSource[type]) ? tagsSource[type] : [];
        const tagStats = this.calculateTagStats();
        const searchTerm = this.searchTerms[type] || "";
        
        let visibleTags = tagsList.filter(tag => 
            tag.toLowerCase().includes(searchTerm.toLowerCase())
        );

        visibleTags.sort((a, b) => {
            const valA = a.toLowerCase();
            const valB = b.toLowerCase();
            if (valA < valB) return this.sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return this.sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        let rows = '';
        if (visibleTags.length === 0) {
            const colspan = this.isEditMode ? 6 : 5;
            rows = `<tr><td colspan="${colspan}">No tags found matching filter.</td></tr>`;
        } else {
            rows = visibleTags.map(tag => {
                const stats = tagStats[type][tag] || { count: 0, income: 0, expense: 0 };
                const net = stats.income - stats.expense;
                let netStr = formatCurrency(Math.abs(net));
                
                const actions = this.isEditMode ? `
                    <td style="text-align: right;">
                        <button class="icon-btn rename-btn" data-tag="${tag}" data-type="${type}" title="Rename">✏️</button>
                        <button class="icon-btn delete-btn" data-tag="${tag}" data-type="${type}" title="Delete">🗑️</button>
                    </td>
                ` : '';

                const rowStyle = this.isEditMode ? '' : 'cursor: pointer;';
                const rowClass = this.isEditMode ? '' : 'tag-row';
                
                return `
                    <tr class="${rowClass}" data-tag="${tag}" data-type="${type}" style="${rowStyle}">
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
        const sortSelect = this.element.querySelector('#tag-sort-select');
        const timeframeSelect = this.element.querySelector('#tag-timeframe-select');

        if (editBtn) editBtn.addEventListener('click', () => this.callbacks.onEditModeToggle(true));
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.callbacks.onEditModeToggle(false));
        if (saveBtn) saveBtn.addEventListener('click', () => this.callbacks.onSave());
        
        if (sortSelect) sortSelect.addEventListener('change', (e) => {
            this.sortOrder = e.target.value;
            this.render(this.isEditMode, this.localTags, this.queue);
        });
        
        if (timeframeSelect) timeframeSelect.addEventListener('change', (e) => {
            this.timeframe = e.target.value;
            this.render(this.isEditMode, this.localTags, this.queue);
        });

        this.element.querySelectorAll('.column-search').forEach(input => {
            input.addEventListener('input', (e) => {
                const type = e.target.dataset.type;
                this.searchTerms[type] = e.target.value;
                this.render(this.isEditMode, this.localTags, this.queue);
                const newInput = this.element.querySelector(`.column-search[data-type="${type}"]`);
                if (newInput) {
                    newInput.focus();
                    newInput.value = e.target.value; 
                }
            });
        });

        if (this.isEditMode) {
            // Add, Delete, Rename logic needs to be handled via callbacks or internal queue manipulation
            // Since `localTags` and `queue` are passed in, we should probably call back to parent to update them?
            // Or update them locally and re-render? 
            // The parent `TagsComponent` holds the source of truth for `localTags` and `queue`.
            // So we should use callbacks for modifications.
            
            this.element.querySelectorAll('.add-tag-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const type = e.target.dataset.type;
                    const inputId = `new-tag-${type.replace(/\W/g, '')}`;
                    const input = this.element.querySelector(`#${inputId}`);
                    const value = input.value.trim();
                    if (this.callbacks.onTagAdd) this.callbacks.onTagAdd(type, value);
                });
            });

            this.element.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const tag = e.target.dataset.tag;
                    const type = e.target.dataset.type;
                    if (this.callbacks.onTagDelete) this.callbacks.onTagDelete(type, tag);
                });
            });

            this.element.querySelectorAll('.rename-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const tag = e.target.dataset.tag;
                    const type = e.target.dataset.type;
                    if (this.callbacks.onTagRename) this.callbacks.onTagRename(type, tag);
                });
            });
        } else {
            // Tag Click (View Details)
            this.element.querySelectorAll('.tag-row').forEach(row => {
                row.addEventListener('click', (e) => {
                    const tag = row.dataset.tag;
                    const type = row.dataset.type;
                    if (this.callbacks.onTagClick) this.callbacks.onTagClick(type, tag);
                });
            });
        }
    }
}