import assert from "node:assert/strict";
import test from "node:test";

import { __testing } from "../lib/flightaware.js";

test("formats an airport using city and IATA code", () => {
  assert.equal(
    __testing.formatAirport({ city: "Seattle", code_iata: "SEA" }),
    "Seattle (SEA)",
  );
});

test("formats an airport when only its code is available", () => {
  assert.equal(
    __testing.formatAirport({ code_icao: "KSEA" }),
    "KSEA",
  );
});

test("formats AeroAPI query times without milliseconds", () => {
  assert.equal(
    __testing.toAeroApiTime(new Date("2026-10-08T17:12:34.567Z")),
    "2026-10-08T17:12:34Z",
  );
});

test("counts the paid calls remaining inside the safety limit", () => {
  assert.deepEqual(__testing.calculateBudgetStatus(0), {
    remainingCalls: 950,
  });

  assert.deepEqual(__testing.calculateBudgetStatus(4.745), {
    remainingCalls: 1,
  });

  assert.equal(__testing.calculateBudgetStatus(4.75).remainingCalls, 0);
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
      aircraft_type: "B738",
      estimated_on: "2026-10-07T19:30:00Z",
      route_distance: 1846.2,
    },
    new Map([["UA", "United Airlines"]]),
    new Map([["ORD", "🇺🇸 United States"]]),
    new Map([["B738", "Boeing 737-800"]]),
  );

  assert.deepEqual(normalized, {
    id: "UAL123-1",
    airline: "United Airlines",
    callsign: "UA123",
    origin: "Chicago (ORD)",
    originCountry: "🇺🇸 United States",
    originScope: "domestic",
    aircraft: "Boeing 737-800",
    status: "En Route",
    estimatedArrivalUtc: "2026-10-07T19:30:00.000Z",
    actualArrivalUtc: null,
    estimatedVisibleUtc: "2026-10-07T19:28:00.000Z",
    routeDistanceKm: 2971,
    logoCodes: ["UA", "UAL"],
  });
});

test("classifies domestic, international, and unknown origins", () => {
  assert.equal(__testing.classifyOriginCountry("🇺🇸 United States"), "domestic");
  assert.equal(__testing.classifyOriginCountry("🇬🇧 United Kingdom"), "international");
  assert.equal(__testing.classifyOriginCountry(null), "unknown");
});

test("prefers a SkyWest marketing carrier name and tail image", () => {
  const normalized = __testing.normalizeFlight(
    {
      fa_flight_id: "SKW5555-1",
      ident_iata: "OO5555",
      operator_iata: "OO",
      operator_icao: "SKW",
      codeshares_iata: ["UA5555"],
      codeshares: ["UAL5555"],
      origin: { city: "Fresno", code_iata: "FAT" },
      status: "Scheduled",
      scheduled_on: "2026-10-07T19:30:00Z",
    },
    new Map([
      ["OO", "SkyWest Airlines"],
      ["UA", "United Airlines"],
    ]),
  );

  assert.equal(normalized.airline, "United Airlines");
  assert.deepEqual(normalized.logoCodes, ["UA", "UAL", "OO", "SKW"]);
});
