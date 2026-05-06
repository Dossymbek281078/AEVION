"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

function bearerHeader(): HeadersInit {
  if (typeof window === "undefined") return {};
  const t = localStorage.getItem("aevion_token") || sessionStorage.getItem("aevion_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

type ProviderInfo = { id: string; name: string; models: string[]; defaultModel: string; configured: boolean };

type PlayResult = {
  provider: string;
  model: string;
  reply: string | null;
  error: string | null;
  durationMs: number;
  tokensIn?: number;
  tokensOut?: number;
};

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "#d97706", openai: "#10b981", gemini: "#3b82f6",
  deepseek: "#8b5cf6", grok: "#ef4444",
};

export default function PlaygroundPage() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [selected, setSelected] = useState<Record<string, string>>({}); // provider → model
  const [results, setResults] = useState<PlayResult[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadProviders = useCallback(async () => {
    if (loaded) return;
    try {
      const res = await fetch(apiUrl("/api/qcoreai/providers"));
      const data = await res.json().catch(() => ({}));
      if (data?.providers) {
        setProviders(data.providers);
        // Pre-select configured providers with their default model
        const sel: Record<string, string> = {};
        for (const p of data.providers) {
          if (p.configured) sel[p.id] = p.defaultModel;
        }
        setSelected(sel);
      }
    } catch { /* noop */ }
    setLoaded(true);
  }, [loaded]);

  // Lazy load providers on first render
  if (!loaded) { loadProviders(); }

  const configured = providers.filter((p) => p.configured);

  const run = async () => {
    if (!prompt.trim() || running) return;
    setResults([]);
    setError(null);
    setRunning(true);
    abortRef.current = new AbortController();

    const targets = Object.entries(selected).filter(([pid]) =>
      providers.find((p) => p.id === pid)?.configured
    );

    if (targets.length === 0) {
      setError("Select at least one provider.");
      setRunning(false);
      return;
    }

    const messages = [
      ...(systemPrompt.trim() ? [{ role: "system", content: systemPrompt.trim() }] : []),
      { role: "user", content: prompt.trim() },
    ];

    const placeholders: PlayResult[] = targets.map(([provider, model]) => ({
      provider, model, reply: null, error: null, durationMs: 0,
    }));
    setResults(placeholders);

    await Promise.all(targets.map(async ([provider, model]) => {
      const t0 = Date.now();
      try {
        const res = await fetch(apiUrl("/api/qcoreai/chat"), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...bearerHeader() },
          body: JSON.stringify({ messages, provider, model }),
          signal: abortRef.current?.signal,
        });
        const data = await res.json().catch(() => ({}));
        const durationMs = Date.now() - t0;
        setResults((prev) => prev.map((r) =>
          r.provider === provider && r.model === model
            ? { ...r, reply: res.ok ? (data.reply || JSON.stringify(data)) : null, error: res.ok ? null : (data.error || `HTTP ${res.status}`), durationMs }
            : r
        ));
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setResults((prev) => prev.map((r) =>
          r.provider === provider && r.model === model
            ? { ...r, error: e?.message || "request failed", durationMs: Date.now() - t0 }
            : r
        ));
      }
    }));

    setRunning(false);
  };

  const stop = () => {
    abortRef.current?.abort();
    setRunning(false);
  };

  return (
    <main>
      <Wave1Nav />
      <ProductPageShell>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", margin: 0 }}>🎮 Prompt Playground</h1>
            <Link href="/qcoreai/multi" style={{ fontSize: 12, color: "#4338ca", fontWeight: 700, textDecoration: "none" }}>← Multi-agent</Link>
          </div>
          <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>
            Test a prompt against multiple AI providers simultaneously — compare outputs side-by-side.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          {/* System prompt */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>System prompt (optional)</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are a helpful assistant…"
              rows={3}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, resize: "vertical", fontFamily: "inherit", outline: "none", boxSizing: "border-box", background: "#f8fafc" }}
            />
          </div>

          {/* Provider selector */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>Providers to compare</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 120, overflowY: "auto" }}>
              {configured.length === 0 && <p style={{ fontSize: 12, color: "#94a3b8" }}>No providers configured.</p>}
              {configured.map((p) => {
                const isOn = !!selected[p.id];
                const color = PROVIDER_COLORS[p.id] || "#475569";
                return (
                  <div key={p.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                      onClick={() => setSelected((prev) => {
                        const next = { ...prev };
                        if (isOn) delete next[p.id]; else next[p.id] = p.defaultModel;
                        return next;
                      })}
                      style={{
                        padding: "3px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer",
                        border: `1px solid ${isOn ? color : "#cbd5e1"}`,
                        background: isOn ? `${color}15` : "#fff",
                        color: isOn ? color : "#94a3b8",
                        minWidth: 90,
                      }}
                    >
                      {isOn ? "✓" : "○"} {p.name}
                    </button>
                    {isOn && (
                      <select
                        value={selected[p.id] || p.defaultModel}
                        onChange={(e) => setSelected((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        style={{ flex: 1, padding: "3px 6px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 11, fontFamily: "inherit" }}
                      >
                        {p.models.map((m) => <option key={m} value={m}>{m.split("-").slice(0, 3).join("-")}</option>)}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Prompt + Run */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); run(); } }}
            placeholder="Enter your prompt here… (Enter to run)"
            rows={3}
            style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.15)", fontSize: 14, resize: "vertical", fontFamily: "inherit", outline: "none" }}
          />
          {running ? (
            <button onClick={stop} style={{ padding: "12px 20px", borderRadius: 10, border: "none", background: "#dc2626", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", alignSelf: "stretch" }}>
              Stop
            </button>
          ) : (
            <button
              onClick={run}
              disabled={!prompt.trim() || Object.keys(selected).length === 0}
              style={{
                padding: "12px 24px", borderRadius: 10, border: "none",
                background: !prompt.trim() || Object.keys(selected).length === 0 ? "#94a3b8" : "linear-gradient(135deg, #0d9488, #06b6d4)",
                color: "#fff", fontWeight: 800, fontSize: 14,
                cursor: !prompt.trim() || Object.keys(selected).length === 0 ? "default" : "pointer",
                alignSelf: "stretch", whiteSpace: "nowrap",
              }}
            >
              Run {Object.keys(selected).filter((pid) => providers.find((p) => p.id === pid)?.configured).length > 1
                ? `× ${Object.keys(selected).filter((pid) => providers.find((p) => p.id === pid)?.configured).length}`
                : ""}
            </button>
          )}
        </div>

        {error && (
          <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.08)", color: "#991b1b", fontSize: 12 }}>
            {error}
          </div>
        )}

        {/* Results grid */}
        {results.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(results.length, 3)}, 1fr)`, gap: 14 }}>
            {results.map((r) => {
              const color = PROVIDER_COLORS[r.provider] || "#475569";
              const isLoading = r.reply === null && r.error === null;
              return (
                <div key={`${r.provider}-${r.model}`} style={{ borderRadius: 12, border: `1px solid ${color}33`, background: "#fff", overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(15,23,42,0.06)", background: `${color}08`, display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontWeight: 800, fontSize: 12, color }}>{r.provider}</span>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>{r.model.split("-").slice(0, 3).join("-")}</span>
                    {!isLoading && r.durationMs > 0 && (
                      <span style={{ marginLeft: "auto", fontSize: 10, color: "#94a3b8" }}>{(r.durationMs / 1000).toFixed(1)}s</span>
                    )}
                  </div>
                  <div style={{ padding: "12px 14px", minHeight: 100 }}>
                    {isLoading && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#94a3b8", fontSize: 12 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, animation: "qc-live-pulse 1.2s infinite" }} />
                        Running…
                      </div>
                    )}
                    {r.error && <div style={{ color: "#dc2626", fontSize: 12 }}>{r.error}</div>}
                    {r.reply && (
                      <div style={{ fontSize: 13, lineHeight: 1.6, color: "#1e293b", whiteSpace: "pre-wrap" }}>
                        {r.reply}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ProductPageShell>
      <style jsx global>{`
        @keyframes qc-live-pulse { 0%,100%{opacity:.4}50%{opacity:1} }
      `}</style>
    </main>
  );
}
