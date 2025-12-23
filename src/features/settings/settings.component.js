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
    this.render();
    store.subscribe("openingBalance", this.render.bind(this));
    store.subscribe("settingsSyncing", this.render.bind(this));
    store.subscribe("expenses", this.render.bind(this));
  }

  render() {
    const settingsSyncing = store.getState("settingsSyncing");

    if (settingsSyncing) {
      this.renderSavingState();
      return;
    }

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

    this.status = el("div", {
      id: "settings-status",
      style: { marginTop: "20px" },
    });

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
                style: {
                  fontSize: "1.2em",
                  color: manualOffset >= 0 ? "#5cb85c" : "#d9534f",
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
          style: {
            marginTop: "30px",
            padding: "20px",
            backgroundColor: "rgba(255, 255, 255, 0.05)",
            borderRadius: "8px",
          },
        },
        el(
          "h3",
          { style: { marginTop: "0", color: "#fff" } },
          "Backup & Restore"
        ),
        el(
          "p",
          {
            style: { color: "#aaa", fontSize: "0.9em", marginBottom: "20px" },
          },
          "Download a full backup of your data or restore from a previous backup file."
        ),
        el(
          "div",
          { style: { display: "flex", gap: "10px", alignItems: "center" } },
          el(
            "button",
            {
              className: "action-btn",
              onclick: () => this.handleBackup(),
            },
            "⬇️ Backup Data"
          ),
          el(
            "div",
            {
              style: {
                position: "relative",
                overflow: "hidden",
                display: "inline-block",
              },
            },
            el(
              "button",
              { className: "action-btn secondary-btn" },
              "⬆️ Restore Data"
            ),
            el("input", {
              type: "file",
              accept: ".json",
              style: {
                position: "absolute",
                top: 0,
                left: 0,
                opacity: 0,
                width: "100%",
                height: "100%",
                cursor: "pointer",
              },
              onchange: (e) => this.handleRestore(e),
            })
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

    this.handleSave(newBalance);
  }

  async handleSave(balance) {
    store.setState("settingsSyncing", true);

    try {
      await ApiService.saveOpeningBalance(balance, { skipLoading: true });
      store.setState("openingBalance", balance); // Optimistic update before reload

      // Trigger full site refresh logic
      document.dispatchEvent(new CustomEvent("dataUploaded"));

      // We turn off the syncing state, but the global loader (from App.js responding to dataUploaded)
      // will likely take over immediately.
      store.setState("settingsSyncing", false);
    } catch (error) {
      console.error("Settings save failed:", error);
      store.setState("settingsSyncing", false);
      // We need to re-render to show the error since we turned off the loading state
      this.render();
      // Use setTimeout to ensure DOM is ready after re-render
      setTimeout(
        () => this.displayStatus(`Error: ${error.message}`, "error"),
        0
      );
    }
  }

  async handleBackup() {
    try {
      store.setState("isLoading", true);
      const result = await ApiService.getAppData();
      store.setState("isLoading", false);

      if (result.success) {
        const dataStr =
          "data:text/json;charset=utf-8," +
          encodeURIComponent(JSON.stringify(result.data, null, 2));
        const downloadAnchorNode = document.createElement("a");
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute(
          "download",
          "umhc_treasurer_backup_" +
            new Date().toISOString().slice(0, 10) +
            ".json"
        );
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        this.displayStatus("Backup downloaded successfully.", "success");
      } else {
        this.displayStatus(
          "Failed to fetch data for backup: " + result.message,
          "error"
        );
      }
    } catch (e) {
      store.setState("isLoading", false);
      this.displayStatus("Backup failed: " + e.message, "error");
    }
  }

  handleRestore(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const json = JSON.parse(e.target.result);
        const confirmed = await this.modal.confirm(
          "WARNING: This will overwrite ALL current data (Expenses, Tags, Splits, Balance) with the data from the backup file. This cannot be undone.\n\nAre you sure you want to proceed?",
          "Restore Data"
        );

        if (confirmed) {
          // Reset file input
          event.target.value = "";

          const result = await ApiService.restoreAppData(json);
          if (result.success) {
            await this.modal.alert("Restore completed successfully. The page will now reload.");
            window.location.reload();
          } else {
            await this.modal.alert("Restore failed: " + result.message);
          }
        } else {
            event.target.value = ""; // Clear if cancelled
        }
      } catch (err) {
        console.error(err);
        await this.modal.alert("Invalid backup file format.");
        event.target.value = "";
      }
    };
    reader.readAsText(file);
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
