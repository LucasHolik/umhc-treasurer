// src/features/settings/selftest/tests.api.js
//
// Only the pure, network-free helpers are tested. Nothing here touches
// the session, storage, or the backend.

import { test, assertEqual } from "./selftest.runner.js";
import {
  canonicalStringify,
  _validateScriptUrl,
} from "../../../services/api.service.js";

const SUITE = "API helpers";

test(SUITE, "canonicalStringify sorts object keys recursively", () => {
  assertEqual(
    canonicalStringify({ b: 1, a: { d: 2, c: 3 } }),
    '{"a":{"c":3,"d":2},"b":1}',
  );
});

test(
  SUITE,
  "canonicalStringify keeps array order, sorts nested objects",
  () => {
    assertEqual(
      canonicalStringify([{ b: 1, a: 2 }, 3, "x"]),
      '[{"a":2,"b":1},3,"x"]',
    );
  },
);

test(SUITE, "canonicalStringify matches JSON.stringify for primitives", () => {
  assertEqual(canonicalStringify("text"), '"text"');
  assertEqual(canonicalStringify(42), "42");
  assertEqual(canonicalStringify(null), "null");
  assertEqual(canonicalStringify(true), "true");
});

test(
  SUITE,
  "canonicalStringify is stable regardless of insertion order",
  () => {
    const a = { x: 1, y: { b: 2, a: 3 } };
    const b = { y: { a: 3, b: 2 }, x: 1 };
    assertEqual(canonicalStringify(a), canonicalStringify(b));
  },
);

test(SUITE, "_validateScriptUrl accepts only Apps Script web app URLs", () => {
  const valid = "https://script.google.com/macros/s/ABC123/exec";
  assertEqual(_validateScriptUrl(valid), valid);
});

test(SUITE, "_validateScriptUrl rejects everything else", () => {
  assertEqual(_validateScriptUrl("https://evil.com/macros/s/x"), null);
  assertEqual(
    _validateScriptUrl("https://evil.script.google.com/macros/s/x"),
    null,
  );
  assertEqual(_validateScriptUrl("https://script.google.com/other/path"), null);
  assertEqual(_validateScriptUrl("not a url"), null);
  assertEqual(_validateScriptUrl(""), null);
  assertEqual(_validateScriptUrl(null), null);
});
