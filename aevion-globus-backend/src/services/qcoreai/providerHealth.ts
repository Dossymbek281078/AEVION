/**
 * Provider health tracking — session-level memory of which {provider, model}
 * pairs have been failing, so the free-fleet council can quietly de-prioritise
 * a flaky vendor instead of retrying it at the same priority every run.
 *
 * `callProviderResilient`/`streamProviderResilient` already retry a single call
 * across a provider's own model list (providers.ts, 429-resilient wrappers),
 * but that memory dies with the call. This module is the missing cross-run
 * memory: a small sliding window of recent outcomes per pair, decayed by
 * recency, cheap enough to keep fully in-process (matches the in-memory tally
 * philosophy already used by smartComplete's savings tally).
 *
 * A pair with no recorded outcomes is treated as healthy (score 1) so a
 * rarely-used or brand-new provider (e.g. NVIDIA NIM, just added) is never
 * penalised for lack of history — only observed failures count against it.
 */

const WINDOW = 20;

type Outcome = { ok: boolean };

const outcomes = new Map<string, Outcome[]>();

function key(provider: string, model: string): string {
  return `${provider}:${model}`;
}

/** Record one call's outcome. Call this from the resilient wrappers on every
 *  terminal result (success, or an error that won't be retried further). */
export function recordOutcome(provider: string, model: string, ok: boolean): void {
  const k = key(provider, model);
  const list = outcomes.get(k) ?? [];
  list.push({ ok });
  if (list.length > WINDOW) list.shift();
  outcomes.set(k, list);
}

/** Recent success rate for a pair, or 1 (neutral/healthy) when there's no
 *  recorded history yet. */
export function healthScore(provider: string, model: string): number {
  const list = outcomes.get(key(provider, model));
  if (!list || list.length === 0) return 1;
  const ok = list.filter((o) => o.ok).length;
  return ok / list.length;
}

/** Reset all tracked outcomes (tests only). */
export function resetProviderHealth(): void {
  outcomes.clear();
}
