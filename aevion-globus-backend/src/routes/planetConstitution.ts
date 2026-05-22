/**
 * Planet — Constitution artifacts (stub).
 *
 * The main planetCompliance.ts pipeline expects submissions through
 * /submissions → versions → certificates flow. That's too heavy for the
 * constitution use case — a constitution snapshot is a self-contained
 * QSign-signed JSON, not a multi-stage submission.
 *
 * This stub gives the constitution module a public-artifact surface:
 *   POST /api/planet/constitution-artifacts  — publish a signed snapshot
 *   GET  /api/planet/constitution-artifacts  — list latest 50
 *   GET  /api/planet/constitution-artifacts/:id — fetch one
 *
 * Storage: in-process LRU (ring buffer of 200). For production this should
 * move to a `planet_constitution_artifacts` table. Marked as stub in the
 * response so consumers don't treat it as authoritative.
 */

import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { rateLimit } from "../lib/rateLimit";

type ArtifactPayload = {
  title?: string;
  regime?: { id?: string; name?: string; era?: string };
  sliders?: Record<string, number>;
  metrics?: Record<string, number>;
  issuedAt?: string;
};

type Artifact = {
  id: string;
  title: string;
  regimeId: string;
  regimeName: string;
  algo: string;
  signature: string;
  signedAt: string;
  publishedAt: string;
  payload: ArtifactPayload;
  stub: true;
};

const MAX_ARTIFACTS = 200;
const ring: Artifact[] = [];

function pushArtifact(a: Artifact): void {
  ring.unshift(a);
  if (ring.length > MAX_ARTIFACTS) ring.length = MAX_ARTIFACTS;
}

export const planetConstitutionRouter = Router();

const writeLimit = rateLimit({
  windowMs: 60_000,
  max: 30,
  keyPrefix: "planet-constitution-write",
});
const readLimit = rateLimit({
  windowMs: 60_000,
  max: 120,
  keyPrefix: "planet-constitution-read",
});

planetConstitutionRouter.post(
  "/",
  writeLimit as unknown as (req: Request, res: Response, next: () => void) => void,
  (req: Request, res: Response) => {
    try {
      const body = (req.body && typeof req.body === "object")
        ? (req.body as Record<string, unknown>)
        : {};
      const envelope = body.envelope ?? body;
      const e = envelope as Record<string, unknown>;
      const signature = typeof e.signature === "string" ? e.signature : null;
      const algo = typeof e.algo === "string" ? e.algo : "HMAC-SHA256";
      const signedAt = typeof e.signedAt === "string"
        ? e.signedAt
        : new Date().toISOString();
      const payload = (e.payload && typeof e.payload === "object")
        ? (e.payload as ArtifactPayload)
        : null;
      if (!signature) {
        return res.status(400).json({ error: "missing_signature" });
      }
      if (!payload) {
        return res.status(400).json({ error: "missing_payload" });
      }
      const title = typeof payload.title === "string" && payload.title
        ? payload.title.slice(0, 160)
        : "untitled-constitution";
      const regimeName = payload.regime?.name ?? "Unknown";
      const regimeId = payload.regime?.id ?? "unknown";
      const artifact: Artifact = {
        id: randomUUID(),
        title,
        regimeId,
        regimeName,
        algo,
        signature,
        signedAt,
        publishedAt: new Date().toISOString(),
        payload,
        stub: true,
      };
      pushArtifact(artifact);
      res.status(201).json({
        artifact,
        publicUrl: `/constitution?artifact=${artifact.id}`,
        note: "stub storage — in-memory ring buffer; not authoritative",
      });
    } catch (err) {
      res.status(500).json({
        error: "publish_failed",
        detail: err instanceof Error ? err.message : "unknown",
      });
    }
  },
);

planetConstitutionRouter.get(
  "/",
  readLimit as unknown as (req: Request, res: Response, next: () => void) => void,
  (req: Request, res: Response) => {
    const limit = Math.max(1, Math.min(100, Number(req.query.limit ?? 20)));
    const items = ring.slice(0, limit).map((a) => ({
      id: a.id,
      title: a.title,
      regimeId: a.regimeId,
      regimeName: a.regimeName,
      signedAt: a.signedAt,
      publishedAt: a.publishedAt,
    }));
    res.json({ items, total: ring.length, stub: true });
  },
);

planetConstitutionRouter.get(
  "/:id",
  readLimit as unknown as (req: Request, res: Response, next: () => void) => void,
  (req: Request, res: Response) => {
    const id = String(req.params.id);
    const a = ring.find((x) => x.id === id);
    if (!a) return res.status(404).json({ error: "not_found" });
    res.json(a);
  },
);
