import { formatCurrency } from "../core/utils.js";
import { el, clear } from "../core/dom.js";

export default class SortableTable {
  /**
   * @param {HTMLElement} container
   * @param {Object} config
   * @param {Array} config.columns - Array of column definitions:
   *   {
   *     key: string,             // Property name in data object
   *     label: string,           // Header text
   *     type: string,            // 'text', 'number', 'currency', 'date'
   *     sortable: boolean,       // Default true
   *     render: (row) => string, // Optional custom renderer
   *     class: string            // Optional CSS class (e.g., 'text-right')
   *   }
   * @param {Function} config.onRowClick - (row, event) => void
   * @param {boolean} config.enableSelection - Default false
   * @param {Function} config.onSelectionChange - (selectedIds) => void
   * @param {string} config.initialSortField
   * @param {boolean} config.initialSortAsc
   */
  constructor(container, config) {
    this.container = container;
    this.columns = config.columns || [];
    this.onRowClick = config.onRowClick;
    this.enableSelection = config.enableSelection || false;
    this.onSelectionChange = config.onSelectionChange;
    this.rowIdField = config.rowIdField || "id";

    this.data = [];
    this.sortField = config.initialSortField || null;
    this.sortAsc =
      config.initialSortAsc !== undefined ? config.initialSortAsc : true;
    this.selectedRows = new Set();
  }

  update(data) {
    this.data = [...data];
    this.sortData();
    this.render();
  }

