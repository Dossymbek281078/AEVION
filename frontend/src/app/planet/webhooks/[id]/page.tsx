"use client";

import Link from "next/link";
import { use as usePromise, useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

const TOKEN_KEY = "aevion_auth_token_v1";

type WebhookSummary = {
  id: string;
  url: string;
  createdAt: string;
  lastDeliveredAt: string | null;
  lastFailedAt: string | null;
  lastError: string | null;
  secretPrefix: string;
};

type Delivery = {
  id: string;
  certificateId: string | null;
  eventType: string;
  requestBody: string;
  statusCode: number | null;
  ok: boolean;
  error: string | null;
  deliveredAt: string;
  isRetry: boolean;
};

const card: CSSProperties = {
  border: "1px solid rgba(15,23,42,0.1)",
  borderRadius: 16,
  padding: 20,
  background: "#fff",
};
const labelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 6,
};

export default function PlanetWebhookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = usePromise(params);
  const { showToast } = useToast();
  const [hasToken, setHasToken] = useState(false);
  const [webhook, setWebhook] = useState<WebhookSummary | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState(false);
  const [editUrl, setEditUrl] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

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

  const loadAll = useCallback(async () => {
    if (!hasToken) return;
    setLoading(true);
    try {
      const [whRes, dlRes] = await Promise.all([
        fetch(apiUrl("/api/planet/webhooks"), { headers: authHeaders() }),
        fetch(apiUrl(`/api/planet/webhooks/${encodeURIComponent(id)}/deliveries?limit=100`), {
          headers: authHeaders(),
        }),
      ]);
      if (whRes.ok) {
        const list = await whRes.json();
        const found = (list.items || []).find((w: WebhookSummary) => w.id === id);
        setWebhook(found || null);
        if (found) setEditUrl(found.url);
      }
      if (dlRes.ok) {
        const data = await dlRes.json();
        setDeliveries(data.items || []);
      }
    } finally {
      setLoading(false);
    }
  }, [authHeaders, hasToken, id]);

  useEffect(() => {
    if (hasToken) loadAll();
  }, [hasToken, loadAll]);

  const retry = async (deliveryId: string) => {
    setRetrying((s) => new Set(s).add(deliveryId));
    try {
      const r = await fetch(
        apiUrl(`/api/planet/webhooks/${encodeURIComponent(id)}/retry/${encodeURIComponent(deliveryId)}`),
        { method: "POST", headers: authHeaders() }
      );
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        showToast(
          data.ok ? `Retried OK (${data.statusCode})` : `Retry failed (${data.statusCode || data.error || "—"})`,
          data.ok ? "success" : "error"
        );
        loadAll();
      } else {
        showToast(`Retry error: ${data.error || r.status}`, "error");
      }
    } catch (e) {
      showToast(`Retry error: ${(e as Error).message}`, "error");
    } finally {
      setRetrying((s) => {
        const next = new Set(s);
        next.delete(deliveryId);
        return next;
      });
    }
  };

  const saveEdit = async () => {
    const url = editUrl.trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      showToast("URL must start with http:// or https://", "error");
      return;
    }
    setSavingEdit(true);
    try {
      const r = await fetch(apiUrl(`/api/planet/webhooks/${encodeURIComponent(id)}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ url }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        showToast("URL updated", "success");
        setEditing(false);
        loadAll();
      } else {
        showToast(`Save failed: ${data.error || r.status}`, "error");
      }
    } catch (e) {
      showToast(`Save failed: ${(e as Error).message}`, "error");
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", background: "#f7f8fa" }}>
      <Wave1Nav />
      <ProductPageShell>
        <div style={{ maxWidth: 1040, margin: "0 auto", padding: "32px 16px" }}>
          <div style={{ marginBottom: 16 }}>
            <Link href="/planet" style={{ fontSize: 12, fontWeight: 700, color: "#0d9488", textDecoration: "none" }}>
              ← AEVION Planet
            </Link>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: "#0f172a", margin: 0 }}>
            Planet webhook delivery log
          </h1>
          <p style={{ color: "#475569", fontSize: 13, marginTop: 6, marginBottom: 20 }}>
            Last 100 attempts. Failed deliveries can be re-issued with the original signed body.
          </p>

          {!hasToken ? (
            <div style={{ ...card, color: "#854d0e", borderColor: "rgba(234,179,8,0.4)" }}>
              Sign in via Auth to view this page.
            </div>
          ) : loading ? (
            <div style={{ ...card, color: "#64748b" }}>Loading…</div>
          ) : !webhook ? (
            <div style={{ ...card, color: "#b91c1c", borderColor: "rgba(185,28,28,0.2)" }}>
              Webhook not found or you do not own it.
            </div>
          ) : (
            <>
              <div style={{ ...card, marginBottom: 18 }}>
                <div style={labelStyle}>Endpoint URL</div>
                {editing ? (
                  <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                    <input
                      type="url"
                      value={editUrl}
                      onChange={(e) => setEditUrl(e.target.value)}
                      style={{ flex: "1 1 320px", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", fontSize: 13, fontFamily: "ui-monospace, Menlo, monospace" }}
                    />
                    <button
                      onClick={saveEdit}
                      disabled={savingEdit}
                      style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#0d9488", color: "#fff", fontWeight: 800, fontSize: 12, cursor: savingEdit ? "not-allowed" : "pointer" }}
                    >
                      {savingEdit ? "Saving…" : "Save"}
                    </button>
                    <button
                      onClick={() => {
                        setEditing(false);
                        setEditUrl(webhook.url);
                      }}
                      disabled={savingEdit}
                      style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", background: "#fff", color: "#475569", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                    <code style={{ flex: "1 1 auto", padding: "8px 12px", borderRadius: 8, background: "#f1f5f9", border: "1px solid rgba(15,23,42,0.08)", fontSize: 12, fontFamily: "ui-monospace, Menlo, monospace", wordBreak: "break-all" }}>
                      {webhook.url}
                    </code>
                    <button
                      onClick={() => setEditing(true)}
                      style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", background: "#fff", color: "#0f172a", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                    >
                      Edit URL
                    </button>
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, fontSize: 12, color: "#475569" }}>
                  <div>
                    <div style={labelStyle}>Created</div>
                    <div>{new Date(webhook.createdAt).toUTCString()}</div>
                  </div>
                  <div>
                    <div style={labelStyle}>Secret prefix</div>
                    <code style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11 }}>
                      {webhook.secretPrefix}…
                    </code>
                  </div>
                  <div>
                    <div style={labelStyle}>Last delivered</div>
                    <div style={{ color: webhook.lastDeliveredAt ? "#0d9488" : "#94a3b8" }}>
                      {webhook.lastDeliveredAt ? new Date(webhook.lastDeliveredAt).toLocaleString() : "never"}
                    </div>
                  </div>
                  <div>
                    <div style={labelStyle}>Last failure</div>
                    <div style={{ color: webhook.lastFailedAt ? "#dc2626" : "#94a3b8" }}>
                      {webhook.lastFailedAt ? new Date(webhook.lastFailedAt).toLocaleString() : "—"}
                    </div>
                    {webhook.lastError && (
                      <div style={{ fontSize: 10, color: "#dc2626", marginTop: 2, fontFamily: "monospace" }}>
                        {webhook.lastError}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
                <h2 style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", margin: 0 }}>Deliveries</h2>
                <span style={{ fontSize: 11, color: "#94a3b8" }}>
                  {deliveries.length} attempt{deliveries.length === 1 ? "" : "s"}
                </span>
                <div style={{ flex: 1 }} />
                <button
                  onClick={loadAll}
                  style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(15,23,42,0.15)", background: "#fff", color: "#475569", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                >
                  Refresh
                </button>
              </div>
              {deliveries.length === 0 ? (
                <div style={{ ...card, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>
                  No deliveries yet — fire one by revoking a certificate.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  {deliveries.map((d) => (
                    <div
                      key={d.id}
                      style={{
                        ...card,
                        padding: "10px 14px",
                        borderColor: d.ok ? "rgba(13,148,136,0.25)" : "rgba(220,38,38,0.25)",
                        background: d.ok ? "#fff" : "rgba(254,242,242,0.4)",
                      }}
                    >
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 11 }}>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 6,
                            background: d.ok ? "rgba(13,148,136,0.12)" : "rgba(220,38,38,0.12)",
                            color: d.ok ? "#0d9488" : "#dc2626",
                            fontWeight: 800,
                            fontFamily: "monospace",
                          }}
                        >
                          {d.ok ? "OK" : "FAIL"} {d.statusCode ?? "—"}
                        </span>
                        {d.isRetry && (
                          <span style={{ padding: "2px 6px", borderRadius: 4, background: "rgba(99,102,241,0.12)", color: "#4f46e5", fontWeight: 700, fontSize: 10 }}>
                            RETRY
                          </span>
                        )}
                        <span style={{ color: "#475569", fontWeight: 700 }}>{d.eventType}</span>
                        {d.certificateId && (
                          <span style={{ color: "#94a3b8", fontFamily: "monospace", fontSize: 10 }}>
                            {d.certificateId.slice(0, 8)}…
                          </span>
                        )}
                        <span style={{ marginLeft: "auto", color: "#94a3b8" }}>
                          {new Date(d.deliveredAt).toLocaleString()}
                        </span>
                        {!d.ok && (
                          <button
                            onClick={() => retry(d.id)}
                            disabled={retrying.has(d.id)}
                            style={{
                              padding: "4px 10px",
                              borderRadius: 6,
                              border: "1px solid #dc2626",
                              background: retrying.has(d.id) ? "#fef2f2" : "#fff",
                              color: "#dc2626",
                              fontWeight: 800,
                              fontSize: 11,
                              cursor: retrying.has(d.id) ? "not-allowed" : "pointer",
                            }}
                          >
                            {retrying.has(d.id) ? "Retrying…" : "Retry"}
                          </button>
                        )}
                      </div>
                      {d.error && (
                        <div style={{ marginTop: 4, fontSize: 11, color: "#dc2626", fontFamily: "monospace" }}>
                          {d.error}
                        </div>
                      )}
                      <details style={{ marginTop: 6 }}>
                        <summary style={{ fontSize: 10, color: "#64748b", cursor: "pointer", fontWeight: 700 }}>
                          request body
                        </summary>
                        <pre style={{ margin: "6px 0 0", fontSize: 10, fontFamily: "monospace", color: "#475569", background: "#f8fafc", padding: 8, borderRadius: 6, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                          {tryPretty(d.requestBody)}
                        </pre>
                      </details>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </ProductPageShell>
    </main>
  );
}

function tryPretty(s: string): string {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}
