"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";

type AuditEntry = {
  id: string;
  at: number;
  action: string;
  target_id: string | null;
  actor_prefix: string;
  ip: string | null;
  ua: string | null;
  meta: Record<string, unknown> | null;
};

const KEY_STORE = "aevion.payments.api.keys.v1";

const ACTION_ACCENTS: Record<string, string> = {
  "link.created": "#0d9488",
  "checkout.created": "#2563eb",
  "subscription.created": "#0ea5e9",
  "webhook.registered": "#7c3aed",
  "webhook.test_fired": "#a855f7",
  "refund.issued": "#ea580c",
};

function timeAgo(ms: number) {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function ensureDemoApiKey(): string {
  if (typeof window === "undefined") return "sk_test_DEMOFALLBACK";
  try {
    const raw = window.localStorage.getItem(KEY_STORE);
    const parsed: { full?: string }[] = raw ? JSON.parse(raw) : [];
    if (parsed.length > 0 && parsed[0].full) return parsed[0].full;
    const bytes = new Uint8Array(20);
    crypto.getRandomValues(bytes);
    const tail = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const full = "sk_test_" + tail;
    window.localStorage.setItem(
      KEY_STORE,
      JSON.stringify([
        {
          id: `key_demo_${Date.now().toString(36).slice(-4)}`,
          name: "Auto-generated (Audit page)",
          prefix: full.slice(0, 12) + "…",
          full,
          createdAt: Date.now(),
          livemode: false,
        },
        ...parsed,
      ])
    );
    return full;
  } catch {
    return "sk_test_DEMOFALLBACK";
  }
}

const cardBase: CSSProperties = {
  background: "#fff",
  border: "1px solid rgba(15,23,42,0.08)",
  borderRadius: 14,
  padding: "16px 18px",
};

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchAudit = useCallback(async () => {
    if (typeof window === "undefined") return;
    const apiKey = ensureDemoApiKey();
    try {
      const r = await fetch(`${window.location.origin}/api/payments/v1/audit?limit=200`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: "no-store",
      });
      if (!r.ok) {
        setLoading(false);
        return;
      }
      const data: { data: AuditEntry[] } = await r.json();
      setEntries(data.data || []);
    } catch {
      // offline
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAudit();
  }, [fetchAudit]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = window.setInterval(() => void fetchAudit(), 5000);
    return () => window.clearInterval(t);
  }, [autoRefresh, fetchAudit]);

  const actions = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) set.add(e.action);
    return Array.from(set).sort();
  }, [entries]);

  const filtered = useMemo(
    () => (filter ? entries.filter((e) => e.action === filter) : entries),
    [entries, filter]
  );

  const stats = useMemo(() => {
    const last1h = entries.filter((e) => Date.now() - e.at < 60 * 60 * 1000).length;
    const last24h = entries.filter(
      (e) => Date.now() - e.at < 24 * 60 * 60 * 1000
    ).length;
    return {
      total: entries.length,
      last1h,
      last24h,
      uniqueActors: new Set(entries.map((e) => e.actor_prefix)).size,
    };
  }, [entries]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 30%, #fff 100%)",
        padding: "44px 20px 80px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: "#0f172a",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <Link
          href="/payments"
          style={{
            color: "#0d9488",
            textDecoration: "none",
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          ← Back to Payments
        </Link>

        <h1
          style={{
            fontSize: "clamp(34px, 5vw, 52px)",
            fontWeight: 900,
            margin: "16px 0 12px",
            letterSpacing: "-0.02em",
          }}
        >
          Audit log
        </h1>
        <p
          style={{
            fontSize: 17,
            color: "#475569",
            maxWidth: 760,
            lineHeight: 1.5,
            marginBottom: 28,
          }}
        >
          Every state-changing API call to the Payments Rail is recorded here
          with actor (api-key prefix), timestamp, IP, user-agent, and the
          target id. Auto-refreshes every 5s. Persisted via{" "}
          <code
            style={{
              background: "#fff",
              padding: "2px 8px",
              borderRadius: 6,
              border: "1px solid rgba(15,23,42,0.1)",
            }}
          >
            kvPush(audit.v1)
          </code>{" "}
          — survives cold starts when KV is wired.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 14,
            marginBottom: 28,
          }}
        >
          <div style={cardBase}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Total entries
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, marginTop: 6 }}>
              {stats.total}
            </div>
          </div>
          <div style={cardBase}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Last 1h
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, marginTop: 6 }}>
              {stats.last1h}
            </div>
          </div>
          <div style={cardBase}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Last 24h
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, marginTop: 6 }}>
              {stats.last24h}
            </div>
          </div>
          <div style={cardBase}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Unique actors
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, marginTop: 6 }}>
              {stats.uniqueActors}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <button
            onClick={() => setFilter("")}
            style={{
              padding: "7px 14px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 700,
              border: filter === "" ? "1px solid #0f172a" : "1px solid rgba(15,23,42,0.18)",
              background: filter === "" ? "#0f172a" : "#fff",
              color: filter === "" ? "#fff" : "#0f172a",
              cursor: "pointer",
            }}
          >
            All ({entries.length})
          </button>
          {actions.map((a) => (
            <button
              key={a}
              onClick={() => setFilter(a)}
              style={{
                padding: "7px 14px",
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 700,
                border:
                  filter === a
                    ? `1px solid ${ACTION_ACCENTS[a] ?? "#0f172a"}`
                    : "1px solid rgba(15,23,42,0.18)",
                background: filter === a ? (ACTION_ACCENTS[a] ?? "#0f172a") : "#fff",
                color: filter === a ? "#fff" : "#0f172a",
                cursor: "pointer",
              }}
            >
              {a}
            </button>
          ))}
          <span style={{ flex: 1 }} />
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              color: "#475569",
            }}
          >
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh 5s
          </label>
          <button
            onClick={() => fetchAudit()}
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              border: "1px solid rgba(15,23,42,0.15)",
              background: "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ↻ refresh
          </button>
        </div>

        {loading ? (
          <div style={{ ...cardBase, color: "#64748b", fontSize: 14 }}>Loading audit…</div>
        ) : filtered.length === 0 ? (
          <div style={{ ...cardBase, color: "#64748b", fontSize: 14 }}>
            No audit entries yet. Try creating a link / firing a test webhook /
            issuing a refund — it will appear here.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {filtered.map((e) => (
              <div
                key={e.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto",
                  gap: 16,
                  alignItems: "center",
                  padding: "11px 14px",
                  borderRadius: 10,
                  background: "#fff",
                  border: "1px solid rgba(15,23,42,0.08)",
                  borderLeft: `4px solid ${ACTION_ACCENTS[e.action] ?? "#94a3b8"}`,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: "#94a3b8",
                    fontFamily: "monospace",
                    minWidth: 110,
                  }}
                >
                  {timeAgo(e.at)}
                </div>
                <div style={{ fontSize: 13 }}>
                  <strong style={{ color: ACTION_ACCENTS[e.action] ?? "#0f172a" }}>
                    {e.action}
                  </strong>
                  {e.target_id && (
                    <span style={{ color: "#64748b" }}>
                      {" "}
                      → <code>{e.target_id}</code>
                    </span>
                  )}
                  {e.meta && Object.keys(e.meta).length > 0 && (
                    <span
                      style={{
                        color: "#94a3b8",
                        marginLeft: 8,
                        fontSize: 12,
                        fontFamily: "monospace",
                      }}
                    >
                      {Object.entries(e.meta)
                        .slice(0, 3)
                        .map(([k, v]) => `${k}=${formatVal(v)}`)
                        .join(" · ")}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontFamily: "monospace",
                    color: "#475569",
                    background: "#f1f5f9",
                    padding: "3px 8px",
                    borderRadius: 6,
                  }}
                >
                  {e.actor_prefix}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function formatVal(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v.length > 30 ? v.slice(0, 30) + "…" : v;
  if (Array.isArray(v)) return `[${v.length}]`;
  if (typeof v === "object") return "{…}";
  return String(v);
}
