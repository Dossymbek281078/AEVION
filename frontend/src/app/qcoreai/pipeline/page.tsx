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

type PipelineStep = {
  role: string;
  name?: string;
  systemPrompt?: string;
  provider?: string;
  model?: string;
};

type Pipeline = {
  id: string;
  name: string;
  description: string | null;
  steps: PipelineStep[];
  isPublic: boolean;
  useCount: number;
  createdAt: string;
};

const ROLE_OPTIONS = [
  { id: "analyst", label: "Analyst", color: "#2563eb", desc: "Decomposes the task" },
  { id: "researcher", label: "Researcher", color: "#7c3aed", desc: "Gathers context and facts" },
  { id: "writer", label: "Writer", color: "#059669", desc: "Drafts the response" },
  { id: "editor", label: "Editor", color: "#0891b2", desc: "Refines and polishes" },
  { id: "critic", label: "Critic", color: "#d97706", desc: "Reviews and approves" },
  { id: "summarizer", label: "Summarizer", color: "#6366f1", desc: "Condenses the result" },
  { id: "translator", label: "Translator", color: "#be185d", desc: "Converts language/format" },
  { id: "fact-checker", label: "Fact-checker", color: "#b45309", desc: "Verifies claims" },
];

const emptyStep = (): PipelineStep => ({ role: "writer", name: "", systemPrompt: "" });

