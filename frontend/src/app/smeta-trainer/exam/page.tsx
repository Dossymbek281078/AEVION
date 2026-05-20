"use client";

/**
 * Список экзаменационных заданий — 5 кейсов разной сложности и тематики.
 * Каждое задание — отдельная страница /smeta-trainer/exam/[id].
 * Бейдж лучшего балла подгружается из localStorage (lib/examJournal).
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { EXAM_TASKS } from "../lib/examTasks";
import { bestScores } from "../lib/examJournal";

const DIFFICULTY_COLOR: Record<string, string> = {
  "лёгкая": "bg-emerald-100 text-emerald-800",
  "средняя": "bg-amber-100 text-amber-800",
  "сложная": "bg-red-100 text-red-800",
};

const CATEGORY_COLOR: Record<string, string> = {
  Отделка: "border-blue-300",
  Кровля: "border-sky-300",
  Фундамент: "border-stone-400",
  Электромонтаж: "border-yellow-400",
  Сантехника: "border-cyan-400",
};

function scoreBadge(score: number): { label: string; cls: string } {
  if (score >= 85) return { label: `✓ ${score} / 100 — отлично`, cls: "bg-emerald-100 text-emerald-800" };
  if (score >= 70) return { label: `${score} / 100 — хорошо`, cls: "bg-blue-100 text-blue-800" };
  if (score >= 50) return { label: `${score} / 100 — удовл.`, cls: "bg-amber-100 text-amber-800" };
  return { label: `${score} / 100 — неуд.`, cls: "bg-red-100 text-red-800" };
}

export default function ExamListPage() {
  const [scores, setScores] = useState<Record<string, number>>({});

  useEffect(() => {
    setScores(bestScores());
  }, []);

  const excellent = EXAM_TASKS.filter((t) => (scores[t.id] ?? 0) >= 85).length;
  const passed = EXAM_TASKS.filter((t) => t.id in scores).length;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <Link href="/smeta-trainer" className="text-xs text-blue-600 hover:underline">
            ← Главная
          </Link>
          <div className="flex items-baseline justify-between mt-1">
            <h1 className="text-2xl font-bold text-slate-900">🎓 Банк экзаменов</h1>
            <Link href="/smeta-trainer/exam-journal" className="text-xs text-blue-600 hover:underline">
              📔 Журнал попыток →
            </Link>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            5 заданий разной сложности и тематики. Каждое — отдельная мини-смета с типовой
            ошибкой. Автопроверка по 4 критериям, балл 0–100.
          </p>
          {(passed > 0 || excellent > 0) && (
            <div className="mt-3 flex gap-2 items-center text-xs">
              <span className="text-slate-500">Прогресс:</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                ✓ {excellent} / {EXAM_TASKS.length} на отлично
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {passed} / {EXAM_TASKS.length} сдано
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {EXAM_TASKS.map((task) => {
            const score = scores[task.id];
            return (
              <Link
                key={task.id}
                href={`/smeta-trainer/exam/${task.id}`}
                className={`block bg-white border-l-4 border-r border-y border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow ${CATEGORY_COLOR[task.category] ?? ""}`}
              >
                <div className="flex items-start gap-3">
                  <div className="text-3xl">{task.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                        {task.category}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${DIFFICULTY_COLOR[task.difficulty]}`}>
                        {task.difficulty}
                      </span>
                      <span className="text-[10px] text-slate-500">~ {task.durationMin} мин</span>
                      {score != null && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${scoreBadge(score).cls}`}>
                          {scoreBadge(score).label}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-semibold text-slate-900 leading-snug">
                      {task.title}
                    </h3>
                    <p className="text-xs text-slate-600 mt-2 leading-relaxed line-clamp-3">
                      {task.object.description}
                    </p>
                    <div className="mt-3 text-[10px] text-slate-400 italic">
                      Что прячет шаблон: <span className="text-slate-600">{task.hiddenError}</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded p-4 text-xs text-blue-900">
          <strong>📚 Как сдавать:</strong> в каждом задании дан стартовый шаблон с типовой
          ошибкой. Изучите задание, поправьте объёмы / добавьте недостающие позиции / включите
          нужный коэффициент. Когда готовы — нажмите «Сдать на проверку». Все сдачи сохраняются
          локально и доступны в журнале попыток.
        </div>
      </div>
    </div>
  );
}
