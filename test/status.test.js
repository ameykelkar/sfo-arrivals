import assert from "node:assert/strict";
import test from "node:test";

import { flightStatusPresentation } from "../lib/status.js";

test("simplifies an on-time flight that is already en route", () => {
  assert.deepEqual(flightStatusPresentation("On The Way! / On Time"), {
    label: "On Time",
    className: "status status-good status-live",
  });
});

test("prioritizes operational exceptions in combined statuses", () => {
  assert.deepEqual(flightStatusPresentation("En Route / Delayed"), {
    label: "Delayed",
    className: "status status-warning",
  });
  assert.deepEqual(flightStatusPresentation("Arrived / Delayed"), {
    label: "Delayed",
    className: "status status-warning",
  });
});
