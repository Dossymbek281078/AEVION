// Aggregates earnings across AEVION modules (banking, QRight, CyberChess, Planet).
//
// Backend status: GET /api/ecosystem/earnings returns real `daily`/`recent`
// for qright/chess/planet (hasRealData flags whether any real events exist)
// — see aevion-globus-backend/src/routes/ecosystem.ts. Banking is always
// real, computed here from the caller's own qtrade operations (never came
// from a mock). fetchEcosystemEarnings merges the two; when the backend has
// no real qright/chess/planet events yet it falls back to the full
// deterministic demo generator instead of a real-banking/fake-rest blend, so
// the widget never mixes one real source with three fabricated ones.

import { CHESS_TOURNAMENT_NAMES, PLANET_TASKS, QRIGHT_FLAT_WORKS } from "./mockCatalog";
import { pick, seeded } from "./random";
import type { Operation } from "./types";
import { apiUrl } from "@/lib/apiBase";

export type EarningSource = "banking" | "qright" | "chess" | "planet";

export type EarningEvent = {
  id: string;
  source: EarningSource;
  amount: number;
  timestamp: string;
  title: string;
  meta?: string;
};

export type SourceTotals = {
  total: number;
  last30d: number;
  last90d: number;
  last365d: number;
};

export type DailyPoint = {
  date: string;
  banking: number;
  qright: number;
  chess: number;
  planet: number;
};

export type EcosystemEarningsSummary = {
  totalAec: number;
  perSource: Record<EarningSource, SourceTotals>;
  daily: DailyPoint[];
  recent: EarningEvent[];
  /** True when qright/chess/planet came from real ledgers, not the demo generator. Banking is always real. */
  isLive: boolean;
};

export const SOURCE_COLOR: Record<EarningSource, string> = {
  banking: "#0f766e",
  qright: "#7c3aed",
  chess: "#d97706",
  planet: "#059669",
};

export const SOURCE_LABEL: Record<EarningSource, string> = {
  banking: "Banking",
  qright: "QRight royalties",
  chess: "Chess winnings",
  planet: "Planet bonuses",
};

export const SOURCE_DESCRIPTION: Record<EarningSource, string> = {
  banking: "Incoming transfers and top-ups",
  qright: "Royalties from IP verifications",
  chess: "Tournament prizes from CyberChess",
  planet: "Progress bonuses from Planet Engine",
};

// i18n keys parallel to SOURCE_LABEL / SOURCE_DESCRIPTION.
// UI components should use these with the global `t()` helper; the raw English
// maps above remain for snapshot/export logic that wants stable, locale-free strings.
export const SOURCE_LABEL_KEY: Record<EarningSource, string> = {
  banking: "ecosystem.source.banking.label",
  qright: "ecosystem.source.qright.label",
  chess: "ecosystem.source.chess.label",
  planet: "ecosystem.source.planet.label",
};

export const SOURCE_DESCRIPTION_KEY: Record<EarningSource, string> = {
  banking: "ecosystem.source.banking.description",
  qright: "ecosystem.source.qright.description",
  chess: "ecosystem.source.chess.description",
  planet: "ecosystem.source.planet.description",
};

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function bankingOnDate(ops: Operation[], accountId: string, dateStr: string): number {
  let s = 0;
  for (const op of ops) {
    if (!op.createdAt.startsWith(dateStr)) continue;
    if (op.to === accountId) s += op.amount;
  }
  return s;
}

// Real banking events, shared by both the mock path and the real-data path —
// banking is always real (qtrade operations), never fabricated.
function bankingRecent(ops: Operation[], accountId: string): EarningEvent[] {
  const out: EarningEvent[] = [];
  for (const op of ops) {
    if (op.to !== accountId) continue;
    const t = new Date(op.createdAt).getTime();
    if (!Number.isFinite(t) || Date.now() - t >= 30 * 86_400_000) continue;
    out.push({
      id: `bk_${op.id}`,
      source: "banking",
      amount: op.amount,
      timestamp: op.createdAt,
      title: op.kind === "topup" ? "Wallet top-up" : "Incoming transfer",
      meta: op.from ?? undefined,
    });
  }
  return out;
}

// Shared by both the demo generator and the real-data path: derives
// perSource / totalAec purely from a completed `daily` series, so real and
// mock data are aggregated identically.
function aggregateFromDaily(daily: DailyPoint[]): { totalAec: number; perSource: Record<EarningSource, SourceTotals> } {
  const sumKey = (k: EarningSource, n: number): number => {
    let s = 0;
    for (const p of daily.slice(-n)) s += p[k];
    return s;
  };
  const days = daily.length;
  const perSource = Object.fromEntries(
    (["banking", "qright", "chess", "planet"] as EarningSource[]).map((src) => [
      src,
      { total: sumKey(src, days), last30d: sumKey(src, 30), last90d: sumKey(src, 90), last365d: sumKey(src, 365) },
    ]),
  ) as Record<EarningSource, SourceTotals>;
  const totalAec = perSource.banking.total + perSource.qright.total + perSource.chess.total + perSource.planet.total;
  return { totalAec, perSource };
}

