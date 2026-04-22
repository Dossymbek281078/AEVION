"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

/* ═══════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════ */

type AgentRole = "analyst" | "writer" | "critic";
type ConfigRoleId = "analyst" | "writer" | "writerB" | "critic";
type Stage = "draft" | "revision" | "judge";
type Strategy = "sequential" | "parallel";

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
};

type RunState = {
  id: string;
  sessionId: string;
  userInput: string;
  turns: AgentTurn[];
  verdict?: { approved: boolean; feedback: string };
  finalContent?: string;
  error?: string;
  status: "running" | "done" | "error";
  startedAt: number;
  persisted?: boolean;
};

type SessionSummary = {
  id: string;
  title: string;
  updatedAt: string;
  userId: string | null;
};

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
  | { type: "agent_end"; role: AgentRole; stage: Stage; content: string; tokensIn?: number; tokensOut?: number; durationMs: number; instance?: string }
  | { type: "verdict"; approved: boolean; feedback: string }
  | { type: "final"; content: string }
  | { type: "error"; message: string; role?: AgentRole }
  | { type: "done"; totalDurationMs: number }
  | { type: "sse_end" };

/* ═══════════════════════════════════════════════════════════════════════
   Role styling
   ═══════════════════════════════════════════════════════════════════════ */

const ROLE_STYLE: Record<ConfigRoleId, { color: string; bg: string; tag: string; label: string; desc: string }> = {
  analyst: { color: "#2563eb", bg: "rgba(37,99,235,0.08)",  tag: "A",  label: "Analyst",  desc: "Decomposes your request: plan, facts, risks" },
  writer:  { color: "#059669", bg: "rgba(5,150,105,0.08)",  tag: "W",  label: "Writer",   desc: "Drafts the final answer from the Analyst's plan" },
  writerB: { color: "#0891b2", bg: "rgba(8,145,178,0.08)",  tag: "W²", label: "Writer B", desc: "Parallel mode: second voice on a different model" },
  critic:  { color: "#d97706", bg: "rgba(217,119,6,0.08)",  tag: "C",  label: "Critic",   desc: "Approves draft or requests fixes (sequential) · synthesizes drafts (parallel)" },
};

const FINAL_STYLE = { color: "#7c3aed", bg: "rgba(124,58,237,0.08)" };

