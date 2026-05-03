"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LEVELS } from "../lib/levels";
import type { CourseProgress } from "../lib/useProgress";

const STORAGE_KEY = "aevion-smeta-progress-v1";

function loadProgress(): CourseProgress {
  if (typeof window === "undefined") return { levels: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { levels: {} };
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return "—";
  }
}

function formatDateShort(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

export default function CertificatePage() {
  const [progress, setProgress] = useState<CourseProgress>({ levels: {} });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setProgress(loadProgress());
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const done = Object.values(progress.levels).filter((l) => l.status === "done").length;
  const total = LEVELS.length;
  const allDone = done === total;
  const name = progress.studentName || "Студент";
  const group = progress.studentGroup;

  // Дата завершения = дата последнего зачёта
  const completionDates = LEVELS
    .map((l) => progress.levels[l.num]?.completedAt)
    .filter(Boolean) as string[];
  const lastCompletedDate = completionDates.length > 0
    ? completionDates.sort().at(-1)
    : undefined;

  // Средний балл по уровням с оценкой
  const scores = LEVELS
    .map((l) => progress.levels[l.num]?.score)
    .filter((s): s is number => s !== undefined);
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : null;

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-8 print:bg-white print:p-0">
      {/* Кнопки действий — скрыты при печати */}
      <div className="print:hidden max-w-3xl mx-auto mb-4 flex items-center gap-3">
        <Link href="/smeta-trainer" className="text-sm text-slate-500 hover:text-slate-700">
          ← Назад к курсу
        </Link>
        <div className="flex-1" />
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700"
        >
          🖨 Распечатать
        </button>
        <button
          onClick={() => {
            const data = JSON.stringify(progress, null, 2);
            const blob = new Blob([data], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `smeta-progress-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="px-4 py-2 bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-300"
        >
          ⬇ Скачать JSON
        </button>
      </div>

      {/* Сертификат */}
      <div className="max-w-3xl mx-auto bg-white shadow-xl rounded-2xl overflow-hidden print:shadow-none print:rounded-none">
        {/* Верхняя полоса */}
        <div className={`h-3 ${allDone ? "bg-gradient-to-r from-emerald-500 to-teal-500" : "bg-gradient-to-r from-slate-400 to-slate-500"}`} />

        <div className="px-8 sm:px-12 py-8 sm:py-10">
          {/* Шапка */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <div className="text-xs font-bold text-emerald-600 tracking-widest uppercase">AEVION Education</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Учебная платформа · Сметное дело РК</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-400">НДЦС РК 8.01-08-2022</div>
              {lastCompletedDate && (
                <div className="text-[10px] text-slate-500 mt-0.5">{formatDateShort(lastCompletedDate)}</div>
              )}
            </div>
          </div>

          {/* Заголовок */}
          <div className="text-center mb-8">
            <div className="text-4xl mb-3">{allDone ? "🏆" : "📊"}</div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
              {allDone ? "Сертификат об окончании курса" : "Отчёт о прохождении курса"}
            </h1>
            <p className="text-slate-500 text-sm">
              {allDone
                ? "Подтверждает успешное освоение учебной программы"
                : `Пройдено ${done} из ${total} уровней`}
            </p>
          </div>

          {/* Имя студента */}
          <div className="text-center mb-8 pb-8 border-b border-slate-200">
            <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-2">Выдан студенту</div>
            <div className="text-2xl sm:text-3xl font-bold text-slate-900">{name}</div>
            {group && <div className="text-sm text-slate-500 mt-1">{group}</div>}
            {allDone && lastCompletedDate && (
              <div className="text-sm text-slate-500 mt-2">
                Курс завершён {formatDate(lastCompletedDate)}
              </div>
            )}
          </div>

          {/* Курс */}
          <div className="mb-8 bg-emerald-50 rounded-xl p-4">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Учебная программа</div>
            <div className="font-bold text-slate-900 text-base">Сметное дело в РК</div>
            <div className="text-xs text-slate-600 mt-1">
              Сквозной кейс: Капитальный ремонт школы №47, г. Алматы · {total} уровней
            </div>
            {avgScore !== null && (
              <div className="mt-2 inline-flex items-center gap-2">
                <span className="text-xs text-slate-500">Средний балл:</span>
                <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${avgScore >= 80 ? "bg-emerald-100 text-emerald-700" : avgScore >= 60 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                  {avgScore}/100
                </span>
              </div>
            )}
          </div>

          {/* Таблица уровней */}
          <div className="mb-8">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">Результаты по уровням</div>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-600 w-8">№</th>
                  <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-600">Уровень</th>
                  <th className="border border-slate-200 px-3 py-2 text-center font-semibold text-slate-600 w-16">Балл</th>
                  <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-600 w-32">Статус</th>
                  <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-600 w-28">Дата</th>
                </tr>
              </thead>
              <tbody>
                {LEVELS.map((level) => {
                  const lp = progress.levels[level.num];
                  const isDone = lp?.status === "done";
                  const isInProgress = lp?.status === "in-progress";
                  return (
                    <tr key={level.num} className={isDone ? "bg-emerald-50" : ""}>
                      <td className="border border-slate-200 px-3 py-2 text-center text-slate-500">{level.num}</td>
                      <td className="border border-slate-200 px-3 py-2">
                        <div className="font-semibold text-slate-800">{level.icon} {level.title}</div>
                        <div className="text-[10px] text-slate-400">{level.role} · ~{level.timeHours} ч</div>
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-center font-mono">
                        {lp?.score !== undefined ? (
                          <span className={`font-bold ${lp.score >= 80 ? "text-emerald-600" : lp.score >= 60 ? "text-amber-600" : "text-red-500"}`}>
                            {lp.score}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="border border-slate-200 px-3 py-2">
                        {isDone && <span className="text-emerald-600 font-semibold">✓ Зачтён</span>}
                        {isInProgress && <span className="text-amber-600">В процессе</span>}
                        {!isDone && !isInProgress && <span className="text-slate-400">Не начат</span>}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-slate-500">
                        {formatDateShort(lp?.completedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Нижняя часть */}
          <div className="flex items-end justify-between pt-4 border-t border-slate-200">
            <div>
              <div className="text-[10px] text-slate-400 mb-1">Курс проведён на платформе</div>
              <div className="font-bold text-slate-700 text-sm">AEVION · smeta-trainer</div>
              {progress.startedAt && (
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Начало обучения: {formatDateShort(progress.startedAt)}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className={`text-4xl ${allDone ? "text-emerald-500" : "text-slate-300"}`}>
                {allDone ? "🎓" : "📚"}
              </div>
              {!allDone && (
                <div className="text-[10px] text-slate-400 mt-1">
                  Завершите все уровни для<br />получения сертификата
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Нижняя полоса */}
        <div className={`h-1 ${allDone ? "bg-gradient-to-r from-emerald-500 to-teal-500" : "bg-slate-200"}`} />
      </div>

      {/* Призыв к действию — скрыт при печати */}
      {!allDone && (
        <div className="print:hidden max-w-3xl mx-auto mt-6 text-center">
          <Link
            href="/smeta-trainer"
            className="inline-block px-6 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 text-sm"
          >
            Продолжить обучение →
          </Link>
          <p className="text-xs text-slate-400 mt-2">
            Осталось {total - done} уровней до сертификата
          </p>
        </div>
      )}
    </div>
  );
}
