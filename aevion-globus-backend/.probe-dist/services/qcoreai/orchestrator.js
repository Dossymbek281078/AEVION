"use strict";
/**
 * Multi-agent orchestrator.
 *
 * Three strategies:
 *
 *  sequential (default)
 *     Analyst → Writer → Critic → (optional) Writer revision.
 *     Classic reflection loop. Critic gates revision via APPROVE/REVISE.
 *
 *  parallel
 *     Analyst → [Writer-A ‖ Writer-B] → Judge.
 *     Two writers stream in parallel on DIFFERENT models (diversity of voice),
 *     then a Judge synthesizes the final answer by picking or merging.
 *
 *  debate
 *     Analyst → [Pro-advocate ‖ Con-advocate] → Moderator.
 *     Two writers take opposing stances. Moderator produces a balanced answer.
 *
 * Every strategy yields strongly-typed OrchestratorEvent objects. The SSE
 * route handler forwards them as-is and persists key milestones to Postgres.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PremiumQuotaError = void 0;
exports.parseRouteToken = parseRouteToken;
exports.assessOpenDepth = assessOpenDepth;
exports.runMultiAgent = runMultiAgent;
const providers_1 = require("./providers");
const agents_1 = require("./agents");
const pricing_1 = require("./pricing");
/**
 * Thrown by streamAgent() when `premiumGate` blocks a dispatch, AFTER the
 * typed `premium_quota_exceeded` event has been yielded. The message is
 * user-facing: strategies embed it into their normal `error` events.
 */
class PremiumQuotaError extends Error {
    constructor(provider, model) {
        super(`premium-model monthly quota exhausted — ${provider}/${model} is unavailable on this account until the quota resets or the plan is upgraded`);
        this.name = "PremiumQuotaError";
    }
}
exports.PremiumQuotaError = PremiumQuotaError;
/* ═══════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════════ */
/**
 * Yield chunks for a single agent call and return the full accumulated text.
 * The single choke point every strategy dispatches through — which is why the
 * premium-quota gate lives here and not in each strategy function.
 */
async function* streamAgent(input, agent, stage, messages, instance, 
// Размер ПАРАЛЛЕЛЬНОЙ группы, в которой стартует этот стрим. Гонка
// 06.09.2026: N одновременных проверок премиум-квоты читали одно used до
// первой записи в леджер — слой из 8 моделей переливал подлимит ×8. Затвор
// теперь требует запас на всю группу (см. qcoreQuota.projectedCalls).
projectedCalls = 1) {
    if (input.premiumGate) {
        let hit = null;
        try {
            hit = await input.premiumGate(agent.provider, agent.model, projectedCalls);
        }
        catch {
            hit = null; // gate failure fails open — never blocks a run on a metering hiccup
        }
        if (hit) {
            yield {
                type: "premium_quota_exceeded",
                provider: agent.provider,
                model: agent.model,
                usedTokens: hit.usedTokens,
                limitTokens: hit.limitTokens,
            };
            throw new PremiumQuotaError(agent.provider, agent.model);
        }
    }
    const t0 = Date.now();
    yield {
        type: "agent_start",
        role: agent.role,
        stage,
        provider: agent.provider,
        model: agent.model,
        instance,
    };
    let content = "";
    let tokensIn;
    let tokensOut;
    for await (const ev of (0, providers_1.streamProviderResilient)(agent.provider, messages, agent.model, agent.temperature)) {
        if (ev.kind === "text") {
            content += ev.text;
            yield { type: "chunk", role: agent.role, stage, text: ev.text, instance };
        }
        else if (ev.kind === "done") {
            tokensIn = ev.tokensIn;
            tokensOut = ev.tokensOut;
        }
    }
    yield {
        type: "agent_end",
        role: agent.role,
        stage,
        content,
        tokensIn,
        tokensOut,
        durationMs: Date.now() - t0,
        costUsd: (0, pricing_1.costUsd)(agent.provider, agent.model, tokensIn, tokensOut),
        instance,
    };
    return content;
}
/**
 * Drain pending mid-run guidance from the input's `guidanceProvider`, emit a
 * `guidance_applied` event for each drained item (so the UI/audit trail can
 * show the human's interjection inline), and return the user prompt with the
 * guidance appended. When no guidance is pending or no provider was supplied,
 * returns the base prompt unchanged.
 */
async function* applyGuidance(input, basePrompt, role, stage, instance) {
    const items = input.guidanceProvider?.() ?? [];
    if (items.length === 0)
        return basePrompt;
    for (const text of items) {
        yield { type: "guidance_applied", stage, role, text, instance };
    }
    const guidanceBlock = items.map((t) => `[Mid-run user guidance: ${t}]`).join("\n");
    return `${basePrompt}\n\n${guidanceBlock}`;
}
/**
 * Returns the cap from input, treating <=0 / non-finite / undefined as
 * "no cap" (Infinity). Centralised so each strategy has one source of truth.
 */
function effectiveBudget(input) {
    const raw = input.maxCostUsd;
    if (typeof raw !== "number" || !isFinite(raw) || raw <= 0)
        return Infinity;
    return raw;
}
/** Yield the graceful bail-out tail when a budget is crossed mid-run. */
function* bailBudget(totalCost, budget, lastContent, t0) {
    yield { type: "budget_exceeded", spentUsd: totalCost, budgetUsd: budget };
    yield { type: "final", content: lastContent };
    yield { type: "done", totalDurationMs: Date.now() - t0, totalCostUsd: totalCost };
}
/** Helper: drain a sub-generator, re-yielding events, return its final value. */
async function* forward(gen) {
    while (true) {
        const r = await gen.next();
        if (r.done)
            return r.value;
        yield r.value;
    }
}
/**
 * Merge N async generators, racing their .next() calls so events from
 * whichever stream has data next are yielded immediately. Returns after all
 * streams complete. Preserves the return values in an array aligned with the
 * input array.
 */
