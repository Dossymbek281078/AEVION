"use client";

import Link from "next/link";
import { useMemo } from "react";
import { LESSONS } from "../lib/lessons";
import { LEVELS } from "../lib/levels";
import { Markdown } from "../components/Markdown";

/**
 * Все уроки курса в одном печатном документе. Для оффлайн-обучения
 * (распечатать как книгу или сохранить в PDF). Используется тот же
 * Markdown-компонент, что и в LessonViewer.
 */
export default function AllLessonsPage() {
  // Группировка по уровням, сохраняем порядок уроков
  const byLevel = useMemo(() => {
    const map = new Map<number, typeof LESSONS>();
    for (const lv of LEVELS) map.set(lv.num, []);
    for (const lesson of LESSONS) {
      map.get(lesson.level)?.push(lesson);
    }
    return map;
  }, []);

  const totalDur = LESSONS.reduce((s, l) => s + l.durationMin, 0);

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      {/* Toolbar (скрыт при печати) */}
      <header className="bg-white border-b sticky top-0 z-10 print:hidden">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center gap-4">
          <Link href="/smeta-trainer" className="text-xs text-slate-500 hover:text-slate-900">
            ← К курсу
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-900">Весь курс одним документом</h1>
            <p className="text-[11px] text-slate-500">
              {LESSONS.length} уроков · {Math.round(totalDur / 60)} ч · ~{Math.round(LESSONS.length * 5)} страниц A4
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="px-4 py-1.5 bg-emerald-600 text-white text-sm font-semibold rounded hover:bg-emerald-700"
          >
            🖨 Печать / PDF (A4)
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-6 bg-white print:px-8 print:py-0 print:max-w-none">
        {/* Титульная страница */}
        <section className="text-center py-12 print:break-after-page">
          <div className="text-[10px] tracking-[0.3em] text-emerald-700 font-bold uppercase">
            AEVION · Учебная платформа
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mt-6">
            Сметное дело в Республике Казахстан
          </h1>
          <div className="text-base text-slate-500 italic mt-2">
            Полный курс — печатное издание
          </div>
          <div className="mt-12 grid grid-cols-3 gap-4 max-w-md mx-auto text-center">
            <div>
              <div className="text-3xl font-bold text-emerald-700">{LESSONS.length}</div>
              <div className="text-[10px] text-slate-500 uppercase">уроков</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-emerald-700">{LEVELS.length}</div>
              <div className="text-[10px] text-slate-500 uppercase">уровней</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-emerald-700">{Math.round(totalDur / 60)}</div>
              <div className="text-[10px] text-slate-500 uppercase">часов</div>
            </div>
          </div>
          <div className="mt-12 text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Сквозной кейс — Капитальный ремонт СОШ №47, г. Алматы.
            Нормативная база — НДЦС РК 8.01-08-2022, СН РК 8.02-07/-09,
            ССЦ РК 8.04-08-2025.
          </div>
          <div className="mt-16 text-[10px] text-slate-400">
            Сгенерировано: {new Date().toLocaleDateString("ru-RU")}
          </div>
        </section>

        {/* Оглавление */}
        <section className="py-6 print:break-after-page">
          <h2 className="text-xl font-bold text-slate-900 mb-4 border-b-2 border-emerald-600 pb-1">
            Оглавление
          </h2>
          {LEVELS.map((lv) => {
            const lessons = byLevel.get(lv.num) ?? [];
            if (lessons.length === 0) return null;
            return (
              <div key={lv.num} className="mb-4">
                <h3 className="text-sm font-bold text-emerald-800 mt-3 mb-1">
                  {lv.icon} Уровень {lv.num} · {lv.title}
                  <span className="text-[10px] text-slate-500 font-normal ml-2">
                    ({lessons.length} {lessons.length === 1 ? "урок" : lessons.length < 5 ? "урока" : "уроков"},
                    ~{Math.round(lessons.reduce((s, l) => s + l.durationMin, 0) / 60 * 10) / 10} ч)
                  </span>
                </h3>
                <ol className="text-xs text-slate-700 space-y-0.5 list-none ml-2">
                  {lessons.map((l, i) => (
                    <li key={l.id} className="flex">
                      <span className="font-mono text-slate-400 w-12 shrink-0">
                        {lv.num}.{String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="flex-1">{l.title}</span>
                      <span className="text-slate-400 text-[10px] shrink-0 ml-2">
                        ~{l.durationMin} мин
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
        </section>

        {/* Все уроки подряд */}
        {LEVELS.map((lv) => {
          const lessons = byLevel.get(lv.num) ?? [];
          if (lessons.length === 0) return null;
          return (
            <section key={lv.num} className="print:break-before-page">
              {/* Разделитель уровня */}
              <div className="text-center py-12 print:py-16">
                <div className="text-[10px] tracking-[0.3em] text-emerald-700 font-bold uppercase">
                  Уровень {lv.num}
                </div>
                <div className="text-3xl font-bold text-slate-900 mt-3">
                  {lv.icon} {lv.title}
                </div>
                <div className="text-sm text-slate-600 italic mt-2 max-w-md mx-auto">
                  {lv.description ?? lv.role}
                </div>
                <div className="text-xs text-slate-400 mt-3">
                  {lessons.length} уроков · ~{Math.round(lessons.reduce((s, l) => s + l.durationMin, 0) / 60 * 10) / 10} ч
                </div>
              </div>

              {lessons.map((lesson, idx) => (
                <article
                  key={lesson.id}
                  className="py-6 border-t border-slate-200 print:break-inside-avoid-page"
                >
                  <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-1 font-mono">
                    Урок {lv.num}.{String(idx + 1).padStart(2, "0")} · ~{lesson.durationMin} мин
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-4">
                    {lesson.title}
                  </h2>
                  <div className="prose prose-sm max-w-none text-slate-800 leading-relaxed">
                    <Markdown text={lesson.content} />
                  </div>

                  {lesson.quizzes && lesson.quizzes.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-emerald-200">
                      <h3 className="text-sm font-bold text-emerald-800 mb-2">
                        ✏️ Упражнения для самопроверки
                      </h3>
                      <ol className="space-y-3">
                        {lesson.quizzes.map((q, qi) => (
                          <li key={qi} className="text-xs">
                            <div className="font-semibold text-slate-800 mb-1">
                              {qi + 1}. {q.question}
                            </div>
                            {q.kind === "mc" && (
                              <ul className="list-none ml-4 space-y-0.5">
                                {q.options.map((opt, oi) => (
                                  <li key={oi} className="flex items-start gap-2">
                                    <span className="font-mono text-slate-400">{String.fromCharCode(65 + oi)}.</span>
                                    <span>{opt}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                            {q.kind === "fill" && (
                              <div className="ml-4 text-slate-500 italic">
                                Впишите ответ:{q.hint ? ` (подсказка: ${q.hint})` : ""}
                              </div>
                            )}
                            <details className="mt-1 ml-4 text-[10px] text-slate-500">
                              <summary className="cursor-pointer hover:text-emerald-700">
                                Ответ и пояснение
                              </summary>
                              <div className="mt-1 italic">
                                {q.kind === "mc" && (
                                  <span>Правильный ответ: <strong>{String.fromCharCode(65 + q.correct)}</strong>. </span>
                                )}
                                {q.kind === "fill" && q.accepts.length > 0 && (
                                  <span>Принимаемые ответы: <strong>{q.accepts.join(", ")}</strong>. </span>
                                )}
                                {q.explanation}
                              </div>
                            </details>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </article>
              ))}
            </section>
          );
        })}

        {/* Подвал */}
        <footer className="py-8 mt-8 border-t-2 border-emerald-600 text-center text-xs text-slate-500 print:break-before-page">
          <div className="font-bold text-emerald-700">AEVION · Сметный тренажёр РК</div>
          <div className="mt-1">aevion.kz · /smeta-trainer</div>
          <div className="mt-3 text-[10px] text-slate-400 max-w-md mx-auto leading-relaxed">
            Учебный материал. Для применения в реальной экспертной деятельности
            требуется проверка по актуальной редакции нормативных документов РК.
          </div>
        </footer>
      </div>

      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 18mm 16mm; }
          body { background: white; }
          .prose { font-size: 11pt; line-height: 1.4; }
          .prose h1, .prose h2 { break-after: avoid; }
          article { break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
