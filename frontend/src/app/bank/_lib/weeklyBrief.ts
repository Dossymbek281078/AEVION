// Weekly Brief — pure derivation from operations + ecosystem summary.
// Snapshots are stored locally so the Bank can show "view past briefs"
// without a backend digest service.

import { detectAnomalies } from "./anomaly";
import { type EarningSource } from "./ecosystem";
import { categorise, type SpendCategory } from "./spending";
import type { Operation } from "./types";
import { loadGoals } from "./savings";

const STORAGE_KEY = "aevion_bank_brief_archive_v1";
const MAX_ARCHIVE = 26; // ~6 months of weekly briefs

export type BriefMood = "strong" | "steady" | "cautious" | "quiet";

export type Brief = {
  weekIso: string;
  startISO: string;
  endISO: string;
  inflowTotal: number;
  outflowTotal: number;
  netFlow: number;
  prevNetFlow: number;
  topEarningSource: { src: EarningSource; amount: number } | null;
  topSpendCategory: { cat: SpendCategory; amount: number } | null;
  anomalies: number;
  opCount: number;
  topGoal: { label: string; pct: number; deltaPct: number } | null;
  mood: BriefMood;
  generatedAt: string;
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// ISO 8601 week — returns "YYYY-Www".
export function isoWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

// Returns [start, end] for the ISO week containing `d` (Monday → Sunday inclusive)
export function weekBounds(d: Date): { start: Date; end: Date } {
  const x = startOfDay(d);
  const dow = x.getDay() || 7; // 1..7 (Mon..Sun)
  const start = new Date(x);
  start.setDate(x.getDate() - (dow - 1));
  const end = new Date(start);
  end.setDate(start.getDate() + 7); // exclusive end
  return { start, end };
}

function effect(op: Operation, myId: string): number {
  if (op.kind === "topup") return op.amount;
  if (op.from === myId) return -op.amount;
  if (op.to === myId) return op.amount;
  return 0;
}

function classifySource(op: Operation, myId: string): EarningSource {
  // Only reliable signal we have: topup vs incoming transfer.
  // For the brief we treat topups as "banking"; cross-module income
  // (qright/chess/planet) lives in mock ecosystem.daily and is summed
  // separately. This function just covers banking inflows.
  if (op.kind === "topup") return "banking";
  if (op.to === myId) return "banking";
  return "banking";
}

export function generateBrief({
  accountId,
  operations,
  daily,
  asOf = new Date(),
}: {
  accountId: string;
  operations: Operation[];
  daily: { date: string; banking: number; qright: number; chess: number; planet: number }[];
  asOf?: Date;
}): Brief {
  const thisWeek = weekBounds(asOf);
  const prevWeek = {
    start: new Date(thisWeek.start.getTime() - 7 * 86_400_000),
    end: thisWeek.start,
  };

  let inflow = 0;
  let outflow = 0;
  let opCount = 0;
  const inflowBySource: Record<EarningSource, number> = {
    banking: 0,
    qright: 0,
    chess: 0,
    planet: 0,
  };
  const outflowByCat: Record<SpendCategory, number> = {
    subscriptions: 0,
    tips: 0,
    contacts: 0,
    untagged: 0,
  };

  for (const op of operations) {
    const ts = new Date(op.createdAt).getTime();
    if (!Number.isFinite(ts)) continue;
    const inThis = ts >= thisWeek.start.getTime() && ts < thisWeek.end.getTime();
    if (!inThis) continue;
    const eff = effect(op, accountId);
    if (eff > 0) {
      inflow += eff;
      inflowBySource[classifySource(op, accountId)] += eff;
    } else if (eff < 0) {
      outflow += -eff;
      const cat = categorise(op, accountId);
      if (cat) outflowByCat[cat] += -eff;
    }
    opCount++;
  }

  // Add ecosystem-side income (qright / chess / planet) for days inside this week
  for (const d of daily) {
    const dt = new Date(d.date).getTime();
    if (!Number.isFinite(dt)) continue;
    if (dt >= thisWeek.start.getTime() && dt < thisWeek.end.getTime()) {
      inflowBySource.qright += d.qright;
      inflowBySource.chess += d.chess;
      inflowBySource.planet += d.planet;
      inflow += d.qright + d.chess + d.planet;
    }
  }

  // Previous week net (banking ops only — we don't replay ecosystem mock against past windows)
  let prevIn = 0;
  let prevOut = 0;
  for (const op of operations) {
    const ts = new Date(op.createdAt).getTime();
    if (!Number.isFinite(ts)) continue;
    if (ts >= prevWeek.start.getTime() && ts < prevWeek.end.getTime()) {
      const eff = effect(op, accountId);
      if (eff > 0) prevIn += eff;
      else if (eff < 0) prevOut += -eff;
    }
  }
  for (const d of daily) {
    const dt = new Date(d.date).getTime();
    if (!Number.isFinite(dt)) continue;
    if (dt >= prevWeek.start.getTime() && dt < prevWeek.end.getTime()) {
      prevIn += d.qright + d.chess + d.planet;
    }
  }

  const netFlow = inflow - outflow;
  const prevNetFlow = prevIn - prevOut;

  // Top earning source
  const sources = Object.keys(inflowBySource) as EarningSource[];
  let topSrc: EarningSource | null = null;
  let topSrcAmt = 0;
  for (const s of sources) {
    if (inflowBySource[s] > topSrcAmt) {
      topSrcAmt = inflowBySource[s];
      topSrc = s;
    }
  }

  // Top spending category
  const cats = Object.keys(outflowByCat) as SpendCategory[];
  let topCat: SpendCategory | null = null;
  let topCatAmt = 0;
  for (const c of cats) {
    if (outflowByCat[c] > topCatAmt) {
      topCatAmt = outflowByCat[c];
      topCat = c;
    }
  }

  // Anomalies — only those whose op fell in this week
  let anomalies = 0;
  for (const op of operations) {
    const ts = new Date(op.createdAt).getTime();
    if (!Number.isFinite(ts)) continue;
    if (ts < thisWeek.start.getTime() || ts >= thisWeek.end.getTime()) continue;
    if (detectAnomalies(op, operations, accountId).length > 0) anomalies++;
  }

  // Top goal (highest pct gained this week — approximated by current pct if completed in window)
  const goals = loadGoals();
  let topGoal: Brief["topGoal"] = null;
  for (const g of goals) {
    const pct = g.targetAec > 0 ? Math.min(100, (g.currentAec / g.targetAec) * 100) : 0;
    const completedThisWeek =
      g.completedAt &&
      new Date(g.completedAt).getTime() >= thisWeek.start.getTime() &&
      new Date(g.completedAt).getTime() < thisWeek.end.getTime();
    const candidate = {
      label: g.label,
      pct: Math.round(pct),
      deltaPct: completedThisWeek ? Math.round(pct) : 0,
    };
    if (!topGoal || candidate.deltaPct > topGoal.deltaPct || (topGoal.deltaPct === 0 && candidate.pct > topGoal.pct)) {
      topGoal = candidate;
    }
  }

  let mood: BriefMood = "quiet";
  if (opCount === 0) mood = "quiet";
  else if (netFlow > Math.max(50, prevNetFlow + 25)) mood = "strong";
  else if (netFlow >= 0) mood = "steady";
  else mood = "cautious";

  return {
    weekIso: isoWeek(thisWeek.start),
    startISO: thisWeek.start.toISOString().slice(0, 10),
    endISO: new Date(thisWeek.end.getTime() - 1).toISOString().slice(0, 10),
    inflowTotal: inflow,
    outflowTotal: outflow,
    netFlow,
    prevNetFlow,
    topEarningSource: topSrc ? { src: topSrc, amount: topSrcAmt } : null,
    topSpendCategory: topCat ? { cat: topCat, amount: topCatAmt } : null,
    anomalies,
    opCount,
    topGoal,
    mood,
    generatedAt: new Date().toISOString(),
  };
}

export function loadArchive(): Brief[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (b): b is Brief =>
        b && typeof b === "object" && typeof b.weekIso === "string" && typeof b.netFlow === "number",
    );
  } catch {
    return [];
  }
}

export function persistBrief(brief: Brief): Brief[] {
  if (typeof window === "undefined") return [];
  const existing = loadArchive();
  const merged = [brief, ...existing.filter((b) => b.weekIso !== brief.weekIso)].slice(0, MAX_ARCHIVE);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // storage full — silent
  }
  return merged;
}
