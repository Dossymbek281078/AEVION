"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * Теплотехнический расчёт — сопротивление теплопередаче (R_тр).
 * Источники: СП РК 2.04-104-2012 · СНиП РК 4.02-42-2006 · СП РК 2.04-21
 */

// ── Хелпер проверки числового ответа с допуском ──────────────────────────────
function check(input: string, answers: string[], tol: number) {
  const v = parseFloat(input.replace(",", "."));
  return answers.some((x) => {
    const e = parseFloat(x.replace(",", "."));
    return !isNaN(v) && !isNaN(e) && Math.abs((v - e) / e) <= tol;
  });
}

// ── Раздел 1: R_тр для регионов РК ───────────────────────────────────────────
type RegionRow = {
  city: string;
  walls: number;
  windows: number;
  roof: number;
  floor: number;
};

const REGIONS_RTR: RegionRow[] = [
  { city: "Алматы",   walls: 3.2, windows: 0.55, roof: 4.8, floor: 4.2 },
  { city: "Шымкент",  walls: 2.8, windows: 0.50, roof: 4.2, floor: 3.8 },
  { city: "Астана",   walls: 4.5, windows: 0.65, roof: 6.0, floor: 5.5 },
  { city: "Атырау",   walls: 3.4, windows: 0.55, roof: 5.0, floor: 4.5 },
  { city: "Костанай", walls: 4.2, windows: 0.62, roof: 5.8, floor: 5.2 },
];

// ── Раздел 2: Теплопроводность материалов ────────────────────────────────────
type MaterialRow = {
  name: string;
  lambda: string;
  use: string;
};

const MATERIALS: MaterialRow[] = [
  { name: "Кирпич глиняный полнотелый",                lambda: "0.81",       use: "Несущие стены" },
  { name: "Кирпич пустотелый",                          lambda: "0.40",       use: "Лёгкие перегородки" },
  { name: "Газобетон D500",                             lambda: "0.13",       use: "Несущие лёгкие стены" },
  { name: "Минвата URSA 35 кг/м³",                      lambda: "0.045",      use: "Утеплитель кровли, фасадов" },
  { name: "Минвата Rockwool 50 кг/м³",                  lambda: "0.039",      use: "Премиум утеплитель" },
  { name: "Пенополистирол ПСБ-С-25",                    lambda: "0.038",      use: "Фасады СФТК (горюч! класс Г1)" },
  { name: "Пенополистирол XPS Технониколь",             lambda: "0.034",      use: "Кровля плоская, цоколь" },
  { name: "ППУ напыляемый",                             lambda: "0.024",      use: "Сложные геометрии" },
  { name: "Бетон тяжёлый М200",                         lambda: "1.40",       use: "Конструкционный" },
  { name: "Стекло одинарное 4 мм",                      lambda: "0.76",       use: "Окна" },
  { name: "Стеклопакет двухкамерный",                   lambda: "R = 0.55",   use: "Окна стандарт" },
  { name: "Стеклопакет с энергосберегающим покрытием",  lambda: "R = 0.65–0.85", use: "Энергоэффект окна" },
];

// ── Раздел: Классы энергоэффективности ───────────────────────────────────────
const EFF_CLASSES: { cls: string; mult: string; desc: string }[] = [
  { cls: "A++", mult: "× 1.50", desc: "премиум" },
  { cls: "A+",  mult: "× 1.30", desc: "повышенный" },
  { cls: "A",   mult: "× 1.10", desc: "хороший" },
  { cls: "B",   mult: "× 1.00", desc: "стандарт" },
  { cls: "C",   mult: "× 0.85", desc: "ниже норм" },
];

// ── Раздел 4: Упражнения ─────────────────────────────────────────────────────
type Exercise = {
  id: string;
  title: string;
  task: string;
  label: string;
  unit: string;
  answers: string[];
  tol: number;
  formula: string;
  comment: string;
};