async function* mergeStreams(streams) {
    const iters = streams.map((s) => s);
    const results = new Array(streams.length);
    const pending = new Map();
    const primeIter = (idx) => {
        pending.set(idx, {
            idx,
            promise: iters[idx].next().then((res) => ({ idx, res })),
        });
    };
    for (let i = 0; i < iters.length; i++)
        primeIter(i);
    while (pending.size > 0) {
        const race = await Promise.race(Array.from(pending.values()).map((p) => p.promise));
        if (race.res.done) {
            results[race.idx] = race.res.value;
            pending.delete(race.idx);
        }
        else {
            yield race.res.value;
            primeIter(race.idx);
        }
    }
    return results;
}
/* ═══════════════════════════════════════════════════════════════════════
   Strategy: sequential
   ═══════════════════════════════════════════════════════════════════════ */
async function* runSequential(input, agents, t0) {
    const { analyst, writer, critic } = agents;
    const maxRevisions = Math.max(0, Math.min(2, input.maxRevisions ?? 1));
    const history = Array.isArray(input.history) ? input.history.filter((m) => m.role !== "system") : [];
    const budget = effectiveBudget(input);
    let totalCost = 0;
    const tally = (e) => {
        if (e.type === "agent_end" && typeof e.costUsd === "number")
            totalCost += e.costUsd;
    };
    yield {
        type: "plan",
        strategy: "sequential",
        analyst: { provider: analyst.provider, model: analyst.model },
        writer: { provider: writer.provider, model: writer.model },
        critic: { provider: critic.provider, model: critic.model },
        maxRevisions,
    };
    /* Stage 1: Analyst */
    const analystMessages = [
        { role: "system", content: analyst.systemPrompt },
        ...history,
        { role: "user", content: input.userInput },
    ];
    let analystContent;
    try {
        analystContent = yield* forwardTally(streamAgent(input, analyst, "draft", analystMessages), tally);
    }
    catch (e) {
        yield { type: "error", role: "analyst", message: `Analyst failed: ${errMsg(e)}` };
        return;
    }
    if (totalCost > budget) {
        // Analyst alone busted the cap — there's no draft yet, so finalize
        // with the analyst plan as the partial answer.
        yield* bailBudget(totalCost, budget, analystContent, t0);
        return;
    }
    /* Stage 2: Writer draft */
    const writerDraftUser = yield* applyGuidance(input, buildWriterPrompt(input.userInput, analystContent), "writer", "draft");
    const writerMessages = [
        { role: "system", content: writer.systemPrompt },
        ...history,
        { role: "user", content: writerDraftUser },
    ];
    let writerDraft;
    try {
        writerDraft = yield* forwardTally(streamAgent(input, writer, "draft", writerMessages), tally);
    }
    catch (e) {
        yield { type: "error", role: "writer", message: `Writer failed: ${errMsg(e)}` };
        return;
    }
    if (totalCost > budget) {
        // Writer draft is good enough as the final answer — skip critic + revision.
        yield* bailBudget(totalCost, budget, writerDraft, t0);
        return;
    }
    /* Stage 3: Critic */
    const criticUser = buildCriticPrompt(input.userInput, analystContent, writerDraft);
    const criticMessages = [
        { role: "system", content: critic.systemPrompt },
        { role: "user", content: criticUser },
    ];
    let criticContent;
    try {
        criticContent = yield* forwardTally(streamAgent(input, critic, "draft", criticMessages), tally);
    }
    catch (e) {
        yield { type: "error", role: "critic", message: `Critic failed: ${errMsg(e)}` };
        yield { type: "final", content: writerDraft };
        yield { type: "done", totalDurationMs: Date.now() - t0, totalCostUsd: totalCost };
        return;
    }
    const verdict = (0, agents_1.parseCriticVerdict)(criticContent);
    yield { type: "verdict", approved: verdict.approved, feedback: verdict.feedback };
    let finalContent = writerDraft;
    if (totalCost > budget) {
        // Critic spent us out before revision could happen — ship the draft.
        yield* bailBudget(totalCost, budget, writerDraft, t0);
        return;
    }
    /* Stage 4: Writer revision (optional) */
    if (!verdict.approved && maxRevisions > 0) {
        const reviseUser = yield* applyGuidance(input, buildRevisePrompt(input.userInput, writerDraft, verdict.feedback), "writer", "revision");
        const reviseMessages = [
            { role: "system", content: writer.systemPrompt },
            ...history,
            { role: "user", content: reviseUser },
        ];
        try {
            finalContent = yield* forwardTally(streamAgent(input, writer, "revision", reviseMessages), tally);
        }
        catch (e) {
            yield { type: "error", role: "writer", message: `Writer revision failed: ${errMsg(e)}` };
            finalContent = writerDraft;
        }
    }
    yield { type: "final", content: finalContent };
    yield { type: "done", totalDurationMs: Date.now() - t0, totalCostUsd: totalCost };
}
/* ═══════════════════════════════════════════════════════════════════════
   Strategy: parallel (Analyst → [Writer-A ‖ Writer-B] → Judge)
   ═══════════════════════════════════════════════════════════════════════ */
