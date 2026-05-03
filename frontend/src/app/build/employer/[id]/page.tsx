import type { Metadata } from "next";
import Link from "next/link";
import { getApiBase } from "@/lib/apiBase";

export const dynamic = "force-dynamic";

type Project = {
  id: string;
  title: string;
  status: string;
  city: string | null;
  budget: number;
  createdAt: string;
  vacancyCount: number;
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
  avgRating?: number;
  reviewCount?: number;
  openToWork: boolean;
};

type ReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  reviewerName: string | null;
  createdAt: string;
};

async function fetchEmployer(id: string) {
  try {
    const [profileRes, projectsRes, reviewsRes] = await Promise.all([
      fetch(`${getApiBase()}/api/build/profiles/${encodeURIComponent(id)}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      }),
      fetch(`${getApiBase()}/api/build/projects?limit=20`, {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      }),
      fetch(`${getApiBase()}/api/build/reviews/by-user/${encodeURIComponent(id)}?limit=5`, {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      }),
    ]);

    const profileJson = profileRes.ok ? await profileRes.json() : null;
    const projectsJson = projectsRes.ok ? await projectsRes.json() : null;
    const reviewsJson = reviewsRes.ok ? await reviewsRes.json() : null;

    const employer = profileJson?.data as Employer | null;
    const allProjects = (projectsJson?.data?.items ?? []) as (Project & { clientId?: string })[];
    const projects = allProjects.filter((p) => p.clientId === id || true).slice(0, 10);
    const reviews = (reviewsJson?.data?.items ?? []) as ReviewRow[];
    const avgRating = reviewsJson?.data?.avgRating ?? 0;

    return { employer, projects, reviews, avgRating };
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
  return {
    title: `${name} — AEVION QBuild`,
    description: `${name} projects and vacancies on AEVION QBuild construction recruiting platform.`,
    openGraph: { title: `${name} on QBuild`, type: "profile" },
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

  const { employer, projects, reviews, avgRating } = data;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link href="/build" className="text-xs text-slate-400 hover:underline">
          ← QBuild
        </Link>

        <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start">
          {employer.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={employer.photoUrl}
              alt={employer.name}
              width={80}
              height={80}
              className="h-20 w-20 rounded-full object-cover border border-white/10"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 text-2xl font-bold text-emerald-200">
              {employer.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
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
            {employer.title && (
              <div className="mt-0.5 text-sm text-emerald-300">{employer.title}</div>
            )}
            <div className="mt-1 flex flex-wrap gap-4 text-xs text-slate-400">
              {employer.city && <span>📍 {employer.city}</span>}
              {avgRating > 0 && (
                <span>
                  {"★".repeat(Math.round(avgRating))} {avgRating.toFixed(1)} ({reviews.length} reviews)
                </span>
              )}
            </div>
            {employer.summary && (
              <p className="mt-3 text-sm text-slate-300">{employer.summary}</p>
            )}
          </div>
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

        {projects.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-3 text-lg font-bold text-white">Projects</h2>
            <div className="space-y-2">
              {projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/build/p/${p.id}`}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 transition hover:border-white/20 hover:bg-white/5"
                >
                  <div>
                    <div className="font-semibold text-white">{p.title}</div>
                    <div className="text-xs text-slate-400">
                      {p.city && `${p.city} · `}
                      {p.status} · {p.vacancyCount ?? 0} vacancies
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

        {reviews.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-3 text-lg font-bold text-white">
              Reviews{" "}
              <span className="text-slate-500 text-base font-normal">
                ({avgRating.toFixed(1)} avg)
              </span>
            </h2>
            <div className="space-y-3">
              {reviews.map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-400">
                      {"★".repeat(r.rating)}
                      <span className="text-slate-600">{"★".repeat(5 - r.rating)}</span>
                    </span>
                    <span className="text-xs text-slate-400">{r.reviewerName || "Anonymous"}</span>
                    <span className="ml-auto text-[10px] text-slate-600">
                      {new Date(r.createdAt).toLocaleDateString("ru-RU")}
                    </span>
                  </div>
                  {r.comment && (
                    <p className="mt-1 text-sm text-slate-300 italic">&ldquo;{r.comment}&rdquo;</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="mt-10 rounded-xl border border-white/10 bg-white/[0.02] p-5 text-center">
          <p className="text-sm text-slate-400">
            Want to work with {employer.name}?{" "}
            <Link href="/build/vacancies" className="text-emerald-300 hover:underline">
              Browse their open vacancies →
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
