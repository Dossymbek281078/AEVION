import Link from "next/link";
import type { BuildVacancy } from "@/lib/build/api";
import { BookmarkButton } from "./BookmarkButton";

export function VacancyCard({
  vacancy,
  showProject = false,
}: {
  vacancy: BuildVacancy;
  showProject?: boolean;
}) {
  const isClosed = vacancy.status === "CLOSED";
  const isFeatured = !!vacancy.boostUntil && new Date(vacancy.boostUntil) > new Date();
  return (
    <Link
      href={`/build/vacancy/${encodeURIComponent(vacancy.id)}`}
      className={`group block rounded-xl border p-4 transition ${
        isClosed
          ? "border-white/5 bg-white/[0.02] opacity-60"
          : isFeatured
            ? "border-amber-500/40 bg-amber-500/5 hover:border-amber-500/70"
            : "border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10"
      }`}
    >
      {isFeatured && (
        <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">
          ★ Featured
        </div>
      )}
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
        <div className="flex shrink-0 items-start gap-2">
          <div className="text-right">
            <div className="text-sm font-semibold text-emerald-300">
              {vacancy.salary > 0 ? `$${vacancy.salary.toLocaleString()}` : "—"}
            </div>
            {isClosed && <div className="mt-0.5 text-[10px] uppercase text-slate-500">closed</div>}
          </div>
          <BookmarkButton kind="VACANCY" targetId={vacancy.id} />
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
