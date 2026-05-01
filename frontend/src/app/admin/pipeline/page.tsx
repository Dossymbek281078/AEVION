"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

const TOKEN_KEY = "aevion_auth_token_v1";

type Cert = {
  id: string;
  objectId: string;
  title: string;
  kind: string;
  authorName: string | null;
  country: string | null;
  status: string;
  protectedAt: string;
  authorVerificationLevel: string | null;
};

type AuditEntry = {
  id: string;
  action: string;
  certId: string | null;
  objectId: string | null;
  actor: string | null;
  payload: Record<string, unknown> | null;
  at: string;
};

const card: CSSProperties = {
  border: "1px solid rgba(15,23,42,0.1)",
  borderRadius: 14,
  padding: 16,
  background: "#fff",
};
const inputStyle: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid rgba(15,23,42,0.15)",
  fontSize: 13,
  marginBottom: 10,
};
const btnDanger: CSSProperties = {
  padding: "6px 12px",
  borderRadius: 6,
  border: "1px solid rgba(220,38,38,0.4)",
  background: "#fff",
  color: "#dc2626",
  fontWeight: 700,
  fontSize: 11,
  cursor: "pointer",
};

const STATUS_FILTER = ["", "active", "revoked"];

export default function AdminPipelinePage() {
  const { showToast } = useToast();
  const [hasToken, setHasToken] = useState(false);
  const [whoami, setWhoami] = useState<{ isAdmin: boolean; email: string | null } | null>(null);
  const [certs, setCerts] = useState<Cert[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [q, setQ] = useState("");
  const [revokeCertId, setRevokeCertId] = useState("");
  const [revokeReason, setRevokeReason] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    setHasToken(Boolean(localStorage.getItem(TOKEN_KEY)));
  }, []);

  const authHeaders = useCallback((): Record<string, string> => {
    const t = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    return t ? { Authorization: `Bearer ${t}` } : {};
  }, []);

  const loadWhoami = useCallback(async () => {
    try {
      const r = await fetch(apiUrl("/api/pipeline/admin/whoami"), { headers: authHeaders() });
      const j = await r.json();
      setWhoami({ isAdmin: !!j.isAdmin, email: j.email || null });
    } catch {
      setWhoami({ isAdmin: false, email: null });
    }
  }, [authHeaders]);

  const loadCerts = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (q.trim().length >= 2) params.set("q", q.trim());
    params.set("limit", "100");
    try {
      const r = await fetch(apiUrl(`/api/pipeline/admin/certificates?${params}`), {
        headers: authHeaders(),
      });
      if (!r.ok) return;
      const j = await r.json();
      setCerts(j.items || []);
    } catch {}
  }, [authHeaders, statusFilter, q]);

  const loadAudit = useCallback(async () => {
    try {
      const r = await fetch(apiUrl(`/api/pipeline/admin/audit?limit=100`), {
        headers: authHeaders(),
      });
      if (!r.ok) return;
      const j = await r.json();
      setAudit(j.items || []);
    } catch {}
  }, [authHeaders]);

  useEffect(() => {
    if (hasToken) loadWhoami();
  }, [hasToken, loadWhoami]);

  useEffect(() => {
    if (whoami?.isAdmin) {
      loadCerts();
      loadAudit();
    }
  }, [whoami, loadCerts, loadAudit]);

  async function revokeCert() {
    if (!revokeCertId.trim()) return showToast("certId required", "error");
    if (!revokeReason.trim()) return showToast("reason required", "error");
    const r = await fetch(apiUrl(`/api/pipeline/admin/certificate/${encodeURIComponent(revokeCertId.trim())}/revoke`), {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ reason: revokeReason.trim() }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      return showToast(`Failed: ${j.error || r.status}`, "error");
    }
    showToast("Cert force-revoked", "success");
    setRevokeCertId("");
    setRevokeReason("");
    loadCerts();
    loadAudit();
  }

  if (!hasToken) {
    return (
      <main style={{ minHeight: "100vh", background: "#f7f8fa" }}>
        <Wave1Nav />
        <ProductPageShell>
          <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 16px" }}>
            <h1 style={{ fontSize: 26, fontWeight: 900 }}>Pipeline · Admin</h1>
            <div style={{ ...card, marginTop: 16, color: "#64748b" }}>
              Sign in via <Link href="/auth">/auth</Link> first. Requires email in <code>PIPELINE_ADMIN_EMAILS</code>.
            </div>
          </div>
        </ProductPageShell>
      </main>
    );
  }
  if (whoami && !whoami.isAdmin) {
    return (
      <main style={{ minHeight: "100vh", background: "#f7f8fa" }}>
        <Wave1Nav />
        <ProductPageShell>
          <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 16px" }}>
            <h1 style={{ fontSize: 26, fontWeight: 900 }}>Pipeline · Admin</h1>
            <div style={{ ...card, marginTop: 16, color: "#b91c1c" }}>
              Not authorized. <code>{whoami.email}</code> not in <code>PIPELINE_ADMIN_EMAILS</code>.
            </div>
          </div>
        </ProductPageShell>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f7f8fa" }}>
      <Wave1Nav />
      <ProductPageShell>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "32px 16px" }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "#0f172a", margin: 0 }}>
            Pipeline · Admin panel
          </h1>
          <p style={{ color: "#475569", fontSize: 13, marginTop: 6, marginBottom: 24 }}>
            Logged in as <strong>{whoami?.email}</strong>. Audit captures every action.
          </p>

          <div style={{ ...card, marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 12px" }}>Force-revoke a certificate</h2>
            <input
              placeholder="Certificate ID (UUID)"
              value={revokeCertId}
              onChange={(e) => setRevokeCertId(e.target.value)}
              style={{ ...inputStyle, width: "100%" }}
            />
            <textarea
              placeholder="Reason (required, ≤500 chars)"
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              style={{ ...inputStyle, width: "100%", minHeight: 60, fontFamily: "inherit" }}
            />
            <button onClick={revokeCert} style={btnDanger}>Force-revoke</button>
          </div>

          <div style={{ ...card, marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, flex: 1 }}>Certificates ({certs.length})</h2>
              <input
                placeholder="Search title…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                style={{ ...inputStyle, marginBottom: 0, width: 200 }}
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ ...inputStyle, marginBottom: 0, width: 140 }}
              >
                {STATUS_FILTER.map((s) => (
                  <option key={s || "all"} value={s}>{s || "All statuses"}</option>
                ))}
              </select>
            </div>
            {certs.length === 0 ? (
              <div style={{ color: "#94a3b8", fontSize: 13, padding: 24, textAlign: "center" }}>
                No certificates match.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {certs.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      padding: 10,
                      border: "1px solid rgba(15,23,42,0.08)",
                      borderRadius: 8,
                      fontSize: 12,
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, color: "#0f172a" }}>
                        {c.title}{" "}
                        <span style={{ color: "#64748b", fontSize: 10, fontFamily: "monospace" }}>{c.kind}</span>
                        {c.status === "revoked" && (
                          <span style={{ marginLeft: 6, color: "#dc2626", fontSize: 10, fontWeight: 800 }}>REVOKED</span>
                        )}
                      </div>
                      <div style={{ color: "#64748b", fontFamily: "monospace", fontSize: 10, marginTop: 2 }}>
                        {c.id} · {c.authorName || "(anon)"} · {c.country || "—"} · lvl={c.authorVerificationLevel || "anonymous"}
                      </div>
                    </div>
                    <button
                      onClick={() => setRevokeCertId(c.id)}
                      style={{ ...btnDanger, opacity: c.status === "revoked" ? 0.4 : 1 }}
                      disabled={c.status === "revoked"}
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={card}>
            <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 12px" }}>Audit log ({audit.length})</h2>
            {audit.length === 0 ? (
              <div style={{ color: "#94a3b8", fontSize: 13 }}>No audit entries yet.</div>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {audit.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      padding: "8px 12px",
                      borderLeft: "3px solid #dc2626",
                      background: "#f8fafc",
                      borderRadius: 4,
                      fontSize: 11,
                      fontFamily: "monospace",
                    }}
                  >
                    <div style={{ color: "#0f172a", fontWeight: 700 }}>{a.action}</div>
                    <div style={{ color: "#64748b", marginTop: 2 }}>
                      actor={a.actor || "—"} · cert={a.certId || "—"} · {new Date(a.at).toLocaleString()}
                    </div>
                    {a.payload && (
                      <div style={{ color: "#475569", marginTop: 2, whiteSpace: "pre-wrap" }}>
                        {JSON.stringify(a.payload)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ProductPageShell>
    </main>
  );
}
