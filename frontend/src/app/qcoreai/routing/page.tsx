"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";

function bearerHeader(): HeadersInit {
  if (typeof window === "undefined") return {};
  const t = localStorage.getItem("aevion_token") || sessionStorage.getItem("aevion_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

type RoutingRule = {
  condition: "short_input" | "long_input" | "code_task" | "creative_task";
  preferProvider: string;
  preferModel: string;
};

type ConditionMeta = {
  id: RoutingRule["condition"];
  label: string;
  description: string;
  icon: string;
};

const CONDITIONS: ConditionMeta[] = [
  { id: "short_input", label: "Short Input", description: "≤500 characters — quick questions or commands", icon: "⚡" },
  { id: "long_input", label: "Long Input", description: ">500 characters — complex prompts or documents", icon: "📄" },
  { id: "code_task", label: "Code Task", description: "Prompt contains ``` code blocks", icon: "💻" },
  { id: "creative_task", label: "Creative Task", description: "Creative writing, poetry, storytelling keywords", icon: "🎨" },
];

const PROVIDERS = [
  { id: "anthropic", label: "Anthropic" },
  { id: "openai", label: "OpenAI" },
  { id: "gemini", label: "Google Gemini" },
  { id: "deepseek", label: "DeepSeek" },
  { id: "grok", label: "Grok" },
  { id: "stub", label: "Stub (no LLM)" },
];

const MODELS: Record<string, string[]> = {
  anthropic: ["claude-sonnet-4-5", "claude-opus-4-5", "claude-haiku-3-5"],
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o1", "o3-mini"],
  gemini: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  grok: ["grok-2-1212", "grok-beta"],
  stub: ["stub"],
};

function defaultRule(condition: RoutingRule["condition"]): RoutingRule {
  return { condition, preferProvider: "anthropic", preferModel: "claude-sonnet-4-5" };
}

export default function RoutingPage() {
  const [rules, setRules] = useState<Record<string, RoutingRule>>({});
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl("/api/qcoreai/me/routing-rules"), { headers: bearerHeader() })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.rules)) {
          const rulesMap: Record<string, RoutingRule> = {};
          const enabledMap: Record<string, boolean> = {};
          for (const r of d.rules as RoutingRule[]) {
            rulesMap[r.condition] = r;
            enabledMap[r.condition] = true;
          }
          setRules(rulesMap);
          setEnabled(enabledMap);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getRule = (cond: RoutingRule["condition"]): RoutingRule => {
    return rules[cond] || defaultRule(cond);
  };

  const updateRule = (cond: RoutingRule["condition"], field: "preferProvider" | "preferModel", val: string) => {
    const existing = getRule(cond);
    const updated = { ...existing, [field]: val };
    if (field === "preferProvider") {
      updated.preferModel = (MODELS[val] || [])[0] || "";
    }
    setRules((prev) => ({ ...prev, [cond]: updated }));
  };

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const activeRules = CONDITIONS
      .filter((c) => enabled[c.id])
      .map((c) => getRule(c.id));
    try {
      const res = await fetch(apiUrl("/api/qcoreai/me/routing-rules"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify({ rules: activeRules }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMsg(`Error: ${err.error || res.status}`);
      } else {
        setMsg("Routing rules saved.");
        setTimeout(() => setMsg(null), 3000);
      }
    } catch (e: any) {
      setMsg(`Error: ${e?.message || "unknown"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "40px 20px" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <Link href="/qcoreai/multi" style={{ fontSize: 13, color: "#6d28d9", textDecoration: "none" }}>
            ← Back to QCoreAI
          </Link>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", margin: "12px 0 4px" }}>
            🔀 Smart Model Routing
          </h1>
          <p style={{ fontSize: 14, color: "#64748b", margin: 0 }}>
            Automatically select the best provider and model based on what you are asking.
            Rules are applied when no explicit override is set.
          </p>
        </div>

        {loading ? (
          <p style={{ color: "#94a3b8", fontSize: 14 }}>Loading rules…</p>
        ) : (
          <>
            {CONDITIONS.map((cond) => {
              const rule = getRule(cond.id);
              const isOn = enabled[cond.id] || false;
              const providerModels = MODELS[rule.preferProvider] || [];

              return (
                <div
                  key={cond.id}
                  style={{
                    background: "#fff",
                    borderRadius: 14,
                    border: `1px solid ${isOn ? "#a78bfa" : "#e2e8f0"}`,
                    padding: "18px 20px",
                    marginBottom: 12,
                    transition: "border-color 0.15s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: isOn ? 16 : 0 }}>
                    <span style={{ fontSize: 22 }}>{cond.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>{cond.label}</div>
                      <div style={{ fontSize: 12, color: "#94a3b8" }}>{cond.description}</div>
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={isOn}
                        onChange={(e) => setEnabled((prev) => ({ ...prev, [cond.id]: e.target.checked }))}
                      />
                      <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Enable</span>
                    </label>
                  </div>

                  {isOn && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>
                          Provider
                        </label>
                        <select
                          value={rule.preferProvider}
                          onChange={(e) => updateRule(cond.id, "preferProvider", e.target.value)}
                          style={{
                            width: "100%", padding: "7px 10px", borderRadius: 8,
                            border: "1px solid #e2e8f0", fontSize: 13, color: "#0f172a",
                            background: "#f8fafc", outline: "none",
                          }}
                        >
                          {PROVIDERS.map((p) => (
                            <option key={p.id} value={p.id}>{p.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>
                          Model
                        </label>
                        <select
                          value={rule.preferModel}
                          onChange={(e) => updateRule(cond.id, "preferModel", e.target.value)}
                          style={{
                            width: "100%", padding: "7px 10px", borderRadius: 8,
                            border: "1px solid #e2e8f0", fontSize: 13, color: "#0f172a",
                            background: "#f8fafc", outline: "none",
                          }}
                        >
                          {providerModels.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                          {providerModels.length === 0 && (
                            <option value={rule.preferModel}>{rule.preferModel}</option>
                          )}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 20 }}>
              <button
                onClick={save}
                disabled={saving}
                style={{
                  padding: "10px 24px", borderRadius: 10, border: "none",
                  background: "#6d28d9", color: "#fff",
                  fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? "Saving…" : "Save rules"}
              </button>
              <Link
                href="/qcoreai/multi"
                style={{ fontSize: 13, color: "#64748b", textDecoration: "none" }}
              >
                Cancel
              </Link>
              {msg && (
                <span style={{ fontSize: 12, color: msg.startsWith("Error") ? "#dc2626" : "#065f46", fontWeight: 600 }}>
                  {msg}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
