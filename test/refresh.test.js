import assert from "node:assert/strict";
import test from "node:test";

import {
  flightDataUrl,
  flightRefreshBucket,
  millisecondsUntilNextFlightRefresh,
} from "../lib/refresh.js";

test("aligns the next flight refresh to a five-minute wall-clock boundary", () => {
  const threeMinutesPast = Date.UTC(2026, 9, 14, 19, 3, 0);
  const fiveMinutesPast = Date.UTC(2026, 9, 14, 19, 5, 0);

  assert.equal(millisecondsUntilNextFlightRefresh(threeMinutesPast), 2 * 60_000);
  assert.equal(millisecondsUntilNextFlightRefresh(fiveMinutesPast), 5 * 60_000);
});

test("uses one shared data URL for each five-minute window", () => {
  const windowStart = Date.UTC(2026, 9, 14, 19, 5, 0);
  const sameWindow = Date.UTC(2026, 9, 14, 19, 9, 59);
  const nextWindow = Date.UTC(2026, 9, 14, 19, 10, 0);

  assert.equal(flightRefreshBucket(windowStart), flightRefreshBucket(sameWindow));
  assert.notEqual(flightRefreshBucket(windowStart), flightRefreshBucket(nextWindow));
  assert.equal(flightDataUrl(windowStart), flightDataUrl(sameWindow));
  assert.notEqual(flightDataUrl(windowStart), flightDataUrl(nextWindow));
});