export default function PipelinePage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [publicPipelines, setPublicPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Builder state
  const [pName, setPName] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [pPublic, setPPublic] = useState(false);
  const [steps, setSteps] = useState<PipelineStep[]>([{ role: "analyst" }, { role: "writer" }, { role: "critic" }]);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [myRes, pubRes] = await Promise.all([
        fetch(apiUrl("/api/qcoreai/pipelines"), { headers: bearerHeader() }),
        fetch(apiUrl("/api/qcoreai/pipelines/public?limit=10")),
      ]);
      const myData = await myRes.json().catch(() => ({}));
      const pubData = await pubRes.json().catch(() => ({}));
      if (Array.isArray(myData?.items)) setPipelines(myData.items);
      if (Array.isArray(pubData?.items)) setPublicPipelines(pubData.items);
    } catch (e: any) { setError(e?.message || "Failed to load pipelines"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addStep = () => setSteps((prev) => [...prev, emptyStep()]);
  const removeStep = (i: number) => setSteps((prev) => prev.filter((_, idx) => idx !== i));
  const updateStep = (i: number, patch: Partial<PipelineStep>) =>
    setSteps((prev) => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  const moveStep = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    setSteps((prev) => { const a = [...prev]; [a[i], a[j]] = [a[j], a[i]]; return a; });
  };

  const save = async () => {
    if (!pName.trim() || steps.length < 1) return;
    setSaving(true);
    setError(null);
    try {
      const body = { name: pName.trim(), description: pDesc.trim() || null, steps, isPublic: pPublic };
      const url = editId ? apiUrl(`/api/qcoreai/pipelines/${editId}`) : apiUrl("/api/qcoreai/pipelines");
      const method = editId ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json", ...bearerHeader() }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setPipelines((prev) => editId ? prev.map((p) => p.id === editId ? data.pipeline : p) : [data.pipeline, ...prev]);
      setPName(""); setPDesc(""); setPPublic(false);
      setSteps([{ role: "analyst" }, { role: "writer" }, { role: "critic" }]);
      setEditId(null);
    } catch (e: any) { setError(e?.message || "Save failed"); }
    finally { setSaving(false); }
  };

  const del = async (id: string) => {
    if (!confirm("Delete this pipeline?")) return;
    await fetch(apiUrl(`/api/qcoreai/pipelines/${id}`), { method: "DELETE", headers: bearerHeader() });
    setPipelines((prev) => prev.filter((p) => p.id !== id));
  };

  const applyToMulti = (p: Pipeline) => {
    sessionStorage.setItem("qcore_pipeline_inject", JSON.stringify(p.steps));
    window.location.href = "/qcoreai/multi?from=pipeline";
  };

  const startEdit = (p: Pipeline) => {
    setEditId(p.id);
    setPName(p.name);
    setPDesc(p.description || "");
    setPPublic(p.isPublic);
    setSteps(p.steps);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main>
      <Wave1Nav />
      <ProductPageShell>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", margin: 0 }}>⚙️ Pipeline Builder</h1>
            <Link href="/qcoreai/multi" style={{ fontSize: 12, color: "#4338ca", fontWeight: 700, textDecoration: "none" }}>← Multi-agent</Link>
          </div>
          <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>
            Design custom multi-step agent chains — chain Analyst → Researcher → Writer → Editor → Critic in any order.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, alignItems: "start" }}>
          {/* Builder */}
          <div style={{ borderRadius: 14, border: "1px solid rgba(15,23,42,0.12)", background: "#fff", padding: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14, color: "#0f172a" }}>
              {editId ? "✎ Edit pipeline" : "+ New pipeline"}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 3 }}>Name *</label>
                <input value={pName} onChange={(e) => setPName(e.target.value)} placeholder="e.g. Deep Research Pipeline"
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 3 }}>Description</label>
                <input value={pDesc} onChange={(e) => setPDesc(e.target.value)} placeholder="Optional description"
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
            </div>

            {/* Steps */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 8 }}>Pipeline steps ({steps.length})</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {steps.map((step, i) => {
                  const roleInfo = ROLE_OPTIONS.find((r) => r.id === step.role) || ROLE_OPTIONS[1];
                  const expanded = expandedStep === i;
                  return (
                    <div key={i} style={{ borderRadius: 10, border: `1px solid ${roleInfo.color}33`, background: `${roleInfo.color}06`, overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px" }}>
                        <span style={{ width: 22, height: 22, borderRadius: 6, background: roleInfo.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, flexShrink: 0 }}>
                          {i + 1}
                        </span>
                        <select value={step.role} onChange={(e) => updateStep(i, { role: e.target.value })}
                          style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 12, fontFamily: "inherit", color: roleInfo.color, fontWeight: 700 }}>
                          {ROLE_OPTIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                        </select>
                        <input value={step.name || ""} onChange={(e) => updateStep(i, { name: e.target.value })}
                          placeholder="Custom name (opt.)"
                          style={{ flex: 1, padding: "4px 8px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, outline: "none" }} />
                        <button onClick={() => setExpandedStep(expanded ? null : i)} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 12, color: "#94a3b8" }}>
                          {expanded ? "▴" : "▾"} Config
                        </button>
                        <button onClick={() => moveStep(i, -1)} disabled={i === 0} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 12, color: "#cbd5e1" }}>↑</button>
                        <button onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 12, color: "#cbd5e1" }}>↓</button>
                        <button onClick={() => removeStep(i)} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 14, color: "#fca5a5" }}>×</button>
                      </div>
                      {expanded && (
                        <div style={{ padding: "8px 12px 12px", borderTop: "1px solid rgba(15,23,42,0.06)" }}>
                          <textarea value={step.systemPrompt || ""} onChange={(e) => updateStep(i, { systemPrompt: e.target.value })}
                            placeholder="Custom system prompt for this step…"
                            rows={3}
                            style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, fontFamily: "inherit", resize: "vertical", outline: "none", boxSizing: "border-box" }} />
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6 }}>
                            <input value={step.provider || ""} onChange={(e) => updateStep(i, { provider: e.target.value })}
                              placeholder="Provider (e.g. anthropic)"
                              style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 11 }} />
                            <input value={step.model || ""} onChange={(e) => updateStep(i, { model: e.target.value })}
                              placeholder="Model (e.g. claude-haiku)"
                              style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 11 }} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <button onClick={addStep} style={{ marginTop: 8, width: "100%", padding: "7px", borderRadius: 8, border: "1px dashed #cbd5e1", background: "#f8fafc", color: "#64748b", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                + Add step
              </button>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
                <input type="checkbox" checked={pPublic} onChange={(e) => setPPublic(e.target.checked)} />
                Share publicly
              </label>
              <button onClick={save} disabled={saving || !pName.trim() || steps.length < 1}
                style={{ flex: 1, padding: "8px", borderRadius: 8, border: "none", background: !pName.trim() ? "#94a3b8" : "#0f172a", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
                {saving ? "Saving…" : editId ? "Update pipeline" : "Save pipeline"}
              </button>
              {editId && <button onClick={() => { setEditId(null); setPName(""); setPDesc(""); setSteps([{ role: "analyst" }, { role: "writer" }, { role: "critic" }]); }}
                style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Cancel</button>}
            </div>

            {error && <div style={{ marginTop: 10, padding: "6px 10px", borderRadius: 6, background: "rgba(239,68,68,0.08)", color: "#991b1b", fontSize: 12 }}>{error}</div>}
          </div>

          {/* Sidebar: my pipelines + community */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* My pipelines */}
            <div>
              <div style={{ fontWeight: 700, fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                My pipelines ({pipelines.length})
              </div>
              {loading ? <p style={{ fontSize: 12, color: "#94a3b8" }}>Loading…</p> : pipelines.length === 0 ? <p style={{ fontSize: 12, color: "#94a3b8" }}>None yet.</p> : (
                pipelines.map((p) => (
                  <div key={p.id} style={{ marginBottom: 8, padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.1)", background: "#fff" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, flex: 1, color: "#0f172a" }}>{p.name}</span>
                      {p.isPublic && <span style={{ fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 999, background: "rgba(124,58,237,0.1)", color: "#6d28d9" }}>PUBLIC</span>}
                    </div>
                    <div style={{ fontSize: 10, color: "#64748b", marginBottom: 6 }}>
                      {p.steps.map((s) => s.name || s.role).join(" → ")}
                    </div>
                    <div style={{ display: "flex", gap: 5 }}>
                      <button onClick={() => applyToMulti(p)} style={{ flex: 1, padding: "4px 8px", borderRadius: 6, border: "none", background: "#0f172a", color: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>▶ Use</button>
                      <button onClick={() => startEdit(p)} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 10, cursor: "pointer" }}>✎</button>
                      <button onClick={() => del(p.id)} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #fecaca", background: "#fff", color: "#991b1b", fontSize: 10, cursor: "pointer" }}>×</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Community pipelines */}
            {publicPipelines.length > 0 && (
              <div>
                <div style={{ fontWeight: 700, fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Community</div>
                {publicPipelines.map((p) => (
                  <div key={p.id} style={{ marginBottom: 8, padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(124,58,237,0.15)", background: "rgba(124,58,237,0.03)" }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: "#0f172a", marginBottom: 2 }}>{p.name}</div>
                    <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 6 }}>{p.steps.map((s) => s.role).join(" → ")} · {p.useCount} uses</div>
                    <button onClick={() => applyToMulti(p)} style={{ width: "100%", padding: "4px", borderRadius: 6, border: "none", background: "rgba(124,58,237,0.12)", color: "#6d28d9", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>▶ Use this pipeline</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ProductPageShell>
    </main>
  );
}
