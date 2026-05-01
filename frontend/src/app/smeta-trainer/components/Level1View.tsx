"use client";

import { useState } from "react";
import { QUIZ_QUESTIONS } from "../lib/quiz";
import { LEVEL1_LSR } from "../lib/levels";
import { useProgress } from "../lib/useProgress";
import { calcLsr, formatKzt } from "../lib/calc";
import { LsrFormTable } from "./LsrFormTable";
import { LsrFormHeader } from "./LsrFormHeader";

const PASS_THRESHOLD = 12;

export function Level1View() {
  const { setLevel } = useProgress();
  const [tab, setTab] = useState<"smeta" | "quiz">("smeta");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState(false);

  const calc = calcLsr(LEVEL1_LSR);

  function checkAnswer(q: typeof QUIZ_QUESTIONS[0], answer: string): boolean {
    if (!answer.trim()) return false;
    const lower = answer.toLowerCase();
    return q.keywords.some((kw) => lower.includes(kw));
  }

  const scores = checked
    ? QUIZ_QUESTIONS.map((q) => checkAnswer(q, answers[q.id] ?? ""))
    : [];
  const correctCount = scores.filter(Boolean).length;
  const passed = checked && correctCount >= PASS_THRESHOLD;

  function handleSubmit() {
    setChecked(true);
    const score = Math.round((correctCount / QUIZ_QUESTIONS.length) * 100);
    setLevel(1, {
      status: correctCount >= PASS_THRESHOLD ? "done" : "in-progress",
      score,
      completedAt: new Date().toISOString(),
      attempts: 1,
    });
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Левая панель — навигация */}
      <aside className="w-56 shrink-0 bg-slate-50 border-r border-slate-200 flex flex-col p-3 gap-2">
        <div className="text-[10px] font-bold text-slate-400 uppercase">Уровень 1 — С нуля</div>
        <div className="text-xs font-semibold text-slate-700 leading-tight">
          Читаю готовую смету
        </div>
        <div className="text-[10px] text-slate-500 mt-1">
          Объект: крыло А школы №47
        </div>
        <div className="text-[10px] text-slate-500">
          Позиций: {QUIZ_QUESTIONS.length} вопросов · Зачёт ≥ {PASS_THRESHOLD}
        </div>
        <hr className="border-slate-200 my-1" />
        <button
          onClick={() => setTab("smeta")}
          className={`text-left text-xs px-2 py-1.5 rounded ${tab === "smeta" ? "bg-emerald-100 text-emerald-800 font-semibold" : "text-slate-600 hover:bg-slate-100"}`}
        >
          📄 Читать смету
        </button>
        <button
          onClick={() => setTab("quiz")}
          className={`text-left text-xs px-2 py-1.5 rounded ${tab === "quiz" ? "bg-emerald-100 text-emerald-800 font-semibold" : "text-slate-600 hover:bg-slate-100"}`}
        >
          ✏️ Ответить на вопросы
          {checked && (
            <span className={`ml-1 font-bold ${passed ? "text-emerald-600" : "text-red-500"}`}>
              {correctCount}/{QUIZ_QUESTIONS.length}
            </span>
          )}
        </button>
        <div className="mt-auto text-[10px] text-slate-400 italic">
          Смета — только для чтения. Изменения недоступны.
        </div>
      </aside>

      {/* Основная область */}
      <main className="flex-1 overflow-auto">
        {tab === "smeta" && (
          <div className="p-4 space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded px-4 py-3 text-sm">
              <strong>Задание уровня 1.</strong> Изучите эту смету, затем перейдите на вкладку «Ответить на вопросы». Зачёт: ≥{PASS_THRESHOLD} из {QUIZ_QUESTIONS.length} правильных ответов.
            </div>
            <LsrFormHeader
              meta={LEVEL1_LSR.meta ?? {}}
              calc={calc}
              onChange={() => {}}
            />
            <LsrFormTable
              calc={calc}
              notices={[]}
              onChangeVolume={() => {}}
              onRemove={() => {}}
            />
          </div>
        )}

        {tab === "quiz" && (
          <div className="p-4 max-w-3xl mx-auto space-y-4">
            {checked && (
              <div className={`rounded-xl p-4 text-center ${passed ? "bg-emerald-50 border border-emerald-300" : "bg-amber-50 border border-amber-300"}`}>
                <div className="text-2xl font-bold">{correctCount}/{QUIZ_QUESTIONS.length}</div>
                <div className={`font-semibold mt-1 ${passed ? "text-emerald-700" : "text-amber-700"}`}>
                  {passed ? "✓ Зачёт получен!" : "Пересдача — не хватает " + (PASS_THRESHOLD - correctCount) + " ответов"}
                </div>
                {!passed && (
                  <button
                    onClick={() => { setChecked(false); setAnswers({}); }}
                    className="mt-2 text-xs text-amber-600 underline"
                  >
                    Попробовать снова
                  </button>
                )}
              </div>
            )}

            {QUIZ_QUESTIONS.map((q, idx) => {
              const isCorrect = checked ? checkAnswer(q, answers[q.id] ?? "") : null;
              return (
                <div
                  key={q.id}
                  className={`border rounded-lg p-4 ${
                    checked
                      ? isCorrect
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-red-300 bg-red-50"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex gap-2 items-start">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-slate-200 text-slate-600 text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-slate-800">{q.question}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5 italic">
                        Подсказка: {q.hint}
                      </div>
                      <textarea
                        disabled={checked}
                        rows={2}
                        className={`mt-2 w-full text-sm border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none ${
                          checked ? "bg-slate-50 text-slate-500" : "bg-white"
                        } ${checked && !isCorrect ? "border-red-300" : "border-slate-300"}`}
                        placeholder="Напишите ваш ответ..."
                        value={answers[q.id] ?? ""}
                        onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      />
                      {checked && (
                        <div className={`text-xs mt-1.5 ${isCorrect ? "text-emerald-700" : "text-red-700"}`}>
                          {isCorrect ? "✓ Верно" : "✗ Неверно"} — {q.explanation}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {!checked && (
              <button
                onClick={handleSubmit}
                disabled={Object.keys(answers).length < 5}
                className="w-full py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Проверить ответы
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
