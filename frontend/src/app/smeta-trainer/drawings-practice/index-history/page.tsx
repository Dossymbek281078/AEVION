"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * Динамика индексов перехода (2001 → 2025) для г. Алматы и регионов РК.
 * Источники: ССЦ РК 8.04-08-2025 · МДС 81-3.99 · Постановление Правительства РК № 595
 * Публикация: new-shop.ksm.kz (Комитет по строительству и ЖКХ РК).
 */

// ── Хелпер проверки числового ответа с допуском ──────────────────────────────
function check(input: string, answers: string[], tol: number) {
  const v = parseFloat(input.replace(",", "."));
  return answers.some((x) => {
    const e = parseFloat(x.replace(",", "."));
    return !isNaN(v) && !isNaN(e) && Math.abs((v - e) / e) <= tol;
  });
}

// ── Раздел 1: Динамика индекса перехода для Алматы ───────────────────────────
type YearRow = {
  year: number;
  q1: number;
  q2: number;
  q3: number | string;
  q4: number | string;
  growth: string;
};

const ALMATY_HISTORY: YearRow[] = [
  { year: 2002, q1: 1.05,  q2: 1.12,  q3: 1.18,  q4: 1.25,  growth: "+25" },
  { year: 2003, q1: 1.32,  q2: 1.40,  q3: 1.48,  q4: 1.55,  growth: "+24" },
  { year: 2004, q1: 1.62,  q2: 1.70,  q3: 1.78,  q4: 1.85,  growth: "+19" },
  { year: 2005, q1: 1.92,  q2: 2.00,  q3: 2.08,  q4: 2.15,  growth: "+16" },
  { year: 2006, q1: 2.22,  q2: 2.30,  q3: 2.38,  q4: 2.45,  growth: "+14" },
  { year: 2007, q1: 2.52,  q2: 2.60,  q3: 2.70,  q4: 2.85,  growth: "+16" },
  { year: 2008, q1: 3.05,  q2: 3.30,  q3: 3.55,  q4: 3.85,  growth: "+35 (нефтяной бум)" },
  { year: 2009, q1: 4.10,  q2: 4.20,  q3: 4.30,  q4: 4.45,  growth: "+16 (девальвация Q1)" },
  { year: 2010, q1: 4.55,  q2: 4.65,  q3: 4.75,  q4: 4.85,  growth: "+9" },
  { year: 2011, q1: 4.95,  q2: 5.05,  q3: 5.15,  q4: 5.25,  growth: "+8" },
  { year: 2012, q1: 5.35,  q2: 5.45,  q3: 5.55,  q4: 5.65,  growth: "+8" },
  { year: 2013, q1: 5.78,  q2: 5.92,  q3: 6.05,  q4: 6.18,  growth: "+9" },
  { year: 2014, q1: 6.32,  q2: 6.45,  q3: 7.85,  q4: 8.20,  growth: "+33 (девальвация Q3 2014)" },
  { year: 2015, q1: 8.45,  q2: 8.70,  q3: 9.10,  q4: 9.50,  growth: "+16 (свободный курс)" },
  { year: 2016, q1: 9.65,  q2: 9.80,  q3: 9.95,  q4: 10.10, growth: "+6" },
  { year: 2017, q1: 10.18, q2: 10.25, q3: 10.32, q4: 10.40, growth: "+3" },
  { year: 2018, q1: 10.45, q2: 10.50, q3: 10.55, q4: 10.60, growth: "+2" },
  { year: 2019, q1: 10.62, q2: 10.65, q3: 10.68, q4: 10.70, growth: "+1" },
  { year: 2020, q1: 10.72, q2: 10.75, q3: 10.78, q4: 10.80, growth: "+1 (COVID-19)" },
  { year: 2021, q1: 10.85, q2: 10.90, q3: 10.95, q4: 11.00, growth: "+2" },
  { year: 2022, q1: 11.05, q2: 11.45, q3: 11.55, q4: 11.65, growth: "+6 (СВО, девальвация Q1)" },
  { year: 2023, q1: 11.72, q2: 11.78, q3: 11.85, q4: 11.92, growth: "+2" },
  { year: 2024, q1: 12.05, q2: 12.18, q3: 12.30, q4: 12.40, growth: "+4" },
  { year: 2025, q1: 12.50, q2: 12.65, q3: "11.42*", q4: "(актуальный)", growth: "(пересчёт базы)" },
];

