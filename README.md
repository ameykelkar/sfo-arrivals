# SFO Final Approach Monitor

This is a small Streamlit app designed to run on a Raspberry Pi and show
aircraft that are currently **arriving at San Francisco International
Airport (SFO)**.

You can keep this running on a dedicated display so that when you look
out from your patio, you can quickly see which flights are lining up to
land.

## Features

- **Live arrivals from FlightAware AeroAPI** — single endpoint call,
  cached to minimise paid API usage.
- **"On the way to SFO"** table showing flights expected to land within
  the next 30 minutes.
- **Readable columns**: Airline, Flight, Origin, Status, Est. Arrival (PT),
  Progress (%), Route Distance (mi).

## 1. Prerequisites

On both your development machine and your Raspberry Pi you will need:

- Python 3.9+ (Python 3.11 recommended on Raspberry Pi OS Bullseye/Bookworm)
- [`uv`](https://github.com/astral-sh/uv) (recommended Python package/virtualenv manager)

On the Raspberry Pi you will also want:

- A graphical environment (e.g. Raspberry Pi OS with desktop)
- A browser (Chromium is installed by default on Raspberry Pi OS)

## 2. Initial setup with uv (any machine)

Clone or copy this project into a directory, then from that directory:

```bash
# create a virtualenv in .venv using uv
uv venv

# activate it (Unix/macOS)
source .venv/bin/activate

# install dependencies from requirements.txt using uv
uv pip install -r requirements.txt
```

You can start the app locally with:

```bash
streamlit run app.py --server.port 8501 --server.headless true
```

Then open `http://localhost:8501` in your browser.

## 3. Configure AeroAPI

This app uses **FlightAware AeroAPI**. You'll need:

1. A FlightAware account with an AeroAPI plan (you mentioned the
   $5/month credit plan).
2. Your AeroAPI key.

Create a `.env` file in the project root (if it doesn't already exist)
and add:

```env
AEROAPI_API_KEY=your_real_aeroapi_key_here
```

The app automatically loads this via `python-dotenv` on startup.

## 4. Running on Raspberry Pi

On your Raspberry Pi:

1. Copy the project directory to the Pi (e.g. using `scp` or `git clone`
   if you host it somewhere).
2. In the project directory, create and activate a virtual environment
   with `uv`:

   ```bash
   cd /path/to/sfo-flight-status

   # create virtualenv
   uv venv

   # activate it
   source .venv/bin/activate

   # install dependencies
   uv pip install -r requirements.txt
   ```

3. Run the Streamlit app:

   ```bash
   streamlit run app.py --server.port 8501 --server.headless true
   ```

4. On the Pi's desktop, open Chromium and navigate to
   `http://localhost:8501`.

You should now see the SFO Final Approach Monitor. Leave this browser
window maximized on your display.

## 5. Kiosk mode on Raspberry Pi (auto-start)

To make this a hands‑off display, you can set up:

1. **A systemd service** to keep the Streamlit app running.
2. **Chromium kiosk mode** to auto-launch the page full screen on boot.

### 5.1 systemd service for Streamlit

Create a service file (for example `/etc/systemd/system/sfo-monitor.service`)
with contents like:

```ini
[Unit]
Description=SFO Final Approach Monitor
After=network-online.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/sfo-flight-status
Environment="PATH=/home/pi/sfo-flight-status/.venv/bin"
ExecStart=/home/pi/sfo-flight-status/.venv/bin/streamlit run app.py --server.port 8501 --server.headless true
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Then enable and start it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable sfo-monitor
sudo systemctl start sfo-monitor
```

### 5.2 Chromium kiosk mode

One simple approach is to add a command to your desktop autostart that
launches Chromium pointing at the app URL in kiosk mode.

For example, create or edit:

`~/.config/lxsession/LXDE-pi/autostart`

and add a line like:

```text
@chromium-browser --kiosk --app=http://localhost:8501
```

(Exact paths/options can vary slightly depending on your Raspberry Pi OS
version.)

On the next reboot, the Pi should:

- Start the Streamlit service.
- Launch Chromium full-screen pointing at your app.

## 6. Adjusting behavior

In `config.py` you can tweak:

- `API_CACHE_TTL_SECONDS` — how long flight data is cached before a new
  AeroAPI call is made. This is the primary cost driver ($0.005/call).
  At the default of 300 s (5 min) and ~6 hrs/day usage, expect ~$10/month.
  Set to 900 s (15 min) to stay comfortably under the $5/month budget.

## 7. Troubleshooting

- If you see **no flights** for a long time:
  - Check your internet connection.
  - Confirm your `AEROAPI_API_KEY` is set correctly in `.env`.
  - The app only shows flights arriving within the next 30 minutes —
    there may genuinely be a quiet period at SFO.
- If the app crashes, run it from a terminal and look for error output
  there.
