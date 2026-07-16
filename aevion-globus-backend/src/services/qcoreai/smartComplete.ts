/**
 * smartComplete — the platform "smart call" layer.
 *
 * Every AEVION module that needs an LLM answer can call this instead of hitting a
 * provider directly. It runs the QCoreAI auto-router (cheap one-token classifier
 * → single flagship for FACT, weight-graded Council for OPEN) and returns the
 * answer plus a `routing` record (what it decided, how deep, what it cost). A
 * process-level tally aggregates the savings across ALL modules, so the platform
 * can show one "AI spent rationally" number instead of each module guessing.
 *
 * This is a thin, non-streaming wrapper over `runMultiAgent({strategy:"auto"})`:
 * it reuses 100% of the routing logic (classifier, depth grader, council, cost
 * accounting) — no duplicated decisions. Offline-safe: with QCOREAI_STUB=1 or
 * localOnly it runs with no network, same as the streaming path.
 */
import {
  runMultiAgent,
  type OrchestratorInput,
} from "./orchestrator";

export type SmartRouting = {
  /** Query type the classifier saw. */
  classification: "open" | "fact";
  /** Strategy the router dispatched to. */
  resolved: "single" | "council";
  /** council only: 1 MoA layer ("light") vs 2 ("deep"). Absent on single. */
  depth?: "light" | "deep";
  /** council only: resolved MoA layer count (1–3). */
  layers?: number;
  /** The classifier's provider/model, for the audit trail. */
  classifier?: { provider: string; model: string };
  /** Human-readable reason for the routing decision. */
  note?: string;
  /** This run's measured cost (USD) — from the orchestrator's own accounting. */
  costUsd: number;
  /** Wall-clock duration (ms). */
  durationMs: number;
};

export type SmartResult = {
  answer: string;
  routing: SmartRouting;
};

/** Anything runMultiAgent accepts except `strategy` — that is forced to "auto". */
export type SmartCompleteInput = Omit<OrchestratorInput, "strategy">;

/** Hard wall-clock ceiling so a wedged provider can never hang a JSON request
 *  forever. Deep council runs legitimately take ~60–90s; 120s leaves headroom. */
const DEFAULT_TIMEOUT_MS = 120_000;
const TIMEOUT = Symbol("smartComplete.timeout");

/* ── Cross-module savings tally (process-level, in-memory) ─────────────────── */

// Deep-L2 council baseline cost — the same estimate the frontend counter and the
// eval harness use as "what always running the full Council would have cost".
export const EST_COUNCIL_COST_USD = 0.077;

export type SmartTally = {
  runs: number;
  facts: number; // fact → single flagship
  light: number; // open → light 1-layer council
  deep: number; // open → deep 2-layer council
  totalCostUsd: number;
  estAlwaysCouncilUsd: number; // what always-Council would have cost
  savedUsd: number; // Σ max(0, estCouncil − actual) per run
};

const tally: SmartTally = {
  runs: 0,
  facts: 0,
  light: 0,
  deep: 0,
  totalCostUsd: 0,
  estAlwaysCouncilUsd: 0,
  savedUsd: 0,
};

/** Fold one routed run into the shared tally. Exported for tests. */
export function recordSmartRun(r: SmartRouting): void {
  tally.runs += 1;
  tally.totalCostUsd += r.costUsd;
  tally.estAlwaysCouncilUsd += EST_COUNCIL_COST_USD;
  tally.savedUsd += Math.max(0, EST_COUNCIL_COST_USD - r.costUsd);
  if (r.resolved === "single") tally.facts += 1;
  else if (r.depth === "deep") tally.deep += 1;
  else tally.light += 1;
}

/** Snapshot the cross-module savings, with a derived saved-percentage. */
export function smartSavingsSnapshot(): SmartTally & { savedPct: number } {
  const savedPct =
    tally.estAlwaysCouncilUsd > 0
      ? (100 * tally.savedUsd) / tally.estAlwaysCouncilUsd
      : 0;
  return { ...tally, savedPct };
}

/** Reset the tally (tests only). */
export function resetSmartTally(): void {
  Object.assign(tally, {
    runs: 0,
    facts: 0,
    light: 0,
    deep: 0,
    totalCostUsd: 0,
    estAlwaysCouncilUsd: 0,
    savedUsd: 0,
  });
}

/* ── The call ─────────────────────────────────────────────────────────────── */

/**
 * Route a single prompt through the auto-router and return the answer + routing.
 * Records the run in the shared savings tally. Throws if the run produced no
 * answer (e.g. no provider configured), mirroring the streaming error path.
 */
export async function smartComplete(
  input: SmartCompleteInput,
  opts?: { timeoutMs?: number }
): Promise<SmartResult> {
  const t0 = Date.now();
  const timeoutMs = opts?.timeoutMs && opts.timeoutMs > 0 ? opts.timeoutMs : DEFAULT_TIMEOUT_MS;
  let answer = "";
  let classification: "open" | "fact" = "open";
  let resolved: "single" | "council" = "council";
  let depth: "light" | "deep" | undefined;
  let layers: number | undefined;
  let classifier: { provider: string; model: string } | undefined;
  let note: string | undefined;
  let costUsd = 0;
  let durationMs = 0;
  let errorMsg: string | null = null;
  let timedOut = false;

  // Drive the generator manually so we can race each step against the deadline:
  // a hung provider (no `done` ever) must not wedge the request indefinitely.
  const gen = runMultiAgent({ ...input, strategy: "auto" });
  try {
    while (true) {
      const remaining = timeoutMs - (Date.now() - t0);
      if (remaining <= 0) { timedOut = true; break; }
      let timer: ReturnType<typeof setTimeout>;
      const step = await Promise.race([
        gen.next(),
        new Promise<typeof TIMEOUT>((resolve) => { timer = setTimeout(() => resolve(TIMEOUT), remaining); }),
      ]);
      clearTimeout(timer!);
      if (step === TIMEOUT) { timedOut = true; break; }
      if (step.done) break;
      const evt = step.value;
      switch (evt.type) {
        case "route":
          classification = evt.classification;
          resolved = evt.resolved;
          depth = evt.depth;
          layers = evt.layers;
          classifier = evt.classifier;
          note = evt.note;
          break;
        case "final":
          answer = evt.content || answer;
          break;
        case "done":
          costUsd = evt.totalCostUsd;
          durationMs = evt.totalDurationMs;
          break;
        case "error":
          // Keep the last error; only fatal if no answer ever arrives.
          errorMsg = evt.message;
          break;
        default:
          break;
      }
    }
  } finally {
    // Release the generator (aborts in-flight agent work on timeout).
    if (timedOut) { try { await gen.return(undefined as never); } catch { /* noop */ } }
  }

  if (!answer) {
    throw new Error(
      timedOut ? `smartComplete timed out after ${timeoutMs}ms` : errorMsg || "smartComplete produced no answer"
    );
  }

  const routing: SmartRouting = {
    classification,
    resolved,
    depth,
    layers,
    classifier,
    note,
    costUsd,
    durationMs: durationMs || Date.now() - t0,
  };
  recordSmartRun(routing);
  return { answer, routing };
}
