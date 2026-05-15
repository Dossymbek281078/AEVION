"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";
import { catalog } from "@/lib/aevionCatalog";

type Stack = "next" | "express" | "static" | "react" | "python";
type ProjectStatus = "draft" | "building" | "live" | "error";

interface Project {
  id: string;
  name: string;
  description: string | null;
  stack: Stack;
  status: ProjectStatus;
  deployUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Snippet {
  id: string;
  userId: string;
  title: string;
  content: string;
  language: string;
  tags: string[];
  stars: number;
  createdAt: string;
  updatedAt: string;
}

const STACK_LABELS: Record<Stack, string> = {
  next: "Next.js",
  express: "Express",
  static: "Static",
  react: "React",
  python: "Python",
};

const STACK_COLORS: Record<Stack, { bg: string; fg: string }> = {
  next: { bg: "#0d9488", fg: "#fff" },
  express: { bg: "#7c3aed", fg: "#fff" },
  static: { bg: "#0369a1", fg: "#fff" },
  react: { bg: "#0284c7", fg: "#fff" },
  python: { bg: "#b45309", fg: "#fff" },
};

const STATUS_STYLES: Record<ProjectStatus, { bg: string; fg: string; label: string }> = {
  draft: { bg: "#f1f5f9", fg: "#64748b", label: "Draft" },
  building: { bg: "#fef3c7", fg: "#92400e", label: "Building..." },
  live: { bg: "#d1fae5", fg: "#065f46", label: "Live" },
  error: { bg: "#fee2e2", fg: "#991b1b", label: "Error" },
};

const STACKS: Array<{ id: Stack; label: string; desc: string }> = [
  { id: "next", label: "Next.js", desc: "Full-stack React" },
  { id: "express", label: "Express", desc: "REST API" },
  { id: "static", label: "Static", desc: "HTML/CSS/JS" },
  { id: "react", label: "React SPA", desc: "Vite + React" },
  { id: "python", label: "Python", desc: "FastAPI / Flask" },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function DevHubPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", stack: "next" as Stack });
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(apiUrl("/api/devhub/projects"), { cache: "no-store" });
      const data = await r.json();
      setProjects(data.projects || []);
    } catch {
      setError("Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const createProject = async () => {
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      const r = await fetch(apiUrl("/api/devhub/projects"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, description: form.description, stack: form.stack }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed to create");
      setProjects((ps) => [data.project, ...ps]);
      setShowModal(false);
      setForm({ name: "", description: "", stack: "next" });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const deleteProject = async (id: string) => {
    if (!confirm("Delete this project and all its files?")) return;
    try {
      await fetch(apiUrl(`/api/devhub/projects/${id}`), { method: "DELETE" });
      setProjects((ps) => ps.filter((p) => p.id !== id));
    } catch {
      setError("Delete failed");
    }
  };

  // ── Snippet Shelf ──────────────────────────────────────────────────────────
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [snippetsLoading, setSnippetsLoading] = useState(true);
  const [snippetForm, setSnippetForm] = useState({
    title: "",
    language: "javascript",
    content: "",
    tags: "",
  });
  const [snippetSubmitting, setSnippetSubmitting] = useState(false);
  const [snippetError, setSnippetError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchSnippets = useCallback(async () => {
    setSnippetsLoading(true);
    try {
      const data = await catalog.devhub.snippets({ limit: 5 });
      // SDK returns { total, items }. Backend legacy used `snippets` —
      // accept either to stay tolerant of mixed deployments.
      const raw = data as unknown as { items?: Snippet[]; snippets?: Snippet[] };
      const list = Array.isArray(raw.items)
        ? raw.items
        : Array.isArray(raw.snippets)
          ? raw.snippets
          : [];
      setSnippets(list);
    } catch {
      setSnippetError("Failed to load snippets");
    } finally {
      setSnippetsLoading(false);
    }
  }, []);

  useEffect(() => { fetchSnippets(); }, [fetchSnippets]);

  const submitSnippet = async () => {
    if (!snippetForm.title.trim() || !snippetForm.content.trim()) return;
    setSnippetSubmitting(true);
    setSnippetError(null);
    try {
      const tags = snippetForm.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await catalog.devhub.createSnippet({
        title: snippetForm.title.trim(),
        content: snippetForm.content,
        language: snippetForm.language.trim() || "plaintext",
        tags,
      });
      setSnippetForm({ title: "", language: "javascript", content: "", tags: "" });
      await fetchSnippets();
    } catch (e: any) {
      setSnippetError(e?.message || "Failed to share snippet");
    } finally {
      setSnippetSubmitting(false);
    }
  };

  const copySnippet = async (s: Snippet) => {
    try {
      await navigator.clipboard.writeText(s.content);
      setCopiedId(s.id);
      setTimeout(() => setCopiedId((c) => (c === s.id ? null : c)), 1600);
    } catch {
      setSnippetError("Clipboard unavailable");
    }
  };

  const starSnippet = async (s: Snippet) => {
    // Optimistic update.
    setSnippets((arr) =>
      arr.map((x) => (x.id === s.id ? { ...x, stars: x.stars + 1 } : x))
    );
    try {
      const data = await catalog.devhub.star(s.id);
      if (typeof data?.stars === "number") {
        setSnippets((arr) =>
          arr.map((x) => (x.id === s.id ? { ...x, stars: data.stars } : x))
        );
      }
    } catch {
      // Rollback.
      setSnippets((arr) =>
        arr.map((x) => (x.id === s.id ? { ...x, stars: Math.max(0, x.stars - 1) } : x))
      );
      setSnippetError("Could not star snippet");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "system-ui, sans-serif", overflowX: "hidden" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 16px" }}>
        <Wave1Nav />

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", margin: 0 }}>
              DevHub
            </h1>
            <p style={{ color: "#64748b", marginTop: 6, fontSize: 15 }}>
              Build and deploy apps with AI. No GitHub or cloud accounts needed.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            style={{
              padding: "10px 22px", background: "#0d9488", color: "#fff",
              border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14,
              cursor: "pointer",
            }}
          >
            + New Project
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 10, padding: "12px 16px", marginBottom: 20, color: "#991b1b", fontSize: 14, display: "flex", justifyContent: "space-between" }}>
            <span>{error}</span>
            <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#991b1b", fontWeight: 700 }}>×</button>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>Loading projects...</div>
        ) : projects.length === 0 ? (
          <div style={{ textAlign: "center", padding: 80 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🏗</div>
            <h2 style={{ fontSize: 20, color: "#0f172a", marginBottom: 8 }}>No projects yet</h2>
            <p style={{ color: "#64748b", marginBottom: 24 }}>Create your first project and let AI build it for you.</p>
            <button
              onClick={() => setShowModal(true)}
              style={{ padding: "10px 24px", background: "#0d9488", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer" }}
            >
              + New Project
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))", gap: 20 }}>
            {projects.map((p) => {
              const stackStyle = STACK_COLORS[p.stack] ?? { bg: "#64748b", fg: "#fff" };
              const statusStyle = STATUS_STYLES[p.status] ?? STATUS_STYLES.draft;
              return (
                <div
                  key={p.id}
                  style={{
                    background: "#fff", border: "1px solid rgba(15,23,42,0.1)",
                    borderRadius: 14, padding: "20px 22px", position: "relative",
                    transition: "box-shadow 0.15s",
                  }}
                >
                  {/* Stack + status row */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    <span style={{ padding: "3px 10px", borderRadius: 6, background: stackStyle.bg, color: stackStyle.fg, fontSize: 12, fontWeight: 700 }}>
                      {STACK_LABELS[p.stack] ?? p.stack}
                    </span>
                    <span style={{ padding: "3px 10px", borderRadius: 6, background: statusStyle.bg, color: statusStyle.fg, fontSize: 12, fontWeight: 600 }}>
                      {statusStyle.label}
                    </span>
                  </div>

                  <Link href={`/devhub/${p.id}`} style={{ textDecoration: "none" }}>
                    <h3 style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", margin: "0 0 6px" }}>
                      {p.name}
                    </h3>
                  </Link>
                  {p.description && (
                    <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 12px", lineHeight: 1.5 }}>
                      {p.description}
                    </p>
                  )}

                  {p.deployUrl && (
                    <a
                      href={p.deployUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 12, color: "#0d9488", display: "block", marginBottom: 12, wordBreak: "break-all" }}
                    >
                      {p.deployUrl}
                    </a>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>{formatDate(p.updatedAt)}</span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Link
                        href={`/devhub/${p.id}`}
                        style={{ padding: "5px 14px", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 12, fontWeight: 600, color: "#0f172a", textDecoration: "none" }}
                      >
                        Open IDE
                      </Link>
                      <button
                        onClick={() => deleteProject(p.id)}
                        style={{ padding: "5px 10px", background: "none", border: "1px solid #fca5a5", borderRadius: 7, fontSize: 12, color: "#ef4444", cursor: "pointer" }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Snippet Shelf ───────────────────────────────────────────────── */}
        <div className="mt-12 rounded-2xl bg-slate-950 text-slate-100 p-6 sm:p-8 border border-slate-800 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">
                Snippet shelf
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Last 5 publicly shared snippets. Copy, star, or share your own.
              </p>
            </div>
            <button
              onClick={fetchSnippets}
              className="self-start sm:self-auto px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700"
            >
              Refresh
            </button>
          </div>

          {snippetError && (
            <div className="mb-4 rounded-md border border-rose-700 bg-rose-950/60 px-3 py-2 text-sm text-rose-200 flex justify-between">
              <span>{snippetError}</span>
              <button
                onClick={() => setSnippetError(null)}
                className="font-bold text-rose-200"
                aria-label="dismiss"
              >
                ×
              </button>
            </div>
          )}

          {snippetsLoading ? (
            <div className="text-center text-slate-500 py-10">Loading snippets…</div>
          ) : snippets.length === 0 ? (
            <div className="text-center text-slate-500 py-10 border border-dashed border-slate-800 rounded-lg">
              No snippets yet. Be the first to share one below.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {snippets.map((s) => {
                const preview = (s.content || "").slice(0, 200);
                const truncated = (s.content || "").length > 200;
                return (
                  <div
                    key={s.id}
                    className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 flex flex-col gap-3 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-white leading-snug">
                        {s.title}
                      </h3>
                      <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider bg-teal-900/60 text-teal-200 border border-teal-800">
                        {s.language || "plaintext"}
                      </span>
                    </div>

                    <pre className="text-[11px] font-mono leading-relaxed text-slate-300 bg-slate-950/60 border border-slate-800 rounded-md p-2 overflow-x-auto max-h-32 whitespace-pre-wrap break-words">
                      {preview}{truncated ? "…" : ""}
                    </pre>

                    {s.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {s.tags.slice(0, 6).map((t) => (
                          <span
                            key={t}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 mt-auto pt-2 border-t border-slate-800">
                      <button
                        onClick={() => starSnippet(s)}
                        className="flex items-center gap-1 text-xs font-semibold text-amber-300 hover:text-amber-200"
                        aria-label="star snippet"
                      >
                        <span aria-hidden>★</span>
                        <span>{s.stars}</span>
                      </button>
                      <button
                        onClick={() => copySnippet(s)}
                        className={
                          "text-xs font-semibold px-2.5 py-1 rounded-md border transition-colors " +
                          (copiedId === s.id
                            ? "bg-emerald-900/60 border-emerald-700 text-emerald-200"
                            : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200")
                        }
                      >
                        {copiedId === s.id ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Share form */}
          <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-white mb-3">
              Поделиться сниппетом
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={snippetForm.title}
                onChange={(e) =>
                  setSnippetForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="Title"
                className="px-3 py-2 rounded-md bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-700"
              />
              <input
                type="text"
                value={snippetForm.language}
                onChange={(e) =>
                  setSnippetForm((f) => ({ ...f, language: e.target.value }))
                }
                placeholder="Language (e.g. javascript)"
                className="px-3 py-2 rounded-md bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-700"
              />
            </div>
            <textarea
              value={snippetForm.content}
              onChange={(e) =>
                setSnippetForm((f) => ({ ...f, content: e.target.value }))
              }
              placeholder="// paste your snippet here"
              rows={5}
              className="mt-3 w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-800 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-700 resize-y"
            />
            <input
              type="text"
              value={snippetForm.tags}
              onChange={(e) =>
                setSnippetForm((f) => ({ ...f, tags: e.target.value }))
              }
              placeholder="tags, comma, separated"
              className="mt-3 w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-700"
            />
            <div className="mt-4 flex justify-end">
              <button
                onClick={submitSnippet}
                disabled={
                  snippetSubmitting ||
                  !snippetForm.title.trim() ||
                  !snippetForm.content.trim()
                }
                className={
                  "px-4 py-2 rounded-md text-sm font-semibold transition-colors " +
                  (snippetSubmitting ||
                  !snippetForm.title.trim() ||
                  !snippetForm.content.trim()
                    ? "bg-teal-900/60 text-teal-300/60 cursor-not-allowed"
                    : "bg-teal-600 hover:bg-teal-500 text-white")
                }
              >
                {snippetSubmitting ? "Sharing…" : "Share snippet"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* New Project Modal */}
      {showModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div style={{ background: "#fff", borderRadius: 16, padding: "20px clamp(16px, 4vw, 32px)", width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 20, color: "#0f172a" }}>New Project</h2>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                Project Name *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="My awesome app"
                style={{ width: "100%", padding: "10px 14px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 16, boxSizing: "border-box" }}
                autoFocus
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                Description
              </label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Short description of the project"
                style={{ width: "100%", padding: "10px 14px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 16, boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                Stack
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {STACKS.map((s) => {
                  const c = STACK_COLORS[s.id];
                  const selected = form.stack === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setForm((f) => ({ ...f, stack: s.id }))}
                      style={{
                        padding: "10px 14px", border: selected ? `2px solid ${c.bg}` : "2px solid #e2e8f0",
                        borderRadius: 10, background: selected ? `${c.bg}15` : "#fff",
                        textAlign: "left", cursor: "pointer",
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 13, color: selected ? c.bg : "#374151" }}>{s.label}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{s.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowModal(false)}
                style={{ padding: "9px 18px", background: "#f1f5f9", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", color: "#374151" }}
              >
                Cancel
              </button>
              <button
                onClick={createProject}
                disabled={creating || !form.name.trim()}
                style={{
                  padding: "9px 22px", background: creating ? "#99f6e4" : "#0d9488",
                  color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: creating ? "not-allowed" : "pointer",
                }}
              >
                {creating ? "Creating..." : "Create Project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
