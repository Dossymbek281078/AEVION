import type { NextRequest } from "next/server";

// Health endpoint для uptime monitoring и smoke-тестов. Edge runtime →
// near-zero latency. Возвращает {ok, version, ts, env, runtime}.
// HEAD also supported для cheap pings.

export const runtime = "edge";
export const dynamic = "force-dynamic";

const STARTED_AT = Date.now();

function payload() {
  return {
    ok: true,
    service: "aevion-frontend-exchange",
    version: process.env.NEXT_PUBLIC_APP_VERSION || "dev",
    env: process.env.NODE_ENV || "unknown",
    runtime: "edge",
    ts: Date.now(),
    uptimeMs: Date.now() - STARTED_AT,
  };
}

export async function GET(_req: NextRequest) {
  return new Response(JSON.stringify(payload()), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: { "cache-control": "no-store" },
  });
}
