import { el } from "../core/dom.js";

export default class LoaderComponent {
  render() {
    const element = el("div", { className: "loader" });

    // For backward compatibility with template literals during refactoring
    element.toString = () => '<div class="loader"></div>';

    return element;
  }
}
