// Copilot Autopilot — opt-in background executor.
// Runs on a client-side tick (via FinancialCopilot) and, subject to strict caps,
// auto-executes ONE safe action per evaluation (currently: goal-catch-up
// contribution). All state is localStorage-only; nothing touches backend.

import type { RecurrencePeriod, Recurring } from "./recurring";
import { forecastGoal, saveGoals, type SavingsGoal } from "./savings";
import type { Account, Operation } from "./types";

const CONFIG_KEY = "aevion_bank_autopilot_config_v1";
const ACTIONS_KEY = "aevion_bank_autopilot_actions_v1";
const STATE_KEY = "aevion_bank_autopilot_state_v1";
const MAX_ACTIONS_KEPT = 50;
export const AUTOPILOT_EVENT = "aevion:autopilot-changed";

export type AutopilotConfig = {
  enabled: boolean;
  /** Max AEC moved by autopilot in a 24h rolling window. */
  dailyCapAec: number;
  /** Max AEC per single tick. Tick rate is handled by the caller (~60s). */
  perTickMaxAec: number;
  /** Balance must stay ≥ safetyBufferRatio × 30-day recurring outflows. */
  safetyBufferRatio: number;
  /** Only catch-up a goal if its deadline is within this many days. */
  maxDaysLeft: number;
  /** Rule #2: % of each inflow to allocate to goals. 0 = off. Range 0..30. */
  inflowSharePct: number;
  /** Rule #2: only trigger on inflow deltas ≥ this AEC. */
  inflowMinTriggerAec: number;
  /** Rule #3: anomaly-watchdog. If a burst of outgoing ops is detected, auto-
   *  freeze the wallet (same mechanism as Panic Freeze) for 5 min. Off by
   *  default; opt-in because it blocks outgoing transfers. */
  anomalyWatchdog: boolean;
  /** Rule #3: burst defined as ≥ N outgoing ops in anomalyWindowMin minutes. */
  anomalyBurstCount: number;
  anomalyWindowMin: number;
};

export const DEFAULT_CONFIG: AutopilotConfig = {
  enabled: false,
  dailyCapAec: 50,
  perTickMaxAec: 5,
  safetyBufferRatio: 1.2,
  maxDaysLeft: 30,
  inflowSharePct: 0,
  inflowMinTriggerAec: 10,
  anomalyWatchdog: false,
  anomalyBurstCount: 3,
  anomalyWindowMin: 20,
};

/** Runtime state — not user preferences; tracks what autopilot has observed. */
export type AutopilotState = {
  /** Balance seen on the previous tick, so we can detect inflow deltas. */
  lastSeenBalance: number | null;
  /** ms epoch of last anomaly auto-freeze — prevents rapid re-freezing. */
  lastAnomalyFreezeMs: number | null;
};

export const DEFAULT_STATE: AutopilotState = {
  lastSeenBalance: null,
  lastAnomalyFreezeMs: null,
};

/** Cooldown between consecutive anomaly-triggered auto-freezes. */
export const ANOMALY_COOLDOWN_MS = 10 * 60 * 1000; // 10 min

export type AutopilotAction = {
  id: string;
  at: string;
  kind: "goal-contribution";
  amount: number;
  targetId: string;
  targetLabel: string;
  note: string;
};

function isConfig(x: unknown): x is AutopilotConfig {
  if (!x || typeof x !== "object") return false;
  const c = x as Partial<AutopilotConfig>;
  // inflowSharePct and inflowMinTriggerAec were added later; fall back to
  // defaults if missing so stored configs without these keys stay valid.
  return (
    typeof c.enabled === "boolean" &&
    typeof c.dailyCapAec === "number" &&
    typeof c.perTickMaxAec === "number" &&
    typeof c.safetyBufferRatio === "number" &&
    typeof c.maxDaysLeft === "number"
  );
}

function isAction(x: unknown): x is AutopilotAction {
  if (!x || typeof x !== "object") return false;
  const a = x as Partial<AutopilotAction>;
  return (
    typeof a.id === "string" &&
    typeof a.at === "string" &&
    typeof a.kind === "string" &&
    typeof a.amount === "number" &&
    typeof a.targetId === "string"
  );
}

export function loadConfig(): AutopilotConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw);
    if (!isConfig(parsed)) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function loadState(): AutopilotState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return DEFAULT_STATE;
    const s = parsed as Partial<AutopilotState>;
    return {
      lastSeenBalance:
        typeof s.lastSeenBalance === "number" && Number.isFinite(s.lastSeenBalance)
          ? s.lastSeenBalance
          : null,
      lastAnomalyFreezeMs:
        typeof s.lastAnomalyFreezeMs === "number" && Number.isFinite(s.lastAnomalyFreezeMs)
          ? s.lastAnomalyFreezeMs
          : null,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveState(s: AutopilotState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function saveConfig(c: AutopilotConfig): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(c));
    window.dispatchEvent(new Event(AUTOPILOT_EVENT));
  } catch {
    /* ignore */
  }
}

