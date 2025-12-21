/**
 * DOM Utility for declarative element creation.
 * Replaces string-based HTML generation to prevent XSS.
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
            if (key.startsWith('on') && typeof value === 'function') {
                // Handle event listeners (e.g., onclick, onchange)
                const eventName = key.substring(2).toLowerCase();
                element.addEventListener(eventName, value);
                listeners.push({ event: eventName, handler: value });
            } else if (key === 'className' || key === 'class') {
                // Handle class names
                element.className = value;
            } else if (key === 'style' && typeof value === 'object') {
                // Handle style object
                Object.assign(element.style, value);
            } else if (key === 'dataset' && typeof value === 'object') {
                // Handle dataset
                Object.assign(element.dataset, value);
            } else if (value !== false && value !== null && value !== undefined) {
                // Handle other attributes
                // Treat boolean 'true' as a presence attribute
                if (value === true) {
                    element.setAttribute(key, '');
                } else {
                    element.setAttribute(key, value);
                }
            }
        });
    }

    // Handle children
    children.forEach(child => {
        if (child instanceof Node) {
            element.appendChild(child);
        } else if (child !== null && child !== undefined && child !== false) {
            // Convert non-node values to text strings
            element.appendChild(document.createTextNode(String(child)));
        }
    });

    // Attach cleanup function to remove event listeners
    element._cleanup = () => {
        listeners.forEach(({ event, handler }) => {
            element.removeEventListener(event, handler);
        });
        listeners.length = 0;
    };

    return element;
};
