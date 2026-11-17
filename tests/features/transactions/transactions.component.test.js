// tests/features/transactions/transactions.component.test.js
//
// Tests for TagSelector outside-click dismissal, trigger toggling, remove
// handling, and SplitTransactionModal suppression inside TransactionsComponent
// across both desktop table and mobile card views.

import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import store, { DEFAULT_AI_STATUS } from "../../../src/core/state.js";
import TransactionsComponent from "../../../src/features/transactions/transactions.component.js";

const originalMatchMedia = window.matchMedia;
const activeComponents = new Set();

const SAMPLE_TAGS = {
  "Trip/Event": ["Winter Trip", "Summer Trip"],
  Category: ["Food", "Transport"],
  Type: [],
  TripTypeMap: {},
  TripStatusMap: {
    "Winter Trip": "Active",
    "Summer Trip": "Active",
  },
};

const SAMPLE_EXPENSES = [
  {
    row: 2,
    Date: "2026-11-01",
    Description: "TESCO STORES",
    Income: "",
    Expense: "12.50",
    "Trip/Event": "Winter Trip",
    Category: "",
  },
  {
    row: 3,
    Date: "2026-11-02",
    Description: "TRAINLINE",
    Income: "",
    Expense: "25.00",
    "Trip/Event": "",
    Category: "Transport",
  },
];

const setViewportMobile = (isMobile) => {
  window.matchMedia = (query) => ({
    matches: isMobile,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false;
    },
  });
};

const mountTransactions = ({ isMobile = false } = {}) => {
  setViewportMobile(isMobile);
  store.setState("currentUser", { canEdit: true, role: "admin" });
  store.setState("tags", SAMPLE_TAGS);
  store.setState("expenses", SAMPLE_EXPENSES);

  const root = document.createElement("div");
  document.body.appendChild(root);

  const component = new TransactionsComponent(root);
  activeComponents.add(component);
  return { root, component };
};

afterEach(() => {
  // Close any open modal via its close button so document keydown listeners are removed.
  document
    .querySelectorAll(".modal-overlay .modal-close")
    .forEach((btn) => btn.click());

  for (const component of activeComponents) {
    component.destroy();
  }
  activeComponents.clear();

  window.matchMedia = originalMatchMedia;
  store.setState("expenses", []);
  store.setState("rawExpenses", []);
  store.setState("tags", {
    "Trip/Event": [],
    Category: [],
    Type: [],
    TripTypeMap: {},
    TripStatusMap: {},
  });
  store.setState("currentUser", null);
  store.setState("isLoading", false);
  store.setState("isTagging", false);
  store.setState("taggingSource", null);
  store.setState("savingSplitTransaction", false);
  store.setState("splitTransactions", null);
  store.setState("taggingProgress", null);
  store.setState("ai", DEFAULT_AI_STATUS);
  store.setState("transactionParams", null);
  document.body.innerHTML = "";
});

test("desktop: clicking section background or a table row cell closes the tag list without opening SplitTransactionModal", () => {
  const { root, component } = mountTransactions({ isMobile: false });

  const placeholder = root.querySelector(
    '.add-tag-placeholder[data-row="2"][data-type="Category"]',
  );
  placeholder.click();

  assert.equal(component.tagSelector.isOpen, true);
  assert.equal(component.tagSelector.element.style.display, "block");

  // Clicking section background closes the popover.
  root.querySelector("h2").click();
  assert.equal(component.tagSelector.isOpen, false);
  assert.equal(component.tagSelector.element.style.display, "none");
  assert.equal(document.querySelector(".modal-overlay"), null);

  // Re-open, then click a table row description cell: closes popover without opening split modal.
  placeholder.click();
  assert.equal(component.tagSelector.isOpen, true);

  const firstRowDescCell = root.querySelector("tbody tr td:nth-child(2)");
  firstRowDescCell.click();
  assert.equal(component.tagSelector.isOpen, false);
  assert.equal(document.querySelector(".modal-overlay"), null);

  // Clicking a table row cell while the tag list is closed still opens SplitTransactionModal.
  firstRowDescCell.click();
  const modalOverlay = document.querySelector(".modal-overlay");
  assert.ok(modalOverlay);
  modalOverlay.querySelector(".modal-close").click();
  assert.equal(document.querySelector(".modal-overlay"), null);
});

