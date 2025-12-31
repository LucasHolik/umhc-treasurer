import { formatCurrency } from "../../core/utils.js";
import ModalComponent from "../../shared/modal.component.js";
import { el, replace } from "../../core/dom.js";

export default class SplitTransactionModal {
  constructor() {
    this.transaction = null;
    this.splits = [];
    this.mode = "create"; // 'create' or 'edit'
    this.groupId = null;
  }

  /**
   * Open the modal.
   * @param {Object} transaction - The source transaction (for create) or restored source (for edit).
   * @param {Array} existingSplits - Optional. If provided, enters edit mode with these splits.
   * @param {string} groupId - Optional. Required if in edit mode.
   */
  async open(transaction, existingSplits = null, groupId = null) {
    this.transaction = transaction;

    // Determine original amount (net)
    const income = transaction.Income
      ? parseFloat(String(transaction.Income).replace(/,/g, ""))
      : 0;
    const expense = transaction.Expense
      ? parseFloat(String(transaction.Expense).replace(/,/g, ""))
      : 0;
    this.originalAmount = isNaN(income) ? 0 : income;
    this.isIncome = income > 0;
    if (expense > 0) {
      this.originalAmount = expense; // Treat as positive magnitude for splitting
      this.isIncome = false;
    }

    if (existingSplits) {
      this.mode = "edit";
      this.groupId = groupId;
      this.splits = existingSplits.map((s) => {
        let amt = 0;
        if (s.Amount !== undefined) amt = s.Amount;
        else if (s.amount !== undefined) amt = s.amount;
        else {
          const inc = s.Income
            ? parseFloat(String(s.Income).replace(/,/g, ""))
            : 0;
          const exp = s.Expense
            ? parseFloat(String(s.Expense).replace(/,/g, ""))
            : 0;
          amt = inc !== 0 ? inc : exp;
        }

        return {
          description: s.Description || s.description || "", // handle both cases
          amount: parseFloat(amt || 0),
        };
      });
    } else {
      this.mode = "create";
      this.splits = [
        {
          description: (transaction.Description ?? "Transaction") + " (Part 1)",
          amount: 0,
        },
        {
          description: (transaction.Description ?? "Transaction") + " (Part 2)",
          amount: 0,
        },
      ];
    }

    return new Promise((resolve) => {
      this.resolvePromise = resolve;
      this.render();
      this.updateCalculations();
    });
  }

  render() {
    const overlay = el("div", { className: "modal-overlay" });

    const amountDisplay = formatCurrency(this.originalAmount);
    const title =
      this.mode === "edit" ? "Edit Split Transaction" : "Split Transaction";

    const revertBtn =
      this.mode === "edit"
        ? el(
            "button",
            {
              className: "modal-btn",
              id: "revert-split-btn",
              style: { backgroundColor: "#d9534f", marginRight: "auto" },
              onclick: () => this.handleRevert(),
            },
            "Revert to Original"
          )
        : null;

    this.splitsContainer = el("div", {
      id: "splits-container",
      style: { maxHeight: "300px", overflowY: "auto", marginBottom: "15px" },
    });

    this.saveBtn = el(
      "button",
      {
        className: "modal-btn modal-btn-confirm",
        id: "save-split-btn",
        disabled: true,
        style: { opacity: "0.5" },
        onclick: () => this.handleSubmit(),
      },
      "Save Splits"
    );

    this.totalDisplay = el(
      "span",
      { id: "total-split-display", style: { fontWeight: "bold" } },
      "$0.00"
    );
    this.remainingDisplay = el(
      "span",
      { id: "remaining-display", style: { fontWeight: "bold" } },
      "$0.00"
    );

    const modalContent = el(
      "div",
      { className: "modal-content", style: { maxWidth: "600px" } },
      // Header
      el(
        "div",
        { className: "modal-header" },
        el("h3", {}, title),
        el(
          "button",
          { className: "modal-close", onclick: () => this.close(null) },
          "×"
        )
      ),
      // Body
      el(
        "div",
        { className: "modal-body" },
        el(
          "div",
          {
            style: {
              background: "rgba(255,255,255,0.05)",
              padding: "15px",
              borderRadius: "8px",
              marginBottom: "20px",
            },
          },
          el(
            "div",
            { style: { fontSize: "0.9em", color: "#aaa" } },
            "Original Transaction"
          ),
          el(
            "div",
            {
              style: {
                fontSize: "1.1em",
                fontWeight: "bold",
                marginBottom: "5px",
              },
            },
            this.transaction.Description ?? "No Description"
          ),
          el(
            "div",
            {
              style: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              },
            },
            el(
              "span",
              { style: { color: "#ddd" } },
              this.transaction.Date ?? ""
            ),
            el(
              "span",
              {
                className: this.isIncome ? "positive" : "negative",
                style: {
                  fontSize: "1.2em",
                },
              },
              amountDisplay
            )
          )
        ),
        this.splitsContainer,
        el(
          "button",
          {
            id: "add-split-btn",
            className: "secondary-btn",
            style: { width: "100%", marginBottom: "15px" },
            onclick: () => this.addSplit(),
          },
          "+ Add Another Split"
        ),
        el(
          "div",
          {
            style: {
              borderTop: "1px solid rgba(255,255,255,0.1)",
              paddingTop: "15px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            },
          },
          el("span", { style: { color: "#aaa" } }, "Total Split:"),
          this.totalDisplay
        ),
        el(
          "div",
          {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "5px",
            },
          },
          el("span", { style: { color: "#aaa" } }, "Remaining:"),
          this.remainingDisplay
        )
      ),
      // Footer
      el(
        "div",
        { className: "modal-footer" },
        revertBtn,
        el(
          "button",
          {
            className: "modal-btn modal-btn-cancel",
            onclick: () => this.close(null),
          },
          "Cancel"
        ),
        this.saveBtn
      )
    );

