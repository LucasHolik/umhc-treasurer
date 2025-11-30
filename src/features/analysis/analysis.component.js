import store from '../../core/state.js';
import { formatCurrency } from '../../core/utils.js';
import ModalComponent from '../../shared/modal.component.js';

class AnalysisComponent {
  constructor(element) {
    this.element = element;
    this.chartInstance = null;
    this.chartLibLoaded = false;
    this.modal = new ModalComponent();
    
    // Default State
    this.state = {
      timeframe: 'past_30_days',
      startDate: '',
      endDate: '',
      
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
    };

    this.loadChartLib();
    this.render();
    
    store.subscribe('expenses', () => {
        this.updateTagSelectors();
        this.generateChart();
    });
    store.subscribe('tags', () => this.updateTagSelectors());
  }

  calculateDateRange(timeframe) {
    let start = new Date();
    let end = new Date();
    const now = new Date();

    switch (timeframe) {
      case "current_month":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case "past_30_days":
        start.setDate(now.getDate() - 30);
        break;
      case "past_3_months":
        start.setMonth(now.getMonth() - 3);
        break;
      case "past_6_months":
        start.setMonth(now.getMonth() - 6);
        break;
      case "past_year":
        start.setFullYear(now.getFullYear() - 1);
        break;
      case "all_time":
        const expenses = store.getState('expenses') || [];
        if (expenses.length > 0) {
            let earliest = new Date();
            let found = false;
            expenses.forEach(item => {
                const d = new Date(item.Date);
                if (!isNaN(d.getTime())) {
                    if (!found || d < earliest) {
                        earliest = d;
                        found = true;
                    }
                }
            });
            if (found) start = earliest;
            else start = new Date(2000, 0, 1);
        } else {
             start = new Date(2000, 0, 1);
        }
        break;
      default:
        return null; // No change for custom
    }
    return { start, end };
  }

