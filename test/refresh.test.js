import assert from "node:assert/strict";
import test from "node:test";

import {
  flightDataUrl,
  flightRefreshBucket,
  isFlightRefreshActive,
  millisecondsUntilNextFlightRefresh,
  shouldDisplayFlight,
} from "../lib/refresh.js";

test("aligns the next flight refresh to a half-hour wall-clock boundary", () => {
  const threeMinutesPast = Date.UTC(2026, 9, 14, 19, 3, 0);
  const fiveMinutesPast = Date.UTC(2026, 9, 14, 19, 5, 0);

  assert.equal(millisecondsUntilNextFlightRefresh(threeMinutesPast), 27 * 60_000);
  assert.equal(millisecondsUntilNextFlightRefresh(fiveMinutesPast), 25 * 60_000);
  assert.equal(millisecondsUntilNextFlightRefresh(Date.UTC(2026, 9, 14, 19, 30)), 30 * 60_000);
});

test("uses one shared data URL for each half-hour window", () => {
  const windowStart = Date.UTC(2026, 9, 14, 19, 5, 0);
  const sameWindow = Date.UTC(2026, 9, 14, 19, 9, 59);
  const nextWindow = Date.UTC(2026, 9, 14, 19, 30, 0);

  assert.equal(flightRefreshBucket(windowStart), flightRefreshBucket(sameWindow));
  assert.notEqual(flightRefreshBucket(windowStart), flightRefreshBucket(nextWindow));
  assert.equal(flightDataUrl(windowStart), flightDataUrl(sameWindow));
  assert.notEqual(flightDataUrl(windowStart), flightDataUrl(nextWindow));
});

test("restricts automatic refresh to 8 AM through midnight Pacific across DST", () => {
  for (const date of ["2026-10-14", "2026-12-14"]) {
    const offset = date.includes("10-14") ? "-07:00" : "-08:00";
    assert.equal(isFlightRefreshActive(Date.parse(`${date}T07:59:59${offset}`)), false);
    assert.equal(isFlightRefreshActive(Date.parse(`${date}T08:00:00${offset}`)), true);
    assert.equal(isFlightRefreshActive(Date.parse(`${date}T23:59:59${offset}`)), true);
    assert.equal(isFlightRefreshActive(Date.parse(`${date}T00:00:00${offset}`)), false);
  }
});

test("removes flights five minutes after actual landing, falling back to the estimate", () => {
  const estimatedArrivalUtc = "2026-10-14T19:00:00Z";
  const actualArrivalUtc = "2026-10-14T19:10:00Z";
  assert.equal(shouldDisplayFlight({ estimatedArrivalUtc }, Date.parse("2026-10-14T19:04:59Z")), true);
  assert.equal(shouldDisplayFlight({ estimatedArrivalUtc }, Date.parse("2026-10-14T19:05:00Z")), false);
  assert.equal(shouldDisplayFlight({ estimatedArrivalUtc, actualArrivalUtc }, Date.parse("2026-10-14T19:05:00Z")), true);
  assert.equal(shouldDisplayFlight({ estimatedArrivalUtc, actualArrivalUtc }, Date.parse("2026-10-14T19:15:00Z")), false);
  assert.equal(shouldDisplayFlight({}, Date.now()), true);
});
