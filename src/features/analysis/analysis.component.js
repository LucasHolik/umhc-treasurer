import store from '../../core/state.js';
import { formatCurrency } from '../../core/utils.js';
import ModalComponent from '../../shared/modal.component.js';
import AnalysisLogic from './analysis.logic.js';
import { calculateFinancials } from '../../core/financial.logic.js';

class AnalysisComponent {
  constructor(element) {
    this.element = element;
    this.chartInstance = null;
    this.chartLibLoaded = false;
    this.modal = new ModalComponent();
    this.analysisLogic = AnalysisLogic;
    
    // Default State
    this.state = {
      timeframe: 'past_30_days',
      startDate: '',
      endDate: '',
      tripStatusFilter: 'All', // 'All', 'Active', 'Completed'
      
      // Split Tag Filters
      selectedCategories: new Set(),
      selectedTrips: new Set(),
      
      categorySearchTerm: '',
      tripSearchTerm: '',

      metric: 'balance', // income, expense, net, balance
      chartType: 'bar', 
      primaryGroup: 'date', 
      secondaryGroup: 'none', 
      timeUnit: 'day',
      
      // Summary Statistics
      summaryStats: {
        totalIncome: 0,
        totalExpense: 0,
        netChange: 0,
        transactionCount: 0,
        effectiveBalance: 0, // Added effectiveBalance
      },
      showDataTable: false, // New state for data table visibility
    };

    this.loadChartLib();
    this.render();
    
    store.subscribe('expenses', () => {
        this.updateTagSelectors();
        this.generateChart();
    });
    store.subscribe('tags', () => this.updateTagSelectors());
  }

  handleTimeframeChange(newTimeframe) {
    this.state.timeframe = newTimeframe;
    if (newTimeframe !== 'custom') {
        const expenses = store.getState('expenses') || [];
        const range = this.analysisLogic.calculateDateRange(newTimeframe, expenses);
        if (range) {
            this.state.startDate = range.start.toISOString().split('T')[0];
            this.state.endDate = range.end.toISOString().split('T')[0];
            
            // Update inputs
            this.updateControls();
        }
    }
  }

  loadChartLib() {
    if (window.Chart) {
      this.chartLibLoaded = true;
      return;
    }

    const script = document.createElement('script');
    script.src = 'src/lib/chart.umd.min.js';
    script.onload = () => {
      this.chartLibLoaded = true;
      console.log('Chart.js loaded');
    };
    script.onerror = () => {
      console.error('Failed to load Chart.js');
      this.element.innerHTML += `<p style="color: red;">Error loading Chart.js library.</p>`;
    };
    document.head.appendChild(script);
  }

