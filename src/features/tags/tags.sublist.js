import { formatCurrency } from "../../core/utils.js";
import SortableTable from "../../shared/sortable-table.component.js";
import { el, replace } from "../../core/dom.js";

export default class TagsSubList {
  constructor(element, callbacks) {
    this.element = element;
    this.callbacks = callbacks || {};
    // callbacks: { onBack, onTagClick }
  }

  render(typeName, stats, tripTypeMap, tripStatusMap) {
    // Validate parameters
    if (!typeName || !stats || !tripTypeMap || !tripStatusMap) {
      console.warn("TagsSubList: Missing required parameters");
      const errorEl = el("div", {}, "Unable to load data");
      replace(this.element, errorEl);
      return;
    }

    // Filter trips that belong to this type
    const tripStats = stats["Trip/Event"] || {};
    const relevantTrips = Object.keys(tripStats).filter(
      (trip) => tripTypeMap[trip] === typeName,
    );

    const data = relevantTrips
      .map((trip) => {
        const s = tripStats[trip];
        if (!s) return null;
        const income = s.income || 0;
        const expense = s.expense || 0;
        const net = income - expense;
        return {
          tag: trip,
          status: tripStatusMap[trip] || "Active",
          income: income,
          expense: expense,
          net: net,
          count: s.count || 0,
        };
      })
      .filter(Boolean);

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
            id: "back-sublist-btn",
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
          typeName,
          el(
            "span",
            {
              style: { fontSize: "0.6em", color: "#aaa", fontWeight: "normal" },
            },
            " (Trip Type)",
          ),
        ),
      ),
    );

    const container = el("div", { id: "sublist-table-container" });

    const section = el("div", { className: "section" }, header, container);

    replace(this.element, section);

    const columns = [
      { key: "tag", label: "Trip/Event Name", type: "text" },
      {
        key: "status",
        label: "Status",
        type: "custom",
        class: "text-center",
        render: (item) => {
          const styles = {
            Active: { icon: "◯", color: "#888", title: "Active" },
            Completed: { icon: "✅", color: "#5cb85c", title: "Completed" },
            Investment: { icon: "🚀", color: "#5bc0de", title: "Investment" },
          };
          const s = styles[item.status] || styles["Active"];

          const span = el(
            "span",
            {
              title: s.title,
              style: { color: s.color, fontWeight: "bold", fontSize: "1.2em" },
            },
            s.icon,
          );
          return span;
        },
      },
      {
        key: "income",
        label: "Income",
        type: "currency",
        class: "positive text-right",
      },
      {
        key: "expense",
        label: "Expense",
        type: "currency",
        class: "negative text-right",
      },
      {
        key: "net",
        label: "Net",
        type: "currency",
        class: "text-right",
        render: (item) => {
          const span = el("span", {}, formatCurrency(Math.abs(item.net)));
          if (item.net > 0) span.className = "positive";
          else if (item.net < 0) span.className = "negative";
          else span.className = "neutral";
          return span;
        },
      },
      { key: "count", label: "Uses", type: "number", class: "text-center" },
    ];

    const table = new SortableTable(container, {
      columns: columns,
      initialSortField: "tag",
      initialSortAsc: true,
      onRowClick: (item) => {
        if (this.callbacks.onTagClick) {
          // When clicking a trip here, we want to go to details for that Trip/Event
          this.callbacks.onTagClick("Trip/Event", item.tag);
        }
      },
    });
    table.update(data);
  }
}
