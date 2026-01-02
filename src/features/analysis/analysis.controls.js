import { el, replace } from "../../core/dom.js";

export default class AnalysisControls {
  constructor(element, callbacks) {
    this.element = element;
    this.callbacks = callbacks || {};
    // callbacks: { onTimeframeChange, onStatusChange, onDateChange, onMetricChange, onChartTypeChange, onGroupChange, onPresetClick, onToggleTable, onDownload }
    this.render();
  }

  createOptions(options, selectedValue) {
    return options.map((opt) =>
      el(
        "option",
        { value: opt.value, selected: opt.value === selectedValue },
        opt.label
      )
    );
  }

  render() {
    // 1. Scope Section
    const timeframeSelect = el(
      "select",
      { id: "analysis-timeframe-select", className: "control-input" },
      ...this.createOptions([
        { value: "current_month", label: "Current Month" },
        { value: "past_30_days", label: "Past 30 Days" },
        { value: "past_3_months", label: "Past 3 Months" },
        { value: "past_6_months", label: "Past 6 Months" },
        { value: "past_year", label: "Past Year" },
        { value: "all_time", label: "All Time" },
        { value: "custom", label: "Custom" },
      ])
    );
    timeframeSelect.addEventListener("change", (e) => {
      if (this.callbacks.onTimeframeChange)
        this.callbacks.onTimeframeChange(e.target.value);
    });

    const statusSelect = el(
      "select",
      { id: "analysis-trip-status-select", className: "control-input" },
      ...this.createOptions([
        { value: "All", label: "All" },
        { value: "Active", label: "Active Only" },
        { value: "Completed", label: "Completed Only" },
        { value: "Investment", label: "Investment Only" },
      ])
    );
    statusSelect.addEventListener("change", (e) => {
      if (this.callbacks.onStatusChange)
        this.callbacks.onStatusChange(e.target.value);
    });

    const startDateInput = el("input", {
      type: "date",
      id: "analysis-start-date",
      "aria-label": "Start Date",
      className: "control-input",
    });
    startDateInput.addEventListener("change", (e) => {
      if (this.callbacks.onDateChange)
        this.callbacks.onDateChange("start", e.target.value);
    });

    const endDateInput = el("input", {
      type: "date",
      id: "analysis-end-date",
      "aria-label": "End Date",
      className: "control-input",
    });
    endDateInput.addEventListener("change", (e) => {
      if (this.callbacks.onDateChange)
        this.callbacks.onDateChange("end", e.target.value);
    });

    const scopeSection = el(
      "div",
      { className: "control-section scope-section" },
      el("div", { className: "section-header" }, "1. Scope"),
      el(
        "div",
        { className: "control-row" },
        el(
          "div",
          { className: "control-group" },
          el("label", { for: "analysis-timeframe-select" }, "Timeframe"),
          timeframeSelect
        ),
        el(
          "div",
          { className: "control-group" },
          el("label", { for: "analysis-trip-status-select" }, "Trip Status"),
          statusSelect
        )
      ),
      el(
        "div",
        { className: "control-row dates-row", style: { marginTop: "10px" } },
        startDateInput,
        el("span", { style: { color: "#ccc", alignSelf: "center" } }, "to"),
        endDateInput
      )
    );

    // 2. Presets Section
    const presetButtons = [
      { id: "trip_cost_completed", label: "🏁 Trip Cost (Completed)" },
      { id: "category_breakdown", label: "📊 Category Breakdown" },
      { id: "monthly_trend", label: "📅 Monthly Trend" },
      { id: "active_trip_status", label: "✈️ Active Trip Status" },
    ].map((p) => {
      const btn = el(
        "button",
        { className: "quick-report-btn", dataset: { preset: p.id } },
        p.label
      );
      btn.addEventListener("click", (e) => {
        if (this.callbacks.onPresetClick)
          this.callbacks.onPresetClick(e.target.dataset.preset);
      });
      return btn;
    });

    const presetsSection = el(
      "div",
      { className: "control-section presets-section" },
      el("div", { className: "section-header" }, "2. Quick Views"),
      el("div", { className: "quick-reports-grid" }, ...presetButtons)
    );

    // 3. Customization Section
    const metricSelect = el(
      "select",
      { id: "analysis-metric-select", className: "control-input" },
      ...this.createOptions([
        { value: "balance", label: "Cumulative Balance" },
        { value: "income", label: "Income" },
        { value: "expense", label: "Expenses" },
        { value: "net", label: "Net Income" },
      ])
    );
    metricSelect.addEventListener("change", (e) => {
      if (this.callbacks.onMetricChange)
        this.callbacks.onMetricChange(e.target.value);
    });

    const chartTypeSelect = el(
      "select",
      { id: "analysis-chart-type-select", className: "control-input" },
      ...this.createOptions([
        { value: "bar", label: "Bar" },
        { value: "line", label: "Line" },
        { value: "pie", label: "Pie" },
        { value: "doughnut", label: "Doughnut" },
      ])
    );
    chartTypeSelect.addEventListener("change", (e) => {
      if (this.callbacks.onChartTypeChange)
        this.callbacks.onChartTypeChange(e.target.value);
    });

    const primaryGroupSelect = el(
      "select",
      { id: "analysis-primary-group-select", className: "control-input" },
      ...this.createOptions([
        { value: "date", label: "Date" },
        { value: "category", label: "Category" },
        { value: "trip", label: "Trip/Event" },
      ])
    );
    primaryGroupSelect.addEventListener("change", (e) => {
      if (this.callbacks.onGroupChange)
        this.callbacks.onGroupChange("primary", e.target.value);
    });

    const secondaryGroupSelect = el(
      "select",
      { id: "analysis-secondary-group-select", className: "control-input" },
      ...this.createOptions([
        { value: "none", label: "None" },
        { value: "category", label: "Category" },
        { value: "trip", label: "Trip/Event" },
      ])
    );
    secondaryGroupSelect.addEventListener("change", (e) => {
      if (this.callbacks.onGroupChange)
        this.callbacks.onGroupChange("secondary", e.target.value);
    });

    const timeUnitSelect = el(
      "select",
      { id: "analysis-time-unit-select", className: "control-input" },
      ...this.createOptions([
        { value: "day", label: "Daily" },
        { value: "week", label: "Weekly" },
        { value: "month", label: "Monthly" },
        { value: "year", label: "Yearly" },
      ])
    );
    timeUnitSelect.addEventListener("change", (e) => {
      if (this.callbacks.onGroupChange)
        this.callbacks.onGroupChange("timeUnit", e.target.value);
    });

    const customizationSection = el(
      "div",
      { className: "control-section customization-section" },
      el("div", { className: "section-header" }, "3. Customization"),
      el(
        "div",
        { className: "control-grid" },
        el(
          "div",
          { className: "control-group" },
          el("label", { for: "analysis-metric-select" }, "Metric"),
          metricSelect
        ),
        el(
          "div",
          { className: "control-group" },
          el("label", { for: "analysis-chart-type-select" }, "Chart Type"),
          chartTypeSelect
        ),
        el(
          "div",
          { className: "control-group" },
          el("label", { for: "analysis-primary-group-select" }, "X-Axis Group"),
          primaryGroupSelect
        ),
        el(
          "div",
          { className: "control-group" },
          el(
            "label",
            { for: "analysis-secondary-group-select" },
            "Sub-Group (Stack)"
          ),
          secondaryGroupSelect
        ),
        el(
          "div",
          { className: "control-group", id: "time-unit-container" },
          el("label", { for: "analysis-time-unit-select" }, "Time Unit"),
          timeUnitSelect
        )
      )
    );

    replace(this.element, scopeSection, presetsSection, customizationSection);
  }

