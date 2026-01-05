import { formatCurrency, parseDate, parseAmount } from "../../core/utils.js";
import ApiService from "../../services/api.service.js";
import store from "../../core/state.js";
import SplitTransactionModal from "./split-transaction.modal.js";
import { el } from "../../core/dom.js";

export default class TransactionsSplitHistory {
  constructor() {}

  async open(data) {
    // Prevent opening multiple overlays concurrently
    this.resolveAndCleanup(false);

    this.closeOverlay();

    return new Promise((resolve, reject) => {
      this.resolvePromise = resolve;
      this.rejectPromise = reject;
      this.data = data;
      try {
        this.render();
      } catch (error) {
        // Clean up any partially created overlay
        this.closeOverlay();
        this.resolvePromise = null;
        this.rejectPromise = null;
        reject(error);
      }
    });
  }

  resolveAndCleanup(result = true) {
    if (this.resolvePromise) {
      this.resolvePromise(result);
      this.resolvePromise = null;
      this.rejectPromise = null;
    }
  }

  closeOverlay() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  parseTransactionAmount(row) {
    const income = parseAmount(row.Income);
    const expense = parseAmount(row.Expense);
    return income - expense;
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
      this.resolveAndCleanup(false);
      this.closeOverlay();
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
              colSpan: "6",
              className: "split-history-empty",
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
        const amount = this.parseTransactionAmount(source);

        const amountClass = amount >= 0 ? "positive" : "negative";
        const statusLabel = isReverted
          ? el("span", { className: "split-reverted-label" }, "(REVERTED)")
          : null;

        // Build Detail Rows
        const detailRows = rows.map((row) => {
          const rType = row["Split Type"];
          const rDesc = row.Description || "";
          const rDate = row.Date || "";
          const rTrip = row["Trip/Event"] || "";
          const rCat = row["Category"] || "";
          const tagsDisplay = [rTrip, rCat].filter(Boolean).join(" / ") || "-";

          const rAmount = this.parseTransactionAmount(row);
          const rAmountClass = rAmount >= 0 ? "positive" : "negative";

          // Styling based on type
          let rowTypeClass = "";
          if (rType === "SOURCE") rowTypeClass = "split-row-source";
          if (rType === "CHILD") rowTypeClass = "split-row-child";

          const clickableClass = !isReverted ? "split-detail-clickable" : "";

          const rowEl = el(
            "tr",
            {
              className: `split-detail-row ${clickableClass} ${rowTypeClass}`,
              dataset: { group: groupId },
            },
            el("td", { className: "split-cell-padding" }, rType),
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
            { className: "split-header-toggle-cell" },
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
            { className: "split-group-id" },
            groupId.length > 8 ? groupId.substring(0, 8) + "..." : groupId
          )
        );

        const detailsRow = el(
          "tr",
          { className: "split-group-details", id: `details-${groupId}` },
          el(
            "td",
            { colSpan: "5", className: "split-details-container" },
            el(
              "div",
              { className: "split-details-wrapper" },
              el(
                "table",
                { className: "split-detail-table" },
                el(
                  "thead",
                  {},
                  el(
                    "tr",
                    {
                      className: "split-detail-header-row",
                    },
                    el("th", { className: "split-detail-th" }, "Type"),
                    el("th", { className: "split-detail-th" }, "Date"),
                    el("th", { className: "split-detail-th" }, "Description"),
                    el("th", { className: "split-detail-th" }, "Tags"),
                    el("th", { className: "split-detail-th" }, "Amount")
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
      this.closeOverlay();
      this.resolveAndCleanup(false);
    };

    const modalContent = el(
      "div",
      {
        className: "modal-content split-modal-content",
      },
      el(
        "div",
        { className: "modal-header" },
        el("h3", {}, "Split Transaction History"),
        el("button", { className: "modal-close", onclick: close }, "×")
      ),
      el(
        "div",
        { className: "modal-body split-modal-body" },
        el(
          "table",
          {
            className: "section-table split-section-table",
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
        this.closeOverlay();

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

        this.resolveAndCleanup(true);
      } else if (action && action.action === "revert") {
        this.closeOverlay();

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

        this.resolveAndCleanup(true);
      } else if (action) {
        // This handles if a split was created, which won't happen here
        this.closeOverlay();
        this.resolveAndCleanup(true);
      }
    } catch (error) {
      console.error("Failed to open split modal:", error);
      alert("An error occurred: " + error.message);
    }
  }
}
