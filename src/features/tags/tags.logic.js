import { filterTransactionsByTimeframe } from "../../core/utils.js";

/**
 * Calculates a "virtual" TripTypeMap by applying pending queue operations
 * to the original map.
 *
 * @param {Object} originalMap - The original TripTypeMap from store
 * @param {Array} queue - Array of pending operations
 * @returns {Object} A new TripTypeMap with operations applied
 */
export const getVirtualTripTypeMap = (originalMap, queue) => {
  let virtualMap = { ...(originalMap || {}) };

  if (!queue || queue.length === 0) return virtualMap;

  queue.forEach((op) => {
    if (op.type === "updateTripType") {
      if (op.newValue === "") {
        delete virtualMap[op.oldValue];
      } else {
        virtualMap[op.oldValue] = op.newValue;
      }
    }
    // Handle renames/deletes for Type Map
    if (op.type === "rename" && op.tagType === "Trip/Event") {
      if (virtualMap[op.oldValue]) {
        virtualMap[op.newValue] = virtualMap[op.oldValue];
        delete virtualMap[op.oldValue];
      }
    }
    if (op.type === "delete" && op.tagType === "Trip/Event") {
      delete virtualMap[op.value];
    }
  });

  return virtualMap;
};

/**
 * Calculates a "virtual" TripStatusMap by applying pending queue operations.
 *
 * @param {Object} originalMap - The original TripStatusMap from store
 * @param {Array} queue - Array of pending operations
 * @returns {Object} A new TripStatusMap with operations applied
 */
export const getVirtualTripStatusMap = (originalMap, queue) => {
  let virtualMap = { ...(originalMap || {}) };

  if (!queue || queue.length === 0) return virtualMap;

  queue.forEach((op) => {
    if (op.type === "updateTripStatus") {
      virtualMap[op.oldValue] = op.newValue;
    }
    // Handle renames/deletes for Status Map
    if (op.type === "rename" && op.tagType === "Trip/Event") {
      const status = virtualMap[op.oldValue] || "Active";
      delete virtualMap[op.oldValue];
      virtualMap[op.newValue] = status;
    }
    if (op.type === "delete" && op.tagType === "Trip/Event") {
      delete virtualMap[op.value];
    }
    // New trips default to Active
    if (op.type === "add" && op.tagType === "Trip/Event") {
      virtualMap[op.value] = "Active";
    }
  });

  return virtualMap;
};

/**
 * Parses a currency string or number into a float.
 * @param {string|number} val
 * @returns {number}
 */
const parseAmount = (val) => {
  if (!val) return 0;
  if (typeof val === "number") return val;
  return parseFloat(val.toString().replace(/,/g, "")) || 0;
};

/**
 * Calculates count, income, and expense stats for a list of transactions.
 * Used by TagsDetails.
 *
 * @param {Array} transactions
 * @returns {Object} { count, income, expense }
 */
export const calculateDetailStats = (transactions) => {
  let count = 0;
  let income = 0;
  let expense = 0;

  transactions.forEach((item) => {
    count++;
    income += parseAmount(item["Income"]);
    expense += parseAmount(item["Expense"]);
  });

  return { count, income, expense };
};

/**
 * aggregateStats
 * Core logic for aggregating transaction data into tags.
 */
export const calculateTagStats = (
  allExpenses,
  tagsData,
  timeframe,
  queue = [],
  isEditMode = false
) => {
  const expenses = filterTransactionsByTimeframe(allExpenses, timeframe);
  const stats = { "Trip/Event": {}, Category: {}, Type: {} };

  // 1. Calculate Trip/Event and Category stats directly from expenses
  expenses.forEach((item) => {
    const tripEventTag = item["Trip/Event"];
    const categoryTag = item["Category"];
    const income = parseAmount(item["Income"]);
    const expense = parseAmount(item["Expense"]);

    if (tripEventTag) {
      if (!stats["Trip/Event"][tripEventTag])
        stats["Trip/Event"][tripEventTag] = { count: 0, income: 0, expense: 0 };
      stats["Trip/Event"][tripEventTag].count += 1;
      stats["Trip/Event"][tripEventTag].income += income;
      stats["Trip/Event"][tripEventTag].expense += expense;
    }
    if (categoryTag) {
      if (!stats["Category"][categoryTag])
        stats["Category"][categoryTag] = { count: 0, income: 0, expense: 0 };
      stats["Category"][categoryTag].count += 1;
      stats["Category"][categoryTag].income += income;
      stats["Category"][categoryTag].expense += expense;
    }
  });

  // 2. Calculate Type stats by aggregating Trip/Event stats based on TripTypeMap
  // Use virtualTripTypeMap to reflect pending changes
  const tripTypeMap = getVirtualTripTypeMap(tagsData.TripTypeMap, queue);

  // Also get virtual status map for return (component might use it)
  const tripStatusMap = getVirtualTripStatusMap(tagsData.TripStatusMap, queue);

  Object.entries(stats["Trip/Event"]).forEach(([tripName, tripStats]) => {
    const type = tripTypeMap[tripName];
    if (type) {
      if (!stats["Type"][type])
        stats["Type"][type] = { count: 0, income: 0, expense: 0 };
      stats["Type"][type].count += tripStats.count;
      stats["Type"][type].income += tripStats.income;
      stats["Type"][type].expense += tripStats.expense;
    }
  });

  // Ensure all "Types" exist in stats even if count is 0
  const types = tagsData["Type"] || [];
  types.forEach((t) => {
    if (!stats["Type"][t])
      stats["Type"][t] = { count: 0, income: 0, expense: 0 };
  });

  // 3. Handle Queue (Virtual Updates) - specific for renames/deletes in edit mode that affect stats display
  if (isEditMode && queue && queue.length > 0) {
    queue.forEach((op) => {
      if (op.type === "rename") {
        const type = op.tagType; // "Trip/Event", "Category", "Type"
        if (stats[type]) {
          const oldStats = stats[type][op.oldValue] || {
            count: 0,
            income: 0,
            expense: 0,
          };
          if (stats[type][op.newValue]) {
            stats[type][op.newValue].count += oldStats.count;
            stats[type][op.newValue].income += oldStats.income;
            stats[type][op.newValue].expense += oldStats.expense;
          } else {
            stats[type][op.newValue] = { ...oldStats };
          }
          delete stats[type][op.oldValue];
        }
      } else if (op.type === "delete") {
        if (stats[op.tagType]) delete stats[op.tagType][op.value];
      }
    });
  }

  return { stats, tripTypeMap, tripStatusMap };
};

/**
 * Formats the edit queue into API operations.
 *
 * @param {Array} queue
 * @returns {Array} Array of operations for the API
 */
export const formatOperationsForApi = (queue) => {
  return queue
    .map((op) => {
      if (op.type === "add") return [null, op.value, "add", op.tagType];
      if (op.type === "delete") return [op.value, null, "delete", op.tagType];
      if (op.type === "rename")
        return [op.oldValue, op.newValue, "rename", op.tagType];
      if (op.type === "updateTripType")
        return [op.oldValue, op.newValue, "updateTripType", op.tagType];
      if (op.type === "updateTripStatus")
        return [op.oldValue, op.newValue, "updateTripStatus", "Trip/Event"];
      return null;
    })
    .filter((op) => op !== null);
};
