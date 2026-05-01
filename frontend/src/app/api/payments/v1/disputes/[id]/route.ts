import type { NextRequest } from "next/server";
import {
  attachRateHeaders,
  badRequest,
  gateRequest,
  store,
  withCors,
} from "../../_lib";
import { kvList, kvSet } from "../../_persist";
import { logAudit } from "../../_audit";
import { enqueueAttempt } from "../../_webhook_queue";

const DISPUTES_KEY = "disputes.v1";
const ALLOWED_TRANSITIONS = {
  warning_needs_response: ["under_review", "won", "lost"],
  under_review: ["won", "lost"],
  won: [],
  lost: [],
  charge_refunded: [],
} as const;

type DisputeStatus = keyof typeof ALLOWED_TRANSITIONS;

type ApiDispute = {
  id: string;
  link_id: string;
  amount: number;
  currency: string;
  reason: string;
  status: DisputeStatus;
  evidence_url: string | null;
  evidence_text: string | null;
  due_by: number;
  created: number;
  updated: number;
};

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
    id: `evt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
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

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const gate = gateRequest(req);
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const all = await loadAll();
  const dispute = all.find((d) => d.id === id);
  if (!dispute) {
    return attachRateHeaders(
      withCors(
        Response.json(
          { error: { type: "not_found", message: `No dispute with id ${id}.` } },
          { status: 404 }
        )
      ),
      gate.rateHeaders
    );
  }
  return attachRateHeaders(withCors(Response.json(dispute)), gate.rateHeaders);
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const gate = gateRequest(req);
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  let body: {
    action?: "respond" | "resolve_won" | "resolve_lost";
    evidence_url?: string;
    evidence_text?: string;
  } | null = null;
  try {
    const raw = await req.text();
    body = raw ? JSON.parse(raw) : null;
  } catch {
    return attachRateHeaders(
      withCors(badRequest("Invalid JSON body.")),
      gate.rateHeaders
    );
  }
  if (!body?.action) {
    return attachRateHeaders(
      withCors(
        badRequest(
          "action is required: 'respond', 'resolve_won', or 'resolve_lost'."
        )
      ),
      gate.rateHeaders
    );
  }

  const all = await loadAll();
  const idx = all.findIndex((d) => d.id === id);
  if (idx === -1) {
    return attachRateHeaders(
      withCors(
        Response.json(
          { error: { type: "not_found", message: `No dispute with id ${id}.` } },
          { status: 404 }
        )
      ),
      gate.rateHeaders
    );
  }
  const cur = all[idx];

  const target: DisputeStatus =
    body.action === "respond"
      ? "under_review"
      : body.action === "resolve_won"
        ? "won"
        : "lost";

  const allowed = ALLOWED_TRANSITIONS[cur.status] as readonly DisputeStatus[];
  if (!allowed.includes(target)) {
    return attachRateHeaders(
      withCors(
        badRequest(
          `Cannot transition from "${cur.status}" via "${body.action}".`,
          409
        )
      ),
      gate.rateHeaders
    );
  }

  const updated: ApiDispute = {
    ...cur,
    status: target,
    evidence_url: body.evidence_url
      ? String(body.evidence_url).slice(0, 500)
      : cur.evidence_url,
    evidence_text: body.evidence_text
      ? String(body.evidence_text).slice(0, 2000)
      : cur.evidence_text,
    updated: Date.now(),
  };
  all[idx] = updated;
  await persistAll(all);

  void logAudit(req, `dispute.${target}`, updated.id, {
    link_id: updated.link_id,
    amount: updated.amount,
    reason: updated.reason,
  });
  void fanoutDisputeWebhook(`dispute.${target}`, updated);

  return attachRateHeaders(
    withCors(Response.json(updated)),
    gate.rateHeaders
  );
}

export function OPTIONS() {
  return withCors(new Response(null, { status: 204 }));
}
