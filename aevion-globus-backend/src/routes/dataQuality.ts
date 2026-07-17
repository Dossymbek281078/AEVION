// AEVION Trust Score API — platform-wide data provenance.
//   GET  /api/data-quality               → every reporting module's DataQuality
//   GET  /api/data-quality/trust-score   → aggregate Trust Score, Ed25519-signed
//   GET  /api/data-quality/trust-score/verify → this server's signing public key
//   POST /api/data-quality/trust-score/verify → verify a signed Trust Score object
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

dataQualityRouter.get("/:id", (req, res) => {
  const dq = moduleDataQuality(req.params.id);
  if (!dq) {
    return res.status(404).json({ error: "module does not report data provenance", id: req.params.id });
  }
  res.json({ id: req.params.id, dataQuality: dq });
});
