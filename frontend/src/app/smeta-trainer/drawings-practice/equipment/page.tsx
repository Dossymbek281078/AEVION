"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

/**
 * Эксплуатация машин и механизмов — стоимость машино-часа, нормы расхода ГСМ.
 * Учебная выборка по СНиР Сб.81, ССЦ РК, МДС 81-3.99.
 * Цены — ориентировочные на III квартал 2025 г. (г. Алматы).
 */

type EqCategory =
  | "earth"
  | "lifting"
  | "concrete"
  | "welding"
  | "roofing"
  | "electric"
  | "other";

interface Equipment {
  id: string;
  name: string;
  category: EqCategory;
  costPerHour: number; // тг/маш-час
  fuel: string;        // расход ГСМ или электроэнергии
  note: string;        // особенность
}

const CATEGORY_META: Record<EqCategory, { label: string; icon: string }> = {
  earth:    { label: "Землеройные",        icon: "🚜" },
  lifting:  { label: "Подъёмно-транспорт.", icon: "🏗" },
  concrete: { label: "Бетонные работы",     icon: "🔲" },
  welding:  { label: "Сварочные",           icon: "⚡" },
  roofing:  { label: "Кровельные",          icon: "🏠" },
  electric: { label: "Электрика и сети",    icon: "💡" },
  other:    { label: "Прочие",              icon: "🔧" },
};

const EQUIPMENT: Equipment[] = [
  // ── Землеройные ──
  { id: "ex-01", name: "Экскаватор Hyundai 220 (ёмкость 1.0 м³)", category: "earth",    costPerHour: 12500, fuel: "18-22 л/ч ДТ",            note: "Универсальный" },
  { id: "ex-02", name: "Экскаватор Cat 320 (1.2 м³)",             category: "earth",    costPerHour: 14800, fuel: "22-25 л/ч ДТ",            note: "Тяжёлые работы" },
  { id: "ex-03", name: "Бульдозер Komatsu D65 (180 л.с.)",         category: "earth",    costPerHour: 11500, fuel: "25-30 л/ч ДТ",            note: "Планировка" },
  { id: "ex-04", name: "Самосвал MAN TGS 28 т",                    category: "earth",    costPerHour: 8500,  fuel: "35-40 л/ч ДТ + 350 тг/км", note: "+ сдельная оплата" },
  { id: "ex-05", name: "Грейдер ДЗ-122",                           category: "earth",    costPerHour: 9800,  fuel: "18-22 л/ч ДТ",            note: "Дороги" },
  { id: "ex-06", name: "Каток виброкаток HAMM (12 т)",             category: "earth",    costPerHour: 7200,  fuel: "12-15 л/ч ДТ",            note: "Уплотнение" },
  // ── Подъёмно-транспортные ──
  { id: "lf-01", name: "Кран башенный КБ-403А (8 т)",              category: "lifting",  costPerHour: 18500, fuel: "35-40 кВт·ч",             note: "+ монтаж/демонтаж" },
  { id: "lf-02", name: "Кран башенный Liebherr 280 EC-H",          category: "lifting",  costPerHour: 28000, fuel: "50-60 кВт·ч",             note: "Высокие здания" },
  { id: "lf-03", name: "Кран автомобильный КС-55 (25 т)",          category: "lifting",  costPerHour: 15800, fuel: "18-20 л/ч ДТ",            note: "Мобильный" },
  { id: "lf-04", name: "Подъёмник мачтовый MMG-1000",              category: "lifting",  costPerHour: 6500,  fuel: "8-10 кВт·ч",              note: "Перевозка раствора" },
  { id: "lf-05", name: "Бетононасос Putzmeister BSF-43",           category: "lifting",  costPerHour: 22500, fuel: "35-40 л/ч ДТ",            note: "Высота >50 м" },
  // ── Бетонные работы ──
  { id: "bt-01", name: "Бетоносмеситель СБ-95 (250 л)",            category: "concrete", costPerHour: 1800,  fuel: "3-4 кВт·ч",               note: "Малые объёмы" },
  { id: "bt-02", name: "Автобетоносмеситель Schwing 6 м³",          category: "concrete", costPerHour: 8800,  fuel: "25-30 л/ч ДТ + сдельная", note: "Доставка с завода" },
  { id: "bt-03", name: "Виброуплотнитель ИВ-95",                   category: "concrete", costPerHour: 850,   fuel: "0.6 кВт·ч",               note: "Для бетона" },
  // ── Сварочные ──
  { id: "wd-01", name: "Сварочный аппарат стац. (380 В)",          category: "welding",  costPerHour: 1200,  fuel: "4-6 кВт·ч",               note: "+ электроды" },
  { id: "wd-02", name: "Полуавтомат сварочный",                     category: "welding",  costPerHour: 1800,  fuel: "6-8 кВт·ч + газ",         note: "Качественные швы" },
  // ── Кровельные ──
  { id: "rf-01", name: "Газовая горелка проф.",                    category: "roofing",  costPerHour: 850,   fuel: "1.5-2 кг газа/час",       note: "Наплавление" },
  { id: "rf-02", name: "Подъёмник для кровли (мачта)",              category: "roofing",  costPerHour: 4200,  fuel: "5-7 кВт·ч",               note: "+ ручной подъём" },
  // ── Электрика и сети ──
  { id: "el-01", name: "Кабелеукладчик гидравлический",             category: "electric", costPerHour: 8500,  fuel: "12-15 л/ч ДТ",            note: "Только большие объёмы" },
  { id: "el-02", name: "Виброплита Wacker WP1540 (90 кг)",          category: "electric", costPerHour: 2200,  fuel: "1.5-2 л/ч АИ",            note: "Для траншей" },
  // ── Прочие ──
  { id: "ot-01", name: "Компрессор передвижной 5 м³/мин",          category: "other",    costPerHour: 3800,  fuel: "8-10 л/ч ДТ",             note: "Пневмо-инструмент" },
  { id: "ot-02", name: "Окрасочный аппарат безвоздушный",           category: "other",    costPerHour: 1200,  fuel: "2-3 кВт·ч",               note: "Большие объёмы краски" },
  { id: "ot-03", name: "Леса инвентарные (за 100 м² за день)",      category: "other",    costPerHour: 5800,  fuel: "—",                        note: "Аренда" },
  { id: "ot-04", name: "Перфоратор Bosch GBH 11DE",                 category: "other",    costPerHour: 380,   fuel: "1.5 кВт·ч",               note: "Бурение" },
];

