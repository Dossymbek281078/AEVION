"use client";

/**
 * Floating quick-access panel on /exam/[id]:
 * shortcuts to calculator, rate catalog, and the task lesson.
 * Links open in new tabs and carry ?from=exam&examId=... so the destination
 * pages can offer a "send value back" workflow.
 */

import Link from "next/link";

export function ExamToolsPanel({
  examId,
  hasLesson,
}: {
  examId: string;
  hasLesson: boolean;
}) {
  const fromQuery = `?from=exam&examId=${encodeURIComponent(examId)}`;

  return (
    <aside
      aria-label="Инструменты сметчика"
      className="hidden lg:flex flex-col gap-2 fixed right-4 top-1/2 -translate-y-1/2 z-40 bg-white border border-slate-200 rounded-lg shadow-lg p-2 print:hidden"
    >
      <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold px-1.5 pt-1">
        Инструменты
      </div>
      <ToolLink
        href={`/smeta-trainer/calc${fromQuery}`}
        icon="🧮"
        title="Калькулятор"
        hint="Объёмы, площади, периметры"
      />
      <ToolLink
        href={`/smeta-trainer/rates${fromQuery}`}
        icon="📚"
        title="Каталог расценок"
        hint="Поиск по корпусу"
      />
      <ToolLink
        href={`/smeta-trainer/real-rates${fromQuery}`}
        icon="🏗"
        title="Реальные расценки"
        hint="Форма 4 → аналог в смету"
      />
      {hasLesson && (
        <ToolLink
          href={`/smeta-trainer/exam/${examId}/lesson`}
          icon="📖"
          title="Урок"
          hint="Разбор задания"
          sameTab
        />
      )}
      <ToolLink
        href={`/smeta-trainer/cheatsheet${fromQuery}`}
        icon="📋"
        title="Шпаргалка"
        hint="Формулы и коэффициенты"
      />
    </aside>
  );
}

function ToolLink({
  href,
  icon,
  title,
  hint,
  sameTab,
}: {
  href: string;
  icon: string;
  title: string;
  hint: string;
  sameTab?: boolean;
}) {
  const className =
    "flex items-start gap-2 px-2 py-1.5 rounded hover:bg-emerald-50 text-left w-44 group";
  const content = (
    <>
      <span className="text-xl leading-none">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-xs font-semibold text-slate-800 group-hover:text-emerald-700">
          {title}
        </span>
        <span className="block text-[10px] text-slate-500 truncate">{hint}</span>
      </span>
    </>
  );
  if (sameTab) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {content}
    </a>
  );
}
