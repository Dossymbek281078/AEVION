"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

function bearerHeader(): HeadersInit {
  if (typeof window === "undefined") return {};
  const t = localStorage.getItem("aevion_token") || sessionStorage.getItem("aevion_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

type ChainStep = {
  inputTemplate: string;
  strategy?: string;
  useOutputOf?: number;
};

type PromptChain = {
  id: string;
  name: string;
  description: string | null;
  steps: ChainStep[];
  isPublic: boolean;
  runCount: number;
  createdAt: string;
  updatedAt: string;
};

type RunResult = {
  stepIndex: number;
  runId: string;
  sessionId: string;
  finalContent: string;
};

const STRATEGIES = ["sequential", "parallel", "debate"];

export default function PromptChainsPage() {
  const [chains, setChains] = useState<PromptChain[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newSteps, setNewSteps] = useState<ChainStep[]>([{ inputTemplate: "", strategy: "sequential" }]);
  const [creating, setCreating] = useState(false);

  // Run state
  const [runningChain, setRunningChain] = useState<string | null>(null);
  const [runResults, setRunResults] = useState<Record<string, RunResult[]>>({});
  const [expandedChain, setExpandedChain] = useState<string | null>(null);

  const loadChains = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(apiUrl("/api/qcoreai/prompt-chains"), { headers: bearerHeader() });
      const d = await r.json();
      if (Array.isArray(d?.items)) setChains(d.items);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadChains(); }, [loadChains]);

  async function createChain() {
    if (!newName.trim() || newSteps.length === 0) return;
    setCreating(true);
    try {
      const r = await fetch(apiUrl("/api/qcoreai/prompt-chains"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || null, steps: newSteps }),
      });
      const d = await r.json();
      if (d?.chain) {
        setChains((p) => [d.chain, ...p]);
        setShowCreate(false);
        setNewName("");
        setNewDesc("");
        setNewSteps([{ inputTemplate: "", strategy: "sequential" }]);
      }
    } catch { /* ignore */ }
    setCreating(false);
  }

  async function runChain(chain: PromptChain) {
    setRunningChain(chain.id);
    try {
      const r = await fetch(apiUrl(`/api/qcoreai/prompt-chains/${chain.id}/run`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
      });
      const d = await r.json();
      if (Array.isArray(d?.results)) {
        setRunResults((p) => ({ ...p, [chain.id]: d.results }));
        setExpandedChain(chain.id);
        setChains((prev) => prev.map((c) => c.id === chain.id ? { ...c, runCount: c.runCount + 1 } : c));
      }
    } catch { /* ignore */ }
    setRunningChain(null);
  }

  async function deleteChain(id: string) {
    if (!confirm("Delete this chain?")) return;
    await fetch(apiUrl(`/api/qcoreai/prompt-chains/${id}`), { method: "DELETE", headers: bearerHeader() });
    setChains((p) => p.filter((c) => c.id !== id));
    setRunResults((p) => { const n = { ...p }; delete n[id]; return n; });
  }

  function addStep() {
    setNewSteps((p) => [...p, { inputTemplate: "", strategy: "sequential" }]);
  }

  function removeStep(idx: number) {
    setNewSteps((p) => p.filter((_, i) => i !== idx));
  }

  function updateStep(idx: number, patch: Partial<ChainStep>) {
    setNewSteps((p) => p.map((s, i) => i === idx ? { ...s, ...patch } : s));
  }

  return (
    <ProductPageShell>
      <Wave1Nav />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <Link href="/qcoreai/multi" style={{ color: "#64748b", fontSize: 13, textDecoration: "none" }}>
                QCoreAI
              </Link>
              <span style={{ color: "#cbd5e1" }}>›</span>
              <span style={{ fontSize: 13, color: "#0f172a", fontWeight: 700 }}>Prompt Chains</span>
            </div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#0f172a" }}>
              🔗 Prompt Chains
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>
              Multi-step prompt sequences — each step uses the previous output as context.
            </p>
          </div>
          <button
            onClick={() => setShowCreate((v) => !v)}
            style={{
              padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer",
              border: "none", background: showCreate ? "#e2e8f0" : "#0f172a", color: showCreate ? "#64748b" : "#fff",
            }}
          >
            {showCreate ? "Cancel" : "+ New Chain"}
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, marginBottom: 24 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a", marginBottom: 12 }}>New Prompt Chain</div>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Chain name…"
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, outline: "none", marginBottom: 10, boxSizing: "border-box" }}
            />
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Description (optional)…"
              rows={2}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, outline: "none", resize: "vertical", marginBottom: 16, boxSizing: "border-box" }}
            />

            <div style={{ fontWeight: 700, fontSize: 12, color: "#475569", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Steps</div>
            {newSteps.map((step, idx) => (
              <div key={idx} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#0f172a", color: "#fff", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {idx + 1}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Step {idx + 1}</span>
                  <select
                    value={step.strategy || "sequential"}
                    onChange={(e) => updateStep(idx, { strategy: e.target.value })}
                    style={{ marginLeft: "auto", padding: "3px 8px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 11, outline: "none" }}
                  >
                    {STRATEGIES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  {newSteps.length > 1 && (
                    <button
                      onClick={() => removeStep(idx)}
                      style={{ padding: "2px 8px", borderRadius: 6, border: "1px solid #fca5a5", background: "transparent", color: "#ef4444", fontSize: 11, cursor: "pointer" }}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <textarea
                  value={step.inputTemplate}
                  onChange={(e) => updateStep(idx, { inputTemplate: e.target.value })}
                  placeholder={idx === 0 ? "Enter your prompt…" : "Enter prompt… Use {prev_output} for the previous step's output."}
                  rows={3}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, outline: "none", resize: "vertical", boxSizing: "border-box" }}
                />
              </div>
            ))}
            <button
              onClick={addStep}
              style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px dashed #cbd5e1", background: "#fff", color: "#64748b", marginBottom: 14 }}
            >
              + Add step
            </button>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={createChain}
                disabled={creating || !newName.trim()}
                style={{
                  padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: creating ? "default" : "pointer",
                  border: "none", background: creating ? "#94a3b8" : "#0f172a", color: "#fff",
                }}
              >
                {creating ? "Creating…" : "Create Chain"}
              </button>
            </div>
          </div>
        )}

        {/* Chain list */}
        {loading ? (
          <div style={{ textAlign: "center", color: "#94a3b8", padding: 40 }}>Loading chains…</div>
        ) : chains.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 20px", color: "#94a3b8" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔗</div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>No chains yet</div>
            <div style={{ fontSize: 13 }}>Create a prompt chain to run multi-step AI pipelines.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {chains.map((chain) => (
              <div key={chain.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a", marginBottom: 2 }}>{chain.name}</div>
                    {chain.description && (
                      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>{chain.description}</div>
                    )}
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 11, background: "#f1f5f9", borderRadius: 6, padding: "2px 8px", color: "#475569", fontWeight: 600 }}>
                        {chain.steps.length} step{chain.steps.length !== 1 ? "s" : ""}
                      </span>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>{chain.runCount} run{chain.runCount !== 1 ? "s" : ""}</span>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>{new Date(chain.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setExpandedChain(expandedChain === chain.id ? null : chain.id)}
                    style={{ padding: "5px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer", border: "1px solid #e2e8f0", background: "#f8fafc", color: "#475569" }}
                  >
                    {expandedChain === chain.id ? "Collapse" : "Details"}
                  </button>
                  <button
                    onClick={() => runChain(chain)}
                    disabled={runningChain === chain.id}
                    style={{
                      padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: runningChain === chain.id ? "default" : "pointer",
                      border: "none", background: runningChain === chain.id ? "#94a3b8" : "#4f46e5", color: "#fff",
                    }}
                  >
                    {runningChain === chain.id ? "Running…" : "▶ Run"}
                  </button>
                  <button
                    onClick={() => deleteChain(chain.id)}
                    style={{ padding: "6px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid #fca5a5", background: "transparent", color: "#ef4444" }}
                  >
                    Delete
                  </button>
                </div>

                {/* Expanded: steps + results */}
                {expandedChain === chain.id && (
                  <div style={{ borderTop: "1px solid #f1f5f9", padding: "14px 16px", background: "#f8fafc" }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: "#475569", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Steps</div>
                    {chain.steps.map((step, idx) => (
                      <div key={idx} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
                        <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#4f46e5", color: "#fff", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                          {idx + 1}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>
                            Strategy: <b>{step.strategy || "sequential"}</b>
                            {step.useOutputOf !== undefined && <span style={{ marginLeft: 8 }}>uses output of step {step.useOutputOf + 1}</span>}
                          </div>
                          <div style={{ fontSize: 12, color: "#0f172a", whiteSpace: "pre-wrap", background: "#fff", padding: "6px 10px", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                            {step.inputTemplate || "(empty)"}
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Run results */}
                    {runResults[chain.id] && runResults[chain.id].length > 0 && (
                      <div style={{ marginTop: 16 }}>
                        <div style={{ fontWeight: 700, fontSize: 12, color: "#475569", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Last Run Results</div>
                        {runResults[chain.id].map((result) => (
                          <div key={result.stepIndex} style={{ marginBottom: 10, background: "#fff", border: "1px solid #e0e7ff", borderRadius: 8, overflow: "hidden" }}>
                            <div style={{ padding: "6px 12px", background: "#eef2ff", display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: "#4338ca" }}>Step {result.stepIndex + 1}</span>
                              <span style={{ fontSize: 11, color: "#6366f1" }}>Run: {result.runId.slice(0, 8)}…</span>
                              <Link
                                href={`/qcoreai/multi?session=${result.sessionId}`}
                                style={{ marginLeft: "auto", fontSize: 11, color: "#4338ca", textDecoration: "none", fontWeight: 600 }}
                              >
                                Open session →
                              </Link>
                            </div>
                            <div style={{ padding: "10px 12px", fontSize: 12, color: "#0f172a", whiteSpace: "pre-wrap", maxHeight: 200, overflowY: "auto" }}>
                              {result.finalContent || "(no output)"}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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
