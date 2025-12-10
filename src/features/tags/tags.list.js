import { formatCurrency } from '../../core/utils.js';
import ModalComponent from '../../shared/modal.component.js';
import SortableTable from '../../shared/sortable-table.component.js';
import TagSelector from '../../shared/tag-selector.component.js';

export default class TagsList {
    constructor(element, callbacks) {
        this.element = element;
        this.callbacks = callbacks || {}; 
        // callbacks: { onEditModeToggle, onSave, onTagClick, onTagAdd, onTagDelete, onTagRename, onUpdateTripType, onToggleTripCompletion, onTimeframeChange }
        
        // Local state for filtering within the list view
        this.searchTerms = {
            "Trip/Event": "",
            "Category": "",
            "Type": ""
        };
        this.activeTab = "Type"; // Default tab
        this.modal = new ModalComponent();
        this.tagSelector = new TagSelector();
        
        // Table instances
        this.tables = {};

        // Global delegation for interactive clicks inside this component
        this.element.addEventListener('click', (e) => this.handleInteractiveClick(e));
    }

    render(isEditMode, localTags, queue, stats, tripTypeMap, timeframe, tagsData) {
        this.isEditMode = isEditMode;
        this.localTags = localTags; 
        this.queue = queue;         
        this.stats = stats;
        this.tripTypeMap = tripTypeMap;
        this.timeframe = timeframe;
        this.tagsData = tagsData; // Used for type selector options and initial completed list

        let actionButtons = '';
        if (this.isEditMode) {
            actionButtons = `
                <button id="cancel-tags-btn" class="secondary-btn" style="border-color: #d9534f; color: #d9534f; margin-right: 10px;">Cancel</button>
                <button id="save-tags-btn" class="action-btn">Save Changes</button>
            `;
        } else if (this.queue && this.queue.length > 0) {
             actionButtons = `
                <button id="save-tags-btn" class="action-btn">Save Changes (${this.queue.length})</button>
             `;
        } else {
            actionButtons = `<button id="edit-tags-btn" class="secondary-btn">Edit Tags</button>`;
        }

        // Define Tabs
        const tabs = [
            { id: 'Type', label: 'Trip Types' },
            { id: 'Trip/Event', label: 'Trip/Event Tags' },
            { id: 'Category', label: 'Category Tags' }
        ];

        const tabsHtml = tabs.map(tab => `
            <button class="tab-btn ${this.activeTab === tab.id ? 'active' : ''}" data-tab="${tab.id}">
                ${tab.label}
            </button>
        `).join('');

        this.element.innerHTML = `
            <div class="section">
                <div class="tags-header-actions" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h2>Manage Tags</h2>
                    <div class="header-controls-group">
                        <div class="header-sort-controls">
                            <div class="timeframe-selector">
                                <label for="tag-timeframe-select">Timeframe: </label>
                                <select id="tag-timeframe-select" aria-label="Timeframe">
                                    <option value="current_month" ${this.timeframe === 'current_month' ? 'selected' : ''}>Current Month</option>
                                    <option value="past_30_days" ${this.timeframe === 'past_30_days' ? 'selected' : ''}>Past 30 Days</option>
                                    <option value="past_3_months" ${this.timeframe === 'past_3_months' ? 'selected' : ''}>Past 3 Months</option>
                                    <option value="past_6_months" ${this.timeframe === 'past_6_months' ? 'selected' : ''}>Past 6 Months</option>
                                    <option value="past_year" ${this.timeframe === 'past_year' ? 'selected' : ''}>Past Year</option>
                                    <option value="all_time" ${this.timeframe === 'all_time' ? 'selected' : ''}>All Time</option>
                                </select>
                            </div>
                        </div>
                        <div class="actions">
                            ${actionButtons}
                        </div>
                    </div>
                </div>

                <div class="tags-tabs-container" style="display: flex; gap: 10px; border-bottom: 1px solid #444; margin-bottom: 20px;">
                    ${tabsHtml}
                </div>
                
                <div class="tags-container">
                    <div id="active-tab-content">
                         <div style="margin-bottom: 10px; display: flex; gap: 10px;">
                            <input type="text" id="search-tag" name="search-tag" aria-label="Search Tags" class="tag-search-input column-search" style="flex: 1;" data-type="${this.activeTab}" placeholder="Search ${this.activeTab}..." value="${this.searchTerms[this.activeTab] || ''}">
                            ${this.isEditMode ? `<button class="secondary-btn add-tag-icon-btn" data-type="${this.activeTab}" style="width: 38px; padding: 0; display: flex; align-items: center; justify-content: center; font-size: 1.2em;" title="Add new ${this.activeTab}">+</button>` : ''}
                         </div>
                         <div id="tags-table-container"></div>
                    </div>
                </div>
            </div>
        `;

        this.attachEventListeners();
        this.renderActiveTable();
    }

