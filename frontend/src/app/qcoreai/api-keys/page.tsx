"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

/* ─── Types ─────────────────────────────────────────────────────────── */

type ApiKey = {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  callCount?: number;
  lastCallAt?: string | null;
};

/* ─── Helpers ────────────────────────────────────────────────────────── */

function bearerHeader(): HeadersInit {
  try {
    const t =
      typeof window !== "undefined"
        ? localStorage.getItem("aevion_auth_token_v1") ||
          localStorage.getItem("aevion_token") ||
          sessionStorage.getItem("aevion_token")
        : null;
    if (t) return { Authorization: `Bearer ${t}` };
  } catch {}
  return {};
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(iso);
}

function isExpiringSoon(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const diff = new Date(iso).getTime() - Date.now();
  return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
}

function isExpired(iso: string | null | undefined): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}

/* ─── Constants ──────────────────────────────────────────────────────── */

const EXPIRY_OPTIONS = [
  { label: "No expiry", value: 0 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
  { label: "365 days", value: 365 },
];

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: "7px 16px",
    borderRadius: 8,
    border: active ? "1px solid rgba(6,182,212,0.4)" : "1px solid rgba(255,255,255,0.07)",
    background: active ? "rgba(6,182,212,0.12)" : "rgba(255,255,255,0.04)",
    color: active ? "#67e8f9" : "#64748b",
    fontWeight: active ? 700 : 500,
    fontSize: 12,
    cursor: "pointer",
    textDecoration: "none",
  };
}

function keyRowStyle(last: boolean): React.CSSProperties {
  return {
    padding: "14px 20px",
    borderBottom: last ? "none" : "1px solid rgba(255,255,255,0.05)",
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  };
}

