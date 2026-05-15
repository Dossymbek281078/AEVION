"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

function bearerHeader(): HeadersInit {
  if (typeof window === "undefined") return {};
  const t = localStorage.getItem("aevion_token") || sessionStorage.getItem("aevion_token") || localStorage.getItem("aevion_auth_token_v1");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

type AbTest = {
  id: string;
  name: string;
  promptA: string;
  promptB: string;
  strategy: string;
  status: string;
  runsA: number;
  runsB: number;
  avgCostA: number;
  avgCostB: number;
  createdAt: string;
};

type RunResult = { runId: string; finalContent: string; costUsd: number };
type TestResult = { testId: string; variantA: RunResult; variantB: RunResult } | null;

export default function AbTestsPage() {
  const [tests, setTests] = useState<AbTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [promptA, setPromptA] = useState("");
  const [promptB, setPromptB] = useState("");
  const [strategy, setStrategy] = useState("sequential");
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch(apiUrl("/api/qcoreai/ab-tests"), { headers: bearerHeader() })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d?.items)) setTests(d.items); })
      .catch((e) => setError(e?.message || "Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const create = async () => {
    if (!name.trim() || !promptA.trim() || !promptB.trim()) return;
    setCreating(true);
    try {
      const r = await fetch(apiUrl("/api/qcoreai/ab-tests"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify({ name, promptA, promptB, strategy }),
      });
      const d = await r.json();
      if (d.test) {
        setTests((p) => [d.test, ...p]);
        setName(""); setPromptA(""); setPromptB(""); setStrategy("sequential");
        setShowForm(false);
      } else {
        setError(d.error || "Create failed");
      }
    } catch (e: any) { setError(e?.message); }
    setCreating(false);
  };

  const runTest = async (id: string) => {
    setRunning((p) => ({ ...p, [id]: true }));
    try {
      const r = await fetch(apiUrl(`/api/qcoreai/ab-tests/${id}/run`), {
        method: "POST",
        headers: bearerHeader(),
      });
      const d = await r.json();
      if (d.testId) {
        setResults((p) => ({ ...p, [id]: d }));
        load(); // refresh counts
      } else {
        setError(d.error || "Run failed");
      }
    } catch (e: any) { setError(e?.message); }
    setRunning((p) => ({ ...p, [id]: false }));
  };

  const deleteTest = async (id: string) => {
    await fetch(apiUrl(`/api/qcoreai/ab-tests/${id}`), { method: "DELETE", headers: bearerHeader() });
    setTests((p) => p.filter((t) => t.id !== id));
    setResults((p) => { const n = { ...p }; delete n[id]; return n; });
  };

  const fmtCost = (v: number) => v > 0 ? `$${v.toFixed(4)}` : "—";

  return (
    <ProductPageShell>
      <Wave1Nav />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#1e293b", margin: 0 }}>A/B Testing</h1>
            <p style={{ color: "#64748b", margin: "4px 0 0" }}>Compare two prompts side-by-side with the same agent pipeline</p>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            style={{ background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}
          >
            {showForm ? "Cancel" : "+ New test"}
          </button>
        </div>

        <Link href="/qcoreai" style={{ fontSize: 13, color: "#6366f1", textDecoration: "none" }}>← Back to QCoreAI</Link>

        {error && (
          <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "12px 16px", color: "#dc2626", marginTop: 16, fontSize: 14 }}>
            {error} <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", marginLeft: 8, fontWeight: 700 }}>×</button>
          </div>
        )}

        {showForm && (
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 24, marginTop: 20 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>New A/B Test</h3>
            <label style={{ display: "block", marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Concise vs Detailed response"
                style={{ display: "block", width: "100%", marginTop: 6, padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }}
              />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 12 }}>
              <label>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Prompt A</span>
                <textarea
                  value={promptA}
                  onChange={(e) => setPromptA(e.target.value)}
                  rows={4}
                  placeholder="First prompt variant..."
                  style={{ display: "block", width: "100%", marginTop: 6, padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13, boxSizing: "border-box", resize: "vertical" }}
                />
              </label>
              <label>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Prompt B</span>
                <textarea
                  value={promptB}
                  onChange={(e) => setPromptB(e.target.value)}
                  rows={4}
                  placeholder="Second prompt variant..."
                  style={{ display: "block", width: "100%", marginTop: 6, padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13, boxSizing: "border-box", resize: "vertical" }}
                />
              </label>
            </div>
            <label style={{ display: "block", marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Strategy</span>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                style={{ display: "block", marginTop: 6, padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14 }}
              >
                <option value="sequential">Sequential</option>
                <option value="parallel">Parallel</option>
                <option value="debate">Debate</option>
              </select>
            </label>
            <button
              onClick={create}
              disabled={creating || !name.trim() || !promptA.trim() || !promptB.trim()}
              style={{ background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontWeight: 700, cursor: "pointer", fontSize: 14, opacity: creating ? 0.6 : 1 }}
            >
              {creating ? "Creating…" : "Create test"}
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ color: "#94a3b8", marginTop: 32, textAlign: "center" }}>Loading…</div>
        ) : tests.length === 0 ? (
          <div style={{ textAlign: "center", color: "#94a3b8", marginTop: 48, fontSize: 15 }}>
            No A/B tests yet. Create one to compare prompt variants.
          </div>
        ) : (
          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 20 }}>
            {tests.map((t) => (
              <div key={t.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>{t.name}</span>
                    <span style={{ marginLeft: 10, fontSize: 12, background: "#f1f5f9", color: "#64748b", borderRadius: 6, padding: "2px 8px" }}>{t.strategy}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => runTest(t.id)}
                      disabled={!!running[t.id]}
                      style={{ background: "#10b981", color: "#fff", border: "none", borderRadius: 8, padding: "7px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13, opacity: running[t.id] ? 0.6 : 1 }}
                    >
                      {running[t.id] ? "Running…" : "▶ Run test"}
                    </button>
                    <button
                      onClick={() => deleteTest(t.id)}
                      style={{ background: "none", border: "1px solid #fee2e2", borderRadius: 8, padding: "7px 12px", color: "#dc2626", cursor: "pointer", fontSize: 13 }}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Result bars */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                  {(["A", "B"] as const).map((v) => {
                    const runs = v === "A" ? t.runsA : t.runsB;
                    const cost = v === "A" ? t.avgCostA : t.avgCostB;
                    const color = v === "A" ? "#4f46e5" : "#0d9488";
                    const maxRuns = Math.max(t.runsA, t.runsB, 1);
                    return (
                      <div key={v} style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 14px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ fontWeight: 700, color, fontSize: 13 }}>Variant {v}</span>
                          <span style={{ fontSize: 12, color: "#64748b" }}>{runs} run{runs !== 1 ? "s" : ""} · {fmtCost(cost)}</span>
                        </div>
                        <div style={{ height: 6, background: "#e2e8f0", borderRadius: 3 }}>
                          <div style={{ height: "100%", width: `${(runs / maxRuns) * 100}%`, background: color, borderRadius: 3, transition: "width 0.3s" }} />
                        </div>
                        <p style={{ fontSize: 11, color: "#94a3b8", margin: "6px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {v === "A" ? t.promptA.slice(0, 80) : t.promptB.slice(0, 80)}{(v === "A" ? t.promptA : t.promptB).length > 80 ? "…" : ""}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Side-by-side result */}
                {results[t.id] && (
                  <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 14, marginTop: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 8 }}>LATEST RUN RESULTS</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      {(["variantA", "variantB"] as const).map((key, i) => {
                        const vr = results[t.id]![key];
                        const label = i === 0 ? "A" : "B";
                        const color = i === 0 ? "#4f46e5" : "#0d9488";
                        return (
                          <div key={key} style={{ background: `${color}08`, border: `1px solid ${color}22`, borderRadius: 8, padding: 12 }}>
                            <div style={{ fontWeight: 700, color, fontSize: 13, marginBottom: 6 }}>Variant {label} · {fmtCost(vr.costUsd)}</div>
                            <p style={{ fontSize: 12, color: "#374151", margin: 0, lineHeight: 1.5, maxHeight: 120, overflow: "hidden" }}>
                              {vr.finalContent?.slice(0, 400) || "(no output)"}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </ProductPageShell>
  );
}
