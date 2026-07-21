/**
 * Provider health tracking — memory of which {provider, model} pairs have
 * been failing, so the free-fleet council can quietly de-prioritise a flaky
 * vendor instead of retrying it at the same priority every run.
 *
 * `callProviderResilient`/`streamProviderResilient` already retry a single call
 * across a provider's own model list (providers.ts, 429-resilient wrappers),
 * but that memory dies with the call. This module is the missing cross-run
 * memory: a small sliding window of recent outcomes per pair, kept in-process
 * for fast synchronous reads (matches the in-memory tally philosophy already
 * used by smartComplete's savings tally) AND durably logged to Postgres so a
 * redeploy doesn't reset every provider back to "neutral" and rediscover
 * flakiness from scratch. DB-optional, best-effort, matching smartRunLog's
 * store philosophy: no reachable database → every DB call quietly no-ops.
 *
 * A pair with no recorded outcomes is treated as healthy (score 1) so a
 * rarely-used or brand-new provider (e.g. NVIDIA NIM, just added) is never
 * penalised for lack of history — only observed failures count against it.
 * This also means reads made before hydration finishes (a few hundred ms
 * after boot, best-effort) just see the safe neutral default, never a wrong
 * "unhealthy" verdict.
 */
import { getPool } from "../../lib/dbPool";

const WINDOW = 20;

type Outcome = { ok: boolean; ms?: number };

const outcomes = new Map<string, Outcome[]>();

function key(provider: string, model: string): string {
  return `${provider}:${model}`;
}

let ensured = false;
let dbUsable: boolean | null = null;

