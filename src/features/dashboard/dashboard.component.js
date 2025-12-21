// src/features/dashboard/dashboard.component.js
import store from '../../core/state.js';
import LoaderComponent from '../../shared/loader.component.js';
import SortableTable from '../../shared/sortable-table.component.js';
import { formatCurrency, filterTransactionsByTimeframe } from '../../core/utils.js';
import { calculateFinancials } from '../../core/financial.logic.js';

class DashboardComponent {
  constructor(element) {
    this.element = element;
    this.timeframe = 'past_30_days'; // Default timeframe
    this.render();
    this.attachEventListeners();
    store.subscribe('expenses', () => this.calculateAndDisplayStats());
    store.subscribe('openingBalance', () => this.calculateAndDisplayStats());
    store.subscribe('isLoading', (isLoading) => this.handleLoading(isLoading));
    this.handleLoading(store.getState('isLoading'));
  }

  render() {
    this.element.innerHTML = `
      <div id="dashboard-content-wrapper">
        <div class="dashboard-header" style="display: flex; justify-content: flex-end; margin-bottom: 15px;">
          <div class="timeframe-selector">
            <label for="dashboard-timeframe-select">Timeframe: </label>
            <select id="dashboard-timeframe-select" aria-label="Timeframe">
              <option value="current_month">Current Month</option>
              <option value="past_30_days" selected>Past 30 Days</option>
              <option value="past_3_months">Past 3 Months</option>
              <option value="past_6_months">Past 6 Months</option>
              <option value="past_year">Past Year</option>
              <option value="all_time">All Time</option>
            </select>
          </div>
        </div>
        <div id="dashboard-loading-placeholder" style="display: none;"></div>
        <div id="dashboard-loaded-content">
            <div class="stats-container">
              <div class="stat-card">
                <h3>Current Balance</h3>
                <p id="current-balance" class="stat-value">£0.00</p>
              </div>
              <div class="stat-card">
                <h3>Total Income</h3>
                <p id="total-income" class="stat-value">£0.00</p>
              </div>
              <div class="stat-card">
                <h3>Total Expenses</h3>
                <p id="total-expenses" class="stat-value">£0.00</p>
              </div>
              <div class="stat-card">
                <h3>Net Change</h3>
                <p id="net-change" class="stat-value">£0.00</p>
              </div>
            </div>
            <div class="section">
              <div class="transactions-header">
                <h2>Recent Transactions</h2>
                <div class="transaction-count-subtitle"></div>
              </div>
              <div id="recent-transactions-content"></div>
            </div>
        </div>
      </div>
    `;
    this.timeframeSelect = this.element.querySelector('#dashboard-timeframe-select');
    this.currentBalanceEl = this.element.querySelector('#current-balance');
    this.totalIncomeEl = this.element.querySelector('#total-income');
    this.totalExpensesEl = this.element.querySelector('#total-expenses');
    this.netChangeEl = this.element.querySelector('#net-change');
    this.recentTransactionsContentEl = this.element.querySelector('#recent-transactions-content');
    this.transactionCountSubtitleEl = this.element.querySelector('.transaction-count-subtitle');
    
    this.loadingPlaceholder = this.element.querySelector('#dashboard-loading-placeholder');
    this.loadedContent = this.element.querySelector('#dashboard-loaded-content');
    this.loadingPlaceholder.replaceChildren(new LoaderComponent().render());

    // Initialize SortableTable
    this.transactionsTable = new SortableTable(this.recentTransactionsContentEl, {
        columns: [
            { key: 'Date', label: 'Date', type: 'date' },
            { key: 'Description', label: 'Description', type: 'text' },
            { 
                key: 'Amount', 
                label: 'Amount (£)', 
                type: 'custom',
                sortValue: (item) => {
                    const income = item.Income ? parseFloat(String(item.Income).replace(/,/g, '')) : 0;
                    const expense = item.Expense ? parseFloat(String(item.Expense).replace(/,/g, '')) : 0;
                    const safeIncome = isNaN(income) ? 0 : income;
                    const safeExpense = isNaN(expense) ? 0 : expense;
                    return safeIncome - safeExpense;
                },
                render: (item) => {
                    // Parse values safely, treating null/undefined/empty string as 0
                    const income = item.Income ? parseFloat(String(item.Income).replace(/,/g, '')) : 0;
                    const expense = item.Expense ? parseFloat(String(item.Expense).replace(/,/g, '')) : 0;
                    
                    // Use 0 if parsing fails (NaN)
                    const safeIncome = isNaN(income) ? 0 : income;
                    const safeExpense = isNaN(expense) ? 0 : expense;
                    
                    const net = safeIncome - safeExpense;
                    
                    const classType = net > 0 ? 'positive' : (net < 0 ? 'negative' : '');
                    const span = document.createElement('span');
                    if (classType) span.className = classType;
                    span.textContent = formatCurrency(Math.abs(net));
                    return span;
                }
            }
        ],
        initialSortField: 'Date',
        initialSortAsc: false
    });
  }

