import Link from "next/link";
import type { BuildVacancy } from "@/lib/build/api";
import { BookmarkButton } from "./BookmarkButton";

export function VacancyCard({
  vacancy,
  showProject = false,
  matchScore,
}: {
  vacancy: BuildVacancy;
  showProject?: boolean;
  matchScore?: number | null;
}) {
  const isClosed = vacancy.status === "CLOSED";
  const isFeatured = !!vacancy.boostUntil && new Date(vacancy.boostUntil) > new Date();
  const daysAgo = Math.floor((Date.now() - new Date(vacancy.createdAt).getTime()) / 86400000);

  return (
    <Link
      href={`/build/vacancy/${encodeURIComponent(vacancy.id)}`}
      className={`group block rounded-xl border p-4 transition ${
        isClosed
          ? "border-white/5 bg-white/[0.02] opacity-60"
          : isFeatured
            ? "border-amber-500/40 bg-amber-500/5 hover:border-amber-500/60 hover:bg-amber-500/10"
            : "border-white/10 bg-white/5 hover:border-emerald-500/30 hover:bg-white/10"
      }`}
    >
      {/* Top badges row */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {isFeatured && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">
            ★ В топе
          </span>
        )}
        {matchScore != null && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            matchScore >= 80 ? "bg-emerald-500/20 text-emerald-300" :
            matchScore >= 50 ? "bg-amber-500/20 text-amber-300" :
            "bg-white/5 text-slate-400"
          }`}>
            {matchScore}% совпадение
          </span>
        )}
        {daysAgo === 0 && (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
            Сегодня
          </span>
        )}
        {vacancy.city && (
          <span className="text-[11px] text-slate-500">📍 {vacancy.city}</span>
        )}
      </div>

      {/* Title + salary */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate text-base font-semibold text-white group-hover:text-emerald-200 transition">
            {vacancy.title}
          </h4>
          {showProject && vacancy.projectTitle && (
            <p className="mt-0.5 truncate text-xs text-slate-400">
              {vacancy.projectTitle}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <div className="text-right">
            {vacancy.salary > 0 ? (
              <div className="text-sm font-bold text-emerald-300">
                {vacancy.salary.toLocaleString("ru-RU")}
                <span className="ml-1 text-[11px] font-normal text-slate-400">
                  {vacancy.salaryCurrency || "₽"}
                </span>
              </div>
            ) : (
              <div className="text-xs text-slate-500">по договору</div>
            )}
            {isClosed && <div className="mt-0.5 text-[10px] uppercase text-slate-500">закрыта</div>}
          </div>
          <BookmarkButton kind="VACANCY" targetId={vacancy.id} />
        </div>
      </div>

      {/* Description */}
      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-400">{vacancy.description}</p>

      {/* Skills */}
      {vacancy.skills && vacancy.skills.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {vacancy.skills.slice(0, 5).map((s) => (
            <span key={s} className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-slate-400">
              {s}
            </span>
          ))}
          {vacancy.skills.length > 5 && (
            <span className="text-[11px] text-slate-500">+{vacancy.skills.length - 5}</span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>
          {daysAgo === 0 ? "сегодня" : daysAgo === 1 ? "вчера" : `${daysAgo} дн. назад`}
        </span>
        {typeof vacancy.applicationsCount === "number" && (
          <span className="flex items-center gap-1">
            <span>👥</span>
            <span>{vacancy.applicationsCount} {
              vacancy.applicationsCount === 1 ? "отклик" :
              vacancy.applicationsCount < 5 ? "отклика" : "откликов"
            }</span>
          </span>
        )}
      </div>
    </Link>
  );
}