export function loadActions(): AutopilotAction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ACTIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isAction);
  } catch {
    return [];
  }
}

export function saveActions(items: AutopilotAction[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ACTIONS_KEY, JSON.stringify(items.slice(0, MAX_ACTIONS_KEPT)));
    window.dispatchEvent(new Event(AUTOPILOT_EVENT));
  } catch {
    /* ignore */
  }
}

const PERIOD_DAYS: Record<RecurrencePeriod, number> = {
  daily: 1,
  weekly: 7,
  biweekly: 14,
  monthly: 30,
};

/** Estimate AEC that recurring schedules will consume in the next 30 days. */
export function recurring30dOutflow(recurring: Recurring[]): number {
  const horizon = Date.now() + 30 * 24 * 60 * 60 * 1000;
  let sum = 0;
  for (const r of recurring) {
    if (!r.active) continue;
    const next = Date.parse(r.nextRunAt);
    if (!Number.isFinite(next)) continue;
    let t = next;
    const step = PERIOD_DAYS[r.period] * 24 * 60 * 60 * 1000;
    while (t <= horizon) {
      sum += r.amount;
      t += step;
    }
  }
  return sum;
}

/** Sum of autopilot-moved AEC in the rolling last 24h. */
export function rollingDailyMoved(actions: AutopilotAction[]): number {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  let sum = 0;
  for (const a of actions) {
    const t = Date.parse(a.at);
    if (Number.isFinite(t) && t >= cutoff) sum += a.amount;
  }
  return sum;
}

export type TickContext = {
  config: AutopilotConfig;
  state: AutopilotState;
  account: Account;
  recurring: Recurring[];
  goals: SavingsGoal[];
  actions: AutopilotAction[];
};

export type TickDecision =
  | { status: "skip"; reason: string; nextState: AutopilotState }
  | {
      status: "execute";
      action: AutopilotAction;
      updatedGoals: SavingsGoal[];
      nextState: AutopilotState;
    };

