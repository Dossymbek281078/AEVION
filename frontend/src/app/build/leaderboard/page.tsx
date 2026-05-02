"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buildApi, type LeaderboardRow } from "@/lib/build/api";

const TIER_BADGE: Record<string, string> = {
  PLATINUM: "bg-cyan-500/20 text-cyan-200 border-cyan-500/40",
  GOLD: "bg-amber-500/20 text-amber-200 border-amber-500/40",
  SILVER: "bg-slate-500/20 text-slate-200 border-slate-500/40",
  BRONZE: "bg-orange-500/20 text-orange-200 border-orange-500/40",
  DEFAULT: "bg-white/5 text-slate-300 border-white/10",
};

export default function LeaderboardPage() {
  const [kind, setKind] = useState<"employer" | "worker">("employer");
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setRows(null);
    buildApi
      .leaderboard(kind, 30)
      .then((r) => setRows(r.items))
      .catch((e) => setErr((e as Error).message));
  }, [kind]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-white">⭐ Лидерборд</h1>
        <p className="text-sm text-slate-400">
          Лучшие работодатели по найму и лучшие работники по рейтингу.
        </p>
      </div>

      <div className="mb-4 inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-1">
        <button
          onClick={() => setKind("employer")}
          className={`rounded-md px-3 py-1.5 text-sm ${kind === "employer" ? "bg-emerald-500 text-emerald-950" : "text-slate-300"}`}
        >
          Работодатели
        </button>
        <button
          onClick={() => setKind("worker")}
          className={`rounded-md px-3 py-1.5 text-sm ${kind === "worker" ? "bg-emerald-500 text-emerald-950" : "text-slate-300"}`}
        >
          Работники
        </button>
      </div>

      {err && <p className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{err}</p>}

      {rows === null && <p className="text-sm text-slate-500">Загружаю…</p>}
      {rows && rows.length === 0 && (
        <p className="rounded-lg border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-slate-500">
          Пока никого. Будь первым.
        </p>
      )}

      <ol className="space-y-2">
        {rows?.map((row, i) => (
          <li key={row.userId} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <span className="w-8 text-center text-lg font-bold text-slate-400">{i + 1}</span>
            {row.photoUrl ? (
              <img src={row.photoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-700 text-sm font-bold text-slate-300">
                {(row.name || "?")[0]}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <Link href={`/build/u/${row.userId}`} className="font-semibold text-white hover:underline">
                {row.name}
              </Link>
              <div className="text-xs text-slate-400">
                {row.title || row.city || "—"}
                {row.avgRating != null && (
                  <> · ⭐ {row.avgRating.toFixed(2)} <span className="text-slate-500">({row.reviewCount})</span></>
                )}
              </div>
            </div>
            <div className="text-right">
              {kind === "employer" ? (
                <>
                  <div className="text-base font-bold text-emerald-300">{row.hires} hires</div>
                  {row.tierKey && (
                    <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${TIER_BADGE[row.tierKey] ?? TIER_BADGE.DEFAULT}`}>
                      {row.tierLabel}
                    </span>
                  )}
                </>
              ) : (
                <div className="text-base font-bold text-emerald-300">{row.trialsApproved ?? 0} trials</div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}
