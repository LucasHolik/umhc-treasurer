import store from '../../core/state.js';
import ApiService from '../../services/api.service.js';
import ModalComponent from '../../shared/modal.component.js';
import router from '../../core/router.js';
import TagsList from './tags.list.js';
import TagsDetails from './tags.details.js';
import TagsAddTrip from './tags.add-trip.js';

class TagsComponent {
  constructor(element) {
    this.element = element;
    
    // Edit Mode State
    this.queue = [];
    this.localTags = null; 
    this.isEditMode = false;
    
    // View State
    this.viewMode = 'list'; // 'list' | 'details' | 'add-trip'
    this.selectedTag = null; // { type, name }
    this.targetTypeName = null; // For add-trip view

    this.modal = new ModalComponent();
    
    // Bind methods
    this.render = this.render.bind(this);
    
    // Initialize Sub-Components
    this.tagsList = new TagsList(element, {
        onEditModeToggle: (isEdit) => this.handleEditModeToggle(isEdit),
        onSave: () => this.handleSave(),
        onTagClick: (type, name) => this.handleTagClick(type, name),
        onTagAdd: (type, value) => this.handleTagAdd(type, value),
        onTagDelete: (type, value) => this.handleTagDelete(type, value),
        onTagRename: (type, oldValue) => this.handleTagRename(type, oldValue),
        onUpdateTripType: (tripName, typeName) => this.handleUpdateTripType(tripName, typeName)
    });

    this.tagsDetails = new TagsDetails(element, {
        onBack: () => this.handleBack(),
        onAddTransactions: (type, name) => this.handleAddTransactions(type, name),
        onAddTagsToType: (typeName) => this.handleAddTagsToType(typeName)
    });

    this.tagsAddTrip = new TagsAddTrip(element, {
        onBack: () => this.handleAddTripBack(),
        onSave: (selectedTrips, typeName) => this.handleAddTripSave(selectedTrips, typeName)
    });

    this.render();
    
    // Subscribe to relevant state changes
    store.subscribe('tags', () => {
        if (!this.isEditMode && this.viewMode === 'list') this.render();
    });
    store.subscribe('expenses', this.render);
    store.subscribe('savingTags', this.render);
    store.subscribe('isTagging', this.render);
  }

  render() {
    const savingTags = store.getState('savingTags');
    const isTagging = store.getState('isTagging');
    
    if (savingTags || isTagging) {
        this.renderSavingState();
        return;
    }

    if (this.viewMode === 'list') {
        // Calculate Virtual TripTypeMap (Store + Queue)
        let virtualTripTypeMap = { ...(store.getState('tags').TripTypeMap || {}) };
        
        // If in edit mode, start from localTags (which might have structural changes)
        if (this.isEditMode && this.localTags && this.localTags.TripTypeMap) {
             virtualTripTypeMap = { ...this.localTags.TripTypeMap };
        }

        // Apply queue updates
        this.queue.forEach(op => {
            if (op.type === 'updateTripType') {
                if (op.newValue === "") {
                    delete virtualTripTypeMap[op.oldValue];
                } else {
                    virtualTripTypeMap[op.oldValue] = op.newValue;
                }
            }
        });

        this.tagsList.render(this.isEditMode, this.localTags, this.queue, virtualTripTypeMap);
    } else if (this.viewMode === 'details' && this.selectedTag) {
        this.tagsDetails.render(this.selectedTag.type, this.selectedTag.name);
    } else if (this.viewMode === 'add-trip') {
        this.tagsAddTrip.init(this.targetTypeName);
    }
  }
  
  renderSavingState() {
      this.element.innerHTML = `
        <div class="section" style="height: 400px; display: flex; flex-direction: column; justify-content: center; align-items: center;">
            <div class="loader" style="width: 50px; height: 50px; margin-bottom: 20px;"></div>
            <h3 style="color: #f0ad4e; margin-bottom: 10px;">Processing...</h3>
            <p style="color: #fff; font-size: 1.1em;">Syncing changes with the database.</p>
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
  
  handleAddTagsToType(typeName) {
      this.targetTypeName = typeName;
      this.viewMode = 'add-trip';
      this.render();
  }

  handleAddTripBack() {
      this.targetTypeName = null;
      this.viewMode = 'details';
      // Ensure we are still looking at the correct tag details
      if (!this.selectedTag) {
          // Fallback if state got weird, though it shouldn't
          this.viewMode = 'list';
      }
      this.render();
  }

  async handleAddTripSave(selectedTrips, typeName) {
      store.setState('isTagging', true);
      const operations = selectedTrips.map(trip => [trip, typeName, 'updateTripType', 'Trip/Event']);
      try {
         const result = await ApiService.processTagOperations(operations);
         if (result.success) {
              document.dispatchEvent(new CustomEvent('dataUploaded'));
              // Navigate back to details on success
              this.handleAddTripBack();
         } else {
              await this.modal.alert(result.message || "Failed to update tags.");
              store.setState('isTagging', false);
         }
      } catch (err) {
          console.error(err);
          await this.modal.alert("Error: " + err.message);
          store.setState('isTagging', false);
      }
  }

  // --- Edit Mode Handlers ---

  async handleEditModeToggle(isEdit) {
      if (isEdit) {
          if (this.queue.length > 0) {
              const confirmed = await this.modal.confirm('You have unsaved changes to Trip/Event types. Discard them to enter Edit Mode?', 'Unsaved Changes');
              if (!confirmed) return;
          }
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
  
  handleUpdateTripType(tripName, newType) {
      // Update local state if in edit mode
      if (this.isEditMode && this.localTags) {
          this.localTags.TripTypeMap[tripName] = newType;
      }
      
      // Queue operation
      // Remove any previous pending update for this specific trip to avoid redundant ops
      this.queue = this.queue.filter(op => !(op.type === 'updateTripType' && op.oldValue === tripName));

      this.queue.push({ type: 'updateTripType', tagType: 'Trip/Event', oldValue: tripName, newValue: newType });
      
      this.render();
  }

  async handleSave() {
    if (this.queue.length === 0) {
        this.isEditMode = false;
        this.render();
        return;
    }

    store.setState('savingTags', true); // This triggers the loading view in render()
    
    const chunkSize = 10;
    const chunks = [];
    
    const formattedOperations = this.queue.map(op => {
        if (op.type === 'add') return [null, op.value, 'add', op.tagType];
        if (op.type === 'delete') return [op.value, null, 'delete', op.tagType];
        if (op.type === 'rename') return [op.oldValue, op.newValue, 'rename', op.tagType];
        if (op.type === 'updateTripType') return [op.oldValue, op.newValue, 'updateTripType', op.tagType];
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