// src/features/settings/selftest/tests.dom.js
//
// All tests operate on detached nodes — nothing is appended to the page.

import { test, assert, assertEqual, assertThrows } from "./selftest.runner.js";
import { el, replace, cleanup, clear } from "../../../core/dom.js";

const SUITE = "DOM helpers";

test(SUITE, "el sets tag, className, style, dataset and attributes", () => {
  const node = el("button", {
    className: "a b",
    style: { color: "red" },
    dataset: { row: "7" },
    id: "x",
    title: "hi",
  });
  assertEqual(node.tagName, "BUTTON");
  assertEqual(node.className, "a b");
  assertEqual(node.style.color, "red");
  assertEqual(node.dataset.row, "7");
  assertEqual(node.id, "x");
  assertEqual(node.getAttribute("title"), "hi");
});

test(SUITE, "el treats booleans as presence attributes", () => {
  const node = el("input", { disabled: true, required: false, foo: null });
  assert(node.hasAttribute("disabled"));
  assert(!node.hasAttribute("required"));
  assert(!node.hasAttribute("foo"));
});

test(SUITE, "el throws on plain-object attribute values", async () => {
  await assertThrows(() => el("div", { foo: { bad: true } }));
});

test(SUITE, "el flattens child arrays and skips null/undefined/false", () => {
  const node = el(
    "div",
    {},
    "a",
    null,
    undefined,
    false,
    ["b", ["c"]],
    el("span", {}, "d"),
  );
  assertEqual(node.textContent, "abcd");
  assertEqual(node.querySelectorAll("span").length, 1);
});

test(SUITE, "el defaults form controls to autocomplete off", () => {
  assertEqual(el("input").getAttribute("autocomplete"), "off");
  assertEqual(
    el("input", { type: "password" }).getAttribute("autocomplete"),
    "new-password",
  );
});

test(SUITE, "cleanup removes event listeners added via el", () => {
  let clicks = 0;
  const node = el("button", { onclick: () => clicks++ });
  node.dispatchEvent(new Event("click"));
  assertEqual(clicks, 1);
  cleanup(node);
  node.dispatchEvent(new Event("click"));
  assertEqual(clicks, 1, "listener must be gone after cleanup");
});

test(SUITE, "replace keeps reused children alive, cleans removed ones", () => {
  let keptClicks = 0;
  let removedClicks = 0;
  const kept = el("button", { onclick: () => keptClicks++ });
  const removed = el("button", { onclick: () => removedClicks++ });
  const parent = el("div", {}, kept, removed);

  replace(parent, kept, el("span", {}, "new"));

  kept.dispatchEvent(new Event("click"));
  assertEqual(keptClicks, 1, "reused child must keep its listener");

  removed.dispatchEvent(new Event("click"));
  assertEqual(removedClicks, 0, "removed child must be cleaned up");
  assertEqual(parent.children.length, 2);
});

test(SUITE, "clear empties an element and cleans its children", () => {
  let clicks = 0;
  const child = el("button", { onclick: () => clicks++ });
  const parent = el("div", {}, child);
  clear(parent);
  assertEqual(parent.children.length, 0);
  child.dispatchEvent(new Event("click"));
  assertEqual(clicks, 0);
});
