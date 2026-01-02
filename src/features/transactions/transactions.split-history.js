import { formatCurrency, parseDate, escapeHtml } from "../../core/utils.js";
import ApiService from "../../services/api.service.js";
import store from "../../core/state.js";
import SplitTransactionModal from "./split-transaction.modal.js";
import { el } from "../../core/dom.js";

export default class TransactionsSplitHistory {
  constructor() {}

  async open(data) {
    return new Promise((resolve, reject) => {
      this.resolvePromise = resolve;
      this.data = data;
      try {
        this.render();
      } catch (error) {
        // Clean up any partially created overlay
        if (this.overlay) {
          this.overlay.remove();
          this.overlay = null;
        }
        reject(error);
      }
    });
  }

  groupData(data) {
    const groups = {};
    // Sort by date desc first
    const sorted = [...data].sort((a, b) => {
      const dateA = parseDate(a.Date);
      const dateB = parseDate(b.Date);

      // Handle invalid dates by placing them at the end
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;

      return dateB - dateA;
    });

    sorted.forEach((row) => {
      const id = row["Split Group ID"];
      if (!id) return; // Should not happen
      if (!groups[id]) groups[id] = [];
      groups[id].push(row);
    });
    return groups;
  }

  render() {
    if (this.overlay) {
      // Resolve the previous promise before removing the overlay
      if (this.resolvePromise) {
        this.resolvePromise(false);
      }
      this.overlay.remove();
      this.overlay = null;
    }

    const overlay = el("div", { className: "modal-overlay" });
    this.overlay = overlay;

    const groupedData = this.groupData(this.data);
    const groupIds = Object.keys(groupedData);

    let tableBodyContent = [];
    if (groupIds.length === 0) {
      tableBodyContent.push(
        el(
          "tr",
          {},
          el(
            "td",
            {
              colspan: "6",
              style: { textAlign: "center", padding: "20px", color: "#aaa" },
            },
            "No split history found."
          )
        )
      );
    } else {
      groupIds.forEach((groupId) => {
        const rows = groupedData[groupId];
        const source =
          rows.find((r) => r["Split Type"] === "SOURCE") || rows[0];

        const date = source.Date || "";
        const desc = source.Description || "";
        const isReverted = rows.some((r) => r["Split Type"] === "REVERTED");

        // Calculate total from source
        let amount = 0;
        if (source.Income)
          amount = parseFloat(String(source.Income).replace(/,/g, ""));
        else if (source.Expense)
          amount = -parseFloat(String(source.Expense).replace(/,/g, ""));

        if (isNaN(amount)) {
          console.warn("Invalid amount parsed for source:", source);
          amount = 0;
        }

        const amountClass = amount >= 0 ? "positive" : "negative";
        const statusLabel = isReverted
          ? el(
              "span",
              { style: { color: "#aaa", fontSize: "0.8em" } },
              "(REVERTED)"
            )
          : null;

        // Build Detail Rows
        const detailRows = rows.map((row) => {
          const rType = row["Split Type"];
          const rDesc = row.Description || "";
          const rDate = row.Date || "";
          const rTrip = row["Trip/Event"] || "";
          const rCat = row["Category"] || "";
          const tagsDisplay = [rTrip, rCat].filter(Boolean).join(" / ") || "-";

          let rAmount = 0;
          if (row.Income)
            rAmount = parseFloat(String(row.Income).replace(/,/g, ""));
          else if (row.Expense)
            rAmount = -parseFloat(String(row.Expense).replace(/,/g, ""));

          if (isNaN(rAmount)) {
            console.warn("Invalid amount parsed for row:", row);
            rAmount = 0;
          }
          const rAmountClass = rAmount >= 0 ? "positive" : "negative";

          // Styling based on type
          let rBg = "transparent";
          if (rType === "SOURCE") rBg = "rgba(255, 0, 0, 0.1)";
          if (rType === "CHILD") rBg = "rgba(0, 255, 0, 0.05)";

          const clickableClass = !isReverted ? "split-detail-clickable" : "";
          const cursorStyle = !isReverted ? "cursor: pointer;" : "";

          const rowEl = el(
            "tr",
            {
              className: `split-detail-row ${clickableClass}`,
              style: `background: ${rBg}; ${cursorStyle}`,
              dataset: { group: groupId },
            },
            el("td", { style: { padding: "8px" } }, rType),
            el("td", {}, rDate),
            el("td", {}, rDesc),
            el("td", {}, tagsDisplay),
            el(
              "td",
              {},
              el(
                "span",
                { className: rAmountClass },
                formatCurrency(Math.abs(rAmount))
              )
            )
          );

          if (!isReverted) {
            rowEl.addEventListener("click", (e) => {
              e.stopPropagation(); // Prevent toggling the group
              this.handleRowClick(groupId);
            });
          }

          return rowEl;
        });

        // Summary Row
        const headerRow = el(
          "tr",
          { className: "split-group-header", dataset: { group: groupId } },
          el(
            "td",
            { style: { width: "40px", textAlign: "center" } },
            el("span", { className: "split-toggle-icon" }, "▶")
          ),
          el("td", {}, date),
          el("td", {}, desc, ...(statusLabel ? [" ", statusLabel] : [])),
          el(
            "td",
            {},
            el(
              "span",
              { className: amountClass },
              formatCurrency(Math.abs(amount))
            )
          ),
          el(
            "td",
            { style: { fontFamily: "monospace", color: "#888" } },
            groupId.substring(0, 8) + "..."
          )
        );

        const detailsRow = el(
          "tr",
          { className: "split-group-details", id: `details-${groupId}` },
          el(
            "td",
            { colspan: "5", style: { padding: "0" } },
            el(
              "div",
              { style: { padding: "10px", background: "rgba(0,0,0,0.2)" } },
              el(
                "table",
                { className: "split-detail-table" },
                el(
                  "thead",
                  {},
                  el(
                    "tr",
                    {
                      style: {
                        color: "#aaa",
                        fontSize: "0.85em",
                        borderBottom: "1px solid rgba(255,255,255,0.1)",
                      },
                    },
                    el(
                      "th",
                      { style: { textAlign: "left", padding: "5px" } },
                      "Type"
                    ),
                    el(
                      "th",
                      { style: { textAlign: "left", padding: "5px" } },
                      "Date"
                    ),
                    el(
                      "th",
                      { style: { textAlign: "left", padding: "5px" } },
                      "Description"
                    ),
                    el(
                      "th",
                      { style: { textAlign: "left", padding: "5px" } },
                      "Tags"
                    ),
                    el(
                      "th",
                      { style: { textAlign: "left", padding: "5px" } },
                      "Amount"
                    )
                  )
                ),
                el("tbody", {}, ...detailRows)
              )
            )
          )
        );

        headerRow.addEventListener("click", () => {
          if (headerRow.classList.contains("split-group-expanded")) {
            headerRow.classList.remove("split-group-expanded");
            detailsRow.classList.remove("active");
          } else {
            headerRow.classList.add("split-group-expanded");
            detailsRow.classList.add("active");
          }
        });

        tableBodyContent.push(headerRow);
        tableBodyContent.push(detailsRow);
      });
    }

    const close = () => {
      overlay.remove();
      this.resolvePromise();
    };

    const modalContent = el(
      "div",
      {
        className: "modal-content",
        style: {
          width: "95%",
          maxWidth: "1200px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
        },
      },
      el(
        "div",
        { className: "modal-header" },
        el("h3", {}, "Split Transaction History"),
        el("button", { className: "modal-close", onclick: close }, "×")
      ),
      el(
        "div",
        { className: "modal-body", style: { overflowY: "auto", padding: "0" } },
        el(
          "table",
          {
            className: "section-table",
            style: {
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: "0",
            },
          },
          el(
            "thead",
            {},
            el(
              "tr",
              {},
              el("th", {}),
              el("th", {}, "Date"),
              el("th", {}, "Description"),
              el("th", {}, "Total Amount"),
              el("th", {}, "Group ID")
            )
          ),
          el("tbody", {}, ...tableBodyContent)
        )
      ),
      el(
        "div",
        { className: "modal-footer" },
        el(
          "button",
          { className: "modal-btn modal-btn-confirm", onclick: close },
          "Close"
        )
      )
    );

    overlay.appendChild(modalContent);
    document.body.appendChild(overlay);
  }

