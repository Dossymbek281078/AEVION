"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LESSONS, findLesson, checkQuizAnswer, saveLessonProgress } from "../lib/lessons";
import { backfillFromLessonProgress, computeDueToday, recordReview, removeReview, type DueLesson } from "../lib/spacedRepetition";
import { Markdown } from "../components/Markdown";

/**
 * Тренировка очереди spaced repetition. Студент проходит уроки по одному,
 * сразу видит квизы для проверки и решает: «знаю» (advance) / «забыл» (reset).
 */
export default function ReviewPage() {
  const [queue, setQueue] = useState<DueLesson[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [revealed, setRevealed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    backfillFromLessonProgress();
    setQueue(computeDueToday());
    setHydrated(true);
  }, []);

  const current = queue[idx];
  const lesson = current ? findLesson(current.lessonId) : null;

  const score = useMemo(() => {
    if (!lesson?.quizzes) return null;
    let correct = 0;
    lesson.quizzes.forEach((q, i) => {
      const ans = answers[`${lesson.id}-${i}`];
      if (ans !== undefined && checkQuizAnswer(q, ans)) correct++;
    });
    return Math.round((correct / lesson.quizzes.length) * 100);
  }, [lesson, answers]);

  function handleCheck() {
    if (!lesson) return;
    setRevealed(true);
    if (lesson.quizzes && score != null) {
      saveLessonProgress(lesson.id, {
        completed: score === 100,
        quizScore: score,
        ts: Date.now(),
      });
      recordReview(lesson.id, score);
    }
  }

  function handleNext() {
    setRevealed(false);
    setAnswers({});
    if (idx + 1 < queue.length) {
      setIdx(idx + 1);
    } else {
      // Завершили очередь — пересчитаем (некоторые могли стать «не due» после успехов)
      setQueue(computeDueToday());
      setIdx(0);
    }
  }

  function handleSkip() {
    setRevealed(false);
    setAnswers({});
    if (idx + 1 < queue.length) setIdx(idx + 1);
  }

  function handleRemove() {
    if (!current) return;
    if (!confirm("Удалить урок из очереди повторения? (Прогресс самого урока сохранится.)")) return;
    removeReview(current.lessonId);
    const newQueue = queue.filter((_, i) => i !== idx);
    setQueue(newQueue);
    if (idx >= newQueue.length) setIdx(Math.max(0, newQueue.length - 1));
    setRevealed(false);
    setAnswers({});
  }

  if (!hydrated) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-white dark:bg-slate-900 border-b dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center gap-4">
          <Link href="/smeta-trainer" className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100">
            ← К курсу
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">🧠 Тренировка повторения</h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Spaced repetition · {queue.length} {queue.length === 1 ? "урок" : "уроков"} в очереди
            </p>
          </div>
          {queue.length > 0 && (
            <div className="text-xs text-slate-600 dark:text-slate-300 font-mono">
              {idx + 1} / {queue.length}
            </div>
          )}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-6 bg-white dark:bg-slate-900 dark:text-slate-200">
        {queue.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-3">✨</div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Очередь пуста</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 max-w-md mx-auto">
              Сегодня нет уроков для повторения. Возвращайтесь завтра — или
              пройдите ещё уроков, чтобы пополнить очередь.
            </p>
            <div className="mt-6 flex gap-2 justify-center">
              <Link href="/smeta-trainer" className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700">
                ← На главную
              </Link>
              <Link href="/smeta-trainer/lessons-search" className="px-4 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 text-sm font-semibold rounded-lg hover:border-emerald-400">
                🔍 Поиск уроков
              </Link>
            </div>
          </div>
        ) : !lesson ? (
          <div className="text-center py-8 text-slate-400">Урок не найден.</div>
        ) : (
          <article>
            {/* Метаданные урока */}
            <div className="text-[11px] text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-2 flex-wrap">
              <span>Уровень {lesson.level} · ~{lesson.durationMin} мин</span>
              <span className="text-purple-600 dark:text-purple-400">
                интервал {current.intervalDays}д · повторов {current.reps}
              </span>
              {current.overdueDays > 0 && (
                <span className="text-red-600 dark:text-red-400">
                  просрочен {current.overdueDays}д
                </span>
              )}
              <button
                onClick={handleRemove}
                className="ml-auto text-slate-400 hover:text-red-500 underline"
                title="Удалить из очереди"
              >
                удалить
              </button>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              {lesson.title}
            </h2>

            {/* Теория свёрнута — показ по запросу. */}
            <details className="mb-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-3">
              <summary className="cursor-pointer text-xs font-semibold text-slate-600 dark:text-slate-300">
                📚 Перечитать теорию ({lesson.content.split("\n").length} строк)
              </summary>
              <div className="mt-3 prose prose-sm max-w-none text-slate-800 dark:text-slate-200">
                <Markdown text={lesson.content} autoGloss />
              </div>
            </details>

            {/* Квизы */}
            {lesson.quizzes && lesson.quizzes.length > 0 ? (
              <section className="space-y-3">
                {lesson.quizzes.map((q, qi) => {
                  const key = `${lesson.id}-${qi}`;
                  const userAns = answers[key];
                  const isCorrect = revealed && userAns !== undefined && checkQuizAnswer(q, userAns);
                  const isWrong = revealed && userAns !== undefined && !isCorrect;

                  const bg = revealed
                    ? isCorrect
                      ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20"
                      : "border-red-300 bg-red-50 dark:bg-red-900/20"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800";

                  return (
                    <div key={qi} className={`border-2 rounded-lg p-4 ${bg}`}>
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
                        {qi + 1}. {q.question}
                      </div>
                      {q.kind === "mc" ? (
                        <div className="space-y-1">
                          {q.options.map((opt, oi) => {
                            const selected = userAns === oi;
                            const isThisCorrect = revealed && oi === q.correct;
                            const isThisWrongPick = revealed && selected && oi !== q.correct;
                            return (
                              <label
                                key={oi}
                                className={`flex items-start gap-2 p-2 rounded cursor-pointer text-xs leading-snug border ${
                                  isThisCorrect
                                    ? "border-emerald-400 bg-emerald-100 dark:bg-emerald-900/40"
                                    : isThisWrongPick
                                      ? "border-red-400 bg-red-100 dark:bg-red-900/40"
                                      : selected
                                        ? "border-emerald-400 bg-white dark:bg-slate-800"
                                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300"
                                } ${revealed ? "cursor-default" : ""}`}
                              >
                                <input
                                  type="radio"
                                  name={key}
                                  checked={selected}
                                  onChange={() => !revealed && setAnswers((p) => ({ ...p, [key]: oi }))}
                                  disabled={revealed}
                                  className="mt-0.5"
                                />
                                <span className="flex-1 text-slate-800 dark:text-slate-200">{opt}</span>
                                {isThisCorrect && <span className="text-emerald-600">✓</span>}
                                {isThisWrongPick && <span className="text-red-600">✗</span>}
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={String(userAns ?? "")}
                          onChange={(e) => !revealed && setAnswers((p) => ({ ...p, [key]: e.target.value }))}
                          disabled={revealed}
                          placeholder="Ваш ответ…"
                          className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      )}
                      {isWrong && (
                        <div className="text-xs mt-2 text-red-700 dark:text-red-300 leading-relaxed">
                          <strong>✗ Неверно.</strong> {q.explanation}
                        </div>
                      )}
                      {isCorrect && (
                        <div className="text-xs mt-2 text-emerald-700 dark:text-emerald-300 leading-relaxed">
                          <strong>✓ Верно.</strong> {q.explanation}
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>
            ) : (
              <p className="text-sm text-slate-500 italic">
                В этом уроке нет квизов — отметьте «прочитано» для повторения.
              </p>
            )}

            {/* Действия */}
            <div className="mt-5 flex items-center gap-3 flex-wrap">
              {!revealed ? (
                <>
                  <button
                    onClick={handleCheck}
                    disabled={lesson.quizzes ? Object.keys(answers).length === 0 : false}
                    className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-40"
                  >
                    Проверить
                  </button>
                  <button
                    onClick={handleSkip}
                    className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-lg hover:bg-slate-300"
                  >
                    Пропустить →
                  </button>
                </>
              ) : (
                <>
                  <div className={`text-sm font-semibold ${score === 100 ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>
                    {score === 100 ? `✓ ${score}/100 — интервал увеличен` : `${score}/100 — сброс на 1 день`}
                  </div>
                  <button
                    onClick={handleNext}
                    className="ml-auto px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700"
                  >
                    {idx + 1 < queue.length ? "Следующий урок →" : "Завершить тренировку"}
                  </button>
                </>
              )}
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
