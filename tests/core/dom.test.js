// tests/core/dom.test.js
//
// All tests operate on detached nodes — nothing is appended to the page.

import { test } from "node:test";
import assert from "node:assert/strict";
import { el, replace, cleanup, clear } from "../../src/core/dom.js";

test("el sets tag, className, style, dataset and attributes", () => {
  const node = el("button", {
    className: "a b",
    style: { color: "red" },
    dataset: { row: "7" },
    id: "x",
    title: "hi",
  });
  assert.equal(node.tagName, "BUTTON");
  assert.equal(node.className, "a b");
  assert.equal(node.style.color, "red");
  assert.equal(node.dataset.row, "7");
  assert.equal(node.id, "x");
  assert.equal(node.getAttribute("title"), "hi");
});

test("el treats booleans as presence attributes", () => {
  const node = el("input", { disabled: true, required: false, foo: null });
  assert.ok(node.hasAttribute("disabled"));
  assert.ok(!node.hasAttribute("required"));
  assert.ok(!node.hasAttribute("foo"));
});

test("el throws on plain-object attribute values", () => {
  assert.throws(() => el("div", { foo: { bad: true } }), /has object value/);
});

test("el flattens child arrays and skips null/undefined/false", () => {
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
  assert.equal(node.textContent, "abcd");
  assert.equal(node.querySelectorAll("span").length, 1);
});

test("el defaults form controls to autocomplete off", () => {
  assert.equal(el("input").getAttribute("autocomplete"), "off");
  assert.equal(
    el("input", { type: "password" }).getAttribute("autocomplete"),
    "new-password",
  );
});

test("cleanup removes event listeners added via el", () => {
  let clicks = 0;
  const node = el("button", { onclick: () => clicks++ });
  node.dispatchEvent(new Event("click"));
  assert.equal(clicks, 1);
  cleanup(node);
  node.dispatchEvent(new Event("click"));
  assert.equal(clicks, 1, "listener must be gone after cleanup");
});

test("replace keeps reused children alive, cleans removed ones", () => {
  let keptClicks = 0;
  let removedClicks = 0;
  const kept = el("button", { onclick: () => keptClicks++ });
  const removed = el("button", { onclick: () => removedClicks++ });
  const parent = el("div", {}, kept, removed);

  replace(parent, kept, el("span", {}, "new"));

  kept.dispatchEvent(new Event("click"));
  assert.equal(keptClicks, 1, "reused child must keep its listener");

  removed.dispatchEvent(new Event("click"));
  assert.equal(removedClicks, 0, "removed child must be cleaned up");
  assert.equal(parent.children.length, 2);
});

test("clear empties an element and cleans its children", () => {
  let clicks = 0;
  const child = el("button", { onclick: () => clicks++ });
  const parent = el("div", {}, child);
  clear(parent);
  assert.equal(parent.children.length, 0);
  child.dispatchEvent(new Event("click"));
  assert.equal(clicks, 0);
});
