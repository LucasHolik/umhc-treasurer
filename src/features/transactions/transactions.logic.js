import { parseAmount, parseDate } from "../../core/utils.js";

export const filterData = (
  data,
  { selectedCategories, selectedTrips, descriptionSearch }
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

      if (isPosA && !isPosB) return -1;
      if (!isPosA && isPosB) return 1;

      if (isPosA && isPosB) {
        valA = numA;
        valB = numB;
      } else {
        const otherField = field === "Income" ? "Expense" : "Income";
        valA = parseAmount(a[otherField]);
        valB = parseAmount(b[otherField]);
      }
    } else if (field === "Date") {
      valA = parseDate(valA) || new Date(0);
      valB = parseDate(valB) || new Date(0);
    }

    if (valA < valB) return ascending ? -1 : 1;
    if (valA > valB) return ascending ? 1 : -1;
    return 0;
  });
};
