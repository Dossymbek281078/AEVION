// AEVION Trust Score API — platform-wide data provenance.
//   GET /api/data-quality              → every reporting module's DataQuality
//   GET /api/data-quality/trust-score  → aggregate AEVION Trust Score
//   GET /api/data-quality/:id          → one module's DataQuality (404 if none)
import { Router } from "express";
import {
  allModuleDataQuality,
  moduleDataQuality,
  trustScore,
} from "../lib/moduleDataQuality";

export const dataQualityRouter = Router();

dataQualityRouter.get("/", (_req, res) => {
  res.json({ modules: allModuleDataQuality() });
});

// Must precede "/:id" so it is not swallowed as a module id.
dataQualityRouter.get("/trust-score", (_req, res) => {
  res.json(trustScore());
});

dataQualityRouter.get("/:id", (req, res) => {
  const dq = moduleDataQuality(req.params.id);
  if (!dq) {
    return res.status(404).json({ error: "module does not report data provenance", id: req.params.id });
  }
  res.json({ id: req.params.id, dataQuality: dq });
});
