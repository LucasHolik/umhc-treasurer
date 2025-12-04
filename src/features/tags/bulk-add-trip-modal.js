import ModalComponent from '../../shared/modal.component.js';
import SortableTable from '../../shared/sortable-table.component.js';

export default class BulkAddTripModal {
    constructor(typeName, candidateTrips, tripTypeMap, allTypes, onConfirm) {
        this.typeName = typeName;
        this.candidateTrips = candidateTrips; // List of trip names
        this.tripTypeMap = tripTypeMap;       // Map { TripName: TypeName }
        this.allTypes = allTypes;             // List of all available Types
        this.onConfirm = onConfirm;

        // State
        this.selectedTrips = new Set();
        this.filterTypes = new Set();         // Set of Types to filter by (empty = show all?) - usually empty means show all or none? 
                                              // Transaction filter: empty usually means "All".
        this.tripSearchTerm = "";
        this.typeSearchTerm = "";

        // Initialize modal
        this.modalOverlay = null;
    }

    show() {
        this.modalOverlay = document.createElement('div');
        this.modalOverlay.className = 'modal-overlay';
        
        // Basic Structure
        this.modalOverlay.innerHTML = `
            <div class="modal-content" style="width: 90%; max-width: 1000px; display: flex; flex-direction: column; max-height: 90vh;">
                <div class="modal-header">
                    <h3>Add Trip/Events to "${this.typeName}"</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body" style="flex: 1; display: flex; overflow: hidden; padding: 0;">
                    <!-- Left Sidebar: Filters -->
                    <div class="modal-sidebar" style="width: 250px; background: rgba(0,0,0,0.2); padding: 15px; display: flex; flex-direction: column; border-right: 1px solid rgba(255,255,255,0.1);">
                        <h4 style="margin-top: 0; margin-bottom: 10px; color: #f0ad4e;">Filter by Type</h4>
                        <input type="text" id="type-filter-search" class="tag-search-input" placeholder="Search Types..." style="margin-bottom: 10px; width: 100%;">
                        <div id="type-filter-list" class="tag-selector" style="flex: 1; border: none; padding: 0;"></div>
                    </div>

                    <!-- Main Content: Table -->
                    <div class="modal-main" style="flex: 1; padding: 15px; display: flex; flex-direction: column; overflow: hidden;">
                        <div style="margin-bottom: 10px; display: flex; gap: 10px; align-items: center;">
                            <input type="text" id="trip-table-search" class="tag-search-input" placeholder="Search Trip/Events..." style="flex: 1;">
                            <div id="selection-count" style="color: #aaa; font-size: 0.9em;">0 selected</div>
                        </div>
                        <div id="trip-table-container" style="flex: 1; overflow-y: auto;"></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="modal-btn modal-btn-cancel">Cancel</button>
                    <button class="modal-btn modal-btn-confirm">Add Selected</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.modalOverlay);
        
        this.bindEvents();
        this.renderFilters();
        this.renderTable();
    }

    bindEvents() {
        const close = () => {
            this.modalOverlay.style.opacity = '0';
            setTimeout(() => {
                if (document.body.contains(this.modalOverlay)) {
                    document.body.removeChild(this.modalOverlay);
                }
            }, 200);
        };

        this.modalOverlay.querySelector('.modal-close').addEventListener('click', close);
        this.modalOverlay.querySelector('.modal-btn-cancel').addEventListener('click', close);
        
        this.modalOverlay.querySelector('.modal-btn-confirm').addEventListener('click', () => {
            const selected = Array.from(this.selectedTrips);
            if (selected.length === 0) {
                // Maybe alert?
                return;
            }
            this.onConfirm(selected);
            close();
        });

        // Type Search
        this.modalOverlay.querySelector('#type-filter-search').addEventListener('input', (e) => {
            this.typeSearchTerm = e.target.value;
            this.renderFilters();
        });

        // Trip Search
        this.modalOverlay.querySelector('#trip-table-search').addEventListener('input', (e) => {
            this.tripSearchTerm = e.target.value;
            this.renderTable();
        });
    }

    renderFilters() {
        const container = this.modalOverlay.querySelector('#type-filter-list');
        container.innerHTML = '';

        // Data Preparation
        // "No Type" is a special case
        // "All Types" from `this.allTypes`
        const NO_TYPE = '__NO_TYPE__';
        
        // 1. "No Type" Option
        const noTypeDiv = document.createElement('div');
        noTypeDiv.className = 'tag-checkbox-item';
        noTypeDiv.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
        noTypeDiv.style.marginBottom = '5px';
        noTypeDiv.style.paddingBottom = '5px';
        
        const noTypeUid = `filter-type-none`;
        const noTypeChecked = this.filterTypes.has(NO_TYPE);
        
        noTypeDiv.innerHTML = `<input type="checkbox" id="${noTypeUid}" /> <label for="${noTypeUid}"><em>(No Type)</em></label>`;
        const noTypeCheckbox = noTypeDiv.querySelector('input');
        noTypeCheckbox.checked = noTypeChecked;
        
        noTypeCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) this.filterTypes.add(NO_TYPE);
            else this.filterTypes.delete(NO_TYPE);
            this.renderTable();
        });
        container.appendChild(noTypeDiv);

        // 2. Available Types
        const visibleTypes = this.allTypes.filter(t => t.toLowerCase().includes(this.typeSearchTerm.toLowerCase())).sort();
        
        // Select All Visible Helper (Optional, but good UX)
        if (visibleTypes.length > 0) {
             const selectAllDiv = document.createElement('div');
             selectAllDiv.className = 'tag-checkbox-item';
             selectAllDiv.innerHTML = `<input type="checkbox" id="filter-type-all-visible" /> <label for="filter-type-all-visible"><em>Select All Visible</em></label>`;
             
             // Check if all visible are selected
             const allVisibleSelected = visibleTypes.every(t => this.filterTypes.has(t));
             const selectAllCb = selectAllDiv.querySelector('input');
             selectAllCb.checked = allVisibleSelected;
             
             selectAllCb.addEventListener('change', (e) => {
                 if (e.target.checked) {
                     visibleTypes.forEach(t => this.filterTypes.add(t));
                 } else {
                     visibleTypes.forEach(t => this.filterTypes.delete(t));
                 }
                 // Re-render filters to update individual checkboxes
                 this.renderFilters(); 
                 this.renderTable();
             });
             container.appendChild(selectAllDiv);
        }

        visibleTypes.forEach(type => {
            const div = document.createElement('div');
            div.className = 'tag-checkbox-item';
            const isChecked = this.filterTypes.has(type);
            const uid = `filter-type-${type.replace(/\s+/g,'-')}`;
            div.innerHTML = `
                <input type="checkbox" id="${uid}" value="${type}" ${isChecked ? 'checked' : ''}>
                <label for="${uid}">${type}</label>
            `;
            const input = div.querySelector('input');
            input.addEventListener('change', (e) => {
                if (e.target.checked) this.filterTypes.add(type);
                else this.filterTypes.delete(type);
                // Update "Select All" state visually if needed, or just let next render handle it
                // For now simpler to just re-render table
                this.renderTable();
            });
            container.appendChild(div);
        });
    }

    renderTable() {
        const container = this.modalOverlay.querySelector('#trip-table-container');
        // Clear previous content handled by SortableTable update, but if it doesn't exist create it.
        
        // Filter Data
        // 1. By Search Term
        let filtered = this.candidateTrips.filter(trip => 
            trip.toLowerCase().includes(this.tripSearchTerm.toLowerCase())
        );

        // 2. By Type Filter
        // If filterTypes is empty, show all? Or show none? 
        // Standard UI: Empty usually implies "no filters applied" -> Show All. 
        // But the user said "filter what I can see".
        if (this.filterTypes.size > 0) {
            filtered = filtered.filter(trip => {
                const type = this.tripTypeMap[trip];
                if (!type) return this.filterTypes.has('__NO_TYPE__');
                return this.filterTypes.has(type);
            });
        }

        const data = filtered.map(trip => ({
            trip: trip,
            type: this.tripTypeMap[trip] || '',
            selected: this.selectedTrips.has(trip)
        }));

        // Update Count
        this.modalOverlay.querySelector('#selection-count').textContent = `${this.selectedTrips.size} selected`;

        if (!this.table) {
            this.table = new SortableTable(container, {
                columns: [
                    {
                        key: 'selected',
                        label: '<input type="checkbox" id="trip-select-all-header">', 
                        type: 'custom',
                        sortable: false,
                        width: '40px',
                        render: (item) => `<input type="checkbox" ${item.selected ? 'checked' : ''} style="pointer-events: none;">` 
                        // pointer-events: none because we handle row click
                    },
                    { key: 'trip', label: 'Trip/Event', type: 'text', sortable: true },
                    { key: 'type', label: 'Current Type', type: 'text', sortable: true }
                ],
                initialSortField: 'trip',
                initialSortAsc: true,
                onRowClick: (item) => {
                    if (this.selectedTrips.has(item.trip)) {
                        this.selectedTrips.delete(item.trip);
                    } else {
                        this.selectedTrips.add(item.trip);
                    }
                    this.renderTable();
                }
            });

            // Header Select All Logic
            // SortableTable renders HTML string for label. We need to attach listener after render.
            // But SortableTable re-renders on sort.
            // We might need to inject the listener every update or use delegation.
            // SortableTable implementation replaces innerHTML.
            // Let's hack it slightly: attach listener to container and check target.
            container.addEventListener('change', (e) => {
                if (e.target.id === 'trip-select-all-header') {
                    const allVisible = data.map(d => d.trip);
                    if (e.target.checked) {
                        allVisible.forEach(t => this.selectedTrips.add(t));
                    } else {
                        allVisible.forEach(t => this.selectedTrips.delete(t));
                    }
                    this.renderTable();
                }
            });
        }
        
        this.table.update(data);

        // Re-sync header checkbox state
        const headerCheckbox = container.querySelector('#trip-select-all-header');
        if (headerCheckbox) {
            const allVisibleSelected = data.length > 0 && data.every(d => d.selected);
            headerCheckbox.checked = allVisibleSelected;
            headerCheckbox.indeterminate = data.some(d => d.selected) && !allVisibleSelected;
        }
    }
}
