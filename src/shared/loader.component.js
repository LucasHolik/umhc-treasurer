import { el } from "../core/dom.js";

export default class LoaderComponent {
  render() {
    const element = el("div", { className: "loader" });

    return element;
  }

  getHTML() {
    return '<div class="loader"></div>';
  }
}
