import type { Metadata } from "next";
import Link from "next/link";
import { getApiBase } from "@/lib/apiBase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AEVION QBuild — Referral leaderboard",
  description:
    "Top community members who help others land construction jobs on AEVION QBuild. Share vacancy ref-links, climb the board.",
};

type Row = {
  userId: string;
  name: string | null;
  totalReferred: number;
  acceptedReferred: number;
};

async function load(): Promise<Row[]> {
  try {
    const r = await fetch(`${getApiBase()}/api/build/referrals/leaderboard?limit=50`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return [];
    const j = (await r.json()) as { success: boolean; data?: { items: Row[] } };
    return j?.data?.items ?? [];
  } catch {
    return [];
  }
}

export default async function ReferralsPage() {
  const rows = await load();
  return (
    <main className="min-h-screen bg-[#06070b] px-6 py-16 text-white sm:px-10">
      <div className="mx-auto max-w-3xl">
        <div className="text-xs font-bold uppercase tracking-[0.25em] text-fuchsia-300">
          AEVION QBuild · Community
        </div>
        <h1 className="mt-3 text-4xl font-bold sm:text-5xl">Referral leaderboard</h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-300">
          Делитесь ссылками на вакансии с пометкой ref — ваш user-id появляется в этом списке когда друг откликается, и поднимается в топ когда друга нанимают. Скоро привяжем награды.
        </p>

        <div className="mt-10 overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.04] text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="w-12 px-3 py-3 text-left font-semibold">#</th>
                <th className="px-3 py-3 text-left font-semibold">Member</th>
                <th className="px-3 py-3 text-right font-semibold">Hires</th>
                <th className="px-3 py-3 text-right font-semibold">Referred</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-500">
                    Пока никто не делился ref-ссылками. Будьте первым 🎯
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={r.userId} className={i < 3 ? "bg-fuchsia-500/[0.03]" : ""}>
                    <td className="px-3 py-3 font-mono text-xs text-slate-500">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                    </td>
                    <td className="px-3 py-3 text-sm font-semibold text-white">
                      {r.name || `${r.userId.slice(0, 8)}…`}
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-emerald-200">
                      {r.acceptedReferred}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-300">{r.totalReferred}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-[11px] text-slate-500">
          Сортировка: количество ACCEPTED-наймов → общее число рефералов.
        </p>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link
            href="/build/vacancies"
            className="rounded-full bg-emerald-400 px-6 py-3 text-sm font-bold text-emerald-950 transition hover:bg-emerald-300"
          >
            Поделиться вакансией →
          </Link>
          <Link
            href="/build/why-aevion"
            className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white hover:bg-white/5"
          >
            Why AEVION
          </Link>
        </div>
      </div>
    </main>
  );
}
