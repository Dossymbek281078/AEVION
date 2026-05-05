import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getApiBase } from "@/lib/apiBase";

export const dynamic = "force-dynamic";

type Vacancy = {
  id: string;
  title: string;
  salary: number;
  salaryCurrency?: string | null;
  city: string | null;
  projectTitle?: string | null;
  projectCity?: string | null;
  skills: string[];
  createdAt: string;
};

type Salary = {
  avg: number;
  median: number;
  min: number;
  max: number;
  count: number;
};

function slugToSkill(slug: string): string {
  return decodeURIComponent(slug).replace(/-/g, " ").trim();
}

async function fetchSkill(skill: string): Promise<{ vacancies: Vacancy[]; salary: Salary | null }> {
  const apiBase = getApiBase();
  try {
    const [vacancyRes, salaryRes] = await Promise.all([
      fetch(`${apiBase}/api/build/vacancies?skill=${encodeURIComponent(skill)}&status=OPEN&limit=50`, {
        cache: "no-store",
        signal: AbortSignal.timeout(7000),
      }),
      fetch(`${apiBase}/api/build/stats/salary?skill=${encodeURIComponent(skill)}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      }),
    ]);
    const vacancyJson = vacancyRes.ok ? await vacancyRes.json() : null;
    const salaryJson = salaryRes.ok ? await salaryRes.json() : null;
    return {
      vacancies: (vacancyJson?.data?.items ?? []) as Vacancy[],
      salary: (salaryJson?.data ?? null) as Salary | null,
    };
  } catch {
    return { vacancies: [], salary: null };
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const skill = slugToSkill(slug);
  const { vacancies } = await fetchSkill(skill);
  const title = `${capitalize(skill)} jobs — AEVION QBuild`;
  const desc = vacancies.length > 0
    ? `${vacancies.length} open ${skill} vacanc${vacancies.length === 1 ? "y" : "ies"} on AEVION QBuild.`
    : `Open ${skill} jobs in construction on AEVION QBuild.`;
  return {
    title,
    description: desc,
    openGraph: { title, description: desc },
    alternates: {
      types: {
        "application/rss+xml": `/api/build/public/rss/vacancies.xml?skill=${encodeURIComponent(skill)}`,
      },
    },
  };
}

export default async function SkillPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const skill = slugToSkill(slug);
  if (!skill || skill.length > 60) notFound();
  const { vacancies, salary } = await fetchSkill(skill);

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
      {jobListLd && (
        // eslint-disable-next-line react/no-danger
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jobListLd) }} />
      )}

      <div className="mx-auto max-w-4xl px-4 py-10">
        <Link href="/build/vacancies" className="text-xs text-slate-400 hover:underline">
          ← All vacancies
        </Link>

        <header className="mt-3 mb-6">
          <h1 className="text-3xl font-bold text-white">
            {capitalize(skill)} jobs
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {vacancies.length > 0
              ? `${vacancies.length} open ${skill} role${vacancies.length === 1 ? "" : "s"} on AEVION QBuild.`
              : `No open ${skill} roles right now — subscribe via RSS to be notified.`}
          </p>
        </header>

        {salary && salary.count > 0 && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Median salary" value={salary.median > 0 ? `$${salary.median.toLocaleString()}` : "—"} tone="emerald" />
            <Tile label="Avg salary" value={salary.avg > 0 ? `$${salary.avg.toLocaleString()}` : "—"} />
            <Tile label="Min" value={salary.min > 0 ? `$${salary.min.toLocaleString()}` : "—"} />
            <Tile label="Max" value={salary.max > 0 ? `$${salary.max.toLocaleString()}` : "—"} />
          </div>
        )}

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <a
            href={`/api/build/public/rss/vacancies.xml?skill=${encodeURIComponent(skill)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/20"
          >
            🛜 Subscribe via RSS
          </a>
          <Link
            href={`/build/vacancies?skill=${encodeURIComponent(skill)}`}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10"
          >
            Open in feed →
          </Link>
        </div>

        {vacancies.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
            <p className="text-sm text-slate-400">
              No open vacancies for &ldquo;{skill}&rdquo; right now.
            </p>
            <Link href="/build/vacancies" className="mt-3 inline-block text-xs text-emerald-300 underline">
              Browse all vacancies
            </Link>
          </div>
        ) : (
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
                      ${v.salary.toLocaleString()}
                    </div>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
                  {(v.city || v.projectCity) && <span>📍 {v.city || v.projectCity}</span>}
                  {v.projectTitle && <span className="text-slate-500">{v.projectTitle}</span>}
                </div>
                {v.skills?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {v.skills.slice(0, 5).map((s) => (
                      <span
                        key={s}
                        className={
                          s.toLowerCase() === skill.toLowerCase()
                            ? "rounded-full bg-emerald-500/25 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-100"
                            : "rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-300"
                        }
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: "emerald" }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`mt-0.5 text-lg font-bold ${tone === "emerald" ? "text-emerald-300" : "text-white"}`}>
        {value}
      </div>
    </div>
  );
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}
