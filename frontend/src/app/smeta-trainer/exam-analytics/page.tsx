"use client";

/**
 * Аналитика экзаменов — слабые места студента + профиль типовых ошибок.
 *
 * Считает:
 *   • На каких заданиях средний балл ниже всего (hardest tasks)
 *   • Какие AI-сценарии чаще всего срабатывают на стартовых шаблонах
 *     (зашитый профиль типовых ошибок)
 *   • Распределение оценок (отлично / хорошо / удовл. / неуд.)
 *   • Рекомендации: куда тратить время чтобы получить tier выше
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EXAM_TASKS } from "../lib/examTasks";
import { computeStats, type JournalStats } from "../lib/examJournal";
import { gradeExam } from "../lib/examGrader";

type ScenarioStat = {
  scenario: string;
  count: number;
  affectedTasks: Set<string>;
};

export default function ExamAnalyticsPage() {
  const [stats, setStats] = useState<JournalStats | null>(null);

  useEffect(() => {
    setStats(computeStats());
  }, []);

  // Профиль типовых ошибок — прогоняем стартовые шаблоны через грейдер,
  // собираем какие AI-сценарии срабатывают и в каких заданиях.
  const scenarioProfile = useMemo(() => {
    const map = new Map<string, ScenarioStat>();
    for (const t of EXAM_TASKS) {
      const r = gradeExam(t.starter, t.reference, t.object);
      for (const n of r.breakdown.ai.notices) {
        const slot = map.get(n.scenario) ?? {
          scenario: n.scenario,
          count: 0,
          affectedTasks: new Set<string>(),
        };
        slot.count += 1;
        slot.affectedTasks.add(t.id);
        map.set(n.scenario, slot);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, []);

  // Профиль ожидаемых баллов на стартовых шаблонах (где «легче залезть в неуд.»)
  const starterScores = useMemo(() => {
    return EXAM_TASKS.map((t) => {
      const r = gradeExam(t.starter, t.reference, t.object);
      return { task: t, starterScore: r.score, starterGrade: r.grade, notices: r.breakdown.ai.notices.length };
    }).sort((a, b) => a.starterScore - b.starterScore);
  }, []);

  // Распределение оценок по реальным сдачам студента
  const gradeDistribution = useMemo(() => {
    const dist = { отлично: 0, хорошо: 0, "удовл.": 0, "неуд.": 0 };
    if (!stats) return dist;
    for (const [, slot] of stats.perTask) {
      for (const a of slot.attempts) {
        dist[a.grade] = (dist[a.grade] ?? 0) + 1;
      }
    }
    return dist;
  }, [stats]);

  const hardestForStudent = useMemo(() => {
    if (!stats) return [];
    const data = EXAM_TASKS.map((t) => {
      const slot = stats.perTask.get(t.id);
      const attempts = slot?.attempts ?? [];
      const avg = attempts.length > 0 ? attempts.reduce((s, a) => s + a.score, 0) / attempts.length : null;
      return { task: t, avg, attempts: attempts.length, best: slot?.best.score ?? null };
    }).filter((d) => d.avg !== null);
    return data.sort((a, b) => (a.avg ?? 0) - (b.avg ?? 0)).slice(0, 5);
  }, [stats]);

  const totalGrades = Object.values(gradeDistribution).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <Link href="/smeta-trainer/exam" className="text-xs text-blue-600 hover:underline">
              ← К списку экзаменов
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">📊 Аналитика экзаменов</h1>
            <p className="text-sm text-slate-600 mt-1">
              Слабые места + профиль типовых ошибок + рекомендации.
            </p>
          </div>
          <Link
            href="/smeta-trainer/exam-journal"
            className="text-xs px-3 py-2 bg-white border border-slate-300 rounded hover:bg-slate-100"
          >
            📔 Журнал →
          </Link>
        </div>

        {/* Распределение оценок */}
        <section className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
          <h2 className="text-base font-semibold text-slate-800 mb-3">
            Распределение оценок по вашим сдачам ({totalGrades})
          </h2>
          {totalGrades === 0 ? (
            <div className="text-sm text-slate-500 italic">Пока нет сдач для анализа.</div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {(["отлично", "хорошо", "удовл.", "неуд."] as const).map((g) => {
                const v = gradeDistribution[g];
                const pct = (v / totalGrades) * 100;
                const colors = {
                  "отлично": "bg-emerald-500 text-emerald-800 bg-emerald-50",
                  "хорошо": "bg-blue-500 text-blue-800 bg-blue-50",
                  "удовл.": "bg-amber-500 text-amber-800 bg-amber-50",
                  "неуд.": "bg-red-500 text-red-800 bg-red-50",
                } as const;
                const [barCls, textCls, bgCls] = colors[g].split(" ");
                return (
                  <div key={g} className={`border border-slate-200 rounded p-2 ${bgCls}`}>
                    <div className={`text-xs uppercase font-bold ${textCls}`}>{g}</div>
                    <div className="text-2xl font-bold mt-1 font-mono">{v}</div>
                    <div className="bg-white rounded h-1.5 mt-1 overflow-hidden">
                      <div className={barCls} style={{ width: `${pct}%`, height: "100%" }} />
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">{pct.toFixed(0)}%</div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Hardest tasks для студента */}
        <section className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
          <h2 className="text-base font-semibold text-slate-800 mb-3">
            🎯 Где у вас среднее ниже всего (топ-5)
          </h2>
          {hardestForStudent.length === 0 ? (
            <div className="text-sm text-slate-500 italic">
              Нужны сдачи хотя бы по нескольким заданиям, чтобы выявить слабые места.
            </div>
          ) : (
            <ul className="space-y-2">
              {hardestForStudent.map((d) => (
                <li
                  key={d.task.id}
                  className="grid grid-cols-[24px_1fr_80px_80px_80px] gap-2 items-center text-xs"
                >
                  <div className="text-lg">{d.task.icon}</div>
                  <div>
                    <Link
                      href={`/smeta-trainer/exam/${d.task.id}`}
                      className="font-medium hover:underline"
                    >
                      {d.task.title}
                    </Link>
                    <div className="text-[10px] text-slate-500">
                      {d.task.category} · {d.task.difficulty}
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="font-bold text-amber-700">{(d.avg ?? 0).toFixed(0)}</div>
                    <div className="text-[10px] text-slate-500">средн.</div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="font-bold text-emerald-700">{d.best ?? "—"}</div>
                    <div className="text-[10px] text-slate-500">лучш.</div>
                  </div>
                  <div className="text-right font-mono text-slate-600">{d.attempts} попыт.</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Профиль типовых ошибок (из стартовых шаблонов) */}
        <section className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
          <h2 className="text-base font-semibold text-slate-800 mb-3">
            🔥 Топ AI-сценариев, срабатывающих на стартовых шаблонах
          </h2>
          <p className="text-[11px] text-slate-500 mb-3 italic">
            Это профиль типовых ошибок банка экзаменов: какие ловушки наиболее частые.
            Изучите эти сценарии — и сможете сдать всё на «отлично».
          </p>
          {scenarioProfile.length === 0 ? (
            <div className="text-sm text-slate-500 italic">Сценарии не сработали.</div>
          ) : (
            <ul className="space-y-1">
              {scenarioProfile.slice(0, 10).map((s, i) => {
                const pct = (s.count / EXAM_TASKS.length) * 100;
                return (
                  <li
                    key={s.scenario}
                    className="grid grid-cols-[32px_1fr_200px_60px] gap-2 items-center text-xs"
                  >
                    <div className="text-slate-400 font-mono">{i + 1}.</div>
                    <code className="font-mono text-slate-800">{s.scenario}</code>
                    <div className="bg-slate-100 rounded h-2 overflow-hidden relative">
                      <div
                        className="absolute inset-y-0 left-0 bg-red-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="text-right font-mono text-slate-600">
                      {s.count} / {EXAM_TASKS.length}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Стартовые баллы — где упасть проще всего */}
        <section className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
          <h2 className="text-base font-semibold text-slate-800 mb-3">
            📉 Стартовый балл (без правок шаблона)
          </h2>
          <p className="text-[11px] text-slate-500 mb-3 italic">
            Если просто нажать «Сдать» не редактируя — какой балл получите. Полезно понять,
            какие задания требуют больше внимания.
          </p>
          <table className="w-full text-xs">
            <thead className="text-slate-500 text-left">
              <tr className="border-b border-slate-200">
                <th className="py-1.5 px-2 w-8"></th>
                <th className="py-1.5 px-2">Задание</th>
                <th className="py-1.5 px-2 text-right w-20">Старт. балл</th>
                <th className="py-1.5 px-2 text-right w-24">Заметок AI</th>
              </tr>
            </thead>
            <tbody>
              {starterScores.map((d) => (
                <tr key={d.task.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-1 px-2 text-lg">{d.task.icon}</td>
                  <td className="py-1 px-2">
                    <Link href={`/smeta-trainer/exam/${d.task.id}`} className="hover:underline">
                      {d.task.title}
                    </Link>
                  </td>
                  <td className="py-1 px-2 text-right font-mono font-bold">
                    {d.starterScore}
                  </td>
                  <td className="py-1 px-2 text-right font-mono text-slate-600">
                    {d.notices}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="text-[11px] text-slate-500 italic text-center">
          Профили посчитаны локально по EXAM_TASKS. Данные распределения оценок и hardest-задач —
          из localStorage. Очистка журнала обнулит вашу часть.
        </div>
      </div>
    </div>
  );
}
