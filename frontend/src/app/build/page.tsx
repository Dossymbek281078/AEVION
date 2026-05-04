"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BuildShell } from "@/components/build/BuildShell";
import { ProjectCard } from "@/components/build/ProjectCard";
import { Skeleton } from "@/components/build/Skeleton";
import { buildApi, type BuildProject, type ProjectStatus } from "@/lib/build/api";
import { useBuildAuth } from "@/lib/build/auth";

const STATUS_FILTERS: (ProjectStatus | "ALL")[] = ["ALL", "OPEN", "IN_PROGRESS", "DONE"];

export default function BuildHomePage() {
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

  useEffect(() => {
    buildApi
      .publicStats()
      .then((r) => setPublicStats(r))
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
    <BuildShell>
      {hydrated && !token && <LandingHero publicStats={publicStats} />}
      {hydrated && token && <SmartSuggestions />}

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Construction projects</h1>
          <p className="mt-1 text-sm text-slate-400">
            Browse open projects, post a vacancy, or apply directly.
          </p>
        </div>
        <Link
          href="/build/create-project"
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
        >
          + New project
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total" value={stats.total} />
        <Stat label="Open" value={stats.open} tone="emerald" />
        <Stat label="In progress" value={stats.active} tone="amber" />
        <Stat label="Vacancies" value={stats.vacancies} />
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by title or description…"
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/40 focus:outline-none"
        />
        {token && (
          <button
            onClick={() => setMineOnly((v) => !v)}
            aria-pressed={mineOnly}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              mineOnly
                ? "bg-emerald-500/20 text-emerald-200"
                : "bg-white/5 text-slate-400 hover:bg-white/10"
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
                  ? "bg-emerald-500/20 text-emerald-200"
                  : "bg-white/5 text-slate-400 hover:bg-white/10"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}

      {loading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
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

      {!loading && projects.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
          <p className="text-sm text-slate-400">
            No projects match these filters. Try clearing the search or{" "}
            <Link href="/build/create-project" className="text-emerald-300 underline">
              post the first one
            </Link>
            .
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
    <div className="mb-8 rounded-xl border border-sky-500/20 bg-sky-500/5 p-5">
      <div className="mb-3 text-xs font-bold uppercase tracking-wider text-sky-300">
        ✨ Suggested for you
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((v) => (
          <Link
            key={v.id}
            href={`/build/vacancy/${encodeURIComponent(v.id)}`}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 transition hover:border-sky-500/30 hover:bg-sky-500/5"
          >
            <div className="font-semibold text-white text-sm">{v.title}</div>
            <div className="mt-0.5 text-xs text-slate-400">
              {v.salary > 0 ? `$${v.salary.toLocaleString()}` : "—"}
              {v.city ? ` · ${v.city}` : ""}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function LandingHero({ publicStats }: { publicStats: { vacancies: number; candidates: number; projects: number } | null }) {
  return (
    <section className="mb-10 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-900 px-6 py-10 sm:px-10 sm:py-14">
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        AEVION QBuild · Construction Recruiting
      </div>
      <h1 className="mt-4 text-3xl font-extrabold text-white sm:text-4xl lg:text-5xl">
        Нанимайте бригады.<br />
        <span className="text-emerald-400">Платите когда нашли.</span>
      </h1>
      <p className="mt-4 max-w-2xl text-base text-slate-300">
        Строительная биржа нового поколения. Без платы за публикацию вакансии. База резюме на любом тарифе.
        Комиссия Pay-per-Hire — <strong className="text-white">от 6%</strong> вместо 15–25% у агентств.
        AI-скоринг заявок, видеорезюме, Trial Jobs.
      </p>

      <div className="mt-6 flex flex-wrap gap-2 text-xs">
        {[
          "0 ₽ за вакансию",
          "AI-скоринг кандидатов",
          "Видеорезюме",
          "Trial Jobs",
          "2% AEV cashback",
          "Прямые сообщения без премиума",
        ].map((t) => (
          <span
            key={t}
            className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-200"
          >
            {t}
          </span>
        ))}
      </div>

      {publicStats && (
        <div className="mt-6 flex flex-wrap gap-6 text-sm">
          <LiveStat n={publicStats.projects} label="открытых проектов" />
          <LiveStat n={publicStats.vacancies} label="вакансий сейчас" />
          <LiveStat n={publicStats.candidates} label="резюме в базе" />
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/build/profile"
          className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
        >
          Создать профиль бесплатно →
        </Link>
        <Link
          href="/build/vacancies"
          className="rounded-lg border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          Смотреть вакансии
        </Link>
        <Link
          href="/build/why-aevion"
          className="rounded-lg border border-white/10 px-5 py-2.5 text-sm font-medium text-slate-400 transition hover:text-white"
        >
          Сравнить с HH →
        </Link>
      </div>
    </section>
  );
}

function LiveStat({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-2xl font-extrabold text-emerald-300">{n.toLocaleString("ru-RU")}</span>
      <span className="text-slate-400">{label}</span>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "emerald" | "amber" }) {
  const toneCls =
    tone === "emerald"
      ? "text-emerald-300"
      : tone === "amber"
        ? "text-amber-300"
        : "text-slate-100";
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-xs uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${toneCls}`}>{value}</div>
    </div>
  );
}
