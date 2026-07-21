import type { Metadata } from "next";
import Link from "next/link";
import { getApiBase } from "@/lib/apiBase";
import { getServerT } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Success Stories — AEVION QBuild",
  description:
    "Real construction workers hired through AEVION QBuild. Every success story is a worker who found a job and an employer who found their crew.",
  openGraph: {
    title: "QBuild Success Stories",
    description: "Real hires made through AEVION QBuild construction recruiting platform.",
    type: "website",
  },
};

type HireRow = {
  vacancyTitle: string;
  projectTitle: string | null;
  projectCity: string | null;
  recruiterName: string;
  workerName: string;
  salary: number;
  salaryCurrency: string;
  acceptedAt: string;
};

async function fetchHires(): Promise<HireRow[]> {
  try {
    const r = await fetch(`${getApiBase()}/api/build/stats/hires?limit=20`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return [];
    const j = await r.json();
    return j?.data?.items ?? [];
  } catch {
    return [];
  }
}

// ── Hardcoded case studies shown above the live feed ──────────────────────────

type CaseStudy = {
  quoteKey: string;
  nameKey: string;
  roleKey: string;
  cityKey: string;
  detailKey: string;
  metric: string;
  metricLabelKey: string;
  accent: "emerald" | "sky" | "fuchsia";
};

const CASE_STUDIES: CaseStudy[] = [
  {
    quoteKey: "build.successStories.case1Quote",
    nameKey: "build.successStories.case1Name",
    roleKey: "build.successStories.case1Role",
    cityKey: "build.successStories.case1City",
    detailKey: "build.successStories.case1Detail",
    metric: "4",
    metricLabelKey: "build.successStories.case1MetricLabel",
    accent: "emerald",
  },
  {
    quoteKey: "build.successStories.case2Quote",
    nameKey: "build.successStories.case2Name",
    roleKey: "build.successStories.case2Role",
    cityKey: "build.successStories.case2City",
    detailKey: "build.successStories.case2Detail",
    metric: "87",
    metricLabelKey: "build.successStories.case2MetricLabel",
    accent: "sky",
  },
  {
    quoteKey: "build.successStories.case3Quote",
    nameKey: "build.successStories.case3Name",
    roleKey: "build.successStories.case3Role",
    cityKey: "build.successStories.case3City",
    detailKey: "build.successStories.case3Detail",
    metric: "47",
    metricLabelKey: "build.successStories.case3MetricLabel",
    accent: "fuchsia",
  },
  {
    quoteKey: "build.successStories.case4Quote",
    nameKey: "build.successStories.case4Name",
    roleKey: "build.successStories.case4Role",
    cityKey: "build.successStories.case4City",
    detailKey: "build.successStories.case4Detail",
    metric: "3",
    metricLabelKey: "build.successStories.case4MetricLabel",
    accent: "emerald",
  },
];

const ACCENT_STYLES: Record<CaseStudy["accent"], { border: string; bg: string; badge: string; metric: string }> = {
  emerald: {
    border: "border-emerald-500/20",
    bg: "bg-emerald-500/5",
    badge: "bg-emerald-500/15 text-emerald-200 border-emerald-500/25",
    metric: "text-emerald-300",
  },
  sky: {
    border: "border-sky-500/20",
    bg: "bg-sky-500/5",
    badge: "bg-sky-500/15 text-sky-200 border-sky-500/25",
    metric: "text-sky-300",
  },
  fuchsia: {
    border: "border-fuchsia-500/20",
    bg: "bg-fuchsia-500/5",
    badge: "bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-500/25",
    metric: "text-fuchsia-300",
  },
};

export default async function SuccessStoriesPage() {
  const { t } = await getServerT();
  const hires = await fetchHires();

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-3xl">
        {/* Breadcrumb */}
        <Link href="/build" className="text-xs text-slate-400 hover:underline">
          ← QBuild
        </Link>

        {/* Hero */}
        <div className="mt-4 mb-2 text-xs font-bold uppercase tracking-wider text-emerald-300">
          AEVION QBuild
        </div>
        <h1 className="text-3xl font-extrabold text-white">Success stories</h1>
        <p className="mt-2 text-sm text-slate-400 max-w-xl">
          {t("build.successStories.heroSubtitle")}
        </p>

        {/* Stats strip */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            { value: t("build.successStories.statHoursValue"), label: t("build.successStories.statDays") },
            { value: "6%", label: t("build.successStories.statPayPerHireMin") },
            { value: "100%", label: t("build.successStories.statNoHiddenFees") },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center"
            >
              <div className="text-2xl font-bold text-emerald-300">{s.value}</div>
              <div className="mt-0.5 text-[11px] uppercase tracking-wider text-slate-500">
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* ── Case Studies ── */}
        <h2 className="mt-12 mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">
          {t("build.successStories.caseStudiesHeading")}
        </h2>
        <div className="space-y-5">
          {CASE_STUDIES.map((cs) => {
            const s = ACCENT_STYLES[cs.accent];
            return (
              <article
                key={cs.nameKey}
                className={`rounded-2xl border ${s.border} ${s.bg} p-6`}
              >
                <div className="flex items-start gap-4">
                  {/* Metric */}
                  <div className="shrink-0 text-center w-16">
                    <div className={`text-3xl font-extrabold leading-none ${s.metric}`}>
                      {cs.metric}
                    </div>
                    <div className="mt-0.5 text-[10px] uppercase leading-tight text-slate-500">
                      {t(cs.metricLabelKey)}
                    </div>
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <blockquote className="text-sm leading-relaxed text-slate-200 italic">
                      &ldquo;{t(cs.quoteKey)}&rdquo;
                    </blockquote>
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white">{t(cs.nameKey)}</span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${s.badge}`}
                      >
                        {t(cs.cityKey)}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">{t(cs.roleKey)}</div>
                    <p className="mt-3 text-xs leading-relaxed text-slate-400 border-l-2 border-white/10 pl-3">
                      {t(cs.detailKey)}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* ── Live hires feed ── */}
        <h2 className="mt-12 mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">
          {t("build.successStories.liveFeedHeading")}
        </h2>

        {hires.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
            <div className="text-4xl">🏗</div>
            <p className="mt-3 text-sm text-slate-400">
              {t("build.successStories.emptyFeedText")}
            </p>
            <Link
              href="/build/vacancies"
              className="mt-4 inline-block rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400"
            >
              {t("build.successStories.viewVacancies")}
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {hires.map((h, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-4"
              >
                <span className="text-xl mt-0.5">✅</span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-white text-sm">{h.workerName}</div>
                  <div className="mt-0.5 text-xs text-emerald-200">{t("build.successStories.hiredAs", { vacancyTitle: h.vacancyTitle })}</div>
                  <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-slate-400">
                    {h.projectTitle && <span>{h.projectTitle}</span>}
                    {h.projectCity && <span>📍 {h.projectCity}</span>}
                    {h.salary > 0 && (
                      <span>
                        {h.salary.toLocaleString("ru-RU")} {h.salaryCurrency}
                      </span>
                    )}
                    <span>{new Date(h.acceptedAt).toLocaleDateString("ru-RU")}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Your story CTA ── */}
        <div className="mt-12 rounded-2xl border border-white/10 bg-white/[0.02] p-7">
          <h2 className="text-lg font-bold text-white">{t("build.successStories.ctaHeading")}</h2>
          <p className="mt-1 text-sm text-slate-400 max-w-lg">
            {t("build.successStories.ctaSubtitle")}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/build/create-project"
              className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 transition"
            >
              {t("build.successStories.postVacancy")}
            </Link>
            <Link
              href="/build/vacancies"
              className="rounded-xl border border-white/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition"
            >
              {t("build.successStories.findWork")}
            </Link>
            <Link
              href="/build/stories"
              className="rounded-xl border border-emerald-500/30 px-5 py-2.5 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/10 transition"
            >
              📣 Site Stories
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
