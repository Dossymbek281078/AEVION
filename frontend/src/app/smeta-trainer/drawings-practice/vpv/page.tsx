"use client";

import { useState } from "react";
import Link from "next/link";

type ExerciseKey = "ex1" | "ex2" | "ex3" | "ex4";

interface ExerciseConfig {
  key: ExerciseKey;
  title: string;
  question: string;
  expected: number;
  unit: string;
  tolerance: number; // fraction, e.g. 0.10
  solution: string[];
}

const exercises: ExerciseConfig[] = [
  {
    key: "ex1",
    title: "Упражнение 1. Количество пожарных кранов",
    question:
      "9-этажный жилой дом, 1 секция, периметр 100 м. Сколько пожарных кранов необходимо установить?",
    expected: 27,
    unit: "шт",
    tolerance: 0.1,
    solution: [
      "Норма: краны через 35–40 м по периметру.",
      "На этаж: 100 / 40 = 2.5 → округляем вверх → 3 крана.",
      "Этажей 9, на каждом — 3 крана.",
      "ИТОГО: 3 × 9 = 27 пожарных кранов.",
    ],
  },
  {
    key: "ex2",
    title: "Упражнение 2. Длина пожарных стояков",
    question:
      "Тот же дом (9 эт, высота этажа 3 м). 2 вертикальных пожарных стояка по концам периметра. Какова суммарная длина стояков (м.п.)?",
    expected: 54,
    unit: "м.п.",
    tolerance: 0.05,
    solution: [
      "Высота на 9 этажей: 3 м × 9 = 27 м.",
      "Стояков 2 (по концам периметра).",
      "ИТОГО: 2 × 27 = 54 м.п.",
    ],
  },
  {
    key: "ex3",
    title: "Упражнение 3. Расход воды на пожаротушение",
    question:
      "Жилое здание: 1 струя × 2.5 л/с. Расчётное время тушения — 1 час. Сколько м³ воды требуется на пожар?",
    expected: 9,
    unit: "м³",
    tolerance: 0.05,
    solution: [
      "Норма для жилого: 1 кран × 2.5 л/с.",
      "За 1 час: 2.5 · 3600 = 9 000 л.",
      "9 000 л = 9 м³.",
      "Расчётное время тушения: 1 час по СНиП.",
    ],
  },
  {
    key: "ex4",
    title: "Упражнение 4. Стоимость ВПВ",
    question:
      "Стоимость комплекта ВПВ для жилого 9-эт (27 кранов, 54 м.п. стояков, 4 соединительные головки, 1 электрозадвижка, монтаж). Сколько тенге? Ответ в млн тг (с десятичными).",
    expected: 1.9,
    unit: "млн тг",
    tolerance: 0.1,
    solution: [
      "27 кранов × 25 000 тг (комплект со шкафом) = 675 000 тг.",
      "54 м.п. стояков × 1 850 тг = 99 900 ≈ 100 000 тг.",
      "Соединительные головки: 4 × 18 500 = 74 000 тг.",
      "Электрозадвижка: 1 × 185 000 = 185 000 тг.",
      "Подключение, монтаж, пусконаладка: 850 000 тг.",
      "ИТОГО: ≈ 1.9–2.0 млн тг.",
    ],
  },
];

interface NormRow {
  type: string;
  flow: string;
  jets: string;
  height: string;
}

const norms: NormRow[] = [
  { type: "Жилые до 12 эт", flow: "2.5", jets: "1", height: "до 22 м — НЕ обязателен ВПВ" },
  { type: "Жилые 12–16 эт", flow: "2.5", jets: "1", height: "22+" },
  { type: "Жилые 16–25 эт", flow: "2.5", jets: "2", height: "30+" },
  { type: "Жилые >25 эт", flow: "2.5", jets: "3–4", height: "50+" },
  { type: "Школы", flow: "2.5", jets: "1", height: "по проекту" },
  { type: "Больницы", flow: "2.5", jets: "2", height: "по проекту" },
  { type: "ТРЦ (S > 500 м²)", flow: "5.0", jets: "2–3", height: "по проекту" },
  { type: "Склады горючих", flow: "5.0", jets: "3–4", height: "по проекту" },
  { type: "Гостиницы", flow: "2.5", jets: "2", height: "по этажам" },
];

