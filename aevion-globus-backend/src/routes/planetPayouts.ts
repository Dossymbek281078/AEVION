import { Router, type Request } from "express";
import { randomUUID } from "node:crypto";
import { requireAuth } from "../lib/authJwt";
import {
  ensureEcosystemLoaded,
  planetCerts,
  scheduleEcosystemPersist,
  type PlanetCert,
} from "./ecosystem";

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

const WEBHOOK_SECRET = process.env.PLANET_WEBHOOK_SECRET || "dev-planet-webhook";

const seenWebhookIds = new Set<string>();

planetPayoutsRouter.post("/payouts/certify-webhook", async (req, res) => {
  const provided = req.headers["x-planet-secret"];
  const tokenStr = Array.isArray(provided) ? provided[0] : provided;
  if (!tokenStr || tokenStr !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: "invalid webhook secret" });
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