async function* runParallel(input, agents, t0) {
    const { analyst, writerA, writerB, judge } = agents;
    const history = Array.isArray(input.history) ? input.history.filter((m) => m.role !== "system") : [];
    const budget = effectiveBudget(input);
    let totalCost = 0;
    const tally = (e) => {
        if (e.type === "agent_end" && typeof e.costUsd === "number")
            totalCost += e.costUsd;
    };
    yield {
        type: "plan",
        strategy: "parallel",
        analyst: { provider: analyst.provider, model: analyst.model },
        writer: { provider: writerA.provider, model: writerA.model },
        writerB: { provider: writerB.provider, model: writerB.model },
        critic: { provider: judge.provider, model: judge.model },
        maxRevisions: 0,
    };
    /* Stage 1: Analyst */
    const analystMessages = [
        { role: "system", content: analyst.systemPrompt },
        ...history,
        { role: "user", content: input.userInput },
    ];
    let analystContent;
    try {
        analystContent = yield* forwardTally(streamAgent(input, analyst, "draft", analystMessages), tally);
    }
    catch (e) {
        yield { type: "error", role: "analyst", message: `Analyst failed: ${errMsg(e)}` };
        return;
    }
    if (totalCost > budget) {
        yield* bailBudget(totalCost, budget, analystContent, t0);
        return;
    }
    /* Stage 2: Two writers in parallel */
    // Drain guidance once and apply it equally to both writers so they share
    // the same human steer (rather than randomly biasing only one).
    const writerUserPrompt = yield* applyGuidance(input, buildWriterPrompt(input.userInput, analystContent), "writer", "draft");
    const writerAMessages = [
        { role: "system", content: writerA.systemPrompt },
        ...history,
        { role: "user", content: writerUserPrompt },
    ];
    const writerBMessages = [
        { role: "system", content: writerB.systemPrompt },
        ...history,
        { role: "user", content: writerUserPrompt },
    ];
    const streamA = streamAgent(input, writerA, "draft", writerAMessages, "a", 2);
    const streamB = streamAgent(input, writerB, "draft", writerBMessages, "b", 2);
    let draftA = "";
    let draftB = "";
    try {
        const results = yield* mergeStreamsTally([streamA, streamB], tally);
        draftA = results[0] ?? "";
        draftB = results[1] ?? "";
    }
    catch (e) {
        yield { type: "error", role: "writer", message: `Parallel writers failed: ${errMsg(e)}` };
        return;
    }
    if (totalCost > budget) {
        // Skip judge and pick the longer draft as the partial answer.
        const partial = draftA.length >= draftB.length ? draftA : draftB;
        yield* bailBudget(totalCost, budget, partial, t0);
        return;
    }
    /* Stage 3: Judge */
    const judgeUser = buildJudgePrompt(input.userInput, analystContent, draftA, draftB);
    const judgeMessages = [
        { role: "system", content: judge.systemPrompt },
        { role: "user", content: judgeUser },
    ];
    let finalContent;
    try {
        finalContent = yield* forwardTally(streamAgent(input, judge, "judge", judgeMessages), tally);
    }
    catch (e) {
        yield { type: "error", role: "critic", message: `Judge failed: ${errMsg(e)}` };
        finalContent = draftA.length >= draftB.length ? draftA : draftB;
    }
    yield { type: "final", content: finalContent };
    yield { type: "done", totalDurationMs: Date.now() - t0, totalCostUsd: totalCost };
}
/* ═══════════════════════════════════════════════════════════════════════
   Strategy: debate (Analyst → [Pro ‖ Con] → Moderator)
   ═══════════════════════════════════════════════════════════════════════ */
async function* runDebate(input, agents, t0) {
    const { analyst, pro, con, moderator } = agents;
    const history = Array.isArray(input.history) ? input.history.filter((m) => m.role !== "system") : [];
    const budget = effectiveBudget(input);
    let totalCost = 0;
    const tally = (e) => {
        if (e.type === "agent_end" && typeof e.costUsd === "number")
            totalCost += e.costUsd;
    };
    yield {
        type: "plan",
        strategy: "debate",
        analyst: { provider: analyst.provider, model: analyst.model },
        writer: { provider: pro.provider, model: pro.model },
        writerB: { provider: con.provider, model: con.model },
        critic: { provider: moderator.provider, model: moderator.model },
        maxRevisions: 0,
    };
    /* Stage 1: Analyst */
    const analystMessages = [
        { role: "system", content: analyst.systemPrompt },
        ...history,
        { role: "user", content: input.userInput },
    ];
    let analystContent;
    try {
        analystContent = yield* forwardTally(streamAgent(input, analyst, "draft", analystMessages), tally);
    }
    catch (e) {
        yield { type: "error", role: "analyst", message: `Analyst failed: ${errMsg(e)}` };
        return;
    }
    if (totalCost > budget) {
        yield* bailBudget(totalCost, budget, analystContent, t0);
        return;
    }
    /* Stage 2: Pro + Con in parallel */
    // Apply pending guidance to both advocates equally so the debate is fair.
    const debateUser = yield* applyGuidance(input, buildDebatePrompt(input.userInput, analystContent), "writer", "draft");
    const proMessages = [
        { role: "system", content: pro.systemPrompt },
        ...history,
        { role: "user", content: debateUser },
    ];
    const conMessages = [
        { role: "system", content: con.systemPrompt },
        ...history,
        { role: "user", content: debateUser },
    ];
    const streamPro = streamAgent(input, pro, "draft", proMessages, "pro", 2);
    const streamCon = streamAgent(input, con, "draft", conMessages, "con", 2);
    let proArg = "";
    let conArg = "";
    try {
        const results = yield* mergeStreamsTally([streamPro, streamCon], tally);
        proArg = results[0] ?? "";
        conArg = results[1] ?? "";
    }
    catch (e) {
        yield { type: "error", role: "writer", message: `Debate advocates failed: ${errMsg(e)}` };
        return;
    }
    if (totalCost > budget) {
        // Skip moderator and stitch a placeholder summary.
        const partial = `**Pro side:**\n${proArg}\n\n**Con side:**\n${conArg}\n\n[Budget exceeded before Moderator synthesis.]`;
        yield* bailBudget(totalCost, budget, partial, t0);
        return;
    }
    /* Stage 3: Moderator synthesizes */
    const modUser = buildModeratorPrompt(input.userInput, analystContent, proArg, conArg);
    const modMessages = [
        { role: "system", content: moderator.systemPrompt },
        { role: "user", content: modUser },
    ];
    let finalContent;
    try {
        finalContent = yield* forwardTally(streamAgent(input, moderator, "judge", modMessages), tally);
    }
    catch (e) {
        yield { type: "error", role: "critic", message: `Moderator failed: ${errMsg(e)}` };
        // Defensive: concat the arguments so the user at least sees both sides.
        finalContent = `**Pro**\n\n${proArg}\n\n**Con**\n\n${conArg}`;
    }
    yield { type: "final", content: finalContent };
    yield { type: "done", totalDurationMs: Date.now() - t0, totalCostUsd: totalCost };
}
/* ═══════════════════════════════════════════════════════════════════════
   Strategy: council (crowd of free models ‖ … → premium Synthesizer)

   The differentiator. N (mostly free) models each answer the SAME question
   under a DIFFERENT persona, streaming in parallel. Then one premium model
   (Opus 4.8 by default) cross-checks all drafts and fuses them into a single
   verified answer. Free breadth, premium depth — cost-tiered automatically.
   ═══════════════════════════════════════════════════════════════════════ */
