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
