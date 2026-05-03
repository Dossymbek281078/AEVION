"use client";

import Link from "next/link";
import { LEVELS } from "../lib/levels";
import { useProgress } from "../lib/useProgress";
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

function formatDate(iso?: string) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return null;
  }
}

export function LevelHome() {
  const { progress, reset } = useProgress();
  const done = Object.values(progress.levels).filter((l) => l.status === "done").length;
  const total = LEVELS.length;
  const allDone = done === total;
  const pct = Math.round((done / total) * 100);
  const name = progress.studentName;

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-slate-50 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">

        {/* Заголовок курса */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              {name && (
                <p className="text-xs text-emerald-600 font-semibold mb-1">
                  👤 {name}{progress.studentGroup ? ` · ${progress.studentGroup}` : ""}
                </p>
              )}
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Курс «Сметное дело в РК»
              </h1>
              <p className="text-slate-500 mt-1 text-xs sm:text-sm">
                Сквозной кейс — Капитальный ремонт школы №47, г. Алматы · 5 уровней · 64 учебных часа
              </p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-2xl font-bold text-emerald-600">{done}/{total}</div>
              <div className="text-xs text-slate-400">уровней зачтено</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3 sm:mt-4">
            <div className="flex justify-between text-[11px] text-slate-400 mb-1">
              <span>Прогресс курса</span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${allDone ? "bg-emerald-500" : "bg-emerald-400"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Баннер завершения курса */}
        {allDone && (
          <div className="mb-6 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-5 text-white shadow-lg">
            <div className="flex items-start gap-4">
              <div className="text-4xl shrink-0">🏆</div>
              <div className="flex-1 min-w-0">
                <div className="text-base font-bold">Курс завершён!</div>
                <p className="text-sm text-emerald-100 mt-0.5">
                  {name ? `${name}, вы` : "Вы"} прошли все 5 уровней и получили квалификацию «Сметчик РК» по программе AEVION.
                </p>
                <Link
                  href="/smeta-trainer/certificate"
                  className="inline-block mt-3 px-4 py-2 bg-white text-emerald-700 text-sm font-bold rounded-lg hover:bg-emerald-50 transition-colors"
                >
                  📜 Получить сертификат
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Не завершён, но есть прогресс */}
        {!allDone && done > 0 && (
          <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-xl">⚡</span>
            <div className="text-sm text-amber-800">
              <strong>{done} из 5 уровней</strong> пройдено.{" "}
              {progress.lastVisited && (
                <Link href={`/smeta-trainer/level/${progress.lastVisited}`} className="underline hover:text-amber-900">
                  Продолжить уровень {progress.lastVisited} →
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Карточки уровней */}
        <div className="grid grid-cols-1 gap-3 sm:gap-4">
          {LEVELS.map((level) => {
            const lvProgress = progress.levels[level.num] ?? { status: "open" };
            const status = lvProgress.status;
            const isLocked = status === "locked";
            const completedDate = formatDate(lvProgress.completedAt);

            return (
              <Link
                key={level.num}
                href={isLocked ? "#" : `/smeta-trainer/level/${level.num}`}
                className={`block border-2 rounded-xl bg-white p-4 sm:p-5 transition-all ${statusBorder[status]} ${isLocked ? "cursor-not-allowed" : "cursor-pointer"}`}
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  {/* Иконка и номер */}
                  <div className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-slate-100 flex flex-col items-center justify-center">
                    <span className="text-xl sm:text-2xl">{level.icon}</span>
                    <span className="text-[9px] sm:text-[10px] text-slate-400 font-mono">Ур. {level.num}</span>
                  </div>

                  {/* Контент */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wide">
                        {level.role}
                      </span>
                      <span className={`text-[10px] sm:text-xs font-semibold ${statusColor[status]}`}>
                        · {statusLabel[status]}
                      </span>
                      {lvProgress.score !== undefined && (
                        <span className="text-[10px] sm:text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">
                          {lvProgress.score}/100
                        </span>
                      )}
                      {completedDate && (
                        <span className="text-[10px] text-slate-400">{completedDate}</span>
                      )}
                    </div>
                    <h2 className="text-sm sm:text-base font-bold text-slate-900 mt-0.5">{level.title}</h2>
                    <p className="text-[11px] sm:text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">{level.description}</p>
                    <div className="mt-2 flex items-center gap-2 sm:gap-3 text-[10px] sm:text-[11px] text-slate-400 flex-wrap">
                      <span>⏱ ~{level.timeHours} ч</span>
                      <span className="text-slate-300">·</span>
                      <span className="truncate">✓ {level.zachetCriteria}</span>
                      {level.lessonRef && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span className="text-slate-400">📚 {level.lessonRef}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Стрелка / зачёт */}
                  <div className="shrink-0 self-center">
                    {status === "done" ? (
                      <span className="text-emerald-500 text-lg">✓</span>
                    ) : !isLocked ? (
                      <span className="text-slate-300 text-xl">→</span>
                    ) : null}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Ссылка на сертификат (если ещё не все сдали, но часть есть) */}
        {!allDone && done > 0 && (
          <div className="mt-4 text-center">
            <Link href="/smeta-trainer/certificate" className="text-xs text-emerald-600 hover:underline">
              📜 Промежуточный отчёт по курсу
            </Link>
          </div>
        )}

        {/* Сбросить прогресс */}
        <div className="mt-4 sm:mt-6 text-center flex items-center justify-center gap-4">
          <button
            onClick={() => { if (confirm("Сбросить весь прогресс курса?")) reset(); }}
            className="text-xs text-slate-400 hover:text-red-500 underline"
          >
            Сбросить прогресс курса
          </button>
          {allDone && (
            <Link href="/smeta-trainer/certificate" className="text-xs text-emerald-600 hover:underline font-semibold">
              Получить сертификат →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