/**
 * Wrap a member's agent stream so a mid-stream failure (network/429/etc.)
 * becomes a non-fatal `error` event and an empty-string return, rather than
 * throwing and aborting the whole council. Re-yields all events from the inner
 * stream until it either completes (returning its text) or throws.
 */
async function* safeMemberStream(inner, persona) {
    try {
        let acc = "";
        while (true) {
            const r = await inner.next();
            if (r.done)
                return r.value ?? acc;
            if (r.value.type === "chunk")
                acc += r.value.text;
            yield r.value;
        }
    }
    catch (e) {
        yield { type: "error", role: "writer", message: `Council member "${persona}" failed: ${errMsg(e)}` };
        return "";
    }
}
async function* runCouncil(input, agents, t0) {
    const { members, synthesizer } = agents;
    const history = Array.isArray(input.history) ? input.history.filter((m) => m.role !== "system") : [];
    const budget = effectiveBudget(input);
    const layers = Math.max(1, Math.min(3, Math.floor(input.councilLayers ?? 1)));
    let totalCost = 0;
    const tally = (e) => {
        if (e.type === "agent_end" && typeof e.costUsd === "number")
            totalCost += e.costUsd;
    };
    const freeById = new Map((0, providers_1.getProviders)().map((p) => [p.id, p.free]));
    yield {
        type: "plan",
        strategy: "council",
        // Fill the legacy slots so existing consumers stay happy; the council-aware
        // UI reads the richer `council` / `synthesizer` fields below.
        analyst: { provider: members[0].provider, model: members[0].model },
        writer: { provider: members[0].provider, model: members[0].model },
        critic: { provider: synthesizer.provider, model: synthesizer.model },
        maxRevisions: 0,
        council: members.map((m) => ({
            provider: m.provider,
            model: m.model,
            persona: m.persona,
            free: freeById.get(m.provider) ?? false,
        })),
        synthesizer: { provider: synthesizer.provider, model: synthesizer.model },
        councilLayers: layers,
        localOnly: input.localOnly === true,
    };
    /* Layer 0 — proposers: the whole crowd answers in parallel, each under its
       persona. Each member is wrapped so an individual failure (free-tier 429)
       degrades to an empty draft + non-fatal error, instead of aborting the run. */
    const memberUser = yield* applyGuidance(input, input.userInput, "writer", "draft");
    let answered;
    {
        const streams = members.map((m) => safeMemberStream(streamAgent(input, m, "draft", [{ role: "system", content: m.systemPrompt }, ...history, { role: "user", content: memberUser }], m.persona, members.length), m.persona));
        let drafts = [];
        try {
            const results = yield* mergeStreamsTally(streams, tally);
            drafts = results.map((r) => r ?? "");
        }
        catch (e) {
            yield { type: "error", role: "writer", message: `Council members failed: ${errMsg(e)}` };
            return;
        }
        answered = members
            .map((m, i) => ({ member: m, draft: drafts[i] }))
            .filter((x) => x.draft.trim().length > 0);
    }
    if (answered.length === 0) {
        yield { type: "error", role: "writer", message: "No council member produced an answer." };
        return;
    }
    /* Layers 1..L-1 — aggregators (Mixture-of-Agents): each member re-answers,
       now seeing ALL of the previous layer's responses, using the AGGREGATOR
       prompt. Free models do this refinement; a layer that goes fully dark keeps
       the previous layer's answers rather than losing everything. */
    // Бюджет проверялся только МЕЖДУ слоями: слой из 8 моделей выносил его
    // разом (та же гонка, но по деньгам). Слой стоит примерно как предыдущий —
    // требуем запас на него ДО старта.
    let lastLayerCost = totalCost; // цена слоя 0
    for (let layer = 1; layer < layers && totalCost + lastLayerCost <= budget; layer++) {
        const costBeforeLayer = totalCost;
        const aggUser = buildAggregatorPrompt(input.userInput, answered.map((x) => x.draft));
        const streams = members.map((m) => safeMemberStream(streamAgent(input, m, "draft", [{ role: "system", content: agents_1.AGGREGATOR_PROMPT }, ...history, { role: "user", content: aggUser }], `${m.persona}·L${layer}`, members.length), m.persona));
        let refined = [];
        try {
            const results = yield* mergeStreamsTally(streams, tally);
            refined = results.map((r) => r ?? "");
        }
        catch (e) {
            yield { type: "error", role: "writer", message: `Aggregator layer ${layer} failed: ${errMsg(e)}` };
            break; // keep the last good layer's answers
        }
        const nextAnswered = members
            .map((m, i) => ({ member: m, draft: refined[i] }))
            .filter((x) => x.draft.trim().length > 0);
        if (nextAnswered.length > 0)
            answered = nextAnswered;
        lastLayerCost = Math.max(totalCost - costBeforeLayer, 0.000001);
    }
    if (totalCost > budget) {
        // Budget blown by the crowd (shouldn't happen with free members) — ship
        // the longest draft rather than paying for synthesis.
        const longest = answered.reduce((a, b) => (b.draft.length > a.draft.length ? b : a)).draft;
        yield* bailBudget(totalCost, budget, longest, t0);
        return;
    }
    /* Final layer — premium Synthesizer (Opus 4.8 by default) fuses + verifies. */
    const synthUser = buildCouncilSynthPrompt(input.userInput, answered.map((x) => ({ persona: x.member.persona, draft: x.draft })));
    const synthMessages = [
        { role: "system", content: synthesizer.systemPrompt },
        { role: "user", content: synthUser },
    ];
    let finalContent;
    try {
        finalContent = yield* forwardTally(streamAgent(input, synthesizer, "judge", synthMessages), tally);
    }
    catch (e) {
        yield { type: "error", role: "critic", message: `Synthesizer failed: ${errMsg(e)}` };
        // Fallback: hand back the longest crowd draft so the user isn't empty-handed.
        finalContent = answered.reduce((a, b) => (b.draft.length > a.draft.length ? b : a)).draft;
    }
    yield { type: "final", content: finalContent };
    yield { type: "done", totalDurationMs: Date.now() - t0, totalCostUsd: totalCost };
}
/* ═══════════════════════════════════════════════════════════════════════
   Tally-aware wrappers — re-yield events AND observe them for cost totals.
   ═══════════════════════════════════════════════════════════════════════ */
