"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

const TOKEN_KEY = "aevion_auth_token_v1";

type RegistryItem = {
  id: string;
  code: string;
  name: string;
  kind: string;
  status: string;
  effectiveStatus: string;
  effectiveTier: string;
  effectiveHint: string;
  override: { status: string | null; tier: string | null; hint: string | null; updatedBy: string | null; updatedAt: string } | null;
  runtime: { tier: string; hint: string; primaryPath: string | null; apiHints: string[] };
};

type AuditEntry = {
  id: string;
  moduleId: string;
  actor: string | null;
  oldState: any;
  newState: any;
  at: string;
};

type WebhookRow = {
  id: string;
  url: string;
  events: string;
  label: string | null;
  active: boolean;
  createdAt: string;
  createdBy: string | null;
  lastFiredAt: string | null;
  lastError: string | null;
  failureCount: number;
};

type DeliveryRow = {
  id: string;
  event: string;
  moduleId: string | null;
  succeeded: boolean;
  statusCode: number | null;
  errorMessage: string | null;
  durationMs: number;
  createdAt: string;
};

const WEBHOOK_EVENT_OPTIONS = ["*", "module.override.set", "module.override.cleared"] as const;

const STATUS_OPTIONS = ["", "idea", "planning", "in_progress", "mvp", "launched"];
const TIER_OPTIONS = ["", "mvp_live", "platform_api", "portal_only"];

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

