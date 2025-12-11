import { formatCurrency } from "../core/utils.js";

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

    this.data = [];
    this.sortField = config.initialSortField || null;
    this.sortAsc =
      config.initialSortAsc !== undefined ? config.initialSortAsc : true;
    this.selectedRows = new Set(); // Stores row IDs (or whole objects if no ID?) - prefer IDs.
    // Assuming data items have a unique 'row' or 'id' property if selection is enabled.
  }

  update(data) {
    this.data = [...data];
    this.sortData();
    this.render();
  }

  render() {
    this.container.innerHTML = "";
    const table = document.createElement("table");
    table.className = "sortable-table section-table"; // Using existing 'section-table' class to match theme

    // THEAD
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    if (this.enableSelection) {
      const th = document.createElement("th");
      th.style.width = "40px";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";

      // Check if all visible rows are selected
      const allSelected =
        this.data.length > 0 &&
        this.data.every((item) => this.selectedRows.has(item.row));
      checkbox.checked = allSelected;

      checkbox.addEventListener("change", (e) =>
        this.handleSelectAll(e.target.checked)
      );
      th.appendChild(checkbox);
      headerRow.appendChild(th);
    }

    this.columns.forEach((col) => {
      const th = document.createElement("th");
      th.innerHTML = col.label;
      if (col.class) th.className = col.class;

      if (col.sortable !== false) {
        th.classList.add("sortable");
        th.addEventListener("click", (e) => {
          if (e.target.closest(".no-sort")) return;
          this.handleSort(col.key);
        });

        if (this.sortField === col.key) {
          const icon = document.createElement("span");
          icon.className = "sort-icon";
          icon.textContent = this.sortAsc ? "▲" : "▼";
          th.appendChild(icon);
        }
      }
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // TBODY
    const tbody = document.createElement("tbody");
    if (this.data.length === 0) {
      const row = document.createElement("tr");
      const colspan = this.columns.length + (this.enableSelection ? 1 : 0);
      row.innerHTML = `<td colspan="${colspan}" style="text-align: center; color: #aaa;">No data available</td>`;
      tbody.appendChild(row);
    } else {
      this.data.forEach((item) => {
        const row = document.createElement("tr");
        if (this.onRowClick && !this.enableSelection) {
          row.style.cursor = "pointer";
          row.addEventListener("click", (e) => this.onRowClick(item, e));
        }

        if (this.enableSelection) {
          const td = document.createElement("td");
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = this.selectedRows.has(item.row); // Assuming 'row' is the ID
          checkbox.addEventListener("change", (e) =>
            this.handleRowSelect(item.row, e.target.checked)
          );
          td.appendChild(checkbox);
          row.appendChild(td);

          row.style.cursor = "pointer";
          row.addEventListener("click", (e) => {
            if (e.target.type === "checkbox") return;
            const newState = !this.selectedRows.has(item.row);
            checkbox.checked = newState;
            this.handleRowSelect(item.row, newState);
          });
        }

        this.columns.forEach((col) => {
          const td = document.createElement("td");
          if (col.class) td.className = col.class;

          if (col.render) {
            td.innerHTML = col.render(item);
          } else {
            let val = item[col.key];
            if (col.type === "currency") {
              val = formatCurrency(val);
            } else if (col.type === "number") {
              // val = val; // already formatted or raw?
            }
            td.textContent = val !== undefined && val !== null ? val : "";
          }

          // Add click handler to cell if row selection is enabled but we also want row actions?
          // For now, just attach to row.
          tbody.appendChild(row);
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

    this.data.sort((a, b) => {
      const colDef = this.columns.find((c) => c.key === this.sortField);

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
        valA = new Date(valA || 0).getTime();
        valB = new Date(valB || 0).getTime();
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
      this.data.forEach((item) => this.selectedRows.add(item.row));
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
    // No need to re-render full table, just update checkbox if needed?
    // But native checkbox updates itself.
  }

  getSelectedRows() {
    return Array.from(this.selectedRows);
  }

  clearSelection() {
    this.selectedRows.clear();
    this.render();
  }
}
