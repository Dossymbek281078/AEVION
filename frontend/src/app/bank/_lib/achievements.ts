// Achievement catalogue — unlockable badges across Banking, Ecosystem,
// Security and Creator axes. Everything is derived from existing state
// (no new persistence) so running unlock state is cheap.

import type { Advance } from "./advance";
import type { ChessSummary } from "./chess";
import type { Circle } from "./circles";
import type { EcosystemEarningsSummary } from "./ecosystem";
import type { RoyaltyStreamSummary } from "./royalties";
import type { SavingsGoal } from "./savings";
import type { SignedOperation } from "./signatures";
import type { Account, Operation } from "./types";

export type AchievementTier = "bronze" | "silver" | "gold" | "platinum";
export type AchievementCategory = "banking" | "ecosystem" | "security" | "creator";

export type Achievement = {
  id: string;
  category: AchievementCategory;
  label: string;
  description: string;
  icon: string;
  tier: AchievementTier;
  earned: boolean;
  progress: number; // 0..1
  progressLabel: string;
};

export type AchievementInputs = {
  account: Account;
  operations: Operation[];
  royalty?: RoyaltyStreamSummary | null;
  chess?: ChessSummary | null;
  ecosystem?: EcosystemEarningsSummary | null;
  goals: SavingsGoal[];
  circles: Circle[];
  signatures: SignedOperation[];
  advance: Advance | null;
  biometricEnrolled: boolean;
};

export const TIER_COLOR: Record<AchievementTier, string> = {
  bronze: "#a16207",
  silver: "#64748b",
  gold: "#d97706",
  platinum: "#7c3aed",
};

export const CATEGORY_LABEL: Record<AchievementCategory, string> = {
  banking: "Banking",
  ecosystem: "Ecosystem",
  security: "Security",
  creator: "Creator",
};

export const CATEGORY_COLOR: Record<AchievementCategory, string> = {
  banking: "#0f766e",
  ecosystem: "#0ea5e9",
  security: "#dc2626",
  creator: "#7c3aed",
};

type Definition = Omit<Achievement, "earned" | "progress" | "progressLabel"> & {
  progress: (i: AchievementInputs) => { ratio: number; label: string };
};

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