test("mobile: clicking a transaction card or background closes the tag list without opening SplitTransactionModal", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { root, component } = mountTransactions({ isMobile: true });

  const placeholder = root.querySelector(
    '.add-tag-placeholder[data-row="2"][data-type="Category"]',
  );
  placeholder.click();
  assert.equal(component.tagSelector.isOpen, true);

  // Clicking a mobile card closes the tag list without opening SplitTransactionModal.
  const cardTitle = root.querySelector(
    ".transaction-mobile-card .mobile-data-card__title",
  );
  cardTitle.click();
  assert.equal(component.tagSelector.isOpen, false);
  assert.equal(document.querySelector(".modal-overlay"), null);

  // Re-open and simulate an iOS Safari non-interactive tap (pointerdown + pointerup without click).
  placeholder.click();
  assert.equal(component.tagSelector.isOpen, true);

  const sectionBg = root.querySelector(".transactions-header");
  sectionBg.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 1,
      clientX: 15,
      clientY: 15,
    }),
  );
  sectionBg.dispatchEvent(
    new PointerEvent("pointerup", {
      bubbles: true,
      pointerId: 1,
      clientX: 15,
      clientY: 15,
    }),
  );
  t.mock.timers.tick(0);

  assert.equal(component.tagSelector.isOpen, false);
  assert.equal(document.querySelector(".modal-overlay"), null);
});

test("clicking the active add-tag placeholder or tag pill toggles the tag list closed and does not reopen it", () => {
  const { root, component } = mountTransactions({ isMobile: false });

  const placeholder = root.querySelector(
    '.add-tag-placeholder[data-row="2"][data-type="Category"]',
  );
  placeholder.click();
  assert.equal(component.tagSelector.isOpen, true);
  assert.equal(component.tagSelector.targetElement, placeholder);

  placeholder.click();
  assert.equal(component.tagSelector.isOpen, false);
  assert.equal(component.tagSelector.element.style.display, "none");

  const pill = root.querySelector(
    '.tag-pill[data-row="2"][data-type="Trip/Event"]',
  );
  pill.click();
  assert.equal(component.tagSelector.isOpen, true);
  assert.equal(component.tagSelector.targetElement, pill);

  // Clicking inside the pill label also toggles the active pill closed.
  pill.querySelector(".tag-text").click();
  assert.equal(component.tagSelector.isOpen, false);
  assert.equal(component.tagSelector.element.style.display, "none");
});

test("clicking a different tag trigger closes the previous session and opens on the new trigger", () => {
  const { root, component } = mountTransactions({ isMobile: false });

  const firstTrigger = root.querySelector(
    '.add-tag-placeholder[data-row="2"][data-type="Category"]',
  );
  const secondTrigger = root.querySelector(
    '.tag-pill[data-row="2"][data-type="Trip/Event"]',
  );
  const thirdTrigger = root.querySelector(
    '.add-tag-placeholder[data-row="3"][data-type="Trip/Event"]',
  );

  firstTrigger.click();
  assert.equal(component.tagSelector.isOpen, true);
  assert.equal(component.tagSelector.targetElement, firstTrigger);

  secondTrigger.click();
  assert.equal(component.tagSelector.isOpen, true);
  assert.equal(component.tagSelector.targetElement, secondTrigger);

  thirdTrigger.click();
  assert.equal(component.tagSelector.isOpen, true);
  assert.equal(component.tagSelector.targetElement, thirdTrigger);
});

test("clicking .remove-btn while the tag list is open removes the tag and hides the tag list", () => {
  const { root, component } = mountTransactions({ isMobile: false });

  const openTrigger = root.querySelector(
    '.add-tag-placeholder[data-row="2"][data-type="Category"]',
  );
  openTrigger.click();
  assert.equal(component.tagSelector.isOpen, true);

  const removeBtn = root.querySelector(
    '.tag-pill[data-row="2"][data-type="Trip/Event"] .remove-btn',
  );
  removeBtn.click();

  assert.equal(component.tagSelector.isOpen, false);
  assert.equal(component.tagSelector.element.style.display, "none");
  assert.equal(component.pendingChanges.get("2")["Trip/Event"], "");
  assert.equal(
    root.querySelector('.tag-pill[data-row="2"][data-type="Trip/Event"]'),
    null,
  );
});

