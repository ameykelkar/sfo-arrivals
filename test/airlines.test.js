import assert from "node:assert/strict";
import test from "node:test";

import { inferAirlineName, parseAirlineData } from "../lib/airlines.js";

test("parses quoted airline names and maps IATA and ICAO codes", () => {
  const mapping = parseAirlineData(
    '1,"Example, Air","",EA,EXA,EXAMPLE,United States,Y',
  );

  assert.equal(mapping.get("EA"), "Example, Air");
  assert.equal(mapping.get("EXA"), "Example, Air");
});

test("infers an airline from a flight ident", () => {
  const mapping = new Map([["UAL", "United Airlines"]]);
  assert.equal(inferAirlineName("UAL123", mapping), "United Airlines");
});
