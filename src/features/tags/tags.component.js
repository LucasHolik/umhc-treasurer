// src/features/tags/tags.component.js
import store from '../../core/state.js';
import ApiService from '../../services/api.service.js';
import LoaderComponent from '../../shared/loader.component.js';
import ModalComponent from '../../shared/modal.component.js';

class TagsComponent {
  constructor(element) {
    this.element = element;
    this.queue = [];
    this.localTags = null; // Used in edit mode
    this.isEditMode = false;
    this.modal = new ModalComponent();
    
    // Bind methods
    this.render = this.render.bind(this);
    this.handleEdit = this.handleEdit.bind(this);
    this.handleCancel = this.handleCancel.bind(this);
    this.handleSave = this.handleSave.bind(this);
    
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
            flex-wrap: wrap;
        }
        .tags-column {
            flex: 1;
            min-width: 300px;
            background-color: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
            padding: 15px;
        }
        .tags-header-actions {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        .tag-input-group {
            display: flex;
            gap: 10px;
            margin-top: 10px;
            padding: 10px;
            background: rgba(0,0,0,0.2);
            border-radius: 4px;
        }
        .tag-input-group input {
            flex: 1;
            padding: 8px;
            border-radius: 4px;
            border: 1px solid #555;
            background: #333;
            color: #fff;
        }
        .icon-btn {
            background: none;
            border: none;
            cursor: pointer;
            font-size: 1.2em;
            padding: 5px;
            transition: transform 0.2s;
        }
        .icon-btn:hover {
            transform: scale(1.1);
        }
        .delete-btn { color: #d9534f; }
        .rename-btn { color: #f0ad4e; }
        .save-btn { color: #5cb85c; }
        .cancel-btn { color: #d9534f; }
      </style>
      <div class="section">
        <div class="tags-header-actions">
            <h2>Manage Tags</h2>
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
    const expenseCounts = this.calculateExpenseCounts();
    
    // Sort alphabetically
    const sortedTags = [...tagsList].sort();

    let rows = '';
    if (sortedTags.length === 0) {
        rows = `<tr><td colspan="${this.isEditMode ? 3 : 2}">No tags found.</td></tr>`;
    } else {
        rows = sortedTags.map(tag => {
            const count = expenseCounts[type][tag] || 0;
            const actions = this.isEditMode ? `
                <td style="text-align: right;">
                    <button class="icon-btn rename-btn" data-tag="${tag}" data-type="${type}" title="Rename">✏️</button>
                    <button class="icon-btn delete-btn" data-tag="${tag}" data-type="${type}" title="Delete">🗑️</button>
                </td>
            ` : '';
            
            return `
                <tr>
                    <td>${tag}</td>
                    <td>${count} transactions</td>
                    ${actions}
                </tr>
            `;
        }).join('');
    }

    const addForm = this.isEditMode ? `
        <div class="tag-input-group">
            <input type="text" id="new-tag-${type.replace(/\W/g, '')}" placeholder="Add new ${type} tag...">
            <button class="secondary-btn add-tag-btn" data-type="${type}">Add</button>
        </div>
    ` : '';

    return `
        <div class="tags-column">
            <h3>${type} Tags</h3>
            <div style="overflow-x: auto;">
                <table class="section-table">
                    <thead>
                        <tr>
                            <th>Tag Name</th>
                            <th style="width: 120px;">Usage</th>
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

  calculateExpenseCounts() {
    const expenses = store.getState('expenses') || [];
    // Deep copy initial counts
    const expenseCounts = { "Trip/Event": {}, "Category": {} };
    
    expenses.forEach(item => {
      const tripEventTag = item["Trip/Event"];
      const categoryTag = item["Category"];
      
      if (tripEventTag) {
          expenseCounts["Trip/Event"][tripEventTag] = (expenseCounts["Trip/Event"][tripEventTag] || 0) + 1;
      }
      if (categoryTag) {
          expenseCounts["Category"][categoryTag] = (expenseCounts["Category"][categoryTag] || 0) + 1;
      }
    });

    // If in edit mode, replay the queue operations on the counts
    if (this.isEditMode && this.queue.length > 0) {
        this.queue.forEach(op => {
            const type = op.tagType;
            if (!expenseCounts[type]) expenseCounts[type] = {};

            if (op.type === 'rename') {
                const count = expenseCounts[type][op.oldValue] || 0;
                // Add to new value
                expenseCounts[type][op.newValue] = (expenseCounts[type][op.newValue] || 0) + count;
                // Remove from old value
                delete expenseCounts[type][op.oldValue];
            } else if (op.type === 'delete') {
                delete expenseCounts[type][op.value];
            } else if (op.type === 'add') {
                if (!expenseCounts[type][op.value]) {
                    expenseCounts[type][op.value] = 0;
                }
            }
        });
    }

    return expenseCounts;
  }

  attachEventListeners() {
    const editBtn = this.element.querySelector('#edit-tags-btn');
    const cancelBtn = this.element.querySelector('#cancel-tags-btn');
    const saveBtn = this.element.querySelector('#save-tags-btn');

    if (editBtn) editBtn.addEventListener('click', this.handleEdit);
    if (cancelBtn) cancelBtn.addEventListener('click', this.handleCancel);
    if (saveBtn) saveBtn.addEventListener('click', this.handleSave);

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