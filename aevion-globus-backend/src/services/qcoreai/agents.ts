/**
 * Default agent configuration for the QCoreAI multi-agent pipeline.
 *
 * The pipeline runs three specialized roles:
 *   - Analyst  — decomposes the task, extracts facts, risks, plan
 *   - Writer   — drafts the user-facing answer following the plan
 *   - Critic   — reviews the draft, returns APPROVE or REVISE + fixes
 *
 * A fourth, optional stage (Writer revision) fires when the Critic says
 * REVISE. Role defaults are tuned per role: the Critic uses a faster/cheaper
 * model by default; Analyst and Writer use a more capable one.
 */

import { getProviders, getFreeProviders, Provider } from "./providers";

export type AgentRole = "analyst" | "writer" | "critic";

export type AgentConfig = {
  role: AgentRole;
  provider: string;
  model: string;
  systemPrompt: string;
  temperature: number;
};

export type AgentOverride = Partial<Pick<AgentConfig, "provider" | "model" | "systemPrompt" | "temperature">>;

/** Human-visible label (English; UI may translate). */
export const AGENT_LABELS: Record<AgentRole, string> = {
  analyst: "Analyst",
  writer: "Writer",
  critic: "Critic",
};

const ANALYST_PROMPT = [
  "You are the Analyst agent in a multi-agent AI team working inside the AEVION platform.",
  "Your job: read the user's request and produce a compact analytical brief for the Writer agent.",
  "Do NOT write the final answer — that is the Writer's job.",
  "",
  "In your brief, cover:",
  "  1. Core intent (one sentence).",
  "  2. Key facts / definitions the Writer must get right.",
  "  3. A short step-by-step plan of what the answer should contain.",
  "  4. Risks / traps / common mistakes to avoid.",
  "",
  "Format: terse markdown with short bullets. Stay under ~400 words.",
  "Respond in the same language the user used.",
].join("\n");

const WRITER_PROMPT = [
  "You are the Writer agent. You receive:",
  "  - the user's original question,",
  "  - the Analyst's brief (plan + facts + risks).",
  "",
  "Produce the final, user-facing answer by following the Analyst's plan.",
  "Be concrete, complete, and clear. Match the user's language.",
  "Do not mention the Analyst or the multi-agent process — just answer the user.",
  "Prefer short paragraphs and light markdown (headings/lists) when it helps readability.",
].join("\n");

const CRITIC_PROMPT = [
  "You are the Critic agent. You receive:",
  "  - the user's question,",
  "  - the Analyst's brief,",
  "  - the Writer's draft answer.",
  "",
  "Review the Writer's draft against the user's question and the Analyst's plan.",
  "Judge correctness, completeness, clarity, tone and language match.",
  "",
  "Output format (STRICT):",
  "  - If the draft is good enough: first line must be exactly 'APPROVE'.",
  "    You may add a one-line note after, nothing more.",
  "  - Otherwise: first line must be exactly 'REVISE'.",
  "    Then list concrete, actionable fixes as bullets. Be specific.",
  "",
  "Be strict but fair. Do NOT rewrite the draft — only evaluate and request fixes.",
].join("\n");

const WRITER_B_PROMPT = [
  "You are Writer B, an alternative voice in a two-Writer team.",
  "You receive the same user question and Analyst brief as Writer A, but your job is to produce a DIFFERENT angle:",
  "  - Prefer a more concise, structured style (headings + tight bullets).",
  "  - Lead with the bottom-line answer, then supporting detail.",
  "  - Challenge any assumption in the Analyst's brief that looks fragile.",
  "",
  "Do not mention Writer A or the multi-agent process — just deliver your answer.",
  "Match the user's language.",
].join("\n");

const JUDGE_PROMPT = [
  "You are the Judge agent. Two independent Writers (A and B) produced candidate answers to the same question.",
  "You receive the user's question, the Analyst's brief, and BOTH drafts.",
  "",
  "Produce the final answer for the user. Either:",
  "  (a) pick the stronger draft and output it verbatim, or",
  "  (b) synthesize a merged answer that takes the best parts of each.",
  "",
  "Output ONLY the final answer. No preamble, no meta commentary, no 'Draft A was better'.",
  "Match the user's language.",
].join("\n");

