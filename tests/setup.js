// tests/setup.js
//
// Preloaded before every test file (see "test" in package.json). Installs a
// browser-like global environment (document, window, localStorage,
// sessionStorage...) so modules written for the browser import cleanly.
// Stylesheets that components inject are skipped rather than reported as
// load failures.

import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register({
  url: "http://localhost/",
  settings: { handleDisabledFileLoadingAsSuccess: true },
});