interface FuelPrice {
  name: string;
  unit: string;
  priceKzt: number;
}

const FUEL_PRICES: FuelPrice[] = [
  { name: "Дизельное топливо ДТ-Л",        unit: "л",     priceKzt: 290 },
  { name: "Бензин АИ-95",                   unit: "л",     priceKzt: 280 },
  { name: "Газ сжиженный (баллон)",         unit: "кг",    priceKzt: 350 },
  { name: "Электроэнергия (тариф 1)",       unit: "кВт·ч", priceKzt: 28  },
  { name: "Электроэнергия (тариф 2 — пром.)", unit: "кВт·ч", priceKzt: 22 },
  { name: "Газ магистральный",              unit: "м³",    priceKzt: 95  },
];

function fmt(n: number): string {
  return n.toLocaleString("ru-RU");
}

function check(input: string, expected: number, tolerance = 0.02): boolean {
  const v = parseFloat(input.replace(",", "."));
  if (isNaN(v) || expected === 0) return false;
  return Math.abs((v - expected) / expected) <= tolerance;
}

interface Exercise {
  id: string;
  title: string;
  description: string;
  fields: { id: string; label: string; expected: number; unit: string }[];
  tolerance: number;
  explanation: string;
}

const EXERCISES: Exercise[] = [
  {
    id: "ex1",
    title: "Стоимость работы экскаватора за смену",
    description:
      "Hyundai 220, маш-час 12 500 тг, смена 8 часов с КИВ = 0.85 (коэф. использования времени). Найди стоимость работы за смену.",
    fields: [
      { id: "cost", label: "Стоимость за смену, тг", expected: 85000, unit: "тг" },
    ],
    tolerance: 0.02,
    explanation:
      "Эфф. часов = 8 × 0.85 = 6.8 ч. Стоимость = 6.8 × 12 500 = 85 000 тг. КИВ учитывает простои, перебазирование, ТО.",
  },
  {
    id: "ex2",
    title: "Расход дизтоплива на разработку котлована",
    description:
      "Котлован 1 380 м³, экскаватор с ковшом 1 м³, удельный расход 0.20 л/м³. Найди расход дизтоплива и его стоимость при цене 290 тг/л.",
    fields: [
      { id: "fuel", label: "Расход топлива, л", expected: 276, unit: "л" },
      { id: "cost", label: "Стоимость топлива, тг", expected: 80040, unit: "тг" },
    ],
    tolerance: 0.02,
    explanation:
      "Расход = 1 380 × 0.20 = 276 л. Стоимость = 276 × 290 = 80 040 тг. Это только ГСМ, без амортизации, з/п и накладных.",
  },
  {
    id: "ex3",
    title: "Машино-часы на бетонирование",
    description:
      "Объём бетона 100 м³, производительность бетононасоса Putzmeister 25 м³/час. Маш-час насоса 22 500 тг. Найди необходимые маш-часы и стоимость работы насоса.",
    fields: [
      { id: "mh",   label: "Маш-часов",         expected: 4,     unit: "ч" },
      { id: "cost", label: "Стоимость насоса, тг", expected: 90000, unit: "тг" },
    ],
    tolerance: 0.02,
    explanation:
      "Маш-часы = 100 / 25 = 4 ч. Стоимость = 4 × 22 500 = 90 000 тг. К этому добавляются: подача авто-бетоносмесителями, разгрузка, выравнивание.",
  },
  {
    id: "ex4",
    title: "Аренда башенного крана на месяц",
    description:
      "КБ-403А, маш-час 18 500 тг. Месяц: 22 рабочих дня × 8 часов × КИВ = 0.7. Монтаж/демонтаж крана — 850 000 тг (один раз). Найди эфф. часы, стоимость работы и общую стоимость с монтажом.",
    fields: [
      { id: "hrs",   label: "Эфф. часов за месяц",   expected: 123.2,   unit: "ч" },
      { id: "work",  label: "Стоимость работы, тг",   expected: 2279200, unit: "тг" },
      { id: "total", label: "Итого с монтажом, тг",   expected: 3129200, unit: "тг" },
    ],
    tolerance: 0.05,
    explanation:
      "Часы = 22 × 8 × 0.7 = 123.2 ч. Работа = 123.2 × 18 500 ≈ 2 279 200 тг. Итого = 2 279 200 + 850 000 = 3 129 200 тг. Монтаж/демонтаж — отдельная позиция в смете (КС-2).",
  },
];

