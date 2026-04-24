// What each Trust Tier unlocks. Pure data — consumed by TierProgression UI.
// Changing a perk's `tier` changes UX expectations; changing its `category`
// is safe (purely for grouping/filtering).

import type { TrustTier } from "./trust";

export type PerkCategory = "banking" | "autopilot" | "security" | "ecosystem";

export type Perk = {
  id: string;
  tier: TrustTier;
  category: PerkCategory;
  label: string;
  hint: string;
  icon: string;
};

export const CATEGORY_COLOR: Record<PerkCategory, string> = {
  banking: "#0ea5e9",
  autopilot: "#059669",
  security: "#dc2626",
  ecosystem: "#7c3aed",
};

export const CATEGORY_LABEL: Record<PerkCategory, string> = {
  banking: "Banking",
  autopilot: "Autopilot",
  security: "Security",
  ecosystem: "Ecosystem",
};

export const PERKS: Perk[] = [
  // NEW tier — everyone gets these from day 1
  {
    id: "wallet",
    tier: "new",
    category: "banking",
    label: "AEC wallet",
    hint: "Provisioned on first visit, full send/receive",
    icon: "₿",
  },
  {
    id: "goals",
    tier: "new",
    category: "banking",
    label: "Goals + recurring + splits",
    hint: "Logical savings, scheduled transfers, group bills",
    icon: "★",
  },
  {
    id: "qsign-audit",
    tier: "new",
    category: "security",
    label: "QSign audit log",
    hint: "Every op HMAC-signed, re-verifiable any time",
    icon: "✎",
  },
  {
    id: "panic-manual",
    tier: "new",
    category: "security",
    label: "Panic Freeze (manual)",
    hint: "One-tap lock on outgoing, 5-min sober window",
    icon: "🔒",
  },
  {
    id: "constellation",
    tier: "new",
    category: "ecosystem",
    label: "Wealth Constellation",
    hint: "Live map of your money streams",
    icon: "✧",
  },

  // GROWING — Trust ≥ 20
  {
    id: "advance-300",
    tier: "growing",
    category: "banking",
    label: "Salary Advance up to 300 AEC",
    hint: "Auto-repay 50% from incoming royalties",
    icon: "⇅",
  },
  {
    id: "inflow-split",
    tier: "growing",
    category: "autopilot",
    label: "Autopilot Rule #2 · Inflow split",
    hint: "Auto-route 5–25% of each inflow to behind-schedule goals",
    icon: "⚡",
  },
  {
    id: "peer-standing",
    tier: "growing",
    category: "ecosystem",
    label: "Peer Standing widget",
    hint: "See where you rank across 4 dimensions vs median AEVION user",
    icon: "◉",
  },
  {
    id: "referrals",
    tier: "growing",
    category: "ecosystem",
    label: "Invite & Earn program",
    hint: "Tiered referral rewards; 5 AEC per active invitee",
    icon: "➤",
  },

  // TRUSTED — Trust ≥ 50
  {
    id: "advance-750",
    tier: "trusted",
    category: "banking",
    label: "Salary Advance up to 750 AEC",
    hint: "Higher credit line, 40% auto-repay (softer than Growing)",
    icon: "⇅",
  },
  {
    id: "anomaly-custom",
    tier: "trusted",
    category: "autopilot",
    label: "Autopilot Rule #3 · Anomaly watchdog (custom)",
    hint: "Tune burst count (2–10) and window (5–60 min)",
    icon: "🔒",
  },
  {
    id: "goal-share",
    tier: "trusted",
    category: "ecosystem",
    label: "Goal QR Share · holographic",
    hint: "Share contribution QR; live-animation anti-phishing",
    icon: "⇱",
  },
  {
    id: "planet-15x",
    tier: "trusted",
    category: "ecosystem",
    label: "Planet voting · 1.5× weight",
    hint: "Your votes on Planet artifacts count more",
    icon: "◈",
  },

  // ELITE — Trust ≥ 80
  {
    id: "advance-unlimited",
    tier: "elite",
    category: "banking",
    label: "Salary Advance up to balance",
    hint: "Credit line scales with your wallet; no hard cap",
    icon: "⇅",
  },
  {
    id: "autopilot-cap-200",
    tier: "elite",
    category: "autopilot",
    label: "Autopilot daily cap up to 200 AEC",
    hint: "Higher daily movement ceiling for automated allocations",
    icon: "⚡",
  },
  {
    id: "fast-unfreeze",
    tier: "elite",
    category: "security",
    label: "Priority unfreeze · 2-min sober window",
    hint: "Sober window shortened from 5 min to 2 min with biometric",
    icon: "🔓",
  },
  {
    id: "planet-2x",
    tier: "elite",
    category: "ecosystem",
    label: "Planet voting · 2× weight",
    hint: "Double voting power on Planet compliance decisions",
    icon: "◈",
  },
  {
    id: "circles-invite-only",
    tier: "elite",
    category: "ecosystem",
    label: "Invite-only Circles",
    hint: "Private group chats with elite-tier peers",
    icon: "◇",
  },
];

/** Tier order for rendering timelines left→right. */
export const TIER_ORDER: TrustTier[] = ["new", "growing", "trusted", "elite"];

/** Display gates — mirrored from trust.ts but re-exported here to keep
 *  TierProgression self-contained for rendering. */
export const TIER_GATE: Record<TrustTier, number> = {
  new: 0,
  growing: 20,
  trusted: 50,
  elite: 80,
};

export function perksByTier(tier: TrustTier): Perk[] {
  return PERKS.filter((p) => p.tier === tier);
}

export function tierIndex(tier: TrustTier): number {
  return TIER_ORDER.indexOf(tier);
}
