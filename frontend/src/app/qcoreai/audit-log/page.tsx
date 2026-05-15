"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

type AuditEntry = {
  id: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  createdAt: string;
};

const ACTION_COLORS: Record<string, string> = {
  "session.created": "#3b82f6",
  "session.shared": "#8b5cf6",
  "run.started": "#10b981",
  "api-key.created": "#f59e0b",
  "api-key.deleted": "#ef4444",
};

const ACTION_CATEGORY: Record<string, string> = {
  "session.created": "session",
  "session.shared": "session",
  "run.started": "run",
  "api-key.created": "api-key",
  "api-key.deleted": "api-key",
};

function categoryColor(action: string): string {
  return ACTION_COLORS[action] ?? "#6b7280";
}

function fmtTime(iso: string): string {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("qcore_token") : null;
      const res = await fetch(apiUrl("/api/qcoreai/me/audit-log?limit=50"), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        if (res.status === 401) { setError("Not authenticated. Please log in."); return; }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setEntries(data.entries ?? []);
      setLastRefresh(new Date());
    } catch (e: any) {
      setError(e?.message || "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <ProductPageShell>
      <Wave1Nav />
      <div style={{ minHeight: "100vh", background: "#0a0e1a", color: "#e2e8f0", fontFamily: "Inter, system-ui, sans-serif" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1.5rem" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem" }}>
            <div>
              <Link href="/qcoreai/multi" style={{ color: "#5eead4", textDecoration: "none", fontSize: "0.85rem", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 8 }}>
                ← Back to QCoreAI
              </Link>
              <h1 style={{ margin: 0, fontSize: "1.6rem", fontWeight: 700, color: "#f1f5f9" }}>
                Audit Log
              </h1>
              <p style={{ margin: "0.4rem 0 0", color: "#94a3b8", fontSize: "0.88rem" }}>
                Your action history — last 50 events
              </p>
            </div>
            <button
              onClick={load}
              disabled={loading}
              style={{
                background: "#1e293b", color: "#94a3b8", border: "1px solid #334155",
                borderRadius: 8, padding: "0.5rem 1rem", cursor: loading ? "not-allowed" : "pointer",
                fontSize: "0.85rem", opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>

          {/* Last refreshed */}
          <div style={{ fontSize: "0.78rem", color: "#475569", marginBottom: "1.2rem" }}>
            Last refreshed: {lastRefresh.toLocaleTimeString()} (auto-refreshes every 30s)
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: "#1a1f2e", border: "1px solid #ef4444", borderRadius: 8, padding: "1rem 1.25rem", color: "#fca5a5", marginBottom: "1.5rem" }}>
              {error}
            </div>
          )}

          {/* Legend */}
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
            {[
              { label: "session", color: "#3b82f6" },
              { label: "run", color: "#10b981" },
              { label: "api-key", color: "#f59e0b" },
              { label: "share", color: "#8b5cf6" },
            ].map((item) => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", color: "#94a3b8" }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: item.color }} />
                {item.label}
              </div>
            ))}
          </div>

          {/* Table */}
          {loading && entries.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "#475569" }}>Loading...</div>
          ) : entries.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "#475569", background: "#0f172a", borderRadius: 12 }}>
              No audit events yet. Start using QCoreAI to see your action history here.
            </div>
          ) : (
            <div style={{ background: "#0f172a", borderRadius: 12, overflow: "hidden", border: "1px solid #1e293b" }}>
              {/* Table header */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 120px 180px 1fr",
                padding: "0.75rem 1.25rem",
                borderBottom: "1px solid #1e293b",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}>
                <div>Action</div>
                <div>Type</div>
                <div>Resource ID</div>
                <div>Timestamp</div>
              </div>
              {/* Rows */}
              {entries.map((entry, i) => {
                const color = categoryColor(entry.action);
                const category = ACTION_CATEGORY[entry.action] ?? "other";
                return (
                  <div
                    key={entry.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 120px 180px 1fr",
                      padding: "0.75rem 1.25rem",
                      borderBottom: i < entries.length - 1 ? "1px solid #1a2235" : "none",
                      alignItems: "center",
                      fontSize: "0.85rem",
                    }}
                  >
                    {/* Action badge */}
                    <div>
                      <span style={{
                        display: "inline-block",
                        padding: "0.2rem 0.6rem",
                        borderRadius: 5,
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        background: `${color}22`,
                        color,
                        border: `1px solid ${color}44`,
                      }}>
                        {entry.action}
                      </span>
                    </div>
                    {/* Resource type */}
                    <div style={{ color: "#94a3b8" }}>
                      {entry.resourceType ?? "—"}
                    </div>
                    {/* Resource ID */}
                    <div style={{ color: "#64748b", fontFamily: "monospace", fontSize: "0.75rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {entry.resourceId ? entry.resourceId.slice(0, 24) + (entry.resourceId.length > 24 ? "…" : "") : "—"}
                    </div>
                    {/* Timestamp */}
                    <div style={{ color: "#64748b", fontSize: "0.78rem" }}>
                      {fmtTime(entry.createdAt)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer links */}
          <div style={{ marginTop: "2rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <Link href="/qcoreai/api-keys" style={{ color: "#5eead4", textDecoration: "none", fontSize: "0.85rem" }}>API Keys</Link>
            <Link href="/qcoreai/analytics" style={{ color: "#5eead4", textDecoration: "none", fontSize: "0.85rem" }}>Analytics</Link>
            <Link href="/qcoreai/multi" style={{ color: "#5eead4", textDecoration: "none", fontSize: "0.85rem" }}>Multi-Agent</Link>
          </div>
        </div>
      </div>
    </ProductPageShell>
  );
}
