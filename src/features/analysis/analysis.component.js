import store from "../../core/state.js";
import { formatCurrency, formatDateForInput } from "../../core/utils.js";
import ModalComponent from "../../shared/modal.component.js";
import AnalysisLogic from "./analysis.logic.js";
import { calculateFinancials } from "../../core/financial.logic.js";

import AnalysisControls from "./analysis.controls.js";
import AnalysisFilters from "./analysis.filters.js";
import AnalysisChart from "./analysis.chart.js";
import AnalysisTable from "./analysis.table.js";
import { el, replace } from "../../core/dom.js";

class AnalysisComponent {
  constructor(element) {
    this.element = element;
    this.modal = new ModalComponent();
    this.analysisLogic = AnalysisLogic;
    this.unsubscribeHandlers = [];
    this.timeouts = [];
    this.eventListeners = [];

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
      chartType: "line",
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

    this.unsubscribeHandlers.push(
      store.subscribe("expenses", () => {
        this.updateTagSelectors();
        this.generateChart();
      })
    );
    this.unsubscribeHandlers.push(
      store.subscribe("tags", () => this.updateTagSelectors())
    );
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
        this.state.startDate = formatDateForInput(range.start);
        this.state.endDate = formatDateForInput(range.end);
      }
    }

    const header = el(
      "div",
      { className: "header-section" },
      el("h2", {}, "Financial Analysis"),
      el("p", {}, "Generate custom reports and visualize your treasury data.")
    );

    const summaryCards = el("div", {
      className: "summary-cards-container",
      id: "analysis-summary-cards",
    });
    const controlsContainer = el("div", {
      className: "main-control-panel",
      id: "analysis-controls-container",
    });
    const filtersContainer = el("div", {
      className: "control-section tag-filters-section",
      id: "analysis-filters-container",
    });

    const actionsBar = el(
      "div",
      { className: "analysis-actions-bar", id: "analysis-actions-bar" },
      el(
        "button",
        { id: "btn-toggle-view", className: "btn-action" },
        "Show Data Table"
      ),
      el(
        "button",
        { id: "btn-download-image", className: "btn-action" },
        "Download Image"
      ),
      el(
        "button",
        {
          id: "btn-download-data",
          className: "btn-action",
          style: { display: "none" },
        },
        "Download Data (CSV)"
      )
    );

    const chartContainer = el(
      "div",
      { className: "chart-container", id: "analysis-chart-container" },
      el("canvas", { id: "analysis-chart" })
    );

    const tableContainer = el("div", {
      id: "analysis-data-table-container",
      style: { display: "none" },
    });

    const container = el(
      "div",
      { className: "analysis-container" },
      header,
      summaryCards,
      controlsContainer,
      filtersContainer,
      actionsBar,
      chartContainer,
      tableContainer
    );

    const cssLink = el("link", {
      rel: "stylesheet",
      href: "src/features/analysis/analysis.css",
    });

    replace(this.element, cssLink, container);

    // Initialize Sub-components
    this.initializeSubComponents();
    this.initializeActionButtons();

    // Initial Updates
    this.updateStatsDOM(false);
    this.timeouts.push(setTimeout(() => this.updateTagSelectors(), 0));
    this.timeouts.push(setTimeout(() => this.generateChart(), 0));
  }

  initializeSubComponents() {
    // 1. Controls
    const controlsContainer = this.element.querySelector(
      "#analysis-controls-container"
    );
    if (!controlsContainer) {
      console.error("Analysis: Controls container not found");
      return;
    }

    this.controlsComponent = new AnalysisControls(controlsContainer, {
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
        this.updateControls();
        this.generateChart();
      },
      onMetricChange: (val) => {
        this.state.metric = val;
        if (val === "balance") {
          this.state.chartType = "line";
        }
        this.updateControls();
        this.generateChart();
      },
      onChartTypeChange: (val) => {
        this.state.chartType = val;
        this.generateChart();
      },
      onGroupChange: (type, val) => this.handleGroupChange(type, val),
      onPresetClick: (preset) => this.applyPreset(preset),
    });
    this.updateControls();

    // 2. Filters
    const filtersContainer = this.element.querySelector(
      "#analysis-filters-container"
    );
    if (!filtersContainer) {
      console.error("Analysis: Filters container not found");
    } else {
      this.filtersComponent = new AnalysisFilters(filtersContainer, {
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
      });
    }

    // 3. Chart
    const chartEl = this.element.querySelector("#analysis-chart");
    if (!chartEl) {
      console.error("Analysis: Chart canvas not found");
    } else {
      this.chartComponent = new AnalysisChart(chartEl);
    }

    // 4. Table
    const tableContainer = this.element.querySelector(
      "#analysis-data-table-container"
    );
    if (!tableContainer) {
      console.error("Analysis: Data table container not found");
    } else {
      this.tableComponent = new AnalysisTable(tableContainer);
    }
  }

  initializeActionButtons() {
    const toggleBtn = this.element.querySelector("#btn-toggle-view");
    if (toggleBtn) {
      const handler = () => {
        this.state.showDataTable = !this.state.showDataTable;
        this.updateViewVisibility();
      };
      toggleBtn.addEventListener("click", handler);
      this.eventListeners.push({ element: toggleBtn, type: "click", handler });
    }

    const downloadImgBtn = this.element.querySelector("#btn-download-image");
    if (downloadImgBtn) {
      const handler = () => {
        if (this.chartComponent) {
          const base64 = this.chartComponent.toBase64Image();
          if (base64) {
            const link = document.createElement("a");
            link.download = `analysis-chart-${formatDateForInput(
              new Date()
            )}.png`;
            link.href = base64;
            link.click();
          } else {
            this.modal.alert("Chart not ready.", "Download Error");
          }
        }
      };
      downloadImgBtn.addEventListener("click", handler);
      this.eventListeners.push({
        element: downloadImgBtn,
        type: "click",
        handler,
      });
    }

    const downloadDataBtn = this.element.querySelector("#btn-download-data");
    if (downloadDataBtn) {
      const handler = () => {
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
            `analysis-data-${formatDateForInput(new Date())}.csv`
          );
          link.style.visibility = "hidden";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        } else {
          this.modal.alert("No data available to download.", "Download Error");
        }
      };
      downloadDataBtn.addEventListener("click", handler);
      this.eventListeners.push({
        element: downloadDataBtn,
        type: "click",
        handler,
      });
    }
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

  updateControls() {
    if (!this.controlsComponent) return;
    const adjustments = this.controlsComponent.update(this.state);
    if (adjustments && adjustments.chartType) {
      this.state.chartType = adjustments.chartType;
    }
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
        this.state.startDate = formatDateForInput(range.start);
        this.state.endDate = formatDateForInput(range.end);
      }
    }
    this.updateControls();
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
    this.updateControls();
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
      this.state.startDate = formatDateForInput(range.start);
      this.state.endDate = formatDateForInput(range.end);
    }
    this.updateControls();
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

  updateStatsDOM(hasBalanceError = false) {
    const stats = this.state.summaryStats;
    const container = this.element.querySelector("#analysis-summary-cards");
    if (!container) return;

    const cards = [
      {
        title: "Total Income",
        value: formatCurrency(stats.totalIncome),
        class: "",
      },
      {
        title: "Total Expense",
        value: formatCurrency(stats.totalExpense),
        class: "",
      },
      {
        title: "Net Change",
        value: formatCurrency(stats.netChange),
        class: "",
      },
      {
        title: "Effective Balance",
        value: hasBalanceError
          ? "⚠️ Error"
          : formatCurrency(stats.effectiveBalance),
        class: "",
        tooltip: hasBalanceError ? "Failed to calculate balance" : "",
      },
      { title: "Transactions", value: stats.transactionCount, class: "" },
    ];

    const cardElements = cards.map((card) =>
      el(
        "div",
        { className: "summary-card", title: card.tooltip || "" },
        el("h3", {}, card.title),
        el("p", { className: card.class }, card.value)
      )
    );

    replace(container, ...cardElements);
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

    let currentBalance = 0;
    let hasBalanceError = false;
    try {
      ({ currentBalance } = calculateFinancials(openingBalance, allExpenses));
    } catch (error) {
      console.error("Analysis: Error calculating financials", error);
      hasBalanceError = true;
    }

    this.state.summaryStats.effectiveBalance =
      this.analysisLogic.calculateEffectiveBalance(
        currentBalance,
        allExpenses,
        tripStatusMap
      );

    this.updateStatsDOM(hasBalanceError);

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
        hasBalanceError: hasBalanceError,
      });
    }

    this.updateViewVisibility();
  }

  destroy() {
    this.unsubscribeHandlers.forEach((handler) => handler.unsubscribe());
    this.unsubscribeHandlers = [];
    this.timeouts.forEach((timeout) => clearTimeout(timeout));
    this.timeouts = [];
    this.eventListeners.forEach(({ element, type, handler }) => {
      element.removeEventListener(type, handler);
    });
    this.eventListeners = [];
    if (this.chartComponent) {
      this.chartComponent.destroy();
    }
  }
}

export default AnalysisComponent;
