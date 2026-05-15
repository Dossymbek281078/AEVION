"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

const TOKEN_KEY = "aevion_auth_token_v1";

type Verification = {
  id: string;
  userId: string | null;
  email: string | null;
  kycProvider: string;
  kycStatus: string;
  kycVerifiedName: string | null;
  kycVerifiedCountry: string | null;
  paymentStatus: string;
  createdAt: string;
  completedAt: string | null;
  orgId: string | null;
};

type AuditEntry = {
  id: string;
  action: string;
  certId: string | null;
  verificationId: string | null;
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
  width: "100%",
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid rgba(15,23,42,0.15)",
  fontSize: 13,
  marginBottom: 10,
};
const btnPrimary: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "none",
  background: "#0d9488",
  color: "#fff",
  fontWeight: 800,
  fontSize: 12,
  cursor: "pointer",
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
const btnGreen: CSSProperties = {
  padding: "6px 12px",
  borderRadius: 6,
  border: "none",
  background: "#16a34a",
  color: "#fff",
  fontWeight: 700,
  fontSize: 11,
  cursor: "pointer",
};

const STATUS_FILTER = ["", "pending", "approved", "declined"];

export default function AdminBureauPage() {
  const { showToast } = useToast();
  const [hasToken, setHasToken] = useState(false);
  const [whoami, setWhoami] = useState<{ isAdmin: boolean; email: string | null } | null>(null);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [forceCertId, setForceCertId] = useState("");
  const [forceName, setForceName] = useState("");
  const [forceReason, setForceReason] = useState("");
  const [revokeCertId, setRevokeCertId] = useState("");
  const [revokeReason, setRevokeReason] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = localStorage.getItem(TOKEN_KEY);
    setHasToken(Boolean(t));
  }, []);

  const authHeaders = useCallback((): Record<string, string> => {
    const t = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    return t ? { Authorization: `Bearer ${t}` } : {};
  }, []);

  const loadWhoami = useCallback(async () => {
    try {
      const r = await fetch(apiUrl("/api/bureau/admin/whoami"), { headers: authHeaders() });
      const j = await r.json();
      setWhoami({ isAdmin: !!j.isAdmin, email: j.email || null });
    } catch {
      setWhoami({ isAdmin: false, email: null });
    }
  }, [authHeaders]);

  const loadVerifications = useCallback(async () => {
    try {
      const qs = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
      const r = await fetch(apiUrl(`/api/bureau/admin/verifications${qs}`), {
        headers: authHeaders(),
      });
      if (!r.ok) return;
      const j = await r.json();
      setVerifications(j.items || []);
    } catch {}
  }, [authHeaders, statusFilter]);

  const loadAudit = useCallback(async () => {
    try {
      const r = await fetch(apiUrl(`/api/bureau/admin/audit?limit=100`), {
        headers: authHeaders(),
      });
      if (!r.ok) return;
      const j = await r.json();
      setAudit(j.items || []);
    } catch {}
  }, [authHeaders]);

  useEffect(() => {
    if (!hasToken) return;
    loadWhoami();
  }, [hasToken, loadWhoami]);

  useEffect(() => {
    if (whoami?.isAdmin) {
      loadVerifications();
      loadAudit();
    }
  }, [whoami, loadVerifications, loadAudit]);

  async function forceVerify() {
    if (!forceCertId.trim()) return showToast("certId required", "error");
    if (!forceReason.trim()) return showToast("reason required", "error");
    const r = await fetch(apiUrl(`/api/bureau/admin/cert/${encodeURIComponent(forceCertId.trim())}/force-verify`), {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ verifiedName: forceName.trim() || undefined, reason: forceReason.trim() }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      return showToast(`Failed: ${j.error || r.status}`, "error");
    }
    showToast("Cert force-verified", "success");
    setForceCertId("");
    setForceName("");
    setForceReason("");
    loadAudit();
  }

  async function revokeVerification() {
    if (!revokeCertId.trim()) return showToast("certId required", "error");
    if (!revokeReason.trim()) return showToast("reason required", "error");
    const r = await fetch(apiUrl(`/api/bureau/admin/cert/${encodeURIComponent(revokeCertId.trim())}/revoke-verification`), {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ reason: revokeReason.trim() }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      return showToast(`Failed: ${j.error || r.status}`, "error");
    }
    showToast("Verification revoked", "success");
    setRevokeCertId("");
    setRevokeReason("");
    loadAudit();
  }

  if (!hasToken) {
    return (
      <main style={{ minHeight: "100vh", background: "#f7f8fa" }}>
        <Wave1Nav />
        <ProductPageShell>
          <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 16px" }}>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: "#0f172a" }}>AEVION Bureau · Admin</h1>
            <div style={{ ...card, marginTop: 16, color: "#64748b" }}>
              Sign in via <Link href="/auth">/auth</Link> first. This panel requires a Bearer token in localStorage and an email
              listed in <code>BUREAU_ADMIN_EMAILS</code>.
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
            <h1 style={{ fontSize: 26, fontWeight: 900, color: "#0f172a" }}>AEVION Bureau · Admin</h1>
            <div style={{ ...card, marginTop: 16, color: "#b91c1c" }}>
              <strong>Not authorized.</strong> Your email <code>{whoami.email}</code> is not in{" "}
              <code>BUREAU_ADMIN_EMAILS</code>.
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
          <div style={{ marginBottom: 16 }}>
            <Link
              href="/bureau"
              style={{ fontSize: 12, fontWeight: 700, color: "#0d9488", textDecoration: "none" }}
            >
              ← AEVION Bureau
            </Link>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "#0f172a", margin: 0 }}>
            Bureau · Admin panel
          </h1>
          <p style={{ color: "#475569", fontSize: 13, marginTop: 6, marginBottom: 24 }}>
            Logged in as <strong>{whoami?.email}</strong>. Audit trail captures every action below.
          </p>

          {/* Force-verify */}
          <div style={{ ...card, marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 12px", color: "#0f172a" }}>
              Force-verify a certificate
            </h2>
            <p style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>
              Bypass KYC + payment. Sets <code>authorVerificationLevel = &apos;verified&apos;</code>. Reason is required and goes to audit.
            </p>
            <input
              placeholder="Certificate ID (UUID)"
              value={forceCertId}
              onChange={(e) => setForceCertId(e.target.value)}
              style={inputStyle}
            />
            <input
              placeholder="Verified name (optional)"
              value={forceName}
              onChange={(e) => setForceName(e.target.value)}
              style={inputStyle}
            />
            <textarea
              placeholder="Reason (required, ≤500 chars)"
              value={forceReason}
              onChange={(e) => setForceReason(e.target.value)}
              style={{ ...inputStyle, minHeight: 60, fontFamily: "inherit" }}
            />
            <button onClick={forceVerify} style={btnGreen}>
              Force-verify
            </button>
          </div>

          {/* Revoke */}
          <div style={{ ...card, marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 12px", color: "#0f172a" }}>
              Revoke verification
            </h2>
            <p style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>
              Drops the cert back to <code>anonymous</code>. Doesn&apos;t touch the cert&apos;s contents.
            </p>
            <input
              placeholder="Certificate ID (UUID)"
              value={revokeCertId}
              onChange={(e) => setRevokeCertId(e.target.value)}
              style={inputStyle}
            />
            <textarea
              placeholder="Reason (required, ≤500 chars)"
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              style={{ ...inputStyle, minHeight: 60, fontFamily: "inherit" }}
            />
            <button onClick={revokeVerification} style={btnDanger}>
              Revoke verification
            </button>
          </div>

          {/* Verifications list */}
          <div style={{ ...card, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: "#0f172a" }}>
                Verifications ({verifications.length})
              </h2>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ ...inputStyle, marginBottom: 0, width: 180 }}
              >
                {STATUS_FILTER.map((s) => (
                  <option key={s || "all"} value={s}>
                    {s || "All statuses"}
                  </option>
                ))}
              </select>
            </div>
            {verifications.length === 0 ? (
              <div style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", padding: 24 }}>
                No verifications match this filter.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {verifications.map((v) => (
                  <div
                    key={v.id}
                    style={{
                      padding: 12,
                      border: "1px solid rgba(15,23,42,0.08)",
                      borderRadius: 10,
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 12,
                      alignItems: "center",
                      fontSize: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, color: "#0f172a" }}>
                        {v.kycVerifiedName || v.email || "(anonymous)"}{" "}
                        <span style={{ color: "#64748b", fontFamily: "monospace", fontSize: 10 }}>{v.kycProvider}</span>
                      </div>
                      <div style={{ color: "#64748b", fontFamily: "monospace", fontSize: 11, marginTop: 2 }}>
                        kyc=<strong style={{ color: v.kycStatus === "approved" ? "#16a34a" : "#0f172a" }}>{v.kycStatus}</strong> ·
                        pay=<strong style={{ color: v.paymentStatus === "paid" ? "#16a34a" : "#0f172a" }}>{v.paymentStatus}</strong>
                        {v.kycVerifiedCountry ? ` · ${v.kycVerifiedCountry}` : ""}
                      </div>
                      <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
                        {new Date(v.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Audit */}
          <div style={card}>
            <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 12px", color: "#0f172a" }}>
              Audit log ({audit.length})
            </h2>
            {audit.length === 0 ? (
              <div style={{ color: "#94a3b8", fontSize: 13 }}>No audit entries yet.</div>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {audit.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      padding: "8px 12px",
                      borderLeft: `3px solid ${a.action.includes("revoke") ? "#dc2626" : "#0d9488"}`,
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
