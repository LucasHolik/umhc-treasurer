import store from "../../core/state.js";
import { formatCurrency } from "../../core/utils.js";
import ModalComponent from "../../shared/modal.component.js";
import AnalysisLogic from "./analysis.logic.js";
import { calculateFinancials } from "../../core/financial.logic.js";

import AnalysisControls from "./analysis.controls.js";
import AnalysisFilters from "./analysis.filters.js";
import AnalysisChart from "./analysis.chart.js";
import AnalysisTable from "./analysis.table.js";

class AnalysisComponent {
  constructor(element) {
    this.element = element;
    this.modal = new ModalComponent();
    this.analysisLogic = AnalysisLogic;

    // Default State
    this.state = {
      timeframe: "past_30_days",
      startDate: "",
      endDate: "",
      tripStatusFilter: "All", // 'All', 'Active', 'Completed', 'Investment'

      // Split Tag Filters
      selectedCategories: new Set(),
      selectedTrips: new Set(),
      // selectedTypes is derived from selectedTrips

      categorySearchTerm: "",
      tripSearchTerm: "",
      typeSearchTerm: "",

      metric: "balance", // income, expense, net, balance
      chartType: "bar",
      primaryGroup: "date",
      secondaryGroup: "none",
      timeUnit: "day",

      // Summary Statistics
      summaryStats: {
        totalIncome: 0,
        totalExpense: 0,
        netChange: 0,
        transactionCount: 0,
        effectiveBalance: 0,
      },
      showDataTable: false,
    };

    this.render();

    store.subscribe("expenses", () => {
      this.updateTagSelectors();
      this.generateChart();
    });
    store.subscribe("tags", () => this.updateTagSelectors());
  }

  render() {
    // Initialize dates if needed (on first render)
    if (this.state.timeframe !== "custom" && !this.state.startDate) {
      const expenses = store.getState("expenses") || [];
      const range = this.analysisLogic.calculateDateRange(
        this.state.timeframe,
        expenses
      );
      if (range) {
        this.state.startDate = range.start.toISOString().split("T")[0];
        this.state.endDate = range.end.toISOString().split("T")[0];
      }
    }

    this.element.innerHTML = `
      <link rel="stylesheet" href="src/features/analysis/analysis.css">
      <div class="analysis-container">
        <div class="header-section">
            <h2>Financial Analysis</h2>
            <p>Generate custom reports and visualize your treasury data.</p>
        </div>

        <!-- Summary Cards -->
        <div class="summary-cards-container" id="analysis-summary-cards">
            <!-- Populated by updateStatsDOM -->
        </div>

        <!-- Main Control Panel -->
        <div class="main-control-panel" id="analysis-controls-container"></div>
        
        <!-- Tag Filters -->
        <div class="control-section tag-filters-section" id="analysis-filters-container"></div>

        <!-- Action Bar -->
        <div class="analysis-actions-bar" id="analysis-actions-bar">
            <button id="btn-toggle-view" class="btn-action">Show Data Table</button>
            <button id="btn-download-image" class="btn-action">Download Image</button>
            <button id="btn-download-data" class="btn-action" style="display: none;">Download Data (CSV)</button>
        </div>

        <div class="chart-container" id="analysis-chart-container">
            <canvas id="analysis-chart"></canvas>
        </div>

        <div id="analysis-data-table-container" style="display: none;"></div>
      </div>
    `;

    // Initialize Sub-components
    this.initializeSubComponents();
    this.initializeActionButtons();

    // Initial Updates
    this.updateStatsDOM();
    setTimeout(() => this.updateTagSelectors(), 0);
    setTimeout(() => this.generateChart(), 0);
  }

  initializeSubComponents() {
    // 1. Controls
    this.controlsComponent = new AnalysisControls(
      this.element.querySelector("#analysis-controls-container"),
      {
        onTimeframeChange: (val) => this.handleTimeframeChange(val),
        onStatusChange: (val) => {
          this.state.tripStatusFilter = val;
          this.updateTagSelectors();
          this.generateChart();
        },
        onDateChange: (type, val) => {
          if (type === "start") this.state.startDate = val;
          else this.state.endDate = val;
          this.state.timeframe = "custom";
          this.controlsComponent.update(this.state);
          this.generateChart();
        },
        onMetricChange: (val) => {
          this.state.metric = val;
          this.generateChart();
        },
        onChartTypeChange: (val) => {
          this.state.chartType = val;
          this.generateChart();
        },
        onGroupChange: (type, val) => this.handleGroupChange(type, val),
        onPresetClick: (preset) => this.applyPreset(preset),
      }
    );
    this.controlsComponent.update(this.state);

    // 2. Filters
    this.filtersComponent = new AnalysisFilters(
      this.element.querySelector("#analysis-filters-container"),
      {
        onFilterChange: () => {
          this.generateChart();
          this.updateTagSelectors();
        },
        onSearchChange: (type, term) => {
          if (type === "Category") {
            this.state.categorySearchTerm = term.toLowerCase();
          } else if (type === "Type") {
            this.state.typeSearchTerm = term.toLowerCase();
          } else {
            this.state.tripSearchTerm = term.toLowerCase();
          }
          this.updateTagSelectors();
        },
        onTypeChange: (typeTag, isChecked) => {
          this.handleTypeChange(typeTag, isChecked);
        },
      }
    );

    // 3. Chart
    this.chartComponent = new AnalysisChart(
      this.element.querySelector("#analysis-chart")
    );

    // 4. Table
    this.tableComponent = new AnalysisTable(
      this.element.querySelector("#analysis-data-table-container")
    );
  }

