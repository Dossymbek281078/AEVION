"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { useToast } from "@/components/build/Toast";
import { buildApi } from "@/lib/build/api";

type Insights = Awaited<ReturnType<typeof buildApi.adminInsights>>;

export default function AdminInsightsPage() {
  return (
    <BuildShell>
      <RequireAuth>
        <Body />
      </RequireAuth>
    </BuildShell>
  );
}

function Body() {
  const toast = useToast();
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    buildApi
      .adminInsights()
      .then((r) => {
        if (!cancelled) setData(r);
      })
      .catch((e) => {
        if (!cancelled) toast.error((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [toast]);

  return (
    <>
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin · Weekly insights</h1>
          <p className="mt-1 text-sm text-slate-400">
            Platform-wide metrics for the past 7 days vs the previous week.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <Link href="/build/admin" className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-slate-300 hover:bg-white/10">
            ← Admin home
          </Link>
          <Link href="/build/admin/leads" className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-slate-300 hover:bg-white/10">
            Leads
          </Link>
          <Link href="/build/admin/flags" className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-slate-300 hover:bg-white/10">
            Flags
          </Link>
        </div>
      </header>

      {loading && <p className="text-sm text-slate-400">Loading…</p>}

      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <DeltaTile label="New users" {...data.newUsers} />
            <DeltaTile label="New applications" {...data.newApplications} />
            <DeltaTile label="New vacancies" {...data.newVacancies} />
            <DeltaTile label="Hires" {...data.hires} />
          </div>

          {data.conversionRate !== null && (
            <div className="rounded-xl border border-fuchsia-400/30 bg-gradient-to-br from-fuchsia-500/10 via-fuchsia-400/5 to-transparent p-4">
              <div className="text-xs uppercase tracking-wider text-fuchsia-200/70">
                Application → hire conversion (7d)
              </div>
              <div className="mt-1 text-3xl font-bold text-fuchsia-100">
                {data.conversionRate.toFixed(1)}%
              </div>
              <div className="mt-1 text-[11px] text-fuchsia-200/60">
                {data.hires.now} hires from {data.newApplications.now} new applications
              </div>
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            <RankList
              title="Top employers by hires (7d)"
              empty="No hires registered this week."
              rows={data.topEmployers.map((e) => ({
                key: e.userId,
                primary: e.name || e.userId.slice(0, 8),
                metric: `${e.hires} hire${e.hires === 1 ? "" : "s"}`,
                href: `/build/employer/${encodeURIComponent(e.userId)}`,
              }))}
            />
            <RankList
              title="Most-applied vacancies (7d)"
              empty="No applications received this week."
              rows={data.topVacancies.map((v) => ({
                key: v.id,
                primary: v.title,
                metric: `${v.apps} application${v.apps === 1 ? "" : "s"}`,
                href: `/build/vacancy/${encodeURIComponent(v.id)}`,
              }))}
            />
          </div>

          <p className="text-[11px] text-slate-500">
            Window: {new Date(data.windowStart).toLocaleString()} → {new Date(data.windowEnd).toLocaleString()}
          </p>
        </div>
      )}
    </>
  );
}

function DeltaTile({
  label,
  now,
  prev,
  change,
}: {
  label: string;
  now: number;
  prev: number;
  change: number;
}) {
  const tone =
    change > 0 ? "text-emerald-300" : change < 0 ? "text-rose-300" : "text-slate-400";
  const arrow = change > 0 ? "▲" : change < 0 ? "▼" : "•";
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-2">
        <div className="text-2xl font-bold text-white">{now}</div>
        <div className={`text-xs font-semibold ${tone}`}>
          {arrow} {Math.abs(change)}
        </div>
      </div>
      <div className="text-[10px] text-slate-500">prev week {prev}</div>
    </div>
  );
}

function RankList({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: { key: string; primary: string; metric: string; href: string }[];
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-500">{empty}</p>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((r, i) => (
            <li
              key={r.key}
              className="flex items-center justify-between gap-2 rounded-md border border-white/5 bg-black/20 p-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-[10px] text-slate-500">{i + 1}.</span>
                <Link
                  href={r.href}
                  className="truncate text-xs text-slate-200 hover:text-emerald-300"
                >
                  {r.primary}
                </Link>
              </div>
              <span className="shrink-0 text-[11px] font-semibold text-emerald-300">
                {r.metric}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