const S = {
  page: {
    background: "#0b0f1a",
    minHeight: "100vh",
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "#e2e8f0",
  },
  inner: { maxWidth: 820, margin: "0 auto", padding: "24px 16px 48px" },

  // Header card
  headerCard: {
    background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #0f2d3d 100%)",
    borderRadius: 16,
    padding: "24px 24px 20px",
    border: "1px solid rgba(99,102,241,0.25)",
    marginBottom: 20,
    boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
  },
  headerRow: { display: "flex", alignItems: "center", gap: 14, marginBottom: 10 },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: "linear-gradient(135deg, #0d9488, #06b6d4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    flexShrink: 0,
    boxShadow: "0 0 16px rgba(6,182,212,0.3)",
  },
  h1: { margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: "-0.02em", color: "#f1f5f9" },
  subtitle: { margin: "2px 0 0", fontSize: 12, color: "rgba(226,232,240,0.6)" },
  backBtn: {
    marginLeft: "auto",
    padding: "7px 14px",
    borderRadius: 8,
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#94a3b8",
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: "nowrap" as const,
    flexShrink: 0,
  },
  headerNote: {
    margin: 0,
    fontSize: 12,
    color: "rgba(226,232,240,0.55)",
    lineHeight: 1.6,
  },
  codePill: {
    background: "rgba(255,255,255,0.1)",
    padding: "1px 6px",
    borderRadius: 5,
    fontFamily: "monospace",
    fontSize: 11,
  },

  // Navigation tabs
  tabBar: { display: "flex", gap: 4, marginBottom: 20 },

  // One-time reveal
  revealBox: {
    background: "rgba(234,179,8,0.06)",
    border: "2px solid rgba(234,179,8,0.4)",
    borderRadius: 12,
    padding: "16px 18px",
    marginBottom: 20,
  },
  revealTitle: { fontWeight: 800, fontSize: 13, color: "#fef08a", marginBottom: 10 },
  revealRow: { display: "flex", gap: 8, alignItems: "center" },
  keyCode: {
    flex: 1,
    padding: "10px 14px",
    borderRadius: 8,
    background: "#1e1b4b",
    color: "#a5f3fc",
    fontSize: 12,
    fontFamily: "monospace",
    wordBreak: "break-all" as const,
    lineHeight: 1.5,
    border: "1px solid rgba(99,102,241,0.3)",
  },

  // Create form
  formCard: {
    background: "rgba(15,23,42,0.8)",
    borderRadius: 12,
    padding: "18px 20px",
    border: "1px solid rgba(255,255,255,0.08)",
    marginBottom: 20,
    backdropFilter: "blur(8px)",
  },
  formTitle: { fontWeight: 800, fontSize: 14, color: "#f1f5f9", marginBottom: 14 },
  formRow: { display: "flex", gap: 8, flexWrap: "wrap" as const },
  input: {
    flex: 1,
    minWidth: 200,
    padding: "9px 12px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.05)",
    color: "#e2e8f0",
    fontSize: 13,
    outline: "none",
  },
  select: {
    padding: "9px 12px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.05)",
    color: "#e2e8f0",
    fontSize: 13,
    cursor: "pointer",
  },

  // Key list
  listCard: {
    background: "rgba(15,23,42,0.8)",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.08)",
    overflow: "hidden",
    backdropFilter: "blur(8px)",
  },
  listHeader: {
    padding: "12px 20px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    fontWeight: 800,
    fontSize: 13,
    color: "#f1f5f9",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  listEmpty: { padding: "36px 20px", textAlign: "center" as const, color: "#475569", fontSize: 13 },
  listError: { padding: "16px 20px", color: "#f87171", fontSize: 12 },

  keyIcon: {
    width: 38,
    height: 38,
    borderRadius: 9,
    background: "linear-gradient(135deg, #1e1b4b, #312e81)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    color: "#a5f3fc",
    fontFamily: "monospace",
    fontWeight: 800,
    flexShrink: 0,
    border: "1px solid rgba(99,102,241,0.3)",
    letterSpacing: "-0.05em",
  },
  keyMeta: { flex: 1, minWidth: 160 },
  keyName: { fontWeight: 700, fontSize: 13, color: "#f1f5f9" },
  keyDetail: { fontSize: 11, color: "#64748b", marginTop: 3 },
  prefixCode: {
    background: "rgba(255,255,255,0.07)",
    padding: "1px 5px",
    borderRadius: 4,
    fontSize: 10,
    fontFamily: "monospace",
    color: "#94a3b8",
  },
  statGroup: { display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" as const },
  stat: { textAlign: "right" as const, minWidth: 72 },
  statLabel: { fontSize: 10, color: "#475569", textTransform: "uppercase" as const, letterSpacing: "0.04em" },
  statVal: { fontSize: 12, fontWeight: 700, color: "#e2e8f0", marginTop: 1 },

  // Badges
  badgeExpiring: {
    background: "rgba(245,158,11,0.12)",
    border: "1px solid rgba(245,158,11,0.3)",
    borderRadius: 5,
    padding: "2px 7px",
    fontSize: 10,
    fontWeight: 700,
    color: "#fbbf24",
  },
  badgeExpired: {
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.25)",
    borderRadius: 5,
    padding: "2px 7px",
    fontSize: 10,
    fontWeight: 700,
    color: "#f87171",
  },

  // Hint
  hint: {
    marginTop: 16,
    padding: "12px 16px",
    borderRadius: 10,
    background: "rgba(13,148,136,0.07)",
    border: "1px solid rgba(13,148,136,0.2)",
    fontSize: 12,
    color: "#5eead4",
    lineHeight: 1.6,
  },
};

