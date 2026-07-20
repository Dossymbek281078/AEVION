import Link from "next/link";
import type { BuildProject } from "@/lib/build/api";

const STATUS_LABEL: Record<BuildProject["status"], string> = {
  OPEN: "Открыт",
  IN_PROGRESS: "В работе",
  DONE: "Завершён",
};

const STATUS_TONE: Record<BuildProject["status"], string> = {
  OPEN: "bg-[#0a7d72]/10 text-[#075b53] border-[#0a7d72]/30",
  IN_PROGRESS: "bg-[#b7791f]/10 text-[#8a5a12] border-[#b7791f]/30",
  DONE: "bg-[#efeee8] text-[#74767c] border-[#d4d3cc]",
};

const STATUS_DOT: Record<BuildProject["status"], string> = {
  OPEN: "bg-[#0a7d72]",
  IN_PROGRESS: "bg-[#b7791f]",
  DONE: "bg-[#9a9c9f]",
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
      className="group block rounded-xl border border-[#d4d3cc] bg-white p-5 transition hover:border-[#0a7d72] hover:shadow-[0_8px_28px_-18px_rgba(20,30,40,0.35)]"
    >
      {/* Status + city */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${STATUS_TONE[project.status]}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[project.status]}`} />
          {STATUS_LABEL[project.status]}
        </span>
        {project.city && (
          <span className="text-[11px] text-[#74767c]">📍 {project.city}</span>
        )}
        {openVacancies != null && openVacancies > 0 && (
          <span className="text-[11px] text-[#075b53] font-medium">
            {openVacancies} {openVacancies === 1 ? "вакансия" : openVacancies < 5 ? "вакансии" : "вакансий"}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="line-clamp-2 text-base font-bold text-[#17181a] group-hover:text-[#075b53] transition">
        {project.title}
      </h3>

      {/* Description */}
      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[#45474c]">
        {project.description}
      </p>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between text-xs text-[#74767c]">
        <span className="font-semibold text-[#17181a]">{formatBudget(project.budget)}</span>
        <span>
          {daysAgo === 0 ? "сегодня" : daysAgo === 1 ? "вчера" : `${daysAgo} дн. назад`}
        </span>
      </div>
    </Link>
  );
}
