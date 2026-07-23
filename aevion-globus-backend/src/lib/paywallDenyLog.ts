/**
 * Paywall deny funnel — records every 402 upgrade_required the module gate
 * emits, so the platform can see DEMAND for paid modules instead of dropping
 * that signal on the floor. Each deny is an anonymous data point: which
 * module, which plan tier hit the wall, when. No user ids by design — the
 * funnel is aggregate-only, same posture as /smart/savings and /qcoreai/opex.
 *
 * DB-optional, best-effort, fire-and-forget — matches providerHealth /
 * smartRunLog store philosophy: no reachable database → writes no-op and
 * reads fall back to the in-process session counters.
 */
import { getPool } from "./dbPool";

const PRUNE_DAYS = 90;

let ensured = false;
let dbUsable: boolean | null = null;

// In-process fallback tally (also the fast path for "since boot" numbers).
const memCounts = new Map<string, number>();

function memKey(module: string, plan: string): string {
  return `${module}:${plan}`;
}

async function ensureTable(): Promise<boolean> {
  if (ensured) return dbUsable === true;
  ensured = true;
  try {
    const pool = getPool();
    await pool.query("SELECT 1");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "paywall_deny_log" (
        "id"     BIGSERIAL PRIMARY KEY,
        "ts"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "module" TEXT NOT NULL,
        "plan"   TEXT NOT NULL
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS "paywall_deny_log_module_ts_idx" ON "paywall_deny_log" ("module", "ts");`);
    // Boot-time prune — the funnel is a rolling-window signal, not an archive.
    try {
      await pool.query(`DELETE FROM "paywall_deny_log" WHERE "ts" < NOW() - INTERVAL '${PRUNE_DAYS} days'`);
    } catch {
      /* best-effort */
    }
    dbUsable = true;
  } catch (e: any) {
    dbUsable = false;
    console.warn(`[paywallDenyLog] DB unavailable — deny funnel persistence off: ${e?.message || e}`);
  }
  return dbUsable === true;
}

/** Record one 402. Never throws, never blocks the response path. */
export function recordDeny(module: string, plan: string): void {
  const k = memKey(module, plan);
  memCounts.set(k, (memCounts.get(k) ?? 0) + 1);
  void (async () => {
    try {
      if (!(await ensureTable())) return;
      await getPool().query(`INSERT INTO "paywall_deny_log" ("module","plan") VALUES ($1,$2)`, [module, plan]);
    } catch {
      /* best-effort — drop silently */
    }
  })();
}

export type FunnelRow = { module: string; denies: number; last24h: number; byPlan: Record<string, number> };
export type FunnelSummary = {
  totalDenies: number;
  last24h: number;
  byModule: FunnelRow[];
  windowDays: number;
  source: "db" | "memory";
};

/** Aggregate deny funnel over the last `days` days (clamped 1–90). */
export async function funnelSummary(days = 30): Promise<FunnelSummary> {
  const n = Math.max(1, Math.min(PRUNE_DAYS, Math.floor(days)));
  if (await ensureTable()) {
    try {
      const result = await getPool().query(
        `SELECT "module", "plan",
                COUNT(*)::int AS denies,
                COUNT(*) FILTER (WHERE "ts" >= NOW() - INTERVAL '24 hours')::int AS last24h
           FROM "paywall_deny_log"
          WHERE "ts" >= NOW() - ($1::int * INTERVAL '1 day')
          GROUP BY "module", "plan"`,
        [n]
      );
      const byModuleMap = new Map<string, FunnelRow>();
      let totalDenies = 0;
      let last24h = 0;
      for (const r of result.rows as { module: string; plan: string; denies: number; last24h: number }[]) {
        const row = byModuleMap.get(r.module) ?? { module: r.module, denies: 0, last24h: 0, byPlan: {} };
        row.denies += r.denies;
        row.last24h += r.last24h;
        row.byPlan[r.plan] = (row.byPlan[r.plan] ?? 0) + r.denies;
        byModuleMap.set(r.module, row);
        totalDenies += r.denies;
        last24h += r.last24h;
      }
      return {
        totalDenies,
        last24h,
        byModule: Array.from(byModuleMap.values()).sort((a, b) => b.denies - a.denies),
        windowDays: n,
        source: "db",
      };
    } catch {
      /* fall through to memory */
    }
  }
  // Memory fallback — counts since process boot, no time windows.
  const byModuleMap = new Map<string, FunnelRow>();
  let totalDenies = 0;
  for (const [k, count] of memCounts) {
    const idx = k.lastIndexOf(":");
    const module = k.slice(0, idx);
    const plan = k.slice(idx + 1);
    const row = byModuleMap.get(module) ?? { module, denies: 0, last24h: 0, byPlan: {} };
    row.denies += count;
    row.byPlan[plan] = (row.byPlan[plan] ?? 0) + count;
    byModuleMap.set(module, row);
    totalDenies += count;
  }
  return {
    totalDenies,
    last24h: 0,
    byModule: Array.from(byModuleMap.values()).sort((a, b) => b.denies - a.denies),
    windowDays: n,
    source: "memory",
  };
}

/** Reset in-memory tallies (tests only). */
export function resetPaywallDenyLog(): void {
  memCounts.clear();
}
