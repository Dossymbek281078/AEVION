"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { Wave1Nav } from "@/components/Wave1Nav";
import { Sparkline } from "@/components/Sparkline";
import { apiUrl } from "@/lib/apiBase";
import { useI18n } from "@/lib/i18n";
import {
  ADMIN_REVOKE_REASON_CODES,
  revokeReasonLabel,
} from "@/lib/qrightRevokeReasons";

const TOKEN_KEY = "aevion_auth_token_v1";

type AdminRow = {
  id: string;
  title: string;
  kind: string;
  contentHash: string;
  ownerName: string | null;
  ownerEmail: string | null;
  country: string | null;
  city: string | null;
  createdAt: string;
  revokedAt: string | null;
  revokeReason: string | null;
  revokeReasonCode: string | null;
  embedFetches: string | number;
  lastFetchedAt: string | null;
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

export default function AdminQRightPage() {
  const { showToast } = useToast();
  const { lang } = useI18n();
  const [hasToken, setHasToken] = useState(false);
  const [whoami, setWhoami] = useState<{ isAdmin: boolean; email: string | null } | null>(null);
  const [items, setItems] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "revoked">("all");
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<AdminRow | null>(null);
  const [code, setCode] = useState<string>("admin-takedown");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [series, setSeries] = useState<Record<string, { day: string; fetches: number }[]>>({});
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
    hosts: { host: string; totalFetches: number; uniqueObjects: number }[];
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
    fetch(apiUrl("/api/qright/admin/whoami"), { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => setWhoami({ isAdmin: !!data.isAdmin, email: data.email || null }))
      .catch(() => setWhoami({ isAdmin: false, email: null }));
  }, [hasToken, authHeaders]);

  const load = useCallback(async () => {
    if (!whoami?.isAdmin) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("status", statusFilter);
      if (q.trim().length >= 2) params.set("q", q.trim());
      const r = await fetch(apiUrl(`/api/qright/admin/objects?${params.toString()}`), {
        headers: authHeaders(),
      });
      if (r.ok) {
        const data = await r.json();
        setItems(data.items || []);
        // Reset bulk selection on every reload — selected ids may now be
        // revoked or filtered out, and clearing is less surprising than
        // silently dropping individual checkboxes.
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

  // Lazy-load series for visible rows (admin reads — no concern about scale).
  useEffect(() => {
    if (!whoami?.isAdmin || items.length === 0) return;
    let cancelled = false;
    Promise.all(
      items.map(async (it) => {
        if (series[it.id]) return null;
        try {
          const r = await fetch(
            apiUrl(`/api/qright/objects/${encodeURIComponent(it.id)}/stats?days=30`),
            { headers: authHeaders() }
          );
          if (!r.ok) return null;
          const data = await r.json();
          return [it.id, (data.series?.points || []) as { day: string; fetches: number }[]] as const;
        } catch {
          return null;
        }
      })
    ).then((results) => {
      if (cancelled) return;
      const next: Record<string, { day: string; fetches: number }[]> = {};
      for (const r of results) if (r) next[r[0]] = r[1];
      if (Object.keys(next).length) setSeries((prev) => ({ ...prev, ...next }));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, whoami?.isAdmin]);

  const selectableIds = items.filter((x) => !x.revokedAt).map((x) => x.id);
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(selectableIds));
  };

  const exportCsv = async () => {
    setCsvBusy(true);
    try {
      const params = new URLSearchParams();
      params.set("status", statusFilter);
      if (q.trim().length >= 2) params.set("q", q.trim());
      const r = await fetch(
        apiUrl(`/api/qright/admin/objects.csv?${params.toString()}`),
        { headers: authHeaders() }
      );
      if (!r.ok) {
        showToast(`CSV export failed (${r.status})`, "error");
        return;
      }
      const blob = await r.blob();
      const dispo = r.headers.get("Content-Disposition") || "";
      const m = /filename="?([^";]+)"?/.exec(dispo);
      const filename =
        m?.[1] || `qright-admin-${new Date().toISOString().slice(0, 10)}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      showToast(`CSV export failed: ${(e as Error).message}`, "error");
    } finally {
      setCsvBusy(false);
    }
  };

  const loadAudit = useCallback(async () => {
    if (!whoami?.isAdmin) return;
    setAuditLoading(true);
    try {
      const r = await fetch(apiUrl("/api/qright/admin/audit?limit=50"), {
        headers: authHeaders(),
      });
      if (r.ok) {
        const data = await r.json();
        setAudit(data.items || []);
      }
    } catch {
      // Silent — audit is supplementary; failure shouldn't block the page.
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
        apiUrl(`/api/qright/admin/sources?days=${sourcesDays}&limit=50`),
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
      // Silent — abuse-detection panel is supplementary.
    } finally {
      setSourcesLoading(false);
    }
  }, [whoami, authHeaders, sourcesDays]);

  useEffect(() => {
    if (whoami?.isAdmin) loadSources();
  }, [whoami, loadSources]);

  const submitBulk = async () => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    try {
      const ids = Array.from(selected);
      const r = await fetch(apiUrl("/api/qright/admin/revoke-bulk"), {
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

  const submit = async () => {
    if (!target) return;
    setBusy(true);
    try {
      const r = await fetch(apiUrl(`/api/qright/admin/revoke/${encodeURIComponent(target.id)}`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ reasonCode: code, reason: reason.trim() || undefined }),
      });
      if (r.ok) {
        showToast("Force-revoked.", "success");
        setTarget(null);
        setReason("");
        load();
        loadAudit();
      } else {
        const data = await r.json().catch(() => ({}));
        showToast(`Revoke failed: ${data.error || r.status}`, "error");
      }
    } catch (e) {
      showToast(`Revoke failed: ${(e as Error).message}`, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", background: "#f7f8fa" }}>
      <Wave1Nav />
      <ProductPageShell maxWidth={1080}>
        <div style={{ padding: "24px 16px" }}>
          <div style={{ marginBottom: 12 }}>
            <Link href="/qright" style={{ fontSize: 12, fontWeight: 700, color: "#0d9488", textDecoration: "none" }}>
              ← QRight
            </Link>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: "#0f172a", margin: 0 }}>
            QRight Admin
          </h1>
          <p style={{ color: "#475569", fontSize: 13, marginTop: 6, marginBottom: 20 }}>
            Audit registry and force-revoke. Visible only to AEVION admins.
          </p>

          {!hasToken && (
            <div style={{ ...card, color: "#854d0e", borderColor: "rgba(234,179,8,0.4)", background: "rgba(254,252,232,0.6)" }}>
              <strong>Sign in required.</strong> This page is admin-only.{" "}
              <Link href="/auth" style={{ color: "#0d9488", fontWeight: 800 }}>
                Sign in
              </Link>
            </div>
          )}

          {hasToken && whoami && !whoami.isAdmin && (
            <div style={{ ...card, color: "#7f1d1d", borderColor: "rgba(220,38,38,0.3)", background: "rgba(254,242,242,0.6)" }}>
              <strong>Forbidden.</strong> Your account ({whoami.email || "—"}) is not in the QRight admin allowlist.
            </div>
          )}

          {hasToken && whoami?.isAdmin && (
            <>
              <div style={{ ...card, marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                <input
                  type="search"
                  placeholder="Title or owner email…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") load();
                  }}
                  style={{ flex: "1 1 280px", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", fontSize: 13 }}
                />
                <div style={{ display: "flex", gap: 4, padding: 3, background: "#f1f5f9", borderRadius: 8 }}>
                  {(["all", "active", "revoked"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        border: "none",
                        background: statusFilter === s ? "#0f172a" : "transparent",
                        color: statusFilter === s ? "#fff" : "#475569",
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: "pointer",
                        textTransform: "capitalize",
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <button
                  onClick={load}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#0d9488", color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer" }}
                >
                  Reload
                </button>
                <button
                  onClick={exportCsv}
                  disabled={csvBusy}
                  title="Download current view as CSV"
                  style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", background: "#fff", color: "#0f172a", fontSize: 12, fontWeight: 800, cursor: csvBusy ? "not-allowed" : "pointer", opacity: csvBusy ? 0.7 : 1 }}
                >
                  {csvBusy ? "Exporting…" : "Export CSV"}
                </button>
              </div>

              {selectableIds.length > 0 && (
                <div
                  style={{
                    ...card,
                    marginBottom: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                    background: selected.size > 0 ? "rgba(13,148,136,0.06)" : "#fff",
                    borderColor: selected.size > 0 ? "rgba(13,148,136,0.35)" : "rgba(15,23,42,0.1)",
                    position: "sticky",
                    top: 8,
                    zIndex: 5,
                  }}
                >
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Select all visible active rows"
                    />
                    {allSelected ? "All selected" : `Select all ${selectableIds.length} active`}
                  </label>
                  <span style={{ fontSize: 12, color: "#475569" }}>
                    {selected.size} selected
                  </span>
                  <div style={{ flex: 1 }} />
                  <button
                    onClick={() => setSelected(new Set())}
                    disabled={selected.size === 0}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      border: "1px solid rgba(15,23,42,0.15)",
                      background: "#fff",
                      color: "#475569",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: selected.size === 0 ? "not-allowed" : "pointer",
                      opacity: selected.size === 0 ? 0.5 : 1,
                    }}
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => {
                      setBulkCode("admin-takedown");
                      setBulkReason("");
                      setBulkOpen(true);
                    }}
                    disabled={selected.size === 0}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 6,
                      border: "none",
                      background: selected.size === 0 ? "#cbd5e1" : "#dc2626",
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: selected.size === 0 ? "not-allowed" : "pointer",
                    }}
                  >
                    Force-revoke {selected.size || ""} →
                  </button>
                </div>
              )}

              {loading ? (
                <div style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>Loading…</div>
              ) : items.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>No matches.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {items.map((x) => {
                    const isRev = !!x.revokedAt;
                    return (
                      <div
                        key={x.id}
                        style={{
                          ...card,
                          borderColor: isRev ? "rgba(220,38,38,0.25)" : "rgba(15,23,42,0.08)",
                          background: isRev ? "rgba(254,242,242,0.4)" : "#fff",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                          {!isRev && (
                            <input
                              type="checkbox"
                              checked={selected.has(x.id)}
                              onChange={() => toggleOne(x.id)}
                              aria-label={`Select ${x.title}`}
                              style={{ marginTop: 4, cursor: "pointer", flexShrink: 0 }}
                            />
                          )}
                          <div style={{ flex: "1 1 320px", minWidth: 0 }}>
                            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                              <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 800, background: "rgba(13,148,136,0.1)", color: "#0d9488", textTransform: "uppercase" }}>
                                {x.kind}
                              </span>
                              <span style={{ fontSize: 11, color: "#94a3b8" }}>
                                {new Date(x.createdAt).toLocaleString()}
                              </span>
                              <span style={{ ...labelStyle, marginLeft: 6 }}>
                                👁 {Number(x.embedFetches).toLocaleString()}
                              </span>
                              {series[x.id] && series[x.id].length > 0 && (
                                <Sparkline points={series[x.id]} width={120} height={20} />
                              )}
                            </div>
                            <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a", marginBottom: 4 }}>{x.title}</div>
                            <div style={{ fontSize: 12, color: "#64748b" }}>
                              {x.ownerName ? `${x.ownerName} · ` : ""}
                              {x.ownerEmail || "—"}
                              {x.country ? ` · ${[x.city, x.country].filter(Boolean).join(", ")}` : ""}
                            </div>
                            <div style={{ marginTop: 6, fontSize: 10, fontFamily: "monospace", color: "#64748b", wordBreak: "break-all" }}>
                              {x.id} · {x.contentHash.slice(0, 24)}…
                            </div>
                            {isRev && (
                              <div style={{ marginTop: 6, padding: "6px 8px", borderRadius: 6, background: "rgba(220,38,38,0.06)", fontSize: 11, color: "#7f1d1d" }}>
                                <strong>{revokeReasonLabel(x.revokeReasonCode, lang)}:</strong>{" "}
                                {x.revokeReason || "no further detail"}{" "}
                                <span style={{ color: "#94a3b8" }}>· {x.revokedAt ? new Date(x.revokedAt).toLocaleString() : ""}</span>
                              </div>
                            )}
                          </div>
                          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                            <Link
                              href={`/qright/object/${x.id}`}
                              target="_blank"
                              style={{ fontSize: 11, fontWeight: 800, color: "#0f172a", textDecoration: "none", padding: "5px 10px", border: "1px solid rgba(15,23,42,0.15)", borderRadius: 6 }}
                            >
                              Public →
                            </Link>
                            {!isRev && (
                              <button
                                onClick={() => {
                                  setTarget(x);
                                  setCode("admin-takedown");
                                  setReason("");
                                }}
                                style={{ fontSize: 11, fontWeight: 800, color: "#dc2626", background: "transparent", padding: "5px 10px", border: "1px solid rgba(220,38,38,0.4)", borderRadius: 6, cursor: "pointer" }}
                              >
                                Force-revoke
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ marginTop: 28, marginBottom: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <h2 style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", margin: 0 }}>
                  Top embed sources
                </h2>
                <span style={{ fontSize: 11, color: "#94a3b8" }}>
                  {sources
                    ? `${sources.uniqueHosts} hosts · ${sources.totalFetches.toLocaleString()} fetches in last ${sources.days}d`
                    : "Aggregated across all objects — useful for abuse detection"}
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
                <div style={{ padding: 16, textAlign: "center", color: "#94a3b8", fontSize: 12, ...card }}>
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
                    <div style={{ textAlign: "right" }}>Objects</div>
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
                          {row.uniqueObjects}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

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
                <div style={{ padding: 16, textAlign: "center", color: "#94a3b8", fontSize: 12, ...card }}>
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
                          <span style={{ color: "#475569", fontWeight: 700 }}>
                            {row.actor || "—"}
                          </span>
                          {row.targetId && (
                            <Link
                              href={`/qright/object/${row.targetId}`}
                              target="_blank"
                              style={{ color: "#0d9488", textDecoration: "none", fontFamily: "monospace", fontSize: 10 }}
                            >
                              {row.targetId.slice(0, 8)}…
                            </Link>
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
              Force-revoke
            </div>
            <div style={{ fontSize: 13, color: "#475569", marginBottom: 14 }}>
              <strong>{target.title}</strong>
              <br />
              Owner: {target.ownerEmail || target.ownerName || "—"}.<br />
              <span style={{ color: "#7f1d1d" }}>
                This action is logged. Use only for genuine takedowns or dispute outcomes.
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

      {bulkOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget && !bulkBusy) setBulkOpen(false);
          }}
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}
        >
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 520, boxShadow: "0 24px 60px rgba(0,0,0,0.25)" }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 4 }}>
              Bulk force-revoke
            </div>
            <div style={{ fontSize: 13, color: "#475569", marginBottom: 14 }}>
              <strong>{selected.size}</strong> object{selected.size === 1 ? "" : "s"} selected.<br />
              <span style={{ color: "#7f1d1d" }}>
                This action is logged. The same reason code and detail will be applied to every object. Already-revoked rows are skipped.
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