async function* forwardTally(gen, observe) {
    while (true) {
        const r = await gen.next();
        if (r.done)
            return r.value;
        observe(r.value);
        yield r.value;
    }
}
async function* mergeStreamsTally(streams, observe) {
    const gen = mergeStreams(streams);
    while (true) {
        const r = await gen.next();
        if (r.done)
            return r.value;
        observe(r.value);
        yield r.value;
    }
}
/* ═══════════════════════════════════════════════════════════════════════
   Strategy: auto — classify the query, then route Council vs single flagship

   Benchmark finding (N=40, 2026-07-12): the Council beats a single flagship on
   reasoning/writing/advice/analysis (100%), math (80%) and coding (67%), but on
   PURE FACTUAL RECALL it only ties (50%) — so paying the ~2.8× Council premium
   there is waste. "auto" runs a cheap one-token classifier (a free model online,
   a local model offline) that sends open-ended prompts to the Council and plain
   factual lookups to a single flagship call. Uncertain → Council (quality-safe).
   ═══════════════════════════════════════════════════════════════════════ */
const CLASSIFIER_SYSTEM = "You are a routing classifier for an AI system. Decide whether a user query is " +
    "OPEN — needing multi-perspective work: reasoning, analysis, writing, advice, " +
    "coding, or multi-step math — or FACT — a simple factual lookup, definition, " +
    "conversion, or trivia that has one correct answer a single strong model already " +
    "knows. When unsure, answer OPEN. Reply with EXACTLY one token: OPEN or FACT. " +
    "No other text.";
const DIRECT_ANSWER_PROMPT = "You are a precise, helpful assistant. Answer the user's question directly and " +
    "correctly. Be concise — include only what is needed to be accurate and useful. " +
    "No preamble, no meta commentary.";
/** Pick the cheapest reliable model to run the router classification on. */
function pickClassifier(localOnly, localModels) {
    if (localOnly) {
        const p = (0, providers_1.getLocalProviders)()[0];
        if (!p)
            return null;
        return { provider: p.id, model: localModels?.[p.id]?.[0] ?? p.defaultModel };
    }
    // Prefer a free gateway (zero marginal cost); else the cheapest premium chair
    // model (Haiku), else anything configured.
    const free = (0, providers_1.getFreeProviders)()[0];
    if (free)
        return { provider: free.id, model: free.defaultModel };
    const anthropic = (0, providers_1.getProviders)().find((p) => p.id === "anthropic" && p.configured);
    if (anthropic) {
        // Cheapest capable chair model for a one-token classification — prefer any
        // Haiku snapshot (id may be versioned, e.g. claude-haiku-4-5-20251001).
        const haiku = anthropic.models.find((m) => m.startsWith("claude-haiku"));
        return { provider: "anthropic", model: haiku ?? anthropic.defaultModel };
    }
    const any = (0, providers_1.getProviders)().find((p) => p.configured);
    return any ? { provider: any.id, model: any.defaultModel } : null;
}
/**
 * Parse the classifier's reply into a routing decision. Pure + exported so the
 * decision rule is unit-testable without a network call. Only an explicit FACT
 * token routes to the single-model path; everything else (including garbage or
 * an OPEN token) is quality-safe OPEN → council.
 */
function parseRouteToken(reply) {
    const t = (reply || "").trim().toUpperCase();
    if (t.startsWith("FACT"))
        return "fact";
    return "open";
}
/**
 * Grade an OPEN query's depth to pick how many Mixture-of-Agents layers to run.
 * Pure + exported so the rule is unit-testable without a network call.
 *
 * Rationale (eval, 2026-07): a second aggregation layer (L2, ~2.8× a single
 * call) earns its keep on long or multi-part prompts, where cross-checking many
 * angles pays off; a short single-ask open prompt is answered just as well by a
 * single aggregation layer (L1, ~1.6×). So we spend the extra layer only where
 * the prompt is genuinely heavy. Signals of "heavy": length, multiple explicit
 * questions, enumerations/numbered sub-asks, "compare/contrast/step by step"
 * style cues, or several sentences. When in doubt we stay LIGHT (L1) — the
 * classifier already guaranteed this is open-ended, so even L1 beats a single
 * flagship; the deep tier is a top-up, not a floor.
 *
 * @returns 1 (light) or 2 (deep) — the resolved MoA layer count.
 */
