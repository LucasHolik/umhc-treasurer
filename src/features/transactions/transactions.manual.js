import { el } from "../../core/dom.js";
import { formatDateForInput } from "../../core/utils.js";
import ModalComponent from "../../shared/modal.component.js";

export default class TransactionsManualModal {
  constructor() {
    this.modalService = new ModalComponent();
  }

  open() {
    return new Promise((resolve, reject) => {
      // Prevent opening multiple modals
      if (this.overlay) {
        reject(new Error("Modal is already open"));
        return;
      }

      this.resolvePromise = resolve;
      this.render();
    });
  }

  render() {
    // Inputs
    this.dateInput = el("input", {
      type: "date",
      id: "manual-date",
      className: "theme-input",
      style: { width: "100%" },
    });
    // Set default date to today (local timezone)
    this.dateInput.value = formatDateForInput(new Date());

    this.descInput = el("input", {
      type: "text",
      id: "manual-desc",
      className: "theme-input",
      placeholder: "e.g. Old Equipment",
      style: { width: "100%" },
    });
    this.docInput = el("input", {
      type: "text",
      id: "manual-doc",
      className: "theme-input",
      placeholder: "e.g. Invoice #123",
      style: { width: "100%" },
    });

    this.typeSelect = el(
      "select",
      {
        id: "manual-type",
        className: "theme-select",
        style: { width: "100%" },
      },
      el("option", { value: "Expense" }, "Expense (Money Out)"),
      el("option", { value: "Income" }, "Income (Money In)"),
    );

    this.amountInput = el("input", {
      type: "number",
      id: "manual-amount",
      className: "theme-input",
      step: "0.01",
      placeholder: "0.00",
      style: { width: "100%" },
    });

    // Modal Content
    const modalContent = el(
      "div",
      {
        className: "modal-content",
        style: { maxWidth: "500px" },
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": "modal-title",
      },
      // Header
      el(
        "div",
        { className: "modal-header" },
        el("h3", { id: "modal-title" }, "Add Manual Transaction"),
        el(
          "button",
          { className: "modal-close", onclick: () => this.close(null) },
          "×",
        ),
      ),
      // Body
      el(
        "div",
        { className: "modal-body" },
        el(
          "p",
          { style: { color: "#aaa", fontSize: "0.9em", marginBottom: "15px" } },
          "Use this ONLY for old transactions not covered by Excel files.",
        ),
        el(
          "div",
          { className: "form-group" },
          el("label", { for: "manual-date" }, "Date"),
          this.dateInput,
        ),
        el(
          "div",
          { className: "form-group" },
          el("label", { for: "manual-desc" }, "Description"),
          this.descInput,
        ),
        el(
          "div",
          { className: "form-group" },
          el("label", { for: "manual-doc" }, "Document (Optional)"),
          this.docInput,
        ),
        el(
          "div",
          { className: "form-group", style: { display: "flex", gap: "10px" } },
          el(
            "div",
            {
              style: {
                flex: "1",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              },
            },
            el("label", { for: "manual-type" }, "Type"),
            this.typeSelect,
          ),
          el(
            "div",
            {
              style: {
                flex: "1",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              },
            },
            el("label", { for: "manual-amount" }, "Amount (£)"),
            this.amountInput,
          ),
        ),
      ),
      // Footer
      el(
        "div",
        { className: "modal-footer" },
        el(
          "button",
          {
            className: "modal-btn modal-btn-cancel",
            onclick: () => this.close(null),
          },
          "Cancel",
        ),
        el(
          "button",
          {
            className: "modal-btn modal-btn-confirm",
            style: { backgroundColor: "#f0ad4e" },
            onclick: () => this.handleSubmit(),
          },
          "Add Transaction",
        ),
      ),
    );

    const overlay = el(
      "div",
      {
        className: "modal-overlay",
      },
      modalContent,
    );

    document.body.appendChild(overlay);
    this.overlay = overlay;

    // Handle Escape key
    this.handleEscapeKey = (e) => {
      if (e.key === "Escape") {
        this.close(null);
      }
    };
    document.addEventListener("keydown", this.handleEscapeKey);

    // Focus the first input
    setTimeout(() => this.dateInput.focus(), 0);
  }

  close(data) {
    if (this.handleEscapeKey) {
      document.removeEventListener("keydown", this.handleEscapeKey);
      this.handleEscapeKey = null;
    }

    if (this.overlay) {
      const overlayToRemove = this.overlay;
      overlayToRemove.style.opacity = "0";
      setTimeout(() => {
        if (overlayToRemove && overlayToRemove.parentNode) {
          overlayToRemove.remove();
        }
      }, 200);
      this.overlay = null;
    }
    if (this.resolvePromise) {
      this.resolvePromise(data);
      this.resolvePromise = null;
    }
  }

  async handleSubmit() {
    const date = this.dateInput.value;
    const desc = this.descInput.value.trim();
    const doc = this.docInput.value.trim();
    const type = this.typeSelect.value;
    const amount = parseFloat(this.amountInput.value);

    if (!date || !desc || isNaN(amount) || amount <= 0) {
      this.modalService.alert(
        "Please fill in all required fields with valid values.",
      );
      return;
    }

    const transaction = {
      date: date,
      description: desc,
      document: doc,
      cashIn: type === "Income" ? amount : "",
      cashOut: type === "Expense" ? amount : "",
      isManual: true,
    };

    this.close(transaction);
  }

  destroy() {
    this.close(null);
  }
}
