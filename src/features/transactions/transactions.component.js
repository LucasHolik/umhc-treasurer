// src/features/transactions/transactions.component.js
import store from '../../core/state.js';
import ApiService from '../../services/api.service.js';

class TransactionsComponent {
  constructor(element) {
    this.element = element;
    this.transactionData = [];
    this.originalTransactionData = [];
    this.changes = {};
    this.sortState = { field: 'Date', ascending: false };
    this.currentView = 'transactions'; // 'transactions', 'tagging', 'bulk'
    this.render();
    store.subscribe('expenses', (data) => this.handleDataChange(data));
    store.subscribe('tags', () => this.updateFilterDropdowns());
  }

  render() {
    this.element.innerHTML = `
        <div id="transactions-display"></div>
        <div id="tag-transactions-view" style="display: none;"></div>
        <div id="bulk-add-tags-view" style="display: none;"></div>
    `;
    this.transactionsDisplay = this.element.querySelector('#transactions-display');
    this.tagTransactionsView = this.element.querySelector('#tag-transactions-view');
    this.bulkAddTagsView = this.element.querySelector('#bulk-add-tags-view');
    this.renderCurrentView();
  }

  renderCurrentView() {
      if (this.currentView === 'transactions') {
          this.renderTransactionsDisplay();
      } else if (this.currentView === 'tagging') {
          this.renderTagTransactionsView();
      }
  }

  renderTransactionsDisplay() {
    this.transactionsDisplay.innerHTML = `
        <div class="filters">
            <select id="filter-trip-event"></select>
            <select id="filter-category"></select>
        </div>
        <div class="transaction-actions">
            <button id="tag-transactions-btn">Tag Transactions</button>
        </div>
        <table id="transactions-table" class="data-table">
            <thead>
                <tr>
                    <th data-sort="Date" class="sortable">Date <span class="sort-indicator"></span></th>
                    <th data-sort="Description" class="sortable">Description <span class="sort-indicator"></span></th>
                    <th data-sort="Trip/Event" class="sortable">Trip/Event <span class="sort-indicator"></span></th>
                    <th data-sort="Category" class="sortable">Category <span class="sort-indicator"></span></th>
                    <th data-sort="Income" class="sortable">Income <span class="sort-indicator"></span></th>
                    <th data-sort="Expense" class="sortable">Expense <span class="sort-indicator"></span></th>
                </tr>
            </thead>
            <tbody id="transactions-tbody"></tbody>
        </table>
    `;
    this.tbody = this.element.querySelector('#transactions-tbody');
    this.filterTripEvent = this.element.querySelector('#filter-trip-event');
    this.filterCategory = this.element.querySelector('#filter-category');
    this.tagTransactionsBtn = this.element.querySelector('#tag-transactions-btn');

    this.tagTransactionsBtn.addEventListener('click', () => {
        this.currentView = 'tagging';
        this.renderCurrentView();
    });

    this.element.querySelectorAll('#transactions-table th.sortable').forEach(th => {
        th.addEventListener('click', () => this.sortTransactions(th.dataset.sort));
    });
    this.filterTripEvent.addEventListener('change', () => this.filterTransactions());
    this.filterCategory.addEventListener('change', () => this.filterTransactions());

    this.displayTransactions(this.transactionData);
    this.updateFilterDropdowns();
  }

