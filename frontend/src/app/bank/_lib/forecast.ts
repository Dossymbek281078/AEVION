import type { EcosystemEarningsSummary } from "./ecosystem";
import type { SavingsGoal } from "./savings";

export type ScenarioKey = "conservative" | "realistic" | "optimistic";

export type Scenario = {
  key: ScenarioKey;
  label: string;
  multiplier: number;
  color: string;
  description: string;
};

export const SCENARIOS: Scenario[] = [
  {
    key: "conservative",
    label: "Conservative",
    multiplier: 0.75,
    color: "#64748b",
    description: "25 % softer than today's pace — accounts for dips in verification volume.",
  },
  {
    key: "realistic",
    label: "Realistic",
    multiplier: 1.0,
    color: "#0d9488",
    description: "Current 30-day pace extrapolated forward.",
  },
  {
    key: "optimistic",
    label: "Optimistic",
    multiplier: 1.35,
    color: "#d97706",
    description: "35 % lift — royalties compound as IP catalogue grows.",
  },
];

export type GoalETA = {
  goalId: string;
  label: string;
  remaining: number;
  daysToComplete: number | null;
  etaISO: string | null;
};

export type WealthForecast = {
  dailyRate: number;
  monthlyRate: number;
  yearlyRate: number;
  trendPct: number; // 7d avg vs 30d avg, percent
  projectedBalanceBy: Record<ScenarioKey, { d30: number; d90: number; d365: number }>;
  goalETAs: GoalETA[];
  topSourceShare: Array<{ source: "banking" | "qright" | "chess" | "planet"; share: number; amount: number }>;
};

function last(daily: EcosystemEarningsSummary["daily"], n: number): number {
  let s = 0;
  for (const d of daily.slice(-n)) s += d.banking + d.qright + d.chess + d.planet;
  return s;
}

export function computeWealthForecast(params: {
  currentBalance: number;
  ecosystem: EcosystemEarningsSummary | null;
  goals: SavingsGoal[];
}): WealthForecast {
  const { currentBalance, ecosystem, goals } = params;

  const last30 = ecosystem ? last(ecosystem.daily, 30) : 0;
  const last7 = ecosystem ? last(ecosystem.daily, 7) : 0;
  const daily = last30 / 30;
  const daily7 = last7 / 7;
  const trendPct = daily > 0 ? ((daily7 - daily) / daily) * 100 : 0;

  const projectedBalanceBy = {} as Record<ScenarioKey, { d30: number; d90: number; d365: number }>;
  for (const s of SCENARIOS) {
    const r = daily * s.multiplier;
    projectedBalanceBy[s.key] = {
      d30: currentBalance + r * 30,
      d90: currentBalance + r * 90,
      d365: currentBalance + r * 365,
    };
  }

  const goalETAs: GoalETA[] = goals
    .filter((g) => !g.completedAt)
    .sort((a, b) => a.targetAec - a.currentAec - (b.targetAec - b.currentAec))
    .map((g) => {
      const remaining = Math.max(0, g.targetAec - g.currentAec);
      if (daily <= 0) {
        return { goalId: g.id, label: g.label, remaining, daysToComplete: null, etaISO: null };
      }
      // Assume half of daily inflow gets set aside toward goals (common personal-finance heuristic).
      const setAside = daily * 0.5;
      const days = setAside > 0 ? Math.ceil(remaining / setAside) : null;
      const eta = days != null ? new Date(Date.now() + days * 86_400_000).toISOString() : null;
      return { goalId: g.id, label: g.label, remaining, daysToComplete: days, etaISO: eta };
    });

  const topSourceShare = ecosystem
    ? (["banking", "qright", "chess", "planet"] as const)
        .map((source) => ({
          source,
          amount: ecosystem.perSource[source].last30d,
          share: last30 > 0 ? ecosystem.perSource[source].last30d / last30 : 0,
        }))
        .sort((a, b) => b.amount - a.amount)
    : [];

  return {
    dailyRate: daily,
    monthlyRate: daily * 30,
    yearlyRate: daily * 365,
    trendPct,
    projectedBalanceBy,
    goalETAs,
    topSourceShare,
  };
}