    renderActiveTable() {
        const type = this.activeTab;
        const container = this.element.querySelector(`#tags-table-container`);
        if (!container) return;

        // Determine source of tag list (edit mode vs normal)
        const tagsSource = this.isEditMode ? this.localTags : this.tagsData;
        const tagsList = (tagsSource && tagsSource[type]) ? tagsSource[type] : [];
        const tripStatusMap = tagsSource ? (tagsSource.TripStatusMap || {}) : {};
        
        const searchTerm = this.searchTerms[type] || "";
        
        let visibleTags = tagsList.filter(tag => 
            tag.toLowerCase().includes(searchTerm.toLowerCase())
        );

        const data = visibleTags.map(tag => {
            const tagStats = this.stats[type][tag] || { count: 0, income: 0, expense: 0 };
            const net = tagStats.income - tagStats.expense;
            
            let row = {
                tag: tag,
                type: type, // for actions
                income: tagStats.income,
                expense: tagStats.expense,
                net: net,
                count: tagStats.count
            };

            if (type === 'Trip/Event') {
                row.tripType = this.tripTypeMap[tag] || "";
                row.status = tripStatusMap[tag] || "Active";
            }

            return row;
        });

        const columns = [
            { key: 'tag', label: 'Name', type: 'text' }
        ];

        if (type === 'Trip/Event') {
            // Status Column
             columns.push({
                key: 'status',
                label: 'Status',
                type: 'custom',
                class: 'text-center',
                render: (item) => {
                     const status = item.status || "Active";
                     const styles = {
                         "Active": { icon: "◯", color: "#888", title: "Active" },
                         "Completed": { icon: "✅", color: "#5cb85c", title: "Completed" },
                         "Investment": { icon: "🚀", color: "#5bc0de", title: "Investment" }
                     };
                     const s = styles[status] || styles["Active"];
                     
                     if (this.isEditMode) {
                         return `<span class="status-toggle-btn" data-tag="${item.tag}" data-status="${status}" title="${s.title} - Click to cycle" style="cursor: pointer; color: ${s.color}; font-weight: bold; font-size: 1.2em;">${s.icon}</span>`;
                     }
                     return `<span title="${s.title}" style="color: ${s.color}; font-weight: bold; font-size: 1.2em;">${s.icon}</span>`;
                }
            });

            columns.push({
                key: 'tripType',
                label: 'Type',
                type: 'custom',
                render: (item) => {
                    // In edit mode: text only. Not in edit mode: interactive.
                    if (!this.isEditMode) {
                        if (item.tripType) {
                             return `
                                <span class="tag-pill" data-tag="${item.tag}" data-type="Type">
                                    <span class="tag-text">${item.tripType}</span>
                                    <span class="remove-btn" title="Remove Type">×</span>
                                </span>
                             `;
                        } else {
                             return `<span class="add-tag-placeholder" data-tag="${item.tag}" data-type="Type" title="Add Type">+</span>`;
                        }
                    }
                    return item.tripType || '';
                }
            });
        }

        columns.push(
            { key: 'income', label: 'Income', type: 'currency', class: 'positive tags-table-num text-right' },
            { key: 'expense', label: 'Expense', type: 'currency', class: 'negative tags-table-num text-right' },
            { key: 'net', label: 'Net', type: 'currency', class: 'tags-table-num text-right', 
              render: (item) => `<span class="${item.net > 0 ? 'positive' : (item.net < 0 ? 'negative' : '')}">${formatCurrency(Math.abs(item.net))}</span>` 
            },
            { key: 'count', label: 'Uses', type: 'number', class: 'text-center' }
        );

        if (this.isEditMode) {
            columns.push({
                key: 'actions',
                label: 'Actions',
                type: 'custom',
                sortable: false,
                class: 'text-right tags-actions-cell',
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
            onRowClick: (item, event) => {
                // Check if the click originated from an interactive element within the row
                const target = event.target;
                const isInteractiveElement = target.classList.contains('add-tag-placeholder') ||
                                             target.closest('.tag-pill') || 
                                             target.classList.contains('remove-btn') ||
                                             target.classList.contains('status-toggle-btn');
                
                if (!isInteractiveElement && !this.isEditMode && this.callbacks.onTagClick) {
                    this.callbacks.onTagClick(type, item.tag);
                }
            }
        });
        table.update(data);
        
        // Store reference for potential future updates
        this.tables[type] = table;

        // Bind action buttons if in edit mode
        if (this.isEditMode) {
            container.querySelectorAll('.rename-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const tag = e.currentTarget.dataset.tag;
                    const t = e.currentTarget.dataset.type;
                    if (this.callbacks.onTagRename) this.callbacks.onTagRename(t, tag);
                });
            });
            container.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const tag = e.currentTarget.dataset.tag;
                    const t = e.currentTarget.dataset.type;
                    if (this.callbacks.onTagDelete) this.callbacks.onTagDelete(t, tag);
                });
            });
        }
    }

    handleInteractiveClick(e) {
        const target = e.target;

        // Tab Switching
        if (target.classList.contains('tab-btn')) {
            this.activeTab = target.dataset.tab;
            this.render(this.isEditMode, this.localTags, this.queue, this.stats, this.tripTypeMap, this.timeframe, this.tagsData);
            return;
        }

        // Toggle Status (Edit Mode Only for now based on implementation logic)
        if (this.isEditMode && target.classList.contains('status-toggle-btn')) {
            e.stopPropagation();
            const tag = target.dataset.tag;
            const currentStatus = target.dataset.status;
             const nextStatus = {
                "Active": "Completed",
                "Completed": "Investment",
                "Investment": "Active"
            }[currentStatus] || "Active";

            if (this.callbacks.onUpdateTripStatus) {
                this.callbacks.onUpdateTripStatus(tag, nextStatus);
            }
            return;
        }

        // We ONLY want the following interactive when NOT in global edit mode
        if (this.isEditMode) return;
        
        // Remove Tag
        if (target.classList.contains('remove-btn')) {
            e.stopPropagation();
            const pill = target.closest('.tag-pill');
            const tag = pill.dataset.tag;
            if (this.callbacks.onUpdateTripType) {
                this.callbacks.onUpdateTripType(tag, ""); // Clear type
            }
            return;
        }

        // Add Tag (+)
        if (target.classList.contains('add-tag-placeholder')) {
            e.stopPropagation();
            const tag = target.dataset.tag;
            // Show selector
             const typeOptions = (this.tagsData["Type"] || []);
             this.tagSelector.show(
                target.getBoundingClientRect(),
                'Type', 
                "", 
                (newType) => {
                    if (this.callbacks.onUpdateTripType) this.callbacks.onUpdateTripType(tag, newType);
                },
                typeOptions
             );
             return;
        }

        // Edit Tag (Click pill body)
        const pill = target.closest('.tag-pill');
        if (pill) {
            e.stopPropagation();
            const tag = pill.dataset.tag;
            const currentVal = pill.querySelector('.tag-text').textContent;
             const typeOptions = (this.tagsData["Type"] || []);
             this.tagSelector.show(
                pill.getBoundingClientRect(),
                'Type', 
                currentVal, 
                (newType) => {
                    if (this.callbacks.onUpdateTripType) this.callbacks.onUpdateTripType(tag, newType);
                },
                typeOptions
             );
        }
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
            if (this.callbacks.onTimeframeChange) {
                this.callbacks.onTimeframeChange(e.target.value);
            }
        });

        this.element.querySelectorAll('.column-search').forEach(input => {
            input.addEventListener('input', (e) => {
                const type = e.target.dataset.type;
                this.searchTerms[type] = e.target.value;
                this.renderActiveTable(); // Only re-render the table content
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