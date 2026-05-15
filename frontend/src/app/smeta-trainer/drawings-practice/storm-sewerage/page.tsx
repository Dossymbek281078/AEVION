"use client";
import Link from "next/link";
import { useState } from "react";

// ── Допуски ───────────────────────────────────────────────────────────────
function checkTol(input: string, expected: number, tol: number) {
  const v = parseFloat(input.replace(",", "."));
  if (isNaN(v)) return false;
  if (tol === 0) return Math.abs(v - expected) < 0.0001;
  return Math.abs((v - expected) / expected) <= tol;
}

// ── Таблица элементов ливневой системы ────────────────────────────────────
const ELEMENTS: { name: string; use: string; price: string }[] = [
  { name: "Дождеприёмник чугунный 600×900", use: "Двор, дороги", price: "25 000 тг + установка" },
  { name: "Лоток ливневый бетонный 200×200×500", use: "Тротуары, полосы", price: "1 850 тг/м.п." },
  { name: "Решётка чугунная для лотка", use: "Защита, эстетика", price: "4 500 тг/м.п." },
  { name: "Колодец дождевой Ø1000", use: "Точка сбора", price: "95 000 тг (комплект)" },
  { name: "Труба ПЭ Ø160 (для трасс)", use: "Отвод от водосборов", price: "1 850 тг/м" },
  { name: "Дождевой коллектор Ø500 ж/б", use: "Магистрали", price: "28 000 тг/м" },
];

// ── Упражнения ────────────────────────────────────────────────────────────
type Ex = {
  id: string;
  title: string;
  hint: string;
  answer: number;
  tol: number;
  unit: string;
  explanation: string[];
};

const EXERCISES: Ex[] = [
  {
    id: "ex1",
    title: "Ex 1. Расход дождя с двора 1500 м² (асфальт) в Алматы",
    hint: "Q = q · F · ψ. Ответ в л/с.",
    answer: 14.25,
    tol: 0.05,
    unit: "л/с",
    explanation: [
      "F = 1500 м² = 0.15 га.",
      "ψ = 0.95 (асфальт).",
      "q = 100 л/с/га (Алматы).",
      "Q = 100 · 0.15 · 0.95 = 14.25 л/с.",
      "Допуск ±5 %.",
    ],
  },
  {
    id: "ex2",
    title: "Ex 2. Стоимость ливневых лотков с решёткой по периметру здания 18×24 (только 2 подветренные стороны)",
    hint: "Лоток + решётка. Тенге.",
    answer: 266700,
    tol: 0.10,
    unit: "тг",
    explanation: [
      "Периметр здания: 2 · (18 + 24) = 84 м.",
      "Лоток только с 2 подветренных сторон: 84 / 2 = 42 м.",
      "Стоимость лотка: 42 · 1 850 = 77 700 тг.",
      "Стоимость решётки: 42 · 4 500 = 189 000 тг.",
      "ИТОГО: 77 700 + 189 000 = 266 700 тг.",
      "Допуск ±10 %.",
    ],
  },
  {
    id: "ex3",
    title: "Ex 3. Кол-во дождеприёмников для двора 60×40 м",
    hint: "Норма 1 шт на 200–400 м² (среднее 300). Шт.",
    answer: 8,
    tol: 0.25,
    unit: "шт",
    explanation: [
      "Площадь двора: 60 · 40 = 2 400 м².",
      "Среднее значение нормы: 1 дождеприёмник на 300 м².",
      "2 400 / 300 = 8 шт.",
      "Допуск ±25 % — норма гибкая, зависит от уклонов и типа покрытия.",
    ],
  },
  {
    id: "ex4",
    title: "Ex 4. Объём ливневого стока 28.5 л/с за 30 мин (расчётный пик)",
    hint: "Перевести литры в м³. Ответ в м³.",
    answer: 51.3,
    tol: 0.05,
    unit: "м³",
    explanation: [
      "30 мин = 1 800 с.",
      "Объём: 28.5 · 1 800 = 51 300 л = 51.3 м³.",
      "Коллектор Ø500 при уклоне 0.5 % пропускает ~250 л/с — резервуар-аккумулятор не нужен (расход в норме сети).",
      "Ответ — расчётный объём дождя за 30 мин.",
      "Допуск ±5 %.",
    ],
  },
];

