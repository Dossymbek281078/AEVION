import type { NextRequest } from "next/server";
import {
  authError,
  badRequest,
  checkIdempotency,
  genId,
  genSecret,
  readJson,
  store,
  withCors,
  type ApiWebhook,
} from "../_lib";

const ALLOWED_EVENTS = [
  "checkout.created",
  "checkout.completed",
  "payment.failed",
  "payment.refunded",
  "settlement.scheduled",
  "settlement.paid",
];

export async function GET(req: NextRequest) {
  const auth = authError(req);
  if (auth) return withCors(Response.json(auth.body, { status: auth.code }));
  const data = Array.from(store.webhooks.values())
    .sort((a, b) => b.created - a.created)
    .map((w) => ({ ...w, secret: w.secret.slice(0, 12) + "…" }));
  return withCors(Response.json({ data, has_more: false }));
}

export async function POST(req: NextRequest) {
  const auth = authError(req);
  if (auth) return withCors(Response.json(auth.body, { status: auth.code }));

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
    return withCors(
      new Response(idem.cachedBody, {
        status: 200,
        headers: { "content-type": "application/json", "idempotent-replayed": "true" },
      })
    );
  }
  store.webhooks.set(id, wh);
  idem.cleanup();
  return withCors(
    new Response(responseBody, {
      status: 201,
      headers: { "content-type": "application/json" },
    })
  );
}

export function OPTIONS() {
  return withCors(new Response(null, { status: 204 }));
}
