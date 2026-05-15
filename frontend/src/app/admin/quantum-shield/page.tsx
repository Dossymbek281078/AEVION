"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

const TOKEN_KEY = "aevion_auth_token_v1";

type Shield = {
  id: string;
  objectId: string | null;
  objectTitle: string | null;
  threshold: number;
  totalShards: number;
  status: string;
  distribution_policy: string;
  verifiedCount: number;
  createdAt: string;
  ownerUserId: string | null;
};

type AuditEntry = {
  id: string;
  shieldId: string;
  event: string;
  actorUserId: string | null;
  actorIp: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
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
const POLICY_FILTER = ["", "legacy_all_local", "distributed_v2"];

export default function AdminQShieldPage() {
  const { showToast } = useToast();
  const [hasToken, setHasToken] = useState(false);
  const [whoami, setWhoami] = useState<{ isAdmin: boolean; email: string | null } | null>(null);
  const [shields, setShields] = useState<Shield[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [policyFilter, setPolicyFilter] = useState("");
  const [revokeId, setRevokeId] = useState("");
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
      const r = await fetch(apiUrl("/api/quantum-shield/admin/whoami"), { headers: authHeaders() });
      const j = await r.json();
      setWhoami({ isAdmin: !!j.isAdmin, email: j.email || null });
    } catch {
      setWhoami({ isAdmin: false, email: null });
    }
  }, [authHeaders]);

  const loadShields = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (policyFilter) params.set("policy", policyFilter);
    params.set("limit", "100");
    try {
      const r = await fetch(apiUrl(`/api/quantum-shield/admin/shields?${params}`), {
        headers: authHeaders(),
      });
      if (!r.ok) return;
      const j = await r.json();
      setShields(j.items || []);
    } catch {}
  }, [authHeaders, statusFilter, policyFilter]);

  const loadAudit = useCallback(async () => {
    try {
      const r = await fetch(apiUrl(`/api/quantum-shield/admin/audit?limit=100`), {
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
      loadShields();
      loadAudit();
    }
  }, [whoami, loadShields, loadAudit]);

  async function revokeShield() {
    if (!revokeId.trim()) return showToast("shield ID required", "error");
    if (!revokeReason.trim()) return showToast("reason required", "error");
    const r = await fetch(apiUrl(`/api/quantum-shield/admin/shields/${encodeURIComponent(revokeId.trim())}/revoke`), {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ reason: revokeReason.trim() }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      return showToast(`Failed: ${j.error || r.status}`, "error");
    }
    showToast("Shield force-revoked", "success");
    setRevokeId("");
    setRevokeReason("");
    loadShields();
    loadAudit();
  }

  if (!hasToken) {
    return (
      <main style={{ minHeight: "100vh", background: "#f7f8fa" }}>
        <Wave1Nav />
        <ProductPageShell>
          <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 16px" }}>
            <h1 style={{ fontSize: 26, fontWeight: 900 }}>Quantum Shield · Admin</h1>
            <div style={{ ...card, marginTop: 16, color: "#64748b" }}>
              Sign in via <Link href="/auth">/auth</Link> first. Requires email in <code>QSHIELD_ADMIN_EMAILS</code>.
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
            <h1 style={{ fontSize: 26, fontWeight: 900 }}>Quantum Shield · Admin</h1>
            <div style={{ ...card, marginTop: 16, color: "#b91c1c" }}>
              Not authorized. <code>{whoami.email}</code> not in <code>QSHIELD_ADMIN_EMAILS</code>.
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
            Quantum Shield · Admin panel
          </h1>
          <p style={{ color: "#475569", fontSize: 13, marginTop: 6, marginBottom: 24 }}>
            Logged in as <strong>{whoami?.email}</strong>. Audit captures every action via <code>QuantumShieldAudit</code>.
          </p>

          <div style={{ ...card, marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 12px" }}>Force-revoke a shield</h2>
            <input
              placeholder="Shield ID"
              value={revokeId}
              onChange={(e) => setRevokeId(e.target.value)}
              style={{ ...inputStyle, width: "100%" }}
            />
            <textarea
              placeholder="Reason (required, ≤500 chars)"
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              style={{ ...inputStyle, width: "100%", minHeight: 60, fontFamily: "inherit" }}
            />
            <button onClick={revokeShield} style={btnDanger}>Force-revoke</button>
          </div>

          <div style={{ ...card, marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, flex: 1 }}>Shields ({shields.length})</h2>
              <select
                value={policyFilter}
                onChange={(e) => setPolicyFilter(e.target.value)}
                style={{ ...inputStyle, marginBottom: 0, width: 180 }}
              >
                {POLICY_FILTER.map((p) => (
                  <option key={p || "all"} value={p}>{p || "All policies"}</option>
                ))}
              </select>
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
            {shields.length === 0 ? (
              <div style={{ color: "#94a3b8", fontSize: 13, padding: 24, textAlign: "center" }}>
                No shields match.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {shields.map((s) => (
                  <div
                    key={s.id}
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
                        {s.objectTitle || "(untitled)"}{" "}
                        <span style={{ color: "#64748b", fontSize: 10, fontFamily: "monospace" }}>
                          [{s.threshold}/{s.totalShards}]
                        </span>
                        {s.status === "revoked" && (
                          <span style={{ marginLeft: 6, color: "#dc2626", fontSize: 10, fontWeight: 800 }}>REVOKED</span>
                        )}
                      </div>
                      <div style={{ color: "#64748b", fontFamily: "monospace", fontSize: 10, marginTop: 2 }}>
                        {s.id} · {s.distribution_policy} · verified={s.verifiedCount}
                      </div>
                    </div>
                    <button
                      onClick={() => setRevokeId(s.id)}
                      style={{ ...btnDanger, opacity: s.status === "revoked" ? 0.4 : 1 }}
                      disabled={s.status === "revoked"}
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
                      borderLeft: `3px solid ${a.event.startsWith("admin.") ? "#dc2626" : "#0d9488"}`,
                      background: "#f8fafc",
                      borderRadius: 4,
                      fontSize: 11,
                      fontFamily: "monospace",
                    }}
                  >
                    <div style={{ color: "#0f172a", fontWeight: 700 }}>{a.event}</div>
                    <div style={{ color: "#64748b", marginTop: 2 }}>
                      shield={a.shieldId} · actor={a.actorUserId || a.actorIp || "—"} · {new Date(a.createdAt).toLocaleString()}
                    </div>
                    {a.details && (
                      <div style={{ color: "#475569", marginTop: 2, whiteSpace: "pre-wrap" }}>
                        {JSON.stringify(a.details)}
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
