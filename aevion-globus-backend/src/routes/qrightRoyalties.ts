import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { requireAuth } from "../lib/authJwt";
import { csvFromRows } from "../lib/csv";
import { paginate, parsePageOpts } from "../lib/pagination";
import { verifyWebhookSig } from "../lib/webhookSig";
import { requireProdSecret } from "../lib/qsignSecret";
import { getPool } from "../lib/dbPool";
import {
  ensureEcosystemLoaded,
  royaltyEvents,
  scheduleEcosystemPersist,
  type RoyaltyEvent,
} from "./ecosystem";
import { internalCreditAccount } from "./qtrade";

// QRightObject.kind ("code" | "text" | "image" | "music" | "movie" | "design"
// | "other", see QRIGHT_KINDS in qright.ts) -> the frontend bank dashboard's
// IPKind ("music" | "photo" | "code" | "design" | "writing" | "video"). The
// two vocabularies grew independently; this is the one place that bridges
// them for the /royalties/summary aggregate below.
const KIND_TO_IP_KIND: Record<string, string> = {
  code: "code",
  text: "writing",
  image: "photo",
  music: "music",
  movie: "video",
  design: "design",
  other: "design",
};

function sendCsv(res: Response, baseName: string, rows: (string | number | null | undefined)[][]): void {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${baseName}-${new Date().toISOString().slice(0, 10)}.csv"`,
  );
  res.status(200).send(csvFromRows(rows));
}

// Sub-router intended to be mounted at /api/qright (so it lives under the
// existing namespace alongside the legacy QRight authorship endpoints).
//
//   GET  /royalties                    — list paid royalties for caller
//   POST /royalties/verify-webhook     — idempotent verifier intended to be
//                                        called by external rights bodies;
//                                        appends a new RoyaltyEvent and
//                                        returns the recorded id.
export const qrightRoyaltiesRouter = Router();

function ownerEmail(req: Request): string {
  return req.auth?.email ?? "";
}

qrightRoyaltiesRouter.get("/royalties", requireAuth, async (req, res) => {
  await ensureEcosystemLoaded();
  const email = ownerEmail(req);
  const items = royaltyEvents
    .filter((x) => x.email === email)
    .sort((a, b) => (a.paidAt < b.paidAt ? 1 : -1));
  const { page, nextCursor } = paginate(items, parsePageOpts(req));
  res.json({ items: page, total: items.length, nextCursor });
});

qrightRoyaltiesRouter.get("/royalties.csv", requireAuth, async (req, res) => {
  await ensureEcosystemLoaded();
  const email = ownerEmail(req);
  const items = royaltyEvents
    .filter((x) => x.email === email)
    .sort((a, b) => (a.paidAt < b.paidAt ? 1 : -1));
  const rows: (string | number | null | undefined)[][] = [
    ["id", "product_key", "period", "amount_aec", "paid_at", "transfer_id"],
    ...items.map((x) => [x.id, x.productKey, x.period, x.amount, x.paidAt, x.transferId]),
  ];
  sendCsv(res, "qright-royalties", rows);
});

// Aggregate view for the bank dashboard's Royalty Stream widget (see
// frontend/src/app/bank/_lib/royalties.ts — item 2 of its TODO). Shapes the
// flat royalty ledger into { works, recentEvents, avgPerDay7d/30d,
// estimated30d } so the widget can render real payouts once they exist,
// falling back to its own client-side demo generator when a caller has
// none yet (hasRealData: false).
qrightRoyaltiesRouter.get("/royalties/summary", requireAuth, async (req, res) => {
  await ensureEcosystemLoaded();
  const email = ownerEmail(req);
  const events = royaltyEvents.filter((x) => x.email === email);

  const productKeys = [...new Set(events.map((e) => e.productKey))];
  const objects = new Map<string, { title: string; kind: string; country: string | null; createdAt: string }>();
  if (productKeys.length) {
    try {
      const pool = getPool();
      const r = await pool.query(
        `SELECT id, title, kind, country, "createdAt" FROM "QRightObject" WHERE id = ANY($1::text[])`,
        [productKeys],
      );
      for (const row of r.rows as { id: string; title: string; kind: string; country: string | null; createdAt: string }[]) {
        objects.set(row.id, row);
      }
    } catch {
      // productKey values that aren't real QRightObject ids (or a fresh DB
      // without the table) just render with the raw key as the title below.
    }
  }

  const works = new Map<
    string,
    { id: string; title: string; kind: string; registeredAt: string; totalRoyalties: number; verifications: number }
  >();
  for (const e of events) {
    const obj = objects.get(e.productKey);
    const existing = works.get(e.productKey);
    if (existing) {
      existing.totalRoyalties += e.amount;
      existing.verifications += 1;
    } else {
      works.set(e.productKey, {
        id: e.productKey,
        title: obj?.title ?? e.productKey,
        kind: KIND_TO_IP_KIND[obj?.kind ?? ""] ?? "code",
        registeredAt: obj?.createdAt ?? e.paidAt,
        totalRoyalties: e.amount,
        verifications: 1,
      });
    }
  }

  const recentEvents = [...events]
    .sort((a, b) => (a.paidAt < b.paidAt ? 1 : -1))
    .slice(0, 50)
    .map((e) => {
      const obj = objects.get(e.productKey);
      return {
        id: e.id,
        workId: e.productKey,
        workTitle: obj?.title ?? e.productKey,
        workKind: KIND_TO_IP_KIND[obj?.kind ?? ""] ?? "code",
        amount: e.amount,
        verifier: obj?.country ?? "—",
        timestamp: e.paidAt,
      };
    });

  const now = Date.now();
  let sum7 = 0;
  let sum30 = 0;
  for (const e of events) {
    const diff = now - new Date(e.paidAt).getTime();
    if (diff < 7 * 86_400_000) sum7 += e.amount;
    if (diff < 30 * 86_400_000) sum30 += e.amount;
  }
  const avgPerDay7d = sum7 / 7;
  const avgPerDay30d = sum30 / 30;
  const growth = avgPerDay30d > 0 ? Math.max(-0.3, Math.min(0.5, (avgPerDay7d - avgPerDay30d) / avgPerDay30d)) : 0;

  res.json({
    hasRealData: events.length > 0,
    works: [...works.values()].map((w) => ({ ...w, totalRoyalties: +w.totalRoyalties.toFixed(2) })),
    recentEvents,
    avgPerDay7d,
    avgPerDay30d,
    estimated30d: Math.max(0, avgPerDay7d * 30 * (1 + growth)),
  });
});

