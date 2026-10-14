import { getAirlineMapping, inferAirlineName } from "./airlines.js";

const AEROAPI_BASE_URL = "https://aeroapi.flightaware.com/aeroapi";
const SFO_ICAO = "KSFO";
const WINDOW_MINUTES = 30;

function toAeroApiTime(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function parseDate(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatAirport(reference = {}) {
  const code =
    reference.code_iata || reference.code_icao || reference.code || reference.code_lid;
  const place = reference.city || reference.name;

  if (place && code) return `${place} (${code})`;
  return code || null;
}

function normalizeFlight(flight, airlines) {
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
    origin: formatAirport(flight.origin),
    status: flight.status || "Scheduled",
    estimatedArrivalUtc: arrival?.toISOString() ?? null,
    routeDistanceMi: Number.isFinite(distance) ? Math.ceil(distance) : null,
    logoCodes: [...new Set([operatorIata, operatorIcao].filter(Boolean))],
  };
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

  const [response, airlines] = await Promise.all([
    fetch(url, {
      headers: { "x-apikey": apiKey },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    }),
    getAirlineMapping(),
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
    .map((flight) => normalizeFlight(flight, airlines))
    .sort((left, right) =>
      (left.estimatedArrivalUtc ?? "").localeCompare(right.estimatedArrivalUtc ?? ""),
    );
}

export const __testing = { formatAirport, normalizeFlight, parseDate, toAeroApiTime };
