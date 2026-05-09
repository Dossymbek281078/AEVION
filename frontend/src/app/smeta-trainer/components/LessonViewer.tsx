"use client";

import { useEffect, useMemo, useState } from "react";
import {
  checkQuizAnswer,
  getLessonsForLevel,
  loadLessonProgress,
  saveLessonProgress,
  type Lesson,
  type Quiz,
} from "../lib/lessons";
import { Markdown } from "./Markdown";

interface Props {
  level: number;
}

/**
 * Просмотрщик уроков уровня. Слева — навигация по урокам с прогрессом,
 * справа — markdown-теория + интерактивные тесты с моментальной проверкой.
 * Прогресс по урокам сохраняется в localStorage (ключ aevion-smeta-lessons-progress-v1).
 */
export function LessonViewer({ level }: Props) {
  const lessons = useMemo(() => getLessonsForLevel(level), [level]);
  // На монтировании прыгаем на первый непрочитанный урок (или 0 — если все пройдены / прогресса нет)
  const [activeIdx, setActiveIdx] = useState(() => {
    if (typeof window === "undefined") return 0;
    const lp = loadLessonProgress();
    const idx = lessons.findIndex((l) => !lp[l.id]?.completed);
    return idx === -1 ? 0 : idx;
  });
  const [progressTick, setProgressTick] = useState(0); // bump для re-read из localStorage
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const active: Lesson | undefined = lessons[activeIdx];

  // Reset state при смене урока
  useEffect(() => {
    setAnswers({});
    setRevealed({});
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [activeIdx]);

  const allProgress = useMemo(() => {
    void progressTick;
    return loadLessonProgress();
  }, [progressTick]);

  if (!active) {
    return (
      <div className="p-6 text-center text-slate-400 text-sm">
        Уроки для этого уровня в разработке.
      </div>
    );
  }
  // После guard'а active гарантированно определён — alias для TS
  const lesson = active;

  function answerKey(quizIdx: number) {
    return `${lesson.id}-${quizIdx}`;
  }

  function setAnswer(quizIdx: number, value: string | number) {
    setAnswers((prev) => ({ ...prev, [answerKey(quizIdx)]: value }));
  }

  function checkAll() {
    if (!lesson.quizzes) {
      // Урок без тестов — просто отмечаем пройденным
      saveLessonProgress(lesson.id, { completed: true, ts: Date.now() });
      setProgressTick((n) => n + 1);
      return;
    }
    const newRevealed: Record<string, boolean> = {};
    let correct = 0;
    lesson.quizzes.forEach((q, i) => {
      const key = answerKey(i);
      newRevealed[key] = true;
      const ans = answers[key];
      if (ans !== undefined && checkQuizAnswer(q, ans)) correct++;
    });
    setRevealed(newRevealed);
    const score = Math.round((correct / lesson.quizzes.length) * 100);
    saveLessonProgress(lesson.id, {
      completed: correct === lesson.quizzes.length,
      quizScore: score,
      ts: Date.now(),
    });
    setProgressTick((n) => n + 1);
  }

  function nextLesson() {
    if (activeIdx + 1 < lessons.length) setActiveIdx(activeIdx + 1);
  }

  const allChecked = lesson.quizzes
    ? lesson.quizzes.every((_, i) => revealed[answerKey(i)])
    : false;
  const allCorrect = lesson.quizzes
    ? lesson.quizzes.every((q, i) => {
        const ans = answers[answerKey(i)];
        return ans !== undefined && checkQuizAnswer(q, ans);
      })
    : true;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar — навигация по урокам */}
      <aside className="w-64 shrink-0 bg-slate-50 border-r border-slate-200 overflow-auto">
        <div className="p-3 border-b border-slate-200">
          <div className="text-[10px] font-bold text-slate-400 uppercase">
            Уровень {level} — Теория
          </div>
          <div className="text-xs text-slate-700 mt-0.5">
            {lessons.length} {lessons.length === 1 ? "урок" : "уроков"} ·{" "}
            {Math.round(lessons.reduce((s, l) => s + l.durationMin, 0))} мин
          </div>
          {/* Progress bar по урокам */}
          {(() => {
            const done = lessons.filter((l) => allProgress[l.id]?.completed).length;
            const pct = lessons.length ? Math.round((done / lessons.length) * 100) : 0;
            return (
              <>
                <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  {done}/{lessons.length} пройдено · {pct}%
                </div>
              </>
            );
          })()}
        </div>
        <ul className="p-2 space-y-0.5">
          {lessons.map((l, i) => {
            const p = allProgress[l.id];
            const isActive = i === activeIdx;
            return (
              <li key={l.id}>
                <button
                  onClick={() => setActiveIdx(i)}
                  className={`w-full text-left px-2 py-1.5 rounded text-xs leading-tight ${
                    isActive
                      ? "bg-emerald-100 text-emerald-900 font-semibold"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-start gap-1.5">
                    <span
                      className={`mt-0.5 text-[10px] shrink-0 ${
                        p?.completed ? "text-emerald-600" : "text-slate-300"
                      }`}
                    >
                      {p?.completed ? "✓" : "○"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] text-slate-500 font-mono">
                        {String(i + 1).padStart(2, "0")}
                      </div>
                      <div className="text-xs">{l.title}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        ~{l.durationMin} мин
                        {p?.quizScore != null && (
                          <span className="ml-1.5 text-emerald-700">
                            · {p.quizScore}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Main — содержимое урока */}
      <main className="flex-1 overflow-auto bg-white">
        <div className="max-w-3xl mx-auto px-6 py-6">
          {/* Заголовок */}
          <div className="mb-5">
            <div className="text-[11px] text-slate-400 uppercase tracking-wide mb-1">
              Урок {activeIdx + 1} из {lessons.length} · ~{lesson.durationMin} мин
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{lesson.title}</h1>
          </div>

          {/* Теория */}
          <article className="prose prose-sm max-w-none text-slate-800 leading-relaxed">
            <Markdown text={lesson.content} />
          </article>

          {/* Тесты */}
          {lesson.quizzes && lesson.quizzes.length > 0 && (
            <section className="mt-8 pt-6 border-t-2 border-emerald-200">
              <h2 className="text-lg font-bold text-slate-900 mb-3">
                ✏️ Проверь себя ({lesson.quizzes.length} вопрос{lesson.quizzes.length > 1 ? (lesson.quizzes.length < 5 ? "а" : "ов") : ""})
              </h2>
              <div className="space-y-4">
                {lesson.quizzes.map((q, i) => {
                  const key = answerKey(i);
                  const userAns = answers[key];
                  const isRevealed = !!revealed[key];
                  const isCorrect =
                    isRevealed && userAns !== undefined && checkQuizAnswer(q, userAns);

                  const bg = isRevealed
                    ? isCorrect
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-red-300 bg-red-50"
                    : "border-slate-200 bg-white";

                  return (
                    <div key={i} className={`border-2 rounded-lg p-4 ${bg}`}>
                      <div className="flex items-start gap-2">
                        <span className="shrink-0 w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-800 mb-2">
                            {q.question}
                          </div>

                          {q.kind === "mc" && (
                            <div className="space-y-1">
                              {q.options.map((opt, oi) => {
                                const selected = userAns === oi;
                                const isThisCorrect = isRevealed && oi === q.correct;
                                const isThisWrongPick = isRevealed && selected && oi !== q.correct;
                                return (
                                  <label
                                    key={oi}
                                    className={`flex items-start gap-2 p-2 rounded cursor-pointer text-xs leading-snug border transition-colors ${
                                      isThisCorrect
                                        ? "border-emerald-400 bg-emerald-100"
                                        : isThisWrongPick
                                          ? "border-red-400 bg-red-100"
                                          : selected
                                            ? "border-emerald-400 bg-white"
                                            : "border-slate-200 bg-white hover:border-slate-300"
                                    } ${isRevealed ? "cursor-default" : ""}`}
                                  >
                                    <input
                                      type="radio"
                                      name={key}
                                      checked={selected}
                                      onChange={() => !isRevealed && setAnswer(i, oi)}
                                      disabled={isRevealed}
                                      className="mt-0.5"
                                    />
                                    <span className="flex-1">{opt}</span>
                                    {isThisCorrect && <span className="text-emerald-600">✓</span>}
                                    {isThisWrongPick && <span className="text-red-600">✗</span>}
                                  </label>
                                );
                              })}
                            </div>
                          )}

                          {q.kind === "fill" && (
                            <div>
                              <input
                                type="text"
                                value={String(userAns ?? "")}
                                onChange={(e) => !isRevealed && setAnswer(i, e.target.value)}
                                disabled={isRevealed}
                                placeholder="Ваш ответ…"
                                className={`w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 ${
                                  isRevealed
                                    ? isCorrect
                                      ? "border-emerald-400 bg-white"
                                      : "border-red-400 bg-white"
                                    : "border-slate-300 focus:ring-emerald-500"
                                }`}
                              />
                              {q.hint && !isRevealed && (
                                <div className="text-[10px] text-slate-400 mt-1 italic">
                                  💡 {q.hint}
                                </div>
                              )}
                            </div>
                          )}

                          {isRevealed && (
                            <div
                              className={`text-xs mt-2 leading-relaxed ${
                                isCorrect ? "text-emerald-800" : "text-red-800"
                              }`}
                            >
                              <strong>{isCorrect ? "✓ Верно. " : "✗ Неверно. "}</strong>
                              {q.explanation}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 flex items-center gap-3">
                {!allChecked ? (
                  <button
                    onClick={checkAll}
                    disabled={Object.keys(answers).filter((k) => k.startsWith(lesson.id)).length === 0}
                    className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Проверить ответы
                  </button>
                ) : (
                  <>
                    <div
                      className={`text-sm font-semibold ${
                        allCorrect ? "text-emerald-700" : "text-amber-700"
                      }`}
                    >
                      {allCorrect
                        ? "✓ Все ответы верны — урок зачтён!"
                        : "Часть ответов неверна. Можешь попробовать ещё раз или идти дальше."}
                    </div>
                    {!allCorrect && (
                      <button
                        onClick={() => {
                          setAnswers({});
                          setRevealed({});
                        }}
                        className="text-xs text-amber-700 underline"
                      >
                        Попробовать снова
                      </button>
                    )}
                  </>
                )}
                {activeIdx + 1 < lessons.length && (
                  <button
                    onClick={nextLesson}
                    className="ml-auto px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-900"
                  >
                    Следующий урок →
                  </button>
                )}
              </div>
            </section>
          )}

          {/* Если у урока нет тестов — простая кнопка «прочитал» */}
          {(!lesson.quizzes || lesson.quizzes.length === 0) && (
            <div className="mt-8 pt-6 border-t-2 border-emerald-200 flex items-center gap-3">
              <button
                onClick={checkAll}
                className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700"
              >
                ✓ Прочитано
              </button>
              {activeIdx + 1 < lessons.length && (
                <button
                  onClick={nextLesson}
                  className="ml-auto px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-900"
                >
                  Следующий урок →
                </button>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
