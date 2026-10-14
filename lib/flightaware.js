import { getAirlineMapping, inferAirlineName } from "./airlines.js";
import { findAirportCountry, getAirportCountryMapping } from "./airports.js";
import { getAircraftMapping, resolveAircraftName } from "./aircraft.js";

const AEROAPI_BASE_URL = "https://aeroapi.flightaware.com/aeroapi";
const SFO_ICAO = "KSFO";
const WINDOW_MINUTES = 30;
const RESULT_SET_COST_USD = 0.005;
const SAFE_ROLLING_BUDGET_USD = 4.25;
const BUDGET_WINDOW_DAYS = 31;
const BUDGET_WINDOW_SECONDS = BUDGET_WINDOW_DAYS * 24 * 60 * 60;
const REGIONAL_OPERATORS_WITH_BRANDED_TAILS = new Set(["OO", "SKW"]);
const SKYWEST_MARKETING_CARRIERS = new Map([
  ["UA", "UAL"],
  ["DL", "DAL"],
  ["AA", "AAL"],
  ["AS", "ASA"],
]);

export class AeroApiBudgetError extends Error {
  constructor() {
    super("The monthly FlightAware safety limit has been reached.");
    this.name = "AeroApiBudgetError";
  }
}

function toAeroApiTime(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function parseDate(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatAirport(reference = {}, countries = new Map()) {
  const code =
    reference.code_iata || reference.code_icao || reference.code || reference.code_lid;
  const place = reference.city || reference.name;
  const country = findAirportCountry(reference, countries);

  const airport = place && code ? `${place} (${code})` : place || code;
  return airport && country ? `${airport}, ${country}` : airport || null;
}

function carrierCode(ident, length) {
  const match = String(ident || "").trim().toUpperCase().match(/^[A-Z0-9]+/);
  return match?.[0]?.slice(0, length) || null;
}

function getSkyWestMarketingCodes(flight) {
  for (const ident of flight.codeshares_iata || []) {
    const iata = carrierCode(ident, 2);
    const icao = SKYWEST_MARKETING_CARRIERS.get(iata);
    if (icao) return [iata, icao];
  }

  for (const ident of flight.codeshares || []) {
    const icao = carrierCode(ident, 3);
    const match = [...SKYWEST_MARKETING_CARRIERS].find(
      ([, marketingIcao]) => marketingIcao === icao,
    );
    if (match) return match;
  }

  return [];
}

function getLogoCodes(flight, operatorIata, operatorIcao) {
  const marketingCodes = REGIONAL_OPERATORS_WITH_BRANDED_TAILS.has(
    operatorIata || operatorIcao,
  )
    ? getSkyWestMarketingCodes(flight)
    : [];

  return [...new Set([...marketingCodes, operatorIata, operatorIcao].filter(Boolean))];
}

function normalizeFlight(flight, airlines, countries = new Map(), aircraft = new Map()) {
  const ident = flight.ident_iata || flight.ident_icao || flight.ident || null;
  const operatorIata = flight.operator_iata || "";
  const operatorIcao = flight.operator_icao || flight.operator || "";
  const operatorCode = operatorIata || operatorIcao;
  const arrival = parseDate(flight.estimated_on || flight.scheduled_on);
  const distance = Number(flight.route_distance);

  return {
    id: flight.fa_flight_id,
    airline: inferAirlineName(operatorCode, airlines) || ident || operatorCode || "Unknown",
    callsign: ident,
    origin: formatAirport(flight.origin, countries),
    aircraft: resolveAircraftName(flight.aircraft_type, aircraft),
    status: flight.status || "Scheduled",
    estimatedArrivalUtc: arrival?.toISOString() ?? null,
    routeDistanceKm: Number.isFinite(distance)
      ? Math.round(distance * 1.609344)
      : null,
    logoCodes: getLogoCodes(flight, operatorIata, operatorIcao),
  };
}

function calculateBudgetStatus(reportedCost) {
  const cost = Number(reportedCost);
  if (!Number.isFinite(cost) || cost < 0) {
    throw new Error("AeroAPI returned invalid account usage data");
  }

  const remainingBudget = Math.max(0, SAFE_ROLLING_BUDGET_USD - cost);
  const remainingCalls = Math.floor((remainingBudget + 1e-9) / RESULT_SET_COST_USD);

  return { remainingCalls };
}

export async function getAeroApiBudgetStatus({ now = new Date() } = {}) {
  const apiKey = process.env.AEROAPI_API_KEY;
  if (!apiKey) throw new Error("AEROAPI_API_KEY is not configured");

  const start = new Date(now.getTime() - BUDGET_WINDOW_SECONDS * 1_000);
  const url = new URL(`${AEROAPI_BASE_URL}/account/usage`);
  url.searchParams.set("start", toAeroApiTime(start));
  url.searchParams.set("end", toAeroApiTime(now));
  url.searchParams.set("all_keys", "true");

  const response = await fetch(url, {
    headers: { "x-apikey": apiKey },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    throw new Error(`Unable to verify AeroAPI usage (${response.status})`);
  }

  const usage = await response.json();
  const reportedCost = Math.max(
    Number(usage.total_cost),
    Number(usage.total_discount_cost),
  );
  const budget = calculateBudgetStatus(reportedCost);

  if (budget.remainingCalls < 1) throw new AeroApiBudgetError();
  return budget;
}

export async function getIncomingFlights({
  airportId = SFO_ICAO,
  windowMinutes = WINDOW_MINUTES,
} = {}) {
  const apiKey = process.env.AEROAPI_API_KEY;
  if (!apiKey) throw new Error("AEROAPI_API_KEY is not configured");

  const now = new Date();
  const windowEnd = new Date(now.getTime() + windowMinutes * 60_000);
  const url = new URL(
    `${AEROAPI_BASE_URL}/airports/${airportId}/flights/scheduled_arrivals`,
  );
  url.searchParams.set("start", toAeroApiTime(now));
  url.searchParams.set("end", toAeroApiTime(windowEnd));
  url.searchParams.set("max_pages", "1");

  const [response, airlines, countries, aircraft] = await Promise.all([
    fetch(url, {
      headers: { "x-apikey": apiKey },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    }),
    getAirlineMapping(),
    getAirportCountryMapping(),
    getAircraftMapping(),
  ]);

  if (!response.ok) {
    throw new Error(`AeroAPI returned ${response.status}`);
  }

  const data = await response.json();
  const seen = new Set();

  return (data.scheduled_arrivals ?? [])
    .filter((flight) => {
      if (!flight.fa_flight_id || seen.has(flight.fa_flight_id)) return false;
      seen.add(flight.fa_flight_id);
      return true;
    })
    .map((flight) => normalizeFlight(flight, airlines, countries, aircraft))
    .sort((left, right) =>
      (left.estimatedArrivalUtc ?? "").localeCompare(right.estimatedArrivalUtc ?? ""),
    );
}

export const __testing = {
  calculateBudgetStatus,
  getLogoCodes,
  formatAirport,
  normalizeFlight,
  parseDate,
  toAeroApiTime,
};
