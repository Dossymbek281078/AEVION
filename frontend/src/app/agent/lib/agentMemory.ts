/**
 * AEVION Agent — local memory: offline-model tracking + an eval (feedback) log.
 *
 * Honest scope (per the objectivity rule): this is NOT self-learning. Model
 * weights never change here. What this does is real and modest — it flags which
 * local/offline models appeared or disappeared since your last visit, and it
 * captures 👍/👎 on answers to a local log. That log is the SUBSTRATE a future
 * router/prompt optimiser can use; on its own it does not make the agent
 * smarter. Everything is client-side (localStorage), so it stays isolated from
 * the backend owned by other work streams.
 */

export interface LocalModelSnapshot {
  id: string;
  models: string[];
}

export interface ModelDiff {
  added: string[];
  removed: string[];
}

/** `id:model` keys present in a snapshot list. */
function modelKeys(snap: LocalModelSnapshot[]): Set<string> {
  const keys = new Set<string>();
  for (const p of snap) for (const m of p.models || []) keys.add(`${p.id}:${m}`);
  return keys;
}

/** What changed in the offline/local model roster since `prev`. */
export function diffLocalModels(prev: LocalModelSnapshot[], curr: LocalModelSnapshot[]): ModelDiff {
  const before = modelKeys(prev || []);
  const after = modelKeys(curr || []);
  const added = [...after].filter((k) => !before.has(k));
  const removed = [...before].filter((k) => !after.has(k));
  return { added, removed };
}

export type Rating = "up" | "down";

export interface FeedbackEntry {
  ts: number;
  message: string;
  mode: string;
  toolId: string | null;
  rating: Rating;
}

export interface FeedbackSummary {
  total: number;
  up: number;
  down: number;
  byTool: Record<string, { up: number; down: number }>;
}

/** Aggregate a feedback log — the read side a future optimiser would consume. */
export function summarizeFeedback(entries: FeedbackEntry[]): FeedbackSummary {
  const summary: FeedbackSummary = { total: 0, up: 0, down: 0, byTool: {} };
  for (const e of entries || []) {
    if (e.rating !== "up" && e.rating !== "down") continue;
    summary.total += 1;
    summary[e.rating] += 1;
    const key = e.toolId ?? "chat";
    const bucket = (summary.byTool[key] ??= { up: 0, down: 0 });
    bucket[e.rating] += 1;
  }
  return summary;
}

// ── localStorage wrappers (SSR-safe) ─────────────────────────────────────────
const MODELS_KEY = "aevion.agent.localModels.v1";
const FEEDBACK_KEY = "aevion.agent.feedback.v1";

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode — non-fatal */
  }
}

export function loadLastModels(): LocalModelSnapshot[] {
  return readJSON<LocalModelSnapshot[]>(MODELS_KEY, []);
}

export function saveLastModels(snap: LocalModelSnapshot[]): void {
  writeJSON(MODELS_KEY, snap);
}

export function loadFeedback(): FeedbackEntry[] {
  return readJSON<FeedbackEntry[]>(FEEDBACK_KEY, []);
}

export function appendFeedback(entry: Omit<FeedbackEntry, "ts"> & { ts?: number }): FeedbackEntry[] {
  const list = loadFeedback();
  // ts passed in by the caller (Date.now() lives in the component, not here).
  const full: FeedbackEntry = { ts: entry.ts ?? 0, ...entry, rating: entry.rating };
  const next = [...list, full].slice(-500); // cap the local log
  writeJSON(FEEDBACK_KEY, next);
  return next;
}
