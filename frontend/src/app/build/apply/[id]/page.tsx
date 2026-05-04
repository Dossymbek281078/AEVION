"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { buildApi, type BuildVacancy } from "@/lib/build/api";
import { ApplicationForm } from "@/components/build/ApplicationForm";
import { Skeleton } from "@/components/build/Skeleton";

export default function StandaloneApplyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <BuildShell>
      <RequireAuth>
        <Body vacancyId={id} />
      </RequireAuth>
    </BuildShell>
  );
}

function Body({ vacancyId }: { vacancyId: string }) {
  const router = useRouter();
  const [vacancy, setVacancy] = useState<BuildVacancy | null>(null);
  const [loading, setLoading] = useState(true);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    buildApi.getVacancy(vacancyId).then(setVacancy).catch(() => {}).finally(() => setLoading(false));
  }, [vacancyId]);

  if (loading) {
    return (
      <div className="max-w-lg space-y-3" aria-busy="true">
        <Skeleton width="40%" height={24} />
        <Skeleton width="60%" height={11} />
        <Skeleton width="100%" height={120} className="mt-4" />
      </div>
    );
  }

  if (!vacancy) {
    return (
      <div className="max-w-lg">
        <p className="text-sm text-rose-300">Vacancy not found.</p>
        <Link href="/build/vacancies" className="mt-4 inline-block text-sm text-emerald-300 hover:underline">
          Browse vacancies →
        </Link>
      </div>
    );
  }

  if (applied) {
    return (
      <div className="max-w-lg rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center">
        <div className="text-4xl">✅</div>
        <h1 className="mt-3 text-xl font-bold text-white">Application sent!</h1>
        <p className="mt-2 text-sm text-slate-400">
          The employer will review and respond via messages.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <Link href="/build/applications" className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400">
            My applications
          </Link>
          <Link href="/build/vacancies" className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">
            Browse more
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <Link
        href={`/build/vacancy/${encodeURIComponent(vacancyId)}`}
        className="text-xs text-slate-400 hover:underline"
      >
        ← View full vacancy
      </Link>

      <h1 className="mt-3 text-2xl font-bold text-white">{vacancy.title}</h1>
      <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-400">
        {vacancy.salary > 0 && <span className="text-emerald-300">${vacancy.salary.toLocaleString()}</span>}
        {vacancy.city && <span>📍 {vacancy.city}</span>}
      </div>

      <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">Apply</h2>
        <ApplicationForm
          vacancyId={vacancyId}
          alreadyApplied={false}
          questions={vacancy.questions || []}
          onApplied={() => {
            setApplied(true);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      </div>
    </div>
  );
}
