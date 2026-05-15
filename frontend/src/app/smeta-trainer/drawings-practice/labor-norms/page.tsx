"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

/**
 * Нормы труда — ЕНиР РК, выработка, разряды.
 * Учебная страница: тарифные ставки, нормы выработки, расчёт ФОТ для бригады.
 * Базовая ставка 1 разряда (РК 2025) ≈ 1850 тг/час. Не для коммерческих расчётов.
 */

// ── Тарифные ставки по разрядам ─────────────────────────────────────────────
interface Tariff {
  rank: number;
  coef: number;
  rateKzt: number;
  application: string;
}

const TARIFFS: Tariff[] = [
  { rank: 1, coef: 1.000, rateKzt: 1850, application: "Подсобные работники, разнорабочие" },
  { rank: 2, coef: 1.085, rateKzt: 2008, application: "Простые штукатурные, бетонные" },
  { rank: 3, coef: 1.189, rateKzt: 2200, application: "Каменщики, плотники, бетонщики" },
  { rank: 4, coef: 1.336, rateKzt: 2472, application: "Маляры-стажисты, опытные штукатуры" },
  { rank: 5, coef: 1.541, rateKzt: 2851, application: "Сварщики, плиточники, монтажники" },
  { rank: 6, coef: 1.793, rateKzt: 3317, application: "Бригадиры, мастера-универсалы" },
];

// ── Нормы выработки по видам работ ──────────────────────────────────────────
type WorkGroup =
  | "Земляные работы"
  | "Бетонные работы"
  | "Каменные работы"
  | "Кровельные работы"
  | "Отделочные работы"
  | "Окна и двери"
  | "Инж. сети"
  | "Кровля скатная";

interface LaborNorm {
  id: string;
  group: WorkGroup;
  name: string;
  unit: string;
  output: string;        // выработка чел/день
  rank: number;
  timeNorm: string;      // чел.час/ед
}

