"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

const TOKEN_KEY = "aevion_auth_token_v1";

const REVOKE_REASON_LABELS: Record<string, string> = {
  "license-conflict": "License conflict",
  withdrawn: "Withdrawn by author",
  dispute: "Disputed authorship",
  mistake: "Registered by mistake",
  superseded: "Superseded by new version",
  other: "Other",
  "admin-takedown": "Admin takedown",
};

const ADMIN_REASON_CODES = [
  "admin-takedown",
  "dispute",
  "license-conflict",
  "mistake",
  "other",
];

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
              </div>

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
                                <strong>{x.revokeReasonCode ? REVOKE_REASON_LABELS[x.revokeReasonCode] || x.revokeReasonCode : "Revoked"}:</strong>{" "}
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
              {ADMIN_REASON_CODES.map((c) => (
                <option key={c} value={c}>
                  {REVOKE_REASON_LABELS[c] || c}
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
    </main>
  );
}
