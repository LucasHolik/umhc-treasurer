// src/core/trip-status.js
//
// Trip/Event status constants and pure helpers. Shared by Tags,
// Transactions and Analysis, so the rules live in one place.
// No DOM, no store.
//
// CURRENT status: "Active" | "Investment"
// PAST status:    "Completed" | "Completed Investment"
// A missing or unrecognised status counts as "Active" (current), so a typo
// in the sheet can never hide a tag someone needs.

export const TRIP_STATUS = Object.freeze({
  ACTIVE: "Active",
  COMPLETED: "Completed",
  INVESTMENT: "Investment",
  COMPLETED_INVESTMENT: "Completed Investment",
});

// Display order
export const TRIP_STATUSES = Object.freeze([
  TRIP_STATUS.ACTIVE,
  TRIP_STATUS.COMPLETED,
  TRIP_STATUS.INVESTMENT,
  TRIP_STATUS.COMPLETED_INVESTMENT,
]);

export const PAST_TRIP_STATUSES = Object.freeze([
  TRIP_STATUS.COMPLETED,
  TRIP_STATUS.COMPLETED_INVESTMENT,
]);

// Icons must stay distinct from each other (accessibility mode relies on
// shape, not colour).
export const TRIP_STATUS_STYLES = Object.freeze({
  [TRIP_STATUS.ACTIVE]: Object.freeze({
    icon: "◯",
    color: "#888",
    label: "Active",
  }),
  [TRIP_STATUS.COMPLETED]: Object.freeze({
    icon: "✅",
    color: "#5cb85c",
    label: "Completed",
  }),
  [TRIP_STATUS.INVESTMENT]: Object.freeze({
    icon: "🚀",
    color: "#5bc0de",
    label: "Investment",
  }),
  [TRIP_STATUS.COMPLETED_INVESTMENT]: Object.freeze({
    icon: "🏦",
    color: "#c9a227",
    label: "Completed Investment",
  }),
});

// Click-to-cycle order on the Tags page:
// Active -> Completed -> Investment -> Completed Investment -> Active
export const NEXT_TRIP_STATUS = Object.freeze({
  [TRIP_STATUS.ACTIVE]: TRIP_STATUS.COMPLETED,
  [TRIP_STATUS.COMPLETED]: TRIP_STATUS.INVESTMENT,
  [TRIP_STATUS.INVESTMENT]: TRIP_STATUS.COMPLETED_INVESTMENT,
  [TRIP_STATUS.COMPLETED_INVESTMENT]: TRIP_STATUS.ACTIVE,
});

/**
 * @param {*} status - Raw status from TripStatusMap.
 * @returns {string} The status if recognised, otherwise "Active".
 */
export function normaliseTripStatus(status) {
  return TRIP_STATUSES.includes(status) ? status : TRIP_STATUS.ACTIVE;
}

/**
 * @param {*} status - Raw status from TripStatusMap.
 * @returns {boolean} True only for "Completed" and "Completed Investment".
 */
export function isPastTripStatus(status) {
  return PAST_TRIP_STATUSES.includes(status);
}

/**
 * @param {*} status - Raw status from TripStatusMap.
 * @returns {{icon: string, color: string, label: string}}
 */
export function getTripStatusStyle(status) {
  return TRIP_STATUS_STYLES[normaliseTripStatus(status)];
}

/**
 * @param {*} status - Raw status from TripStatusMap.
 * @returns {string} The status a click on the Tags page moves to.
 */
export function getNextTripStatus(status) {
  return NEXT_TRIP_STATUS[normaliseTripStatus(status)];
}

/**
 * Splits trips into current and past by their status.
 * Keeps input order and drops non-string entries.
 *
 * @param {Array} trips - Trip/Event tag names.
 * @param {Object} tripStatusMap - { [tripName]: status }
 * @returns {{current: string[], past: string[]}}
 */
export function partitionTripsByStatus(trips, tripStatusMap) {
  const statusMap = tripStatusMap || {};
  const current = [];
  const past = [];

  (trips || []).forEach((trip) => {
    if (typeof trip !== "string") return;
    const status = Object.prototype.hasOwnProperty.call(statusMap, trip)
      ? statusMap[trip]
      : undefined;
    if (isPastTripStatus(status)) past.push(trip);
    else current.push(trip);
  });

  return { current, past };
}