/** Pick the visual style for a turn using role + stage + instance. */
function turnStyle(role: AgentRole, stage: Stage, instance?: string) {
  if (role === "critic" && stage === "judge") {
    return { ...ROLE_STYLE.critic, tag: "J", label: "Judge" };
  }
  if (role === "writer" && instance === "b") {
    return ROLE_STYLE.writerB;
  }
  if (role === "writer") {
    return ROLE_STYLE.writer;
  }
  if (role === "analyst") return ROLE_STYLE.analyst;
  return ROLE_STYLE.critic;
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

/* ═══════════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════════ */

export default function QCoreMultiAgentPage() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [roleDefaults, setRoleDefaults] = useState<RoleDefault[]>([]);
  const [strategies, setStrategies] = useState<StrategyInfo[]>([]);
  const [strategy, setStrategy] = useState<Strategy>("sequential");
  const [overrides, setOverrides] = useState<Record<ConfigRoleId, { provider: string; model: string }>>({
    analyst: { provider: "", model: "" },
    writer: { provider: "", model: "" },
    writerB: { provider: "", model: "" },
    critic: { provider: "", model: "" },
  });
  const [maxRevisions, setMaxRevisions] = useState(1);
  const [configOpen, setConfigOpen] = useState(false);

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [runs, setRuns] = useState<RunState[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const timelineRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  /* ── Load providers + role defaults + sessions on mount ── */
  useEffect(() => {
    (async () => {
      try {
        const [provRes, agRes, sessRes] = await Promise.all([
          fetch(apiUrl("/api/qcoreai/providers")),
          fetch(apiUrl("/api/qcoreai/agents")),
          fetch(apiUrl("/api/qcoreai/sessions"), { headers: bearerHeader() }),
        ]);
        const provData = await provRes.json().catch(() => ({}));
        const agData = await agRes.json().catch(() => ({}));
        const sessData = await sessRes.json().catch(() => ({}));

        if (provData?.providers) setProviders(provData.providers);
        if (Array.isArray(agData?.strategies)) setStrategies(agData.strategies);
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
      } catch (e: any) {
        setGlobalError(e?.message || "Failed to load QCoreAI config");
      }
    })();
  }, []);

  /* ── Auto-scroll on new chunks ── */
  useEffect(() => {
    if (!timelineRef.current) return;
    timelineRef.current.scrollTo({ top: timelineRef.current.scrollHeight, behavior: "smooth" });
  }, [runs]);

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
        persisted: true,
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
      const turns: AgentTurn[] = (data.messages || [])
        .filter((m: any) => m.role === "analyst" || m.role === "writer" || m.role === "critic")
        .map((m: any) => ({
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
        }));
      setRuns((prev) => prev.map((r) => (r.id === runId ? { ...r, turns } : r)));
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

  /* ── Send a new prompt (starts a run, streams SSE) ── */
  const send = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || busy) return;

    setInput("");
    setGlobalError(null);
    setBusy(true);

    // Prepend a placeholder run so user sees activity immediately.
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
      },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const body = {
        input: msg,
        sessionId: activeSessionId,
        strategy,
        maxRevisions,
        overrides: {
          analyst: overrides.analyst,
          writer: overrides.writer,
          writerB: overrides.writerB,
          critic: overrides.critic,
        },
      };
      const res = await fetch(apiUrl("/api/qcoreai/multi-agent"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
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
                // In parallel mode multiple turns can stream concurrently — match by role+stage+instance.
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
          case "error":
            setRuns((prev) =>
              prev.map((r) => (r.id === realRunId ? { ...r, error: (r.error ? r.error + "\n" : "") + payload.message } : r))
            );
            break;
          case "done":
            setRuns((prev) =>
              prev.map((r) => (r.id === realRunId ? { ...r, status: r.error ? "error" : "done" } : r))
            );
            break;
          case "sse_end":
            break;
        }
      }

      // Refresh sessions list (might have created a new one).
      try {
        const sessRes = await fetch(apiUrl("/api/qcoreai/sessions"), { headers: bearerHeader() });
        const sessData = await sessRes.json();
        if (Array.isArray(sessData?.items)) setSessions(sessData.items);
      } catch { /* noop */ }
    } catch (e: any) {
      const msg = e?.name === "AbortError" ? "Stopped." : e?.message || "Stream failed";
      setGlobalError(msg);
      setRuns((prev) => prev.map((r) => (r.status === "running" ? { ...r, status: "error", error: msg } : r)));
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }, [input, busy, activeSessionId, maxRevisions, overrides, strategy]);

  const stop = useCallback(() => {
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch { /* noop */ }
      abortRef.current = null;
    }
  }, []);

  const configuredProviders = useMemo(() => providers.filter((p) => p.configured), [providers]);
  const anyConfigured = configuredProviders.length > 0;

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
                  Analyst + Writer + Critic — inspectable AI pipeline with streaming and persistent sessions.
                </p>
              </div>
              <Link
                href="/qcoreai"
                style={{
                  padding: "8px 14px",
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
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
              {/* Strategy toggle */}
              <div
                style={{
                  display: "flex",
                  padding: 3,
                  borderRadius: 10,
                  background: "rgba(0,0,0,0.28)",
                  border: "1px solid rgba(255,255,255,0.14)",
                }}
              >
                {(["sequential", "parallel"] as Strategy[]).map((s) => (
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
                    {s === "sequential" ? "Sequential" : "Parallel"}
                  </button>
                ))}
              </div>

              {/* Active roles pills */}
              {(strategy === "parallel"
                ? (["analyst", "writer", "writerB", "critic"] as ConfigRoleId[])
                : (["analyst", "writer", "critic"] as ConfigRoleId[])
              ).map((roleId) => {
                const s = ROLE_STYLE[roleId];
                const ov = overrides[roleId];
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
                    <span style={{ fontWeight: 700 }}>{roleId === "critic" && strategy === "parallel" ? "Judge" : s.label}</span>
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
            </div>
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
                  .filter((r) => (strategy === "parallel" ? true : r.id !== "writerB"))
                  .map((r) => (
                    <RoleConfigCard
                      key={r.id}
                      role={r}
                      strategy={strategy}
                      providers={providers}
                      value={overrides[r.id]}
                      onChange={(v) => setOverrides((prev) => ({ ...prev, [r.id]: v }))}
                    />
                  ))}
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
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16, alignItems: "start" }}>
          {/* Sessions sidebar */}
          <aside
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
                  <div key={s.id} style={{ display: "flex", alignItems: "stretch", gap: 4 }}>
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
                      onClick={() => removeSession(s.id)}
                      title="Delete session"
                      style={{
                        width: 28, borderRadius: 8,
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
          </aside>

          {/* Main conversation */}
          <section>
            <div
              ref={timelineRef}
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
                <EmptyState onSuggest={(s) => send(s)} canSend={anyConfigured} />
              ) : (
                runs.map((run) => (
                  <RunCard
                    key={run.id}
                    run={run}
                    onLoadDetails={run.persisted && run.turns.length === 0 ? () => expandRunDetails(run.id) : undefined}
                  />
                ))
              )}
            </div>

            {globalError && (
              <div
                style={{
                  color: "#b91c1c", background: "rgba(239,68,68,0.06)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  borderRadius: 10, padding: "8px 12px", fontSize: 12, marginBottom: 10,
                }}
              >
                {globalError}
              </div>
            )}

            {/* Input */}
            <div style={{ display: "flex", gap: 8 }}>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Describe your task — the Analyst will decompose, Writer will draft, Critic will check."
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
                <button
                  type="button"
                  onClick={() => send()}
                  disabled={!input.trim() || !anyConfigured}
                  style={{
                    padding: "12px 24px", borderRadius: 12, border: "none",
                    background: !input.trim() || !anyConfigured ? "#94a3b8" : "linear-gradient(135deg, #0d9488, #06b6d4)",
                    color: "#fff", fontWeight: 800, fontSize: 14,
                    cursor: !input.trim() || !anyConfigured ? "default" : "pointer",
                    alignSelf: "stretch",
                  }}
                >
                  Send
                </button>
              )}
            </div>
          </section>
        </div>
      </ProductPageShell>
    </main>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Subcomponents
   ═══════════════════════════════════════════════════════════════════════ */

