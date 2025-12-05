export default class TransactionsFilters {
    constructor(element, callbacks) {
        this.element = element; 
        this.callbacks = callbacks || {}; // { onFilterChange, onFilterSelectAll, onSearchChange }
        this.bindEvents();
    }

    bindEvents() {
        const catSearch = this.element.querySelector('#transactions-cat-search');
        if (catSearch) {
            catSearch.addEventListener('input', (e) => {
                if (this.callbacks.onSearchChange) {
                    this.callbacks.onSearchChange('Category', e.target.value);
                }
            });
        }

        const tripSearch = this.element.querySelector('#transactions-trip-search');
        if (tripSearch) {
            tripSearch.addEventListener('input', (e) => {
                 if (this.callbacks.onSearchChange) {
                    this.callbacks.onSearchChange('Trip/Event', e.target.value);
                }
            });
        }
    }

    renderTagLists(tagsData, selectedCategories, selectedTrips, categorySearch, tripSearch) {
        this.populateTagList(
            'Category', 
            tagsData['Category'] || [], 
            selectedCategories, 
            categorySearch, 
            '#category-selector-container'
        );

        this.populateTagList(
            'Trip/Event', 
            tagsData['Trip/Event'] || [], 
            selectedTrips, 
            tripSearch, 
            '#trip-selector-container'
        );
    }

    populateTagList(type, tagsArray, selectionSet, searchTerm, containerId) {
        const container = this.element.querySelector(containerId);
        if (!container) return;

        container.innerHTML = '';
        const NO_TAG_VALUE = '__NO_TAG__';
        
        // 1. "No Tag" Option
        const noTagDiv = document.createElement('div');
        noTagDiv.className = 'tag-checkbox-item';
        noTagDiv.style.borderBottom = '1px solid rgba(255,255,255,0.1)'; 
        noTagDiv.style.marginBottom = '5px';
        noTagDiv.style.paddingBottom = '5px';
        
        const noTagUid = `notag-${type.replace('/','-')}`;
        noTagDiv.innerHTML = `<input type="checkbox" id="${noTagUid}" /> <label for="${noTagUid}"><em>(No Tag)</em></label>`;
        
        const noTagCheckbox = noTagDiv.querySelector('input');
        noTagCheckbox.checked = selectionSet.has(NO_TAG_VALUE);
        
        noTagCheckbox.addEventListener('change', (e) => {
            if (this.callbacks.onFilterChange) {
                this.callbacks.onFilterChange(type, NO_TAG_VALUE, e.target.checked);
            }
        });
        container.appendChild(noTagDiv);

        if (tagsArray.length === 0) {
            container.innerHTML += '<div style="padding:5px;">No tags found</div>';
            return;
        }

        const sortedTags = [...tagsArray].sort();
        const visibleTags = sortedTags.filter(tag => tag.toLowerCase().includes(searchTerm));

        // 2. Select All
        if (visibleTags.length > 0) {
            const selectAllDiv = document.createElement('div');
            selectAllDiv.className = 'tag-checkbox-item';
            const selectAllUid = `all-${type.replace('/','-')}`;
            selectAllDiv.innerHTML = `<input type="checkbox" id="${selectAllUid}" /> <label for="${selectAllUid}"><em>Select All Visible</em></label>`;
            
            const allVisibleSelected = visibleTags.every(t => selectionSet.has(t));
            const checkbox = selectAllDiv.querySelector('input');
            checkbox.checked = allVisibleSelected;

            checkbox.addEventListener('change', (e) => {
                 if (this.callbacks.onFilterSelectAll) {
                     this.callbacks.onFilterSelectAll(type, visibleTags, e.target.checked);
                 }
            });
            container.appendChild(selectAllDiv);
        } else {
             container.innerHTML += '<div style="padding:5px; color:#ccc;">No matches found</div>';
        }

        // 3. Tags
        visibleTags.forEach(tag => {
            const div = document.createElement('div');
            div.className = 'tag-checkbox-item';
            const isChecked = selectionSet.has(tag);
            const uid = `tx-${type.replace('/','-')}-${tag.replace(/\s+/g,'-')}`; 
            div.innerHTML = `
                <input type="checkbox" id="${uid}" value="${tag}" class="tag-item-input" ${isChecked ? 'checked' : ''}>
                <label for="${uid}">${tag}</label>
            `;
            const input = div.querySelector('input');
            input.addEventListener('change', (e) => {
                if (this.callbacks.onFilterChange) {
                    this.callbacks.onFilterChange(type, tag, e.target.checked);
                }
            });
            container.appendChild(div);
        });
    }
}
