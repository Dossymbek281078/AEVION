"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

// Auto-refresh toggle for the /modules page.
//
// Rationale:
//   - The page is a server component that revalidates every 60s by default,
//     but viewers parked on it for triage (incident response, launch days)
//     want fresher data on demand.
//   - Implementing this server-side via short revalidate is wasteful
//     (every visitor pays the rebuild cost). Client-driven refresh keeps
//     the burden on the active viewer.
//   - We use router.refresh() rather than a full reload so the user's
//     scroll position and any expanded card state survive each tick.
//
// UX:
//   - Pill button (off by default — opt-in to avoid surprising new users).
//   - When on: 30s default interval, live countdown so the user knows
//     when the next refresh lands.
//   - Choice persists per-browser via localStorage so a user who keeps
//     this dashboard open as a tab gets their preference back on reload.

const STORAGE_KEY = "aevion.modules.autoRefresh";
const DEFAULT_INTERVAL_MS = 30_000;

type Lang = "en" | "ru";

const COPY: Record<Lang, {
  off: string;
  on: string;
  nextIn: string;
  refreshNow: string;
  refreshing: string;
  lastUpdated: string;
}> = {
  en: {
    off: "Auto-refresh off",
    on: "Auto-refresh on",
    nextIn: "next in",
    refreshNow: "Refresh now",
    refreshing: "Refreshing…",
    lastUpdated: "Last fetched",
  },
  ru: {
    off: "Авто-обновление выкл",
    on: "Авто-обновление вкл",
    nextIn: "через",
    refreshNow: "Обновить",
    refreshing: "Обновление…",
    lastUpdated: "Получено",
  },
};

function formatRelative(ms: number, lang: Lang): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return lang === "ru" ? `${h}ч ${m % 60}м` : `${h}h ${m % 60}m`;
}

export default function AutoRefreshToggle({
  lang = "en",
  generatedAt,
}: {
  lang?: Lang;
  generatedAt?: string;
}) {
  const router = useRouter();
  const t = COPY[lang];

  // Hydrate from localStorage. We start "off" on first paint to avoid
  // hydration mismatch — the actual stored preference is read in effect.
  const [enabled, setEnabled] = useState(false);
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const lastRefreshRef = useRef<number>(Date.now());
  const nextRefreshRef = useRef<number>(Date.now() + DEFAULT_INTERVAL_MS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === "1") setEnabled(true);
    } catch {
      // Private mode / blocked storage — fail silent, just stay off.
    }
  }, []);

  // Single interval drives both countdown re-render (1Hz) and the actual
  // refresh trigger. Using a single timer avoids the multi-timer drift
  // and is plenty cheap.
  useEffect(() => {
    if (!enabled) return;
    nextRefreshRef.current = Date.now() + DEFAULT_INTERVAL_MS;
    const iv = setInterval(() => {
      setTick((n) => n + 1);
      if (Date.now() >= nextRefreshRef.current) {
        setRefreshing(true);
        lastRefreshRef.current = Date.now();
        nextRefreshRef.current = Date.now() + DEFAULT_INTERVAL_MS;
        router.refresh();
        // Clear the "Refreshing…" state visually after a short beat so
        // the user gets feedback that the call landed. Next render of
        // the server component will land via React's transition.
        setTimeout(() => setRefreshing(false), 800);
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [enabled, router]);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Ignore — preference simply won't persist.
      }
      return next;
    });
  }, []);

  const refreshNow = useCallback(() => {
    setRefreshing(true);
    lastRefreshRef.current = Date.now();
    nextRefreshRef.current = Date.now() + DEFAULT_INTERVAL_MS;
    router.refresh();
    setTimeout(() => setRefreshing(false), 800);
  }, [router]);

  const msUntilNext = Math.max(0, nextRefreshRef.current - Date.now());
  // Reference `tick` so React re-renders the countdown each second.
  void tick;

  const fetchedAt = generatedAt ? new Date(generatedAt) : null;
  const fetchedAgo = fetchedAt ? Date.now() - fetchedAt.getTime() : null;

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        flexWrap: "wrap",
        marginBottom: 14,
        padding: "10px 14px",
        background: "#fff",
        border: "1px solid rgba(15,23,42,0.1)",
        borderRadius: 12,
        fontSize: 12,
      }}
    >
      <button
        type="button"
        onClick={toggle}
        aria-pressed={enabled}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 12px",
          borderRadius: 999,
          border: `1px solid ${enabled ? "#0d9488" : "rgba(15,23,42,0.2)"}`,
          background: enabled ? "#0d9488" : "#fff",
          color: enabled ? "#fff" : "#475569",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        <span
          aria-hidden
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: enabled ? "#5eead4" : "#94a3b8",
            boxShadow: enabled ? "0 0 0 3px rgba(94,234,212,0.25)" : "none",
            // Pulse while refreshing for instant feedback.
            animation: enabled && refreshing ? "aevion-pulse 0.8s ease-out" : "none",
          }}
        />
        {enabled ? t.on : t.off}
      </button>

      {enabled && (
        <span style={{ color: "#64748b", fontFamily: "ui-monospace, monospace", fontSize: 11 }}>
          {refreshing ? t.refreshing : `${t.nextIn} ${formatRelative(msUntilNext, lang)}`}
        </span>
      )}

      <button
        type="button"
        onClick={refreshNow}
        disabled={refreshing}
        style={{
          padding: "5px 10px",
          borderRadius: 6,
          border: "1px solid rgba(15,23,42,0.15)",
          background: refreshing ? "#f1f5f9" : "#fff",
          color: "#0f172a",
          fontSize: 11,
          fontWeight: 700,
          cursor: refreshing ? "wait" : "pointer",
          fontFamily: "inherit",
        }}
      >
        ↻ {t.refreshNow}
      </button>

      {fetchedAt && (
        <span
          style={{
            marginLeft: "auto",
            color: "#94a3b8",
            fontFamily: "ui-monospace, monospace",
            fontSize: 10,
          }}
          title={fetchedAt.toISOString()}
        >
          {t.lastUpdated}:{" "}
          {fetchedAgo !== null && fetchedAgo < 60_000
            ? lang === "ru"
              ? "только что"
              : "just now"
            : fetchedAgo !== null
              ? `${formatRelative(fetchedAgo, lang)} ${lang === "ru" ? "назад" : "ago"}`
              : fetchedAt.toLocaleTimeString()}
        </span>
      )}

      <style jsx>{`
        @keyframes aevion-pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(94, 234, 212, 0.6);
          }
          100% {
            box-shadow: 0 0 0 8px rgba(94, 234, 212, 0);
          }
        }
      `}</style>
    </div>
  );
}
