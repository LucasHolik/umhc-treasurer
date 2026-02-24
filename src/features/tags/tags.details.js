import store from "../../core/state.js";
import { formatCurrency } from "../../core/utils.js";
import SortableTable from "../../shared/sortable-table.component.js";
import { calculateDetailStats } from "./tags.logic.js";
import { el, replace } from "../../core/dom.js";

export default class TagsDetails {
  constructor(element, callbacks) {
    this.element = element;
    this.callbacks = callbacks || {}; // { onBack, onAddTransactions, onAddTagsToType }

    this.tagType = null;
    this.tagName = null;
    this.transactionsData = [];
  }

  render(tagType, tagName, canEdit = true) {
    this.tagType = tagType;
    this.tagName = tagName;

    const allExpenses = store.getState("expenses") || [];

    // Filter transactions based on tag type
    if (tagType === "Type") {
      // For "Type" tags, we need to find all expenses that have a Trip/Event which is of this Type.
      const tripTypeMap = store.getState("tags")?.TripTypeMap || {};
      this.transactionsData = allExpenses.filter((item) => {
        const trip = item["Trip/Event"];
        return trip && tripTypeMap[trip] === tagName;
      });
    } else {
      this.transactionsData = allExpenses.filter(
        (item) => item[tagType] === tagName,
      );
    }

    // Calculate stats
    const stats = calculateDetailStats(this.transactionsData);
    const netStr = formatCurrency(Math.abs(stats.income - stats.expense));
    const netClass =
      stats.income - stats.expense > 0
        ? "positive"
        : stats.income - stats.expense < 0
          ? "negative"
          : "";

    // Contextual Action Button
    let actionButton = null;
    if (canEdit && tagType === "Type") {
      // Use save-changes-btn for orange background
      actionButton = el(
        "button",
        {
          id: "add-tags-to-type-btn",
          className: "action-btn",
          onclick: () => {
            if (this.callbacks.onAddTagsToType)
              this.callbacks.onAddTagsToType(this.tagName);
          },
        },
        "Add Trip/Events",
      );
    } else if (canEdit) {
      actionButton = el(
        "button",
        {
          id: "add-transactions-btn",
          className: "action-btn",
          onclick: () => {
            if (this.callbacks.onAddTransactions)
              this.callbacks.onAddTransactions(this.tagType, this.tagName);
          },
        },
        "Add Transactions",
      );
    }

    const header = el(
      "div",
      {
        className: "tags-header-actions",
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        },
      },
      el(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "15px" } },
        el(
          "button",
          {
            id: "back-tags-btn",
            className: "secondary-btn",
            style: { padding: "5px 10px" },
            onclick: () => {
              if (this.callbacks.onBack) this.callbacks.onBack();
            },
          },
          "← Back",
        ),
        el(
          "h2",
          { style: { margin: "0" } },
          tagName,
          el(
            "span",
            {
              style: { fontSize: "0.6em", color: "#aaa", fontWeight: "normal" },
            },
            ` (${tagType})`,
          ),
        ),
      ),
      actionButton,
    );

    const summary = el(
      "div",
      {
        className: "stats-summary",
        style: {
          display: "flex",
          gap: "30px",
          marginBottom: "20px",
          background: "rgba(0,0,0,0.2)",
          padding: "15px",
          borderRadius: "8px",
        },
      },
      el(
        "div",
        {},
        el("div", { style: { fontSize: "0.9em", color: "#aaa" } }, "Count"),
        el("div", { style: { fontSize: "1.2em" } }, stats.count),
      ),
      el(
        "div",
        {},
        el(
          "div",
          { style: { fontSize: "0.9em", color: "#aaa" } },
          "Total Income",
        ),
        el(
          "div",
          { style: { fontSize: "1.2em" }, className: "positive" },
          formatCurrency(stats.income),
        ),
      ),
      el(
        "div",
        {},
        el(
          "div",
          { style: { fontSize: "0.9em", color: "#aaa" } },
          "Total Expense",
        ),
        el(
          "div",
          { style: { fontSize: "1.2em" }, className: "negative" },
          formatCurrency(stats.expense),
        ),
      ),
      el(
        "div",
        {},
        el("div", { style: { fontSize: "0.9em", color: "#aaa" } }, "Net"),
        el(
          "div",
          { style: { fontSize: "1.2em" }, className: netClass },
          netStr,
        ),
      ),
    );

    const tableContainer = el("div", {
      id: "tag-transactions-table-container",
    });

    const section = el(
      "div",
      { className: "section" },
      header,
      summary,
      tableContainer,
    );

    replace(this.element, section);

    // Render Table
    const table = new SortableTable(tableContainer, {
      columns: [
        { key: "Date", label: "Date", type: "date" },
        { key: "Description", label: "Description", type: "text" },
        { key: "Trip/Event", label: "Trip/Event", type: "text" },
        { key: "Category", label: "Category", type: "text" },
        {
          key: "Amount",
          label: "Amount",
          type: "custom",
          sortValue: (item) => {
            const income = item.Income
              ? parseFloat(String(item.Income).replace(/,/g, ""))
              : 0;
            const expense = item.Expense
              ? parseFloat(String(item.Expense).replace(/,/g, ""))
              : 0;
            const safeIncome = isNaN(income) ? 0 : income;
            const safeExpense = isNaN(expense) ? 0 : expense;
            return safeIncome - safeExpense;
          },
          render: (item) => {
            const income = item.Income
              ? parseFloat(String(item.Income).replace(/,/g, ""))
              : 0;
            const expense = item.Expense
              ? parseFloat(String(item.Expense).replace(/,/g, ""))
              : 0;

            const safeIncome = isNaN(income) ? 0 : income;
            const safeExpense = isNaN(expense) ? 0 : expense;

            const net = safeIncome - safeExpense;

            const classType = net > 0 ? "positive" : net < 0 ? "negative" : "";
            const span = el("span", {}, formatCurrency(Math.abs(net)));
            if (classType) span.className = classType;
            return span;
          },
        },
      ],
      initialSortField: "Date",
      initialSortAsc: false,
    });
    table.update(this.transactionsData);
  }
}
