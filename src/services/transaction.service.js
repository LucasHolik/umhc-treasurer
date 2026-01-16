import { sortData } from "../features/transactions/transactions.logic.js";

const TransactionService = {
  /**
   * Merges raw expenses with split transaction history.
   * Removes original "Source" transactions and injects "Child" splits.
   *
   * @param {Array} rawExpenses - The original list of transactions from the sheet.
   * @param {Array} splitHistory - The list of split definitions (Source and Child rows).
   * @returns {Array} - The processed list with splits baked in.
   */
  mergeSplits: (rawExpenses, splitHistory) => {
    if (!splitHistory || splitHistory.length === 0) {
      return [...rawExpenses];
    }

    // 1. Identify Split Groups and Children
    const splitMap = new Map(); // GroupID -> [Children]
    const sourceGroupIds = new Set(); // GroupIDs that have a Source (to be removed)

    splitHistory.forEach((item) => {
      const gid = item["Split Group ID"];
      if (!gid) return;

      if (item["Split Type"] === "SOURCE") {
        sourceGroupIds.add(gid);
      } else if (item["Split Type"] === "CHILD") {
        if (!splitMap.has(gid)) {
          splitMap.set(gid, []);
        }
        splitMap.get(gid).push(item);
      }
    });

    // 2. Build the new list
    let processedList = [];
    const processedGroupIds = new Set();

    rawExpenses.forEach((row) => {
      const gid = row["Split Group ID"];

      // If this row is part of a split group
      // Safe guard: check if row is explicitly a CHILD. If so, treat as normal transaction.
      // (Note: rawExpenses typically lacks "Split Type", so undefined !== "CHILD" works for Source rows)
      if (gid && sourceGroupIds.has(gid) && row["Split Type"] !== "CHILD") {
        // If we haven't processed this group yet
        if (!processedGroupIds.has(gid)) {
          // If we have children for this group, add them
          if (splitMap.has(gid)) {
            const children = splitMap.get(gid);
            processedList.push(...children);
          } else {
            console.warn(
              `SOURCE group ${gid} has no CHILD entries. Keeping original transaction.`,
            );
            processedList.push(row);
          }
          // Mark group as processed so we don't add children multiple times
          // (In case multiple rows map to same group, which shouldn't happen for Source, but safety first)
          processedGroupIds.add(gid);
        }
        // We intentionally DO NOT push the current 'row' if it is a Source or related to the group
        // because we replaced it with children.
      } else {
        // Standard transaction, keep it.
        processedList.push(row);
      }
    });

    // 3. Sort by Date (descending) to ensure children appear correctly relative to others
    // We reuse the existing sort logic to maintain consistency
    // Note: passing false for 'ascending' parameter sorts in descending order.
    return sortData(processedList, "Date", false);
  },
};

export default TransactionService;
