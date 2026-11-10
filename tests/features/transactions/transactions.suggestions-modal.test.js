// tests/features/transactions/transactions.suggestions-modal.test.js
//
// The review dialog runs under happy-dom. Every test opens one dialog, acts on
// its DOM and closes it, so the page is left clean for the next test.

import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import TransactionsSuggestionsModal from "../../../src/features/transactions/transactions.suggestions-modal.js";

const rowsById = () =>
  new Map([
    [
      "2",
      {
        row: 2,
        Date: "2026-11-01",
        Description: "TESCO STORES",
        Income: "",
        Expense: "12.34",
        "Trip/Event": "",
        Category: "",
      },
    ],
    [
      "3",
      {
        row: 3,
        Date: "2026-11-02",
        Description: "ALDI",
        Income: "",
        Expense: "5",
        "Trip/Event": "Winter Trip",
        Category: "",
      },
    ],
  ]);

const proposals = () => [
  { row: 2, tripEvent: "Winter Trip", category: "Food" },
  { row: 3, category: "Transport" },
];

const openModals = new Set();

const openModal = (options = {}) => {
  const modal = new TransactionsSuggestionsModal();
  openModals.add(modal);
  const result = modal.open({
    suggestions: proposals(),
    rowsById: rowsById(),
    ...options,
  });
  return { modal, result };
};

const q = (selector) => document.querySelector(selector);
const qa = (selector) => Array.from(document.querySelectorAll(selector));

// A failing assertion can leave a dialog open, and its document keydown
// listener would leak into later tests, so close every instance here.
afterEach(() => {
  for (const modal of openModals) {
    modal.close(null);
  }
  openModals.clear();
  document.body.innerHTML = "";
});

test("every proposal is ticked by default", () => {
  const { modal, result } = openModal();

  const ticks = qa(".suggest-row__tick");
  assert.equal(ticks.length, 2);
  assert.ok(ticks.every((tick) => tick.checked));
  assert.equal(q(".suggest-count").textContent, "2 of 2 selected");
  assert.equal(q("#suggest-apply-btn").textContent, "Apply 2 suggestions");
  assert.equal(
    ticks[0].getAttribute("aria-label"),
    "Include suggestion for TESCO STORES on 2026-11-01",
  );

  modal.close(null);
  return result;
});

test("each row shows the date, description and signed amount", () => {
  const { modal, result } = openModal();

  const firstRow = q(".suggest-row");
  assert.match(firstRow.textContent, /2026-11-01/);
  assert.match(firstRow.textContent, /TESCO STORES/);
  assert.match(q(".suggest-row__amount").textContent, /-12\.34/);

  modal.close(null);
  return result;
});

test("unticking a row reduces the count and the Apply label", () => {
  const { modal, result } = openModal();

  qa(".suggest-row__tick")[0].click();

  assert.equal(q(".suggest-count").textContent, "1 of 2 selected");
  assert.equal(q("#suggest-apply-btn").textContent, "Apply 1 suggestion");

  modal.close(null);
  return result;
});

test("Apply resolves with only the ticked proposals", async () => {
  const { modal, result } = openModal();

  qa(".suggest-row__tick")[0].click();
  q("#suggest-apply-btn").click();

  assert.deepEqual(await result, [{ row: 3, category: "Transport" }]);
  assert.equal(modal.overlay, null);
});

test("Cancel resolves null and removes the overlay", async () => {
  const { modal, result } = openModal();

  assert.ok(q(".modal-overlay"));
  q(".suggest-modal-footer .modal-btn-cancel").click();

  assert.equal(await result, null);
  assert.equal(q(".modal-overlay"), null);
  assert.equal(modal.overlay, null);
});

test("Escape resolves null", async () => {
  const { result } = openModal();

  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

  assert.equal(await result, null);
  assert.equal(q(".modal-overlay"), null);
});

test("the close button resolves null", async () => {
  const { result } = openModal();

  q(".modal-close").click();

  assert.equal(await result, null);
});

test("an overlay click resolves null", async () => {
  const { result } = openModal();

  q(".modal-overlay").dispatchEvent(new MouseEvent("click"));

  assert.equal(await result, null);
  assert.equal(q(".modal-overlay"), null);
});

