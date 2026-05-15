"use client";

/**
 * FintechHealthBadge — compact live health indicator for the 5 fintech modules.
 * Polls each module's /health endpoint every 60s and shows aggregate status.
 *
 * Usage:
 *   <FintechHealthBadge compact />     — single pill, hover for details
 *   <FintechHealthBadge />              — full row with per-module dots
 *
 * Zone: aevion-core/main owns frontend/src/components/fintech/**
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { getApiBase } from "@/lib/apiBase";

const MODULES = [
  { key: "qgood",          path: "/api/qgood/health",           emoji: "💚", color: "#34d399" },
  { key: "qmaskcard",      path: "/api/qmaskcard/health",       emoji: "🪪", color: "#a78bfa" },
  { key: "veilnetx",       path: "/api/veilnetx-ledger/health", emoji: "🌀", color: "#a78bfa" },
  { key: "ztide",          path: "/api/ztide/health",           emoji: "🌊", color: "#fbbf24" },
  { key: "qchaingov",      path: "/api/qchaingov/health",       emoji: "🗳", color: "#f472b6" },
];

type Status = "ok" | "degraded" | "down" | "checking";

const STATUS_COLOR: Record<Status, string> = {
  ok: "#34d399",
  degraded: "#fbbf24",
  down: "#ef4444",
  checking: "#64748b",
};

export default function FintechHealthBadge({ compact = false }: { compact?: boolean }) {
  const [results, setResults] = useState<Record<string, Status>>(() => {
    const initial: Record<string, Status> = {};
    for (const m of MODULES) initial[m.key] = "checking";
    return initial;
  });

  useEffect(() => {
    const probe = async () => {
      const apiBase = getApiBase();
      const next: Record<string, Status> = {};
      await Promise.all(MODULES.map(async (m) => {
        try {
          const r = await fetch(`${apiBase}${m.path}`, {
            signal: AbortSignal.timeout(4000),
            headers: { Accept: "application/json" },
          });
          if (r.ok) {
            const body = await r.json().catch(() => ({}));
            next[m.key] = body?.status === "degraded" ? "degraded" : "ok";
          } else {
            next[m.key] = r.status >= 500 ? "down" : "degraded";
          }
        } catch {
          next[m.key] = "down";
        }
      }));
      setResults(next);
    };
    probe();
    const t = setInterval(probe, 60_000);
    return () => clearInterval(t);
  }, []);

  const statuses = Object.values(results);
  const allOk = statuses.every(s => s === "ok");
  const anyDown = statuses.some(s => s === "down");
  const overall: Status = anyDown ? "down" : allOk ? "ok" : "degraded";
  const okCount = statuses.filter(s => s === "ok").length;

  if (compact) {
    return (
      <Link
        href="/fintech/status"
        title={`Fintech health: ${MODULES.map(m => `${m.key}=${results[m.key]}`).join(", ")}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "3px 9px",
          borderRadius: 999,
          border: `1px solid ${STATUS_COLOR[overall]}30`,
          background: `${STATUS_COLOR[overall]}12`,
          fontSize: 11,
          fontWeight: 700,
          color: STATUS_COLOR[overall],
          textDecoration: "none",
          cursor: "pointer",
        }}
      >
        <span style={{
          width: 7, height: 7, borderRadius: "50%",
          background: STATUS_COLOR[overall],
          ...(overall === "ok" ? { boxShadow: `0 0 4px ${STATUS_COLOR[overall]}` } : {}),
        }} />
        <span>Fintech {okCount}/{MODULES.length}</span>
      </Link>
    );
  }

  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "5px 12px",
      borderRadius: 8,
      border: `1px solid ${STATUS_COLOR[overall]}30`,
      background: "rgba(15,23,42,0.4)",
    }}>
      <span style={{ fontSize: 10, fontWeight: 800, color: STATUS_COLOR[overall], letterSpacing: 0.5, textTransform: "uppercase" as const }}>
        Fintech
      </span>
      {MODULES.map(m => {
        const s = results[m.key];
        return (
          <span
            key={m.key}
            title={`${m.key}: ${s}`}
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: STATUS_COLOR[s],
              opacity: s === "checking" ? 0.4 : 1,
              transition: "background 0.3s",
            }}
          />
        );
      })}
      <Link href="/fintech/status" style={{ fontSize: 10, color: STATUS_COLOR[overall], fontWeight: 700, textDecoration: "none", marginLeft: 4 }}>
        details →
      </Link>
    </div>
  );
}