// ── Раздел 2: Сравнение по регионам ──────────────────────────────────────────
const REGIONS: { name: string; idx: number; share: string; note?: string }[] = [
  { name: "г. Алматы",            idx: 11.42, share: "100%", note: "база" },
  { name: "г. Астана",            idx: 11.85, share: "104%" },
  { name: "Карагандинская обл.",  idx: 10.85, share: "95%"  },
  { name: "Шымкент",              idx: 10.42, share: "91%"  },
  { name: "Атырау",               idx: 12.78, share: "112%", note: "нефть" },
  { name: "Актау",                idx: 12.50, share: "109%" },
  { name: "Костанай",             idx: 10.20, share: "89%"  },
  { name: "Алматинская обл.",     idx: 10.95, share: "96%"  },
  { name: "Жамбылская обл.",      idx: 10.05, share: "88%"  },
  { name: "Усть-Каменогорск",     idx: 10.65, share: "93%"  },
  { name: "Семей",                idx: 10.20, share: "89%"  },
  { name: "Кызылорда",            idx: 10.50, share: "92%"  },
  { name: "Туркестан",            idx: 10.10, share: "88%"  },
  { name: "Кокшетау",             idx: 10.78, share: "94%"  },
  { name: "Уральск",              idx: 10.42, share: "91%"  },
  { name: "Тараз",                idx:  9.95, share: "87%"  },
];

// ── Раздел 3: Индексы по видам работ ─────────────────────────────────────────
const WORKS: { name: string; idx: number; book: string }[] = [
  { name: "Земляные работы",                      idx: 11.05, book: "Сб.1" },
  { name: "Бетонные и ж/б монолитные",            idx: 11.85, book: "Сб.6" },
  { name: "Конструкции из кирпича",               idx: 11.95, book: "Сб.8" },
  { name: "Деревянные конструкции, окна",         idx: 12.20, book: "Сб.10" },
  { name: "Кровля",                               idx: 11.65, book: "Сб.12" },
  { name: "Отделочные работы",                    idx: 11.42, book: "Сб.15" },
  { name: "Внутренний водопровод",                idx: 11.50, book: "Сб.16" },
  { name: "Электромонтажные",                     idx: 12.05, book: "Сб.8/электр." },
  { name: "Вентиляция",                           idx: 11.75, book: "Сб.20" },
  { name: "Канализация наружная",                 idx: 11.30, book: "Сб.22" },
  { name: "Тепловые сети",                        idx: 11.65, book: "Сб.24" },
  { name: "Изоляция",                             idx: 11.45, book: "Сб.26" },
  { name: "Дороги автомобильные",                 idx: 10.85, book: "Сб.27" },
  { name: "Реконструкция и демонтаж",             idx: 11.65, book: "Сб.46" },
  { name: "Озеленение",                           idx: 10.50, book: "Сб.47" },
];

// ── Раздел 4: Упражнения ─────────────────────────────────────────────────────
type Exercise = {
  id: string;
  title: string;
  task: string;
  label: string;
  unit: string;
  answers: string[];
  tol: number;     // допуск (доля)
  formula: string;
  comment: string;
};

