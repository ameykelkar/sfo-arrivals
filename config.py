"""
Configuration for the SFO Final Approach Monitor.

This module holds deployment-time configuration such as the SFO
identifier, AeroAPI credentials, and the API cache TTL.
"""

from __future__ import annotations

import os

from dotenv import load_dotenv

# Load environment variables from a local .env file if present.
# This lets you keep your AeroAPI key in .env instead of exporting it
# in your shell each time.
load_dotenv()

SFO_ICAO: str = "KSFO"

# AeroAPI (FlightAware) configuration
AEROAPI_BASE_URL: str = "https://aeroapi.flightaware.com/aeroapi"

# It is strongly recommended to set this via an environment variable
# `AEROAPI_API_KEY` on your Pi rather than hard-coding a key here.
AEROAPI_API_KEY: str | None = os.getenv("AEROAPI_API_KEY")

# How long AeroAPI data is cached (seconds). This is the true cost driver —
# each cache expiry triggers 1 API call at $0.005/refresh.
#
# Budget guide ($0.005/refresh, $5/month):
#   ~6 hrs/day active  →  15 min interval ≈ $3.60/month
#   ~6 hrs/day active  →   5 min interval ≈ $10.80/month (over budget)
API_CACHE_TTL_SECONDS: int = 300  # 5 minutes — adjust to match your usage

