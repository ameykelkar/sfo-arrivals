const LOGOSTREAM_BASE_URL = "https://airlines-api.logostream.dev/airlines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const apiKey = process.env.LOGOSTREAM_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "LOGOSTREAM_API_KEY is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { code: rawCode } = await params;
  const code = String(rawCode || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{2,3}$/.test(code)) {
    return Response.json(
      { error: "Invalid airline code." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const codeType = code.length === 2 ? "iata" : "icao";
  const url = new URL(`${LOGOSTREAM_BASE_URL}/${codeType}/${code}`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("variant", "tail");
  url.searchParams.set("format", "png");
  url.searchParams.set("size", "80");

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      return Response.json(
        { error: "Tail image is unavailable." },
        { status: response.status, headers: { "Cache-Control": "no-store" } },
      );
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("image/svg+xml")) {
      return Response.json(
        { error: "Tail image is unavailable." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    return new Response(response.body, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Type": contentType || "image/png",
      },
    });
  } catch (error) {
    console.error("Unable to load airline tail", error);
    return Response.json(
      { error: "Tail image is temporarily unavailable." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
