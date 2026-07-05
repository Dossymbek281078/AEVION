"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";

/**
 * Free-tier token usage meter for QCoreAI. Reads GET /api/qcoreai/me/token-quota
 * and renders a slim bar with an upgrade nudge — but ONLY for logged-in free
 * users while the quota is actually enforced (metered=true). Renders nothing for
 * anonymous visitors, paid tiers, or when the quota gate is off, so it never
 * shows a misleading limit. Fails silent on any error.
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
        if (alive && d && d.metered && d.limitTokens) setQ(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!q || !q.metered || !q.limitTokens) return null;

  const limit = q.limitTokens;
  const used = Math.max(0, q.usedTokens ?? 0);
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const near = pct >= 80 || q.exceeded;
  const fmt = (n: number) => n.toLocaleString("ru-RU");

  return (
    <div className="w-full border-b border-white/10 bg-black/40 px-4 py-2 text-xs text-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2">
        <span className="whitespace-nowrap">
          Бесплатный лимит QCoreAI:{" "}
          <b className={q.exceeded ? "text-red-400" : "text-white"}>{fmt(used)}</b> / {fmt(limit)} токенов в этом месяце
        </span>
        <div className="h-1.5 min-w-[120px] flex-1 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full transition-all ${
              q.exceeded ? "bg-red-500" : near ? "bg-amber-400" : "bg-emerald-400"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {near && (
          <Link
            href="/pricing"
            className="whitespace-nowrap rounded-md bg-white/90 px-2.5 py-1 font-medium text-black transition-colors hover:bg-white"
          >
            {q.exceeded ? "Лимит исчерпан — перейти на платный" : "Осталось мало — Upgrade"}
          </Link>
        )}
      </div>
    </div>
  );
}
