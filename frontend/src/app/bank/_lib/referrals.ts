// Referral program — share-to-earn loop. Every wallet gets a short code
// derived from its accountId + a shareable URL. Accepted invite grants
// the inviter REFERRAL_BONUS_AEC and the invitee a boost on first top-up.
//
// TODO backend: POST /api/referrals/claim?code=X when a new wallet is
// provisioned — verifies the code, credits both parties, records the
// edge on the Trust Graph. Until then, invite counts + earnings are
// seeded deterministically from accountId so the demo reflects a
// plausible network already around the user.

import { seeded } from "./random";

export const REFERRAL_BONUS_AEC = 10;
export const INVITEE_BOOST_AEC = 5;

const TIER_THRESHOLDS = [1, 5, 15, 40] as const;
export type ReferralTier = "starter" | "advocate" | "ambassador" | "top-referrer";
const TIERS: ReferralTier[] = ["starter", "advocate", "ambassador", "top-referrer"];

export type ReferralStats = {
  code: string;
  shareUrl: string;
  invited: number;
  earnedAec: number;
  tier: ReferralTier;
  nextTierThreshold: number | null;
  nextTierLabel: ReferralTier | null;
  invitesToNextTier: number;
  recent: Array<{ nickname: string; joinedAt: string; bonus: number }>;
};

export const TIER_COLOR: Record<ReferralTier, string> = {
  starter: "#64748b",
  advocate: "#0d9488",
  ambassador: "#7c3aed",
  "top-referrer": "#d97706",
};

export const TIER_LABEL: Record<ReferralTier, string> = {
  starter: "Starter",
  advocate: "Advocate",
  ambassador: "Ambassador",
  "top-referrer": "Top referrer",
};

export const TIER_DESCRIPTION: Record<ReferralTier, string> = {
  starter: "Share your code to bring your first friend and enter the program.",
  advocate: "5+ invites — you help AEVION grow.",
  ambassador: "15+ invites — priority support and early features.",
  "top-referrer": "40+ invites — custom perks and featured on the network leaderboard.",
};

function codeFromAccount(accountId: string): string {
  const base = accountId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return base.slice(-6).padStart(6, "X");
}

function tierFor(invited: number): ReferralTier {
  if (invited >= TIER_THRESHOLDS[3]) return "top-referrer";
  if (invited >= TIER_THRESHOLDS[2]) return "ambassador";
  if (invited >= TIER_THRESHOLDS[1]) return "advocate";
  return "starter";
}

function nextTier(current: ReferralTier): ReferralTier | null {
  const idx = TIERS.indexOf(current);
  return idx >= 0 && idx < TIERS.length - 1 ? TIERS[idx + 1] : null;
}

const RECENT_NAMES = [
  "Daria K.",
  "Tomás R.",
  "Priya S.",
  "Marco B.",
  "Lena H.",
  "Yuki N.",
  "Sam W.",
  "Ava T.",
  "Noah Z.",
  "Ines M.",
];

function buildRecent(
  accountId: string,
  invited: number,
): Array<{ nickname: string; joinedAt: string; bonus: number }> {
  const rand = seeded(`${accountId}:referrals`);
  const now = Date.now();
  const out: Array<{ nickname: string; joinedAt: string; bonus: number }> = [];
  const shown = Math.min(invited, 4);
  for (let i = 0; i < shown; i++) {
    const daysAgo = i === 0 ? rand() * 3 : 3 + rand() * 28;
    out.push({
      nickname: RECENT_NAMES[Math.floor(rand() * RECENT_NAMES.length)],
      joinedAt: new Date(now - daysAgo * 86_400_000).toISOString(),
      bonus: REFERRAL_BONUS_AEC,
    });
  }
  return out;
}

export function computeReferralStats(accountId: string, origin: string): ReferralStats {
  const code = codeFromAccount(accountId);
  const rand = seeded(`${accountId}:referral-count`);
  // Seeded baseline: 0–12 invited, weighted toward low numbers so "Starter"
  // is the most common initial tier.
  const invited = Math.floor(Math.pow(rand(), 2.1) * 13);
  const earnedAec = invited * REFERRAL_BONUS_AEC;
  const tier = tierFor(invited);
  const next = nextTier(tier);
  const nextThreshold = next ? TIER_THRESHOLDS[TIERS.indexOf(next)] : null;
  const invitesToNextTier = nextThreshold ? Math.max(0, nextThreshold - invited) : 0;
  const shareUrl = `${origin.replace(/\/$/, "")}/auth?ref=${code}`;
  return {
    code,
    shareUrl,
    invited,
    earnedAec,
    tier,
    nextTierThreshold: nextThreshold,
    nextTierLabel: next,
    invitesToNextTier,
    recent: buildRecent(accountId, invited),
  };
}
