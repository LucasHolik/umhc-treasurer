import store from '../../core/state.js';
import ApiService from '../../services/api.service.js';
import ModalComponent from '../../shared/modal.component.js';
import router from '../../core/router.js';
import TagsList from './tags.list.js';
import TagsDetails from './tags.details.js';

class TagsComponent {
  constructor(element) {
    this.element = element;
    
    // Edit Mode State
    this.queue = [];
    this.localTags = null; 
    this.isEditMode = false;
    
    // View State
    this.viewMode = 'list'; // 'list' | 'details'
    this.selectedTag = null; // { type, name }

    this.modal = new ModalComponent();
    
    // Bind methods
    this.render = this.render.bind(this);
    
    // Initialize Sub-Components
    // We will instantiate them on render or keep them persistent?
    // Persistent allows them to keep their internal state (search, sort).
    this.tagsList = new TagsList(element, {
        onEditModeToggle: (isEdit) => this.handleEditModeToggle(isEdit),
        onSave: () => this.handleSave(),
        onTagClick: (type, name) => this.handleTagClick(type, name),
        onTagAdd: (type, value) => this.handleTagAdd(type, value),
        onTagDelete: (type, value) => this.handleTagDelete(type, value),
        onTagRename: (type, oldValue) => this.handleTagRename(type, oldValue)
    });

    this.tagsDetails = new TagsDetails(element, {
        onBack: () => this.handleBack(),
        onAddTransactions: (type, name) => this.handleAddTransactions(type, name)
    });

    this.render();
    
    // Subscribe to relevant state changes
    store.subscribe('tags', () => {
        if (!this.isEditMode && this.viewMode === 'list') this.render();
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

    // Clear container before sub-component render if needed, 
    // but sub-components usually overwrite innerHTML.
    // However, TagsList and TagsDetails expect `this.element` to be their container.
    // Since they share the same container, one overwrites the other.
    
    if (this.viewMode === 'list') {
        this.tagsList.render(this.isEditMode, this.localTags, this.queue);
    } else if (this.viewMode === 'details' && this.selectedTag) {
        this.tagsDetails.render(this.selectedTag.type, this.selectedTag.name);
    }
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

  // --- Navigation Handlers ---

  handleTagClick(type, name) {
      this.selectedTag = { type, name };
      this.viewMode = 'details';
      this.render();
  }

  handleBack() {
      this.selectedTag = null;
      this.viewMode = 'list';
      this.render();
  }

  handleAddTransactions(type, name) {
      // Set intent in store
      store.setState('transactionParams', {
          mode: 'bulk',
          prefill: {
              type: type,
              value: name
          }
      });
      
      // Navigate
      router.navigate('transactions');
  }

  // --- Edit Mode Handlers ---

  async handleEditModeToggle(isEdit) {
      if (isEdit) {
          // Enter Edit Mode
          this.localTags = JSON.parse(JSON.stringify(store.getState('tags')));
          this.queue = [];
          this.isEditMode = true;
          this.render();
      } else {
          // Cancel Edit Mode
          if (this.queue.length > 0) {
              const confirmed = await this.modal.confirm('You have unsaved changes. Are you sure you want to cancel?', 'Unsaved Changes');
              if (!confirmed) return;
          }
          this.isEditMode = false;
          this.localTags = null;
          this.queue = [];
          this.render();
      }
  }

  async handleTagAdd(type, value) {
        if (!value) return;
        if (this.localTags[type].includes(value)) {
            await this.modal.alert('Tag already exists!');
            return;
        }
        this.localTags[type].push(value);
        this.queue.push({ type: 'add', tagType: type, value: value });
        this.render();
  }

  async handleTagDelete(type, tag) {
      const confirmed = await this.modal.confirm(`Delete tag "${tag}"?`);
      if (confirmed) {
          this.localTags[type] = this.localTags[type].filter(t => t !== tag);
          this.queue.push({ type: 'delete', tagType: type, value: tag });
          this.render();
      }
  }

  async handleTagRename(type, tag) {
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
