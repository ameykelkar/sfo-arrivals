# SFO Arrivals

A small Next.js arrivals board for flights expected to land at San Francisco
International Airport in the next 30 minutes. It deploys directly to Vercel and
uses FlightAware AeroAPI for live data.

## Local development

Requirements: Node.js 20.9 or newer and a FlightAware AeroAPI key.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Add your real key to `.env.local`, then open `http://localhost:3000`.

## Deploy to Vercel

1. Import this repository into Vercel.
2. Keep the detected framework preset as **Next.js**.
3. Add `AEROAPI_API_KEY` in the project's Environment Variables settings.
4. Add `LOGOSTREAM_API_KEY` for airline tail-fin images. The free Logostream
   plan is sufficient for small deployments, but does not permit caching.
5. Optionally add `API_CACHE_TTL_SECONDS`. It defaults to `300` seconds and
   values below that use the same five-minute minimum.
6. Deploy.

The API key is read only by the server route and is never sent to the browser.
The `/api/flights` response is cached at Vercel's CDN for the configured TTL so
multiple visitors do not cause one paid AeroAPI request each.

### FlightAware cost protection

Auto-refresh is off by default. A visitor can enable five-minute polling for the
current browser session; the setting resets when the page reloads or the tab is
closed. Before making a paid arrivals request, the server checks FlightAware's
free account-usage endpoint. It stops paid requests at $4.25 in a rolling 31-day
window. The $0.75 reserve protects the $5 monthly credit from FlightAware's
usage-reporting delay and concurrent requests. If usage cannot be verified, the
app fails closed without making the paid request.

## Commands

```bash
npm run dev    # local development server
npm test       # data normalization tests
npm run build  # production build
npm start      # run the production build locally
```

## Project structure

- `app/page.js` renders the application shell.
- `app/components/arrivals-board.js` loads and displays live arrivals.
- `app/api/flights/route.js` is the server-only Vercel/Next.js API route.
- `lib/flightaware.js` fetches and normalizes AeroAPI data.
- `lib/airlines.js`, `lib/airports.js`, and `lib/aircraft.js` resolve display names with built-in fallbacks.
- `app/globals.css` contains deliberately neutral, framework-independent styles.
