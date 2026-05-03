import { store } from "../payments/v1/_lib";
import { kvBackend } from "../payments/v1/_persist";

const STARTED_AT = Date.now();

export function GET() {
  const now = Date.now();
  const uptimeMs = now - STARTED_AT;
  const memUsed =
    typeof process !== "undefined" && process.memoryUsage
      ? Math.round(process.memoryUsage().rss / 1024 / 1024)
      : null;

  const surfaces = [
    { name: "links", count: store.links.size, ok: true },
    { name: "checkouts", count: store.checkouts.size, ok: true },
    { name: "subscriptions", count: store.subscriptions.size, ok: true },
    { name: "webhooks", count: store.webhooks.size, ok: true },
    { name: "settlements", count: store.settlements.size, ok: true },
    {
      name: "idempotency_cache",
      count: store.idempotency.size,
      ok: store.idempotency.size < 5000,
    },
  ];

  const allOk = surfaces.every((s) => s.ok);

  return Response.json(
    {
      status: allOk ? "ok" : "degraded",
      timestamp: now,
      iso: new Date(now).toISOString(),
      uptime_ms: uptimeMs,
      uptime_human: formatUptime(uptimeMs),
      version: "v1.3",
      runtime: typeof process !== "undefined" ? process.version : "edge",
      memory_rss_mb: memUsed,
      persistence: kvBackend(),
      surfaces,
    },
    {
      headers: {
        "cache-control": "no-store",
        "access-control-allow-origin": "*",
      },
    }
  );
}

function formatUptime(ms: number) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
    },
  });
}