function RoleConfigCard({
  role,
  strategy,
  providers,
  value,
  onChange,
}: {
  role: RoleDefault;
  strategy: Strategy;
  providers: ProviderInfo[];
  value: { provider: string; model: string };
  onChange: (v: { provider: string; model: string }) => void;
}) {
  const s = ROLE_STYLE[role.id];
  const currentProvider = providers.find((p) => p.id === value.provider);
  const availableModels = currentProvider?.models || [];
  const configured = providers.filter((p) => p.configured);
  const displayLabel = role.id === "critic" && strategy === "parallel" ? "Judge" : s.label;

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
          {role.id === "critic" && strategy === "parallel" ? "J" : s.tag}
        </span>
        <span style={{ fontWeight: 800, fontSize: 13, color: "#0f172a" }}>{displayLabel}</span>
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
    </div>
  );
}

function EmptyState({ onSuggest, canSend }: { onSuggest: (s: string) => void; canSend: boolean }) {
  const SUGGESTIONS = [
    "Explain how QRight protects my IP — in a way I can repeat to a non-technical customer.",
    "I'm designing the Planet Compliance flow. What edge cases should I test first?",
    "Compare single-chat vs multi-agent AI for a customer-support tool. Recommend one.",
  ];
  return (
    <div style={{ textAlign: "center", padding: "40px 20px" }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>
        How the pipeline works
      </div>
      <div style={{ fontSize: 12, color: "#475569", marginBottom: 18, maxWidth: 540, margin: "0 auto 18px" }}>
        Your prompt is read by the <b>Analyst</b> (plan & risks) → handed to the <b>Writer</b> (drafts the answer)
        → reviewed by the <b>Critic</b>. If the Critic asks for changes, the Writer revises. Everything streams live.
      </div>
      {canSend && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => onSuggest(s)}
              style={{
                padding: "8px 14px", borderRadius: 10,
                border: "1px solid rgba(15,23,42,0.12)", background: "#fff",
                fontSize: 12, color: "#334155", cursor: "pointer",
                fontWeight: 600, maxWidth: 320, textAlign: "left",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RunCard({ run, onLoadDetails }: { run: RunState; onLoadDetails?: () => void }) {
  const hasAgents = run.turns.length > 0;
  const grouped = groupTurns(run.turns);
  return (
    <div style={{ marginBottom: 20 }}>
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

      {/* Agent turns (pair up parallel writers) */}
      {grouped.map((item, i) =>
        "pair" in item ? (
          <div
            key={`pair-${i}`}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginBottom: 0,
            }}
          >
            <AgentTurnCard turn={item.pair[0]} />
            <AgentTurnCard turn={item.pair[1]} />
          </div>
        ) : (
          <AgentTurnCard key={i} turn={item} />
        )
      )}

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
      {run.finalContent && <FinalCard content={run.finalContent} />}

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

      {/* "View agents" for past runs */}
      {!hasAgents && run.finalContent && onLoadDetails && (
        <div style={{ marginTop: 8 }}>
          <button
            onClick={onLoadDetails}
            style={{
              padding: "6px 12px", borderRadius: 8,
              background: "transparent", border: "1px dashed #94a3b8",
              color: "#475569", fontSize: 11, fontWeight: 600, cursor: "pointer",
            }}
          >
            Show agent trace
          </button>
        </div>
      )}
    </div>
  );
}

function AgentTurnCard({ turn }: { turn: AgentTurn }) {
  const s = turnStyle(turn.role, turn.stage, turn.instance);
  const streaming = turn.status === "streaming";
  const stageBadge =
    turn.stage === "revision" ? " (revision)" :
    turn.stage === "judge" ? "" :
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
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center", fontSize: 11, color: "#94a3b8" }}>
          {streaming && (
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color, animation: "pulse 1.2s ease-in-out infinite" }} />
              streaming
            </span>
          )}
          {!streaming && turn.durationMs != null && <span>{formatDuration(turn.durationMs)}</span>}
          {!streaming && (turn.tokensIn != null || turn.tokensOut != null) && (
            <span>{(turn.tokensIn ?? 0)}→{(turn.tokensOut ?? 0)} tok</span>
          )}
        </div>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.55, color: "#0f172a" }}>
        <Markdown source={turn.content || (streaming ? "…" : "")} />
        {streaming && <span style={{ animation: "blink 1s step-end infinite" }}>▌</span>}
      </div>
      <style jsx>{`
        @keyframes pulse { 0%,100% { opacity: 0.4 } 50% { opacity: 1 } }
        @keyframes blink { 50% { opacity: 0 } }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Turn grouping + Final card + Markdown
   ═══════════════════════════════════════════════════════════════════════ */

type TurnGroup = AgentTurn | { pair: [AgentTurn, AgentTurn] };

/** Group parallel writer drafts (instance a + b, same stage="draft") into pairs. */
function groupTurns(turns: AgentTurn[]): TurnGroup[] {
  const out: TurnGroup[] = [];
  const consumed = new Set<number>();
  for (let i = 0; i < turns.length; i++) {
    if (consumed.has(i)) continue;
    const t = turns[i];
    if (t.role === "writer" && t.stage === "draft" && (t.instance === "a" || t.instance === "b")) {
      let peerIdx = -1;
      for (let j = i + 1; j < turns.length; j++) {
        if (consumed.has(j)) continue;
        const p = turns[j];
        if (p.role === "writer" && p.stage === "draft" && p.instance && p.instance !== t.instance) {
          peerIdx = j;
          break;
        }
      }
      if (peerIdx >= 0) {
        const peer = turns[peerIdx];
        const a = t.instance === "a" ? t : peer;
        const b = t.instance === "b" ? t : peer;
        out.push({ pair: [a, b] });
        consumed.add(i);
        consumed.add(peerIdx);
        continue;
      }
    }
    out.push(t);
  }
  return out;
}

function FinalCard({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* noop */
    }
  };
  return (
    <div
      style={{
        marginTop: 4,
        padding: "14px 16px",
        borderRadius: 14,
        background: "#fff",
        border: `2px solid ${FINAL_STYLE.color}`,
        boxShadow: "0 4px 16px rgba(124,58,237,0.08)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span
          style={{
            width: 24, height: 24, borderRadius: 6,
            background: FINAL_STYLE.color, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 900,
          }}
        >
          ★
        </span>
        <span style={{ fontWeight: 800, fontSize: 13, color: "#581c87" }}>Final answer</span>
        <button
          onClick={copy}
          style={{
            marginLeft: "auto",
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
      <div style={{ fontSize: 14, lineHeight: 1.6, color: "#0f172a" }}>
        <Markdown source={content} />
      </div>
    </div>
  );
}

/* Minimal Markdown renderer — no external dependencies.
 * Supported: # / ## / ### / #### headings, **bold**, *italic*, `inline code`,
 * - / * / 1. lists, ``` fenced code blocks, blank lines as paragraph breaks.
 * Unsupported features fall back to plain text. */
function Markdown({ source }: { source: string }) {
  if (!source) return null;
  const lines = source.split("\n");
  const blocks: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let orderedList = false;
  let codeBuffer: string[] | null = null;
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
  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, "");
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
        flushList();
        codeBuffer = [];
      }
      continue;
    }
    if (codeBuffer) { codeBuffer.push(line); continue; }
    if (/^\s*$/.test(line)) { flushList(); continue; }
    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      flushList();
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
    flushList();
    blocks.push(
      <p key={`p-${blocks.length}`} style={{ margin: "4px 0" }}>
        <InlineMD text={line} />
      </p>
    );
  }
  flushList();
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
