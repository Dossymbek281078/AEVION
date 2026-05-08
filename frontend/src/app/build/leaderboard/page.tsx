import type { Metadata } from "next";
import Link from "next/link";
import { getApiBase } from "@/lib/apiBase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "QBuild Leaderboard — Top Employers & Workers",
  description: "Top-rated employers and workers on AEVION QBuild construction platform.",
};

type LeaderRow = {
  userId: string;
  name: string;
  city: string | null;
  buildRole: string;
  avgRating: number;
  reviewCount: number;
  verifiedAt: string | null;
};

async function fetchLeaders(): Promise<{ employers: LeaderRow[]; workers: LeaderRow[] }> {
  try {
    const r = await fetch(`${getApiBase()}/api/build/stats/leaderboard`, {
      cache: "no-store", signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return { employers: [], workers: [] };
    const j = await r.json();
    return j?.data ?? { employers: [], workers: [] };
  } catch {
    return { employers: [], workers: [] };
  }
}

export default async function LeaderboardPage() {
  const { employers, workers } = await fetchLeaders();

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-4xl">
        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-300">
          AEVION QBuild
        </div>
        <h1 className="text-3xl font-extrabold text-white">Leaderboard</h1>
        <p className="mt-2 text-sm text-slate-400">Top-rated employers and workers by review score.</p>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <Section title="🏆 Top Employers" items={employers} emptyLabel="No employers yet." />
          <Section title="⭐ Top Workers" items={workers} emptyLabel="No workers yet." />
        </div>

        <div className="mt-10 text-center">
          <Link href="/build/vacancies" className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-emerald-950 hover:bg-emerald-400">
            Browse vacancies →
          </Link>
        </div>
      </div>
    </main>
  );
}

function Section({ title, items, emptyLabel }: { title: string; items: LeaderRow[]; emptyLabel: string }) {
  return (
    <section>
      <h2 className="mb-4 text-lg font-bold text-white">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">{emptyLabel}</p>
      ) : (
        <ol className="space-y-2">
          {items.map((row, i) => (
            <li key={row.userId}>
              <Link
                href={`/build/u/${encodeURIComponent(row.userId)}`}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition hover:border-white/20 hover:bg-white/10"
              >
                <span className="w-6 text-center text-sm font-bold text-slate-500">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white truncate">{row.name}</span>
                    {row.verifiedAt && (
                      <span className="rounded-full bg-sky-500/20 px-1.5 py-0.5 text-[9px] font-bold text-sky-200">✓</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400">
                    {row.buildRole}{row.city ? ` · ${row.city}` : ""}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-yellow-400">
                    {"★".repeat(Math.round(row.avgRating))}{" "}
                    <span className="text-white">{row.avgRating.toFixed(1)}</span>
                  </div>
                  <div className="text-[10px] text-slate-500">{row.reviewCount} review{row.reviewCount !== 1 ? "s" : ""}</div>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
