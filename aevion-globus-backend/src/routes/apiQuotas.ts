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

const QUOTAS_VERSION = "1.1.0";
const PUBLISHED_AT = "2026-05-08";

// Tiers MUST stay in sync with frontend/src/app/pricing/api-pricing/page.tsx
// (VOLUME_TIERS const). Names and prices align with the public pricing page;
// rate limits + SLA + key issuance limits are added here as the backend
// contract.
const TIERS = [
  {
    id: "developer",
    name: "Developer",
    priceUsdMonthly: 0,
    monthlyCalls: 10_000,
    rateLimit: { perMinute: 100 },
    sla: { uptime: null, supportResponseHours: null, channel: "community" },
    commercialUse: false,
    perCallDiscount: null,
    keyLimit: 1,
    bestFor: "Прототипы, SDK-тесты, hobby projects",
  },
  {
    id: "build",
    name: "Build",
    priceUsdMonthly: 49,
    monthlyCalls: 100_000,
    rateLimit: { perMinute: 500 },
    sla: { uptime: 99.0, supportResponseHours: 48, channel: "email" },
    commercialUse: true,
    perCallDiscount: 0.15,
    keyLimit: 5,
    bestFor: "Запуск, MVP, single-product B2B",
  },
  {
    id: "scale",
    name: "Scale",
    priceUsdMonthly: 249,
    monthlyCalls: 1_000_000,
    rateLimit: { perMinute: 2000 },
    sla: { uptime: 99.5, supportResponseHours: 24, channel: "email+slack" },
    commercialUse: true,
    perCallDiscount: 0.30,
    keyLimit: 10,
    bestFor: "Production SaaS, content platforms, marketplace",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceUsdMonthly: null,
    monthlyCalls: null,
    rateLimit: { perMinute: null },
    sla: { uptime: 99.9, supportResponseHours: 4, channel: "dedicated-rep" },
    commercialUse: true,
    perCallDiscount: 0.50,
    keyLimit: null,
    bestFor: "TikTok/Spotify/YouTube-class, governments, on-prem, BYO-key",
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
      "Developer tier requests above 100/min return HTTP 429 with Retry-After.",
      "Paid tier monthly call quota — overage at per-endpoint rate-card with tier discount applied.",
      "Per-endpoint pricing & detailed quotas: https://aevion.app/pricing/api-pricing",
      "Enterprise quotas negotiated per-contract; contact api@aevion.app.",
      "Per-request cost units are weighted: heavy endpoints (verify, snapshot) count 2; default 1.",
      "QPayNet merchant keys (qpn_live_*) are a separate per-merchant system, not part of this tier matrix.",
    ],
  });
});
