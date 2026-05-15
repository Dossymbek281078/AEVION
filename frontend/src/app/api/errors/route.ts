import type { NextRequest } from "next/server";

// Client-side error reporter sink. Same pattern as /api/metrics — logs in dev,
// optionally forwards to ERRORS_FORWARD_URL (Sentry-compat ingest, etc).

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let payload: unknown = null;
  try {
    const text = await req.text();
    payload = text ? JSON.parse(text) : null;
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "bad json" }), {
      status: 400, headers: { "content-type": "application/json" },
    });
  }
  const forwardUrl = process.env.ERRORS_FORWARD_URL?.trim();
  if (forwardUrl) {
    try {
      await fetch(forwardUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      // silent — client already saw an error
    }
  } else if (process.env.NODE_ENV !== "production") {
    console.error("[client-error]", payload);
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { "content-type": "application/json" },
  });
}

export async function GET() {
  return new Response(JSON.stringify({ ok: true, hint: "POST error JSON here" }), {
    status: 200, headers: { "content-type": "application/json" },
  });
}
