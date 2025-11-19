// src/features/tags/tags.component.js
import store from '../../core/state.js';
import ApiService from '../../services/api.service.js';

class TagsComponent {
  constructor(element) {
    this.element = element;
    this.operations = [];
    this.isEditMode = false;
    this.render();
    store.subscribe('tags', () => this.render());
    store.subscribe('expenses', () => this.render());
  }

  render() {
    this.element.innerHTML = `
      <div id="tags-table-container" style="display: ${this.isEditMode ? 'none' : 'block'}">
          ${this.renderTagsTable()}
      </div>
      <div id="tags-edit-container" style="display: ${this.isEditMode ? 'block' : 'none'}">
          ${this.renderTagsEdit()}
      </div>
      <div class="tags-actions">
        <button id="edit-tags-button">${this.isEditMode ? 'Cancel' : 'Edit Tags'}</button>
        <button id="save-tags-changes-button" style="display: ${this.isEditMode ? 'inline-block' : 'none'}">Save Changes</button>
      </div>
    `;
    this.attachEventListeners();
  }

  renderTagsTable() {
    const tags = store.getState('tags') || { 'Trip/Event': [], 'Category': [] };
    const expenseCounts = this.calculateExpenseCounts();
    
    const renderTable = (tagType) => {
        const tagList = tags[tagType] || [];
        const rows = tagList.length === 0 
            ? '<tr><td colspan="2">No tags found.</td></tr>'
            : tagList.map(tag => `<tr><td>${tag}</td><td>${expenseCounts[tagType][tag] || 0}</td></tr>`).join('');
        
        return `
            <div class="table-container">
              <h3>${tagType} Tags</h3>
              <table class="data-table">
                <thead><tr><th>Tag</th><th>Expense Count</th></tr></thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
        `;
    }
    return renderTable('Trip/Event') + renderTable('Category');
  }

  renderTagsEdit() {
      const tags = store.getState('tags') || { 'Trip/Event': [], 'Category': [] };

      const renderEditList = (tagType) => {
          const tagList = tags[tagType] || [];
          const items = tagList.map(tag => `
            <div class="tag-edit-item" data-tag="${tag}" data-type="${tagType}">
                <span>${tag}</span>
                <button class="rename-tag-btn">Rename</button>
                <button class="delete-tag-btn">Delete</button>
            </div>
          `).join('');

          return `
            <div class="tags-edit-column">
                <h3>${tagType} Tags</h3>
                <div class="add-tag-form">
                    <input type="text" placeholder="New ${tagType} tag" id="add-${tagType}-input">
                    <button class="add-tag-btn" data-type="${tagType}">Add</button>
                </div>
                <div class="tag-edit-list">${items}</div>
            </div>
          `;
      }
      return renderEditList('Trip/Event') + renderEditList('Category');
  }

  attachEventListeners() {
    this.element.querySelector('#edit-tags-button').addEventListener('click', () => {
        this.isEditMode = !this.isEditMode;
        this.operations = [];
        this.render();
    });

    if (this.isEditMode) {
        this.element.querySelector('#save-tags-changes-button').addEventListener('click', () => this.saveChanges());

        this.element.querySelectorAll('.add-tag-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = e.target.dataset.type;
                const input = this.element.querySelector(`#add-${type}-input`);
                const value = input.value.trim();
                if (value) {
                    this.operations.push([null, value, 'add', type]);
                    // Optimistically update UI
                    const tags = store.getState('tags');
                    tags[type].push(value);
                    store.setState('tags', tags);
                    input.value = '';
                }
            });
        });
        
        this.element.querySelectorAll('.delete-tag-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const item = e.target.closest('.tag-edit-item');
                const tag = item.dataset.tag;
                const type = item.dataset.type;
                this.operations.push([tag, null, 'delete', type]);
                // Optimistically update UI
                const tags = store.getState('tags');
                tags[type] = tags[type].filter(t => t !== tag);
                store.setState('tags', tags);
            });
        });
        
        this.element.querySelectorAll('.rename-tag-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const item = e.target.closest('.tag-edit-item');
                const tag = item.dataset.tag;
                const type = item.dataset.type;
                const newName = prompt(`Enter new name for "${tag}":`, tag);
                if (newName && newName.trim() !== tag) {
                    this.operations.push([tag, newName.trim(), 'rename', type]);
                    // Optimistically update UI
                    const tags = store.getState('tags');
                    tags[type] = tags[type].map(t => t === tag ? newName.trim() : t);
                    store.setState('tags', tags);
                }
            });
        });
    }
  }

  async saveChanges() {
    if (this.operations.length > 0) {
        await ApiService.processTagOperations(this.operations);
        document.dispatchEvent(new CustomEvent('dataUploaded'));
    }
    this.isEditMode = false;
    this.operations = [];
    this.render();
  }

  calculateExpenseCounts() {
    const expenses = store.getState('expenses') || [];
    const expenseCounts = { "Trip/Event": {}, "Category": {} };
    expenses.forEach(item => {
      const tripEventTag = item["Trip/Event"];
      const categoryTag = item["Category"];
      if (tripEventTag) expenseCounts["Trip/Event"][tripEventTag] = (expenseCounts["Trip/Event"][tripEventTag] || 0) + 1;
      if (categoryTag) expenseCounts["Category"][categoryTag] = (expenseCounts["Category"][categoryTag] || 0) + 1;
    });
    return expenseCounts;
  }
}

export default TagsComponent;
