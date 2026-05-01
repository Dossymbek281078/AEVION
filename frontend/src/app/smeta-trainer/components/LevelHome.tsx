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

export function LevelHome() {
  const { progress, reset } = useProgress();
  const done = Object.values(progress.levels).filter((l) => l.status === "done").length;
  const total = LEVELS.length;

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-slate-50 p-6">
      {/* Заголовок курса */}
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Курс «Сметное дело в РК»
              </h1>
              <p className="text-slate-500 mt-1 text-sm">
                Сквозной кейс — Капитальный ремонт школы №47, г. Алматы · 5 уровней · 88 учебных часов
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-emerald-600">{done}/{total}</div>
              <div className="text-xs text-slate-400">уровней зачтено</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${(done / total) * 100}%` }}
            />
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
                className={`block border-2 rounded-xl bg-white p-5 transition-all ${statusBorder[status]} ${isLocked ? "cursor-not-allowed" : "cursor-pointer"}`}
              >
                <div className="flex items-start gap-4">
                  {/* Иконка и номер */}
                  <div className="shrink-0 w-14 h-14 rounded-xl bg-slate-100 flex flex-col items-center justify-center">
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
                    <h2 className="text-base font-bold text-slate-900 mt-0.5">{level.title}</h2>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{level.description}</p>
                    <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                      <span>⏱ ~{level.timeHours} ч</span>
                      <span className="text-slate-300">·</span>
                      <span>✓ {(level as { zachetCriteria?: string; zacketCriteria?: string }).zachetCriteria ?? (level as { zachetCriteria?: string; zacketCriteria?: string }).zacketCriteria}</span>
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
