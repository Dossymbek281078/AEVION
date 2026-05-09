"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  PRACTICE_EXERCISES,
  loadPracticeProgress,
  savePracticeAttempt,
  type PracticeExercise,
} from "../lib/practiceExercises";
import { findLesson } from "../lib/lessons";

export default function PracticePage() {
  const [active, setActive] = useState<PracticeExercise | null>(null);
  const [progress, setProgress] = useState<ReturnType<typeof loadPracticeProgress>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setProgress(loadPracticeProgress());
    setHydrated(true);
  }, []);

  function refreshProgress() {
    setProgress(loadPracticeProgress());
  }

  const solved = Object.values(progress).filter((p) => p.correct).length;
  const total = PRACTICE_EXERCISES.length;
  const pct = Math.round((solved / total) * 100);

  if (!hydrated) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center gap-4">
          <Link href="/smeta-trainer" className="text-xs text-slate-500 hover:text-slate-900">
            ← К курсу
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-900">Практика — найди ошибку</h1>
            <p className="text-[11px] text-slate-500">
              {total} мини-задач — по одной на каждый AI-сценарий тренажёра
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-emerald-600">{solved}/{total}</div>
            <div className="text-[10px] text-slate-400">{pct}% решено</div>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-slate-200">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-4">
        {!active ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PRACTICE_EXERCISES.map((ex) => {
              const att = progress[ex.id];
              const status = att?.correct ? "solved" : att ? "tried" : "fresh";
              return (
                <button
                  key={ex.id}
                  onClick={() => setActive(ex)}
                  className={`text-left border-2 rounded-xl p-4 transition-colors ${
                    status === "solved"
                      ? "bg-emerald-50 border-emerald-300 hover:border-emerald-500"
                      : status === "tried"
                        ? "bg-amber-50 border-amber-300 hover:border-amber-500"
                        : "bg-white border-slate-200 hover:border-emerald-400"
                  }`}
                >
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      {ex.scenario}
                    </span>
                    {status === "solved" && (
                      <span className="text-[10px] bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded-full font-semibold">
                        ✓ решено
                      </span>
                    )}
                    {status === "tried" && (
                      <span className="text-[10px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full font-semibold">
                        попыток: {att.attempts}
                      </span>
                    )}
                  </div>
                  <h2 className="text-sm font-bold text-slate-900">{ex.title}</h2>
                  <p className="text-xs text-slate-600 mt-1 leading-snug">{ex.context}</p>
                </button>
              );
            })}

            {solved === total && (
              <div className="sm:col-span-2 bg-emerald-100 border-2 border-emerald-400 rounded-xl p-5 text-center">
                <div className="text-4xl mb-2">🎯</div>
                <div className="text-base font-bold text-emerald-900">Все 7 сценариев пройдены!</div>
                <div className="text-xs text-emerald-700 mt-1">
                  Вы научились распознавать все ключевые ошибки сметчика. Теперь смело
                  идите на Уровень 5 — там их 10 в одной смете.
                </div>
              </div>
            )}
          </div>
        ) : (
          <ExerciseView
            exercise={active}
            onClose={() => { setActive(null); refreshProgress(); }}
          />
        )}
      </div>
    </div>
  );
}

