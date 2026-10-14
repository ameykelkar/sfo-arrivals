import assert from "node:assert/strict";
import test from "node:test";

import { __testing } from "../lib/flightaware.js";

test("formats an airport using city and IATA code", () => {
  assert.equal(
    __testing.formatAirport({ city: "Seattle", code_iata: "SEA" }),
    "Seattle (SEA)",
  );
});

test("formats AeroAPI query times without milliseconds", () => {
  assert.equal(
    __testing.toAeroApiTime(new Date("2026-10-08T17:12:34.567Z")),
    "2026-10-08T17:12:34Z",
  );
});

test("normalizes a FlightAware arrival", () => {
  const normalized = __testing.normalizeFlight(
    {
      fa_flight_id: "UAL123-1",
      ident_iata: "UA123",
      operator_iata: "UA",
      operator_icao: "UAL",
      origin: { city: "Chicago", code_iata: "ORD" },
      status: "En Route",
      estimated_on: "2026-10-07T19:30:00Z",
      route_distance: 1846.2,
    },
    new Map([["UA", "United Airlines"]]),
  );

  assert.deepEqual(normalized, {
    id: "UAL123-1",
    airline: "United Airlines",
    callsign: "UA123",
    origin: "Chicago (ORD)",
    status: "En Route",
    estimatedArrivalUtc: "2026-10-07T19:30:00.000Z",
    routeDistanceMi: 1847,
    logoCodes: ["UA", "UAL"],
  });
});
