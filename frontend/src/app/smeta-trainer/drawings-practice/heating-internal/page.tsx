"use client";

import { useState } from "react";
import Link from "next/link";

type ExerciseKey = "ex1" | "ex2" | "ex3" | "ex4";

interface ExerciseAnswer {
  value: string;
  checked: boolean;
  correct: boolean;
  message: string;
}

const EXERCISES: Record<
  ExerciseKey,
  { target: number; tolerance: number; unit: string; solution: string }
> = {
  ex1: {
    target: 24,
    tolerance: 0.1,
    unit: "м",
    solution:
      "6 радиаторов × 4 м (среднее с подводками подача+обратка) = 24 м. Допуск ±10%.",
  },
  ex2: {
    target: 129500,
    tolerance: 0.1,
    unit: "тг",
    solution:
      "Норма: 1 секция на 1.5 м² → 80 / 1.5 = 53 секции. 53 / 8 секций (Rifar 8) ≈ 7 радиаторов × 18 500 = 129 500 тг. Допуск ±10%.",
  },
  ex3: {
    target: 120000,
    tolerance: 0.15,
    unit: "тг",
    solution:
      "Только в зонах без мебели: 25·0.7 + 6·1.0 = 17.5 + 6 = 23.5 м². Стоимость работы 850 тг/м²: 23.5·850 = 19 975 тг + материал ~35 000 тг = 55 000 тг + коллектор 65 000 тг = 120 000 тг. Допуск ±15%.",
  },
  ex4: {
    target: 6,
    tolerance: 0.2,
    unit: "дн.",
    solution:
      "Бригада 2 чел: 5–7 рабочих дней. Принять 6 (среднее), допуск ±20%.",
  },
};

