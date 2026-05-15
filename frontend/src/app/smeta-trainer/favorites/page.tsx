"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LESSONS, findLesson } from "../lib/lessons";
import { loadBookmarks } from "../lib/useLessonBookmarks";
import { LEVELS } from "../lib/levels";
import { Markdown } from "../components/Markdown";

/**
 * /favorites — мини-курс из избранных уроков. Студент собирает свой
 * персональный сборник — перечитывает, печатает в PDF.
 */
export default function FavoritesPage() {
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setBookmarks(loadBookmarks());
    setHydrated(true);
  }, []);

  const items = useMemo(() => {
    return LESSONS.filter((l) => bookmarks.has(l.id));
  }, [bookmarks]);

  const totalDur = items.reduce((s, l) => s + l.durationMin, 0);

  if (!hydrated) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 print:bg-white">
      {/* Toolbar */}
      <header className="bg-white dark:bg-slate-900 border-b dark:border-slate-700 sticky top-0 z-10 print:hidden">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center gap-4">
          <Link href="/smeta-trainer" className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100">
            ← К курсу
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              ★ Избранные уроки
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {items.length === 0
                ? "Пока ни одного избранного"
                : `${items.length} ${items.length === 1 ? "урок" : items.length < 5 ? "урока" : "уроков"} · ~${Math.round(totalDur / 60 * 10) / 10} ч`}
            </p>
          </div>
          {items.length > 0 && (
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded hover:bg-emerald-700"
            >
              🖨 Печать всех
            </button>
          )}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-6 bg-white dark:bg-slate-900 print:px-8">
        {items.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">★</div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Избранное пусто</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 max-w-md mx-auto">
              Откройте любой урок и нажмите ★ рядом с заголовком — он появится здесь.
              Соберите свой сборник «вернусь к этому позже».
            </p>
            <Link
              href="/smeta-trainer/lessons-search"
              className="inline-block mt-6 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700"
            >
              🔍 Найти уроки
            </Link>
          </div>
        ) : (
          <>
            {/* Содержание */}
            <section className="mb-6 print:break-after-page">
              <div className="text-center mb-4 pb-3 border-b-2 border-emerald-600">
                <div className="text-[10px] tracking-[0.3em] text-emerald-700 dark:text-emerald-400 font-bold uppercase">
                  AEVION · Мой сборник
                </div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
                  Избранные уроки курса «Сметное дело в РК»
                </h1>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {items.length} уроков · ~{Math.round(totalDur / 60 * 10) / 10} ч ·
                  собрано {new Date().toLocaleDateString("ru-RU")}
                </div>
              </div>

              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Содержание</h2>
              <ol className="space-y-1 text-xs">
                {items.map((l, i) => (
                  <li key={l.id} className="flex gap-2">
                    <span className="font-mono text-slate-400 w-8 shrink-0 text-right">
                      {String(i + 1).padStart(2, "0")}.
                    </span>
                    <span className="flex-1 text-slate-800 dark:text-slate-200">{l.title}</span>
                    <span className="text-slate-400 text-[10px] shrink-0">
                      Ур.{l.level} · ~{l.durationMin}м
                    </span>
                  </li>
                ))}
              </ol>
            </section>

            {/* Все уроки подряд */}
            {items.map((lesson, idx) => (
              <article
                key={lesson.id}
                className="py-6 border-t border-slate-200 dark:border-slate-700 print:break-inside-avoid-page"
              >
                <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-1 font-mono flex items-center gap-2">
                  <span>★ Урок {idx + 1} · Уровень {lesson.level} · ~{lesson.durationMin} мин</span>
                  <Link
                    href={`/smeta-trainer/level/${lesson.level}#lesson-${encodeURIComponent(lesson.id)}`}
                    className="ml-auto text-emerald-700 dark:text-emerald-400 hover:underline print:hidden"
                  >
                    открыть в курсе →
                  </Link>
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                  {lesson.title}
                </h2>
                <div className="prose prose-sm max-w-none text-slate-800 dark:text-slate-200 leading-relaxed">
                  <Markdown text={lesson.content} autoGloss={false} />
                </div>
              </article>
            ))}
          </>
        )}
      </div>

      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 16mm; }
          body { background: white; }
          article { break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