  handleLoading(isLoading) {
    if (this.loadingPlaceholder && this.loadedContent) {
        if (isLoading) {
            this.loadingPlaceholder.style.display = 'block';
            this.loadedContent.style.display = 'none';
        } else {
            this.loadingPlaceholder.style.display = 'none';
            this.loadedContent.style.display = 'block';
        }
    }
  }

  attachEventListeners() {
    this.timeframeSelect.addEventListener('change', (e) => {
      this.timeframe = e.target.value;
      this.calculateAndDisplayStats();
      this.updateTitle();
    });
  }

  updateTitle() {
    const titleEl = document.getElementById('page-title');
    if (titleEl) {
      titleEl.textContent = `Dashboard - ${this.getTimeframeLabel(this.timeframe)}`;
    }
  }

  calculateAndDisplayStats() {
    const data = store.getState('expenses') || [];
    const openingBalance = store.getState('openingBalance') || 0;
    const filteredData = filterTransactionsByTimeframe(data, this.timeframe);

    const { currentBalance } = calculateFinancials(openingBalance, data);

    let totalIncome = 0;
    let totalExpenses = 0;

    filteredData.forEach((item) => {
      if (item.Income && !isNaN(parseFloat(item.Income))) {
        totalIncome += parseFloat(item.Income);
      }
      if (item.Expense && !isNaN(parseFloat(item.Expense))) {
        totalExpenses += parseFloat(item.Expense);
      }
    });

    const netChange = totalIncome - totalExpenses;

    this.currentBalanceEl.textContent = `£${formatCurrency(currentBalance)}`;
    this.totalIncomeEl.textContent = `£${formatCurrency(totalIncome)}`;
    this.totalExpensesEl.textContent = `£${formatCurrency(totalExpenses)}`;
    this.netChangeEl.textContent = `£${formatCurrency(netChange)}`;

    this.displayRecentTransactions(filteredData);
  }

  displayRecentTransactions(transactions) {
    this.updateTransactionCountHeader(transactions.length);
    this.transactionsTable.update(transactions);
  }
  
  updateTransactionCountHeader(count) {
      if (this.transactionCountSubtitleEl) {
          const timeframeLabel = this.getTimeframeLabel(this.timeframe).toLowerCase();
          const transactionWord = count === 1 ? "transaction" : "transactions";
          this.transactionCountSubtitleEl.textContent = `${count} ${transactionWord} in the ${timeframeLabel}`;
      }
  }

  getTimeframeLabel(timeframe) {
    const labels = {
      current_month: "Current Month",
      past_30_days: "Past 30 Days",
      past_3_months: "Past 3 Months",
      past_6_months: "Past 6 Months",
      past_year: "Past Year",
      all_time: "All Time",
    };
    return labels[timeframe] || "Past 30 Days";
  }
}

export default DashboardComponent;
