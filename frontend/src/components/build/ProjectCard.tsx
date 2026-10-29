import Link from "next/link";
import type { BuildProject } from "@/lib/build/api";
import { useI18n } from "@/lib/i18n";
import { useBuildT, type BuildKey } from "@/app/build/i18n";

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

// Бюджет проекта вводится в USD (create-project: «Budget (USD)», страница проекта — «$»);
// до 29.10.2026 карточка показывала его как «тыс. ₽» — валюта расходилась с вводом.
function formatBudget(n: number, t: (k: BuildKey, v?: Record<string, string | number>) => string): string {
  if (!n) return t("card.negotiable");
  if (n >= 1_000_000) return t("card.budgetM", { n: (n / 1_000_000).toFixed(1) });
  if (n >= 1_000) return t("card.budgetK", { n: (n / 1_000).toFixed(0) });
  return t("card.budget", { n });
}

export function ProjectCard({ project }: { project: BuildProject }) {
  const daysAgo = Math.floor((Date.now() - new Date(project.createdAt).getTime()) / 86400000);
  const openVacancies = typeof project.vacancyCount === "number" ? project.vacancyCount : null;
  const { t } = useI18n();
  const { t: tb, tn, st } = useBuildT();

  return (
    <Link
      href={`/build/project/${encodeURIComponent(project.id)}`}
      className="group block rounded-xl border border-[#d4d3cc] bg-white p-5 transition hover:border-[#0a7d72] hover:shadow-[0_8px_28px_-18px_rgba(20,30,40,0.35)]"
    >
      {/* Status + city */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {project.example && (
          <span data-build-example className="inline-flex items-center rounded-full border border-[#b7791f]/40 bg-[#fef3c7] px-2.5 py-1 text-[11px] font-bold text-[#8a5a12]">
            {t("build.example.badge")}
          </span>
        )}
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${STATUS_TONE[project.status]}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[project.status]}`} />
          {st("pstatus", project.status)}
        </span>
        {project.city && (
          <span className="text-[11px] text-[#74767c]">📍 {project.city}</span>
        )}
        {openVacancies != null && openVacancies > 0 && (
          <span className="text-[11px] text-[#075b53] font-medium">
            {tn("card.vacancies", openVacancies)}
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
        <span className="font-semibold text-[#17181a]">{formatBudget(project.budget, tb)}</span>
        <span>
          {daysAgo === 0 ? tb("card.today") : daysAgo === 1 ? tb("card.yesterday") : tb("card.daysAgo", { n: daysAgo })}
        </span>
      </div>
    </Link>
  );
}