  update(state) {
    const setVal = (id, val) => {
      const el = this.element.querySelector(id);
      if (el) el.value = val;
    };

    setVal("#analysis-timeframe-select", state.timeframe);
    setVal("#analysis-trip-status-select", state.tripStatusFilter);
    setVal("#analysis-start-date", state.startDate);
    setVal("#analysis-end-date", state.endDate);
    setVal("#analysis-metric-select", state.metric);

    // Update Chart Type Options based on Metric
    const chartTypeSelect = this.element.querySelector(
      "#analysis-chart-type-select"
    );
    let stateAdjustment = null;
    if (chartTypeSelect) {
      let options = [];
      if (state.metric === "balance") {
        options = [{ value: "line", label: "Line" }];
      } else {
        options = [
          { value: "bar", label: "Bar" },
          { value: "line", label: "Line" },
          { value: "pie", label: "Pie" },
          { value: "doughnut", label: "Doughnut" },
        ];
      }

      // Validate chartType against available options, default to first valid option
      const validValues = options.map((opt) => opt.value);
      const chartTypeValue = validValues.includes(state.chartType)
        ? state.chartType
        : options[0].value;

      // Re-populate options
      chartTypeSelect.innerHTML = "";
      const optionEls = this.createOptions(options, chartTypeValue);
      optionEls.forEach((opt) => chartTypeSelect.appendChild(opt));

      // Store adjusted value if it changed, let caller handle state update
      if (chartTypeValue !== state.chartType) {
        stateAdjustment = { chartType: chartTypeValue };
      }
    }

    setVal("#analysis-primary-group-select", state.primaryGroup);
    setVal("#analysis-secondary-group-select", state.secondaryGroup);
    setVal("#analysis-time-unit-select", state.timeUnit);

    const timeUnitContainer = this.element.querySelector(
      "#time-unit-container"
    );
    if (timeUnitContainer) {
      timeUnitContainer.style.display =
        state.primaryGroup === "date" ? "flex" : "none";
    }

    return stateAdjustment;
  }
}
