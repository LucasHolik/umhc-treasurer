import store from "../../core/state.js";
import SortableTable from "../../shared/sortable-table.component.js";
import { el, replace } from "../../core/dom.js";

export default class TagsAddTrip {
  static NO_TYPE = "__NO_TYPE__";

  constructor(element, callbacks) {
    this.element = element;
    this.callbacks = callbacks; // { onBack, onSave }

    // State
    this.targetTypeName = "";
    this.selectedTrips = new Set(); // Trips selected to be added
    this.typeFilterSet = new Set(); // Types to filter the view by
    this.tripSearchTerm = "";
    this.typeSearchTerm = "";

    // Data
    this.allTrips = []; // List of strings
    this.tripTypeMap = {}; // { tripName: typeName }
    this.allTypes = []; // List of strings

    // UI Components
    this.tableComponent = null;

    // Bindings
    this.render = this.render.bind(this);
  }

  init(targetTypeName) {
    this.targetTypeName = targetTypeName;
    this.selectedTrips.clear();
    this.typeFilterSet.clear();
    this.tripSearchTerm = "";
    this.typeSearchTerm = "";

    this.loadData();
    this.render();
  }

  loadData() {
    const tagsData = store.getState("tags");
    this.allTrips = tagsData["Trip/Event"] || [];
    this.tripTypeMap = tagsData["TripTypeMap"] || {};
    this.allTypes = tagsData["Type"] || [];
  }

  render() {
    const header = el(
      "div",
      {
        className: "transactions-header",
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        },
      },
      el("h2", {}, `Add Trip/Events to "${this.targetTypeName}"`),
      el(
        "button",
        {
          id: "add-trip-back-btn",
          className: "secondary-btn",
          onclick: () => {
            if (this.callbacks.onBack) this.callbacks.onBack();
          },
        },
        "Back"
      )
    );

    // Filter Group
    const typeFilterSearch = el("input", {
      type: "text",
      id: "filter-type-search",
      className: "tag-search-input",
      "aria-label": "Search types",
      placeholder: "Search types...",
      value: this.typeSearchTerm,
    });
    typeFilterSearch.addEventListener("input", (e) => {
      this.typeSearchTerm = e.target.value;
      this.renderFilters();
    });

    const typeFilterList = el("div", {
      id: "type-filter-list",
      className: "tag-selector",
    });

    const filterGroup = el(
      "div",
      { className: "control-group", style: { flexGrow: "1" } },
      el(
        "div",
        {
          className: "control-label",
          style: { fontWeight: "bold", marginBottom: "5px" },
        },
        "Filter by Current Type"
      ),
      el(
        "div",
        { className: "tag-filters-container" },
        el(
          "div",
          { className: "tag-filter-column" },
          el("div", { className: "tag-filter-header" }, "Types"),
          typeFilterSearch,
          typeFilterList
        )
      )
    );

    // Actions
    const saveBtn = el(
      "button",
      {
        id: "add-trip-save-btn",
        className: "action-btn",
        disabled: true,
        onclick: () => this.handleSave(),
      },
      "Add Selected (",
      el("span", { id: "selection-count" }, "0"),
      ")"
    );

    const actionsDiv = el(
      "div",
      {
        className: "transaction-actions",
        style: { alignSelf: "flex-start", marginTop: "22px" },
      },
      saveBtn
    );

    const controlsToolbar = el(
      "div",
      { className: "transaction-controls" },
      filterGroup,
      actionsDiv
    );

    // Table Search
    const tableSearchInput = el("input", {
      type: "text",
      id: "trip-table-search",
      className: "tag-search-input",
      "aria-label": "Search Trip/Events",
      style: {
        width: "100%",
        padding: "12px",
        boxSizing: "border-box",
        fontSize: "1em",
        background: "rgba(0,0,0,0.3)",
        border: "1px solid rgba(255,255,255,0.2)",
      },
      placeholder: "Search Trip/Events...",
      value: this.tripSearchTerm,
    });
    tableSearchInput.addEventListener("input", (e) => {
      this.tripSearchTerm = e.target.value;
      if (this.tableComponent) {
        this.tableComponent.update(this.getFilteredData());
      }
    });

    const tableSearchDiv = el(
      "div",
      { style: { marginBottom: "15px" } },
      tableSearchInput
    );

    const tableContainer = el("div", { id: "add-trip-table-container" });

    const section = el(
      "div",
      { className: "section" },
      header,
      controlsToolbar,
      tableSearchDiv,
      tableContainer
    );

    replace(this.element, section);