test("select all and clear both update the ticks and the footer", async () => {
  const { modal, result } = openModal();

  qa(".suggest-row__tick")[0].click();
  const toggle = q(".suggest-toggle");
  assert.equal(toggle.textContent, "Select all");

  toggle.click();
  assert.ok(qa(".suggest-row__tick").every((tick) => tick.checked));
  assert.equal(toggle.textContent, "Clear all");
  assert.equal(q(".suggest-count").textContent, "2 of 2 selected");

  toggle.click();
  assert.ok(qa(".suggest-row__tick").every((tick) => !tick.checked));
  assert.equal(toggle.textContent, "Select all");
  assert.equal(q(".suggest-count").textContent, "0 of 2 selected");
  assert.equal(q("#suggest-apply-btn").disabled, true);

  modal.close(null);
  await result;
});

test("the field that was already tagged is shown as kept, not as a proposal", async () => {
  const { modal, result } = openModal({
    suggestions: [{ row: 3, category: "Transport" }],
  });

  const row = q(".suggest-row");
  const kept = row.querySelector(".suggest-pill--kept");
  assert.ok(kept);
  assert.match(kept.textContent, /Trip\/Event: Winter Trip/);
  assert.equal(kept.getAttribute("title"), "Already set");

  const proposed = Array.from(
    row.querySelectorAll(".suggest-pill:not(.suggest-pill--kept)"),
  );
  assert.equal(proposed.length, 1);
  assert.match(proposed[0].textContent, /Category: Transport/);
  assert.doesNotMatch(proposed[0].textContent, /Winter Trip/);

  modal.close(null);
  await result;
});

test("a notice is shown when one is passed", async () => {
  const { modal, result } = openModal({
    notice: new Error("The last batch failed."),
  });

  assert.equal(q(".suggest-notice").textContent, "The last batch failed.");

  modal.close(null);
  await result;
});

test("focus moves into the dialog and returns to the previous element on close", async () => {
  const trigger = document.createElement("button");
  trigger.textContent = "Open suggestions";
  document.body.appendChild(trigger);
  trigger.focus();
  assert.equal(document.activeElement, trigger);

  const { modal, result } = openModal();
  assert.equal(document.activeElement, q(".suggest-row__tick"));

  modal.close(null);
  await result;

  assert.equal(document.activeElement, trigger);
});

test("an explicit returnFocus element receives focus on close", async () => {
  const previouslyFocused = document.createElement("button");
  previouslyFocused.textContent = "Previously focused";
  document.body.appendChild(previouslyFocused);
  previouslyFocused.focus();

  const returnTarget = document.createElement("button");
  returnTarget.textContent = "AI button";
  document.body.appendChild(returnTarget);

  const { modal, result } = openModal({ returnFocus: returnTarget });
  modal.close(null);
  await result;

  assert.equal(document.activeElement, returnTarget);
});

test("focus falls back to the body when the return element left the document", async () => {
  const returnTarget = document.createElement("button");
  returnTarget.textContent = "AI button";
  document.body.appendChild(returnTarget);
  returnTarget.focus();

  const { modal, result } = openModal({ returnFocus: returnTarget });
  returnTarget.remove();
  modal.close(null);
  await result;

  assert.equal(document.activeElement, document.body);
});

test("Tab from the last focusable wraps to the first", () => {
  const { modal, result } = openModal();

  const focusable = qa(
    ".suggest-modal-content input, .suggest-modal-content button",
  ).filter((element) => !element.disabled);
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  last.focus();
  assert.equal(document.activeElement, last);

  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Tab", cancelable: true }),
  );

  assert.equal(document.activeElement, first);

  modal.close(null);
  return result;
});

test("Shift+Tab from the first focusable wraps to the last", () => {
  const { modal, result } = openModal();

  const focusable = qa(
    ".suggest-modal-content input, .suggest-modal-content button",
  ).filter((element) => !element.disabled);
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  first.focus();
  assert.equal(document.activeElement, first);

  document.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      cancelable: true,
    }),
  );

  assert.equal(document.activeElement, last);

  modal.close(null);
  return result;
});

test("a second open on the same instance is refused", async () => {
  const { modal, result } = openModal();

  assert.throws(() => modal.open({ suggestions: [], rowsById: new Map() }), {
    message: /already open/,
  });

  modal.close(null);
  await result;
});