const composition: string[] = [
  "Пожарные стояки Ø50 (на каждом этаже)",
  "Пожарные краны Ду50 в шкафах (через 35–40 м по периметру)",
  "Соединительные головки (рукавная, для МЧС)",
  "Резервный насос пожаротушения (если давления городской сети недостаточно)",
  "Электрозадвижки с автоматическим открытием",
  "Спринклеры (для торговых, складских зданий)",
];

const normsList: { code: string; title: string }[] = [
  { code: "СП РК 5.01-101-2002", title: "«Расход воды»" },
  { code: "СП РК 4.04-21", title: "«Противопожарный водопровод»" },
  { code: "СН РК 4.04-22", title: "Внутренние сети противопожарного водоснабжения" },
];

interface AnswerState {
  value: string;
  status: "idle" | "correct" | "wrong";
}

const initialAnswers: Record<ExerciseKey, AnswerState> = {
  ex1: { value: "", status: "idle" },
  ex2: { value: "", status: "idle" },
  ex3: { value: "", status: "idle" },
  ex4: { value: "", status: "idle" },
};

export default function VpvPage() {
  const [answers, setAnswers] =
    useState<Record<ExerciseKey, AnswerState>>(initialAnswers);
  const [shown, setShown] = useState<Record<ExerciseKey, boolean>>({
    ex1: false,
    ex2: false,
    ex3: false,
    ex4: false,
  });

  const check = (ex: ExerciseConfig) => {
    const raw = answers[ex.key].value.replace(",", ".").trim();
    const num = Number.parseFloat(raw);
    if (Number.isNaN(num)) {
      setAnswers((prev) => ({
        ...prev,
        [ex.key]: { value: prev[ex.key].value, status: "wrong" },
      }));
      return;
    }
    const diff = Math.abs(num - ex.expected) / ex.expected;
    const ok = diff <= ex.tolerance;
    setAnswers((prev) => ({
      ...prev,
      [ex.key]: { value: prev[ex.key].value, status: ok ? "correct" : "wrong" },
    }));
  };

  const setValue = (key: ExerciseKey, value: string) =>
    setAnswers((prev) => ({ ...prev, [key]: { value, status: "idle" } }));

  const toggleShown = (key: ExerciseKey) =>
    setShown((prev) => ({ ...prev, [key]: !prev[key] }));

  const solved = Object.values(answers).filter((a) => a.status === "correct").length;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-orange-400 transition hover:text-orange-300"
          >
            ← К разделам
          </Link>
          <div className="rounded-full border border-orange-500/40 bg-orange-500/10 px-3 py-1 text-sm text-orange-300">
            Решено: {solved} / {exercises.length}
          </div>
        </div>

        <h1 className="mb-2 text-3xl font-bold text-orange-300 sm:text-4xl">
          🚰 ВПВ — внутренний противопожарный водопровод
        </h1>
        <p className="mb-8 text-zinc-300">
          ВПВ — внутренний противопожарный водопровод. Обязателен для зданий выше 22 м или
          общественных с большим скоплением людей. Стоимость для жилого 9-эт: <b className="text-orange-300">2.5–4 млн тг</b>.
        </p>

        {/* Norms */}
        <section className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="mb-3 text-lg font-semibold text-orange-300">Нормативная база</h2>
          <ul className="space-y-2 text-sm text-zinc-300">
            {normsList.map((n) => (
              <li key={n.code} className="flex flex-wrap gap-2">
                <span className="rounded bg-red-900/40 px-2 py-0.5 font-mono text-xs text-red-300">
                  {n.code}
                </span>
                <span>{n.title}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Section 1 — Composition */}
        <section className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="mb-4 text-xl font-semibold text-orange-300">
            1. Состав ВПВ
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {composition.map((c, i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-200"
              >
                <span className="mt-0.5 text-orange-400">▸</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Section 2 — Norms table */}
        <section className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="mb-4 text-xl font-semibold text-orange-300">
            2. Нормы расчёта
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-700 text-orange-300">
                  <th className="py-2 pr-3">Тип здания</th>
                  <th className="py-2 pr-3">Расход на 1 струю, л/с</th>
                  <th className="py-2 pr-3">Кол-во струй</th>
                  <th className="py-2">Высота, м</th>
                </tr>
              </thead>
              <tbody>
                {norms.map((n) => (
                  <tr
                    key={n.type}
                    className="border-b border-zinc-800/70 text-zinc-200"
                  >
                    <td className="py-2 pr-3">{n.type}</td>
                    <td className="py-2 pr-3 font-mono text-orange-200">{n.flow}</td>
                    <td className="py-2 pr-3 font-mono text-orange-200">{n.jets}</td>
                    <td className="py-2 text-zinc-400">{n.height}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3 — Exercises */}
        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-orange-300">
            3. Практика: 4 упражнения
          </h2>
          <div className="space-y-4">
            {exercises.map((ex) => {
              const state = answers[ex.key];
              const isShown = shown[ex.key];
              return (
                <div
                  key={ex.key}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5"
                >
                  <h3 className="mb-2 text-base font-semibold text-orange-200">
                    {ex.title}
                  </h3>
                  <p className="mb-3 text-sm text-zinc-300">{ex.question}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={state.value}
                      onChange={(e) => setValue(ex.key, e.target.value)}
                      placeholder="Ваш ответ"
                      className="w-40 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none transition focus:border-orange-500"
                    />
                    <span className="text-sm text-zinc-400">{ex.unit}</span>
                    <button
                      type="button"
                      onClick={() => check(ex)}
                      className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-orange-400"
                    >
                      Проверить
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleShown(ex.key)}
                      className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-orange-500 hover:text-orange-300"
                    >
                      {isShown ? "Скрыть решение" : "Показать решение"}
                    </button>
                    {state.status === "correct" && (
                      <span className="rounded-lg bg-emerald-500/15 px-3 py-1 text-sm text-emerald-300">
                        ✓ Верно (допуск ±{(ex.tolerance * 100).toFixed(0)}%)
                      </span>
                    )}
                    {state.status === "wrong" && (
                      <span className="rounded-lg bg-red-500/15 px-3 py-1 text-sm text-red-300">
                        ✗ Неверно. Попробуйте ещё или посмотрите решение.
                      </span>
                    )}
                  </div>
                  {isShown && (
                    <div className="mt-4 rounded-lg border border-orange-500/30 bg-orange-500/5 p-3 text-sm text-zinc-200">
                      <div className="mb-2 font-semibold text-orange-300">
                        Решение:
                      </div>
                      <ol className="list-decimal space-y-1 pl-5">
                        {ex.solution.map((line, i) => (
                          <li key={i}>{line}</li>
                        ))}
                      </ol>
                      <div className="mt-2 text-orange-200">
                        Ответ: <b>{ex.expected}</b> {ex.unit}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Расценки */}
        <section className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="mb-3 text-lg font-semibold text-orange-300">
            Расценки ЭСН
          </h2>
          <ul className="space-y-2 text-sm text-zinc-300">
            <li className="flex gap-2">
              <span className="rounded bg-orange-900/40 px-2 py-0.5 font-mono text-xs text-orange-300">
                Сб.16-04
              </span>
              <span>«Установка кранов пожарных»</span>
            </li>
            <li className="flex gap-2">
              <span className="rounded bg-orange-900/40 px-2 py-0.5 font-mono text-xs text-orange-300">
                Сб.16-05
              </span>
              <span>«Пожарные шкафы»</span>
            </li>
          </ul>
        </section>

        {/* Factoid */}
        <section className="mb-12 rounded-xl border border-red-500/40 bg-red-500/10 p-5">
          <div className="mb-2 flex items-center gap-2 text-red-300">
            <span className="text-xl">⚠️</span>
            <h2 className="text-lg font-semibold">Важно</h2>
          </div>
          <p className="text-sm text-red-100/90">
            Без ВПВ в зданиях с обязательными требованиями (22 м+) объект{" "}
            <b className="text-red-300">НЕ ВВОДИТСЯ в эксплуатацию</b>. Согласование
            с КГГП ЧС обязательно.
          </p>
        </section>
      </div>
    </div>
  );
}