const DEFS: Definition[] = [
  // Banking
  {
    id: "first-topup",
    category: "banking",
    label: "First spark",
    description: "Fund your wallet for the first time.",
    icon: "✦",
    tier: "bronze",
    progress: (i) => {
      const topups = i.operations.filter((op) => op.kind === "topup").length;
      return { ratio: topups >= 1 ? 1 : 0, label: topups >= 1 ? "1 top-up" : "0 / 1 top-up" };
    },
  },
  {
    id: "volume-500",
    category: "banking",
    label: "500 AEC moved",
    description: "Cumulative transfer + top-up volume reaches 500 AEC.",
    icon: "₳",
    tier: "bronze",
    progress: (i) => {
      let v = 0;
      for (const op of i.operations) {
        if (op.to === i.account.id || op.from === i.account.id) v += op.amount;
      }
      return { ratio: clamp01(v / 500), label: `${v.toFixed(0)} / 500 AEC` };
    },
  },
  {
    id: "volume-5000",
    category: "banking",
    label: "Momentum",
    description: "Move 5 000 AEC through your wallet.",
    icon: "⚡",
    tier: "silver",
    progress: (i) => {
      let v = 0;
      for (const op of i.operations) {
        if (op.to === i.account.id || op.from === i.account.id) v += op.amount;
      }
      return { ratio: clamp01(v / 5000), label: `${v.toFixed(0)} / 5 000 AEC` };
    },
  },
  {
    id: "network-5",
    category: "banking",
    label: "Connected",
    description: "Transact with 5 unique counterparties.",
    icon: "◉",
    tier: "bronze",
    progress: (i) => {
      const cps = new Set<string>();
      for (const op of i.operations.filter((o) => o.kind === "transfer")) {
        if (op.from && op.from !== i.account.id) cps.add(op.from);
        if (op.to && op.to !== i.account.id) cps.add(op.to);
      }
      return { ratio: clamp01(cps.size / 5), label: `${cps.size} / 5 contacts` };
    },
  },
  {
    id: "activity-streak",
    category: "banking",
    label: "Rhythm",
    description: "Record 25 banking operations.",
    icon: "⟳",
    tier: "silver",
    progress: (i) => ({ ratio: clamp01(i.operations.length / 25), label: `${i.operations.length} / 25 ops` }),
  },
  {
    id: "goal-first",
    category: "banking",
    label: "Goal-setter",
    description: "Complete your first savings goal.",
    icon: "◆",
    tier: "silver",
    progress: (i) => {
      const done = i.goals.filter((g) => !!g.completedAt).length;
      return { ratio: done >= 1 ? 1 : 0, label: done >= 1 ? "1 completed" : "0 / 1 completed" };
    },
  },
  {
    id: "advance-repaid",
    category: "banking",
    label: "Clean slate",
    description: "Take and fully repay a salary advance.",
    icon: "▼",
    tier: "gold",
    progress: (i) => {
      if (!i.advance) return { ratio: 0, label: "no advance taken" };
      const repaid = i.advance.principal - i.advance.outstanding;
      return {
        ratio: clamp01(repaid / (i.advance.principal || 1)),
        label: `${repaid.toFixed(0)} / ${i.advance.principal.toFixed(0)} AEC repaid`,
      };
    },
  },

  // Ecosystem
  {
    id: "qright-first-work",
    category: "creator",
    label: "Author",
    description: "Register your first creative work in QRight.",
    icon: "✎",
    tier: "bronze",
    progress: (i) => {
      const n = i.royalty?.works.length ?? 0;
      return { ratio: n >= 1 ? 1 : 0, label: n >= 1 ? `${n} works` : "0 / 1 work" };
    },
  },
  {
    id: "qright-portfolio",
    category: "creator",
    label: "Catalogue builder",
    description: "Register 5 creative works in QRight.",
    icon: "⎇",
    tier: "silver",
    progress: (i) => {
      const n = i.royalty?.works.length ?? 0;
      return { ratio: clamp01(n / 5), label: `${n} / 5 works` };
    },
  },
  {
    id: "qright-reach",
    category: "creator",
    label: "Verified worldwide",
    description: "Hit 100 QRight verifications across your catalogue.",
    icon: "◈",
    tier: "gold",
    progress: (i) => {
      const v = i.royalty?.works.reduce((s, w) => s + w.verifications, 0) ?? 0;
      return { ratio: clamp01(v / 100), label: `${v} / 100 verifications` };
    },
  },
  {
    id: "chess-podium",
    category: "ecosystem",
    label: "Podium",
    description: "Finish top-3 in any CyberChess tournament.",
    icon: "♛",
    tier: "silver",
    progress: (i) => {
      const n = i.chess?.topThreeFinishes ?? 0;
      return { ratio: n >= 1 ? 1 : 0, label: n >= 1 ? `${n} podiums` : "0 / 1 podium" };
    },
  },
  {
    id: "chess-1500",
    category: "ecosystem",
    label: "Grandmaster track",
    description: "Reach CyberChess rating 1 500.",
    icon: "♞",
    tier: "gold",
    progress: (i) => {
      const r = i.chess?.currentRating ?? 0;
      return { ratio: clamp01((r - 1000) / 500), label: r ? `${r} / 1 500` : "no games" };
    },
  },
  {
    id: "planet-aligned",
    category: "ecosystem",
    label: "Planet-aligned",
    description: "Earn 100 AEC from Planet bonuses.",
    icon: "◎",
    tier: "silver",
    progress: (i) => {
      const v = i.ecosystem?.perSource.planet.total ?? 0;
      return { ratio: clamp01(v / 100), label: `${v.toFixed(0)} / 100 AEC` };
    },
  },
  {
    id: "ecosystem-breadth",
    category: "ecosystem",
    label: "Breadth",
    description: "Earn from all four modules: banking, QRight, chess, planet.",
    icon: "✧",
    tier: "platinum",
    progress: (i) => {
      if (!i.ecosystem) return { ratio: 0, label: "loading…" };
      const ps = i.ecosystem.perSource;
      let n = 0;
      if (ps.banking.total > 0) n++;
      if (ps.qright.total > 0) n++;
      if (ps.chess.total > 0) n++;
      if (ps.planet.total > 0) n++;
      return { ratio: clamp01(n / 4), label: `${n} / 4 modules active` };
    },
  },

  // Security
  {
    id: "biometric-on",
    category: "security",
    label: "Biometric shield",
    description: "Enrol Touch ID / Windows Hello for high-value transfers.",
    icon: "⌘",
    tier: "silver",
    progress: (i) => ({ ratio: i.biometricEnrolled ? 1 : 0, label: i.biometricEnrolled ? "enrolled" : "not enrolled" }),
  },
  {
    id: "sign-first",
    category: "security",
    label: "Signed & sealed",
    description: "Sign your first transaction with QSign.",
    icon: "⍟",
    tier: "bronze",
    progress: (i) => {
      const n = i.signatures.length;
      return { ratio: n >= 1 ? 1 : 0, label: n >= 1 ? `${n} signed` : "0 / 1 signed" };
    },
  },
  {
    id: "sign-volume",
    category: "security",
    label: "Notary",
    description: "Sign 25 operations — build the audit trail.",
    icon: "⎈",
    tier: "gold",
    progress: (i) => {
      const n = i.signatures.length;
      return { ratio: clamp01(n / 25), label: `${n} / 25 signed` };
    },
  },

  // Social / misc
  {
    id: "circle-host",
    category: "banking",
    label: "Circle host",
    description: "Create a social circle and post a message.",
    icon: "◎",
    tier: "bronze",
    progress: (i) => {
      const active = i.circles.find((c) => c.messages.length > 0);
      return { ratio: active ? 1 : 0, label: active ? "circle active" : "0 / 1 circle" };
    },
  },
];

export function evaluateAchievements(inputs: AchievementInputs): Achievement[] {
  return DEFS.map((d) => {
    const p = d.progress(inputs);
    const ratio = clamp01(p.ratio);
    return {
      id: d.id,
      category: d.category,
      label: d.label,
      description: d.description,
      icon: d.icon,
      tier: d.tier,
      earned: ratio >= 1,
      progress: ratio,
      progressLabel: p.label,
    };
  });
}

export function achievementStats(list: Achievement[]): {
  earned: number;
  total: number;
  pct: number;
  perCategory: Record<AchievementCategory, { earned: number; total: number }>;
} {
  const perCategory: Record<AchievementCategory, { earned: number; total: number }> = {
    banking: { earned: 0, total: 0 },
    ecosystem: { earned: 0, total: 0 },
    security: { earned: 0, total: 0 },
    creator: { earned: 0, total: 0 },
  };
  let earned = 0;
  for (const a of list) {
    perCategory[a.category].total++;
    if (a.earned) {
      perCategory[a.category].earned++;
      earned++;
    }
  }
  return {
    earned,
    total: list.length,
    pct: list.length > 0 ? (earned / list.length) * 100 : 0,
    perCategory,
  };
}
