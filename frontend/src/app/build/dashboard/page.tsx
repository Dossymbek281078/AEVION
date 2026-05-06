"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { buildApi } from "@/lib/build/api";
import { useToast } from "@/components/build/Toast";
import { rowsToCsv, downloadCsv } from "@/lib/build/csv";
import { SavedSearchAlerts } from "@/components/build/SavedSearchAlerts";

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
    if (!items) return { open: 0, pending: 0, views: 0, accepted: 0, avgSlaSec: null as number | null };
    const base = items.reduce(
      (acc, r) => ({
        open: acc.open + (r.status === "OPEN" ? 1 : 0),
        pending: acc.pending + r.appsPending,
        views: acc.views + (r.viewCount ?? 0),
        accepted: acc.accepted + r.appsAccepted,
        slaSum: acc.slaSum + (r.avgResponseSeconds || 0),
        slaCnt: acc.slaCnt + (r.avgResponseSeconds ? 1 : 0),
      }),
      { open: 0, pending: 0, views: 0, accepted: 0, slaSum: 0, slaCnt: 0 },
    );
    return {
      open: base.open,
      pending: base.pending,
      views: base.views,
      accepted: base.accepted,
      avgSlaSec: base.slaCnt > 0 ? base.slaSum / base.slaCnt : null,
    };
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
        <div className="flex items-center gap-2">
          <ExportBundleButton />
          <Link
            href="/build/create-project"
            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
          >
            + New project / vacancy
          </Link>
        </div>
      </header>

      {items && <TodayDigestTile items={items} />}

      <SavedSearchAlerts />

      {items && <ClosingSoonBanner items={items} onChanged={() => {
        buildApi.myVacanciesFunnel().then((r) => setItems(r.items)).catch(() => {});
      }} />}
      {items && <StaleAppsBanner items={items} />}

      {items && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Tile label="Open vacancies" value={totals.open} tone="emerald" />
          <Tile label="Pending apps" value={totals.pending} tone="amber" />
          <Tile label="Hired" value={totals.accepted} tone="emerald" />
          <Tile label="Total views" value={totals.views} />
          <SlaTile avgSec={totals.avgSlaSec} />
        </div>
      )}

      {items && <SourceBreakdownChart />}

      {items && <RejectReasonsChart />}

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
                <th className="px-3 py-2 text-right font-semibold">SLA</th>
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
                    <td className="px-3 py-2 text-right tabular-nums">
                      <SlaCell seconds={r.avgResponseSeconds} />
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

