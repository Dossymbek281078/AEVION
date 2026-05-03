"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl, getBackendOrigin } from "@/lib/apiBase";

/* ═══════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════ */

type AgentRole = "analyst" | "writer" | "critic";
type ConfigRoleId = "analyst" | "writer" | "writerB" | "critic";
type Stage = "draft" | "revision" | "judge";
type Strategy = "sequential" | "parallel" | "debate";

type ProviderInfo = {
  id: string;
  name: string;
  models: string[];
  defaultModel: string;
  configured: boolean;
};

type RoleDefault = {
  id: ConfigRoleId;
  label: string;
  description: string;
  default: { provider: string; model: string } | null;
  temperature: number;
};

type StrategyInfo = {
  id: Strategy;
  label: string;
  description: string;
  agents: ConfigRoleId[];
};

type PricingRow = {
  provider: string;
  model: string;
  inputPer1M: number;
  outputPer1M: number;
};

type AgentTurn = {
  role: AgentRole;
  stage: Stage;
  instance?: string;
  provider: string;
  model: string;
  content: string;
  status: "streaming" | "done";
  startedAt: number;
  durationMs?: number;
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
};

/** Mid-run human guidance entry. `beforeTurnIndex` is the index in
    `run.turns` of the agent stage this guidance was applied to (set when
    we receive `guidance_applied` — the next arriving `agent_start` will
    be at exactly that index). */
type GuidanceItem = {
  text: string;
  stage: Stage;
  role: AgentRole;
  instance?: string;
  appliedAt: number;
  beforeTurnIndex: number;
};

type RunState = {
  id: string;
  sessionId: string;
  userInput: string;
  turns: AgentTurn[];
  /** Set when the run hit its maxCostUsd budget cap and bailed early. */
  budgetExceeded?: { spentUsd: number; budgetUsd: number };
  /** Optional mid-run guidance items, rendered as inline chips before the
      agent stage they steered. */
  guidance?: GuidanceItem[];
  /** QRight objects pre-attached to this run (server-resolved from the
      requested IDs). */
  attachments?: QRightObjectLite[];
  verdict?: { approved: boolean; feedback: string };
  finalContent?: string;
  error?: string;
  status: "running" | "done" | "error" | "stopped";
  startedAt: number;
  totalDurationMs?: number;
  totalCostUsd?: number;
  strategy?: Strategy;
  agentConfig?: any;
  persisted?: boolean;
  shareToken?: string | null;
  /** Free-form tags attached by the owner (PATCH /runs/:id/tags). */
  tags?: string[];
};

type SessionSummary = {
  id: string;
  title: string;
  updatedAt: string;
  userId: string | null;
};

/** Saved agent preset — strategy + role overrides + revision count.
    Persisted in localStorage so users can reuse named role lineups
    (e.g. "Long-form essay", "Quick code review") without re-picking
    Provider/Model for each agent every time. */
type AgentPreset = {
  id: string;
  name: string;
  strategy: Strategy;
  overrides: Record<ConfigRoleId, { provider: string; model: string }>;
  maxRevisions: number;
};

const PRESETS_KEY = "qcore_presets_v1";

type SSEPayload =
  | { type: "session"; sessionId: string; runId: string }
  | {
      type: "plan";
      strategy: Strategy;
      analyst: { provider: string; model: string };
      writer: { provider: string; model: string };
      writerB?: { provider: string; model: string };
      critic: { provider: string; model: string };
      maxRevisions: number;
    }
  | { type: "agent_start"; role: AgentRole; stage: Stage; provider: string; model: string; instance?: string }
  | { type: "chunk"; role: AgentRole; stage: Stage; text: string; instance?: string }
  | {
      type: "agent_end";
      role: AgentRole;
      stage: Stage;
      content: string;
      tokensIn?: number;
      tokensOut?: number;
      durationMs: number;
      costUsd?: number;
      instance?: string;
    }
  | { type: "verdict"; approved: boolean; feedback: string }
  | { type: "final"; content: string }
  | { type: "error"; message: string; role?: AgentRole }
  | { type: "guidance_applied"; stage: Stage; role: AgentRole; text: string; instance?: string }
  | { type: "qright_attached"; items: { id: string; title: string | null; kind: string | null }[] }
  | { type: "budget_exceeded"; spentUsd: number; budgetUsd: number }
  | { type: "done"; totalDurationMs: number; totalCostUsd: number }
  | { type: "sse_end" };

type QRightObjectLite = {
  id: string;
  title: string | null;
  kind: string | null;
};

type TemplateItem = {
  id: string;
  ownerUserId: string;
  name: string;
  description: string | null;
  input: string;
  strategy: string;
  overrides: Record<string, { provider: string; model: string }>;
  isPublic: boolean;
  useCount: number;
};

/* ═══════════════════════════════════════════════════════════════════════
   Role styling
   ═══════════════════════════════════════════════════════════════════════ */

type RoleVisual = { color: string; bg: string; tag: string; label: string; desc: string };

const ROLE_STYLE: Record<string, RoleVisual> = {
  analyst: { color: "#2563eb", bg: "rgba(37,99,235,0.08)",  tag: "A",  label: "Analyst",  desc: "Decomposes your request: plan, facts, risks" },
  writer:  { color: "#059669", bg: "rgba(5,150,105,0.08)",  tag: "W",  label: "Writer",   desc: "Drafts the final answer from the Analyst's plan" },
  writerB: { color: "#0891b2", bg: "rgba(8,145,178,0.08)",  tag: "W²", label: "Writer B", desc: "Parallel mode: second voice on a different model" },
  critic:  { color: "#d97706", bg: "rgba(217,119,6,0.08)",  tag: "C",  label: "Critic",   desc: "Approves draft or requests fixes (sequential) · synthesizes drafts (parallel/debate)" },
  pro:     { color: "#16a34a", bg: "rgba(22,163,74,0.08)",  tag: "✚",  label: "Pro",      desc: "Debate mode: argues the case IN FAVOR" },
  con:     { color: "#dc2626", bg: "rgba(220,38,38,0.08)",  tag: "✕",  label: "Con",      desc: "Debate mode: argues the counter-case" },
  moderator: { color: "#7c3aed", bg: "rgba(124,58,237,0.08)", tag: "M", label: "Moderator", desc: "Debate mode: synthesizes a balanced answer" },
  judge:   { color: "#d97706", bg: "rgba(217,119,6,0.08)",  tag: "J",  label: "Judge",    desc: "Parallel mode: picks or merges drafts" },
};

const FINAL_STYLE = { color: "#7c3aed", bg: "rgba(124,58,237,0.08)" };

/** Pick the visual style for a turn using role + stage + instance + strategy. */
function turnStyle(role: AgentRole, stage: Stage, instance?: string, strategy?: Strategy): RoleVisual {
  if (role === "writer" && instance === "pro") return ROLE_STYLE.pro;
  if (role === "writer" && instance === "con") return ROLE_STYLE.con;
  if (role === "writer" && instance === "b") return ROLE_STYLE.writerB;
  if (role === "writer") return ROLE_STYLE.writer;
  if (role === "analyst") return ROLE_STYLE.analyst;
  if (role === "critic" && stage === "judge") {
    return strategy === "debate" ? ROLE_STYLE.moderator : ROLE_STYLE.judge;
  }
  return ROLE_STYLE.critic;
}

/** Label a role slot for display based on the active strategy. */
function roleSlotLabel(id: ConfigRoleId, strategy: Strategy): string {
  if (id === "writer" && strategy === "debate") return "Pro";
  if (id === "writerB" && strategy === "debate") return "Con";
  if (id === "writer" && strategy === "parallel") return "Writer A";
  if (id === "writerB" && strategy === "parallel") return "Writer B";
  if (id === "critic" && strategy === "debate") return "Moderator";
  if (id === "critic" && strategy === "parallel") return "Judge";
  if (id === "critic") return "Critic";
  if (id === "writer") return "Writer";
  if (id === "writerB") return "Writer B";
  return "Analyst";
}

/** Pick role style for a config slot depending on strategy. */
function roleSlotStyle(id: ConfigRoleId, strategy: Strategy): RoleVisual {
  if (strategy === "debate") {
    if (id === "writer") return ROLE_STYLE.pro;
    if (id === "writerB") return ROLE_STYLE.con;
    if (id === "critic") return ROLE_STYLE.moderator;
  }
  if (strategy === "parallel" && id === "critic") return ROLE_STYLE.judge;
  return ROLE_STYLE[id] || ROLE_STYLE.analyst;
}

const prettyModel = (m: string) => {
  const map: Record<string, string> = {
    "claude-sonnet-4-20250514": "Claude Sonnet 4",
    "claude-haiku-4-5-20251001": "Claude Haiku 4.5",
    "gpt-4o": "GPT-4o",
    "gpt-4o-mini": "GPT-4o Mini",
    "gpt-4-turbo": "GPT-4 Turbo",
    "gemini-2.5-flash": "Gemini 2.5 Flash",
    "gemini-2.0-flash-001": "Gemini 2.0 Flash",
    "gemini-1.5-pro": "Gemini 1.5 Pro",
    "deepseek-chat": "DeepSeek Chat",
    "deepseek-reasoner": "DeepSeek Reasoner",
    "grok-3": "Grok 3",
    "grok-3-mini": "Grok 3 Mini",
  };
  return map[m] || m;
};

/* ═══════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════════ */

function bearerHeader(): HeadersInit {
  try {
    const t = typeof window !== "undefined" ? localStorage.getItem("aevion_auth_token_v1") : null;
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

/** Read SSE stream from a fetch Response, yielding parsed JSON payloads. */
async function* readSSE<T = unknown>(body: ReadableStream<Uint8Array>): AsyncGenerator<T> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) >= 0) {
        const block = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const dataLines: string[] = [];
        for (const rawLine of block.split("\n")) {
          const line = rawLine.replace(/\r$/, "");
          if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^\s/, ""));
        }
        if (!dataLines.length) continue;
        try {
          yield JSON.parse(dataLines.join("\n")) as T;
        } catch {
          /* skip malformed frames */
        }
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* noop */ }
  }
}

