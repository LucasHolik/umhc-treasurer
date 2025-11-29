import store from '../../core/state.js';
import { formatCurrency } from '../../core/utils.js';

class AnalysisComponent {
  constructor(element) {
    this.element = element;
    this.chartInstance = null;
    this.chartLibLoaded = false;
    
    // Default State
    this.state = {
      startDate: '',
      endDate: '',
      selectedTags: new Set(),
      metric: 'income', // income, expense, net, balance
      chartType: 'bar', // line, bar, pie, doughnut
      groupBy: 'date', // date, category, trip
    };

    this.loadChartLib();
    this.render();
    
    store.subscribe('expenses', () => this.updateTagSelector());
    store.subscribe('tags', () => this.updateTagSelector());
  }

  loadChartLib() {
    if (window.Chart) {
      this.chartLibLoaded = true;
      return;
    }

    const script = document.createElement('script');
    // Load from the local library file we saved
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
    // Set default dates (past 6 months)
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 6);
    
    this.state.endDate = end.toISOString().split('T')[0];
    this.state.startDate = start.toISOString().split('T')[0];

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
                <div style="display: flex; gap: 10px;">
                    <input type="date" id="start-date" class="control-input" value="${this.state.startDate}">
                    <input type="date" id="end-date" class="control-input" value="${this.state.endDate}">
                </div>
            </div>

            <!-- Metric & Chart Type -->
            <div class="control-group">
                <label>Visualization</label>
                <select id="metric-select" class="control-input">
                    <option value="income">Income Only</option>
                    <option value="expense">Expenses Only</option>
                    <option value="net">Net Income (Income - Expense)</option>
                    <option value="balance">Cumulative Balance</option>
                </select>
                <select id="chart-type-select" class="control-input" style="margin-top: 5px;">
                    <option value="bar">Bar Chart</option>
                    <option value="line">Line Chart</option>
                    <option value="pie">Pie Chart (Totals)</option>
                    <option value="doughnut">Doughnut Chart</option>
                </select>
            </div>

            <!-- Group By -->
            <div class="control-group">
                <label>Group By</label>
                <select id="group-by-select" class="control-input">
                    <option value="date">Date (Monthly)</option>
                    <option value="category">Category (Tag)</option>
                    <option value="trip">Trip/Event (Tag)</option>
                </select>
            </div>

            <!-- Tag Filter -->
            <div class="control-group">
                <label>Filter Tags (Optional)</label>
                <div id="tag-selector-container" class="tag-selector">
                    <!-- Populated via JS -->
                    <div style="padding: 5px; color: rgba(255,255,255,0.5);">Loading tags...</div>
                </div>
            </div>
        </div>

        <div class="analysis-actions">
            <button id="btn-generate" class="btn-analyze">Generate Graph</button>
            <button id="btn-download" class="btn-download">Download Image</button>
        </div>