const EXERCISES: Exercise[] = [
  {
    id: "ex1",
    title: "Упражнение 1. R_стены кирпичной без утепления",
    task:
      "Стена из полнотелого кирпича толщиной 380 мм + штукатурка по 20 мм с двух сторон. " +
      "Рассчитайте сопротивление теплопередаче R_стены (м²·°C/Вт). " +
      "Учтите Rн + Rв = 0.158.",
    label: "R_стены, м²·°C/Вт",
    unit: "м²·°C/Вт",
    answers: ["0.677", "0,677", "0.68", "0,68"],
    tol: 0.05,
    formula:
      "Кирпич: 0.38/0.81 = 0.469; штукатурка: 2·(0.020/0.81) = 0.05; +0.158 = 0.677 м²·°C/Вт",
    comment:
      "R_тр стен Алматы = 3.2 → 0.677 < 3.2 → НЕ СООТВЕТСТВУЕТ. Нужно дополнительное утепление ≈90 мм минваты.",
  },
  {
    id: "ex2",
    title: "Упражнение 2. Толщина минваты для R_тр Алматы",
    task:
      "Существующая кирпичная стена R = 0.677 м²·°C/Вт. Требуется довести до R_тр Алматы = 3.2 м²·°C/Вт " +
      "за счёт минваты URSA (λ = 0.045). Какова требуемая толщина утеплителя в мм?",
    label: "Толщина минваты, мм",
    unit: "мм",
    answers: ["114", "120"],
    tol: 0.10,
    formula:
      "ΔR = 3.2 − 0.677 = 2.52; δ = 2.52 · 0.045 = 0.114 м = 114 мм → округлить до 120 мм (стандартный рулон)",
    comment:
      "Допуск ±10% (110–130 мм). На производстве выбирают ближайшую кратную 50 мм толщину рулона.",
  },
  {
    id: "ex3",
    title: "Упражнение 3. Сравнение утеплителей для R = 2.5",
    task:
      "Требуется добавить R = 2.5 м²·°C/Вт. Рассчитайте толщину пенополистирола ПСБ-25 " +
      "(λ = 0.038), мм.",
    label: "Толщина ПСБ-25, мм",
    unit: "мм",
    answers: ["95"],
    tol: 0.05,
    formula:
      "δ = R·λ = 2.5 · 0.038 = 0.095 м = 95 мм. Для сравнения: минвата URSA — 113 мм, ППУ — 60 мм.",
    comment:
      "ППУ напыляемый тоньше минваты в ~2 раза для той же R. Но дороже и требует спецоборудования.",
  },
  {
    id: "ex4",
    title: "Упражнение 4. Стоимость утепления стен школы №47",
    task:
      "Площадь стен 1115 м². Утеплитель — минвата URSA, толщина 100 мм (класс B Алматы). " +
      "Цена URSA: 22 000 тг/м³. Работа: 850 тг/м². Какова итоговая стоимость утепления (тг)?",
    label: "Итого, тг",
    unit: "тг",
    answers: ["3400750", "3 400 750"],
    tol: 0.05,
    formula:
      "V = 1115·0.10 = 111.5 м³; материал: 111.5·22000 = 2 453 000; работа: 1115·850 = 947 750; итого 3 400 750 тг",
    comment:
      "Допуск ±5%. Включить в смету по ЭСН Сб.26-01-001 «Утепление фасадов плитами».",
  },
];

