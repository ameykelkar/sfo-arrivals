from __future__ import annotations

import base64
from functools import lru_cache
from pathlib import Path

import requests


# ---------------------------------------------------------------------------
# Source configuration — swap this URL to change the logo provider.
# {code} is replaced with the operator code (IATA or ICAO).
# Using Jxck-S/airline-logos which hosts FlightAware logos by operator code.
# See: https://github.com/Jxck-S/airline-logos
# ---------------------------------------------------------------------------
LOGO_CDN_URL = (
    "https://raw.githubusercontent.com/Jxck-S/airline-logos/"
    "main/flightaware_logos/{code}.png"
)

LOGOS_DIR = Path(__file__).resolve().parent / "data" / "logos"


def _download_logo(code: str) -> bool:
    """Download logo for `code` to disk. Returns True on success."""
    LOGOS_DIR.mkdir(parents=True, exist_ok=True)
    path = LOGOS_DIR / f"{code}.png"
    if path.exists():
        return True
    try:
        response = requests.get(LOGO_CDN_URL.format(code=code), timeout=5)
        response.raise_for_status()
        path.write_bytes(response.content)
        return True
    except Exception:  # noqa: BLE001
        return False


@lru_cache(maxsize=256)
def get_logo_data_uri(iata_code: str, icao_code: str = "") -> str | None:
    """
    Return a base64 PNG data URI for an airline, trying IATA code first
    then ICAO code as fallback.

    Downloaded logos are cached to data/logos/{code}.png so the network
    is only hit once per code. The lru_cache keeps encoded strings in
    memory to avoid repeated disk reads.
    """
    for code in filter(None, [iata_code, icao_code]):
        path = LOGOS_DIR / f"{code}.png"
        if not path.exists():
            if not _download_logo(code):
                continue
        try:
            encoded = base64.b64encode(path.read_bytes()).decode("ascii")
            return f"data:image/png;base64,{encoded}"
        except Exception:  # noqa: BLE001
            continue
    return None
