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
  /** i18n key for the achievement title; falls back to {@link label} (raw EN). */
  labelKey: string;
  /** i18n key for the achievement description; falls back to {@link description} (raw EN). */
  descriptionKey: string;
  icon: string;
  tier: AchievementTier;
  earned: boolean;
  progress: number; // 0..1
  progressLabel: string;
  /**
   * Optional i18n key + interpolation vars for {@link progressLabel}. When
   * present, consumers can render `t(progressLabelKey, progressLabelVars)`
   * and fall back to the raw EN {@link progressLabel} otherwise.
   */
  progressLabelKey?: string;
  progressLabelVars?: Record<string, string | number>;
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

/** i18n keys parallel to {@link CATEGORY_LABEL} — feed into `t(...)`. */
export const CATEGORY_LABEL_KEY: Record<AchievementCategory, string> = {
  banking: "achievements.category.banking",
  ecosystem: "achievements.category.ecosystem",
  security: "achievements.category.security",
  creator: "achievements.category.creator",
};

export const CATEGORY_COLOR: Record<AchievementCategory, string> = {
  banking: "#0f766e",
  ecosystem: "#0ea5e9",
  security: "#dc2626",
  creator: "#7c3aed",
};

type ProgressResult = {
  ratio: number;
  label: string;
  /** i18n key for the progress label, optional (raw EN label is the fallback). */
  labelKey?: string;
  labelVars?: Record<string, string | number>;
};

type Definition = Omit<
  Achievement,
  "earned" | "progress" | "progressLabel" | "progressLabelKey" | "progressLabelVars"
