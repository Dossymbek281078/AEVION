import type { Metadata } from "next";
import Link from "next/link";
import { getApiBase } from "@/lib/apiBase";
import { getServerT } from "@/lib/i18n-server";

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

type Series = { day: string; n: number }[];
type Timeseries = { vacancies: Series; applications: Series; projects: Series };

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

async function loadSeries(): Promise<Timeseries | null> {
  try {
    const r = await fetch(`${getApiBase()}/api/build/stats/timeseries`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { success: boolean; data?: Timeseries };
    return j?.data ?? null;
  } catch {
    return null;
  }
}

function Sparkline({
  values,
  stroke = "#34d399",
  fill = "rgba(52,211,153,0.15)",
}: {
  values: number[];
  stroke?: string;
  fill?: string;
}) {
  if (values.length === 0) return null;
  const w = 240;
  const h = 48;
  const max = Math.max(1, ...values);
  const step = w / (values.length - 1 || 1);
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * (h - 6) - 3).toFixed(1)}`)
    .join(" ");
  const area = `0,${h} ${points} ${w},${h}`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height={h}
      preserveAspectRatio="none"
      role="img"
      aria-label="14-day trend"
    >
      <polygon points={area} fill={fill} />
      <polyline points={points} fill="none" stroke={stroke} strokeWidth={1.6} />
    </svg>
  );
}

export default async function StatsPage() {
  const { t } = await getServerT();
  const [s, ts] = await Promise.all([load(), loadSeries()]);
  return (
    <main className="min-h-screen bg-[#06070b] px-6 py-16 text-white sm:px-10">
      <div className="mx-auto max-w-5xl">
        <div className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">
          AEVION QBuild · public dashboard
        </div>
        <h1 className="mt-3 text-4xl font-bold sm:text-5xl">
          {t("build.stats.heading")}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-300">
          {t("build.stats.descriptionPrefix")} <Link href="/build/why-aevion" className="text-emerald-300 hover:text-emerald-200">{t("build.stats.whyLinkText")}</Link>.
        </p>

        {!s ? (
          <p className="mt-10 rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-200">
            {t("build.stats.loadError")}
          </p>
        ) : (
          <>
            <section className="mt-10 grid gap-4 sm:grid-cols-3">
              <Tile label={t("build.stats.tileOpenVacancies")} big={s.vacancies.open} sub={t("build.stats.tileTotalSuffix", { total: s.vacancies.total })} accent="emerald" />
              <Tile label={t("build.stats.tileCandidates")} big={s.candidates} accent="sky" />
              <Tile label={t("build.stats.tileActiveProjects")} big={s.projects.open} sub={t("build.stats.tileTotalSuffix", { total: s.projects.total })} accent="fuchsia" />
            </section>
            <section className="mt-6 grid gap-4 sm:grid-cols-3">
              <Tile
                label={t("build.stats.tileTotalApplications")}
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
                sub={t("build.stats.cashbackSub", { entries: s.cashback.entries })}
                accent="emerald"
              />
            </section>
            {ts && (
              <section className="mt-10">
                <div className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                  {t("build.stats.last14Days")}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <SparkTile
                    label={t("build.stats.sparkNewVacancies")}
                    series={ts.vacancies}
                    stroke="#34d399"
                    fill="rgba(52,211,153,0.15)"
                    totalSuffix={t("build.stats.sparkTotalSuffix")}
                    trendSuffix={t("build.stats.sparkTrendSuffix")}
                  />
                  <SparkTile
                    label={t("build.stats.sparkApplications")}
                    series={ts.applications}
                    stroke="#7dd3fc"
                    fill="rgba(125,211,252,0.15)"
                    totalSuffix={t("build.stats.sparkTotalSuffix")}
                    trendSuffix={t("build.stats.sparkTrendSuffix")}
                  />
                  <SparkTile
                    label={t("build.stats.sparkNewProjects")}
                    series={ts.projects}
                    stroke="#f0abfc"
                    fill="rgba(240,171,252,0.15)"
                    totalSuffix={t("build.stats.sparkTotalSuffix")}
                    trendSuffix={t("build.stats.sparkTrendSuffix")}
                  />
                </div>
              </section>
            )}

            <p className="mt-8 text-[11px] text-slate-500">
              {t("build.stats.updatedAt", { timestamp: new Date(s.timestamp).toLocaleString("ru-RU") })}
            </p>
          </>
        )}

        <div className="mt-12 flex flex-wrap gap-3">
          <Link
            href="/build"
            className="rounded-full bg-emerald-400 px-6 py-3 text-sm font-bold text-emerald-950 transition hover:bg-emerald-300"
          >
            {t("build.stats.openQBuild")}
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
            {t("build.stats.pricingLink")}
          </Link>
        </div>
      </div>
    </main>
  );
}

function SparkTile({
  label,
  series,
  stroke,
  fill,
  totalSuffix,
  trendSuffix,
}: {
  label: string;
  series: Series;
  stroke: string;
  fill: string;
  totalSuffix: string;
  trendSuffix: string;
}) {
  const total = series.reduce((s, p) => s + p.n, 0);
  const last = series[series.length - 1]?.n ?? 0;
  const prev = series.length > 1 ? series[series.length - 2]!.n : 0;
  const trend = last - prev;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-[11px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-white">{total}</span>
        <span className="text-[11px] text-slate-500">{totalSuffix}</span>
        {trend !== 0 && (
          <span className={`text-[11px] font-semibold ${trend > 0 ? "text-emerald-300" : "text-rose-300"}`}>
            {trend > 0 ? "▲" : "▼"} {Math.abs(trend)} {trendSuffix}
          </span>
        )}
      </div>
      <div className="mt-2">
        <Sparkline values={series.map((p) => p.n)} stroke={stroke} fill={fill} />
      </div>
    </div>
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
