"use client";

import { useCallback, useEffect, useState } from "react";

const REFRESH_INTERVAL_MS = 5 * 60 * 1_000;
const LOGO_BASE_URL =
  "https://raw.githubusercontent.com/Jxck-S/airline-logos/main/flightaware_logos";

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  hour: "numeric",
  minute: "2-digit",
});

const updatedFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});

function statusClass(status = "") {
  const value = status.toLowerCase();
  if (value.includes("on time") || value.includes("en route")) return "status status-good";
  if (value.includes("delay") || value.includes("divert")) return "status status-warning";
  if (value.includes("cancel")) return "status status-muted";
  return "status";
}

function arrivalCountdown(value, now) {
  if (!value) return null;
  const minutes = Math.ceil((new Date(value).getTime() - now) / 60_000);
  if (minutes <= 1) return "Arriving";
  return `In ${minutes} min`;
}

function PlaneIcon() {
  return (
    <span className="logo-fallback" aria-hidden="true">
      ✈
    </span>
  );
}

function AirlineLogo({ airline, codes }) {
  const [index, setIndex] = useState(0);

  if (!codes?.[index]) return <PlaneIcon />;

  return (
    <img
      className="airline-logo"
      src={`${LOGO_BASE_URL}/${encodeURIComponent(codes[index])}.png`}
      alt=""
      width="32"
      height="32"
      onError={() => setIndex((current) => current + 1)}
      title={airline}
    />
  );
}

function LoadingRows() {
  return Array.from({ length: 5 }, (_, index) => (
    <tr className="loading-row" key={index}>
      <td colSpan="6"><span /></td>
    </tr>
  ));
}

export default function ArrivalsBoard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now());

  const loadFlights = useCallback(async ({ manual = false } = {}) => {
    if (manual) setRefreshing(true);

    try {
      const response = await fetch("/api/flights");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load arrivals.");
      setData(payload);
      setError("");
    } catch (requestError) {
      setError(requestError.message || "Unable to load arrivals.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadFlights();
    const refreshTimer = window.setInterval(loadFlights, REFRESH_INTERVAL_MS);
    const clockTimer = window.setInterval(() => setNow(Date.now()), 30_000);

    return () => {
      window.clearInterval(refreshTimer);
      window.clearInterval(clockTimer);
    };
  }, [loadFlights]);

  const flights = data?.flights ?? [];

  return (
    <section className="board" aria-labelledby="board-title">
      <header className="board-header">
        <div>
          <p className="eyebrow">San Francisco International Airport</p>
          <h1 id="board-title">SFO Arrivals</h1>
        </div>

        <div className="board-meta" aria-live="polite">
          <span>{loading ? "Loading" : `${flights.length} flights`}</span>
          {data?.updatedAt && <span>Updated {updatedFormatter.format(new Date(data.updatedAt))} PT</span>}
          <button type="button" onClick={() => loadFlights({ manual: true })} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      {error && (
        <div className="error-message" role="alert">
          <span>{error}</span>
          {!data && <button onClick={() => loadFlights({ manual: true })}>Try again</button>}
        </div>
      )}

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Airline</th>
              <th>Flight</th>
              <th>Origin</th>
              <th>Status</th>
              <th>Arrives</th>
              <th>Distance</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingRows />
            ) : flights.length ? (
              flights.map((flight) => (
                <tr key={flight.id}>
                  <td>
                    <div className="airline-cell">
                      <AirlineLogo airline={flight.airline} codes={flight.logoCodes} />
                      <span>{flight.airline}</span>
                    </div>
                  </td>
                  <td className="flight-number">{flight.callsign || "—"}</td>
                  <td>{flight.origin || "—"}</td>
                  <td><span className={statusClass(flight.status)}>{flight.status}</span></td>
                  <td>
                    <span className="arrival-time">
                      {flight.estimatedArrivalUtc
                        ? timeFormatter.format(new Date(flight.estimatedArrivalUtc))
                        : "—"}
                    </span>
                    <span className="countdown">
                      {arrivalCountdown(flight.estimatedArrivalUtc, now)}
                    </span>
                  </td>
                  <td>{flight.routeDistanceMi ? `${flight.routeDistanceMi} mi` : "—"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="empty-state" colSpan="6">No upcoming arrivals in the next 30 minutes.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
