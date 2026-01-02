import { formatCurrency } from "../../core/utils.js";
import ModalComponent from "../../shared/modal.component.js";
import SortableTable from "../../shared/sortable-table.component.js";
import TagSelector from "../../shared/tag-selector.component.js";
import { el, replace } from "../../core/dom.js";

export default class TagsList {
  constructor(element, callbacks) {
    this.element = element;
    this.callbacks = callbacks || {};
    // callbacks: { onEditModeToggle, onSave, onTagClick, onTagAdd, onTagDelete, onTagRename, onUpdateTripType, onUpdateTripStatus, onTimeframeChange }

    // Local state for filtering within the list view
    this.searchTerms = {
      "Trip/Event": "",
      Category: "",
      Type: "",
    };
    this.activeTab = "Type"; // Default tab
    this.modal = new ModalComponent();
    this.tagSelector = new TagSelector();

    // Table instances
    this.tables = {};

    // Global delegation for interactive clicks inside this component
    this.element.addEventListener("click", (e) =>
      this.handleInteractiveClick(e)
    );

    this.element.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        // Only trigger if the target is interactive
        const target = e.target;
        if (
          target.classList.contains("tag-pill") ||
          target.classList.contains("add-tag-placeholder") ||
          target.classList.contains("remove-btn") ||
          target.classList.contains("status-toggle-btn")
        ) {
          e.preventDefault();
          this.handleInteractiveClick(e);
        }
      }
    });
  }

  render(
    isEditMode,
    localTags,
    queue,
    stats,
    tripTypeMap,
    tripStatusMap,
    timeframe,
    tagsData
  ) {
    this.isEditMode = isEditMode;
    this.localTags = localTags;
    this.queue = queue;
    this.stats = stats;
    this.tripTypeMap = tripTypeMap;
    this.tripStatusMap = tripStatusMap;
    this.timeframe = timeframe;
    this.tagsData = tagsData; // Used for type selector options and initial completed list

    let actionButtons = [];
    if (this.isEditMode) {
      actionButtons.push(
        el(
          "button",
          {
            id: "cancel-tags-btn",
            className: "secondary-btn",
            style: {
              borderColor: "#d9534f",
              color: "#d9534f",
              marginRight: "10px",
            },
            onclick: () => this.callbacks.onEditModeToggle(false),
          },
          "Cancel"
        ),
        el(
          "button",
          {
            id: "save-tags-btn",
            className: "action-btn",
            onclick: () => this.callbacks.onSave(),
          },
          "Save Changes"
        )
      );
    } else if (this.queue && this.queue.length > 0) {
      actionButtons.push(
        el(
          "button",
          {
            id: "save-tags-btn",
            className: "action-btn",
            onclick: () => this.callbacks.onSave(),
          },
          `Save Changes (${this.queue.length})`
        )
      );
    } else {
      actionButtons.push(
        el(
          "button",
          {
            id: "edit-tags-btn",
            className: "secondary-btn",
            onclick: () => this.callbacks.onEditModeToggle(true),
          },
          "Edit Tags"
        )
      );
    }

    // Define Tabs
    const tabs = [
      { id: "Type", label: "Trip Types" },
      { id: "Trip/Event", label: "Trip/Event Tags" },
      { id: "Category", label: "Category Tags" },
    ];

    const tabsContainer = el(
      "div",
      {
        className: "tags-tabs-container",
        style: {
          display: "flex",
          gap: "10px",
          borderBottom: "1px solid #444",
          marginBottom: "20px",
        },
      },
      ...tabs.map((tab) =>
        el(
          "button",
          {
            className: `tab-btn ${this.activeTab === tab.id ? "active" : ""}`,
            dataset: { tab: tab.id },
          },
          tab.label
        )
      )
    );

    // Timeframe Selector options
    const timeframeOptions = [
      { value: "current_month", label: "Current Month" },
      { value: "past_30_days", label: "Past 30 Days" },
      { value: "past_3_months", label: "Past 3 Months" },
      { value: "past_6_months", label: "Past 6 Months" },
      { value: "past_year", label: "Past Year" },
      { value: "all_time", label: "All Time" },
    ];

    const timeframeSelect = el(
      "select",
      { id: "tag-timeframe-select", "aria-label": "Timeframe" },
      ...timeframeOptions.map((opt) =>
        el(
          "option",
          { value: opt.value, selected: this.timeframe === opt.value },
          opt.label
        )
      )
    );
    timeframeSelect.addEventListener("change", (e) => {
      if (this.callbacks.onTimeframeChange) {
        this.callbacks.onTimeframeChange(e.target.value);
      }
    });

    // Search Input
    const searchInput = el("input", {
      type: "text",
      id: "search-tag",
      name: "search-tag",
      "aria-label": "Search Tags",
      className: "tag-search-input column-search",
      style: { flex: "1" },
      dataset: { type: this.activeTab },
      placeholder: `Search ${this.activeTab}...`,
      value: this.searchTerms[this.activeTab] || "",
    });
    searchInput.addEventListener("input", (e) => {
      const type = e.target.dataset.type;
      this.searchTerms[type] = e.target.value;
      this.renderActiveTable(); // Only re-render the table content
    });

    const activeTabContent = el(
      "div",
      { id: "active-tab-content" },
      el(
        "div",
        { style: { marginBottom: "10px", display: "flex", gap: "10px" } },
        searchInput,
        this.isEditMode
          ? el(
              "button",
              {
                className: "secondary-btn add-tag-icon-btn",
                dataset: { type: this.activeTab },
                style: {
                  width: "38px",
                  padding: "0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.2em",
                },
                title: `Add new ${this.activeTab}`,
                onclick: async (e) => {
                  try {
                    const type = e.currentTarget.dataset.type;
                    const value = await this.modal.prompt(
                      `Enter new name for ${type} tag:`,
                      "",
                      "Add Tag"
                    );
                    if (value && value.trim() !== "") {
                      if (this.callbacks.onTagAdd)
                        this.callbacks.onTagAdd(type, value.trim());
                    }
                  } catch (err) {
                    console.error("Failed to add tag:", err);
                  }
                },
              },
              "+"
            )
          : null
      ),
      el("div", { id: "tags-table-container" })
    );

    const section = el(
      "div",
      { className: "section" },
      el(
        "div",
        {
          className: "tags-header-actions",
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "15px",
          },
        },
        el("h2", {}, "Manage Tags"),
        el(
          "div",
          { className: "header-controls-group" },
          el(
            "div",
            { className: "header-sort-controls" },
            el(
              "div",
              { className: "timeframe-selector" },
              el("label", { for: "tag-timeframe-select" }, "Timeframe: "),
              timeframeSelect
            )
          ),
          el("div", { className: "actions" }, ...actionButtons)
        )
      ),
      tabsContainer,
      el("div", { className: "tags-container" }, activeTabContent)
    );

    replace(this.element, section);
    this.renderActiveTable();
  }

  renderActiveTable() {
    const type = this.activeTab;
    const container = this.element.querySelector(`#tags-table-container`);
    if (!container) return;

    // Determine source of tag list (edit mode vs normal)
    const tagsSource = this.isEditMode ? this.localTags : this.tagsData;
    const tagsList = tagsSource && tagsSource[type] ? tagsSource[type] : [];

    // Use virtual tripStatusMap which includes queued changes
    const tripStatusMap = this.tripStatusMap || {};

    const searchTerm = this.searchTerms[type] || "";

    let visibleTags = tagsList.filter((tag) =>
      tag.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const data = visibleTags.map((tag) => {
      const tagStats = this.stats?.[type]?.[tag] || {
        count: 0,
        income: 0,
        expense: 0,
      };
      const net = tagStats.income - tagStats.expense;

      let row = {
        tag: tag,
        type: type, // for actions
        income: tagStats.income,
        expense: tagStats.expense,
        net: net,
        count: tagStats.count,
      };

      if (type === "Trip/Event") {
        row.tripType = this.tripTypeMap[tag] || "";
        row.status = tripStatusMap[tag] || "Active";
      }

      return row;
    });

    const columns = [{ key: "tag", label: "Name", type: "text" }];

    if (type === "Trip/Event") {
      // Status Column
      const statusLabel = el(
        "span",
        {},
        "Status ",
        el(
          "span",
          {
            className: "info-icon no-sort",
            title: "What do these mean?",
            style: { cursor: "help", fontSize: "0.8em" },
          },
          "ℹ️"
        )
      );

      columns.push({
        key: "status",
        label: statusLabel,
        type: "custom",
        class: "text-center",
        render: (item) => {
          const status = item.status || "Active";
          const styles = {
            Active: { icon: "◯", color: "#888", title: "Active" },
            Completed: { icon: "✅", color: "#5cb85c", title: "Completed" },
            Investment: { icon: "🚀", color: "#5bc0de", title: "Investment" },
          };
          const s = styles[status] || styles["Active"];

          const span = el(
            "span",
            {
              className: "status-toggle-btn",
              style: {
                color: s.color,
                fontWeight: "bold",
                fontSize: "1.2em",
                cursor: this.isEditMode ? "not-allowed" : "pointer",
                opacity: this.isEditMode ? "0.7" : "1",
              },
              title: this.isEditMode ? s.title : `${s.title} - Click to cycle`,
              dataset: { tag: item.tag, status: status },
              tabIndex: this.isEditMode ? "-1" : "0",
              role: "button",
            },
            s.icon
          );

          return span;
        },
      });

      columns.push({
        key: "tripType",
        label: "Type",
        type: "custom",
        render: (item) => {
          let content;
          if (item.tripType) {
            content = el(
              "span",
              {
                className: "tag-pill",
                dataset: { tag: item.tag, type: "Type" },
                tabIndex: this.isEditMode ? "-1" : "0",
                role: "button",
                style: {
                  opacity: this.isEditMode ? "0.7" : "1",
                  cursor: this.isEditMode ? "not-allowed" : "pointer",
                },
              },
              el("span", { className: "tag-text" }, item.tripType),
              el(
                "span",
                {
                  className: "remove-btn",
                  title: "Remove Type",
                  tabIndex: this.isEditMode ? "-1" : "0",
                  role: "button",
                  style: {
                    cursor: this.isEditMode ? "not-allowed" : "pointer",
                  },
                },
                "×"
              )
            );
          } else {
            content = el(
              "span",
              {
                className: "add-tag-placeholder",
                dataset: { tag: item.tag, type: "Type" },
                title: "Add Type",
                tabIndex: this.isEditMode ? "-1" : "0",
                role: "button",
                style: {
                  opacity: this.isEditMode ? "0.7" : "1",
                  cursor: this.isEditMode ? "not-allowed" : "pointer",
                },
              },
              "+"
            );
          }

          return content;
        },
      });
    }

    columns.push(
      {
        key: "income",
        label: "Income",
        type: "currency",
        class: "positive tags-table-num text-right",
      },
      {
        key: "expense",
        label: "Expense",
        type: "currency",
        class: "negative tags-table-num text-right",
      },
      {
        key: "net",
        label: "Net",
        type: "currency",
        class: "tags-table-num text-right",
        render: (item) => {
          const span = el("span", {});
          if (item.net > 0) span.className = "positive";
          else if (item.net < 0) span.className = "negative";
          span.textContent = formatCurrency(Math.abs(item.net));
          return span;
        },
      },
      { key: "count", label: "Uses", type: "number", class: "text-center" }
    );

    if (this.isEditMode) {
      columns.push({
        key: "actions",
        label: "Actions",
        type: "custom",
        sortable: false,
        class: "text-right tags-actions-cell",
        render: (item) => {
          const div = el(
            "div",
            {},
            el(
              "button",
              {
                className: "icon-btn rename-btn",
                title: "Rename",
                onclick: (e) => {
                  e.stopPropagation();
                  if (this.callbacks.onTagRename)
                    this.callbacks.onTagRename(item.type, item.tag);
                },
              },
              "✏️"
            ),
            document.createTextNode(" "),
            el(
              "button",
              {
                className: "icon-btn delete-btn",
                title: "Delete",
                onclick: (e) => {
                  e.stopPropagation();
                  if (this.callbacks.onTagDelete)
                    this.callbacks.onTagDelete(item.type, item.tag);
                },
              },
              "🗑️"
            )
          );
          return div;
        },
      });
    }

    let initialSortField = "tag";
    let initialSortAsc = true;

    // Preserve sort state if table already exists
    if (this.tables[type]) {
      initialSortField = this.tables[type].sortField;
      initialSortAsc = this.tables[type].sortAsc;
    }

    const table = new SortableTable(container, {
      columns: columns,
      initialSortField: initialSortField,
      initialSortAsc: initialSortAsc,
      onRowClick: (item, event) => {
        // Check if the click originated from an interactive element within the row
        const target = event.target;
        const isInteractiveElement =
          target.classList.contains("add-tag-placeholder") ||
          target.closest(".tag-pill") ||
          target.classList.contains("remove-btn") ||
          target.classList.contains("status-toggle-btn");

        if (
          !isInteractiveElement &&
          !this.isEditMode &&
          this.callbacks.onTagClick
        ) {
          this.callbacks.onTagClick(type, item.tag);
        }
      },
    });
    table.update(data);

    // Store reference for potential future updates
    this.tables[type] = table;
  }

  handleInteractiveClick(e) {
    const target = e.target;

    // Status Info Icon
    if (target.classList.contains("info-icon")) {
      e.stopPropagation();
      const message = el(
        "div",
        { style: { textAlign: "left" } },
        el("p", {}, el("strong", {}, "Status Meanings:")),
        el(
          "ul",
          { style: { listStyle: "none", paddingLeft: "0" } },
          el(
            "li",
            { style: { marginBottom: "8px" } },
            el(
              "span",
              {
                style: { color: "#888", fontWeight: "bold", fontSize: "1.2em" },
              },
              "◯"
            ),
            el("strong", {}, " Active:"),
            " The trip or event is currently being planned or is in progress."
          ),
          el(
            "li",
            { style: { marginBottom: "8px" } },
            el(
              "span",
              {
                style: {
                  color: "#5cb85c",
                  fontWeight: "bold",
                  fontSize: "1.2em",
                },
              },
              "✅"
            ),
            el("strong", {}, " Completed:"),
            " The trip is finished and all expenses are finalized."
          ),
          el(
            "li",
            { style: { marginBottom: "8px" } },
            el(
              "span",
              {
                style: {
                  color: "#5bc0de",
                  fontWeight: "bold",
                  fontSize: "1.2em",
                },
              },
              "🚀"
            ),
            el("strong", {}, " Investment:"),
            " This tag tracks a long-term investment or asset, not a regular trip."
          )
        ),
        el(
          "p",
          {},
          el(
            "em",
            {},
            "Click the status icon to cycle through these options (not available in Edit Mode)."
          )
        )
      );

      this.modal.alert(message, "Trip/Event Status Legend");
      return;
    }

    // Tab Switching
    if (target.classList.contains("tab-btn")) {
      this.activeTab = target.dataset.tab;
      this.render(
        this.isEditMode,
        this.localTags,
        this.queue,
        this.stats,
        this.tripTypeMap,
        this.tripStatusMap,
        this.timeframe,
        this.tagsData
      );
      return;
    }

    // Toggle Status
    if (target.classList.contains("status-toggle-btn") && !this.isEditMode) {
      e.stopPropagation();
      const tag = target.dataset.tag;
      const currentStatus = target.dataset.status;
      const nextStatus =
        {
          Active: "Completed",
          Completed: "Investment",
          Investment: "Active",
        }[currentStatus] || "Active";

      if (this.callbacks.onUpdateTripStatus) {
        this.callbacks.onUpdateTripStatus(tag, nextStatus);
      }
      return;
    }

    // Remove Tag
    if (target.classList.contains("remove-btn")) {
      e.stopPropagation();
      if (this.isEditMode) return;
      const pill = target.closest(".tag-pill");
      if (!pill) return;
      const tag = pill.dataset.tag;
      if (this.callbacks.onUpdateTripType) {
        this.callbacks.onUpdateTripType(tag, ""); // Clear type
      }
      return;
    }

    // Add Tag (+)
    if (target.classList.contains("add-tag-placeholder")) {
      e.stopPropagation();
      if (this.isEditMode) return;
      const tag = target.dataset.tag;
      // Show selector
      const typeOptions = this.tagsData["Type"] || [];
      this.tagSelector.show(
        target.getBoundingClientRect(),
        "Type",
        "",
        (newType) => {
          if (this.callbacks.onUpdateTripType)
            this.callbacks.onUpdateTripType(tag, newType);
        },
        typeOptions
      );
      return;
    }

    // Edit Tag (Click pill body)
    const pill = target.closest(".tag-pill");
    if (pill) {
      e.stopPropagation();
      if (this.isEditMode) return;
      const tag = pill.dataset.tag;
      const tagTextEl = pill.querySelector(".tag-text");
      if (!tagTextEl) return;
      const currentVal = tagTextEl.textContent;
      const typeOptions = this.tagsData["Type"] || [];
      this.tagSelector.show(
        pill.getBoundingClientRect(),
        "Type",
        currentVal,
        (newType) => {
          if (this.callbacks.onUpdateTripType)
            this.callbacks.onUpdateTripType(tag, newType);
        },
        typeOptions
      );
    }
  }
}
