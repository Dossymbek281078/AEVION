"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiUrl } from "@/lib/apiBase";

type ActivityKind = "submitted" | "certified" | "revoked" | "voted";

type ActivityItem = {
  kind: ActivityKind;
  id: string;
  at: string;
  ownerId?: string | null;
  ref?: string | null;
  title?: string | null;
};

type ActivityResponse = {
  items: ActivityItem[];
  count: number;
  kinds: ActivityKind[];
};

type Filter = "all" | ActivityKind;

const ALL_KINDS: ActivityKind[] = ["submitted", "certified", "revoked", "voted"];

const KIND_META: Record<
  ActivityKind,
  { icon: string; label: string; verb: string; color: string; bg: string; border: string }
> = {
  submitted: {
    icon: "✏️",
    label: "Submitted",
    verb: "submitted",
    color: "#a5b4fc",
    bg: "rgba(99,102,241,0.12)",
    border: "rgba(99,102,241,0.35)",
  },
  certified: {
    icon: "✅",
    label: "Certified",
    verb: "certified",
    color: "#86efac",
    bg: "rgba(16,185,129,0.12)",
    border: "rgba(16,185,129,0.4)",
  },
  revoked: {
    icon: "🚫",
    label: "Revoked",
    verb: "revoked",
    color: "#fca5a5",
    bg: "rgba(239,68,68,0.12)",
    border: "rgba(239,68,68,0.4)",
  },
  voted: {
    icon: "🗳️",
    label: "Voted",
    verb: "voted on",
    color: "#fcd34d",
    bg: "rgba(245,158,11,0.12)",
    border: "rgba(245,158,11,0.4)",
  },
};

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "—";
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

function shortRef(ref: string | null | undefined): string {
  if (!ref) return "";
  if (ref.length <= 14) return ref;
  return `${ref.slice(0, 6)}…${ref.slice(-4)}`;
}

function shortOwner(ownerId: string | null | undefined): string {
  if (!ownerId) return "";
  if (ownerId.length <= 10) return ownerId;
  return `${ownerId.slice(0, 4)}…${ownerId.slice(-4)}`;
}

function buildArtifactLink(item: ActivityItem): string | null {
  // Submissions don't have an artifactVersionId in `ref` — `ref` is productKey.
  // Cert/revoke/vote use artifactVersionId as `ref`.
  if (!item.ref) return null;
  if (item.kind === "submitted") return null;
  return `/planet/artifact/${encodeURIComponent(item.ref)}`;
}

function describe(item: ActivityItem): string {
  const meta = KIND_META[item.kind];
  switch (item.kind) {
    case "submitted":
      return item.title?.trim() || `Submission ${shortRef(item.id)}`;
    case "certified":
      return `Certificate issued for artifact ${shortRef(item.ref)}`;
    case "revoked": {
      const reason = item.title?.trim();
      return reason
        ? `Certificate revoked (${reason}) — artifact ${shortRef(item.ref)}`
        : `Certificate revoked — artifact ${shortRef(item.ref)}`;
    }
    case "voted":
      return `Vote in category ${item.title?.trim() || "?"} on artifact ${shortRef(item.ref)}`;
    default:
      return `${meta.label} ${shortRef(item.id)}`;
  }
}

export type PlanetActivityFeedProps = {
  /** Max items per fetch (1..100). Default 20. */
  limit?: number;
  /** Auto-refresh interval in seconds. 0 / falsy disables. Default 60. */
  refreshSeconds?: number;
  /** Show tab filter row. Default true. */
  showTabs?: boolean;
  /** Optional initial filter. Default "all". */
  initialFilter?: Filter;
  /** Compact mode for embedding into the main page. Default false. */
  compact?: boolean;
  /** Optional heading override. */
  heading?: string;
  /** Optional className for outer wrapper. */
  className?: string;
};

