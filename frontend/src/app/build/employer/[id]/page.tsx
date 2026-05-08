import type { Metadata } from "next";
import Link from "next/link";
import { getApiBase } from "@/lib/apiBase";

export const dynamic = "force-dynamic";

type Vacancy = {
  id: string;
  title: string;
  salary: number;
  salaryCurrency: string | null;
  skills: string[];
  city: string | null;
  createdAt: string;
  expiresAt: string | null;
  projectTitle: string;
  projectCity: string | null;
};

type Project = {
  id: string;
  title: string;
  status: string;
  city: string | null;
  budget: number;
  createdAt: string;
  openVacancies: number;
};

type Employer = {
  userId: string;
  name: string;
  title: string | null;
  city: string | null;
  summary: string | null;
  buildRole: string;
  verifiedAt: string | null;
  photoUrl: string | null;
};

type Stats = {
  openVacancies: number;
  openProjects: number;
  totalProjects: number;
  hires: number;
  avgRating: number;
  reviewCount: number;
};

async function fetchEmployer(id: string) {
  try {
    const r = await fetch(
      `${getApiBase()}/api/build/stats/employers/${encodeURIComponent(id)}/overview`,
      { cache: "no-store", signal: AbortSignal.timeout(7000) },
    );
    if (!r.ok) return null;
    const j = await r.json();
    if (!j?.success) return null;
    return j.data as {
      employer: Employer;
      projects: Project[];
      vacancies: Vacancy[];
      stats: Stats;
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await fetchEmployer(id);
  const name = data?.employer?.name ?? "Employer";
  const open = data?.stats?.openVacancies ?? 0;
  const description = open > 0
    ? `${name} has ${open} open vacanc${open === 1 ? "y" : "ies"} on AEVION QBuild.`
    : `${name} on AEVION QBuild — construction & recruiting.`;
  return {
    title: `${name} — AEVION QBuild`,
    description,
    openGraph: { title: `${name} on QBuild`, description, type: "profile" },
  };
}

export default async function EmployerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await fetchEmployer(id);

  if (!data?.employer) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-center">
        <div className="text-4xl font-extrabold text-slate-700">404</div>
        <p className="mt-3 text-sm text-slate-400">Employer not found.</p>
        <Link href="/build/talent" className="mt-4 text-sm text-emerald-300 hover:underline">
          ← Browse talent
        </Link>
      </main>
    );
  }

  const { employer, projects, vacancies, stats } = data;

  // Aggregate "Organization" + ItemList of JobPostings JSON-LD for SEO.
  const orgLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: employer.name,
    description: employer.summary || undefined,
    image: employer.photoUrl || undefined,
    address: employer.city ? { "@type": "PostalAddress", addressLocality: employer.city } : undefined,
  };
  const jobListLd = vacancies.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: vacancies.slice(0, 20).map((v, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `https://aevion.tech/build/vacancy/${encodeURIComponent(v.id)}`,
      name: v.title,
    })),
  } : null;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }} />
      {jobListLd && (
        // eslint-disable-next-line react/no-danger
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jobListLd) }} />
      )}

      <div className="mx-auto max-w-4xl px-4 py-10">
        <Link href="/build" className="text-xs text-slate-400 hover:underline">
          ← QBuild
        </Link>

        <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start">
          {employer.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={employer.photoUrl}
              alt={employer.name}
              width={88}
              height={88}
              className="h-22 w-22 rounded-full object-cover border border-white/10"
            />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-2xl font-bold text-emerald-200">
              {employer.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold text-white">{employer.name}</h1>
              {employer.verifiedAt && (
                <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-200">
                  ✓ verified
                </span>
              )}
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase text-slate-400">
                {employer.buildRole}
              </span>
            </div>
            {employer.title && <div className="mt-0.5 text-sm text-emerald-300">{employer.title}</div>}
            <div className="mt-1 flex flex-wrap gap-4 text-xs text-slate-400">
              {employer.city && <span>📍 {employer.city}</span>}
              {stats.avgRating > 0 && (
                <span>
                  {"★".repeat(Math.round(stats.avgRating))} {stats.avgRating.toFixed(1)} ({stats.reviewCount} reviews)
                </span>
              )}
            </div>
            {employer.summary && <p className="mt-3 text-sm text-slate-300">{employer.summary}</p>}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Open vacancies" value={stats.openVacancies} tone="emerald" />
          <Stat label="Open projects" value={stats.openProjects} />
          <Stat label="All projects" value={stats.totalProjects} />
          <Stat label="Hires" value={stats.hires} tone="emerald" />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/build/u/${encodeURIComponent(id)}`}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Full profile →
          </Link>
          <Link
            href={`/build/messages?to=${encodeURIComponent(id)}`}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
          >
            Send message
          </Link>
        </div>

        {vacancies.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-3 text-lg font-bold text-white">
              Open vacancies <span className="text-slate-500 text-sm font-normal">({vacancies.length})</span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {vacancies.map((v) => (
                <Link
                  key={v.id}
                  href={`/build/vacancy/${encodeURIComponent(v.id)}`}
                  className="block rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-emerald-500/30 hover:bg-white/[0.06]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="min-w-0 truncate text-sm font-semibold text-white">{v.title}</h3>
                    {v.salary > 0 && (
                      <div className="shrink-0 text-sm font-semibold text-emerald-300">
                        {v.salary.toLocaleString()} {v.salaryCurrency || "USD"}
                      </div>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-400">
                    {(v.city || v.projectCity) && <span>📍 {v.city || v.projectCity}</span>}
                    <span className="text-slate-500">{v.projectTitle}</span>
                  </div>
                  {v.skills.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {v.skills.slice(0, 5).map((s) => (
                        <span key={s} className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-200">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        {projects.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-3 text-lg font-bold text-white">Projects</h2>
            <div className="space-y-2">
              {projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/build/project/${encodeURIComponent(p.id)}`}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 transition hover:border-white/20 hover:bg-white/5"
                >
                  <div>
                    <div className="font-semibold text-white">{p.title}</div>
                    <div className="text-xs text-slate-400">
                      {p.city && `${p.city} · `}
                      {p.status} · {p.openVacancies} open vacanc{p.openVacancies === 1 ? "y" : "ies"}
                    </div>
                  </div>
                  {p.budget > 0 && (
                    <div className="text-sm font-semibold text-emerald-300">
                      ${p.budget.toLocaleString()}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        {vacancies.length === 0 && projects.length === 0 && (
          <div className="mt-10 rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
            <p className="text-sm text-slate-400">
              {employer.name} hasn't posted any projects yet.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "emerald";
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`mt-0.5 text-xl font-bold ${tone === "emerald" ? "text-emerald-300" : "text-white"}`}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}
