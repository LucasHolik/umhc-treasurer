import store from '../../core/state.js';
import { formatCurrency } from '../../core/utils.js';
import SortableTable from '../../shared/sortable-table.component.js';

export default class TagsDetails {
    constructor(element, callbacks) {
        this.element = element;
        this.callbacks = callbacks || {}; // { onBack, onAddTransactions }
        
        this.tagType = null;
        this.tagName = null;
        this.transactionsData = [];
    }

    render(tagType, tagName) {
        this.tagType = tagType;
        this.tagName = tagName;
        
        // Filter transactions
        const allExpenses = store.getState('expenses') || [];
        this.transactionsData = allExpenses.filter(item => item[tagType] === tagName);
        
        // Calculate stats
        const stats = this.calculateStats(this.transactionsData);
        const netStr = formatCurrency(Math.abs(stats.income - stats.expense));
        const netClass = (stats.income - stats.expense) > 0 ? 'positive' : ((stats.income - stats.expense) < 0 ? 'negative' : '');

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
                
                <div id="tag-transactions-table-container"></div>
            </div>
        `;

        this.attachEventListeners();
        
        // Render Table
        const tableContainer = this.element.querySelector('#tag-transactions-table-container');
        const table = new SortableTable(tableContainer, {
            columns: [
                { key: 'Date', label: 'Date', type: 'date' },
                { key: 'Description', label: 'Description', type: 'text' },
                { key: 'Trip/Event', label: 'Trip/Event', type: 'text' },
                { key: 'Category', label: 'Category', type: 'text' },
                { 
                    key: 'Amount', 
                    label: 'Amount', 
                    type: 'custom',
                    sortValue: (item) => {
                        const income = item.Income ? parseFloat(String(item.Income).replace(/,/g, '')) : 0;
                        const expense = item.Expense ? parseFloat(String(item.Expense).replace(/,/g, '')) : 0;
                        const safeIncome = isNaN(income) ? 0 : income;
                        const safeExpense = isNaN(expense) ? 0 : expense;
                        return safeIncome - safeExpense;
                    },
                    render: (item) => {
                        const income = item.Income ? parseFloat(String(item.Income).replace(/,/g, '')) : 0;
                        const expense = item.Expense ? parseFloat(String(item.Expense).replace(/,/g, '')) : 0;
                        
                        const safeIncome = isNaN(income) ? 0 : income;
                        const safeExpense = isNaN(expense) ? 0 : expense;
                        
                        const net = safeIncome - safeExpense;
                        
                        const classType = net > 0 ? 'positive' : (net < 0 ? 'negative' : '');
                        return `<span class="${classType}">${formatCurrency(Math.abs(net))}</span>`;
                    }
                }
            ],
            initialSortField: 'Date',
            initialSortAsc: false
        });
        table.update(this.transactionsData);
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
