/**
 * QCoreAI eval harness — runs a suite of test cases through the orchestrator
 * and judges each output. Score = passedCases / totalCases (weighted).
 *
 * Concurrency: bounded parallel pool (default 3) — each case is one full
 * orchestrator pipeline, so we trade wall-clock time vs LLM rate limits.
 *
 * No streaming to client — eval runs are async fire-and-forget; consumers
 * poll GET /eval/runs/:id for progress + final score.
 */

import { runMultiAgent, type OrchestratorInput } from "./orchestrator";
import {
  type EvalCase,
  type EvalCaseResult,
  type EvalJudge,
  type EvalSuiteRow,
  updateEvalRun,
  getEvalRun,
} from "./store";

export type RunEvalSuiteOpts = {
  runId: string;
  suite: EvalSuiteRow;
  concurrency?: number;
  perCaseMaxCostUsd?: number;
};

function judgeCase(judge: EvalJudge, output: string): { passed: boolean; reason: string } {
  if (judge.type === "contains") {
    const hay = judge.caseSensitive ? output : output.toLowerCase();
    const ndl = judge.caseSensitive ? judge.needle : judge.needle.toLowerCase();
    const hit = hay.includes(ndl);
    return { passed: hit, reason: hit ? `contains "${judge.needle}"` : `missing "${judge.needle}"` };
  }
  if (judge.type === "not_contains") {
    const hay = judge.caseSensitive ? output : output.toLowerCase();
    const ndl = judge.caseSensitive ? judge.needle : judge.needle.toLowerCase();
    const hit = hay.includes(ndl);
    return { passed: !hit, reason: hit ? `contains forbidden "${judge.needle}"` : `does not contain "${judge.needle}"` };
  }
  if (judge.type === "equals") {
    let a = output;
    let b = judge.expected;
    if (judge.trim !== false) {
      a = a.trim();
      b = b.trim();
    }
    if (!judge.caseSensitive) {
      a = a.toLowerCase();
      b = b.toLowerCase();
    }
    return { passed: a === b, reason: a === b ? "exact match" : "differs from expected" };
  }
  if (judge.type === "regex") {
    try {
      const re = new RegExp(judge.pattern, judge.flags || "");
      const hit = re.test(output);
      return { passed: hit, reason: hit ? `matched /${judge.pattern}/${judge.flags || ""}` : `no regex match` };
    } catch (e: any) {
      return { passed: false, reason: `regex error: ${e?.message || "invalid pattern"}` };
    }
  }
  if (judge.type === "min_length") {
    const ok = output.length >= judge.chars;
    return { passed: ok, reason: ok ? `${output.length} ≥ ${judge.chars} chars` : `${output.length} < ${judge.chars} chars` };
  }
  if (judge.type === "max_length") {
    const ok = output.length <= judge.chars;
    return { passed: ok, reason: ok ? `${output.length} ≤ ${judge.chars} chars` : `${output.length} > ${judge.chars} chars` };
  }
  return { passed: false, reason: "unknown judge type" };
}

async function runOneCase(
  c: EvalCase,
  baseInput: Omit<OrchestratorInput, "userInput" | "maxCostUsd">,
  perCaseMaxCostUsd?: number
): Promise<EvalCaseResult> {
  const t0 = Date.now();
  let finalContent = "";
  let costUsd = 0;
  try {
    const input: OrchestratorInput = {
      ...baseInput,
      userInput: c.input,
      ...(perCaseMaxCostUsd && perCaseMaxCostUsd > 0 ? { maxCostUsd: perCaseMaxCostUsd } : {}),
    };
    for await (const ev of runMultiAgent(input)) {
      if (ev.type === "final") finalContent = ev.content;
      else if (ev.type === "agent_end" && typeof ev.costUsd === "number") costUsd += ev.costUsd;
      else if (ev.type === "done") costUsd = ev.totalCostUsd ?? costUsd;
    }
    const verdict = judgeCase(c.judge, finalContent);
    return {
      caseId: c.id,
      caseName: c.name || c.id,
      passed: verdict.passed,
      judgeKind: c.judge.type,
      reason: verdict.reason,
      output: finalContent.slice(0, 4000),
      costUsd,
      durationMs: Date.now() - t0,
    };
  } catch (e: any) {
    return {
      caseId: c.id,
      caseName: c.name || c.id,
      passed: false,
      judgeKind: c.judge.type,
      reason: `case error: ${e?.message || "unknown"}`,
      output: finalContent.slice(0, 4000),
      costUsd,
      durationMs: Date.now() - t0,
      error: String(e?.message || e),
    };
  }
}

/** Compute weighted score = sum(weight where passed) / sum(weight). */
function aggregateScore(cases: EvalCase[], results: EvalCaseResult[]): number {
  let total = 0;
  let earned = 0;
  for (const c of cases) {
    const w = c.weight ?? 1;
    total += w;
    const r = results.find((x) => x.caseId === c.id);
    if (r?.passed) earned += w;
  }
  if (total <= 0) return 0;
  return Number((earned / total).toFixed(4));
}

export async function runEvalSuite(opts: RunEvalSuiteOpts): Promise<void> {
  const { runId, suite } = opts;
  const concurrency = Math.max(1, Math.min(8, opts.concurrency ?? 3));
  const cases = suite.cases || [];

  if (!cases.length) {
    await updateEvalRun(runId, {
      status: "done",
      score: 0,
      passedCases: 0,
      totalCostUsd: 0,
      results: [],
      completedAt: new Date().toISOString(),
    });
    return;
  }

  const baseInput = {
    strategy: (suite.strategy as OrchestratorInput["strategy"]) || "sequential",
    overrides: suite.overrides || {},
    maxRevisions: 1,
  } satisfies Omit<OrchestratorInput, "userInput" | "maxCostUsd">;

  const results: EvalCaseResult[] = [];
  let cursor = 0;

  async function worker() {
    while (cursor < cases.length) {
      const idx = cursor++;
      const c = cases[idx];
      try {
        const r = await runOneCase(c, baseInput, opts.perCaseMaxCostUsd);
        results.push(r);
      } catch (e: any) {
        results.push({
          caseId: c.id,
          caseName: c.name || c.id,
          passed: false,
          judgeKind: c.judge.type,
          reason: `worker error: ${e?.message || "unknown"}`,
          output: "",
          costUsd: 0,
          durationMs: 0,
          error: String(e?.message || e),
        });
      }
      // Persist progress after every case so the UI can poll for updates.
      const passedSoFar = results.filter((r) => r.passed).length;
      const costSoFar = results.reduce((sum, r) => sum + (r.costUsd || 0), 0);
      await updateEvalRun(runId, {
        passedCases: passedSoFar,
        totalCostUsd: Number(costSoFar.toFixed(6)),
        results: results.slice(),
      }).catch(() => {});
    }
  }

  try {
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    const score = aggregateScore(cases, results);
    const passed = results.filter((r) => r.passed).length;
    const cost = results.reduce((sum, r) => sum + (r.costUsd || 0), 0);
    await updateEvalRun(runId, {
      status: "done",
      score,
      passedCases: passed,
      totalCostUsd: Number(cost.toFixed(6)),
      results,
      completedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    await updateEvalRun(runId, {
      status: "error",
      errorMessage: String(e?.message || e),
      completedAt: new Date().toISOString(),
    }).catch(() => {});
  }
}

export { judgeCase, aggregateScore };