> & {
  progress: (i: AchievementInputs) => ProgressResult;
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
    labelKey: "achievements.title.first-topup",
    descriptionKey: "achievements.hint.first-topup",
    icon: "✦",
    tier: "bronze",
    progress: (i) => {
      const topups = i.operations.filter((op) => op.kind === "topup").length;
      return topups >= 1
        ? { ratio: 1, label: "1 top-up", labelKey: "achievements.progress.topupDone" }
        : { ratio: 0, label: "0 / 1 top-up", labelKey: "achievements.progress.topupTodo" };
    },
  },
  {
    id: "volume-500",
    category: "banking",
    label: "500 AEC moved",
    description: "Cumulative transfer + top-up volume reaches 500 AEC.",
    labelKey: "achievements.title.volume-500",
    descriptionKey: "achievements.hint.volume-500",
    icon: "₳",
    tier: "bronze",
    progress: (i) => {
      let v = 0;
      for (const op of i.operations) {
        if (op.to === i.account.id || op.from === i.account.id) v += op.amount;
      }
      return {
        ratio: clamp01(v / 500),
        label: `${v.toFixed(0)} / 500 AEC`,
        labelKey: "achievements.progress.volume",
        labelVars: { current: v.toFixed(0), target: "500" },
      };
    },
  },
  {
    id: "volume-5000",
    category: "banking",
    label: "Momentum",
    description: "Move 5 000 AEC through your wallet.",
    labelKey: "achievements.title.volume-5000",
    descriptionKey: "achievements.hint.volume-5000",
    icon: "⚡",
    tier: "silver",
    progress: (i) => {
      let v = 0;
      for (const op of i.operations) {
        if (op.to === i.account.id || op.from === i.account.id) v += op.amount;
      }
      return {
        ratio: clamp01(v / 5000),
        label: `${v.toFixed(0)} / 5 000 AEC`,
        labelKey: "achievements.progress.volume",
        labelVars: { current: v.toFixed(0), target: "5 000" },
      };
    },
  },
  {
    id: "network-5",
    category: "banking",
    label: "Connected",
    description: "Transact with 5 unique counterparties.",
    labelKey: "achievements.title.network-5",
    descriptionKey: "achievements.hint.network-5",
    icon: "◉",
    tier: "bronze",
    progress: (i) => {
      const cps = new Set<string>();
      for (const op of i.operations.filter((o) => o.kind === "transfer")) {
        if (op.from && op.from !== i.account.id) cps.add(op.from);
        if (op.to && op.to !== i.account.id) cps.add(op.to);
      }
      return {
        ratio: clamp01(cps.size / 5),
        label: `${cps.size} / 5 contacts`,
        labelKey: "achievements.progress.contacts",
        labelVars: { current: cps.size, target: 5 },
      };
    },
  },
  {
    id: "activity-streak",
    category: "banking",
    label: "Rhythm",
    description: "Record 25 banking operations.",
    labelKey: "achievements.title.activity-streak",
    descriptionKey: "achievements.hint.activity-streak",
    icon: "⟳",
    tier: "silver",
    progress: (i) => ({
      ratio: clamp01(i.operations.length / 25),
      label: `${i.operations.length} / 25 ops`,
      labelKey: "achievements.progress.ops",
      labelVars: { current: i.operations.length, target: 25 },
    }),
  },
  {
    id: "goal-first",
    category: "banking",
    label: "Goal-setter",
    description: "Complete your first savings goal.",
    labelKey: "achievements.title.goal-first",
    descriptionKey: "achievements.hint.goal-first",
    icon: "◆",
    tier: "silver",
    progress: (i) => {
      const done = i.goals.filter((g) => !!g.completedAt).length;
      return done >= 1
        ? { ratio: 1, label: "1 completed", labelKey: "achievements.progress.goalDone" }
        : { ratio: 0, label: "0 / 1 completed", labelKey: "achievements.progress.goalTodo" };
    },
  },
  {
    id: "advance-repaid",
    category: "banking",
    label: "Clean slate",
    description: "Take and fully repay a salary advance.",
    labelKey: "achievements.title.advance-repaid",
    descriptionKey: "achievements.hint.advance-repaid",
    icon: "▼",
    tier: "gold",
    progress: (i) => {
      if (!i.advance) {
        return { ratio: 0, label: "no advance taken", labelKey: "achievements.progress.advanceNone" };
      }
      const repaid = i.advance.principal - i.advance.outstanding;
      return {
        ratio: clamp01(repaid / (i.advance.principal || 1)),
        label: `${repaid.toFixed(0)} / ${i.advance.principal.toFixed(0)} AEC repaid`,
        labelKey: "achievements.progress.advanceRepaid",
        labelVars: { current: repaid.toFixed(0), target: i.advance.principal.toFixed(0) },
      };
    },
  },

  // Ecosystem
  {
    id: "qright-first-work",
    category: "creator",
    label: "Author",
    description: "Register your first creative work in QRight.",
    labelKey: "achievements.title.qright-first-work",
    descriptionKey: "achievements.hint.qright-first-work",
    icon: "✎",
    tier: "bronze",
    progress: (i) => {
      const n = i.royalty?.works.length ?? 0;
      return n >= 1
        ? {
            ratio: 1,
            label: `${n} works`,
            labelKey: "achievements.progress.works",
            labelVars: { n },
          }
        : { ratio: 0, label: "0 / 1 work", labelKey: "achievements.progress.workTodo" };
    },
  },
  {
    id: "qright-portfolio",
    category: "creator",
    label: "Catalogue builder",
    description: "Register 5 creative works in QRight.",
    labelKey: "achievements.title.qright-portfolio",
    descriptionKey: "achievements.hint.qright-portfolio",
    icon: "⎇",
    tier: "silver",
    progress: (i) => {
      const n = i.royalty?.works.length ?? 0;
      return {
        ratio: clamp01(n / 5),
        label: `${n} / 5 works`,
        labelKey: "achievements.progress.worksOf",
        labelVars: { current: n, target: 5 },
      };
    },
  },
  {
    id: "qright-reach",
    category: "creator",
    label: "Verified worldwide",
    description: "Hit 100 QRight verifications across your catalogue.",
    labelKey: "achievements.title.qright-reach",
    descriptionKey: "achievements.hint.qright-reach",
    icon: "◈",
    tier: "gold",
    progress: (i) => {
      const v = i.royalty?.works.reduce((s, w) => s + w.verifications, 0) ?? 0;
      return {
        ratio: clamp01(v / 100),
        label: `${v} / 100 verifications`,
        labelKey: "achievements.progress.verifications",
        labelVars: { current: v, target: 100 },
      };
    },
  },
  {
    id: "chess-podium",
    category: "ecosystem",
    label: "Podium",
    description: "Finish top-3 in any CyberChess tournament.",
    labelKey: "achievements.title.chess-podium",
    descriptionKey: "achievements.hint.chess-podium",
    icon: "♛",
    tier: "silver",
    progress: (i) => {
      const n = i.chess?.topThreeFinishes ?? 0;
      return n >= 1
        ? {
            ratio: 1,
            label: `${n} podiums`,
            labelKey: "achievements.progress.podiums",
            labelVars: { n },
          }
        : { ratio: 0, label: "0 / 1 podium", labelKey: "achievements.progress.podiumTodo" };
    },
  },
  {
    id: "chess-1500",
    category: "ecosystem",
    label: "Grandmaster track",
    description: "Reach CyberChess rating 1 500.",
    labelKey: "achievements.title.chess-1500",
    descriptionKey: "achievements.hint.chess-1500",
    icon: "♞",
    tier: "gold",
    progress: (i) => {
      const r = i.chess?.currentRating ?? 0;
      if (!r) return { ratio: 0, label: "no games", labelKey: "achievements.progress.noGames" };
      return {
        ratio: clamp01((r - 1000) / 500),
        label: `${r} / 1 500`,
        labelKey: "achievements.progress.rating",
        labelVars: { current: r, target: "1 500" },
      };
    },
  },
  {
    id: "planet-aligned",
    category: "ecosystem",
    label: "Planet-aligned",
    description: "Earn 100 AEC from Planet bonuses.",
    labelKey: "achievements.title.planet-aligned",
    descriptionKey: "achievements.hint.planet-aligned",
    icon: "◎",
    tier: "silver",
    progress: (i) => {
      const v = i.ecosystem?.perSource.planet.total ?? 0;
      return {
        ratio: clamp01(v / 100),
        label: `${v.toFixed(0)} / 100 AEC`,
        labelKey: "achievements.progress.volume",
        labelVars: { current: v.toFixed(0), target: "100" },
      };
    },
  },
  {
    id: "ecosystem-breadth",
    category: "ecosystem",
    label: "Breadth",
    description: "Earn from all four modules: banking, QRight, chess, planet.",
    labelKey: "achievements.title.ecosystem-breadth",
    descriptionKey: "achievements.hint.ecosystem-breadth",
    icon: "✧",
    tier: "platinum",
    progress: (i) => {
      if (!i.ecosystem) return { ratio: 0, label: "loading…", labelKey: "achievements.progress.loading" };
      const ps = i.ecosystem.perSource;
      let n = 0;
      if (ps.banking.total > 0) n++;
      if (ps.qright.total > 0) n++;
      if (ps.chess.total > 0) n++;
      if (ps.planet.total > 0) n++;
      return {
        ratio: clamp01(n / 4),
        label: `${n} / 4 modules active`,
        labelKey: "achievements.progress.modules",
        labelVars: { current: n, target: 4 },
      };
    },
  },

  // Security
  {
    id: "biometric-on",
    category: "security",
    label: "Biometric shield",
    description: "Enrol Touch ID / Windows Hello for high-value transfers.",
    labelKey: "achievements.title.biometric-on",
    descriptionKey: "achievements.hint.biometric-on",
    icon: "⌘",
    tier: "silver",
    progress: (i) => i.biometricEnrolled
      ? { ratio: 1, label: "enrolled", labelKey: "achievements.progress.enrolled" }
      : { ratio: 0, label: "not enrolled", labelKey: "achievements.progress.notEnrolled" },
  },
  {
    id: "sign-first",
    category: "security",
    label: "Signed & sealed",
    description: "Sign your first transaction with QSign.",
    labelKey: "achievements.title.sign-first",
    descriptionKey: "achievements.hint.sign-first",
    icon: "⍟",
    tier: "bronze",
    progress: (i) => {
      const n = i.signatures.length;
      return n >= 1
        ? {
            ratio: 1,
            label: `${n} signed`,
            labelKey: "achievements.progress.signed",
            labelVars: { n },
          }
        : { ratio: 0, label: "0 / 1 signed", labelKey: "achievements.progress.signedTodo" };
    },
  },
  {
    id: "sign-volume",
    category: "security",
    label: "Notary",
    description: "Sign 25 operations — build the audit trail.",
    labelKey: "achievements.title.sign-volume",
    descriptionKey: "achievements.hint.sign-volume",
    icon: "⎈",
    tier: "gold",
    progress: (i) => {
      const n = i.signatures.length;
      return {
        ratio: clamp01(n / 25),
        label: `${n} / 25 signed`,
        labelKey: "achievements.progress.signedOf",
        labelVars: { current: n, target: 25 },
      };
    },
  },

  // Social / misc
  {
    id: "circle-host",
    category: "banking",
    label: "Circle host",
    description: "Create a social circle and post a message.",
    labelKey: "achievements.title.circle-host",
    descriptionKey: "achievements.hint.circle-host",
    icon: "◎",
    tier: "bronze",
    progress: (i) => {
      const active = i.circles.find((c) => c.messages.length > 0);
      return active
        ? { ratio: 1, label: "circle active", labelKey: "achievements.progress.circleActive" }
        : { ratio: 0, label: "0 / 1 circle", labelKey: "achievements.progress.circleTodo" };
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
      labelKey: d.labelKey,
      descriptionKey: d.descriptionKey,
      icon: d.icon,
      tier: d.tier,
      earned: ratio >= 1,
      progress: ratio,
      progressLabel: p.label,
      progressLabelKey: p.labelKey,
      progressLabelVars: p.labelVars,
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