const PRO_PROMPT = [
  "You are the Pro advocate in a structured debate about the user's question.",
  "Your job: argue the strongest possible case FOR the most natural solution / position / recommendation that the user's question invites.",
  "Be assertive and specific — cite concrete benefits, real-world evidence, and realistic timelines.",
  "Acknowledge one or two trade-offs briefly, but end with a clear, confident recommendation IN FAVOR.",
  "Do not mention the other advocate or the multi-agent process. Do not hedge into balance — that is the Moderator's job.",
  "Match the user's language. Use light markdown (short headings, tight bullets).",
].join("\n");

const CON_PROMPT = [
  "You are the Con advocate in a structured debate about the user's question.",
  "Your job: stress-test the naive answer with the strongest possible counter-case.",
  "Call out risks, hidden assumptions, failure modes, edge cases, and better alternatives.",
  "Be constructive, not contrarian for its own sake — concede points the Pro side gets right, but make your objections land.",
  "End with a clear recommendation AGAINST (or for a safer alternative), with the critical condition that would change your mind.",
  "Do not mention the other advocate or the multi-agent process. Match the user's language.",
].join("\n");

const MODERATOR_PROMPT = [
  "You are the Moderator of a structured debate. You receive:",
  "  - the user's question,",
  "  - the Analyst's brief,",
  "  - the Pro advocate's argument,",
  "  - the Con advocate's argument.",
  "",
  "Produce a single honest, balanced answer for the user:",
  "  1. State the bottom-line recommendation up front (one line).",
  "  2. Acknowledge the strongest point from each side.",
  "  3. Give the nuanced, defensible answer — including the conditions under which the recommendation flips.",
  "",
  "Output ONLY the final answer. No 'Pro said / Con said' commentary, no meta. Match the user's language.",
].join("\n");

export const WRITER_REVISE_INSTRUCTION = [
  "Rewrite your previous draft applying ALL fixes requested by the Critic.",
  "Keep the parts that were fine; only change what the Critic flagged.",
  "Output the full revised answer (not just the diff).",
  "Match the user's language.",
].join("\n");

/**
 * Resolve which concrete provider+model to use for a role, given:
 *   - a preferred provider (from config / user override)
 *   - a preferred model (optional)
 *   - fallback: any configured provider
 *
 * If no provider is configured at all, returns null (caller should surface
 * a helpful "configure API key" error to the UI).
 */
export function resolveRoleProvider(
  preferredProvider: string | undefined,
  preferredModel: string | undefined,
  roleDefault: { provider: string; model: string }
): { provider: string; model: string } | null {
  const providers = getProviders();
  const byId = (id: string) => providers.find((p) => p.id === id);

  // 1. explicit user choice
  if (preferredProvider && byId(preferredProvider)?.configured) {
    const p = byId(preferredProvider)!;
    const model = preferredModel && p.models.includes(preferredModel) ? preferredModel : p.defaultModel;
    return { provider: p.id, model };
  }

  // 2. role default (e.g. critic prefers Haiku)
  const def = byId(roleDefault.provider);
  if (def?.configured) {
    const model = def.models.includes(roleDefault.model) ? roleDefault.model : def.defaultModel;
    return { provider: def.id, model };
  }

  // 3. any configured provider
  for (const p of providers) {
    if (p.configured) return { provider: p.id, model: p.defaultModel };
  }

  return null;
}

/**
 * Per-role hardcoded defaults — used when the user hasn't picked a provider.
 *
 * Cost-rational tiering (see providers.ts):
 *   - Analyst decomposes the task → Opus 4.8 (workhorse reasoning).
 *   - Writer drafts the answer     → Opus 4.8.
 *   - Critic gates the revision    → Haiku (cheap, fast; a strict grader
 *                                     doesn't need flagship depth).
 * The council strategy overrides this entirely: free models do the breadth,
 * a premium chair (Opus 4.8 by default) does the final synthesis
 * (see buildCouncil / buildSynthesizer).
 */
