/**
 * QCoreAI vs. other multi-agent frameworks — comparison data.
 *
 * Every "yes" here maps to a real, checkable code path in this repo (see the
 * `source` field). Where a competitor plausibly does something too, that's
 * marked "partial", not "no" — the point is a defensible technical
 * comparison, not a marketing sweep. Update alongside docs/benchmarks/ when
 * a fresh qcore-eval.js run changes the cited numbers.
 */

export type SystemId = "qcoreai" | "autogen" | "crewai" | "langgraph" | "openai-agents" | "metagpt";

export type System = {
  id: SystemId;
  name: string;
  maker: string;
  isUs?: boolean;
};

export const SYSTEMS: System[] = [
  { id: "qcoreai", name: "QCoreAI", maker: "AEVION", isUs: true },
  { id: "autogen", name: "AutoGen", maker: "Microsoft" },
  { id: "crewai", name: "CrewAI", maker: "crewAI Inc." },
  { id: "langgraph", name: "LangGraph", maker: "LangChain" },
  { id: "openai-agents", name: "Agents SDK", maker: "OpenAI" },
  { id: "metagpt", name: "MetaGPT", maker: "DeepWisdom" },
];

export type Verdict = "yes" | "partial" | "no";

export type Row = {
  id: string;
  label: string;
  detail: string;
  source?: string;
  values: Record<SystemId, { verdict: Verdict; note?: string }>;
};

export const ROWS: Row[] = [
  {
    id: "auto-routing",
    label: "Automatic cost routing",
    detail: "Classifies each query (fact vs. open-ended) and picks single-model vs. graded-depth Council automatically — no hand-built orchestration graph.",
    source: "orchestrator.ts — runAuto(), assessOpenDepth()",
    values: {
      qcoreai: { verdict: "yes" },
      autogen: { verdict: "no", note: "you wire the agent graph and model choice by hand" },
      crewai: { verdict: "no", note: "crew/process defined manually per task" },
      langgraph: { verdict: "no", note: "you author the state graph and routing logic" },
      "openai-agents": { verdict: "no", note: "handoffs are explicit, not cost-classified" },
      metagpt: { verdict: "no", note: "fixed SOP pipeline per role" },
    },
  },
  {
    id: "free-fleet",
    label: "Built-in free-tier model fleet",
    detail: "13 providers / 40+ models (OpenRouter, Groq, Cerebras, Mistral, Together, GitHub Models, NVIDIA NIM…) ship pre-wired as zero-cost Council members.",
    source: "providers.ts — OPENAI_COMPAT registry",
    values: {
      qcoreai: { verdict: "yes" },
      autogen: { verdict: "partial", note: "any OpenAI-compatible endpoint works, but none ship configured" },
      crewai: { verdict: "partial", note: "LiteLLM passthrough — bring your own keys" },
      langgraph: { verdict: "partial", note: "provider-agnostic, but no fleet shipped" },
      "openai-agents": { verdict: "no", note: "OpenAI-model-first by design" },
      metagpt: { verdict: "no", note: "OpenAI-model-first by design" },
    },
  },
  {
    id: "offline",
    label: "Fully offline / local-only mode",
    detail: "Ollama, LM Studio, Jan, LocalAI, llama.cpp all plug into the same adapter; `localOnly` degrades gracefully to whichever runtime is actually reachable.",
    source: "providers.ts local runtime adapters + agents.ts buildCouncil({localOnly})",
    values: {
      qcoreai: { verdict: "yes" },
      autogen: { verdict: "partial", note: "local models reachable via manual config, not a first-class mode" },
      crewai: { verdict: "partial", note: "same — DIY via LiteLLM/Ollama config" },
      langgraph: { verdict: "partial", note: "same — provider-agnostic, no shipped offline mode" },
      "openai-agents": { verdict: "no" },
      metagpt: { verdict: "no" },
    },
  },
  {
    id: "cost-dashboard",
    label: "Cross-module cost/savings accounting",
    detail: "Durable Postgres log of every routed run, aggregated per module with a live dashboard — not just a per-run token count.",
    source: "smartComplete.ts + smartRunLog.ts + /admin/ai-spend",
    values: {
      qcoreai: { verdict: "yes" },
      autogen: { verdict: "no", note: "per-run usage prints only" },
      crewai: { verdict: "no", note: "per-run usage prints only" },
      langgraph: { verdict: "partial", note: "LangSmith adds this — separate paid product" },
      "openai-agents": { verdict: "partial", note: "built-in tracing, no cost dashboard" },
      metagpt: { verdict: "no" },
    },
  },
  {
    id: "eval-harness",
    label: "Built-in eval harness (DB-backed + LLM judge)",
    detail: "User-authored suites (contains/regex/llm_judge) run against any strategy, persisted with pollable progress — not a separate project you bolt on.",
    source: "evalRunner.ts + POST /api/qcoreai/eval/suites",
    values: {
      qcoreai: { verdict: "yes" },
      autogen: { verdict: "partial", note: "AutoGenBench exists as a separate, unintegrated project" },
      crewai: { verdict: "no", note: "test utilities, no persisted LLM-judge harness" },
      langgraph: { verdict: "partial", note: "LangSmith adds this — separate paid product" },
      "openai-agents": { verdict: "partial", note: "tracing only, no scored eval suites" },
      metagpt: { verdict: "no" },
    },
  },
  {
    id: "resilience",
    label: "Health-aware member selection",
    detail: "A flaky provider's recent failures sink it below healthy ones in council slot ordering, on top of non-fatal per-agent failure handling.",
    source: "providerHealth.ts + agents.ts enumerateCandidateModels()",
    values: {
      qcoreai: { verdict: "yes" },
      autogen: { verdict: "partial", note: "HTTP-level retry only, no cross-run health memory" },
      crewai: { verdict: "partial", note: "HTTP-level retry only, no cross-run health memory" },
      langgraph: { verdict: "partial", note: "retry policies configurable, no health-scored selection" },
      "openai-agents": { verdict: "partial", note: "SDK-level retry only" },
      metagpt: { verdict: "no" },
    },
  },
  {
    id: "quality-benchmark",
    label: "Published Council-vs-single-model benchmark",
    detail: "N=40 pairwise-judged (order-randomised) benchmark: Council beats a single flagship on reasoning/writing/advice/analysis, ties only on pure factual recall — with a reproducible script, not a claim.",
    source: "scripts/qcore-eval.js — see docs/benchmarks/",
    values: {
      qcoreai: { verdict: "yes", note: "N=40, 2026-07-12 — see docs/benchmarks/" },
      autogen: { verdict: "no" },
      crewai: { verdict: "no" },
      langgraph: { verdict: "no" },
      "openai-agents": { verdict: "no" },
      metagpt: { verdict: "no" },
    },
  },
];