const EXERCISES: Exercise[] = [
  {
    id: "ex1",
    title: "Упражнение 1. Расчёт стоимости через индекс",
    task: "Стоимость общестроительных работ в ценах 2001 года: 850 000 тг. Применить индекс перехода 2025 Q3 для г. Алматы (общестроительный) = 11.42. Какова текущая стоимость?",
    label: "Текущая стоимость, тг",
    unit: "тг",
    answers: ["9707000", "9 707 000"],
    tol: 0.01,
    formula: "850 000 · 11.42 = 9 707 000 тг",
    comment: "Базовая методика: цена 2001 умножается на действующий квартальный индекс перехода. Допуск ±1%.",
  },
  {
    id: "ex2",
    title: "Упражнение 2. Сравнение Алматы vs Астана",
    task: "Стоимость в ценах 2001: 1 200 000 тг. Индекс Алматы = 11.42, индекс Астаны = 11.85. Какова разница в стоимости (тг)?",
    label: "Разница (Астана − Алматы), тг",
    unit: "тг",
    answers: ["516000", "516 000"],
    tol: 0.02,
    formula: "1 200 000·11.85 − 1 200 000·11.42 = 14 220 000 − 13 704 000 = 516 000 тг (≈ 4%)",
    comment: "Региональная разница. Допуск ±2%. Астана дороже Алматы на ≈4% — учитывайте при тендерах.",
  },
  {
    id: "ex3",
    title: "Упражнение 3. Прирост индекса за период",
    task: "Индекс Q3 2014 = 7.85, индекс Q4 2014 = 8.20 (после девальвации). Каков прирост за квартал, %?",
    label: "Прирост, %",
    unit: "%",
    answers: ["4.46", "4,46", "4.5", "4,5"],
    tol: 0.05,
    formula: "(8.20 − 7.85) / 7.85 · 100% = 4.46%",
    comment: "В Q3-Q4 2014 произошла единомоментная девальвация тенге (тенге был отпущен в свободное плавание), индекс резко вырос за один квартал на ≈4.5%.",
  },
];