  initializeActionButtons() {
    this.element
      .querySelector("#btn-toggle-view")
      .addEventListener("click", () => {
        this.state.showDataTable = !this.state.showDataTable;
        this.updateViewVisibility();
      });

    this.element
      .querySelector("#btn-download-image")
      .addEventListener("click", () => {
        if (this.chartComponent) {
          const base64 = this.chartComponent.toBase64Image();
          if (base64) {
            const link = document.createElement("a");
            link.download = `analysis-chart-${
              new Date().toISOString().split("T")[0]
            }.png`;
            link.href = base64;
            link.click();
          } else {
            alert("Chart not ready.");
          }
        }
      });

    this.element
      .querySelector("#btn-download-data")
      .addEventListener("click", () => {
        if (this.chartData) {
          const csvContent = this.analysisLogic.generateCSV(
            this.chartData.labels,
            this.chartData.datasets,
            {
              primaryGroup: this.state.primaryGroup,
              secondaryGroup: this.state.secondaryGroup,
              metric: this.state.metric,
              timeUnit: this.state.timeUnit,
            }
          );
          const blob = new Blob([csvContent], {
            type: "text/csv;charset=utf-8;",
          });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.setAttribute("href", url);
          link.setAttribute(
            "download",
            `analysis-data-${new Date().toISOString().split("T")[0]}.csv`
          );
          link.style.visibility = "hidden";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } else {
          alert("No data available to download.");
        }
      });
  }

  handleTypeChange(typeTag, isChecked) {
    // Find associated Trips and update Trip Selection
    const tags = store.getState("tags") || {};
    const tripTypeMap = tags.TripTypeMap || {};
    const tripStatusMap = tags.TripStatusMap || {};
    const allTrips = tags["Trip/Event"] || [];

    // Filter Trips based on Scope (same logic as updateTagSelectors)
    const visibleTrips = this.analysisLogic.getVisibleTrips(
      allTrips,
      tripStatusMap,
      this.state.tripStatusFilter
    );

    const tripsToUpdate = visibleTrips.filter(
      (trip) => tripTypeMap[trip] === typeTag
    );

    tripsToUpdate.forEach((trip) => {
      if (isChecked) {
        this.state.selectedTrips.add(trip);
      } else {
        this.state.selectedTrips.delete(trip);
      }
    });

    // Update UI is handled by onFilterChange callback
  }

  handleTimeframeChange(newTimeframe) {
    this.state.timeframe = newTimeframe;
    if (newTimeframe !== "custom") {
      const expenses = store.getState("expenses") || [];
      const range = this.analysisLogic.calculateDateRange(
        newTimeframe,
        expenses
      );
      if (range) {
        this.state.startDate = range.start.toISOString().split("T")[0];
        this.state.endDate = range.end.toISOString().split("T")[0];
      }
    }
    this.controlsComponent.update(this.state);
    this.generateChart();
  }

  handleGroupChange(type, val) {
    if (type === "primary") {
      this.state.primaryGroup = val;
      if (this.state.primaryGroup === this.state.secondaryGroup) {
        this.state.secondaryGroup = "none";
      }
    } else if (type === "secondary") {
      this.state.secondaryGroup = val;
      if (
        this.state.primaryGroup === this.state.secondaryGroup &&
        this.state.secondaryGroup !== "none"
      ) {
        this.modal.alert(
          "Secondary grouping cannot be the same as primary.",
          "Grouping Error"
        );
        this.state.secondaryGroup = "none";
      }
    } else if (type === "timeUnit") {
      this.state.timeUnit = val;
    }
    this.controlsComponent.update(this.state);
    this.generateChart();
  }

  applyPreset(presetName) {
    const presetState = this.analysisLogic.getPresetState(presetName);
    Object.assign(this.state, presetState);

    // Recalculate date range
    const expenses = store.getState("expenses") || [];
    const range = this.analysisLogic.calculateDateRange(
      this.state.timeframe,
      expenses
    );
    if (range) {
      this.state.startDate = range.start.toISOString().split("T")[0];
      this.state.endDate = range.end.toISOString().split("T")[0];
    }

    this.controlsComponent.update(this.state);
    this.updateTagSelectors();
    this.generateChart();
  }

