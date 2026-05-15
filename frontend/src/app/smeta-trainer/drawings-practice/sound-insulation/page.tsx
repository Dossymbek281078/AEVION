"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * Звукоизоляция — стены, перекрытия, окна.
 * Источники: СН РК 4.04-22-2002 · ГОСТ 27296-2012 · СНиП РК 5.05-101 · СН РК 4.04-21
 */

// ── Хелпер проверки числового ответа с допуском ──────────────────────────────
function check(input: string, answers: string[], tol: number) {
  const v = parseFloat(input.replace(",", "."));
  return answers.some((x) => {
    const e = parseFloat(x.replace(",", "."));
    if (isNaN(v) || isNaN(e)) return false;
    if (tol === 0) return Math.abs(v - e) < 1e-6;
    return Math.abs((v - e) / e) <= tol;
  });
}

// ── Раздел 1: Индекс изоляции воздушного шума Rw ─────────────────────────────
type RwRow = {
  construction: string;
  thickness: string;
  rw: number;
  use: string;
  warn?: boolean;
};

const RW_TABLE: RwRow[] = [
  { construction: "Кирпич полнотелый 250 мм", thickness: "250 мм", rw: 50, use: "Норма для межквартирных стен" },
  { construction: "Кирпич 380 мм", thickness: "380 мм", rw: 55, use: "Несущие наружные" },
  { construction: "Газобетон D500 200 мм", thickness: "200 мм", rw: 36, use: "НЕДОСТАТОЧНО для межквартирных!", warn: true },
  { construction: "Газобетон D500 300 мм", thickness: "300 мм", rw: 41, use: "Едва достаточно", warn: true },
  { construction: "Газобетон D500 400 мм", thickness: "400 мм", rw: 46, use: "Норма для несущих наружных" },
  { construction: "Гипсокартонная перегородка 2×ГКЛ + 50 мм минвата", thickness: "100 мм", rw: 47, use: "Между офисами" },
  { construction: "Гипсокартонная перегородка 4×ГКЛ + 100 мм минвата", thickness: "150 мм", rw: 56, use: "Профессиональная (звукозапись)" },
  { construction: "Монолитный ж/б 200 мм", thickness: "200 мм", rw: 51, use: "Межэтажные перекрытия" },
  { construction: "Сэндвич-панель PUR 100 мм", thickness: "100 мм", rw: 28, use: "Промышленные", warn: true },
];

// ── Раздел 2: Нормативные требования по типам помещений ──────────────────────
type NormRow = {
  room: string;
  rwMin: string;
};

const NORM_TABLE: NormRow[] = [
  { room: "Между квартирами в жилом доме", rwMin: "≥ 52 dB" },
  { room: "Между классами в школе", rwMin: "≥ 50 dB" },
  { room: "Между офисами в БЦ", rwMin: "≥ 45 dB" },
  { room: "Между палатами в больнице", rwMin: "≥ 50 dB" },
  { room: "Перегородка в гостинице (3 звезды)", rwMin: "≥ 48 dB" },
  { room: "Перегородка в гостинице (5 звёзд)", rwMin: "≥ 55 dB" },
];

// ── Раздел 3: Решения по типам конструкций ───────────────────────────────────
type SolutionGroup = {
  title: string;
  subtitle: string;
  items: { name: string; gain: string }[];
};

