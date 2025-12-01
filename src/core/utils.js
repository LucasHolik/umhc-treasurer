// src/core/utils.js

// Shared helper functions will be added here.

/**
 * Formats a number or string into a currency string with 2 decimal places.
 * e.g. 4 -> "4.00", "4.5" -> "4.50", "1,234" -> "1234.00"
 * @param {string|number} amount
 * @returns {string}
 */
export function formatCurrency(amount) {
  if (amount === null || amount === undefined || amount === '') {
    return '';
  }
  
  let num;
  if (typeof amount === 'string') {
      // Remove commas to handle formatted strings like "1,234.56"
      num = parseFloat(amount.replace(/,/g, ''));
  } else {
      num = parseFloat(amount);
  }

  if (isNaN(num)) {
    return amount.toString(); // Return original if not a valid number
  }
  return num.toFixed(2);
}

export function parseDate(dateString) {
    if (!dateString) return null;
    let date = new Date(dateString);
    if (isNaN(date.getTime())) {
      const formattedDate = dateString.replace(/[-./]/g, "/");
      date = new Date(formattedDate);
    }
    if (isNaN(date.getTime())) return null;
    return date;
}

export function getCurrentMonthRange() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start, end };
}
  
export function getPastDaysRange(days) {
    const now = new Date();
    const start = new Date();
    start.setDate(now.getDate() - days);
    return { start, end: now };
}
  
export function getPastMonthsRange(months) {
    const now = new Date();
    const start = new Date();
    start.setMonth(now.getMonth() - months);
    return { start, end: now };
}
  
export function getPastYearRange() {
    const now = new Date();
    const start = new Date();
    start.setFullYear(now.getFullYear() - 1);
    return { start, end: now };
}

export function filterTransactionsByTimeframe(transactions, timeframe) {
    if (!transactions || transactions.length === 0) return [];
    if (timeframe === "all_time") return transactions;

    let { start, end } = { start: null, end: new Date() };

    switch (timeframe) {
      case "current_month":
        ({ start, end } = getCurrentMonthRange());
        break;
      case "past_30_days":
        ({ start, end } = getPastDaysRange(30));
        break;
      case "past_3_months":
        ({ start, end } = getPastMonthsRange(3));
        break;
      case "past_6_months":
        ({ start, end } = getPastMonthsRange(6));
        break;
      case "past_year":
        ({ start, end } = getPastYearRange());
        break;
      default:
        ({ start, end } = getPastDaysRange(30));
    }

    return transactions.filter((transaction) => {
      const date = parseDate(transaction.Date);
      if (!date) return false;
      return date >= start && date <= end;
    });
}