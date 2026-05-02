// Savings goals — logical tracking only (no physical escrow in qtrade yet).
// "Add to goal" just bumps a counter; balance stays in the main account.
// TODO backend: POST /api/qtrade/goals (subaccounts with real reserve) — until then,
// goals live in localStorage ["aevion_bank_goals_v1"].

const STORAGE_KEY = "aevion_bank_goals_v1";
export const GOALS_EVENT = "aevion:goals-changed";

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

/** i18n keys parallel to {@link ICON_LABEL}. */
export const ICON_LABEL_KEY: Record<GoalIcon, string> = {
  travel: "savings.icon.travel",
  vacation: "savings.icon.vacation",
  home: "savings.icon.home",
  gear: "savings.icon.gear",
  star: "savings.icon.star",
  heart: "savings.icon.heart",
  coffee: "savings.icon.coffee",
  music: "savings.icon.music",
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
    window.dispatchEvent(new Event(GOALS_EVENT));
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

type Translator = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Goal pacing forecast. When a `t` translator is passed, the `hint` string is
 * localized; otherwise the original English copy is returned (so server-side
 * code, snapshots, and tests remain stable without an i18n context).
 */
export function forecastGoal(g: SavingsGoal, t?: Translator): GoalForecast {
  const tr: Translator = t ?? ((_k, _v) => _k);
  const useT = typeof t === "function";
  const progressPct = Math.min(100, (g.currentAec / Math.max(0.01, g.targetAec)) * 100);
  const remaining = Math.max(0, g.targetAec - g.currentAec);

  if (g.currentAec >= g.targetAec || g.completedAt) {
    return {
      progressPct: 100,
      remaining: 0,
      daysLeft: null,
      daysToReachAtRate: null,
      status: "completed",
      hint: useT ? tr("savings.forecast.completed") : "Goal reached",
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
      hint:
        daysLeft != null
          ? useT
            ? tr("savings.forecast.idleWithDeadline", { days: daysLeft })
            : `${daysLeft}d left · add funds to start`
          : useT
            ? tr("savings.forecast.idleNoDeadline")
            : "Add funds to start",
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
        hint: useT
          ? tr("savings.forecast.onTrackDeadline", { days: daysLeft })
          : `On track · ${daysLeft}d left`,
      };
    }
    const perDay = ((remaining - ratePerDay * daysLeft) / Math.max(1, daysLeft)).toFixed(2);
    return {
      progressPct,
      remaining,
      daysLeft,
      daysToReachAtRate: daysToReach,
      status: "behind",
      hint: useT
        ? tr("savings.forecast.behind", { perDay })
        : `Behind · need +${perDay}/day`,
    };
  }

  return {
    progressPct,
    remaining,
    daysLeft: null,
    daysToReachAtRate: daysToReach,
    status: "onTrack",
    hint: useT
      ? tr("savings.forecast.onTrackOpen", { days: Math.ceil(daysToReach) })
      : `~${Math.ceil(daysToReach)}d at current rate`,
  };
}
