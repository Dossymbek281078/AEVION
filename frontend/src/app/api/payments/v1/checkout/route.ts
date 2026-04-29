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
  type ApiCheckout,
  type Currency,
} from "../_lib";

const ALLOWED_CURRENCIES: Currency[] = ["USD", "EUR", "KZT", "AEC"];

export async function POST(req: NextRequest) {
  const gate = gateRequest(req);
  if (!gate.ok) return gate.response;

  const body = await readJson<{
    amount?: unknown;
    currency?: unknown;
    settlement?: unknown;
    methods?: unknown;
    metadata?: unknown;
  }>(req);
  if (!body) return withCors(badRequest("Body must be JSON."));

  if (typeof body.amount !== "number" || body.amount <= 0) {
    return withCors(badRequest("amount must be a positive number (minor units)."));
  }
  if (
    typeof body.currency !== "string" ||
    !ALLOWED_CURRENCIES.includes(body.currency as Currency)
  ) {
    return withCors(
      badRequest(`currency must be one of: ${ALLOWED_CURRENCIES.join(", ")}.`)
    );
  }

  const methods = Array.isArray(body.methods)
    ? (body.methods as unknown[]).filter((m): m is string => typeof m === "string")
    : ["visa-mc", "apple-pay", "aec-credit"];

  const id = genId("co");
  const secret = `${id}_secret_${Math.random().toString(36).slice(2, 22)}`;
  const checkout: ApiCheckout = {
    id,
    amount: body.amount,
    currency: body.currency as Currency,
    settlement:
      typeof body.settlement === "string" ? body.settlement : "aevion-bank",
    methods,
    metadata:
      body.metadata && typeof body.metadata === "object"
        ? (body.metadata as Record<string, string>)
        : null,
    url: `${getOrigin(req)}/checkout/${id}`,
    client_secret: secret,
    status: "open",
    created: Math.floor(Date.now() / 1000),
  };

  const responseBody = JSON.stringify(checkout);
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
  store.checkouts.set(id, checkout);
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
