from __future__ import annotations

import csv
import datetime as dt
import math
import zoneinfo
from functools import lru_cache
from pathlib import Path
from typing import Any

import requests

from config import AEROAPI_BASE_URL, AEROAPI_API_KEY, SFO_ICAO
from logo_provider import get_logo_data_uri


OPENFLIGHTS_AIRLINES_URL = (
    "https://raw.githubusercontent.com/jpatokal/openflights/"
    "master/data/airlines.dat"
)
DATA_DIR = Path(__file__).resolve().parent / "data"
AIRLINES_PATH = DATA_DIR / "airlines.dat"

_PACIFIC = zoneinfo.ZoneInfo("America/Los_Angeles")


@lru_cache(maxsize=1)
def _load_airline_mapping() -> dict[str, str]:
    """
    Load IATA/ICAO airline codes → human-readable names from the OpenFlights
    dataset. Downloads once on first run and caches to disk thereafter.
    """
    mapping: dict[str, str] = {}
    try:
        if AIRLINES_PATH.exists():
            text = AIRLINES_PATH.read_text(encoding="utf-8", errors="ignore")
        else:
            response = requests.get(OPENFLIGHTS_AIRLINES_URL, timeout=10)
            response.raise_for_status()
            text = response.text
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            AIRLINES_PATH.write_text(text, encoding="utf-8")
    except Exception as exc:  # noqa: BLE001
        print(f"Error loading airline mapping from OpenFlights: {exc}")
        return mapping

    for row in csv.reader(text.splitlines()):
        # Format: Airline ID, Name, Alias, IATA, ICAO, Callsign, Country, Active
        if len(row) < 5:
            continue
        name = row[1].strip('" ')
        iata = row[3].strip().upper()
        icao = row[4].strip().upper()
        if name and iata and iata != r"\N":
            mapping[iata] = name
        if name and icao and icao != r"\N":
            mapping[icao] = name

    return mapping


def _infer_airline_name(code_or_ident: Any) -> str | None:
    """Resolve an operator code or ident (e.g. 'UAL123', 'B6') to an airline name."""
    if not code_or_ident:
        return None
    token = str(code_or_ident).strip().upper().split()[0]
    mapping = _load_airline_mapping()
    for candidate in (token, token[:3], token[:2]):
        if candidate in mapping:
            return mapping[candidate]
    return None


def _get_headers() -> dict[str, str]:
    if not AEROAPI_API_KEY:
        return {}
    return {"x-apikey": AEROAPI_API_KEY}


def _parse_time(value: Any) -> dt.datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    text = value.strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        return dt.datetime.fromisoformat(text)
    except ValueError:
        return None


def _to_pacific(value: str | None) -> str | None:
    parsed = _parse_time(value)
    if not parsed:
        return None
    return parsed.astimezone(_PACIFIC).strftime("%I:%M %p")


def _format_airport(ref: dict[str, Any] | None) -> str | None:
    if not ref:
        return None
    code = (
        ref.get("code_iata")
        or ref.get("code_icao")
        or ref.get("code")
        or ref.get("code_lid")
    )
    city = ref.get("city")
    name = ref.get("name")
    if city and code:
        return f"{city} ({code})"
    if name and code:
        return f"{name} ({code})"
    return code


def _fetch_scheduled_arrivals(
    airport_id: str,
    window_end: dt.datetime,
) -> list[dict[str, Any]]:
    """
    Fetch upcoming/en-route flights expected to land before `window_end`.
    Makes a single AeroAPI call.
    """
    headers = _get_headers()
    if not headers:
        return []

    url = f"{AEROAPI_BASE_URL}/airports/{airport_id}/flights/scheduled_arrivals"
    params = {
        "start": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "end": window_end.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "max_pages": 1,
    }

    try:
        response = requests.get(url, headers=headers, params=params, timeout=8)
        response.raise_for_status()
        data = response.json() or {}
    except Exception as exc:  # noqa: BLE001
        print(f"Error calling AeroAPI scheduled_arrivals: {exc}")
        return []

    return data.get("scheduled_arrivals") or []


def get_incoming_flights(
    airport_id: str = SFO_ICAO,
    window_minutes: int = 30,
) -> list[dict[str, Any]]:
    """
    Return flights expected to land at `airport_id` within the next
    `window_minutes` minutes, normalized for display.

    Makes a single AeroAPI call to /airports/{id}/flights/scheduled_arrivals.
    """
    now = dt.datetime.now(dt.timezone.utc)
    window_end = now + dt.timedelta(minutes=window_minutes)

    flights = _fetch_scheduled_arrivals(airport_id, window_end)

    normalized: list[dict[str, Any]] = []
    seen: set[str] = set()

    for flight in flights:
        fa_id = flight.get("fa_flight_id")
        if not fa_id or fa_id in seen:
            continue
        seen.add(fa_id)

        ident = (
            flight.get("ident_iata")
            or flight.get("ident_icao")
            or flight.get("ident")
        )
        operator_iata = flight.get("operator_iata") or ""
        operator_icao = flight.get("operator_icao") or flight.get("operator") or ""
        operator_code = operator_iata or operator_icao
        airline_name = _infer_airline_name(operator_code) or ident or operator_code

        route_distance_raw = flight.get("route_distance")
        route_distance_mi = (
            math.ceil(float(route_distance_raw))
            if isinstance(route_distance_raw, (int, float))
            else None
        )

        _estimated_on_raw = flight.get("estimated_on") or flight.get("scheduled_on")
        estimated_on_dt = _parse_time(_estimated_on_raw)
        estimated_on = (
            estimated_on_dt.astimezone(_PACIFIC).strftime("%I:%M %p")
            if estimated_on_dt else None
        )

        normalized.append(
            {
                "logo_url": get_logo_data_uri(operator_iata, operator_icao) if (operator_iata or operator_icao) else None,
                "airline": airline_name,
                "callsign": ident,
                "origin": _format_airport(flight.get("origin") or {}),
                "status": flight.get("status"),
                "estimated_arrival": estimated_on,
                "estimated_arrival_utc": estimated_on_dt.isoformat() if estimated_on_dt else None,
                "route_distance_mi": route_distance_mi,
            }
        )

    normalized.sort(key=lambda f: f.get("estimated_arrival_utc") or "")
    return normalized
