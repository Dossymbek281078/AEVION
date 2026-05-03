import Link from "next/link";
import type { BuildProject } from "@/lib/build/api";

const STATUS_LABEL: Record<BuildProject["status"], string> = {
  OPEN: "Открыт",
  IN_PROGRESS: "В работе",
  DONE: "Завершён",
};

const STATUS_TONE: Record<BuildProject["status"], string> = {
  OPEN: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  IN_PROGRESS: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  DONE: "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

const STATUS_DOT: Record<BuildProject["status"], string> = {
  OPEN: "bg-emerald-400",
  IN_PROGRESS: "bg-amber-400",
  DONE: "bg-slate-500",
};

function formatBudget(n: number): string {
  if (!n) return "По договору";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} млн ₽`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} тыс. ₽`;
  return `${n} ₽`;
}

export function ProjectCard({ project }: { project: BuildProject }) {
  const daysAgo = Math.floor((Date.now() - new Date(project.createdAt).getTime()) / 86400000);
  const openVacancies = typeof project.vacancyCount === "number" ? project.vacancyCount : null;

  return (
    <Link
      href={`/build/project/${encodeURIComponent(project.id)}`}
      className="group block rounded-xl border border-white/10 bg-white/5 p-5 transition hover:border-emerald-500/30 hover:bg-white/10"
    >
      {/* Status + city */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_TONE[project.status]}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[project.status]}`} />
          {STATUS_LABEL[project.status]}
        </span>
        {project.city && (
          <span className="text-[11px] text-slate-500">📍 {project.city}</span>
        )}
        {openVacancies != null && openVacancies > 0 && (
          <span className="text-[11px] text-emerald-400 font-medium">
            {openVacancies} {openVacancies === 1 ? "вакансия" : openVacancies < 5 ? "вакансии" : "вакансий"}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="line-clamp-2 text-base font-bold text-white group-hover:text-emerald-200 transition">
        {project.title}
      </h3>

      {/* Description */}
      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-400">
        {project.description}
      </p>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <span className="font-semibold text-slate-300">{formatBudget(project.budget)}</span>
        <span>
          {daysAgo === 0 ? "сегодня" : daysAgo === 1 ? "вчера" : `${daysAgo} дн. назад`}
        </span>
      </div>
    </Link>
  );
}
