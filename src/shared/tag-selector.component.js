import store from '../core/state.js';

export default class TagSelector {
    constructor() {
        this.isOpen = false;
        this.currentConfig = null; // { x, y, type, onSelect, currentVal }
        this.searchTerm = '';
        
        this.element = document.createElement('div');
        this.element.className = 'tag-selector-popover';
        this.element.style.display = 'none';
        document.body.appendChild(this.element);
        
        // Global click to close
        document.addEventListener('click', (e) => {
            if (this.isOpen && !this.element.contains(e.target) && !e.target.closest('.tag-interactive-area') && !e.target.closest('.tag-pill') && !e.target.closest('.add-tag-placeholder')) {
                this.close();
            }
        });

        // Render structure once
        this.element.innerHTML = `
            <input type="text" id="tag-selector-search-input" name="tag-selector-search" aria-label="Search Tags" class="tag-selector-search" placeholder="Search..." />
            <div class="tag-selector-list"></div>
        `;
        
        this.searchInput = this.element.querySelector('input');
        this.listContainer = this.element.querySelector('.tag-selector-list');
        
        this.searchInput.addEventListener('input', (e) => {
            this.searchTerm = e.target.value.toLowerCase();
            this.renderList();
        });

        // Prevent closing when clicking inside
        this.element.addEventListener('click', (e) => e.stopPropagation());
    }

    show(rect, type, currentVal, onSelect, customOptions = null) {
        this.currentConfig = { type, onSelect, currentVal, customOptions };
        this.searchTerm = '';
        this.searchInput.value = '';
        
        this.renderList();
        
        this.element.style.display = 'block';
        this.isOpen = true;

        // Position
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;
        
        // Default position: below the element
        let top = rect.bottom + scrollY + 5;
        let left = rect.left + scrollX;

        // Boundary checks (simple)
        if (left + 200 > window.innerWidth) {
            left = window.innerWidth - 210;
        }
        
        this.element.style.top = `${top}px`;
        this.element.style.left = `${left}px`;
        
        this.searchInput.focus();
    }

    close() {
        this.isOpen = false;
        this.element.style.display = 'none';
        this.currentConfig = null;
    }

    renderList() {
        if (!this.currentConfig) return;
        
        const { type, onSelect, customOptions } = this.currentConfig;
        let tags = [];
        
        if (customOptions) {
            tags = customOptions;
        } else {
            const tagsData = store.getState('tags') || {};
            // Map 'Trip/Event' column key to 'Trip/Event' tag key (which matches)
            // Map 'Category' column key to 'Category' tag key
            tags = tagsData[type] || [];
        }
        
        const filteredTags = tags.filter(tag => 
            tag.toLowerCase().includes(this.searchTerm)
        ).sort();

        this.listContainer.innerHTML = '';

        if (filteredTags.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'tag-selector-item empty';
            empty.textContent = 'No matching tags';
            this.listContainer.appendChild(empty);
        }

        filteredTags.forEach(tag => {
            const item = document.createElement('div');
            item.className = 'tag-selector-item';
            item.textContent = tag;
            item.addEventListener('click', () => {
                onSelect(tag);
                this.close();
            });
            this.listContainer.appendChild(item);
        });
    }
}