  updateTagSelectors() {
    if (!this.filtersComponent) return;

    const tagsData = store.getState("tags") || {};

    // Delegate logic to AnalysisLogic
    const { visibleTrips, visibleTypes, typeStatusMap, filteredTagsData } =
      this.analysisLogic.calculateTagFilterState(
        tagsData,
        this.state.tripStatusFilter,
        this.state.selectedTrips
      );

    this.filtersComponent.renderTagLists(
      filteredTagsData,
      this.state.selectedCategories,
      this.state.selectedTrips,
      typeStatusMap, // Pass calculated map instead of set
      this.state.categorySearchTerm,
      this.state.tripSearchTerm,
      this.state.typeSearchTerm
    );
    this.filtersComponent.updateInputs(
      this.state.categorySearchTerm,
      this.state.tripSearchTerm,
      this.state.typeSearchTerm
    );
  }

  updateStatsDOM() {
    const stats = this.state.summaryStats;
    const container = this.element.querySelector("#analysis-summary-cards");
    if (!container) return;

    container.innerHTML = `
        <div class="summary-card">
            <h3>Total Income</h3>
            <p>${formatCurrency(stats.totalIncome)}</p>
        </div>
        <div class="summary-card">
            <h3>Total Expense</h3>
            <p>${formatCurrency(stats.totalExpense)}</p>
        </div>
        <div class="summary-card">
            <h3>Net Change</h3>
            <p>${formatCurrency(stats.netChange)}</p>
        </div>
        <div class="summary-card">
            <h3>Effective Balance</h3>
            <p>${formatCurrency(stats.effectiveBalance)}</p>
        </div>
        <div class="summary-card">
            <h3>Transactions</h3>
            <p>${stats.transactionCount}</p>
        </div>
      `;
  }

  updateViewVisibility() {
    const isTable = this.state.showDataTable;
    const chartContainer = this.element.querySelector(
      "#analysis-chart-container"
    );
    const tableContainer = this.element.querySelector(
      "#analysis-data-table-container"
    );
    const toggleBtn = this.element.querySelector("#btn-toggle-view");
    const downloadImgBtn = this.element.querySelector("#btn-download-image");
    const downloadDataBtn = this.element.querySelector("#btn-download-data");

    if (isTable) {
      chartContainer.style.display = "none";
      tableContainer.style.display = "block";
      toggleBtn.textContent = "Show Graph";
      downloadImgBtn.style.display = "none";
      downloadDataBtn.style.display = "inline-block";
    } else {
      chartContainer.style.display = "block";
      tableContainer.style.display = "none";
      toggleBtn.textContent = "Show Data Table";
      downloadImgBtn.style.display = "inline-block";
      downloadDataBtn.style.display = "none";
    }

    // Force table render if switching to table view and we have data
    if (isTable && this.chartData && this.tableComponent) {
      this.tableComponent.render(
        this.chartData.labels,
        this.chartData.datasets,
        {
          primaryGroup: this.state.primaryGroup,
          secondaryGroup: this.state.secondaryGroup,
          metric: this.state.metric,
          timeUnit: this.state.timeUnit,
          show: true,
        }
      );
    }
  }

  generateChart() {
    const expenses = store.getState("expenses") || [];
    const tags = store.getState("tags") || {};
    const tripStatusMap = tags.TripStatusMap || {};

    const filteredData = this.analysisLogic.getFilteredData(
      expenses,
      {
        startDate: this.state.startDate,
        endDate: this.state.endDate,
        selectedCategories: this.state.selectedCategories,
        selectedTrips: this.state.selectedTrips,
        tripStatusFilter: this.state.tripStatusFilter,
      },
      tripStatusMap
    );

    this.state.summaryStats =
      this.analysisLogic.calculateSummaryStats(filteredData);

    const allExpenses = store.getState("expenses") || [];
    const openingBalance = store.getState("openingBalance") || 0;
    const { currentBalance } = calculateFinancials(openingBalance, allExpenses);

    this.state.summaryStats.effectiveBalance =
      this.analysisLogic.calculateEffectiveBalance(
        currentBalance,
        allExpenses,
        tripStatusMap
      );

    this.updateStatsDOM();

    this.chartData = this.analysisLogic.aggregateData(
      filteredData,
      {
        primaryGroup: this.state.primaryGroup,
        secondaryGroup: this.state.secondaryGroup,
        metric: this.state.metric,
        timeUnit: this.state.timeUnit,
        startDate: this.state.startDate,
      },
      allExpenses,
      openingBalance
    );

    // Render Chart
    if (this.chartComponent) {
      this.chartComponent.render(this.chartData, {
        type: this.state.chartType,
        metric: this.state.metric,
        primaryGroup: this.state.primaryGroup,
        secondaryGroup: this.state.secondaryGroup,
      });
    }

    this.updateViewVisibility();
  }
}

export default AnalysisComponent;
