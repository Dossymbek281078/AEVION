// Spending Challenges — gamified weekly / monthly missions.
// Pure derivation from operations + recurring + savings — no separate state.
// Each challenge evaluates relative to NOW so completion is observable
// directly from existing data; achievements track historical wins.

import { categorise } from "./spending";
import { loadRecurring } from "./recurring";
import { loadGoals } from "./savings";
import type { Operation } from "./types";

export type ChallengeId =
  | "noSpendDay"
  | "skipTipsWeek"
  | "save10Percent"
  | "subPauseMonth"
  | "goalSprint";

export type ChallengeStatus = "active" | "won" | "lost";

export type Challenge = {
  id: ChallengeId;
  rewardAec: number;
  /** Days the challenge runs from window start. */
  durationDays: number;
};

export type ChallengeEval = {
  id: ChallengeId;
  status: ChallengeStatus;
  /** Progress fraction toward win condition; 1 = won. */
  progress: number;
  /** Hours left in window (0 if expired). */
  hoursLeft: number;
  /** Human-friendly current value (e.g., "2 of 5 days") — i18n key + vars. */
  detailKey: string;
  detailVars: Record<string, string | number>;
  rewardAec: number;
};

export const CHALLENGES: Challenge[] = [
  { id: "noSpendDay", rewardAec: 5, durationDays: 1 },
  { id: "skipTipsWeek", rewardAec: 10, durationDays: 7 },
  { id: "save10Percent", rewardAec: 15, durationDays: 7 },
  { id: "subPauseMonth", rewardAec: 25, durationDays: 30 },
  { id: "goalSprint", rewardAec: 20, durationDays: 7 },
];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const dow = x.getDay() || 7;
  x.setDate(x.getDate() - (dow - 1));
  return x;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function effect(op: Operation, myId: string): number {
  if (op.kind === "topup") return op.amount;
  if (op.from === myId) return -op.amount;
  if (op.to === myId) return op.amount;
  return 0;
}

function hoursLeftOf(endMs: number): number {
  return Math.max(0, Math.floor((endMs - Date.now()) / 3_600_000));
}

