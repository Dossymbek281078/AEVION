// Aggregates earnings across AEVION modules (banking, QRight, CyberChess, Planet).
// TODO backend: GET /api/ecosystem/earnings?accountId=... returning EcosystemEarningsSummary.
// For now we synthesise deterministic mock per accountId and merge real banking ops.

import { CHESS_TOURNAMENT_NAMES, PLANET_TASKS, QRIGHT_FLAT_WORKS } from "./mockCatalog";
import { pick, seeded } from "./random";
import type { Operation } from "./types";

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

function generateMock(accountId: string, ops: Operation[]): EcosystemEarningsSummary {
  const rand = seeded(accountId);
  const today = new Date();
  const days = 365;

  const daily: DailyPoint[] = [];
  const recent: EarningEvent[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
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

  for (const op of ops) {
    if (op.to === accountId) {
      const t = new Date(op.createdAt).getTime();
      if (Number.isFinite(t) && Date.now() - t < 30 * 86_400_000) {
        recent.push({
          id: `bk_${op.id}`,
          source: "banking",
          amount: op.amount,
          timestamp: op.createdAt,
          title: op.kind === "topup" ? "Wallet top-up" : "Incoming transfer",
          meta: op.from ?? undefined,
        });
      }
    }
  }

  recent.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const recentTrimmed = recent.slice(0, 20);

  const sumKey = (k: keyof DailyPoint, n: number): number => {
    if (k === "date") return 0;
    let s = 0;
    for (const p of daily.slice(-n)) s += (p[k] as number);
    return s;
  };

  const perSource: Record<EarningSource, SourceTotals> = {
    banking: { total: sumKey("banking", days), last30d: sumKey("banking", 30), last90d: sumKey("banking", 90), last365d: sumKey("banking", 365) },
    qright:  { total: sumKey("qright",  days), last30d: sumKey("qright",  30), last90d: sumKey("qright",  90), last365d: sumKey("qright",  365) },
    chess:   { total: sumKey("chess",   days), last30d: sumKey("chess",   30), last90d: sumKey("chess",   90), last365d: sumKey("chess",   365) },
    planet:  { total: sumKey("planet",  days), last30d: sumKey("planet",  30), last90d: sumKey("planet",  90), last365d: sumKey("planet",  365) },
  };

  const totalAec = perSource.banking.total + perSource.qright.total + perSource.chess.total + perSource.planet.total;

  return { totalAec, perSource, daily, recent: recentTrimmed };
}

export async function fetchEcosystemEarnings(params: {
  accountId: string;
  operations: Operation[];
}): Promise<EcosystemEarningsSummary> {
  // TODO backend: replace with real GET /api/ecosystem/earnings?accountId=...
  // Currently synthesised: banking is real (from qtrade ops), other sources are
  // seeded mock until QRight/CyberChess/Planet expose earnings endpoints.
  return generateMock(params.accountId, params.operations);
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
