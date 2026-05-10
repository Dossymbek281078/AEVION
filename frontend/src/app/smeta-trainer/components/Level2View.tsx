"use client";

import { useState, useMemo } from "react";
import { useProgress } from "../lib/useProgress";
import { applyDemoFill } from "../lib/demoFill";
import { getLessonsForLevel, levelLessonsCompletion } from "../lib/lessons";
import { LsrEditor } from "./LsrEditor";
import { LessonViewer } from "./LessonViewer";
import type { Lsr } from "../lib/types";

const INITIAL_LSR: Lsr = {
  id: "lsr-level2-student",
  title: "ЛСР — Отделочные работы крыла Б школы №47",
  objectId: "school-47-wing-b",
  method: "базисно-индексный",
  indexQuarter: "2026-Q2",
  indexRegion: "Алматы",
  meta: {
    strojkaTitle: "Капитальный ремонт СОШ №47, г. Алматы",
    strojkaCode: "02-2026-ПВП 20",
    objectTitle: "Учебный корпус, крыло Б — классные комнаты 1–4 этаж",
    objectCode: "2-02",
    lsrNumber: "2-02-01-01",
    worksTitle: "Демонтажные и отделочные работы крыла Б",
    priceDate: "декабрь 2025 г.",
    author: "",
  },
  sections: [
    { id: "l2-s1", title: "Раздел 1. Демонтажные работы",         category: "демонтажные",  positions: [] },
    { id: "l2-s2", title: "Раздел 2. Штукатурно-шпатлёвочные",    category: "отделочные",   positions: [] },
    { id: "l2-s3", title: "Раздел 3. Окраска",                    category: "отделочные",   positions: [] },
    { id: "l2-s4", title: "Раздел 4. Полы",                       category: "отделочные",   positions: [] },
    { id: "l2-s5", title: "Раздел 5. Окна и двери",               category: "отделочные",   positions: [] },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const STEPS = [
  { id: 1, label: "Заполните шапку ЛСР (реквизиты)", check: "Номер ЛСР, объект, шифр, дата цен" },
  { id: 2, label: "Раздел 1: Демонтажные работы — внесите позиции", check: "Демонтаж штукатурки, стяжки, покрытий, окон, дверей" },
  { id: 3, label: "Раздел 2: Штукатурка и шпатлёвка", check: "Штукатурка по маякам + шпатлёвка 2 слоя" },
  { id: 4, label: "Раздел 3: Окраска стен и откосов", check: "Окраска ВД в 2 слоя + откосы" },
  { id: 5, label: "Раздел 4: Полы — стяжка + покрытие", check: "Стяжка 40 мм + антивандальный линолеум или ламинат" },
  { id: 6, label: "Раздел 5: Окна и двери — замена", check: "ПВХ окна + ПВХ двери" },
  { id: 7, label: "Заполните ВОР с формулами объёмов", check: "Каждая позиция — формула со ссылкой на чертёж" },
  { id: 8, label: "Примените коэффициент К=1.15 к демонтажу и отделке", check: "Школа действующая — коэффициент стеснённости обязателен" },
];

export function Level2View() {
  const { setLevel } = useProgress();
  const [showTask, setShowTask] = useState(true);
  const [mode, setMode] = useState<"editor" | "theory">("editor");
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [lsr, setLsr] = useState(INITIAL_LSR);
  const [demoApplied, setDemoApplied] = useState(false);
  const [lessonsTick, setLessonsTick] = useState(0);
  const lessonsCount = getLessonsForLevel(2).length;
  const lessonsCompletion = lessonsCount > 0 ? levelLessonsCompletion(2) : 0;
  void lessonsTick;

  function handleDemo() {
    if (confirm("Заполнить смету примером? Текущие данные будут заменены демо-данными.")) {
      setLsr(applyDemoFill(INITIAL_LSR));
      setDemoApplied(true);
      setCompletedSteps(new Set([1, 2, 3, 4, 5, 6, 7]));
    }
  }

  function toggleStep(id: number) {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const allDone = completedSteps.size >= 6;

  function handleZachet() {
    setLevel(2, { status: "done", completedAt: new Date().toISOString() });
    alert("Уровень 2 зачтён! Переходите на уровень 3 (ПТО).");
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden relative">
      {/* Mobile open trigger когда aside скрыт */}
      {!showTask && (
        <button
          onClick={() => setShowTask(true)}
          className="md:hidden absolute top-2 left-2 z-30 bg-amber-100 border border-amber-300 rounded-md px-2 py-1 text-xs font-semibold shadow text-amber-800"
        >
          ☰ Задание
        </button>
      )}
      {/* Mobile backdrop */}
      {showTask && (
        <div
          onClick={() => setShowTask(false)}
          className="md:hidden fixed inset-0 bg-black/40 z-40"
        />
      )}
      {/* Task card боковая */}
      {showTask && (
        <aside className="fixed left-0 top-0 bottom-0 w-72 z-50 md:relative md:w-72 md:z-auto md:shrink-0 bg-amber-50 border-r border-amber-200 flex flex-col overflow-auto">
          <div className="px-3 py-3 border-b border-amber-200 flex justify-between items-center">
            <span className="text-xs font-bold text-amber-800 uppercase">Задание — уровень 2</span>
            <button onClick={() => setShowTask(false)} className="text-amber-400 hover:text-amber-700 text-xs">скрыть</button>
          </div>
          {lessonsCount > 0 && (
            <div className="px-3 pt-3">
              <div className="flex gap-1">
                <button
                  onClick={() => setMode("editor")}
                  className={`flex-1 text-[11px] px-2 py-1.5 rounded font-medium ${mode === "editor" ? "bg-amber-200 text-amber-900" : "bg-white text-amber-700 hover:bg-amber-100"}`}
                >
                  ✏️ Редактор
                </button>
                <button
                  onClick={() => setMode("theory")}
                  className={`flex-1 text-[11px] px-2 py-1.5 rounded font-medium ${mode === "theory" ? "bg-amber-200 text-amber-900" : "bg-white text-amber-700 hover:bg-amber-100"}`}
                >
                  📚 Теория
                  <span className="ml-1 text-[9px] opacity-70">{Math.round(lessonsCompletion * 100)}%</span>
                </button>
              </div>
            </div>
          )}
          <div className="p-3 space-y-1">
            <p className="text-xs text-amber-700 mb-3">
              Составьте ЛСР «Отделочные работы крыла Б школы №47». Отмечайте шаги по мере выполнения.
            </p>
            {STEPS.map((step) => (
              <label key={step.id} className="flex gap-2 items-start cursor-pointer group">
                <input
                  type="checkbox"
                  checked={completedSteps.has(step.id)}
                  onChange={() => toggleStep(step.id)}
                  className="mt-0.5 accent-amber-600 shrink-0"
                />
                <div>
                  <div className={`text-xs font-medium ${completedSteps.has(step.id) ? "line-through text-slate-400" : "text-slate-800"}`}>
                    {step.label}
                  </div>
                  <div className="text-[10px] text-slate-400">{step.check}</div>
                </div>
              </label>
            ))}

            <div className="pt-3 mt-2 border-t border-amber-200 space-y-2">
              <button
                onClick={handleDemo}
                className="w-full py-1.5 bg-amber-100 text-amber-800 text-xs font-medium rounded border border-amber-300 hover:bg-amber-200"
              >
                {demoApplied ? "✓ Пример применён" : "👁 Показать пример заполнения"}
              </button>
              <div className="text-[10px] text-amber-700">
                Выполнено: {completedSteps.size}/{STEPS.length} шагов
              </div>
              <button
                onClick={handleZachet}
                disabled={!allDone}
                className="w-full py-2 bg-emerald-600 text-white text-xs font-semibold rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-700"
              >
                Сдать на зачёт
              </button>
              {!allDone && (
                <div className="text-[10px] text-slate-400 text-center">
                  Отметьте минимум 6 шагов
                </div>
              )}
            </div>
          </div>
        </aside>
      )}

      {/* Основная область — редактор */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {!showTask && (
          <div className="px-3 py-1.5 bg-amber-50 border-b border-amber-200 flex justify-between items-center text-xs">
            <span className="text-amber-700 font-medium">Уровень 2 — Составляю ЛСР</span>
            <button onClick={() => setShowTask(true)} className="text-amber-600 underline">показать задание</button>
          </div>
        )}
        {mode === "theory" ? (
          <div className="flex-1 overflow-hidden" onClick={() => setLessonsTick((n) => n + 1)}>
            <LessonViewer level={2} />
          </div>
        ) : (
          /* key сбрасывает LsrEditor когда применяется demo — иначе useLocalSmeta не перечитает initialLsr */
          <div className="flex-1 overflow-hidden">
            <LsrEditor key={demoApplied ? "demo" : "fresh"} initialLsr={lsr} />
          </div>
        )}
      </div>
    </div>
  );
}
