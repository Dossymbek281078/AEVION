import type { NextRequest } from "next/server";

// Web Vitals beacon receiver. Logs payload to stdout in dev, swallows in prod
// when FORWARD_URL is not set. When backend is wired, set METRICS_FORWARD_URL
// in env and we POST through.

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
  const forwardUrl = process.env.METRICS_FORWARD_URL?.trim();
  if (forwardUrl) {
    try {
      await fetch(forwardUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      // forward best-effort; do not surface to client
    }
  } else if (process.env.NODE_ENV !== "production") {
    console.log("[metrics]", payload);
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { "content-type": "application/json" },
  });
}

export async function GET() {
  return new Response(JSON.stringify({ ok: true, hint: "POST web-vitals JSON here" }), {
    status: 200, headers: { "content-type": "application/json" },
  });
}