test("clicking inside the tag list keeps it open, and clicking a tag item saves a pending change and hides the list", () => {
  const { root, component } = mountTransactions({ isMobile: false });

  const trigger = root.querySelector(
    '.add-tag-placeholder[data-row="2"][data-type="Category"]',
  );
  trigger.click();
  assert.equal(component.tagSelector.isOpen, true);

  // Clicking the search input inside the popover keeps it open.
  component.tagSelector.searchInput.click();
  assert.equal(component.tagSelector.isOpen, true);
  assert.equal(component.tagSelector.element.style.display, "block");

  // Selecting an item records the pending change and closes the popover.
  const foodItem = Array.from(
    component.tagSelector.element.querySelectorAll(".tag-selector-item"),
  ).find((item) => item.textContent === "Food");
  foodItem.click();

  assert.equal(component.tagSelector.isOpen, false);
  assert.equal(component.pendingChanges.get("2").Category, "Food");
  assert.equal(
    root.querySelector(
      '.tag-pill.pending-change[data-row="2"][data-type="Category"] .tag-text',
    ).textContent,
    "Food",
  );
});

test("renderTransactionsDisplay and store updates close an open tag list", () => {
  const { root, component } = mountTransactions({ isMobile: false });

  const placeholder = root.querySelector(
    '.add-tag-placeholder[data-row="2"][data-type="Category"]',
  );
  placeholder.click();
  assert.equal(component.tagSelector.isOpen, true);
  assert.equal(component.tagSelector.element.style.display, "block");

  // Direct re-render closes the open popover.
  component.renderTransactionsDisplay();
  assert.equal(component.tagSelector.isOpen, false);
  assert.equal(component.tagSelector.element.style.display, "none");

  // Re-open on freshly rendered trigger, then trigger a store update that re-renders the view.
  root
    .querySelector('.add-tag-placeholder[data-row="2"][data-type="Category"]')
    .click();
  assert.equal(component.tagSelector.isOpen, true);

  store.setState("savingSplitTransaction", true);
  assert.equal(component.tagSelector.isOpen, false);
  assert.equal(component.tagSelector.element.style.display, "none");
});

test("Escape on document closes an open tag list via handleInteractiveTagKeydown and Enter/Space toggle triggers", () => {
  const { root, component } = mountTransactions({ isMobile: false });

  const placeholder = root.querySelector(
    '.add-tag-placeholder[data-row="2"][data-type="Category"]',
  );
  placeholder.click();
  assert.equal(component.tagSelector.isOpen, true);

  // Move focus outside TagSelector so Escape relies on TransactionsComponent's document listener.
  placeholder.focus();
  assert.equal(
    component.tagSelector.element.contains(document.activeElement),
    false,
  );

  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  assert.equal(component.tagSelector.isOpen, false);
  assert.equal(component.tagSelector.element.style.display, "none");

  // Enter opens the focused trigger and Space toggles the active trigger closed.
  placeholder.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
  );
  assert.equal(component.tagSelector.isOpen, true);
  assert.equal(component.tagSelector.targetElement, placeholder);

  placeholder.dispatchEvent(
    new KeyboardEvent("keydown", { key: " ", bubbles: true }),
  );
  assert.equal(component.tagSelector.isOpen, false);
  assert.equal(component.tagSelector.element.style.display, "none");

  // Enter on .remove-btn while the tag list is open closes it and removes the tag.
  placeholder.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
  );
  assert.equal(component.tagSelector.isOpen, true);

  const removeBtn = root.querySelector(
    '.tag-pill[data-row="2"][data-type="Trip/Event"] .remove-btn',
  );
  removeBtn.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
  );
  assert.equal(component.tagSelector.isOpen, false);
  assert.equal(component.pendingChanges.get("2")["Trip/Event"], "");
  assert.equal(
    root.querySelector('.tag-pill[data-row="2"][data-type="Trip/Event"]'),
    null,
  );
});
