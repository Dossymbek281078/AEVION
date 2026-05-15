import type { NextRequest } from "next/server";
import {
  attachRateHeaders,
  badRequest,
  checkIdempotency,
  gateRequest,
  genId,
  store,
  withCors,
  type ApiLink,
} from "../_lib";
import { kvList, kvSet } from "../_persist";
import { logAudit } from "../_audit";
import { enqueueAttempt } from "../_webhook_queue";

type DisputeStatus =
  | "warning_needs_response"
  | "under_review"
  | "won"
  | "lost"
  | "charge_refunded";

type DisputeReason =
  | "fraudulent"
  | "product_not_received"
  | "product_unacceptable"
  | "duplicate"
  | "credit_not_processed"
  | "customer_signature_missing"
  | "general";

export type ApiDispute = {
  id: string;
  link_id: string;
  amount: number;
  currency: string;
  reason: DisputeReason;
  status: DisputeStatus;
  evidence_url: string | null;
  evidence_text: string | null;
  due_by: number;
  created: number;
  updated: number;
};

const DISPUTES_KEY = "disputes.v1";
const ALLOWED_REASONS: DisputeReason[] = [
  "fraudulent",
  "product_not_received",
  "product_unacceptable",
  "duplicate",
  "credit_not_processed",
  "customer_signature_missing",
  "general",
];

async function loadAll(): Promise<ApiDispute[]> {
  return (await kvList<ApiDispute>(DISPUTES_KEY)) ?? [];
}

async function persistAll(items: ApiDispute[]): Promise<void> {
  await kvSet(DISPUTES_KEY, items.slice(0, 1000));
}

async function fanoutDisputeWebhook(event: string, dispute: ApiDispute): Promise<void> {
  const enabled = Array.from(store.webhooks.values()).filter(
    (w) => w.enabled && w.events.includes(event)
  );
  if (enabled.length === 0) return;
  const payload = JSON.stringify({
    id: genId("evt"),
    type: event,
    created: Math.floor(Date.now() / 1000),
    data: dispute,
  });
  for (const w of enabled) {
    try {
      await enqueueAttempt({
        webhook_id: w.id,
        webhook_url: w.url,
        webhook_secret: w.secret,
        event,
        payload,
        immediate: true,
      });
    } catch {
      // queue write failed — give up silently
    }
  }
}

export async function GET(req: NextRequest) {
  const gate = gateRequest(req);
  if (!gate.ok) return gate.response;
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const linkId = url.searchParams.get("link_id");
  let data = await loadAll();
  data.sort((a, b) => b.created - a.created);
  if (status) data = data.filter((d) => d.status === status);
  if (linkId) data = data.filter((d) => d.link_id === linkId);
  return attachRateHeaders(
    withCors(
      Response.json({
        object: "list",
        count: data.length,
        data: data.slice(0, 100),
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

  let body: {
    link_id?: string;
    reason?: DisputeReason;
    amount?: number;
    evidence_url?: string;
    evidence_text?: string;
    due_by?: number;
  } | null = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    return attachRateHeaders(
      withCors(badRequest("Invalid JSON body.")),
      gate.rateHeaders
    );
  }
  if (!body?.link_id) {
    return attachRateHeaders(
      withCors(badRequest("link_id is required.")),
      gate.rateHeaders
    );
  }
  if (!body.reason || !ALLOWED_REASONS.includes(body.reason)) {
    return attachRateHeaders(
      withCors(
        badRequest(`reason must be one of: ${ALLOWED_REASONS.join(", ")}.`)
      ),
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

  const requested = body.amount && body.amount > 0 ? body.amount : link.amount;
  if (requested > link.amount + 1e-9) {
    return attachRateHeaders(
      withCors(
        badRequest(
          `Disputed amount ${requested} exceeds link amount ${link.amount}.`,
          409
        )
      ),
      gate.rateHeaders
    );
  }

  const now = Date.now();
  const dispute: ApiDispute = {
    id: genId("dp"),
    link_id: link.id,
    amount: requested,
    currency: link.currency,
    reason: body.reason,
    status: "warning_needs_response",
    evidence_url: body.evidence_url ? String(body.evidence_url).slice(0, 500) : null,
    evidence_text: body.evidence_text ? String(body.evidence_text).slice(0, 2000) : null,
    due_by:
      typeof body.due_by === "number" && body.due_by > now
        ? body.due_by
        : now + 7 * 24 * 60 * 60 * 1000,
    created: now,
    updated: now,
  };

  const all = await loadAll();
  all.unshift(dispute);
  await persistAll(all);

  void logAudit(req, "dispute.created", dispute.id, {
    link_id: dispute.link_id,
    amount: dispute.amount,
    reason: dispute.reason,
  });
  void fanoutDisputeWebhook("dispute.created", dispute);

  const responseBody = JSON.stringify(dispute);
  idem.cleanup?.();
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
