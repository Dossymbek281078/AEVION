"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

type ProviderInfo = {
  id: string;
  name: string;
  models: string[];
  defaultModel: string;
  configured: boolean;
};

type PricingRow = {
  provider: string;
  model: string;
  inputPer1M: number;
  outputPer1M: number;
};

type HealthData = {
  ok: boolean;
  configuredProviders: string[];
  totalProviders: number;
  activeProvider: string | null;
  storage: string;
  storageError: string | null;
  webhookConfigured: boolean;
  guidanceBus: string;
  liveRuns: number;
  features: string[];
  version: string;
  at: string;
};

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "#d97706",
  openai: "#10b981",
  gemini: "#3b82f6",
  deepseek: "#8b5cf6",
  grok: "#ef4444",
};

const PROVIDER_ICONS: Record<string, string> = {
  anthropic: "◈",
  openai: "◆",
  gemini: "◇",
  deepseek: "▣",
  grok: "✦",
};

const prettyModel = (m: string) => {
  const map: Record<string, string> = {
    "claude-sonnet-4-20250514": "Claude Sonnet 4",
    "claude-haiku-4-5-20251001": "Claude Haiku 4.5",
    "claude-opus-4-7": "Claude Opus 4.7",
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

export default function ProvidersPage() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [pricing, setPricing] = useState<PricingRow[]>([]);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [pRes, prRes, hRes] = await Promise.all([
          fetch(apiUrl("/api/qcoreai/providers")),
          fetch(apiUrl("/api/qcoreai/pricing")),
          fetch(apiUrl("/api/qcoreai/health")),
        ]);
        const pData = await pRes.json().catch(() => ({}));
        const prData = await prRes.json().catch(() => ({}));
        const hData = await hRes.json().catch(() => ({}));
        if (pData?.providers) setProviders(pData.providers);
        if (Array.isArray(prData?.table)) setPricing(prData.table);
        if (hData?.ok !== undefined) setHealth(hData);
      } catch (e: any) {
        setError(e?.message || "Failed to load provider info");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const configured = providers.filter((p) => p.configured);
  const unconfigured = providers.filter((p) => !p.configured);

  return (
    <main>
      <Wave1Nav />
      <ProductPageShell>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", margin: 0 }}>◈ AI Providers</h1>
            <Link href="/qcoreai/multi" style={{ fontSize: 12, color: "#4338ca", fontWeight: 700, textDecoration: "none" }}>← Multi-agent</Link>
          </div>
          <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>
            Configured AI providers, available models, and pricing overview.
          </p>
        </div>

        {loading && <p style={{ color: "#94a3b8" }}>Loading…</p>}
        {error && <p style={{ color: "#dc2626" }}>{error}</p>}

        {/* Health strip */}
        {health && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
            {[
              { label: "Storage", value: health.storage, color: health.storageError ? "#dc2626" : "#065f46" },
              { label: "Bus", value: health.guidanceBus, color: "#0f172a" },
              { label: "Live runs", value: String(health.liveRuns), color: "#0f172a" },
              { label: "Version", value: health.version || "—", color: "#0f172a" },
              { label: "Providers", value: `${configured.length}/${providers.length} active`, color: configured.length > 0 ? "#065f46" : "#dc2626" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ padding: "6px 14px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: 12 }}>
                <span style={{ color: "#94a3b8" }}>{label}: </span>
                <span style={{ fontWeight: 700, color }}>{value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Configured providers */}
        {!loading && (
          <>
            <h2 style={{ fontSize: 15, fontWeight: 800, marginBottom: 12, color: "#0f172a" }}>
              ✓ Configured ({configured.length})
            </h2>
            {configured.length === 0 ? (
              <div style={{ padding: 24, borderRadius: 12, border: "1px dashed #cbd5e1", textAlign: "center", color: "#94a3b8", fontSize: 13, marginBottom: 20 }}>
                No providers configured. Set API keys via environment variables on the backend.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginBottom: 24 }}>
                {configured.map((p) => {
                  const color = PROVIDER_COLORS[p.id] || "#475569";
                  const icon = PROVIDER_ICONS[p.id] || "◉";
                  const provPricing = pricing.filter((r) => r.provider === p.id);
                  const isActive = health?.activeProvider === p.id;
                  return (
                    <div
                      key={p.id}
                      style={{
                        padding: 16, borderRadius: 14,
                        border: `2px solid ${isActive ? color : color + "33"}`,
                        background: isActive ? `${color}08` : "#fff",
                        position: "relative",
                      }}
                    >
                      {isActive && (
                        <span style={{ position: "absolute", top: 10, right: 10, fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 999, background: `${color}22`, color }}>
                          DEFAULT
                        </span>
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                        <span style={{ fontSize: 22, color }}>{icon}</span>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a" }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: "#64748b" }}>{p.models.length} model{p.models.length !== 1 ? "s" : ""}</div>
                        </div>
                      </div>

                      {/* Default model chip */}
                      <div style={{ marginBottom: 10 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#64748b" }}>Default: </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#0f172a" }}>{prettyModel(p.defaultModel)}</span>
                      </div>

                      {/* Model + pricing list */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {p.models.slice(0, 6).map((m) => {
                          const pr = provPricing.find((r) => r.model === m);
                          return (
                            <div key={m} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                              <span style={{ flex: 1, color: "#334155" }}>{prettyModel(m)}</span>
                              {pr && (
                                <span style={{ color: "#94a3b8", fontFamily: "monospace" }}>
                                  ${pr.inputPer1M.toFixed(2)} / ${pr.outputPer1M.toFixed(2)}
                                </span>
                              )}
                            </div>
                          );
                        })}
                        {p.models.length > 6 && (
                          <span style={{ fontSize: 10, color: "#94a3b8" }}>+{p.models.length - 6} more</span>
                        )}
                      </div>

                      {/* Pricing note */}
                      {provPricing.length > 0 && (
                        <div style={{ marginTop: 8, fontSize: 9, color: "#cbd5e1" }}>
                          Input / Output per 1M tokens
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Unconfigured */}
            {unconfigured.length > 0 && (
              <>
                <h2 style={{ fontSize: 15, fontWeight: 800, marginBottom: 10, color: "#94a3b8" }}>
                  ○ Not configured ({unconfigured.length})
                </h2>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                  {unconfigured.map((p) => {
                    const color = PROVIDER_COLORS[p.id] || "#94a3b8";
                    const icon = PROVIDER_ICONS[p.id] || "◉";
                    return (
                      <div key={p.id} style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fafafa", display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ color, opacity: 0.4 }}>{icon}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>{p.name}</span>
                        <span style={{ fontSize: 10, color: "#cbd5e1" }}>{p.models.length} models</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Features list from health */}
            {health?.features && health.features.length > 0 && (
              <div style={{ padding: 16, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
                  Active Features
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {health.features.map((f) => (
                    <span key={f} style={{ padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700, background: "rgba(124,58,237,0.08)", color: "#6d28d9", border: "1px solid rgba(124,58,237,0.15)" }}>
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </ProductPageShell>
    </main>
  );
}
