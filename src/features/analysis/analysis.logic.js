// src/features/analysis/analysis.logic.js

import store from '../../core/state.js';
import { getDateRange } from '../../core/utils.js';
import { calculateFinancials } from '../../core/financial.logic.js';

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
    if (timeframe === "custom") return null;

    if (timeframe === "all_time") {
        let start;
        if (expenses && expenses.length > 0) {
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
            start = found ? earliest : new Date(2000, 0, 1);
        } else {
            start = new Date(2000, 0, 1);
        }
        return { start, end: new Date() };
    }

    return getDateRange(timeframe);
  }


  /**
   * Checks if a transaction belongs to a trip with the specified status.
   * @param {Object} item - The transaction item.
   * @param {Object} tripStatusMap - Map of trip names to their status ('Active', 'Completed').
   * @param {string} tripStatusFilter - The desired trip status to filter by ('Active', 'Completed', 'All').
   * @returns {boolean} True if the transaction matches the trip status filter, false otherwise.
   */
  isTransactionInTripStatus(item, tripStatusMap, tripStatusFilter) {
    const tripName = item['Trip/Event'];

    // If the filter is 'All' or empty, all transactions pass this filter
    if (tripStatusFilter === 'All' || tripStatusFilter === '') {
        return true;
    }

    // If there's no trip name, and a specific filter is applied (not 'All' or empty),
    // then this transaction should not pass the filter.
    if (!tripName) {
        return false;
    }

    const actualStatus = tripStatusMap[tripName];

    // If the trip doesn't have a status in the map, and a specific filter is applied,
    // then this transaction should not pass the filter.
    if (!actualStatus) {
        return false;
    }

    // Now, a specific filter is applied, tripName exists, and actualStatus exists.
    // Check if the actual status matches the filter.
    return actualStatus === tripStatusFilter;
  }

  /**
   * Filters the raw expenses data based on date range, selected tags, and trip status.
   * @param {Array<Object>} expenses - The raw list of expense objects.
   * @param {Object} filterState - An object containing startDate, endDate, selectedCategories, selectedTrips, tripStatusFilter.
   * @param {Object} tripStatusMap - Map of trip names to their status ('Active', 'Completed').
   * @returns {Array<Object>} The filtered list of expense objects.
   */
  getFilteredData(expenses, filterState, tripStatusMap) {
    const { startDate, endDate, selectedCategories, selectedTrips, tripStatusFilter } = filterState;
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

        // Trip Status Filter
        if (!this.isTransactionInTripStatus(item, tripStatusMap, tripStatusFilter)) {
            return false;
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
        const openingBalance = store.getState('openingBalance') || 0;
        
        // Use adjustedOpeningBalance as the true starting point.
        // This accounts for Manual transactions (which adjust the start)
        // while the loop below accounts for their timeline effect.
        // Result: Correct running balance at any point in time.
        const { adjustedOpeningBalance } = calculateFinancials(openingBalance, allExpenses);
        let balance = adjustedOpeningBalance;
        
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

  /**
   * Calculates the "Effective Balance" (Safe-to-Spend).
   * Effective Balance = Current Balance - Net Contribution of Active Trips.
   * This removes money that is currently tied up in ongoing trips/events.
   * @param {number} currentBalance - The total current balance of the treasury.
   * @param {Array<Object>} expenses - The full list of expense objects.
   * @param {Object} tags - The tags object from the store containing TripStatusMap.
   * @returns {number} The effective balance.
   */
  calculateEffectiveBalance(currentBalance, expenses, tags) {
    const tripStatusMap = tags.TripStatusMap || {};
    
    // Filter expenses for active trips
    // We want transactions where Trip/Event matches a key in TripStatusMap with value 'Active'
    const activeTripExpenses = expenses.filter(item => {
        const tripName = item['Trip/Event'];
        return tripName && tripStatusMap[tripName] === 'Active';
    });

    // Calculate Net sum of active transactions
    let netActiveContribution = 0;
    activeTripExpenses.forEach(item => {
        const inc = item.Income ? parseFloat(String(item.Income).replace(/,/g, '')) : 0;
        const exp = item.Expense ? parseFloat(String(item.Expense).replace(/,/g, '')) : 0;
        const safeInc = isNaN(inc) ? 0 : inc;
        const safeExp = isNaN(exp) ? 0 : exp;
        netActiveContribution += (safeInc - safeExp);
    });

    return currentBalance - netActiveContribution;
  }
}

export default new AnalysisLogic();