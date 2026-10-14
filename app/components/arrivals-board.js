"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  flightDataUrl,
  flightRefreshBucket,
  millisecondsUntilNextFlightRefresh,
} from "../../lib/refresh";
import { flightStatusPresentation } from "../../lib/status";

const LOGO_BASE_URL =
  "https://raw.githubusercontent.com/Jxck-S/airline-logos/main/flightaware_logos";
const FLIGHT_FILTERS = [
  { value: "all", label: "All" },
  { value: "domestic", label: "Domestic" },
  { value: "international", label: "International" },
];

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

function visibilityCountdown(value, now) {
  if (!value) return null;
  const minutes = Math.ceil((new Date(value).getTime() - now) / 60_000);
  if (minutes < -1) return "Passed window";
  if (minutes <= 1) return "At window";
  return `In ${minutes} min`;
}

function PlaneIcon() {
  return (
    <span className="logo-fallback" aria-hidden="true">
      ✈
    </span>
  );
}

function FlightStatus({ status }) {
  const presentation = flightStatusPresentation(status);
  return <span className={presentation.className}>{presentation.label}</span>;
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
  const sources = [
    ...(codes || []).map((code) => `/api/airline-tail/${encodeURIComponent(code)}`),
    ...(codes || []).map(
      (code) => `${LOGO_BASE_URL}/${encodeURIComponent(code)}.png`,
    ),
  ];

  if (!sources[index]) return <PlaneIcon />;

  return (
    <img
      className={index < (codes?.length || 0) ? "airline-logo airline-tail" : "airline-logo"}
      src={sources[index]}
      alt=""
      width="40"
      height="40"
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
  const [flightFilter, setFlightFilter] = useState("all");
  const [now, setNow] = useState(Date.now());
  const lastRequestedBucket = useRef(null);

  const loadFlights = useCallback(async ({ manual = false, scheduled = false } = {}) => {
    const requestTime = Date.now();
    const requestBucket = flightRefreshBucket(requestTime);
    if (scheduled && lastRequestedBucket.current === requestBucket) return;

    lastRequestedBucket.current = requestBucket;
    if (manual) setRefreshing(true);

    try {
      const response = await fetch(flightDataUrl(requestTime), {
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

    let cancelled = false;
    let refreshTimer;

    const scheduleNextRefresh = () => {
      refreshTimer = window.setTimeout(async () => {
        await loadFlights({ scheduled: true });
        if (!cancelled) scheduleNextRefresh();
      }, millisecondsUntilNextFlightRefresh(Date.now()));
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        loadFlights({ scheduled: true });
      }
    };

    scheduleNextRefresh();
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      cancelled = true;
      window.clearTimeout(refreshTimer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [autoRefreshEnabled, loadFlights]);

  const flights = data?.flights ?? [];
  const filteredFlights = flightFilter === "all"
    ? flights
    : flights.filter((flight) => flight.originScope === flightFilter);
  const filterDescription = flightFilter === "all" ? "" : `${flightFilter} `;

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
          <span>{loading ? "Loading flights…" : `${filteredFlights.length} ${filterDescription}flights in the next 30 minutes`}</span>
          {data?.updatedAt && <span>Updated {updatedFormatter.format(new Date(data.updatedAt))}</span>}
        </div>

        <div className="board-controls">
          <div className="flight-filter" role="group" aria-label="Filter arrivals">
            {FLIGHT_FILTERS.map((filter) => (
              <button
                type="button"
                key={filter.value}
                className={`filter-button ${flightFilter === filter.value ? "filter-button-active" : ""}`}
                aria-pressed={flightFilter === filter.value}
                onClick={() => setFlightFilter(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
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
              <th>Flight / Aircraft</th>
              <th>Origin</th>
              <th>Status</th>
              <th title="Window time is estimated for the usual Runway 28 approach">Visible / Arrives</th>
              <th>Distance</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingRows />
            ) : filteredFlights.length ? (
              filteredFlights.map((flight) => (
                <tr key={flight.id}>
                  <td data-label="Airline">
                    <div className="airline-cell">
                      <AirlineLogo airline={flight.airline} codes={flight.logoCodes} />
                      <span>{flight.airline}</span>
                    </div>
                  </td>
                  <td data-label="Flight / Aircraft" className="flight-aircraft-cell">
                    <span className="flight-number">{flight.callsign || "—"}</span>
                    <span className="aircraft-cell">{flight.aircraft || "—"}</span>
                  </td>
                  <td data-label="Origin" className="origin-cell">
                    <span>{flight.origin || "—"}</span>
                    <span className="origin-country">{flight.originCountry || "—"}</span>
                  </td>
                  <td data-label="Status"><FlightStatus status={flight.status} /></td>
                  <td data-label="Visible / Arrives">
                    <span className="arrival-time visible-time">
                      {flight.estimatedVisibleUtc
                        ? `≈ ${timeFormatter.format(new Date(flight.estimatedVisibleUtc))}`
                        : "—"}
                    </span>
                    <span className="countdown">
                      {[
                        visibilityCountdown(flight.estimatedVisibleUtc, now),
                        flight.estimatedArrivalUtc
                          ? `Lands ${timeFormatter.format(new Date(flight.estimatedArrivalUtc))}`
                          : null,
                      ].filter(Boolean).join(" · ")}
                    </span>
                  </td>
                  <td data-label="Distance" className="distance-cell">{flight.routeDistanceKm ? `${flight.routeDistanceKm} km` : "—"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="empty-state" colSpan="6">No upcoming {filterDescription}arrivals in the next 30 minutes.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