function newActionId(): string {
  return `ap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function applyContribution(
  goals: SavingsGoal[],
  targetId: string,
  amount: number,
): SavingsGoal[] {
  return goals.map((g) => {
    if (g.id !== targetId) return g;
    const nextAec = +(g.currentAec + amount).toFixed(2);
    return {
      ...g,
      currentAec: nextAec,
      completedAt: nextAec >= g.targetAec && !g.completedAt ? new Date().toISOString() : g.completedAt,
    };
  });
}

/** Pure evaluator — returns what would happen. Caller persists via applyExecute. */
export function evaluateTick(ctx: TickContext): TickDecision {
  const { config, state, account, recurring, goals, actions } = ctx;
  // Preserve anomaly timestamp — only tick updates balance observation.
  const nextState: AutopilotState = {
    lastSeenBalance: account.balance,
    lastAnomalyFreezeMs: state.lastAnomalyFreezeMs,
  };

  if (!config.enabled) return { status: "skip", reason: "autopilot-disabled", nextState };

  const movedToday = rollingDailyMoved(actions);
  const remainingDaily = config.dailyCapAec - movedToday;
  if (remainingDaily <= 0) return { status: "skip", reason: "daily-cap-reached", nextState };

  const buffer = recurring30dOutflow(recurring) * config.safetyBufferRatio;
  const spendable = account.balance - buffer;
  if (spendable <= 0) return { status: "skip", reason: "balance-below-safety-buffer", nextState };

  const openGoals = goals.filter((g) => !g.completedAt && g.currentAec < g.targetAec);

  // Rule #2: split-on-inflow. Preferred when it can fire — users find "you
  // got paid, I saved X%" more intuitive than "you were behind, I caught up".
  if (
    config.inflowSharePct > 0 &&
    state.lastSeenBalance !== null &&
    state.lastSeenBalance >= 0
  ) {
    const delta = account.balance - state.lastSeenBalance;
    if (delta >= config.inflowMinTriggerAec) {
      // Prefer behind-pace goals with deadlines; fall back to any open goal
      // with a deadline; finally to any open goal.
      const ranked = openGoals
        .map((g) => ({ g, fc: forecastGoal(g) }))
        .sort((a, b) => {
          const aBehind = a.fc.status === "behind" ? 0 : 1;
          const bBehind = b.fc.status === "behind" ? 0 : 1;
          if (aBehind !== bBehind) return aBehind - bBehind;
          const aDays = a.fc.daysLeft ?? Number.POSITIVE_INFINITY;
          const bDays = b.fc.daysLeft ?? Number.POSITIVE_INFINITY;
          return aDays - bDays;
        });
      if (ranked.length > 0) {
        const target = ranked[0].g;
        const share = delta * (config.inflowSharePct / 100);
        const gap = target.targetAec - target.currentAec;
        const amount = +Math.min(
          config.perTickMaxAec,
          remainingDaily,
          spendable,
          gap,
          share,
        ).toFixed(2);
        if (amount > 0) {
          const updatedGoals = applyContribution(goals, target.id, amount);
          const action: AutopilotAction = {
            id: newActionId(),
            at: new Date().toISOString(),
            kind: "goal-contribution",
            amount,
            targetId: target.id,
            targetLabel: target.label,
            note: `+${amount.toFixed(2)} AEC → ${target.label} · inflow-split ${config.inflowSharePct}%`,
          };
          return { status: "execute", action, updatedGoals, nextState };
        }
      }
    }
  }

  // Rule #1: catch-up for behind-pace goals within the deadline window.
  const catchUp = openGoals
    .map((g) => ({ g, fc: forecastGoal(g) }))
    .filter(
      ({ fc }) =>
        fc.status === "behind" &&
        fc.daysLeft != null &&
        fc.daysLeft > 0 &&
        fc.daysLeft <= config.maxDaysLeft,
    )
    .sort((a, b) => (a.fc.daysLeft ?? Infinity) - (b.fc.daysLeft ?? Infinity));

  if (catchUp.length === 0) return { status: "skip", reason: "no-behind-goals", nextState };

  const { g: target } = catchUp[0];
  const gap = target.targetAec - target.currentAec;
  const amount = +Math.min(config.perTickMaxAec, remainingDaily, spendable, gap).toFixed(2);
  if (amount <= 0) return { status: "skip", reason: "amount-zero", nextState };

  const updatedGoals = applyContribution(goals, target.id, amount);
  const action: AutopilotAction = {
    id: newActionId(),
    at: new Date().toISOString(),
    kind: "goal-contribution",
    amount,
    targetId: target.id,
    targetLabel: target.label,
    note: `+${amount.toFixed(2)} AEC → ${target.label}`,
  };

  return { status: "execute", action, updatedGoals, nextState };
}

/** Apply a decision — persists goals, action log, and runtime state. */
export function applyExecute(
  decision: Extract<TickDecision, { status: "execute" }>,
  currentActions: AutopilotAction[],
): AutopilotAction[] {
  saveGoals(decision.updatedGoals);
  const nextActions = [decision.action, ...currentActions].slice(0, MAX_ACTIONS_KEPT);
  saveActions(nextActions);
  saveState(decision.nextState);
  return nextActions;
}

/** Persist nextState even on skip — so the next tick has a baseline. */
export function commitState(nextState: AutopilotState): void {
  saveState(nextState);
}

export type AnomalyDecision =
  | { status: "idle"; reason: string }
  | { status: "freeze"; note: string; burstCount: number; burstValueAec: number };

/** Watchdog evaluator — separate from tick because it fires more often (15s)
 *  and its side effect (freeze) is different from the goal-contribution path. */
export function evaluateAnomaly(
  config: AutopilotConfig,
  state: AutopilotState,
  account: Account,
  operations: Operation[],
  alreadyFrozen: boolean,
): AnomalyDecision {
  if (!config.enabled) return { status: "idle", reason: "autopilot-disabled" };
  if (!config.anomalyWatchdog) return { status: "idle", reason: "watchdog-off" };
  if (alreadyFrozen) return { status: "idle", reason: "already-frozen" };
  if (
    state.lastAnomalyFreezeMs !== null &&
    Date.now() - state.lastAnomalyFreezeMs < ANOMALY_COOLDOWN_MS
  ) {
    return { status: "idle", reason: "cooldown" };
  }

  const cutoff = Date.now() - config.anomalyWindowMin * 60 * 1000;
  let burstCount = 0;
  let burstValue = 0;
  for (const op of operations) {
    const t = Date.parse(op.createdAt);
    if (!Number.isFinite(t) || t < cutoff) continue;
    // Only count OUTGOING: either a topup we initiated, or a transfer from us.
    // Topups add value, so treat them as risk-neutral; only `transfer` from us
    // counts toward burst.
    if (op.kind === "transfer" && op.from === account.id) {
      burstCount += 1;
      burstValue += op.amount;
    }
  }

  if (burstCount < config.anomalyBurstCount) {
    return { status: "idle", reason: "below-threshold" };
  }
  const valueGate = Math.max(50, account.balance * 0.2);
  if (burstValue < valueGate) {
    return { status: "idle", reason: "below-value-gate" };
  }

  const note = `Auto-freeze · burst: ${burstCount} transfers (${burstValue.toFixed(0)} AEC) in ${config.anomalyWindowMin} min`;
  return { status: "freeze", note, burstCount, burstValueAec: burstValue };
}