    overlay.appendChild(modalContent);
    document.body.appendChild(overlay);
    this.overlay = overlay;

    // Keyboard accessibility for ESC key
    this.handleEscape = (e) => {
      if (e.key === "Escape") {
        this.close(null);
      }
    };
    document.addEventListener("keydown", this.handleEscape);

    // Render initial splits
    this.renderSplits();
  }

  renderSplits() {
    const rows = this.splits.map((split, index) => {
      const descInput = el("input", {
        type: "text",
        id: `split-desc-${index}`,
        name: `split-desc-${index}`,
        "aria-label": `Description for split ${index + 1}`,
        className: "theme-input split-desc",
        dataset: { index },
        value: split.description,
        placeholder: "Description",
        style: { flex: "2" },
      });
      descInput.addEventListener("input", (e) => {
        this.splits[e.target.dataset.index].description = e.target.value;
      });

      const amountInput = el("input", {
        type: "number",
        id: `split-amount-${index}`,
        name: `split-amount-${index}`,
        "aria-label": `Amount for split ${index + 1}`,
        className: "theme-input split-amount",
        dataset: { index },
        value: split.amount || "",
        placeholder: "0.00",
        step: "0.01",
        style: { flex: "1" },
      });
      amountInput.addEventListener("input", (e) => {
        const val = parseFloat(e.target.value);
        this.splits[e.target.dataset.index].amount = isNaN(val) ? 0 : val;
        this.updateCalculations();
      });

      const removeBtn = el(
        "button",
        {
          className: "remove-split-btn",
          "aria-label": `Remove split ${index + 1}`,
          dataset: { index },
          style: {
            background: "none",
            border: "none",
            color: "#d9534f",
            cursor: "pointer",
            fontSize: "1.2em",
          },
          onclick: (e) =>
            this.removeSplit(parseInt(e.currentTarget.dataset.index)),
        },
        "×"
      );

      return el(
        "div",
        {
          className: "split-row",
          style: {
            display: "flex",
            gap: "10px",
            marginBottom: "10px",
            alignItems: "center",
          },
        },
        descInput,
        amountInput,
        removeBtn
      );
    });

    replace(this.splitsContainer, ...rows);
  }

  addSplit() {
    const baseDesc = this.transaction.Description ?? "Transaction";
    this.splits.push({
      description: baseDesc + " (Part " + (this.splits.length + 1) + ")",
      amount: 0,
    });
    this.renderSplits();
    this.updateCalculations();
  }

  async removeSplit(index) {
    if (this.splits.length <= 2) {
      await new ModalComponent().alert("You must have at least 2 splits.");
      return;
    }
    this.splits.splice(index, 1);
    this.renderSplits();
    this.updateCalculations();
  }

  updateCalculations() {
    const total = this.splits.reduce((sum, s) => sum + (s.amount || 0), 0);
    const remaining = this.originalAmount - total;

    this.totalDisplay.textContent = formatCurrency(total);
    this.remainingDisplay.textContent = formatCurrency(remaining);

    // Tolerance for floating point errors
    const isValid = Math.abs(remaining) < 0.01;

    if (isValid) {
      this.remainingDisplay.className = "positive";
      this.remainingDisplay.style.color = ""; // Clear inline style if any
      this.saveBtn.disabled = false;
      this.saveBtn.style.opacity = "1";
    } else {
      this.remainingDisplay.className = "negative";
      this.remainingDisplay.style.color = ""; // Clear inline style if any
      this.saveBtn.disabled = true;
      this.saveBtn.style.opacity = "0.5";
    }
  }

  async handleRevert() {
    const modal = new ModalComponent();
    const confirmed = await modal.confirm(
      "Are you sure you want to revert this split? The original transaction will be restored."
    );

    if (confirmed) {
      // Visually hide the current modal immediately so it feels like "closing"
      if (this.overlay) this.overlay.style.display = "none";

      // Return action to caller to handle API
      this.close({ action: "revert", groupId: this.groupId });
    }
  }

  async handleSubmit() {
    // Final validation
    const total = this.splits.reduce((sum, s) => sum + (s.amount || 0), 0);
    if (Math.abs(this.originalAmount - total) >= 0.01) {
      await new ModalComponent().alert(
        "Total split amount must equal original amount."
      );
      return;
    }

    if (this.splits.some((s) => !s.description || !s.description.trim())) {
      await new ModalComponent().alert("All splits must have a description.");
      return;
    }

    // Format for API
    const splitsPayload = this.splits.map((s) => ({
      Description: s.description,
      Amount: s.amount,
    }));

    if (this.mode === "edit") {
      // Return data to caller to handle API
      this.close({
        action: "edit",
        groupId: this.groupId,
        original: this.transaction,
        splits: splitsPayload,
      });
    } else {
      // Handle Create (Return data to caller to handle API)
      this.close(splitsPayload);
    }
  }

  close(data) {
    if (this.handleEscape) {
      document.removeEventListener("keydown", this.handleEscape);
    }
    if (this.overlay) {
      this.overlay.remove();
    }
    if (this.resolvePromise) {
      this.resolvePromise(data);
    }
  }
}
