"use client";

/**
 * Список экзаменационных заданий — 5 кейсов разной сложности и тематики.
 * Каждое задание — отдельная страница /smeta-trainer/exam/[id].
 */

import Link from "next/link";
import { EXAM_TASKS } from "../lib/examTasks";

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

export default function ExamListPage() {
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <Link href="/smeta-trainer" className="text-xs text-blue-600 hover:underline">
            ← Главная
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            🎓 Банк экзаменов
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            5 заданий разной сложности и тематики. Каждое — отдельная мини-смета с типовой
            ошибкой, которую нужно найти и исправить. Автопроверка по 4 критериям, балл 0–100.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {EXAM_TASKS.map((task) => (
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
                    <span className="text-[10px] text-slate-500">
                      ~ {task.durationMin} мин
                    </span>
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
          ))}
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded p-4 text-xs text-blue-900">
          <strong>📚 Как сдавать:</strong> в каждом задании дан стартовый шаблон с типовой
          ошибкой. Изучите задание, поправьте объёмы / добавьте недостающие позиции / включите
          нужный коэффициент. Когда готовы — нажмите «Сдать на проверку». Система прогонит 15
          AI-сценариев, сравнит с эталоном и поставит балл.
        </div>
      </div>
    </div>
  );
}
