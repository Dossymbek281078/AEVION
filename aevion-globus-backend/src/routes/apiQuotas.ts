/**
 * Public API quotas — machine-readable tier matrix.
 *
 * GET /api/quotas — returns the canonical pricing/quota table for AEVION's
 * public API surface. Source of truth for sales conversations, partner
 * integrations, and public docs. Hardcoded here intentionally: changes
 * require a code review + deploy, not a live config knob.
 *
 * Spec: docs/api/PUBLIC_API_QUOTAS.md
 */

import { Router } from "express";

export const apiQuotasRouter = Router();

const QUOTAS_VERSION = "1.0.0";
const PUBLISHED_AT = "2026-05-08";

const TIERS = [
  {
    id: "free",
    name: "Free",
    priceUsdMonthly: 0,
    rateLimit: { perMinute: 100, perDay: 10_000 },
    sla: { uptime: null, supportResponseHours: null, channel: "community" },
    commercialUse: false,
    overageUsd: null,
    bestFor: "Discovery, prototyping, hobby projects",
  },
  {
    id: "starter",
    name: "Starter",
    priceUsdMonthly: 29,
    rateLimit: { perMinute: 500, perDay: 100_000 },
    sla: { uptime: 99.0, supportResponseHours: 48, channel: "email" },
    commercialUse: true,
    overageUsd: 0.001,
    bestFor: "Indie SaaS, single-product B2B integrations",
  },
  {
    id: "pro",
    name: "Pro",
    priceUsdMonthly: 199,
    rateLimit: { perMinute: 2000, perDay: 1_000_000 },
    sla: { uptime: 99.5, supportResponseHours: 24, channel: "email+slack" },
    commercialUse: true,
    overageUsd: 0.0005,
    bestFor: "Production SaaS, content platforms, marketplace listings",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceUsdMonthly: null,
    rateLimit: { perMinute: null, perDay: null },
    sla: { uptime: 99.9, supportResponseHours: 4, channel: "dedicated-rep" },
    commercialUse: true,
    overageUsd: null,
    bestFor: "TikTok / Spotify / YouTube-class deployments, governments",
  },
] as const;

const ENDPOINTS = [
  {
    path: "/api/qright/objects",
    method: "GET",
    publicAccess: true,
    perRequestCostUnits: 1,
    description: "List public IP registry entries",
  },
  {
    path: "/api/bureau/cert/:id/embed",
    method: "GET",
    publicAccess: true,
    perRequestCostUnits: 1,
    description: "Embed-ready certificate viewer (HTML+JSON)",
  },
  {
    path: "/api/bureau/notaries",
    method: "GET",
    publicAccess: true,
    perRequestCostUnits: 1,
    description: "Public catalog of notary partners",
  },
  {
    path: "/api/bureau/trust-edges/cert/:id",
    method: "GET",
    publicAccess: true,
    perRequestCostUnits: 1,
    description: "Trust Graph edges for a cert",
  },
  {
    path: "/api/qsign/verify",
    method: "POST",
    publicAccess: true,
    perRequestCostUnits: 2,
    description: "Verify ML-DSA-65 signature (CPU-heavy)",
  },
  {
    path: "/api/awards/seasons/:id/results",
    method: "GET",
    publicAccess: true,
    perRequestCostUnits: 1,
    description: "Awards season results + Merkle proofs",
  },
  {
    path: "/api/planet/snapshots/:id",
    method: "GET",
    publicAccess: true,
    perRequestCostUnits: 2,
    description: "Compliance snapshot with evidenceRoot",
  },
  {
    path: "/api/qpaynet/merchant/charge",
    method: "POST",
    publicAccess: false,
    perRequestCostUnits: 1,
    description: "Merchant charge (existing per-merchant rate limits apply, not tier)",
  },
] as const;

apiQuotasRouter.get("/", (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=300");
  res.json({
    version: QUOTAS_VERSION,
    publishedAt: PUBLISHED_AT,
    docsUrl: "https://github.com/Dossymbek281078/AEVION/blob/main/docs/api/PUBLIC_API_QUOTAS.md",
    contact: "api@aevion.app",
    keyFormat: {
      pattern: "aev_(test|live)_<24bytes_base64url>",
      headerName: "X-Aevion-Api-Key",
      issuance: "Self-serve via /api/keys (POST) once authenticated. Free tier: 1 key. Paid: up to 10 keys per account.",
    },
    tiers: TIERS,
    endpoints: ENDPOINTS,
    notes: [
      "Free tier requests above 100/min return HTTP 429 with Retry-After.",
      "Paid tier overage billed monthly via Stripe; first $5 absorbed.",
      "Enterprise quotas negotiated per-contract; contact api@aevion.app.",
      "Per-request cost units are weighted: heavy endpoints (verify, snapshot) count 2; default 1.",
      "QPayNet merchant keys (qpn_live_*) are a separate per-merchant system, not part of this tier matrix.",
    ],
  });
});