export default function AdminModulesPage() {
  const { showToast } = useToast();
  const [hasToken, setHasToken] = useState(false);
  const [whoami, setWhoami] = useState<{ isAdmin: boolean; email: string | null } | null>(null);
  const [items, setItems] = useState<RegistryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [target, setTarget] = useState<RegistryItem | null>(null);
  const [draftStatus, setDraftStatus] = useState("");
  const [draftTier, setDraftTier] = useState("");
  const [draftHint, setDraftHint] = useState("");
  const [busy, setBusy] = useState(false);

  // Webhooks state
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [webhooksLoading, setWebhooksLoading] = useState(false);
  const [whUrl, setWhUrl] = useState("");
  const [whLabel, setWhLabel] = useState("");
  const [whEvents, setWhEvents] = useState<string>("*");
  const [whBusy, setWhBusy] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<{ id: string; secret: string } | null>(null);
  const [deliveriesFor, setDeliveriesFor] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);

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
    fetch(apiUrl("/api/modules/admin/whoami"), { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => setWhoami({ isAdmin: !!data.isAdmin, email: data.email || null }))
      .catch(() => setWhoami({ isAdmin: false, email: null }));
  }, [hasToken, authHeaders]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(apiUrl("/api/modules/registry?limit=200"), {
        headers: authHeaders(),
      });
      if (r.ok) {
        const d = await r.json();
        setItems(d.items || []);
      } else {
        showToast(`Load failed (${r.status})`, "error");
      }
    } catch (e) {
      showToast(`Load failed: ${(e as Error).message}`, "error");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, showToast]);

  const loadAudit = useCallback(async () => {
    if (!whoami?.isAdmin) return;
    setAuditLoading(true);
    try {
      const r = await fetch(apiUrl("/api/modules/admin/audit?limit=50"), {
        headers: authHeaders(),
      });
      if (r.ok) {
        const d = await r.json();
        setAudit(d.items || []);
      }
    } catch {
      /* silent */
    } finally {
      setAuditLoading(false);
    }
  }, [whoami, authHeaders]);

  const loadWebhooks = useCallback(async () => {
    if (!whoami?.isAdmin) return;
    setWebhooksLoading(true);
    try {
      const r = await fetch(apiUrl("/api/modules/admin/webhooks"), { headers: authHeaders() });
      if (r.ok) {
        const d = await r.json();
        setWebhooks(d.items || []);
      }
    } catch {
      /* silent */
    } finally {
      setWebhooksLoading(false);
    }
  }, [whoami, authHeaders]);

  const createWebhook = useCallback(async () => {
    const url = whUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      showToast("URL must be http(s)://", "error");
      return;
    }
    setWhBusy(true);
    try {
      const events = whEvents === "*" ? "*" : [whEvents];
      const r = await fetch(apiUrl("/api/modules/admin/webhooks"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ url, events, label: whLabel.trim() || null }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        showToast("Webhook created", "success");
        setRevealedSecret({ id: d.id, secret: d.secret });
        setWhUrl("");
        setWhLabel("");
        setWhEvents("*");
        loadWebhooks();
      } else {
        showToast(`Create failed: ${d.error || r.status}`, "error");
      }
    } catch (e) {
      showToast(`Create failed: ${(e as Error).message}`, "error");
    } finally {
      setWhBusy(false);
    }
  }, [whUrl, whLabel, whEvents, authHeaders, showToast, loadWebhooks]);

  const deleteWebhook = useCallback(
    async (id: string) => {
      if (!confirm("Delete this subscription? Delivery log will also be removed.")) return;
      try {
        const r = await fetch(apiUrl(`/api/modules/admin/webhooks/${encodeURIComponent(id)}`), {
          method: "DELETE",
          headers: authHeaders(),
        });
        if (r.ok) {
          showToast("Webhook deleted", "success");
          if (deliveriesFor === id) setDeliveriesFor(null);
          loadWebhooks();
        } else {
          showToast(`Delete failed (${r.status})`, "error");
        }
      } catch (e) {
        showToast(`Delete failed: ${(e as Error).message}`, "error");
      }
    },
    [authHeaders, deliveriesFor, showToast, loadWebhooks]
  );

  const loadDeliveries = useCallback(
    async (id: string) => {
      setDeliveriesFor(id);
      setDeliveriesLoading(true);
      try {
        const r = await fetch(
          apiUrl(`/api/modules/admin/webhooks/${encodeURIComponent(id)}/deliveries?limit=50`),
          { headers: authHeaders() }
        );
        if (r.ok) {
          const d = await r.json();
          setDeliveries(d.items || []);
        } else {
          setDeliveries([]);
        }
      } catch {
        setDeliveries([]);
      } finally {
        setDeliveriesLoading(false);
      }
    },
    [authHeaders]
  );

  useEffect(() => {
    if (whoami) load();
  }, [whoami, load]);

  useEffect(() => {
    if (whoami?.isAdmin) {
      loadAudit();
      loadWebhooks();
    }
  }, [whoami, loadAudit, loadWebhooks]);

  const openEdit = (m: RegistryItem) => {
    setTarget(m);
    setDraftStatus(m.override?.status || "");
    setDraftTier(m.override?.tier || "");
    setDraftHint(m.override?.hint || "");
  };

  const submitEdit = async () => {
    if (!target) return;
    setBusy(true);
    try {
      // null = clear override, "" = leave server default; we send only what changed.
      // To keep UX predictable, we send all three explicitly: empty string → null on server.
      const body = {
        status: draftStatus || null,
        tier: draftTier || null,
        hint: draftHint.trim() || null,
      };
      const r = await fetch(apiUrl(`/api/modules/admin/${encodeURIComponent(target.id)}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        showToast(d.cleared ? "Override cleared" : "Override saved", "success");
        setTarget(null);
        load();
        loadAudit();
      } else {
        showToast(`Save failed: ${d.error || r.status}`, "error");
      }
    } catch (e) {
      showToast(`Save failed: ${(e as Error).message}`, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", background: "#f7f8fa" }}>
      <Wave1Nav />
      <ProductPageShell>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 16px" }}>
          <div style={{ marginBottom: 16 }}>
            <Link
              href="/modules"
              style={{ fontSize: 12, fontWeight: 700, color: "#0d9488", textDecoration: "none" }}
            >
              ← Modules registry
            </Link>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "#0f172a", margin: 0 }}>
            Modules admin override
          </h1>
          <p style={{ color: "#475569", fontSize: 13, marginTop: 6, marginBottom: 24 }}>
            Flip any module&apos;s tier, status, or hint without a code deploy.
            Static <code>projects.ts</code> remains the source of truth; overrides take effect on read.
          </p>

          {!hasToken && (
            <div style={{ ...card, color: "#854d0e", borderColor: "rgba(234,179,8,0.4)" }}>
              Sign in via Auth — this page requires a Bearer token.
            </div>
          )}
          {hasToken && whoami && !whoami.isAdmin && (
            <div style={{ ...card, color: "#b91c1c", borderColor: "rgba(185,28,28,0.2)" }}>
              You are signed in as <strong>{whoami.email || "—"}</strong>, but not a modules admin.
              Set <code>MODULES_ADMIN_EMAILS</code> on the backend.
            </div>
          )}

          {whoami?.isAdmin && (
            <>
              {loading ? (
                <div style={{ ...card, textAlign: "center", color: "#94a3b8" }}>Loading…</div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {items.map((m) => {
                    const overridden = !!m.override;
                    return (
                      <div
                        key={m.id}
                        style={{
                          ...card,
                          padding: "12px 14px",
                          borderColor: overridden ? "rgba(234,88,12,0.35)" : "rgba(15,23,42,0.1)",
                          background: overridden ? "rgba(255,247,237,0.5)" : "#fff",
                          display: "grid",
                          gridTemplateColumns: "1fr auto",
                          gap: 12,
                          alignItems: "center",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <span style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
                              {m.name}
                            </span>
                            <span style={{ padding: "2px 6px", borderRadius: 4, background: "rgba(15,23,42,0.06)", color: "#475569", fontSize: 10, fontFamily: "monospace" }}>
                              {m.code}
                            </span>
                            <span style={{ padding: "2px 6px", borderRadius: 4, background: "rgba(13,148,136,0.12)", color: "#0d9488", fontSize: 10, fontFamily: "monospace" }}>
                              {m.effectiveTier}
                            </span>
                            <span style={{ padding: "2px 6px", borderRadius: 4, background: "rgba(15,23,42,0.06)", color: "#475569", fontSize: 10, fontFamily: "monospace" }}>
                              {m.effectiveStatus}
                            </span>
                            {overridden && (
                              <span style={{ padding: "2px 6px", borderRadius: 4, background: "rgba(234,88,12,0.15)", color: "#c2410c", fontSize: 10, fontWeight: 700 }}>
                                OVERRIDE
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: "#64748b", marginTop: 4, fontFamily: "monospace" }}>
                            id: {m.id}
                            {m.runtime.primaryPath ? ` · ${m.runtime.primaryPath}` : ""}
                          </div>
                          {overridden && m.override && (
                            <div style={{ fontSize: 10, color: "#c2410c", marginTop: 4 }}>
                              by {m.override.updatedBy || "—"} ·{" "}
                              {new Date(m.override.updatedAt).toLocaleString()}
                              {" · "}
                              {[
                                m.override.status && `status=${m.override.status}`,
                                m.override.tier && `tier=${m.override.tier}`,
                                m.override.hint && `hint=…`,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => openEdit(m)}
                          style={{
                            padding: "6px 14px",
                            borderRadius: 6,
                            border: "1px solid rgba(15,23,42,0.15)",
                            background: "#fff",
                            color: "#0f172a",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Edit override
                        </button>
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
                  Last 50 override changes
                </span>
                <div style={{ flex: 1 }} />
                <button
                  onClick={loadAudit}
                  disabled={auditLoading}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid rgba(15,23,42,0.15)",
                    background: "#fff",
                    color: "#475569",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: auditLoading ? "not-allowed" : "pointer",
                  }}
                >
                  {auditLoading ? "Loading…" : "Refresh"}
                </button>
              </div>
              {audit.length === 0 ? (
                <div style={{ ...card, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>
                  {auditLoading ? "Loading…" : "No override events yet."}
                </div>
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  {audit.map((a) => (
                    <div key={a.id} style={{ ...card, padding: "10px 12px" }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 11 }}>
                        <span style={{ padding: "2px 8px", borderRadius: 6, background: "rgba(234,88,12,0.12)", color: "#c2410c", fontWeight: 800, fontSize: 10, fontFamily: "monospace" }}>
                          {a.moduleId}
                        </span>
                        <span style={{ color: "#475569", fontWeight: 700 }}>{a.actor || "—"}</span>
                        <span style={{ marginLeft: "auto", color: "#94a3b8" }}>
                          {new Date(a.at).toLocaleString()}
                        </span>
                      </div>
                      <details style={{ marginTop: 6 }}>
                        <summary style={{ fontSize: 10, color: "#64748b", cursor: "pointer", fontWeight: 700 }}>
                          diff
                        </summary>
                        <pre style={{ margin: "6px 0 0", fontSize: 10, fontFamily: "monospace", color: "#475569", background: "#f8fafc", padding: 8, borderRadius: 6, overflowX: "auto", whiteSpace: "pre-wrap" }}>
                          {`before: ${JSON.stringify(a.oldState)}
 after: ${JSON.stringify(a.newState)}`}
                        </pre>
                      </details>
                    </div>
                  ))}
                </div>
              )}

              {/* Webhook subscriptions */}
              <div style={{ marginTop: 32, marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
                <h2 style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", margin: 0 }}>
                  Webhook subscriptions
                </h2>
                <span style={{ fontSize: 11, color: "#94a3b8" }}>
                  Fired on every override flip · HMAC-SHA256 signed
                </span>
                <div style={{ flex: 1 }} />
                <button
                  onClick={loadWebhooks}
                  disabled={webhooksLoading}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid rgba(15,23,42,0.15)",
                    background: "#fff",
                    color: "#475569",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: webhooksLoading ? "not-allowed" : "pointer",
                  }}
                >
                  {webhooksLoading ? "Loading…" : "Refresh"}
                </button>
              </div>

              {/* Create form */}
              <div style={{ ...card, marginBottom: 12, padding: 14 }}>
                <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 220px 180px auto", alignItems: "end" }}>
                  <div>
                    <div style={{ ...labelStyle, marginBottom: 4 }}>URL (https)</div>
                    <input
                      value={whUrl}
                      onChange={(e) => setWhUrl(e.target.value.slice(0, 2000))}
                      placeholder="https://your.host/webhook"
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid rgba(15,23,42,0.15)", fontSize: 12 }}
                    />
                  </div>
                  <div>
                    <div style={{ ...labelStyle, marginBottom: 4 }}>Events</div>
                    <select
                      value={whEvents}
                      onChange={(e) => setWhEvents(e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid rgba(15,23,42,0.15)", fontSize: 12, background: "#fff" }}
                    >
                      {WEBHOOK_EVENT_OPTIONS.map((ev) => (
                        <option key={ev} value={ev}>
                          {ev === "*" ? "* (all)" : ev}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div style={{ ...labelStyle, marginBottom: 4 }}>Label (optional)</div>
                    <input
                      value={whLabel}
                      onChange={(e) => setWhLabel(e.target.value.slice(0, 200))}
                      placeholder="ops slack"
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid rgba(15,23,42,0.15)", fontSize: 12 }}
                    />
                  </div>
                  <button
                    onClick={createWebhook}
                    disabled={whBusy}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 6,
                      border: "none",
                      background: "#0d9488",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: whBusy ? "not-allowed" : "pointer",
                      opacity: whBusy ? 0.7 : 1,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {whBusy ? "Creating…" : "Create"}
                  </button>
                </div>
              </div>

              {webhooks.length === 0 ? (
                <div style={{ ...card, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>
                  {webhooksLoading ? "Loading…" : "No webhook subscriptions yet."}
                </div>
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  {webhooks.map((w) => {
                    const failing = w.failureCount > 0;
                    const isSelected = deliveriesFor === w.id;
                    return (
                      <div key={w.id} style={{ ...card, padding: "10px 12px", borderColor: failing ? "rgba(185,28,28,0.25)" : "rgba(15,23,42,0.1)" }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 12 }}>
                          {w.label && (
                            <span style={{ padding: "2px 8px", borderRadius: 6, background: "rgba(13,148,136,0.12)", color: "#0d9488", fontWeight: 800, fontSize: 10 }}>
                              {w.label}
                            </span>
                          )}
                          <span style={{ fontFamily: "monospace", color: "#0f172a", fontSize: 11, wordBreak: "break-all", flex: 1, minWidth: 0 }}>
                            {w.url}
                          </span>
                          <span style={{ padding: "2px 6px", borderRadius: 4, background: "rgba(15,23,42,0.06)", color: "#475569", fontSize: 10, fontFamily: "monospace" }}>
                            {w.events}
                          </span>
                          {failing && (
                            <span style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(185,28,28,0.12)", color: "#b91c1c", fontSize: 10, fontWeight: 800 }}>
                              {w.failureCount} fail
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: "#64748b", marginTop: 6, display: "flex", gap: 12, flexWrap: "wrap", fontFamily: "monospace" }}>
                          <span>created {new Date(w.createdAt).toLocaleString()}</span>
                          {w.createdBy && <span>by {w.createdBy}</span>}
                          {w.lastFiredAt && <span>last fired {new Date(w.lastFiredAt).toLocaleString()}</span>}
                          {w.lastError && (
                            <span style={{ color: "#b91c1c" }}>last error: {w.lastError.slice(0, 80)}</span>
                          )}
                        </div>
                        <div style={{ marginTop: 8, display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <button
                            onClick={() => (isSelected ? setDeliveriesFor(null) : loadDeliveries(w.id))}
                            style={{
                              padding: "5px 10px",
                              borderRadius: 6,
                              border: "1px solid rgba(15,23,42,0.15)",
                              background: isSelected ? "#0f172a" : "#fff",
                              color: isSelected ? "#fff" : "#475569",
                              fontSize: 10,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            {isSelected ? "Hide deliveries" : "Deliveries"}
                          </button>
                          <button
                            onClick={() => deleteWebhook(w.id)}
                            style={{
                              padding: "5px 10px",
                              borderRadius: 6,
                              border: "1px solid rgba(185,28,28,0.3)",
                              background: "#fff",
                              color: "#b91c1c",
                              fontSize: 10,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            Delete
                          </button>
                        </div>
                        {isSelected && (
                          <div style={{ marginTop: 10, padding: 10, background: "#f8fafc", borderRadius: 8 }}>
                            {deliveriesLoading ? (
                              <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center" }}>Loading…</div>
                            ) : deliveries.length === 0 ? (
                              <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center" }}>No deliveries yet.</div>
                            ) : (
                              <div style={{ display: "grid", gap: 4 }}>
                                {deliveries.map((d) => (
                                  <div
                                    key={d.id}
                                    style={{
                                      display: "grid",
                                      gridTemplateColumns: "auto auto 1fr auto auto",
                                      gap: 8,
                                      fontSize: 10,
                                      fontFamily: "monospace",
                                      color: "#475569",
                                      alignItems: "center",
                                    }}
                                  >
                                    <span style={{ color: d.succeeded ? "#0d9488" : "#b91c1c", fontWeight: 800 }}>
                                      {d.succeeded ? "OK" : "ERR"}
                                    </span>
                                    <span style={{ color: "#94a3b8" }}>{d.statusCode ?? "—"}</span>
                                    <span>
                                      {d.event}
                                      {d.moduleId ? ` · ${d.moduleId}` : ""}
                                      {d.errorMessage ? ` · ${d.errorMessage.slice(0, 60)}` : ""}
                                    </span>
                                    <span style={{ color: "#94a3b8" }}>{d.durationMs}ms</span>
                                    <span style={{ color: "#94a3b8" }}>{new Date(d.createdAt).toLocaleString()}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
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

      {/* Edit modal */}
      {target && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setTarget(null);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 520 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 4 }}>
              Override {target.code}
            </div>
            <div style={{ fontSize: 12, color: "#475569", marginBottom: 14 }}>
              Leave a field blank to clear that override (falls back to <code>projects.ts</code>).
              <br />
              All three blank → drop the row entirely.
            </div>

            <label style={{ ...labelStyle, display: "block", marginBottom: 6 }}>
              Status (default: <code>{target.status}</code>)
            </label>
            <select
              value={draftStatus}
              onChange={(e) => setDraftStatus(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", fontSize: 13, marginBottom: 12 }}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s || "_clear"} value={s}>
                  {s || "(clear override)"}
                </option>
              ))}
            </select>

            <label style={{ ...labelStyle, display: "block", marginBottom: 6 }}>
              Tier (default: <code>{target.runtime.tier}</code>)
            </label>
            <select
              value={draftTier}
              onChange={(e) => setDraftTier(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", fontSize: 13, marginBottom: 12 }}
            >
              {TIER_OPTIONS.map((s) => (
                <option key={s || "_clear"} value={s}>
                  {s || "(clear override)"}
                </option>
              ))}
            </select>

            <label style={{ ...labelStyle, display: "block", marginBottom: 6 }}>
              Hint (default: <code>{target.runtime.hint}</code>)
            </label>
            <input
              value={draftHint}
              onChange={(e) => setDraftHint(e.target.value.slice(0, 500))}
              placeholder="(blank = clear)"
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", fontSize: 13, marginBottom: 14 }}
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
                onClick={submitEdit}
                disabled={busy}
                style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#0d9488", color: "#fff", fontWeight: 800, fontSize: 13, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.7 : 1 }}
              >
                {busy ? "Saving…" : "Save override"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Secret reveal — shown ONCE on webhook creation */}
      {revealedSecret && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 560 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 6 }}>
              Webhook secret — save it now
            </div>
            <div style={{ fontSize: 12, color: "#475569", marginBottom: 14, lineHeight: 1.5 }}>
              This secret is shown only once. Store it on the receiver side and use it to verify incoming
              <code> X-AEVION-Signature: sha256=&lt;hex&gt;</code> headers
              against <code>HMAC-SHA256(secret, rawBody)</code>.
            </div>
            <div
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 11,
                background: "#0f172a",
                color: "#5eead4",
                padding: 12,
                borderRadius: 8,
                wordBreak: "break-all",
                marginBottom: 14,
              }}
            >
              {revealedSecret.secret}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  if (typeof navigator !== "undefined" && navigator.clipboard) {
                    navigator.clipboard.writeText(revealedSecret.secret);
                    showToast("Secret copied", "success");
                  }
                }}
                style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", background: "#fff", color: "#0f172a", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
              >
                Copy
              </button>
              <button
                onClick={() => setRevealedSecret(null)}
                style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#0d9488", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}
              >
                Saved, close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