    this.renderTable();
    this.renderFilters();
  }

  renderFilters() {
    const container = this.element.querySelector("#type-filter-list");
    if (!container) return;

    const NO_TYPE = TagsAddTrip.NO_TYPE;
    const children = [];

    // 1. No Type Option
    const noTypeUid = `add-trip-type-none`;
    const noTypeCb = el("input", { type: "checkbox", id: noTypeUid });
    noTypeCb.checked = this.typeFilterSet.has(NO_TYPE);
    noTypeCb.addEventListener("change", (e) => {
      if (e.target.checked) this.typeFilterSet.add(NO_TYPE);
      else this.typeFilterSet.delete(NO_TYPE);
      if (this.tableComponent) {
        this.tableComponent.update(this.getFilteredData());
      }
    });

    const noTypeDiv = el(
      "div",
      {
        className: "tag-checkbox-item",
        style: {
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          marginBottom: "5px",
          paddingBottom: "5px",
        },
      },
      noTypeCb,
      el("label", { for: noTypeUid }, el("em", {}, "(No Type)"))
    );
    children.push(noTypeDiv);

    // 2. Type List
    const visibleTypes = this.allTypes
      .filter((t) =>
        t.toLowerCase().includes(this.typeSearchTerm.toLowerCase())
      )
      .sort();

    // Select All Visible
    if (visibleTypes.length > 0) {
      const selectAllUid = "add-trip-type-all-visible";
      const allVisibleSelected = visibleTypes.every((t) =>
        this.typeFilterSet.has(t)
      );

      const selectAllCb = el("input", { type: "checkbox", id: selectAllUid });
      selectAllCb.checked = allVisibleSelected;
      selectAllCb.addEventListener("change", (e) => {
        if (e.target.checked) {
          visibleTypes.forEach((t) => this.typeFilterSet.add(t));
        } else {
          visibleTypes.forEach((t) => this.typeFilterSet.delete(t));
        }
        this.renderFilters(); // Update checkboxes
        if (this.tableComponent) {
          this.tableComponent.update(this.getFilteredData());
        }
      });

      const selectAllDiv = el(
        "div",
        { className: "tag-checkbox-item" },
        selectAllCb,
        el("label", { for: selectAllUid }, el("em", {}, "Select All Visible"))
      );
      children.push(selectAllDiv);
    }

    visibleTypes.forEach((type) => {
      const uid = `filter-type-${btoa(encodeURIComponent(type)).replace(
        /[^a-zA-Z0-9]/g,
        ""
      )}`;
      const isChecked = this.typeFilterSet.has(type);

      const checkbox = el("input", { type: "checkbox", id: uid, value: type });
      checkbox.checked = isChecked;
      checkbox.addEventListener("change", (e) => {
        if (e.target.checked) this.typeFilterSet.add(type);
        else this.typeFilterSet.delete(type);
        if (this.tableComponent) {
          this.tableComponent.update(this.getFilteredData());
        }
      });

      const div = el(
        "div",
        { className: "tag-checkbox-item" },
        checkbox,
        el("label", { for: uid }, type)
      );
      children.push(div);
    });

    replace(container, ...children);
  }

  getFilteredData() {
    let filtered = this.allTrips;

    // Search Filter
    if (this.tripSearchTerm) {
      const term = this.tripSearchTerm.toLowerCase();
      filtered = filtered.filter((trip) => trip.toLowerCase().includes(term));
    }

    // Type Filter
    if (this.typeFilterSet.size > 0) {
      filtered = filtered.filter((trip) => {
        const type = this.tripTypeMap[trip];
        if (!type) return this.typeFilterSet.has(TagsAddTrip.NO_TYPE);
        return this.typeFilterSet.has(type);
      });
    }

    return filtered.map((trip) => ({
      trip: trip,
      type: this.tripTypeMap[trip] || "",
      selected: this.selectedTrips.has(trip),
    }));
  }

  renderTable() {
    const container = this.element.querySelector("#add-trip-table-container");

    this.tableComponent = new SortableTable(container, {
      enableSelection: true,
      rowIdField: "trip",
      columns: [
        { key: "trip", label: "Trip/Event", type: "text", sortable: true },
        { key: "type", label: "Current Type", type: "text", sortable: true },
      ],
      initialSortField: "trip",
      initialSortAsc: true,
      onSelectionChange: (selectedIds) => {
        this.selectedTrips = new Set(selectedIds);
        this.updateSelectionUI();
      },
      // onRowClick is not needed for selection when enableSelection is true
      // If specific row details were needed on click, it would go here
    });

    // Header Select All Logic - handled by SortableTable when enableSelection: true
    // The previous manual event listener is no longer needed here.
    this.tableComponent.update(this.getFilteredData());
    this.updateSelectionUI();
  }

  updateSelectionUI() {
    const countSpan = this.element.querySelector("#selection-count");
    const saveButton = this.element.querySelector("#add-trip-save-btn");
    if (countSpan) {
      countSpan.textContent = this.selectedTrips.size;
    }
    if (saveButton) {
      saveButton.disabled = this.selectedTrips.size === 0;
    }
  }

  handleSave() {
    const selected = Array.from(this.selectedTrips);
    if (selected.length === 0) {
      alert("No trips selected.");
      return;
    }

    if (this.callbacks.onSave) {
      this.callbacks.onSave(selected, this.targetTypeName);
    }
  }
}
