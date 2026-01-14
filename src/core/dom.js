/**
 * DOM Utility for declarative element creation.
 * Replaces string-based HTML generation to prevent XSS.
 */

// Store cleanup handlers in a WeakMap to avoid polluting DOM elements
const cleanupHandlers = new WeakMap();

/**
 * Recursively cleanup an element and its children
 * @param {HTMLElement} element - The element to cleanup
 */
export const cleanup = (element) => {
  if (!element || !(element instanceof Element)) return;

  const handler = cleanupHandlers.get(element);
  if (handler) {
    handler();
    cleanupHandlers.delete(element);
  }

  // Recursively cleanup children
  Array.from(element.children).forEach((child) => cleanup(child));
};

/**
 * Safely empty an element, cleaning up all descendants.
 * @param {HTMLElement} element - The element to clear.
 */
export const clear = (element) => {
  if (!element || !(element instanceof Element)) return;
  Array.from(element.children).forEach((child) => cleanup(child));
  element.replaceChildren();
};

/**
 * Safely replace all children of an element and clean up descendants.
 * @param {HTMLElement} element - The parent element.
 * @param {...Node} newChildren - The new children to add.
 */
export const replace = (element, ...newChildren) => {
  if (!element || !(element instanceof Element)) return;

  const newChildrenSet = new Set(newChildren);

  Array.from(element.children).forEach((child) => {
    // Only cleanup children that are NOT being reused
    if (!newChildrenSet.has(child)) {
      cleanup(child);
    }
  });

  element.replaceChildren(...newChildren);
};

/**
 * Declarative element creation helper.
 *
 * @param {string} tag - The HTML tag name (e.g., 'div', 'button').
 * @param {Object} attributes - A map of attributes/events (e.g., { class: 'btn', onclick: handler }).
 * @param {...(HTMLElement|string)} children - Child elements or text content.
 * @returns {HTMLElement} The created DOM element.
 */
export const el = (tag, attributes = {}, ...children) => {
  const element = document.createElement(tag);
  const listeners = [];

  // Handle attributes
  if (attributes) {
    Object.entries(attributes).forEach(([key, value]) => {
      if (key.startsWith("on") && typeof value === "function") {
        // Handle event listeners (e.g., onclick, onchange)
        const eventName = key.substring(2).toLowerCase();
        element.addEventListener(eventName, value);
        listeners.push({ event: eventName, handler: value });
      } else if (key === "className" || key === "class") {
        // Handle class names
        element.className = value;
      } else if (key === "style" && typeof value === "object") {
        // Handle style object
        Object.assign(element.style, value);
      } else if (key === "dataset" && typeof value === "object") {
        // Handle dataset
        Object.assign(element.dataset, value);
      } else if (value !== false && value !== null && value !== undefined) {
        // Handle other attributes
        if (typeof value === "object") {
          throw new TypeError(
            `Attribute "${key}" has object value. Use className, style, or dataset for objects.`
          );
        }
        // Treat boolean 'true' as a presence attribute
        if (value === true) {
          element.setAttribute(key, "");
        } else {
          element.setAttribute(key, value);
        }
      }
    });
  }

  // Handle children
  children.forEach((child) => {
    if (child instanceof Node) {
      element.appendChild(child);
    } else if (child !== null && child !== undefined && child !== false) {
      // Convert non-node values to text strings
      element.appendChild(document.createTextNode(String(child)));
    }
  });

  // Store cleanup function in WeakMap to remove event listeners
  cleanupHandlers.set(element, () => {
    listeners.forEach(({ event, handler }) => {
      element.removeEventListener(event, handler);
    });
    listeners.length = 0;
  });

  return element;
};