const NORMS: LaborNorm[] = [
  // Земляные работы
  { id: "z-01", group: "Земляные работы", name: "Разработка грунта вручную (II кат.)",   unit: "м³", output: "4-5",   rank: 2, timeNorm: "1.6-2.0" },
  { id: "z-02", group: "Земляные работы", name: "Разработка грунта вручную (III кат.)",  unit: "м³", output: "2-3",   rank: 2, timeNorm: "2.7-4.0" },
  { id: "z-03", group: "Земляные работы", name: "Засыпка вручную с трамбованием",        unit: "м³", output: "4-6",   rank: 1, timeNorm: "1.3-2.0" },

  // Бетонные работы
  { id: "b-01", group: "Бетонные работы", name: "Монтаж арматурного каркаса",            unit: "т",  output: "0.4-0.6", rank: 4, timeNorm: "13-20" },
  { id: "b-02", group: "Бетонные работы", name: "Установка опалубки щитовой",            unit: "м²", output: "8-12",  rank: 3, timeNorm: "0.7-1.0" },
  { id: "b-03", group: "Бетонные работы", name: "Бетонирование монолита",                unit: "м³", output: "3-5",   rank: 3, timeNorm: "1.6-2.7" },
  { id: "b-04", group: "Бетонные работы", name: "Уход за бетоном (полив)",               unit: "м²", output: "80-100",rank: 1, timeNorm: "0.08-0.10" },

  // Каменные работы
  { id: "k-01", group: "Каменные работы", name: "Кладка стен из кирпича толщ. 380 мм",   unit: "м³", output: "1.0-1.4", rank: 4, timeNorm: "5.7-8.0" },
  { id: "k-02", group: "Каменные работы", name: "Кладка газобетон D500 толщ. 400 мм",    unit: "м³", output: "2.5-3.5", rank: 3, timeNorm: "2.3-3.2" },
  { id: "k-03", group: "Каменные работы", name: "Кладка простой формы внутр. перегородки", unit: "м²", output: "8-10", rank: 3, timeNorm: "0.8-1.0" },

  // Кровельные работы
  { id: "r-01", group: "Кровельные работы", name: "Устройство пароизоляции",             unit: "м²", output: "80-100",rank: 3, timeNorm: "0.08-0.10" },
  { id: "r-02", group: "Кровельные работы", name: "Укладка минваты на кровлю",           unit: "м²", output: "40-60", rank: 3, timeNorm: "0.13-0.20" },
  { id: "r-03", group: "Кровельные работы", name: "Наплавление 2 слоев Унифлекс",        unit: "м²", output: "40-50", rank: 4, timeNorm: "0.16-0.20" },

  // Отделочные работы
  { id: "f-01", group: "Отделочные работы", name: "Штукатурка стен по маякам толщ. 20 мм", unit: "м²", output: "6-8", rank: 4, timeNorm: "1.0-1.3" },
  { id: "f-02", group: "Отделочные работы", name: "Штукатурка потолков (выше +3 м)",     unit: "м²", output: "4-5",  rank: 4, timeNorm: "1.6-2.0" },
  { id: "f-03", group: "Отделочные работы", name: "Шпатлёвка 2 слоя",                    unit: "м²", output: "30-40", rank: 4, timeNorm: "0.20-0.27" },
  { id: "f-04", group: "Отделочные работы", name: "Окраска ВД 2 слоя",                   unit: "м²", output: "80-100",rank: 3, timeNorm: "0.08-0.10" },
  { id: "f-05", group: "Отделочные работы", name: "Облицовка стен плиткой керам. 250×400", unit: "м²", output: "4-5", rank: 4, timeNorm: "1.6-2.0" },
  { id: "f-06", group: "Отделочные работы", name: "Укладка плитки пол керам. 300×300",   unit: "м²", output: "6-8",  rank: 4, timeNorm: "1.0-1.3" },
  { id: "f-07", group: "Отделочные работы", name: "Укладка ламината 33 кл.",             unit: "м²", output: "15-20",rank: 3, timeNorm: "0.40-0.53" },

  // Окна и двери
  { id: "w-01", group: "Окна и двери", name: "Установка окна ПВХ (1.5×1.8)",             unit: "шт", output: "1.5-2", rank: 4, timeNorm: "4-5" },
  { id: "w-02", group: "Окна и двери", name: "Установка двери внутренней",                unit: "шт", output: "2-3",   rank: 4, timeNorm: "2.7-4.0" },

  // Инж. сети
  { id: "u-01", group: "Инж. сети", name: "Прокладка трубы ПЭ Ø160 в траншее",           unit: "м.п.", output: "35-45", rank: 4, timeNorm: "0.18-0.23" },
  { id: "u-02", group: "Инж. сети", name: "Прокладка кабеля АВВГ в траншее",             unit: "м.п.", output: "80-100",rank: 4, timeNorm: "0.08-0.10" },
  { id: "u-03", group: "Инж. сети", name: "Установка водопроводного колодца ВК-1500",    unit: "шт",   output: "0.5 за день бригадой", rank: 5, timeNorm: "16" },
  { id: "u-04", group: "Инж. сети", name: "Сварка стыков теплосети Ø108",                unit: "стык", output: "4-5",   rank: 5, timeNorm: "1.6-2.0" },

  // Кровля скатная
  { id: "s-01", group: "Кровля скатная", name: "Устройство стропил",                     unit: "м² (по плану кровли)", output: "12-15", rank: 4, timeNorm: "0.53-0.67" },
  { id: "s-02", group: "Кровля скатная", name: "Обрешётка 50×50",                        unit: "м²",                   output: "25-30", rank: 3, timeNorm: "0.27-0.32" },
  { id: "s-03", group: "Кровля скатная", name: "Укладка металлочерепицы",                unit: "м²",                   output: "40-50", rank: 4, timeNorm: "0.16-0.20" },
];

const GROUP_ORDER: WorkGroup[] = [
  "Земляные работы",
  "Бетонные работы",
  "Каменные работы",
  "Кровельные работы",
  "Отделочные работы",
  "Окна и двери",
  "Инж. сети",
  "Кровля скатная",
];

