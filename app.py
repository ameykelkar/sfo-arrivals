import datetime as dt
import zoneinfo

import streamlit as st

from config import API_CACHE_TTL_SECONDS
from aeroapi_client import get_incoming_flights
from board_renderer import render_board

_PACIFIC = zoneinfo.ZoneInfo("America/Los_Angeles")

st.set_page_config(
    page_title="SFO Arrivals",
    layout="wide",
    initial_sidebar_state="collapsed",
)


@st.cache_data(ttl=API_CACHE_TTL_SECONDS)
def _fetch() -> list[dict]:
    return get_incoming_flights()


def main() -> None:
    with st.spinner(""):
        flights = _fetch()

    if not flights:
        st.markdown(
            '<p style="color:#556;font-family:monospace;padding:20px;">'
            "NO ARRIVALS FOUND — CHECK AEROAPI_API_KEY</p>",
            unsafe_allow_html=True,
        )
        return

    updated_at = dt.datetime.now(_PACIFIC).strftime("%I:%M:%S %p")
    st.markdown(render_board(flights, updated_at), unsafe_allow_html=True)


if __name__ == "__main__":
    main()
