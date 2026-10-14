import assert from "node:assert/strict";
import test from "node:test";

import { findAirportCountry, parseAirportData } from "../lib/airports.js";

test("maps OpenFlights airport rows by IATA and ICAO code", () => {
  const countries = parseAirportData(
    '3577,"San Francisco International Airport","San Francisco","United States","SFO","KSFO",37.618999,-122.375',
  );

  assert.equal(countries.get("SFO"), "United States");
  assert.equal(countries.get("KSFO"), "United States");
});

test("finds a country using the available airport code", () => {
  const countries = new Map([["KORD", "United States"]]);

  assert.equal(findAirportCountry({ code_icao: "KORD" }, countries), "United States");
  assert.equal(findAirportCountry({ code_iata: "ZZZ" }, countries), null);
});