async function ensureTable(): Promise<boolean> {
  if (ensured) return dbUsable === true;
  ensured = true;
  try {
    const pool = getPool();
    await pool.query("SELECT 1");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "provider_health_log" (
        "id"       BIGSERIAL PRIMARY KEY,
        "ts"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "provider" TEXT NOT NULL,
        "model"    TEXT NOT NULL,
        "ok"       BOOLEAN NOT NULL,
        "ms"       INTEGER
      );
    `);
    await pool.query(`ALTER TABLE "provider_health_log" ADD COLUMN IF NOT EXISTS "ms" INTEGER;`);
    await pool.query(`CREATE INDEX IF NOT EXISTS "provider_health_log_pm_ts_idx" ON "provider_health_log" ("provider", "model", "ts");`);
    dbUsable = true;
  } catch (e: any) {
    dbUsable = false;
    console.warn(`[providerHealth] DB unavailable — cross-restart persistence off: ${e?.message || e}`);
  }
  return dbUsable === true;
}

/** Fire-and-forget durable log of one outcome. Never throws; table grows
 *  unbounded over time (same trade-off smart_run_log already accepts) since
 *  hydration only ever reads the last WINDOW rows per pair regardless of
 *  total table size — pruning can be added later if storage becomes a
 *  real concern. */
function insertOutcomeDb(provider: string, model: string, ok: boolean, ms?: number): void {
  void (async () => {
    try {
      if (!(await ensureTable())) return;
      await getPool().query(`INSERT INTO "provider_health_log" ("provider","model","ok","ms") VALUES ($1,$2,$3,$4)`, [provider, model, ok, ms ?? null]);
    } catch {
      /* best-effort — drop silently */
    }
  })();
}

let hydrated = false;

/** Warm-start the in-memory map from the durable log's last WINDOW rows per
 *  pair. Runs once, kicked off (fire-and-forget) at module load; anything
 *  read before it resolves just sees the neutral default. */
const PRUNE_DAYS = 30;

async function hydrate(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  try {
    if (!(await ensureTable())) return;
    // Boot-time prune: hydration only ever reads the last WINDOW rows per
    // pair, so anything older than PRUNE_DAYS is dead weight. Best-effort,
    // before the read so a long-running deployment's backlog doesn't slow
    // the window query down forever.
    try {
      await getPool().query(`DELETE FROM "provider_health_log" WHERE "ts" < NOW() - INTERVAL '${PRUNE_DAYS} days'`);
    } catch {
      /* best-effort — skip pruning on any failure */
    }
    const result = await getPool().query(`
      SELECT provider, model, ok, ms FROM (
        SELECT provider, model, ok, ms, ts,
               ROW_NUMBER() OVER (PARTITION BY provider, model ORDER BY ts DESC) AS rn
        FROM "provider_health_log"
      ) ranked
      WHERE rn <= ${WINDOW}
      ORDER BY provider, model, ts ASC
    `);
    for (const row of result.rows as { provider: string; model: string; ok: boolean; ms: number | null }[]) {
      const k = key(row.provider, row.model);
      const list = outcomes.get(k) ?? [];
      list.push({ ok: row.ok, ms: row.ms ?? undefined });
      outcomes.set(k, list);
    }
  } catch {
    /* best-effort — leave the map empty (neutral) on any failure */
  }
}

void hydrate();

/** Record one call's outcome. Call this from the resilient wrappers on every
 *  terminal result (success, or an error that won't be retried further).
 *  `ms` is the full request duration; only pass it for non-streaming calls
 *  (a stream's duration scales with answer length, not model speed) so the
 *  latency samples stay one comparable metric. */
export function recordOutcome(provider: string, model: string, ok: boolean, ms?: number): void {
  const k = key(provider, model);
  const list = outcomes.get(k) ?? [];
  list.push({ ok, ms });
  if (list.length > WINDOW) list.shift();
  outcomes.set(k, list);
  insertOutcomeDb(provider, model, ok, ms);
}

/** Recent success rate for a pair, or 1 (neutral/healthy) when there's no
 *  recorded history yet. */
export function healthScore(provider: string, model: string): number {
  const list = outcomes.get(key(provider, model));
  if (!list || list.length === 0) return 1;
  const ok = list.filter((o) => o.ok).length;
  return ok / list.length;
}

/** Median full-request latency over this pair's recent successful
 *  non-streaming calls, or null when fewer than `minSamples` are recorded.
 *  Only successes count — a failed call's duration measures the retry/timeout
 *  path, not the model. */
export function latencySummary(
  provider: string,
  model: string,
  minSamples = 3
): { p50Ms: number | null; samples: number } {
  const list = outcomes.get(key(provider, model)) ?? [];
  const ms = list.filter((o) => o.ok && typeof o.ms === "number").map((o) => o.ms as number);
  if (ms.length < minSamples) return { p50Ms: null, samples: ms.length };
  const sorted = [...ms].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const p50 = sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  return { p50Ms: p50, samples: ms.length };
}

/** Provider-level median latency across every model tracked for one provider
 *  (pooled successful timed samples), or null under `minSamples` — the
 *  per-provider companion to latencySummary() for surfaces that only ask
 *  per-provider (e.g. /providers/health). */
export function providerLatencySummary(
  provider: string,
  minSamples = 3
): { p50Ms: number | null; samples: number } {
  const prefix = `${provider}:`;
  const ms: number[] = [];
  for (const [k, list] of outcomes) {
    if (!k.startsWith(prefix)) continue;
    for (const o of list) if (o.ok && typeof o.ms === "number") ms.push(o.ms);
  }
  if (ms.length < minSamples) return { p50Ms: null, samples: ms.length };
  const sorted = [...ms].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const p50 = sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  return { p50Ms: p50, samples: ms.length };
}

/** Reset all tracked outcomes (tests only). */
export function resetProviderHealth(): void {
  outcomes.clear();
}

/** Aggregate score across every model tracked for one provider this session
 *  (mean of each model's recent success rate) — for surfacing on a provider
 *  list where the API only asks per-provider, not per-model. 1/0 samples when
 *  nothing has been recorded yet (still neutral/healthy, per healthScore()). */
export function providerHealthSummary(provider: string): { score: number; samples: number } {
  let sum = 0;
  let modelsTracked = 0;
  let samples = 0;
  const prefix = `${provider}:`;
  for (const [key, list] of outcomes) {
    if (!key.startsWith(prefix)) continue;
    const ok = list.filter((o) => o.ok).length;
    sum += ok / list.length;
    modelsTracked += 1;
    samples += list.length;
  }
  return { score: modelsTracked > 0 ? sum / modelsTracked : 1, samples };
}
