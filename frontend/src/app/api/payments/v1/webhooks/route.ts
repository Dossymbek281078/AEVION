import type { NextRequest } from "next/server";
import {
  attachRateHeaders,
  badRequest,
  checkIdempotency,
  gateRequest,
  genId,
  genSecret,
  readJson,
  store,
  withCors,
  type ApiWebhook,
} from "../_lib";
import { logAudit } from "../_audit";

const ALLOWED_EVENTS = [
  "checkout.created",
  "checkout.completed",
  "payment.failed",
  "payment.refunded",
  "settlement.scheduled",
  "settlement.paid",
  "dispute.created",
  "dispute.under_review",
  "dispute.won",
  "dispute.lost",
];

export async function GET(req: NextRequest) {
  const gate = gateRequest(req);
  if (!gate.ok) return gate.response;
  const data = Array.from(store.webhooks.values())
    .sort((a, b) => b.created - a.created)
    .map((w) => ({ ...w, secret: w.secret.slice(0, 12) + "…" }));
  return attachRateHeaders(
    withCors(Response.json({ data, has_more: false })),
    gate.rateHeaders
  );
}

export async function POST(req: NextRequest) {
  const gate = gateRequest(req);
  if (!gate.ok) return gate.response;

  const body = await readJson<{ url?: unknown; events?: unknown }>(req);
  if (!body) return withCors(badRequest("Body must be JSON."));

  if (typeof body.url !== "string" || !/^https?:\/\//i.test(body.url)) {
    return withCors(badRequest("url must be an absolute http(s) URL."));
  }
  if (!Array.isArray(body.events) || body.events.length === 0) {
    return withCors(badRequest("events must be a non-empty array of event names."));
  }
  const events = (body.events as unknown[]).filter(
    (e): e is string => typeof e === "string" && ALLOWED_EVENTS.includes(e)
  );
  if (events.length === 0) {
    return withCors(
      badRequest(`events must contain at least one of: ${ALLOWED_EVENTS.join(", ")}.`)
    );
  }

  const id = genId("we");
  const wh: ApiWebhook = {
    id,
    url: body.url,
    events,
    secret: genSecret(),
    enabled: true,
    created: Math.floor(Date.now() / 1000),
  };
  const responseBody = JSON.stringify(wh);
  const idem = checkIdempotency(req, responseBody);
  if (idem.hit) {
    return attachRateHeaders(
      withCors(
        new Response(idem.cachedBody, {
          status: 200,
          headers: { "content-type": "application/json", "idempotent-replayed": "true" },
        })
      ),
      gate.rateHeaders
    );
  }
  store.webhooks.set(id, wh);
  idem.cleanup();
  void logAudit(req, "webhook.registered", id, {
    url: wh.url,
    events: wh.events,
  });
  return attachRateHeaders(
    withCors(
      new Response(responseBody, {
        status: 201,
        headers: { "content-type": "application/json" },
      })
    ),
    gate.rateHeaders
  );
}

export function OPTIONS() {
  return withCors(new Response(null, { status: 204 }));
}
