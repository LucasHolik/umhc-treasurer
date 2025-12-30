// src/features/dashboard/dashboard.component.js
import store from "../../core/state.js";
import SortableTable from "../../shared/sortable-table.component.js";
import {
  formatCurrency,
  filterTransactionsByTimeframe,
  parseAmount,
} from "../../core/utils.js";
import { calculateFinancials } from "../../core/financial.logic.js";
import { el, replace } from "../../core/dom.js";

class DashboardComponent {
  constructor(element) {
    this.element = element;
    this.timeframe = "past_30_days"; // Default timeframe
    this.render();
    store.subscribe("expenses", () => this.calculateAndDisplayStats());
    store.subscribe("openingBalance", () => this.calculateAndDisplayStats());
    store.subscribe("accessibilityMode", () => this.render());
  }

  render() {
    // Timeframe selector options
    const options = [
      { value: "current_month", text: "Current Month" },
      { value: "past_30_days", text: "Past 30 Days" },
      { value: "past_3_months", text: "Past 3 Months" },
      { value: "past_6_months", text: "Past 6 Months" },
      { value: "past_year", text: "Past Year" },
      { value: "all_time", text: "All Time" },
    ];

    // Mark selected option based on current state
    options.forEach((opt) => {
      if (opt.value === this.timeframe) {
        opt.selected = true;
      }
    });

    this.timeframeSelect = el(
      "select",
      { id: "dashboard-timeframe-select", "aria-label": "Timeframe" },
      ...options.map((opt) =>
        el("option", { value: opt.value, selected: opt.selected }, opt.text)
      )
    );

    // Attach listener immediately
    this.timeframeSelect.addEventListener("change", (e) => {
      this.timeframe = e.target.value;
      this.calculateAndDisplayStats();
      this.updateTitle();
    });

    this.currentBalanceEl = el(
      "p",
      { id: "current-balance", className: "stat-value" },
      "£0.00"
    );
    this.totalIncomeEl = el(
      "p",
      { id: "total-income", className: "stat-value" },
      "£0.00"
    );
    this.totalExpensesEl = el(
      "p",
      { id: "total-expenses", className: "stat-value" },
      "£0.00"
    );
    this.netChangeEl = el(
      "p",
      { id: "net-change", className: "stat-value" },
      "£0.00"
    );

    this.transactionCountSubtitleEl = el("div", {
      className: "transaction-count-subtitle",
    });
    this.recentTransactionsContentEl = el("div", {
      id: "recent-transactions-content",
    });

    this.loadedContent = el(
      "div",
      { id: "dashboard-loaded-content" },
      el(
        "div",
        { className: "stats-container" },
        el(
          "div",
          { className: "stat-card" },
          el("h3", {}, "Current Balance"),
          this.currentBalanceEl
        ),
        el(
          "div",
          { className: "stat-card" },
          el("h3", {}, "Total Income"),
          this.totalIncomeEl
        ),
        el(
          "div",
          { className: "stat-card" },
          el("h3", {}, "Total Expenses"),
          this.totalExpensesEl
        ),
        el(
          "div",
          { className: "stat-card" },
          el("h3", {}, "Net Change"),
          this.netChangeEl
        )
      ),
      el(
        "div",
        { className: "section" },
        el(
          "div",
          { className: "transactions-header" },
          el("h2", {}, "Recent Transactions"),
          this.transactionCountSubtitleEl
        ),
        this.recentTransactionsContentEl
      )
    );

    const container = el(
      "div",
      { id: "dashboard-content-wrapper" },
      el(
        "div",
        {
          className: "dashboard-header",
          style: {
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            marginBottom: "15px",
            gap: "15px",
          },
        },
        el(
          "button",
          {
            className: `secondary-btn accessibility-toggle ${
              store.getState("accessibilityMode") ? "active" : ""
            }`,
            title: "Toggle Accessibility Mode (Symbols for +/-)",
            onclick: () => {
              const current = store.getState("accessibilityMode");
              store.setState("accessibilityMode", !current);
            },
          },
          `👁️ Colourblind Access: ${
            store.getState("accessibilityMode") ? "On" : "Off"
          }`
        ),
        el(
          "div",
          { className: "timeframe-selector" },
          el("label", { for: "dashboard-timeframe-select" }, "Timeframe: "),
          this.timeframeSelect
        )
      ),
      this.loadedContent
    );

    replace(this.element, container);

    // Initialize SortableTable
    this.transactionsTable = new SortableTable(
      this.recentTransactionsContentEl,
      {
        columns: [
          { key: "Date", label: "Date", type: "date" },
          { key: "Description", label: "Description", type: "text" },
          {
            key: "Amount",
            label: "Amount (£)",
            type: "custom",
            sortValue: (item) => {
              const income = parseAmount(item.Income);
              const expense = parseAmount(item.Expense);
              return income - expense;
            },
            render: (item) => {
              const net = parseAmount(item.Income) - parseAmount(item.Expense);

              const classType =
                net > 0 ? "positive" : net < 0 ? "negative" : "";
              const span = document.createElement("span");
              if (classType) span.className = classType;
              span.textContent = formatCurrency(Math.abs(net));
              return span;
            },
          },
        ],
        initialSortField: "Date",
        initialSortAsc: false,
      }
    );

    // Re-calculate stats to populate the new elements
    this.calculateAndDisplayStats();
  }

  updateTitle() {
    const titleEl = document.getElementById("page-title");
    if (titleEl) {
      titleEl.textContent = `Dashboard - ${this.getTimeframeLabel(
        this.timeframe
      )}`;
    }
  }

  calculateAndDisplayStats() {
    const data = store.getState("expenses") || [];
    const openingBalance = store.getState("openingBalance") || 0;
    const filteredData = filterTransactionsByTimeframe(data, this.timeframe);

    const { currentBalance } = calculateFinancials(openingBalance, data);

    let totalIncome = 0;
    let totalExpenses = 0;

    filteredData.forEach((item) => {
      totalIncome += parseAmount(item.Income);
      totalExpenses += parseAmount(item.Expense);
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
      const timeframeLabel = this.getTimeframeLabel(
        this.timeframe
      ).toLowerCase();
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
