// src/features/dashboard/dashboard.component.js
import store from '../../core/state.js';
import LoaderComponent from '../../shared/loader.component.js';

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
            <label for="timeframe-select">Timeframe: </label>
            <select id="timeframe-select">
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
    this.timeframeSelect = this.element.querySelector('#timeframe-select');
    this.currentBalanceEl = this.element.querySelector('#current-balance');
    this.totalIncomeEl = this.element.querySelector('#total-income');
    this.totalExpensesEl = this.element.querySelector('#total-expenses');
    this.netChangeEl = this.element.querySelector('#net-change');
    this.recentTransactionsContentEl = this.element.querySelector('#recent-transactions-content');
    this.transactionCountSubtitleEl = this.element.querySelector('.transaction-count-subtitle');
    
    this.loadingPlaceholder = this.element.querySelector('#dashboard-loading-placeholder');
    this.loadedContent = this.element.querySelector('#dashboard-loaded-content');
    this.loadingPlaceholder.innerHTML = new LoaderComponent().render();
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
    const filteredData = this.filterTransactionsByTimeframe(data, this.timeframe);

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

    let allTimeTotalIncome = 0;
    let allTimeTotalExpenses = 0;

    data.forEach((item) => {
      if (item.Income && !isNaN(parseFloat(item.Income))) {
        allTimeTotalIncome += parseFloat(item.Income);
      }
      if (item.Expense && !isNaN(parseFloat(item.Expense))) {
        allTimeTotalExpenses += parseFloat(item.Expense);
      }
    });

    const currentBalance = openingBalance + allTimeTotalIncome - allTimeTotalExpenses;
    const netChange = totalIncome - totalExpenses;

    this.currentBalanceEl.textContent = `£${currentBalance.toFixed(2)}`;
    this.totalIncomeEl.textContent = `£${totalIncome.toFixed(2)}`;
    this.totalExpensesEl.textContent = `£${totalExpenses.toFixed(2)}`;
    this.netChangeEl.textContent = `£${netChange.toFixed(2)}`;

    this.displayRecentTransactions(filteredData);
  }

  displayRecentTransactions(transactions) {
    const sortedTransactions = transactions.sort((a, b) => {
        const dateA = this.parseDate(a.Date);
        const dateB = this.parseDate(b.Date);
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateB - dateA;
    });

    this.updateTransactionCountHeader(transactions.length);

    if (this.recentTransactionsContentEl) {
        this.recentTransactionsContentEl.innerHTML = "";

        if (sortedTransactions.length > 0) {
            const table = document.createElement("table");
            table.innerHTML = `
                <thead>
                <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Amount (£)</th>
                </tr>
                </thead>
                <tbody>
                ${sortedTransactions
                    .map((item) => {
                    const amount = item.Income
                        ? `+${item.Income}`
                        : `-${item.Expense}`;
                    return `
                    <tr>
                        <td>${item.Date || "N/A"}</td>
                        <td>${item.Description || "N/A"}</td>
                        <td>${amount || "N/A"}</td>
                    </tr>
                    `;
                    })
                    .join("")}
                </tbody>
            `;
            this.recentTransactionsContentEl.appendChild(table);
        } else {
            this.recentTransactionsContentEl.textContent = "No transactions found in selected timeframe";
        }
    }
  }
  
  updateTransactionCountHeader(count) {
      if (this.transactionCountSubtitleEl) {
          const timeframeLabel = this.getTimeframeLabel(this.timeframe).toLowerCase();
          const transactionWord = count === 1 ? "transaction" : "transactions";
          this.transactionCountSubtitleEl.textContent = `${count} ${transactionWord} in the ${timeframeLabel}`;
      }
  }

  filterTransactionsByTimeframe(transactions, timeframe) {
    if (!transactions || transactions.length === 0) return [];
    if (timeframe === "all_time") return transactions;

    let { start, end } = { start: null, end: new Date() };

    switch (timeframe) {
      case "current_month":
        ({ start, end } = this.getCurrentMonthRange());
        break;
      case "past_30_days":
        ({ start, end } = this.getPastDaysRange(30));
        break;
      case "past_3_months":
        ({ start, end } = this.getPastMonthsRange(3));
        break;
      case "past_6_months":
        ({ start, end } = this.getPastMonthsRange(6));
        break;
      case "past_year":
        ({ start, end } = this.getPastYearRange());
        break;
      default:
        ({ start, end } = this.getPastDaysRange(30));
    }

    return transactions.filter((transaction) => {
      const date = this.parseDate(transaction.Date);
      if (!date) return false;
      return date >= start && date <= end;
    });
  }

  parseDate(dateString) {
    if (!dateString) return null;
    let date = new Date(dateString);
    if (isNaN(date.getTime())) {
      const formattedDate = dateString.replace(/[-./]/g, "/");
      date = new Date(formattedDate);
    }
    if (isNaN(date.getTime())) return null;
    return date;
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

  getCurrentMonthRange = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start, end };
  }
  
  getPastDaysRange = (days) => {
    const now = new Date();
    const start = new Date();
    start.setDate(now.getDate() - days);
    return { start, end: now };
  }
  
  getPastMonthsRange = (months) => {
    const now = new Date();
    const start = new Date();
    start.setMonth(now.getMonth() - months);
    return { start, end: now };
  }
  
  getPastYearRange = () => {
    const now = new Date();
    const start = new Date();
    start.setFullYear(now.getFullYear() - 1);
    return { start, end: now };
  }
}

export default DashboardComponent;