// ── Страница ──────────────────────────────────────────────────────────────
export default function StormSewerage() {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [shown, setShown] = useState<Record<string, boolean>>({});

  const setAns = (id: string, v: string) => setAnswers((s) => ({ ...s, [id]: v }));
  const toggle = (id: string) => setShown((s) => ({ ...s, [id]: !s[id] }));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <Link
          href="/smeta-trainer/drawings-practice/hub"
          className="text-blue-400 hover:text-blue-300 text-sm"
        >
          ← К разделам
        </Link>

        <h1 className="text-3xl md:text-4xl font-bold mt-4 mb-2 text-blue-300">
          ☔ Ливневая канализация — расчёт и проектирование
        </h1>
        <p className="text-slate-400 mb-8">
          Отвод дождевой и талой воды. Учебный модуль AEVION Смета.
        </p>

        {/* Intro */}
        <section className="bg-slate-900 border border-blue-900/50 rounded-lg p-5 mb-6">
          <h2 className="text-xl font-semibold text-blue-300 mb-3">Что это</h2>
          <p className="text-slate-200 mb-3">
            <b>Ливневая канализация</b> — отдельная сеть отвода дождевой и талой воды.{" "}
            <span className="text-amber-300">НЕ ПУТАТЬ</span> с хозяйственно-бытовой канализацией.
          </p>
          <p className="text-slate-300 mb-2">Обязательна для:</p>
          <ul className="list-disc list-inside text-slate-300 space-y-1 mb-3">
            <li>Дворовых территорий и площадей</li>
            <li>Кровель плоских (через водосточные воронки)</li>
            <li>Дорог и тротуаров</li>
            <li>Промышленных площадок</li>
          </ul>
          <p className="text-slate-300">
            <b className="text-blue-300">Стоимость:</b> 0.8–2.5 млн тг для типового двора.
          </p>
        </section>

        {/* Norms */}
        <section className="bg-slate-900 border border-blue-900/50 rounded-lg p-5 mb-6">
          <h2 className="text-xl font-semibold text-blue-300 mb-3">Нормативы</h2>
          <ul className="list-disc list-inside text-slate-300 space-y-1">
            <li>СНиП РК 4.01-43-2007 — наружные сети канализации</li>
            <li>СП РК 4.01-43 — свод правил по проектированию</li>
            <li>ССЦ РК — дождеприёмники, лотки, трубы (актуальные индексы)</li>
          </ul>
        </section>

        {/* Section 1: расчёт */}
        <section className="bg-slate-900 border border-blue-900/50 rounded-lg p-5 mb-6">
          <h2 className="text-xl font-semibold text-blue-300 mb-3">
            1. Расчёт ливневой канализации (формулы)
          </h2>
          <pre className="bg-slate-950 border border-slate-800 rounded p-4 text-sm text-slate-200 overflow-x-auto whitespace-pre-wrap">
{`Расход дождевой воды:
Q = q · F · ψ · n_заст

где:
  q       — интенсивность дождя для региона
            Алматы 100 л/с/га
            Астана  80 л/с/га
            Атырау  60 л/с/га
  F       — площадь водосбора, га
  ψ       — коэффициент стока:
              асфальт  0.95
              газон    0.10
              грунт    0.20
  n_заст  — коэффициент застройки

Пример: двор 0.3 га (3 000 м²), асфальт ψ = 0.95
  Q = 100 · 0.3 · 0.95 = 28.5 л/с`}
          </pre>
        </section>

        {/* Section 2: элементы */}
        <section className="bg-slate-900 border border-blue-900/50 rounded-lg p-5 mb-6">
          <h2 className="text-xl font-semibold text-blue-300 mb-3">
            2. Элементы ливневой системы
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-blue-300 border-b border-blue-900/50">
                  <th className="py-2 pr-4">Элемент</th>
                  <th className="py-2 pr-4">Назначение</th>
                  <th className="py-2">Цена 2025</th>
                </tr>
              </thead>
              <tbody>
                {ELEMENTS.map((m) => (
                  <tr key={m.name} className="border-b border-slate-800/60">
                    <td className="py-2 pr-4 text-slate-200">{m.name}</td>
                    <td className="py-2 pr-4 text-slate-400">{m.use}</td>
                    <td className="py-2 text-slate-200 whitespace-nowrap">{m.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: упражнения */}
        <section className="bg-slate-900 border border-blue-900/50 rounded-lg p-5 mb-6">
          <h2 className="text-xl font-semibold text-blue-300 mb-4">
            3. Упражнения
          </h2>

          <div className="space-y-5">
            {EXERCISES.map((ex) => {
              const v = answers[ex.id] ?? "";
              const ok = v ? checkTol(v, ex.answer, ex.tol) : null;
              return (
                <div
                  key={ex.id}
                  className="bg-slate-950 border border-slate-800 rounded-lg p-4"
                >
                  <div className="font-semibold text-slate-100 mb-1">
                    {ex.title}
                  </div>
                  <div className="text-xs text-slate-400 mb-3">{ex.hint}</div>

                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <input
                      value={v}
                      onChange={(e) => setAns(ex.id, e.target.value)}
                      placeholder={`ваш ответ, ${ex.unit}`}
                      className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-slate-100 text-sm w-48 focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-slate-500 text-sm">{ex.unit}</span>
                    {v && (
                      <span
                        className={`text-sm font-semibold ${
                          ok ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {ok ? "✓ верно" : "✗ ещё попробуй"}
                      </span>
                    )}
                    <button
                      onClick={() => toggle(ex.id)}
                      className="ml-auto text-xs text-blue-400 hover:text-blue-300 underline"
                    >
                      {shown[ex.id] ? "скрыть решение" : "показать решение"}
                    </button>
                  </div>

                  {shown[ex.id] && (
                    <div className="bg-slate-900 border border-blue-900/40 rounded p-3 mt-3">
                      <ul className="list-disc list-inside text-slate-300 text-sm space-y-1">
                        {ex.explanation.map((line, i) => (
                          <li key={i}>{line}</li>
                        ))}
                      </ul>
                      <div className="text-xs text-slate-500 mt-2">
                        Эталон: <b className="text-slate-300">{ex.answer} {ex.unit}</b>{" "}
                        (допуск ±{Math.round(ex.tol * 100)} %)
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Расценки ЭСН */}
        <section className="bg-slate-900 border border-blue-900/50 rounded-lg p-5 mb-6">
          <h2 className="text-xl font-semibold text-blue-300 mb-3">
            Расценки ЭСН
          </h2>
          <ul className="list-disc list-inside text-slate-300 space-y-1">
            <li><b className="text-slate-100">Сб. 23-1</b> — трубы ливневые (укладка)</li>
            <li><b className="text-slate-100">Сб. 23-3</b> — колодцы дождевые (монтаж)</li>
            <li><b className="text-slate-100">Сб. 27</b> — лотки ливневые с решётками</li>
          </ul>
        </section>

        {/* Factoid */}
        <section className="bg-blue-950/40 border border-blue-700/60 rounded-lg p-5 mb-10">
          <div className="text-blue-300 font-semibold mb-2">
            💡 Факт-напоминание
          </div>
          <p className="text-slate-200">
            Ливневая канализация — <b>забытая статья сметы</b>. Часто проектируют
            только хоз-бытовую и забывают ливневую → подтопления при первом ливне.
            Закладывай <b className="text-blue-300">1–3 % от СМР</b> на ливнёвку
            даже если ТЗ молчит. Защитит от переделок и претензий.
          </p>
        </section>

        <div className="text-center text-slate-500 text-xs pb-8">
          AEVION Смета · модуль «Ливневая канализация»
        </div>
      </div>
    </div>
  );
}
