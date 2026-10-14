import { getIncomingFlights } from "../../../lib/flightaware";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cacheSeconds() {
  const configured = Number.parseInt(process.env.API_CACHE_TTL_SECONDS ?? "300", 10);
  return Number.isFinite(configured) && configured >= 60 ? configured : 300;
}

function responseHeaders() {
  const ttl = cacheSeconds();

  return {
    "Cache-Control": "public, max-age=0, must-revalidate",
    "Vercel-CDN-Cache-Control": `public, s-maxage=${ttl}, stale-while-revalidate=60, stale-if-error=3600`,
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
    const flights = await getIncomingFlights();

    return Response.json(
      {
        airport: "SFO",
        flights,
        updatedAt: new Date().toISOString(),
      },
      { headers: responseHeaders() },
    );
  } catch (error) {
    console.error("Unable to load SFO arrivals", error);

    return Response.json(
      { error: "Flight data is temporarily unavailable." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
