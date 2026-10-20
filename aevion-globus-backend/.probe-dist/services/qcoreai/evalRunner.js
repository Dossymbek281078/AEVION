"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.runEvalSuite = runEvalSuite;
exports.judgeCase = judgeCase;
exports.aggregateScore = aggregateScore;
const orchestrator_1 = require("./orchestrator");
const providers_1 = require("./providers");
const store_1 = require("./store");
const DEFAULT_LLM_JUDGE_MODEL = {
    anthropic: "claude-haiku-4-5-20251001",
    openai: "gpt-4o-mini",
    gemini: "gemini-2.5-flash",
    deepseek: "deepseek-chat",
    grok: "grok-3-mini",
};
const LLM_JUDGE_SYSTEM = `You are an automated grader. You will be shown a rubric and a candidate output.

Reply with EXACTLY this format on two lines (no preamble, no markdown):
VERDICT: PASS|FAIL
CONFIDENCE: 0.0..1.0

PASS means the output satisfies the rubric. CONFIDENCE expresses your certainty (1.0 = sure pass / sure fail; 0.5 = ambiguous). Be strict — if the rubric is not clearly met, FAIL.`;
async function judgeCase(judge, output, input) {
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
        }
        catch (e) {
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
    if (judge.type === "llm_judge") {
        try {
            const provider = (0, providers_1.resolveProvider)(judge.provider);
            const model = judge.model || DEFAULT_LLM_JUDGE_MODEL[provider] || "claude-haiku-4-5-20251001";
            const userPart = [
                `RUBRIC:\n${judge.rubric}`,
                input ? `\nORIGINAL PROMPT:\n${input}` : "",
                `\nCANDIDATE OUTPUT:\n${output}`,
            ].join("");
            const result = await (0, providers_1.callProvider)(provider, [
                { role: "system", content: LLM_JUDGE_SYSTEM },
                { role: "user", content: userPart },
            ], model, 0);
            const reply = (result.reply || "").trim();
            const verdictMatch = reply.match(/VERDICT\s*:\s*(PASS|FAIL)/i);
            const confidenceMatch = reply.match(/CONFIDENCE\s*:\s*([0-9.]+)/i);
            if (!verdictMatch) {
                return { passed: false, reason: `llm_judge unparseable reply: ${reply.slice(0, 100)}` };
            }
            const verdict = verdictMatch[1].toUpperCase();
            const confidence = confidenceMatch ? Math.max(0, Math.min(1, parseFloat(confidenceMatch[1]))) : 1;
            let passed = verdict === "PASS";
            const threshold = judge.passThreshold;
            let thresholdHint = "";
            if (passed && typeof threshold === "number" && threshold > 0 && confidence < threshold) {
                passed = false;
                thresholdHint = ` (below confidence threshold ${threshold})`;
            }
            return {
                passed,
                reason: `${verdict} @ confidence ${confidence.toFixed(2)}${thresholdHint}`,
            };
        }
        catch (e) {
            return { passed: false, reason: `llm_judge error: ${e?.message || "unknown"}` };
        }
    }
    return { passed: false, reason: "unknown judge type" };
}
async function runOneCase(c, baseInput, perCaseMaxCostUsd) {
    const t0 = Date.now();
    let finalContent = "";
    let costUsd = 0;
    try {
        const input = {
            ...baseInput,
            userInput: c.input,
            ...(perCaseMaxCostUsd && perCaseMaxCostUsd > 0 ? { maxCostUsd: perCaseMaxCostUsd } : {}),
        };
        for await (const ev of (0, orchestrator_1.runMultiAgent)(input)) {
            if (ev.type === "final")
                finalContent = ev.content;
            else if (ev.type === "agent_end" && typeof ev.costUsd === "number")
                costUsd += ev.costUsd;
            else if (ev.type === "done")
                costUsd = ev.totalCostUsd ?? costUsd;
        }
        const verdict = await judgeCase(c.judge, finalContent, c.input);
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
    }
    catch (e) {
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
function aggregateScore(cases, results) {
    let total = 0;
    let earned = 0;
    for (const c of cases) {
        const w = c.weight ?? 1;
        total += w;
        const r = results.find((x) => x.caseId === c.id);
        if (r?.passed)
            earned += w;
    }
    if (total <= 0)
        return 0;
    return Number((earned / total).toFixed(4));
}
async function runEvalSuite(opts) {
    const { runId, suite } = opts;
    const concurrency = Math.max(1, Math.min(8, opts.concurrency ?? 3));
    const cases = suite.cases || [];
    if (!cases.length) {
        await (0, store_1.updateEvalRun)(runId, {
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
        strategy: suite.strategy || "sequential",
        overrides: suite.overrides || {},
        maxRevisions: 1,
    };
    const results = [];
    let cursor = 0;
    async function worker() {
        while (cursor < cases.length) {
            const idx = cursor++;
            const c = cases[idx];
            try {
                const r = await runOneCase(c, baseInput, opts.perCaseMaxCostUsd);
                results.push(r);
            }
            catch (e) {
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
            await (0, store_1.updateEvalRun)(runId, {
                passedCases: passedSoFar,
                totalCostUsd: Number(costSoFar.toFixed(6)),
                results: results.slice(),
            }).catch(() => { });
        }
    }
    try {
        await Promise.all(Array.from({ length: concurrency }, () => worker()));
        const score = aggregateScore(cases, results);
        const passed = results.filter((r) => r.passed).length;
        const cost = results.reduce((sum, r) => sum + (r.costUsd || 0), 0);
        await (0, store_1.updateEvalRun)(runId, {
            status: "done",
            score,
            passedCases: passed,
            totalCostUsd: Number(cost.toFixed(6)),
            results,
            completedAt: new Date().toISOString(),
        });
    }
    catch (e) {
        await (0, store_1.updateEvalRun)(runId, {
            status: "error",
            errorMessage: String(e?.message || e),
            completedAt: new Date().toISOString(),
        }).catch(() => { });
    }
}
