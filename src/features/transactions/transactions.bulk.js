import store from '../../core/state.js';

export default class TransactionsBulk {
    constructor(element, callbacks) {
        this.element = element;
        this.callbacks = callbacks || {}; // { onToggleMode, onApply }
        
        // State
        this.bulkTripState = { value: null, search: '', isOpen: false };
        this.bulkCategoryState = { value: null, search: '', isOpen: false };

        this.bindEvents();
    }

    bindEvents() {
        this.tagTransactionsBtn = this.element.querySelector('#tag-transactions-btn');
        this.bulkToolbar = this.element.querySelector('#bulk-actions-toolbar');
        this.mainControls = this.element.querySelector('#main-controls');
        this.selectionCount = this.element.querySelector('#selection-count');

        if (this.tagTransactionsBtn) {
            this.tagTransactionsBtn.addEventListener('click', () => {
                 if (this.callbacks.onToggleMode) this.callbacks.onToggleMode(true);
            });
        }
        
        const cancelBtn = this.element.querySelector('#bulk-cancel-btn');
        if (cancelBtn) {
             cancelBtn.addEventListener('click', () => {
                 if (this.callbacks.onToggleMode) this.callbacks.onToggleMode(false);
            });
        }

        const applyBtn = this.element.querySelector('#bulk-apply-btn');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => this.handleApply());
        }
        
        // Bulk Dropdown Listeners
        this.setupBulkDropdown('trip', '#bulk-trip-container', '#bulk-trip-trigger', '#bulk-trip-content', '#bulk-trip-search', 'Trip/Event');
        this.setupBulkDropdown('category', '#bulk-category-container', '#bulk-category-trigger', '#bulk-category-content', '#bulk-category-search', 'Category');
    }

    handleApply() {
        const tripVal = this.bulkTripState.value;
        const catVal = this.bulkCategoryState.value;
        
        if (!tripVal && !catVal) {
            alert("Please select a Trip/Event or Category to apply.");
            return; 
        }
        
        if (this.callbacks.onApply) {
            this.callbacks.onApply(tripVal, catVal);
        }
    }

    toggleSelectionMode(active, selectedCount) {
      if (!active) {
          // Reset Bulk State
          this.bulkTripState = { value: null, search: '', isOpen: false };
          this.bulkCategoryState = { value: null, search: '', isOpen: false };
          this.closeBulkDropdown('trip');
          this.closeBulkDropdown('category');
          // Reset Triggers Text
          const tripTrigger = this.element.querySelector('#bulk-trip-trigger');
          const catTrigger = this.element.querySelector('#bulk-category-trigger');
          if(tripTrigger) tripTrigger.textContent = 'Set Trip/Event...';
          if(catTrigger) catTrigger.textContent = 'Set Category...';
          
          // Clear searches
          const tripSearch = this.element.querySelector('#bulk-trip-search');
          const catSearch = this.element.querySelector('#bulk-category-search');
          if(tripSearch) tripSearch.value = '';
          if(catSearch) catSearch.value = '';
      }
      
      if (!this.bulkToolbar || !this.mainControls) return;

      this.updateSelectionCount(selectedCount);

      if (active) {
          this.bulkToolbar.style.display = 'block';
          this.mainControls.classList.add('disabled');
      } else {
          this.bulkToolbar.style.display = 'none';
          this.mainControls.classList.remove('disabled');
      }
    }

    updateSelectionCount(count) {
        if (this.selectionCount) {
            this.selectionCount.textContent = `${count} selected`;
        }
    }

    handleGlobalClick(e) {
        // Close Trip Dropdown if clicked outside
        if (!e.target.closest('#bulk-trip-container')) {
            this.closeBulkDropdown('trip');
        }
        
        // Close Category Dropdown if clicked outside
        if (!e.target.closest('#bulk-category-container')) {
            this.closeBulkDropdown('category');
        }
    }

    setupBulkDropdown(type, containerId, triggerId, contentId, searchId, tagName) {
        const container = this.element.querySelector(containerId);
        const trigger = this.element.querySelector(triggerId);
        const content = this.element.querySelector(contentId);
        const search = this.element.querySelector(searchId);
        
        if (!container || !trigger || !content || !search) return;
  
        // Toggle Dropdown
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const state = type === 'trip' ? this.bulkTripState : this.bulkCategoryState;
            if (state.isOpen) {
                this.closeBulkDropdown(type);
            } else {
                // Close other dropdown first
                if (type === 'trip') this.closeBulkDropdown('category');
                else this.closeBulkDropdown('trip');
                
                this.openBulkDropdown(type);
            }
        });
  
        // Search Input
        search.addEventListener('input', (e) => {
            const state = type === 'trip' ? this.bulkTripState : this.bulkCategoryState;
            state.search = e.target.value.toLowerCase();
            this.renderBulkTagList(tagName, type === 'trip' ? '#bulk-trip-list' : '#bulk-category-list', state);
        });
        
        // Prevent closing when clicking inside the dropdown content
        content.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
  
    openBulkDropdown(type) {
        const state = type === 'trip' ? this.bulkTripState : this.bulkCategoryState;
        const contentId = type === 'trip' ? '#bulk-trip-content' : '#bulk-category-content';
        const content = this.element.querySelector(contentId);
        const searchId = type === 'trip' ? '#bulk-trip-search' : '#bulk-category-search';
        
        if (content) {
            content.style.display = 'block';
            state.isOpen = true;
            // Focus search
            setTimeout(() => {
                const search = this.element.querySelector(searchId);
                if(search) search.focus();
            }, 50);
        }
    }
  
    closeBulkDropdown(type) {
        const state = type === 'trip' ? this.bulkTripState : this.bulkCategoryState;
        const contentId = type === 'trip' ? '#bulk-trip-content' : '#bulk-category-content';
        const content = this.element.querySelector(contentId);
        
        if (content) {
            content.style.display = 'none';
            state.isOpen = false;
        }
    }

    renderBulkTagLists() {
         this.renderBulkTagList('Trip/Event', '#bulk-trip-list', this.bulkTripState);
         this.renderBulkTagList('Category', '#bulk-category-list', this.bulkCategoryState);
    }

    renderBulkTagList(tagName, listId, stateObj) {
        const container = this.element.querySelector(listId);
        if (!container) return;
        
        container.innerHTML = '';
        const tagsData = store.getState('tags') || {};
        const tags = tagsData[tagName] || [];
        const sortedTags = [...tags].sort();
        const visibleTags = sortedTags.filter(tag => tag.toLowerCase().includes(stateObj.search));
        
        // "No Tag" Option
        const noTagDiv = document.createElement('div');
        noTagDiv.className = `tag-item-option ${stateObj.value === '__REMOVE__' ? 'selected' : ''}`;
        noTagDiv.innerHTML = '<em>(No Tag)</em>';
        noTagDiv.addEventListener('click', () => {
            this.handleBulkSelection(tagName, '__REMOVE__', stateObj);
        });
        container.appendChild(noTagDiv);
  
        if (visibleTags.length === 0) {
            container.innerHTML += '<div style="padding:5px; color:#ccc;">No matches found</div>';
        }
  
        visibleTags.forEach(tag => {
            const div = document.createElement('div');
            div.className = `tag-item-option ${stateObj.value === tag ? 'selected' : ''}`;
            div.textContent = tag;
            div.addEventListener('click', () => {
                this.handleBulkSelection(tagName, tag, stateObj);
            });
            container.appendChild(div);
        });
    }
  
    handleBulkSelection(tagName, value, stateObj) {
        stateObj.value = value;
        
        // Update Trigger Text
        const triggerId = tagName === 'Category' ? '#bulk-category-trigger' : '#bulk-trip-trigger';
        const trigger = this.element.querySelector(triggerId);
        
        if (trigger) {
            if (value === '__REMOVE__') {
                trigger.innerHTML = '<em>(No Tag)</em>';
            } else {
                trigger.textContent = value;
            }
        }
        
        // Close Dropdown
        if (tagName === 'Category') this.closeBulkDropdown('category');
        else this.closeBulkDropdown('trip');
        
        // Re-render list to show selection state (highlighting)
        const listId = tagName === 'Category' ? '#bulk-category-list' : '#bulk-trip-list';
        this.renderBulkTagList(tagName, listId, stateObj);
    }
}