const SOLUTIONS: SolutionGroup[] = [
  {
    title: "Стены кирпичные тонкие",
    subtitle: "Rw < 50",
    items: [
      { name: "+ Гипсокартон с минватой 50 мм на каркасе", gain: "+6–10 dB" },
      { name: "+ Двойная стена с воздушной полостью", gain: "+8–12 dB" },
    ],
  },
  {
    title: "Перекрытия монолитные",
    subtitle: "Rw < 52 для квартирных",
    items: [
      { name: "+ Плавающая стяжка (минвата 30 мм + стяжка 50 мм)", gain: "+5–8 dB" },
      { name: "+ Подвесной потолок ГКЛ + минвата 100 мм", gain: "+6–10 dB" },
    ],
  },
  {
    title: "Окна",
    subtitle: "стеклопакеты по уровню Rw",
    items: [
      { name: "Однокамерный 4-12-4", gain: "26 dB (мало)" },
      { name: "Двухкамерный 4-10-4-10-4", gain: "31 dB" },
      { name: "Двухкамерный с триплексом", gain: "38–42 dB (премиум)" },
    ],
  },
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
    title: "Упражнение 1. Достаточна ли стена газобетон D500 300 мм для межквартирной?",
    task:
      "Имеется стена из газобетона D500 толщиной 300 мм. Используется как межквартирная " +
      "в жилом доме. Введите разницу между фактическим и требуемым Rw, dB " +
      "(если стена не дотягивает — введите отрицательное число или модуль).",
    label: "Разница Rw, dB",
    unit: "dB",
    answers: ["-11", "11"],
    tol: 0,
    formula:
      "Rw газобетон D500 300 мм = 41 dB; Требуемое для межквартирной = 52 dB; Разница = 41 − 52 = −11 dB",
    comment:
      "НЕ ДОСТАТОЧНО. По СН РК 4.04-22-2002 межквартирные стены должны иметь Rw ≥ 52 dB. Требуется дополнительная звукоизоляция.",
  },
  {
    id: "ex2",
    title: "Упражнение 2. Стоимость доп. звукоизоляции 1 м² для соответствия 52 dB",
    task:
      "На газобетон 300 мм (Rw = 41 dB) нужно добавить звукоизоляцию для достижения 52 dB. " +
      "Решение: 2×ГКЛ + 100 мм минвата на каркасе (даёт +11 dB и более). " +
      "Стоимость материала + работы: введите стоимость в тг за 1 м².",
    label: "Стоимость, тг/м²",
    unit: "тг/м²",
    answers: ["4500"],
    tol: 0.10,
    formula:
      "Гипсокартон + 50 мм минвата = +8 dB, нужно ещё +3 dB → удвоить ГКЛ или толще минвата 100 мм. Готовое решение: 2×ГКЛ + 100 мм минвата = 4500 тг/м² с работой.",
    comment:
      "На стене 30 м² (типовая комната): 30 · 4500 = 135 000 тг. Допуск ±10%.",
  },
  {
    id: "ex3",
    title: "Упражнение 3. Стоимость улучшения звукоизоляции ВСЕХ межквартирных стен в 9-эт. жилом доме",
    task:
      "В 9-этажном доме 36 квартир, в каждой средняя площадь межквартирных стен — 80 м². " +
      "Нужно дополнительно звукоизолировать все межквартирные стены. " +
      "Стоимость работ + материалов: 4500 тг/м². Введите итоговую стоимость, тг.",
    label: "Итого, тг",
    unit: "тг",
    answers: ["12960000"],
    tol: 0.10,
    formula:
      "S = 36 · 80 = 2880 м²; С = 2880 · 4500 = 12 960 000 тг",
    comment:
      "Допуск ±10%. На этапе проектирования закладывать сразу — переделка после жалоб обойдётся в 5–10 раз дороже.",
  },
  {
    id: "ex4",
    title: "Упражнение 4. Какое окно использовать в спальне (звукоизоляция от шумной улицы)",
    task:
      "Уличный шум 75 dB, нормативный уровень в спальне ≤ 45 dB → требуемая звукоизоляция окна 30 dB. " +
      "Из таблицы окон выбрать минимально подходящее по Rw. Введите Rw выбранного окна, dB.",
    label: "Rw окна, dB",
    unit: "dB",
    answers: ["38", "42"],
    tol: 0,
    formula:
      "Однокамерный 4-12-4: 26 dB → НЕДОСТАТОЧНО; Двухкамерный 4-10-4-10-4: 31 dB → почти, но мало (запас 1 dB); Двухкамерный с триплексом: 38–42 dB → ДОСТАТОЧНО.",
    comment:
      "Двухкамерный с триплексом — единственный гарантированно проходит норматив с запасом. Однокамерный годится только для тихих улиц.",
  },
];

