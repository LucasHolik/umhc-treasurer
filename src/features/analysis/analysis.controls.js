export default class AnalysisControls {
  constructor(element, callbacks) {
    this.element = element;
    this.callbacks = callbacks || {};
    // callbacks: { onTimeframeChange, onStatusChange, onDateChange, onMetricChange, onChartTypeChange, onGroupChange, onPresetClick, onToggleTable, onDownload }
    this.render();
    this.bindEvents();
  }

  render() {
    this.element.innerHTML = `
            <!-- Section 1: Scope (Time & Status) -->
            <div class="control-section scope-section">
                <div class="section-header">1. Scope</div>
                <div class="control-row">
                    <div class="control-group">
                        <label for="analysis-timeframe-select">Timeframe</label>
                        <select id="analysis-timeframe-select" class="control-input">
                            <option value="current_month">Current Month</option>
                            <option value="past_30_days">Past 30 Days</option>
                            <option value="past_3_months">Past 3 Months</option>
                            <option value="past_6_months">Past 6 Months</option>
                            <option value="past_year">Past Year</option>
                            <option value="all_time">All Time</option>
                            <option value="custom">Custom</option>
                        </select>
                    </div>
                    <div class="control-group">
                        <label for="analysis-trip-status-select">Trip Status</label>
                        <select id="analysis-trip-status-select" class="control-input">
                            <option value="All">All</option>
                            <option value="Active">Active Only</option>
                            <option value="Completed">Completed Only</option>
                            <option value="Investment">Investment Only</option>
                        </select>
                    </div>
                </div>
                <div class="control-row dates-row" style="margin-top: 10px;">
                     <input type="date" id="analysis-start-date" aria-label="Start Date" class="control-input">
                     <span style="color: #ccc; align-self: center;">to</span>
                     <input type="date" id="analysis-end-date" aria-label="End Date" class="control-input">
                </div>
            </div>

            <!-- Section 2: View (Presets) -->
            <div class="control-section presets-section">
                <div class="section-header">2. Quick Views</div>
                <div class="quick-reports-grid">
                    <button class="quick-report-btn" data-preset="trip_cost_completed">🏁 Trip Cost (Completed)</button>
                    <button class="quick-report-btn" data-preset="category_breakdown">📊 Category Breakdown</button>
                    <button class="quick-report-btn" data-preset="monthly_trend">📅 Monthly Trend</button>
                    <button class="quick-report-btn" data-preset="active_trip_status">✈️ Active Trip Status</button>
                </div>
            </div>

            <!-- Section 3: Customization -->
            <div class="control-section customization-section">
                <div class="section-header">3. Customization</div>
                <div class="control-grid">
                    
                    <!-- Visualization -->
                    <div class="control-group">
                        <label for="analysis-metric-select">Metric</label>
                        <select id="analysis-metric-select" class="control-input">
                            <option value="balance">Cumulative Balance</option>
                            <option value="income">Income</option>
                            <option value="expense">Expenses</option>
                            <option value="net">Net Income</option>
                        </select>
                    </div>

                     <div class="control-group">
                        <label for="analysis-chart-type-select">Chart Type</label>
                        <select id="analysis-chart-type-select" class="control-input">
                            <option value="bar">Bar</option>
                            <option value="line">Line</option>
                            <option value="pie">Pie</option>
                            <option value="doughnut">Doughnut</option>
                        </select>
                    </div>

                    <!-- Grouping -->
                    <div class="control-group">
                        <label for="analysis-primary-group-select">X-Axis Group</label>
                        <select id="analysis-primary-group-select" class="control-input">
                            <option value="date">Date</option>
                            <option value="category">Category</option>
                            <option value="trip">Trip/Event</option>
                        </select>
                    </div>

                    <div class="control-group">
                        <label for="analysis-secondary-group-select">Sub-Group (Stack)</label>
                        <select id="analysis-secondary-group-select" class="control-input">
                            <option value="none">None</option>
                            <option value="category">Category</option>
                            <option value="trip">Trip/Event</option>
                        </select>
                    </div>

                    <div class="control-group" id="time-unit-container">
                        <label for="analysis-time-unit-select">Time Unit</label>
                        <select id="analysis-time-unit-select" class="control-input">
                            <option value="day">Daily</option>
                            <option value="week">Weekly</option>
                            <option value="month">Monthly</option>
                            <option value="year">Yearly</option>
                        </select>
                    </div>

                </div>
            </div>
        `;
  }

  bindEvents() {
    this.element
      .querySelector("#analysis-timeframe-select")
      .addEventListener("change", (e) => {
        if (this.callbacks.onTimeframeChange)
          this.callbacks.onTimeframeChange(e.target.value);
      });

    this.element
      .querySelector("#analysis-trip-status-select")
      .addEventListener("change", (e) => {
        if (this.callbacks.onStatusChange)
          this.callbacks.onStatusChange(e.target.value);
      });

    this.element
      .querySelector("#analysis-start-date")
      .addEventListener("change", (e) => {
        if (this.callbacks.onDateChange)
          this.callbacks.onDateChange("start", e.target.value);
      });

    this.element
      .querySelector("#analysis-end-date")
      .addEventListener("change", (e) => {
        if (this.callbacks.onDateChange)
          this.callbacks.onDateChange("end", e.target.value);
      });

    this.element
      .querySelector("#analysis-metric-select")
      .addEventListener("change", (e) => {
        if (this.callbacks.onMetricChange)
          this.callbacks.onMetricChange(e.target.value);
      });

    this.element
      .querySelector("#analysis-chart-type-select")
      .addEventListener("change", (e) => {
        if (this.callbacks.onChartTypeChange)
          this.callbacks.onChartTypeChange(e.target.value);
      });

    const primarySelect = this.element.querySelector(
      "#analysis-primary-group-select"
    );
    const secondarySelect = this.element.querySelector(
      "#analysis-secondary-group-select"
    );
    const timeUnitSelect = this.element.querySelector(
      "#analysis-time-unit-select"
    );

    primarySelect.addEventListener("change", (e) => {
      if (this.callbacks.onGroupChange)
        this.callbacks.onGroupChange("primary", e.target.value);
    });

    secondarySelect.addEventListener("change", (e) => {
      if (this.callbacks.onGroupChange)
        this.callbacks.onGroupChange("secondary", e.target.value);
    });

    timeUnitSelect.addEventListener("change", (e) => {
      if (this.callbacks.onGroupChange)
        this.callbacks.onGroupChange("timeUnit", e.target.value);
    });

    this.element.querySelectorAll(".quick-report-btn").forEach((button) => {
      button.addEventListener("click", (e) => {
        if (this.callbacks.onPresetClick)
          this.callbacks.onPresetClick(e.target.dataset.preset);
      });
    });
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
    setVal("#analysis-chart-type-select", state.chartType);
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
  }
}