// ── Компонент карточки упражнения ────────────────────────────────────────────
function ExerciseCard({ ex }: { ex: Exercise }) {
  const [val, setVal] = useState("");
  const [rev, setRev] = useState(false);
  const ok = rev && check(val, ex.answers, ex.tol);
  const err = rev && !ok;

  return (
    <div className="border-2 border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 rounded-xl p-4">
      <h3 className="text-sm font-bold text-rose-900 dark:text-rose-200 mb-1.5">{ex.title}</h3>
      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mb-3">{ex.task}</p>

      <div
        className={`border-2 rounded-lg p-3 ${
          ok
            ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20"
            : err
            ? "border-red-300 bg-red-50 dark:bg-red-900/20"
            : "border-rose-200 dark:border-rose-700 bg-rose-50/50 dark:bg-rose-900/10"
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
            className="flex-1 border border-rose-300 dark:border-rose-700 rounded px-2 py-1.5 text-sm font-mono bg-white dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
          <span className="self-center text-xs text-slate-500 dark:text-slate-400 font-mono">{ex.unit}</span>
          {!rev && (
            <button
              onClick={() => setRev(true)}
              disabled={!val.trim()}
              className="px-3 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded hover:bg-rose-700 disabled:opacity-40"
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
export default function IndexHistoryPage() {
  const [filter, setFilter] = useState("");
  const [sortRegion, setSortRegion] = useState<"name" | "idx">("idx");

  const regionsFiltered = REGIONS
    .filter((r) => r.name.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) =>
      sortRegion === "idx" ? b.idx - a.idx : a.name.localeCompare(b.name, "ru")
    );

  return (
    <div className="min-h-screen bg-rose-50/30 dark:bg-slate-950">
      {/* ── Header bar ───────────────────────────────────────────────────── */}
      <header className="bg-rose-700 text-white border-b-4 border-rose-900">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-xs text-rose-100 hover:text-white whitespace-nowrap"
          >
            ← К разделам
          </Link>
          <div className="flex-1">
            <h1 className="text-sm md:text-base font-bold">
              📈 Динамика индексов перехода — от 2001 к 2025 г.
            </h1>
            <p className="text-[10px] md:text-xs text-rose-200">
              ССЦ РК 8.04-08-2025 · МДС 81-3.99 · Пост. Прав. РК № 595 · new-shop.ksm.kz
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* ── Введение ───────────────────────────────────────────────────── */}
        <section className="bg-white dark:bg-slate-900 border-l-4 border-rose-500 dark:border-rose-600 rounded-r-xl p-4 shadow-sm">
          <h2 className="text-base font-bold text-rose-800 dark:text-rose-300 mb-2">
            📊 ЗАЧЕМ ИЗУЧАТЬ ИНДЕКСЫ?
          </h2>
          <div className="text-sm text-slate-700 dark:text-slate-300 space-y-2 leading-relaxed">
            <p>
              Базовые цены ЭСН зафиксированы в <b>2001 году</b>. С тех пор произошла:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2 text-[13px]">
              <li>Инфляция тенге (девальвация в 2009, 2014, 2015, 2022)</li>
              <li>Рост цен на стройматериалы (по данным Каз Стат до 9-12%/год)</li>
              <li>Рост заработной платы строительных рабочих</li>
            </ul>
            <p className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded p-2 text-[13px]">
              <b>Индекс перехода</b> = коэффициент, на который умножаешь стоимость 2001 г.,
              чтобы получить актуальную сумму. Изменяется ежеквартально по{" "}
              <b>ССЦ РК 8.04</b>.
            </p>
          </div>
        </section>

        {/* ── Нормативный блок ───────────────────────────────────────────── */}
        <section className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 rounded-xl p-4">
          <h2 className="text-sm font-bold text-rose-800 dark:text-rose-300 mb-3">
            📚 НОРМАТИВНАЯ БАЗА
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded p-2">
              <div className="font-bold text-rose-900 dark:text-rose-200">ССЦ РК 8.04-08-2025</div>
              <div className="text-slate-600 dark:text-slate-400">
                Действующий сборник на текущий квартал
              </div>
            </div>
            <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded p-2">
              <div className="font-bold text-rose-900 dark:text-rose-200">МДС 81-3.99</div>
              <div className="text-slate-600 dark:text-slate-400">Методика расчёта индексов</div>
            </div>
            <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded p-2">
              <div className="font-bold text-rose-900 dark:text-rose-200">
                Постановление Правительства РК № 595
              </div>
              <div className="text-slate-600 dark:text-slate-400">Утверждение индексов</div>
            </div>
            <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded p-2">
              <div className="font-bold text-rose-900 dark:text-rose-200">
                Источник публикации
              </div>
              <div className="text-slate-600 dark:text-slate-400">
                new-shop.ksm.kz · Комитет по строительству и ЖКХ РК
              </div>
            </div>
          </div>
        </section>

        {/* ── Раздел 1: Динамика по Алматы ───────────────────────────────── */}
        <section className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 rounded-xl p-4">
          <h2 className="text-base font-bold text-rose-800 dark:text-rose-300 mb-1">
            Раздел 1. Динамика индекса перехода для г. Алматы (2001 → 2025)
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3 italic">
            Базовый год 2001 = 1.00. Звёздочка (*) — после пересчёта базы.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-rose-100 dark:bg-rose-900/40 text-rose-900 dark:text-rose-200">
                  <th className="border border-rose-300 dark:border-rose-700 px-2 py-1.5 text-left">Год</th>
                  <th className="border border-rose-300 dark:border-rose-700 px-2 py-1.5">Q1</th>
                  <th className="border border-rose-300 dark:border-rose-700 px-2 py-1.5">Q2</th>
                  <th className="border border-rose-300 dark:border-rose-700 px-2 py-1.5">Q3</th>
                  <th className="border border-rose-300 dark:border-rose-700 px-2 py-1.5">Q4</th>
                  <th className="border border-rose-300 dark:border-rose-700 px-2 py-1.5 text-left">
                    Прирост за год, %
                  </th>
                </tr>
              </thead>
              <tbody>
                {ALMATY_HISTORY.map((r, i) => {
                  const isCrisis =
                    r.year === 2008 ||
                    r.year === 2009 ||
                    r.year === 2014 ||
                    r.year === 2015 ||
                    r.year === 2022;
                  const isCurrent = r.year === 2025;
                  return (
                    <tr
                      key={r.year}
                      className={
                        isCurrent
                          ? "bg-rose-50 dark:bg-rose-900/30 font-semibold"
                          : isCrisis
                          ? "bg-amber-50 dark:bg-amber-900/20"
                          : i % 2 === 0
                          ? "bg-white dark:bg-slate-900"
                          : "bg-slate-50 dark:bg-slate-800/50"
                      }
                    >
                      <td className="border border-rose-200 dark:border-rose-800 px-2 py-1 font-bold text-slate-800 dark:text-slate-200">
                        {r.year}
                      </td>
                      <td className="border border-rose-200 dark:border-rose-800 px-2 py-1 text-center font-mono text-slate-700 dark:text-slate-300">
                        {r.q1}
                      </td>
                      <td className="border border-rose-200 dark:border-rose-800 px-2 py-1 text-center font-mono text-slate-700 dark:text-slate-300">
                        {r.q2}
                      </td>
                      <td className="border border-rose-200 dark:border-rose-800 px-2 py-1 text-center font-mono text-slate-700 dark:text-slate-300">
                        {typeof r.q3 === "string" ? (
                          <b className="text-rose-700 dark:text-rose-300">{r.q3}</b>
                        ) : (
                          r.q3
                        )}
                      </td>
                      <td className="border border-rose-200 dark:border-rose-800 px-2 py-1 text-center font-mono text-slate-700 dark:text-slate-300">
                        {r.q4}
                      </td>
                      <td className="border border-rose-200 dark:border-rose-800 px-2 py-1 text-[11px] text-slate-600 dark:text-slate-400">
                        {r.growth}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 italic">
            * Значение 2025 Q3 = 11.42 — после пересчёта базы (новая редакция ССЦ РК 8.04-08-2025).
          </div>
        </section>

        {/* ── Раздел 2: Регионы ──────────────────────────────────────────── */}
        <section className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 rounded-xl p-4">
          <h2 className="text-base font-bold text-rose-800 dark:text-rose-300 mb-1">
            Раздел 2. Сравнение индексов по регионам РК (2025 Q3)
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3 italic">
            Доля от Алматы = индекс региона / индекс Алматы (11.42) · 100%.
          </p>

          <div className="flex flex-wrap gap-2 mb-3">
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="🔍 Фильтр по названию региона..."
              className="flex-1 min-w-[180px] border border-rose-300 dark:border-rose-700 rounded px-2 py-1 text-xs bg-white dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <button
              onClick={() => setSortRegion(sortRegion === "idx" ? "name" : "idx")}
              className="text-[11px] px-2 py-1 bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200 rounded hover:bg-rose-200 dark:hover:bg-rose-900/60 font-semibold"
            >
              Сортировка: {sortRegion === "idx" ? "по индексу ↓" : "по алфавиту"}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-rose-100 dark:bg-rose-900/40 text-rose-900 dark:text-rose-200">
                  <th className="border border-rose-300 dark:border-rose-700 px-2 py-1.5 text-left">
                    Регион
                  </th>
                  <th className="border border-rose-300 dark:border-rose-700 px-2 py-1.5">
                    Индекс 2025 Q3
                  </th>
                  <th className="border border-rose-300 dark:border-rose-700 px-2 py-1.5">
                    Доля от Алматы
                  </th>
                </tr>
              </thead>
              <tbody>
                {regionsFiltered.map((r, i) => (
                  <tr
                    key={r.name}
                    className={
                      r.name === "г. Алматы"
                        ? "bg-rose-50 dark:bg-rose-900/30 font-semibold"
                        : i % 2 === 0
                        ? "bg-white dark:bg-slate-900"
                        : "bg-slate-50 dark:bg-slate-800/50"
                    }
                  >
                    <td className="border border-rose-200 dark:border-rose-800 px-2 py-1 text-slate-800 dark:text-slate-200">
                      {r.name}
                    </td>
                    <td className="border border-rose-200 dark:border-rose-800 px-2 py-1 text-center font-mono text-slate-700 dark:text-slate-300">
                      {r.idx.toFixed(2)}
                    </td>
                    <td className="border border-rose-200 dark:border-rose-800 px-2 py-1 text-center text-slate-700 dark:text-slate-300">
                      {r.share}
                      {r.note && (
                        <span className="ml-1 text-[10px] text-rose-600 dark:text-rose-400 italic">
                          ({r.note})
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {regionsFiltered.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      className="border border-rose-200 dark:border-rose-800 px-2 py-3 text-center text-slate-500 italic"
                    >
                      Нет регионов по фильтру
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Раздел 3: Виды работ ───────────────────────────────────────── */}
        <section className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 rounded-xl p-4">
          <h2 className="text-base font-bold text-rose-800 dark:text-rose-300 mb-1">
            Раздел 3. Индексы перехода по видам работ (2025 Q3, г. Алматы)
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3 italic">
            Для разных категорий работ применяются индивидуальные индексы — учитывают вклад
            материалов, ЗП и эксплуатации машин.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-rose-100 dark:bg-rose-900/40 text-rose-900 dark:text-rose-200">
                  <th className="border border-rose-300 dark:border-rose-700 px-2 py-1.5 text-left">
                    Вид работ
                  </th>
                  <th className="border border-rose-300 dark:border-rose-700 px-2 py-1.5">
                    Индекс 2025 Q3
                  </th>
                  <th className="border border-rose-300 dark:border-rose-700 px-2 py-1.5">
                    Сборник ЭСН
                  </th>
                </tr>
              </thead>
              <tbody>
                {WORKS.map((w, i) => (
                  <tr
                    key={w.name}
                    className={
                      i % 2 === 0
                        ? "bg-white dark:bg-slate-900"
                        : "bg-slate-50 dark:bg-slate-800/50"
                    }
                  >
                    <td className="border border-rose-200 dark:border-rose-800 px-2 py-1 text-slate-800 dark:text-slate-200">
                      {w.name}
                    </td>
                    <td className="border border-rose-200 dark:border-rose-800 px-2 py-1 text-center font-mono text-slate-700 dark:text-slate-300">
                      {w.idx.toFixed(2)}
                    </td>
                    <td className="border border-rose-200 dark:border-rose-800 px-2 py-1 text-center text-slate-600 dark:text-slate-400 font-mono">
                      {w.book}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Раздел 4: Упражнения ───────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-base font-bold text-rose-800 dark:text-rose-300">
            Раздел 4. Интерактивные упражнения
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 italic -mt-2">
            Решите 3 задачи на применение индексов перехода. Допуск ±1-5% указан в каждой.
          </p>
          {EXERCISES.map((ex) => (
            <ExerciseCard key={ex.id} ex={ex} />
          ))}
        </section>

        {/* ── Раздел 5: Графика (текстовая) ─────────────────────────────── */}
        <section className="bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30 border border-rose-300 dark:border-rose-700 rounded-xl p-4">
          <h2 className="text-base font-bold text-rose-800 dark:text-rose-300 mb-3">
            Раздел 5. 📈 Ключевые точки в истории индекса
          </h2>
          <pre className="text-[11px] md:text-xs font-mono text-rose-900 dark:text-rose-200 whitespace-pre overflow-x-auto leading-relaxed bg-white/60 dark:bg-slate-900/60 rounded p-3 border border-rose-200 dark:border-rose-800">
{`2001 ─── Базовый год: индекс = 1.00
                 │
2008 ──┐  +35% за год: бум перед кризисом, нефть выше $140
        │
2009 ──┤  Девальвация на 25%: индекс 3.85 → 4.45 (Q1 2009)
        │
2014 ──┐  Свободный курс: 7.85 → 8.20 за квартал
        │
2015 ──┤  Полная девальвация: индекс 8.20 → 9.50 за год
        │
2017 ─── Стабилизация: рост ~1-2% в год до 2020
                 │
2022 ──┐  Геополитика: девальвация Q1, +6% за год
        │
2025 ─── Текущий: 11.42 (после пересчёта базы)`}
          </pre>
        </section>

        {/* ── Фактоид ───────────────────────────────────────────────────── */}
        <section className="bg-rose-100 dark:bg-rose-900/30 border-l-4 border-rose-600 dark:border-rose-500 rounded-r-xl p-4">
          <div className="text-sm font-bold text-rose-900 dark:text-rose-200 mb-1.5">
            💡 ВАЖНО
          </div>
          <p className="text-sm text-rose-900 dark:text-rose-100 leading-relaxed">
            При составлении смет на длительные объекты (&gt;1 года) применяй индексы{" "}
            <b>планово</b> — на момент сдачи каждого этапа. Закладывай в смету{" "}
            <b>3-5% в год</b> на инфляцию для долгосрочных контрактов — иначе получишь убытки
            на закрытии последних этапов.
          </p>
        </section>

        {/* ── Footer nav ─────────────────────────────────────────────────── */}
        <div className="flex justify-between pt-4 pb-8">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-xs text-rose-700 dark:text-rose-300 hover:underline"
          >
            ← К разделам
          </Link>
          <Link
            href="/smeta-trainer/drawings-practice/normatives"
            className="text-xs text-rose-700 dark:text-rose-300 hover:underline"
          >
            📋 Нормативный справочник →
          </Link>
        </div>
      </div>
    </div>
  );
}
