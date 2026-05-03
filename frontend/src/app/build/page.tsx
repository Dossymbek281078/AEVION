"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BuildShell } from "@/components/build/BuildShell";
import { ProjectCard } from "@/components/build/ProjectCard";
import { OnboardingChecklist } from "@/components/build/OnboardingChecklist";
import { buildApi, type BuildProject, type ProjectStatus, type BuildProfile } from "@/lib/build/api";
import { useBuildAuth } from "@/lib/build/auth";

const STATUS_FILTERS: (ProjectStatus | "ALL")[] = ["ALL", "OPEN", "IN_PROGRESS", "DONE"];

export default function BuildHomePage() {
  const token = useBuildAuth((s) => s.token);
  const user = useBuildAuth((s) => s.user);
  const [profile, setProfile] = useState<BuildProfile | null>(null);
  const [projects, setProjects] = useState<BuildProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ProjectStatus | "ALL">("ALL");
  const [q, setQ] = useState("");
  const [mineOnly, setMineOnly] = useState(false);

  useEffect(() => {
    if (token) {
      buildApi.me().then((r) => setProfile(r.profile)).catch(() => {});
    }
  }, [token]);

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
      {token && user && (
        <OnboardingChecklist user={user} profile={profile} />
      )}

      {!token && (
        <div className="mb-8 overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-slate-900 to-slate-950 px-6 py-8">
          <div className="max-w-2xl">
            <div className="mb-1 text-xs font-bold uppercase tracking-widest text-emerald-400">AEVION QBuild</div>
            <h1 className="mb-3 text-3xl font-bold text-white">
              Биржа строительного найма.<br />
              <span className="text-emerald-400">Лучше HeadHunter — для стройки.</span>
            </h1>
            <p className="mb-5 text-sm text-slate-300">
              Найди сварщика, прораба или бригаду за часы, а не недели. Открытые вакансии, видео-интервью,
              тестовые задания с эскроу, карта объектов — всё в одном месте.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/build/vacancies" className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-bold text-emerald-950 hover:bg-emerald-400">
                Найти работу →
              </Link>
              <Link href="/build/create-project" className="rounded-lg border border-white/20 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/5">
                Разместить вакансию
              </Link>
              <Link href="/build/why-aevion" className="rounded-lg border border-white/10 px-5 py-2.5 text-sm text-slate-400 hover:text-white">
                Почему QBuild?
              </Link>
            </div>
            <div className="mt-5 flex flex-wrap gap-4 text-xs text-slate-500">
              <span>⚡ Quick Apply за 1 клик</span>
              <span>📣 Site Stories с площадок</span>
              <span>⭐ Лидерборд работодателей</span>
              <span>🗺️ Карта вакансий</span>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Проекты на платформе</h1>
          <p className="mt-1 text-sm text-slate-400">
            Открытые строительные проекты. Нашли нужный — откройте, посмотрите вакансии, откликнитесь.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/build/vacancies"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10"
          >
            Все вакансии
          </Link>
          <Link
            href="/build/create-project"
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
          >
            + Новый проект
          </Link>
        </div>
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
          {STATUS_FILTERS.map((s: any) => (
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

      {loading && <p className="text-sm text-slate-400">Loading…</p>}

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
