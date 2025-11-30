// src/features/analysis/analysis.logic.js

import store from '../../core/state.js';

class AnalysisLogic {
  constructor() {
    // This class will primarily contain static or utility methods,
    // so a constructor isn't strictly necessary for state, but useful for context.
  }

  /**
   * Calculates the start and end dates based on a given timeframe string.
   * @param {string} timeframe - The predefined timeframe (e.g., 'current_month', 'past_30_days', 'all_time').
   * @param {string[]} expenses - The full list of expense items from the store.
   * @returns {{start: Date, end: Date}|null} An object with start and end Date objects, or null if custom.
   */
  calculateDateRange(timeframe, expenses) {
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
      case "custom":
        return null;
      default:
        // Default to past_30_days if an unknown timeframe is passed
        start.setDate(now.getDate() - 30);
        break;
    }
    return { start, end };
  }

  /**
   * Filters the raw expenses data based on date range and selected tags.
   * @param {Array<Object>} expenses - The raw list of expense objects.
   * @param {Object} filterState - An object containing startDate, endDate, selectedCategories, selectedTrips.
   * @returns {Array<Object>} The filtered list of expense objects.
   */
  getFilteredData(expenses, filterState) {
    const { startDate, endDate, selectedCategories, selectedTrips } = filterState;
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // Include the whole end day

    return expenses.filter(item => {
        const date = new Date(item.Date);
        if (isNaN(date.getTime())) return false;
        if (date < start || date > end) return false;

        // Category Filter (AND logic)
        if (selectedCategories.size > 0) {
            const itemCategory = item.Category || '';
            if (!selectedCategories.has(itemCategory)) {
                return false;
            }
        }

        // Trip Filter (AND logic)
        if (selectedTrips.size > 0) {
            const itemTrip = item['Trip/Event'] || '';
            if (!selectedTrips.has(itemTrip)) {
                return false;
            }
        }

        return true;
    });
  }

  /**
   * Aggregates financial data based on primary and secondary grouping, and a specified metric.
   * @param {Array<Object>} data - The filtered list of expense objects.
   * @param {Object} aggregationState - State controlling aggregation (primaryGroup, secondaryGroup, metric, timeUnit, startDate, openingBalance).
   * @returns {{labels: Array<string>, datasets: Array<Object>}} Data structured for Chart.js.
   */
  aggregateData(data, aggregationState) {
    const { primaryGroup, secondaryGroup, metric, timeUnit, startDate } = aggregationState;
    const allExpenses = store.getState('expenses') || []; // Needed for balance pre-calculation
    
    const primaryMap = {}; 
    const allSecondaryKeys = new Set();

    const getVal = (item) => {
        const inc = parseFloat(item.Income || 0);
        const exp = parseFloat(item.Expense || 0);
        if (metric === 'income') return inc;
        if (metric === 'expense') return exp;
        if (metric === 'net') return inc - exp;
        // For balance calculation, individual item value is always net
        return inc - exp; 
    };

    const getKey = (item, type) => {
        if (type === 'date') {
             const date = new Date(item.Date);
             if (timeUnit === 'day') return date.toISOString().split('T')[0];
             if (timeUnit === 'week') {
                 // Adjust date to the start of the week (Monday)
                 const day = date.getDay();
                 const diff = date.getDate() - day + (day === 0 ? -6 : 1); // If Sunday (0), go back 6 days to Monday
                 return new Date(date.setDate(diff)).toISOString().split('T')[0];
             }
             if (timeUnit === 'year') return date.getFullYear().toString();
             return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // Month format YYYY-MM
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
    
    // Special handling for 'balance' metric, which is cumulative
    if (metric === 'balance' && primaryGroup === 'date' && secondaryGroup === 'none') {
        const labels = [];
        const values = [];
        
        const calculationStart = new Date(startDate);
        let balance = store.getState('openingBalance') || 0;
        
        // Pre-calculate balance for transactions *before* the current analysis window
        allExpenses.forEach(item => {
            const itemDate = new Date(item.Date);
            if (!isNaN(itemDate.getTime()) && itemDate < calculationStart) {
                balance += (parseFloat(item.Income||0) - parseFloat(item.Expense||0));
            }
        });

        // Apply changes within the window
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
    
    // Helper for consistent color generation
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
        const colors = labels.map((k, i) => {
            // Apply conditional coloring (green for positive, red for negative) only for non-balance, date-grouped charts
            if (primaryGroup === 'date' && metric !== 'balance') {
                return dataPoints[i] >= 0 ? '#1a6b10' : '#d9534f';
            }
            return getColor(k, i);
        });
        
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
                stack: 'stack1' // For stacked bar charts
            });
        });
    }

    return { labels, datasets };
  }

  /**
   * Calculates key summary statistics for the filtered data.
   * @param {Array<Object>} filteredData - The data after filtering by date and tags.
   * @returns {{totalIncome: number, totalExpense: number, netChange: number, transactionCount: number}}
   */
  calculateSummaryStats(filteredData) {
    let totalIncome = 0;
    let totalExpense = 0;

    filteredData.forEach(item => {
      totalIncome += parseFloat(item.Income || 0);
      totalExpense += parseFloat(item.Expense || 0);
    });

    const netChange = totalIncome - totalExpense;
    const transactionCount = filteredData.length;

    return {
      totalIncome,
      totalExpense,
      netChange,
      transactionCount,
    };
  }
}

export default new AnalysisLogic();