function assessOpenDepth(query) {
    const q = (query || "").trim();
    if (!q)
        return 1;
    const words = q.split(/\s+/).filter(Boolean).length;
    const questionMarks = (q.match(/\?/g) || []).length;
    // Enumerated sub-asks: 2+ numbered markers ("1. … 2. … 3.") ANYWHERE (inline
    // "do three things: 1. x, 2. y" counts, not only line-start), or bullet lines.
    const enumerated = (q.match(/\b\d+[.)]\s+/g) || []).length >= 2 ||
        /(^|\n)\s*[-*•]\s+/m.test(q);
    const lines = q.split(/\n/).filter((l) => l.trim()).length;
    // Multi-part cues that signal several distinct angles in one prompt. Includes
    // the noun forms ("comparison", "difference(s) between") and "distinguish",
    // which the verb list below misses — borderline eval (2026-07) showed genuinely
    // two-part prompts like "explain the difference between X and Y, and describe …"
    // slipping through as light.
    const multiPartCue = /\b(compare|comparisons?|contrast|versus|vs\.?|pros and cons|trade-?offs?|differences? between|distinguish|step[-\s]?by[-\s]?step|as well as|and also|then explain|both|each of)\b/i.test(q);
    // Imperative task chain: 3+ distinct "do this" verbs in one prompt
    // ("summarize …, identify …, and propose …") signals several sub-asks even
    // without enumeration or an explicit compare cue.
    const taskVerbs = new Set((q.match(/\b(summari[sz]e|identify|outline|list|propose|recommend\w*|compare|contrast|weigh|analy[sz]e|explain|describe|evaluate|design|assess|cover)\b/gi) || [])
        .map((v) => v.toLowerCase()));
    const imperativeChain = taskVerbs.size >= 3;
    // Ranked-list ask ("the top five tools", "top 3 frameworks") — an implicit
    // enumeration the numbered-marker check can't see. Only heavy when paired with
    // a compare cue or enough length, so "top 3 tips" alone stays light.
    const rankedList = /\btop\s+(\d+|two|three|four|five|six|seven|eight|nine|ten)\b/i.test(q);
    // "and"-joined asks ("do X and explain Y and weigh Z") — 2+ "and" hints breadth.
    const andJoins = (q.match(/\band\b/gi) || []).length;
    const heavy = words >= 60 ||
        questionMarks >= 2 ||
        enumerated ||
        lines >= 3 ||
        imperativeChain ||
        (rankedList && (multiPartCue || words >= 14)) ||
        // An explicit compare cue plus a second distinct task verb = two real asks
        // ("compare X vs Y, and explain the trade-offs") — deep regardless of length.
        (multiPartCue && taskVerbs.size >= 2) ||
        (multiPartCue && words >= 18) ||
        // Breadth by conjunction, but only when a task/compare signal backs it — bare
        // narrative "and"s ("I like my job and my team, and I wonder …") stay light.
        (andJoins >= 2 && words >= 28 && (multiPartCue || taskVerbs.size >= 2));
    return heavy ? 2 : 1;
}
/**
 * Classify a query as OPEN (→ council) or FACT (→ single). Returns null if the
 * classifier call fails, so the caller can default to Council (never under-serve
 * on a quality question).
 */
async function classifyRoute(userInput, clf) {
    try {
        const res = await (0, providers_1.callProviderResilient)(clf.provider, [
            { role: "system", content: CLASSIFIER_SYSTEM },
            { role: "user", content: `Query:\n${userInput.slice(0, 2000)}\n\nOPEN or FACT?` },
        ], clf.model, 0);
        return parseRouteToken(res.reply);
    }
    catch {
        return null;
    }
}
/**
 * Single-model path for FACT queries: one direct call to the best available
 * model (the same chair the Council would use, minus the crowd). Streams its
 * output as the final answer. Emits a `plan` (strategy: sequential, one slot)
 * so existing consumers stay happy, then agent + final + done.
 */
async function* runSingle(input, answerer, t0) {
    const history = Array.isArray(input.history) ? input.history.filter((m) => m.role !== "system") : [];
    let totalCost = 0;
    const tally = (e) => {
        if (e.type === "agent_end" && typeof e.costUsd === "number")
            totalCost += e.costUsd;
    };
    yield {
        type: "plan",
        strategy: "sequential",
        analyst: { provider: answerer.provider, model: answerer.model },
        writer: { provider: answerer.provider, model: answerer.model },
        critic: { provider: answerer.provider, model: answerer.model },
        maxRevisions: 0,
    };
    const userPrompt = yield* applyGuidance(input, input.userInput, "writer", "draft");
    const messages = [
        { role: "system", content: answerer.systemPrompt },
        ...history,
        { role: "user", content: userPrompt },
    ];
    let finalContent;
    try {
        finalContent = yield* forwardTally(streamAgent(input, answerer, "draft", messages), tally);
    }
    catch (e) {
        yield { type: "error", role: "writer", message: `Single-model answer failed: ${errMsg(e)}` };
        return;
    }
    yield { type: "final", content: finalContent };
    yield { type: "done", totalDurationMs: Date.now() - t0, totalCostUsd: totalCost };
}
/**
 * Resolve "auto" into a concrete run. Classifies the query, emits a `route`
 * event, then delegates to the Council (open) or a single flagship call (fact).
 * Provider selection mirrors the council path so offline/online both work.
 */