// ── Карточка упражнения ──────────────────────────────────────────────────────
function ExerciseCard({ ex }: { ex: Exercise }) {
  const [val, setVal] = useState("");
  const [rev, setRev] = useState(false);
  const ok = rev && check(val, ex.answers, ex.tol);
  const err = rev && !ok;

  return (
    <div className="border-2 border-violet-200 dark:border-violet-800 bg-white dark:bg-slate-900 rounded-xl p-4">
      <h3 className="text-sm font-bold text-violet-900 dark:text-violet-200 mb-1.5">{ex.title}</h3>
      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mb-3">{ex.task}</p>

      <div
        className={`border-2 rounded-lg p-3 ${
          ok
            ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20"
            : err
            ? "border-red-300 bg-red-50 dark:bg-red-900/20"
            : "border-violet-200 dark:border-violet-700 bg-violet-50/50 dark:bg-violet-900/10"
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
            className="flex-1 border border-violet-300 dark:border-violet-700 rounded px-2 py-1.5 text-sm font-mono bg-white dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <span className="self-center text-xs text-slate-500 dark:text-slate-400 font-mono">
            {ex.unit}
          </span>
          {!rev && (
            <button
              onClick={() => setRev(true)}
              disabled={!val.trim()}
              className="px-3 py-1.5 bg-violet-600 text-white text-xs font-semibold rounded hover:bg-violet-700 disabled:opacity-40"
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
export default function SoundInsulationPage() {
  const [rwFilter, setRwFilter] = useState("");

  const rwFiltered = RW_TABLE.filter((r) =>
    r.construction.toLowerCase().includes(rwFilter.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-violet-50/30 dark:bg-slate-950">
      {/* ── Header bar ───────────────────────────────────────────────────── */}
      <header className="bg-violet-700 text-white border-b-4 border-violet-900">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-xs text-violet-100 hover:text-white whitespace-nowrap"
          >
            ← К разделам
          </Link>
          <div className="flex-1">
            <h1 className="text-sm md:text-base font-bold">
              🔇 Звукоизоляция — стены, перекрытия, окна
            </h1>
            <p className="text-[10px] md:text-xs text-violet-200">
              СН РК 4.04-22-2002 · ГОСТ 27296-2012 · СНиП РК 5.05-101 · СН РК 4.04-21
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* ── Введение ───────────────────────────────────────────────────── */}
        <section className="bg-white dark:bg-slate-900 border-l-4 border-violet-500 dark:border-violet-600 rounded-r-xl p-4 shadow-sm">
          <h2 className="text-base font-bold text-violet-800 dark:text-violet-300 mb-2">
            🔇 ЗВУКОИЗОЛЯЦИЯ — критично для:
          </h2>
          <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-1 leading-relaxed list-disc list-inside">
            <li>Жилых зданий (СН РК 4.04-22 — нормы по этажам и квартирам)</li>
            <li>Гостиниц</li>
            <li>Школ (между классами)</li>
            <li>Офисов (между переговорными)</li>
            <li>Театров, кинотеатров, концертных залов</li>
          </ul>
          <p className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded p-2 text-[13px] text-slate-700 dark:text-slate-300 mt-3 leading-relaxed">
            ⚠ Без правильной звукоизоляции — жалобы, штрафы Сан.Эпид.надзора,
            снижение цены продажи квартир.
          </p>
        </section>

        {/* ── Нормативный блок ───────────────────────────────────────────── */}
        <section className="bg-white dark:bg-slate-900 border border-violet-200 dark:border-violet-800 rounded-xl p-4">
          <h2 className="text-sm font-bold text-violet-800 dark:text-violet-300 mb-3">
            📚 НОРМАТИВНАЯ БАЗА
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded p-2">
              <div className="font-bold text-violet-900 dark:text-violet-200">
                СН РК 4.04-22-2002
              </div>
              <div className="text-slate-600 dark:text-slate-400">
                «Защита от шума»
              </div>
            </div>
            <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded p-2">
              <div className="font-bold text-violet-900 dark:text-violet-200">
                ГОСТ 27296-2012
              </div>
              <div className="text-slate-600 dark:text-slate-400">
                Защита от шума. Звукоизоляция
              </div>
            </div>
            <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded p-2">
              <div className="font-bold text-violet-900 dark:text-violet-200">
                СНиП РК 5.05-101
              </div>
              <div className="text-slate-600 dark:text-slate-400">
                Стены, кладка
              </div>
            </div>
            <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded p-2">
              <div className="font-bold text-violet-900 dark:text-violet-200">
                СН РК 4.04-21
              </div>
              <div className="text-slate-600 dark:text-slate-400">
                «Шум на рабочих местах»
              </div>
            </div>
          </div>
        </section>

        {/* ── Раздел 1: Индекс Rw ────────────────────────────────────────── */}
        <section className="bg-white dark:bg-slate-900 border border-violet-200 dark:border-violet-800 rounded-xl p-4">
          <h2 className="text-base font-bold text-violet-800 dark:text-violet-300 mb-1">
            Раздел 1. Индекс изоляции воздушного шума Rw (dB)
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3 italic">
            Чем выше Rw — тем лучше конструкция гасит воздушный шум. Норма для жилья — 52 dB.
          </p>

          <div className="flex flex-wrap gap-2 mb-3">
            <input
              type="text"
              value={rwFilter}
              onChange={(e) => setRwFilter(e.target.value)}
              placeholder="🔍 Фильтр по конструкции..."
              className="flex-1 min-w-[180px] border border-violet-300 dark:border-violet-700 rounded px-2 py-1 text-xs bg-white dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-violet-100 dark:bg-violet-900/40 text-violet-900 dark:text-violet-200">
                  <th className="border border-violet-300 dark:border-violet-700 px-2 py-1.5 text-left">
                    Конструкция
                  </th>
                  <th className="border border-violet-300 dark:border-violet-700 px-2 py-1.5">
                    Толщина
                  </th>
                  <th className="border border-violet-300 dark:border-violet-700 px-2 py-1.5">
                    Rw, dB
                  </th>
                  <th className="border border-violet-300 dark:border-violet-700 px-2 py-1.5 text-left">
                    Применение
                  </th>
                </tr>
              </thead>
              <tbody>
                {rwFiltered.map((r, i) => (
                  <tr
                    key={r.construction}
                    className={
                      r.warn
                        ? "bg-amber-50 dark:bg-amber-900/20"
                        : i % 2 === 0
                        ? "bg-white dark:bg-slate-900"
                        : "bg-slate-50 dark:bg-slate-800/50"
                    }
                  >
                    <td className="border border-violet-200 dark:border-violet-800 px-2 py-1 text-slate-800 dark:text-slate-200">
                      {r.construction}
                    </td>
                    <td className="border border-violet-200 dark:border-violet-800 px-2 py-1 text-center font-mono text-slate-700 dark:text-slate-300">
                      {r.thickness}
                    </td>
                    <td className="border border-violet-200 dark:border-violet-800 px-2 py-1 text-center font-mono font-bold text-violet-800 dark:text-violet-200">
                      {r.rw}
                    </td>
                    <td className="border border-violet-200 dark:border-violet-800 px-2 py-1 text-slate-600 dark:text-slate-400">
                      {r.use}
                    </td>
                  </tr>
                ))}
                {rwFiltered.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="border border-violet-200 dark:border-violet-800 px-2 py-3 text-center text-slate-500 italic"
                    >
                      Нет конструкций по фильтру
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Раздел 2: Нормативные требования ───────────────────────────── */}
        <section className="bg-white dark:bg-slate-900 border border-violet-200 dark:border-violet-800 rounded-xl p-4">
          <h2 className="text-base font-bold text-violet-800 dark:text-violet-300 mb-1">
            Раздел 2. Нормативные требования к Rw
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3 italic">
            СН РК 4.04-22-2002 — минимально допустимые значения Rw для разных типов помещений.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-violet-100 dark:bg-violet-900/40 text-violet-900 dark:text-violet-200">
                  <th className="border border-violet-300 dark:border-violet-700 px-2 py-1.5 text-left">
                    Тип помещения
                  </th>
                  <th className="border border-violet-300 dark:border-violet-700 px-2 py-1.5">
                    Требуемое Rw
                  </th>
                </tr>
              </thead>
              <tbody>
                {NORM_TABLE.map((n, i) => (
                  <tr
                    key={n.room}
                    className={
                      i % 2 === 0
                        ? "bg-white dark:bg-slate-900"
                        : "bg-slate-50 dark:bg-slate-800/50"
                    }
                  >
                    <td className="border border-violet-200 dark:border-violet-800 px-2 py-1 text-slate-800 dark:text-slate-200">
                      {n.room}
                    </td>
                    <td className="border border-violet-200 dark:border-violet-800 px-2 py-1 text-center font-mono font-bold text-violet-800 dark:text-violet-200">
                      {n.rwMin}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Раздел 3: Решения ──────────────────────────────────────────── */}
        <section className="bg-white dark:bg-slate-900 border border-violet-200 dark:border-violet-800 rounded-xl p-4">
          <h2 className="text-base font-bold text-violet-800 dark:text-violet-300 mb-3">
            Раздел 3. Решения — что улучшить
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {SOLUTIONS.map((g) => (
              <div
                key={g.title}
                className="bg-gradient-to-br from-violet-50 to-fuchsia-50 dark:from-violet-950/30 dark:to-fuchsia-950/30 border border-violet-300 dark:border-violet-700 rounded-lg p-3"
              >
                <div className="text-sm font-bold text-violet-900 dark:text-violet-200">
                  {g.title}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 italic mb-2">
                  ({g.subtitle})
                </div>
                <ul className="space-y-1.5">
                  {g.items.map((it) => (
                    <li
                      key={it.name}
                      className="text-[12px] bg-white/70 dark:bg-slate-900/70 border border-violet-200 dark:border-violet-800 rounded p-2"
                    >
                      <div className="text-slate-800 dark:text-slate-200 leading-snug">
                        {it.name}
                      </div>
                      <div className="font-mono font-bold text-violet-700 dark:text-violet-300 mt-1">
                        {it.gain}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ── Раздел 4: Упражнения ───────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-base font-bold text-violet-800 dark:text-violet-300">
            Раздел 4. Интерактивные упражнения
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 italic -mt-2">
            Решите 4 задачи на расчёт звукоизоляции и подбор конструкций.
          </p>
          {EXERCISES.map((ex) => (
            <ExerciseCard key={ex.id} ex={ex} />
          ))}
        </section>

        {/* ── Раздел 5: Расценки ЭСН ─────────────────────────────────────── */}
        <section className="bg-white dark:bg-slate-900 border border-violet-200 dark:border-violet-800 rounded-xl p-4">
          <h2 className="text-base font-bold text-violet-800 dark:text-violet-300 mb-3">
            Раздел 5. Расценки ЭСН для звукоизоляционных работ
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
            <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded p-2">
              <div className="font-bold text-violet-900 dark:text-violet-200 font-mono">
                ЭСН Сб.13-3-x
              </div>
              <div className="text-slate-600 dark:text-slate-400">
                «Звукоизоляция перегородок»
              </div>
            </div>
            <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded p-2">
              <div className="font-bold text-violet-900 dark:text-violet-200 font-mono">
                ЭСН Сб.13-4-x
              </div>
              <div className="text-slate-600 dark:text-slate-400">
                «Плавающие стяжки»
              </div>
            </div>
            <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded p-2">
              <div className="font-bold text-violet-900 dark:text-violet-200 font-mono">
                ЭСН Сб.10-1-x
              </div>
              <div className="text-slate-600 dark:text-slate-400">
                «Окна со звукоизоляцией» (премиум-класс)
              </div>
            </div>
          </div>
        </section>

        {/* ── Фактоид ─────────────────────────────────────────────────────── */}
        <section className="bg-violet-100 dark:bg-violet-900/30 border-l-4 border-violet-600 dark:border-violet-500 rounded-r-xl p-4">
          <div className="text-sm font-bold text-violet-900 dark:text-violet-200 mb-1.5">
            💡 ВАЖНО
          </div>
          <p className="text-sm text-violet-900 dark:text-violet-100 leading-relaxed">
            Звукоизоляция — самый незаметный, но критичный параметр жилья. По жалобам соседей
            застройщик обязан <b>ПЕРЕДЕЛАТЬ за свой счёт</b> (по СН РК 4.04-22). Заранее
            правильная конструкция в смете дешевле в <b>5–10 раз</b> чем переделка.
          </p>
        </section>

        {/* ── Footer nav ─────────────────────────────────────────────────── */}
        <div className="flex justify-between pt-4 pb-8">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-xs text-violet-700 dark:text-violet-300 hover:underline"
          >
            ← К разделам
          </Link>
          <Link
            href="/smeta-trainer/drawings-practice/thermal-calc"
            className="text-xs text-violet-700 dark:text-violet-300 hover:underline"
          >
            🌡 Теплотехника →
          </Link>
        </div>
      </div>
    </div>
  );
}
