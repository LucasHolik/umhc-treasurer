import { formatCurrency } from "../../core/utils.js";

export default class AnalysisTable {
  constructor(element) {
    this.element = element;
  }

  render(labels, datasets, options) {
    const { primaryGroup, secondaryGroup, metric, timeUnit, show } = options;

    if (!show) {
      this.element.innerHTML = "";
      return;
    }

    let tableHeaders = `<th class="data-table-header">${
      primaryGroup === "date"
        ? `Date (${timeUnit})`
        : primaryGroup.charAt(0).toUpperCase() + primaryGroup.slice(1)
    }</th>`;
    if (secondaryGroup !== "none") {
      const secondaryKeys = datasets.map((d) => d.label);
      tableHeaders += secondaryKeys
        .map((key) => `<th class="data-table-header">${key}</th>`)
        .join("");
      tableHeaders += `<th class="data-table-header">Total</th>`;
    } else {
      tableHeaders += `<th class="data-table-header">${
        metric.charAt(0).toUpperCase() + metric.slice(1)
      }</th>`;
    }

    let tableRows = labels
      .map((label) => {
        let rowData = `<td class="data-table-cell">${label}</td>`;
        if (secondaryGroup !== "none") {
          let rowTotal = 0;
          datasets.forEach((dataset) => {
            const dataIndex = labels.indexOf(label);
            const value = dataset.data[dataIndex] || 0;
            rowData += `<td class="data-table-cell">${formatCurrency(
              value
            )}</td>`;
            rowTotal += value;
          });
          rowData += `<td class="data-table-cell total-column">${formatCurrency(
            rowTotal
          )}</td>`;
        } else {
          const dataIndex = labels.indexOf(label);
          const value = datasets[0].data[dataIndex] || 0;
          rowData += `<td class="data-table-cell">${formatCurrency(
            value
          )}</td>`;
        }
        return `<tr class="data-table-row">${rowData}</tr>`;
      })
      .join("");

    this.element.innerHTML = `
            <div class="data-table-container">
                <h3>Aggregated Data</h3>
                <table class="data-table">
                    <thead>
                        <tr>${tableHeaders}</tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>
        `;
  }
}
