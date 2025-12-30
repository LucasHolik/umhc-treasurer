// src/features/settings/settings.component.js
import store from "../../core/state.js";
import ApiService from "../../services/api.service.js";
import ModalComponent from "../../shared/modal.component.js";
import { formatCurrency } from "../../core/utils.js";
import { calculateFinancials } from "../../core/financial.logic.js";
import { el, replace } from "../../core/dom.js";

class SettingsComponent {
  constructor(element) {
    this.element = element;
    this.modal = new ModalComponent();
    this.status = el("div", {
      id: "settings-status",
      style: { marginTop: "20px" },
    });
    this.unsubscribers = [];
    this.render();
    this.unsubscribers.push(
      store.subscribe("openingBalance", this.render.bind(this))
    );
    this.unsubscribers.push(
      store.subscribe("settingsSyncing", this.render.bind(this))
    );
    this.unsubscribers.push(
      store.subscribe("expenses", this.render.bind(this))
    );
    this.unsubscribers.push(
      store.subscribe("accessibilityMode", this.render.bind(this))
    );
  }

  destroy() {
    this.unsubscribers.forEach((sub) => sub.unsubscribe());
    this.unsubscribers = [];
  }

  render() {
    const settingsSyncing = store.getState("settingsSyncing");

    if (settingsSyncing) {
      this.renderSavingState();
      return;
    }

    // Reset status content on re-render to match previous behavior (fresh state)
    this.status.innerHTML = "";

    const currentBalance = store.getState("openingBalance") || 0;
    const expenses = store.getState("expenses") || [];

    // Calculate offset from manual transactions
    const { manualOffset, adjustedOpeningBalance } = calculateFinancials(
      currentBalance,
      expenses
    );

    this.editButton = el(
      "button",
      {
        id: "edit-opening-balance",
        className: "secondary-btn",
        title: "Edit Opening Balance",
        onclick: () => this.handleEdit(),
      },
      "✏️ Edit"
    );

    const container = el(
      "div",
      { className: "section" },
      el("div", { className: "transactions-header" }, el("h2", {}, "Settings")),

      el(
        "div",
        {
          style: {
            marginTop: "30px",
            padding: "20px",
            backgroundColor: "rgba(255, 255, 255, 0.05)",
            borderRadius: "8px",
          },
        },

        // Base Opening Balance
        el(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: "20px",
              borderBottom: "1px solid rgba(255,255,255,0.1)",
              paddingBottom: "15px",
              marginBottom: "15px",
            },
          },
          el(
            "div",
            { style: { flex: "1" } },
            el(
              "div",
              {
                style: {
                  display: "block",
                  color: "#f0ad4e",
                  fontWeight: "bold",
                  marginBottom: "5px",
                  textTransform: "uppercase",
                  fontSize: "0.85em",
                },
              },
              "Base Opening Balance"
            ),
            el(
              "div",
              { style: { fontSize: "1.5em" } },
              `£${formatCurrency(currentBalance)}`
            ),
            el(
              "div",
              { style: { color: "#aaa", fontSize: "0.9em" } },
              "Set manually."
            )
          ),
          this.editButton
        ),

        // Manual Offset
        el(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: "20px",
              marginBottom: "15px",
            },
          },
          el(
            "div",
            { style: { flex: "1" } },
            el(
              "div",
              {
                style: {
                  display: "block",
                  color: "#f0ad4e",
                  fontWeight: "bold",
                  marginBottom: "5px",
                  textTransform: "uppercase",
                  fontSize: "0.85em",
                },
              },
              "Manual Transactions Offset"
            ),
            el(
              "div",
              {
                className: manualOffset >= 0 ? "positive" : "negative",
                style: {
                  fontSize: "1.2em",
                },
              },
              `${manualOffset >= 0 ? "+" : ""}£${formatCurrency(
                Math.abs(manualOffset)
              )}`
            ),
            el(
              "div",
              { style: { color: "#aaa", fontSize: "0.9em" } },
              "Calculated from manually added old transactions."
            )
          )
        ),

        // Effective Start
        el(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: "20px",
              borderTop: "1px solid rgba(255,255,255,0.1)",
              paddingTop: "15px",
            },
          },
          el(
            "div",
            { style: { flex: "1" } },
            el(
              "div",
              {
                style: {
                  display: "block",
                  color: "#fff",
                  fontWeight: "bold",
                  marginBottom: "5px",
                  textTransform: "uppercase",
                  fontSize: "0.85em",
                },
              },
              "Effective Start Balance"
            ),
            el(
              "div",
              { style: { fontSize: "1.5em" } },
              `£${formatCurrency(adjustedOpeningBalance)}`
            ),
            el(
              "div",
              { style: { color: "#aaa", fontSize: "0.9em" } },
              "Actual starting point for calculations."
            )
          )
        )
      ),

      el(
        "div",
        {
          className: "section",
          style: {
            marginTop: "30px",
          },
        },
        el(
          "div",
          { className: "transactions-header" },
          el("h2", {}, "Preferences")
        ),
        el(
          "div",
          {
            style: {
              padding: "20px",
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              gap: "20px",
            },
          },
          el(
            "div",
            { style: { flex: "1" } },
            el(
              "div",
              {
                style: {
                  display: "block",
                  color: "#fff",
                  fontWeight: "bold",
                  marginBottom: "5px",
                },
              },
              "Accessibility Mode"
            ),
            el(
              "div",
              { style: { color: "#aaa", fontSize: "0.9em" } },
              "Add symbols (▲/▼) to positive/negative values for better visibility."
            )
          ),
          el(
            "label",
            { className: "switch" },
            el("input", {
              type: "checkbox",
              checked: store.getState("accessibilityMode"),
              onchange: (e) =>
                store.setState("accessibilityMode", e.target.checked),
            }),
            el("span", { className: "slider" })
          )
        )
      ),

      this.status
    );

    replace(this.element, container);
  }

  renderSavingState() {
    replace(
      this.element,
      el(
        "div",
        {
          className: "section",
          style: {
            height: "400px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
          },
        },
        el("div", {
          className: "loader",
          style: { width: "50px", height: "50px", marginBottom: "20px" },
        }),
        el(
          "h3",
          { style: { color: "#f0ad4e", marginBottom: "10px" } },
          "Saving Settings..."
        ),
        el(
          "p",
          { style: { color: "#fff", fontSize: "1.1em" } },
          "Updating and syncing data."
        )
      )
    );
  }

  async handleEdit() {
    const currentBalance = store.getState("openingBalance") || 0;
    const newBalanceStr = await this.modal.prompt(
      "Enter new Opening Balance (£):",
      currentBalance.toString(),
      "Edit Opening Balance"
    );

    if (newBalanceStr === null) return; // Cancelled

    const newBalance = parseFloat(newBalanceStr);
    if (isNaN(newBalance)) {
      await this.modal.alert("Please enter a valid number.");
      return;
    }

    await this.handleSave(newBalance);
  }

  async handleSave(balance) {
    store.setState("settingsSyncing", true);

    try {
      await ApiService.saveOpeningBalance(balance, { skipLoading: true });

      // Update state locally. No need for full site refresh (dataUploaded)
      // as opening balance is an isolated config value.
      store.setState("openingBalance", balance);
      store.setState("settingsSyncing", false);

      this.displayStatus("Saved successfully!", "success");
    } catch (error) {
      console.error("Settings save failed:", error);
      store.setState("settingsSyncing", false);
      // Re-render ensures UI is ready, and status is stable from constructor
      this.render();
      this.displayStatus(`Error: ${error.message}`, "error");
    }
  }

  displayStatus(message, type) {
    if (this.status) {
      const color = type === "error" ? "#d9534f" : "#5cb85c";
      replace(
        this.status,
        el(
          "div",
          {
            style: {
              color: color,
              padding: "10px",
              background: "rgba(0,0,0,0.2)",
              borderRadius: "4px",
              display: "inline-block",
            },
          },
          message
        )
      );
    }
  }
}

export default SettingsComponent;
