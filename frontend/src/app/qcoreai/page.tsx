"use client";

import { useCallback, useRef, useEffect, useState } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { PitchValueCallout } from "@/components/PitchValueCallout";
import { apiUrl } from "@/lib/apiBase";

type Msg = { role: "user" | "assistant" | "system"; content: string };

type ProviderInfo = {
  id: string;
  name: string;
  models: string[];
  defaultModel: string;
  configured: boolean;
};

const SUGGESTIONS = [
  "What is AEVION?",
  "How does QRight protect my IP?",
  "Explain Trust Graph",
  "How do automatic royalties work?",
  "What makes AEVION worth $1B?",
];

const PROVIDER_ICONS: Record<string, string> = {
  anthropic: "◈",
  openai: "◆",
  gemini: "◇",
  deepseek: "▣",
  grok: "✦",
};

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "#d97706",
  openai: "#10b981",
  gemini: "#3b82f6",
  deepseek: "#8b5cf6",
  grok: "#ef4444",
};

/* ── Pretty model name ── */
const prettyModel = (m: string) => {
  const map: Record<string, string> = {
    "claude-sonnet-4-20250514": "Claude Sonnet 4",
    "claude-haiku-4-5-20251001": "Claude Haiku 4.5",
    "gpt-4o": "GPT-4o",
    "gpt-4o-mini": "GPT-4o Mini",
    "gpt-4-turbo": "GPT-4 Turbo",
    "gemini-2.5-flash": "Gemini 2.5 Flash",
    "gemini-2.0-flash-001": "Gemini 2.0 Flash",
    "gemini-2.0-flash": "Gemini 2.0 Flash",
    "gemini-1.5-pro": "Gemini 1.5 Pro",
    "deepseek-chat": "DeepSeek Chat",
    "deepseek-reasoner": "DeepSeek Reasoner",
    "grok-3": "Grok 3",
    "grok-3-mini": "Grok 3 Mini",
  };
  return map[m] || m;
};

