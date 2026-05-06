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

export default function NotebookPage() {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [tags, setTags] = useState<Array<{ tag: string; count: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [activeTag, setActiveTag] = useState("");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editAnnotation, setEditAnnotation] = useState("");
  const [editTags, setEditTags] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
                      border: `1px solid ${s.pinned ? "rgba(245,158,11,0.4)" : "rgba(15,23,42,0.1)"}`,
                      background: s.pinned ? "rgba(245,158,11,0.03)" : "#fff",
                      padding: "12px 14px",
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
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

                    {/* Tags */}
                    {s.tags.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
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
                      </div>
                    )}
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
