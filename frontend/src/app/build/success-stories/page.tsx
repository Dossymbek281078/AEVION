import type { Metadata } from "next";
import Link from "next/link";
import { getApiBase } from "@/lib/apiBase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Success Stories — AEVION QBuild",
  description: "Real hires made through AEVION QBuild construction recruiting platform.",
  openGraph: { title: "QBuild Success Stories", type: "website" },
};

type HireRow = {
  vacancyTitle: string;
  projectTitle: string | null;
  projectCity: string | null;
  recruiterName: string;
  workerName: string;
  salary: number;
  salaryCurrency: string;
  acceptedAt: string;
};

async function fetchHires(): Promise<HireRow[]> {
  try {
    const r = await fetch(
      `${getApiBase()}/api/build/stats/hires?limit=20`,
      { cache: "no-store", signal: AbortSignal.timeout(5000) },
    );
    if (!r.ok) return [];
    const j = await r.json();
    return j?.data?.items ?? [];
  } catch {
    return [];
  }
}

export default async function SuccessStoriesPage() {
  const hires = await fetchHires();

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-3xl">
        <Link href="/build" className="text-xs text-slate-400 hover:underline">← QBuild</Link>

        <div className="mt-4 mb-2 text-xs font-bold uppercase tracking-wider text-emerald-300">
          AEVION QBuild
        </div>
        <h1 className="text-3xl font-extrabold text-white">Success stories</h1>
        <p className="mt-2 text-sm text-slate-400">
          Real hires made on the platform. Every ✅ here is a worker who found a job and an employer who found their crew.
        </p>

        {hires.length === 0 ? (
          <div className="mt-10 rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
            <div className="text-4xl">🏗</div>
            <p className="mt-3 text-sm text-slate-400">
              Be the first hire! Browse open vacancies and apply.
            </p>
            <Link href="/build/vacancies" className="mt-4 inline-block rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400">
              Browse vacancies →
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {hires.map((h, i) => (
              <div key={i} className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">✅</span>
                  <div>
                    <div className="font-bold text-white">{h.workerName}</div>
                    <div className="mt-0.5 text-sm text-emerald-200">hired as {h.vacancyTitle}</div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-400">
                      {h.projectTitle && <span>Project: {h.projectTitle}</span>}
                      {h.projectCity && <span>📍 {h.projectCity}</span>}
                      {h.salary > 0 && (
                        <span>Salary: ${h.salary.toLocaleString()} {h.salaryCurrency}</span>
                      )}
                      <span>{new Date(h.acceptedAt).toLocaleDateString("ru-RU")}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-12 rounded-xl border border-white/10 bg-white/[0.02] p-6">
          <h2 className="text-lg font-bold text-white">Your hire could be next</h2>
          <p className="mt-1 text-sm text-slate-400">
            Free to post. Pay-per-Hire from 6%. AI-scored applications.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/build/create-project" className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-emerald-950 hover:bg-emerald-400">
              Post a project →
            </Link>
            <Link href="/build/vacancies" className="rounded-lg border border-white/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10">
              Browse vacancies
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