  render() {
    clear(this.container);
    const table = el("table", { className: "sortable-table section-table" });

    // THEAD
    const headerRow = el("tr");

    if (this.enableSelection) {
      const checkbox = el("input", {
        type: "checkbox",
        "aria-label": "Select all rows",
        onclick: (e) => e.stopPropagation(), // Prevent triggering header click if any
        onchange: (e) => this.handleSelectAll(e.target.checked),
      });

      // Check if all visible rows are selected
      const allSelected =
        this.data.length > 0 &&
        this.data.every((item) => this.selectedRows.has(item[this.rowIdField]));
      checkbox.checked = allSelected;

      headerRow.appendChild(el("th", { style: { width: "40px" } }, checkbox));
    }

    this.columns.forEach((col) => {
      const th = el(
        "th",
        {
          className: col.class || "",
        },
        col.label
      );

      if (col.sortable !== false) {
        th.classList.add("sortable");
        th.setAttribute("tabindex", "0");
        th.setAttribute("role", "button");
        th.setAttribute("aria-label", `Sort by ${col.label}`);

        const sortHandler = (e) => {
          if (e.target.closest(".no-sort")) return;
          this.handleSort(col.key);
        };

        th.addEventListener("click", sortHandler);
        th.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            sortHandler(e);
          }
        });

        if (this.sortField === col.key) {
          th.appendChild(
            el("span", { className: "sort-icon" }, this.sortAsc ? " ▲" : " ▼")
          );
        }
      }
      headerRow.appendChild(th);
    });

    table.appendChild(el("thead", {}, headerRow));

    // TBODY
    const tbody = el("tbody");
    if (this.data.length === 0) {
      const colspan = this.columns.length + (this.enableSelection ? 1 : 0);
      tbody.appendChild(
        el(
          "tr",
          {},
          el(
            "td",
            {
              colspan,
              style: { textAlign: "center", color: "#aaa" },
            },
            "No data available"
          )
        )
      );
    } else {
      this.data.forEach((item) => {
        const row = el("tr");
        if (this.onRowClick && !this.enableSelection) {
          row.style.cursor = "pointer";
          row.onclick = (e) => this.onRowClick(item, e);
        }

        if (this.enableSelection) {
          const checkbox = el("input", {
            type: "checkbox",
            "aria-label": "Select row",
            checked: this.selectedRows.has(item[this.rowIdField]),
            onchange: (e) =>
              this.handleRowSelect(item[this.rowIdField], e.target.checked),
            onclick: (e) => e.stopPropagation(),
          });

          row.appendChild(el("td", {}, checkbox));

          row.style.cursor = "pointer";
          row.onclick = (e) => {
            if (e.target.type === "checkbox") return;
            const newState = !this.selectedRows.has(item[this.rowIdField]);
            checkbox.checked = newState;
            this.handleRowSelect(item[this.rowIdField], newState);

            if (this.onRowClick) {
              this.onRowClick(item, e);
            }
          };
        }

        this.columns.forEach((col) => {
          const td = el("td", { className: col.class || "" });

          if (col.render) {
            const rendered = col.render(item);
            if (rendered instanceof Node) {
              td.appendChild(rendered);
            } else {
              td.textContent = String(rendered);
            }
          } else {
            let val = item[col.key];
            if (col.type === "currency") {
              val = formatCurrency(val);
            }
            td.textContent = val !== undefined && val !== null ? val : "";
          }
          row.appendChild(td);
        });
        tbody.appendChild(row);
      });
    }
    table.appendChild(tbody);
    this.container.appendChild(table);
  }

  handleSort(key) {
    if (this.sortField === key) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortField = key;
      this.sortAsc = true;
    }
    this.sortData();
    this.render();
  }

  sortData() {
    if (!this.sortField) return;

    const colDef = this.columns.find((c) => c.key === this.sortField);

    this.data.sort((a, b) => {
      let valA, valB;

      if (colDef && colDef.sortValue) {
        valA = colDef.sortValue(a);
        valB = colDef.sortValue(b);
      } else {
        valA = a[this.sortField];
        valB = b[this.sortField];
      }

      // Handle Dates
      if (colDef && colDef.type === "date") {
        const dateA = new Date(valA);
        const dateB = new Date(valB);
        valA = isNaN(dateA.getTime()) ? Infinity : dateA.getTime();
        valB = isNaN(dateB.getTime()) ? Infinity : dateB.getTime();
      } else if (
        colDef &&
        (colDef.type === "number" || colDef.type === "currency")
      ) {
        // Try parsing simple numbers or currency
        valA = this.parseNumber(valA);
        valB = this.parseNumber(valB);
      } else {
        if (typeof valA === "number" && typeof valB === "number") {
          // Keep as numbers
        } else {
          // String comparison
          valA = (valA !== undefined && valA !== null ? valA : "")
            .toString()
            .toLowerCase();
          valB = (valB !== undefined && valB !== null ? valB : "")
            .toString()
            .toLowerCase();
        }
      }

      if (valA < valB) return this.sortAsc ? -1 : 1;
      if (valA > valB) return this.sortAsc ? 1 : -1;
      return 0;
    });
  }

  parseNumber(val) {
    if (typeof val === "number") return val;
    if (!val) return 0;
    return parseFloat(val.toString().replace(/,/g, "")) || 0;
  }

  handleSelectAll(checked) {
    if (checked) {
      this.data.forEach((item) => this.selectedRows.add(item[this.rowIdField]));
    } else {
      this.selectedRows.clear();
    }
    if (this.onSelectionChange)
      this.onSelectionChange(Array.from(this.selectedRows));
    this.render();
  }

  handleRowSelect(id, checked) {
    if (checked) this.selectedRows.add(id);
    else this.selectedRows.delete(id);
    if (this.onSelectionChange)
      this.onSelectionChange(Array.from(this.selectedRows));

    // Update header checkbox state
    const headerCheckbox = this.container.querySelector(
      'thead input[type="checkbox"]'
    );
    if (headerCheckbox) {
      headerCheckbox.checked =
        this.data.length > 0 &&
        this.data.every((item) => this.selectedRows.has(item[this.rowIdField]));
    }
  }

  getSelectedRows() {
    return Array.from(this.selectedRows);
  }

  clearSelection() {
    this.selectedRows.clear();
    this.render();
  }
}
