import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { requireAuth } from "../lib/authJwt";
import { csvFromRows } from "../lib/csv";
import { verifyWebhookSig } from "../lib/webhookSig";
import {
  ensureEcosystemLoaded,
  planetCerts,
  scheduleEcosystemPersist,
  type PlanetCert,
} from "./ecosystem";

function sendCsv(res: Response, baseName: string, rows: (string | number | null | undefined)[][]): void {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${baseName}-${new Date().toISOString().slice(0, 10)}.csv"`,
  );
  res.status(200).send(csvFromRows(rows));
}

// Mounted at /api/planet alongside the existing /api/planet/{stats,artifacts}.
//   GET  /payouts                      — caller's planet certification rewards
//   POST /payouts/certify-webhook      — quorum-passed certification trigger
//
// This is the third and final ecosystem stream — closes the last "mock"
// surface in the bank UI. Webhook is intended to be called by the Planet
// quorum service when an artifact version reaches the certification threshold.
export const planetPayoutsRouter = Router();

function ownerEmail(req: Request): string {
  return req.auth?.email ?? "";
}

planetPayoutsRouter.get("/payouts", requireAuth, async (req, res) => {
  await ensureEcosystemLoaded();
  const email = ownerEmail(req);
  const items = planetCerts
    .filter((x) => x.email === email)
    .sort((a, b) => (a.certifiedAt < b.certifiedAt ? 1 : -1));
  res.json({ items });
});

planetPayoutsRouter.get("/payouts.csv", requireAuth, async (req, res) => {
  await ensureEcosystemLoaded();
  const email = ownerEmail(req);
  const items = planetCerts
    .filter((x) => x.email === email)
    .sort((a, b) => (a.certifiedAt < b.certifiedAt ? 1 : -1));
  const rows: (string | number | null | undefined)[][] = [
    ["id", "artifact_version_id", "amount_aec", "certified_at"],
    ...items.map((x) => [x.id, x.artifactVersionId, x.amount, x.certifiedAt]),
  ];
  sendCsv(res, "planet-payouts", rows);
});

const WEBHOOK_SECRET = process.env.PLANET_WEBHOOK_SECRET || "dev-planet-webhook";

const seenWebhookIds = new Set<string>();

planetPayoutsRouter.post("/payouts/certify-webhook", async (req, res) => {
  const verdict = verifyWebhookSig({
    signature: req.headers["x-aevion-signature"],
    timestamp: req.headers["x-aevion-timestamp"],
    legacySecret: req.headers["x-planet-secret"],
    body: req.body,
    secret: WEBHOOK_SECRET,
  });
  if (!verdict.ok) {
    return res.status(401).json({ error: "invalid webhook signature", reason: verdict.reason });
  }
  await ensureEcosystemLoaded();

  const { eventId, email, artifactVersionId, amount } = req.body || {};
  if (
    typeof eventId !== "string" ||
    typeof email !== "string" ||
    typeof artifactVersionId !== "string"
  ) {
    return res.status(400).json({
      error: "eventId, email, artifactVersionId required as strings",
    });
  }
  const a = Number(amount);
  if (!Number.isFinite(a) || a <= 0) {
    return res.status(400).json({ error: "amount must be positive number" });
  }

  if (seenWebhookIds.has(eventId)) {
    const existing = planetCerts.find(
      (x) =>
        x.email === email.toLowerCase() &&
        x.artifactVersionId === artifactVersionId,
    );
    return res.status(200).json({
      replayed: true,
      id: existing?.id ?? null,
      eventId,
    });
  }

  const cert: PlanetCert = {
    id: `pcert_${randomUUID()}`,
    email: email.toLowerCase(),
    artifactVersionId,
    amount: a,
    certifiedAt: new Date().toISOString(),
    source: "planet",
  };
  planetCerts.push(cert);
  seenWebhookIds.add(eventId);
  scheduleEcosystemPersist();

  res.status(201).json({
    replayed: false,
    id: cert.id,
    eventId,
    certifiedAt: cert.certifiedAt,
  });
});