// Webhook is *not* requireAuth-gated: called by trusted external rights
// services using the shared webhook secret. Resolved lazily through
// requireProdSecret() so prod-misconfig fails per-request, not at boot.
const getWebhookSecret = () => requireProdSecret("QRIGHT_WEBHOOK_SECRET", "dev-qright-webhook");

const seenWebhookIds = new Set<string>();

qrightRoyaltiesRouter.post("/royalties/verify-webhook", async (req, res) => {
  const verdict = verifyWebhookSig({
    signature: req.headers["x-aevion-signature"],
    timestamp: req.headers["x-aevion-timestamp"],
    legacySecret: req.headers["x-qright-secret"],
    body: req.body,
    secret: getWebhookSecret(),
  });
  if (!verdict.ok) {
    return res.status(401).json({ error: "invalid webhook signature", reason: verdict.reason });
  }
  await ensureEcosystemLoaded();

  const { eventId, email, productKey, period, amount } = req.body || {};
  if (
    typeof eventId !== "string" ||
    typeof email !== "string" ||
    typeof productKey !== "string" ||
    typeof period !== "string"
  ) {
    return res.status(400).json({ error: "eventId, email, productKey, period required as strings" });
  }
  const a = Number(amount);
  if (!Number.isFinite(a) || a <= 0) {
    return res.status(400).json({ error: "amount must be positive number" });
  }

  // Idempotency: if we've seen this eventId already, return the previously
  // recorded entry so the partner can safely retry.
  if (seenWebhookIds.has(eventId)) {
    const existing = royaltyEvents.find(
      (x) => x.email === email.toLowerCase() && x.productKey === productKey && x.period === period,
    );
    return res.status(200).json({
      replayed: true,
      id: existing?.id ?? null,
      eventId,
    });
  }

  // Credit the recipient's QTrade account so the royalty actually lands as
  // spendable balance, not just a ledger line. Auto-provisions an account if
  // the recipient doesn't have one yet — a rights body can pay out before
  // the creator has ever opened /qtrade. Failure here is effectively
  // unreachable (amount/email are already validated above) but is treated
  // as non-fatal: the RoyaltyEvent is still recorded with transferId null so
  // /earnings reflects the payout, and it can be reconciled manually.
  const credit = await internalCreditAccount({
    owner: email,
    amount: a,
    memo: `Royalty · ${productKey} · ${period}`,
  });

  const ev: RoyaltyEvent = {
    id: `roy_${randomUUID()}`,
    email: email.toLowerCase(),
    productKey,
    period,
    amount: a,
    paidAt: new Date().toISOString(),
    transferId: credit.ok ? credit.operationId : null,
    source: "qright",
  };
  royaltyEvents.push(ev);
  seenWebhookIds.add(eventId);
  scheduleEcosystemPersist();

  res.status(201).json({
    replayed: false,
    id: ev.id,
    eventId,
    paidAt: ev.paidAt,
    transferId: ev.transferId,
    accountId: credit.ok ? credit.accountId : null,
    creditError: credit.ok ? undefined : credit.error,
  });
});
