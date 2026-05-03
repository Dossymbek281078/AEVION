import Link from "next/link";
import type { BuildProject } from "@/lib/build/api";

const STATUS_TONE: Record<BuildProject["status"], string> = {
  OPEN: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  IN_PROGRESS: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  DONE: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

function formatBudget(n: number): string {
  if (!n) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

export function ProjectCard({ project }: { project: BuildProject }) {
  return (
    <Link
      href={`/build/project/${encodeURIComponent(project.id)}`}
      className="group block rounded-xl border border-white/10 bg-white/5 p-5 transition hover:border-white/30 hover:bg-white/10"
    >
      <div className="flex items-start justify-between gap-4">
        <h3 className="line-clamp-2 text-lg font-semibold text-white group-hover:text-emerald-200">
          {project.title}
        </h3>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_TONE[project.status]}`}
        >
          {project.status}
        </span>
      </div>

      <p className="mt-2 line-clamp-3 text-sm text-slate-300">{project.description}</p>

      <dl className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          <dt className="opacity-60">Budget</dt>
          <dd className="font-medium text-slate-200">${formatBudget(project.budget)}</dd>
        </div>
        {project.city && (
          <div className="flex items-center gap-1.5">
            <dt className="opacity-60">City</dt>
            <dd className="font-medium text-slate-200">{project.city}</dd>
          </div>
        )}
        {typeof project.vacancyCount === "number" && (
          <div className="flex items-center gap-1.5">
            <dt className="opacity-60">Vacancies</dt>
            <dd className="font-medium text-slate-200">{project.vacancyCount}</dd>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <dt className="opacity-60">Created</dt>
          <dd className="font-medium text-slate-200">
            {new Date(project.createdAt).toLocaleDateString()}
          </dd>
        </div>
      </dl>
    </Link>
  );
}
