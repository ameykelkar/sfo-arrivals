"use client";

import { useCallback, useEffect, useState } from "react";

const AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1_000;
const LOGO_BASE_URL =
  "https://raw.githubusercontent.com/Jxck-S/airline-logos/main/flightaware_logos";

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  hour: "numeric",
  minute: "2-digit",
});

const currentTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});

const updatedFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  weekday: "short",
  month: "short",
  day: "numeric",
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

function ArrivalsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m3.7 13.6 6.1 1.7 3.7 5.5 2.1-.6-1.6-5.5 4.5-1.3c1.8-.5 3-1.5 2.7-2.5-.3-1-1.9-1.2-3.7-.7L13 11.5 8.8 8l-1.5.4 2.4 4.4-4.3 1.3-2-1.5-1.1.3 1.4 2.7Z" />
    </svg>
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
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [now, setNow] = useState(Date.now());

  const loadFlights = useCallback(async ({ manual = false } = {}) => {
    if (manual) setRefreshing(true);

    try {
      const response = await fetch("/api/flights", {
        headers: { Pragma: "no-cache" },
      });
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
  }, [loadFlights]);

  useEffect(() => {
    const clockTimer = window.setInterval(() => setNow(Date.now()), 1_000);

    return () => window.clearInterval(clockTimer);
  }, []);

  useEffect(() => {
    if (!autoRefreshEnabled) return undefined;

    const refreshTimer = window.setInterval(loadFlights, AUTO_REFRESH_INTERVAL_MS);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") loadFlights();
    };

    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(refreshTimer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [autoRefreshEnabled, loadFlights]);

  const flights = data?.flights ?? [];

  return (
    <section className="board" aria-labelledby="board-title">
      <header className="board-header">
        <div className="board-identity">
          <span className="airport-code" aria-hidden="true">SFO</span>
          <div>
            <p className="eyebrow">San Francisco International Airport</p>
            <h1 id="board-title"><ArrivalsIcon /> Arrivals</h1>
          </div>
        </div>

        <div className="terminal-clock" aria-label="Current Pacific time">
          <span>{dateFormatter.format(new Date(now))}</span>
          <strong>{currentTimeFormatter.format(new Date(now))}</strong>
          <small>Pacific time</small>
        </div>
      </header>

      <div className="board-toolbar" aria-live="polite">
        <div className="board-summary">
          <span className="live-indicator"><i /> Live arrivals</span>
          <span>{loading ? "Loading flights…" : `${flights.length} flights in the next 30 minutes`}</span>
          {data?.updatedAt && <span>Updated {updatedFormatter.format(new Date(data.updatedAt))}</span>}
        </div>

        <div className="board-controls">
          <button
            type="button"
            className={`control-button auto-refresh ${autoRefreshEnabled ? "auto-refresh-active" : ""}`}
            aria-pressed={autoRefreshEnabled}
            onClick={() => setAutoRefreshEnabled((enabled) => !enabled)}
          >
            <span>Auto refresh</span>
            <span className="toggle-state">{autoRefreshEnabled ? "On" : "Off"}</span>
          </button>
          <button
            type="button"
            className="control-button refresh-button"
            onClick={() => loadFlights({ manual: true })}
            disabled={refreshing}
          >
            <span aria-hidden="true" className={refreshing ? "refresh-icon spinning" : "refresh-icon"}>↻</span>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

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
                  <td data-label="Airline">
                    <div className="airline-cell">
                      <AirlineLogo airline={flight.airline} codes={flight.logoCodes} />
                      <span>{flight.airline}</span>
                    </div>
                  </td>
                  <td data-label="Flight" className="flight-number">{flight.callsign || "—"}</td>
                  <td data-label="Origin" className="origin-cell">{flight.origin || "—"}</td>
                  <td data-label="Status"><span className={statusClass(flight.status)}>{flight.status}</span></td>
                  <td data-label="Arrival">
                    <span className="arrival-time">
                      {flight.estimatedArrivalUtc
                        ? timeFormatter.format(new Date(flight.estimatedArrivalUtc))
                        : "—"}
                    </span>
                    <span className="countdown">
                      {arrivalCountdown(flight.estimatedArrivalUtc, now)}
                    </span>
                  </td>
                  <td data-label="Distance" className="distance-cell">{flight.routeDistanceMi ? `${flight.routeDistanceMi} mi` : "—"}</td>
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
