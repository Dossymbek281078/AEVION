"use client";

/**
 * Тест по ресурсному методу (Форма 4 по НДЦС РК 8.01-08-2022).
 * Опирается на эталонный слой /smeta-trainer/real-rates. Зачёт сохраняется локально.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  RESOURCE_QUIZ,
  RESOURCE_QUIZ_PASS_THRESHOLD,
} from "../lib/resourceMethodQuiz";

const PASS_KEY = "smeta-trainer:resource-quiz-pass-v1";

export default function ResourceQuizPage() {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [previouslyPassed, setPreviouslyPassed] = useState(false);

  useEffect(() => {
    setHydrated(true);
    if (typeof window !== "undefined") {
      try {
        setPreviouslyPassed(localStorage.getItem(PASS_KEY) === "true");
      } catch {}
    }
  }, []);

  const correctCount = RESOURCE_QUIZ.reduce(
    (s, q, i) => s + (answers[i] === q.correct ? 1 : 0),
    0,
  );
  const passed = submitted && correctCount >= RESOURCE_QUIZ_PASS_THRESHOLD;

  function handleSubmit() {
    setSubmitted(true);
    if (correctCount >= RESOURCE_QUIZ_PASS_THRESHOLD) {
      try {
        localStorage.setItem(PASS_KEY, "true");
        window.dispatchEvent(new CustomEvent("aevion-smeta-progress-update"));
      } catch {}
    }
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleReset() {
    setAnswers({});
    setSubmitted(false);
  }

  if (!hydrated) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/smeta-trainer/real-rates" className="text-xs text-slate-400 hover:text-white">
            ← К реальным расценкам
          </Link>
          <div className="flex-1">
            <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">
              Ресурсный метод · Форма 4 (НДЦС РК 8.01-08-2022)
            </div>
            <h1 className="text-lg font-bold mt-0.5">🧱 Тест: ресурсная смета vs плоская расценка</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {RESOURCE_QUIZ.length} вопросов · зачёт ≥ {RESOURCE_QUIZ_PASS_THRESHOLD} правильных
            </p>
          </div>
          {previouslyPassed && (
            <span className="text-[10px] bg-emerald-700 text-emerald-100 px-2 py-1 rounded font-semibold">
              ✓ ранее зачтён
            </span>
          )}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-4 space-y-4">
        {!submitted && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            <strong>Зачем это:</strong> в реальной смете РК каждая позиция раскрыта на ресурсы
            (труд, машины, материалы, перевозки) с кодами ЭСН/ССЦ. Этот тест проверяет, что вы
            понимаете ресурсный метод — основу проверяемого ценообразования. Откройте{" "}
            <Link href="/smeta-trainer/real-rates" className="underline">эталонную смету</Link>{" "}
            в соседней вкладке, если нужно подсмотреть структуру.
          </div>
        )}

        {submitted && (
          <div className={`rounded-xl p-5 border-2 text-center ${
            passed ? "bg-emerald-50 border-emerald-400" : "bg-red-50 border-red-300"
          }`}>
            <div className="text-3xl mb-2">{passed ? "🎉" : "📚"}</div>
            <div className="text-2xl font-bold">{correctCount}/{RESOURCE_QUIZ.length}</div>
            <div className={`mt-1 font-semibold ${passed ? "text-emerald-700" : "text-red-700"}`}>
              {passed
                ? "✓ Зачёт — вы владеете ресурсным методом"
                : `Не хватает ${RESOURCE_QUIZ_PASS_THRESHOLD - correctCount} ответов до зачёта`}
            </div>
            <div className="mt-3 flex gap-2 justify-center">
              {!passed && (
                <button
                  onClick={handleReset}
                  className="px-4 py-1.5 bg-amber-500 text-white text-xs font-semibold rounded hover:bg-amber-600"
                >
                  Повторить попытку
                </button>
              )}
              <Link
                href="/smeta-trainer/real-rates/build"
                className="px-4 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded hover:bg-emerald-700"
              >
                → Собрать смету из реальных позиций
              </Link>
            </div>
          </div>
        )}

        {RESOURCE_QUIZ.map((q, i) => {
          const userPick = answers[i];
          const isCorrect = submitted && userPick === q.correct;
          const isWrong = submitted && userPick != null && userPick !== q.correct;
          const noAnswer = submitted && userPick == null;
          return (
            <div
              key={i}
              className={`bg-white border-2 rounded-lg p-4 ${
                isCorrect ? "border-emerald-300" : isWrong || noAnswer ? "border-red-300" : "border-slate-200"
              }`}
            >
              <div className="flex items-start gap-2 mb-2">
                <span className="shrink-0 w-6 h-6 rounded-full bg-slate-700 text-white text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <div className="text-sm font-semibold text-slate-900 flex-1">{q.q}</div>
              </div>
              <div className="space-y-1">
                {q.options.map((opt, oi) => {
                  const selected = userPick === oi;
                  const isOptCorrect = submitted && oi === q.correct;
                  const isOptWrongPick = submitted && selected && oi !== q.correct;
                  return (
                    <label
                      key={oi}
                      className={`flex items-start gap-2 p-2 rounded cursor-pointer text-xs leading-snug border ${
                        isOptCorrect
                          ? "border-emerald-400 bg-emerald-50"
                          : isOptWrongPick
                            ? "border-red-400 bg-red-50"
                            : selected
                              ? "border-emerald-400 bg-white"
                              : "border-slate-200 bg-white hover:border-slate-300"
                      } ${submitted ? "cursor-default" : ""}`}
                    >
                      <input
                        type="radio"
                        name={`q-${i}`}
                        checked={selected}
                        onChange={() => !submitted && setAnswers((p) => ({ ...p, [i]: oi }))}
                        disabled={submitted}
                        className="mt-0.5"
                      />
                      <span className="flex-1">{opt}</span>
                      {isOptCorrect && <span className="text-emerald-600">✓</span>}
                      {isOptWrongPick && <span className="text-red-600">✗</span>}
                    </label>
                  );
                })}
              </div>
              {submitted && (
                <div className="text-[11px] mt-2 italic text-slate-700 bg-slate-50 border border-slate-100 rounded p-2 leading-relaxed">
                  💡 {q.explanation}
                </div>
              )}
            </div>
          );
        })}

        {!submitted && (
          <button
            onClick={handleSubmit}
            disabled={Object.keys(answers).length < RESOURCE_QUIZ.length}
            className="w-full py-3 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {Object.keys(answers).length < RESOURCE_QUIZ.length
              ? `Ответьте на все вопросы (${Object.keys(answers).length}/${RESOURCE_QUIZ.length})`
              : "Сдать тест"}
          </button>
        )}
      </div>
    </div>
  );
}
