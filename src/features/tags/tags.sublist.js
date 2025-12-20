import { formatCurrency } from "../../core/utils.js";
import SortableTable from "../../shared/sortable-table.component.js";

export default class TagsSubList {
  constructor(element, callbacks) {
    this.element = element;
    this.callbacks = callbacks || {};
    // callbacks: { onBack, onTagClick }
  }

  render(typeName, stats, tripTypeMap, tripStatusMap) {
    // Filter trips that belong to this type
    const tripStats = stats["Trip/Event"] || {};
    const relevantTrips = Object.keys(tripStats).filter(
      (trip) => tripTypeMap[trip] === typeName
    );

    const data = relevantTrips.map((trip) => {
      const s = tripStats[trip];
      const net = s.income - s.expense;
      return {
        tag: trip,
        status: tripStatusMap[trip] || "Active",
        income: s.income,
        expense: s.expense,
        net: net,
        count: s.count,
      };
    });

    this.element.innerHTML = `
            <div class="section">
                <div class="tags-header-actions" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <button id="back-sublist-btn" class="secondary-btn" style="padding: 5px 10px;">← Back</button>
                        <h2 style="margin: 0;">${typeName} <span style="font-size: 0.6em; color: #aaa; font-weight: normal;">(Trip Type)</span></h2>
                    </div>
                </div>

                <div id="sublist-table-container"></div>
            </div>
        `;

    const container = this.element.querySelector("#sublist-table-container");

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
          
          const span = document.createElement("span");
          span.title = s.title;
          span.style.color = s.color;
          span.style.fontWeight = "bold";
          span.style.fontSize = "1.2em";
          span.textContent = s.icon;
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
          const span = document.createElement("span");
          if (item.net > 0) span.className = "positive";
          else if (item.net < 0) span.className = "negative";
          span.textContent = formatCurrency(Math.abs(item.net));
          return span;
        }
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

    // Attach listeners
    this.element
      .querySelector("#back-sublist-btn")
      .addEventListener("click", () => {
        if (this.callbacks.onBack) this.callbacks.onBack();
      });
  }
}
