"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LEVELS } from "../lib/levels";
import { useProgress } from "../lib/useProgress";
import { getLessonsForLevel, levelLessonsCompletion, loadLessonProgress } from "../lib/lessons";
import { ACHIEVEMENTS, computeEarned } from "../lib/achievements";
import { findLesson } from "../lib/lessons";
import { backfillFromLessonProgress, computeDueToday, type DueLesson } from "../lib/spacedRepetition";
import { currentStreak, longestStreak } from "../lib/streak";
import { loadDrawingsProgress } from "../lib/useDrawingsProgress";
import type { LevelStatus } from "../lib/useProgress";

const statusLabel: Record<LevelStatus, string> = {
  locked: "Недоступен",
  open: "Не начат",
  "in-progress": "В процессе",
  done: "Зачтён ✓",
};

const statusColor: Record<LevelStatus, string> = {
  locked: "text-slate-400",
  open: "text-slate-500",
  "in-progress": "text-amber-600",
  done: "text-emerald-600",
};

const statusBorder: Record<LevelStatus, string> = {
  locked: "border-slate-200 opacity-50",
  open: "border-slate-200 hover:border-emerald-300 hover:shadow-md",
  "in-progress": "border-amber-300 hover:border-amber-400 hover:shadow-md",
  done: "border-emerald-300 hover:border-emerald-400 hover:shadow-md",
};

