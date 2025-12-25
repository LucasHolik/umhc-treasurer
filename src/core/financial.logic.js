import { formatCurrency } from "./utils.js";

/**
 * Calculates the manual offset, adjusted opening balance, and current balance.
 * Manual transactions are used to adjust the opening balance (e.g. historical data).
 * Adjusted Opening Balance = Configured Opening Balance + (Manual Expenses - Manual Income)
 * Current Balance = Adjusted Opening Balance + Total Income - Total Expenses
 *
 * @param {number} openingBalance - The configured initial balance.
 * @param {Array} transactions - List of all transactions.
 * @returns {object} - { manualOffset, adjustedOpeningBalance, currentBalance, totalIncome, totalExpenses }
 */
export function calculateFinancials(openingBalance, transactions) {
  let manualIncome = 0;
  let manualExpense = 0;
  let totalIncome = 0;
  let totalExpenses = 0;

  const safeTransactions = transactions || [];

  safeTransactions.forEach((item) => {
    const inc = item.Income
      ? parseFloat(String(item.Income).replace(/,/g, ""))
      : 0;
    const exp = item.Expense
      ? parseFloat(String(item.Expense).replace(/,/g, ""))
      : 0;
    const safeInc = isNaN(inc) ? 0 : inc;
    const safeExp = isNaN(exp) ? 0 : exp;

    if (item.Type === "Manual") {
      manualIncome += safeInc;
      manualExpense += safeExp;
    }

    totalIncome += safeInc;
    totalExpenses += safeExp;
  });

  // Manual Offset: If we manually added income, we subtract it from the running total calculation
  // because it's technically "pre-existing" money or an adjustment, not "new" income.
  // However, the formula observed was: Offset = ManualExpense - ManualIncome.
  // And Balance = Opening + Offset + TotalIncome - TotalExpense.
  const manualOffset = manualExpense - manualIncome;
  const adjustedOpeningBalance = openingBalance + manualOffset;
  const currentBalance = adjustedOpeningBalance + totalIncome - totalExpenses;

  return {
    manualOffset,
    adjustedOpeningBalance,
    currentBalance,
    totalIncome,
    totalExpenses,
  };
}
