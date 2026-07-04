"use client";
/**
 * PresenceIndicator — «🟢 N играют сейчас».
 *
 * Любой открытый таб CyberChess раз в 20с пингует
 * POST /api-backend/api/cyberchess/matchmaking/presence/ping {userId}
 * и показывает live-счётчик онлайн-игроков (+ в очереди / в партиях).
 * Социальное доказательство — как «N players online» у lichess.
 *
 * Всё defensive: SSR-safe, сетевые ошибки глушатся (пилюля просто прячется),
 * никаких throw. Не ломает страницу, если backend недоступен.
 */

import React, { useEffect, useRef, useState } from "react";

const PING_URL = "/api-backend/api/cyberchess/matchmaking/presence/ping";
const PING_INTERVAL_MS = 20_000;

function stableUserId(): string {
  if (typeof window === "undefined") return "anon";
  try {
    let id = localStorage.getItem("cc_user_id");
    if (!id) {
      id = "u_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
      localStorage.setItem("cc_user_id", id);
    }
    return id;
  } catch {
    return "anon";
  }
}

type Presence = { online: number; inQueue: number; activeMatches: number };

export default function PresenceIndicator() {
  const [data, setData] = useState<Presence | null>(null);
  const [failed, setFailed] = useState(false);
  const idRef = useRef<string>("");

  useEffect(() => {
    idRef.current = stableUserId();
    let alive = true;
    let fails = 0;

    const ping = async () => {
      try {
        const r = await fetch(PING_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: idRef.current }),
          cache: "no-store",
        });
        if (!r.ok) throw new Error(String(r.status));
        const j = await r.json();
        if (!alive) return;
        if (j?.ok) {
          setData({
            online: Number(j.online) || 0,
            inQueue: Number(j.inQueue) || 0,
            activeMatches: Number(j.activeMatches) || 0,
          });
          setFailed(false);
          fails = 0;
        }
      } catch {
        if (!alive) return;
        // After 2 consecutive failures, hide the pill silently (backend offline).
        if (++fails >= 2) setFailed(true);
      }
    };

    ping();
    const t = setInterval(ping, PING_INTERVAL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  // Nothing to show until we have a successful read; hide on repeated failure.
  if (failed || !data) return null;

  const online = Math.max(1, data.online); // текущий таб уже онлайн → минимум 1
  const title =
    `${online} онлайн` +
    (data.inQueue ? ` · ${data.inQueue} в очереди` : "") +
    (data.activeMatches ? ` · ${data.activeMatches} партий идёт` : "");

  return (
    <span
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        background: "var(--cc-surface1, #1f2937)",
        border: "1px solid var(--cc-border, #374151)",
        fontSize: 12,
        fontWeight: 800,
        color: "var(--cc-text, #e5e7eb)",
        whiteSpace: "nowrap",
        lineHeight: 1,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "#22c55e",
          boxShadow: "0 0 0 0 rgba(34,197,94,0.6)",
          animation: "cc-presence-pulse 2s ease-in-out infinite",
          flexShrink: 0,
        }}
      />
      {online} онлайн
      {data.activeMatches > 0 && (
        <span style={{ color: "var(--cc-text-dim, #9ca3af)", fontWeight: 700 }}>
          · {data.activeMatches} игр
        </span>
      )}
      <style>{`@keyframes cc-presence-pulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,0.55)}70%{box-shadow:0 0 0 6px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}`}</style>
    </span>
  );
}
