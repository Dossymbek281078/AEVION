"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BuildShell } from "@/components/build/BuildShell";
import { ProjectCard } from "@/components/build/ProjectCard";
import { Skeleton } from "@/components/build/Skeleton";
import { buildApi, type BuildProject, type ProjectStatus } from "@/lib/build/api";
import { formatSalary } from "@/lib/build/format";
import { useBuildAuth } from "@/lib/build/auth";
import { useI18n } from "@/lib/i18n";

const STATUS_FILTERS: (ProjectStatus | "ALL")[] = ["ALL", "OPEN", "IN_PROGRESS", "DONE"];

export default function BuildHomePage() {
  const { t } = useI18n();
  const token = useBuildAuth((s) => s.token);
  const hydrated = useBuildAuth((s) => s.hydrated);
  const [projects, setProjects] = useState<BuildProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ProjectStatus | "ALL">("ALL");
  const [q, setQ] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [publicStats, setPublicStats] = useState<{
    vacancies: number;
    candidates: number;
    projects: number;
  } | null>(null);
  // Platform-wide summary for the stat cards (real DB counts, not the
  // capped/filtered list length — keeps the cards consistent with the hero).
  const [summary, setSummary] = useState<{
    total: number;
    open: number;
    inProgress: number;
    vacancies: number;
  } | null>(null);

  useEffect(() => {
    buildApi
      .publicStats()
      .then((r) => setPublicStats(r))
      .catch(() => {});
    buildApi
      .buildStats()
      .then((r) =>
        setSummary({
          total: r.projects.total,
          open: r.projects.open,
          inProgress: r.projects.inProgress,
          vacancies: r.vacancies.total,
        }),
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    buildApi
      .listProjects({
        status: status === "ALL" ? undefined : status,
        q: q.trim() || undefined,
        mine: mineOnly && !!token ? true : undefined,
        limit: 100,
      })
      .then((r) => {
        if (!cancelled) setProjects(r.items);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status, q, mineOnly, token]);

  const stats = useMemo(() => {
    return {
      total: projects.length,
      open: projects.filter((p) => p.status === "OPEN").length,
      active: projects.filter((p) => p.status === "IN_PROGRESS").length,
      vacancies: projects.reduce((acc, p) => acc + (p.vacancyCount || 0), 0),
    };
  }, [projects]);

  return (
    <BuildShell theme="light">
      {hydrated && !token && <LandingHero publicStats={publicStats} />}
      {hydrated && token && <SmartSuggestions />}

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-paper-ink">Construction projects</h1>
          <p className="mt-1 text-sm text-paper-ink-faint">
            Browse open projects, post a vacancy, or apply directly.
          </p>
        </div>
        <Link
          href="/build/create-project"
          className="rounded-lg bg-paper-teal px-4 py-2 text-sm font-semibold text-white transition hover:bg-paper-teal-deep"
        >
          + New project
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total" value={summary?.total ?? stats.total} />
        <Stat label="Open" value={summary?.open ?? stats.open} tone="emerald" />
        <Stat label="In progress" value={summary?.inProgress ?? stats.active} tone="amber" />
        <Stat label="Vacancies" value={summary?.vacancies ?? stats.vacancies} />
      </div>

      <LiveActivityBand />

      <FeaturedEmployers />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search by title or description"
          placeholder="Search by title or description…"
          className="flex-1 rounded-lg border border-paper-rule bg-white px-3 py-2 text-sm text-paper-ink placeholder:text-paper-ink-faint-2 focus:border-paper-teal focus:outline-none"
        />
        {token && (
          <button
            onClick={() => setMineOnly((v) => !v)}
            aria-pressed={mineOnly}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              mineOnly
                ? "bg-paper-teal text-white"
                : "border border-paper-rule bg-white text-paper-ink-soft hover:bg-paper-2"
            }`}
          >
            {mineOnly ? "✓ Mine only" : "Mine only"}
          </button>
        )}
        <div className="flex items-center gap-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                status === s
                  ? "bg-paper-teal text-white"
                  : "border border-paper-rule bg-white text-paper-ink-soft hover:bg-paper-2"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      {loading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-paper-rule bg-white p-4">
              <Skeleton width="70%" height={16} />
              <Skeleton width="100%" height={11} className="mt-3" />
              <Skeleton width="85%" height={11} className="mt-1.5" />
              <div className="mt-3 flex justify-between">
                <Skeleton width={70} height={11} />
                <Skeleton width={50} height={11} />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && projects.length === 0 && mineOnly && token && (
        <FirstProjectCta />
      )}

      {!loading && projects.length === 0 && !(mineOnly && token) && (
        <div className="rounded-xl border border-paper-rule bg-white p-8 text-center">
          <p className="text-sm text-paper-ink-soft">
            No projects match these filters. Try clearing the search or{" "}
            <Link href="/build/create-project" className="text-paper-teal-deep underline">
              post the first one
            </Link>
            .
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {projects.map((p) => (
          <ProjectCard key={p.id} project={p} />
        ))}
      </div>
    </BuildShell>
  );
}

function SmartSuggestions() {
  const [items, setItems] = useState<import("@/lib/build/api").BuildVacancy[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Load profile to get skills, then suggest matching vacancies
    import("@/lib/build/api").then(({ buildApi }) => {
      buildApi.me().then((m) => {
        const skills = m.profile?.skills ?? [];
        if (skills.length === 0) { setLoaded(true); return; }
        const skill = skills[0];
        return buildApi.listVacancies({ status: "OPEN", skill, limit: 4 }).then((r) => {
          setItems(r.items);
          setLoaded(true);
        });
      }).catch(() => setLoaded(true));
    });
  }, []);

  if (!loaded || items.length === 0) return null;

  return (
    <div className="mb-8 rounded-xl border border-paper-rule bg-white p-5">
      <div className="mb-3 text-xs font-bold uppercase tracking-wider text-paper-teal-deep">
        ✨ Suggested for you
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((v) => (
          <Link
            key={v.id}
            href={`/build/vacancy/${encodeURIComponent(v.id)}`}
            className="rounded-lg border border-paper-rule bg-paper-card px-4 py-3 transition hover:border-paper-teal"
          >
            <div className="font-semibold text-paper-ink text-sm">{v.title}</div>
            <div className="mt-0.5 text-xs text-paper-ink-faint">
              {formatSalary(v.salary, v.salaryCurrency)}
              {v.city ? ` · ${v.city}` : ""}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function LandingHero({ publicStats }: { publicStats: { vacancies: number; candidates: number; projects: number } | null }) {
  const { t } = useI18n();
  return (
    <section className="mb-10 rounded-2xl border-y-[3px] border-paper-ink bg-paper-card px-6 py-10 sm:px-10 sm:py-14">
      <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-paper-teal-deep">
        <span className="h-1.5 w-1.5 rounded-full bg-paper-red" />
        AEVION QBuild · Construction Recruiting
      </div>
      <h1 className="mt-4 font-serif text-4xl font-extrabold tracking-tight text-paper-ink sm:text-5xl lg:text-6xl" style={{ fontFamily: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif' }}>
        {t("build.home.heroTitleLine1")}<br />
        <span className="text-paper-teal">{t("build.home.heroTitleLine2")}</span>
      </h1>
      <p className="mt-4 max-w-2xl text-base text-paper-ink-soft">
        {t("build.home.heroSubtitlePrefix")} <strong className="text-paper-ink">{t("build.home.heroSubtitleRate")}</strong> {t("build.home.heroSubtitleSuffix")}
      </p>

      <div className="mt-6 flex flex-wrap gap-2 text-xs">
        {[
          t("build.home.chipFreePost"),
          t("build.home.chipAiScoring"),
          t("build.home.chipVideoResume"),
          t("build.home.chipTrialJobs"),
          t("build.home.chipCashback"),
          t("build.home.chipDirectMessages"),
        ].map((chip) => (
          <span
            key={chip}
            className="rounded-full border border-paper-rule-mid px-3 py-1 text-paper-ink-soft"
          >
            {chip}
          </span>
        ))}
      </div>

      {publicStats && (
        <div className="mt-6 flex flex-wrap gap-6 text-sm">
          <LiveStat n={publicStats.projects} label={t("build.home.statOpenProjects")} />
          <LiveStat n={publicStats.vacancies} label={t("build.home.statVacanciesNow")} />
          <LiveStat n={publicStats.candidates} label={t("build.home.statResumesInBase")} />
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/build/profile"
          className="rounded-lg bg-paper-teal px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-paper-teal-deep"
        >
          {t("build.home.createProfileFree")}
        </Link>
        <Link
          href="/build/vacancies"
          className="rounded-lg border border-paper-rule-soft bg-white px-5 py-2.5 text-sm font-semibold text-paper-ink transition hover:bg-paper-2"
        >
          {t("build.home.viewVacancies")}
        </Link>
        <Link
          href="/build/why-aevion"
          className="rounded-lg px-5 py-2.5 text-sm font-medium text-paper-ink-soft transition hover:text-paper-ink"
        >
          {t("build.home.compareWithHh")}
        </Link>
      </div>
    </section>
  );
}

function LiveActivityBand() {
  const [items, setItems] = useState<
    { kind: "VACANCY" | "APPLICATION" | "HIRE"; title: string; city: string | null; at: string }[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    function load() {
      buildApi
        .liveActivity()
        .then((r) => {
          if (!cancelled) setItems(r.items);
        })
        .catch(() => {});
    }
    load();
    // Refresh every 60s so a long-open tab feels alive without burning DB.
    const t = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  if (items.length === 0) return null;

  function relative(at: string): string {
    const ms = Date.now() - new Date(at).getTime();
    const m = Math.floor(ms / 60_000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-paper-rule bg-white">
      <div className="flex items-center gap-2 border-b border-paper-rule px-3 py-1.5">
        <span className="inline-block h-2 w-2 rounded-full bg-paper-red" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-paper-ink-soft">
          Live · last 20 events
        </span>
      </div>
      <ul className="divide-y divide-[#ecebe5] max-h-48 overflow-y-auto">
        {items.map((e, i) => {
          const tone =
            e.kind === "HIRE"
              ? "text-paper-teal-deep"
              : e.kind === "VACANCY"
                ? "text-[#1f6f9f]"
                : "text-[#8a3fb0]";
          const verb =
            e.kind === "HIRE"
              ? "✓ hired for"
              : e.kind === "VACANCY"
                ? "+ posted"
                : "→ applied to";
          return (
            <li key={i} className="flex items-center gap-2 px-3 py-1.5 text-xs">
              <span className={`shrink-0 font-semibold ${tone}`}>{verb}</span>
              <span className="min-w-0 flex-1 truncate text-paper-ink">{e.title}</span>
              {e.city && <span className="shrink-0 text-paper-ink-faint">📍 {e.city}</span>}
              <span className="shrink-0 text-paper-ink-faint">{relative(e.at)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function LiveStat({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-2xl font-extrabold text-paper-teal">{n.toLocaleString("ru-RU")}</span>
      <span className="text-paper-ink-soft">{label}</span>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "emerald" | "amber" }) {
  const toneCls =
    tone === "emerald"
      ? "text-paper-teal"
      : tone === "amber"
        ? "text-[#b7791f]"
        : "text-paper-ink";
  return (
    <div className="rounded-xl border border-paper-rule bg-white px-4 py-3">
      <div className="text-xs uppercase tracking-wider text-paper-ink-faint">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${toneCls}`}>{value}</div>
    </div>
  );
}

function FeaturedEmployers() {
  const [items, setItems] = useState<Awaited<ReturnType<typeof buildApi.featuredEmployers>>["items"]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    buildApi
      .featuredEmployers()
      .then((r) => {
        if (!cancelled) {
          setItems(r.items);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded || items.length === 0) return null;

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-paper-ink-faint">
          Featured employers
        </h2>
        <Link href="/build/leaderboard" className="text-[11px] text-paper-teal-deep hover:underline">
          See all →
        </Link>
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {items.map((e) => (
          <Link
            key={e.userId}
            href={`/build/employer/${encodeURIComponent(e.userId)}`}
            className="group shrink-0 rounded-xl border border-paper-rule bg-white p-3 transition hover:border-paper-teal"
            style={{ minWidth: 200, maxWidth: 240 }}
          >
            <div className="flex items-center gap-2">
              {e.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={e.photoUrl}
                  alt={e.name ?? ""}
                  width={36}
                  height={36}
                  className="h-9 w-9 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-paper-teal/15 text-sm font-bold text-paper-teal-deep">
                  {(e.name ?? "?").charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="truncate text-sm font-semibold text-paper-ink group-hover:text-paper-teal-deep">
                    {e.name ?? "Anonymous"}
                  </span>
                  {e.verifiedAt && (
                    <span className="text-[10px] text-[#1f6f9f]" title="Verified">✓</span>
                  )}
                </div>
                {e.city && <div className="truncate text-[10px] text-paper-ink-faint">📍 {e.city}</div>}
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-paper-ink-faint">
              <span>
                {e.openVacancies > 0 ? (
                  <span className="text-paper-teal-deep">{e.openVacancies} open</span>
                ) : (
                  <span className="text-paper-ink-faint-2">no open roles</span>
                )}
              </span>
              <span>
                {e.hires > 0 && <span>{e.hires} hires</span>}
                {e.avgRating > 0 && (
                  <span className="ml-1.5 text-[#b7791f]">★ {e.avgRating.toFixed(1)}</span>
                )}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function FirstProjectCta() {
  const { t } = useI18n();
  return (
    <div className="rounded-2xl border-y-[3px] border-paper-ink bg-paper-card p-8 text-center">
      <div className="text-5xl">🏗</div>
      <h2 className="mt-4 text-xl font-bold text-paper-ink">{t("build.home.ctaTitle")}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-paper-ink-soft">
        {t("build.home.ctaDescription")}
      </p>
      <div className="mt-5 grid mx-auto max-w-md gap-2 text-left text-xs text-paper-ink-soft sm:grid-cols-3">
        <div className="rounded-lg border border-paper-rule bg-white px-3 py-2">
          <div className="text-base">📝</div>
          <div className="mt-1 font-semibold text-paper-ink">{t("build.home.ctaStep1Title")}</div>
          <p className="mt-0.5 text-[11px] text-paper-ink-faint">{t("build.home.ctaStep1Desc")}</p>
        </div>
        <div className="rounded-lg border border-paper-rule bg-white px-3 py-2">
          <div className="text-base">👥</div>
          <div className="mt-1 font-semibold text-paper-ink">{t("build.home.ctaStep2Title")}</div>
          <p className="mt-0.5 text-[11px] text-paper-ink-faint">{t("build.home.ctaStep2Desc")}</p>
        </div>
        <div className="rounded-lg border border-paper-rule bg-white px-3 py-2">
          <div className="text-base">✓</div>
          <div className="mt-1 font-semibold text-paper-ink">{t("build.home.ctaStep3Title")}</div>
          <p className="mt-0.5 text-[11px] text-paper-ink-faint">{t("build.home.ctaStep3Desc")}</p>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link
          href="/build/create-project"
          className="rounded-lg bg-paper-teal px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-paper-teal-deep"
        >
          {t("build.home.ctaCreateFirst")}
        </Link>
        <Link
          href="/build/onboarding"
          className="rounded-lg border border-paper-rule-soft bg-white px-5 py-2.5 text-sm font-semibold text-paper-ink transition hover:bg-paper-2"
        >
          {t("build.home.ctaOnboarding")}
        </Link>
      </div>
    </div>
  );
}
