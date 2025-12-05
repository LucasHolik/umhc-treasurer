import store from '../../core/state.js';
import ApiService from '../../services/api.service.js';
import SortableTable from '../../shared/sortable-table.component.js';
import TagSelector from '../../shared/tag-selector.component.js';

export default class TagsAddTrip {
    constructor(element, callbacks) {
        this.element = element;
        this.callbacks = callbacks; // { onBack, onSave }
        
        // State
        this.targetTypeName = "";
        this.selectedTrips = new Set(); // Trips selected to be added
        this.typeFilterSet = new Set(); // Types to filter the view by
        this.tripSearchTerm = "";
        this.typeSearchTerm = "";
        
        // Data
        this.allTrips = []; // List of strings
        this.tripTypeMap = {}; // { tripName: typeName }
        this.allTypes = []; // List of strings
        
        // UI Components
        this.tableComponent = null;
        
        // Bindings
        this.render = this.render.bind(this);
    }

    init(targetTypeName) {
        this.targetTypeName = targetTypeName;
        this.selectedTrips.clear();
        this.typeFilterSet.clear();
        this.tripSearchTerm = "";
        this.typeSearchTerm = "";
        
        this.loadData();
        this.render();
    }

    loadData() {
        const tagsData = store.getState('tags');
        this.allTrips = tagsData['Trip/Event'] || [];
        this.tripTypeMap = tagsData['TripTypeMap'] || {};
        this.allTypes = tagsData['Type'] || [];
    }

    render() {
        this.element.innerHTML = `
            <div class="section">
                <div class="transactions-header" style="display: flex; justify-content: space-between; align-items: center;">
                    <h2>Add Trip/Events to "${this.targetTypeName}"</h2>
                    <button id="add-trip-back-btn" class="secondary-btn">Back</button>
                </div>

                <!-- Controls Toolbar -->
                <div class="transaction-controls">
                    
                    <!-- Filter Group -->
                    <div class="control-group" style="flex-grow: 1;">
                        <label class="control-label">Filter by Current Type</label>
                        <div class="tag-filters-container">
                            <!-- Type Filter Column -->
                            <div class="tag-filter-column">
                                <div class="tag-filter-header">Types</div>
                                <input type="text" id="filter-type-search" class="tag-search-input" placeholder="Search types..." value="${this.typeSearchTerm}">
                                <div id="type-filter-list" class="tag-selector">
                                    <!-- Populated via JS -->
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Actions -->
                    <div class="transaction-actions" style="align-self: flex-start; margin-top: 22px;">
                        <button id="add-trip-save-btn" class="save-changes-btn" disabled>Add Selected (<span id="selection-count">0</span>)</button>
                    </div>
                </div>
                
                <!-- Table Search -->
                <div style="margin-bottom: 15px;">
                    <input type="text" id="trip-table-search" class="tag-search-input" style="width: 100%; padding: 12px; box-sizing: border-box; font-size: 1em; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2);" placeholder="Search Trip/Events..." value="${this.tripSearchTerm}">
                </div>

                <!-- Table -->
                <div id="add-trip-table-container"></div>
            </div>
        `;

        this.bindEvents();
        this.renderFilters();
        this.renderTable();
    }

    bindEvents() {
        // Back Button
        this.element.querySelector('#add-trip-back-btn').addEventListener('click', () => {
            if (this.callbacks.onBack) this.callbacks.onBack();
        });

        // Save Button
        this.element.querySelector('#add-trip-save-btn').addEventListener('click', () => {
            this.handleSave();
        });

        // Type Search
        this.element.querySelector('#filter-type-search').addEventListener('input', (e) => {
            this.typeSearchTerm = e.target.value;
            this.renderFilters();
        });

        // Trip Search
        this.element.querySelector('#trip-table-search').addEventListener('input', (e) => {
            this.tripSearchTerm = e.target.value;
            this.tableComponent.update(this.getFilteredData());
        });
    }

