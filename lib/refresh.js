export const FLIGHT_REFRESH_INTERVAL_MS = 5 * 60 * 1_000;

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