// ── Упражнения ──────────────────────────────────────────────────────────────
interface Exercise {
  id: string;
  title: string;
  question: string;
  hint?: string;
  unit: string;
  expected: number;
  tolerance: number;     // относительная (0.02 = ±2%); 0 = точное
  exact?: boolean;
  solution: string;
}

const EXERCISES: Exercise[] = [
  {
    id: "e1",
    title: "ФОТ за день для бригады каменщиков",
    question:
      "Бригада из 7 человек: 1 бригадир (6 разряд), 3 каменщика (4 разряд), 2 подсобника (2 разряд), 1 рабочий-сварщик (5 разряд). Смена 8 часов. Рассчитайте ФОТ за смену, тг.",
    hint: "ФОТ = Σ(чел × ставка_часа) × часы_смены",
    unit: "тг",
    expected: 140800,
    tolerance: 0.02,
    solution:
      "(1·3317 + 3·2472 + 2·2008 + 1·2851) · 8 = (3317 + 7416 + 4016 + 2851) · 8 = 17 600 · 8 = 140 800 тг (допуск ±2%).",
  },
  {
    id: "e2",
    title: "Срок выполнения кладки стены",
    question:
      "Бригада каменщиков из 3 человек (4 разряд). Объём кладки 25 м³ кирпича толщ. 380 мм. Норма выработки 1.2 м³/чел/день. Сколько рабочих дней потребуется (округлить вверх)?",
    hint: "Дни = объём / (количество чел × выработка). Округлить вверх.",
    unit: "дн.",
    expected: 7,
    tolerance: 0.10,
    solution:
      "25 / (3 · 1.2) = 25 / 3.6 = 6.94 → округление вверх → 7 дней (допуск ±10%).",
  },
  {
    id: "e3",
    title: "Стоимость работ по нормам времени",
    question:
      "Объём штукатурки стен 100 м². Норма времени 1.15 чел.час/м². Работают штукатуры 4 разряда (ставка 2472 тг/час). Рассчитайте ФОТ, тг.",
    hint: "ФОТ = объём × норма_времени × ставка_часа",
    unit: "тг",
    expected: 284280,
    tolerance: 0.02,
    solution:
      "100 · 1.15 · 2472 = 284 280 тг (допуск ±2%).",
  },
  {
    id: "e4",
    title: "Численность бригады для срока",
    question:
      "Объём кладки 200 м³, директивный срок 30 рабочих дней, норма выработки 1.2 м³/чел/день. Сколько человек должно быть в бригаде (округление вверх)?",
    hint: "n = объём / (срок × выработка), округлить вверх.",
    unit: "чел.",
    expected: 6,
    tolerance: 0,
    exact: true,
    solution:
      "n = 200 / (30 · 1.2) = 200 / 36 = 5.56 → округление вверх → 6 человек. Округление вверх обязательно — недостаток рабочих сорвёт срок.",
  },
];

// ── Утилиты ─────────────────────────────────────────────────────────────────
function formatPrice(n: number): string {
  return n.toLocaleString("ru-RU");
}

function parseInputNumber(v: string): number {
  return parseFloat(v.replace(",", ".").replace(/\s+/g, "")) || 0;
}

function checkAnswer(input: string, ex: Exercise): boolean {
  const v = parseInputNumber(input);
  if (!isFinite(v)) return false;
  if (ex.exact || ex.tolerance === 0) {
    return Math.abs(v - ex.expected) < 1e-6;
  }
  return Math.abs((v - ex.expected) / ex.expected) <= ex.tolerance;
}

