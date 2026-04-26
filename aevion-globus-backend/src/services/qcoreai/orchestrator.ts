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

import { streamProvider, ChatMessage } from "./providers";
import {
  AgentConfig,
  AgentOverride,
  AgentRole,
  buildAgent,
  buildCon,
  buildJudge,
  buildModerator,
  buildPro,
  buildWriterB,
  parseCriticVerdict,
  WRITER_REVISE_INSTRUCTION,
} from "./agents";
import { costUsd } from "./pricing";

export type AgentStage = "draft" | "revision" | "judge";
export type PipelineStrategy = "sequential" | "parallel" | "debate";

export type OrchestratorInput = {
  userInput: string;
  strategy?: PipelineStrategy;
  overrides?: {
    analyst?: AgentOverride;
    writer?: AgentOverride;
    writerB?: AgentOverride; // parallel + debate (con side)
    critic?: AgentOverride;
  };
  /** sequential mode only: 0 = no revision, 1 = up to one pass (default), 2 = cap. */
  maxRevisions?: number;
  /** Optional prior user/assistant turns for follow-up context. */
  history?: ChatMessage[];
  /**
   * Mid-run human guidance. Called by the orchestrator at stage boundaries
   * (before each writer call, including parallel/debate sides and revisions);
   * returns and clears any pending guidance text the user has POSTed since
   * the last drain. The orchestrator appends each item to the writer's user
   * prompt as `[Mid-run user guidance: …]` and emits a `guidance_applied`
   * event so the UI can render it inline. When omitted, the orchestrator
   * runs exactly as before.
   */
  guidanceProvider?: () => string[];
};

export type OrchestratorEvent =
  | {
      type: "plan";
      strategy: PipelineStrategy;
      analyst: { provider: string; model: string };
      writer: { provider: string; model: string };
      writerB?: { provider: string; model: string };
      critic: { provider: string; model: string };
      maxRevisions: number;
    }
  | {
      type: "agent_start";
      role: AgentRole;
      stage: AgentStage;
      provider: string;
      model: string;
      /** Disambiguates concurrent streams: "a"/"b" (parallel) or "pro"/"con" (debate). */
      instance?: string;
    }
  | {
      type: "chunk";
      role: AgentRole;
      stage: AgentStage;
      text: string;
      instance?: string;
    }
  | {
      type: "agent_end";
      role: AgentRole;
      stage: AgentStage;
      content: string;
      tokensIn?: number;
      tokensOut?: number;
      durationMs: number;
      /** Cost of just this call in USD (0 when model is unpriced or tokens unknown). */
      costUsd?: number;
      instance?: string;
    }
  | { type: "verdict"; approved: boolean; feedback: string }
  | { type: "final"; content: string }
  | { type: "error"; message: string; role?: AgentRole }
  /** Emitted once per drained guidance item, immediately before the agent
      stage that will incorporate it. The UI renders these as a compact
      lavender chip in the run timeline so the trace is auditable. */
  | { type: "guidance_applied"; stage: AgentStage; role: AgentRole; text: string; instance?: string }
  | { type: "done"; totalDurationMs: number; totalCostUsd: number };

/* ═══════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════════ */

