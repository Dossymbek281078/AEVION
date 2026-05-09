"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";

type Org = { id: string; name: string; ownerId: string; plan: string; memberLimit: number; createdAt: string };
type Member = { orgId: string; userId: string; role: string; joinedAt: string };

function bearerHeader(): HeadersInit {
  try {
    const t = typeof window !== "undefined" ? localStorage.getItem("aevion_auth_token_v1") : null;
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch { return {}; }
}

export default function OrgsPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [authMissing, setAuthMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);

  const [inviteUserId, setInviteUserId] = useState("");
  const [inviting, setInviting] = useState(false);

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    try {
      const h = bearerHeader();
      if (!("Authorization" in h)) { setAuthMissing(true); setLoading(false); return; }
      const r = await fetch(apiUrl("/api/qcoreai/orgs"), { headers: h });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
      setOrgs(data.items || []);
    } catch (e: any) {
      setError(e?.message || "fetch failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrgs(); }, [fetchOrgs]);

  const selectOrg = useCallback(async (id: string) => {
    setSelectedId(id);
    setInviteUserId("");
    try {
      const h = bearerHeader();
      const r = await fetch(apiUrl(`/api/qcoreai/orgs/${id}/members`), { headers: h });
      const data = await r.json().catch(() => ({}));
      setMembers(data.members || []);
    } catch { /* silent */ }
  }, []);

  const createOrg = async () => {
    if (!createName.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      const r = await fetch(apiUrl("/api/qcoreai/orgs"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify({ name: createName.trim() }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
      setCreateName("");
      await fetchOrgs();
      selectOrg(data.org.id);
    } catch (e: any) {
      setError(e?.message || "create failed");
    } finally {
      setCreating(false);
    }
  };

  const deleteOrg = async (id: string) => {
    if (!confirm("Delete this organization?")) return;
    try {
      const r = await fetch(apiUrl(`/api/qcoreai/orgs/${id}`), { method: "DELETE", headers: bearerHeader() });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d?.error || `HTTP ${r.status}`); }
      if (selectedId === id) { setSelectedId(null); setMembers([]); }
      await fetchOrgs();
    } catch (e: any) { setError(e?.message || "delete failed"); }
  };

  const addMember = async () => {
    if (!selectedId || !inviteUserId.trim() || inviting) return;
    setInviting(true);
    setError(null);
    try {
      const r = await fetch(apiUrl(`/api/qcoreai/orgs/${selectedId}/members`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify({ userId: inviteUserId.trim() }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
      setInviteUserId("");
      await selectOrg(selectedId);
    } catch (e: any) {
      setError(e?.message || "add member failed");
    } finally {
      setInviting(false);
    }
  };

  const removeMember = async (userId: string) => {
    if (!selectedId) return;
    try {
      const r = await fetch(apiUrl(`/api/qcoreai/orgs/${selectedId}/members/${encodeURIComponent(userId)}`), {
        method: "DELETE",
        headers: bearerHeader(),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d?.error || `HTTP ${r.status}`); }
      await selectOrg(selectedId);
    } catch (e: any) { setError(e?.message || "remove failed"); }
  };

  const selectedOrg = orgs.find((o) => o.id === selectedId);

  const card: React.CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 20px", marginBottom: 12 };
  const btn = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, ...extra,
  });

  if (authMissing) return (
    <div style={{ padding: 40, fontFamily: "sans-serif" }}>
      <Link href="/qcoreai" style={{ color: "#4f46e5", fontSize: 13 }}>← Back to QCoreAI</Link>
      <p style={{ marginTop: 20, color: "#6b7280" }}>Sign in to manage organizations.</p>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <Link href="/qcoreai" style={{ color: "#4f46e5", fontSize: 13, textDecoration: "none" }}>← QCoreAI</Link>
          <span style={{ color: "#d1d5db" }}>/</span>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#111827" }}>Organizations</h1>
        </div>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "#dc2626", fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20 }}>
          {/* Left: org list + create */}
          <div>
            <div style={{ ...card }}>
              <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                My Organizations
              </p>
              {loading ? (
                <p style={{ margin: 0, color: "#9ca3af", fontSize: 13 }}>Loading…</p>
              ) : orgs.length === 0 ? (
                <p style={{ margin: 0, color: "#9ca3af", fontSize: 13 }}>No organizations yet.</p>
              ) : (
                orgs.map((org) => (
                  <div
                    key={org.id}
                    onClick={() => selectOrg(org.id)}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "8px 10px", borderRadius: 7, cursor: "pointer", marginBottom: 4,
                      background: selectedId === org.id ? "#ede9fe" : "transparent",
                      border: selectedId === org.id ? "1px solid #c4b5fd" : "1px solid transparent",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{org.name}</div>
                      <div style={{ fontSize: 11, color: "#9ca3af" }}>{org.plan}</div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteOrg(org.id); }}
                      style={btn({ background: "transparent", color: "#ef4444", padding: "2px 6px", fontSize: 11 })}
                      title="Delete org"
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Create form */}
            <div style={{ ...card }}>
              <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                New Organization
              </p>
              <input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") createOrg(); }}
                placeholder="Organization name"
                style={{ width: "100%", padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, boxSizing: "border-box", marginBottom: 8 }}
              />
              <button
                onClick={createOrg}
                disabled={creating || !createName.trim()}
                style={btn({ background: creating || !createName.trim() ? "#e5e7eb" : "#4f46e5", color: creating || !createName.trim() ? "#9ca3af" : "#fff", width: "100%" })}
              >
                {creating ? "Creating…" : "Create Organization"}
              </button>
            </div>
          </div>

          {/* Right: org detail */}
          <div>
            {!selectedOrg ? (
              <div style={{ ...card, color: "#9ca3af", fontSize: 14, textAlign: "center", padding: 40 }}>
                Select an organization to manage members.
              </div>
            ) : (
              <div style={{ ...card }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                  <div>
                    <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: "#111827" }}>{selectedOrg.name}</h2>
                    <span style={{ fontSize: 11, background: "#f3f4f6", color: "#6b7280", padding: "2px 8px", borderRadius: 12 }}>
                      {selectedOrg.plan} · up to {selectedOrg.memberLimit} members
                    </span>
                  </div>
                </div>

                {/* Members list */}
                <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Members ({members.length})
                </p>
                {members.length === 0 ? (
                  <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 16 }}>No members yet — invite someone below.</p>
                ) : (
                  <div style={{ marginBottom: 16 }}>
                    {members.map((m) => (
                      <div key={m.userId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#f9fafb", borderRadius: 7, marginBottom: 6, border: "1px solid #e5e7eb" }}>
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{m.userId}</span>
                          <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 8 }}>{m.role}</span>
                        </div>
                        <button
                          onClick={() => removeMember(m.userId)}
                          style={btn({ background: "#fef2f2", color: "#dc2626", fontSize: 11 })}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add member */}
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={inviteUserId}
                    onChange={(e) => setInviteUserId(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addMember(); }}
                    placeholder="User ID to add"
                    style={{ flex: 1, padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 }}
                  />
                  <button
                    onClick={addMember}
                    disabled={inviting || !inviteUserId.trim()}
                    style={btn({ background: inviting || !inviteUserId.trim() ? "#e5e7eb" : "#10b981", color: inviting || !inviteUserId.trim() ? "#9ca3af" : "#fff" })}
                  >
                    {inviting ? "Adding…" : "Add Member"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
