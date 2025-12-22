import { formatCurrency } from "../../core/utils.js";
import { el, replace } from "../../core/dom.js";

export default class AnalysisTable {
  constructor(element) {
    this.element = element;
  }

  render(labels, datasets, options) {
    const { primaryGroup, secondaryGroup, metric, timeUnit, show } = options;

    if (!show) {
      replace(this.element);
      return;
    }

    const headerCells = [];
    headerCells.push(
      el(
        "th",
        { className: "data-table-header" },
        primaryGroup === "date"
          ? `Date (${timeUnit})`
          : primaryGroup.charAt(0).toUpperCase() + primaryGroup.slice(1)
      )
    );

    if (secondaryGroup !== "none") {
      const secondaryKeys = datasets.map((d) => d.label);
      secondaryKeys.forEach((key) => {
        headerCells.push(el("th", { className: "data-table-header" }, key));
      });
      headerCells.push(el("th", { className: "data-table-header" }, "Total"));
    } else {
      headerCells.push(
        el(
          "th",
          { className: "data-table-header" },
          metric.charAt(0).toUpperCase() + metric.slice(1)
        )
      );
    }

    const tableRows = labels.map((label) => {
      const rowCells = [];
      rowCells.push(el("td", { className: "data-table-cell" }, label));

      if (secondaryGroup !== "none") {
        let rowTotal = 0;
        datasets.forEach((dataset) => {
          const dataIndex = labels.indexOf(label);
          const value = dataset.data[dataIndex] || 0;
          rowCells.push(
            el("td", { className: "data-table-cell" }, formatCurrency(value))
          );
          rowTotal += value;
        });
        rowCells.push(
          el(
            "td",
            { className: "data-table-cell total-column" },
            formatCurrency(rowTotal)
          )
        );
      } else {
        const dataIndex = labels.indexOf(label);
        const value = datasets[0].data[dataIndex] || 0;
        rowCells.push(
          el("td", { className: "data-table-cell" }, formatCurrency(value))
        );
      }
      return el("tr", { className: "data-table-row" }, ...rowCells);
    });

    const container = el(
      "div",
      { className: "data-table-container" },
      el("h3", {}, "Aggregated Data"),
      el(
        "table",
        { className: "data-table" },
        el("thead", {}, el("tr", {}, ...headerCells)),
        el("tbody", {}, ...tableRows)
      )
    );

    replace(this.element, container);
  }
}
