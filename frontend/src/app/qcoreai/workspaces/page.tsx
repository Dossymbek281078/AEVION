"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";

type Workspace = { id: string; name: string; description: string | null; ownerId: string; createdAt: string; updatedAt: string };
type Member = { workspaceId: string; userId: string; role: string; joinedAt: string };
type Session = { id: string; title: string; updatedAt: string; pinned?: boolean };

function bearerHeader(): HeadersInit {
  try {
    const t = typeof window !== "undefined" ? localStorage.getItem("aevion_auth_token_v1") : null;
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch { return {}; }
}

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [authMissing, setAuthMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const [inviteUserId, setInviteUserId] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("viewer");
  const [inviting, setInviting] = useState(false);

  const fetchWorkspaces = useCallback(async () => {
    setLoading(true);
    try {
      const h = bearerHeader();
      if (!("Authorization" in h)) { setAuthMissing(true); setLoading(false); return; }
      const r = await fetch(apiUrl("/api/qcoreai/workspaces"), { headers: h });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
      setWorkspaces(data.items || []);
    } catch (e: any) {
      setError(e?.message || "fetch failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);

  const selectWorkspace = useCallback(async (id: string) => {
    setSelectedId(id);
    try {
      const h = bearerHeader();
      const [mRes, sRes] = await Promise.all([
        fetch(apiUrl(`/api/qcoreai/workspaces/${id}/members`), { headers: h }),
        fetch(apiUrl(`/api/qcoreai/workspaces/${id}/sessions`), { headers: h }),
      ]);
      const mData = await mRes.json().catch(() => ({}));
      const sData = await sRes.json().catch(() => ({}));
      setMembers(mData.items || []);
      setSessions(sData.items || []);
    } catch { /* silent */ }
  }, []);

  const createWorkspace = async () => {
    if (!createName.trim() || creating) return;
    setCreating(true);
    try {
      const r = await fetch(apiUrl("/api/qcoreai/workspaces"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify({ name: createName.trim(), description: createDesc.trim() || null }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
      setCreateName(""); setCreateDesc(""); setCreateOpen(false);
      await fetchWorkspaces();
      setSelectedId(data.workspace.id);
      selectWorkspace(data.workspace.id);
    } catch (e: any) {
      setError(e?.message || "create failed");
    } finally {
      setCreating(false);
    }
  };

  const deleteWorkspace = async (id: string) => {
    if (!confirm("Delete this workspace? Sessions and members will be unlinked.")) return;
    try {
      await fetch(apiUrl(`/api/qcoreai/workspaces/${id}`), { method: "DELETE", headers: bearerHeader() });
      setWorkspaces((prev) => prev.filter((w) => w.id !== id));
      if (selectedId === id) { setSelectedId(null); setMembers([]); setSessions([]); }
    } catch { /* silent */ }
  };

  const inviteMember = async () => {
    if (!inviteUserId.trim() || !selectedId || inviting) return;
    setInviting(true);
    try {
      const r = await fetch(apiUrl(`/api/qcoreai/workspaces/${selectedId}/members`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify({ userId: inviteUserId.trim(), role: inviteRole }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
      setMembers((prev) => [...prev.filter((m) => m.userId !== inviteUserId.trim()), data.member]);
      setInviteUserId("");
    } catch (e: any) {
      setError(e?.message || "invite failed");
    } finally {
      setInviting(false);
    }
  };

  const removeMember = async (userId: string) => {
    if (!selectedId) return;
    try {
      await fetch(apiUrl(`/api/qcoreai/workspaces/${selectedId}/members/${userId}`), { method: "DELETE", headers: bearerHeader() });
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    } catch { /* silent */ }
  };

  const removeSession = async (sessionId: string) => {
    if (!selectedId) return;
    try {
      await fetch(apiUrl(`/api/qcoreai/workspaces/${selectedId}/sessions/${sessionId}`), { method: "DELETE", headers: bearerHeader() });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch { /* silent */ }
  };

  const selected = workspaces.find((w) => w.id === selectedId);

  return (
    <main style={{ background: "#f8fafc", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
        {/* Header */}
        <div style={{ borderRadius: 20, overflow: "hidden", background: "linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#3730a3 100%)", color: "#fff", padding: "28px 28px 22px", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#0d9488,#06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 18 }}>W</div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.7, letterSpacing: "0.05em", textTransform: "uppercase" }}>QCoreAI</div>
              <h1 style={{ fontSize: 22, fontWeight: 900, margin: "2px 0 0", letterSpacing: "-0.02em" }}>Workspaces</h1>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <Link href="/qcoreai/multi" style={{ padding: "7px 14px", borderRadius: 8, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.25)", color: "#fff", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
                ← Multi-agent
              </Link>
              <button
                onClick={() => setCreateOpen((v) => !v)}
                style={{ padding: "7px 14px", borderRadius: 8, background: createOpen ? "rgba(34,211,238,0.25)" : "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                {createOpen ? "Cancel" : "+ New workspace"}
              </button>
            </div>
          </div>
        </div>

        {authMissing && (
          <div style={{ padding: 14, background: "#fef3c7", borderRadius: 10, color: "#78350f", fontSize: 13, marginBottom: 16 }}>
            Sign in to use workspaces. <Link href="/auth" style={{ color: "#9a3412", fontWeight: 700 }}>Sign in →</Link>
          </div>
        )}
        {error && <div style={{ padding: 10, background: "#fef2f2", borderRadius: 8, color: "#991b1b", fontSize: 13, marginBottom: 12 }}>{error}</div>}

        {createOpen && (
          <div style={{ padding: 16, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, marginBottom: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>New workspace</div>
            <input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="Workspace name *" style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, marginBottom: 8, boxSizing: "border-box" }} />
            <input value={createDesc} onChange={(e) => setCreateDesc(e.target.value)} placeholder="Description (optional)" style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, marginBottom: 10, boxSizing: "border-box" }} />
            <button onClick={createWorkspace} disabled={!createName.trim() || creating} style={{ padding: "8px 20px", borderRadius: 8, background: createName.trim() ? "#0e7490" : "#cbd5e1", border: "none", color: "#fff", fontWeight: 700, cursor: createName.trim() ? "pointer" : "default", fontSize: 13 }}>
              {creating ? "Creating…" : "Create"}
            </button>
          </div>
        )}

        {!authMissing && (
          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16, alignItems: "start" }}>
            {/* Workspace list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {loading ? (
                <div style={{ color: "#64748b", padding: 12 }}>Loading…</div>
              ) : workspaces.length === 0 ? (
                <div style={{ color: "#94a3b8", fontSize: 13, padding: 12, border: "2px dashed #e2e8f0", borderRadius: 8, textAlign: "center" }}>No workspaces yet.</div>
              ) : (
                workspaces.map((w) => (
                  <div key={w.id} style={{ display: "flex", gap: 4 }}>
                    <button
                      onClick={() => selectWorkspace(w.id)}
                      style={{ flex: 1, textAlign: "left", padding: "10px 12px", borderRadius: 10, border: `1px solid ${selectedId === w.id ? "#0e7490" : "#e2e8f0"}`, background: selectedId === w.id ? "rgba(6,182,212,0.06)" : "#fff", cursor: "pointer" }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{w.name}</div>
                      {w.description && <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{w.description}</div>}
                    </button>
                    <button onClick={() => deleteWorkspace(w.id)} title="Delete workspace" style={{ width: 28, borderRadius: 8, border: "1px solid transparent", background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: 14 }}>×</button>
                  </div>
                ))
              )}
            </div>

            {/* Workspace detail */}
            {selected ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 18 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a", marginBottom: 4 }}>{selected.name}</div>
                  {selected.description && <div style={{ fontSize: 13, color: "#64748b", marginBottom: 10 }}>{selected.description}</div>}

                  {/* Members */}
                  <div style={{ fontWeight: 700, fontSize: 12, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, marginTop: 12 }}>Members</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                    {members.map((m) => (
                      <div key={m.userId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{m.userId}</span>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: m.role === "owner" ? "#dbeafe" : m.role === "editor" ? "#d1fae5" : "#f1f5f9", color: m.role === "owner" ? "#1e40af" : m.role === "editor" ? "#065f46" : "#475569", fontWeight: 700 }}>{m.role}</span>
                        {m.role !== "owner" && (
                          <button onClick={() => removeMember(m.userId)} style={{ border: "none", background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>×</button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Invite */}
                  <div style={{ display: "flex", gap: 6 }}>
                    <input value={inviteUserId} onChange={(e) => setInviteUserId(e.target.value)} placeholder="User ID to invite" style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 12 }} />
                    <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as "editor" | "viewer")} style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 12 }}>
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                    </select>
                    <button onClick={inviteMember} disabled={!inviteUserId.trim() || inviting} style={{ padding: "6px 14px", borderRadius: 8, background: inviteUserId.trim() ? "#0e7490" : "#cbd5e1", border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: inviteUserId.trim() ? "pointer" : "default" }}>
                      {inviting ? "…" : "Invite"}
                    </button>
                  </div>
                </div>

                {/* Sessions */}
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 18 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Sessions in workspace</div>
                  {sessions.length === 0 ? (
                    <div style={{ color: "#94a3b8", fontSize: 13 }}>No sessions added yet. Use the ⊞ button in Multi-agent sidebar to add a session to this workspace.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {sessions.map((s) => (
                        <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                          <Link href={`/qcoreai/multi?session=${s.id}`} style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#0e7490", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {s.title || "(untitled)"}
                          </Link>
                          <span style={{ fontSize: 10, color: "#94a3b8" }}>{new Date(s.updatedAt).toLocaleDateString()}</span>
                          <button onClick={() => removeSession(s.id)} title="Remove from workspace" style={{ border: "none", background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ color: "#94a3b8", fontSize: 13, padding: 24, textAlign: "center" }}>Select a workspace to view details.</div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
