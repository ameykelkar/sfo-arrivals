"""
Renders the arrivals board as an HTML string.

All HTML structure and CSS loading lives here so that app.py
stays focused on Streamlit wiring and data fetching.
"""
from __future__ import annotations

import datetime as dt
import html
import math
from pathlib import Path

_CSS_PATH = Path(__file__).resolve().parent / "static" / "board.css"

_GENERIC_PLANE_SVG = (
    '<svg height="28" width="28" viewBox="0 0 24 24" '
    'style="vertical-align:middle;margin-right:10px;flex-shrink:0;" '
    'fill="#3a4060" xmlns="http://www.w3.org/2000/svg">'
    '<path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 '
    "1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 "
    '3.5 1v-1.5L13 19v-5.5z"/>'
    "</svg>"
)

COLUMNS: list[tuple[str, str]] = [
    ("airline",           "Airline"),
    ("callsign",          "Flight"),
    ("origin",            "Origin"),
    ("status",            "Status"),
    ("estimated_arrival", "Arrives"),
    ("route_distance_mi", "Distance"),
]

_STATUS_CLASS: dict[str, str] = {
    "on time":   "status-ontime",
    "en route":  "status-ontime",
    "scheduled": "status-scheduled",
    "delayed":   "status-delayed",
    "cancelled": "status-cancelled",
}


def _status_class(status: str | None) -> str:
    s = (status or "").lower()
    for keyword, cls in _STATUS_CLASS.items():
        if keyword in s:
            return cls
    return "status-scheduled"


def _airline_cell(flight: dict) -> str:
    logo = flight.get("logo_url")
    img = (
        f'<img src="{logo}" height="28" '
        f'style="vertical-align:middle;margin-right:10px;border-radius:3px;">'
        if logo else _GENERIC_PLANE_SVG
    )
    name = html.escape(str(flight.get("airline") or ""))
    return f'<td class="col-airline">{img}{name}</td>'


def _status_cell(value: str | None) -> str:
    cls = _status_class(value)
    label = html.escape((value or "").upper())
    return f'<td><span class="{cls}">{label}</span></td>'


def _arrival_cell(flight: dict) -> str:
    time_str = html.escape(str(flight.get("estimated_arrival") or ""))
    countdown = ""
    utc_str = flight.get("estimated_arrival_utc")
    if utc_str:
        try:
            arr = dt.datetime.fromisoformat(utc_str)
            secs = (arr - dt.datetime.now(dt.timezone.utc)).total_seconds()
            if secs <= 60:
                countdown = '<br><span class="eta-countdown">arriving</span>'
            else:
                mins = math.ceil(secs / 60)
                countdown = f'<br><span class="eta-countdown">in {mins} min</span>'
        except Exception:  # noqa: BLE001
            pass
    return f"<td>{time_str}{countdown}</td>"


def _build_rows(flights: list[dict]) -> str:
    rows = []
    for flight in flights:
        cells = []
        for key, _ in COLUMNS:
            if key == "airline":
                cells.append(_airline_cell(flight))
            elif key == "status":
                cells.append(_status_cell(flight.get("status")))
            elif key == "estimated_arrival":
                cells.append(_arrival_cell(flight))
            else:
                cells.append(f'<td>{html.escape(str(flight.get(key) or ""))}</td>')
        rows.append(f"<tr>{''.join(cells)}</tr>")
    return "".join(rows)


def render_board(flights: list[dict], updated_at: str = "") -> str:
    """Return the full HTML string for the arrivals board."""
    css = _CSS_PATH.read_text(encoding="utf-8")

    header_cells = "".join(f"<th>{label}</th>" for _, label in COLUMNS)

    if flights:
        tbody = f"<tbody>{_build_rows(flights)}</tbody>"
        flight_count = f"{len(flights)} FLIGHTS"
    else:
        col_span = len(COLUMNS)
        tbody = (
            f'<tbody><tr><td colspan="{col_span}" class="no-arrivals">'
            "No upcoming arrivals"
            f"</td></tr></tbody>"
        )
        flight_count = "0 FLIGHTS"

    return f"""
<style>{css}</style>
<div class="board-wrap">
  <div class="board-header">
    <h2>SFO &mdash; Arrivals</h2>
    <span class="count">
      <span class="live-text">LIVE</span> &nbsp;&middot;&nbsp; {flight_count}
    </span>
    <span class="updated-at">UPDATED {updated_at}</span>
    <button class="fs-btn" title="Toggle fullscreen"
      onclick="document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()">
      <svg class="icon-expand" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
      </svg>
      <svg class="icon-compress" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
      </svg>
    </button>
  </div>
  <table class="flt-table">
    <thead><tr>{header_cells}</tr></thead>
    {tbody}
  </table>
</div>
"""
