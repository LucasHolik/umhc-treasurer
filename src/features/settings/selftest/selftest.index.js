// src/features/settings/selftest/selftest.index.js
//
// Entry point for the self-test suite, lazy-loaded by SettingsComponent
// via dynamic import(). Importing the tests.* modules registers every
// test with the runner; runSelfTests() then drives the live modal.

import "./tests.utils.js";
import "./tests.financial.js";
import "./tests.transactions.js";
import "./tests.tags.js";
import "./tests.state.js";
import "./tests.dom.js";
import "./tests.excel.js";
import "./tests.api.js";
import "./tests.analysis.js";

import { runAll } from "./selftest.runner.js";
import SelfTestModal from "./selftest.modal.js";

let running = false;

export async function runSelfTests() {
  if (running) return;
  running = true;

  // Everything fallible stays inside the try so `running` always resets;
  // a throw between the flag and the try would dead-latch the feature.
  let modal;
  let total = 0;
  try {
    modal = new SelfTestModal();
    modal.open();
    await runAll({
      onStart: (count) => {
        total = count;
        modal.setProgress(0, total);
      },
      onResult: (result, index) => {
        modal.addResult(result);
        modal.setProgress(index + 1, total);
      },
      onDone: (summary) => modal.setSummary(summary),
      isCancelled: () => modal.isCancelled(),
    });
  } catch (error) {
    if (modal) modal.close();
    throw error;
  } finally {
    running = false;
  }
}