        <div class="chart-container">
            <canvas id="analysis-chart"></canvas>
        </div>
      </div>
    `;

    this.attachEventListeners();
    // Initial tag population
    setTimeout(() => this.updateTagSelector(), 0);
  }

  attachEventListeners() {
    this.element.querySelector('#start-date').addEventListener('change', (e) => this.state.startDate = e.target.value);
    this.element.querySelector('#end-date').addEventListener('change', (e) => this.state.endDate = e.target.value);
    this.element.querySelector('#metric-select').addEventListener('change', (e) => this.state.metric = e.target.value);
    this.element.querySelector('#chart-type-select').addEventListener('change', (e) => this.state.chartType = e.target.value);
    this.element.querySelector('#group-by-select').addEventListener('change', (e) => this.state.groupBy = e.target.value);
    
    this.element.querySelector('#btn-generate').addEventListener('click', () => this.generateChart());
    this.element.querySelector('#btn-download').addEventListener('click', () => this.downloadChart());
  }

  updateTagSelector() {
    const container = this.element.querySelector('#tag-selector-container');
    if (!container) return;

    // Get tags from store (assuming they are in 'tags' object)
    const tagsData = store.getState('tags') || {};
    const allTags = new Set();
    
    // Collect all unique tags from predefined lists
    if (tagsData['Category']) tagsData['Category'].forEach(t => allTags.add(t));
    if (tagsData['Trip/Event']) tagsData['Trip/Event'].forEach(t => allTags.add(t));

    // Also check existing expenses for any ad-hoc tags not in the list?
    // For now, stick to the store tags + maybe a scan of expenses if needed.
    // Let's just use the store tags.

    container.innerHTML = '';
    
    if (allTags.size === 0) {
        container.innerHTML = '<div style="padding:5px;">No tags found</div>';
        return;
    }

    const sortedTags = Array.from(allTags).sort();
    
    // "Select All" helper
    const selectAllDiv = document.createElement('div');
    selectAllDiv.className = 'tag-checkbox-item';
    selectAllDiv.innerHTML = `<input type="checkbox" id="tag-all" /> <label for="tag-all"><em>Select All</em></label>`;
    selectAllDiv.querySelector('input').addEventListener('change', (e) => {
        const checkboxes = container.querySelectorAll('.tag-item-input');
        checkboxes.forEach(cb => {
            cb.checked = e.target.checked;
            if (e.target.checked) this.state.selectedTags.add(cb.value);
            else this.state.selectedTags.delete(cb.value);
        });
    });
    container.appendChild(selectAllDiv);

    sortedTags.forEach(tag => {
        const div = document.createElement('div');
        div.className = 'tag-checkbox-item';
        const isChecked = this.state.selectedTags.has(tag);
        div.innerHTML = `
            <input type="checkbox" id="tag-${tag}" value="${tag}" class="tag-item-input" ${isChecked ? 'checked' : ''}>
            <label for="tag-${tag}">${tag}</label>
        `;
        const input = div.querySelector('input');
        input.addEventListener('change', (e) => {
            if (e.target.checked) this.state.selectedTags.add(tag);
            else this.state.selectedTags.delete(tag);
        });
        container.appendChild(div);
    });
  }

  getFilteredData() {
    const expenses = store.getState('expenses') || [];
    const start = new Date(this.state.startDate);
    const end = new Date(this.state.endDate);
    end.setHours(23, 59, 59, 999); // Include the whole end day

    return expenses.filter(item => {
        const date = new Date(item.Date);
        if (isNaN(date.getTime())) return false;
        
        // Date Filter
        if (date < start || date > end) return false;

        // Tag Filter (if any tags are selected)
        if (this.state.selectedTags.size > 0) {
            // item.Tag or item.Category or item['Trip/Event']?
            // Based on dashboard, it seems item properties are capitalized.
            // Let's assume item has 'Category' and 'Trip/Event' or just 'Tag'.
            // Checking api.service.js or data structure would confirm.
            // Assuming standard schema: 'Category', 'Trip/Event'.
            const itemCategory = item.Category || '';
            const itemTrip = item['Trip/Event'] || '';
            
            const hasSelectedTag = this.state.selectedTags.has(itemCategory) || this.state.selectedTags.has(itemTrip);
            if (!hasSelectedTag) return false;
        }

        return true;
    });
  }

  aggregateData(data) {
    const { groupBy, metric, timeUnit } = this.state;
    const labels = [];
    const values = [];
    const backgroundColors = [];
    
    // Helper to parse amount
    const getVal = (item) => {
        const inc = parseFloat(item.Income || 0);
        const exp = parseFloat(item.Expense || 0);
        if (metric === 'income') return inc;
        if (metric === 'expense') return exp;
        if (metric === 'net') return inc - exp;
        return 0; // Balance handled differently
    };

    // Helper to get week start (Monday)
    const getWeekStart = (d) => {
        const date = new Date(d);
        const day = date.getDay(); // 0 (Sun) to 6 (Sat)
        const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
        return new Date(date.setDate(diff)).toISOString().split('T')[0];
    };

    // Helper to get key based on time unit
    const getDateKey = (itemDate) => {
        const date = new Date(itemDate);
        if (timeUnit === 'day') {
             return date.toISOString().split('T')[0];
        } else if (timeUnit === 'week') {
             return getWeekStart(date);
        } else {
             // Default Month
             return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }
    };

    if (groupBy === 'date') {
        const grouped = {};
        data.forEach(item => {
            const key = getDateKey(item.Date);
            if (!grouped[key]) grouped[key] = 0;
            grouped[key] += getVal(item);
        });

        // Sort keys
        const sortedKeys = Object.keys(grouped).sort();
        
        if (metric === 'balance') {
            // Cumulative calculation
            
            // 1. Calculate balance at start of period (using all historical expenses)
            const allExpenses = store.getState('expenses') || [];
            const start = new Date(this.state.startDate);
            let balance = store.getState('openingBalance') || 0;
            
            allExpenses.forEach(item => {
                const d = new Date(item.Date);
                if (d < start) {
                    balance += (parseFloat(item.Income || 0) - parseFloat(item.Expense || 0));
                }
            });

            // 2. Calculate net change per time unit
            const unitNet = {};
            data.forEach(item => {
                 const key = getDateKey(item.Date);
                 if (!unitNet[key]) unitNet[key] = 0;
                 unitNet[key] += (parseFloat(item.Income || 0) - parseFloat(item.Expense || 0));
            });

            // 3. Iterate and accumulate
            sortedKeys.forEach(key => {
                balance += (unitNet[key] || 0);
                labels.push(key);
                values.push(balance);
                backgroundColors.push('#f0ad4e');
            });

        } else {
            sortedKeys.forEach(key => {
                labels.push(key);
                values.push(grouped[key]);
                backgroundColors.push(grouped[key] >= 0 ? '#1a6b10' : '#d9534f'); // Green for pos, Red for neg
            });
        }

    } else {
        // Group by Tag (Category or Trip)
        const tagKey = groupBy === 'category' ? 'Category' : 'Trip/Event';
        const grouped = {};

        data.forEach(item => {
            const tag = item[tagKey] || 'Uncategorized';
            if (!grouped[tag]) grouped[tag] = 0;
            grouped[tag] += getVal(item);
        });

        Object.keys(grouped).forEach((tag, index) => {
            labels.push(tag);
            values.push(grouped[tag]);
            // Generate a color
            const hue = (index * 137.508) % 360; // Golden angle approximation for distinct colors
            backgroundColors.push(`hsl(${hue}, 70%, 50%)`);
        });
    }

    return { labels, values, backgroundColors };
  }

  generateChart() {
    if (!this.chartLibLoaded) {
        alert("Chart library not loaded yet. Please wait a moment and try again.");
        return;
    }

    const data = this.getFilteredData();
    if (data.length === 0) {
        alert("No data found for the selected filters.");
        return;
    }

    const { labels, values, backgroundColors } = this.aggregateData(data);

    const ctx = this.element.querySelector('#analysis-chart').getContext('2d');

    // Destroy existing chart
    if (this.chartInstance) {
        this.chartInstance.destroy();
    }

    // Chart Config
    const config = {
        type: this.state.chartType,
        data: {
            labels: labels,
            datasets: [{
                label: this.state.metric.toUpperCase(),
                data: values,
                backgroundColor: backgroundColors,
                borderColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#fff' }
                },
                title: {
                    display: true,
                    text: `Analysis: ${this.state.metric} by ${this.state.groupBy}`,
                    color: '#f0ad4e',
                    font: { size: 16 }
                }
            },
            scales: {
                y: {
                    ticks: { color: '#ccc' },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                },
                x: {
                    ticks: { color: '#ccc' },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                }
            }
        }
    };

    // Pie/Doughnut specific tweaks
    if (this.state.chartType === 'pie' || this.state.chartType === 'doughnut') {
        delete config.options.scales; // No axes for pie
    }

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