export default function QCoreAIPage() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "system",
      content:
        "You are QCoreAI, the AI assistant for the AEVION ecosystem. Answer concisely and helpfully. You know about all 29 AEVION modules: QRight (IP registry), QSign (cryptographic signatures), IP Bureau (patent bureau), Planet (compliance and certification), AEVION Bank (digital wallet and royalties), CyberChess (chess platform), Awards (music and film), Auth (identity), and more. You respond in the same language the user writes in.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  /* ── Provider state ── */
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [providerDropdownOpen, setProviderDropdownOpen] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [activeProviderName, setActiveProviderName] = useState<string>("");
  const [activeModel, setActiveModel] = useState<string>("");
  const providerRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);

  /* ── Load providers on mount ── */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/qcoreai/providers"));
        const data = await res.json();
        if (data?.providers) {
          setProviders(data.providers);
          const firstConfigured = data.providers.find((p: ProviderInfo) => p.configured);
          if (firstConfigured) {
            setSelectedProvider(firstConfigured.id);
            setSelectedModel(firstConfigured.defaultModel);
          }
        }
      } catch {
        /* silent — will use backend auto-select */
      }
    })();
  }, []);

  /* ── Close dropdowns on outside click ── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (providerRef.current && !providerRef.current.contains(e.target as Node)) {
        setProviderDropdownOpen(false);
      }
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  /* ── Current provider/model helpers ── */
  const currentProvider = providers.find((p) => p.id === selectedProvider);
  const availableModels = currentProvider?.models || [];

  const selectProvider = (id: string) => {
    setSelectedProvider(id);
    const p = providers.find((pr) => pr.id === id);
    if (p) setSelectedModel(p.defaultModel);
    setProviderDropdownOpen(false);
    setModelDropdownOpen(false);
  };

  const selectModel = (model: string) => {
    setSelectedModel(model);
    setModelDropdownOpen(false);
  };

  /* ── Send message ── */
  const send = useCallback(
    async (text?: string) => {
      const msg = (text || input).trim();
      if (!msg || busy) return;
      const nextMsgs: Msg[] = [...messages, { role: "user", content: msg }];
      setMessages(nextMsgs);
      setInput("");
      setErr(null);
      setBusy(true);

      try {
        const headers: HeadersInit = { "Content-Type": "application/json" };
        try {
          const t = localStorage.getItem("aevion_auth_token_v1");
          if (t) headers.Authorization = `Bearer ${t}`;
        } catch {}

        const body: Record<string, unknown> = { messages: nextMsgs };
        if (selectedProvider) body.provider = selectedProvider;
        if (selectedModel) body.model = selectedModel;

        const res = await fetch(apiUrl("/api/qcoreai/chat"), {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

        const reply = typeof data?.reply === "string" ? data.reply : JSON.stringify(data, null, 2);

        if (data?.provider) setActiveProviderName(data.provider);
        if (data?.model) setActiveModel(data.model);

        setMessages((m) => [...m, { role: "assistant", content: reply }]);
      } catch {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content:
              "I am currently offline. The AI engine needs an API key configured on the backend. Try again later or explore the platform modules directly.",
          },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [busy, input, messages, selectedProvider, selectedModel]
  );

  const visible = messages.filter((m) => m.role !== "system");
  const configuredProviders = providers.filter((p) => p.configured);
  const unconfiguredProviders = providers.filter((p) => !p.configured);

  return (
    <main>
      <ProductPageShell maxWidth={840}>
        <Wave1Nav />

        {/* ── Header ── */}
        <div style={{ borderRadius: 20, overflow: "hidden", marginBottom: 20 }}>
          <div
            style={{
              background: "linear-gradient(135deg, #0f172a, #1e1b4b, #312e81)",
              padding: "24px 24px 20px",
              color: "#fff",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "linear-gradient(135deg, #0d9488, #06b6d4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  fontWeight: 900,
                }}
              >
                AI
              </div>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, letterSpacing: "-0.02em" }}>QCoreAI</h1>
                <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>Multi-model AI assistant for the AEVION ecosystem</p>
              </div>
            </div>

            {/* ── Provider + Model selectors ── */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {/* Provider selector */}
              <div ref={providerRef} style={{ position: "relative" }}>
                <button
                  onClick={() => {
                    setProviderDropdownOpen(!providerDropdownOpen);
                    setModelDropdownOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 14px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.2)",
                    background: "rgba(255,255,255,0.1)",
                    backdropFilter: "blur(8px)",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    minWidth: 160,
                    justifyContent: "space-between",
                    transition: "all 0.2s",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {selectedProvider && (
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: PROVIDER_COLORS[selectedProvider] || "#06b6d4",
                          display: "inline-block",
                        }}
                      />
                    )}
                    {currentProvider?.name || "Select Provider"}
                  </span>
                  <span style={{ fontSize: 10, opacity: 0.7 }}>▼</span>
                </button>

                {providerDropdownOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 4px)",
                      left: 0,
                      minWidth: 220,
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.15)",
                      background: "rgba(15,23,42,0.95)",
                      backdropFilter: "blur(16px)",
                      boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                      zIndex: 100,
                      overflow: "hidden",
                    }}
                  >
                    {configuredProviders.length > 0 && (
                      <div style={{ padding: "8px 12px 4px", fontSize: 10, fontWeight: 700, color: "#22d3ee", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
                        Available
                      </div>
                    )}
                    {configuredProviders.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => selectProvider(p.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          width: "100%",
                          padding: "10px 14px",
                          border: "none",
                          background: selectedProvider === p.id ? "rgba(6,182,212,0.15)" : "transparent",
                          color: "#fff",
                          fontSize: 13,
                          fontWeight: selectedProvider === p.id ? 700 : 500,
                          cursor: "pointer",
                          textAlign: "left" as const,
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = selectedProvider === p.id ? "rgba(6,182,212,0.2)" : "rgba(255,255,255,0.06)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = selectedProvider === p.id ? "rgba(6,182,212,0.15)" : "transparent")}
                      >
                        <span style={{ fontSize: 16, color: PROVIDER_COLORS[p.id] || "#06b6d4" }}>{PROVIDER_ICONS[p.id] || "●"}</span>
                        <span>{p.name}</span>
                        {selectedProvider === p.id && <span style={{ marginLeft: "auto", fontSize: 11, color: "#22d3ee" }}>✓</span>}
                      </button>
                    ))}

                    {unconfiguredProviders.length > 0 && (
                      <>
                        <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "4px 0" }} />
                        <div style={{ padding: "8px 12px 4px", fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
                          Not configured
                        </div>
                        {unconfiguredProviders.map((p) => (
                          <div
                            key={p.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              padding: "10px 14px",
                              color: "#475569",
                              fontSize: 13,
                              fontWeight: 500,
                            }}
                          >
                            <span style={{ fontSize: 16, opacity: 0.4 }}>{PROVIDER_ICONS[p.id] || "●"}</span>
                            <span>{p.name}</span>
                            <span style={{ marginLeft: "auto", fontSize: 10, background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: 4, color: "#64748b" }}>
                              Add API key
                            </span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Model selector */}
              {availableModels.length > 0 && (
                <div ref={modelRef} style={{ position: "relative" }}>
                  <button
                    onClick={() => {
                      setModelDropdownOpen(!modelDropdownOpen);
                      setProviderDropdownOpen(false);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 14px",
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.15)",
                      background: "rgba(255,255,255,0.06)",
                      color: "rgba(255,255,255,0.9)",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      minWidth: 140,
                      justifyContent: "space-between",
                      transition: "all 0.2s",
                    }}
                  >
                    <span>{prettyModel(selectedModel)}</span>
                    <span style={{ fontSize: 10, opacity: 0.7 }}>▼</span>
                  </button>

                  {modelDropdownOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 4px)",
                        left: 0,
                        minWidth: 200,
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.15)",
                        background: "rgba(15,23,42,0.95)",
                        backdropFilter: "blur(16px)",
                        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                        zIndex: 100,
                        overflow: "hidden",
                        padding: "4px 0",
                      }}
                    >
                      {availableModels.map((m) => (
                        <button
                          key={m}
                          onClick={() => selectModel(m)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            width: "100%",
                            padding: "10px 14px",
                            border: "none",
                            background: selectedModel === m ? "rgba(6,182,212,0.15)" : "transparent",
                            color: "#fff",
                            fontSize: 13,
                            fontWeight: selectedModel === m ? 700 : 500,
                            cursor: "pointer",
                            textAlign: "left" as const,
                            transition: "background 0.15s",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = selectedModel === m ? "rgba(6,182,212,0.2)" : "rgba(255,255,255,0.06)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = selectedModel === m ? "rgba(6,182,212,0.15)" : "transparent")}
                        >
                          <span>{prettyModel(m)}</span>
                          {selectedModel === m && <span style={{ marginLeft: "auto", fontSize: 11, color: "#22d3ee" }}>✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <PitchValueCallout moduleId="qcoreai" variant="dark" />

        {/* ── Active model indicator ── */}
        {activeProviderName && activeModel && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 10,
              padding: "6px 12px",
              borderRadius: 8,
              background: "rgba(6,182,212,0.06)",
              border: "1px solid rgba(6,182,212,0.12)",
              fontSize: 11,
              color: "#64748b",
              fontWeight: 600,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22d3ee" }} />
            Last response: {activeProviderName} · {prettyModel(activeModel)}
          </div>
        )}

        {/* ── Chat area ── */}
        <div
          ref={chatRef}
          style={{
            border: "1px solid rgba(15,23,42,0.1)",
            borderRadius: 16,
            padding: 16,
            minHeight: 320,
            maxHeight: 480,
            overflowY: "auto",
            background: "#f8fafc",
            marginBottom: 12,
          }}
        >
          {visible.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🤖</div>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a", marginBottom: 6 }}>Welcome to QCoreAI</div>
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
                Ask me anything about AEVION — IP protection, signatures, royalties, or how to get started.
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "1px solid rgba(15,23,42,0.12)",
                      background: "#fff",
                      fontSize: 12,
                      color: "#475569",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            visible.map((m, i) => (
              <div key={i} style={{ marginBottom: 14, display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                {m.role === "assistant" ? (
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: "linear-gradient(135deg, #0d9488, #06b6d4)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 900,
                      color: "#fff",
                      flexShrink: 0,
                      marginRight: 8,
                      marginTop: 2,
                    }}
                  >
                    AI
                  </div>
                ) : null}
                <div
                  style={{
                    maxWidth: "80%",
                    padding: "10px 14px",
                    borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                    background: m.role === "user" ? "#0f172a" : "#fff",
                    color: m.role === "user" ? "#fff" : "#0f172a",
                    border: m.role === "user" ? "none" : "1px solid rgba(15,23,42,0.08)",
                    fontSize: 14,
                    lineHeight: 1.55,
                    whiteSpace: "pre-wrap" as const,
                    boxShadow: m.role === "assistant" ? "0 1px 4px rgba(15,23,42,0.06)" : "none",
                  }}
                >
                  {m.content}
                </div>
              </div>
            ))
          )}
          {busy ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: "linear-gradient(135deg, #0d9488, #06b6d4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 900,
                  color: "#fff",
                }}
              >
                AI
              </div>
              <div
                style={{
                  padding: "8px 14px",
                  borderRadius: 14,
                  background: "#fff",
                  border: "1px solid rgba(15,23,42,0.08)",
                  fontSize: 13,
                  color: "#94a3b8",
                }}
              >
                Thinking...
              </div>
            </div>
          ) : null}
        </div>

        {err ? (
          <div
            style={{
              color: "#dc2626",
              marginBottom: 8,
              fontSize: 12,
              padding: "6px 10px",
              borderRadius: 8,
              background: "rgba(220,38,38,0.06)",
            }}
          >
            {err}
          </div>
        ) : null}

        {/* ── Input ── */}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
            placeholder="Ask QCoreAI anything..."
            disabled={busy}
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid rgba(15,23,42,0.15)",
              fontSize: 14,
              outline: "none",
            }}
          />
          <button
            type="button"
            onClick={() => send()}
            disabled={busy || !input.trim()}
            style={{
              padding: "12px 20px",
              borderRadius: 12,
              border: "none",
              background: busy ? "#94a3b8" : "linear-gradient(135deg, #0d9488, #06b6d4)",
              color: "#fff",
              fontWeight: 800,
              fontSize: 14,
              cursor: busy ? "default" : "pointer",
            }}
          >
            {busy ? "..." : "Send"}
          </button>
        </div>

        {/* ── Capabilities ── */}
        <div
          style={{
            marginTop: 20,
            marginBottom: 40,
            padding: "14px 16px",
            borderRadius: 14,
            border: "1px solid rgba(15,23,42,0.08)",
            background: "rgba(15,23,42,0.02)",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>QCoreAI capabilities</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
            {[
              { icon: "🧠", t: "Multi-model", d: "Claude, GPT-4, Gemini, DeepSeek, Grok" },
              { icon: "🔐", t: "Context-aware", d: "Knows your QRight records, Trust Score, history" },
              { icon: "⚡", t: "Real-time", d: "Instant responses from 5 AI providers" },
              { icon: "🌍", t: "Multilingual", d: "English, Russian, and 50+ languages" },
            ].map((f) => (
              <div key={f.t} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ fontSize: 16 }}>{f.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 12, color: "#0f172a" }}>{f.t}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{f.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* V7 feature grid */}
        <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
          {[
            { href: "/qcoreai/multi",      icon: "🤖", t: "Multi-agent pipeline",   d: "Analyst → Writer → Critic with 3 strategies" },
            { href: "/qcoreai/eval",       icon: "🧪", t: "Eval harness",            d: "Regression testing with 6+ judge types" },
            { href: "/qcoreai/prompts",    icon: "📝", t: "Prompts library",         d: "Versioned system prompts, fork & share" },
            { href: "/qcoreai/analytics",  icon: "📊", t: "Analytics",               d: "Cost tracking, token usage, trends" },
            { href: "/qcoreai/budget",     icon: "💰", t: "Budget & Limits",         d: "Set monthly spend cap, alert threshold" },
            { href: "/qcoreai/batch",      icon: "⚡", t: "Batch runs",              d: "20 prompts in parallel, one call" },
            { href: "/qcoreai/schedule",   icon: "🕐", t: "Scheduled batches",       d: "Hourly, daily, weekly automation" },
            { href: "/qcoreai/workspaces", icon: "🗂️", t: "Workspaces",              d: "Share session collections with your team" },
            { href: "/qcoreai/compare",   icon: "⚖️", t: "Run compare",              d: "Side-by-side cost + output diff for any two runs" },
            { href: "/qcoreai/notebook",  icon: "📓", t: "Notebook",                  d: "Annotated snippets from run outputs" },
            { href: "/qcoreai/providers", icon: "◈",  t: "AI Providers",              d: "Configured models, pricing, and health" },
            { href: "/qcoreai/docs",      icon: "📖", t: "API Reference",              d: "Full endpoint documentation with request/response" },
          ].map(({ href, icon, t, d }) => (
            <a
              key={href}
              href={href}
              style={{
                display: "block", padding: "12px 14px", borderRadius: 12,
                border: "1px solid rgba(15,23,42,0.1)", background: "#fff",
                textDecoration: "none", color: "inherit",
                transition: "box-shadow 0.15s",
              }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 20 }}>{icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{t}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{d}</div>
                </div>
              </div>
            </a>
          ))}
        </div>
      </ProductPageShell>
    </main>
  );
}