  render() {
    // Initialize dates if needed (on first render)
    if (this.state.timeframe !== 'custom' && !this.state.startDate) {
        const expenses = store.getState('expenses') || [];
        const range = this.analysisLogic.calculateDateRange(this.state.timeframe, expenses);
        if (range) {
            this.state.startDate = range.start.toISOString().split('T')[0];
            this.state.endDate = range.end.toISOString().split('T')[0];
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
        <div class="summary-cards-container">
            <div class="summary-card">
                <h3>Total Income</h3>
                <p>${formatCurrency(this.state.summaryStats.totalIncome)}</p>
            </div>
            <div class="summary-card">
                <h3>Total Expense</h3>
                <p>${formatCurrency(this.state.summaryStats.totalExpense)}</p>
            </div>
            <div class="summary-card">
                <h3>Net Change</h3>
                <p>${formatCurrency(this.state.summaryStats.netChange)}</p>
            </div>
            <div class="summary-card">
                <h3>Effective Balance</h3>
                <p>${formatCurrency(this.state.summaryStats.effectiveBalance)}</p>
            </div>
            <div class="summary-card">
                <h3>Transactions</h3>
                <p>${this.state.summaryStats.transactionCount}</p>
            </div>
        </div>

        <!-- Main Control Panel -->
        <div class="main-control-panel">
            
            <!-- Section 1: Scope (Time & Status) -->
            <div class="control-section scope-section">
                <div class="section-header">1. Scope</div>
                <div class="control-row">
                    <div class="control-group">
                        <label for="analysis-timeframe-select">Timeframe</label>
                        <select id="analysis-timeframe-select" class="control-input">
                            <option value="current_month" ${this.state.timeframe === 'current_month' ? 'selected' : ''}>Current Month</option>
                            <option value="past_30_days" ${this.state.timeframe === 'past_30_days' ? 'selected' : ''}>Past 30 Days</option>
                            <option value="past_3_months" ${this.state.timeframe === 'past_3_months' ? 'selected' : ''}>Past 3 Months</option>
                            <option value="past_6_months" ${this.state.timeframe === 'past_6_months' ? 'selected' : ''}>Past 6 Months</option>
                            <option value="past_year" ${this.state.timeframe === 'past_year' ? 'selected' : ''}>Past Year</option>
                            <option value="all_time" ${this.state.timeframe === 'all_time' ? 'selected' : ''}>All Time</option>
                            <option value="custom" ${this.state.timeframe === 'custom' ? 'selected' : ''}>Custom</option>
                        </select>
                    </div>
                    <div class="control-group">
                        <label for="analysis-trip-status-select">Trip Status</label>
                        <select id="analysis-trip-status-select" class="control-input">
                            <option value="All" ${this.state.tripStatusFilter === 'All' ? 'selected' : ''}>All</option>
                            <option value="Active" ${this.state.tripStatusFilter === 'Active' ? 'selected' : ''}>Active Only</option>
                            <option value="Completed" ${this.state.tripStatusFilter === 'Completed' ? 'selected' : ''}>Completed Only</option>
                        </select>
                    </div>
                </div>
                <div class="control-row dates-row" style="margin-top: 10px;">
                     <input type="date" id="analysis-start-date" aria-label="Start Date" class="control-input" value="${this.state.startDate}">
                     <span style="color: #ccc; align-self: center;">to</span>
                     <input type="date" id="analysis-end-date" aria-label="End Date" class="control-input" value="${this.state.endDate}">
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
                            <option value="balance" ${this.state.metric === 'balance' ? 'selected' : ''}>Cumulative Balance</option>
                            <option value="income" ${this.state.metric === 'income' ? 'selected' : ''}>Income</option>
                            <option value="expense" ${this.state.metric === 'expense' ? 'selected' : ''}>Expenses</option>
                            <option value="net" ${this.state.metric === 'net' ? 'selected' : ''}>Net Income</option>
                        </select>
                    </div>

                     <div class="control-group">
                        <label for="analysis-chart-type-select">Chart Type</label>
                        <select id="analysis-chart-type-select" class="control-input">
                            <option value="bar" ${this.state.chartType === 'bar' ? 'selected' : ''}>Bar</option>
                            <option value="line" ${this.state.chartType === 'line' ? 'selected' : ''}>Line</option>
                            <option value="pie" ${this.state.chartType === 'pie' ? 'selected' : ''}>Pie</option>
                            <option value="doughnut" ${this.state.chartType === 'doughnut' ? 'selected' : ''}>Doughnut</option>
                        </select>
                    </div>

                    <!-- Grouping -->
                    <div class="control-group">
                        <label for="analysis-primary-group-select">X-Axis Group</label>
                        <select id="analysis-primary-group-select" class="control-input">
                            <option value="date" ${this.state.primaryGroup === 'date' ? 'selected' : ''}>Date</option>
                            <option value="category" ${this.state.primaryGroup === 'category' ? 'selected' : ''}>Category</option>
                            <option value="trip" ${this.state.primaryGroup === 'trip' ? 'selected' : ''}>Trip/Event</option>
                        </select>
                    </div>

                    <div class="control-group">
                        <label for="analysis-secondary-group-select">Sub-Group (Stack)</label>
                        <select id="analysis-secondary-group-select" class="control-input">
                            <option value="none" ${this.state.secondaryGroup === 'none' ? 'selected' : ''}>None</option>
                            <option value="category" ${this.state.secondaryGroup === 'category' ? 'selected' : ''}>Category</option>
                            <option value="trip" ${this.state.secondaryGroup === 'trip' ? 'selected' : ''}>Trip/Event</option>
                        </select>
                    </div>

                    <div class="control-group" style="display: ${this.state.primaryGroup === 'date' ? 'block' : 'none'};">
                        <label for="analysis-time-unit-select">Time Unit</label>
                        <select id="analysis-time-unit-select" class="control-input">
                            <option value="day" ${this.state.timeUnit === 'day' ? 'selected' : ''}>Daily</option>
                            <option value="week" ${this.state.timeUnit === 'week' ? 'selected' : ''}>Weekly</option>
                            <option value="month" ${this.state.timeUnit === 'month' ? 'selected' : ''}>Monthly</option>
                            <option value="year" ${this.state.timeUnit === 'year' ? 'selected' : ''}>Yearly</option>
                        </select>
                    </div>

                </div>
            </div>
        </div>
        
        <!-- Tag Filters (Collapsible/Full Width) -->
        <div class="control-section tag-filters-section">
             <div class="section-header">Filter Specific Tags</div>
             <div class="tag-filters-container">
                <!-- Trip Filter -->
                <div class="tag-filter-column">
                    <div class="tag-filter-header">Trips / Events</div>
                    <input type="text" id="analysis-trip-search" aria-label="Search Trips" class="tag-search-input" placeholder="Search trips..." value="${this.state.tripSearchTerm}">
                    <div id="trip-selector-container" class="tag-selector">
                        <div style="padding: 5px; color: rgba(255,255,255,0.5);">Loading...</div>
                    </div>
                </div>

                <!-- Category Filter -->
                <div class="tag-filter-column">
                    <div class="tag-filter-header">Categories</div>
                    <input type="text" id="analysis-cat-search" aria-label="Search Categories" class="tag-search-input" placeholder="Search categories..." value="${this.state.categorySearchTerm}">
                    <div id="category-selector-container" class="tag-selector">
                        <div style="padding: 5px; color: rgba(255,255,255,0.5);">Loading...</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="analysis-actions">
            <button id="btn-toggle-data-table" class="btn-download">${this.state.showDataTable ? 'Hide Data Table' : 'Show Data Table'}</button>
            <button id="btn-download" class="btn-download">Download Image</button>
        </div>

        <div class="chart-container">
            <canvas id="analysis-chart"></canvas>
        </div>

        <div id="analysis-data-table-container"></div>
      </div>
    `;

    this.attachEventListeners();
    setTimeout(() => this.updateTagSelectors(), 0);
    // Ensure chart is generated on first render (if data exists)
    setTimeout(() => this.generateChart(), 0); 
  }

  attachEventListeners() {
    // Timeframe & Date
    this.element.querySelector('#analysis-timeframe-select').addEventListener('change', (e) => {
        this.handleTimeframeChange(e.target.value);
        this.generateChart();
    });
    this.element.querySelector('#analysis-trip-status-select').addEventListener('change', (e) => {
        this.state.tripStatusFilter = e.target.value;
        this.generateChart();
    });
    this.element.querySelector('#analysis-start-date').addEventListener('change', (e) => {
        this.state.startDate = e.target.value;
        this.state.timeframe = 'custom';
        this.element.querySelector('#analysis-timeframe-select').value = 'custom';
        this.generateChart();
    });
    this.element.querySelector('#analysis-end-date').addEventListener('change', (e) => {
        this.state.endDate = e.target.value;
        this.state.timeframe = 'custom';
        this.element.querySelector('#analysis-timeframe-select').value = 'custom';
        this.generateChart();
    });

    // Metrics
    this.element.querySelector('#analysis-metric-select').addEventListener('change', (e) => {
        this.state.metric = e.target.value;
        this.generateChart();
    });
    this.element.querySelector('#analysis-chart-type-select').addEventListener('change', (e) => {
        this.state.chartType = e.target.value;
        this.generateChart();
    });
    
    // Grouping
    const primarySelect = this.element.querySelector('#analysis-primary-group-select');
    const secondarySelect = this.element.querySelector('#analysis-secondary-group-select');
    const timeUnitSelect = this.element.querySelector('#analysis-time-unit-select');

    primarySelect.addEventListener('change', (e) => {
        this.state.primaryGroup = e.target.value;
        timeUnitSelect.style.display = (this.state.primaryGroup === 'date') ? 'block' : 'none';
        
        if (this.state.primaryGroup === this.state.secondaryGroup) {
            this.state.secondaryGroup = 'none';
            secondarySelect.value = 'none';
        }
        this.generateChart();
    });

    secondarySelect.addEventListener('change', (e) => {
        this.state.secondaryGroup = e.target.value;
         if (this.state.primaryGroup === this.state.secondaryGroup && this.state.secondaryGroup !== 'none') {
             this.modal.alert("Secondary grouping cannot be the same as primary.", "Grouping Error");
             this.state.secondaryGroup = 'none';
             e.target.value = 'none';
         }
        this.generateChart();
    });

    timeUnitSelect.addEventListener('change', (e) => {
        this.state.timeUnit = e.target.value;
        this.generateChart();
    });
    
    // Tag Search Inputs
    const catSearch = this.element.querySelector('#analysis-cat-search');
    catSearch.addEventListener('input', (e) => {
        this.state.categorySearchTerm = e.target.value.toLowerCase();
        this.updateTagSelectors(); // Re-render list with filter
    });

    const tripSearch = this.element.querySelector('#analysis-trip-search');
    tripSearch.addEventListener('input', (e) => {
        this.state.tripSearchTerm = e.target.value.toLowerCase();
        this.updateTagSelectors(); // Re-render list with filter
    });
    
    this.element.querySelectorAll('.quick-report-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            this.applyPreset(e.target.dataset.preset);
        });
    });

    this.element.querySelector('#btn-download').addEventListener('click', () => this.downloadChart());
    
    this.element.querySelector('#btn-toggle-data-table').addEventListener('click', () => {
        this.state.showDataTable = !this.state.showDataTable;
        this.updateControls(); // Update button text
        this.generateChart(); // Show/Hide table content
    });
  }

  applyPreset(presetName) {
    // Reset selections for a clean preset application
    this.state.selectedCategories.clear();
    this.state.selectedTrips.clear();
    this.state.categorySearchTerm = '';
    this.state.tripSearchTerm = '';
    
    // Default to 'All' unless specified
    this.state.tripStatusFilter = 'All';

    switch (presetName) {
        case 'trip_cost_completed':
            this.state.timeframe = 'all_time';
            this.state.metric = 'net';
            this.state.chartType = 'bar';
            this.state.primaryGroup = 'trip';
            this.state.secondaryGroup = 'none';
            this.state.timeUnit = 'month'; // Not used
            this.state.tripStatusFilter = 'Completed';
            break;
        case 'category_breakdown':
            this.state.timeframe = 'past_year';
            this.state.metric = 'expense';
            this.state.chartType = 'bar';
            this.state.primaryGroup = 'category';
            this.state.secondaryGroup = 'trip';
            this.state.timeUnit = 'month'; // Not used
            break;
        case 'monthly_trend':
            this.state.timeframe = 'past_year';
            this.state.metric = 'net';
            this.state.chartType = 'bar';
            this.state.primaryGroup = 'date';
            this.state.secondaryGroup = 'none';
            this.state.timeUnit = 'month';
            break;
        case 'active_trip_status':
            this.state.timeframe = 'all_time';
            this.state.metric = 'net';
            this.state.chartType = 'bar';
            this.state.primaryGroup = 'trip';
            this.state.secondaryGroup = 'none';
            this.state.timeUnit = 'month'; // Not used
            this.state.tripStatusFilter = 'Active';
            break;
    }
    
    // Recalculate date range for the new timeframe
    const expenses = store.getState('expenses') || [];
    const range = this.analysisLogic.calculateDateRange(this.state.timeframe, expenses);
    if (range) {
        this.state.startDate = range.start.toISOString().split('T')[0];
        this.state.endDate = range.end.toISOString().split('T')[0];
    }

    // Update controls without full re-render to prevent glitches
    this.updateControls();
    this.updateTagSelectors();
    this.generateChart();
  }

  updateControls() {
    // Update Timeframe & Dates
    const timeframeSelect = this.element.querySelector('#analysis-timeframe-select');
    if (timeframeSelect) timeframeSelect.value = this.state.timeframe;
    
    const tripStatusSelect = this.element.querySelector('#analysis-trip-status-select');
    if (tripStatusSelect) tripStatusSelect.value = this.state.tripStatusFilter;
    
    const startDateInput = this.element.querySelector('#analysis-start-date');
    if (startDateInput) startDateInput.value = this.state.startDate;
    
    const endDateInput = this.element.querySelector('#analysis-end-date');
    if (endDateInput) endDateInput.value = this.state.endDate;

    // Update Metrics
    const metricSelect = this.element.querySelector('#analysis-metric-select');
    if (metricSelect) metricSelect.value = this.state.metric;

    const chartTypeSelect = this.element.querySelector('#analysis-chart-type-select');
    if (chartTypeSelect) chartTypeSelect.value = this.state.chartType;

    // Update Grouping
    const primarySelect = this.element.querySelector('#analysis-primary-group-select');
    if (primarySelect) primarySelect.value = this.state.primaryGroup;

    const secondarySelect = this.element.querySelector('#analysis-secondary-group-select');
    if (secondarySelect) secondarySelect.value = this.state.secondaryGroup;

    const timeUnitSelect = this.element.querySelector('#analysis-time-unit-select');
    if (timeUnitSelect) {
        timeUnitSelect.value = this.state.timeUnit;
        timeUnitSelect.style.display = (this.state.primaryGroup === 'date') ? 'block' : 'none';
    }

    // Update Toggle Button Text
    const toggleBtn = this.element.querySelector('#btn-toggle-data-table');
    if (toggleBtn) {
        toggleBtn.textContent = this.state.showDataTable ? 'Hide Data Table' : 'Show Data Table';
    }

    // Clear Search Inputs
    const catSearch = this.element.querySelector('#analysis-cat-search');
    if (catSearch) catSearch.value = this.state.categorySearchTerm;

    const tripSearch = this.element.querySelector('#analysis-trip-search');
    if (tripSearch) tripSearch.value = this.state.tripSearchTerm;
  }

  updateTagSelectors() {
    const tagsData = store.getState('tags') || {};
    
    this.populateTagList(
        'Category', 
        tagsData['Category'] || [], 
        this.state.selectedCategories, 
        this.state.categorySearchTerm,
        '#category-selector-container',
        '#analysis-cat-search'
    );

    this.populateTagList(
        'Trip/Event', 
        tagsData['Trip/Event'] || [], 
        this.state.selectedTrips, 
        this.state.tripSearchTerm,
        '#trip-selector-container',
        '#analysis-trip-search'
    );
  }

  populateTagList(type, tagsArray, selectionSet, searchTerm, containerId, searchInputId) {
    const container = this.element.querySelector(containerId);
    if (!container) return;

    container.innerHTML = '';
    
    if (tagsArray.length === 0) {
        container.innerHTML = '<div style="padding:5px;">No tags found</div>';
        return;
    }

    const sortedTags = [...tagsArray].sort();
    const visibleTags = sortedTags.filter(tag => tag.toLowerCase().includes(searchTerm));

    // "Select All" Option
    // Only show if we are not filtering via search, OR if search is active we can "select all matches"
    if (visibleTags.length > 0) {
        const selectAllDiv = document.createElement('div');
        selectAllDiv.className = 'tag-checkbox-item';
        selectAllDiv.innerHTML = `<input type="checkbox" id="analysis-all-${type.replace('/','-')}" /> <label for="analysis-all-${type.replace('/','-')}"><em>Select All</em></label>`;
        
        // Check state of select all box: true if all visible tags are in set
        const allVisibleSelected = visibleTags.every(t => selectionSet.has(t));
        const checkbox = selectAllDiv.querySelector('input');
        checkbox.checked = allVisibleSelected && visibleTags.length > 0 && selectionSet.size > 0;

        checkbox.addEventListener('change', (e) => {
            visibleTags.forEach(tag => {
                if (e.target.checked) selectionSet.add(tag);
                else selectionSet.delete(tag);
            });
            this.updateTagSelectors(); // Update UI to reflect check state
            this.generateChart();
        });
        container.appendChild(selectAllDiv);
    }

    if (visibleTags.length === 0) {
         container.innerHTML += '<div style="padding:5px; color:#ccc;">No matches found</div>';
    }

    visibleTags.forEach(tag => {
        const div = document.createElement('div');
        div.className = 'tag-checkbox-item';
        const isChecked = selectionSet.has(tag);
        // Unique ID for label
        const uid = `analysis-${type.replace('/','-')}-${tag.replace(/\s+/g,'-')}`; 
        div.innerHTML = `
            <input type="checkbox" id="${uid}" value="${tag}" class="tag-item-input" ${isChecked ? 'checked' : ''}>
            <label for="${uid}">${tag}</label>
        `;
        const input = div.querySelector('input');
        input.addEventListener('change', (e) => {
            if (e.target.checked) selectionSet.add(tag);
            else selectionSet.delete(tag);
            // We don't need full re-render of list, just chart
            // But SelectAll checkbox state might need update. For perf, just gen chart.
            // Actually, let's re-render list to update "Select All" state visual? 
            // Maybe excessive. Let's just gen chart.
            this.generateChart();
        });
        container.appendChild(div);
    });
  }

  updateStatsDOM() {
      const stats = this.state.summaryStats;
      const cards = this.element.querySelectorAll('.summary-card p');
      if (cards.length >= 5) {
          cards[0].textContent = formatCurrency(stats.totalIncome);
          cards[1].textContent = formatCurrency(stats.totalExpense);
          cards[2].textContent = formatCurrency(stats.netChange);
          cards[3].textContent = formatCurrency(stats.effectiveBalance);
          cards[4].textContent = stats.transactionCount;
      }
  }

  updateDataTable(labels, datasets) {
      const container = this.element.querySelector('#analysis-data-table-container');
      if (!container) return;

      if (!this.state.showDataTable) {
          container.innerHTML = '';
          return;
      }

      let tableHeaders = `<th class="data-table-header">${this.state.primaryGroup === 'date' ? `Date (${this.state.timeUnit})` : this.state.primaryGroup.charAt(0).toUpperCase() + this.state.primaryGroup.slice(1)}</th>`;
      if (this.state.secondaryGroup !== 'none') {
          const secondaryKeys = datasets.map(d => d.label);
          tableHeaders += secondaryKeys.map(key => `<th class="data-table-header">${key}</th>`).join('');
          tableHeaders += `<th class="data-table-header">Total</th>`;
      } else {
          tableHeaders += `<th class="data-table-header">${this.state.metric.charAt(0).toUpperCase() + this.state.metric.slice(1)}</th>`;
      }

      let tableRows = labels.map(label => {
          let rowData = `<td class="data-table-cell">${label}</td>`;
          if (this.state.secondaryGroup !== 'none') {
              let rowTotal = 0;
              datasets.forEach(dataset => {
                  const dataIndex = labels.indexOf(label);
                  const value = dataset.data[dataIndex] || 0;
                  rowData += `<td class="data-table-cell">${formatCurrency(value)}</td>`;
                  rowTotal += value;
              });
              rowData += `<td class="data-table-cell total-column">${formatCurrency(rowTotal)}</td>`;
          } else {
              const dataIndex = labels.indexOf(label);
              const value = datasets[0].data[dataIndex] || 0;
              rowData += `<td class="data-table-cell">${formatCurrency(value)}</td>`;
          }
          return `<tr class="data-table-row">${rowData}</tr>`;
      }).join('');
      
      container.innerHTML = `
          <div class="data-table-container">
              <h3>Aggregated Data</h3>
              <table class="data-table">
                  <thead>
                      <tr>${tableHeaders}</tr>
                  </thead>
                  <tbody>
                      ${tableRows}
                  </tbody>
              </table>
          </div>
      `;
  }

  generateChart() {
    if (!this.chartLibLoaded) {
        // Debounce check or just return, user will retry or auto-update
        return;
    }

    const expenses = store.getState('expenses') || [];
    const tags = store.getState('tags') || {};
    const tripStatusMap = tags.TripStatusMap || {};

    const filteredData = this.analysisLogic.getFilteredData(expenses, {
        startDate: this.state.startDate,
        endDate: this.state.endDate,
        selectedCategories: this.state.selectedCategories,
        selectedTrips: this.state.selectedTrips,
        tripStatusFilter: this.state.tripStatusFilter,
    }, tripStatusMap);
    
    // Update summary stats
    this.state.summaryStats = this.analysisLogic.calculateSummaryStats(filteredData);
    
    // Calculate Effective Balance
    // 1. Calculate Current Global Balance
    const allExpenses = store.getState('expenses') || [];
    const openingBalance = store.getState('openingBalance') || 0;
    
    const { currentBalance } = calculateFinancials(openingBalance, allExpenses);

    // 2. Get Tags and Calculate
    this.state.summaryStats.effectiveBalance = this.analysisLogic.calculateEffectiveBalance(currentBalance, allExpenses, tags);

    this.updateStatsDOM();
    
    const { labels, datasets } = this.analysisLogic.aggregateData(filteredData, {
        primaryGroup: this.state.primaryGroup,
        secondaryGroup: this.state.secondaryGroup,
        metric: this.state.metric,
        timeUnit: this.state.timeUnit,
        startDate: this.state.startDate, // Pass startDate for balance calculation
    });
    
    this.updateDataTable(labels, datasets);

    const ctx = this.element.querySelector('#analysis-chart').getContext('2d');

    if (this.chartInstance) {
        this.chartInstance.destroy();
    }

    let type = this.state.chartType;
    if (this.state.secondaryGroup !== 'none' && (type === 'pie' || type === 'doughnut')) {
        type = 'bar'; 
    }
    if (this.state.metric === 'balance' && this.state.primaryGroup === 'date' && this.state.secondaryGroup === 'none') {
        type = 'line'; 
    }

    const config = {
        type: type,
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#fff' },
                    display: true
                },
                title: {
                    display: true,
                    text: `Analysis: ${this.state.metric.toUpperCase()} by ${this.state.primaryGroup}${this.state.secondaryGroup !== 'none' ? ' & ' + this.state.secondaryGroup : ''}`,
                    color: '#f0ad4e',
                    font: { size: 16 }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += formatCurrency(context.parsed.y);
                            }
                            return label;
                        },
                        footer: function(tooltipItems) {
                            let sum = 0;
                            tooltipItems.forEach(function(tooltipItem) {
                                sum += tooltipItem.parsed.y;
                            });
                            // Only show total if there's more than one item
                            if (tooltipItems.length > 1) {
                                return 'Total: ' + formatCurrency(sum);
                            }
                            return '';
                        }
                    }
                }
            },
            scales: (type === 'pie' || type === 'doughnut') ? {} : {
                y: {
                    stacked: this.state.secondaryGroup !== 'none',
                    ticks: { color: '#ccc' },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                },
                x: {
                    stacked: this.state.secondaryGroup !== 'none',
                    ticks: { color: '#ccc' },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                }
            }
        }
    };

    this.chartInstance = new Chart(ctx, config);
  }

  downloadChart() {
    if (!this.chartInstance) {
        alert("Please generate a chart first.");
        return;
    }
    const link = document.createElement('a');
    link.download = `analysis-chart-${new Date().toISOString().split('T')[0]}.png`;
    link.href = this.chartInstance.toBase64Image();
    link.click();
  }
}

export default AnalysisComponent;