function generateMock(accountId: string, ops: Operation[]): EcosystemEarningsSummary {
  const rand = seeded(accountId);
  // UTC-midnight anchor, not local midnight — bankingOnDate compares against
  // real op.createdAt (ISO UTC), so a local-timezone anchor would misfile
  // real banking ops by a day on any non-UTC server/browser.
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const days = 365;

  const daily: DailyPoint[] = [];
  const recent: EarningEvent[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86_400_000);
    const ds = dateKey(d);

    let qright = 0;
    const qrightCount = rand() < 0.55 ? Math.floor(rand() * 4) + 1 : 0;
    for (let k = 0; k < qrightCount; k++) {
      const amt = +(rand() * 2.4 + 0.1).toFixed(2);
      qright += amt;
      if (i < 30) {
        recent.push({
          id: `qr_${ds}_${k}`,
          source: "qright",
          amount: amt,
          timestamp: new Date(d.getTime() + rand() * 86_400_000).toISOString(),
          title: pick(QRIGHT_FLAT_WORKS, rand),
          meta: "1 verification",
        });
      }
    }

    let chess = 0;
    if (rand() < 0.08) {
      const amt = +(50 + rand() * 450).toFixed(0);
      chess = amt;
      if (i < 30) {
        recent.push({
          id: `ch_${ds}`,
          source: "chess",
          amount: amt,
          timestamp: new Date(d.getTime() + rand() * 86_400_000).toISOString(),
          title: pick(CHESS_TOURNAMENT_NAMES, rand),
          meta: `Place ${Math.floor(rand() * 3) + 1}`,
        });
      }
    }

    let planet = 0;
    if (i % 7 === 3) {
      const amt = +(10 + rand() * 15).toFixed(2);
      planet = amt;
      if (i < 30) {
        recent.push({
          id: `pl_${ds}`,
          source: "planet",
          amount: amt,
          timestamp: new Date(d.getTime() + rand() * 86_400_000).toISOString(),
          title: pick(PLANET_TASKS, rand),
        });
      }
    }

    const banking = bankingOnDate(ops, accountId, ds);

    daily.push({ date: ds, banking, qright, chess, planet });
  }

  recent.push(...bankingRecent(ops, accountId));
  recent.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const recentTrimmed = recent.slice(0, 20);

  return { ...aggregateFromDaily(daily), daily, recent: recentTrimmed, isLive: false };
}

const TOKEN_KEY = "aevion_auth_token_v1";

function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const t = localStorage.getItem(TOKEN_KEY);
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

type RealEarningsResponse = {
  hasRealData: boolean;
  daily: { date: string; qright: number; chess: number; planet: number }[];
  recent: { id: string; source: "qright" | "chess" | "planet"; amount: number; timestamp: string; title: string; meta?: string }[];
};

async function fetchRealEarnings(): Promise<RealEarningsResponse | null> {
  const headers = authHeaders();
  if (!headers.Authorization) return null;
  try {
    const r = await fetch(apiUrl("/api/ecosystem/earnings"), { headers, cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as RealEarningsResponse;
  } catch {
    return null;
  }
}

export async function fetchEcosystemEarnings(params: {
  accountId: string;
  operations: Operation[];
}): Promise<EcosystemEarningsSummary> {
  const { accountId, operations: ops } = params;
  const real = await fetchRealEarnings();
  if (real && real.hasRealData) {
    // Real qright/chess/planet daily buckets from the backend, banking daily
    // computed here from the caller's own qtrade operations (always real,
    // same source the demo path uses).
    const daily: DailyPoint[] = real.daily.map((d) => ({
      date: d.date,
      banking: bankingOnDate(ops, accountId, d.date),
      qright: d.qright,
      chess: d.chess,
      planet: d.planet,
    }));
    const recent = [...real.recent, ...bankingRecent(ops, accountId)]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 20);
    return { ...aggregateFromDaily(daily), daily, recent, isLive: true };
  }
  return generateMock(accountId, ops);
}

export function periodTotals(
  daily: DailyPoint[],
  days: number,
): { banking: number; qright: number; chess: number; planet: number; total: number } {
  const slice = daily.slice(-days);
  let banking = 0;
  let qright = 0;
  let chess = 0;
  let planet = 0;
  for (const p of slice) {
    banking += p.banking;
    qright += p.qright;
    chess += p.chess;
    planet += p.planet;
  }
  return { banking, qright, chess, planet, total: banking + qright + chess + planet };
}
