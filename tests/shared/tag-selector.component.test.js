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

test("clicking outside TagSelector closes it and fires onClose, including caller-style tag pills", () => {
  const selector = createSelector();
  const anchor = createAnchor();
  let closeCalls = 0;

  const outsideDiv = document.createElement("div");
  const outsidePill = document.createElement("span");
  outsidePill.className = "tag-pill";
  const outsidePlaceholder = document.createElement("span");
  outsidePlaceholder.className = "add-tag-placeholder";
  document.body.append(outsideDiv, outsidePill, outsidePlaceholder);

  selector.show(anchor, "Category", "", () => {}, ["Food"], {
    onClose: () => {
      closeCalls++;
    },
  });
  assert.equal(selector.isOpen, true);

  outsideDiv.click();
  assert.equal(selector.isOpen, false);
  assert.equal(selector.element.style.display, "none");
  assert.equal(closeCalls, 1);

  selector.show(anchor, "Category", "", () => {}, ["Food"], {
    onClose: () => {
      closeCalls++;
    },
  });
  outsidePill.click();
  assert.equal(selector.isOpen, false);
  assert.equal(closeCalls, 2);

  selector.show(anchor, "Category", "", () => {}, ["Food"], {
    onClose: () => {
      closeCalls++;
    },
  });
  outsidePlaceholder.click();
  assert.equal(selector.isOpen, false);
  assert.equal(closeCalls, 3);
});

test("clicking inside TagSelector (search input or past-tags toggle) keeps it open", () => {
  const selector = createSelector();
  const anchor = createAnchor();
  let closeCalls = 0;

  selector.show(anchor, "Trip/Event", "", () => {}, ["Winter Trip"], {
    pastOptions: [{ value: "Old Trip", hint: "Completed" }],
    onClose: () => {
      closeCalls++;
    },
  });
  assert.equal(selector.isOpen, true);

  selector.searchInput.click();
  assert.equal(selector.isOpen, true);
  assert.equal(selector.element.style.display, "block");
  assert.equal(closeCalls, 0);

  selector.pastToggleBtn.click();
  assert.equal(selector.isOpen, true);
  assert.equal(selector.showPast, true);
  assert.equal(closeCalls, 0);
});

test("show() while already open closes the previous session and fires its onClose before reopening", () => {
  const selector = createSelector();
  const firstAnchor = createAnchor();
  const secondAnchor = createAnchor();
  const events = [];

  selector.show(firstAnchor, "Category", "", () => {}, ["Food"], {
    onClose: () => {
      events.push(["close-first", selector.isOpen, selector.targetElement]);
    },
  });

  selector.show(secondAnchor, "Category", "", () => {}, ["Transport"], {
    onClose: () => {
      events.push(["close-second", selector.isOpen, selector.targetElement]);
    },
  });

  assert.deepEqual(events, [["close-first", false, null]]);
  assert.equal(selector.isOpen, true);
  assert.equal(selector.targetElement, secondAnchor);

  selector.close();
  assert.deepEqual(events, [
    ["close-first", false, null],
    ["close-second", false, null],
  ]);
});

test("toggle() closes on the same target and switches on a different target", () => {
  const selector = createSelector();
  const firstAnchor = createAnchor();
  const secondAnchor = createAnchor();
  let firstClosed = 0;
  let secondClosed = 0;

  selector.toggle(firstAnchor, "Category", "", () => {}, ["Food"], {
    onClose: () => {
      firstClosed++;
    },
  });
  assert.equal(selector.isOpen, true);
  assert.equal(selector.targetElement, firstAnchor);

  // Toggling the same target closes it.
  selector.toggle(firstAnchor, "Category", "", () => {}, ["Food"], {
    onClose: () => {
      firstClosed++;
    },
  });
  assert.equal(selector.isOpen, false);
  assert.equal(firstClosed, 1);

  // Re-open on first, then toggle on second: closes first and opens second.
  selector.toggle(firstAnchor, "Category", "", () => {}, ["Food"], {
    onClose: () => {
      firstClosed++;
    },
  });
  selector.toggle(secondAnchor, "Category", "", () => {}, ["Transport"], {
    onClose: () => {
      secondClosed++;
    },
  });
  assert.equal(selector.isOpen, true);
  assert.equal(selector.targetElement, secondAnchor);
  assert.equal(firstClosed, 2);
  assert.equal(secondClosed, 0);
});