    renderFilters() {
        const container = this.element.querySelector('#type-filter-list');
        if (!container) return;
        container.innerHTML = '';

        const NO_TYPE = '__NO_TYPE__';
        
        // 1. No Type Option
        const noTypeDiv = document.createElement('div');
        noTypeDiv.className = 'tag-checkbox-item';
        noTypeDiv.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
        noTypeDiv.style.marginBottom = '5px';
        noTypeDiv.style.paddingBottom = '5px';
        
        const noTypeUid = `filter-type-none`;
        noTypeDiv.innerHTML = `<input type="checkbox" id="${noTypeUid}" /> <label for="${noTypeUid}"><em>(No Type)</em></label>`;
        
        const noTypeCb = noTypeDiv.querySelector('input');
        noTypeCb.checked = this.typeFilterSet.has(NO_TYPE);
        
        noTypeCb.addEventListener('change', (e) => {
            if (e.target.checked) this.typeFilterSet.add(NO_TYPE);
            else this.typeFilterSet.delete(NO_TYPE);
            this.tableComponent.update(this.getFilteredData());
        });
        container.appendChild(noTypeDiv);

        // 2. Type List
        const visibleTypes = this.allTypes
            .filter(t => t.toLowerCase().includes(this.typeSearchTerm.toLowerCase()))
            .sort();

        // Select All Visible
        if (visibleTypes.length > 0) {
             const selectAllDiv = document.createElement('div');
             selectAllDiv.className = 'tag-checkbox-item';
             selectAllDiv.innerHTML = `<input type="checkbox" id="filter-type-all-visible" /> <label for="filter-type-all-visible"><em>Select All Visible</em></label>`;
             
             const allVisibleSelected = visibleTypes.every(t => this.typeFilterSet.has(t));
             const selectAllCb = selectAllDiv.querySelector('input');
             selectAllCb.checked = allVisibleSelected;
             
             selectAllCb.addEventListener('change', (e) => {
                 if (e.target.checked) {
                     visibleTypes.forEach(t => this.typeFilterSet.add(t));
                 } else {
                     visibleTypes.forEach(t => this.typeFilterSet.delete(t));
                 }
                 this.renderFilters(); // Update checkboxes
                 this.tableComponent.update(this.getFilteredData());
             });
             container.appendChild(selectAllDiv);
        }

        visibleTypes.forEach(type => {
            const div = document.createElement('div');
            div.className = 'tag-checkbox-item';
            const isChecked = this.typeFilterSet.has(type);
            const uid = `filter-type-${type.replace(/\s+/g,'-')}`;
            div.innerHTML = `
                <input type="checkbox" id="${uid}" value="${type}" ${isChecked ? 'checked' : ''}>
                <label for="${uid}">${type}</label>
            `;
            const input = div.querySelector('input');
            input.addEventListener('change', (e) => {
                if (e.target.checked) this.typeFilterSet.add(type);
                else this.typeFilterSet.delete(type);
                this.tableComponent.update(this.getFilteredData());
            });
            container.appendChild(div);
        });
    }

    getFilteredData() {
        let filtered = this.allTrips;

        // Search Filter
        if (this.tripSearchTerm) {
            const term = this.tripSearchTerm.toLowerCase();
            filtered = filtered.filter(trip => trip.toLowerCase().includes(term));
        }

        // Type Filter
        if (this.typeFilterSet.size > 0) {
            filtered = filtered.filter(trip => {
                const type = this.tripTypeMap[trip];
                if (!type) return this.typeFilterSet.has('__NO_TYPE__');
                return this.typeFilterSet.has(type);
            });
        }

        return filtered.map(trip => ({
            row: trip, // SortableTable expects a 'row' property for selection
            trip: trip,
            type: this.tripTypeMap[trip] || '',
            selected: this.selectedTrips.has(trip)
        }));
    }

    renderTable() {
        const container = this.element.querySelector('#add-trip-table-container');
        
        this.tableComponent = new SortableTable(container, {
            enableSelection: true,
            columns: [
                { key: 'trip', label: 'Trip/Event', type: 'text', sortable: true },
                { key: 'type', label: 'Current Type', type: 'text', sortable: true }
            ],
            initialSortField: 'trip',
            initialSortAsc: true,
            onSelectionChange: (selectedIds) => {
                this.selectedTrips = new Set(selectedIds);
                this.updateSelectionUI();
            },
            // onRowClick is not needed for selection when enableSelection is true
            // If specific row details were needed on click, it would go here
        });

        // Header Select All Logic - handled by SortableTable when enableSelection: true
        // The previous manual event listener is no longer needed here.
        this.tableComponent.update(this.getFilteredData().map(item => ({...item, row: item.trip}))); // SortableTable expects 'row' as unique identifier
        this.updateSelectionUI();
    }

    updateSelectionUI() {
        const countSpan = this.element.querySelector('#selection-count');
        const saveButton = this.element.querySelector('#add-trip-save-btn');
        if (countSpan) {
            countSpan.textContent = this.selectedTrips.size;
        }
        if (saveButton) {
            saveButton.disabled = this.selectedTrips.size === 0;
            // Add/remove a class for visual feedback on disabled state
            if (saveButton.disabled) {
                saveButton.classList.add('disabled-btn');
            } else {
                saveButton.classList.remove('disabled-btn');
            }
        }
    }

    handleSave() {
        const selected = Array.from(this.selectedTrips);
        if (selected.length === 0) {
            alert("No trips selected.");
            return;
        }
        
        if (this.callbacks.onSave) {
            this.callbacks.onSave(selected, this.targetTypeName);
        }
    }
}
