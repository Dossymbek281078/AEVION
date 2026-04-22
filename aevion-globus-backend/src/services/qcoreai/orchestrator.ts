/**
 * Multi-agent orchestrator.
 *
 * Two strategies:
 *
 *  sequential (default)
 *     Analyst → Writer → Critic → (optional) Writer revision
 *     Classic reflection loop. Critic gates revision via APPROVE/REVISE.
 *
 *  parallel
 *     Analyst → [Writer-A ‖ Writer-B] → Judge
 *     Two writers stream in parallel on DIFFERENT models (diversity of voice),
 *     then a Judge synthesizes the final answer by picking or merging.
 *
 * Everything yields strongly-typed OrchestratorEvent objects. Route handler
 * forwards them over SSE and persists key milestones to Postgres.
 */

import { streamProvider, ChatMessage } from "./providers";
import {
  AgentConfig,
  AgentOverride,
  AgentRole,
  buildAgent,
  buildJudge,
  buildWriterB,
  parseCriticVerdict,
  WRITER_REVISE_INSTRUCTION,
} from "./agents";

export type AgentStage = "draft" | "revision" | "judge";
export type PipelineStrategy = "sequential" | "parallel";

export type OrchestratorInput = {
  userInput: string;
  strategy?: PipelineStrategy;
  overrides?: {
    analyst?: AgentOverride;
    writer?: AgentOverride;
    writerB?: AgentOverride; // only used in parallel mode
    critic?: AgentOverride;
  };
  /** sequential mode only: 0 = no revision, 1 = up to one pass (default), 2 = cap. */
  maxRevisions?: number;
  /** Optional prior user/assistant turns for follow-up context. */
  history?: ChatMessage[];
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
      /** "a" | "b" in parallel mode; undefined for single-instance stages. */
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
      instance?: string;
    }
  | { type: "verdict"; approved: boolean; feedback: string }
  | { type: "final"; content: string }
  | { type: "error"; message: string; role?: AgentRole }
  | { type: "done"; totalDurationMs: number };

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
    instance,
  };
  return content;
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
    analystContent = yield* forward(streamAgent(analyst, "draft", analystMessages));
  } catch (e) {
    yield { type: "error", role: "analyst", message: `Analyst failed: ${errMsg(e)}` };
    return;
  }

  /* Stage 2: Writer draft */
  const writerDraftUser = buildWriterPrompt(input.userInput, analystContent);
  const writerMessages: ChatMessage[] = [
    { role: "system", content: writer.systemPrompt },
    ...history,
    { role: "user", content: writerDraftUser },
  ];
  let writerDraft: string;
  try {
    writerDraft = yield* forward(streamAgent(writer, "draft", writerMessages));
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
    criticContent = yield* forward(streamAgent(critic, "draft", criticMessages));
  } catch (e) {
    yield { type: "error", role: "critic", message: `Critic failed: ${errMsg(e)}` };
    yield { type: "final", content: writerDraft };
    yield { type: "done", totalDurationMs: Date.now() - t0 };
    return;
  }

  const verdict = parseCriticVerdict(criticContent);
  yield { type: "verdict", approved: verdict.approved, feedback: verdict.feedback };

  let finalContent = writerDraft;

  /* Stage 4: Writer revision (optional) */
  if (!verdict.approved && maxRevisions > 0) {
    const reviseUser = buildRevisePrompt(input.userInput, writerDraft, verdict.feedback);
    const reviseMessages: ChatMessage[] = [
      { role: "system", content: writer.systemPrompt },
      ...history,
      { role: "user", content: reviseUser },
    ];
    try {
      finalContent = yield* forward(streamAgent(writer, "revision", reviseMessages));
    } catch (e) {
      yield { type: "error", role: "writer", message: `Writer revision failed: ${errMsg(e)}` };
      finalContent = writerDraft;
    }
  }

  yield { type: "final", content: finalContent };
  yield { type: "done", totalDurationMs: Date.now() - t0 };
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
    analystContent = yield* forward(streamAgent(analyst, "draft", analystMessages));
  } catch (e) {
    yield { type: "error", role: "analyst", message: `Analyst failed: ${errMsg(e)}` };
    return;
  }

  /* Stage 2: Two writers in parallel */
  const writerUserPrompt = buildWriterPrompt(input.userInput, analystContent);
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
    const results = yield* mergeStreams<OrchestratorEvent, string>([streamA, streamB]);
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
    finalContent = yield* forward(streamAgent(judge, "judge", judgeMessages));
  } catch (e) {
    yield { type: "error", role: "critic", message: `Judge failed: ${errMsg(e)}` };
    // Pick the longer draft as a defensive fallback.
    finalContent = draftA.length >= draftB.length ? draftA : draftB;
  }

  yield { type: "final", content: finalContent };
  yield { type: "done", totalDurationMs: Date.now() - t0 };
}

/* ═══════════════════════════════════════════════════════════════════════
   Public entry point
   ═══════════════════════════════════════════════════════════════════════ */

export async function* runMultiAgent(
  input: OrchestratorInput
): AsyncGenerator<OrchestratorEvent> {
  const t0 = Date.now();
  const strategy: PipelineStrategy = input.strategy === "parallel" ? "parallel" : "sequential";

  const analyst = buildAgent("analyst", input.overrides?.analyst);
  const writer = buildAgent("writer", input.overrides?.writer);

  if (strategy === "parallel") {
    if (!analyst || !writer) {
      yield {
        type: "error",
        message: noProviderMsg(),
      };
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

function noProviderMsg(): string {
  return "No AI provider is configured. Add ANTHROPIC_API_KEY (or OPENAI / GEMINI / DEEPSEEK / GROK) to backend env.";
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
