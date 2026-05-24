/**
 * Constitution — Pro tier plan resolution.
 *
 * GET /api/constitution/me/plan
 *   Returns { plan: "free" | "pro", limits, hint }
 *
 * Plan resolution (in priority order):
 *   1. JWT payload.plan === "pro"  → pro
 *   2. JWT payload.email in CONSTITUTION_PRO_ALLOWLIST (comma-separated env) → pro
 *   3. Otherwise → free
 *
 * Limits per tier:
 *   free: max 5 saved scenarios in cloud, AI 10/day soft-limit, PDF must
 *         carry "unsigned draft" watermark unless QSign-signed.
 *   pro:  unlimited saves, AI without daily cap, clean PDF, "embed on
 *         your site" code snippets, custom color themes.
 *
 * Paddle wiring: this endpoint is the integration point. Once Paddle
 * verification clears (project_aevion_paddle), the webhook handler will
 * set payload.plan on JWT issuance — no code change needed here.
 */

import { Router, type Request, type Response } from "express";
import { rateLimit } from "../lib/rateLimit";
import { verifyBearerOptional } from "../lib/authJwt";

const PRO_ALLOWLIST = (process.env.CONSTITUTION_PRO_ALLOWLIST || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const FREE_LIMITS = {
  savedScenarios: 5,
  aiSuggestPerDay: 10,
  pdfRequiresSign: true,
  customThemes: false,
  embedSnippet: false,
} as const;

const PRO_LIMITS = {
  savedScenarios: 0, // 0 = unlimited
  aiSuggestPerDay: 0,
  pdfRequiresSign: false,
  customThemes: true,
  embedSnippet: true,
} as const;

// LemonSqueezy replaces Paddle (Paddle verification blocked).
// Variant IDs configured in Railway env:
//   LEMON_SQUEEZY_CONSTITUTION_PRO_VARIANT_ID
//   LEMON_SQUEEZY_CONSTITUTION_TEAM_VARIANT_ID

function resolvePlan(req: Request): {
  plan: "free" | "pro";
  reason: string;
  email: string | null;
} {
  const payload = verifyBearerOptional(req);
  if (!payload) return { plan: "free", reason: "no-token", email: null };
  const p = payload as Record<string, unknown>;
  const email = typeof p.email === "string" ? p.email.toLowerCase() : null;
  if (p.plan === "pro") return { plan: "pro", reason: "jwt-plan", email };
  if (email && PRO_ALLOWLIST.includes(email)) {
    return { plan: "pro", reason: "allowlist", email };
  }
  return { plan: "free", reason: "default", email };
}

export const constitutionProRouter = Router();

const readLimit = rateLimit({
  windowMs: 60_000,
  max: 120,
  keyPrefix: "constitution-pro-read",
});

constitutionProRouter.get(
  "/me/plan",
  readLimit as unknown as (req: Request, res: Response, next: () => void) => void,
  (req: Request, res: Response) => {
    const { plan, reason, email } = resolvePlan(req);
    const limits = plan === "pro" ? PRO_LIMITS : FREE_LIMITS;
    res.json({
      plan,
      reason,
      email,
      limits,
      upgrade: plan === "free"
        ? {
            price: "$9 / month",
            checkout: {
              provider: "lemonsqueezy",
              endpoint: "/api/constitution/checkout/session",
              hint: "POST { tier: 'pro' | 'team' } → { checkoutUrl }",
              directLink: "/api/constitution/checkout/go/pro",
            },
            features: [
              "Unlimited saved scenarios",
              "AI suggestions without daily cap",
              "Clean PDF export (no watermark)",
              "Custom color themes",
              "Embed widget on your site",
            ],
          }
        : null,
    });
  },
);
