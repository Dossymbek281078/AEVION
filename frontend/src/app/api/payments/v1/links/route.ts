import type { NextRequest } from "next/server";
import {
  attachRateHeaders,
  badRequest,
  parseAmount,
  parseLimit,
  beginIdempotency,
  gateRequest,
  genId,
  getOrigin,
  readJson,
  store,
  withCors,
  type ApiLink,
  type Currency,
} from "../_lib";
import { logAudit } from "../_audit";

const ALLOWED_CURRENCIES: Currency[] = ["USD", "EUR", "KZT", "AEC"];

export async function GET(req: NextRequest) {
  const gate = gateRequest(req);
  if (!gate.ok) return gate.response;
  const { searchParams } = new URL(req.url);
  const limit = parseLimit(searchParams.get("limit"), 25, 100);
  if (typeof limit === "string") {
    return attachRateHeaders(withCors(badRequest(limit)), gate.rateHeaders);
  }
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

  // Ключ резервируется до работы: иначе одновременный повтор тоже сочтёт себя
  // первым и создаст второй объект.
  const idem = beginIdempotency(req, JSON.stringify(body));
  if (idem.status === "replay") {
    return attachRateHeaders(
      withCors(
        new Response(idem.body, {
          status: 200,
          headers: { "content-type": "application/json", "idempotent-replayed": "true" },
        })
      ),
      gate.rateHeaders
    );
  }
  if (idem.status === "conflict") {
    return attachRateHeaders(withCors(badRequest(idem.message, 409)), gate.rateHeaders);
  }

  const { currency, title } = body;
  const amount = parseAmount(body.amount);
  if (typeof amount === "string") return withCors(badRequest(amount));
  if (typeof currency !== "string" || !ALLOWED_CURRENCIES.includes(currency as Currency)) {
    return withCors(
      badRequest(`currency must be one of: ${ALLOWED_CURRENCIES.join(", ")}.`)
    );
  }
  if (typeof title !== "string" || !title.trim()) {
    return withCors(badRequest("title is required."));
  }
  const settlement = body.settlement === "aec" ? "aec" : "bank";
  // Собственная спека (`/api/openapi.json`) обещает `integer, minimum: 1`, а код
  // принимал `0.5` и `Infinity` (`1e400` в JSON — это Infinity, и `> 0` истинно).
  // Расхождение кода с опубликованным контрактом — то же враньё, только тише.
  if (body.expires_in_days !== undefined && body.expires_in_days !== null) {
    const d = body.expires_in_days;
    if (typeof d !== "number" || !Number.isInteger(d) || d < 1 || d > 3650) {
      return withCors(
        badRequest("expires_in_days must be a whole number of days between 1 and 3650.")
      );
    }
  }
  const expDays =
    typeof body.expires_in_days === "number" ? body.expires_in_days : null;

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
  store.links.set(id, link);
  idem.commit(responseBody);
  void logAudit(req, "link.created", id, {
    amount: link.amount,
    currency: link.currency,
    settlement: link.settlement,
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