async function* runAuto(input, t0) {
    const localOnly = input.localOnly === true;
    const localModels = localOnly ? await (0, providers_1.discoverLocalModels)() : undefined;
    const clf = pickClassifier(localOnly, localModels);
    const decision = clf ? await classifyRoute(input.userInput, clf) : null;
    // No classifier, or classifier errored → default to Council (quality-safe).
    const classification = decision ?? "open";
    const clfMeta = clf ?? { provider: "none", model: "heuristic-default" };
    if (classification === "fact") {
        // FACT → single strong model, no crowd. Reuse the chair's provider/model but
        // with a plain direct-answer prompt (not the synthesis prompt).
        const chair = (0, agents_1.buildSynthesizer)(input.overrides?.critic, { localOnly, localModels });
        if (!chair) {
            yield { type: "error", message: localOnly ? noLocalProviderMsg() : noProviderMsg() };
            return;
        }
        const answerer = {
            role: "writer",
            provider: chair.provider,
            model: chair.model,
            systemPrompt: input.overrides?.critic?.systemPrompt?.trim() || DIRECT_ANSWER_PROMPT,
            temperature: 0.3,
        };
        yield {
            type: "route",
            classification,
            resolved: "single",
            classifier: clfMeta,
            note: decision
                ? "Factual lookup — a single flagship call answers this as well as the council, at 1× cost."
                : "Classifier unavailable — defaulted, but treated as a single call.",
        };
        yield* runSingle(input, answerer, t0);
        return;
    }
    // OPEN → Council. Grade the query's depth to pick 1 vs 2 MoA layers: a short
    // single-ask open prompt runs LIGHT (L1, ~1.6×), a long/multi-part one runs
    // DEEP (L2, ~2.8×). An explicit councilLayers on the request always wins — the
    // heuristic only fills the gap when the caller delegated the choice to auto.
    const members = (0, agents_1.buildCouncil)(input.councilSize ?? 3, input.overrides?.writer, { localOnly, localModels });
    const synthesizer = (0, agents_1.buildSynthesizer)(input.overrides?.critic, { localOnly, localModels });
    if (members.length < 2 || !synthesizer) {
        yield { type: "error", message: localOnly ? noLocalProviderMsg() : noProviderMsg() };
        return;
    }
    const explicitLayers = typeof input.councilLayers === "number";
    const layers = explicitLayers
        ? Math.max(1, Math.min(3, Math.floor(input.councilLayers)))
        : assessOpenDepth(input.userInput);
    const depth = layers >= 2 ? "deep" : "light";
    yield {
        type: "route",
        classification,
        resolved: "council",
        classifier: clfMeta,
        depth,
        layers,
        note: !decision
            ? "Classifier unavailable — defaulted to the council (quality-safe)."
            : explicitLayers
                ? `Open-ended query — routed to the council (${layers}-layer, as requested).`
                : depth === "deep"
                    ? "Open-ended and heavy (long or multi-part) — routed to the deep council (2 layers) for full cross-checking."
                    : "Open-ended but focused — routed to the light council (1 layer); still beats a single flagship at lower cost.",
    };
    yield* runCouncil({ ...input, councilLayers: layers }, { members, synthesizer }, t0);
}
/* ═══════════════════════════════════════════════════════════════════════
   Public entry point
   ═══════════════════════════════════════════════════════════════════════ */
async function* runMultiAgent(input) {
    const t0 = Date.now();
    if (input.strategy === "auto") {
        yield* runAuto(input, t0);
        return;
    }
    const strategy = input.strategy === "parallel" ? "parallel" :
        input.strategy === "debate" ? "debate" :
            input.strategy === "council" ? "council" :
                "sequential";
    if (strategy === "council") {
        const localOnly = input.localOnly === true;
        // Offline: discover which models each local runtime has actually pulled, so
        // the council convenes only models that exist (no 404 on a not-pulled model).
        const localModels = localOnly ? await (0, providers_1.discoverLocalModels)() : undefined;
        const members = (0, agents_1.buildCouncil)(input.councilSize ?? 3, input.overrides?.writer, { localOnly, localModels });
        const synthesizer = (0, agents_1.buildSynthesizer)(input.overrides?.critic, { localOnly, localModels });
        if (members.length < 2 || !synthesizer) {
            yield { type: "error", message: localOnly ? noLocalProviderMsg() : noProviderMsg() };
            return;
        }
        yield* runCouncil(input, { members, synthesizer }, t0);
        return;
    }
    // Offline (localOnly): sequential/parallel/debate can also run entirely on
    // local runtimes (Ollama / LM Studio / …). Discover which models each local
    // runtime has actually pulled so builders never name a missing model — same
    // as the council path. Under localOnly a no-provider error is a LOCAL one.
    const argueLocalOnly = input.localOnly === true;
    const argueLocalModels = argueLocalOnly ? await (0, providers_1.discoverLocalModels)() : undefined;
    const bopts = { localOnly: argueLocalOnly, localModels: argueLocalModels };
    const noProv = () => (argueLocalOnly ? noLocalProviderMsg() : noProviderMsg());
    const analyst = (0, agents_1.buildAgent)("analyst", input.overrides?.analyst, bopts);
    const writer = (0, agents_1.buildAgent)("writer", input.overrides?.writer, bopts);
    if (strategy === "parallel") {
        if (!analyst || !writer) {
            yield { type: "error", message: noProv() };
            return;
        }
        const writerB = (0, agents_1.buildWriterB)(writer, input.overrides?.writerB, bopts);
        const judge = (0, agents_1.buildJudge)(input.overrides?.critic, bopts);
        if (!writerB || !judge) {
            yield { type: "error", message: noProv() };
            return;
        }
        yield* runParallel(input, { analyst, writerA: writer, writerB, judge }, t0);
        return;
    }
    if (strategy === "debate") {
        if (!analyst) {
            yield { type: "error", message: noProv() };
            return;
        }
        const pro = (0, agents_1.buildPro)(input.overrides?.writer, bopts);
        if (!pro) {
            yield { type: "error", message: noProv() };
            return;
        }
        const con = (0, agents_1.buildCon)(pro, input.overrides?.writerB, bopts);
        const moderator = (0, agents_1.buildModerator)(input.overrides?.critic, bopts);
        if (!con || !moderator) {
            yield { type: "error", message: noProv() };
            return;
        }
        yield* runDebate(input, { analyst, pro, con, moderator }, t0);
        return;
    }
    const critic = (0, agents_1.buildAgent)("critic", input.overrides?.critic, bopts);
    if (!analyst || !writer || !critic) {
        yield { type: "error", message: noProv() };
        return;
    }
    yield* runSequential(input, { analyst, writer, critic }, t0);
}
/* ═══════════════════════════════════════════════════════════════════════
   Prompt builders (kept near the orchestrator so prompt shape is obvious)
   ═══════════════════════════════════════════════════════════════════════ */
