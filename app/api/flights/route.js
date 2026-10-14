import {
  AeroApiBudgetError,
  getAeroApiBudgetStatus,
  getIncomingFlights,
} from "../../../lib/flightaware";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function configuredCacheSeconds() {
  const configured = Number.parseInt(process.env.API_CACHE_TTL_SECONDS ?? "1800", 10);
  return Number.isFinite(configured) && configured >= 1800 ? configured : 1800;
}

function responseHeaders(ttl) {
  return {
    "Cache-Control": "public, max-age=0, must-revalidate",
    "Vercel-CDN-Cache-Control": `public, s-maxage=${ttl}, stale-if-error=3600`,
  };
}

export async function GET() {
  if (!process.env.AEROAPI_API_KEY) {
    return Response.json(
      { error: "AEROAPI_API_KEY is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    await getAeroApiBudgetStatus();
    const flights = await getIncomingFlights();
    const refreshAfterSeconds = configuredCacheSeconds();

    return Response.json(
      {
        airport: "SFO",
        flights,
        updatedAt: new Date().toISOString(),
      },
      { headers: responseHeaders(refreshAfterSeconds) },
    );
  } catch (error) {
    if (error instanceof AeroApiBudgetError) {
      return Response.json(
        { error: error.message },
        { status: 429, headers: { "Cache-Control": "no-store" } },
      );
    }

    console.error("Unable to load SFO arrivals", error);

    return Response.json(
      { error: "Flight data is temporarily unavailable." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
