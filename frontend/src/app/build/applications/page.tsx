"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { buildApi, type BuildApplication, type ApplicationStatus } from "@/lib/build/api";
import { Skeleton } from "@/components/build/Skeleton";
import { useToast } from "@/components/build/Toast";
import { formatSalary } from "@/lib/build/format";
import { useBuildT } from "../i18n";

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
  const { t, st } = useBuildT();

  useEffect(() => {
    buildApi
      .myApplications()
      .then((r) => setItems(r.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function withdraw(id: string) {
    if (!confirm(t("apps.withdrawConfirm"))) return;
    try {
      await buildApi.withdrawApplication(id);
      toast.success(t("apps.withdrawn"));
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
          <h1 className="text-2xl font-bold text-white">{t("apps.title")}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {t("apps.sub")}
          </p>
        </div>
        <Link
          href="/build/vacancies"
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
        >
          {t("apps.browse")}
        </Link>
      </div>

      <ClosingSoonBanner items={items} />

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
            {s === "ALL" ? t("status.ALL") : st("astatus", s)}{" "}
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
              ? t("apps.none")
              : t("apps.noneStatus", { s: st("astatus", filter) })}
          </p>
          <Link
            href="/build/vacancies"
            className="mt-4 inline-block text-sm text-emerald-300 hover:underline"
          >
            {t("apps.browseOpen")}
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

function ClosingSoonBanner({ items }: { items: BuildApplication[] }) {
  const { t, tn } = useBuildT();
  const closingSoon = items
    .filter((a) => a.status === "PENDING" && a.vacancyStatus === "OPEN" && a.vacancyExpiresAt)
    .map((a) => ({
      ...a,
      daysLeft: Math.ceil(
        (new Date(a.vacancyExpiresAt!).getTime() - Date.now()) / 86400000,
      ),
    }))
    .filter((a) => a.daysLeft >= 0 && a.daysLeft <= 3);

  if (closingSoon.length === 0) return null;

  return (
    <div className="mb-5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-amber-200">
        {t("apps.closingSoon")}
      </div>
      <p className="mt-1 text-sm text-amber-100">
        {closingSoon.length === 1
          ? t("apps.closingOne")
          : t("apps.closingMany", { n: closingSoon.length })}
      </p>
      <ul className="mt-2 space-y-0.5 text-xs">
        {closingSoon.slice(0, 5).map((a) => (
          <li key={a.id}>
            <Link
              href={`/build/vacancy/${encodeURIComponent(a.vacancyId)}`}
              className="text-amber-200 hover:underline"
            >
              {a.vacancyTitle ?? t("common.vacancy")} —{" "}
              {a.daysLeft === 0 ? t("common.endsToday") : tn("common.daysLeft", a.daysLeft)}
            </Link>
          </li>
        ))}
      </ul>
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
  const { t, st, date, lang } = useBuildT();
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
              {app.vacancyTitle || t("common.vacancy")}
            </Link>
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold uppercase ${statusCls}`}>
              {icon} {st("astatus", app.status)}
            </span>
          </div>
          {app.projectTitle && (
            <div className="mt-0.5 text-xs text-slate-400">
              {t("apps.project", { t: app.projectTitle })}
            </div>
          )}
          {app.message && (
            <p className="mt-2 line-clamp-2 text-sm text-slate-300 italic">
              &ldquo;{app.message}&rdquo;
            </p>
          )}
          {app.status === "REJECTED" && app.rejectReason && (
            <p className="mt-1.5 rounded-md bg-rose-500/10 px-2.5 py-1 text-xs text-rose-200">
              {t("common.reason", { r: app.rejectReason })}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          {app.salary ? (
            <div className="text-sm font-semibold text-emerald-300">
              {formatSalary(app.salary, "USD", lang)}
            </div>
          ) : null}
          <div className="mt-1 text-[10px] text-slate-500">
            {t("apps.appliedOn", { date: date(app.createdAt) })}
          </div>
          <div className="mt-0.5 text-[10px] text-slate-600">
            {t("apps.updatedOn", { date: date(app.updatedAt) })}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/build/vacancy/${encodeURIComponent(app.vacancyId)}`}
          className="rounded-md border border-white/10 px-3 py-1 text-xs text-slate-300 transition hover:bg-white/10"
        >
          {t("apps.viewVacancy")}
        </Link>
        {app.status === "ACCEPTED" && (
          <>
            <Link
              href={`/build/messages?to=${encodeURIComponent(app.userId)}`}
              className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200 transition hover:bg-emerald-500/20"
            >
              {t("apps.messageEmployer")}
            </Link>
            <Link
              href="/build/trials"
              className="rounded-md border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 text-xs text-fuchsia-200 transition hover:bg-fuchsia-500/20"
            >
              {t("apps.trials")}
            </Link>
          </>
        )}
        {app.status === "PENDING" && (
          <button
            type="button"
            onClick={onWithdraw}
            className="rounded-md border border-rose-500/20 bg-rose-500/5 px-3 py-1 text-xs text-rose-200/80 transition hover:bg-rose-500/10"
          >
            {t("apps.withdraw")}
          </button>
        )}
      </div>
    </div>
  );
}