function buildWriterPrompt(userInput, analystContent) {
    return [
        "User question:",
        userInput,
        "",
        "Analyst brief (plan, facts, risks):",
        analystContent,
        "",
        "Now write the final answer for the user, following the Analyst's plan.",
    ].join("\n");
}
function buildCriticPrompt(userInput, analystContent, writerDraft) {
    return [
        "User question:",
        userInput,
        "",
        "Analyst brief:",
        analystContent,
        "",
        "Writer draft:",
        writerDraft,
        "",
        "Now review the draft. Remember: first line must be APPROVE or REVISE.",
    ].join("\n");
}
function buildRevisePrompt(userInput, writerDraft, feedback) {
    return [
        "User question:",
        userInput,
        "",
        "Your previous draft:",
        writerDraft,
        "",
        "Critic feedback (fixes to apply):",
        feedback,
        "",
        agents_1.WRITER_REVISE_INSTRUCTION,
    ].join("\n");
}
function buildJudgePrompt(userInput, analystContent, draftA, draftB) {
    return [
        "User question:",
        userInput,
        "",
        "Analyst brief:",
        analystContent,
        "",
        "Draft A (Writer A):",
        draftA,
        "",
        "Draft B (Writer B):",
        draftB,
        "",
        "Produce the final answer now. Either pick the stronger draft verbatim or synthesize a merged version.",
        "Output ONLY the final answer. No preamble. No meta commentary.",
    ].join("\n");
}
function buildDebatePrompt(userInput, analystContent) {
    return [
        "User question:",
        userInput,
        "",
        "Analyst brief (shared context):",
        analystContent,
        "",
        "Now make your case. Be concrete, specific, and forceful.",
    ].join("\n");
}
function buildModeratorPrompt(userInput, analystContent, proArg, conArg) {
    return [
        "User question:",
        userInput,
        "",
        "Analyst brief:",
        analystContent,
        "",
        "Pro advocate argued:",
        proArg,
        "",
        "Con advocate argued:",
        conArg,
        "",
        "Produce the balanced final answer now. Bottom-line recommendation first.",
        "Output ONLY the final answer. No 'Pro said / Con said' commentary.",
    ].join("\n");
}
/**
 * Cap each draft before it feeds a synthesis/aggregation prompt. The premium
 * final synthesizer's cost is driven by how much crowd text it reads, so
 * trimming long drafts cuts cost with minimal quality loss (the head of an
 * answer carries most of the signal). Env-tunable; 0 disables trimming.
 */
const MAX_DRAFT_CHARS = (() => {
    const n = Number(process.env.QCOREAI_MAX_DRAFT_CHARS);
    return Number.isFinite(n) && n >= 0 ? n : 1600;
})();
function trimDraft(s) {
    if (!MAX_DRAFT_CHARS || s.length <= MAX_DRAFT_CHARS)
        return s;
    return s.slice(0, MAX_DRAFT_CHARS).replace(/\s+\S*$/, "") + " …[trimmed]";
}
/** MoA aggregator-layer prompt: user question + all prior-layer responses. */
function buildAggregatorPrompt(userInput, priorDrafts) {
    const parts = ["User question:", userInput, ""];
    parts.push(`Responses from the previous layer (${priorDrafts.length}):`);
    parts.push("");
    priorDrafts.forEach((d, i) => {
        parts.push(`── Response ${i + 1} ──`);
        parts.push(trimDraft(d));
        parts.push("");
    });
    parts.push("Synthesize these into a single, higher-quality answer per your instructions. " +
        "Critically evaluate for accuracy — do not copy errors. Output only the improved answer.");
    return parts.join("\n");
}
function buildCouncilSynthPrompt(userInput, drafts) {
    const parts = ["User question:", userInput, ""];
    parts.push(`The council (${drafts.length} independent models) answered:`);
    parts.push("");
    drafts.forEach((d, i) => {
        parts.push(`── Member ${i + 1} · ${d.persona} ──`);
        parts.push(trimDraft(d.draft));
        parts.push("");
    });
    parts.push("Now produce the single best final answer per your instructions: cross-check the members, " +
        "adjudicate disagreements, fix errors, and merge the strongest parts. Output ONLY the final answer.");
    return parts.join("\n");
}
function noProviderMsg() {
    return "No AI provider is configured. Add ANTHROPIC_API_KEY (or OPENAI / GEMINI / DEEPSEEK / GROK) to backend env.";
}
function noLocalProviderMsg() {
    return "Offline council needs a local runtime. Start one and set its base URL: OLLAMA_BASE_URL, LMSTUDIO_BASE_URL, JAN_BASE_URL, LOCALAI_BASE_URL, or LLAMACPP_BASE_URL.";
}
function errMsg(e) {
    return e instanceof Error ? e.message : String(e);
}
