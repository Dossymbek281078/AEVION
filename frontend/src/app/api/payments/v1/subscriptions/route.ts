import type { NextRequest } from "next/server";
import {
  authError,
  badRequest,
  checkIdempotency,
  genId,
  readJson,
  store,
  withCors,
  type ApiSubscription,
  type Currency,
} from "../_lib";

const ALLOWED_CURRENCIES: Currency[] = ["USD", "EUR", "KZT", "AEC"];
const ALLOWED_INTERVALS: ApiSubscription["interval"][] = [
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
];
const INTERVAL_DAYS = { weekly: 7, monthly: 30, quarterly: 90, yearly: 365 };

export async function GET(req: NextRequest) {
  const auth = authError(req);
  if (auth) return withCors(Response.json(auth.body, { status: auth.code }));
  const data = Array.from(store.subscriptions.values()).sort(
    (a, b) => b.created - a.created
  );
  return withCors(Response.json({ data, has_more: false }));
}

export async function POST(req: NextRequest) {
  const auth = authError(req);
  if (auth) return withCors(Response.json(auth.body, { status: auth.code }));

  const body = await readJson<{
    customer?: unknown;
    plan_name?: unknown;
    amount?: unknown;
    currency?: unknown;
    interval?: unknown;
    trial_days?: unknown;
  }>(req);
  if (!body) return withCors(badRequest("Body must be JSON."));

  if (typeof body.customer !== "string" || !body.customer.trim()) {
    return withCors(badRequest("customer is required."));
  }
  if (typeof body.plan_name !== "string" || !body.plan_name.trim()) {
    return withCors(badRequest("plan_name is required."));
  }
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
  if (
    typeof body.interval !== "string" ||
    !ALLOWED_INTERVALS.includes(body.interval as ApiSubscription["interval"])
  ) {
    return withCors(
      badRequest(`interval must be one of: ${ALLOWED_INTERVALS.join(", ")}.`)
    );
  }
  const trial =
    typeof body.trial_days === "number" && body.trial_days >= 0 ? body.trial_days : 0;

  const id = genId("sub");
  const now = Math.floor(Date.now() / 1000);
  const interval = body.interval as ApiSubscription["interval"];
  const periodEndSec = now + (trial > 0 ? trial * 86400 : INTERVAL_DAYS[interval] * 86400);
  const sub: ApiSubscription = {
    id,
    customer: body.customer.trim(),
    plan_name: body.plan_name.trim(),
    amount: body.amount,
    currency: body.currency as Currency,
    interval,
    trial_days: trial,
    status: trial > 0 ? "trialing" : "active",
    current_period_start: now,
    current_period_end: periodEndSec,
    created: now,
  };

  const responseBody = JSON.stringify(sub);
  const idem = checkIdempotency(req, responseBody);
  if (idem.hit) {
    return withCors(
      new Response(idem.cachedBody, {
        status: 200,
        headers: { "content-type": "application/json", "idempotent-replayed": "true" },
      })
    );
  }
  store.subscriptions.set(id, sub);
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