function ExerciseView({ exercise, onClose }: { exercise: PracticeExercise; onClose: () => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [wrongCount, setWrongCount] = useState(0);
  const [showHint, setShowHint] = useState(false);

  function check() {
    if (picked == null) return;
    const correct = picked === exercise.correct;
    setRevealed(true);
    if (!correct) setWrongCount((n) => n + 1);
    savePracticeAttempt({
      exerciseId: exercise.id,
      picked,
      correct,
      attempts: 1,
      ts: Date.now(),
    });
  }

  function retry() {
    setPicked(null);
    setRevealed(false);
  }

  const isCorrect = revealed && picked === exercise.correct;
  const lesson = exercise.lessonRef ? findLesson(exercise.lessonRef) : null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <button
        onClick={onClose}
        className="text-xs text-slate-400 hover:text-slate-700 mb-3"
      >
        ← К списку упражнений
      </button>

      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
        Сценарий: {exercise.scenario}
      </div>
      <h2 className="text-xl font-bold text-slate-900 mt-1">{exercise.title}</h2>
      <p className="text-sm text-slate-600 mt-2 leading-relaxed">{exercise.context}</p>

      <pre className="mt-3 bg-slate-900 text-emerald-100 text-xs p-3 rounded-lg overflow-x-auto leading-snug font-mono">
        {exercise.snapshot}
      </pre>

      <div className="mt-4">
        <div className="text-sm font-bold text-slate-900 mb-2">{exercise.question}</div>
        <div className="space-y-2">
          {exercise.options.map((opt, i) => {
            const isThisCorrect = revealed && i === exercise.correct;
            const isThisWrongPick = revealed && i === picked && i !== exercise.correct;
            return (
              <label
                key={i}
                className={`flex items-start gap-2 p-3 rounded-lg cursor-pointer text-sm leading-snug border-2 transition-colors ${
                  isThisCorrect
                    ? "border-emerald-400 bg-emerald-50"
                    : isThisWrongPick
                      ? "border-red-400 bg-red-50"
                      : picked === i
                        ? "border-emerald-400 bg-white"
                        : "border-slate-200 bg-white hover:border-slate-300"
                } ${revealed ? "cursor-default" : ""}`}
              >
                <input
                  type="radio"
                  name={exercise.id}
                  checked={picked === i}
                  onChange={() => !revealed && setPicked(i)}
                  disabled={revealed}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div>{opt.text}</div>
                  {isThisWrongPick && opt.explainIfPicked && (
                    <div className="text-xs text-red-700 mt-1 italic">
                      {opt.explainIfPicked}
                    </div>
                  )}
                </div>
                {isThisCorrect && <span className="text-emerald-600 text-lg">✓</span>}
                {isThisWrongPick && <span className="text-red-600 text-lg">✗</span>}
              </label>
            );
          })}
        </div>
      </div>

      {/* Подсказка */}
      {!revealed && wrongCount >= 2 && (
        <div className="mt-3">
          {!showHint ? (
            <button
              onClick={() => setShowHint(true)}
              className="text-xs text-amber-600 hover:text-amber-800 underline"
            >
              💡 Показать подсказку
            </button>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-800">
              💡 {exercise.hint}
            </div>
          )}
        </div>
      )}

      {/* Объяснение */}
      {revealed && (
        <div className={`mt-4 rounded-lg p-3 border-2 ${
          isCorrect ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"
        }`}>
          <div className={`text-sm font-bold ${isCorrect ? "text-emerald-800" : "text-red-800"}`}>
            {isCorrect ? "✓ Верно!" : "✗ Неверно"}
          </div>
          <div className="text-xs text-slate-700 mt-1 leading-relaxed">
            {exercise.explanation}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
            {exercise.normRef && (
              <span className="text-slate-500">📖 {exercise.normRef}</span>
            )}
            {lesson && (
              <Link
                href={`/smeta-trainer/level/${lesson.level}#lesson-${encodeURIComponent(lesson.id)}`}
                className="text-emerald-700 hover:text-emerald-900 underline"
              >
                📚 Подробнее: Ур.{lesson.level} · {lesson.title}
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Кнопки */}
      <div className="mt-4 flex gap-2">
        {!revealed ? (
          <button
            onClick={check}
            disabled={picked == null}
            className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-40"
          >
            Проверить
          </button>
        ) : (
          <>
            {!isCorrect && (
              <button
                onClick={retry}
                className="px-4 py-2 bg-amber-500 text-white text-sm font-semibold rounded-lg hover:bg-amber-600"
              >
                Попробовать ещё
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 text-white text-sm font-semibold rounded-lg hover:bg-slate-900 ml-auto"
            >
              К следующему упражнению →
            </button>
          </>
        )}
      </div>
    </div>
  );
}
