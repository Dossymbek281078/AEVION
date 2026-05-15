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

import { getProviders } from "./providers";

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

/** Per-role hardcoded defaults — used when the user hasn't picked a provider. */
const ROLE_DEFAULTS: Record<AgentRole, { provider: string; model: string; temperature: number; systemPrompt: string }> = {
  analyst: {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    temperature: 0.3,
    systemPrompt: ANALYST_PROMPT,
  },
  writer: {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
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
