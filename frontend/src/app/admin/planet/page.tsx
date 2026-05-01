"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";
import { useI18n } from "@/lib/i18n";
import {
  ADMIN_REVOKE_REASON_CODES,
  revokeReasonLabel,
} from "@/lib/qrightRevokeReasons";

const TOKEN_KEY = "aevion_auth_token_v1";

type AdminCert = {
  id: string;
  ownerId: string;
  status: string;
  createdAt: string;
  revokedAt: string | null;
  revokeReason: string | null;
  revokeReasonCode: string | null;
  revokedBy: string | null;
  embedFetches: number;
  lastFetchedAt: string | null;
  artifactVersionId: string | null;
  artifactType: string | null;
  versionNo: number | null;
  submissionTitle: string | null;
};

const card: CSSProperties = {
  border: "1px solid rgba(15,23,42,0.1)",
  borderRadius: 14,
  padding: 16,
  background: "#fff",
};

const labelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

export default function AdminPlanetPage() {
  const { showToast } = useToast();
  const { lang } = useI18n();
  const [hasToken, setHasToken] = useState(false);
  const [whoami, setWhoami] = useState<{ isAdmin: boolean; email: string | null } | null>(null);
  const [items, setItems] = useState<AdminCert[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "revoked">("all");
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<AdminCert | null>(null);
  const [code, setCode] = useState<string>("admin-takedown");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkCode, setBulkCode] = useState<string>("admin-takedown");
  const [bulkReason, setBulkReason] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [csvBusy, setCsvBusy] = useState(false);
  const [audit, setAudit] = useState<
    {
      id: string;
      actor: string | null;
      action: string;
      targetId: string | null;
      payload: Record<string, unknown> | null;
      at: string;
    }[]
  >([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [sources, setSources] = useState<{
    days: number;
    uniqueHosts: number;
    totalFetches: number;
    hosts: { host: string; totalFetches: number; uniqueCertificates: number }[];
  } | null>(null);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [sourcesDays, setSourcesDays] = useState<7 | 30 | 90>(30);

  const authHeaders = useCallback((): HeadersInit => {
    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      return raw ? { Authorization: `Bearer ${raw}` } : {};
    } catch {
      return {};
    }
  }, []);

  useEffect(() => {
    try {
      setHasToken(!!localStorage.getItem(TOKEN_KEY));
    } catch {}
  }, []);

  useEffect(() => {
    if (!hasToken) {
      setWhoami({ isAdmin: false, email: null });
      return;
    }
    fetch(apiUrl("/api/planet/admin/whoami"), { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => setWhoami({ isAdmin: !!data.isAdmin, email: data.email || null }))
      .catch(() => setWhoami({ isAdmin: false, email: null }));
  }, [hasToken, authHeaders]);

  const load = useCallback(async () => {
    if (!whoami?.isAdmin) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (q.trim().length >= 2) params.set("q", q.trim());
      const r = await fetch(apiUrl(`/api/planet/admin/certificates?${params.toString()}`), {
        headers: authHeaders(),
      });
      if (r.ok) {
        const data = await r.json();
        setItems(data.items || []);
        setSelected(new Set());
      } else {
        showToast(`Load failed (${r.status})`, "error");
      }
    } catch (e) {
      showToast(`Load failed: ${(e as Error).message}`, "error");
    } finally {
      setLoading(false);
    }
  }, [whoami, statusFilter, q, authHeaders, showToast]);

  useEffect(() => {
    if (whoami?.isAdmin) load();
  }, [whoami, statusFilter, load]);

  const loadAudit = useCallback(async () => {
    if (!whoami?.isAdmin) return;
    setAuditLoading(true);
    try {
      const r = await fetch(apiUrl("/api/planet/admin/audit?limit=50"), {
        headers: authHeaders(),
      });
      if (r.ok) {
        const data = await r.json();
        setAudit(data.items || []);
      }
    } catch {
      /* silent */
    } finally {
      setAuditLoading(false);
    }
  }, [whoami, authHeaders]);

  useEffect(() => {
    if (whoami?.isAdmin) loadAudit();
  }, [whoami, loadAudit]);

  const loadSources = useCallback(async () => {
    if (!whoami?.isAdmin) return;
    setSourcesLoading(true);
    try {
      const r = await fetch(
        apiUrl(`/api/planet/admin/sources?days=${sourcesDays}&limit=50`),
        { headers: authHeaders() }
      );
      if (r.ok) {
        const data = await r.json();
        setSources({
          days: data.days,
          uniqueHosts: data.uniqueHosts || 0,
          totalFetches: data.totalFetches || 0,
          hosts: data.hosts || [],
        });
      }
    } catch {
      /* silent */
    } finally {
      setSourcesLoading(false);
    }
  }, [whoami, authHeaders, sourcesDays]);

  useEffect(() => {
    if (whoami?.isAdmin) loadSources();
  }, [whoami, loadSources]);

  const downloadCsv = async () => {
    setCsvBusy(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (q.trim().length >= 2) params.set("q", q.trim());
      const r = await fetch(apiUrl(`/api/planet/admin/certificates.csv?${params}`), {
        headers: authHeaders(),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `planet-certificates-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      showToast(`CSV failed: ${(e as Error).message}`, "error");
    } finally {
      setCsvBusy(false);
    }
  };

  const submit = async () => {
    if (!target) return;
    setBusy(true);
    try {
      const r = await fetch(
        apiUrl(`/api/planet/admin/certificates/${encodeURIComponent(target.id)}/revoke`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ reasonCode: code, reason: reason.trim() || undefined }),
        }
      );
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        showToast("Force-revoked.", "success");
        setTarget(null);
        setReason("");
        load();
        loadAudit();
      } else {
        showToast(`Revoke failed: ${data.error || r.status}`, "error");
      }
    } catch (e) {
      showToast(`Revoke failed: ${(e as Error).message}`, "error");
    } finally {
      setBusy(false);
    }
  };

  const submitBulk = async () => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    try {
      const ids = Array.from(selected);
      const r = await fetch(apiUrl("/api/planet/admin/certificates/revoke-bulk"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          ids,
          reasonCode: bulkCode,
          reason: bulkReason.trim() || undefined,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        const revN = Array.isArray(data.revoked) ? data.revoked.length : 0;
        const alrN = Array.isArray(data.alreadyRevoked) ? data.alreadyRevoked.length : 0;
        const missN = Array.isArray(data.notFound) ? data.notFound.length : 0;
        const parts = [`${revN} revoked`];
        if (alrN) parts.push(`${alrN} already`);
        if (missN) parts.push(`${missN} not found`);
        showToast(`Bulk: ${parts.join(", ")}`, revN > 0 ? "success" : "info");
        setBulkOpen(false);
        setBulkReason("");
        load();
        loadAudit();
      } else {
        showToast(`Bulk revoke failed: ${data.error || r.status}`, "error");
      }
    } catch (e) {
      showToast(`Bulk revoke failed: ${(e as Error).message}`, "error");
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", background: "#f7f8fa" }}>
      <Wave1Nav />
      <ProductPageShell>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 16px" }}>
          <div style={{ marginBottom: 16 }}>
            <Link
              href="/planet"
              style={{ fontSize: 12, fontWeight: 700, color: "#0d9488", textDecoration: "none" }}
            >
              ← AEVION Planet
            </Link>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "#0f172a", margin: 0 }}>
            Planet certificate admin
          </h1>
          <p style={{ color: "#475569", fontSize: 13, marginTop: 6, marginBottom: 24 }}>
            Audit registry and force-revoke. Visible only to AEVION admins.
          </p>

          {!hasToken && (
            <div style={{ ...card, color: "#854d0e", borderColor: "rgba(234,179,8,0.4)" }}>
              Sign in via Auth — this page requires a Bearer token.
            </div>
          )}
          {hasToken && whoami && !whoami.isAdmin && (
            <div style={{ ...card, color: "#b91c1c", borderColor: "rgba(185,28,28,0.2)" }}>
              You are signed in as <strong>{whoami.email || "—"}</strong>, but not an admin. Set
              <code style={{ margin: "0 4px" }}>PLANET_ADMIN_EMAILS</code> on the backend to grant access.
            </div>
          )}

          {whoami?.isAdmin && (
            <>
              {/* Filters */}
              <div style={{ ...card, marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 4 }}>
                  {(["all", "active", "revoked"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 6,
                        border: "1px solid rgba(15,23,42,0.15)",
                        background: statusFilter === s ? "#0f172a" : "#fff",
                        color: statusFilter === s ? "#fff" : "#475569",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        textTransform: "capitalize",
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <input
                  type="search"
                  placeholder="Search title or id (≥2 chars)"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && load()}
                  style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(15,23,42,0.15)", fontSize: 12 }}
                />
                <button
                  onClick={load}
                  disabled={loading}
                  style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid rgba(15,23,42,0.15)", background: "#fff", color: "#0f172a", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                >
                  {loading ? "Loading…" : "Reload"}
                </button>
                <button
                  onClick={downloadCsv}
                  disabled={csvBusy}
                  style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid rgba(13,148,136,0.4)", background: "#fff", color: "#0d9488", fontSize: 11, fontWeight: 700, cursor: csvBusy ? "not-allowed" : "pointer" }}
                >
                  {csvBusy ? "Exporting…" : "Export CSV"}
                </button>
              </div>

              {/* Bulk bar */}
              {selected.size > 0 && (
                <div style={{ position: "sticky", top: 8, zIndex: 5, ...card, marginBottom: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, background: "#fef3c7", borderColor: "rgba(217,119,6,0.4)" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#92400e" }}>
                    {selected.size} selected
                  </span>
                  <button
                    onClick={() => setSelected(new Set())}
                    style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(146,64,14,0.4)", background: "#fff", color: "#92400e", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                  >
                    Clear
                  </button>
                  <div style={{ flex: 1 }} />
                  <button
                    onClick={() => setBulkOpen(true)}
                    style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#dc2626", color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer" }}
                  >
                    Force-revoke {selected.size}
                  </button>
                </div>
              )}

              {/* Cert list */}
              {items.length === 0 ? (
                <div style={{ ...card, textAlign: "center", color: "#94a3b8" }}>
                  {loading ? "Loading…" : "No certificates."}
                </div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {items.map((c) => {
                    const isRevoked = !!c.revokedAt;
                    return (
                      <div
                        key={c.id}
                        style={{
                          ...card,
                          borderColor: isRevoked ? "rgba(220,38,38,0.3)" : "rgba(15,23,42,0.1)",
                          background: isRevoked ? "rgba(254,242,242,0.5)" : "#fff",
                          padding: "12px 14px",
                          display: "grid",
                          gridTemplateColumns: "auto 1fr auto",
                          gap: 12,
                          alignItems: "center",
                        }}
                      >
                        <input
                          type="checkbox"
                          disabled={isRevoked}
                          checked={selected.has(c.id)}
                          onChange={(e) => {
                            const next = new Set(selected);
                            if (e.target.checked) next.add(c.id);
                            else next.delete(c.id);
                            setSelected(next);
                          }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <span style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
                              {c.submissionTitle || "(untitled)"}
                            </span>
                            {c.artifactType && (
                              <span style={{ padding: "2px 6px", borderRadius: 4, background: "rgba(13,148,136,0.1)", color: "#0d9488", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>
                                {c.artifactType}
                              </span>
                            )}
                            {isRevoked && (
                              <span style={{ padding: "2px 6px", borderRadius: 4, background: "rgba(220,38,38,0.12)", color: "#dc2626", fontSize: 10, fontWeight: 800 }}>
                                REVOKED
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: "#64748b", marginTop: 4, fontFamily: "monospace", wordBreak: "break-all" }}>
                            {c.id}
                          </div>
                          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
                            owner: {c.ownerId.slice(0, 8)}… · created {new Date(c.createdAt).toLocaleDateString()} · {c.embedFetches} fetches
                          </div>
                          {isRevoked && c.revokeReasonCode && (
                            <div style={{ fontSize: 10, color: "#dc2626", marginTop: 2 }}>
                              {revokeReasonLabel(c.revokeReasonCode, lang)}
                              {c.revokeReason ? ` — ${c.revokeReason}` : ""}
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          {c.artifactVersionId && (
                            <Link
                              href={`/planet/artifact/${c.artifactVersionId}`}
                              target="_blank"
                              style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid rgba(15,23,42,0.15)", background: "#fff", color: "#475569", fontSize: 11, fontWeight: 700, textDecoration: "none" }}
                            >
                              View →
                            </Link>
                          )}
                          {!isRevoked && (
                            <button
                              onClick={() => setTarget(c)}
                              style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "#dc2626", color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer" }}
                            >
                              Force-revoke
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Sources */}
              <div style={{ marginTop: 28, marginBottom: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <h2 style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", margin: 0 }}>
                  Top embed sources
                </h2>
                <span style={{ fontSize: 11, color: "#94a3b8" }}>
                  {sources
                    ? `${sources.uniqueHosts} hosts · ${sources.totalFetches.toLocaleString()} fetches in last ${sources.days}d`
                    : "Aggregated across all certificates"}
                </span>
                <div style={{ flex: 1 }} />
                <div style={{ display: "flex", gap: 4 }}>
                  {([7, 30, 90] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setSourcesDays(d)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: "1px solid rgba(15,23,42,0.15)",
                        background: sourcesDays === d ? "#0f172a" : "#fff",
                        color: sourcesDays === d ? "#fff" : "#475569",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
                <button
                  onClick={loadSources}
                  disabled={sourcesLoading}
                  style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(15,23,42,0.15)", background: "#fff", color: "#475569", fontSize: 11, fontWeight: 700, cursor: sourcesLoading ? "not-allowed" : "pointer" }}
                >
                  {sourcesLoading ? "Loading…" : "Refresh"}
                </button>
              </div>
              {!sources || sources.hosts.length === 0 ? (
                <div style={{ ...card, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>
                  {sourcesLoading ? "Loading…" : "No fetch sources tracked yet."}
                </div>
              ) : (
                <div style={{ ...card, padding: 0, overflow: "hidden" }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 120px 100px",
                      padding: "10px 14px",
                      fontSize: 10,
                      fontWeight: 800,
                      color: "#64748b",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderBottom: "1px solid rgba(15,23,42,0.08)",
                      background: "#f8fafc",
                    }}
                  >
                    <div>Source host</div>
                    <div style={{ textAlign: "right" }}>Fetches</div>
                    <div style={{ textAlign: "right" }}>Certs</div>
                  </div>
                  {sources.hosts.map((row) => {
                    const isDirect = row.host === "(direct)";
                    return (
                      <div
                        key={row.host}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 120px 100px",
                          padding: "8px 14px",
                          fontSize: 12,
                          alignItems: "center",
                          borderBottom: "1px solid rgba(15,23,42,0.04)",
                        }}
                      >
                        <div
                          style={{
                            fontFamily: "monospace",
                            color: isDirect ? "#94a3b8" : "#0d9488",
                            fontWeight: 700,
                            wordBreak: "break-all",
                          }}
                        >
                          {row.host}
                        </div>
                        <div style={{ textAlign: "right", fontWeight: 700, color: "#0f172a" }}>
                          {row.totalFetches.toLocaleString()}
                        </div>
                        <div style={{ textAlign: "right", color: "#475569" }}>
                          {row.uniqueCertificates}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Audit log */}
              <div style={{ marginTop: 28, marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
                <h2 style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", margin: 0 }}>
                  Audit log
                </h2>
                <span style={{ fontSize: 11, color: "#94a3b8" }}>
                  Last 50 privileged actions, newest first
                </span>
                <div style={{ flex: 1 }} />
                <button
                  onClick={loadAudit}
                  disabled={auditLoading}
                  style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(15,23,42,0.15)", background: "#fff", color: "#475569", fontSize: 11, fontWeight: 700, cursor: auditLoading ? "not-allowed" : "pointer" }}
                >
                  {auditLoading ? "Loading…" : "Refresh"}
                </button>
              </div>
              {audit.length === 0 ? (
                <div style={{ ...card, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>
                  {auditLoading ? "Loading…" : "No audit events yet."}
                </div>
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  {audit.map((row) => {
                    const isAdmin = row.action.startsWith("admin.");
                    return (
                      <div
                        key={row.id}
                        style={{
                          ...card,
                          padding: "10px 12px",
                          borderColor: isAdmin ? "rgba(220,38,38,0.2)" : "rgba(15,23,42,0.08)",
                          background: isAdmin ? "rgba(254,242,242,0.4)" : "#fff",
                        }}
                      >
                        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 11 }}>
                          <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 800, background: isAdmin ? "rgba(220,38,38,0.1)" : "rgba(13,148,136,0.1)", color: isAdmin ? "#dc2626" : "#0d9488", textTransform: "uppercase", fontFamily: "monospace" }}>
                            {row.action}
                          </span>
                          <span style={{ color: "#475569", fontWeight: 700 }}>{row.actor || "—"}</span>
                          {row.targetId && (
                            <span style={{ color: "#94a3b8", fontFamily: "monospace", fontSize: 10 }}>
                              {row.targetId.slice(0, 8)}…
                            </span>
                          )}
                          <span style={{ marginLeft: "auto", color: "#94a3b8" }}>
                            {new Date(row.at).toLocaleString()}
                          </span>
                        </div>
                        {row.payload && Object.keys(row.payload).length > 0 && (
                          <details style={{ marginTop: 6 }}>
                            <summary style={{ fontSize: 10, color: "#64748b", cursor: "pointer", fontWeight: 700 }}>
                              payload
                            </summary>
                            <pre style={{ margin: "6px 0 0", fontSize: 10, fontFamily: "monospace", color: "#475569", background: "#f8fafc", padding: 8, borderRadius: 6, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                              {JSON.stringify(row.payload, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </ProductPageShell>

      {/* Force-revoke modal */}
      {target && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setTarget(null);
          }}
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}
        >
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 480, boxShadow: "0 24px 60px rgba(0,0,0,0.25)" }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 4 }}>
              Force-revoke certificate
            </div>
            <div style={{ fontSize: 13, color: "#475569", marginBottom: 14 }}>
              <strong>{target.submissionTitle || "(untitled)"}</strong>
              <br />
              <span style={{ color: "#7f1d1d" }}>
                This action is logged to the audit trail and visible in transparency.
              </span>
            </div>
            <label style={{ ...labelStyle, display: "block", marginBottom: 6 }}>Reason code</label>
            <select
              value={code}
              onChange={(e) => setCode(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", fontSize: 14, marginBottom: 12 }}
            >
              {ADMIN_REVOKE_REASON_CODES.map((c) => (
                <option key={c} value={c}>
                  {revokeReasonLabel(c, lang)}
                </option>
              ))}
            </select>
            <label style={{ ...labelStyle, display: "block", marginBottom: 6 }}>Public detail (≤ 500)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 500))}
              rows={3}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", fontSize: 13, marginBottom: 14, resize: "vertical", fontFamily: "inherit" }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setTarget(null)}
                disabled={busy}
                style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", background: "#fff", color: "#475569", fontWeight: 700, fontSize: 13, cursor: busy ? "not-allowed" : "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={busy}
                style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#dc2626", color: "#fff", fontWeight: 800, fontSize: 13, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.7 : 1 }}
              >
                {busy ? "Revoking…" : "Force-revoke"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk modal */}
      {bulkOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget && !bulkBusy) setBulkOpen(false);
          }}
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}
        >
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 520 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 4 }}>
              Bulk force-revoke
            </div>
            <div style={{ fontSize: 13, color: "#475569", marginBottom: 14 }}>
              <strong>{selected.size}</strong> certificate{selected.size === 1 ? "" : "s"} selected.
              <br />
              <span style={{ color: "#7f1d1d" }}>
                The same reason code will be applied. Already-revoked rows are skipped.
              </span>
            </div>
            <label style={{ ...labelStyle, display: "block", marginBottom: 6 }}>Reason code</label>
            <select
              value={bulkCode}
              onChange={(e) => setBulkCode(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", fontSize: 14, marginBottom: 12 }}
            >
              {ADMIN_REVOKE_REASON_CODES.map((c) => (
                <option key={c} value={c}>
                  {revokeReasonLabel(c, lang)}
                </option>
              ))}
            </select>
            <label style={{ ...labelStyle, display: "block", marginBottom: 6 }}>Public detail (≤ 500)</label>
            <textarea
              value={bulkReason}
              onChange={(e) => setBulkReason(e.target.value.slice(0, 500))}
              rows={3}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", fontSize: 13, marginBottom: 14, resize: "vertical", fontFamily: "inherit" }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setBulkOpen(false)}
                disabled={bulkBusy}
                style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", background: "#fff", color: "#475569", fontWeight: 700, fontSize: 13, cursor: bulkBusy ? "not-allowed" : "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={submitBulk}
                disabled={bulkBusy || selected.size === 0}
                style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#dc2626", color: "#fff", fontWeight: 800, fontSize: 13, cursor: bulkBusy ? "not-allowed" : "pointer", opacity: bulkBusy ? 0.7 : 1 }}
              >
                {bulkBusy ? "Revoking…" : `Force-revoke ${selected.size}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