export function LevelHome() {
  const { progress, reset } = useProgress();
  const done = Object.values(progress.levels).filter((l) => l.status === "done").length;
  const total = LEVELS.length;

  // Прогресс уроков считаем на клиенте (после mount), чтобы не было гидратационного рассинхрона
  const [lessonsState, setLessonsState] = useState<{
    done: number;
    total: number;
    perLevel: Record<number, { done: number; total: number; pct: number }>;
    nextLevel: number | null; // уровень с первым непрочитанным уроком
    nextTitle: string | null;  // заголовок этого урока — для CTA
    unread: Array<{ level: number; id: string }>;
  } | null>(null);
  useEffect(() => {
    const lp = loadLessonProgress();
    let totalLessons = 0;
    let doneLessons = 0;
    let nextLevel: number | null = null;
    let nextTitle: string | null = null;
    const perLevel: Record<number, { done: number; total: number; pct: number }> = {};
    const unread: Array<{ level: number; id: string }> = [];
    LEVELS.forEach((lv) => {
      const lessons = getLessonsForLevel(lv.num);
      const t = lessons.length;
      const d = lessons.filter((l) => lp[l.id]?.completed).length;
      totalLessons += t;
      doneLessons += d;
      perLevel[lv.num] = { done: d, total: t, pct: t > 0 ? levelLessonsCompletion(lv.num) : 0 };
      lessons.forEach((l) => {
        if (!lp[l.id]?.completed) unread.push({ level: lv.num, id: l.id });
      });
      if (nextLevel === null) {
        const firstUnread = lessons.find((l) => !lp[l.id]?.completed);
        if (firstUnread) {
          nextLevel = lv.num;
          nextTitle = firstUnread.title;
        }
      }
    });
    setLessonsState({ done: doneLessons, total: totalLessons, perLevel, nextLevel, nextTitle, unread });
    setBadgesEarned(computeEarned(progress, lp).size);
  }, [progress]);

  const [badgesEarned, setBadgesEarned] = useState(0);

  const [streak, setStreak] = useState({ current: 0, longest: 0 });
  useEffect(() => {
    setStreak({ current: currentStreak(), longest: longestStreak() });
  }, [progress]);

  const [drawingsPct, setDrawingsPct] = useState(0);
  useEffect(() => {
    const dp = loadDrawingsProgress();
    const total = dp.basicTotal + dp.advancedTotal + dp.errorsTotal;
    const done  = dp.basicDone  + dp.advancedDone  + dp.errorsDone;
    setDrawingsPct(total > 0 ? Math.round((done / total) * 100) : 0);
  }, [progress]);

  // Spaced repetition — что повторять сегодня
  const [dueToday, setDueToday] = useState<DueLesson[]>([]);
  useEffect(() => {
    backfillFromLessonProgress(); // безопасный one-time fill для старых пользователей
    setDueToday(computeDueToday());
  }, [progress]);

  // Weak spots: уроки с quizScore < 100, отсортированные по слабости
  const [weakSpots, setWeakSpots] = useState<Array<{ id: string; title: string; level: number; score: number }>>([]);
  useEffect(() => {
    const lp = loadLessonProgress();
    const items: Array<{ id: string; title: string; level: number; score: number }> = [];
    Object.entries(lp).forEach(([id, p]) => {
      if (p.quizScore != null && p.quizScore < 100) {
        const lesson = findLesson(id);
        if (lesson) items.push({ id, title: lesson.title, level: lesson.level, score: p.quizScore });
      }
    });
    items.sort((a, b) => a.score - b.score);
    setWeakSpots(items.slice(0, 4));
  }, [progress]);

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-slate-50 dark:bg-slate-950 p-6 transition-colors">
      {/* Заголовок курса */}
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                Курс «Сметное дело в РК»
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
                Сквозной кейс — Капитальный ремонт школы №47, г. Алматы · 5 уровней · 88 учебных часов
              </p>
            </div>
            <div className="text-right flex gap-5">
              <div>
                <div className="text-2xl font-bold text-emerald-600">{done}/{total}</div>
                <div className="text-xs text-slate-400">уровней зачтено</div>
              </div>
              {lessonsState && lessonsState.total > 0 && (
                <div>
                  <div className="text-2xl font-bold text-sky-600">{lessonsState.done}/{lessonsState.total}</div>
                  <div className="text-xs text-slate-400">уроков пройдено</div>
                </div>
              )}
              {streak.current > 0 && (
                <div title={`Лучший streak: ${streak.longest}д`}>
                  <div className="text-2xl font-bold text-orange-500 flex items-center gap-1">
                    🔥 {streak.current}
                  </div>
                  <div className="text-xs text-slate-400">
                    {streak.current === 1 ? "день подряд" : streak.current < 5 ? "дня подряд" : "дней подряд"}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Continue learning CTA + Random */}
          {lessonsState?.nextLevel != null && lessonsState.done < lessonsState.total && (
            <div className="mt-4 flex gap-2">
              <Link
                href={`/smeta-trainer/level/${lessonsState.nextLevel}#lesson-${encodeURIComponent(lessonsState.unread[0]?.id ?? "")}`}
                className="flex-1 flex items-center gap-3 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white rounded-lg p-3 shadow-sm"
              >
                <div className="text-2xl">▶️</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-wide text-sky-100">
                    Продолжить с урока
                  </div>
                  <div className="text-sm font-bold truncate">
                    Уровень {lessonsState.nextLevel} · {lessonsState.nextTitle}
                  </div>
                </div>
                <div className="text-xl">→</div>
              </Link>
              {lessonsState.unread.length > 1 && (
                <button
                  onClick={() => {
                    const pick = lessonsState.unread[Math.floor(Math.random() * lessonsState.unread.length)];
                    window.location.href = `/smeta-trainer/level/${pick.level}#lesson-${encodeURIComponent(pick.id)}`;
                  }}
                  className="px-4 bg-white border-2 border-sky-300 text-sky-700 hover:bg-sky-50 rounded-lg flex items-center gap-1 font-bold text-sm shadow-sm"
                  title="Случайный непрочитанный урок — для повторения вразброс"
                >
                  <span className="text-xl">🎲</span>
                  <span className="hidden sm:inline text-xs">Случайный</span>
                </button>
              )}
            </div>
          )}

          {/* Spaced repetition — что повторять сегодня */}
          {dueToday.length > 0 && (
            <div className="mt-3 bg-purple-50 border border-purple-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">🧠</span>
                <div className="text-xs font-bold text-purple-800 uppercase tracking-wide">
                  Сегодня к повторению — {dueToday.length} {dueToday.length === 1 ? "урок" : dueToday.length < 5 ? "урока" : "уроков"}
                </div>
                <Link
                  href="/smeta-trainer/review"
                  className="ml-auto text-[10px] bg-purple-600 text-white px-2 py-0.5 rounded font-semibold hover:bg-purple-700"
                >
                  ▶ Тренировать
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {dueToday.slice(0, 6).map((d) => (
                  <Link
                    key={d.lessonId}
                    href={`/smeta-trainer/level/${d.level}#lesson-${encodeURIComponent(d.lessonId)}`}
                    className="flex items-center gap-2 bg-white border border-purple-200 rounded px-2 py-1.5 hover:border-purple-400 text-xs"
                  >
                    <span className="shrink-0 w-9 text-right text-[10px] font-mono font-bold text-purple-700">
                      {"⭐".repeat(Math.min(d.reps + 1, 5))}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-800 truncate">{d.title}</div>
                      <div className="text-[10px] text-slate-400">
                        Уровень {d.level} · интервал {d.intervalDays}д
                        {d.overdueDays > 0 && (
                          <span className="text-red-600 ml-1">· просрочен {d.overdueDays}д</span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              {dueToday.length > 6 && (
                <div className="text-[10px] text-purple-600 mt-2 italic">
                  И ещё {dueToday.length - 6} — пройди эти 6, остальные подтянутся завтра.
                </div>
              )}
            </div>
          )}

          {/* Weak spots — повторить уроки с низким quiz-баллом */}
          {weakSpots.length > 0 && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">🔁</span>
                <div className="text-xs font-bold text-amber-800 uppercase tracking-wide">
                  Слабые места — стоит повторить
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {weakSpots.map((w) => (
                  <Link
                    key={w.id}
                    href={`/smeta-trainer/level/${w.level}#lesson-${encodeURIComponent(w.id)}`}
                    className="flex items-center gap-2 bg-white border border-amber-200 rounded px-2 py-1.5 hover:border-amber-400 text-xs"
                  >
                    <span className={`shrink-0 font-mono text-[10px] font-bold w-9 text-right ${
                      w.score < 50 ? "text-red-600" : "text-amber-600"
                    }`}>
                      {w.score}%
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-800 truncate">{w.title}</div>
                      <div className="text-[10px] text-slate-400">Уровень {w.level}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Progress bars */}
          <div className="mt-4 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 w-16 shrink-0">Зачёты</span>
              <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${(done / total) * 100}%` }}
                />
              </div>
            </div>
            {lessonsState && lessonsState.total > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 w-16 shrink-0">Теория</span>
                <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sky-500 rounded-full transition-all"
                    style={{ width: `${(lessonsState.done / lessonsState.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Справочники */}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/smeta-trainer/ssc"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs font-semibold rounded-lg"
            >
              📚 Справочник ССЦ РК 8.04-08-2025
              <span className="text-[10px] text-emerald-500 font-normal">
                189 493 позиций
              </span>
            </Link>
            <Link
              href="/smeta-trainer/ssc-search"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs font-semibold rounded-lg"
            >
              🔍 Глобальный поиск ССЦ
              <span className="text-[10px] text-emerald-500 font-normal">
                все 20 регионов
              </span>
            </Link>
            <Link
              href="/smeta-trainer/ssc-stats"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs font-semibold rounded-lg"
            >
              📊 Статистика ССЦ
              <span className="text-[10px] text-emerald-500 font-normal">
                покрытие по регионам/книгам
              </span>
            </Link>
            <Link
              href="/smeta-trainer/documents"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs font-semibold rounded-lg"
            >
              📄 Учебные документы
              <span className="text-[10px] text-emerald-500 font-normal">
                КС-2 · КС-3 · Ф-2 РК · АОСР
              </span>
            </Link>
            <Link
              href="/smeta-trainer/exam"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-300 text-amber-800 hover:bg-amber-100 text-xs font-semibold rounded-lg"
            >
              🎓 Экзамен
              <span className="text-[10px] text-amber-600 font-normal">
                5 заданий · автопроверка · балл 0–100
              </span>
            </Link>
            <Link
              href="/smeta-trainer/exam-journal"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-300 text-amber-800 hover:bg-amber-100 text-xs font-semibold rounded-lg"
            >
              📔 Журнал попыток
              <span className="text-[10px] text-amber-600 font-normal">
                история · CSV-экспорт
              </span>
            </Link>
            <Link
              href="/smeta-trainer/indexes"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs font-semibold rounded-lg"
            >
              📈 Индексы НДЦС РК 8.04-07-2025
              <span className="text-[10px] text-emerald-500 font-normal">
                15 годовых + 26 квартальных
              </span>
            </Link>
            <Link
              href="/smeta-trainer/methodology"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs font-semibold rounded-lg"
            >
              📖 Методика ССЦ (общие положения)
              <span className="text-[10px] text-emerald-500 font-normal">
                206 пунктов + 225 таблиц
              </span>
            </Link>
            <Link
              href="/smeta-trainer/labor-machines"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs font-semibold rounded-lg"
            >
              💼🚜 Труд + машины (СЦЗТ + СЦЭМ)
              <span className="text-[10px] text-emerald-500 font-normal">
                ставки рабочих и маш.-ч
              </span>
            </Link>
            <Link
              href="/smeta-trainer/glossary"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs font-semibold rounded-lg"
            >
              📕 Глоссарий
              <span className="text-[10px] text-emerald-500 font-normal">
                40+ терминов с поиском
              </span>
            </Link>
            <Link
              href="/smeta-trainer/cheatsheet"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs font-semibold rounded-lg"
            >
              📋 Шпаргалка
              <span className="text-[10px] text-emerald-500 font-normal">
                все формулы на A4
              </span>
            </Link>
            <Link
              href="/smeta-trainer/all-lessons"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs font-semibold rounded-lg"
            >
              📖 Весь курс PDF
              <span className="text-[10px] text-emerald-500 font-normal">
                47 уроков печатно
              </span>
            </Link>
            <Link
              href="/smeta-trainer/drawings-practice/hub"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-indigo-300 text-indigo-700 hover:bg-indigo-50 text-xs font-semibold rounded-lg"
            >
              📐 Чертежи → ВОР
              <span className="text-[10px] text-indigo-500 font-normal">
                {drawingsPct > 0 ? `${drawingsPct}% · ` : ""}9 разделов строительства</span>
            </Link>
            <Link
              href="/smeta-trainer/lessons-search"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-sky-300 text-sky-700 hover:bg-sky-50 text-xs font-semibold rounded-lg"
            >
              🔍 Поиск по урокам
              <span className="text-[10px] text-sky-500 font-normal">
                найти теорию по слову
              </span>
            </Link>
            <Link
              href="/smeta-trainer/notes"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-sky-300 text-sky-700 hover:bg-sky-50 text-xs font-semibold rounded-lg"
            >
              📝 Мои заметки
              <span className="text-[10px] text-sky-500 font-normal">
                конспект + экспорт .md
              </span>
            </Link>
            <Link
              href="/smeta-trainer/favorites"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-300 text-amber-700 hover:bg-amber-50 text-xs font-semibold rounded-lg"
            >
              ★ Избранное
              <span className="text-[10px] text-amber-500 font-normal">
                мини-курс из ★ уроков
              </span>
            </Link>
            <Link
              href="/smeta-trainer/practice"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-purple-300 text-purple-700 hover:bg-purple-50 text-xs font-semibold rounded-lg"
            >
              🕵️ Практика
              <span className="text-[10px] text-purple-500 font-normal">
                7 упражнений «найди ошибку»
              </span>
            </Link>
            <Link
              href="/smeta-trainer/capstone"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-purple-300 text-purple-700 hover:bg-purple-50 text-xs font-semibold rounded-lg"
            >
              📜 Капстоун
              <span className="text-[10px] text-purple-500 font-normal">
                сводный экзамен (10)
              </span>
            </Link>
            <Link
              href="/smeta-trainer/import-check"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-semibold rounded-lg"
            >
              📤 Импорт ЛСР
              <span className="text-[10px] text-rose-500 font-normal">
                CSV → AI-проверка
              </span>
            </Link>
            <Link
              href="/smeta-trainer/dashboard"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg"
            >
              📊 Dashboard
              <span className="text-[10px] text-slate-400 font-normal">
                прогресс + лидерборд
              </span>
            </Link>
            <Link
              href="/smeta-trainer/achievements"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-300 text-amber-700 hover:bg-amber-50 text-xs font-semibold rounded-lg"
            >
              🏅 Достижения
              <span className="text-[10px] text-amber-500 font-normal">
                {badgesEarned}/{ACHIEVEMENTS.length}
              </span>
            </Link>
            {done === total && (
              <Link
                href="/smeta-trainer/certificate"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold rounded-lg shadow"
              >
                🎓 Сертификат
                <span className="text-[10px] text-emerald-100 font-normal">
                  курс пройден
                </span>
              </Link>
            )}
          </div>
        </div>

        {/* Карточки уровней */}
        <div className="grid grid-cols-1 gap-4">
          {LEVELS.map((level) => {
            const lvProgress = progress.levels[level.num] ?? { status: "open" };
            const status = lvProgress.status;
            const isLocked = status === "locked";

            return (
              <Link
                key={level.num}
                href={isLocked ? "#" : `/smeta-trainer/level/${level.num}`}
                className={`block border-2 rounded-xl bg-white dark:bg-slate-800 dark:border-slate-700 p-5 transition-all ${statusBorder[status]} ${isLocked ? "cursor-not-allowed" : "cursor-pointer"}`}
              >
                <div className="flex items-start gap-4">
                  {/* Иконка и номер */}
                  <div className="shrink-0 w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-700 flex flex-col items-center justify-center">
                    <span className="text-2xl">{level.icon}</span>
                    <span className="text-[10px] text-slate-400 font-mono">Ур. {level.num}</span>
                  </div>

                  {/* Контент */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                        {level.role}
                      </span>
                      <span className={`text-xs font-semibold ${statusColor[status]}`}>
                        · {statusLabel[status]}
                      </span>
                      {lvProgress.score !== undefined && (
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                          {lvProgress.score}/100
                        </span>
                      )}
                    </div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">{level.title}</h2>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{level.description}</p>
                    <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                      <span>⏱ ~{level.timeHours} ч</span>
                      <span className="text-slate-300">·</span>
                      <span>✓ {level.zachetCriteria}</span>
                      {lessonsState?.perLevel[level.num] && lessonsState.perLevel[level.num].total > 0 && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span className="inline-flex items-center gap-1">
                            📚 {lessonsState.perLevel[level.num].done}/{lessonsState.perLevel[level.num].total}
                            {lessonsState.perLevel[level.num].pct === 1 && (
                              <span className="text-emerald-600 font-semibold">✓</span>
                            )}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Стрелка */}
                  {!isLocked && (
                    <div className="shrink-0 text-slate-300 text-xl self-center">→</div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Сбросить прогресс */}
        <div className="mt-6 text-center">
          <button
            onClick={() => { if (confirm("Сбросить весь прогресс курса?")) reset(); }}
            className="text-xs text-slate-400 hover:text-red-500 underline"
          >
            Сбросить прогресс курса
          </button>
        </div>
      </div>
    </div>
  );
}
