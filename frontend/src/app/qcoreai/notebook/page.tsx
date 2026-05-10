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

type Snippet = {
  id: string;
  runId: string;
  role: string;
  content: string;
  annotation: string | null;
  tags: string[];
  pinned: boolean;
  createdAt: string;
};

const ROLE_COLORS: Record<string, string> = {
  final: "#7c3aed",
  analyst: "#2563eb",
  writer: "#059669",
  critic: "#d97706",
};

function tagColor(tag: string): string {
  const h = tag.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return `hsl(${h},60%,35%)`;
}

type Collection = { id: string; name: string; description: string | null; color: string | null };

export default function NotebookPage() {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [tags, setTags] = useState<Array<{ tag: string; count: number }>>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeCollection, setActiveCollection] = useState<string | null>(null);
  const [newCollName, setNewCollName] = useState("");
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [activeTag, setActiveTag] = useState("");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editAnnotation, setEditAnnotation] = useState("");
  const [editTags, setEditTags] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelect = (id: string) => setSelectedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // V53: Auto-tag suggestions per snippet
  const [autoTagBusy, setAutoTagBusy] = useState<string | null>(null); // snippet id
  const [suggestedTags, setSuggestedTags] = useState<Record<string, string[]>>({}); // snippetId -> tags

  async function fetchAutoTags(snippet: Snippet) {
    if (autoTagBusy) return;
    setAutoTagBusy(snippet.id);
    try {
      const r = await fetch(apiUrl("/api/qcoreai/notebook/auto-tag"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify({ content: snippet.content }),
      });
      const d = await r.json().catch(() => ({}));
      if (Array.isArray(d?.tags)) {
        setSuggestedTags((p) => ({ ...p, [snippet.id]: d.tags }));
      }
    } catch { /* ignore */ }
    setAutoTagBusy(null);
  }

  async function addSuggestedTag(snippet: Snippet, tag: string) {
    const newTags = [...new Set([...snippet.tags, tag])];
    const res = await fetch(apiUrl(`/api/qcoreai/notebook/${snippet.id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...bearerHeader() },
      body: JSON.stringify({ tags: newTags }),
    });
    const d = await res.json().catch(() => ({}));
    if (d.snippet) {
      setSnippets((p) => p.map((s) => s.id === snippet.id ? d.snippet : s));
      setSuggestedTags((p) => ({ ...p, [snippet.id]: (p[snippet.id] || []).filter((t) => t !== tag) }));
    }
  }

  // V35: Notebook Q&A panel
  const [qaOpen, setQaOpen] = useState(false);
  const [qaQuestion, setQaQuestion] = useState("");
  const [qaAnswer, setQaAnswer] = useState<string | null>(null);
  const [qaSnippetsUsed, setQaSnippetsUsed] = useState(0);
  const [qaBusy, setQaBusy] = useState(false);

  const askAI = async () => {
    if (!qaQuestion.trim() || qaBusy) return;
    setQaBusy(true);
    setQaAnswer(null);
    try {
      const r = await fetch(apiUrl("/api/qcoreai/notebook/qa"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify({ question: qaQuestion.trim(), limit: 10 }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setQaAnswer(d.answer ?? "No answer returned.");
        setQaSnippetsUsed(d.snippetsUsed ?? 0);
      } else {
        setQaAnswer("Error: " + (d.error ?? "unknown"));
      }
    } catch (e: any) {
      setQaAnswer("Error: " + (e?.message || "unknown"));
    } finally {
      setQaBusy(false);
    }
  };

  const loadCollections = useCallback(async () => {
    try {
      const r = await fetch(apiUrl("/api/qcoreai/notebook/collections"), { headers: bearerHeader() });
      const d = await r.json().catch(() => ({}));
      if (Array.isArray(d?.items)) setCollections(d.items);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => { loadCollections(); }, [loadCollections]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (activeTag) params.set("tag", activeTag);
      if (pinnedOnly) params.set("pinned", "true");
      params.set("limit", "50");
      const [sRes, tRes] = await Promise.all([
        fetch(apiUrl(`/api/qcoreai/notebook?${params}`), { headers: bearerHeader() }),
        fetch(apiUrl("/api/qcoreai/notebook/tags"), { headers: bearerHeader() }),
      ]);
      const sData = await sRes.json().catch(() => ({}));
      const tData = await tRes.json().catch(() => ({}));
      if (Array.isArray(sData?.items)) setSnippets(sData.items);
      if (Array.isArray(tData?.items)) setTags(tData.items);
    } catch (e: any) {
      setError(e?.message || "Failed to load notebook");
    } finally {
      setLoading(false);
    }
  }, [q, activeTag, pinnedOnly]);

  useEffect(() => { load(); }, [load]);

  const togglePin = async (snippet: Snippet) => {
    try {
      const res = await fetch(apiUrl(`/api/qcoreai/notebook/${snippet.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify({ pinned: !snippet.pinned }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setSnippets((p) => p.map((s) => s.id === snippet.id ? data.snippet : s));
    } catch { /* noop */ }
  };

  const del = async (id: string) => {
    if (!confirm("Delete this snippet?")) return;
    try {
      await fetch(apiUrl(`/api/qcoreai/notebook/${id}`), { method: "DELETE", headers: bearerHeader() });
      setSnippets((p) => p.filter((s) => s.id !== id));
      setTags((prev) => {
        // Re-fetch tags to get updated counts
        fetch(apiUrl("/api/qcoreai/notebook/tags"), { headers: bearerHeader() })
          .then((r) => r.json()).then((d) => { if (Array.isArray(d?.items)) setTags(d.items); });
        return prev;
      });
    } catch { /* noop */ }
  };

  const openEdit = (s: Snippet) => {
    setEditId(s.id);
    setEditAnnotation(s.annotation || "");
    setEditTags(s.tags.join(", "));
  };

  const saveEdit = async () => {
    if (!editId) return;
    setSaving(true);
    try {
      const res = await fetch(apiUrl(`/api/qcoreai/notebook/${editId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify({
          annotation: editAnnotation.trim() || null,
          tags: editTags.split(/[,;]+/).map((t) => t.trim().toLowerCase()).filter(Boolean),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSnippets((p) => p.map((s) => s.id === editId ? data.snippet : s));
        setEditId(null);
      }
    } finally {
      setSaving(false);
    }
  };

  const copyContent = async (content: string) => {
    try { await navigator.clipboard.writeText(content); } catch { /* noop */ }
  };

  const useInPrompt = (content: string) => {
    // Store snippet in sessionStorage then navigate to multi page which reads it
    if (typeof window !== "undefined") {
      sessionStorage.setItem("qcore_notebook_inject", content.slice(0, 8000));
      window.location.href = "/qcoreai/multi?from=notebook";
    }
  };

  return (
    <main>
      <Wave1Nav />
      <ProductPageShell>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", margin: 0 }}>📓 Notebook</h1>
            <Link href="/qcoreai/multi" style={{ fontSize: 12, color: "#4338ca", fontWeight: 700, textDecoration: "none" }}>← Multi-agent</Link>
          </div>
          <div style={{ display: "flex", gap: 8, margin: "8px 0 0", flexWrap: "wrap" }}>
            <p style={{ fontSize: 13, color: "#64748b", margin: 0, flex: 1 }}>
              Saved snippets from run outputs — highlight, annotate, and search your knowledge base.
            </p>
            {/* V35: Ask AI button */}
            <button
              onClick={() => { setQaOpen((v) => !v); setQaAnswer(null); }}
              style={{
                padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer",
                border: "1px solid rgba(99,102,241,0.4)", background: qaOpen ? "rgba(99,102,241,0.1)" : "#fff",
                color: "#4338ca", whiteSpace: "nowrap",
              }}
            >
              Ask AI
            </button>
            <button
              onClick={async () => {
                const lines = ["# QCoreAI Notebook Export", `*${new Date().toISOString().slice(0, 10)}*`, ""];
                for (const s of snippets) {
                  lines.push(`## [${s.role.toUpperCase()}] ${new Date(s.createdAt).toLocaleDateString()}`, "");
                  if (s.annotation) lines.push(`> ${s.annotation}`, "");
                  if (s.tags.length > 0) lines.push(`Tags: ${s.tags.map((t) => `#${t}`).join(", ")}`, "");
                  lines.push(s.content, "", "---", "");
                }
                const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = "qcore-notebook.md"; a.click();
                URL.revokeObjectURL(url);
              }}
              disabled={snippets.length === 0}
              style={{
                padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: snippets.length > 0 ? "pointer" : "default",
                border: "1px solid #cbd5e1", background: "#fff", color: "#475569", whiteSpace: "nowrap",
              }}
            >
              ⬇ Export MD ({snippets.length})
            </button>
            {selectedIds.size > 0 && (
              <Link
                href={`/qcoreai/notebook/to-eval?ids=${Array.from(selectedIds).join(",")}`}
                style={{ padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, textDecoration: "none", border: "1px solid rgba(124,58,237,0.3)", background: "rgba(124,58,237,0.08)", color: "#6d28d9", whiteSpace: "nowrap" }}
              >
                🧪 Eval ({selectedIds.size})
              </Link>
            )}
            {selectedIds.size === 0 && (
              <span style={{ fontSize: 11, color: "#94a3b8" }}>Click snippets to select for eval</span>
            )}
          </div>
        </div>

        {/* V35: Notebook Q&A panel */}
        {qaOpen && (
          <div style={{ marginBottom: 16, padding: 16, borderRadius: 12, border: "1px solid rgba(99,102,241,0.2)", background: "rgba(99,102,241,0.04)" }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: "#3730a3", marginBottom: 8 }}>Ask AI about your notebook</div>
            <div style={{ display: "flex", gap: 8, marginBottom: qaAnswer ? 12 : 0 }}>
              <textarea
                value={qaQuestion}
                onChange={(e) => setQaQuestion(e.target.value)}
                onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); askAI(); } }}
                placeholder="What patterns do you see in my saved snippets?"
                rows={2}
                style={{
                  flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #c7d2fe",
                  fontSize: 12, outline: "none", resize: "vertical", fontFamily: "inherit",
                }}
              />
              <button
                onClick={askAI}
                disabled={qaBusy || !qaQuestion.trim()}
                style={{
                  padding: "8px 16px", borderRadius: 8, border: "none",
                  background: qaBusy ? "#a5b4fc" : "#4338ca", color: "#fff",
                  fontSize: 12, fontWeight: 700, cursor: qaBusy ? "default" : "pointer", alignSelf: "flex-start",
                }}
              >
                {qaBusy ? "…" : "Ask"}
              </button>
            </div>
            {qaAnswer && (
              <div>
                <div style={{ fontSize: 11, color: "#6d28d9", marginBottom: 4, fontWeight: 600 }}>
                  Answer · {qaSnippetsUsed} snippet{qaSnippetsUsed !== 1 ? "s" : ""} used
                </div>
                <div style={{ fontSize: 13, color: "#1e1b4b", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{qaAnswer}</div>
              </div>
            )}
          </div>
        )}

        {/* Collections */}
        <div style={{ marginBottom: 14, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>Collections:</span>
          <button
            onClick={() => setActiveCollection(null)}
            style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: "pointer", border: `1px solid ${activeCollection === null ? "#0f172a" : "#e2e8f0"}`, background: activeCollection === null ? "#0f172a" : "#fff", color: activeCollection === null ? "#fff" : "#64748b" }}
          >
            All
          </button>
          {collections.map((c) => (
            <span key={c.id} style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
              <button
                onClick={() => setActiveCollection(activeCollection === c.id ? null : c.id)}
                style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: "pointer", border: `1px solid ${activeCollection === c.id ? (c.color || "#4338ca") : "#e2e8f0"}`, background: activeCollection === c.id ? (c.color ? `${c.color}20` : "rgba(67,56,202,0.1)") : "#fff", color: activeCollection === c.id ? (c.color || "#4338ca") : "#64748b" }}
              >
                {c.name}
              </button>
              {/* V53: Export collection as markdown */}
              <button
                title={`Export "${c.name}" as markdown`}
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    const r = await fetch(apiUrl(`/api/qcoreai/notebook/collections/${c.id}/export`), { method: "POST", headers: bearerHeader() });
                    if (r.ok) {
                      const text = await r.text();
                      const blob = new Blob([text], { type: "text/markdown" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a"); a.href = url; a.download = `${c.name.toLowerCase().replace(/\s+/g, "-")}.md`; a.click(); URL.revokeObjectURL(url);
                    }
                  } catch { /* ignore */ }
                }}
                style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 11, color: "#64748b", padding: "1px 3px" }}
              >
                📋
              </button>
              <button onClick={async (e) => { e.stopPropagation(); await fetch(apiUrl(`/api/qcoreai/notebook/collections/${c.id}`), { method: "DELETE", headers: bearerHeader() }); setCollections((p) => p.filter((x) => x.id !== c.id)); }} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 11, color: "#fca5a5", padding: "1px 3px" }}>×</button>
            </span>
          ))}
          <div style={{ display: "flex", gap: 4 }}>
            <input value={newCollName} onChange={(e) => setNewCollName(e.target.value)} onKeyDown={async (e) => {
              if (e.key === "Enter" && newCollName.trim()) {
                const r = await fetch(apiUrl("/api/qcoreai/notebook/collections"), { method: "POST", headers: { "Content-Type": "application/json", ...bearerHeader() }, body: JSON.stringify({ name: newCollName.trim() }) });
                const d = await r.json().catch(() => ({}));
                if (d.collection) { setCollections((p) => [...p, d.collection]); setNewCollName(""); }
              }
            }} placeholder="+ New collection…" style={{ padding: "3px 8px", borderRadius: 999, border: "1px dashed #e2e8f0", fontSize: 11, outline: "none", width: 120 }} />
          </div>
        </div>

        {/* Search + filters */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          <input
            placeholder="Search snippets…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ flex: 1, minWidth: 180, padding: "7px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, outline: "none" }}
          />
          <button
            onClick={() => setPinnedOnly((v) => !v)}
            style={{
              padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
              border: "1px solid " + (pinnedOnly ? "#f59e0b" : "#cbd5e1"),
              background: pinnedOnly ? "rgba(245,158,11,0.1)" : "#fff",
              color: pinnedOnly ? "#92400e" : "#475569",
            }}
          >
            ★ Pinned only
          </button>
          {activeTag && (
            <button
              onClick={() => setActiveTag("")}
              style={{ padding: "5px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", border: "1px solid #e2e8f0", background: "#f8fafc" }}
            >
              ✕ {activeTag}
            </button>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 16, alignItems: "start" }}>
          {/* Tag cloud sidebar */}
          <div>
            <div style={{ fontWeight: 700, fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Tags</div>
            {tags.length === 0 ? (
              <p style={{ fontSize: 12, color: "#94a3b8" }}>No tags yet.</p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {tags.map(({ tag, count }) => (
                  <button
                    key={tag}
                    onClick={() => setActiveTag(activeTag === tag ? "" : tag)}
                    style={{
                      padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: "pointer",
                      border: `1px solid ${tagColor(tag)}44`,
                      background: activeTag === tag ? `${tagColor(tag)}15` : "#fff",
                      color: tagColor(tag),
                    }}
                  >
                    {tag} <span style={{ opacity: 0.6 }}>{count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Snippet list */}
          <div>
            {loading ? (
              <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading…</p>
            ) : snippets.length === 0 ? (
              <div style={{ padding: 32, borderRadius: 14, border: "1px dashed rgba(15,23,42,0.15)", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                No snippets yet. In the multi-agent view, click ⊞ Save on any agent turn or final answer to save it here.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {snippets.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      borderRadius: 12,
                      border: `1px solid ${selectedIds.has(s.id) ? "rgba(124,58,237,0.5)" : s.pinned ? "rgba(245,158,11,0.4)" : "rgba(15,23,42,0.1)"}`,
                      background: selectedIds.has(s.id) ? "rgba(124,58,237,0.04)" : s.pinned ? "rgba(245,158,11,0.03)" : "#fff",
                      padding: "12px 14px",
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleSelect(s.id)} style={{ cursor: "pointer", marginRight: 2 }} />
                      <span style={{ fontWeight: 800, fontSize: 10, padding: "2px 7px", borderRadius: 999, background: `${ROLE_COLORS[s.role] || "#475569"}15`, color: ROLE_COLORS[s.role] || "#475569" }}>
                        {s.role}
                      </span>
                      <Link href={`/qcoreai/compare?a=${s.runId}`} style={{ fontSize: 10, color: "#4338ca", fontWeight: 700, textDecoration: "none" }}>
                        Run ↗
                      </Link>
                      <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: "auto" }}>
                        {new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                      <button
                        onClick={() => useInPrompt(s.content)}
                        title="Use this snippet as prompt in multi-agent"
                        style={{ border: "1px solid rgba(13,148,136,0.3)", background: "rgba(13,148,136,0.06)", borderRadius: 6, cursor: "pointer", fontSize: 10, fontWeight: 700, color: "#0f766e", padding: "2px 7px" }}
                      >
                        ↗ Use
                      </button>
                      <button onClick={() => togglePin(s)} title={s.pinned ? "Unpin" : "Pin"} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 14, color: s.pinned ? "#f59e0b" : "#cbd5e1" }}>★</button>
                      <button onClick={() => copyContent(s.content)} title="Copy" style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 12, color: "#94a3b8" }}>⎘</button>
                      <button onClick={() => openEdit(s)} title="Edit annotation + tags" style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 12, color: "#94a3b8" }}>✎</button>
                      <button onClick={() => del(s.id)} title="Delete" style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 14, color: "#fca5a5" }}>×</button>
                    </div>

                    {/* Content */}
                    <div style={{ fontSize: 13, color: "#1e293b", lineHeight: 1.6, maxHeight: 200, overflow: "hidden", position: "relative" }}>
                      <div style={{ whiteSpace: "pre-wrap" }}>
                        {s.content.length > 400 ? s.content.slice(0, 400) + "…" : s.content}
                      </div>
                    </div>

                    {/* Annotation */}
                    {editId === s.id ? (
                      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                        <textarea
                          value={editAnnotation}
                          onChange={(e) => setEditAnnotation(e.target.value)}
                          placeholder="Annotation…"
                          rows={2}
                          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 12, fontFamily: "inherit", resize: "vertical" }}
                        />
                        <input
                          value={editTags}
                          onChange={(e) => setEditTags(e.target.value)}
                          placeholder="Tags (comma-separated)…"
                          style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 12 }}
                        />
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={saveEdit} disabled={saving} style={{ padding: "5px 12px", borderRadius: 7, border: "none", background: "#0f172a", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                            {saving ? "…" : "Save"}
                          </button>
                          <button onClick={() => setEditId(null)} style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 12, cursor: "pointer" }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : s.annotation ? (
                      <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 8, background: "#f8fafc", border: "1px solid rgba(15,23,42,0.08)", fontSize: 12, color: "#475569", fontStyle: "italic" }}>
                        {s.annotation}
                      </div>
                    ) : null}

                    {/* Tags + V53 Auto-tag */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8, alignItems: "center" }}>
                      {s.tags.map((t) => (
                        <button
                          key={t}
                          onClick={() => setActiveTag(t)}
                          style={{
                            padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700, cursor: "pointer",
                            border: `1px solid ${tagColor(t)}44`,
                            background: `${tagColor(t)}10`,
                            color: tagColor(t),
                          }}
                        >
                          {t}
                        </button>
                      ))}
                      <button
                        onClick={() => fetchAutoTags(s)}
                        disabled={autoTagBusy === s.id}
                        title="AI auto-tag"
                        style={{ padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700, cursor: autoTagBusy === s.id ? "default" : "pointer", border: "1px dashed #a78bfa", background: "rgba(167,139,250,0.08)", color: "#7c3aed" }}
                      >
                        {autoTagBusy === s.id ? "…" : "✨ Auto-tag"}
                      </button>
                      {(suggestedTags[s.id] || []).map((tag) => (
                        <button
                          key={tag}
                          onClick={() => addSuggestedTag(s, tag)}
                          title={`Add tag "${tag}"`}
                          style={{ padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700, cursor: "pointer", border: "1px solid #a78bfa", background: "rgba(167,139,250,0.15)", color: "#6d28d9" }}
                        >
                          + {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div role="alert" style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#991b1b", fontSize: 12, display: "flex", gap: 8 }}>
            <span style={{ flex: 1 }}>{error}</span>
            <button onClick={() => setError(null)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#991b1b", fontSize: 16, fontWeight: 700 }}>×</button>
          </div>
        )}
      </ProductPageShell>
    </main>
  );
}
