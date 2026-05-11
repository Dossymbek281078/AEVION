"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

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

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>
        <Wave1Nav />

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
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
      </div>

      {/* New Project Modal */}
      {showModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div style={{ background: "#fff", borderRadius: 16, padding: 32, width: "100%", maxWidth: 480 }}>
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
                style={{ width: "100%", padding: "10px 14px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }}
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
                style={{ width: "100%", padding: "10px 14px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }}
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