export default function EquipmentPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<EqCategory | "all">("all");
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return EQUIPMENT.filter((e) => {
      if (activeCategory !== "all" && e.category !== activeCategory) return false;
      if (!q) return true;
      const hay = `${e.name} ${e.fuel} ${e.note}`.toLowerCase();
      return hay.includes(q);
    });
  }, [search, activeCategory]);

  function setInput(k: string, v: string) {
    setInputs((p) => ({ ...p, [k]: v }));
  }

  function checkExercise(ex: Exercise) {
    setRevealed((r) => ({ ...r, [ex.id]: true }));
  }

  function resetExercise(ex: Exercise) {
    setRevealed((r) => ({ ...r, [ex.id]: false }));
    const cleared = { ...inputs };
    ex.fields.forEach((f) => {
      delete cleared[`${ex.id}-${f.id}`];
    });
    setInputs(cleared);
  }

  function exerciseCorrect(ex: Exercise): boolean {
    return ex.fields.every((f) =>
      check(inputs[`${ex.id}-${f.id}`] ?? "", f.expected, ex.tolerance)
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-amber-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Header bar */}
      <div className="border-b border-orange-200 dark:border-orange-900/40 bg-white/80 dark:bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-sm text-orange-700 hover:text-orange-900 dark:text-orange-300 dark:hover:text-orange-100 font-medium flex items-center gap-1"
          >
            <span>←</span>
            <span>К разделам</span>
          </Link>
          <div className="text-xs text-slate-500 dark:text-slate-400 ml-auto">
            СНиР Сб.81 · ССЦ РК · МДС 81-3.99 · учебная выборка
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Title */}
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          🚜 Эксплуатация машин — стоимость машино-часа, нормы расхода
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          Калькуляция эксплуатации строительной техники: амортизация, ремонт, ГСМ, з/п машиниста, накладные.
        </p>

        {/* Нормативный блок */}
        <div className="mb-6 rounded-lg border-2 border-orange-500 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-700 p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">📚</span>
            <div className="space-y-2 text-sm text-orange-900 dark:text-orange-200">
              <p className="font-semibold">Нормативная база — эксплуатация машин и механизмов</p>
              <ul className="list-disc list-inside space-y-1 ml-1">
                <li><span className="font-semibold">СНиР Сб.81</span> — Сметные нормы расходов на эксплуатацию машин и механизмов</li>
                <li><span className="font-semibold">ССЦ РК</span> — Сборник цен на эксплуатацию строительных машин</li>
                <li><span className="font-semibold">МДС 81-3.99</span> — Методические указания по определению стоимости маш-часа</li>
              </ul>
              <p className="pt-2 border-t border-orange-300/50 dark:border-orange-800/50 text-orange-800 dark:text-orange-300/90">
                <span className="font-semibold">Стоимость маш-часа</span> = амортизация + ремонт + ГСМ + зарплата машиниста + накладные
              </p>
            </div>
          </div>
        </div>

        {/* ── Раздел 1: Состав стоимости 1 маш-часа ── */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-3">
            1. Состав стоимости 1 маш-часа
          </h2>
          <div className="rounded-lg border-2 border-orange-300 dark:border-orange-800 bg-white dark:bg-slate-900 p-5">
            <div className="font-mono text-sm text-orange-800 dark:text-orange-300 mb-4 bg-orange-50 dark:bg-orange-950/40 rounded p-3 border border-orange-200 dark:border-orange-900">
              <div className="font-bold mb-2">ФОРМУЛА: Сэксп = А + Р + З + Г + Н</div>
              <div className="text-xs text-orange-900 dark:text-orange-200">где компоненты — см. ниже</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="rounded border border-orange-200 dark:border-orange-900 bg-orange-50/40 dark:bg-orange-950/20 p-3">
                <div className="font-semibold text-orange-800 dark:text-orange-300">А — амортизация</div>
                <div className="text-slate-700 dark:text-slate-300 text-xs mt-1">
                  0.25-0.40% от цены машины × кол-во часов работы
                </div>
              </div>
              <div className="rounded border border-orange-200 dark:border-orange-900 bg-orange-50/40 dark:bg-orange-950/20 p-3">
                <div className="font-semibold text-orange-800 dark:text-orange-300">Р — ремонт + ТО</div>
                <div className="text-slate-700 dark:text-slate-300 text-xs mt-1">
                  0.20-0.30 от амортизации (А)
                </div>
              </div>
              <div className="rounded border border-orange-200 dark:border-orange-900 bg-orange-50/40 dark:bg-orange-950/20 p-3">
                <div className="font-semibold text-orange-800 dark:text-orange-300">З — зарплата машиниста</div>
                <div className="text-slate-700 dark:text-slate-300 text-xs mt-1">
                  1 чел/час × разряд (по ТКС РК)
                </div>
              </div>
              <div className="rounded border border-orange-200 dark:border-orange-900 bg-orange-50/40 dark:bg-orange-950/20 p-3">
                <div className="font-semibold text-orange-800 dark:text-orange-300">Г — ГСМ</div>
                <div className="text-slate-700 dark:text-slate-300 text-xs mt-1">
                  расход топлива/энергии × цена единицы
                </div>
              </div>
              <div className="md:col-span-2 rounded border border-orange-200 dark:border-orange-900 bg-orange-50/40 dark:bg-orange-950/20 p-3">
                <div className="font-semibold text-orange-800 dark:text-orange-300">Н — накладные расходы</div>
                <div className="text-slate-700 dark:text-slate-300 text-xs mt-1">
                  60-80% от ФОТ машиниста (страхование машины, гараж, ИТР, перебазирование)
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Раздел 2: Стоимость маш-часа — типовые машины ── */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-3">
            2. Стоимость маш-часа — типовые машины
          </h2>

          {/* Поиск + категории */}
          <div className="mb-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔎 Поиск машины (название, расход, особенность)..."
              className="w-full px-4 py-2.5 rounded-lg border-2 border-orange-300 dark:border-orange-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-orange-500 dark:focus:border-orange-500 transition-colors"
            />
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              onClick={() => setActiveCategory("all")}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                activeCategory === "all"
                  ? "bg-orange-600 text-white border-orange-600 dark:bg-orange-500 dark:border-orange-500"
                  : "bg-white text-slate-700 border-slate-300 hover:border-orange-400 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700 dark:hover:border-orange-600"
              }`}
            >
              Все ({EQUIPMENT.length})
            </button>
            {(Object.keys(CATEGORY_META) as EqCategory[]).map((cat) => {
              const meta = CATEGORY_META[cat];
              const count = EQUIPMENT.filter((e) => e.category === cat).length;
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    isActive
                      ? "bg-orange-600 text-white border-orange-600 dark:bg-orange-500 dark:border-orange-500"
                      : "bg-white text-slate-700 border-slate-300 hover:border-orange-400 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700 dark:hover:border-orange-600"
                  }`}
                >
                  <span className="mr-1">{meta.icon}</span>
                  {meta.label} ({count})
                </button>
              );
            })}
            <span className="ml-auto text-xs text-slate-500 dark:text-slate-400 self-center">
              Найдено: <span className="font-semibold text-orange-700 dark:text-orange-300">{filtered.length}</span> поз.
            </span>
          </div>

          {/* Таблица */}
          <div className="overflow-x-auto rounded-lg border border-orange-200 dark:border-orange-900 bg-white dark:bg-slate-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-orange-100 dark:bg-orange-950/40 text-orange-900 dark:text-orange-200">
                  <th className="text-left px-3 py-2 font-semibold">Машина</th>
                  <th className="text-right px-3 py-2 font-semibold whitespace-nowrap">Маш-час, тг</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Расход топл./эл</th>
                  <th className="text-left px-3 py-2 font-semibold">Особенность</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-slate-500 dark:text-slate-400">
                      Ничего не найдено. Измените запрос или сбросьте фильтр.
                    </td>
                  </tr>
                ) : (
                  filtered.flatMap((e, idx) => {
                    const meta = CATEGORY_META[e.category];
                    const prevCat = idx > 0 ? filtered[idx - 1].category : null;
                    const showHeader = e.category !== prevCat;
                    const rows = [];
                    if (showHeader) {
                      rows.push(
                        <tr key={`hdr-${e.category}`} className="bg-orange-50/60 dark:bg-orange-950/20">
                          <td colSpan={4} className="px-3 py-1.5 text-xs font-bold text-orange-800 dark:text-orange-300 uppercase tracking-wide">
                            {meta.icon} {meta.label}
                          </td>
                        </tr>
                      );
                    }
                    rows.push(
                      <tr
                        key={e.id}
                        className="border-t border-orange-100 dark:border-orange-900/40 hover:bg-orange-50/40 dark:hover:bg-orange-950/20"
                      >
                        <td className="px-3 py-2 text-slate-900 dark:text-slate-200">{e.name}</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-orange-700 dark:text-orange-300 whitespace-nowrap">
                          {fmt(e.costPerHour)}
                        </td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-300 text-xs whitespace-nowrap">{e.fuel}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400 text-xs">{e.note}</td>
                      </tr>
                    );
                    return rows;
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Раздел 3: Цены на топливо и энергоносители ── */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-3">
            3. Цены на топливо и энергоносители (актуально 2025 г.)
          </h2>
          <div className="overflow-x-auto rounded-lg border border-orange-200 dark:border-orange-900 bg-white dark:bg-slate-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-orange-100 dark:bg-orange-950/40 text-orange-900 dark:text-orange-200">
                  <th className="text-left px-3 py-2 font-semibold">Топливо/Энергия</th>
                  <th className="text-left px-3 py-2 font-semibold w-24">Ед.</th>
                  <th className="text-right px-3 py-2 font-semibold w-32 whitespace-nowrap">Цена 2025, тг</th>
                </tr>
              </thead>
              <tbody>
                {FUEL_PRICES.map((f) => (
                  <tr key={f.name} className="border-t border-orange-100 dark:border-orange-900/40">
                    <td className="px-3 py-2 text-slate-900 dark:text-slate-200">{f.name}</td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{f.unit}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-orange-700 dark:text-orange-300">
                      {fmt(f.priceKzt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Раздел 4: Интерактивные упражнения ── */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-3">
            4. Интерактивные упражнения
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Введи ответ в каждое поле и нажми «Проверить». Допуск ±2-5%.
          </p>

          <div className="space-y-4">
            {EXERCISES.map((ex, idx) => {
              const isRevealed = revealed[ex.id] === true;
              const isCorrect = isRevealed && exerciseCorrect(ex);
              const isWrong = isRevealed && !isCorrect;
              return (
                <div
                  key={ex.id}
                  className={`rounded-lg border-2 p-4 transition-colors ${
                    isCorrect
                      ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-700"
                      : isWrong
                      ? "border-red-400 bg-red-50 dark:bg-red-950/20 dark:border-red-700"
                      : "border-orange-300 bg-white dark:bg-slate-900 dark:border-orange-800"
                  }`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <span className="shrink-0 px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300 text-xs font-bold">
                      Упр. {idx + 1}
                    </span>
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                        {ex.title}
                      </h3>
                      <p className="text-sm text-slate-700 dark:text-slate-300">
                        {ex.description}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                    {ex.fields.map((f) => {
                      const k = `${ex.id}-${f.id}`;
                      const fieldOk =
                        isRevealed && check(inputs[k] ?? "", f.expected, ex.tolerance);
                      const fieldBad = isRevealed && !fieldOk;
                      return (
                        <div key={f.id}>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1.5">
                            {f.label}
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={inputs[k] ?? ""}
                              onChange={(e) => setInput(k, e.target.value)}
                              disabled={isRevealed && isCorrect}
                              placeholder="Число..."
                              className={`w-full px-3 py-2 rounded-md border-2 font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none transition-colors ${
                                fieldOk
                                  ? "border-emerald-400 dark:border-emerald-600"
                                  : fieldBad
                                  ? "border-red-400 dark:border-red-600"
                                  : "border-orange-300 dark:border-orange-800 focus:border-orange-500"
                              }`}
                            />
                            {isRevealed && (
                              <span
                                className={`absolute right-2 top-1/2 -translate-y-1/2 text-lg ${
                                  fieldOk
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-red-600 dark:text-red-400"
                                }`}
                              >
                                {fieldOk ? "✓" : "✗"}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {isRevealed && (
                    <div
                      className={`text-sm rounded-md p-3 mb-3 ${
                        isCorrect
                          ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-200"
                          : "bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-200"
                      }`}
                    >
                      <span className="font-semibold">
                        {isCorrect ? "✓ Верно. " : "✗ Не совсем. "}
                      </span>
                      {ex.explanation}
                    </div>
                  )}

                  <div className="flex gap-2">
                    {!isRevealed ? (
                      <button
                        onClick={() => checkExercise(ex)}
                        className="px-4 py-2 rounded-md bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 text-white text-sm font-semibold transition-colors"
                      >
                        Проверить
                      </button>
                    ) : (
                      <button
                        onClick={() => resetExercise(ex)}
                        className="px-4 py-2 rounded-md bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm font-semibold transition-colors"
                      >
                        Попробовать снова
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Фактоид */}
        <div className="mt-8 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
          <div className="flex items-start gap-3 text-sm text-amber-900 dark:text-amber-200">
            <span className="text-2xl shrink-0">💡</span>
            <p>
              <span className="font-semibold">КИВ (коэффициент использования времени)</span> —{" "}
              0.65-0.85 в зависимости от организации работ. Без правильного КИВ смета на 15-20%{" "}
              превысит реальные затраты — заказчик найдёт это при проверке и срежет.
            </p>
          </div>
        </div>

        {/* Footer space */}
        <div className="h-12" />
      </div>
    </div>
  );
}