// ── Карточка упражнения ──────────────────────────────────────────────────────
function ExerciseCard({ ex }: { ex: Exercise }) {
  const [val, setVal] = useState("");
  const [rev, setRev] = useState(false);
  const ok = rev && check(val, ex.answers, ex.tol);
  const err = rev && !ok;

  return (
    <div className="border-2 border-cyan-200 dark:border-cyan-800 bg-white dark:bg-slate-900 rounded-xl p-4">
      <h3 className="text-sm font-bold text-cyan-900 dark:text-cyan-200 mb-1.5">{ex.title}</h3>
      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mb-3">{ex.task}</p>

      <div
        className={`border-2 rounded-lg p-3 ${
          ok
            ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20"
            : err
            ? "border-red-300 bg-red-50 dark:bg-red-900/20"
            : "border-cyan-200 dark:border-cyan-700 bg-cyan-50/50 dark:bg-cyan-900/10"
        }`}
      >
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 block mb-1.5">
          {ex.label}
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !rev && setRev(true)}
            disabled={rev}
            placeholder="Введите число..."
            className="flex-1 border border-cyan-300 dark:border-cyan-700 rounded px-2 py-1.5 text-sm font-mono bg-white dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <span className="self-center text-xs text-slate-500 dark:text-slate-400 font-mono">
            {ex.unit}
          </span>
          {!rev && (
            <button
              onClick={() => setRev(true)}
              disabled={!val.trim()}
              className="px-3 py-1.5 bg-cyan-600 text-white text-xs font-semibold rounded hover:bg-cyan-700 disabled:opacity-40"
            >
              Проверить
            </button>
          )}
        </div>

        {rev && (
          <div className="mt-2 space-y-1.5">
            <div
              className={`text-xs leading-relaxed ${
                ok ? "text-emerald-800 dark:text-emerald-300" : "text-red-800 dark:text-red-300"
              }`}
            >
              {ok ? "✓ Верно. " : "✗ Неверно. "}
              <span className="font-mono text-[11px]">{ex.formula}</span>
            </div>
            <div className="text-[11px] text-slate-600 dark:text-slate-400 italic leading-relaxed">
              {ex.comment}
            </div>
            {err && (
              <button
                onClick={() => {
                  setVal("");
                  setRev(false);
                }}
                className="text-[11px] text-amber-700 dark:text-amber-400 underline"
              >
                Попробовать снова
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Главная страница ─────────────────────────────────────────────────────────
export default function ThermalCalcPage() {
  const [matFilter, setMatFilter] = useState("");

  const materialsFiltered = MATERIALS.filter((m) =>
    m.name.toLowerCase().includes(matFilter.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-cyan-50/30 dark:bg-slate-950">
      {/* ── Header bar ───────────────────────────────────────────────────── */}
      <header className="bg-blue-700 text-white border-b-4 border-blue-900">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-xs text-blue-100 hover:text-white whitespace-nowrap"
          >
            ← К разделам
          </Link>
          <div className="flex-1">
            <h1 className="text-sm md:text-base font-bold">
              🌡 Теплотехнический расчёт — сопротивление теплопередаче
            </h1>
            <p className="text-[10px] md:text-xs text-blue-200">
              СП РК 2.04-104-2012 · СНиП РК 4.02-42-2006 · СП РК 2.04-21
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* ── Введение ───────────────────────────────────────────────────── */}
        <section className="bg-white dark:bg-slate-900 border-l-4 border-cyan-500 dark:border-cyan-600 rounded-r-xl p-4 shadow-sm">
          <h2 className="text-base font-bold text-cyan-800 dark:text-cyan-300 mb-2">
            🌡 ЗАЧЕМ ТЕПЛОТЕХНИЧЕСКИЙ РАСЧЁТ?
          </h2>
          <div className="text-sm text-slate-700 dark:text-slate-300 space-y-2 leading-relaxed">
            <p>
              <b>Теплотехнический расчёт</b> определяет необходимую толщину утеплителя
              для соответствия требуемому сопротивлению теплопередаче (R_тр).
            </p>
            <p className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded p-2 text-[13px]">
              ⚠ Без теплотехнического расчёта проект <b>НЕ ПРОЙДЁТ</b> экспертизу.
              Сметчик использует результаты расчёта для подбора материалов утепления.
            </p>
            <div className="mt-2">
              <div className="text-xs font-bold text-cyan-900 dark:text-cyan-200 mb-1.5">
                Класс энергоэффективности здания:
              </div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-1.5">
                {EFF_CLASSES.map((c) => (
                  <div
                    key={c.cls}
                    className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded p-2 text-center"
                  >
                    <div className="font-bold text-cyan-900 dark:text-cyan-200 text-sm">
                      {c.cls}
                    </div>
                    <div className="text-[11px] font-mono text-slate-700 dark:text-slate-300">
                      R_тр {c.mult}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 italic">
                      {c.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Нормативный блок ───────────────────────────────────────────── */}
        <section className="bg-white dark:bg-slate-900 border border-cyan-200 dark:border-cyan-800 rounded-xl p-4">
          <h2 className="text-sm font-bold text-cyan-800 dark:text-cyan-300 mb-3">
            📚 НОРМАТИВНАЯ БАЗА
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
            <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded p-2">
              <div className="font-bold text-cyan-900 dark:text-cyan-200">
                СП РК 2.04-104-2012
              </div>
              <div className="text-slate-600 dark:text-slate-400">
                «Тепловая защита зданий»
              </div>
            </div>
            <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded p-2">
              <div className="font-bold text-cyan-900 dark:text-cyan-200">
                СНиП РК 4.02-42-2006
              </div>
              <div className="text-slate-600 dark:text-slate-400">
                «Тепловые сети»
              </div>
            </div>
            <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded p-2">
              <div className="font-bold text-cyan-900 dark:text-cyan-200">
                СП РК 2.04-21
              </div>
              <div className="text-slate-600 dark:text-slate-400">
                «Энергоэффективность жилых и общественных зданий»
              </div>
            </div>
          </div>
        </section>

        {/* ── Раздел 1: R_тр для регионов ────────────────────────────────── */}
        <section className="bg-white dark:bg-slate-900 border border-cyan-200 dark:border-cyan-800 rounded-xl p-4">
          <h2 className="text-base font-bold text-cyan-800 dark:text-cyan-300 mb-1">
            Раздел 1. Требуемое R_тр для регионов РК
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3 italic">
            Базовый класс B (стандарт). Для A+/A++ — умножить на 1.30 / 1.50.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-cyan-100 dark:bg-cyan-900/40 text-cyan-900 dark:text-cyan-200">
                  <th className="border border-cyan-300 dark:border-cyan-700 px-2 py-1.5 text-left">
                    Город
                  </th>
                  <th className="border border-cyan-300 dark:border-cyan-700 px-2 py-1.5">
                    R_тр стен, м²·°C/Вт
                  </th>
                  <th className="border border-cyan-300 dark:border-cyan-700 px-2 py-1.5">
                    R_тр окон
                  </th>
                  <th className="border border-cyan-300 dark:border-cyan-700 px-2 py-1.5">
                    R_тр кровля
                  </th>
                  <th className="border border-cyan-300 dark:border-cyan-700 px-2 py-1.5">
                    R_тр пол
                  </th>
                </tr>
              </thead>
              <tbody>
                {REGIONS_RTR.map((r, i) => (
                  <tr
                    key={r.city}
                    className={
                      r.city === "Алматы"
                        ? "bg-cyan-50 dark:bg-cyan-900/30 font-semibold"
                        : i % 2 === 0
                        ? "bg-white dark:bg-slate-900"
                        : "bg-slate-50 dark:bg-slate-800/50"
                    }
                  >
                    <td className="border border-cyan-200 dark:border-cyan-800 px-2 py-1 font-bold text-slate-800 dark:text-slate-200">
                      {r.city}
                    </td>
                    <td className="border border-cyan-200 dark:border-cyan-800 px-2 py-1 text-center font-mono text-slate-700 dark:text-slate-300">
                      {r.walls.toFixed(1)}
                    </td>
                    <td className="border border-cyan-200 dark:border-cyan-800 px-2 py-1 text-center font-mono text-slate-700 dark:text-slate-300">
                      {r.windows.toFixed(2)}
                    </td>
                    <td className="border border-cyan-200 dark:border-cyan-800 px-2 py-1 text-center font-mono text-slate-700 dark:text-slate-300">
                      {r.roof.toFixed(1)}
                    </td>
                    <td className="border border-cyan-200 dark:border-cyan-800 px-2 py-1 text-center font-mono text-slate-700 dark:text-slate-300">
                      {r.floor.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Раздел 2: Теплопроводность материалов ──────────────────────── */}
        <section className="bg-white dark:bg-slate-900 border border-cyan-200 dark:border-cyan-800 rounded-xl p-4">
          <h2 className="text-base font-bold text-cyan-800 dark:text-cyan-300 mb-1">
            Раздел 2. Теплопроводность строительных материалов
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3 italic">
            λ — коэффициент теплопроводности, Вт/(м·°C). Меньше λ — лучше утеплитель.
          </p>

          <div className="flex flex-wrap gap-2 mb-3">
            <input
              type="text"
              value={matFilter}
              onChange={(e) => setMatFilter(e.target.value)}
              placeholder="🔍 Фильтр по названию материала..."
              className="flex-1 min-w-[180px] border border-cyan-300 dark:border-cyan-700 rounded px-2 py-1 text-xs bg-white dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-cyan-100 dark:bg-cyan-900/40 text-cyan-900 dark:text-cyan-200">
                  <th className="border border-cyan-300 dark:border-cyan-700 px-2 py-1.5 text-left">
                    Материал
                  </th>
                  <th className="border border-cyan-300 dark:border-cyan-700 px-2 py-1.5">
                    λ, Вт/(м·°C)
                  </th>
                  <th className="border border-cyan-300 dark:border-cyan-700 px-2 py-1.5 text-left">
                    Применение
                  </th>
                </tr>
              </thead>
              <tbody>
                {materialsFiltered.map((m, i) => (
                  <tr
                    key={m.name}
                    className={
                      i % 2 === 0
                        ? "bg-white dark:bg-slate-900"
                        : "bg-slate-50 dark:bg-slate-800/50"
                    }
                  >
                    <td className="border border-cyan-200 dark:border-cyan-800 px-2 py-1 text-slate-800 dark:text-slate-200">
                      {m.name}
                    </td>
                    <td className="border border-cyan-200 dark:border-cyan-800 px-2 py-1 text-center font-mono text-slate-700 dark:text-slate-300">
                      {m.lambda}
                    </td>
                    <td className="border border-cyan-200 dark:border-cyan-800 px-2 py-1 text-slate-600 dark:text-slate-400">
                      {m.use}
                    </td>
                  </tr>
                ))}
                {materialsFiltered.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      className="border border-cyan-200 dark:border-cyan-800 px-2 py-3 text-center text-slate-500 italic"
                    >
                      Нет материалов по фильтру
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Раздел 3: Формула + пример ─────────────────────────────────── */}
        <section className="bg-white dark:bg-slate-900 border border-cyan-200 dark:border-cyan-800 rounded-xl p-4">
          <h2 className="text-base font-bold text-cyan-800 dark:text-cyan-300 mb-3">
            Раздел 3. Формула расчёта стены
          </h2>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-3">
            <div className="text-xs font-bold text-blue-900 dark:text-blue-200 mb-2">
              ФОРМУЛА:
            </div>
            <div className="font-mono text-xs md:text-sm text-blue-900 dark:text-blue-100 leading-relaxed">
              R_стены = δ₁/λ₁ + δ₂/λ₂ + δ₃/λ₃ + ... + Rн + Rв
            </div>
            <ul className="mt-2 text-[11px] text-slate-700 dark:text-slate-300 space-y-0.5 list-disc list-inside">
              <li><b>δ</b> — толщина слоя, м</li>
              <li><b>λ</b> — теплопроводность материала, Вт/(м·°C)</li>
              <li><b>Rн</b> = 0.115 м²·°C/Вт (для внутренней поверхности)</li>
              <li><b>Rв</b> = 0.043 м²·°C/Вт (для наружной поверхности)</li>
            </ul>
          </div>

          <div className="bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-950/30 dark:to-blue-950/30 border border-cyan-300 dark:border-cyan-700 rounded-lg p-3">
            <div className="text-xs font-bold text-cyan-900 dark:text-cyan-200 mb-2">
              ПРИМЕР: Стена газобетон + СФТК
            </div>
            <pre className="text-[11px] md:text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre overflow-x-auto leading-relaxed bg-white/70 dark:bg-slate-900/70 rounded p-2 border border-cyan-200 dark:border-cyan-800">
{`1. Штукатурка внутр. 20 мм:        0.020 / 0.81  = 0.025
2. Газобетон D500 400 мм:          0.40  / 0.13  = 3.08
3. Клеевой слой 5 мм:              0.005 / 0.50  = 0.01
4. Пенополистирол ПСБ-25 100 мм:   0.10  / 0.038 = 2.63
5. Армирующий слой 5 мм:           0.005 / 0.50  = 0.01
6. Декоративная штукатурка 3 мм:   0.003 / 0.81  = 0.004
                                   Rн + Rв        = 0.158
                                   ─────────────────────
R_стены                            = 5.92 м²·°C/Вт`}
            </pre>
            <div className="mt-2 text-[12px] text-slate-700 dark:text-slate-300 leading-relaxed">
              <div>
                Сравнение с R_тр для Алматы (3.2):{" "}
                <b className="text-emerald-700 dark:text-emerald-300">5.92 &gt; 3.2 ✓</b> →
                стена соответствует.
              </div>
              <div className="italic text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                Запас 85% → можно утеплитель уменьшить до 60–70 мм для оптимизации сметы.
              </div>
            </div>
          </div>
        </section>

        {/* ── Раздел 4: Упражнения ───────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-base font-bold text-cyan-800 dark:text-cyan-300">
            Раздел 4. Интерактивные упражнения
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 italic -mt-2">
            Решите 4 задачи на расчёт сопротивления теплопередаче. Допуск ±5–10% указан в каждой.
          </p>
          {EXERCISES.map((ex) => (
            <ExerciseCard key={ex.id} ex={ex} />
          ))}
        </section>

        {/* ── Раздел 5: Расценки ЭСН ─────────────────────────────────────── */}
        <section className="bg-white dark:bg-slate-900 border border-cyan-200 dark:border-cyan-800 rounded-xl p-4">
          <h2 className="text-base font-bold text-cyan-800 dark:text-cyan-300 mb-3">
            Раздел 5. Расценки ЭСН для утеплительных работ
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded p-2">
              <div className="font-bold text-cyan-900 dark:text-cyan-200 font-mono">
                ЭСН Сб.26-01-001
              </div>
              <div className="text-slate-600 dark:text-slate-400">
                «Утепление фасадов плитами»
              </div>
            </div>
            <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded p-2">
              <div className="font-bold text-cyan-900 dark:text-cyan-200 font-mono">
                ЭСН Сб.26-01-005
              </div>
              <div className="text-slate-600 dark:text-slate-400">
                «Армирующий слой со стеклосеткой»
              </div>
            </div>
            <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded p-2">
              <div className="font-bold text-cyan-900 dark:text-cyan-200 font-mono">
                ЭСН Сб.13
              </div>
              <div className="text-slate-600 dark:text-slate-400">
                «Огнезащита и тепло»
              </div>
            </div>
            <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded p-2">
              <div className="font-bold text-cyan-900 dark:text-cyan-200 font-mono">
                ССЦ РК
              </div>
              <div className="text-slate-600 dark:text-slate-400">
                Цены материалов утепления (URSA, Rockwool, ПСБ, XPS, ППУ)
              </div>
            </div>
          </div>
        </section>

        {/* ── Фактоид ─────────────────────────────────────────────────────── */}
        <section className="bg-blue-100 dark:bg-blue-900/30 border-l-4 border-blue-600 dark:border-blue-500 rounded-r-xl p-4">
          <div className="text-sm font-bold text-blue-900 dark:text-blue-200 mb-1.5">
            💡 ВАЖНО
          </div>
          <p className="text-sm text-blue-900 dark:text-blue-100 leading-relaxed">
            Класс <b>A+</b> требует на <b>30%</b> больше материала утеплителя, но снижает
            теплопотери на <b>25–30%</b> и счёт за отопление на <b>~15%/год</b>.
            Окупается за <b>7–12 лет</b>. Для бюджетных зданий — обязательно класс <b>B</b>{" "}
            минимум.
          </p>
        </section>

        {/* ── Footer nav ─────────────────────────────────────────────────── */}
        <div className="flex justify-between pt-4 pb-8">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-xs text-cyan-700 dark:text-cyan-300 hover:underline"
          >
            ← К разделам
          </Link>
          <Link
            href="/smeta-trainer/drawings-practice/facade-svtk"
            className="text-xs text-cyan-700 dark:text-cyan-300 hover:underline"
          >
            🏗 Фасад СФТК →
          </Link>
        </div>
      </div>
    </div>
  );
}