export default function PlanetActivityFeed({
  limit = 20,
  refreshSeconds = 60,
  showTabs = true,
  initialFilter = "all",
  compact = false,
  heading,
  className,
}: PlanetActivityFeedProps) {
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const inFlight = useRef<AbortController | null>(null);

  const fetchFeed = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setError(null);
        const params = new URLSearchParams();
        params.set("limit", String(Math.max(1, Math.min(100, limit))));
        if (filter !== "all") params.set("kinds", filter);
        const r = await fetch(apiUrl(`/api/planet/activity?${params.toString()}`), {
          signal,
          cache: "no-store",
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = (await r.json()) as ActivityResponse;
        if (signal?.aborted) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
        setLastUpdated(Date.now());
      } catch (e: any) {
        if (signal?.aborted || e?.name === "AbortError") return;
        setError(e?.message || "Failed to load activity");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [filter, limit],
  );

  useEffect(() => {
    setLoading(true);
    inFlight.current?.abort();
    const ctrl = new AbortController();
    inFlight.current = ctrl;
    fetchFeed(ctrl.signal);
    return () => {
      ctrl.abort();
    };
  }, [fetchFeed]);

  useEffect(() => {
    if (!refreshSeconds || refreshSeconds <= 0) return;
    const id = window.setInterval(() => {
      const ctrl = new AbortController();
      inFlight.current = ctrl;
      fetchFeed(ctrl.signal);
    }, refreshSeconds * 1000);
    return () => window.clearInterval(id);
  }, [fetchFeed, refreshSeconds]);

  const tabs: { id: Filter; label: string; icon?: string }[] = useMemo(
    () => [
      { id: "all", label: "All" },
      ...ALL_KINDS.map((k) => ({
        id: k as Filter,
        label: KIND_META[k].label,
        icon: KIND_META[k].icon,
      })),
    ],
    [],
  );

  const headerLabel = heading ?? "Recent Planet activity";

  return (
    <section
      className={className}
      style={{
        borderRadius: 18,
        background: "linear-gradient(160deg, #0f172a 0%, #111827 100%)",
        border: "1px solid rgba(148,163,184,0.18)",
        color: "#e2e8f0",
        padding: compact ? 16 : 22,
        boxShadow: "0 12px 40px rgba(2,6,23,0.35)",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <div>
          <div
            style={{
              fontSize: compact ? 16 : 20,
              fontWeight: 900,
              letterSpacing: "-0.01em",
              color: "#f8fafc",
            }}
          >
            {headerLabel}
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
            Live feed across submissions, certificates, revocations and votes
            {lastUpdated ? (
              <>
                {" · updated "}
                <span suppressHydrationWarning>{timeAgo(new Date(lastUpdated).toISOString())}</span>
              </>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            const ctrl = new AbortController();
            inFlight.current = ctrl;
            setLoading(true);
            fetchFeed(ctrl.signal);
          }}
          disabled={loading}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid rgba(148,163,184,0.3)",
            background: "rgba(148,163,184,0.08)",
            color: "#e2e8f0",
            fontSize: 12,
            fontWeight: 700,
            cursor: loading ? "wait" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </header>

      {showTabs ? (
        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          {tabs.map((t) => {
            const isActive = filter === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setFilter(t.id)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: "1px solid",
                  borderColor: isActive ? "rgba(99,102,241,0.55)" : "rgba(148,163,184,0.25)",
                  background: isActive ? "rgba(99,102,241,0.18)" : "rgba(15,23,42,0.6)",
                  color: isActive ? "#c7d2fe" : "#cbd5e1",
                  fontWeight: isActive ? 800 : 600,
                  fontSize: 12,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {t.icon ? <span aria-hidden>{t.icon}</span> : null}
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.35)",
            color: "#fecaca",
            fontSize: 13,
          }}
        >
          Failed to load activity: {error}
        </div>
      ) : null}

      {!error && loading && items.length === 0 ? (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <li
              key={i}
              style={{
                height: 56,
                borderRadius: 12,
                background: "rgba(148,163,184,0.08)",
                border: "1px solid rgba(148,163,184,0.12)",
                animation: "pulse 1.4s ease-in-out infinite",
              }}
            />
          ))}
        </ul>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <div
          style={{
            padding: "16px 12px",
            textAlign: "center",
            color: "#94a3b8",
            fontSize: 13,
            background: "rgba(15,23,42,0.45)",
            borderRadius: 12,
            border: "1px dashed rgba(148,163,184,0.25)",
          }}
        >
          No activity yet for this filter.
        </div>
      ) : null}

      {items.length > 0 ? (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
          {items.map((item) => {
            const meta = KIND_META[item.kind] ?? KIND_META.submitted;
            const link = buildArtifactLink(item);
            const desc = describe(item);
            return (
              <li
                key={`${item.kind}:${item.id}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: "rgba(15,23,42,0.55)",
                  border: `1px solid ${meta.border}`,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: meta.bg,
                    border: `1px solid ${meta.border}`,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    flexShrink: 0,
                  }}
                >
                  {meta.icon}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      flexWrap: "wrap",
                      fontSize: 13,
                      lineHeight: 1.35,
                    }}
                  >
                    <span
                      style={{
                        color: meta.color,
                        fontWeight: 800,
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {meta.label}
                    </span>
                    {item.ownerId ? (
                      <span style={{ fontSize: 12, color: "#94a3b8" }}>
                        by <code style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{shortOwner(item.ownerId)}</code>
                      </span>
                    ) : null}
                  </div>
                  <div
                    style={{
                      marginTop: 2,
                      color: "#e2e8f0",
                      fontWeight: 600,
                      fontSize: 14,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={desc}
                  >
                    {link ? (
                      <Link
                        href={link}
                        style={{ color: "#e0e7ff", textDecoration: "none", fontWeight: 700 }}
                      >
                        {desc}
                      </Link>
                    ) : (
                      <span>{desc}</span>
                    )}
                  </div>
                  {item.ref ? (
                    <div
                      style={{
                        marginTop: 2,
                        fontSize: 11,
                        color: "#64748b",
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      }}
                    >
                      {item.kind === "submitted" ? "product" : "ref"}: {shortRef(item.ref)}
                    </div>
                  ) : null}
                </div>
                <div
                  style={{
                    color: "#94a3b8",
                    fontSize: 12,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                  title={item.at}
                >
                  <span suppressHydrationWarning>{timeAgo(item.at)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      <style jsx>{`
        @keyframes pulse {
          0%,
          100% {
            opacity: 0.45;
          }
          50% {
            opacity: 0.85;
          }
        }
      `}</style>
    </section>
  );
}