function formatDuration(ms?: number): string {
  if (ms == null) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatMoney(v?: number | null, precision = 4): string {
  if (v == null || !isFinite(v)) return "—";
  if (v === 0) return "$0";
  if (v < 0.0001) return "<$0.0001";
  return `$${v.toFixed(precision)}`;
}

/** Sum tokensIn/Out across a run's turns — used for live dashboard. */
function runStats(run: RunState): { tokensIn: number; tokensOut: number; costUsd: number; durationMs: number } {
  let tokensIn = 0, tokensOut = 0, costUsd = 0, durationMs = 0;
  for (const t of run.turns) {
    tokensIn += t.tokensIn ?? 0;
    tokensOut += t.tokensOut ?? 0;
    costUsd += t.costUsd ?? 0;
    durationMs += t.durationMs ?? 0;
  }
  return { tokensIn, tokensOut, costUsd, durationMs };
}

/* ═══════════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════════ */

export default function QCoreMultiAgentPage() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [roleDefaults, setRoleDefaults] = useState<RoleDefault[]>([]);
  const [strategies, setStrategies] = useState<StrategyInfo[]>([]);
  const [pricing, setPricing] = useState<PricingRow[]>([]);
  const [strategy, setStrategy] = useState<Strategy>("sequential");
  const [overrides, setOverrides] = useState<Record<ConfigRoleId, { provider: string; model: string }>>({
    analyst: { provider: "", model: "" },
    writer: { provider: "", model: "" },
    writerB: { provider: "", model: "" },
    critic: { provider: "", model: "" },
  });
  // V6-P integration: per-role custom system prompt selection. Holds the
  // promptId that the orchestrator will fetch + inject as systemPrompt for
  // that role. Empty string = use the role's default prompt.
  const [promptSelections, setPromptSelections] = useState<Record<ConfigRoleId, string>>({
    analyst: "",
    writer: "",
    writerB: "",
    critic: "",
  });
  const [userPrompts, setUserPrompts] = useState<Array<{ id: string; name: string; role: string; version: number }>>([]);
  const [maxRevisions, setMaxRevisions] = useState(1);
  // Optional spend cap per run (USD). 0 = no cap. Persisted in localStorage
  // so investors don't accidentally start a $5 run during a demo.
  const [maxCostUsd, setMaxCostUsd] = useState(0);
  const [configOpen, setConfigOpen] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [presets, setPresets] = useState<AgentPreset[]>([]);
  const [savingPreset, setSavingPreset] = useState(false);
  const [presetName, setPresetName] = useState("");
  // V4-E agent marketplace
  const [marketplaceOpen, setMarketplaceOpen] = useState(false);
  const [marketplacePresets, setMarketplacePresets] = useState<Array<{
    id: string;
    name: string;
    description: string | null;
    strategy: string;
    overrides: any;
    importCount: number;
    updatedAt: string;
  }>>([]);
  const [marketplaceQuery, setMarketplaceQuery] = useState("");
  const [marketplaceBusy, setMarketplaceBusy] = useState(false);
  const [marketplaceShareFor, setMarketplaceShareFor] = useState<string | null>(null);
  const [marketplaceShareDesc, setMarketplaceShareDesc] = useState("");
  const [webhookConfigured, setWebhookConfigured] = useState(false);
  // Per-user webhook config (auth-required). null = not loaded yet,
  // undefined = loaded but user has no webhook set.
  const [userWebhook, setUserWebhook] = useState<{
    url: string;
    hasSecret: boolean;
    updatedAt: string;
  } | null | undefined>(null);
  const [whUrlInput, setWhUrlInput] = useState("");
  const [whSecretInput, setWhSecretInput] = useState("");
  const [whBusy, setWhBusy] = useState(false);
  // Sessions sidebar state — only honored on mobile via CSS, always-open on desktop.
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Mid-run guidance input value.
  const [guidanceText, setGuidanceText] = useState("");
  // QRight objects available to attach as context (lazy-loaded on first config-open).
  const [qrightObjects, setQrightObjects] = useState<QRightObjectLite[] | null>(null);
  const [attachedIds, setAttachedIds] = useState<string[]>([]);

  // V7-T: id of the run being continued (thread reply context).
  const [continueFromRunId, setContinueFromRunId] = useState<string | null>(null);
  // V7-Tmpl: run templates — save/load named input+strategy bundles.
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [publicTemplates, setPublicTemplates] = useState<TemplateItem[]>([]);
  const [templatePanelOpen, setTemplatePanelOpen] = useState(false);
  const [templateQuery, setTemplateQuery] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState("");
  const [saveTemplateFor, setSaveTemplateFor] = useState<string | null>(null);

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [runs, setRuns] = useState<RunState[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  // Sidebar quick-find + tag chip strip (feat/qcore-extras 2026-04-29).
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<Array<{
    runId: string; sessionId: string; sessionTitle: string;
    matched: "input" | "final" | "title" | "tag"; preview: string;
  }>>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [topTags, setTopTags] = useState<Array<{ tag: string; count: number }>>([]);
  // Inline refine state per-run.
  const [refineOpen, setRefineOpen] = useState<string | null>(null);
  const [refineText, setRefineText] = useState<string>("");
  const [refineBusy, setRefineBusy] = useState<boolean>(false);

  const timelineRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // True when user has manually scrolled up — pauses auto-scroll until they
  // return to the bottom. Prevents the streaming view from yanking the
  // viewport away while the user is reading an earlier turn.
  const userScrolledUpRef = useRef(false);
  // Tells `sendCompareAll` to stop firing remaining strategies. Set by Stop.
  const compareAbortRef = useRef(false);

  /* ── Load providers + role defaults + sessions + pricing on mount ── */
  useEffect(() => {
    (async () => {
      try {
        const [provRes, agRes, sessRes, priceRes, healthRes] = await Promise.all([
          fetch(apiUrl("/api/qcoreai/providers")),
          fetch(apiUrl("/api/qcoreai/agents")),
          fetch(apiUrl("/api/qcoreai/sessions"), { headers: bearerHeader() }),
          fetch(apiUrl("/api/qcoreai/pricing")),
          fetch(apiUrl("/api/qcoreai/health")),
        ]);
        const provData = await provRes.json().catch(() => ({}));
        const agData = await agRes.json().catch(() => ({}));
        const sessData = await sessRes.json().catch(() => ({}));
        const priceData = await priceRes.json().catch(() => ({}));
        const healthData = await healthRes.json().catch(() => ({}));
        if (typeof healthData?.webhookConfigured === "boolean") {
          setWebhookConfigured(healthData.webhookConfigured);
        }

        if (provData?.providers) setProviders(provData.providers);
        if (Array.isArray(agData?.strategies)) setStrategies(agData.strategies);
        if (Array.isArray(priceData?.table)) setPricing(priceData.table);
        if (Array.isArray(agData?.roles)) {
          setRoleDefaults(agData.roles);
          const next: Record<ConfigRoleId, { provider: string; model: string }> = {
            analyst: { provider: "", model: "" },
            writer: { provider: "", model: "" },
            writerB: { provider: "", model: "" },
            critic: { provider: "", model: "" },
          };
          for (const r of agData.roles as RoleDefault[]) {
            if (r.default) next[r.id] = { provider: r.default.provider, model: r.default.model };
          }
          setOverrides(next);
        }
        if (Array.isArray(sessData?.items)) setSessions(sessData.items);

        // V7-Tmpl: load user's own templates in the background.
        try {
          const [tmplRes, pubTmplRes] = await Promise.all([
            fetch(apiUrl("/api/qcoreai/templates"), { headers: bearerHeader() }),
            fetch(apiUrl("/api/qcoreai/templates/public?limit=20")),
          ]);
          const tmplData = await tmplRes.json().catch(() => ({}));
          const pubData = await pubTmplRes.json().catch(() => ({}));
          if (Array.isArray(tmplData?.items)) setTemplates(tmplData.items);
          if (Array.isArray(pubData?.items)) setPublicTemplates(pubData.items);
        } catch { /* templates are non-critical */ }
      } catch (e: any) {
        setGlobalError(e?.message || "Failed to load QCoreAI config");
      }
    })();
  }, []);

  /* ── Lazy-load user's prompts when config panel opens ── */
  useEffect(() => {
    if (!configOpen) return;
    if (typeof window === "undefined") return;
    const headers = bearerHeader();
    if (!("Authorization" in headers)) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(apiUrl("/api/qcoreai/prompts?limit=200"), { headers });
        if (!r.ok || cancelled) return;
        const data = await r.json();
        if (!cancelled) {
          setUserPrompts(
            (data.items || []).map((p: any) => ({
              id: p.id,
              name: p.name,
              role: p.role,
              version: p.version,
            }))
          );
        }
      } catch {
        /* ignore — prompts panel just stays empty */
      }
    })();
    return () => { cancelled = true; };
  }, [configOpen]);

  /* ── Lazy-load personal webhook config when config panel opens ── */
  useEffect(() => {
    if (!configOpen) return;
    if (userWebhook !== null) return;
    if (typeof window === "undefined") return;
    const token = (() => {
      try { return localStorage.getItem("aevion_auth_token_v1"); } catch { return null; }
    })();
    if (!token) {
      // Anonymous — there's no per-user config to load. Mark as undefined.
      setUserWebhook(undefined);
      return;
    }
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/qcoreai/me/webhook"), { headers: bearerHeader() });
        if (res.status === 404) {
          setUserWebhook(undefined);
          return;
        }
        if (!res.ok) {
          setUserWebhook(undefined);
          return;
        }
        const data = await res.json();
        setUserWebhook({
          url: data.url,
          hasSecret: !!data.hasSecret,
          updatedAt: data.updatedAt || "",
        });
      } catch {
        setUserWebhook(undefined);
      }
    })();
  }, [configOpen, userWebhook]);

  const saveUserWebhook = useCallback(async () => {
    const url = whUrlInput.trim();
    if (!url) return;
    setWhBusy(true);
    try {
      const res = await fetch(apiUrl("/api/qcoreai/me/webhook"), {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify({
          url,
          secret: whSecretInput.trim() ? whSecretInput.trim() : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setGlobalError(data?.error || `Webhook save failed: HTTP ${res.status}`);
        return;
      }
      setUserWebhook({
        url: data.url,
        hasSecret: !!data.hasSecret,
        updatedAt: data.updatedAt || "",
      });
      setWhUrlInput("");
      setWhSecretInput("");
    } catch (e: any) {
      setGlobalError(e?.message || "Webhook save failed");
    } finally {
      setWhBusy(false);
    }
  }, [whUrlInput, whSecretInput]);

  const removeUserWebhook = useCallback(async () => {
    setWhBusy(true);
    try {
      const res = await fetch(apiUrl("/api/qcoreai/me/webhook"), {
        method: "DELETE",
        headers: bearerHeader(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setGlobalError(data?.error || `Webhook delete failed: HTTP ${res.status}`);
        return;
      }
      setUserWebhook(undefined);
    } catch (e: any) {
      setGlobalError(e?.message || "Webhook delete failed");
    } finally {
      setWhBusy(false);
    }
  }, []);

  /* ── Lazy-load QRight objects when config panel opens (one fetch per page life) ── */
  useEffect(() => {
    if (!configOpen) return;
    if (qrightObjects !== null) return;
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/qright/objects"), { headers: bearerHeader() });
        if (!res.ok) {
          setQrightObjects([]);
          return;
        }
        const data = await res.json().catch(() => ({}));
        const items = Array.isArray(data?.items) ? data.items : [];
        setQrightObjects(
          items.slice(0, 50).map((o: any) => ({
            id: String(o?.id ?? ""),
            title: typeof o?.title === "string" ? o.title : null,
            kind: typeof o?.kind === "string" ? o.kind : null,
          })).filter((o: QRightObjectLite) => o.id)
        );
      } catch {
        setQrightObjects([]);
      }
    })();
  }, [configOpen, qrightObjects]);

  /* ── Load saved presets on mount ── */
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(PRESETS_KEY) : null;
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const safe = parsed.filter(
        (p): p is AgentPreset =>
          p && typeof p.id === "string" && typeof p.name === "string" &&
          p.overrides && typeof p.overrides === "object"
      );
      setPresets(safe);
    } catch { /* ignore corrupted storage */ }
  }, []);

  const persistPresets = useCallback((next: AgentPreset[]) => {
    setPresets(next);
    try {
      if (typeof window !== "undefined") localStorage.setItem(PRESETS_KEY, JSON.stringify(next));
    } catch { /* quota / privacy mode — keep state in memory */ }
  }, []);

  const savePreset = useCallback(() => {
    const name = presetName.trim();
    if (!name) return;
    // Overwrite same-name preset rather than duplicating.
    const next: AgentPreset[] = [
      ...presets.filter((p) => p.name !== name),
      {
        id: `p_${Date.now()}`,
        name,
        strategy,
        overrides,
        maxRevisions,
      },
    ];
    persistPresets(next);
    setPresetName("");
    setSavingPreset(false);
  }, [presetName, presets, strategy, overrides, maxRevisions, persistPresets]);

  const applyPreset = useCallback((p: AgentPreset) => {
    setStrategy(p.strategy);
    setOverrides(p.overrides);
    setMaxRevisions(p.maxRevisions);
  }, []);

  const deletePreset = useCallback((id: string) => {
    persistPresets(presets.filter((p) => p.id !== id));
  }, [presets, persistPresets]);

  /* ── V4-E Agent marketplace ── */
  const loadMarketplace = useCallback(async (q?: string) => {
    setMarketplaceBusy(true);
    try {
      const url = q
        ? apiUrl(`/api/qcoreai/presets/public?q=${encodeURIComponent(q)}`)
        : apiUrl(`/api/qcoreai/presets/public`);
      const res = await fetch(url, { headers: bearerHeader() });
      const data = await res.json().catch(() => ({}));
      if (Array.isArray(data?.items)) setMarketplacePresets(data.items);
    } catch { /* ignore */ } finally {
      setMarketplaceBusy(false);
    }
  }, []);

  const importMarketplacePreset = useCallback(async (id: string) => {
    try {
      const res = await fetch(apiUrl(`/api/qcoreai/presets/${encodeURIComponent(id)}/import`), {
        method: "POST",
        headers: bearerHeader(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.preset) throw new Error(data?.error || "import failed");
      const p = data.preset;
      // Add to localStorage presets — generate new local id, suffix collisions.
      const existingNames = new Set(presets.map((x) => x.name));
      let name = p.name;
      let n = 2;
      while (existingNames.has(name)) name = `${p.name} (${n++})`;
      const next: AgentPreset[] = [
        ...presets,
        {
          id: crypto.randomUUID(),
          name,
          strategy: (p.strategy === "parallel" || p.strategy === "debate" ? p.strategy : "sequential") as Strategy,
          overrides: (p.overrides && typeof p.overrides === "object" ? p.overrides : {}) as AgentPreset["overrides"],
          maxRevisions: typeof p.maxRevisions === "number" ? p.maxRevisions : 1,
        },
      ];
      persistPresets(next);
      // Refresh the list (importCount bumped server-side).
      void loadMarketplace(marketplaceQuery);
    } catch (e: any) {
      setGlobalError(e?.message || "import failed");
    }
  }, [presets, persistPresets, marketplaceQuery, loadMarketplace]);

  const sharePresetToMarketplace = useCallback(async (preset: AgentPreset, description: string) => {
    try {
      const res = await fetch(apiUrl(`/api/qcoreai/presets/share`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify({
          name: preset.name,
          description: description.trim() || null,
          strategy: preset.strategy,
          overrides: preset.overrides,
          isPublic: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setMarketplaceShareFor(null);
      setMarketplaceShareDesc("");
      // Refresh to show our new entry.
      if (marketplaceOpen) void loadMarketplace(marketplaceQuery);
    } catch (e: any) {
      setGlobalError(e?.message || "share failed");
    }
  }, [marketplaceOpen, marketplaceQuery, loadMarketplace]);

  /* ── Auto-scroll on new chunks (only if user is at the bottom) ── */
  useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;
    if (userScrolledUpRef.current) return;
    // Instant, not smooth — smooth queues animations during streaming and
    // ends up always one chunk behind.
    el.scrollTop = el.scrollHeight;
  }, [runs]);

  const onTimelineScroll = useCallback(() => {
    const el = timelineRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    userScrolledUpRef.current = distFromBottom > 80;
  }, []);

  /* ── Sidebar quick-find: debounced search across all the user's runs. ── */
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setSearchBusy(false);
      return;
    }
    setSearchBusy(true);
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          apiUrl(`/api/qcoreai/search?q=${encodeURIComponent(q)}`),
          { headers: bearerHeader(), signal: ctrl.signal }
        );
        const data = await res.json().catch(() => ({}));
        if (Array.isArray(data?.items)) setSearchResults(data.items);
        else setSearchResults([]);
      } catch {
        /* aborted or network */
      } finally {
        setSearchBusy(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [searchQuery]);

  /* ── Load top tags chip strip on mount. ── */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(apiUrl(`/api/qcoreai/tags?limit=20`), {
          headers: bearerHeader(),
        });
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        if (Array.isArray(data?.items)) setTopTags(data.items);
      } catch { /* ignore */ }
    })();
  }, []);

  /* ── Load a session's runs when selected ── */
  const loadSession = useCallback(async (sessionId: string) => {
    setBusy(false);
    setGlobalError(null);
    try {
      const res = await fetch(apiUrl(`/api/qcoreai/sessions/${sessionId}`), { headers: bearerHeader() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      const hydrated: RunState[] = (data.runs || []).map((r: any) => ({
        id: r.id,
        sessionId,
        userInput: r.userInput,
        turns: [],
        finalContent: r.finalContent ?? undefined,
        error: r.error ?? undefined,
        status: r.status,
        startedAt: Date.parse(r.startedAt) || Date.now(),
        totalDurationMs: r.totalDurationMs ?? undefined,
        totalCostUsd: r.totalCostUsd ?? undefined,
        strategy: r.strategy || undefined,
        agentConfig: r.agentConfig ?? undefined,
        persisted: true,
        shareToken: r.shareToken ?? null,
        tags: Array.isArray(r.tags) ? r.tags : [],
      }));
      setRuns(hydrated);
      setActiveSessionId(sessionId);
    } catch (e: any) {
      setGlobalError(e?.message || "Failed to load session");
    }
  }, []);

  const expandRunDetails = useCallback(async (runId: string) => {
    try {
      const res = await fetch(apiUrl(`/api/qcoreai/runs/${runId}`), { headers: bearerHeader() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      const all = (data.messages || []) as any[];

      // Hydrate agent turns (analyst / writer / critic).
      const agentMsgs = all.filter(
        (m) => m.role === "analyst" || m.role === "writer" || m.role === "critic"
      );
      const turns: AgentTurn[] = agentMsgs.map((m: any) => ({
        role: m.role,
        stage: (m.stage || "draft") as Stage,
        instance: m.instance ?? undefined,
        provider: m.provider || "",
        model: m.model || "",
        content: m.content || "",
        status: "done" as const,
        startedAt: Date.parse(m.createdAt) || 0,
        durationMs: m.durationMs ?? undefined,
        tokensIn: m.tokensIn ?? undefined,
        tokensOut: m.tokensOut ?? undefined,
        costUsd: m.costUsd ?? undefined,
      }));

      // Hydrate guidance + attachments. We rebuild beforeTurnIndex by
      // walking messages in order: each guidance message lands before the
      // next agent message (its position in the trace).
      const guidance: GuidanceItem[] = [];
      let agentIdxSoFar = 0;
      for (const m of all) {
        if (m.role === "analyst" || m.role === "writer" || m.role === "critic") {
          agentIdxSoFar++;
          continue;
        }
        if (m.role === "guidance") {
          guidance.push({
            text: m.content || "",
            stage: (m.stage || "draft") as Stage,
            role: "writer",
            instance: m.instance ?? undefined,
            appliedAt: Date.parse(m.createdAt) || Date.now(),
            beforeTurnIndex: agentIdxSoFar,
          });
        }
      }

      const attachmentsMsg = all.find((m) => m.role === "attachments");
      let attachments: QRightObjectLite[] | undefined;
      if (attachmentsMsg?.content) {
        try {
          const parsed = JSON.parse(attachmentsMsg.content);
          if (Array.isArray(parsed)) {
            attachments = parsed
              .filter((a: any) => a && typeof a.id === "string")
              .map((a: any) => ({
                id: a.id,
                title: typeof a.title === "string" ? a.title : null,
                kind: typeof a.kind === "string" ? a.kind : null,
              }));
          }
        } catch {
          // malformed — skip
        }
      }

      setRuns((prev) =>
        prev.map((r) =>
          r.id === runId ? { ...r, turns, guidance, attachments } : r
        )
      );
    } catch (e: any) {
      setGlobalError(e?.message || "Failed to load run detail");
    }
  }, []);

  const newSession = useCallback(() => {
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch { /* noop */ }
      abortRef.current = null;
    }
    setActiveSessionId(null);
    setRuns([]);
    setBusy(false);
    setGlobalError(null);
    setInput("");
    setContinueFromRunId(null);
  }, []);

  /* V7-T: continue a run — fills the textarea and marks thread context. */
  const continueRun = useCallback((runId: string) => {
    setContinueFromRunId(runId);
    setInput("");
    // Scroll textarea into view and focus it.
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 80);
  }, []);

  /* V7-Tmpl: save current run as a template. */
  const saveAsTemplate = useCallback(async (runId: string, name: string) => {
    const run = runs.find((r) => r.id === runId);
    if (!run || !name.trim()) return;
    setSavingTemplate(true);
    try {
      const body = {
        name: name.trim(),
        input: run.userInput,
        strategy: run.strategy || strategy,
        overrides: {
          analyst: overrides.analyst,
          writer: overrides.writer,
          writerB: overrides.writerB,
          critic: overrides.critic,
        },
        isPublic: false,
      };
      const res = await fetch(apiUrl("/api/qcoreai/templates"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.template) {
        setTemplates((prev) => [data.template, ...prev]);
        setSaveTemplateFor(null);
        setTemplateNameInput("");
      } else {
        setGlobalError(data.error || "Failed to save template");
      }
    } catch (e: any) {
      setGlobalError(e?.message || "Failed to save template");
    } finally {
      setSavingTemplate(false);
    }
  }, [runs, strategy, overrides]);

  /* V7-Tmpl: apply a template — fills form fields. */
  const applyTemplate = useCallback(async (t: TemplateItem) => {
    setInput(t.input);
    if (t.strategy === "sequential" || t.strategy === "parallel" || t.strategy === "debate") {
      setStrategy(t.strategy as Strategy);
    }
    if (t.overrides && typeof t.overrides === "object") {
      setOverrides((prev) => ({
        ...prev,
        ...Object.fromEntries(
          Object.entries(t.overrides).filter(([, v]) => v?.provider && v?.model)
        ),
      }));
    }
    setTemplatePanelOpen(false);
    // Bump useCount in background.
    fetch(apiUrl(`/api/qcoreai/templates/${t.id}/use`), { method: "POST" }).catch(() => {});
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(t.input.length, t.input.length);
      }
    }, 80);
  }, []);

  const removeSession = useCallback(async (id: string) => {
    if (!confirm("Delete this session and all its runs?")) return;
    try {
      const res = await fetch(apiUrl(`/api/qcoreai/sessions/${id}`), {
        method: "DELETE",
        headers: bearerHeader(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeSessionId === id) newSession();
    } catch (e: any) {
      setGlobalError(e?.message || "Delete failed");
    }
  }, [activeSessionId, newSession]);

  const renameSessionPrompt = useCallback(async (s: SessionSummary) => {
    const next = typeof window !== "undefined" ? window.prompt("Rename session", s.title) : null;
    if (!next || !next.trim() || next.trim() === s.title) return;
    try {
      const res = await fetch(apiUrl(`/api/qcoreai/sessions/${s.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify({ title: next.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setSessions((prev) => prev.map((x) => (x.id === s.id ? { ...x, title: data.session.title } : x)));
    } catch (e: any) {
      setGlobalError(e?.message || "Rename failed");
    }
  }, []);

  /* ── Send a new prompt (starts a run, streams SSE) ── */
  const send = useCallback(async (text?: string, opts?: { strategy?: Strategy; overrides?: Record<ConfigRoleId, { provider: string; model: string }>; maxRevisions?: number }) => {
    const msg = (text || input).trim();
    if (!msg || busy) return;

    // Optimistically clear textarea so the user can keep typing while the
    // run streams. If the request fails BEFORE the stream opens, we restore
    // it so they don't lose what they wrote.
    const clearedFromInput = !text;
    if (clearedFromInput) setInput("");
    setGlobalError(null);
    setBusy(true);
    // Reset the manual-scroll flag for this new run — they want to follow it.
    userScrolledUpRef.current = false;

    const useStrategy = opts?.strategy || strategy;
    const useOverrides = opts?.overrides || overrides;
    const useMaxRevisions = opts?.maxRevisions ?? maxRevisions;

    const tempRunId = `tmp_${Date.now()}`;
    setRuns((prev) => [
      ...prev,
      {
        id: tempRunId,
        sessionId: activeSessionId || "",
        userInput: msg,
        turns: [],
        status: "running",
        startedAt: Date.now(),
        strategy: useStrategy,
      },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const body: Record<string, unknown> = {
        input: msg,
        sessionId: activeSessionId,
        strategy: useStrategy,
        maxRevisions: useMaxRevisions,
        overrides: {
          analyst: useOverrides.analyst,
          writer: useOverrides.writer,
          writerB: useOverrides.writerB,
          critic: useOverrides.critic,
        },
      };
      if (attachedIds.length > 0) body.qrightAttachmentIds = attachedIds;
      if (maxCostUsd > 0) body.maxCostUsd = maxCostUsd;
      if (continueFromRunId) body.continueFromRunId = continueFromRunId;
      // V6-P integration: send promptOverrides if user picked custom prompts.
      const promptOverridesBody: Record<string, { promptId: string }> = {};
      (Object.keys(promptSelections) as ConfigRoleId[]).forEach((role) => {
        const id = promptSelections[role];
        if (id) promptOverridesBody[role] = { promptId: id };
      });
      if (Object.keys(promptOverridesBody).length > 0) {
        body.promptOverrides = promptOverridesBody;
      }
      const res = await fetch(apiUrl("/api/qcoreai/multi-agent"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        if (res.status === 429) {
          const retry = parseInt(res.headers.get("Retry-After") || "60", 10);
          // Restore input so the user can re-send after waiting.
          if (clearedFromInput) setInput(msg);
          // Tell compare-all to give up — hammering at 429 won't help.
          compareAbortRef.current = true;
          throw new Error(`Rate limit reached (20 runs/min/IP). Try again in ${isFinite(retry) ? retry : 60}s.`);
        }
        const err = await res.json().catch(() => ({}));
        if (clearedFromInput) setInput(msg);
        throw new Error(err?.error || `HTTP ${res.status}`);
      }

      let realRunId = tempRunId;
      let realSessionId = activeSessionId || "";

      for await (const payload of readSSE<SSEPayload>(res.body)) {
        switch (payload.type) {
          case "session":
            realRunId = payload.runId;
            realSessionId = payload.sessionId;
            setRuns((prev) => prev.map((r) => (r.id === tempRunId ? { ...r, id: realRunId, sessionId: realSessionId } : r)));
            if (!activeSessionId) setActiveSessionId(realSessionId);
            // Clear thread continuation after the run is confirmed started.
            setContinueFromRunId(null);
            break;
          case "agent_start":
            setRuns((prev) =>
              prev.map((r) =>
                r.id === realRunId
                  ? {
                      ...r,
                      turns: [
                        ...r.turns,
                        {
                          role: payload.role,
                          stage: payload.stage,
                          instance: payload.instance,
                          provider: payload.provider,
                          model: payload.model,
                          content: "",
                          status: "streaming",
                          startedAt: Date.now(),
                        },
                      ],
                    }
                  : r
              )
            );
            break;
          case "chunk":
            setRuns((prev) =>
              prev.map((r) => {
                if (r.id !== realRunId) return r;
                const turns = r.turns.slice();
                for (let i = turns.length - 1; i >= 0; i--) {
                  const t = turns[i];
                  if (
                    t.status === "streaming" &&
                    t.role === payload.role &&
                    t.stage === payload.stage &&
                    (t.instance || undefined) === (payload.instance || undefined)
                  ) {
                    turns[i] = { ...t, content: t.content + payload.text };
                    break;
                  }
                }
                return { ...r, turns };
              })
            );
            break;
          case "agent_end":
            setRuns((prev) =>
              prev.map((r) => {
                if (r.id !== realRunId) return r;
                const turns = r.turns.slice();
                for (let i = turns.length - 1; i >= 0; i--) {
                  const t = turns[i];
                  if (
                    t.status === "streaming" &&
                    t.role === payload.role &&
                    t.stage === payload.stage &&
                    (t.instance || undefined) === (payload.instance || undefined)
                  ) {
                    turns[i] = {
                      ...t,
                      content: payload.content || t.content,
                      status: "done",
                      durationMs: payload.durationMs,
                      tokensIn: payload.tokensIn,
                      tokensOut: payload.tokensOut,
                      costUsd: payload.costUsd,
                    };
                    break;
                  }
                }
                return { ...r, turns };
              })
            );
            break;
          case "verdict":
            setRuns((prev) =>
              prev.map((r) =>
                r.id === realRunId ? { ...r, verdict: { approved: payload.approved, feedback: payload.feedback } } : r
              )
            );
            break;
          case "final":
            setRuns((prev) =>
              prev.map((r) => (r.id === realRunId ? { ...r, finalContent: payload.content } : r))
            );
            break;
          case "budget_exceeded":
            setRuns((prev) =>
              prev.map((r) =>
                r.id === realRunId
                  ? { ...r, budgetExceeded: { spentUsd: payload.spentUsd, budgetUsd: payload.budgetUsd } }
                  : r
              )
            );
            break;
          case "qright_attached":
            setRuns((prev) =>
              prev.map((r) => (r.id === realRunId ? { ...r, attachments: payload.items } : r))
            );
            break;
          case "guidance_applied":
            setRuns((prev) =>
              prev.map((r) =>
                r.id === realRunId
                  ? {
                      ...r,
                      guidance: [
                        ...(r.guidance || []),
                        {
                          text: payload.text,
                          stage: payload.stage,
                          role: payload.role,
                          instance: payload.instance,
                          appliedAt: Date.now(),
                          // The next agent_start will land at this turn index.
                          beforeTurnIndex: r.turns.length,
                        },
                      ],
                    }
                  : r
              )
            );
            break;
          case "error":
            setRuns((prev) =>
              prev.map((r) => (r.id === realRunId ? { ...r, error: (r.error ? r.error + "\n" : "") + payload.message } : r))
            );
            break;
          case "done":
            setRuns((prev) =>
              prev.map((r) => (r.id === realRunId ? {
                ...r,
                status: r.error ? "error" : "done",
                totalDurationMs: payload.totalDurationMs,
                totalCostUsd: payload.totalCostUsd,
              } : r))
            );
            break;
          case "sse_end":
            break;
        }
      }

      try {
        const sessRes = await fetch(apiUrl("/api/qcoreai/sessions"), { headers: bearerHeader() });
        const sessData = await sessRes.json();
        if (Array.isArray(sessData?.items)) setSessions(sessData.items);
      } catch { /* noop */ }
    } catch (e: any) {
      const isAbort = e?.name === "AbortError";
      const msgText = isAbort ? "Stopped by user." : e?.message || "Stream failed";
      if (!isAbort) setGlobalError(msgText);
      setRuns((prev) => prev.map((r) => (r.status === "running" ? {
        ...r,
        status: isAbort ? "stopped" : "error",
        error: isAbort ? undefined : msgText,
      } : r)));
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }, [input, busy, activeSessionId, maxRevisions, overrides, strategy]);

  /**
   * Mid-run guidance — POST a steer message that gets attached to the next
   * writer-stage prompt. Returns true on success, false on 404/etc so the
   * UI can show a friendly hint ("run already finished").
   */
  const sendGuidance = useCallback(async (runIdArg: string, text: string): Promise<boolean> => {
    const trimmed = text.trim();
    if (!trimmed || !runIdArg || runIdArg.startsWith("tmp_")) return false;
    try {
      const res = await fetch(apiUrl(`/api/qcoreai/runs/${runIdArg}/guidance`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify({ text: trimmed }),
      });
      if (!res.ok) {
        if (res.status === 404) {
          setGlobalError("Run already finished — guidance arrived too late.");
        } else if (res.status === 429) {
          setGlobalError("Too many guidance updates. Slow down for a moment.");
        } else {
          const data = await res.json().catch(() => ({}));
          setGlobalError(data?.error || `Guidance failed: HTTP ${res.status}`);
        }
        return false;
      }
      return true;
    } catch (e: any) {
      setGlobalError(e?.message || "Guidance send failed");
      return false;
    }
  }, []);

  const stop = useCallback(() => {
    // Signal compare-all loop to stop firing more strategies.
    compareAbortRef.current = true;
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch { /* noop */ }
      abortRef.current = null;
    }
  }, []);

  /** Run the same prompt through all three strategies back-to-back. */
  const sendCompareAll = useCallback(async () => {
    const msg = input.trim();
    if (!msg || busy) return;
    setInput("");
    compareAbortRef.current = false;
    const order: Strategy[] = ["sequential", "parallel", "debate"];
    for (const s of order) {
      if (compareAbortRef.current) break;
      await send(msg, { strategy: s });
    }
  }, [input, busy, send]);

  /** Publish a run via shareToken; copies public URL to clipboard. */
  const shareRun = useCallback(async (runId: string) => {
    try {
      const res = await fetch(apiUrl(`/api/qcoreai/runs/${runId}/share`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/qcoreai/shared/${data.token}`;
      setRuns((prev) => prev.map((r) => (r.id === runId ? { ...r, shareToken: data.token } : r)));
      try {
        await navigator.clipboard.writeText(shareUrl);
        alert(`Public link copied to clipboard:\n\n${shareUrl}`);
      } catch {
        prompt("Public link:", shareUrl);
      }
    } catch (e: any) {
      setGlobalError(e?.message || "Share failed");
    }
  }, []);

  const unshareRun = useCallback(async (runId: string) => {
    try {
      const res = await fetch(apiUrl(`/api/qcoreai/runs/${runId}/share`), {
        method: "DELETE",
        headers: bearerHeader(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setRuns((prev) => prev.map((r) => (r.id === runId ? { ...r, shareToken: null } : r)));
    } catch (e: any) {
      setGlobalError(e?.message || "Unshare failed");
    }
  }, []);

  /** Restore a past run's config and load its prompt into the textarea so
      the user can tweak it before resending. The "Edit ✎" button. */
  const editAndResend = useCallback((run: RunState) => {
    const cfg = run.agentConfig || {};
    const nextStrategy: Strategy =
      cfg.strategy === "parallel" ? "parallel" :
      cfg.strategy === "debate" ? "debate" :
      (run.strategy as Strategy) || strategy;
    let nextOverrides = overrides;
    if (cfg.overrides && typeof cfg.overrides === "object") {
      const pick = (k: ConfigRoleId) => {
        const v = cfg.overrides?.[k];
        return v && typeof v === "object" && v.provider
          ? { provider: v.provider, model: v.model || "" }
          : overrides[k];
      };
      nextOverrides = {
        analyst: pick("analyst"),
        writer: pick("writer"),
        writerB: pick("writerB"),
        critic: pick("critic"),
      };
    }
    const nextMaxRev = typeof cfg.maxRevisions === "number" ? cfg.maxRevisions : maxRevisions;
    setStrategy(nextStrategy);
    setOverrides(nextOverrides);
    setMaxRevisions(nextMaxRev);
    setInput(run.userInput);
    // Focus + place caret at the end so the user can keep typing.
    setTimeout(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }, 0);
  }, [strategy, overrides, maxRevisions]);

  /** Restore a past run's config + resend its prompt — the "Rerun" button. */
  const rerun = useCallback((run: RunState) => {
    const cfg = run.agentConfig || {};
    const nextStrategy: Strategy =
      cfg.strategy === "parallel" ? "parallel" :
      cfg.strategy === "debate" ? "debate" :
      (run.strategy as Strategy) || strategy;
    let nextOverrides = overrides;
    if (cfg.overrides && typeof cfg.overrides === "object") {
      const pick = (k: ConfigRoleId) => {
        const v = cfg.overrides?.[k];
        return v && typeof v === "object" && v.provider
          ? { provider: v.provider, model: v.model || "" }
          : overrides[k];
      };
      nextOverrides = {
        analyst: pick("analyst"),
        writer: pick("writer"),
        writerB: pick("writerB"),
        critic: pick("critic"),
      };
    }
    const nextMaxRev = typeof cfg.maxRevisions === "number" ? cfg.maxRevisions : maxRevisions;
    setStrategy(nextStrategy);
    setOverrides(nextOverrides);
    setMaxRevisions(nextMaxRev);
    send(run.userInput, { strategy: nextStrategy, overrides: nextOverrides, maxRevisions: nextMaxRev });
  }, [send, strategy, overrides, maxRevisions]);

  /** Apply a one-pass refinement on top of a finished run. */
  const refineRun = useCallback(async (runId: string, instruction: string) => {
    const trimmed = instruction.trim();
    if (!trimmed) return;
    setRefineBusy(true);
    try {
      const res = await fetch(apiUrl(`/api/qcoreai/runs/${runId}/refine`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify({ instruction: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setRuns((prev) =>
        prev.map((r) =>
          r.id === runId
            ? {
                ...r,
                finalContent: data.content,
                totalCostUsd: data.runTotalCostUsd ?? r.totalCostUsd,
                totalDurationMs: data.runTotalDurationMs ?? r.totalDurationMs,
              }
            : r
        )
      );
      setRefineOpen(null);
      setRefineText("");
    } catch (e: any) {
      setGlobalError(e?.message || "refine failed");
    } finally {
      setRefineBusy(false);
    }
  }, []);

  /** Replace a run's tags via PATCH and refresh chip strip. */
  const updateRunTags = useCallback(async (runId: string, tags: string[]) => {
    try {
      const res = await fetch(apiUrl(`/api/qcoreai/runs/${runId}/tags`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify({ tags }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setRuns((prev) =>
        prev.map((r) => (r.id === runId ? { ...r, tags: data.tags || [] } : r))
      );
      // Refresh top-tags chip ranking.
      try {
        const r2 = await fetch(apiUrl(`/api/qcoreai/tags?limit=20`), {
          headers: bearerHeader(),
        });
        const d2 = await r2.json().catch(() => ({}));
        if (Array.isArray(d2?.items)) setTopTags(d2.items);
      } catch { /* ignore */ }
    } catch (e: any) {
      setGlobalError(e?.message || "set tags failed");
    }
  }, []);

  const configuredProviders = useMemo(() => providers.filter((p) => p.configured), [providers]);
  const anyConfigured = configuredProviders.length > 0;

  /* ── Live run stats for the header (last run in the timeline) ── */
  const liveRun = runs.find((r) => r.status === "running");

  return (
    <main>
      <ProductPageShell maxWidth={1200}>
        <Wave1Nav />

        {/* ── Header ── */}
        <div style={{ borderRadius: 20, overflow: "hidden", marginBottom: 16 }}>
          <div
            style={{
              background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #3730a3 100%)",
              padding: "24px 28px",
              color: "#fff",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
              <div
                style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: "linear-gradient(135deg, #0d9488, #06b6d4)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 900, letterSpacing: "0.03em",
                }}
              >
                MA
              </div>
              <div style={{ flex: 1 }}>
                <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0, letterSpacing: "-0.02em" }}>
                  QCoreAI · Multi-Agent
                </h1>
                <p style={{ margin: 0, fontSize: 13, opacity: 0.78 }}>
                  Analyst + Writer + Critic — inspectable AI pipeline with live streaming, cost tracking, and three strategies.
                </p>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <Link
                  href="/qcoreai/analytics"
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.25)",
                    background: "rgba(255,255,255,0.08)",
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 700,
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                  }}
                  title="Totals: runs, cost, tokens, strategy mix"
                >
                  📊 Analytics
                </Link>
                <Link
                  href="/qcoreai"
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.25)",
                    background: "rgba(255,255,255,0.08)",
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 700,
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  Single chat →
                </Link>
              </div>
            </div>

            {/* Strategy + role pills */}
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div
                style={{
                  display: "flex",
                  padding: 3,
                  borderRadius: 10,
                  background: "rgba(0,0,0,0.28)",
                  border: "1px solid rgba(255,255,255,0.14)",
                }}
              >
                {(["sequential", "parallel", "debate"] as Strategy[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStrategy(s)}
                    title={strategies.find((x) => x.id === s)?.description || ""}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "none",
                      background: strategy === s ? "#fff" : "transparent",
                      color: strategy === s ? "#0f172a" : "rgba(255,255,255,0.85)",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "background 0.15s",
                    }}
                  >
                    {s === "sequential" ? "Sequential" : s === "parallel" ? "Parallel" : "Debate"}
                  </button>
                ))}
              </div>

              {(strategy === "sequential"
                ? (["analyst", "writer", "critic"] as ConfigRoleId[])
                : (["analyst", "writer", "writerB", "critic"] as ConfigRoleId[])
              ).map((roleId) => {
                const s = roleSlotStyle(roleId, strategy);
                const ov = overrides[roleId];
                const label = roleSlotLabel(roleId, strategy);
                return (
                  <div
                    key={roleId}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "6px 10px", borderRadius: 8,
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.14)",
                      fontSize: 12,
                    }}
                  >
                    <span
                      style={{
                        width: 22, height: 22, borderRadius: 6,
                        background: s.color, color: "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 900, fontSize: 11,
                      }}
                    >
                      {s.tag}
                    </span>
                    <span style={{ fontWeight: 700 }}>{label}</span>
                    <span style={{ opacity: 0.7 }}>{ov.provider ? prettyModel(ov.model) : "—"}</span>
                  </div>
                );
              })}

              <button
                onClick={() => setConfigOpen((v) => !v)}
                style={{
                  padding: "6px 12px", borderRadius: 8,
                  background: configOpen ? "rgba(34,211,238,0.2)" : "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
                }}
              >
                {configOpen ? "Hide config ▲" : "Configure agents ▼"}
              </button>

              <label
                style={{
                  padding: "6px 12px", borderRadius: 8,
                  background: compareMode ? "rgba(245,158,11,0.25)" : "rgba(255,255,255,0.08)",
                  border: `1px solid ${compareMode ? "rgba(245,158,11,0.6)" : "rgba(255,255,255,0.2)"}`,
                  color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                }}
                title="Send the same prompt through all three strategies back-to-back"
              >
                <input
                  type="checkbox"
                  checked={compareMode}
                  onChange={(e) => setCompareMode(e.target.checked)}
                  style={{ accentColor: "#f59e0b", cursor: "pointer" }}
                />
                Compare all 3
              </label>

              {webhookConfigured && (
                <span
                  title="Webhook is configured on the backend — every completed run is posted to your endpoint as a run.completed event."
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "5px 10px",
                    borderRadius: 10,
                    background: "rgba(56,189,248,0.18)",
                    border: "1px solid rgba(56,189,248,0.4)",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  <span style={{ fontSize: 12 }}>🔗</span>
                  Webhook wired
                </span>
              )}
              {liveRun && (
                <LiveCostBadge run={liveRun} />
              )}
            </div>

            {/* Active-strategy description: always visible so the user
                knows what the chosen mode does without opening Config. */}
            <div
              style={{
                marginTop: 10,
                fontSize: 12,
                color: "rgba(226,232,240,0.78)",
                lineHeight: 1.5,
              }}
            >
              {compareMode
                ? "Compare mode: your prompt runs through Sequential, Parallel, and Debate back-to-back so you can read all three side-by-side."
                : (strategies.find((x) => x.id === strategy)?.description ||
                    (strategy === "sequential"
                      ? "Sequential: Analyst plans, Writer drafts, Critic reviews and may send back for one revision."
                      : strategy === "parallel"
                      ? "Parallel: Analyst plans, two Writers draft on different models in parallel, Judge synthesizes."
                      : "Debate: Pro and Con each argue their case, Moderator synthesizes a balanced answer."))}
            </div>

            {/* Agent presets — save/recall named role lineups */}
            <div
              style={{
                marginTop: 10,
                display: "flex",
                gap: 6,
                alignItems: "center",
                flexWrap: "wrap",
                fontSize: 11,
              }}
            >
              <span
                style={{
                  color: "rgba(226,232,240,0.55)",
                  fontWeight: 800,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  marginRight: 2,
                }}
              >
                Presets
              </span>
              {presets.length === 0 && !savingPreset && (
                <span style={{ color: "rgba(226,232,240,0.5)", fontStyle: "italic" }}>
                  none — pick a strategy + models, then save the lineup
                </span>
              )}
              {presets.map((p) => (
                <span
                  key={p.id}
                  style={{
                    display: "inline-flex",
                    alignItems: "stretch",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.18)",
                    overflow: "hidden",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => applyPreset(p)}
                    title={`Apply: ${p.strategy} · ${Object.values(p.overrides).filter((v) => v.provider).length} roles`}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "#fff",
                      padding: "4px 8px",
                      fontWeight: 700,
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    {p.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMarketplaceShareFor(p.id); setMarketplaceShareDesc(""); }}
                    aria-label={`Share preset ${p.name}`}
                    title="Share to community marketplace"
                    style={{
                      border: "none",
                      borderLeft: "1px solid rgba(255,255,255,0.15)",
                      background: "transparent",
                      color: "rgba(13,148,136,0.85)",
                      padding: "0 7px",
                      fontSize: 11,
                      cursor: "pointer",
                      lineHeight: 1,
                      fontWeight: 700,
                    }}
                  >
                    🌐
                  </button>
                  <button
                    type="button"
                    onClick={() => deletePreset(p.id)}
                    aria-label={`Delete preset ${p.name}`}
                    title="Delete preset"
                    style={{
                      border: "none",
                      borderLeft: "1px solid rgba(255,255,255,0.15)",
                      background: "transparent",
                      color: "rgba(255,255,255,0.55)",
                      padding: "0 7px",
                      fontSize: 13,
                      cursor: "pointer",
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
              {savingPreset ? (
                <>
                  <input
                    autoFocus
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); savePreset(); }
                      if (e.key === "Escape") { setSavingPreset(false); setPresetName(""); }
                    }}
                    placeholder="Preset name"
                    maxLength={40}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.3)",
                      background: "rgba(255,255,255,0.95)",
                      color: "#0f172a",
                      fontSize: 11,
                      fontWeight: 600,
                      outline: "none",
                      width: 140,
                    }}
                  />
                  <button
                    type="button"
                    onClick={savePreset}
                    disabled={!presetName.trim()}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.3)",
                      background: presetName.trim() ? "#fff" : "rgba(255,255,255,0.4)",
                      color: "#0f172a",
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: presetName.trim() ? "pointer" : "default",
                    }}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSavingPreset(false); setPresetName(""); }}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.2)",
                      background: "transparent",
                      color: "rgba(255,255,255,0.7)",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setSavingPreset(true)}
                  title="Save the current strategy + role models as a named preset"
                  style={{
                    padding: "4px 10px",
                    borderRadius: 8,
                    border: "1px dashed rgba(255,255,255,0.3)",
                    background: "transparent",
                    color: "rgba(255,255,255,0.85)",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  + Save current
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const next = !marketplaceOpen;
                  setMarketplaceOpen(next);
                  if (next && marketplacePresets.length === 0) void loadMarketplace();
                }}
                title="Browse community-shared agent presets"
                style={{
                  padding: "4px 10px",
                  borderRadius: 8,
                  border: marketplaceOpen
                    ? "1px solid rgba(13,148,136,0.7)"
                    : "1px dashed rgba(13,148,136,0.5)",
                  background: marketplaceOpen ? "rgba(13,148,136,0.2)" : "transparent",
                  color: "rgba(13,148,136,0.95)",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                🌐 Browse community
              </button>
            </div>

            {/* Share-preset modal-ish row — appears when user clicks 🌐 on a saved preset */}
            {marketplaceShareFor && (() => {
              const p = presets.find((x) => x.id === marketplaceShareFor);
              if (!p) return null;
              return (
                <div
                  style={{
                    marginTop: 10,
                    padding: 10,
                    borderRadius: 10,
                    background: "rgba(13,148,136,0.12)",
                    border: "1px solid rgba(13,148,136,0.4)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    color: "#e2e8f0",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700 }}>
                    Share preset <span style={{ color: "#5eead4" }}>{p.name}</span> to community
                  </div>
                  <textarea
                    value={marketplaceShareDesc}
                    onChange={(e) => setMarketplaceShareDesc(e.target.value)}
                    placeholder="Optional description: when to use this preset, model rationale, etc."
                    maxLength={400}
                    rows={2}
                    style={{
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.2)",
                      background: "rgba(255,255,255,0.95)",
                      color: "#0f172a",
                      padding: "6px 10px",
                      fontSize: 12,
                      fontFamily: "inherit",
                      outline: "none",
                      resize: "vertical",
                    }}
                  />
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                      onClick={() => sharePresetToMarketplace(p, marketplaceShareDesc)}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 8,
                        border: "none",
                        background: "#0d9488",
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Share publicly
                    </button>
                    <button
                      onClick={() => { setMarketplaceShareFor(null); setMarketplaceShareDesc(""); }}
                      style={{
                        padding: "5px 10px",
                        borderRadius: 8,
                        background: "transparent",
                        color: "rgba(255,255,255,0.7)",
                        border: "1px solid rgba(255,255,255,0.2)",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <span style={{ fontSize: 10, color: "rgba(226,232,240,0.6)" }}>
                      Auth required. Public until you delete it.
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Browse community panel */}
            {marketplaceOpen && (
              <div
                style={{
                  marginTop: 10,
                  padding: 12,
                  borderRadius: 10,
                  background: "rgba(15,23,42,0.4)",
                  border: "1px solid rgba(13,148,136,0.3)",
                  color: "#e2e8f0",
                }}
              >
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                  <input
                    type="search"
                    value={marketplaceQuery}
                    onChange={(e) => {
                      setMarketplaceQuery(e.target.value);
                      // Debounced via simple timeout — recreate on keystroke.
                      window.clearTimeout((window as any).__qcoreMarketTimer);
                      (window as any).__qcoreMarketTimer = window.setTimeout(
                        () => loadMarketplace(e.target.value),
                        250
                      );
                    }}
                    placeholder="Search community presets…"
                    style={{
                      flex: 1,
                      padding: "5px 10px",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.2)",
                      background: "rgba(255,255,255,0.95)",
                      color: "#0f172a",
                      fontSize: 12,
                      fontFamily: "inherit",
                      outline: "none",
                    }}
                  />
                  <span style={{ fontSize: 11, color: "rgba(226,232,240,0.6)" }}>
                    {marketplaceBusy ? "…" : `${marketplacePresets.length} preset${marketplacePresets.length === 1 ? "" : "s"}`}
                  </span>
                </div>
                {marketplacePresets.length === 0 && !marketplaceBusy ? (
                  <div style={{ fontSize: 12, color: "rgba(226,232,240,0.5)", padding: "12px 4px", fontStyle: "italic" }}>
                    No public presets yet. Be the first — save a lineup, click 🌐 to share.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" }}>
                    {marketplacePresets.map((mp) => (
                      <div
                        key={mp.id}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 8,
                          background: "rgba(15,23,42,0.5)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          display: "flex",
                          gap: 10,
                          alignItems: "flex-start",
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 700, fontSize: 12, color: "#fff" }}>{mp.name}</span>
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                padding: "1px 6px",
                                borderRadius: 999,
                                background: "rgba(13,148,136,0.2)",
                                color: "#5eead4",
                                textTransform: "uppercase",
                              }}
                            >
                              {mp.strategy}
                            </span>
                            <span style={{ fontSize: 10, color: "rgba(226,232,240,0.5)" }}>
                              ↑ {mp.importCount}
                            </span>
                          </div>
                          {mp.description && (
                            <div style={{ marginTop: 3, fontSize: 11, color: "rgba(226,232,240,0.7)", lineHeight: 1.4 }}>
                              {mp.description}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => importMarketplacePreset(mp.id)}
                          title="Import to your saved presets"
                          style={{
                            padding: "5px 12px",
                            borderRadius: 8,
                            border: "1px solid rgba(13,148,136,0.5)",
                            background: "rgba(13,148,136,0.2)",
                            color: "#5eead4",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          ↓ Import
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {configOpen && (
            <div style={{ padding: "16px 24px", background: "#f8fafc", borderTop: "1px solid rgba(15,23,42,0.08)" }}>
              {!anyConfigured && (
                <div style={{
                  padding: "10px 14px", borderRadius: 10,
                  background: "#fef3c7", border: "1px solid #fde68a",
                  color: "#78350f", fontSize: 13, marginBottom: 12, fontWeight: 600,
                }}>
                  No AI provider is configured on the backend. Add one of:
                  ANTHROPIC_API_KEY · OPENAI_API_KEY · GEMINI_API_KEY · DEEPSEEK_API_KEY · GROK_API_KEY.
                </div>
              )}
              <div style={{ fontSize: 12, color: "#475569", marginBottom: 10 }}>
                {strategies.find((s) => s.id === strategy)?.description || null}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
                {roleDefaults
                  .filter((r) => (strategy === "sequential" ? r.id !== "writerB" : true))
                  .map((r) => (
                    <RoleConfigCard
                      key={r.id}
                      role={r}
                      strategy={strategy}
                      providers={providers}
                      pricing={pricing}
                      value={overrides[r.id]}
                      onChange={(v) => setOverrides((prev) => ({ ...prev, [r.id]: v }))}
                      promptId={promptSelections[r.id] || ""}
                      onPromptChange={(id) => setPromptSelections((prev) => ({ ...prev, [r.id]: id }))}
                      availablePrompts={userPrompts.filter((p) => p.role === r.id || p.role === "writer" || p.role === "system")}
                    />
                  ))}
              </div>
              {/* Personal webhook config — auth-required.
                  When set, run.completed events fire to this URL instead of
                  the env-level fallback. Anonymous users see only a hint. */}
              <div
                style={{
                  marginTop: 14,
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#0f172a", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                    🔗 Personal webhook
                  </span>
                  <span style={{ fontSize: 11, color: "#64748b" }}>
                    Your URL receives <code style={{ background: "#f1f5f9", padding: "1px 5px", borderRadius: 4, fontSize: "0.92em" }}>run.completed</code> events for runs you start.
                  </span>
                </div>
                {userWebhook === null ? (
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>Loading…</div>
                ) : userWebhook === undefined ? (
                  <div>
                    {(() => {
                      const token = typeof window !== "undefined"
                        ? (() => { try { return localStorage.getItem("aevion_auth_token_v1"); } catch { return null; } })()
                        : null;
                      if (!token) {
                        return (
                          <div style={{ fontSize: 12, color: "#94a3b8" }}>
                            Sign in at{" "}
                            <Link href="/auth" style={{ color: "#0d9488", fontWeight: 700 }}>Auth</Link>
                            {" "}to configure your own webhook URL.
                          </div>
                        );
                      }
                      return (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                          <input
                            type="url"
                            value={whUrlInput}
                            onChange={(e) => setWhUrlInput(e.target.value)}
                            placeholder="https://your-receiver.example.com/qcore"
                            disabled={whBusy}
                            style={{
                              flex: "1 1 220px",
                              minWidth: 200,
                              padding: "6px 10px",
                              borderRadius: 8,
                              border: "1px solid #cbd5e1",
                              fontSize: 12,
                              outline: "none",
                            }}
                          />
                          <input
                            type="password"
                            value={whSecretInput}
                            onChange={(e) => setWhSecretInput(e.target.value)}
                            placeholder="HMAC secret (optional)"
                            disabled={whBusy}
                            style={{
                              flex: "1 1 160px",
                              minWidth: 140,
                              padding: "6px 10px",
                              borderRadius: 8,
                              border: "1px solid #cbd5e1",
                              fontSize: 12,
                              outline: "none",
                            }}
                          />
                          <button
                            type="button"
                            onClick={saveUserWebhook}
                            disabled={whBusy || !whUrlInput.trim()}
                            style={{
                              padding: "6px 12px",
                              borderRadius: 8,
                              border: "none",
                              background: whUrlInput.trim() ? "#0369a1" : "#cbd5e1",
                              color: "#fff",
                              fontSize: 12,
                              fontWeight: 800,
                              cursor: whUrlInput.trim() ? "pointer" : "default",
                            }}
                          >
                            {whBusy ? "Saving…" : "Save"}
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <code
                      style={{
                        padding: "4px 8px",
                        background: "rgba(56,189,248,0.12)",
                        border: "1px solid rgba(56,189,248,0.35)",
                        borderRadius: 8,
                        fontSize: 11,
                        color: "#0369a1",
                        fontWeight: 600,
                        maxWidth: "100%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={userWebhook.url}
                    >
                      {userWebhook.url}
                    </code>
                    {userWebhook.hasSecret && (
                      <span
                        title="HMAC-SHA256 signature included on every POST"
                        style={{
                          padding: "3px 8px",
                          fontSize: 10,
                          fontWeight: 800,
                          color: "#0f766e",
                          background: "rgba(13,148,136,0.1)",
                          border: "1px solid rgba(13,148,136,0.3)",
                          borderRadius: 999,
                        }}
                      >
                        🔐 HMAC
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setWhUrlInput(userWebhook.url);
                        setWhSecretInput("");
                        setUserWebhook(undefined);
                      }}
                      disabled={whBusy}
                      style={{
                        padding: "5px 10px",
                        borderRadius: 8,
                        background: "#fff",
                        border: "1px solid #cbd5e1",
                        color: "#0f172a",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={removeUserWebhook}
                      disabled={whBusy}
                      style={{
                        padding: "5px 10px",
                        borderRadius: 8,
                        background: "#fff",
                        border: "1px solid #fecaca",
                        color: "#991b1b",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {whBusy ? "…" : "Remove"}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setWhBusy(true);
                        try {
                          const res = await fetch(apiUrl("/api/qcoreai/me/webhook/test"), {
                            method: "POST", headers: bearerHeader(),
                          });
                          const data = await res.json().catch(() => ({}));
                          if (res.ok) alert(`Test sent to ${data.sentTo}`);
                          else alert(data.error || "Test failed");
                        } catch (e: any) {
                          alert(e?.message || "Test failed");
                        } finally {
                          setWhBusy(false);
                        }
                      }}
                      disabled={whBusy}
                      style={{
                        padding: "5px 10px",
                        borderRadius: 8,
                        background: "#fff",
                        border: "1px solid #bfdbfe",
                        color: "#1d4ed8",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Send test
                    </button>
                  </div>
                )}
              </div>

              {/* QRight attachments — pre-fetched as Analyst context */}
              <div
                style={{
                  marginTop: 14,
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#0f172a", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                    📎 Attach QRight objects
                  </span>
                  <span style={{ fontSize: 11, color: "#64748b" }}>
                    Selected ones become Analyst context — agents reason against your registered IP.
                  </span>
                </div>
                {qrightObjects === null ? (
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>Loading…</div>
                ) : qrightObjects.length === 0 ? (
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>
                    No QRight objects found. Register one at{" "}
                    <Link href="/qright" style={{ color: "#0d9488", fontWeight: 700 }}>QRight</Link> first.
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {qrightObjects.map((o) => {
                      const checked = attachedIds.includes(o.id);
                      return (
                        <label
                          key={o.id}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "5px 10px",
                            borderRadius: 999,
                            border: `1px solid ${checked ? "#0d9488" : "#e2e8f0"}`,
                            background: checked ? "rgba(13,148,136,0.08)" : "#f8fafc",
                            color: checked ? "#0f766e" : "#475569",
                            fontSize: 12,
                            fontWeight: checked ? 700 : 500,
                            cursor: "pointer",
                            maxWidth: "100%",
                          }}
                          title={o.title || o.id}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setAttachedIds((prev) =>
                                e.target.checked ? [...prev, o.id] : prev.filter((x) => x !== o.id)
                              );
                            }}
                            style={{ accentColor: "#0d9488", cursor: "pointer" }}
                          />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240 }}>
                            {o.title || o.id.slice(0, 8)}
                          </span>
                          {o.kind && (
                            <span style={{ fontSize: 10, opacity: 0.6 }}>({o.kind})</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
                {attachedIds.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 11, color: "#0f766e", fontWeight: 700 }}>
                    {attachedIds.length} attached — Analyst will see them as factual grounding.
                    <button
                      type="button"
                      onClick={() => setAttachedIds([])}
                      style={{
                        marginLeft: 8, border: "none", background: "transparent",
                        color: "#475569", fontSize: 11, fontWeight: 700, cursor: "pointer",
                      }}
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {/* V7-Budget: monthly spend summary + limit setting */}
              <SpendLimitPanel />

              {/* Budget cap selector — applies to every strategy. */}
              <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#475569", flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700 }}>Per-run cap:</span>
                {[
                  { v: 0, label: "No cap" },
                  { v: 0.05, label: "$0.05" },
                  { v: 0.10, label: "$0.10" },
                  { v: 0.25, label: "$0.25" },
                  { v: 1.0, label: "$1.00" },
                ].map((opt) => {
                  const active = Math.abs(maxCostUsd - opt.v) < 0.001;
                  return (
                    <button
                      key={opt.label}
                      onClick={() => setMaxCostUsd(opt.v)}
                      style={{
                        padding: "5px 10px", borderRadius: 8,
                        border: "1px solid " + (active ? "#0f172a" : "#cbd5e1"),
                        background: active ? "#0f172a" : "#fff",
                        color: active ? "#fff" : "#334155",
                        fontWeight: 700, fontSize: 12, cursor: "pointer",
                      }}
                      title={opt.v === 0 ? "Run until natural completion" : `Stop after ~$${opt.v.toFixed(2)} spent`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
                <span style={{ fontSize: 11, color: "#94a3b8" }}>
                  (orchestrator finalises with the latest writer output if the cap is crossed mid-run)
                </span>
              </div>

              {strategy === "sequential" && (
                <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: "#475569", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700 }}>Revision rounds:</span>
                  {[0, 1, 2].map((n) => (
                    <button
                      key={n}
                      onClick={() => setMaxRevisions(n)}
                      style={{
                        padding: "6px 12px", borderRadius: 8,
                        border: "1px solid " + (maxRevisions === n ? "#0f172a" : "#cbd5e1"),
                        background: maxRevisions === n ? "#0f172a" : "#fff",
                        color: maxRevisions === n ? "#fff" : "#334155",
                        fontWeight: 700, fontSize: 12, cursor: "pointer",
                      }}
                    >
                      {n === 0 ? "No revision" : n === 1 ? "Up to 1" : "Up to 2"}
                    </button>
                  ))}
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>
                    (Critic can send the draft back to Writer this many times.)
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Main 2-column layout ── */}
        <div className="qc-layout">
          {/* Sessions sidebar */}
          <aside
            className="qc-sidebar"
            style={{
              border: "1px solid rgba(15,23,42,0.1)",
              borderRadius: 14,
              background: "#fff",
              padding: 12,
              position: "sticky",
              top: 12,
              maxHeight: "calc(100vh - 40px)",
              overflowY: "auto",
            }}
          >
            {/* Mobile-only collapse toggle. Hidden on desktop via CSS. */}
            <button
              type="button"
              className="qc-sidebar-toggle"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-expanded={sidebarOpen}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid rgba(15,23,42,0.15)",
                background: "#f8fafc",
                color: "#0f172a",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                marginBottom: 10,
                display: "none", // overridden on mobile
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <span>Sessions ({sessions.length})</span>
              <span style={{ fontSize: 10, color: "#64748b" }}>{sidebarOpen ? "▲ Hide" : "▼ Show"}</span>
            </button>
            <div className="qc-sidebar-body" data-open={sidebarOpen ? "true" : "false"}>
            <button
              onClick={newSession}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 10,
                border: "1px solid #0f172a", background: "#0f172a", color: "#fff",
                fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 10,
              }}
            >
              + New session
            </button>
            <div style={{ position: "relative", marginBottom: 10 }}>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search runs… (text, tags)"
                style={{
                  width: "100%",
                  padding: "8px 32px 8px 12px",
                  borderRadius: 10,
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  color: "#0f172a",
                  fontSize: 12,
                  fontFamily: "inherit",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                  style={{
                    position: "absolute",
                    right: 6,
                    top: 6,
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    border: "none",
                    background: "transparent",
                    color: "#94a3b8",
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  ×
                </button>
              )}
            </div>
            {topTags.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 4,
                  marginBottom: 10,
                  paddingBottom: 8,
                  borderBottom: "1px dashed rgba(15,23,42,0.08)",
                }}
              >
                {topTags.slice(0, 12).map((t) => {
                  const active = searchQuery.trim().toLowerCase() === t.tag.toLowerCase();
                  return (
                    <button
                      key={t.tag}
                      type="button"
                      onClick={() => setSearchQuery(active ? "" : t.tag)}
                      title={`${t.count} run${t.count === 1 ? "" : "s"} tagged "${t.tag}"`}
                      style={{
                        padding: "3px 8px",
                        borderRadius: 999,
                        border: active
                          ? "1px solid #0f766e"
                          : "1px solid rgba(13,148,136,0.25)",
                        background: active ? "#0f766e" : "rgba(13,148,136,0.06)",
                        color: active ? "#fff" : "#0f766e",
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: "pointer",
                        lineHeight: 1.4,
                      }}
                    >
                      {t.tag}
                      <span
                        style={{
                          marginLeft: 4,
                          opacity: 0.6,
                          fontWeight: 500,
                          fontSize: 9,
                        }}
                      >
                        {t.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {searchQuery.trim() && (
              <div style={{ marginBottom: 12 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    padding: "4px 6px 6px",
                  }}
                >
                  Search {searchBusy ? "…" : `(${searchResults.length})`}
                </div>
                {!searchBusy && searchResults.length === 0 ? (
                  <div style={{ fontSize: 12, color: "#94a3b8", padding: "6px" }}>
                    No matches.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {searchResults.map((hit) => (
                      <button
                        key={hit.runId}
                        onClick={() => loadSession(hit.sessionId)}
                        title={hit.preview}
                        style={{
                          textAlign: "left",
                          padding: "8px 10px",
                          borderRadius: 8,
                          border: "1px solid rgba(13,148,136,0.2)",
                          background:
                            activeSessionId === hit.sessionId ? "rgba(13,148,136,0.08)" : "#fff",
                          color: "#0f172a",
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: 11,
                            color: "#0f766e",
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 6,
                          }}
                        >
                          <span
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              flex: 1,
                            }}
                          >
                            {hit.sessionTitle || "(untitled)"}
                          </span>
                          <span style={{ fontSize: 9, color: "#64748b", textTransform: "uppercase" }}>
                            {hit.matched}
                          </span>
                        </div>
                        <div
                          style={{
                            marginTop: 3,
                            fontSize: 11,
                            color: "#475569",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {hit.preview}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", padding: "8px 6px 4px" }}>
              Sessions
            </div>
            {sessions.length === 0 ? (
              <div style={{ fontSize: 12, color: "#94a3b8", padding: "12px 6px" }}>
                No sessions yet. Send a prompt to start.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {sessions.map((s) => (
                  <div key={s.id} style={{ display: "flex", alignItems: "stretch", gap: 2 }}>
                    <button
                      onClick={() => loadSession(s.id)}
                      style={{
                        flex: 1, textAlign: "left",
                        padding: "8px 10px", borderRadius: 8,
                        border: "1px solid transparent",
                        background: activeSessionId === s.id ? "rgba(6,182,212,0.1)" : "transparent",
                        color: activeSessionId === s.id ? "#0e7490" : "#334155",
                        fontSize: 12, fontWeight: activeSessionId === s.id ? 700 : 500,
                        cursor: "pointer",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}
                      title={s.title}
                    >
                      {s.title || "(untitled)"}
                    </button>
                    <button
                      onClick={async () => {
                        const pinned = !(s as any).pinned;
                        try {
                          await fetch(apiUrl(`/api/qcoreai/sessions/${s.id}/pin`), {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json", ...bearerHeader() },
                            body: JSON.stringify({ pinned }),
                          });
                          setSessions((prev) => prev.map((x) => x.id === s.id ? { ...x, pinned } as any : x));
                        } catch { /* noop */ }
                      }}
                      title={(s as any).pinned ? "Unpin session" : "Pin session (floats to top)"}
                      style={{
                        width: 24, borderRadius: 6,
                        border: "1px solid transparent", background: "transparent",
                        color: (s as any).pinned ? "#f59e0b" : "#94a3b8",
                        cursor: "pointer", fontSize: 13,
                      }}
                    >
                      ★
                    </button>
                    <button
                      onClick={() => renameSessionPrompt(s)}
                      title="Rename session"
                      style={{
                        width: 24, borderRadius: 6,
                        border: "1px solid transparent", background: "transparent",
                        color: "#94a3b8", cursor: "pointer", fontSize: 12,
                      }}
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => removeSession(s.id)}
                      title="Delete session"
                      style={{
                        width: 24, borderRadius: 6,
                        border: "1px solid transparent", background: "transparent",
                        color: "#94a3b8", cursor: "pointer", fontSize: 14,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            </div>
          </aside>

          {/* Main conversation */}
          <section>
            <div
              ref={timelineRef}
              onScroll={onTimelineScroll}
              style={{
                border: "1px solid rgba(15,23,42,0.1)",
                borderRadius: 14,
                background: "#f8fafc",
                padding: 16,
                minHeight: 360,
                maxHeight: "calc(100vh - 200px)",
                overflowY: "auto",
                marginBottom: 12,
              }}
            >
              {runs.length === 0 ? (
                <EmptyState
                  strategies={strategies}
                  onSuggest={(s, strat) => {
                    if (strat) setStrategy(strat);
                    send(s, strat ? { strategy: strat } : undefined);
                  }}
                  onPickStrategy={(s) => setStrategy(s)}
                  currentStrategy={strategy}
                  canSend={anyConfigured}
                />
              ) : (
                runs.map((run) => (
                  <RunCard
                    key={run.id}
                    run={run}
                    onLoadDetails={run.persisted && run.turns.length === 0 ? () => expandRunDetails(run.id) : undefined}
                    onRerun={() => rerun(run)}
                    onEdit={() => editAndResend(run)}
                    onShare={() => shareRun(run.id)}
                    onUnshare={() => unshareRun(run.id)}
                    onUpdateTags={(tags: string[]) => updateRunTags(run.id, tags)}
                    refineOpen={refineOpen === run.id}
                    refineText={refineOpen === run.id ? refineText : ""}
                    refineBusy={refineOpen === run.id ? refineBusy : false}
                    onOpenRefine={() => { setRefineOpen(run.id); setRefineText(""); }}
                    onChangeRefineText={setRefineText}
                    onCancelRefine={() => { setRefineOpen(null); setRefineText(""); }}
                    onApplyRefine={() => refineRun(run.id, refineText)}
                    onContinue={continueRun}
                    onSaveTemplate={(runId) => {
                      setSaveTemplateFor(runId);
                      setTemplateNameInput("");
                      setTemplatePanelOpen(false);
                    }}
                  />
                ))
              )}
            </div>

            {/* Mid-run guidance — visible only while a run is streaming and
                has been registered (real runId, not the tmp_ placeholder).
                Lets the user steer writer stages mid-execution; the steer
                lands as a `[Mid-run user guidance: …]` line on the next
                writer prompt and surfaces back as a lavender chip in the
                timeline. */}
            {liveRun && !liveRun.id.startsWith("tmp_") && (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  padding: "8px 12px",
                  marginBottom: 10,
                  borderRadius: 10,
                  background: "rgba(196,181,253,0.16)",
                  border: "1px solid rgba(124,58,237,0.3)",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: "#6d28d9",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                  }}
                >
                  ↪ Steer
                </span>
                <input
                  value={guidanceText}
                  onChange={(e) => setGuidanceText(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter" && guidanceText.trim()) {
                      e.preventDefault();
                      const ok = await sendGuidance(liveRun.id, guidanceText);
                      if (ok) setGuidanceText("");
                    }
                  }}
                  placeholder='Mid-run hint — applied to the next writer stage. e.g. "focus on EU regulators".'
                  maxLength={4000}
                  style={{
                    flex: 1,
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid rgba(124,58,237,0.25)",
                    background: "#fff",
                    color: "#0f172a",
                    fontSize: 12,
                    fontWeight: 500,
                    outline: "none",
                  }}
                />
                <button
                  type="button"
                  disabled={!guidanceText.trim()}
                  onClick={async () => {
                    const ok = await sendGuidance(liveRun.id, guidanceText);
                    if (ok) setGuidanceText("");
                  }}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: "none",
                    background: guidanceText.trim() ? "#7c3aed" : "rgba(124,58,237,0.3)",
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: guidanceText.trim() ? "pointer" : "default",
                    whiteSpace: "nowrap",
                  }}
                >
                  Send
                </button>
              </div>
            )}

            {globalError && (
              <div
                role="alert"
                style={{
                  color: "#b91c1c", background: "rgba(239,68,68,0.06)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  borderRadius: 10, padding: "8px 12px", fontSize: 12, marginBottom: 10,
                  display: "flex", alignItems: "center", gap: 10,
                }}
              >
                <span style={{ flex: 1 }}>{globalError}</span>
                <button
                  type="button"
                  onClick={() => setGlobalError(null)}
                  aria-label="Dismiss error"
                  style={{
                    border: "none", background: "transparent",
                    color: "#b91c1c", cursor: "pointer",
                    fontSize: 16, lineHeight: 1, padding: "0 2px", fontWeight: 700,
                  }}
                >
                  ×
                </button>
              </div>
            )}

            {/* V7-Tmpl: save-template inline form */}
            {saveTemplateFor && (
              <div
                style={{
                  marginBottom: 10, padding: 12, borderRadius: 12,
                  border: "1px solid rgba(15,23,42,0.15)", background: "#f8fafc",
                  display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>📋 Save as template:</span>
                <input
                  autoFocus
                  value={templateNameInput}
                  onChange={(e) => setTemplateNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveAsTemplate(saveTemplateFor, templateNameInput);
                    if (e.key === "Escape") setSaveTemplateFor(null);
                  }}
                  placeholder="Template name…"
                  style={{
                    flex: 1, padding: "5px 10px", borderRadius: 8,
                    border: "1px solid #cbd5e1", fontSize: 12, outline: "none",
                    background: "#fff", minWidth: 140,
                  }}
                />
                <button
                  onClick={() => saveAsTemplate(saveTemplateFor, templateNameInput)}
                  disabled={savingTemplate || !templateNameInput.trim()}
                  style={{
                    padding: "5px 14px", borderRadius: 8, border: "none",
                    background: templateNameInput.trim() ? "#0f172a" : "#94a3b8",
                    color: "#fff", fontSize: 12, fontWeight: 700,
                    cursor: templateNameInput.trim() ? "pointer" : "default",
                  }}
                >
                  {savingTemplate ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => setSaveTemplateFor(null)}
                  style={{
                    padding: "5px 10px", borderRadius: 8,
                    border: "1px solid #cbd5e1", background: "#fff",
                    color: "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            )}

            {/* V7-T: thread continuation pill */}
            {continueFromRunId && (
              <div
                style={{
                  display: "flex", alignItems: "center", gap: 8, marginBottom: 8,
                  padding: "6px 12px", borderRadius: 10,
                  background: "rgba(124,58,237,0.08)",
                  border: "1px solid rgba(124,58,237,0.25)",
                  fontSize: 12, color: "#6d28d9", fontWeight: 600,
                }}
              >
                <span>↩</span>
                <span style={{ flex: 1 }}>Continuing thread — context from previous run loaded</span>
                <button
                  onClick={() => setContinueFromRunId(null)}
                  title="Cancel continuation"
                  style={{
                    border: "none", background: "transparent", cursor: "pointer",
                    color: "#7c3aed", fontSize: 16, lineHeight: 1, padding: "0 2px",
                  }}
                >
                  ×
                </button>
              </div>
            )}

            {/* V7-Tmpl: template panel */}
            {templatePanelOpen && (
              <div
                style={{
                  marginBottom: 10, borderRadius: 12,
                  border: "1px solid rgba(15,23,42,0.12)",
                  background: "#f8fafc", padding: 12,
                  maxHeight: 320, overflowY: "auto",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ fontWeight: 800, fontSize: 13, flex: 1 }}>📋 Templates</span>
                  <input
                    placeholder="Filter…"
                    value={templateQuery}
                    onChange={(e) => setTemplateQuery(e.target.value)}
                    style={{
                      padding: "4px 10px", borderRadius: 8, border: "1px solid #cbd5e1",
                      fontSize: 12, width: 130, outline: "none", background: "#fff",
                    }}
                  />
                  <button
                    onClick={() => setTemplatePanelOpen(false)}
                    style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 16, color: "#475569" }}
                  >
                    ×
                  </button>
                </div>
                {templates.length > 0 && (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                      My Templates
                    </div>
                    {templates
                      .filter((t) => !templateQuery || t.name.toLowerCase().includes(templateQuery.toLowerCase()))
                      .map((t) => (
                        <div
                          key={t.id}
                          style={{
                            display: "flex", alignItems: "center", gap: 8, marginBottom: 4,
                            padding: "6px 10px", borderRadius: 8, background: "#fff",
                            border: "1px solid rgba(15,23,42,0.08)", cursor: "pointer",
                          }}
                          onClick={() => applyTemplate(t)}
                        >
                          <span style={{ fontSize: 13, flex: 1, fontWeight: 600 }}>{t.name}</span>
                          <span style={{ fontSize: 10, color: "#94a3b8", borderRadius: 6, padding: "2px 6px", background: "#f1f5f9" }}>{t.strategy}</span>
                          {t.description && (
                            <span style={{ fontSize: 11, color: "#64748b", flex: 2 }} title={t.description}>
                              {t.description.slice(0, 60)}{t.description.length > 60 ? "…" : ""}
                            </span>
                          )}
                        </div>
                      ))}
                  </>
                )}
                {publicTemplates.length > 0 && (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, margin: "8px 0 4px" }}>
                      Community
                    </div>
                    {publicTemplates
                      .filter((t) => !templateQuery || t.name.toLowerCase().includes(templateQuery.toLowerCase()))
                      .map((t) => (
                        <div
                          key={t.id}
                          style={{
                            display: "flex", alignItems: "center", gap: 8, marginBottom: 4,
                            padding: "6px 10px", borderRadius: 8, background: "#fff",
                            border: "1px solid rgba(124,58,237,0.12)", cursor: "pointer",
                          }}
                          onClick={() => applyTemplate(t)}
                        >
                          <span style={{ fontSize: 13, flex: 1, fontWeight: 600 }}>{t.name}</span>
                          <span style={{ fontSize: 10, color: "#6d28d9", borderRadius: 6, padding: "2px 6px", background: "rgba(124,58,237,0.07)" }}>{t.useCount} uses</span>
                        </div>
                      ))}
                  </>
                )}
                {templates.length === 0 && publicTemplates.length === 0 && (
                  <p style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", margin: "12px 0" }}>
                    No templates yet. Save a run as a template to reuse it.
                  </p>
                )}
              </div>
            )}

            {/* Input */}
            <div style={{ display: "flex", gap: 8 }}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (compareMode) sendCompareAll(); else send();
                  }
                }}
                placeholder={
                  compareMode
                    ? "Compare mode: your prompt runs through Sequential + Parallel + Debate, back-to-back."
                    : strategy === "debate"
                    ? "Ask a decision or trade-off question — Pro and Con will argue it out, Moderator synthesizes."
                    : strategy === "parallel"
                    ? "Describe your task — Analyst plans, two Writers draft on different models, Judge synthesizes."
                    : "Describe your task — Analyst decomposes, Writer drafts, Critic reviews and revises."
                }
                disabled={busy}
                rows={3}
                style={{
                  flex: 1, padding: "12px 14px",
                  borderRadius: 12, border: "1px solid rgba(15,23,42,0.15)",
                  fontSize: 14, resize: "vertical", fontFamily: "inherit", outline: "none",
                  background: busy ? "#f1f5f9" : "#fff",
                }}
              />
              {busy ? (
                <button
                  type="button"
                  onClick={stop}
                  style={{
                    padding: "12px 20px", borderRadius: 12, border: "none",
                    background: "#dc2626", color: "#fff",
                    fontWeight: 800, fontSize: 14, cursor: "pointer", alignSelf: "stretch",
                  }}
                >
                  Stop
                </button>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, alignSelf: "stretch" }}>
                  <button
                    type="button"
                    onClick={() => compareMode ? sendCompareAll() : send()}
                    disabled={!input.trim() || !anyConfigured}
                    style={{
                      flex: 1, padding: "12px 24px", borderRadius: 12, border: "none",
                      background: !input.trim() || !anyConfigured ? "#94a3b8"
                        : compareMode ? "linear-gradient(135deg, #f59e0b, #ef4444)"
                        : "linear-gradient(135deg, #0d9488, #06b6d4)",
                      color: "#fff", fontWeight: 800, fontSize: 14,
                      cursor: !input.trim() || !anyConfigured ? "default" : "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {compareMode ? "Send × 3" : "Send"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTemplatePanelOpen((v) => !v)}
                    title="Browse and apply run templates"
                    style={{
                      padding: "6px 12px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.15)",
                      background: templatePanelOpen ? "rgba(124,58,237,0.1)" : "#fff",
                      color: templatePanelOpen ? "#6d28d9" : "#475569",
                      fontWeight: 700, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap",
                    }}
                  >
                    📋 Templates
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>

        <style jsx global>{`
          .qc-layout {
            display: grid;
            grid-template-columns: 260px 1fr;
            gap: 16px;
            align-items: start;
          }
          .qc-pair-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
          }
          @media (max-width: 880px) {
            .qc-layout { grid-template-columns: 1fr; }
            .qc-pair-grid { grid-template-columns: 1fr; }
            .qc-sidebar { max-height: none !important; position: static !important; }
            .qc-sidebar-toggle { display: flex !important; }
            .qc-sidebar-body[data-open="false"] { display: none; }
          }
        `}</style>
      </ProductPageShell>
    </main>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Subcomponents
   ═══════════════════════════════════════════════════════════════════════ */

function SpendLimitPanel() {
  const [summary, setSummary] = useState<{
    spentUsd: number; limitUsd: number | null; alertAt: number; pct: number | null;
    alerting: boolean; exceeded: boolean;
  } | null>(null);
  const [limitInput, setLimitInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    fetch(apiUrl("/api/qcoreai/me/spend-summary"), { headers: bearerHeader() })
      .then((r) => r.json()).then((d) => { if (d.spentUsd !== undefined) setSummary(d); })
      .catch(() => {});
  }, []);

  if (!summary) return null;

  const pctNum = summary.pct !== null ? Math.min(100, Math.round(summary.pct * 100)) : null;
  const barColor = summary.exceeded ? "#ef4444" : summary.alerting ? "#f59e0b" : "#10b981";

  const save = async () => {
    const v = parseFloat(limitInput);
    if (!isFinite(v) || v <= 0) return;
    setSaving(true);
    try {
      const res = await fetch(apiUrl("/api/qcoreai/me/spend-limit"), {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify({ monthlyLimitUsd: v }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSummary((prev) => prev ? { ...prev, limitUsd: v, pct: prev.spentUsd / v, alerting: prev.spentUsd / v >= 0.8, exceeded: prev.spentUsd >= v } : prev);
        setEditing(false);
        setLimitInput("");
      } else {
        alert(data.error || "Failed to save limit");
      }
    } finally { setSaving(false); }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await fetch(apiUrl("/api/qcoreai/me/spend-limit"), { method: "DELETE", headers: bearerHeader() });
      setSummary((prev) => prev ? { ...prev, limitUsd: null, pct: null, alerting: false, exceeded: false } : prev);
      setEditing(false);
    } finally { setSaving(false); }
  };

  return (
    <div
      style={{
        marginTop: 12, padding: "10px 12px", borderRadius: 10,
        border: `1px solid ${summary.alerting ? "rgba(245,158,11,0.4)" : "rgba(15,23,42,0.1)"}`,
        background: summary.alerting ? "rgba(245,158,11,0.05)" : "#f8fafc",
        fontSize: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontWeight: 800, color: "#0f172a" }}>Monthly spend</span>
        <span style={{ fontWeight: 700, color: summary.exceeded ? "#dc2626" : "#0f172a" }}>
          ${summary.spentUsd.toFixed(4)}
        </span>
        {summary.limitUsd && (
          <span style={{ color: "#64748b" }}>/ ${summary.limitUsd.toFixed(2)}</span>
        )}
        {summary.alerting && !summary.exceeded && (
          <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 999, background: "rgba(245,158,11,0.15)", color: "#92400e" }}>
            ⚠ 80%+ of limit
          </span>
        )}
        {summary.exceeded && (
          <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 999, background: "rgba(239,68,68,0.1)", color: "#991b1b" }}>
            LIMIT REACHED
          </span>
        )}
        <button
          onClick={() => { setEditing((v) => !v); setLimitInput(summary.limitUsd ? String(summary.limitUsd) : ""); }}
          style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", color: "#475569" }}
        >
          {editing ? "Close" : summary.limitUsd ? "Edit limit" : "+ Set limit"}
        </button>
      </div>

      {summary.limitUsd && pctNum !== null && (
        <div style={{ height: 4, borderRadius: 2, background: "#e2e8f0", overflow: "hidden", marginBottom: editing ? 8 : 0 }}>
          <div style={{ height: "100%", borderRadius: 2, background: barColor, width: `${pctNum}%`, transition: "width 0.5s" }} />
        </div>
      )}

      {editing && (
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}>
          <span style={{ fontSize: 11, color: "#64748b" }}>$/month:</span>
          <input
            type="number"
            min={0}
            step={1}
            value={limitInput}
            onChange={(e) => setLimitInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); }}
            placeholder="e.g. 10"
            style={{ width: 80, padding: "4px 8px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 11, fontFamily: "inherit" }}
          />
          <button
            onClick={save}
            disabled={saving}
            style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "#0f172a", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
          >
            {saving ? "…" : "Save"}
          </button>
          {summary.limitUsd && (
            <button
              onClick={remove}
              disabled={saving}
              style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #fecaca", background: "#fff", color: "#991b1b", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
            >
              Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function LiveCostBadge({ run }: { run: RunState }) {
  const stats = runStats(run);
  return (
    <div
      title="Live cost + tokens (rolling sum across agents in this run)"
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 10,
        background: "rgba(16,185,129,0.18)",
        border: "1px solid rgba(16,185,129,0.4)",
        color: "#fff",
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      <span
        style={{ width: 8, height: 8, borderRadius: "50%", background: "#34d399", boxShadow: "0 0 0 0 rgba(52,211,153,0.7)", animation: "qc-live-pulse 1.5s infinite" }}
      />
      <span>{formatMoney(stats.costUsd, 4)}</span>
      <span style={{ opacity: 0.8 }}>· {stats.tokensIn + stats.tokensOut} tok</span>
      <span style={{ opacity: 0.8 }}>· {formatDuration(stats.durationMs)}</span>
      <style jsx>{`
        @keyframes qc-live-pulse {
          0% { box-shadow: 0 0 0 0 rgba(52,211,153,0.7); }
          70% { box-shadow: 0 0 0 8px rgba(52,211,153,0); }
          100% { box-shadow: 0 0 0 0 rgba(52,211,153,0); }
        }
      `}</style>
    </div>
  );
}

function RoleConfigCard({
  role,
  strategy,
  providers,
  pricing,
  value,
  onChange,
  promptId,
  onPromptChange,
  availablePrompts,
}: {
  role: RoleDefault;
  strategy: Strategy;
  providers: ProviderInfo[];
  pricing: PricingRow[];
  value: { provider: string; model: string };
  onChange: (v: { provider: string; model: string }) => void;
  promptId?: string;
  onPromptChange?: (id: string) => void;
  availablePrompts?: Array<{ id: string; name: string; role: string; version: number }>;
}) {
  const s = roleSlotStyle(role.id, strategy);
  const label = roleSlotLabel(role.id, strategy);
  const currentProvider = providers.find((p) => p.id === value.provider);
  const availableModels = currentProvider?.models || [];
  const configured = providers.filter((p) => p.configured);
  const priceRow = pricing.find((p) => p.provider === value.provider && p.model === value.model);

  return (
    <div
      style={{
        border: `1px solid ${s.color}33`,
        background: s.bg,
        borderRadius: 12,
        padding: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span
          style={{
            width: 24, height: 24, borderRadius: 6,
            background: s.color, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: 12,
          }}
        >
          {s.tag}
        </span>
        <span style={{ fontWeight: 800, fontSize: 13, color: "#0f172a" }}>{label}</span>
      </div>
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10 }}>{role.description}</div>

      <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#475569", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        Provider
      </label>
      <select
        value={value.provider}
        onChange={(e) => {
          const nextProv = e.target.value;
          const p = providers.find((pp) => pp.id === nextProv);
          onChange({ provider: nextProv, model: p?.defaultModel || "" });
        }}
        style={{
          width: "100%", padding: "6px 8px", borderRadius: 8,
          border: "1px solid rgba(15,23,42,0.15)", background: "#fff",
          fontSize: 12, marginBottom: 8,
        }}
      >
        {configured.length === 0 && <option value="">(no providers configured)</option>}
        {configured.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>

      <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#475569", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        Model
      </label>
      <select
        value={value.model}
        onChange={(e) => onChange({ provider: value.provider, model: e.target.value })}
        disabled={!availableModels.length}
        style={{
          width: "100%", padding: "6px 8px", borderRadius: 8,
          border: "1px solid rgba(15,23,42,0.15)", background: "#fff",
          fontSize: 12,
        }}
      >
        {availableModels.length === 0 && <option value="">—</option>}
        {availableModels.map((m) => (
          <option key={m} value={m}>{prettyModel(m)}</option>
        ))}
      </select>
      {priceRow && (
        <div style={{ fontSize: 10, color: "#64748b", marginTop: 6 }}>
          <b>${priceRow.inputPer1M.toFixed(2)}</b>/M input · <b>${priceRow.outputPer1M.toFixed(2)}</b>/M output
        </div>
      )}
      {onPromptChange && (
        <>
          <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#475569", marginTop: 10, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Custom prompt
          </label>
          <select
            value={promptId || ""}
            onChange={(e) => onPromptChange(e.target.value)}
            style={{
              width: "100%", padding: "6px 8px", borderRadius: 8,
              border: "1px solid rgba(15,23,42,0.15)", background: "#fff",
              fontSize: 12,
            }}
          >
            <option value="">— role default —</option>
            {(availablePrompts || []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · v{p.version} ({p.role})
              </option>
            ))}
          </select>
          {(!availablePrompts || availablePrompts.length === 0) && (
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>
              No prompts yet — create at <a href="/qcoreai/prompts" style={{ color: "#4f46e5" }}>/qcoreai/prompts</a>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EmptyState({
  strategies,
  onSuggest,
  onPickStrategy,
  currentStrategy,
  canSend,
}: {
  strategies: StrategyInfo[];
  onSuggest: (s: string, strategy?: Strategy) => void;
  onPickStrategy: (s: Strategy) => void;
  currentStrategy: Strategy;
  canSend: boolean;
}) {
  const CARDS: { id: Strategy; title: string; blurb: string; example: string; accent: string }[] = [
    {
      id: "sequential",
      title: "Sequential",
      blurb: "Analyst → Writer → Critic. Best for well-defined questions you want polished.",
      example: "Draft a one-page pitch for AEVION QRight aimed at fintech compliance officers.",
      accent: "#0d9488",
    },
    {
      id: "parallel",
      title: "Parallel drafts",
      blurb: "Two Writers on different models stream at once → Judge merges. Best for open-ended creative work.",
      example: "Propose three distinct architectures for a privacy-preserving IP registry and compare them.",
      accent: "#4338ca",
    },
    {
      id: "debate",
      title: "Debate",
      blurb: "Pro vs Con → Moderator. Best for decisions, trade-offs, and stress-testing recommendations.",
      example: "Should AEVION launch QTrade before or after the QRight v2 public beta? Defend both sides.",
      accent: "#7c3aed",
    },
  ];

  return (
    <div style={{ padding: "24px 8px" }}>
      <div style={{ textAlign: "center", marginBottom: 22 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>
          Pick a strategy — or try an example
        </div>
        <div style={{ fontSize: 13, color: "#475569", maxWidth: 620, margin: "0 auto" }}>
          Three agents coordinate on every answer. You see every step, every model, every token, and the running cost live.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        {CARDS.map((c) => {
          const isActive = c.id === currentStrategy;
          const meta = strategies.find((s) => s.id === c.id);
          return (
            <div
              key={c.id}
              style={{
                border: `1px solid ${isActive ? c.accent : "rgba(15,23,42,0.12)"}`,
                borderRadius: 14,
                background: isActive ? `${c.accent}0d` : "#fff",
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                transition: "transform 0.15s, box-shadow 0.15s",
                boxShadow: isActive ? `0 6px 20px ${c.accent}22` : "0 1px 4px rgba(15,23,42,0.04)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: c.accent, color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 900, fontSize: 12,
                  }}
                >
                  {c.id === "sequential" ? "→" : c.id === "parallel" ? "‖" : "⚖"}
                </span>
                <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a" }}>{c.title}</div>
                {isActive && (
                  <span
                    style={{
                      marginLeft: "auto", fontSize: 10, fontWeight: 800, color: c.accent,
                      padding: "2px 8px", borderRadius: 999, background: `${c.accent}1f`, border: `1px solid ${c.accent}55`,
                    }}
                  >
                    ACTIVE
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>{meta?.description || c.blurb}</div>
              <button
                onClick={() => canSend && onSuggest(c.example, c.id)}
                disabled={!canSend}
                style={{
                  textAlign: "left",
                  fontSize: 12, color: "#0f172a",
                  padding: "10px 12px", borderRadius: 10,
                  background: "#fff", border: "1px dashed rgba(15,23,42,0.18)",
                  fontStyle: "italic", cursor: canSend ? "pointer" : "default",
                  lineHeight: 1.45,
                }}
              >
                "{c.example}"
              </button>
              <button
                onClick={() => onPickStrategy(c.id)}
                style={{
                  marginTop: "auto",
                  padding: "6px 10px", borderRadius: 8,
                  border: `1px solid ${c.accent}66`,
                  background: isActive ? c.accent : "#fff",
                  color: isActive ? "#fff" : c.accent,
                  fontSize: 11, fontWeight: 800, cursor: "pointer",
                  alignSelf: "flex-start",
                }}
              >
                {isActive ? "Selected" : `Use ${c.title.toLowerCase()}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RunCard({
  run,
  onLoadDetails,
  onRerun,
  onEdit,
  onShare,
  onUnshare,
  onUpdateTags,
  refineOpen,
  refineText,
  refineBusy,
  onOpenRefine,
  onChangeRefineText,
  onCancelRefine,
  onApplyRefine,
  onContinue,
  onSaveTemplate,
}: {
  run: RunState;
  onLoadDetails?: () => void;
  onRerun?: () => void;
  onEdit?: () => void;
  onShare?: () => void;
  onUnshare?: () => void;
  onUpdateTags?: (tags: string[]) => void;
  refineOpen?: boolean;
  refineText?: string;
  refineBusy?: boolean;
  onOpenRefine?: () => void;
  onChangeRefineText?: (text: string) => void;
  onCancelRefine?: () => void;
  onApplyRefine?: () => void;
  onContinue?: (runId: string) => void;
  onSaveTemplate?: (runId: string) => void;
}) {
  const hasAgents = run.turns.length > 0;
  const grouped = groupTurns(run.turns);
  const [tagInput, setTagInput] = useState<string>("");
  const [tagInputOpen, setTagInputOpen] = useState<boolean>(false);
  const tags = run.tags || [];
  const stats = runStats(run);
  const displayStrategy = (run.strategy as Strategy) || "sequential";
  const totalDur = run.totalDurationMs ?? stats.durationMs;
  const totalCost = run.totalCostUsd ?? stats.costUsd;
  const totalTok = stats.tokensIn + stats.tokensOut;

  return (
    <div style={{ marginBottom: 24 }}>
      {/* User message */}
      <div style={{ marginBottom: 10, display: "flex", justifyContent: "flex-end" }}>
        <div
          style={{
            maxWidth: "85%",
            padding: "10px 14px", borderRadius: "14px 14px 4px 14px",
            background: "#0f172a", color: "#fff", fontSize: 14,
            whiteSpace: "pre-wrap", lineHeight: 1.55,
          }}
        >
          {run.userInput}
        </div>
      </div>

      {/* Attached QRight objects — visible reminder of the factual context
          the agents are working from. */}
      {run.attachments && run.attachments.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10, justifyContent: "flex-end" }}>
          {run.attachments.map((a) => (
            <span
              key={a.id}
              title={a.title || a.id}
              style={{
                padding: "3px 9px",
                borderRadius: 999,
                background: "rgba(13,148,136,0.1)",
                border: "1px solid rgba(13,148,136,0.3)",
                color: "#0f766e",
                fontSize: 11,
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              📎 {a.title || a.id.slice(0, 8)}
              {a.kind && <span style={{ fontSize: 10, opacity: 0.7 }}>· {a.kind}</span>}
            </span>
          ))}
        </div>
      )}

      {/* Agent turns (pair up parallel/debate writers) — guidance chips
          are interleaved at their `beforeTurnIndex` positions so the
          steer is visible right above the stage it shaped. */}
      {(() => {
        const out: React.ReactNode[] = [];
        let consumedTurns = 0;
        const guidanceList = run.guidance || [];
        const flushGuidanceBefore = (turnIdx: number) => {
          for (const g of guidanceList) {
            if (g.beforeTurnIndex === turnIdx) {
              out.push(<GuidanceChip key={`g-${turnIdx}-${g.appliedAt}`} item={g} />);
            }
          }
        };
        grouped.forEach((item, i) => {
          flushGuidanceBefore(consumedTurns);
          if ("pair" in item) {
            out.push(
              <div key={`pair-${i}`} className="qc-pair-grid" style={{ marginBottom: 0 }}>
                <AgentTurnCard turn={item.pair[0]} strategy={displayStrategy} />
                <AgentTurnCard turn={item.pair[1]} strategy={displayStrategy} />
              </div>
            );
            consumedTurns += 2;
          } else {
            out.push(<AgentTurnCard key={i} turn={item} strategy={displayStrategy} />);
            consumedTurns += 1;
          }
        });
        // Trailing guidance — applied but next stage hasn't started yet.
        flushGuidanceBefore(consumedTurns);
        return out;
      })()}

      {/* Verdict */}
      {run.verdict && (
        <div
          style={{
            margin: "8px 0 10px",
            padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700,
            background: run.verdict.approved ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.12)",
            border: `1px solid ${run.verdict.approved ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.4)"}`,
            color: run.verdict.approved ? "#065f46" : "#92400e",
            display: "inline-block",
          }}
        >
          {run.verdict.approved ? "Critic: APPROVE" : "Critic: REVISE → Writer rewriting"}
        </div>
      )}

      {/* Final */}
      {run.finalContent && (
        <>
          <FinalCard
            content={run.finalContent}
            runId={run.id}
            stopped={run.status === "stopped"}
            onContinue={onContinue}
          />
          {run.status !== "running" && onOpenRefine && !refineOpen && (
            <button
              onClick={onOpenRefine}
              title="One-pass surgical edit on top of this answer"
              style={{
                marginTop: 6,
                alignSelf: "flex-start",
                padding: "4px 10px",
                borderRadius: 8,
                border: "1px solid rgba(124,58,237,0.3)",
                background: "rgba(124,58,237,0.06)",
                color: "#6d28d9",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              ✎ Refine
            </button>
          )}
          {run.finalContent && run.status !== "running" && onSaveTemplate && (
            <button
              onClick={() => onSaveTemplate(run.id)}
              title="Save this prompt + config as a reusable template"
              style={{
                marginTop: 6,
                alignSelf: "flex-start",
                padding: "4px 10px",
                borderRadius: 8,
                border: "1px solid rgba(15,23,42,0.2)",
                background: "#f8fafc",
                color: "#475569",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              📋 Save as template
            </button>
          )}
          {refineOpen && (
            <div
              style={{
                marginTop: 6,
                border: "1px solid rgba(124,58,237,0.3)",
                background: "rgba(124,58,237,0.04)",
                borderRadius: 10,
                padding: 10,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <textarea
                value={refineText || ""}
                onChange={(e) => onChangeRefineText && onChangeRefineText(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    onApplyRefine && onApplyRefine();
                  } else if (e.key === "Escape") {
                    onCancelRefine && onCancelRefine();
                  }
                }}
                placeholder="e.g. Add a TL;DR section at the top, tighten the conclusion, fix the table…"
                disabled={refineBusy}
                rows={3}
                style={{
                  resize: "vertical",
                  borderRadius: 8,
                  border: "1px solid rgba(124,58,237,0.25)",
                  padding: "8px 10px",
                  fontSize: 12,
                  fontFamily: "inherit",
                  background: "#fff",
                  color: "#0f172a",
                  outline: "none",
                  minHeight: 60,
                }}
              />
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  onClick={onApplyRefine}
                  disabled={refineBusy || !(refineText || "").trim()}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 8,
                    background: refineBusy ? "#a78bfa" : "#7c3aed",
                    color: "#fff",
                    border: "none",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: refineBusy ? "default" : "pointer",
                  }}
                >
                  {refineBusy ? "Refining…" : "Apply (⌘/Ctrl+Enter)"}
                </button>
                <button
                  onClick={onCancelRefine}
                  disabled={refineBusy}
                  style={{
                    padding: "5px 10px",
                    borderRadius: 8,
                    background: "#fff",
                    color: "#475569",
                    border: "1px solid #cbd5e1",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel (Esc)
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Error */}
      {run.error && !run.finalContent && (
        <div
          style={{
            padding: "10px 14px", borderRadius: 10,
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.25)",
            color: "#991b1b", fontSize: 13, whiteSpace: "pre-wrap",
          }}
        >
          {run.error}
        </div>
      )}

      {/* Run footer: stats + rerun + export + trace */}
      {(run.status !== "running" || hasAgents) && (
        <div
          style={{
            marginTop: 10,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
            fontSize: 11,
            color: "#475569",
          }}
        >
          {run.status === "stopped" && (
            <span
              style={{
                padding: "2px 8px", borderRadius: 999,
                background: "#fef3c7", color: "#92400e",
                fontSize: 10, fontWeight: 800, border: "1px solid #fde68a",
              }}
            >
              STOPPED
            </span>
          )}
          {run.budgetExceeded && (
            <span
              title={`Spend cap of ${formatMoney(run.budgetExceeded.budgetUsd, 2)} crossed at ${formatMoney(run.budgetExceeded.spentUsd, 4)} — finalised with the latest writer output.`}
              style={{
                padding: "2px 8px", borderRadius: 999,
                background: "rgba(245,158,11,0.12)", color: "#92400e",
                fontSize: 10, fontWeight: 800, border: "1px solid rgba(245,158,11,0.4)",
              }}
            >
              💸 BUDGET CAP
            </span>
          )}
          {run.status === "error" && (
            <span
              style={{
                padding: "2px 8px", borderRadius: 999,
                background: "#fee2e2", color: "#991b1b",
                fontSize: 10, fontWeight: 800, border: "1px solid #fecaca",
              }}
            >
              ERROR
            </span>
          )}
          <span title="Total wall-clock time (parallel stages count once)">
            ⏱ {formatDuration(totalDur)}
          </span>
          <span title="Total tokens (in + out) across all agents">
            🔤 {totalTok.toLocaleString()} tok
          </span>
          <span
            title="Total USD cost across all agents in this run"
            style={{ fontWeight: 700, color: totalCost > 0 ? "#0f172a" : "#94a3b8" }}
          >
            💲 {formatMoney(totalCost)}
          </span>

          {/* Tag chips + + Tag input — owner-only edit, displayed for everyone. */}
          {run.persisted && run.id && !run.id.startsWith("tmp_") && (
            <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
              {tags.map((t) => (
                <span
                  key={t}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                    padding: "2px 6px 2px 8px",
                    borderRadius: 999,
                    background: "rgba(13,148,136,0.08)",
                    border: "1px solid rgba(13,148,136,0.25)",
                    color: "#0f766e",
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  {t}
                  {onUpdateTags && (
                    <button
                      onClick={() => onUpdateTags(tags.filter((x) => x !== t))}
                      title={`Remove "${t}"`}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#0f766e",
                        cursor: "pointer",
                        fontSize: 11,
                        padding: 0,
                        lineHeight: 1,
                        opacity: 0.6,
                      }}
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
              {onUpdateTags && tags.length < 16 && (
                tagInputOpen ? (
                  <input
                    autoFocus
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onBlur={() => {
                      const v = tagInput.trim();
                      if (v && !tags.includes(v)) onUpdateTags([...tags, v]);
                      setTagInput("");
                      setTagInputOpen(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const v = tagInput.trim();
                        if (v && !tags.includes(v)) onUpdateTags([...tags, v]);
                        setTagInput("");
                        setTagInputOpen(false);
                      } else if (e.key === "Escape") {
                        setTagInput("");
                        setTagInputOpen(false);
                      }
                    }}
                    placeholder="tag…"
                    maxLength={32}
                    style={{
                      width: 80,
                      padding: "2px 6px",
                      borderRadius: 999,
                      border: "1px solid rgba(13,148,136,0.4)",
                      background: "#fff",
                      fontSize: 10,
                      color: "#0f766e",
                      fontWeight: 600,
                      outline: "none",
                    }}
                  />
                ) : (
                  <button
                    onClick={() => setTagInputOpen(true)}
                    title="Add a tag"
                    style={{
                      padding: "2px 8px",
                      borderRadius: 999,
                      border: "1px dashed rgba(13,148,136,0.35)",
                      background: "transparent",
                      color: "#0f766e",
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    + Tag
                  </button>
                )
              )}
            </div>
          )}

          <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
            {onEdit && run.status !== "running" && (
              <button
                onClick={onEdit}
                style={{
                  padding: "5px 10px", borderRadius: 8,
                  background: "#fff", border: "1px solid #cbd5e1",
                  color: "#0f172a", fontSize: 11, fontWeight: 700, cursor: "pointer",
                }}
                title="Load this prompt + settings into the input so you can tweak and resend"
              >
                ✎ Edit
              </button>
            )}
            {onRerun && run.status !== "running" && (
              <button
                onClick={onRerun}
                style={{
                  padding: "5px 10px", borderRadius: 8,
                  background: "#fff", border: "1px solid #cbd5e1",
                  color: "#0f172a", fontSize: 11, fontWeight: 700, cursor: "pointer",
                }}
                title="Re-run this prompt with the same settings"
              >
                ↻ Rerun
              </button>
            )}
            {run.persisted && run.id && !run.id.startsWith("tmp_") && (
              <>
                {run.shareToken ? (
                  <>
                    <a
                      href={`/qcoreai/shared/${run.shareToken}`}
                      target="_blank" rel="noreferrer"
                      style={{
                        padding: "5px 10px", borderRadius: 8,
                        background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.35)",
                        color: "#6d28d9", fontSize: 11, fontWeight: 700, textDecoration: "none",
                      }}
                      title="Open public link in new tab"
                    >
                      🔗 Public
                    </a>
                    <button
                      onClick={async () => {
                        const origin = typeof window !== "undefined" ? window.location.origin : "";
                        const snippet =
                          `<iframe\n` +
                          `  src="${origin}/qcoreai/embed/${run.shareToken}?theme=light"\n` +
                          `  width="100%"\n` +
                          `  height="520"\n` +
                          `  frameborder="0"\n` +
                          `  loading="lazy"\n` +
                          `  title="QCoreAI run"\n` +
                          `  style="border:1px solid rgba(15,23,42,0.1); border-radius:14px;"\n` +
                          `></iframe>`;
                        try {
                          await navigator.clipboard.writeText(snippet);
                          alert("Iframe snippet copied!\n\nTip: pass ?theme=dark&compact=1 to render minimal/dark.");
                        } catch {
                          window.prompt("Copy this iframe snippet:", snippet);
                        }
                      }}
                      title="Copy embed iframe snippet to clipboard"
                      style={{
                        padding: "5px 10px", borderRadius: 8,
                        background: "rgba(13,148,136,0.08)", border: "1px solid rgba(13,148,136,0.3)",
                        color: "#0f766e", fontSize: 11, fontWeight: 700, cursor: "pointer",
                      }}
                    >
                      &lt;/&gt; Embed
                    </button>
                    {onUnshare && (
                      <button
                        onClick={onUnshare}
                        style={{
                          padding: "5px 10px", borderRadius: 8,
                          background: "#fff", border: "1px solid #cbd5e1",
                          color: "#991b1b", fontSize: 11, fontWeight: 700, cursor: "pointer",
                        }}
                        title="Revoke public link"
                      >
                        Unshare
                      </button>
                    )}
                  </>
                ) : onShare ? (
                  <button
                    onClick={onShare}
                    style={{
                      padding: "5px 10px", borderRadius: 8,
                      background: "#fff", border: "1px solid #cbd5e1",
                      color: "#6d28d9", fontSize: 11, fontWeight: 700, cursor: "pointer",
                    }}
                    title="Create a public link to share this run"
                  >
                    🔗 Share
                  </button>
                ) : null}
                <a
                  href={`${getBackendOrigin()}/api/qcoreai/runs/${run.id}/export?format=md`}
                  target="_blank" rel="noreferrer"
                  style={{
                    padding: "5px 10px", borderRadius: 8,
                    background: "#fff", border: "1px solid #cbd5e1",
                    color: "#0f172a", fontSize: 11, fontWeight: 700, textDecoration: "none",
                  }}
                  title="Download as Markdown"
                >
                  ⬇ Markdown
                </a>
                <a
                  href={`${getBackendOrigin()}/api/qcoreai/runs/${run.id}/export?format=json`}
                  target="_blank" rel="noreferrer"
                  style={{
                    padding: "5px 10px", borderRadius: 8,
                    background: "#fff", border: "1px solid #cbd5e1",
                    color: "#0f172a", fontSize: 11, fontWeight: 700, textDecoration: "none",
                  }}
                  title="Download as JSON"
                >
                  ⬇ JSON
                </a>
                <a
                  href={`/qcoreai/compare?a=${run.id}`}
                  style={{
                    padding: "5px 10px", borderRadius: 8,
                    background: "#fff", border: "1px solid #c7d2fe",
                    color: "#4338ca", fontSize: 11, fontWeight: 700, textDecoration: "none",
                  }}
                  title="Compare this run with another"
                >
                  ⚖️ Compare
                </a>
              </>
            )}
            {!hasAgents && run.finalContent && onLoadDetails && (
              <button
                onClick={onLoadDetails}
                style={{
                  padding: "5px 10px", borderRadius: 8,
                  background: "transparent", border: "1px dashed #94a3b8",
                  color: "#475569", fontSize: 11, fontWeight: 600, cursor: "pointer",
                }}
              >
                Show agent trace
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function GuidanceChip({ item }: { item: GuidanceItem }) {
  return (
    <div
      style={{
        margin: "0 0 8px",
        padding: "8px 12px",
        borderRadius: 10,
        background: "rgba(196,181,253,0.18)",
        border: "1px solid rgba(124,58,237,0.35)",
        display: "flex",
        gap: 8,
        alignItems: "flex-start",
      }}
      title="Mid-run guidance you sent — applied to the next writer stage."
    >
      <span
        style={{
          width: 22, height: 22, borderRadius: 6,
          background: "#7c3aed", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 900, flexShrink: 0,
        }}
        aria-hidden
      >
        ↪
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#6d28d9", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 2 }}>
          You steered the next stage
        </div>
        <div style={{ fontSize: 13, color: "#0f172a", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
          {item.text}
        </div>
      </div>
    </div>
  );
}

function AgentTurnCard({ turn, strategy }: { turn: AgentTurn; strategy: Strategy }) {
  const s = turnStyle(turn.role, turn.stage, turn.instance, strategy);
  const streaming = turn.status === "streaming";
  const stageBadge =
    turn.stage === "revision" ? " (revision)" :
    turn.stage === "judge" ? "" :
    turn.instance === "pro" || turn.instance === "con" ? "" :
    turn.instance ? ` · ${turn.instance.toUpperCase()}` : "";
  return (
    <div
      style={{
        margin: "0 0 10px",
        padding: "10px 14px",
        borderRadius: 12,
        background: "#fff",
        border: `1px solid ${s.color}33`,
        boxShadow: "0 1px 4px rgba(15,23,42,0.04)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
        <span
          style={{
            width: 22, height: 22, borderRadius: 6,
            background: s.color, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 900,
          }}
        >
          {s.tag}
        </span>
        <span style={{ fontWeight: 800, fontSize: 12, color: s.color }}>
          {s.label}{stageBadge}
        </span>
        {turn.model && (
          <span style={{ fontSize: 11, color: "#94a3b8" }}>
            {prettyModel(turn.model)}
          </span>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center", fontSize: 11, color: "#94a3b8", flexWrap: "wrap" }}>
          {streaming && (
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color, animation: "qc-pulse 1.2s ease-in-out infinite" }} />
              streaming
            </span>
          )}
          {!streaming && turn.durationMs != null && <span>{formatDuration(turn.durationMs)}</span>}
          {!streaming && (turn.tokensIn != null || turn.tokensOut != null) && (
            <span>{(turn.tokensIn ?? 0)}→{(turn.tokensOut ?? 0)} tok</span>
          )}
          {!streaming && turn.costUsd != null && turn.costUsd > 0 && (
            <span style={{ color: "#0f172a", fontWeight: 700 }}>{formatMoney(turn.costUsd)}</span>
          )}
        </div>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.55, color: "#0f172a" }}>
        <Markdown source={turn.content || (streaming ? "…" : "")} />
        {streaming && <span style={{ animation: "qc-blink 1s step-end infinite" }}>▌</span>}
      </div>
      <style jsx global>{`
        @keyframes qc-pulse { 0%,100% { opacity: 0.4 } 50% { opacity: 1 } }
        @keyframes qc-blink { 50% { opacity: 0 } }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Turn grouping + Final card + Markdown
   ═══════════════════════════════════════════════════════════════════════ */

type TurnGroup = AgentTurn | { pair: [AgentTurn, AgentTurn] };

/** Group parallel/debate writer drafts into pairs. Keeps stable left/right ordering. */
function groupTurns(turns: AgentTurn[]): TurnGroup[] {
  const out: TurnGroup[] = [];
  const consumed = new Set<number>();
  const LEFT = new Set(["a", "pro"]);
  const RIGHT = new Set(["b", "con"]);
  for (let i = 0; i < turns.length; i++) {
    if (consumed.has(i)) continue;
    const t = turns[i];
    if (t.role === "writer" && t.stage === "draft" && (LEFT.has(t.instance || "") || RIGHT.has(t.instance || ""))) {
      let peerIdx = -1;
      for (let j = i + 1; j < turns.length; j++) {
        if (consumed.has(j)) continue;
        const p = turns[j];
        if (p.role !== "writer" || p.stage !== "draft") continue;
        const bothA = LEFT.has(t.instance || "") && RIGHT.has(p.instance || "");
        const bothB = RIGHT.has(t.instance || "") && LEFT.has(p.instance || "");
        if (bothA || bothB) { peerIdx = j; break; }
      }
      if (peerIdx >= 0) {
        const peer = turns[peerIdx];
        const left = LEFT.has(t.instance || "") ? t : peer;
        const right = RIGHT.has(t.instance || "") ? t : peer;
        out.push({ pair: [left, right] });
        consumed.add(i);
        consumed.add(peerIdx);
        continue;
      }
    }
    out.push(t);
  }
  return out;
}

function FinalCard({
  content, runId, stopped, onContinue,
}: {
  content: string; runId: string; stopped?: boolean;
  onContinue?: (runId: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch { /* noop */ }
  };
  return (
    <div
      style={{
        marginTop: 4,
        padding: "14px 16px",
        borderRadius: 14,
        background: "#fff",
        border: `2px solid ${stopped ? "#f59e0b" : FINAL_STYLE.color}`,
        boxShadow: `0 4px 16px ${stopped ? "rgba(245,158,11,0.08)" : "rgba(124,58,237,0.08)"}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span
          style={{
            width: 24, height: 24, borderRadius: 6,
            background: stopped ? "#f59e0b" : FINAL_STYLE.color, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 900,
          }}
        >
          ★
        </span>
        <span style={{ fontWeight: 800, fontSize: 13, color: stopped ? "#92400e" : "#581c87" }}>
          {stopped ? "Partial answer (stopped)" : "Final answer"}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {onContinue && (
            <button
              onClick={() => onContinue(runId)}
              title="Continue this thread — sends a follow-up with full context"
              style={{
                padding: "4px 10px", borderRadius: 8,
                border: "1px solid rgba(124,58,237,0.3)",
                background: "#fff", color: "#6d28d9",
                fontSize: 11, fontWeight: 700, cursor: "pointer",
              }}
            >
              ↩ Continue
            </button>
          )}
          <button
            onClick={copy}
            style={{
              padding: "4px 10px",
              borderRadius: 8,
              border: "1px solid rgba(124,58,237,0.3)",
              background: copied ? "rgba(124,58,237,0.12)" : "#fff",
              color: "#6d28d9",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.6, color: "#0f172a" }}>
        <Markdown source={content} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Minimal Markdown renderer.
   Supported: #/##/###/#### headings, **bold**, *italic*, `inline code`,
   - / * / 1. lists, > blockquotes, ``` fenced code, | pipe | tables.
   ═══════════════════════════════════════════════════════════════════════ */

function Markdown({ source }: { source: string }) {
  if (!source) return null;
  const lines = source.split("\n");
  const blocks: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let orderedList = false;
  let quoteBuffer: string[] = [];
  let codeBuffer: string[] | null = null;
  let tableBuffer: string[] | null = null;

  const flushList = () => {
    if (listBuffer.length === 0) return;
    const items = listBuffer;
    const key = `list-${blocks.length}`;
    const styles = { margin: "4px 0 6px 20px", padding: 0, fontSize: "inherit" } as const;
    if (orderedList) {
      blocks.push(
        <ol key={key} style={styles}>
          {items.map((it, i) => <li key={i} style={{ margin: "2px 0" }}><InlineMD text={it} /></li>)}
        </ol>
      );
    } else {
      blocks.push(
        <ul key={key} style={styles}>
          {items.map((it, i) => <li key={i} style={{ margin: "2px 0" }}><InlineMD text={it} /></li>)}
        </ul>
      );
    }
    listBuffer = [];
    orderedList = false;
  };

  const flushQuote = () => {
    if (quoteBuffer.length === 0) return;
    blocks.push(
      <blockquote
        key={`q-${blocks.length}`}
        style={{
          margin: "6px 0",
          padding: "4px 12px",
          borderLeft: "3px solid #7c3aed",
          background: "rgba(124,58,237,0.05)",
          color: "#334155",
          fontStyle: "italic",
          borderRadius: "0 6px 6px 0",
        }}
      >
        {quoteBuffer.map((q, i) => (
          <div key={i} style={{ margin: "2px 0" }}><InlineMD text={q} /></div>
        ))}
      </blockquote>
    );
    quoteBuffer = [];
  };

  const flushTable = () => {
    if (!tableBuffer || tableBuffer.length < 2) {
      // Not a valid table — render as plain paragraphs.
      if (tableBuffer) {
        for (const l of tableBuffer) {
          blocks.push(
            <p key={`p-${blocks.length}`} style={{ margin: "4px 0" }}>
              <InlineMD text={l} />
            </p>
          );
        }
      }
      tableBuffer = null;
      return;
    }
    const rows = tableBuffer.map((l) => splitTableRow(l));
    tableBuffer = null;
    // Validate: second row must be separator (--- cells).
    const sep = rows[1];
    const isSeparator = sep.every((c) => /^:?-{3,}:?$/.test(c.trim()));
    if (!isSeparator) {
      // Render as paragraphs.
      for (const r of rows) {
        blocks.push(
          <p key={`p-${blocks.length}`} style={{ margin: "4px 0" }}>
            <InlineMD text={r.join(" | ")} />
          </p>
        );
      }
      return;
    }
    const header = rows[0];
    const body = rows.slice(2);
    blocks.push(
      <div
        key={`tbl-${blocks.length}`}
        style={{ overflowX: "auto", margin: "8px 0" }}
      >
        <table
          style={{
            borderCollapse: "collapse",
            fontSize: 12,
            minWidth: "50%",
            border: "1px solid rgba(15,23,42,0.12)",
            background: "#fff",
          }}
        >
          <thead>
            <tr>
              {header.map((h, i) => (
                <th
                  key={i}
                  style={{
                    textAlign: "left",
                    padding: "6px 10px",
                    background: "#f8fafc",
                    borderBottom: "1px solid rgba(15,23,42,0.15)",
                    fontWeight: 800,
                    color: "#0f172a",
                  }}
                >
                  <InlineMD text={h} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, ri) => (
              <tr key={ri} style={{ background: ri % 2 ? "#fafbfc" : "#fff" }}>
                {row.map((c, ci) => (
                  <td
                    key={ci}
                    style={{
                      padding: "5px 10px",
                      borderTop: "1px solid rgba(15,23,42,0.08)",
                      color: "#0f172a",
                      verticalAlign: "top",
                    }}
                  >
                    <InlineMD text={c} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const flushAll = () => { flushList(); flushQuote(); flushTable(); };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, "");

    // Code fence
    if (/^```/.test(line)) {
      if (codeBuffer) {
        blocks.push(
          <pre
            key={`code-${blocks.length}`}
            style={{ background: "#f1f5f9", padding: "8px 10px", borderRadius: 6, margin: "6px 0", fontSize: 12, overflowX: "auto" }}
          >
            <code>{codeBuffer.join("\n")}</code>
          </pre>
        );
        codeBuffer = null;
      } else {
        flushAll();
        codeBuffer = [];
      }
      continue;
    }
    if (codeBuffer) { codeBuffer.push(line); continue; }

    // Table row?
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flushList();
      flushQuote();
      if (!tableBuffer) tableBuffer = [];
      tableBuffer.push(line.trim());
      continue;
    }
    if (tableBuffer) flushTable();

    // Blank line
    if (/^\s*$/.test(line)) { flushAll(); continue; }

    // Blockquote
    const quote = /^\s*>\s?(.*)$/.exec(line);
    if (quote) {
      flushList();
      quoteBuffer.push(quote[1]);
      continue;
    }
    if (quoteBuffer.length) flushQuote();

    // Heading
    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      flushAll();
      const level = heading[1].length;
      const sizes = [17, 15, 14, 13];
      blocks.push(
        <div
          key={`h-${blocks.length}`}
          style={{ fontSize: sizes[level - 1], fontWeight: 800, margin: "8px 0 4px", color: "#0f172a" }}
        >
          <InlineMD text={heading[2]} />
        </div>
      );
      continue;
    }

    // Bullets
    const bullet = /^\s*[-*•]\s+(.+)$/.exec(line);
    if (bullet) {
      if (orderedList) flushList();
      listBuffer.push(bullet[1]);
      continue;
    }
    const ordered = /^\s*\d+\.\s+(.+)$/.exec(line);
    if (ordered) {
      if (!orderedList && listBuffer.length) flushList();
      orderedList = true;
      listBuffer.push(ordered[1]);
      continue;
    }

    flushAll();
    blocks.push(
      <p key={`p-${blocks.length}`} style={{ margin: "4px 0" }}>
        <InlineMD text={line} />
      </p>
    );
  }
  flushAll();
  if (codeBuffer) {
    blocks.push(
      <pre
        key={`code-${blocks.length}`}
        style={{ background: "#f1f5f9", padding: "8px 10px", borderRadius: 6, margin: "6px 0", fontSize: 12, overflowX: "auto" }}
      >
        <code>{codeBuffer.join("\n")}</code>
      </pre>
    );
  }
  return <>{blocks}</>;
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  // Split on unescaped pipes. We don't support escaped pipes here (rare in agent output).
  return trimmed.split("|").map((c) => c.trim());
}

function InlineMD({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let key = 0;
  const regex = /(\*\*([^*\n]+)\*\*)|(\*([^*\n]+)\*)|(`([^`\n]+)`)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) parts.push(text.slice(lastIdx, match.index));
    if (match[2] !== undefined) parts.push(<strong key={key++}>{match[2]}</strong>);
    else if (match[4] !== undefined) parts.push(<em key={key++}>{match[4]}</em>);
    else if (match[6] !== undefined) {
      parts.push(
        <code
          key={key++}
          style={{ background: "#f1f5f9", padding: "1px 5px", borderRadius: 4, fontSize: "0.92em" }}
        >
          {match[6]}
        </code>
      );
    }
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return <>{parts}</>;
}
