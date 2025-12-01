import { formatCurrency } from '../../core/utils.js';

export default class TransactionsTable {
    constructor(tableElement, callbacks) {
        this.tableElement = tableElement;
        this.tbody = tableElement.querySelector('#transactions-tbody');
        this.selectAllCheckbox = tableElement.querySelector('#select-all-checkbox');
        this.callbacks = callbacks || {}; // { onSort, onSelectAll, onRowSelect }
        
        this.bindEvents();
    }

    bindEvents() {
        // Header Sort
        this.tableElement.querySelectorAll('th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const field = th.dataset.sort;
                if (this.callbacks.onSort) this.callbacks.onSort(field);
            });
        });

        // Select All
        if (this.selectAllCheckbox) {
            this.selectAllCheckbox.addEventListener('change', (e) => {
                if (this.callbacks.onSelectAll) this.callbacks.onSelectAll(e.target.checked);
            });
        }
    }

    render(data, selectionMode, selectedRows) {
        if (!this.tbody) return;
        this.tbody.innerHTML = '';
        
        if (!data || data.length === 0) {
            const row = document.createElement('tr');
            const colSpan = selectionMode ? 7 : 6;
            row.innerHTML = `<td colspan="${colSpan}">No transactions found.</td>`;
            this.tbody.appendChild(row);
            return;
        }

        data.forEach(item => {
            const row = document.createElement('tr');
            const isSelected = selectedRows.has(item.row);
            
            let checkboxCell = '';
            if (selectionMode) {
                checkboxCell = `<td><input type="checkbox" class="row-select" data-row="${item.row}" ${isSelected ? 'checked' : ''}></td>`;
            }

            row.innerHTML = `
                ${checkboxCell}
                <td>${item.Date || ''}</td>
                <td>${item.Description || ''}</td>
                <td>${item['Trip/Event'] || ''}</td>
                <td>${item.Category || ''}</td>
                <td>${formatCurrency(item.Income)}</td>
                <td>${formatCurrency(item.Expense)}</td>
            `;
            
            if (selectionMode) {
                const checkbox = row.querySelector('.row-select');
                checkbox.addEventListener('change', (e) => {
                    if (this.callbacks.onRowSelect) {
                        this.callbacks.onRowSelect(item.row, e.target.checked);
                    }
                });
                
                row.addEventListener('click', (e) => {
                    if (e.target !== checkbox) {
                         checkbox.checked = !checkbox.checked;
                         checkbox.dispatchEvent(new Event('change'));
                    }
                });
                row.style.cursor = 'pointer';
            }

            this.tbody.appendChild(row);
        });
    }
    
    toggleSelectionMode(active) {
        const header = this.tableElement.querySelector('#select-all-header');
        if (header) {
            header.style.display = active ? 'table-cell' : 'none';
        }
        if (!active && this.selectAllCheckbox) {
            this.selectAllCheckbox.checked = false;
        }
    }
}
