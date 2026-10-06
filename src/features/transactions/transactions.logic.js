import { parseAmount, parseDate } from "../../core/utils.js";
import {
  getTripStatusStyle,
  partitionTripsByStatus,
} from "../../core/trip-status.js";

export const filterData = (
  data,
  { selectedCategories, selectedTrips, descriptionSearch },
) => {
  const NO_TAG = "__NO_TAG__";

  return data.filter((item) => {
    // Description Filter
    if (descriptionSearch) {
      const description = (item["Description"] || "").toLowerCase();
      if (!description.includes(descriptionSearch.toLowerCase())) {
        return false;
      }
    }

    // Category Filter
    let categoryMatch = true;
    if (selectedCategories && selectedCategories.size > 0) {
      const itemCat = item["Category"];
      const hasNoTag = selectedCategories.has(NO_TAG);
      categoryMatch = selectedCategories.has(itemCat) || (hasNoTag && !itemCat);
    }

    // Trip Filter
    let tripMatch = true;
    if (selectedTrips && selectedTrips.size > 0) {
      const itemTrip = item["Trip/Event"];
      const hasNoTag = selectedTrips.has(NO_TAG);
      tripMatch = selectedTrips.has(itemTrip) || (hasNoTag && !itemTrip);
    }

    return categoryMatch && tripMatch;
  });
};

export const sortData = (data, field, ascending) => {
  return [...data].sort((a, b) => {
    let valA = a[field] || "";
    let valB = b[field] || "";

    if (field === "Net") {
      const incomeA = parseAmount(a["Income"]);
      const expenseA = parseAmount(a["Expense"]);
      valA = incomeA - expenseA;

      const incomeB = parseAmount(b["Income"]);
      const expenseB = parseAmount(b["Expense"]);
      valB = incomeB - expenseB;
    } else if (field === "Income" || field === "Expense") {
      const numA = parseAmount(valA);
      const numB = parseAmount(valB);

      const isPosA = numA > 0;
      const isPosB = numB > 0;

      if (isPosA && !isPosB) return ascending ? -1 : 1;
      if (!isPosA && isPosB) return ascending ? 1 : -1;

      if (isPosA && isPosB) {
        valA = numA;
        valB = numB;
      } else {
        const otherField = field === "Income" ? "Expense" : "Income";
        valA = parseAmount(a[otherField]);
        valB = parseAmount(b[otherField]);
      }
    } else if (field === "Date") {
      const dateA = parseDate(valA);
      const dateB = parseDate(valB);
      valA = !dateA || isNaN(dateA.getTime()) ? Infinity : dateA.getTime();
      valB = !dateB || isNaN(dateB.getTime()) ? Infinity : dateB.getTime();
    }

    if (valA < valB) return ascending ? -1 : 1;
    if (valA > valB) return ascending ? 1 : -1;
    return 0;
  });
};

/**
 * Builds TagSelector options for a tag type. Trip/Event tags are split into
 * current tags (listed) and past tags (behind "See past tags", each with its
 * status label as a hint). Other types keep the selector's default list.
 *
 * @param {string} type - "Trip/Event" | "Category" | ...
 * @param {Object} tagsData - store.tags
 * @returns {{customOptions: string[]|null, pastOptions: Array<{value: string, hint: string}>}}
 */
export const buildTagSelectorOptions = (type, tagsData) => {
  if (type !== "Trip/Event") return { customOptions: null, pastOptions: [] };
  return buildTripSelectorOptions(tagsData);
};

/**
 * @param {Object} tagsData - store.tags
 * @returns {{customOptions: string[], pastOptions: Array<{value: string, hint: string}>}}
 */
export const buildTripSelectorOptions = (tagsData) => {
  const tags = tagsData || {};
  const tripStatusMap = tags.TripStatusMap || {};
  const { current, past } = partitionTripsByStatus(
    tags["Trip/Event"] || [],
    tripStatusMap,
  );
  return {
    customOptions: current,
    pastOptions: past.map((trip) => ({
      value: trip,
      hint: getTripStatusStyle(tripStatusMap[trip]).label,
    })),
  };
};