export default function HeatingInternalPage() {
  const [answers, setAnswers] = useState<Record<ExerciseKey, ExerciseAnswer>>({
    ex1: { value: "", checked: false, correct: false, message: "" },
    ex2: { value: "", checked: false, correct: false, message: "" },
    ex3: { value: "", checked: false, correct: false, message: "" },
    ex4: { value: "", checked: false, correct: false, message: "" },
  });

  const [revealed, setRevealed] = useState<Record<ExerciseKey, boolean>>({
    ex1: false,
    ex2: false,
    ex3: false,
    ex4: false,
  });

  const updateValue = (key: ExerciseKey, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [key]: { ...prev[key], value, checked: false, message: "" },
    }));
  };

  const checkAnswer = (key: ExerciseKey) => {
    const cfg = EXERCISES[key];
    const raw = answers[key].value.replace(/\s+/g, "").replace(",", ".");
    const num = parseFloat(raw);
    if (isNaN(num)) {
      setAnswers((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          checked: true,
          correct: false,
          message: "Введите число",
        },
      }));
      return;
    }
    const diff = Math.abs(num - cfg.target) / cfg.target;
    const ok = diff <= cfg.tolerance;
    setAnswers((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        checked: true,
        correct: ok,
        message: ok
          ? `Верно! Эталон: ${cfg.target.toLocaleString("ru-RU")} ${cfg.unit} (отклонение ${(diff * 100).toFixed(1)}%)`
          : `Не подходит. Отклонение ${(diff * 100).toFixed(1)}%, допуск ±${cfg.tolerance * 100}%`,
      },
    }));
  };

  const toggleSolution = (key: ExerciseKey) => {
    setRevealed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-orange-950 text-zinc-100">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="inline-flex items-center gap-2 text-sm text-orange-400 transition hover:text-orange-300"
          >
            ← К разделам
          </Link>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-orange-200 sm:text-4xl">
            🔥 Внутреннее отопление — радиаторы, тёплый пол, разводка
          </h1>
        </header>

        {/* Intro */}
        <section className="mb-8 rounded-2xl border border-orange-900/40 bg-zinc-900/60 p-6 shadow-lg">
          <h2 className="mb-3 text-xl font-semibold text-orange-300">
            Введение
          </h2>
          <p className="leading-relaxed text-zinc-300">
            Внутреннее отопление включает разводку труб, радиаторы, тёплый пол,
            узлы учёта. Не путать с наружными теплосетями (см.{" "}
            <Link
              href="/smeta-trainer/drawings-practice/heating"
              className="text-orange-400 underline-offset-2 hover:underline"
            >
              /heating
            </Link>
            ). Стоимость для типовой квартиры 70–100 м²:{" "}
            <span className="font-semibold text-orange-200">
              350 000 – 650 000 тг
            </span>{" "}
            (только внутренняя система).
          </p>
        </section>

        {/* Norms */}
        <section className="mb-8 rounded-2xl border border-red-900/40 bg-zinc-900/60 p-6 shadow-lg">
          <h2 className="mb-3 text-xl font-semibold text-red-300">
            Нормативная база
          </h2>
          <ul className="space-y-2 text-zinc-300">
            <li className="flex gap-2">
              <span className="text-red-400">▸</span>
              <span>
                <span className="font-semibold text-red-200">ЭСН РК Сб.18</span>{" "}
                «Отопление внутреннее»
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-red-400">▸</span>
              <span>
                <span className="font-semibold text-red-200">
                  СНиП РК 4.02-05-2001
                </span>{" "}
                «Отопление, вентиляция и кондиционирование» (внутр. часть)
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-red-400">▸</span>
              <span>
                <span className="font-semibold text-red-200">
                  СП РК 4.02-101-2012
                </span>
              </span>
            </li>
          </ul>
        </section>

        {/* Section 1 — Equipment */}
        <section className="mb-8 rounded-2xl border border-orange-900/40 bg-zinc-900/60 p-6 shadow-lg">
          <h2 className="mb-4 text-xl font-semibold text-orange-300">
            1. Типы систем и оборудования
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-orange-800/50 bg-orange-950/40 text-orange-200">
                  <th className="px-3 py-2 font-semibold">Тип</th>
                  <th className="px-3 py-2 font-semibold">Применение</th>
                  <th className="px-3 py-2 font-semibold">Цена 2025, тг</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 text-zinc-300">
                <tr className="hover:bg-orange-950/20">
                  <td className="px-3 py-2">
                    Радиатор биметаллический Rifar 8 секций
                  </td>
                  <td className="px-3 py-2">Стандарт для квартир</td>
                  <td className="px-3 py-2 font-mono text-orange-200">18 500</td>
                </tr>
                <tr className="hover:bg-orange-950/20">
                  <td className="px-3 py-2">
                    Радиатор алюминиевый AL Plus 10 секций
                  </td>
                  <td className="px-3 py-2">Бюджет</td>
                  <td className="px-3 py-2 font-mono text-orange-200">12 800</td>
                </tr>
                <tr className="hover:bg-orange-950/20">
                  <td className="px-3 py-2">
                    Радиатор стальной панельный Kermi K22 600×1200
                  </td>
                  <td className="px-3 py-2">Премиум</td>
                  <td className="px-3 py-2 font-mono text-orange-200">65 000</td>
                </tr>
                <tr className="hover:bg-orange-950/20">
                  <td className="px-3 py-2">Конвектор внутрипольный</td>
                  <td className="px-3 py-2">Витражи, панорамные окна</td>
                  <td className="px-3 py-2 font-mono text-orange-200">
                    145 000 за блок
                  </td>
                </tr>
                <tr className="hover:bg-orange-950/20">
                  <td className="px-3 py-2">
                    Тёплый пол водяной (петля 8×8 м)
                  </td>
                  <td className="px-3 py-2">Жилые комнаты, ванные</td>
                  <td className="px-3 py-2 font-mono text-orange-200">
                    850 тг/м² + коллектор 65 000
                  </td>
                </tr>
                <tr className="hover:bg-orange-950/20">
                  <td className="px-3 py-2">
                    Тёплый пол электрический мат Devi
                  </td>
                  <td className="px-3 py-2">Малые помещения, балконы</td>
                  <td className="px-3 py-2 font-mono text-orange-200">
                    18 000 тг/м²
                  </td>
                </tr>
                <tr className="hover:bg-orange-950/20">
                  <td className="px-3 py-2">
                    Узел регулирования с насосом для квартиры
                  </td>
                  <td className="px-3 py-2">На входе в квартиру</td>
                  <td className="px-3 py-2 font-mono text-orange-200">
                    285 000
                  </td>
                </tr>
                <tr className="hover:bg-orange-950/20">
                  <td className="px-3 py-2">Расширительный бак 50 л</td>
                  <td className="px-3 py-2">Системы открытого типа</td>
                  <td className="px-3 py-2 font-mono text-orange-200">25 000</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 2 — Pipes */}
        <section className="mb-8 rounded-2xl border border-red-900/40 bg-zinc-900/60 p-6 shadow-lg">
          <h2 className="mb-4 text-xl font-semibold text-red-300">
            2. Трубы для внутреннего отопления
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-red-800/50 bg-red-950/40 text-red-200">
                  <th className="px-3 py-2 font-semibold">Тип</th>
                  <th className="px-3 py-2 font-semibold">Применение</th>
                  <th className="px-3 py-2 font-semibold">Цена 2025</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 text-zinc-300">
                <tr className="hover:bg-red-950/20">
                  <td className="px-3 py-2">Металлопластик Ø16 (TECE)</td>
                  <td className="px-3 py-2">Подводки к радиаторам</td>
                  <td className="px-3 py-2 font-mono text-red-200">380 тг/м</td>
                </tr>
                <tr className="hover:bg-red-950/20">
                  <td className="px-3 py-2">Металлопластик Ø20</td>
                  <td className="px-3 py-2">Стояки до 5 эт.</td>
                  <td className="px-3 py-2 font-mono text-red-200">580 тг/м</td>
                </tr>
                <tr className="hover:bg-red-950/20">
                  <td className="px-3 py-2">Полипропилен Ø25 PPR</td>
                  <td className="px-3 py-2">Магистральные внутренние</td>
                  <td className="px-3 py-2 font-mono text-red-200">650 тг/м</td>
                </tr>
                <tr className="hover:bg-red-950/20">
                  <td className="px-3 py-2">Сшитый полиэтилен PEX-A Ø16</td>
                  <td className="px-3 py-2">Тёплые полы</td>
                  <td className="px-3 py-2 font-mono text-red-200">420 тг/м</td>
                </tr>
                <tr className="hover:bg-red-950/20">
                  <td className="px-3 py-2">Сталь чёрная Ø32</td>
                  <td className="px-3 py-2">Стояки выше 5 эт. (нагрузки)</td>
                  <td className="px-3 py-2 font-mono text-red-200">1 850 тг/м</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3 — Exercises */}
        <section className="mb-8 rounded-2xl border border-orange-900/40 bg-zinc-900/60 p-6 shadow-lg">
          <h2 className="mb-4 text-xl font-semibold text-orange-300">
            3. Практические задачи
          </h2>

          <div className="space-y-6">
            {/* Exercise 1 */}
            <div className="rounded-xl border border-orange-900/30 bg-zinc-950/60 p-5">
              <h3 className="mb-2 font-semibold text-orange-200">
                Задача 1. Длина трубы для подводки 6 радиаторов в квартире
              </h3>
              <p className="mb-3 text-sm text-zinc-400">
                Сколько метров металлопластиковой трубы Ø16 потребуется на
                подводки (подача + обратка) для 6 радиаторов? Среднее на
                радиатор — 4 м.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  inputMode="decimal"
                  value={answers.ex1.value}
                  onChange={(e) => updateValue("ex1", e.target.value)}
                  placeholder="м"
                  className="w-32 rounded-md border border-orange-800/50 bg-zinc-900 px-3 py-2 text-orange-100 focus:border-orange-500 focus:outline-none"
                />
                <button
                  onClick={() => checkAnswer("ex1")}
                  className="rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-500"
                >
                  Проверить
                </button>
                <button
                  onClick={() => toggleSolution("ex1")}
                  className="rounded-md border border-orange-700/50 px-4 py-2 text-sm text-orange-300 transition hover:bg-orange-900/30"
                >
                  {revealed.ex1 ? "Скрыть решение" : "Показать решение"}
                </button>
              </div>
              {answers.ex1.checked && (
                <p
                  className={`mt-3 text-sm ${
                    answers.ex1.correct ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {answers.ex1.message}
                </p>
              )}
              {revealed.ex1 && (
                <div className="mt-3 rounded-md bg-orange-950/30 p-3 text-sm text-orange-100">
                  {EXERCISES.ex1.solution}
                </div>
              )}
            </div>

            {/* Exercise 2 */}
            <div className="rounded-xl border border-orange-900/30 bg-zinc-950/60 p-5">
              <h3 className="mb-2 font-semibold text-orange-200">
                Задача 2. Стоимость комплекта радиаторов для квартиры 80 м²
              </h3>
              <p className="mb-3 text-sm text-zinc-400">
                Норма: 1 секция на 1.5 м². Используем биметаллический Rifar по 8
                секций (18 500 тг/шт). Какая итоговая стоимость комплекта?
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  inputMode="decimal"
                  value={answers.ex2.value}
                  onChange={(e) => updateValue("ex2", e.target.value)}
                  placeholder="тг"
                  className="w-40 rounded-md border border-orange-800/50 bg-zinc-900 px-3 py-2 text-orange-100 focus:border-orange-500 focus:outline-none"
                />
                <button
                  onClick={() => checkAnswer("ex2")}
                  className="rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-500"
                >
                  Проверить
                </button>
                <button
                  onClick={() => toggleSolution("ex2")}
                  className="rounded-md border border-orange-700/50 px-4 py-2 text-sm text-orange-300 transition hover:bg-orange-900/30"
                >
                  {revealed.ex2 ? "Скрыть решение" : "Показать решение"}
                </button>
              </div>
              {answers.ex2.checked && (
                <p
                  className={`mt-3 text-sm ${
                    answers.ex2.correct ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {answers.ex2.message}
                </p>
              )}
              {revealed.ex2 && (
                <div className="mt-3 rounded-md bg-orange-950/30 p-3 text-sm text-orange-100">
                  {EXERCISES.ex2.solution}
                </div>
              )}
            </div>

            {/* Exercise 3 */}
            <div className="rounded-xl border border-orange-900/30 bg-zinc-950/60 p-5">
              <h3 className="mb-2 font-semibold text-orange-200">
                Задача 3. Тёплый пол для гостиной 25 м² + ванной 6 м²
              </h3>
              <p className="mb-3 text-sm text-zinc-400">
                Заполнение в зонах без мебели: гостиная — 70%, ванная — 100%.
                Найдите итог: материал + работа + коллектор. Округлите.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  inputMode="decimal"
                  value={answers.ex3.value}
                  onChange={(e) => updateValue("ex3", e.target.value)}
                  placeholder="тг"
                  className="w-40 rounded-md border border-orange-800/50 bg-zinc-900 px-3 py-2 text-orange-100 focus:border-orange-500 focus:outline-none"
                />
                <button
                  onClick={() => checkAnswer("ex3")}
                  className="rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-500"
                >
                  Проверить
                </button>
                <button
                  onClick={() => toggleSolution("ex3")}
                  className="rounded-md border border-orange-700/50 px-4 py-2 text-sm text-orange-300 transition hover:bg-orange-900/30"
                >
                  {revealed.ex3 ? "Скрыть решение" : "Показать решение"}
                </button>
              </div>
              {answers.ex3.checked && (
                <p
                  className={`mt-3 text-sm ${
                    answers.ex3.correct ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {answers.ex3.message}
                </p>
              )}
              {revealed.ex3 && (
                <div className="mt-3 rounded-md bg-orange-950/30 p-3 text-sm text-orange-100">
                  {EXERCISES.ex3.solution}
                </div>
              )}
            </div>

            {/* Exercise 4 */}
            <div className="rounded-xl border border-orange-900/30 bg-zinc-950/60 p-5">
              <h3 className="mb-2 font-semibold text-orange-200">
                Задача 4. Время монтажа отопления квартиры 80 м²
              </h3>
              <p className="mb-3 text-sm text-zinc-400">
                Сколько рабочих дней займёт монтаж бригадой из 2 человек
                (среднее значение)?
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  inputMode="decimal"
                  value={answers.ex4.value}
                  onChange={(e) => updateValue("ex4", e.target.value)}
                  placeholder="дн."
                  className="w-32 rounded-md border border-orange-800/50 bg-zinc-900 px-3 py-2 text-orange-100 focus:border-orange-500 focus:outline-none"
                />
                <button
                  onClick={() => checkAnswer("ex4")}
                  className="rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-500"
                >
                  Проверить
                </button>
                <button
                  onClick={() => toggleSolution("ex4")}
                  className="rounded-md border border-orange-700/50 px-4 py-2 text-sm text-orange-300 transition hover:bg-orange-900/30"
                >
                  {revealed.ex4 ? "Скрыть решение" : "Показать решение"}
                </button>
              </div>
              {answers.ex4.checked && (
                <p
                  className={`mt-3 text-sm ${
                    answers.ex4.correct ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {answers.ex4.message}
                </p>
              )}
              {revealed.ex4 && (
                <div className="mt-3 rounded-md bg-orange-950/30 p-3 text-sm text-orange-100">
                  {EXERCISES.ex4.solution}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ESN refs */}
        <section className="mb-8 rounded-2xl border border-red-900/40 bg-zinc-900/60 p-6 shadow-lg">
          <h2 className="mb-3 text-xl font-semibold text-red-300">
            Расценки ЭСН
          </h2>
          <ul className="space-y-2 text-zinc-300">
            <li className="flex gap-2">
              <span className="text-red-400">●</span>
              <span>
                <span className="font-mono font-semibold text-red-200">
                  Сб.18-1
                </span>{" "}
                — трубы (прокладка, испытания)
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-red-400">●</span>
              <span>
                <span className="font-mono font-semibold text-red-200">
                  Сб.18-2
                </span>{" "}
                — радиаторы (монтаж, обвязка)
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-red-400">●</span>
              <span>
                <span className="font-mono font-semibold text-red-200">
                  Сб.18-3
                </span>{" "}
                — тёплый пол (укладка петель, коллектор, опрессовка)
              </span>
            </li>
          </ul>
        </section>

        {/* Factoid */}
        <section className="mb-8 rounded-2xl border-l-4 border-orange-500 bg-orange-950/30 p-6 shadow-lg">
          <h3 className="mb-2 text-lg font-bold text-orange-300">
            💡 Факт по регионам РК
          </h3>
          <p className="leading-relaxed text-orange-100">
            Тёплый пол + радиаторы — оптимальная схема для южных регионов РК
            (Алматы, Шымкент). Тёплый пол только — для северных требует мощных
            тепловых насосов.
          </p>
        </section>

        <footer className="mt-12 border-t border-orange-900/30 pt-6 text-center text-xs text-zinc-500">
          AEVION Сметчик — Тренажёр по чертежам · Внутреннее отопление
        </footer>
      </div>
    </div>
  );
}