const ROLE_DEFAULTS: Record<AgentRole, { provider: string; model: string; temperature: number; systemPrompt: string }> = {
  analyst: {
    provider: "anthropic",
    model: "claude-opus-4-8",
    temperature: 0.3,
    systemPrompt: ANALYST_PROMPT,
  },
  writer: {
    provider: "anthropic",
    model: "claude-opus-4-8",
    temperature: 0.7,
    systemPrompt: WRITER_PROMPT,
  },
  critic: {
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
    temperature: 0.2,
    systemPrompt: CRITIC_PROMPT,
  },
};

/** Build a concrete agent config, merging override → role default → global fallback. */
export function buildAgent(role: AgentRole, override?: AgentOverride): AgentConfig | null {
  const def = ROLE_DEFAULTS[role];
  const resolved = resolveRoleProvider(override?.provider, override?.model, {
    provider: def.provider,
    model: def.model,
  });
  if (!resolved) return null;
  return {
    role,
    provider: resolved.provider,
    model: resolved.model,
    systemPrompt: override?.systemPrompt?.trim() || def.systemPrompt,
    temperature: typeof override?.temperature === "number" ? override.temperature : def.temperature,
  };
}

/**
 * Build a "Writer B" — a second writer for parallel mode. By default we try
 * hard to pick a DIFFERENT model (and ideally a different provider) than the
 * primary Writer, to get genuine diversity of perspective. Falls back to the
 * same provider/model if nothing else is configured.
 */
export function buildWriterB(
  primary: AgentConfig,
  override?: AgentOverride
): AgentConfig | null {
  const providers = getProviders();
  const configuredOthers = providers.filter((p) => p.configured && p.id !== primary.provider);

  // Explicit override wins.
  if (override?.provider || override?.model) {
    const built = buildAgent("writer", override);
    if (built) {
      return { ...built, systemPrompt: override.systemPrompt?.trim() || WRITER_B_PROMPT };
    }
  }

  // Prefer a different provider if any is configured.
  if (configuredOthers.length > 0) {
    const alt = configuredOthers[0];
    return {
      role: "writer",
      provider: alt.id,
      model: alt.defaultModel,
      systemPrompt: WRITER_B_PROMPT,
      temperature: 0.7,
    };
  }

  // Same provider — pick a different model in its list, if possible.
  const sameProv = providers.find((p) => p.id === primary.provider);
  if (sameProv) {
    const altModel = sameProv.models.find((m) => m !== primary.model) || sameProv.defaultModel;
    return {
      role: "writer",
      provider: primary.provider,
      model: altModel,
      systemPrompt: WRITER_B_PROMPT,
      temperature: 0.7,
    };
  }

  // Last resort — clone primary with just a different prompt.
  return { ...primary, systemPrompt: WRITER_B_PROMPT };
}

/**
 * Build a Judge agent. Under the hood it uses the Critic's slot (fast model
 * makes sense for judging too), but with the JUDGE_PROMPT so the output is a
 * direct final answer instead of APPROVE/REVISE.
 */
export function buildJudge(override?: AgentOverride): AgentConfig | null {
  const built = buildAgent("critic", override);
  if (!built) return null;
  return {
    ...built,
    role: "critic",
    systemPrompt: override?.systemPrompt?.trim() || JUDGE_PROMPT,
    // Judge benefits from a slightly higher temperature to merge smoothly.
    temperature: typeof override?.temperature === "number" ? override.temperature : 0.4,
  };
}

/** Build the Pro advocate — writer role with PRO_PROMPT. Used by the debate strategy. */
export function buildPro(override?: AgentOverride): AgentConfig | null {
  const built = buildAgent("writer", override);
  if (!built) return null;
  return {
    ...built,
    systemPrompt: override?.systemPrompt?.trim() || PRO_PROMPT,
    temperature: typeof override?.temperature === "number" ? override.temperature : 0.65,
  };
}

