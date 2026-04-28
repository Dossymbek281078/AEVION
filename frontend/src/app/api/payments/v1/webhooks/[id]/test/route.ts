import type { NextRequest } from "next/server";
import {
  authError,
  badRequest,
  genId,
  readJson,
  signHmac,
  store,
  withCors,
} from "../../../_lib";

const ALLOWED_EVENTS = new Set([
  "checkout.created",
  "checkout.completed",
  "payment.failed",
  "payment.refunded",
  "settlement.scheduled",
  "settlement.paid",
]);

function samplePayload(event: string) {
  const ts = Math.floor(Date.now() / 1000);
  return {
    id: genId("evt"),
    type: event,
    created: ts,
    data: { sample: true, event },
  };
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = authError(req);
  if (auth) return withCors(Response.json(auth.body, { status: auth.code }));

  const { id } = await ctx.params;
  const ep = store.webhooks.get(id);
  if (!ep) {
    return withCors(
      Response.json(
        {
          error: { type: "not_found", message: `No webhook with id ${id}.` },
        },
        { status: 404 }
      )
    );
  }
  if (!ep.enabled) {
    return withCors(
      badRequest("Webhook is paused. Resume it before firing test events.")
    );
  }

  const body = await readJson<{ event?: unknown }>(req);
  const event =
    typeof body?.event === "string" && ALLOWED_EVENTS.has(body.event)
      ? body.event
      : ep.events[0] ?? "checkout.completed";

  const ts = Date.now();
  const payload = samplePayload(event);
  const rawBody = JSON.stringify(payload);
  const signature = signHmac(ep.secret, `${ts}.${rawBody}`);

  const startedAt = Date.now();
  let httpCode: number | null = null;
  let success = false;
  let error: string | null = null;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(ep.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Aevion-Webhooks/1.0",
        "X-AEVION-Signature": signature,
        "X-AEVION-Timestamp": ts.toString(),
        "X-AEVION-Event": event,
        "X-AEVION-Webhook": ep.id,
      },
      body: rawBody,
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    httpCode = r.status;
    success = r.status >= 200 && r.status < 300;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const durationMs = Date.now() - startedAt;

  return withCors(
    Response.json(
      {
        id: genId("att"),
        webhook_id: ep.id,
        event,
        delivered: success,
        http_code: httpCode,
        duration_ms: durationMs,
        timestamp: ts,
        signature,
        url: ep.url,
        error,
        payload,
      },
      { status: success ? 200 : 502 }
    )
  );
}

export function OPTIONS() {
  return withCors(new Response(null, { status: 204 }));
}