  async handleRowClick(groupId) {
    // 1. Find data locally from this.data
    const groupRows = this.data.filter((r) => r["Split Group ID"] === groupId);

    if (groupRows.length === 0) {
      alert("Error: Transaction details not found in local history.");
      return;
    }

    const source = groupRows.find((r) => r["Split Type"] === "SOURCE");
    const children = groupRows.filter((r) => r["Split Type"] === "CHILD");

    if (!source) {
      // Should not happen if data integrity is good
      alert("Error: Source transaction missing.");
      return;
    }

    // 2. Open Modal using local data
    try {
      const modal = new SplitTransactionModal();
      const action = await modal.open(source, children, groupId);

      if (action && action.action === "edit") {
        this.overlay.remove();

        store.setState("savingSplitTransaction", true);
        try {
          await ApiService.editSplit(
            action.groupId,
            action.splits,
            action.original,
            { skipLoading: true }
          );
          document.dispatchEvent(new CustomEvent("dataUploaded"));
        } catch (error) {
          console.error("Failed to update split:", error);
          alert("Failed to update split: " + error.message);
        } finally {
          store.setState("savingSplitTransaction", false);
        }
        this.resolvePromise(true);
      } else if (action && action.action === "revert") {
        this.overlay.remove();

        store.setState("savingSplitTransaction", true);
        try {
          await ApiService.revertSplit(action.groupId, { skipLoading: true });
          document.dispatchEvent(new CustomEvent("dataUploaded"));
        } catch (error) {
          console.error("Failed to revert split:", error);
          alert("Failed to revert split: " + error.message);
        } finally {
          store.setState("savingSplitTransaction", false);
        }

        this.resolvePromise(true);
      } else if (action) {
        // This handles if a split was created, which won't happen here
        this.overlay.remove();
        this.resolvePromise(true);
      }
    } catch (error) {
      console.error("Failed to open split modal:", error);
      alert("An error occurred: " + error.message);
    }
  }
}
