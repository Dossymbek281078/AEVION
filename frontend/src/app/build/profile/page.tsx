"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { ProfileForm } from "@/components/build/ProfileForm";
import { buildApi, type BuildProfile, type BuildApplication } from "@/lib/build/api";

export default function ProfilePage() {
  return (
    <BuildShell>
      <RequireAuth>
        <ProfileBody />
      </RequireAuth>
    </BuildShell>
  );
}

const APP_STATUS_TONE = {
  PENDING: "bg-slate-500/15 text-slate-200 border-slate-500/30",
  ACCEPTED: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  REJECTED: "bg-rose-500/15 text-rose-200 border-rose-500/30",
} as const;

function ProfileBody() {
  const [profile, setProfile] = useState<BuildProfile | null>(null);
  const [applications, setApplications] = useState<BuildApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      buildApi.me().catch(() => ({ profile: null, user: null as never })),
      buildApi.myApplications().catch(() => ({ items: [] as BuildApplication[], total: 0 })),
    ])
      .then(([me, apps]) => {
        if (cancelled) return;
        setProfile(me.profile);
        setApplications(apps.items);
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
  }, []);

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>;

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <section className="lg:col-span-2">
        <h1 className="mb-1 text-2xl font-bold text-white">Your profile</h1>
        <p className="mb-5 text-sm text-slate-400">
          Tell clients and project owners who you are. Required to apply for vacancies.
        </p>
        {error && <p className="mb-4 text-sm text-rose-300">{error}</p>}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <ProfileForm initial={profile} onSaved={(p) => setProfile(p)} />
        </div>
      </section>

      <aside>
        <h2 className="mb-3 text-lg font-semibold text-white">My applications</h2>
        {applications.length === 0 ? (
          <p className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-5 text-center text-sm text-slate-400">
            You haven&apos;t applied for any vacancies yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {applications.map((a) => (
              <li
                key={a.id}
                className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/build/vacancy/${encodeURIComponent(a.vacancyId)}`}
                    className="line-clamp-1 font-medium text-white hover:text-emerald-200"
                  >
                    {a.vacancyTitle || a.vacancyId}
                  </Link>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${APP_STATUS_TONE[a.status]}`}
                  >
                    {a.status}
                  </span>
                </div>
                {a.projectTitle && (
                  <Link
                    href={`/build/project/${encodeURIComponent(a.projectId || "")}`}
                    className="mt-0.5 line-clamp-1 text-xs text-slate-400 hover:underline"
                  >
                    {a.projectTitle}
                  </Link>
                )}
                <div className="mt-2 text-xs text-slate-500">
                  {new Date(a.createdAt).toLocaleDateString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