  renderTagTransactionsView() {
    this.tagTransactionsView.innerHTML = `
        <div class="transaction-actions">
            <button id="save-tag-changes-btn">Save Changes</button>
            <button id="cancel-tag-changes-btn">Cancel</button>
        </div>
        <table id="tagging-table" class="data-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Trip/Event</th>
                    <th>Category</th>
                    <th>Income</th>
                    <th>Expense</th>
                </tr>
            </thead>
            <tbody id="tagging-tbody"></tbody>
        </table>
    `;

    const tbody = this.tagTransactionsView.querySelector('#tagging-tbody');
    const tags = store.getState('tags');

    this.transactionData.forEach(item => {
        const row = document.createElement('tr');
        row.dataset.rowId = item.row;
        const createSelect = (type, selectedValue) => {
            const select = document.createElement('select');
            select.dataset.type = type;
            select.dataset.rowId = item.row;
            const tagOptions = tags[type] || [];
            select.innerHTML = '<option value="">None</option>';
            tagOptions.forEach(tag => {
                const opt = document.createElement('option');
                opt.value = tag;
                opt.textContent = tag;
                if (tag === selectedValue) opt.selected = true;
                select.appendChild(opt);
            });
            return select.outerHTML;
        }

        row.innerHTML = `
            <td>${item.Date || ''}</td>
            <td>${item.Description || ''}</td>
            <td>${createSelect('Trip/Event', item['Trip/Event'])}</td>
            <td>${createSelect('Category', item.Category)}</td>
            <td>${item.Income || ''}</td>
            <td>${item.Expense || ''}</td>
        `;
        tbody.appendChild(row);
    });

    this.tagTransactionsView.querySelector('#save-tag-changes-btn').addEventListener('click', () => this.saveTagChanges());
    this.tagTransactionsView.querySelector('#cancel-tag-changes-btn').addEventListener('click', () => {
        this.currentView = 'transactions';
        this.renderCurrentView();
    });
    tbody.addEventListener('change', (e) => {
        if (e.target.tagName === 'SELECT') {
            const rowId = e.target.dataset.rowId;
            const type = e.target.dataset.type;
            const value = e.target.value;
            if (!this.changes[rowId]) {
                this.changes[rowId] = { ...this.originalTransactionData.find(t => t.row == rowId) };
            }
            this.changes[rowId][type] = value;
        }
    })
  }

  async saveTagChanges() {
      const changesToSave = Object.values(this.changes);
      if (changesToSave.length > 0) {
          await ApiService.updateExpenses(changesToSave);
          this.changes = {};
          document.dispatchEvent(new CustomEvent('dataUploaded'));
      }
      this.currentView = 'transactions';
      this.renderCurrentView();
  }

  handleDataChange(data) {
    this.transactionData = [...data];
    this.originalTransactionData = [...data];
    this.renderCurrentView();
  }
  
  displayTransactions(data) {
    if (!this.tbody) return;
    this.tbody.innerHTML = '';
    if (!data || data.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="6">No transactions found.</td>';
        this.tbody.appendChild(row);
        return;
    }

    data.forEach(item => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${item.Date || ''}</td>
        <td>${item.Description || ''}</td>
        <td>${item['Trip/Event'] || ''}</td>
        <td>${item.Category || ''}</td>
        <td>${item.Income || ''}</td>
        <td>${item.Expense || ''}</td>
      `;
      this.tbody.appendChild(row);
    });
  }

  // ... other methods from previous turn (updateFilterDropdowns, filterTransactions, sortTransactions)
  updateFilterDropdowns() {
    const tags = store.getState('tags');
    if (!tags || !this.filterTripEvent) return;

    const createOptions = (select, options) => {
        const currentValue = select.value;
        select.innerHTML = '<option value="">All</option>';
        (options || []).forEach(option => {
            const opt = document.createElement('option');
            opt.value = option;
            opt.textContent = option;
            select.appendChild(opt);
        });
        select.value = currentValue;
    }
    
    createOptions(this.filterTripEvent, tags['Trip/Event']);
    createOptions(this.filterCategory, tags['Category']);
  }

  filterTransactions() {
    const tripEventFilter = this.filterTripEvent.value;
    const categoryFilter = this.filterCategory.value;

    this.transactionData = this.originalTransactionData.filter(item => {
        const tripEventMatch = !tripEventFilter || item['Trip/Event'] === tripEventFilter;
        const categoryMatch = !categoryFilter || item['Category'] === categoryFilter;
        return tripEventMatch && categoryMatch;
    });
    this.displayTransactions(this.transactionData);
  }

  sortTransactions(field) {
    if (this.sortState.field === field) {
        this.sortState.ascending = !this.sortState.ascending;
    } else {
        this.sortState.field = field;
        this.sortState.ascending = true;
    }

    this.transactionData.sort((a, b) => {
        let valA = a[field] || '';
        let valB = b[field] || '';

        if (field === 'Date') {
            valA = new Date(valA);
            valB = new Date(valB);
        }

        if (valA < valB) return this.sortState.ascending ? -1 : 1;
        if (valA > valB) return this.sortState.ascending ? 1 : -1;
        return 0;
    });

    this.displayTransactions(this.transactionData);
  }
}

export default TransactionsComponent;