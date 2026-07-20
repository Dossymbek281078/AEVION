"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BuildShell } from "@/components/build/BuildShell";
import { ProjectCard } from "@/components/build/ProjectCard";
import { Skeleton } from "@/components/build/Skeleton";
import { buildApi, type BuildProject, type ProjectStatus } from "@/lib/build/api";
import { formatSalary } from "@/lib/build/format";
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
          <h1 className="text-2xl font-bold text-[#17181a]">Construction projects</h1>
          <p className="mt-1 text-sm text-[#74767c]">
            Browse open projects, post a vacancy, or apply directly.
          </p>
        </div>
        <Link
          href="/build/create-project"
          className="rounded-lg bg-[#0a7d72] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#075b53]"
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
          placeholder="Search by title or description…"
          className="flex-1 rounded-lg border border-[#d4d3cc] bg-white px-3 py-2 text-sm text-[#17181a] placeholder:text-[#9a9c9f] focus:border-[#0a7d72] focus:outline-none"
        />
        {token && (
          <button
            onClick={() => setMineOnly((v) => !v)}
            aria-pressed={mineOnly}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              mineOnly
                ? "bg-[#0a7d72] text-white"
                : "border border-[#d4d3cc] bg-white text-[#45474c] hover:bg-[#efeee8]"
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
                  ? "bg-[#0a7d72] text-white"
                  : "border border-[#d4d3cc] bg-white text-[#45474c] hover:bg-[#efeee8]"
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-[#d4d3cc] bg-white p-4">
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
        <div className="rounded-xl border border-[#d4d3cc] bg-white p-8 text-center">
          <p className="text-sm text-[#45474c]">
            No projects match these filters. Try clearing the search or{" "}
            <Link href="/build/create-project" className="text-[#075b53] underline">
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
    <div className="mb-8 rounded-xl border border-[#d4d3cc] bg-white p-5">
      <div className="mb-3 text-xs font-bold uppercase tracking-wider text-[#075b53]">
        ✨ Suggested for you
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((v) => (
          <Link
            key={v.id}
            href={`/build/vacancy/${encodeURIComponent(v.id)}`}
            className="rounded-lg border border-[#d4d3cc] bg-[#fffefb] px-4 py-3 transition hover:border-[#0a7d72]"
          >
            <div className="font-semibold text-[#17181a] text-sm">{v.title}</div>
            <div className="mt-0.5 text-xs text-[#74767c]">
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
  return (
    <section className="mb-10 rounded-2xl border-y-[3px] border-[#17181a] bg-[#fffefb] px-6 py-10 sm:px-10 sm:py-14">
      <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#075b53]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#b5241b]" />
        AEVION QBuild · Construction Recruiting
      </div>
      <h1 className="mt-4 font-serif text-4xl font-extrabold tracking-tight text-[#17181a] sm:text-5xl lg:text-6xl" style={{ fontFamily: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif' }}>
        Нанимайте бригады.<br />
        <span className="text-[#0a7d72]">Платите когда нашли.</span>
      </h1>
      <p className="mt-4 max-w-2xl text-base text-[#45474c]">
        Строительная биржа нового поколения. Без платы за публикацию вакансии. База резюме на любом тарифе.
        Комиссия Pay-per-Hire — <strong className="text-[#17181a]">от 6%</strong> вместо 15–25% у агентств.
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
            className="rounded-full border border-[#b9b8b0] px-3 py-1 text-[#45474c]"
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
          className="rounded-lg bg-[#0a7d72] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#075b53]"
        >
          Создать профиль бесплатно →
        </Link>
        <Link
          href="/build/vacancies"
          className="rounded-lg border border-[#c2c8cf] bg-white px-5 py-2.5 text-sm font-semibold text-[#17181a] transition hover:bg-[#efeee8]"
        >
          Смотреть вакансии
        </Link>
        <Link
          href="/build/why-aevion"
          className="rounded-lg px-5 py-2.5 text-sm font-medium text-[#45474c] transition hover:text-[#17181a]"
        >
          Сравнить с HH →
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
    <div className="mb-6 overflow-hidden rounded-xl border border-[#d4d3cc] bg-white">
      <div className="flex items-center gap-2 border-b border-[#d4d3cc] px-3 py-1.5">
        <span className="inline-block h-2 w-2 rounded-full bg-[#b5241b]" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#45474c]">
          Live · last 20 events
        </span>
      </div>
      <ul className="divide-y divide-[#ecebe5] max-h-48 overflow-y-auto">
        {items.map((e, i) => {
          const tone =
            e.kind === "HIRE"
              ? "text-[#075b53]"
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
              <span className="min-w-0 flex-1 truncate text-[#17181a]">{e.title}</span>
              {e.city && <span className="shrink-0 text-[#74767c]">📍 {e.city}</span>}
              <span className="shrink-0 text-[#74767c]">{relative(e.at)}</span>
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
      <span className="text-2xl font-extrabold text-[#0a7d72]">{n.toLocaleString("ru-RU")}</span>
      <span className="text-[#45474c]">{label}</span>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "emerald" | "amber" }) {
  const toneCls =
    tone === "emerald"
      ? "text-[#0a7d72]"
      : tone === "amber"
        ? "text-[#b7791f]"
        : "text-[#17181a]";
  return (
    <div className="rounded-xl border border-[#d4d3cc] bg-white px-4 py-3">
      <div className="text-xs uppercase tracking-wider text-[#74767c]">{label}</div>
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
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#74767c]">
          Featured employers
        </h2>
        <Link href="/build/leaderboard" className="text-[11px] text-[#075b53] hover:underline">
          See all →
        </Link>
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {items.map((e) => (
          <Link
            key={e.userId}
            href={`/build/employer/${encodeURIComponent(e.userId)}`}
            className="group shrink-0 rounded-xl border border-[#d4d3cc] bg-white p-3 transition hover:border-[#0a7d72]"
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
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0a7d72]/15 text-sm font-bold text-[#075b53]">
                  {(e.name ?? "?").charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="truncate text-sm font-semibold text-[#17181a] group-hover:text-[#075b53]">
                    {e.name ?? "Anonymous"}
                  </span>
                  {e.verifiedAt && (
                    <span className="text-[10px] text-[#1f6f9f]" title="Verified">✓</span>
                  )}
                </div>
                {e.city && <div className="truncate text-[10px] text-[#74767c]">📍 {e.city}</div>}
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-[#74767c]">
              <span>
                {e.openVacancies > 0 ? (
                  <span className="text-[#075b53]">{e.openVacancies} open</span>
                ) : (
                  <span className="text-[#9a9c9f]">no open roles</span>
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
  return (
    <div className="rounded-2xl border-y-[3px] border-[#17181a] bg-[#fffefb] p-8 text-center">
      <div className="text-5xl">🏗</div>
      <h2 className="mt-4 text-xl font-bold text-[#17181a]">Запустите первый проект на QBuild</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-[#45474c]">
        Проект — это контейнер для одной или нескольких вакансий. Один проект может содержать
        бригады разных специальностей: сварщики, монтажники, прорабы.
      </p>
      <div className="mt-5 grid mx-auto max-w-md gap-2 text-left text-xs text-[#45474c] sm:grid-cols-3">
        <div className="rounded-lg border border-[#d4d3cc] bg-white px-3 py-2">
          <div className="text-base">📝</div>
          <div className="mt-1 font-semibold text-[#17181a]">Опишите объект</div>
          <p className="mt-0.5 text-[11px] text-[#74767c]">Город, бюджет, сроки</p>
        </div>
        <div className="rounded-lg border border-[#d4d3cc] bg-white px-3 py-2">
          <div className="text-base">👥</div>
          <div className="mt-1 font-semibold text-[#17181a]">Добавьте вакансии</div>
          <p className="mt-0.5 text-[11px] text-[#74767c]">С зарплатой и навыками</p>
        </div>
        <div className="rounded-lg border border-[#d4d3cc] bg-white px-3 py-2">
          <div className="text-base">✓</div>
          <div className="mt-1 font-semibold text-[#17181a]">Получайте отклики</div>
          <p className="mt-0.5 text-[11px] text-[#74767c]">AI-скоринг + bulk-actions</p>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link
          href="/build/create-project"
          className="rounded-lg bg-[#0a7d72] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#075b53]"
        >
          + Создать первый проект
        </Link>
        <Link
          href="/build/onboarding"
          className="rounded-lg border border-[#c2c8cf] bg-white px-5 py-2.5 text-sm font-semibold text-[#17181a] transition hover:bg-[#efeee8]"
        >
          5-step онбординг
        </Link>
      </div>
    </div>
  );
}
