"use client";

/**
 * Пред-экзаменационный урок-разбор для каждого из 15 заданий.
 * Содержание: суть, формулы, нормативка РК, типовая ошибка, разобранный
 * пример на похожем объекте (не идентичный экзамену).
 * URL: /smeta-trainer/exam/[id]/lesson
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { useEffect } from "react";
import { findExamTask } from "../../../lib/examTasks";
import { findLesson, markLessonVisited } from "../../../lib/examLessons";

export default function ExamLessonPage({ params }: { params: { id: string } }) {
  const task = findExamTask(params.id);
  const lesson = findLesson(params.id);
  if (!task || !lesson) {
    notFound();
  }

  useEffect(() => {
    markLessonVisited(params.id);
  }, [params.id]);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4">
          <div className="flex items-baseline justify-between">
            <Link href="/smeta-trainer/exam" className="text-xs text-blue-600 hover:underline">
              ← К списку экзаменов
            </Link>
            <Link
              href={`/smeta-trainer/exam/${params.id}`}
              className="text-xs text-blue-600 hover:underline"
            >
              К заданию →
            </Link>
          </div>
          <div className="flex items-baseline gap-3 mt-1 flex-wrap">
            <span className="text-3xl">{task!.icon}</span>
            <h1 className="text-2xl font-bold text-slate-900">{task!.title}</h1>
            <span className="text-[10px] uppercase tracking-wider bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">
              📖 Урок-разбор
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Изучите теорию перед сдачей экзамена. Содержание: суть, формулы, нормативка, типовая
            ошибка, разобранный пример.
          </p>
        </div>

        {/* Введение */}
        <section className="bg-white border-l-4 border-blue-400 border-y border-r border-slate-200 rounded-lg p-4 mb-4">
          <div className="text-xs uppercase tracking-wider text-blue-700 font-bold mb-2">
            💡 Что считаем
          </div>
          <p className="text-sm text-slate-800 leading-relaxed">{lesson!.intro}</p>
        </section>

        {/* Формулы */}
        <section className="bg-white border-l-4 border-emerald-400 border-y border-r border-slate-200 rounded-lg p-4 mb-4">
          <div className="text-xs uppercase tracking-wider text-emerald-700 font-bold mb-3">
            📐 Формулы и правила
          </div>
          <div className="space-y-3">
            {lesson!.formulas.map((f, i) => (
              <div key={i} className="border-l-2 border-emerald-200 pl-3">
                <div className="text-sm font-semibold text-slate-800">{f.title}</div>
                <code className="block text-xs font-mono bg-emerald-50 px-2 py-1 rounded my-1 text-emerald-900">
                  {f.formula}
                </code>
                <div className="text-xs text-slate-600">{f.explain}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Нормативка */}
        <section className="bg-white border-l-4 border-purple-400 border-y border-r border-slate-200 rounded-lg p-4 mb-4">
          <div className="text-xs uppercase tracking-wider text-purple-700 font-bold mb-3">
            📜 Нормативная база
          </div>
          <ul className="space-y-2">
            {lesson!.norms.map((n, i) => (
              <li key={i} className="text-xs">
                <span className="font-mono font-semibold text-purple-800">{n.ref}</span>
                <span className="text-slate-600"> — {n.what}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Типовая ошибка */}
        <section className="bg-amber-50 border-l-4 border-amber-400 border-y border-r border-amber-200 rounded-lg p-4 mb-4">
          <div className="text-xs uppercase tracking-wider text-amber-700 font-bold mb-2">
            ⚠️ Типовая ошибка
          </div>
          <p className="text-sm text-amber-900 leading-relaxed">{lesson!.trap}</p>
          <p className="text-xs text-amber-800 italic mt-2">
            (В стартовом шаблоне экзамена эта ошибка уже «зашита» — найдите её и исправьте.)
          </p>
        </section>

        {/* Разобранный пример */}
        <section className="bg-white border-l-4 border-slate-500 border-y border-r border-slate-200 rounded-lg p-4 mb-4">
          <div className="text-xs uppercase tracking-wider text-slate-700 font-bold mb-3">
            🧮 Разобранный пример
          </div>
          <p className="text-sm text-slate-700 mb-3 italic">{lesson!.example.setup}</p>
          <table className="w-full text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="border border-slate-200 px-2 py-1 text-left">Шаг</th>
                <th className="border border-slate-200 px-2 py-1 text-left">Расчёт</th>
                <th className="border border-slate-200 px-2 py-1 text-right">Результат</th>
              </tr>
            </thead>
            <tbody>
              {lesson!.example.steps.map((s, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="border border-slate-200 px-2 py-1 text-slate-700">{s.step}</td>
                  <td className="border border-slate-200 px-2 py-1 font-mono text-slate-600">
                    {s.calc}
                  </td>
                  <td className="border border-slate-200 px-2 py-1 text-right font-mono font-semibold text-emerald-700">
                    {s.result}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-slate-600 italic mt-3">{lesson!.example.total}</p>
        </section>

        {/* CTA */}
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-lg p-5 text-center">
          <div className="text-sm text-emerald-900 mb-3">
            Теория изучена. Теперь применяйте на практике — найдите типовую ошибку в стартовом
            шаблоне и сдайте на «отлично».
          </div>
          <Link
            href={`/smeta-trainer/exam/${params.id}`}
            className="inline-block px-6 py-3 bg-emerald-600 text-white rounded text-sm font-bold hover:bg-emerald-700"
          >
            🎯 Готов сдавать экзамен →
          </Link>
        </div>
      </div>
    </div>
  );
}
