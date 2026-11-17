// tests/shared/tag-selector.component.test.js
//
// Tests for TagSelector's Escape propagation and onClose lifecycle.

import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import TagSelector from "../../src/shared/tag-selector.component.js";

const createdSelectors = new Set();

const createSelector = () => {
  const selector = new TagSelector();
  createdSelectors.add(selector);
  return selector;
};

const createAnchor = () => {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Pick tag";
  document.body.appendChild(button);
  return button;
};

afterEach(() => {
  for (const selector of createdSelectors) {
    selector.destroy();
  }
  createdSelectors.clear();
  document.body.innerHTML = "";
});

test("Escape inside an open TagSelector closes it and stops propagation", () => {
  const selector = createSelector();
  const anchor = createAnchor();
  let documentSawEscape = false;
  const onDocKeydown = (e) => {
    if (e.key === "Escape") documentSawEscape = true;
  };
  document.addEventListener("keydown", onDocKeydown);

  try {
    selector.show(anchor, "Category", "", () => {}, ["Food", "Transport"]);
    assert.equal(selector.isOpen, true);

    const escapeEvent = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    selector.searchInput.dispatchEvent(escapeEvent);

    assert.equal(selector.isOpen, false);
    assert.equal(selector.element.style.display, "none");
    assert.equal(documentSawEscape, false);
  } finally {
    document.removeEventListener("keydown", onDocKeydown);
  }
});

test("Escape when TagSelector is closed does not stop propagation or fire onClose", () => {
  const selector = createSelector();
  let documentSawEscape = false;
  const onDocKeydown = (e) => {
    if (e.key === "Escape") documentSawEscape = true;
  };
  document.addEventListener("keydown", onDocKeydown);

  try {
    const escapeEvent = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
    });
    selector.element.dispatchEvent(escapeEvent);

    assert.equal(documentSawEscape, true);
  } finally {
    document.removeEventListener("keydown", onDocKeydown);
  }
});

test("onClose fires once when closing an open popover and not when already closed", () => {
  const selector = createSelector();
  const anchor = createAnchor();
  let closeCalls = 0;
  let openStateDuringCallback = null;

  selector.show(anchor, "Category", "", () => {}, ["Food"], {
    onClose: () => {
      closeCalls++;
      openStateDuringCallback = selector.isOpen;
    },
  });

  selector.close();
  assert.equal(closeCalls, 1);
  assert.equal(openStateDuringCallback, false);

  selector.close();
  selector.destroy();
  assert.equal(closeCalls, 1);
});

test("onClose fires on Escape and after selecting an item", () => {
  const selector = createSelector();
  const anchor = createAnchor();
  let closeCalls = 0;
  const selected = [];

  selector.show(
    anchor,
    "Category",
    "",
    (value) => selected.push(value),
    ["Food"],
    {
      onClose: () => {
        closeCalls++;
      },
    },
  );
  selector.element.querySelector(".tag-selector-item").click();

  assert.deepEqual(selected, ["Food"]);
  assert.equal(closeCalls, 1);

  selector.show(anchor, "Category", "", () => {}, ["Food"], {
    onClose: () => {
      closeCalls++;
    },
  });
  selector.searchInput.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  assert.equal(closeCalls, 2);
});
