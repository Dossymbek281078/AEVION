"use client";

import { useCallback, useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { BuildShell } from "@/components/build/BuildShell";
import { ApplicationForm } from "@/components/build/ApplicationForm";
import {
  buildApi,
  type BuildVacancy,
  type BuildApplication,
  type ApplicationStatus,
} from "@/lib/build/api";
import { useBuildAuth } from "@/lib/build/auth";

export default function VacancyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const me = useBuildAuth((s) => s.user);

  const [vacancy, setVacancy] = useState<BuildVacancy | null>(null);
  const [applications, setApplications] = useState<BuildApplication[] | null>(null);
  const [myApplied, setMyApplied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    buildApi
      .getVacancy(id)
      .then(async (v) => {
        setVacancy(v);
        if (me?.id) {
          const isOwner = v.clientId === me.id;
          const [my, owned] = await Promise.all([
            buildApi.myApplications().catch(() => ({ items: [] as BuildApplication[], total: 0 })),
            isOwner
              ? buildApi.applicationsByVacancy(id).catch(() => ({ items: [] as BuildApplication[], total: 0 }))
              : Promise.resolve(null),
          ]);
          setMyApplied(my.items.some((a) => a.vacancyId === id));
          setApplications(owned ? owned.items : null);
        }
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [id, me?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading) {
    return (
      <BuildShell>
        <p className="py-8 text-sm text-slate-400">Loading vacancy…</p>
      </BuildShell>
    );
  }
  if (error || !vacancy) {
    return (
      <BuildShell>
        <p className="py-8 text-sm text-rose-300">{error || "Vacancy not found."}</p>
        <Link href="/build" className="text-sm text-emerald-300 underline">
          ← Back to projects
        </Link>
      </BuildShell>
    );
  }

  const isOwner = me?.id === vacancy.clientId;

  return (
    <BuildShell>
      <Link
        href={`/build/project/${encodeURIComponent(vacancy.projectId)}`}
        className="text-xs text-slate-400 underline-offset-2 hover:underline"
      >
        ← {vacancy.projectTitle || "Back to project"}
      </Link>

      <div className="mt-2 mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{vacancy.title}</h1>
          <div className="mt-1 text-xs text-slate-400">
            Posted {new Date(vacancy.createdAt).toLocaleDateString()} ·{" "}
            <span className={vacancy.status === "OPEN" ? "text-emerald-300" : "text-slate-500"}>
              {vacancy.status}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wider text-slate-400">Salary</div>
          <div className="text-2xl font-semibold text-emerald-300">
            {vacancy.salary > 0 ? `$${vacancy.salary.toLocaleString()}` : "—"}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Role description
            </h2>
            <p className="whitespace-pre-wrap text-sm text-slate-200">{vacancy.description}</p>
            {vacancy.skills && vacancy.skills.length > 0 && (
              <div className="mt-4">
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Required skills
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {vacancy.skills.map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs text-emerald-200"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {isOwner && applications && (
            <div className="mt-6">
              <h2 className="mb-3 text-lg font-semibold text-white">
                Applications <span className="text-slate-500">({applications.length})</span>
              </h2>
              {applications.length === 0 ? (
                <p className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-6 text-center text-sm text-slate-400">
                  No applications yet.
                </p>
              ) : (
                <ul className="space-y-3">
                  {applications.map((a) => (
                    <ApplicationRow key={a.id} app={a} onChanged={refresh} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          {!isOwner && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
                Apply
              </h2>
              <ApplicationForm vacancyId={vacancy.id} alreadyApplied={myApplied} onApplied={refresh} />
            </div>
          )}
        </aside>
      </div>
    </BuildShell>
  );
}

const STATUS_TONE: Record<ApplicationStatus, string> = {
  PENDING: "bg-slate-500/15 text-slate-200 border-slate-500/30",
  ACCEPTED: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  REJECTED: "bg-rose-500/15 text-rose-200 border-rose-500/30",
};

function ApplicationRow({ app, onChanged }: { app: BuildApplication; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const matchScore = app.matchScore;
  const matchTone =
    matchScore == null
      ? "bg-slate-500/15 text-slate-300"
      : matchScore >= 80
        ? "bg-emerald-500/20 text-emerald-200"
        : matchScore >= 50
          ? "bg-amber-500/20 text-amber-200"
          : "bg-slate-500/15 text-slate-300";
  return (
    <li className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/build/u/${encodeURIComponent(app.userId)}`}
              className="text-sm font-semibold text-white hover:text-emerald-200"
            >
              {app.applicantName || app.email || app.userId}
            </Link>
            {matchScore != null && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${matchTone}`}
                title={`${app.matchedSkills?.length || 0} of required skills matched`}
              >
                {matchScore}% match
              </span>
            )}
          </div>
          {app.applicantHeadline && (
            <div className="mt-0.5 text-xs text-emerald-200/80">{app.applicantHeadline}</div>
          )}
          <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-slate-400">
            {app.applicantCity && <span>📍 {app.applicantCity}</span>}
            {app.applicantExperienceYears != null && app.applicantExperienceYears > 0 && (
              <span>⏱ {app.applicantExperienceYears}y</span>
            )}
          </div>
          {(app.matchedSkills?.length ?? 0) > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {app.matchedSkills!.slice(0, 6).map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-200"
                >
                  ✓ {s}
                </span>
              ))}
            </div>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs ${STATUS_TONE[app.status]}`}
        >
          {app.status}
        </span>
      </div>
      {app.message && (
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{app.message}</p>
      )}
      <div className="mt-3 flex items-center gap-2">
        <Link
          href={`/build/messages?to=${encodeURIComponent(app.userId)}`}
          className="rounded-md bg-white/10 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/20"
        >
          Message
        </Link>
        {app.status !== "ACCEPTED" && (
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await buildApi.updateApplication(app.id, "ACCEPTED");
                onChanged();
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-md bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50"
          >
            Accept
          </button>
        )}
        {app.status !== "REJECTED" && (
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await buildApi.updateApplication(app.id, "REJECTED");
                onChanged();
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-md bg-rose-500/20 px-3 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-500/30 disabled:opacity-50"
          >
            Reject
          </button>
        )}
      </div>
    </li>
  );
}
