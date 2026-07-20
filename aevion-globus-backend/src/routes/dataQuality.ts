// AEVION Trust Score API — platform-wide data provenance.
//   GET  /api/data-quality               → every reporting module's DataQuality
//   GET  /api/data-quality/trust-score   → aggregate Trust Score, Ed25519-signed
//   GET  /api/data-quality/trust-score/verify → this server's signing public key
//   POST /api/data-quality/trust-score/verify → verify a signed Trust Score object
//   POST /api/data-quality/trust-score/anchor → Ed25519-sign + Bitcoin-anchor (OpenTimestamps)
//   POST /api/data-quality/trust-score/anchor/verify → verify Ed25519 + Bitcoin anchor
//   GET  /api/data-quality/:id           → one module's DataQuality (404 if none)
import { Router } from "express";
import {
  allModuleDataQuality,
  moduleDataQuality,
} from "../lib/moduleDataQuality";
import {
  signedTrustScore,
  verifySignedTrustScore,
  trustSigningKey,
} from "../lib/trustSignature";
import {
  anchorTrustScore,
  verifyAnchoredTrustScore,
} from "../lib/trustAnchor";

export const dataQualityRouter = Router();

dataQualityRouter.get("/", (_req, res) => {
  res.json({ modules: allModuleDataQuality() });
});

// The signed aggregate. Backward-compatible: the TrustScore fields stay at the
// top level (existing badge reads .score / .modulesReporting), plus `attestation`.
// Must precede "/:id" so it is not swallowed as a module id.
dataQualityRouter.get("/trust-score", (_req, res) => {
  res.json(signedTrustScore(new Date().toISOString()));
});

// GET → the platform signing key (so a verifier can pin AEVION's Ed25519 key).
dataQualityRouter.get("/trust-score/verify", (_req, res) => {
  res.json({
    ...trustSigningKey(),
    howTo: "POST a signed Trust Score object (as returned by GET /trust-score) to this URL to verify its Ed25519 attestation.",
  });
});

// POST → verify a signed Trust Score the caller supplies.
dataQualityRouter.post("/trust-score/verify", (req, res) => {
  res.json(verifySignedTrustScore(req.body));
});

// POST → sign the current Trust Score and submit its hash to OpenTimestamps
// (Bitcoin anchor). Network call (~1-5s); the response carries the .ots proof
// to keep. Must precede "/:id".
dataQualityRouter.post("/trust-score/anchor", async (_req, res) => {
  try {
    res.json(await anchorTrustScore(new Date().toISOString()));
  } catch (err) {
    res.status(502).json({ error: "anchor failed", detail: err instanceof Error ? err.message : String(err) });
  }
});

// POST → verify an anchored snapshot end to end (Ed25519 + Bitcoin timestamp).
// Body: { snapshot, otsProofB64 }.
dataQualityRouter.post("/trust-score/anchor/verify", async (req, res) => {
  try {
    res.json(await verifyAnchoredTrustScore(req.body));
  } catch (err) {
    res.status(502).json({ error: "anchor verify failed", detail: err instanceof Error ? err.message : String(err) });
  }
});

dataQualityRouter.get("/:id", (req, res) => {
  const dq = moduleDataQuality(req.params.id);
  if (!dq) {
    return res.status(404).json({ error: "module does not report data provenance", id: req.params.id });
  }
  res.json({ id: req.params.id, dataQuality: dq });
});
