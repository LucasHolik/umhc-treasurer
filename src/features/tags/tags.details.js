import store from '../../core/state.js';
import { formatCurrency } from '../../core/utils.js';
import TransactionsTable from '../transactions/transactions.table.js';
import * as TransactionsLogic from '../transactions/transactions.logic.js';

export default class TagsDetails {
    constructor(element, callbacks) {
        this.element = element;
        this.callbacks = callbacks || {}; // { onBack, onAddTransactions }
        
        this.tagType = null;
        this.tagName = null;
        this.transactionsData = [];
        this.sortState = { field: 'Date', ascending: false };
    }

    render(tagType, tagName) {
        this.tagType = tagType;
        this.tagName = tagName;
        
        // Filter transactions
        const allExpenses = store.getState('expenses') || [];
        this.transactionsData = allExpenses.filter(item => item[tagType] === tagName);
        
        // Sort
        this.transactionsData = TransactionsLogic.sortData(
            this.transactionsData, 
            this.sortState.field, 
            this.sortState.ascending
        );

        // Calculate stats
        const stats = this.calculateStats(this.transactionsData);
        const netStr = formatCurrency(Math.abs(stats.income - stats.expense));
        const netClass = (stats.income - stats.expense) >= 0 ? 'positive' : 'negative';

        this.element.innerHTML = `
            <div class="section">
                <div class="tags-header-actions" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <button id="back-tags-btn" class="secondary-btn" style="padding: 5px 10px;">← Back</button>
                        <h2 style="margin: 0;">${tagName} <span style="font-size: 0.6em; color: #aaa; font-weight: normal;">(${tagType})</span></h2>
                    </div>
                    <button id="add-transactions-btn" class="secondary-btn" style="background-color: #f0ad4e; color: white;">Add Transactions</button>
                </div>

                <div class="stats-summary" style="display: flex; gap: 30px; margin-bottom: 20px; background: rgba(0,0,0,0.2); padding: 15px; border-radius: 8px;">
                    <div>
                        <div style="font-size: 0.9em; color: #aaa;">Count</div>
                        <div style="font-size: 1.2em;">${stats.count}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.9em; color: #aaa;">Total Income</div>
                        <div style="font-size: 1.2em;" class="positive">${formatCurrency(stats.income)}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.9em; color: #aaa;">Total Expense</div>
                        <div style="font-size: 1.2em;" class="negative">${formatCurrency(stats.expense)}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.9em; color: #aaa;">Net</div>
                        <div style="font-size: 1.2em;" class="${netClass}">${netStr}</div>
                    </div>
                </div>
                
                <div id="tag-transactions-table-container">
                    <table id="transactions-table" class="section-table">
                        <thead>
                            <tr>
                                <th data-sort="Date" class="sortable" style="cursor: pointer;">Date ${this.getSortIcon('Date')}</th>
                                <th data-sort="Description" class="sortable" style="cursor: pointer;">Description ${this.getSortIcon('Description')}</th>
                                <th data-sort="Trip/Event" class="sortable" style="cursor: pointer;">Trip/Event ${this.getSortIcon('Trip/Event')}</th>
                                <th data-sort="Category" class="sortable" style="cursor: pointer;">Category ${this.getSortIcon('Category')}</th>
                                <th data-sort="Income" class="sortable" style="cursor: pointer;">Income ${this.getSortIcon('Income')}</th>
                                <th data-sort="Expense" class="sortable" style="cursor: pointer;">Expense ${this.getSortIcon('Expense')}</th>
                            </tr>
                        </thead>
                        <tbody id="transactions-tbody"></tbody>
                    </table>
                </div>
            </div>
        `;

        this.attachEventListeners();
        
        // Render Table
        const tableContainer = this.element.querySelector('#tag-transactions-table-container');
        this.tableComponent = new TransactionsTable(tableContainer, {
            onSort: (field) => this.handleSort(field)
        });
        this.tableComponent.render(this.transactionsData, false, new Set());
    }

    calculateStats(data) {
        let count = 0;
        let income = 0;
        let expense = 0;

        const parseAmount = (val) => {
            if (!val) return 0;
            if (typeof val === 'number') return val;
            return parseFloat(val.toString().replace(/,/g, '')) || 0;
        };

        data.forEach(item => {
            count++;
            income += parseAmount(item["Income"]);
            expense += parseAmount(item["Expense"]);
        });

        return { count, income, expense };
    }

    getSortIcon(field) {
        if (this.sortState.field !== field) return '';
        return this.sortState.ascending ? '▲' : '▼';
    }

    handleSort(field) {
        if (this.sortState.field === field) {
            this.sortState.ascending = !this.sortState.ascending;
        } else {
            this.sortState.field = field;
            this.sortState.ascending = true;
        }
        this.render(this.tagType, this.tagName);
    }

    attachEventListeners() {
        const backBtn = this.element.querySelector('#back-tags-btn');
        const addBtn = this.element.querySelector('#add-transactions-btn');
        
        if (backBtn) backBtn.addEventListener('click', () => {
            if (this.callbacks.onBack) this.callbacks.onBack();
        });

        if (addBtn) addBtn.addEventListener('click', () => {
            if (this.callbacks.onAddTransactions) this.callbacks.onAddTransactions(this.tagType, this.tagName);
        });
    }
}
