import type { NextRequest } from "next/server";
import {
  attachRateHeaders,
  badRequest,
  checkIdempotency,
  gateRequest,
  genId,
  getOrigin,
  signHmac,
  store,
  withCors,
  type ApiLink,
} from "../_lib";
import { kvList, kvPush } from "../_persist";
import { logAudit } from "../_audit";
import { enqueueAttempt } from "../_webhook_queue";

const REFUNDS_KEY = "refunds.v1";
const REFUND_LIST_CAP = 500;

type ApiRefund = {
  id: string;
  link_id: string;
  amount: number;
  currency: string;
  reason: string;
  status: "succeeded";
  created: number;
};

export async function GET(req: NextRequest) {
  const gate = gateRequest(req);
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const linkId = url.searchParams.get("link_id");

  const items = await kvList<ApiRefund>(REFUNDS_KEY);
  const filtered = linkId ? items.filter((r) => r.link_id === linkId) : items;

  return attachRateHeaders(
    withCors(
      Response.json({
        object: "list",
        count: filtered.length,
        data: filtered.slice(0, 100),
      })
    ),
    gate.rateHeaders
  );
}

export async function POST(req: NextRequest) {
  const gate = gateRequest(req);
  if (!gate.ok) return gate.response;

  const raw = await req.text();
  const idem = checkIdempotency(req, raw);
  if (idem.hit) {
    return attachRateHeaders(
      withCors(
        new Response(idem.cachedBody, {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      ),
      gate.rateHeaders
    );
  }

  let body: { link_id?: string; amount?: number; reason?: string } | null = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    return withCors(badRequest("Invalid JSON body."));
  }
  if (!body?.link_id) {
    return attachRateHeaders(
      withCors(badRequest("link_id is required.")),
      gate.rateHeaders
    );
  }

  const link: ApiLink | undefined = store.links.get(body.link_id);
  if (!link) {
    return attachRateHeaders(
      withCors(badRequest(`No payment link found for id ${body.link_id}.`, 404)),
      gate.rateHeaders
    );
  }
  if (link.status !== "paid") {
    return attachRateHeaders(
      withCors(badRequest(`Cannot refund a link with status "${link.status}".`, 409)),
      gate.rateHeaders
    );
  }

  const prior = await kvList<ApiRefund>(REFUNDS_KEY);
  const refundedSoFar = prior
    .filter((r) => r.link_id === link.id)
    .reduce((acc, r) => acc + r.amount, 0);
  const remaining = link.amount - refundedSoFar;
  if (remaining <= 0) {
    return attachRateHeaders(
      withCors(badRequest("Link has already been fully refunded.", 409)),
      gate.rateHeaders
    );
  }

  const requested = body.amount && body.amount > 0 ? body.amount : remaining;
  if (requested > remaining + 1e-9) {
    return attachRateHeaders(
      withCors(
        badRequest(
          `Requested amount ${requested} exceeds remaining refundable ${remaining}.`,
          409
        )
      ),
      gate.rateHeaders
    );
  }

  const refund: ApiRefund = {
    id: genId("rfd"),
    link_id: link.id,
    amount: requested,
    currency: link.currency,
    reason: (body.reason || "requested_by_customer").slice(0, 120),
    status: "succeeded",
    created: Date.now(),
  };

  await kvPush(REFUNDS_KEY, refund, REFUND_LIST_CAP);

  void logAudit(req, "refund.issued", refund.id, {
    link_id: refund.link_id,
    amount: refund.amount,
    currency: refund.currency,
    reason: refund.reason,
  });

  // fire & forget webhooks
  void fanoutRefundWebhook(refund, getOrigin(req));

  const responseBody = JSON.stringify(refund);
  idem.cleanup?.();
  return attachRateHeaders(
    withCors(
      new Response(responseBody, {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    ),
    gate.rateHeaders
  );
}

async function fanoutRefundWebhook(refund: ApiRefund, origin: string) {
  const enabled = Array.from(store.webhooks.values()).filter(
    (w) => w.enabled && w.events.includes("payment.refunded")
  );
  if (enabled.length === 0) return;

  const payload = {
    id: genId("evt"),
    type: "payment.refunded",
    created: Math.floor(Date.now() / 1000),
    data: {
      refund_id: refund.id,
      link_id: refund.link_id,
      amount: refund.amount,
      currency: refund.currency,
      reason: refund.reason,
    },
  };
  const body = JSON.stringify(payload);
  const ts = Math.floor(Date.now() / 1000);

  await Promise.allSettled(
    enabled.map(async (w) => {
      const sig = signHmac(w.secret, `${ts}.${body}`);
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      let delivered = false;
      try {
        const r = await fetch(w.url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-aevion-signature": sig,
            "x-aevion-timestamp": String(ts),
            "x-aevion-event": "payment.refunded",
            "x-aevion-webhook": w.id,
            "user-agent": `AEVION-Payments/1.4 (+${origin})`,
          },
          body,
          signal: ctrl.signal,
        });
        delivered = r.status >= 200 && r.status < 300;
      } catch {
        delivered = false;
      } finally {
        clearTimeout(timer);
      }
      if (!delivered) {
        try {
          await enqueueAttempt({
            webhook_id: w.id,
            webhook_url: w.url,
            webhook_secret: w.secret,
            event: "payment.refunded",
            payload: body,
            immediate: false,
          });
        } catch {
          // queue write failed — give up silently
        }
      }
    })
  );
}

export function OPTIONS() {
  return withCors(new Response(null, { status: 204 }));
}