// ── Страница ────────────────────────────────────────────────────────────────
export default function LaborNormsPage() {
  const [search, setSearch] = useState("");
  const [activeGroup, setActiveGroup] = useState<WorkGroup | "all">("all");

  // Калькулятор ФОТ
  const [calcRank, setCalcRank] = useState<number>(4);
  const [calcQty, setCalcQty] = useState<string>("100");
  const [calcTimeNorm, setCalcTimeNorm] = useState<string>("1.15");

  // Упражнения
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const filteredNorms = useMemo(() => {
    const q = search.trim().toLowerCase();
    return NORMS.filter((n) => {
      if (activeGroup !== "all" && n.group !== activeGroup) return false;
      if (!q) return true;
      const hay = `${n.name} ${n.unit} ${n.group}`.toLowerCase();
      return hay.includes(q);
    });
  }, [search, activeGroup]);

  const groupedFiltered = useMemo(() => {
    const map = new Map<WorkGroup, LaborNorm[]>();
    for (const g of GROUP_ORDER) map.set(g, []);
    for (const n of filteredNorms) map.get(n.group)!.push(n);
    return map;
  }, [filteredNorms]);

  const calcRate = TARIFFS.find((t) => t.rank === calcRank)?.rateKzt ?? 0;
  const calcQtyN = parseInputNumber(calcQty);
  const calcTimeN = parseInputNumber(calcTimeNorm);
  const calcTotal = Math.round(calcQtyN * calcTimeN * calcRate);

  function submitAnswer(exId: string) {
    setRevealed((r) => ({ ...r, [exId]: true }));
  }

  function resetExercise(exId: string) {
    setAnswers((a) => ({ ...a, [exId]: "" }));
    setRevealed((r) => ({ ...r, [exId]: false }));
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Header */}
      <div className="border-b border-blue-200 dark:border-blue-900/40 bg-white/80 dark:bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-sm text-blue-700 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100 font-medium flex items-center gap-1"
          >
            <span>←</span>
            <span>К разделам</span>
          </Link>
          <div className="text-xs text-slate-500 dark:text-slate-400 ml-auto">
            ЕНиР РК · МДС 81-33.2004 · база 1850 тг/ч (1 разряд, 2025)
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Title */}
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          👷 Нормы труда — ЕНиР РК, выработка, разряды
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Тарифные ставки по 6 разрядам, нормы выработки по видам работ, расчёт ФОТ для бригады.
        </p>

        {/* Нормативный блок */}
        <div className="mb-6 rounded-lg border-2 border-blue-500 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-700 p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">📚</span>
            <div className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
              <p className="font-semibold">Нормативная база нормирования труда (РК):</p>
              <ul className="space-y-1 list-disc list-inside marker:text-blue-500">
                <li>
                  <span className="font-semibold">ЕНиР РК</span> — Единые нормы и расценки на строительные работы (Республика Казахстан).
                </li>
                <li>
                  <span className="font-semibold">МДС 81-33.2004</span> — Методические указания по применению норм труда.
                </li>
                <li>
                  <span className="font-semibold">Тарифные коэффициенты по разрядам</span> (1–6 разряд) — устанавливают соотношение оплаты по квалификации.
                </li>
                <li>
                  Базовая ставка <span className="font-semibold">1 разряда (РК 2025) ≈ 1 850 тг/час</span>.
                </li>
              </ul>
              <p className="text-blue-800/80 dark:text-blue-300/70 pt-2 border-t border-blue-300/50 dark:border-blue-800/50 text-xs">
                Учебная выборка. Для коммерческих расчётов — актуальные ЕНиР РК и тарифные сетки конкретного предприятия.
              </p>
            </div>
          </div>
        </div>

        {/* Раздел 1: Тарифные ставки */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
            <span className="inline-block w-1.5 h-6 bg-blue-500 rounded"></span>
            Раздел 1: Тарифные ставки по разрядам
          </h2>
          <div className="overflow-x-auto rounded-lg border border-blue-200 dark:border-blue-900/40 bg-white dark:bg-slate-900 shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-blue-100 dark:bg-blue-900/40 text-blue-900 dark:text-blue-200">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Разряд</th>
                  <th className="px-3 py-2 text-right font-semibold">Тарифный коэф.</th>
                  <th className="px-3 py-2 text-right font-semibold">Ставка час, тг</th>
                  <th className="px-3 py-2 text-left font-semibold">Применение</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-100 dark:divide-blue-900/40">
                {TARIFFS.map((t) => (
                  <tr key={t.rank} className="hover:bg-blue-50/50 dark:hover:bg-blue-950/30">
                    <td className="px-3 py-2 font-semibold text-slate-900 dark:text-slate-100">
                      {t.rank} разряд
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">
                      {t.coef.toFixed(3)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-blue-800 dark:text-blue-300">
                      {formatPrice(t.rateKzt)}
                    </td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-400">{t.application}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Ставка часа = базовая ставка 1 разряда (1 850 тг/ч) × тарифный коэф. (округление до целого тг).
          </p>
        </section>

        {/* Раздел 2: Нормы выработки */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
            <span className="inline-block w-1.5 h-6 bg-blue-500 rounded"></span>
            Раздел 2: Нормы выработки по видам работ
          </h2>

          {/* Поиск */}
          <div className="mb-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔎 Поиск по работам (название, единица, группа)..."
              className="w-full px-4 py-2.5 rounded-lg border-2 border-blue-300 dark:border-blue-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Фильтры группы */}
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              onClick={() => setActiveGroup("all")}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                activeGroup === "all"
                  ? "bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500"
                  : "bg-white text-slate-700 border-slate-300 hover:border-blue-400 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700 dark:hover:border-blue-600"
              }`}
            >
              Все ({NORMS.length})
            </button>
            {GROUP_ORDER.map((g) => {
              const count = NORMS.filter((n) => n.group === g).length;
              const isActive = activeGroup === g;
              return (
                <button
                  key={g}
                  onClick={() => setActiveGroup(g)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    isActive
                      ? "bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500"
                      : "bg-white text-slate-700 border-slate-300 hover:border-blue-400 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700 dark:hover:border-blue-600"
                  }`}
                >
                  {g} ({count})
                </button>
              );
            })}
          </div>

          {/* Таблица норм */}
          {filteredNorms.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-slate-500 dark:text-slate-400">
              Ничего не найдено. Сбросьте фильтр или измените запрос.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-blue-200 dark:border-blue-900/40 bg-white dark:bg-slate-900 shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-blue-100 dark:bg-blue-900/40 text-blue-900 dark:text-blue-200 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Вид работы</th>
                    <th className="px-3 py-2 text-left font-semibold">Ед. изм.</th>
                    <th className="px-3 py-2 text-right font-semibold">Выработка (1 чел/день)</th>
                    <th className="px-3 py-2 text-center font-semibold">Разряд</th>
                    <th className="px-3 py-2 text-right font-semibold">Норма, чел.час/ед.</th>
                  </tr>
                </thead>
                {GROUP_ORDER.map((g) => {
                  const items = groupedFiltered.get(g) ?? [];
                  if (items.length === 0) return null;
                  return (
                    <tbody key={g} className="divide-y divide-blue-100 dark:divide-blue-900/40">
                      <tr className="bg-blue-50 dark:bg-blue-950/30">
                        <td
                          colSpan={5}
                          className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-blue-800 dark:text-blue-300"
                        >
                          {g}
                        </td>
                      </tr>
                      {items.map((n) => (
                        <tr
                          key={n.id}
                          className="hover:bg-blue-50/50 dark:hover:bg-blue-950/20"
                        >
                          <td className="px-3 py-1.5 text-slate-900 dark:text-slate-100">
                            {n.name}
                          </td>
                          <td className="px-3 py-1.5 text-slate-700 dark:text-slate-400 font-mono text-xs">
                            {n.unit}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono text-slate-700 dark:text-slate-300">
                            {n.output}
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            <span className="inline-block px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 text-xs font-semibold">
                              {n.rank}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono text-blue-800 dark:text-blue-300 font-semibold">
                            {n.timeNorm}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  );
                })}
              </table>
            </div>
          )}
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Найдено: <span className="font-semibold text-blue-700 dark:text-blue-300">{filteredNorms.length}</span> поз.
            из {NORMS.length}.
          </p>

          {/* Калькулятор ФОТ по нормам */}
          <div className="mt-4 rounded-xl border-2 border-blue-500 bg-white dark:bg-slate-900 dark:border-blue-700 shadow-md overflow-hidden">
            <div className="bg-blue-600 dark:bg-blue-700 px-5 py-3 text-white">
              <h3 className="text-base font-bold flex items-center gap-2">
                🧮 Калькулятор ФОТ по нормам времени
              </h3>
              <p className="text-xs text-blue-100 mt-0.5">
                ФОТ = объём × норма_времени (чел.час/ед.) × ставка_часа (тг/ч)
              </p>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-3">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1.5">
                  Объём работ
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={calcQty}
                  onChange={(e) => setCalcQty(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-2 border-blue-300 dark:border-blue-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                />
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">единицы измерения</div>
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1.5">
                  Норма времени
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={calcTimeNorm}
                  onChange={(e) => setCalcTimeNorm(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-2 border-blue-300 dark:border-blue-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                />
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">чел.час / ед.</div>
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1.5">
                  Разряд исполнителя
                </label>
                <select
                  value={calcRank}
                  onChange={(e) => setCalcRank(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-lg border-2 border-blue-300 dark:border-blue-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                >
                  {TARIFFS.map((t) => (
                    <option key={t.rank} value={t.rank}>
                      {t.rank} разряд — {formatPrice(t.rateKzt)} тг/ч
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1.5">
                  Чел.часов всего
                </label>
                <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                  {(calcQtyN * calcTimeN).toLocaleString("ru-RU", { maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
            <div className="mx-5 mb-5 rounded-lg bg-gradient-to-r from-blue-50 to-slate-50 dark:from-blue-950/40 dark:to-slate-900/40 border border-blue-300 dark:border-blue-800 p-4">
              <div className="text-xs uppercase tracking-wide text-blue-700 dark:text-blue-300 font-semibold mb-1">
                ФОТ
              </div>
              <div className="text-2xl md:text-3xl font-bold text-blue-900 dark:text-blue-100">
                {calcQtyN.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} × {calcTimeN.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} × {formatPrice(calcRate)} ={" "}
                <span className="text-blue-700 dark:text-blue-300">{formatPrice(calcTotal)} тг</span>
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Без НР, СП, доплат за условия труда. Только тарифная заработная плата.
              </div>
            </div>
          </div>
        </section>

        {/* Раздел 3: Упражнения */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
            <span className="inline-block w-1.5 h-6 bg-blue-500 rounded"></span>
            Раздел 3: Расчёт ФОТ для бригады — 4 упражнения
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Решай в столбик, потом подставь ответ. Допуск ±2% (или ±10% / точное — указано отдельно).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {EXERCISES.map((ex, i) => {
              const userAns = answers[ex.id] ?? "";
              const isRevealed = !!revealed[ex.id];
              const correct = isRevealed && checkAnswer(userAns, ex);
              const wrong = isRevealed && !correct;
              const tolLabel = ex.exact || ex.tolerance === 0
                ? "точный ответ"
                : `допуск ±${(ex.tolerance * 100).toFixed(0)}%`;
              return (
                <div
                  key={ex.id}
                  className={`rounded-lg border-2 p-4 transition-colors ${
                    correct
                      ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-700"
                      : wrong
                      ? "border-red-400 bg-red-50 dark:bg-red-950/30 dark:border-red-700"
                      : "border-blue-300 bg-white dark:bg-slate-900 dark:border-blue-800"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-slate-900 dark:text-slate-100">
                      Упражнение {i + 1}: {ex.title}
                    </h3>
                    <span className="shrink-0 text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 font-medium">
                      {tolLabel}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300 mb-3 leading-relaxed">
                    {ex.question}
                  </p>
                  {ex.hint && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic mb-3">
                      💡 {ex.hint}
                    </p>
                  )}
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={userAns}
                      onChange={(e) =>
                        setAnswers((a) => ({ ...a, [ex.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !isRevealed) submitAnswer(ex.id);
                      }}
                      disabled={isRevealed}
                      placeholder="Ваш ответ..."
                      className="flex-1 px-3 py-2 rounded-lg border-2 border-blue-300 dark:border-blue-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-blue-500 disabled:opacity-70"
                    />
                    <span className="text-sm text-slate-500 dark:text-slate-400">{ex.unit}</span>
                    {!isRevealed ? (
                      <button
                        onClick={() => submitAnswer(ex.id)}
                        disabled={!userAns.trim()}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-40 transition-colors"
                      >
                        Проверить
                      </button>
                    ) : (
                      <button
                        onClick={() => resetExercise(ex.id)}
                        className="px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-lg transition-colors"
                      >
                        ↺
                      </button>
                    )}
                  </div>
                  {isRevealed && (
                    <div
                      className={`mt-3 rounded-lg p-3 text-sm leading-relaxed ${
                        correct
                          ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-200"
                          : "bg-red-100 dark:bg-red-900/40 text-red-900 dark:text-red-200"
                      }`}
                    >
                      <div className="font-bold mb-1">
                        {correct ? "✓ Верно" : `✗ Неверно (правильно: ${formatPrice(ex.expected)} ${ex.unit})`}
                      </div>
                      <div className="text-xs">{ex.solution}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Раздел 4: Сменность */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
            <span className="inline-block w-1.5 h-6 bg-blue-500 rounded"></span>
            Раздел 4: Сменность работ и простои
          </h2>
          <div className="rounded-lg border-2 border-blue-500 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-700 p-4">
            <ul className="space-y-2 text-sm text-blue-900 dark:text-blue-200">
              <li className="flex items-start gap-2">
                <span className="font-semibold shrink-0 w-56">Стандартная смена</span>
                <span>8 часов (5/2)</span>
              </li>
              <li className="flex items-start gap-2 pt-2 border-t border-blue-300/40 dark:border-blue-800/40">
                <span className="font-semibold shrink-0 w-56">Удлинённая смена</span>
                <span>12 часов с переработкой (оплата ×1.5 за переработанные часы)</span>
              </li>
              <li className="flex items-start gap-2 pt-2 border-t border-blue-300/40 dark:border-blue-800/40">
                <span className="font-semibold shrink-0 w-56">Двусменный режим</span>
                <span>Бригада сменяется — наиболее эффективен для непрерывных работ</span>
              </li>
              <li className="flex items-start gap-2 pt-2 border-t border-blue-300/40 dark:border-blue-800/40">
                <span className="font-semibold shrink-0 w-56">Трёхсменный режим</span>
                <span>Только в особых случаях (сжатые сроки, монолит, инж. сети под отключение)</span>
              </li>
              <li className="flex items-start gap-2 pt-2 border-t border-blue-300/40 dark:border-blue-800/40">
                <span className="font-semibold shrink-0 w-56">Простой по вине заказчика</span>
                <span>Оплата <span className="font-mono font-semibold">×0.66</span> от ставки</span>
              </li>
              <li className="flex items-start gap-2 pt-2 border-t border-blue-300/40 dark:border-blue-800/40">
                <span className="font-semibold shrink-0 w-56">Простой по погоде</span>
                <span>Оплата <span className="font-mono font-semibold">×0.50</span> от ставки</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Фактоид */}
        <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
          <div className="flex items-start gap-3 text-sm text-amber-900 dark:text-amber-200">
            <span className="text-2xl shrink-0">💡</span>
            <p>
              Реальные нормы выработки часто на <span className="font-semibold">20–30 % ниже нормативных</span> из-за погоды,
              простоев и несогласованности. Опытный сметчик закладывает резерв{" "}
              <span className="font-semibold">1.10–1.20</span> в график.
            </p>
          </div>
        </div>

        <div className="h-12" />
      </div>
    </div>
  );
}
