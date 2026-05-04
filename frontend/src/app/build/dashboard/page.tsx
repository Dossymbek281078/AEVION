"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { buildApi } from "@/lib/build/api";

type Row = Awaited<ReturnType<typeof buildApi.myVacanciesFunnel>>["items"][number];

type StatusFilter = "ALL" | "OPEN" | "CLOSED";
type SortKey = "recent" | "pending" | "views" | "applies";

export default function DashboardPage() {
  return (
    <BuildShell>
      <RequireAuth>
        <Body />
      </RequireAuth>
    </BuildShell>
  );
}

function Body() {
  const [items, setItems] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("OPEN");
  const [sort, setSort] = useState<SortKey>("recent");

  useEffect(() => {
    buildApi
      .myVacanciesFunnel()
      .then((r) => setItems(r.items))
      .catch((e) => setError((e as Error).message));
  }, []);

  const filtered = useMemo(() => {
    if (!items) return [];
    let out = items;
    if (statusFilter !== "ALL") out = out.filter((r) => r.status === statusFilter);
    const sorted = [...out];
    sorted.sort((a, b) => {
      switch (sort) {
        case "pending": return b.appsPending - a.appsPending;
        case "views": return (b.viewCount ?? 0) - (a.viewCount ?? 0);
        case "applies": return b.appsTotal - a.appsTotal;
        default: return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
    return sorted;
  }, [items, statusFilter, sort]);

  const totals = useMemo(() => {
    if (!items) return { open: 0, pending: 0, views: 0, accepted: 0 };
    return items.reduce(
      (acc, r) => ({
        open: acc.open + (r.status === "OPEN" ? 1 : 0),
        pending: acc.pending + r.appsPending,
        views: acc.views + (r.viewCount ?? 0),
        accepted: acc.accepted + r.appsAccepted,
      }),
      { open: 0, pending: 0, views: 0, accepted: 0 },
    );
  }, [items]);

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Recruiter dashboard</h1>
          <p className="mt-1 text-sm text-slate-400">
            All vacancies you own with the funnel — views, applications by status, hires.
          </p>
        </div>
        <Link
          href="/build/create-project"
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
        >
          + New project / vacancy
        </Link>
      </header>

      {items && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Open vacancies" value={totals.open} tone="emerald" />
          <Tile label="Pending apps" value={totals.pending} tone="amber" />
          <Tile label="Hired" value={totals.accepted} tone="emerald" />
          <Tile label="Total views" value={totals.views} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <div className="flex items-center gap-1">
          {(["OPEN", "CLOSED", "ALL"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-md px-3 py-1.5 ${
                statusFilter === s ? "bg-emerald-500/20 text-emerald-200" : "bg-white/5 text-slate-400 hover:bg-white/10"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Sort:</span>
          {(["recent", "pending", "views", "applies"] as SortKey[]).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`rounded-md px-2.5 py-1 ${
                sort === s ? "bg-white/15 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"
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

      {!items && !error && <p className="text-sm text-slate-400">Loading dashboard…</p>}

      {items && filtered.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-10 text-center">
          <div className="text-5xl">🏗</div>
          <p className="mt-3 text-sm text-slate-300">
            No vacancies match the active filter.
          </p>
          <Link
            href="/build/create-project"
            className="mt-3 inline-block text-xs text-emerald-300 hover:underline"
          >
            Post your first project →
          </Link>
        </div>
      )}

      {items && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-white/5 text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Vacancy</th>
                <th className="px-3 py-2 text-right font-semibold">Views</th>
                <th className="px-3 py-2 text-right font-semibold">Apps</th>
                <th className="px-3 py-2 text-right font-semibold">Pending</th>
                <th className="px-3 py-2 text-right font-semibold">Hired</th>
                <th className="px-3 py-2 text-right font-semibold">Salary</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const conv =
                  r.viewCount && r.viewCount > 0
                    ? `${Math.round((r.appsTotal / r.viewCount) * 100)}%`
                    : "—";
                return (
                  <tr
                    key={r.id}
                    className="border-t border-white/5 transition hover:bg-white/[0.04]"
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={`/build/vacancy/${encodeURIComponent(r.id)}`}
                        className="block max-w-[320px] truncate font-medium text-white hover:text-emerald-200"
                      >
                        {r.title}
                      </Link>
                      <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-500">
                        <span>{r.projectTitle}</span>
                        <span
                          className={
                            r.status === "OPEN" ? "text-emerald-300" : "text-slate-500"
                          }
                        >
                          {r.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-200">
                      {r.viewCount ?? 0}
                      <div className="text-[10px] text-slate-500">{conv} conv</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-200">{r.appsTotal}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.appsPending > 0 ? (
                        <span className="text-amber-200">{r.appsPending}</span>
                      ) : (
                        <span className="text-slate-500">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-300">
                      {r.appsAccepted}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-300">
                      {r.salary > 0
                        ? `$${r.salary.toLocaleString()}`
                        : <span className="text-slate-500">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "emerald" | "amber";
}) {
  const cls =
    tone === "emerald"
      ? "text-emerald-300"
      : tone === "amber"
        ? "text-amber-300"
        : "text-white";
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-xs uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`mt-1 text-3xl font-bold ${cls}`}>{value.toLocaleString()}</div>
    </div>
  );
}