// Render seconds as "1h 12m", "2d 4h", "—" depending on bucket. Anything over
// 30 days is collapsed to ">30d" so a single ancient outlier doesn't blow up
// the dashboard average.
function formatSla(seconds: number | null): string {
  if (!seconds || !Number.isFinite(seconds) || seconds < 0) return "—";
  const min = Math.round(seconds / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.round(seconds / 3600);
  if (hr < 24) return `${hr}h`;
  const days = Math.round(seconds / 86400);
  if (days <= 30) return `${days}d`;
  return ">30d";
}

function slaTone(seconds: number | null): string {
  if (!seconds) return "text-slate-500";
  if (seconds < 86400) return "text-emerald-300"; // <1d good
  if (seconds < 3 * 86400) return "text-amber-300"; // 1-3d ok
  return "text-rose-300"; // >3d bad
}

function SlaCell({ seconds }: { seconds: number | null }) {
  return <span className={slaTone(seconds)}>{formatSla(seconds)}</span>;
}

function SlaTile({ avgSec }: { avgSec: number | null }) {
  return (
    <div
      className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
      title="Average time from application received to first recruiter action"
    >
      <div className="text-xs uppercase tracking-wider text-slate-400">Avg SLA</div>
      <div className={`mt-1 text-3xl font-bold ${slaTone(avgSec)}`}>{formatSla(avgSec)}</div>
    </div>
  );
}

function SourceBreakdownChart() {
  const [data, setData] = useState<Awaited<ReturnType<typeof buildApi.recruiterSourceBreakdown>> | null>(null);
  const [days, setDays] = useState<7 | 30 | 90>(30);

  useEffect(() => {
    let cancelled = false;
    buildApi
      .recruiterSourceBreakdown({ days })
      .then((r) => {
        if (!cancelled) setData(r);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  if (!data) return null;
  if (data.total === 0) return null;

  const order: { key: keyof typeof data.buckets; label: string; color: string }[] = [
    { key: "organic", label: "Organic", color: "#10b981" },
    { key: "utm", label: "UTM", color: "#06b6d4" },
    { key: "ref", label: "Referrers", color: "#f59e0b" },
    { key: "widget", label: "Widget", color: "#a855f7" },
    { key: "other", label: "Other", color: "#64748b" },
  ];

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Application sources
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            {data.total} application{data.total === 1 ? "" : "s"} · last {data.days} days
          </div>
        </div>
        <div className="flex items-center gap-1">
          {([7, 30, 90] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`rounded-md px-2 py-0.5 text-[11px] ${
                days === d
                  ? "bg-emerald-500/20 text-emerald-200"
                  : "text-slate-400 hover:bg-white/5"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Stacked bar */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-white/5">
        {order.map(({ key, color }) => {
          const n = data.buckets[key].count;
          if (n === 0) return null;
          const pct = (n / data.total) * 100;
          return (
            <div
              key={key}
              style={{ width: `${pct}%`, backgroundColor: color }}
              title={`${key}: ${n}`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-5">
        {order.map(({ key, label, color }) => {
          const n = data.buckets[key].count;
          const pct = data.total > 0 ? Math.round((n / data.total) * 100) : 0;
          const detail = data.buckets[key].details
            .slice(0, 3)
            .map((d) => d.tag)
            .join(", ");
          return (
            <li key={key} className="flex items-center gap-1.5" title={detail || undefined}>
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-slate-300">{label}</span>
              <span className="ml-auto tabular-nums text-slate-400">
                {n} <span className="text-slate-500">({pct}%)</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TodayDigestTile({ items }: { items: Row[] }) {
  // Stand-up summary for the recruiter computed entirely from existing
  // funnel rows. We need an extra fetch to count "new in last 24h" since
  // the funnel only has totals; reuse the live activity feed (which is
  // already the home page's data source) but filter to apps for vacancies
  // I own.
  const [recentApps, setRecentApps] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    buildApi
      .liveActivity()
      .then((r) => {
        if (cancelled) return;
        // The live feed is platform-wide; we approximate "my new apps" by
        // matching titles against my open vacancies. False positives are
        // possible if two recruiters happen to use the same title — but
        // it's a quick heuristic and the precise count is shown elsewhere.
        const myTitles = new Set(items.filter((r) => r.status === "OPEN").map((r) => r.title));
        const cutoff = Date.now() - 24 * 3600 * 1000;
        const n = r.items.filter(
          (e) =>
            e.kind === "APPLICATION" &&
            myTitles.has(e.title) &&
            new Date(e.at).getTime() >= cutoff,
        ).length;
        setRecentApps(n);
      })
      .catch(() => {
        if (!cancelled) setRecentApps(null);
      });
    return () => {
      cancelled = true;
    };
  }, [items]);

  const nowMs = Date.now();
  const stale = items.filter(
    (r) =>
      r.status === "OPEN" &&
      r.appsPending > 0 &&
      r.oldestPendingAt &&
      nowMs - new Date(r.oldestPendingAt).getTime() > 7 * 86400 * 1000,
  ).reduce((acc, r) => acc + r.appsPending, 0);

  const closing = items.filter(
    (r) =>
      r.status === "OPEN" &&
      r.appsTotal > 0 &&
      r.expiresAt &&
      new Date(r.expiresAt).getTime() - nowMs <= 3 * 86400 * 1000 &&
      new Date(r.expiresAt).getTime() > nowMs,
  ).length;

  const totalPending = items.reduce((a, r) => a + r.appsPending, 0);

  // Skip rendering if nothing actionable.
  if (recentApps === null && totalPending === 0 && stale === 0 && closing === 0) return null;

  const parts: { label: string; value: string | number; tone: string; href: string }[] = [];
  if (recentApps != null && recentApps > 0) {
    parts.push({
      label: "new apps · 24h",
      value: recentApps,
      tone: "text-emerald-300",
      href: "#funnel",
    });
  }
  if (totalPending > 0) {
    parts.push({
      label: "pending",
      value: totalPending,
      tone: "text-amber-300",
      href: "#funnel",
    });
  }
  if (stale > 0) {
    parts.push({
      label: "stale >7d",
      value: stale,
      tone: "text-rose-300",
      href: "/build/applications?staleOnly=1",
    });
  }
  if (closing > 0) {
    parts.push({
      label: "closing ≤3d",
      value: closing,
      tone: "text-fuchsia-300",
      href: "#funnel",
    });
  }

  return (
    <div className="rounded-xl border border-white/10 bg-gradient-to-r from-emerald-500/[0.04] to-fuchsia-500/[0.04] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Today
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-5 gap-y-1">
            {parts.map((p, i) => (
              <a
                key={i}
                href={p.href}
                className="group flex items-baseline gap-1.5"
                title={p.label}
              >
                <span className={`text-xl font-bold ${p.tone}`}>{p.value}</span>
                <span className="text-xs text-slate-400 group-hover:text-slate-200">{p.label}</span>
              </a>
            ))}
          </div>
        </div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500">
          {new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
        </div>
      </div>
    </div>
  );
}

function ExportBundleButton() {
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function run() {
    setBusy(true);
    try {
      const r = await buildApi.exportAll();
      const stamp = new Date().toISOString().slice(0, 10);
      const downloads: { name: string; rows: Record<string, unknown>[] }[] = [
        { name: `qbuild-projects-${stamp}.csv`, rows: r.datasets.projects },
        { name: `qbuild-vacancies-${stamp}.csv`, rows: r.datasets.vacancies },
        { name: `qbuild-applications-${stamp}.csv`, rows: r.datasets.applications },
        { name: `qbuild-reviews-${stamp}.csv`, rows: r.datasets.reviews },
      ];
      let nonEmpty = 0;
      for (const d of downloads) {
        if (d.rows.length === 0) continue;
        downloadCsv(d.name, rowsToCsv(d.rows));
        nonEmpty += 1;
      }
      if (nonEmpty === 0) {
        toast.info("Nothing to export yet.");
      } else {
        toast.success(`Downloaded ${nonEmpty} CSV file${nonEmpty === 1 ? "" : "s"}`);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      title="Download all your data as CSV files (vacancies, applications, projects, reviews)"
      className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
    >
      {busy ? "…" : "↓ Export all"}
    </button>
  );
}

function RejectReasonsChart() {
  const [data, setData] = useState<Awaited<ReturnType<typeof buildApi.rejectReasonsBreakdown>> | null>(null);

  useEffect(() => {
    let cancelled = false;
    buildApi
      .rejectReasonsBreakdown(90)
      .then((r) => {
        if (!cancelled) setData(r);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data || data.total === 0) return null;

  const order: { key: keyof typeof data.buckets; label: string; color: string }[] = [
    { key: "overqualified", label: "Overqualified", color: "#a855f7" },
    { key: "missing-skill", label: "Missing skill", color: "#ef4444" },
    { key: "salary-mismatch", label: "Salary mismatch", color: "#f59e0b" },
    { key: "location", label: "Location", color: "#06b6d4" },
    { key: "timing", label: "Timing", color: "#10b981" },
    { key: "other", label: "Other", color: "#64748b" },
    { key: "unspecified", label: "No reason given", color: "#475569" },
  ];

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Rejection reasons
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            {data.total} rejection{data.total === 1 ? "" : "s"} · last {data.days} days
          </div>
        </div>
      </div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-white/5">
        {order.map(({ key, color }) => {
          const n = data.buckets[key];
          if (n === 0) return null;
          const pct = (n / data.total) * 100;
          return (
            <div
              key={key}
              style={{ width: `${pct}%`, backgroundColor: color }}
              title={`${key}: ${n}`}
            />
          );
        })}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
        {order.map(({ key, label, color }) => {
          const n = data.buckets[key];
          if (n === 0) return null;
          const pct = data.total > 0 ? Math.round((n / data.total) * 100) : 0;
          return (
            <li key={key} className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-slate-300">{label}</span>
              <span className="ml-auto tabular-nums text-slate-400">
                {n} <span className="text-slate-500">({pct}%)</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ClosingSoonBanner({
  items,
  onChanged,
}: {
  items: Row[];
  onChanged: () => void;
}) {
  // OPEN vacancies expiring in <=3 days that have at least one application —
  // worth nudging because closing those silently abandons the candidates.
  const toast = useToast();
  const cutoffMs = Date.now() + 3 * 86400000;
  const closing = items.filter(
    (r) =>
      r.status === "OPEN" &&
      r.expiresAt &&
      new Date(r.expiresAt).getTime() <= cutoffMs &&
      r.appsTotal > 0,
  );
  if (closing.length === 0) return null;

  async function extend(id: string) {
    try {
      // republishVacancy resets expiry to +30d even when status===OPEN. Backend
      // returns 409 vacancy_already_open, so we PATCH-close-then-republish.
      await buildApi.patchVacancy(id, { status: "CLOSED" });
      await buildApi.republishVacancy(id);
      toast.success("Vacancy extended by 30 days");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100">
      <div className="font-semibold text-rose-50">
        ⏰ {closing.length} vacanc{closing.length === 1 ? "y" : "ies"} expiring within 3 days
      </div>
      <p className="mt-1 text-xs text-rose-200/80">
        Each has at least one applicant. Closing silently abandons those candidates —
        extend the vacancy by 30 days or close it explicitly with feedback.
      </p>
      <ul className="mt-2 space-y-1">
        {closing.slice(0, 5).map((r) => {
          const days = r.expiresAt
            ? Math.max(0, Math.ceil((new Date(r.expiresAt).getTime() - Date.now()) / 86400000))
            : 0;
          return (
            <li key={r.id} className="flex items-center justify-between gap-2 border-t border-rose-300/15 pt-1.5 text-xs">
              <Link
                href={`/build/vacancy/${encodeURIComponent(r.id)}`}
                className="truncate text-rose-50 hover:underline"
                title={r.title}
              >
                {r.title} · {r.appsTotal} app{r.appsTotal === 1 ? "" : "s"} · {days}d left
              </Link>
              <button
                type="button"
                onClick={() => extend(r.id)}
                className="shrink-0 rounded-md border border-emerald-300/40 bg-emerald-300/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-300/25"
              >
                +30d
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StaleAppsBanner({ items }: { items: Row[] }) {
  // "Stale" = a PENDING application sitting >7 days untouched. Recruiter
  // ghosting candidates is the #1 complaint vs HH; this banner nudges them.
  const STALE_DAYS = 7;
  const cutoffMs = Date.now() - STALE_DAYS * 86400000;
  const stale = items.filter(
    (r) =>
      r.status === "OPEN" &&
      r.appsPending > 0 &&
      r.oldestPendingAt &&
      new Date(r.oldestPendingAt).getTime() < cutoffMs,
  );
  // Need at least 3 stale vacancies (or 1 with many pending) to be worth nudging.
  const totalStaleApps = stale.reduce((acc, r) => acc + r.appsPending, 0);
  if (stale.length < 1 || totalStaleApps < 3) return null;

  // Oldest one across all
  const oldest = stale.reduce(
    (acc, r) =>
      r.oldestPendingAt && (!acc || new Date(r.oldestPendingAt).getTime() < new Date(acc).getTime())
        ? r.oldestPendingAt
        : acc,
    null as string | null,
  );
  const oldestDays = oldest ? Math.floor((Date.now() - new Date(oldest).getTime()) / 86400000) : 0;

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-amber-50">
            {totalStaleApps} pending application{totalStaleApps === 1 ? "" : "s"} waiting more than {STALE_DAYS} days
          </div>
          <div className="mt-1 text-xs text-amber-200/80">
            Across {stale.length} open vacanc{stale.length === 1 ? "y" : "ies"} — oldest sitting for {oldestDays} day{oldestDays === 1 ? "" : "s"}.
            Ghosted candidates rarely come back; reply or reject within a week.
          </div>
        </div>
        <Link
          href="/build/applications?staleOnly=1"
          className="rounded-md border border-amber-300/40 bg-amber-300/20 px-3 py-1.5 text-xs font-semibold text-amber-50 hover:bg-amber-300/30"
        >
          Review now →
        </Link>
      </div>
      {stale.length <= 5 && (
        <ul className="mt-3 space-y-1 text-xs">
          {stale.slice(0, 5).map((r) => {
            const days = r.oldestPendingAt
              ? Math.floor((Date.now() - new Date(r.oldestPendingAt).getTime()) / 86400000)
              : 0;
            return (
              <li key={r.id} className="flex items-center justify-between border-t border-amber-300/15 pt-1.5">
                <Link
                  href={`/build/vacancy/${encodeURIComponent(r.id)}`}
                  className="truncate text-amber-50 hover:underline"
                  title={r.title}
                >
                  {r.title}
                </Link>
                <span className="ml-2 shrink-0 text-amber-200/70">
                  {r.appsPending} pending · oldest {days}d
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
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