/** Yield chunks for a single agent call and return the full accumulated text. */
async function* streamAgent(
  agent: AgentConfig,
  stage: AgentStage,
  messages: ChatMessage[],
  instance?: string
): AsyncGenerator<OrchestratorEvent, string, unknown> {
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
  let tokensIn: number | undefined;
  let tokensOut: number | undefined;
  for await (const ev of streamProvider(
    agent.provider,
    messages,
    agent.model,
    agent.temperature
  )) {
    if (ev.kind === "text") {
      content += ev.text;
      yield { type: "chunk", role: agent.role, stage, text: ev.text, instance };
    } else if (ev.kind === "done") {
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
    costUsd: costUsd(agent.provider, agent.model, tokensIn, tokensOut),
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
async function* applyGuidance(
  input: OrchestratorInput,
  basePrompt: string,
  role: AgentRole,
  stage: AgentStage,
  instance?: string
): AsyncGenerator<OrchestratorEvent, string, unknown> {
  const items = input.guidanceProvider?.() ?? [];
  if (items.length === 0) return basePrompt;
  for (const text of items) {
    yield { type: "guidance_applied", stage, role, text, instance };
  }
  const guidanceBlock = items.map((t) => `[Mid-run user guidance: ${t}]`).join("\n");
  return `${basePrompt}\n\n${guidanceBlock}`;
}

/** Helper: drain a sub-generator, re-yielding events, return its final value. */
async function* forward<T>(
  gen: AsyncGenerator<OrchestratorEvent, T, unknown>
): AsyncGenerator<OrchestratorEvent, T, unknown> {
  while (true) {
    const r = await gen.next();
    if (r.done) return r.value;
    yield r.value;
  }
}

/**
 * Merge N async generators, racing their .next() calls so events from
 * whichever stream has data next are yielded immediately. Returns after all
 * streams complete. Preserves the return values in an array aligned with the
 * input array.
 */
async function* mergeStreams<T, R>(
  streams: AsyncGenerator<T, R, unknown>[]
): AsyncGenerator<T, R[], unknown> {
  type Pending = {
    idx: number;
    promise: Promise<{ idx: number; res: IteratorResult<T, R> }>;
  };
  const iters = streams.map((s) => s);
  const results: R[] = new Array(streams.length);
  const pending = new Map<number, Pending>();

  const primeIter = (idx: number) => {
    pending.set(idx, {
      idx,
      promise: iters[idx].next().then((res) => ({ idx, res })),
    });
  };

  for (let i = 0; i < iters.length; i++) primeIter(i);

  while (pending.size > 0) {
    const race = await Promise.race(Array.from(pending.values()).map((p) => p.promise));
    if (race.res.done) {
      results[race.idx] = race.res.value as R;
      pending.delete(race.idx);
    } else {
      yield race.res.value;
      primeIter(race.idx);
    }
  }

  return results;
}

/* ═══════════════════════════════════════════════════════════════════════
   Strategy: sequential
   ═══════════════════════════════════════════════════════════════════════ */

async function* runSequential(
  input: OrchestratorInput,
  agents: { analyst: AgentConfig; writer: AgentConfig; critic: AgentConfig },
  t0: number
): AsyncGenerator<OrchestratorEvent> {
  const { analyst, writer, critic } = agents;
  const maxRevisions = Math.max(0, Math.min(2, input.maxRevisions ?? 1));
  const history = Array.isArray(input.history) ? input.history.filter((m) => m.role !== "system") : [];
  let totalCost = 0;
  const tally = (e: OrchestratorEvent) => {
    if (e.type === "agent_end" && typeof e.costUsd === "number") totalCost += e.costUsd;
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
  const analystMessages: ChatMessage[] = [
    { role: "system", content: analyst.systemPrompt },
    ...history,
    { role: "user", content: input.userInput },
  ];
  let analystContent: string;
  try {
    analystContent = yield* forwardTally(streamAgent(analyst, "draft", analystMessages), tally);
  } catch (e) {
    yield { type: "error", role: "analyst", message: `Analyst failed: ${errMsg(e)}` };
    return;
  }

  /* Stage 2: Writer draft */
  const writerDraftUser = yield* applyGuidance(
    input,
    buildWriterPrompt(input.userInput, analystContent),
    "writer",
    "draft"
  );
  const writerMessages: ChatMessage[] = [
    { role: "system", content: writer.systemPrompt },
    ...history,
    { role: "user", content: writerDraftUser },
  ];
  let writerDraft: string;
  try {
    writerDraft = yield* forwardTally(streamAgent(writer, "draft", writerMessages), tally);
  } catch (e) {
    yield { type: "error", role: "writer", message: `Writer failed: ${errMsg(e)}` };
    return;
  }

  /* Stage 3: Critic */
  const criticUser = buildCriticPrompt(input.userInput, analystContent, writerDraft);
  const criticMessages: ChatMessage[] = [
    { role: "system", content: critic.systemPrompt },
    { role: "user", content: criticUser },
  ];
  let criticContent: string;
  try {
    criticContent = yield* forwardTally(streamAgent(critic, "draft", criticMessages), tally);
  } catch (e) {
    yield { type: "error", role: "critic", message: `Critic failed: ${errMsg(e)}` };
    yield { type: "final", content: writerDraft };
    yield { type: "done", totalDurationMs: Date.now() - t0, totalCostUsd: totalCost };
    return;
  }

  const verdict = parseCriticVerdict(criticContent);
  yield { type: "verdict", approved: verdict.approved, feedback: verdict.feedback };

  let finalContent = writerDraft;

  /* Stage 4: Writer revision (optional) */
  if (!verdict.approved && maxRevisions > 0) {
    const reviseUser = yield* applyGuidance(
      input,
      buildRevisePrompt(input.userInput, writerDraft, verdict.feedback),
      "writer",
      "revision"
    );
    const reviseMessages: ChatMessage[] = [
      { role: "system", content: writer.systemPrompt },
      ...history,
      { role: "user", content: reviseUser },
    ];
    try {
      finalContent = yield* forwardTally(streamAgent(writer, "revision", reviseMessages), tally);
    } catch (e) {
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

async function* runParallel(
  input: OrchestratorInput,
  agents: { analyst: AgentConfig; writerA: AgentConfig; writerB: AgentConfig; judge: AgentConfig },
  t0: number
): AsyncGenerator<OrchestratorEvent> {
  const { analyst, writerA, writerB, judge } = agents;
  const history = Array.isArray(input.history) ? input.history.filter((m) => m.role !== "system") : [];
  let totalCost = 0;
  const tally = (e: OrchestratorEvent) => {
    if (e.type === "agent_end" && typeof e.costUsd === "number") totalCost += e.costUsd;
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
  const analystMessages: ChatMessage[] = [
    { role: "system", content: analyst.systemPrompt },
    ...history,
    { role: "user", content: input.userInput },
  ];
  let analystContent: string;
  try {
    analystContent = yield* forwardTally(streamAgent(analyst, "draft", analystMessages), tally);
  } catch (e) {
    yield { type: "error", role: "analyst", message: `Analyst failed: ${errMsg(e)}` };
    return;
  }

  /* Stage 2: Two writers in parallel */
  // Drain guidance once and apply it equally to both writers so they share
  // the same human steer (rather than randomly biasing only one).
  const writerUserPrompt = yield* applyGuidance(
    input,
    buildWriterPrompt(input.userInput, analystContent),
    "writer",
    "draft"
  );
  const writerAMessages: ChatMessage[] = [
    { role: "system", content: writerA.systemPrompt },
    ...history,
    { role: "user", content: writerUserPrompt },
  ];
  const writerBMessages: ChatMessage[] = [
    { role: "system", content: writerB.systemPrompt },
    ...history,
    { role: "user", content: writerUserPrompt },
  ];

  const streamA = streamAgent(writerA, "draft", writerAMessages, "a");
  const streamB = streamAgent(writerB, "draft", writerBMessages, "b");

  let draftA = "";
  let draftB = "";
  try {
    const results = yield* mergeStreamsTally([streamA, streamB], tally);
    draftA = results[0] ?? "";
    draftB = results[1] ?? "";
  } catch (e) {
    yield { type: "error", role: "writer", message: `Parallel writers failed: ${errMsg(e)}` };
    return;
  }

  /* Stage 3: Judge */
  const judgeUser = buildJudgePrompt(input.userInput, analystContent, draftA, draftB);
  const judgeMessages: ChatMessage[] = [
    { role: "system", content: judge.systemPrompt },
    { role: "user", content: judgeUser },
  ];
  let finalContent: string;
  try {
    finalContent = yield* forwardTally(streamAgent(judge, "judge", judgeMessages), tally);
  } catch (e) {
    yield { type: "error", role: "critic", message: `Judge failed: ${errMsg(e)}` };
    finalContent = draftA.length >= draftB.length ? draftA : draftB;
  }

  yield { type: "final", content: finalContent };
  yield { type: "done", totalDurationMs: Date.now() - t0, totalCostUsd: totalCost };
}

/* ═══════════════════════════════════════════════════════════════════════
   Strategy: debate (Analyst → [Pro ‖ Con] → Moderator)
   ═══════════════════════════════════════════════════════════════════════ */

async function* runDebate(
  input: OrchestratorInput,
  agents: { analyst: AgentConfig; pro: AgentConfig; con: AgentConfig; moderator: AgentConfig },
  t0: number
): AsyncGenerator<OrchestratorEvent> {
  const { analyst, pro, con, moderator } = agents;
  const history = Array.isArray(input.history) ? input.history.filter((m) => m.role !== "system") : [];
  let totalCost = 0;
  const tally = (e: OrchestratorEvent) => {
    if (e.type === "agent_end" && typeof e.costUsd === "number") totalCost += e.costUsd;
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
  const analystMessages: ChatMessage[] = [
    { role: "system", content: analyst.systemPrompt },
    ...history,
    { role: "user", content: input.userInput },
  ];
  let analystContent: string;
  try {
    analystContent = yield* forwardTally(streamAgent(analyst, "draft", analystMessages), tally);
  } catch (e) {
    yield { type: "error", role: "analyst", message: `Analyst failed: ${errMsg(e)}` };
    return;
  }

  /* Stage 2: Pro + Con in parallel */
  // Apply pending guidance to both advocates equally so the debate is fair.
  const debateUser = yield* applyGuidance(
    input,
    buildDebatePrompt(input.userInput, analystContent),
    "writer",
    "draft"
  );
  const proMessages: ChatMessage[] = [
    { role: "system", content: pro.systemPrompt },
    ...history,
    { role: "user", content: debateUser },
  ];
  const conMessages: ChatMessage[] = [
    { role: "system", content: con.systemPrompt },
    ...history,
    { role: "user", content: debateUser },
  ];

  const streamPro = streamAgent(pro, "draft", proMessages, "pro");
  const streamCon = streamAgent(con, "draft", conMessages, "con");

  let proArg = "";
  let conArg = "";
  try {
    const results = yield* mergeStreamsTally([streamPro, streamCon], tally);
    proArg = results[0] ?? "";
    conArg = results[1] ?? "";
  } catch (e) {
    yield { type: "error", role: "writer", message: `Debate advocates failed: ${errMsg(e)}` };
    return;
  }

  /* Stage 3: Moderator synthesizes */
  const modUser = buildModeratorPrompt(input.userInput, analystContent, proArg, conArg);
  const modMessages: ChatMessage[] = [
    { role: "system", content: moderator.systemPrompt },
    { role: "user", content: modUser },
  ];
  let finalContent: string;
  try {
    finalContent = yield* forwardTally(streamAgent(moderator, "judge", modMessages), tally);
  } catch (e) {
    yield { type: "error", role: "critic", message: `Moderator failed: ${errMsg(e)}` };
    // Defensive: concat the arguments so the user at least sees both sides.
    finalContent = `**Pro**\n\n${proArg}\n\n**Con**\n\n${conArg}`;
  }

  yield { type: "final", content: finalContent };
  yield { type: "done", totalDurationMs: Date.now() - t0, totalCostUsd: totalCost };
}

/* ═══════════════════════════════════════════════════════════════════════
   Tally-aware wrappers — re-yield events AND observe them for cost totals.
   ═══════════════════════════════════════════════════════════════════════ */

async function* forwardTally<T>(
  gen: AsyncGenerator<OrchestratorEvent, T, unknown>,
  observe: (e: OrchestratorEvent) => void
): AsyncGenerator<OrchestratorEvent, T, unknown> {
  while (true) {
    const r = await gen.next();
    if (r.done) return r.value;
    observe(r.value);
    yield r.value;
  }
}

async function* mergeStreamsTally<R>(
  streams: AsyncGenerator<OrchestratorEvent, R, unknown>[],
  observe: (e: OrchestratorEvent) => void
): AsyncGenerator<OrchestratorEvent, R[], unknown> {
  const gen = mergeStreams<OrchestratorEvent, R>(streams);
  while (true) {
    const r = await gen.next();
    if (r.done) return r.value;
    observe(r.value);
    yield r.value;
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   Public entry point
   ═══════════════════════════════════════════════════════════════════════ */

export async function* runMultiAgent(
  input: OrchestratorInput
): AsyncGenerator<OrchestratorEvent> {
  const t0 = Date.now();
  const strategy: PipelineStrategy =
    input.strategy === "parallel" ? "parallel" :
    input.strategy === "debate" ? "debate" :
    "sequential";

  const analyst = buildAgent("analyst", input.overrides?.analyst);
  const writer = buildAgent("writer", input.overrides?.writer);

  if (strategy === "parallel") {
    if (!analyst || !writer) {
      yield { type: "error", message: noProviderMsg() };
      return;
    }
    const writerB = buildWriterB(writer, input.overrides?.writerB);
    const judge = buildJudge(input.overrides?.critic);
    if (!writerB || !judge) {
      yield { type: "error", message: noProviderMsg() };
      return;
    }
    yield* runParallel(input, { analyst, writerA: writer, writerB, judge }, t0);
    return;
  }

  if (strategy === "debate") {
    if (!analyst) {
      yield { type: "error", message: noProviderMsg() };
      return;
    }
    const pro = buildPro(input.overrides?.writer);
    if (!pro) {
      yield { type: "error", message: noProviderMsg() };
      return;
    }
    const con = buildCon(pro, input.overrides?.writerB);
    const moderator = buildModerator(input.overrides?.critic);
    if (!con || !moderator) {
      yield { type: "error", message: noProviderMsg() };
      return;
    }
    yield* runDebate(input, { analyst, pro, con, moderator }, t0);
    return;
  }

  const critic = buildAgent("critic", input.overrides?.critic);
  if (!analyst || !writer || !critic) {
    yield { type: "error", message: noProviderMsg() };
    return;
  }
  yield* runSequential(input, { analyst, writer, critic }, t0);
}

/* ═══════════════════════════════════════════════════════════════════════
   Prompt builders (kept near the orchestrator so prompt shape is obvious)
   ═══════════════════════════════════════════════════════════════════════ */

function buildWriterPrompt(userInput: string, analystContent: string): string {
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

function buildCriticPrompt(userInput: string, analystContent: string, writerDraft: string): string {
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

function buildRevisePrompt(userInput: string, writerDraft: string, feedback: string): string {
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
    WRITER_REVISE_INSTRUCTION,
  ].join("\n");
}

function buildJudgePrompt(
  userInput: string,
  analystContent: string,
  draftA: string,
  draftB: string
): string {
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

function buildDebatePrompt(userInput: string, analystContent: string): string {
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

function buildModeratorPrompt(
  userInput: string,
  analystContent: string,
  proArg: string,
  conArg: string
): string {
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

function noProviderMsg(): string {
  return "No AI provider is configured. Add ANTHROPIC_API_KEY (or OPENAI / GEMINI / DEEPSEEK / GROK) to backend env.";
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