  handleTimeframeChange(newTimeframe) {
    this.state.timeframe = newTimeframe;
    if (newTimeframe !== 'custom') {
        const range = this.calculateDateRange(newTimeframe);
        if (range) {
            this.state.startDate = range.start.toISOString().split('T')[0];
            this.state.endDate = range.end.toISOString().split('T')[0];
            
            // Update inputs
            const startInput = this.element.querySelector('#start-date');
            const endInput = this.element.querySelector('#end-date');
            if (startInput) startInput.value = this.state.startDate;
            if (endInput) endInput.value = this.state.endDate;
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
    if (this.state.timeframe !== 'custom') {
        const range = this.calculateDateRange(this.state.timeframe);
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

        <div class="analysis-controls">
            <!-- Date Range -->
            <div class="control-group">
                <label>Date Range</label>
                <select id="timeframe-select" class="control-input" style="margin-bottom: 10px;">
                    <option value="current_month" ${this.state.timeframe === 'current_month' ? 'selected' : ''}>Current Month</option>
                    <option value="past_30_days" ${this.state.timeframe === 'past_30_days' ? 'selected' : ''}>Past 30 Days</option>
                    <option value="past_3_months" ${this.state.timeframe === 'past_3_months' ? 'selected' : ''}>Past 3 Months</option>
                    <option value="past_6_months" ${this.state.timeframe === 'past_6_months' ? 'selected' : ''}>Past 6 Months</option>
                    <option value="past_year" ${this.state.timeframe === 'past_year' ? 'selected' : ''}>Past Year</option>
                    <option value="all_time" ${this.state.timeframe === 'all_time' ? 'selected' : ''}>All Time</option>
                    <option value="custom" ${this.state.timeframe === 'custom' ? 'selected' : ''}>Custom</option>
                </select>
                <div style="display: flex; gap: 10px;">
                    <input type="date" id="start-date" class="control-input" value="${this.state.startDate}">
                    <input type="date" id="end-date" class="control-input" value="${this.state.endDate}">
                </div>
            </div>

            <!-- Metric & Chart Type -->
            <div class="control-group">
                <label>Visualization</label>
                <select id="metric-select" class="control-input">
                    <option value="balance" ${this.state.metric === 'balance' ? 'selected' : ''}>Cumulative Balance</option>
                    <option value="income" ${this.state.metric === 'income' ? 'selected' : ''}>Income Only</option>
                    <option value="expense" ${this.state.metric === 'expense' ? 'selected' : ''}>Expenses Only</option>
                    <option value="net" ${this.state.metric === 'net' ? 'selected' : ''}>Net Income (Income - Expense)</option>
                </select>
                <select id="chart-type-select" class="control-input" style="margin-top: 5px;">
                    <option value="bar" ${this.state.chartType === 'bar' ? 'selected' : ''}>Bar Chart (Stacked)</option>
                    <option value="line" ${this.state.chartType === 'line' ? 'selected' : ''}>Line Chart</option>
                    <option value="pie" ${this.state.chartType === 'pie' ? 'selected' : ''}>Pie Chart</option>
                    <option value="doughnut" ${this.state.chartType === 'doughnut' ? 'selected' : ''}>Doughnut Chart</option>
                </select>
            </div>

            <!-- Grouping -->
            <div class="control-group">
                <label>Grouping</label>
                <div style="display:flex; flex-direction:column; gap:5px;">
                    <select id="primary-group-select" class="control-input" title="Primary Grouping (X-Axis)">
                        <option value="date" ${this.state.primaryGroup === 'date' ? 'selected' : ''}>By Date</option>
                        <option value="category" ${this.state.primaryGroup === 'category' ? 'selected' : ''}>By Category</option>
                        <option value="trip" ${this.state.primaryGroup === 'trip' ? 'selected' : ''}>By Trip/Event</option>
                    </select>
                    
                    <select id="secondary-group-select" class="control-input" title="Secondary Grouping (Segments/Stacks)">
                        <option value="none" ${this.state.secondaryGroup === 'none' ? 'selected' : ''}>No Sub-grouping</option>
                        <option value="category" ${this.state.secondaryGroup === 'category' ? 'selected' : ''}>Split by Category</option>
                        <option value="trip" ${this.state.secondaryGroup === 'trip' ? 'selected' : ''}>Split by Trip/Event</option>
                    </select>

                    <select id="time-unit-select" class="control-input" style="display: ${this.state.primaryGroup === 'date' ? 'block' : 'none'};">
                        <option value="day" ${this.state.timeUnit === 'day' ? 'selected' : ''}>Daily</option>
                        <option value="week" ${this.state.timeUnit === 'week' ? 'selected' : ''}>Weekly</option>
                        <option value="month" ${this.state.timeUnit === 'month' ? 'selected' : ''}>Monthly</option>
                        <option value="year" ${this.state.timeUnit === 'year' ? 'selected' : ''}>Yearly</option>
                    </select>
                </div>
            </div>
        </div>
        
        <!-- Tag Filters (Full Width) -->
        <div class="analysis-controls" style="margin-top:-10px;">
             <div class="control-group" style="grid-column: 1 / -1;">
                <label>Filter Tags</label>
                <div class="tag-filters-container">
                    
                    <!-- Category Filter -->
                    <div class="tag-filter-column">
                        <div class="tag-filter-header">Categories</div>
                        <input type="text" id="cat-search" class="tag-search-input" placeholder="Search categories..." value="${this.state.categorySearchTerm}">
                        <div id="category-selector-container" class="tag-selector">
                            <div style="padding: 5px; color: rgba(255,255,255,0.5);">Loading...</div>
                        </div>
                    </div>

                    <!-- Trip Filter -->
                    <div class="tag-filter-column">
                        <div class="tag-filter-header">Trips / Events</div>
                        <input type="text" id="trip-search" class="tag-search-input" placeholder="Search trips..." value="${this.state.tripSearchTerm}">
                        <div id="trip-selector-container" class="tag-selector">
                            <div style="padding: 5px; color: rgba(255,255,255,0.5);">Loading...</div>
                        </div>
                    </div>

                </div>
            </div>
        </div>

        <div class="analysis-actions">
            <button id="btn-download" class="btn-download">Download Image</button>
        </div>

        <div class="chart-container">
            <canvas id="analysis-chart"></canvas>
        </div>
      </div>
    `;

    this.attachEventListeners();
    setTimeout(() => this.updateTagSelectors(), 0);
  }

  attachEventListeners() {
    // Timeframe & Date
    this.element.querySelector('#timeframe-select').addEventListener('change', (e) => {
        this.handleTimeframeChange(e.target.value);
        this.generateChart();
    });
    this.element.querySelector('#start-date').addEventListener('change', (e) => {
        this.state.startDate = e.target.value;
        this.state.timeframe = 'custom';
        this.element.querySelector('#timeframe-select').value = 'custom';
        this.generateChart();
    });
    this.element.querySelector('#end-date').addEventListener('change', (e) => {
        this.state.endDate = e.target.value;
        this.state.timeframe = 'custom';
        this.element.querySelector('#timeframe-select').value = 'custom';
        this.generateChart();
    });

    // Metrics
    this.element.querySelector('#metric-select').addEventListener('change', (e) => {
        this.state.metric = e.target.value;
        this.generateChart();
    });
    this.element.querySelector('#chart-type-select').addEventListener('change', (e) => {
        this.state.chartType = e.target.value;
        this.generateChart();
    });
    
    // Grouping
    const primarySelect = this.element.querySelector('#primary-group-select');
    const secondarySelect = this.element.querySelector('#secondary-group-select');
    const timeUnitSelect = this.element.querySelector('#time-unit-select');

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
    const catSearch = this.element.querySelector('#cat-search');
    catSearch.addEventListener('input', (e) => {
        this.state.categorySearchTerm = e.target.value.toLowerCase();
        this.updateTagSelectors(); // Re-render list with filter
    });

    const tripSearch = this.element.querySelector('#trip-search');
    tripSearch.addEventListener('input', (e) => {
        this.state.tripSearchTerm = e.target.value.toLowerCase();
        this.updateTagSelectors(); // Re-render list with filter
    });
    
    this.element.querySelector('#btn-download').addEventListener('click', () => this.downloadChart());
  }

  updateTagSelectors() {
    const tagsData = store.getState('tags') || {};
    
    this.populateTagList(
        'Category', 
        tagsData['Category'] || [], 
        this.state.selectedCategories, 
        this.state.categorySearchTerm,
        '#category-selector-container',
        '#cat-search'
    );

    this.populateTagList(
        'Trip/Event', 
        tagsData['Trip/Event'] || [], 
        this.state.selectedTrips, 
        this.state.tripSearchTerm,
        '#trip-selector-container',
        '#trip-search'
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
        selectAllDiv.innerHTML = `<input type="checkbox" id="all-${type.replace('/','-')}" /> <label for="all-${type.replace('/','-')}"><em>Select All</em></label>`;
        
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
        const uid = `${type.replace('/','-')}-${tag.replace(/\s+/g,'-')}`; 
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

  getFilteredData() {
    const expenses = store.getState('expenses') || [];
    const start = new Date(this.state.startDate);
    const end = new Date(this.state.endDate);
    end.setHours(23, 59, 59, 999);

    return expenses.filter(item => {
        const date = new Date(item.Date);
        if (isNaN(date.getTime())) return false;
        if (date < start || date > end) return false;

        // Category Filter (AND logic)
        if (this.state.selectedCategories.size > 0) {
            const itemCategory = item.Category || '';
            if (!this.state.selectedCategories.has(itemCategory)) {
                return false; // Must match one of selected categories
            }
        }

        // Trip Filter (AND logic)
        if (this.state.selectedTrips.size > 0) {
            const itemTrip = item['Trip/Event'] || '';
            if (!this.state.selectedTrips.has(itemTrip)) {
                return false; // Must match one of selected trips
            }
        }

        return true;
    });
  }

  aggregateData(data) {
    const { primaryGroup, secondaryGroup, metric, timeUnit } = this.state;
    
    const primaryMap = {}; 
    const allSecondaryKeys = new Set();

    const getVal = (item) => {
        const inc = parseFloat(item.Income || 0);
        const exp = parseFloat(item.Expense || 0);
        if (metric === 'income') return inc;
        if (metric === 'expense') return exp;
        if (metric === 'net') return inc - exp;
        return inc - exp; 
    };

    const getKey = (item, type) => {
        if (type === 'date') {
             const date = new Date(item.Date);
             if (timeUnit === 'day') return date.toISOString().split('T')[0];
             if (timeUnit === 'week') {
                 const day = date.getDay();
                 const diff = date.getDate() - day + (day === 0 ? -6 : 1);
                 return new Date(date.setDate(diff)).toISOString().split('T')[0];
             }
             if (timeUnit === 'year') return date.getFullYear().toString();
             return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }
        if (type === 'category') return item.Category || 'Uncategorized';
        if (type === 'trip') return item['Trip/Event'] || 'Uncategorized';
        return 'Unknown';
    };

    data.forEach(item => {
        const pKey = getKey(item, primaryGroup);
        const val = getVal(item);
        
        if (!primaryMap[pKey]) {
            primaryMap[pKey] = secondaryGroup === 'none' ? 0 : {};
        }

        if (secondaryGroup === 'none') {
            primaryMap[pKey] += val;
        } else {
            const sKey = getKey(item, secondaryGroup);
            allSecondaryKeys.add(sKey);
            if (!primaryMap[pKey][sKey]) primaryMap[pKey][sKey] = 0;
            primaryMap[pKey][sKey] += val;
        }
    });

    let sortedPKeys = Object.keys(primaryMap).sort();
    
    // Balance Logic
    if (metric === 'balance' && primaryGroup === 'date' && secondaryGroup === 'none') {
        const labels = [];
        const values = [];
        
        const allExpenses = store.getState('expenses') || [];
        const start = new Date(this.state.startDate);
        let balance = store.getState('openingBalance') || 0;
        
        // Pre-calc balance before window
        allExpenses.forEach(item => {
            if (new Date(item.Date) < start) {
                balance += (parseFloat(item.Income||0) - parseFloat(item.Expense||0));
            }
        });

        sortedPKeys.forEach(key => {
            balance += primaryMap[key];
            labels.push(key);
            values.push(balance);
        });
        
        return {
            labels,
            datasets: [{
                label: 'Balance',
                data: values,
                backgroundColor: '#f0ad4e',
                borderColor: '#f0ad4e',
                fill: false,
                type: 'line'
            }]
        };
    } 
    
    const labels = sortedPKeys;
    const datasets = [];
    
    const getColor = (str, index) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash % 360);
        return `hsl(${hue}, 70%, 50%)`;
    };

    if (secondaryGroup === 'none') {
        const dataPoints = labels.map(k => primaryMap[k]);
        // Conditional coloring for date-grouped non-balance charts
        const colors = labels.map((k, i) => (primaryGroup === 'date' && metric !== 'balance' ? (dataPoints[i] >= 0 ? '#1a6b10' : '#d9534f') : getColor(k, i)));
        
        datasets.push({
            label: metric.toUpperCase(),
            data: dataPoints,
            backgroundColor: colors,
            borderWidth: 1
        });
    } else {
        const sortedSKeys = Array.from(allSecondaryKeys).sort();
        
        sortedSKeys.forEach((sKey, i) => {
            const dataPoints = labels.map(pKey => primaryMap[pKey][sKey] || 0);
            datasets.push({
                label: sKey,
                data: dataPoints,
                backgroundColor: getColor(sKey, i),
                borderWidth: 1,
                stack: 'stack1'
            });
        });
    }

    return { labels, datasets };
  }

  generateChart() {
    if (!this.chartLibLoaded) {
        // Debounce check or just return, user will retry or auto-update
        return;
    }

    const data = this.getFilteredData();
    const { labels, datasets } = this.aggregateData(data);
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
                    intersect: false
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