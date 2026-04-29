import Link from "next/link";
import type { BuildVacancy } from "@/lib/build/api";

export function VacancyCard({
  vacancy,
  showProject = false,
}: {
  vacancy: BuildVacancy;
  showProject?: boolean;
}) {
  const isClosed = vacancy.status === "CLOSED";
  return (
    <Link
      href={`/build/vacancy/${encodeURIComponent(vacancy.id)}`}
      className={`group block rounded-xl border p-4 transition ${
        isClosed
          ? "border-white/5 bg-white/[0.02] opacity-60"
          : "border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate text-base font-semibold text-white group-hover:text-emerald-200">
            {vacancy.title}
          </h4>
          {showProject && vacancy.projectTitle && (
            <p className="mt-0.5 truncate text-xs text-slate-400">
              Project: <span className="text-slate-200">{vacancy.projectTitle}</span>
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-semibold text-emerald-300">
            {vacancy.salary > 0 ? `$${vacancy.salary.toLocaleString()}` : "—"}
          </div>
          {isClosed && <div className="mt-0.5 text-[10px] uppercase text-slate-500">closed</div>}
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-slate-300">{vacancy.description}</p>
      <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
        <span>{new Date(vacancy.createdAt).toLocaleDateString()}</span>
        {typeof vacancy.applicationsCount === "number" && (
          <span>
            {vacancy.applicationsCount} application{vacancy.applicationsCount === 1 ? "" : "s"}
          </span>
        )}
      </div>
    </Link>
  );
}
