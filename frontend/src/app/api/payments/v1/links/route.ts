import type { NextRequest } from "next/server";
import {
  attachRateHeaders,
  badRequest,
  checkIdempotency,
  gateRequest,
  genId,
  getOrigin,
  readJson,
  store,
  withCors,
  type ApiLink,
  type Currency,
} from "../_lib";

const ALLOWED_CURRENCIES: Currency[] = ["USD", "EUR", "KZT", "AEC"];

export async function GET(req: NextRequest) {
  const gate = gateRequest(req);
  if (!gate.ok) return gate.response;
  const { searchParams } = new URL(req.url);
  const limit = Math.min(100, Number(searchParams.get("limit") ?? 25));
  const data = Array.from(store.links.values())
    .sort((a, b) => b.created - a.created)
    .slice(0, limit);
  return attachRateHeaders(
    withCors(Response.json({ data, has_more: store.links.size > limit })),
    gate.rateHeaders
  );
}

export async function POST(req: NextRequest) {
  const gate = gateRequest(req);
  if (!gate.ok) return gate.response;

  const body = await readJson<{
    amount?: unknown;
    currency?: unknown;
    title?: unknown;
    description?: unknown;
    settlement?: unknown;
    expires_in_days?: unknown;
  }>(req);
  if (!body) return withCors(badRequest("Body must be JSON."));

  const { amount, currency, title } = body;
  if (typeof amount !== "number" || amount <= 0) {
    return withCors(badRequest("amount must be a positive number (minor units)."));
  }
  if (typeof currency !== "string" || !ALLOWED_CURRENCIES.includes(currency as Currency)) {
    return withCors(
      badRequest(`currency must be one of: ${ALLOWED_CURRENCIES.join(", ")}.`)
    );
  }
  if (typeof title !== "string" || !title.trim()) {
    return withCors(badRequest("title is required."));
  }
  const settlement = body.settlement === "aec" ? "aec" : "bank";
  const expDays =
    typeof body.expires_in_days === "number" && body.expires_in_days > 0
      ? body.expires_in_days
      : null;

  const id = genId("pl");
  const link: ApiLink = {
    id,
    amount,
    currency: currency as Currency,
    title: title.trim(),
    description:
      typeof body.description === "string" ? body.description.trim() : "",
    settlement,
    expires_in_days: expDays,
    status: "active",
    created: Math.floor(Date.now() / 1000),
    url: `${getOrigin(req)}/pay/${id}`,
    paid_at: null,
  };

  const responseBody = JSON.stringify(link);
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
  store.links.set(id, link);
  idem.cleanup();
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
