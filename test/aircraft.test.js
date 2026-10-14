import assert from "node:assert/strict";
import test from "node:test";

import { parseAircraftData, resolveAircraftName } from "../lib/aircraft.js";

test("maps OpenFlights aircraft rows by IATA and ICAO code", () => {
  const aircraft = parseAircraftData('"Boeing 737-800","738","B738"');

  assert.equal(aircraft.get("738"), "Boeing 737-800");
  assert.equal(aircraft.get("B738"), "Boeing 737-800");
});

test("falls back to the aircraft type code when its name is unknown", () => {
  assert.equal(resolveAircraftName("b752", new Map()), "B752");
  assert.equal(resolveAircraftName(null, new Map()), null);
});
