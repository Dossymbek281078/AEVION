"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ACHIEVEMENTS, computeEarned } from "../lib/achievements";
import { useProgress } from "../lib/useProgress";
import { loadLessonProgress } from "../lib/lessons";

export default function AchievementsPage() {
  const { progress } = useProgress();
  const [earned, setEarned] = useState<Set<string>>(new Set());

  useEffect(() => {
    setEarned(computeEarned(progress, loadLessonProgress()));
  }, [progress]);

  const earnedCount = earned.size;
  const total = ACHIEVEMENTS.length;
  const pct = Math.round((earnedCount / total) * 100);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-white dark:bg-slate-900 border-b dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center gap-4">
          <Link href="/smeta-trainer" className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100">
            ← К курсу
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Достижения</h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Бейджи открываются автоматически при выполнении условий курса
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-emerald-600">{earnedCount}/{total}</div>
            <div className="text-[10px] text-slate-400">{pct}% открыто</div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-4 space-y-4">
        {/* Прогресс */}
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            Полная коллекция = курс пройден целиком, теория и практика на 100%
          </div>
        </div>

        {/* Сетка бейджей */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ACHIEVEMENTS.map((a) => {
            const isEarned = earned.has(a.id);
            return (
              <div
                key={a.id}
                className={`border-2 rounded-xl p-4 flex gap-4 items-start ${
                  isEarned
                    ? "bg-white border-emerald-300 shadow-sm"
                    : "bg-slate-50 border-slate-200 opacity-60 grayscale"
                }`}
              >
                <div
                  className={`text-4xl shrink-0 ${isEarned ? "" : "saturate-50"}`}
                  aria-hidden="true"
                >
                  {isEarned ? a.icon : "🔒"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className={`text-sm font-bold ${isEarned ? "text-slate-900" : "text-slate-500"}`}>
                      {a.title}
                    </h2>
                    {isEarned && (
                      <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide">
                        получено
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {a.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-[10px] text-slate-400 text-center pt-3 italic">
          Достижения — учебная мотивация. Прогресс хранится локально в браузере.
        </div>
      </div>
    </div>
  );
}
