"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { buildApi, type BuildApplication, type ApplicationStatus } from "@/lib/build/api";
import { Skeleton } from "@/components/build/Skeleton";
import { useToast } from "@/components/build/Toast";

const STATUS_COLOR: Record<ApplicationStatus, string> = {
  PENDING: "text-amber-200 bg-amber-500/10 border-amber-500/20",
  ACCEPTED: "text-emerald-200 bg-emerald-500/10 border-emerald-500/20",
  REJECTED: "text-rose-200 bg-rose-500/10 border-rose-500/20",
};

const STATUS_ICON: Record<ApplicationStatus, string> = {
  PENDING: "⏳",
  ACCEPTED: "✅",
  REJECTED: "❌",
};

export default function ApplicationsPage() {
  return (
    <BuildShell>
      <RequireAuth>
        <Body />
      </RequireAuth>
    </BuildShell>
  );
}

function Body() {
  const [items, setItems] = useState<BuildApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ApplicationStatus | "ALL">("ALL");
  const toast = useToast();

  useEffect(() => {
    buildApi
      .myApplications()
      .then((r) => setItems(r.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function withdraw(id: string) {
    if (!confirm("Withdraw this application? The employer will be notified.")) return;
    try {
      await buildApi.withdrawApplication(id);
      toast.success("Application withdrawn");
      const r = await buildApi.myApplications();
      setItems(r.items);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const filtered = filter === "ALL" ? items : items.filter((a) => a.status === filter);

  const counts = {
    ALL: items.length,
    PENDING: items.filter((a) => a.status === "PENDING").length,
    ACCEPTED: items.filter((a) => a.status === "ACCEPTED").length,
    REJECTED: items.filter((a) => a.status === "REJECTED").length,
  };

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My applications</h1>
          <p className="mt-1 text-sm text-slate-400">
            Track vacancies you applied for.
          </p>
        </div>
        <Link
          href="/build/vacancies"
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
        >
          Browse vacancies
        </Link>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {(["ALL", "PENDING", "ACCEPTED", "REJECTED"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              filter === s
                ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-200"
                : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10"
            }`}
          >
            {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}{" "}
            <span className="ml-1 font-bold">{counts[s]}</span>
          </button>
        ))}
      </div>

      {loading && (
        <div className="space-y-3" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex justify-between">
                <Skeleton width="50%" height={16} />
                <Skeleton width={80} height={20} />
              </div>
              <Skeleton width="80%" height={11} className="mt-3" />
              <Skeleton width="30%" height={11} className="mt-1.5" />
            </div>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
          <div className="text-4xl">📋</div>
          <p className="mt-3 text-sm text-slate-400">
            {filter === "ALL"
              ? "You haven't applied for any vacancies yet."
              : `No ${filter.toLowerCase()} applications.`}
          </p>
          <Link
            href="/build/vacancies"
            className="mt-4 inline-block text-sm text-emerald-300 hover:underline"
          >
            Browse open vacancies →
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((a) => (
          <ApplicationCard key={a.id} app={a} onWithdraw={() => withdraw(a.id)} />
        ))}
      </div>
    </div>
  );
}

function ApplicationCard({
  app,
  onWithdraw,
}: {
  app: BuildApplication;
  onWithdraw: () => void;
}) {
  const statusCls = STATUS_COLOR[app.status];
  const icon = STATUS_ICON[app.status];

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 transition hover:border-white/20">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/build/vacancy/${encodeURIComponent(app.vacancyId)}`}
              className="font-semibold text-white hover:text-emerald-200"
            >
              {app.vacancyTitle || "Vacancy"}
            </Link>
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${statusCls}`}>
              {icon} {app.status}
            </span>
          </div>
          {app.projectTitle && (
            <div className="mt-0.5 text-xs text-slate-400">
              Project: {app.projectTitle}
            </div>
          )}
          {app.message && (
            <p className="mt-2 line-clamp-2 text-sm text-slate-300 italic">
              &ldquo;{app.message}&rdquo;
            </p>
          )}
          {app.status === "REJECTED" && app.rejectReason && (
            <p className="mt-1.5 rounded-md bg-rose-500/10 px-2.5 py-1 text-xs text-rose-200">
              Reason: {app.rejectReason}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          {app.salary ? (
            <div className="text-sm font-semibold text-emerald-300">
              ${app.salary.toLocaleString()}
            </div>
          ) : null}
          <div className="mt-1 text-[10px] text-slate-500">
            Applied {new Date(app.createdAt).toLocaleDateString("ru-RU")}
          </div>
          <div className="mt-0.5 text-[10px] text-slate-600">
            Updated {new Date(app.updatedAt).toLocaleDateString("ru-RU")}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/build/vacancy/${encodeURIComponent(app.vacancyId)}`}
          className="rounded-md border border-white/10 px-3 py-1 text-xs text-slate-300 transition hover:bg-white/10"
        >
          View vacancy →
        </Link>
        {app.status === "ACCEPTED" && (
          <>
            <Link
              href={`/build/messages?to=${encodeURIComponent(app.userId)}`}
              className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200 transition hover:bg-emerald-500/20"
            >
              Message employer
            </Link>
            <Link
              href="/build/trials"
              className="rounded-md border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 text-xs text-fuchsia-200 transition hover:bg-fuchsia-500/20"
            >
              Trial tasks
            </Link>
          </>
        )}
        {app.status === "PENDING" && (
          <button
            type="button"
            onClick={onWithdraw}
            className="rounded-md border border-rose-500/20 bg-rose-500/5 px-3 py-1 text-xs text-rose-200/80 transition hover:bg-rose-500/10"
          >
            Withdraw
          </button>
        )}
      </div>
    </div>
  );
}