/* ─── Page ───────────────────────────────────────────────────────────── */

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(0);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/qcoreai/me/api-keys"), {
        headers: bearerHeader(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setKeys(Array.isArray(data.items) ? data.items : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreate = async () => {
    if (!newName.trim() || creating) return;
    setCreating(true);
    setNewKey(null);
    setCreateError(null);
    try {
      const body: Record<string, unknown> = { name: newName.trim() };
      if (expiresInDays > 0) body.expiresInDays = expiresInDays;
      const res = await fetch(apiUrl("/api/qcoreai/me/api-keys"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setNewKey(data.key);
      setNewName("");
      setExpiresInDays(0);
      await fetchKeys();
    } catch (e: any) {
      setCreateError(e?.message || "Failed to create API key");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this API key? This action cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(apiUrl(`/api/qcoreai/me/api-keys/${encodeURIComponent(id)}`), {
        method: "DELETE",
        headers: bearerHeader(),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || `HTTP ${res.status}`);
      }
      setKeys((prev) => prev.filter((k) => k.id !== id));
      if (newKey) setNewKey(null);
    } catch (e: any) {
      alert(e?.message || "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopy = async () => {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("Copy failed — please select and copy manually.");
    }
  };

  const activeKeys = keys.filter((k) => !isExpired(k.expiresAt));
  const expiredKeys = keys.filter((k) => isExpired(k.expiresAt));

  return (
    <div style={S.page}>
      <Wave1Nav />
      <div style={S.inner}>
        {/* ── Header ── */}
        <div style={S.headerCard}>
          <div style={S.headerRow}>
            <div style={S.iconBox}>&#128273;</div>
            <div>
              <h1 style={S.h1}>API Keys</h1>
              <p style={S.subtitle}>Personal access tokens for programmatic access to QCoreAI</p>
            </div>
            <Link href="/qcoreai/multi" style={S.backBtn}>
              &#8592; Back to QCoreAI
            </Link>
          </div>
          <p style={S.headerNote}>
            Keys are prefixed with <code style={S.codePill}>qck_</code> and authenticated via the{" "}
            <code style={S.codePill}>X-QCore-Key</code> header. The raw key is shown{" "}
            <strong style={{ color: "#fef08a" }}>only once</strong> — copy it now and store it safely.
          </p>
        </div>

        {/* ── Nav tabs ── */}
        <div style={S.tabBar}>
          <span style={tabStyle(true)}>&#128273; API Keys</span>
          <Link href="/qcoreai/webhooks" style={tabStyle(false)}>
            &#128161; Webhooks
          </Link>
          <Link href="/qcoreai/settings" style={tabStyle(false)}>
            &#9881;&#65039; Settings
          </Link>
          <Link href="/qcoreai/audit-log" style={tabStyle(false)}>
            &#128202; Audit Log
          </Link>
        </div>

        {/* ── New key reveal ── */}
        {newKey && (
          <div style={S.revealBox}>
            <div style={S.revealTitle}>
              &#9888;&#65039; Your new API key — copy it now. It will NOT be shown again.
            </div>
            <div style={S.revealRow}>
              <code style={S.keyCode}>{newKey}</code>
              <button
                onClick={handleCopy}
                style={{
                  padding: "10px 18px",
                  borderRadius: 8,
                  background: copied ? "rgba(16,185,129,0.2)" : "rgba(6,182,212,0.15)",
                  border: copied ? "1px solid rgba(16,185,129,0.4)" : "1px solid rgba(6,182,212,0.35)",
                  color: copied ? "#34d399" : "#67e8f9",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                onClick={() => setNewKey(null)}
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#64748b",
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* ── Create form ── */}
        <div style={S.formCard}>
          <div style={S.formTitle}>Generate new key</div>
          {createError && (
            <div style={{ marginBottom: 10, fontSize: 12, color: "#f87171" }}>{createError}</div>
          )}
          <div style={S.formRow}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Key name (e.g. My Script, CI/CD Pipeline)"
              style={S.input}
            />
            <select
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(Number(e.target.value))}
              style={S.select}
            >
              {EXPIRY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
              style={{
                padding: "9px 22px",
                borderRadius: 8,
                background:
                  newName.trim() && !creating
                    ? "linear-gradient(135deg, #0d9488, #06b6d4)"
                    : "rgba(255,255,255,0.07)",
                border: "none",
                color: newName.trim() && !creating ? "#fff" : "#475569",
                fontWeight: 700,
                fontSize: 13,
                cursor: newName.trim() && !creating ? "pointer" : "default",
                whiteSpace: "nowrap",
                boxShadow: newName.trim() && !creating ? "0 0 12px rgba(6,182,212,0.25)" : "none",
              }}
            >
              {creating ? "Generating..." : "Generate"}
            </button>
          </div>
        </div>

        {/* ── Key list ── */}
        <div style={S.listCard}>
          <div style={S.listHeader}>
            <span>Active keys</span>
            {!loading && (
              <span
                style={{
                  background: "rgba(6,182,212,0.12)",
                  border: "1px solid rgba(6,182,212,0.25)",
                  borderRadius: 6,
                  padding: "1px 8px",
                  fontSize: 11,
                  color: "#67e8f9",
                  fontWeight: 700,
                }}
              >
                {activeKeys.length}
              </span>
            )}
            <button
              onClick={fetchKeys}
              style={{
                marginLeft: "auto",
                background: "none",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 6,
                color: "#475569",
                fontSize: 11,
                padding: "3px 10px",
                cursor: "pointer",
              }}
            >
              Refresh
            </button>
          </div>

          {loading && (
            <div style={{ padding: "32px 20px", textAlign: "center", color: "#475569", fontSize: 13 }}>
              Loading...
            </div>
          )}

          {error && (
            <div style={S.listError}>
              {error} — are you logged in?{" "}
              <button
                onClick={fetchKeys}
                style={{ background: "none", border: "none", color: "#7c3aed", cursor: "pointer", fontSize: 12, textDecoration: "underline" }}
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && activeKeys.length === 0 && (
            <div style={S.listEmpty}>
              No active API keys yet. Generate one above.
            </div>
          )}

          {!loading &&
            activeKeys.map((k, i) => (
              <div key={k.id} style={keyRowStyle(i === activeKeys.length - 1 && expiredKeys.length === 0)}>
                <div style={S.keyIcon}>{k.keyPrefix.slice(4, 8) || k.keyPrefix.slice(0, 4)}</div>
                <div style={S.keyMeta}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={S.keyName}>{k.name}</span>
                    {isExpiringSoon(k.expiresAt) && (
                      <span style={S.badgeExpiring}>Expiring soon</span>
                    )}
                  </div>
                  <div style={S.keyDetail}>
                    <code style={S.prefixCode}>{k.keyPrefix}...</code>
                    {" "}&#183;{" "}Created {fmtDate(k.createdAt)}
                  </div>
                </div>

                <div style={S.statGroup}>
                  {/* Usage count */}
                  {typeof k.callCount === "number" && (
                    <div style={S.stat}>
                      <div style={S.statLabel}>Calls</div>
                      <div style={{ ...S.statVal, color: k.callCount > 0 ? "#67e8f9" : "#475569" }}>
                        {k.callCount.toLocaleString()}
                      </div>
                    </div>
                  )}

                  {/* Last used */}
                  <div style={S.stat}>
                    <div style={S.statLabel}>Last used</div>
                    <div style={{ ...S.statVal, fontSize: 11 }}>
                      {fmtRelative(k.lastUsedAt || k.lastCallAt)}
                    </div>
                  </div>

                  {/* Expires */}
                  <div style={S.stat}>
                    <div style={S.statLabel}>Expires</div>
                    <div
                      style={{
                        ...S.statVal,
                        fontSize: 11,
                        color: isExpiringSoon(k.expiresAt) ? "#fbbf24" : "#475569",
                      }}
                    >
                      {k.expiresAt ? fmtDate(k.expiresAt) : "Never"}
                    </div>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(k.id)}
                    disabled={deletingId === k.id}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 7,
                      border: "1px solid rgba(239,68,68,0.25)",
                      background: "rgba(239,68,68,0.06)",
                      color: deletingId === k.id ? "#475569" : "#f87171",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: deletingId === k.id ? "default" : "pointer",
                    }}
                  >
                    {deletingId === k.id ? "Deleting..." : "Revoke"}
                  </button>
                </div>
              </div>
            ))}

          {/* Expired keys section */}
          {!loading && expiredKeys.length > 0 && (
            <>
              <div
                style={{
                  padding: "10px 20px",
                  borderTop: "1px solid rgba(255,255,255,0.05)",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#475569",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                Expired ({expiredKeys.length})
              </div>
              {expiredKeys.map((k, i) => (
                <div
                  key={k.id}
                  style={{
                    ...keyRowStyle(i === expiredKeys.length - 1),
                    opacity: 0.5,
                  }}
                >
                  <div style={{ ...S.keyIcon, filter: "grayscale(1)" }}>
                    {k.keyPrefix.slice(4, 8) || k.keyPrefix.slice(0, 4)}
                  </div>
                  <div style={S.keyMeta}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ ...S.keyName, color: "#64748b" }}>{k.name}</span>
                      <span style={S.badgeExpired}>Expired</span>
                    </div>
                    <div style={S.keyDetail}>
                      <code style={S.prefixCode}>{k.keyPrefix}...</code>
                      {" "}&#183;{" "}Expired {fmtDate(k.expiresAt)}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(k.id)}
                    disabled={deletingId === k.id}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 7,
                      border: "1px solid rgba(239,68,68,0.2)",
                      background: "rgba(239,68,68,0.05)",
                      color: "#ef4444",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </>
          )}
        </div>

        {/* ── Usage hint ── */}
        <div style={S.hint}>
          <strong>Usage:</strong> pass{" "}
          <code style={{ background: "rgba(13,148,136,0.15)", padding: "1px 6px", borderRadius: 4, fontFamily: "monospace", fontSize: 11 }}>
            X-QCore-Key: qck_...
          </code>{" "}
          header in your API requests.{" "}
          <Link href="/qcoreai/docs" style={{ color: "#2dd4bf", fontWeight: 700 }}>
            See API Docs
          </Link>{" "}
          for full reference. Need event-driven integrations?{" "}
          <Link href="/qcoreai/webhooks" style={{ color: "#2dd4bf", fontWeight: 700 }}>
            Configure Webhooks
          </Link>
          .
        </div>
      </div>
    </div>
  );
}
