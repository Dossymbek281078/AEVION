"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataQualityRouter = void 0;
// AEVION Trust Score API — platform-wide data provenance.
//   GET  /api/data-quality               → every reporting module's DataQuality
//   GET  /api/data-quality/trust-score   → aggregate Trust Score, Ed25519-signed
//   GET  /api/data-quality/trust-score/verify → this server's signing public key
//   POST /api/data-quality/trust-score/verify → verify a signed Trust Score object
//   POST /api/data-quality/trust-score/anchor → Ed25519-sign + Bitcoin-anchor (OpenTimestamps)
//   POST /api/data-quality/trust-score/anchor/verify → verify Ed25519 + Bitcoin anchor
//   GET  /api/data-quality/:id           → one module's DataQuality (404 if none)
const express_1 = require("express");
const moduleDataQuality_1 = require("../lib/moduleDataQuality");
const trustSignature_1 = require("../lib/trustSignature");
const trustAnchor_1 = require("../lib/trustAnchor");
exports.dataQualityRouter = (0, express_1.Router)();
exports.dataQualityRouter.get("/", (_req, res) => {
    res.json({ modules: (0, moduleDataQuality_1.allModuleDataQuality)() });
});
// The signed aggregate. Backward-compatible: the TrustScore fields stay at the
// top level (existing badge reads .score / .modulesReporting), plus `attestation`.
// Must precede "/:id" so it is not swallowed as a module id.
exports.dataQualityRouter.get("/trust-score", (_req, res) => {
    res.json((0, trustSignature_1.signedTrustScore)(new Date().toISOString()));
});
// GET → the platform signing key (so a verifier can pin AEVION's Ed25519 key).
exports.dataQualityRouter.get("/trust-score/verify", (_req, res) => {
    res.json({
        ...(0, trustSignature_1.trustSigningKey)(),
        howTo: "POST a signed Trust Score object (as returned by GET /trust-score) to this URL to verify its Ed25519 attestation.",
    });
});
// POST → verify a signed Trust Score the caller supplies.
exports.dataQualityRouter.post("/trust-score/verify", (req, res) => {
    res.json((0, trustSignature_1.verifySignedTrustScore)(req.body));
});
// POST → sign the current Trust Score and submit its hash to OpenTimestamps
// (Bitcoin anchor). Network call (~1-5s); the response carries the .ots proof
// to keep. Must precede "/:id".
exports.dataQualityRouter.post("/trust-score/anchor", async (_req, res) => {
    try {
        res.json(await (0, trustAnchor_1.anchorTrustScore)(new Date().toISOString()));
    }
    catch (err) {
        res.status(502).json({ error: "anchor failed", detail: err instanceof Error ? err.message : String(err) });
    }
});
// POST → verify an anchored snapshot end to end (Ed25519 + Bitcoin timestamp).
// Body: { snapshot, otsProofB64 }.
exports.dataQualityRouter.post("/trust-score/anchor/verify", async (req, res) => {
    try {
        res.json(await (0, trustAnchor_1.verifyAnchoredTrustScore)(req.body));
    }
    catch (err) {
        res.status(502).json({ error: "anchor verify failed", detail: err instanceof Error ? err.message : String(err) });
    }
});
exports.dataQualityRouter.get("/:id", (req, res) => {
    const dq = (0, moduleDataQuality_1.moduleDataQuality)(req.params.id);
    if (!dq) {
        return res.status(404).json({ error: "module does not report data provenance", id: req.params.id });
    }
    res.json({ id: req.params.id, dataQuality: dq });
});
