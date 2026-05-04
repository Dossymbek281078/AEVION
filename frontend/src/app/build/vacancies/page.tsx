"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BuildShell } from "@/components/build/BuildShell";
import { VacancyCard } from "@/components/build/VacancyCard";
import { VacancySkeleton } from "@/components/build/Skeleton";
import { buildApi, type BuildVacancy, type VacancyStatus } from "@/lib/build/api";

const STATUS_FILTERS: (VacancyStatus | "ALL")[] = ["ALL", "OPEN", "CLOSED"];

type FeedVacancy = BuildVacancy & { projectCity?: string | null };

export default function VacanciesFeedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<FeedVacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Initial state hydrates from URL so deep links / back-button restore filters.
  const [status, setStatus] = useState<VacancyStatus | "ALL">(
    (searchParams.get("status") as VacancyStatus | "ALL") || "OPEN",
  );
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [city, setCity] = useState(searchParams.get("city") || "");
  const [minSalary, setMinSalary] = useState<string>(searchParams.get("minSalary") || "");
  const [skill, setSkill] = useState(searchParams.get("skill") || "");
  const [sort, setSort] = useState<"recent" | "salary" | "popular">(
    (searchParams.get("sort") as "recent" | "salary" | "popular") || "recent",
  );
  const [popularSkills, setPopularSkills] = useState<string[]>([]);

  useEffect(() => {
    buildApi.popularSkills().then((r) => setPopularSkills(r.items.slice(0, 12).map((s) => s.skill))).catch(() => {});
  }, []);

  // Reflect filter state back into URL (debounced via the same 250ms gate
  // as the network call). Skip the very-first run if URL already matches.
  useEffect(() => {
    const handle = setTimeout(() => {
      const next = new URLSearchParams();
      if (q.trim()) next.set("q", q.trim());
      if (city.trim()) next.set("city", city.trim());
      if (minSalary.trim()) next.set("minSalary", minSalary.trim());
      if (skill.trim()) next.set("skill", skill.trim());
      if (sort !== "recent") next.set("sort", sort);
      if (status !== "OPEN") next.set("status", status);
      const qs = next.toString();
      const url = qs ? `/build/vacancies?${qs}` : "/build/vacancies";
      router.replace(url, { scroll: false });
    }, 300);
    return () => clearTimeout(handle);
  }, [q, city, minSalary, skill, sort, status, router]);

  useEffect(() => {
    const handle = setTimeout(() => {
      let cancelled = false;
      setLoading(true);
      const min = minSalary.trim() ? Number(minSalary) : undefined;
      buildApi
        .listVacancies({
          status: status === "ALL" ? undefined : status,
          q: q.trim() || undefined,
          city: city.trim() || undefined,
          minSalary: Number.isFinite(min) ? (min as number) : undefined,
          skill: skill.trim() || undefined,
          sort,
          limit: 100,
        })
        .then((r) => {
          if (!cancelled) setItems(r.items);
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
    }, 250);
    return () => clearTimeout(handle);
  }, [status, q, city, minSalary, skill, sort]);

  const stats = useMemo(() => {
    const openItems = items.filter((v) => v.status === "OPEN");
    const totalSalary = openItems.reduce((s, v) => s + (v.salary || 0), 0);
    const avgSalary = openItems.length ? Math.round(totalSalary / openItems.length) : 0;
    const cities = new Set(items.map((v) => v.projectCity).filter(Boolean) as string[]);
    return {
      total: items.length,
      open: openItems.length,
      avgSalary,
      cities: cities.size,
    };
  }, [items]);

  return (
    <BuildShell>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Vacancies feed</h1>
          <p className="mt-1 text-sm text-slate-400">
            All open positions across QBuild projects. Filter by status, salary, or city.
          </p>
        </div>
        <Link
          href="/build/create-project"
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
        >
          Post a project
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Listed" value={stats.total} />
        <Stat label="Open" value={stats.open} tone="emerald" />
        <Stat label="Avg salary" value={stats.avgSalary > 0 ? `$${stats.avgSalary.toLocaleString()}` : "—"} />
        <Stat label="Cities" value={stats.cities} />
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title or description…"
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/40 focus:outline-none"
        />
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="City"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/40 focus:outline-none sm:w-32"
        />
        <input
          value={minSalary}
          onChange={(e) => setMinSalary(e.target.value.replace(/[^\d]/g, ""))}
          placeholder="Min $"
          inputMode="numeric"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/40 focus:outline-none sm:w-28"
        />
        <input
          value={skill}
          onChange={(e) => setSkill(e.target.value)}
          placeholder="Skill (e.g. AutoCAD)"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/40 focus:outline-none sm:w-40"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as "recent" | "salary" | "popular")}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-500/40 focus:outline-none"
        >
          <option value="recent">Recent</option>
          <option value="salary">Salary ↓</option>
          <option value="popular">Popular</option>
        </select>
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

      {popularSkills.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {popularSkills.map((s) => (
            <button
              key={s}
              onClick={() => setSkill(skill === s ? "" : s)}
              className={`rounded-full border px-2.5 py-0.5 text-xs transition ${
                skill === s
                  ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-200"
                  : "border-white/10 bg-white/5 text-slate-400 hover:border-white/30 hover:text-slate-200"
              }`}
            >
              {s}
            </button>
          ))}
          {skill && (
            <button onClick={() => setSkill("")} className="rounded-full border border-white/5 px-2.5 py-0.5 text-xs text-slate-500 hover:text-slate-300">
              ✕ clear
            </button>
          )}
        </div>
      )}

      <SavedSearches
        current={{ q, city, minSalary, skill, sort, status }}
        onApply={(s) => {
          setQ(s.q);
          setCity(s.city);
          setMinSalary(s.minSalary);
          setSkill(s.skill);
          setSort(s.sort);
          setStatus(s.status);
        }}
      />

      {error && (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <VacancySkeleton key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
          <p className="text-sm text-slate-400">
            No vacancies match these filters. Try clearing them, or{" "}
            <Link href="/build" className="text-emerald-300 underline">
              browse projects
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((v) => (
            <VacancyCard key={v.id} vacancy={v} showProject />
          ))}
        </div>
      )}
    </BuildShell>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "emerald" | "amber";
}) {
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

type SavedSearch = {
  id: string;
  name: string;
  q: string;
  city: string;
  minSalary: string;
  skill: string;
  sort: "recent" | "salary" | "popular";
  status: VacancyStatus | "ALL";
};

const SAVED_KEY = "qbuild.savedSearches.v1";

function SavedSearches({
  current,
  onApply,
}: {
  current: Omit<SavedSearch, "id" | "name">;
  onApply: (s: Omit<SavedSearch, "id" | "name">) => void;
}) {
  const [items, setItems] = useState<SavedSearch[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_KEY);
      if (raw) setItems(JSON.parse(raw) as SavedSearch[]);
    } catch {
      // Corrupt JSON — reset.
      try { localStorage.removeItem(SAVED_KEY); } catch {}
    }
    setHydrated(true);
  }, []);

  function persist(next: SavedSearch[]) {
    setItems(next);
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch {}
  }

  function describe(c: Omit<SavedSearch, "id" | "name">) {
    const parts: string[] = [];
    if (c.q) parts.push(`"${c.q}"`);
    if (c.skill) parts.push(`skill:${c.skill}`);
    if (c.city) parts.push(`city:${c.city}`);
    if (c.minSalary) parts.push(`≥$${c.minSalary}`);
    if (c.sort !== "recent") parts.push(`sort:${c.sort}`);
    if (c.status !== "OPEN") parts.push(`status:${c.status}`);
    return parts.length > 0 ? parts.join(" · ") : "all open vacancies";
  }

  function save() {
    const summary = describe(current);
    const name = window.prompt("Name this search:", summary === "all open vacancies" ? "" : summary);
    if (!name?.trim()) return;
    const id = `s_${Date.now()}`;
    persist([{ id, name: name.trim().slice(0, 60), ...current }, ...items].slice(0, 20));
  }

  function remove(id: string) {
    persist(items.filter((s) => s.id !== id));
  }

  // Hide entirely until we know what's stored — avoids SSR hydration flicker.
  if (!hydrated) return null;

  const hasFilters =
    current.q || current.city || current.minSalary || current.skill || current.sort !== "recent" || current.status !== "OPEN";

  if (items.length === 0 && !hasFilters) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Saved:</span>
      {items.length === 0 && (
        <span className="text-[11px] text-slate-500">none yet</span>
      )}
      {items.map((s) => (
        <span
          key={s.id}
          className="inline-flex items-center gap-1 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-2.5 py-0.5 text-xs text-fuchsia-200"
        >
          <button
            onClick={() => onApply(s)}
            title={describe(s)}
            className="hover:underline"
          >
            {s.name}
          </button>
          <button
            onClick={() => remove(s.id)}
            aria-label={`Delete ${s.name}`}
            className="text-fuchsia-200/60 hover:text-fuchsia-200"
          >
            ×
          </button>
        </span>
      ))}
      {hasFilters && (
        <button
          onClick={save}
          className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20"
        >
          ★ Save current
        </button>
      )}
    </div>
  );
}