export function evaluateChallenge(
  ch: Challenge,
  operations: Operation[],
  myId: string,
  now: Date = new Date(),
): ChallengeEval {
  switch (ch.id) {
    case "noSpendDay": {
      const start = startOfDay(now).getTime();
      const end = start + 86_400_000;
      let outflowCount = 0;
      for (const op of operations) {
        const ts = new Date(op.createdAt).getTime();
        if (!Number.isFinite(ts) || ts < start || ts >= end) continue;
        if (op.kind === "transfer" && op.from === myId) outflowCount++;
      }
      const won = outflowCount === 0;
      const expired = now.getTime() >= end;
      return {
        id: ch.id,
        status: expired && won ? "won" : expired ? "lost" : won ? "active" : "lost",
        progress: won ? 1 : 0,
        hoursLeft: hoursLeftOf(end),
        detailKey: "challenge.noSpendDay.detail",
        detailVars: { count: outflowCount },
        rewardAec: ch.rewardAec,
      };
    }
    case "skipTipsWeek": {
      const start = startOfWeek(now).getTime();
      const end = start + 7 * 86_400_000;
      let tipsTotal = 0;
      for (const op of operations) {
        const ts = new Date(op.createdAt).getTime();
        if (!Number.isFinite(ts) || ts < start || ts >= end) continue;
        const cat = categorise(op, myId);
        if (cat === "tips") tipsTotal += op.amount;
      }
      const won = tipsTotal === 0;
      const expired = now.getTime() >= end;
      return {
        id: ch.id,
        status: expired && won ? "won" : expired ? "lost" : won ? "active" : "lost",
        progress: won ? 1 : 0,
        hoursLeft: hoursLeftOf(end),
        detailKey: "challenge.skipTipsWeek.detail",
        detailVars: { total: tipsTotal.toFixed(2) },
        rewardAec: ch.rewardAec,
      };
    }
    case "save10Percent": {
      const start = startOfWeek(now).getTime();
      const end = start + 7 * 86_400_000;
      let inflow = 0;
      for (const op of operations) {
        const ts = new Date(op.createdAt).getTime();
        if (!Number.isFinite(ts) || ts < start || ts >= end) continue;
        const eff = effect(op, myId);
        if (eff > 0) inflow += eff;
      }
      const goals = loadGoals();
      const goalsContribThisWeek = goals.reduce((s, g) => {
        // Approximate: assume currentAec ramps linearly from createdAt → now;
        // contribution this week = total currentAec × fraction-of-age in window
        const created = new Date(g.createdAt).getTime();
        if (!Number.isFinite(created)) return s;
        const ageMs = Math.max(1, Date.now() - created);
        const overlap = Math.max(0, Math.min(end, Date.now()) - Math.max(start, created));
        return s + (g.currentAec * overlap) / ageMs;
      }, 0);
      const target = inflow * 0.1;
      const progress = target > 0 ? Math.min(1, goalsContribThisWeek / target) : 0;
      const won = progress >= 1;
      const expired = now.getTime() >= end;
      return {
        id: ch.id,
        status: expired && won ? "won" : expired ? "lost" : won ? "active" : "active",
        progress,
        hoursLeft: hoursLeftOf(end),
        detailKey: "challenge.save10Percent.detail",
        detailVars: {
          saved: goalsContribThisWeek.toFixed(2),
          target: target.toFixed(2),
        },
        rewardAec: ch.rewardAec,
      };
    }
    case "subPauseMonth": {
      const start = startOfMonth(now).getTime();
      const next = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
      let subTotal = 0;
      for (const op of operations) {
        const ts = new Date(op.createdAt).getTime();
        if (!Number.isFinite(ts) || ts < start || ts >= next) continue;
        const cat = categorise(op, myId);
        if (cat === "subscriptions") subTotal += op.amount;
      }
      const recurringActive = loadRecurring().filter((r) => r.active).length;
      const won = subTotal === 0 && recurringActive === 0;
      const expired = now.getTime() >= next;
      return {
        id: ch.id,
        status: expired && won ? "won" : expired ? "lost" : won ? "active" : "lost",
        progress: won ? 1 : 0,
        hoursLeft: hoursLeftOf(next),
        detailKey: "challenge.subPauseMonth.detail",
        detailVars: { active: recurringActive, paid: subTotal.toFixed(2) },
        rewardAec: ch.rewardAec,
      };
    }
    case "goalSprint": {
      const start = startOfWeek(now).getTime();
      const end = start + 7 * 86_400_000;
      const goals = loadGoals();
      const contribThisWeek = goals.reduce((s, g) => {
        const created = new Date(g.createdAt).getTime();
        if (!Number.isFinite(created)) return s;
        const ageMs = Math.max(1, Date.now() - created);
        const overlap = Math.max(0, Math.min(end, Date.now()) - Math.max(start, created));
        return s + (g.currentAec * overlap) / ageMs;
      }, 0);
      const target = 50;
      const progress = Math.min(1, contribThisWeek / target);
      const won = progress >= 1;
      const expired = now.getTime() >= end;
      return {
        id: ch.id,
        status: expired && won ? "won" : expired ? "lost" : won ? "active" : "active",
        progress,
        hoursLeft: hoursLeftOf(end),
        detailKey: "challenge.goalSprint.detail",
        detailVars: { saved: contribThisWeek.toFixed(2), target },
        rewardAec: ch.rewardAec,
      };
    }
  }
}

export function evaluateAll(
  operations: Operation[],
  myId: string,
  now: Date = new Date(),
): ChallengeEval[] {
  return CHALLENGES.map((ch) => evaluateChallenge(ch, operations, myId, now));
}
