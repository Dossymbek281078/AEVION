"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

type Prompt = {
  id: string;
  ownerUserId: string;
  name: string;
  description: string | null;
  role: string;
  content: string;
  version: number;
  parentPromptId: string | null;
  isPublic: boolean;
  importCount: number;
  createdAt: string;
  updatedAt: string;
};

const ROLES = ["analyst", "writer", "writerB", "critic", "judge", "system"];

function bearerHeader(): HeadersInit {
  try {
    const t = typeof window !== "undefined" ? localStorage.getItem("aevion_auth_token_v1") : null;
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

function fmtDate(s: string) {
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

export default function QCorePromptsPage() {
  const [items, setItems] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [authMissing, setAuthMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chain, setChain] = useState<Prompt[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [role, setRole] = useState("writer");
  const [content, setContent] = useState("");
  const [creating, setCreating] = useState(false);

  const [editContent, setEditContent] = useState("");

  const [browseOpen, setBrowseOpen] = useState(false);
  const [browseQ, setBrowseQ] = useState("");
  const [browseItems, setBrowseItems] = useState<Prompt[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = bearerHeader();
      if (!("Authorization" in headers)) {
        setAuthMissing(true);
        setLoading(false);
        return;
      }
      const r = await fetch(apiUrl("/api/qcoreai/prompts"), { headers });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setItems(data.items || []);
    } catch (e: any) {
      setError(e?.message || "fetch failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchChain = useCallback(async (id: string) => {
    try {
      const r = await fetch(apiUrl(`/api/qcoreai/prompts/${id}/versions`), { headers: bearerHeader() });
      if (!r.ok) return;
      const data = await r.json();
      setChain(data.items || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const selected = useMemo(() => items.find((p) => p.id === selectedId) || null, [items, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setChain([]);
      setEditContent("");
      return;
    }
    fetchChain(selectedId);
    const sel = items.find((p) => p.id === selectedId);
    setEditContent(sel?.content || "");
  }, [selectedId, items, fetchChain]);

  const createNew = useCallback(async () => {
    if (!name.trim() || !content.trim()) return;
    setCreating(true);
    try {
      const r = await fetch(apiUrl("/api/qcoreai/prompts"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify({
          name,
          description: description.trim() || null,
          role,
          content,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setName("");
      setDescription("");
      setContent("");
      setRole("writer");
      setCreateOpen(false);
      await fetchAll();
      setSelectedId(data.prompt.id);
    } catch (e: any) {
      setError(e?.message || "create failed");
    } finally {
      setCreating(false);
    }
  }, [name, description, role, content, fetchAll]);

  const togglePublic = useCallback(
    async (p: Prompt) => {
      try {
        const r = await fetch(apiUrl(`/api/qcoreai/prompts/${p.id}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...bearerHeader() },
          body: JSON.stringify({ isPublic: !p.isPublic }),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        await fetchAll();
      } catch (e: any) {
        setError(e?.message || "update failed");
      }
    },
    [fetchAll]
  );

  const saveAsNewVersion = useCallback(async () => {
    if (!selected) return;
    if (editContent.trim() === selected.content.trim()) return;
    try {
      const r = await fetch(apiUrl(`/api/qcoreai/prompts/${selected.id}/fork`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify({ content: editContent }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      await fetchAll();
      setSelectedId(data.prompt.id);
    } catch (e: any) {
      setError(e?.message || "fork failed");
    }
  }, [selected, editContent, fetchAll]);

  const deletePrompt = useCallback(
    async (id: string) => {
      if (!confirm("Delete this prompt version? Other versions in the chain remain.")) return;
      try {
        const r = await fetch(apiUrl(`/api/qcoreai/prompts/${id}`), {
          method: "DELETE",
          headers: bearerHeader(),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        await fetchAll();
        if (selectedId === id) setSelectedId(null);
      } catch (e: any) {
        setError(e?.message || "delete failed");
      }
    },
    [fetchAll, selectedId]
  );

  const fetchBrowse = useCallback(async (q: string) => {
    setBrowseLoading(true);
    try {
      const url = q
        ? `/api/qcoreai/prompts/public?q=${encodeURIComponent(q)}&limit=30`
        : `/api/qcoreai/prompts/public?limit=30`;
      const r = await fetch(apiUrl(url));
      if (!r.ok) return;
      const data = await r.json();
      setBrowseItems(data.items || []);
    } finally {
      setBrowseLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!browseOpen) return;
    const t = setTimeout(() => fetchBrowse(browseQ.trim()), 250);
    return () => clearTimeout(t);
  }, [browseOpen, browseQ, fetchBrowse]);

  const importPublic = useCallback(
    async (p: Prompt) => {
      try {
        const r = await fetch(apiUrl(`/api/qcoreai/prompts/${p.id}/fork`), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...bearerHeader() },
          body: JSON.stringify({}),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        await fetchAll();
        setSelectedId(data.prompt.id);
        setBrowseOpen(false);
      } catch (e: any) {
        setError(e?.message || "import failed");
      }
    },
    [fetchAll]
  );

  return (
    <main>
      <ProductPageShell maxWidth={1200}>
        <Wave1Nav />

        <div
          style={{
            borderRadius: 20,
            overflow: "hidden",
            marginBottom: 16,
            background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #4338ca 100%)",
            color: "#fff",
            padding: "28px 28px 22px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: "linear-gradient(135deg, #818cf8, #4f46e5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                fontSize: 16,
              }}
            >
              ✎
            </div>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0, letterSpacing: "-0.02em" }}>
                QCoreAI · Prompts
              </h1>
              <p style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.78 }}>
                Versioned custom system prompts per agent role. Fork, edit, share.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Your prompts</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setBrowseOpen((v) => !v)}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                background: browseOpen ? "#1e293b" : "#f1f5f9",
                color: browseOpen ? "#fff" : "#0f172a",
                border: "1px solid #e2e8f0",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              🌐 Browse community
            </button>
            <button
              onClick={() => setCreateOpen((v) => !v)}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                background: createOpen ? "#1e293b" : "#0f172a",
                color: "#fff",
                border: 0,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              {createOpen ? "Close" : "+ New prompt"}
            </button>
          </div>
        </div>

        {browseOpen && (
          <div
            style={{
              padding: 12,
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              background: "#fafbfc",
              marginBottom: 16,
            }}
          >
            <input
              value={browseQ}
              onChange={(e) => setBrowseQ(e.target.value)}
              placeholder="Search community prompts…"
              style={{
                width: "100%",
                padding: "6px 10px",
                border: "1px solid #cbd5e1",
                borderRadius: 6,
                fontSize: 13,
                marginBottom: 8,
              }}
            />
            {browseLoading ? (
              <div style={{ color: "#64748b", fontSize: 13 }}>Loading…</div>
            ) : browseItems.length === 0 ? (
              <div style={{ color: "#64748b", fontSize: 13 }}>No public prompts found.</div>
            ) : (
              <div style={{ display: "grid", gap: 8, maxHeight: 320, overflowY: "auto" }}>
                {browseItems.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      padding: 10,
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      background: "#fff",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: 8,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500 }}>{p.name}</div>
                      {p.description && (
                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{p.description}</div>
                      )}
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                        role: {p.role} · v{p.version} · ↓ {p.importCount}
                      </div>
                    </div>
                    <button
                      onClick={() => importPublic(p)}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 6,
                        background: "#0d9488",
                        color: "#fff",
                        border: 0,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      ↓ Import
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {createOpen && (
          <div
            style={{
              padding: 14,
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              background: "#fafbfc",
              marginBottom: 16,
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 8, marginBottom: 8 }}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
                style={{
                  padding: "6px 10px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 6,
                  fontSize: 13,
                }}
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                style={{
                  padding: "6px 10px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 6,
                  fontSize: 13,
                }}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              style={{
                width: "100%",
                padding: "6px 10px",
                border: "1px solid #cbd5e1",
                borderRadius: 6,
                fontSize: 13,
                marginBottom: 8,
              }}
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="System prompt content"
              rows={6}
              style={{
                width: "100%",
                padding: "8px 10px",
                border: "1px solid #cbd5e1",
                borderRadius: 6,
                fontSize: 13,
                fontFamily: "inherit",
                resize: "vertical",
                marginBottom: 8,
              }}
            />
            <button
              onClick={createNew}
              disabled={creating || !name.trim() || !content.trim()}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                background: creating || !name.trim() || !content.trim() ? "#cbd5e1" : "#0f172a",
                color: "#fff",
                border: 0,
                fontSize: 13,
                fontWeight: 500,
                cursor: creating || !name.trim() || !content.trim() ? "not-allowed" : "pointer",
              }}
            >
              {creating ? "Creating…" : "Create prompt"}
            </button>
          </div>
        )}

        {authMissing && (
          <div
            style={{
              padding: 14,
              border: "1px solid #fde68a",
              background: "#fef3c7",
              color: "#78350f",
              borderRadius: 10,
              fontSize: 13,
            }}
          >
            Sign in to manage prompts. <Link href="/auth" style={{ color: "#9a3412", textDecoration: "underline" }}>Go to /auth</Link>.
          </div>
        )}

        {error && !authMissing && (
          <div
            style={{
              padding: 10,
              border: "1px solid #fecaca",
              background: "#fef2f2",
              color: "#991b1b",
              borderRadius: 8,
              fontSize: 13,
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}

        {!authMissing && (
          <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 14 }}>
            <div style={{ display: "grid", gap: 8, alignContent: "start" }}>
              {loading ? (
                <div style={{ color: "#64748b", padding: 12 }}>Loading…</div>
              ) : items.length === 0 ? (
                <div style={{ color: "#64748b", fontSize: 13, padding: 12, border: "2px dashed #e2e8f0", borderRadius: 8, textAlign: "center" }}>
                  No prompts yet.
                </div>
              ) : (
                items.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    style={{
                      textAlign: "left",
                      padding: 10,
                      border: `1px solid ${selectedId === p.id ? "#4f46e5" : "#e2e8f0"}`,
                      borderRadius: 8,
                      background: selectedId === p.id ? "#eef2ff" : "#fff",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <strong style={{ fontSize: 13 }}>{p.name}</strong>
                      <span style={{ fontSize: 11, color: "#64748b" }}>v{p.version}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                      role: {p.role}{p.isPublic ? " · 🌐 public" : ""}{p.importCount ? ` · ↓ ${p.importCount}` : ""}
                    </div>
                  </button>
                ))
              )}
            </div>

            <div>
              {!selected ? (
                <div style={{ padding: 28, color: "#64748b", textAlign: "center", border: "2px dashed #e2e8f0", borderRadius: 12 }}>
                  Pick a prompt on the left to view + edit.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>{selected.name}</h3>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                        role: <strong style={{ color: "#0f172a" }}>{selected.role}</strong> · v{selected.version}
                        {selected.parentPromptId && " (forked)"} · updated {fmtDate(selected.updatedAt)}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => togglePublic(selected)}
                        style={{
                          padding: "5px 10px",
                          borderRadius: 6,
                          background: selected.isPublic ? "#dcfce7" : "#f1f5f9",
                          border: "1px solid #e2e8f0",
                          color: selected.isPublic ? "#15803d" : "#0f172a",
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        {selected.isPublic ? "🌐 Public" : "🔒 Private"}
                      </button>
                      <button
                        onClick={() => deletePrompt(selected.id)}
                        style={{
                          padding: "5px 10px",
                          borderRadius: 6,
                          background: "transparent",
                          border: "1px solid #fecaca",
                          color: "#991b1b",
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={14}
                    style={{
                      padding: 12,
                      border: "1px solid #cbd5e1",
                      borderRadius: 8,
                      fontSize: 13,
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      lineHeight: 1.5,
                      resize: "vertical",
                    }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={saveAsNewVersion}
                      disabled={editContent.trim() === selected.content.trim()}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 6,
                        background: editContent.trim() === selected.content.trim() ? "#cbd5e1" : "#0d9488",
                        color: "#fff",
                        border: 0,
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: editContent.trim() === selected.content.trim() ? "not-allowed" : "pointer",
                      }}
                    >
                      💾 Save as v{selected.version + 1}
                    </button>
                    <button
                      onClick={() => setEditContent(selected.content)}
                      disabled={editContent === selected.content}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 6,
                        background: "transparent",
                        border: "1px solid #e2e8f0",
                        color: "#475569",
                        fontSize: 13,
                        cursor: editContent === selected.content ? "not-allowed" : "pointer",
                      }}
                    >
                      Reset
                    </button>
                  </div>

                  {chain.length > 1 && (
                    <div>
                      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>
                        Version chain ({chain.length})
                      </div>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {chain.map((v) => (
                          <button
                            key={v.id}
                            onClick={() => setSelectedId(v.id)}
                            style={{
                              padding: "4px 10px",
                              borderRadius: 6,
                              background: v.id === selected.id ? "#4f46e5" : "#f1f5f9",
                              color: v.id === selected.id ? "#fff" : "#0f172a",
                              border: 0,
                              fontSize: 12,
                              cursor: "pointer",
                              fontWeight: v.id === selected.id ? 600 : 400,
                            }}
                          >
                            v{v.version}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </ProductPageShell>
    </main>
  );
}
