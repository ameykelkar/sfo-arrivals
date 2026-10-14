export const FLIGHT_REFRESH_INTERVAL_MS = 30 * 60 * 1_000;

const pacificHourFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  hour: "numeric",
  hourCycle: "h23",
});

export function isFlightRefreshActive(timestamp = Date.now()) {
  return Number(pacificHourFormatter.format(new Date(timestamp))) >= 8;
}

export function shouldDisplayFlight(flight, timestamp = Date.now()) {
  const arrival = flight.actualArrivalUtc || flight.estimatedArrivalUtc;
  if (!arrival) return true;
  const arrivalTime = Date.parse(arrival);
  return !Number.isFinite(arrivalTime) || timestamp < arrivalTime + 5 * 60_000;
}

export function flightRefreshBucket(timestamp = Date.now()) {
  return Math.floor(timestamp / FLIGHT_REFRESH_INTERVAL_MS);
}

export function millisecondsUntilNextFlightRefresh(timestamp = Date.now()) {
  const remainder = timestamp % FLIGHT_REFRESH_INTERVAL_MS;
  return remainder === 0
    ? FLIGHT_REFRESH_INTERVAL_MS
    : FLIGHT_REFRESH_INTERVAL_MS - remainder;
}

export function flightDataUrl(timestamp = Date.now()) {
  return `/api/flights?refresh=${flightRefreshBucket(timestamp)}`;
}