test("outside pointerdown + pointerup without click closes TagSelector, while drag > 10px, inside pointerdown, or pointercancel do not", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });

  const selector = createSelector();
  const anchor = createAnchor();
  const background = document.createElement("div");
  document.body.appendChild(background);
  let closeCalls = 0;

  // 1. Tap outside without click closes on timer tick.
  selector.show(anchor, "Category", "", () => {}, ["Food"], {
    onClose: () => {
      closeCalls++;
    },
  });
  background.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 1,
      clientX: 20,
      clientY: 30,
    }),
  );
  background.dispatchEvent(
    new PointerEvent("pointerup", {
      bubbles: true,
      pointerId: 1,
      clientX: 22,
      clientY: 33,
    }),
  );
  // Still open synchronously before the tick so click handlers in the same gesture see it open.
  assert.equal(selector.isOpen, true);
  t.mock.timers.tick(0);
  assert.equal(selector.isOpen, false);
  assert.equal(closeCalls, 1);

  // 2. Scroll/drag (> 10px pointermove) does not close.
  selector.show(anchor, "Category", "", () => {}, ["Food"], {
    onClose: () => {
      closeCalls++;
    },
  });
  background.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 2,
      clientX: 20,
      clientY: 30,
    }),
  );
  background.dispatchEvent(
    new PointerEvent("pointermove", {
      bubbles: true,
      pointerId: 2,
      clientX: 35,
      clientY: 30,
    }),
  );
  background.dispatchEvent(
    new PointerEvent("pointerup", {
      bubbles: true,
      pointerId: 2,
      clientX: 35,
      clientY: 30,
    }),
  );
  t.mock.timers.tick(0);
  assert.equal(selector.isOpen, true);
  assert.equal(closeCalls, 1);

  // 3. pointerdown inside popover followed by pointerup outside does not close.
  selector.searchInput.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 3,
      clientX: 50,
      clientY: 50,
    }),
  );
  background.dispatchEvent(
    new PointerEvent("pointerup", {
      bubbles: true,
      pointerId: 3,
      clientX: 100,
      clientY: 100,
    }),
  );
  t.mock.timers.tick(0);
  assert.equal(selector.isOpen, true);
  assert.equal(closeCalls, 1);

  // 4. pointercancel clears tracked outside pointer.
  background.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 4,
      clientX: 10,
      clientY: 10,
    }),
  );
  background.dispatchEvent(
    new PointerEvent("pointercancel", {
      bubbles: true,
      pointerId: 4,
    }),
  );
  background.dispatchEvent(
    new PointerEvent("pointerup", {
      bubbles: true,
      pointerId: 4,
      clientX: 10,
      clientY: 10,
    }),
  );
  t.mock.timers.tick(0);
  assert.equal(selector.isOpen, true);
  assert.equal(closeCalls, 1);
});

test("destroy() clears pending pointer fallback timers and removes document listeners", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });

  const selector = createSelector();
  const anchor = createAnchor();
  const background = document.createElement("div");
  document.body.appendChild(background);
  let closeCalls = 0;

  selector.show(anchor, "Category", "", () => {}, ["Food"], {
    onClose: () => {
      closeCalls++;
    },
  });

  // Start and end an outside pointer sequence so a fallback timer is pending.
  background.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 5,
      clientX: 10,
      clientY: 10,
    }),
  );
  background.dispatchEvent(
    new PointerEvent("pointerup", {
      bubbles: true,
      pointerId: 5,
      clientX: 10,
      clientY: 10,
    }),
  );

  // Destroy closes once and clears the pending timer.
  selector.destroy();
  assert.equal(closeCalls, 1);

  t.mock.timers.tick(0);
  assert.equal(closeCalls, 1);

  // Subsequent document clicks/pointer events after destroy are ignored.
  let closeMethodCalls = 0;
  selector.close = () => {
    closeMethodCalls++;
  };
  selector.isOpen = true;
  background.click();
  background.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 6,
      clientX: 10,
      clientY: 10,
    }),
  );
  background.dispatchEvent(
    new PointerEvent("pointerup", {
      bubbles: true,
      pointerId: 6,
      clientX: 10,
      clientY: 10,
    }),
  );
  t.mock.timers.tick(0);
  assert.equal(closeMethodCalls, 0);
});
