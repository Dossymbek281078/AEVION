// Savings goals — logical tracking only (no physical escrow in qtrade yet).
// "Add to goal" just bumps a counter; balance stays in the main account.
// TODO backend: POST /api/qtrade/goals (subaccounts with real reserve) — until then,
// goals live in localStorage ["aevion_bank_goals_v1"].

const STORAGE_KEY = "aevion_bank_goals_v1";

export type GoalIcon = "travel" | "vacation" | "home" | "gear" | "star" | "heart" | "coffee" | "music";

export type SavingsGoal = {
  id: string;
  label: string;
  icon: GoalIcon;
  targetAec: number;
  currentAec: number;
  deadlineISO: string | null;
  createdAt: string;
  completedAt: string | null;
};

export const ICON_SYMBOL: Record<GoalIcon, string> = {
  travel: "✈",
  vacation: "☀",
  home: "⌂",
  gear: "⌨",
  star: "★",
  heart: "♥",
  coffee: "☕",
  music: "♫",
};

export const ICON_COLOR: Record<GoalIcon, string> = {
  travel: "#0ea5e9",
  vacation: "#f59e0b",
  home: "#059669",
  gear: "#7c3aed",
  star: "#d97706",
  heart: "#dc2626",
  coffee: "#78350f",
  music: "#db2777",
};

export const ICON_LABEL: Record<GoalIcon, string> = {
  travel: "Travel",
  vacation: "Vacation",
  home: "Home",
  gear: "Gear",
  star: "Goal",
  heart: "Emergency",
  coffee: "Lifestyle",
  music: "Hobby",
};

function isGoal(x: unknown): x is SavingsGoal {
  if (!x || typeof x !== "object") return false;
  const g = x as Partial<SavingsGoal>;
  return (
    typeof g.id === "string" &&
    typeof g.label === "string" &&
    typeof g.icon === "string" &&
    typeof g.targetAec === "number" &&
    typeof g.currentAec === "number" &&
    typeof g.createdAt === "string"
  );
}

export function loadGoals(): SavingsGoal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(isGoal);
  } catch {
    return [];
  }
}

export function saveGoals(items: SavingsGoal[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // quota exceeded — best effort
  }
}

export type GoalForecast = {
  progressPct: number;
  remaining: number;
  daysLeft: number | null;
  daysToReachAtRate: number | null;
  status: "completed" | "onTrack" | "behind" | "idle";
  hint: string;
};

export function forecastGoal(g: SavingsGoal): GoalForecast {
  const progressPct = Math.min(100, (g.currentAec / Math.max(0.01, g.targetAec)) * 100);
  const remaining = Math.max(0, g.targetAec - g.currentAec);

  if (g.currentAec >= g.targetAec || g.completedAt) {
    return {
      progressPct: 100,
      remaining: 0,
      daysLeft: null,
      daysToReachAtRate: null,
      status: "completed",
      hint: "Goal reached",
    };
  }

  const ageDays = Math.max(
    0.1,
    (Date.now() - new Date(g.createdAt).getTime()) / 86_400_000,
  );
  const ratePerDay = g.currentAec / ageDays;

  const daysLeft = g.deadlineISO
    ? Math.max(0, Math.floor((new Date(g.deadlineISO).getTime() - Date.now()) / 86_400_000))
    : null;

  if (ratePerDay <= 0) {
    return {
      progressPct,
      remaining,
      daysLeft,
      daysToReachAtRate: null,
      status: "idle",
      hint: daysLeft != null ? `${daysLeft}d left · add funds to start` : "Add funds to start",
    };
  }

  const daysToReach = remaining / ratePerDay;

  if (daysLeft != null) {
    if (daysToReach <= daysLeft) {
      return {
        progressPct,
        remaining,
        daysLeft,
        daysToReachAtRate: daysToReach,
        status: "onTrack",
        hint: `On track · ${daysLeft}d left`,
      };
    }
    return {
      progressPct,
      remaining,
      daysLeft,
      daysToReachAtRate: daysToReach,
      status: "behind",
      hint: `Behind · need +${((remaining - ratePerDay * daysLeft) / Math.max(1, daysLeft)).toFixed(2)}/day`,
    };
  }

  return {
    progressPct,
    remaining,
    daysLeft: null,
    daysToReachAtRate: daysToReach,
    status: "onTrack",
    hint: `~${Math.ceil(daysToReach)}d at current rate`,
  };
}