/** Build the Con advocate — writer role with CON_PROMPT. Picks a different model than Pro where possible. */
export function buildCon(pro: AgentConfig, override?: AgentOverride): AgentConfig | null {
  // Reuse the Writer-B mechanic (prefer different provider / different model).
  const alt = buildWriterB(pro, override);
  if (!alt) return null;
  return {
    ...alt,
    systemPrompt: override?.systemPrompt?.trim() || CON_PROMPT,
    temperature: typeof override?.temperature === "number" ? override.temperature : 0.7,
  };
}

/** Build the Moderator — like Judge but with a balancing/synthesis prompt. */
export function buildModerator(override?: AgentOverride): AgentConfig | null {
  const built = buildAgent("critic", override);
  if (!built) return null;
  return {
    ...built,
    role: "critic",
    systemPrompt: override?.systemPrompt?.trim() || MODERATOR_PROMPT,
    temperature: typeof override?.temperature === "number" ? override.temperature : 0.4,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   Council strategy — a swarm of (mostly free) models drafts in parallel, then
   a premium Synthesizer (Opus 4.8 by default) fuses the drafts into one
   verified answer. This is QCoreAI's differentiator over "N models side by
   side" tools: free breadth + premium depth, cost-tiered automatically.
   ═══════════════════════════════════════════════════════════════════════ */

export type CouncilMember = AgentConfig & { persona: string };

/** Distinct diversity lenses cycled across council members. */
const COUNCIL_PERSONAS: { key: string; prompt: string }[] = [
  {
    key: "Rigorous",
    prompt:
      "You are a rigorous, analytical council member. Prioritise correctness, precise definitions, " +
      "and step-by-step reasoning. State assumptions explicitly. If something is uncertain, say so.",
  },
  {
    key: "Creative",
    prompt:
      "You are a lateral-thinking council member. Offer the non-obvious angle, alternative framings, " +
      "and ideas the others will likely miss. Be bold but keep it grounded and useful.",
  },
  {
    key: "Skeptic",
    prompt:
      "You are the skeptical council member. Stress-test the naive answer: name the risks, hidden " +
      "assumptions, edge cases, and failure modes. Prefer being right over being agreeable.",
  },
  {
    key: "Pragmatist",
    prompt:
      "You are the pragmatic council member. Give the shortest path to a working, real-world answer. " +
      "Concrete steps, defaults, and trade-offs over theory. Lead with the bottom line.",
  },
  {
    key: "Domain",
    prompt:
      "You are the domain-expert council member. Bring specialist depth, correct terminology, and the " +
      "one detail a non-expert would get wrong. Cite the reasoning, not just the conclusion.",
  },
];

/**
 * Aggregator prompt for intermediate MoA layers. Unlike the final Synthesizer
 * (which produces the user-facing answer), an aggregator REFINES: it reads the
 * previous layer's responses and emits one improved answer that the NEXT layer
 * (or the final Synthesizer) will consume. Based on the Mixture-of-Agents
 * aggregate-and-synthesize prompt (Wang et al., ICLR 2025).
 */
export const AGGREGATOR_PROMPT = [
  "You are an aggregation model in a multi-layer council. You will receive several",
  "independent responses to the same user question from different AI models.",
  "",
  "Your task: synthesize them into a SINGLE, higher-quality response.",
  "  - Critically evaluate each response for accuracy — do NOT copy errors or bias.",
  "  - Keep what is correct and well-argued; discard what is wrong or unsupported.",
  "  - Fill gaps the individual responses missed. Improve structure and completeness.",
  "",
  "Output only your improved answer to the user's question. No meta commentary about",
  "the other responses. Match the user's language.",
].join("\n");

const SYNTHESIZER_PROMPT = [
  "You are the Synthesizer — the chair of a multi-model council. Several independent AI models",
  "(each with a different persona and, often, a different vendor) answered the SAME question.",
  "You receive the user's question and every council member's answer, labelled by persona.",
  "",
  "Your job — produce the single best final answer for the user:",
  "  1. Cross-check the members against each other. Where they AGREE, treat it as high-confidence.",
  "  2. Where they DISAGREE or one contradicts a fact, adjudicate: keep what is correct, discard",
  "     what is wrong. Do not average away a correct minority view.",
  "  3. Merge the strongest, most correct, most complete parts into one coherent answer.",
  "  4. Silently fix any factual or reasoning errors you can verify.",
  "",
  "Output ONLY the final answer for the user. No 'Member 1 said…', no meta commentary about the",
  "council process. Match the user's language. Use light markdown when it helps readability.",
].join("\n");

/**
 * Enumerate concrete { provider, model } slots ordered by preference. Free
 * providers first (each expanded across its model list for diversity), then
 * budget, then premium. Used to auto-assemble a council even when the operator
 * has only configured one vendor.
 */
function enumerateCandidateModels(preferFree: boolean, localOnly = false): { provider: string; model: string }[] {
  const providers = getProviders().filter((p) => p.configured && (!localOnly || p.local));
  const rank = (p: Provider) =>
    preferFree
      ? p.tier === "free" ? 0 : p.tier === "budget" ? 1 : 2
      : p.tier === "premium" ? 0 : p.tier === "budget" ? 1 : 2;
  const ordered = [...providers].sort((a, b) => rank(a) - rank(b));

  const out: { provider: string; model: string }[] = [];
  // First pass: one default model per provider (maximise vendor diversity).
  for (const p of ordered) out.push({ provider: p.id, model: p.defaultModel });
  // Second pass: extra models within each provider (fill remaining slots).
  for (const p of ordered) {
    for (const m of p.models) {
      if (m === p.defaultModel) continue;
      out.push({ provider: p.id, model: m });
    }
  }
  return out;
}

/**
 * Build up to `maxMembers` council members. Prefers configured FREE providers
 * (the "crowd"); each member gets a distinct persona + a slightly varied
 * temperature for genuine diversity. Degrades gracefully: with only one vendor
 * configured it spreads across that vendor's models; with none configured it
 * returns []. `override` (from the writer slot) lets a caller pin a base
 * provider/model for the whole council. `opts.localOnly` restricts the crowd
 * to local runtimes so the whole council works with the internet off.
 */
export function buildCouncil(
  maxMembers: number,
  override?: AgentOverride,
  opts?: { localOnly?: boolean }
): CouncilMember[] {
  const n = Math.max(2, Math.min(6, Math.floor(maxMembers) || 3));
  const localOnly = opts?.localOnly === true;

  // If the caller pinned a provider, honour it for every member (varied models
  // where possible); otherwise auto-assemble preferring free vendors. Under
  // localOnly a non-local pin is ignored — we always draw from local runtimes.
  let slots: { provider: string; model: string }[];
  const pinned = override?.provider
    ? getProviders().find((x) => x.id === override.provider && x.configured && (!localOnly || x.local))
    : undefined;
  if (pinned) {
    const models = override!.model && pinned.models.includes(override!.model)
      ? [override!.model, ...pinned.models.filter((m) => m !== override!.model)]
      : pinned.models;
    slots = models.map((m) => ({ provider: pinned.id, model: m }));
  } else {
    // Auto-assemble preferring free vendors; enumerateCandidateModels still
    // returns budget/premium slots when no free vendor is configured, so the
    // council degrades gracefully to whatever exists. localOnly restricts to
    // local runtimes (returns [] when none is configured → caller errors out).
    slots = enumerateCandidateModels(true, localOnly);
  }

  const members: CouncilMember[] = [];
  const tempCycle = [0.4, 0.75, 0.9, 0.55, 1.0, 0.65];
  for (let i = 0; i < slots.length && members.length < n; i++) {
    const persona = COUNCIL_PERSONAS[members.length % COUNCIL_PERSONAS.length];
    members.push({
      role: "writer",
      provider: slots[i].provider,
      model: slots[i].model,
      systemPrompt: override?.systemPrompt?.trim() || persona.prompt,
      temperature: typeof override?.temperature === "number" ? override.temperature : tempCycle[members.length % tempCycle.length],
      persona: persona.key,
    });
  }
  return members;
}

/**
 * Build the Synthesizer — the council chair. Defaults to Opus 4.8: a 16-Q
 * benchmark (2026-07-09) showed the Opus chair matches Fable 5's 92% win-rate
 * over a single flagship at 2.8× the flagship cost vs Fable's 3.6× — same
 * quality, ~23% cheaper. Fable 5 stays available for max-stakes runs via the
 * `synthModel` override or the QCOREAI_SYNTH_MODEL env. This is where the
 * premium spend goes: one high-quality fusion over many cheap drafts.
 *
 * `opts.localOnly` forces a LOCAL chair (Ollama/LM Studio/…): the whole council
 * then runs with the internet off. A cloud override provider is ignored in that
 * mode; returns null when no local runtime is configured.
 */
export function buildSynthesizer(
  override?: AgentOverride,
  opts?: { localOnly?: boolean }
): AgentConfig | null {
  const localOnly = opts?.localOnly === true;

  // Explicit override wins — but under localOnly only if it names a local,
  // configured provider (otherwise we'd break the offline guarantee).
  if (override?.provider) {
    const p = getProviders().find((x) => x.id === override.provider && x.configured);
    if (p && (!localOnly || p.local)) {
      const built = buildAgent("critic", override);
      if (built) return { ...built, role: "critic", systemPrompt: override.systemPrompt?.trim() || SYNTHESIZER_PROMPT, temperature: 0.4 };
    }
  }

  // Offline chair: pick the strongest local runtime available (its default
  // model is usually the largest one the operator pulled). No cloud fallback.
  if (localOnly) {
    const chair = getProviders().find((p) => p.configured && p.local);
    if (!chair) return null;
    const model = override?.model && chair.models.includes(override.model)
      ? override.model
      : chair.defaultModel;
    return {
      role: "critic",
      provider: chair.id,
      model,
      systemPrompt: override?.systemPrompt?.trim() || SYNTHESIZER_PROMPT,
      temperature: 0.4,
    };
  }

  const anthropic = getProviders().find((p) => p.id === "anthropic" && p.configured);
  if (anthropic) {
    // Chair model: env override → best-quality/cost default (Opus 4.8) →
    // Fable 5 → provider default. Env lets ops flip the chair without a deploy.
    const envModel = process.env.QCOREAI_SYNTH_MODEL?.trim();
    const model = envModel && anthropic.models.includes(envModel)
      ? envModel
      : anthropic.models.includes("claude-opus-4-8")
        ? "claude-opus-4-8"
        : anthropic.models.includes("claude-fable-5")
          ? "claude-fable-5"
          : anthropic.defaultModel;
    return {
      role: "critic",
      provider: "anthropic",
      model,
      systemPrompt: override?.systemPrompt?.trim() || SYNTHESIZER_PROMPT,
      temperature: 0.4,
    };
  }

  // No Anthropic — synthesise with the best non-free provider, else anything.
  const providers = getProviders().filter((p) => p.configured);
  const best =
    providers.find((p) => p.tier === "premium") ||
    providers.find((p) => p.tier === "budget") ||
    providers[0];
  if (!best) return null;
  return {
    role: "critic",
    provider: best.id,
    model: best.defaultModel,
    systemPrompt: override?.systemPrompt?.trim() || SYNTHESIZER_PROMPT,
    temperature: 0.4,
  };
}

/**
 * Parse the Critic's verdict. First non-empty line is the decision token.
 *  - APPROVE → approved
 *  - REVISE  → revision requested, rest of the text is feedback
 *  - anything else → treated as implicit approval (defensive fallback)
 */
export function parseCriticVerdict(raw: string): { approved: boolean; feedback: string } {
  const trimmed = (raw || "").trim();
  if (!trimmed) return { approved: true, feedback: "" };
  const firstLine = trimmed.split("\n", 1)[0].trim().toUpperCase();
  if (firstLine.startsWith("APPROVE")) return { approved: true, feedback: trimmed };
  if (firstLine.startsWith("REVISE")) {
    const feedback = trimmed.replace(/^REVISE[:\s]*/i, "").trim();
    return { approved: false, feedback };
  }
  // Unknown verdict — don't block; treat as approve but keep note.
  return { approved: true, feedback: trimmed };
}
