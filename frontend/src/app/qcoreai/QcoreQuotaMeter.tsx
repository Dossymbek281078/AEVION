"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";

/**
 * Token usage meter for QCoreAI. Reads GET /api/qcoreai/me/token-quota and
 * renders a slim bar (plus a second bar for the premium-model sub-cap, when
 * that gate is also on) with an upgrade nudge — only while the relevant gate
 * is actually enforced (metered / premiumMetered). Renders nothing for
 * anonymous visitors or while every gate is off, so it never shows a
 * misleading limit. Fails silent on any error.
 *
 * `metered` covers BOTH the free-tier gate (QCOREAI_FREE_QUOTA) and the
 * paid-tier overall cap (QCOREAI_TIER_QUOTA, added 2026-07-22) — copy reads
 * "free" only when tier === "free", generic "monthly limit" otherwise, so a
 * paid subscriber under QCOREAI_TIER_QUOTA doesn't see a "free limit" label.
 */
function bearerHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const t = localStorage.getItem("aevion_token") ?? sessionStorage.getItem("qcoreai_token") ?? "";
  return t ? { Authorization: `Bearer ${t}` } : {};
}

interface TokenQuota {
  tier: string;
  metered: boolean;
  usedTokens: number;
  limitTokens: number | null;
  remainingTokens: number | null;
  exceeded: boolean;
  premiumMetered?: boolean;
  premiumUsedTokens?: number | null;
  premiumLimitTokens?: number | null;
  premiumRemainingTokens?: number | null;
  premiumExceeded?: boolean;
}

function Bar({
  label,
  used,
  limit,
  exceeded,
  showUpgrade,
}: {
  label: string;
  used: number;
  limit: number;
  exceeded: boolean;
  showUpgrade: boolean;
}) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const near = pct >= 80 || exceeded;
  const fmt = (n: number) => n.toLocaleString("ru-RU");

  return (
    <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2">
      <span className="whitespace-nowrap">
        {label}: <b className={exceeded ? "text-red-400" : "text-white"}>{fmt(used)}</b> / {fmt(limit)} токенов в этом месяце
      </span>
      <div className="h-1.5 min-w-[120px] flex-1 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all ${
            exceeded ? "bg-red-500" : near ? "bg-amber-400" : "bg-emerald-400"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showUpgrade && near && (
        <Link
          href="/pricing"
          className="whitespace-nowrap rounded-md bg-white/90 px-2.5 py-1 font-medium text-black transition-colors hover:bg-white"
        >
          {exceeded ? "Лимит исчерпан — перейти на платный" : "Осталось мало — Upgrade"}
        </Link>
      )}
    </div>
  );
}

export default function QcoreQuotaMeter() {
  const [q, setQ] = useState<TokenQuota | null>(null);

  useEffect(() => {
    const headers = bearerHeader();
    if (!("Authorization" in headers)) return; // anonymous — nothing to meter
    let alive = true;
    fetch(apiUrl("/api/qcoreai/me/token-quota"), { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: TokenQuota | null) => {
        if (alive && d && ((d.metered && d.limitTokens) || (d.premiumMetered && d.premiumLimitTokens))) setQ(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!q) return null;
  const showOverall = q.metered && !!q.limitTokens;
  const showPremium = !!q.premiumMetered && !!q.premiumLimitTokens;
  if (!showOverall && !showPremium) return null;

  return (
    <div className="w-full space-y-1.5 border-b border-white/10 bg-black/40 px-4 py-2 text-xs text-white/80 backdrop-blur">
      {showOverall && (
        <Bar
          label={q.tier === "free" ? "Бесплатный лимит QCoreAI" : "Месячный лимит QCoreAI"}
          used={Math.max(0, q.usedTokens ?? 0)}
          limit={q.limitTokens as number}
          exceeded={q.exceeded}
          showUpgrade={!showPremium}
        />
      )}
      {showPremium && (
        <Bar
          label="Лимит на топовые модели"
          used={Math.max(0, q.premiumUsedTokens ?? 0)}
          limit={q.premiumLimitTokens as number}
          exceeded={!!q.premiumExceeded}
          showUpgrade
        />
      )}
    </div>
  );
}
