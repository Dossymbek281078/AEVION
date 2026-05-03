import type { Metadata } from "next";
import Link from "next/link";
import { getApiBase } from "@/lib/apiBase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AEVION QBuild — public stats",
  description:
    "Realtime metrics of the AEVION QBuild construction recruiting platform — vacancies, candidates, applications, trial jobs, AEV cashback minted.",
};

type Stats = {
  vacancies: { open: number; total: number };
  candidates: number;
  projects: { total: number; open: number };
  applications: { total: number; accepted: number; acceptRate: number };
  trials: { total: number; approved: number };
  cashback: { totalAev: number; entries: number };
  timestamp: string;
};

async function load(): Promise<Stats | null> {
  try {
    const r = await fetch(`${getApiBase()}/api/build/stats`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { success: boolean; data?: Stats };
    return j?.data ?? null;
  } catch {
    return null;
  }
}

export default async function StatsPage() {
  const s = await load();
  return (
    <main className="min-h-screen bg-[#06070b] px-6 py-16 text-white sm:px-10">
      <div className="mx-auto max-w-5xl">
        <div className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">
          AEVION QBuild · public dashboard
        </div>
        <h1 className="mt-3 text-4xl font-bold sm:text-5xl">
          Метрики платформы — в реальном времени
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-300">
          Все цифры обновляются с каждым запросом. Без приукрашивания, без VC-метрик. Если стало интересно — <Link href="/build/why-aevion" className="text-emerald-300 hover:text-emerald-200">почему AEVION QBuild лучше HH</Link>.
        </p>

        {!s ? (
          <p className="mt-10 rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-200">
            Не удалось загрузить статистику. Попробуйте позже.
          </p>
        ) : (
          <>
            <section className="mt-10 grid gap-4 sm:grid-cols-3">
              <Tile label="Открытых вакансий" big={s.vacancies.open} sub={`${s.vacancies.total} всего`} accent="emerald" />
              <Tile label="Кандидатов в базе" big={s.candidates} accent="sky" />
              <Tile label="Активных проектов" big={s.projects.open} sub={`${s.projects.total} всего`} accent="fuchsia" />
            </section>
            <section className="mt-6 grid gap-4 sm:grid-cols-3">
              <Tile
                label="Откликов всего"
                big={s.applications.total}
                sub={`${s.applications.accepted} ACCEPTED · ${s.applications.acceptRate}% acceptance rate`}
              />
              <Tile
                label="Trial Jobs"
                big={s.trials.total}
                sub={`${s.trials.approved} APPROVED`}
              />
              <Tile
                label="AEV cashback minted"
                big={s.cashback.totalAev.toLocaleString("ru-RU", { maximumFractionDigits: 4 })}
                sub={`${s.cashback.entries} PAID-заказов`}
                accent="emerald"
              />
            </section>
            <p className="mt-8 text-[11px] text-slate-500">
              Обновлено: {new Date(s.timestamp).toLocaleString("ru-RU")}
            </p>
          </>
        )}

        <div className="mt-12 flex flex-wrap gap-3">
          <Link
            href="/build"
            className="rounded-full bg-emerald-400 px-6 py-3 text-sm font-bold text-emerald-950 transition hover:bg-emerald-300"
          >
            Открыть QBuild →
          </Link>
          <Link
            href="/build/leaderboard"
            className="rounded-full border border-amber-500/40 bg-amber-500/10 px-6 py-3 text-sm font-semibold text-amber-200 hover:bg-amber-500/20"
          >
            Leaderboard 🏆
          </Link>
          <Link
            href="/build/why-aevion"
            className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white hover:bg-white/5"
          >
            Why AEVION
          </Link>
          <Link
            href="/build/pricing"
            className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white hover:bg-white/5"
          >
            Тарифы
          </Link>
        </div>
      </div>
    </main>
  );
}

function Tile({
  label,
  big,
  sub,
  accent,
}: {
  label: string;
  big: string | number;
  sub?: string;
  accent?: "emerald" | "sky" | "fuchsia";
}) {
  const tone =
    accent === "emerald"
      ? "text-emerald-300"
      : accent === "sky"
        ? "text-sky-300"
        : accent === "fuchsia"
          ? "text-fuchsia-300"
          : "text-white";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="text-xs uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`mt-2 text-4xl font-bold ${tone}`}>{big}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}
