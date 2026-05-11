"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * Нормативный справочник для подсчёта объёмов земляных работ и сетей.
 * Источники:
 *  • СНиП РК 5.01-03-2002 «Земляные сооружения, основания и фундаменты»
 *  • ЭСН РК Сборник 1 «Земляные работы» (Общая часть)
 *  • СНиП РК 3.05.04-2002 «Наружные сети и сооружения водоснабжения и канализации»
 *  • МДС 81-25.2004 «Методика определения стоимости строительной продукции»
 *  • ГОСТ 25100-2011 «Грунты. Классификация»
 *  • СН РК 1.04-09-2002 «Организация строительного производства»
 */

type Section = "soils" | "slopes" | "loosen" | "trenches" | "workspace" | "rates";

const SECTIONS: { id: Section; icon: string; title: string; normRef: string }[] = [
  { id: "soils",     icon: "🪨", title: "Категории грунтов",            normRef: "ЭСН РК Сб.1 Общая часть, ГОСТ 25100" },
  { id: "slopes",    icon: "📐", title: "Крутизна откосов",             normRef: "СНиП РК 5.01-03-2002, Табл. 1" },
  { id: "loosen",    icon: "🔢", title: "Коэффициент разрыхления (Кр)", normRef: "ЭСН РК Сб.1 Табл. 1 Общая часть" },
  { id: "trenches",  icon: "🔗", title: "Ширина траншей под сети",      normRef: "СНиП РК 3.05.04-2002, п. 4.3, Табл. 6" },
  { id: "workspace", icon: "📏", title: "Рабочее пространство котлована", normRef: "МДС 81-25.2004, Прил. А; СН РК 1.04-09" },
  { id: "rates",     icon: "📋", title: "Какую расценку ЭСН применить", normRef: "ЭСН РК Сб.1 «Земляные работы»" },
];

// ── Данные нормативов ────────────────────────────────────────────────────────

const SOIL_CATEGORIES = [
  {
    cat: "I",
    color: "text-emerald-700 bg-emerald-50",
    label: "Лёгкие (I кат.)",
    soils: "Растительный слой без корней, торф лёгкий, лёгкий суглинок, рыхлый песок, пёсок кварцевый, гравий мелкий",
    mech: "Механизм: любой (Э-302, Э-2503...)",
    hand: "Ручная: лопатой, без предварительного рыхления",
    norm: "Расценки ЭСН РК Сб.1 §1-1-1 ... §1-1-9 (механизация), §1-2-1 (вручную)",
  },
  {
    cat: "II",
    color: "text-yellow-700 bg-yellow-50",
    label: "Средние (II кат.)",
    soils: "Суглинок с примесью, лёсс, супесь, гравий крупный, растительный слой с корнями, торф с кустарником",
    mech: "Механизм: экскаватор (ёмкость ≥0.4 м³), бульдозер",
    hand: "Ручная: лопатой с подборщиком, кирка",
    norm: "ЭСН РК Сб.1 §1-1-10 ... §1-1-22, §1-2-2",
  },
  {
    cat: "III",
    color: "text-orange-700 bg-orange-50",
    label: "Тяжёлые (III кат.)",
    soils: "Тяжёлый суглинок, глина средней плотности, плотный лёсс, галечниковый грунт, разжиженная глина",
    mech: "Механизм: мощный экскаватор (ёмкость ≥0.65 м³), рыхлитель",
    hand: "Ручная: кирко-мотыга, отбойный молоток",
    norm: "ЭСН РК Сб.1 §1-1-23 ... §1-1-31, §1-2-3",
  },
  {
    cat: "IV",
    color: "text-red-700 bg-red-50",
    label: "Очень тяжёлые (IV кат.)",
    soils: "Тяжёлая и жирная глина, плотный суглинок, мёрзлый грунт, сланцы мягкие, рыхлая скала",
    mech: "Механизм: рыхлитель + мощный экскаватор, взрывные работы (для скалы)",
    hand: "Ручная: только с механическим рыхлением (отбойный молоток, клин)",
    norm: "ЭСН РК Сб.1 §1-1-32 ... §1-1-40, §1-2-4; взрыв — Сб.2",
  },
];

const SLOPE_TABLE = [
  // [грунт, ≤1.5м (m:1), 1.5-3м, 3-5м]
  ["Насыпные (уплотнённые)",    "0:1  (вертик.)", "1:0.67", "1:1.00"],
  ["Песок, гравий, галька",      "1:0.50",          "1:1.00", "1:1.00"],
  ["Супесь",                     "1:0.25",          "1:0.67", "1:0.85"],
  ["Суглинок",                   "0:1  (вертик.)", "1:0.50", "1:0.75"],
  ["Глина (мягкая, пластичная)", "0:1  (вертик.)", "1:0.25", "1:0.50"],
  ["Глина (твёрдая)",            "0:1  (вертик.)", "1:0.25", "1:0.25"],
  ["Лёсс (непросадочный)",       "0:1  (вертик.)", "1:0.50", "1:0.50"],
  ["Мёрзлый грунт",              "0:1  (вертик.)", "0:1  ",  "1:0.25"],
];

const LOOSEN_TABLE = [
  // [грунт, Кр первонач., Кр остаточный]
  ["Песок, супесь", "1.10 – 1.15", "1.01 – 1.03"],
  ["Суглинок лёгкий", "1.12 – 1.18", "1.02 – 1.05"],
  ["Суглинок тяжёлый, глина мягкая", "1.18 – 1.24", "1.04 – 1.08"],
  ["Глина жирная, твёрдая", "1.24 – 1.30", "1.06 – 1.12"],
  ["Лёсс", "1.12 – 1.18", "1.02 – 1.05"],
  ["Гравийно-галечниковый", "1.15 – 1.20", "1.03 – 1.07"],
  ["Скала разрыхлённая", "1.30 – 1.45", "1.10 – 1.20"],
  ["Скала крепкая", "1.45 – 1.50", "1.20 – 1.30"],
];

const TRENCH_TABLE = [
  // [материал трубы, диаметр, ширина траншеи]
  ["Сталь, чугун, ж/б",    "Ø ≤ 200 мм",     "Ø + 0.5 м (мин. 0.7 м)"],
  ["Сталь, чугун",          "Ø 200 – 700 мм",  "Ø + 0.8 м"],
  ["Сталь, чугун",          "Ø 700 – 1500 мм", "Ø + 1.0 м"],
  ["Ж/б (раструбные)",      "Ø ≤ 700 мм",      "Ø + 1.2 м (мин. 0.9 м)"],
  ["Ж/б (раструбные)",      "Ø > 700 мм",      "Ø + 1.4 м"],
  ["ПВХ, ПЭ (напорные)",    "Ø ≤ 500 мм",      "Ø + 0.6 м"],
  ["ПВХ, ПЭ (безнапорные)", "Ø ≤ 500 мм",      "Ø + 0.5 м"],
  ["Кирпичные коллекторы",  "Прямоугольник a×b", "a + 1.0 – 1.4 м"],
];

const WORKSPACE_TABLE = [
  ["Экскаватор (без распорного крепления)",    "0.50 м от стенок котлована"],
  ["С трубопроводным распорным креплением",    "0.30 м от свободной стенки"],
  ["Монтаж ж/б фундаментов",                   "0.50 м от края конструкции"],
  ["Монтаж сборных плит перекрытий",           "0.60 м"],
  ["Монтаж стеновых панелей",                   "0.50 м"],
  ["Гидроизоляция фундаментов + опалубка",     "0.60 – 0.80 м (нормально)"],
  ["Укладка трубопровода в траншее",            "0.50 м от оси (мин. ширина по СНИП)"],
  ["Монолитные конструкции (опалубка обычная)","0.50 – 0.70 м (по проекту)"],
];

const ESN_RATES = [
  {
    code: "ЭСН 1-1-1 … 1-1-9",
    title: "Разработка грунта экскаватором (открытые котлованы, траншеи)",
    cond: "Любой грунт I–IV кат.; ёмкость ковша 0.15–5 м³; навымет и в отвал",
    unit: "1000 м³",
    note: "Выбирать по: кат. грунта + ёмкость ковша + тип работы (котлован/траншея)",
    color: "border-emerald-200 bg-emerald-50",
  },
  {
    code: "ЭСН 1-1-10 … 1-1-22",
    title: "Разработка грунта бульдозером",
    cond: "Перемещение грунта на расстояние до 40 м; планировка",
    unit: "1000 м³",
    note: "Для обратной засыпки с перемещением; перемещение свыше 40 м — §1-1-23",
    color: "border-blue-200 bg-blue-50",
  },
  {
    code: "ЭСН 1-1-30 … 1-1-40",
    title: "Разработка грунта скрепером",
    cond: "Выемка с перемещением 50–5000 м; II–IV кат.",
    unit: "1000 м³",
    note: "Для больших объёмов с перемещением; сравните с эксплуатацией экскаватор+самосвал",
    color: "border-purple-200 bg-purple-50",
  },
  {
    code: "ЭСН 1-1-50 … 1-1-60",
    title: "Разработка грунта вручную (лопата, кирка)",
    cond: "Доработка в котлованах и траншеях; ниши; подбивка",
    unit: "м³",
    note: "Ручной труд — только для доработки и зон, недоступных технике",
    color: "border-amber-200 bg-amber-50",
  },
  {
    code: "ЭСН 1-2-1 … 1-2-10",
    title: "Уплотнение грунта (обратная засыпка)",
    cond: "Виброплита, трамбовочная машина, каток; по слоям",
    unit: "1000 м³",
    note: "Обратная засыпка ≠ просто засыпать: СНиП требует уплотнение слоями",
    color: "border-slate-200 bg-slate-50",
  },
  {
    code: "ЭСН 1-1-70 … 1-1-80",
    title: "Рекультивация (планировка территории)",
    cond: "Бульдозер; срезка и насыпка; предварительное рыхление",
    unit: "га",
    note: "После завершения работ; дополнительная позиция при рекультивации",
    color: "border-teal-200 bg-teal-50",
  },
];

// ── Интерактивный калькулятор откосов ────────────────────────────────────────

const SLOPE_CALC_DATA: Record<string, Record<string, number>> = {
  "Суглинок":   { "≤1.5": 0, "≤3.0": 0.50, "≤5.0": 0.75 },
  "Глина мягкая": { "≤1.5": 0, "≤3.0": 0.25, "≤5.0": 0.50 },
  "Песок/Гравий": { "≤1.5": 0.50, "≤3.0": 1.00, "≤5.0": 1.00 },
  "Супесь":    { "≤1.5": 0.25, "≤3.0": 0.67, "≤5.0": 0.85 },
  "Лёсс":       { "≤1.5": 0, "≤3.0": 0.50, "≤5.0": 0.50 },
  "Насыпной":   { "≤1.5": 0, "≤3.0": 0.67, "≤5.0": 1.00 },
};

function SlopeCalc() {
  const [soil, setSoil] = useState("Суглинок");
  const [depth, setDepth] = useState(2.5);
  const depthKey = depth <= 1.5 ? "≤1.5" : depth <= 3.0 ? "≤3.0" : "≤5.0";
  const m = SLOPE_CALC_DATA[soil]?.[depthKey] ?? 0.5;
  const slopeOffset = m * depth;
  const slopeAngle = m > 0 ? Math.atan(1 / m) * 180 / Math.PI : 90;
  const widthIncrease = 2 * slopeOffset;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
      <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-2">
        🧮 Калькулятор откоса (СНиП РК 5.01-03-2002, Табл. 1)
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-slate-500 block mb-1">Грунт</label>
          <select value={soil} onChange={(e) => setSoil(e.target.value)}
            className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 rounded px-2 py-1.5 text-xs">
            {Object.keys(SLOPE_CALC_DATA).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-slate-500 block mb-1">Глубина h, м</label>
          <input type="number" min={0.5} max={5} step={0.1} value={depth}
            onChange={(e) => setDepth(parseFloat(e.target.value) || 2.5)}
            className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 rounded px-2 py-1.5 text-sm font-mono" />
        </div>
      </div>
      <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg p-3 text-xs space-y-1">
        <div className="font-bold text-indigo-800 dark:text-indigo-300">Результат:</div>
        <div>Коэффициент откоса: <span className="font-mono font-bold text-indigo-900 dark:text-indigo-200">m = {m}</span></div>
        <div>Откос с каждой стороны: <span className="font-mono font-bold">{slopeOffset.toFixed(2)} м</span></div>
        <div>Уширение по верху: <span className="font-mono font-bold">+{widthIncrease.toFixed(2)} м</span> (с двух сторон)</div>
        {m > 0 && <div>Угол откоса от вертикали: <span className="font-mono">{(90 - slopeAngle).toFixed(1)}°</span></div>}
        {m === 0 && <div className="text-emerald-700 dark:text-emerald-400">⚠ Вертикальная стенка — только при h ≤ 1.5 м и без подземных вод</div>}
      </div>
      <div className="text-[10px] text-slate-400 italic">
        Источник: СНиП РК 5.01-03-2002, Таблица 1. При наличии подземных вод или вибрации — применять более пологие откосы.
      </div>
    </div>
  );
}

// ── Калькулятор ширины траншеи ───────────────────────────────────────────────

function TrenchWidthCalc() {
  const [mat, setMat] = useState("Сталь/чугун");
  const [diam, setDiam] = useState(300);

  function calcWidth(material: string, d: number): string {
    if (material === "Сталь/чугун") {
      if (d <= 200) return `${d/1000 + 0.5} м (Ø + 0.5 м)`;
      if (d <= 700) return `${d/1000 + 0.8} м (Ø + 0.8 м)`;
      return `${d/1000 + 1.0} м (Ø + 1.0 м)`;
    }
    if (material === "Ж/б раструбный") {
      if (d <= 700) return `${d/1000 + 1.2} м (Ø + 1.2 м, мин. 0.9 м)`;
      return `${d/1000 + 1.4} м (Ø + 1.4 м)`;
    }
    if (material === "ПВХ/ПЭ напорный") return `${d/1000 + 0.6} м (Ø + 0.6 м)`;
    if (material === "ПВХ/ПЭ безнапорный") return `${d/1000 + 0.5} м (Ø + 0.5 м)`;
    return "—";
  }

  const width = calcWidth(mat, diam);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
      <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-2">
        🔗 Калькулятор ширины траншеи (СНиП РК 3.05.04-2002, п. 4.3)
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-slate-500 block mb-1">Материал трубы</label>
          <select value={mat} onChange={(e) => setMat(e.target.value)}
            className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 rounded px-2 py-1.5 text-xs">
            {["Сталь/чугун", "Ж/б раструбный", "ПВХ/ПЭ напорный", "ПВХ/ПЭ безнапорный"].map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-slate-500 block mb-1">Диаметр трубы Ø, мм</label>
          <input type="number" min={50} max={2000} step={50} value={diam}
            onChange={(e) => setDiam(parseInt(e.target.value) || 300)}
            className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 rounded px-2 py-1.5 text-sm font-mono" />
        </div>
      </div>
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 text-xs">
        <div className="font-bold text-blue-800 dark:text-blue-300">Нормативная ширина траншеи (по дну):</div>
        <div className="text-lg font-mono font-bold text-blue-900 dark:text-blue-200 mt-1">{width}</div>
        <div className="text-[10px] text-blue-600 dark:text-blue-400 mt-1">
          + рабочее пространство {mat.includes("ПВХ") ? "уже включено" : "— без крепления дополнительно не требуется"}
        </div>
      </div>
      <div className="text-[10px] text-slate-400 italic">
        Источник: СНиП РК 3.05.04-2002, пункт 4.3, Таблица 6. При наличии крепления траншеи — ширина увеличивается на 0.15 м.
      </div>
    </div>
  );
}

// ── Основная страница ─────────────────────────────────────────────────────────

export default function NormativesPage() {
  const [activeSection, setActiveSection] = useState<Section>("soils");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-slate-900 text-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link href="/smeta-trainer/drawings-practice/hub" className="text-xs text-slate-400 hover:text-white">← Все разделы</Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold">📋 Нормативная база — подсчёт объёмов земляных работ и сетей</h1>
            <p className="text-[10px] text-slate-400">СНиП РК 5.01-03-2002 · ЭСН РК Сб.1 · СНиП РК 3.05.04-2002 · МДС 81-25.2004</p>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-4">
        {/* Section tabs */}
        <div className="flex gap-1.5 flex-wrap mb-4">
          {SECTIONS.map((s) => (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
              className={`text-[11px] px-3 py-1.5 rounded-full font-semibold transition-colors ${
                activeSection === s.id
                  ? "bg-slate-900 text-white"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-400"
              }`}>
              {s.icon} {s.title}
            </button>
          ))}
        </div>

        <div className="text-[10px] text-slate-400 mb-3 italic">
          Источник: {SECTIONS.find(s => s.id === activeSection)?.normRef}
        </div>

        {/* ── Категории грунтов ─────────────────────────────────────────── */}
        {activeSection === "soils" && (
          <div className="space-y-3">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-300">
              ⚡ <strong>Ключевое правило:</strong> категория грунта определяет номер расценки ЭСН и время цикла экскаватора.
              Одни и те же работы в IV категории стоят в 2-3 раза дороже, чем в I категории.
            </div>
            {SOIL_CATEGORIES.map((c) => (
              <div key={c.cat} className={`border-2 rounded-xl p-4 ${c.color} border-current`}>
                <div className="flex items-baseline gap-3 mb-2">
                  <span className="text-2xl font-black">{c.cat}</span>
                  <h2 className="text-sm font-bold">{c.label}</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="font-semibold mb-1">Грунты:</div>
                    <div className="text-[11px] leading-relaxed">{c.soils}</div>
                  </div>
                  <div className="space-y-1">
                    <div><span className="font-semibold">Механизация:</span> <span className="text-[11px]">{c.mech}</span></div>
                    <div><span className="font-semibold">Вручную:</span> <span className="text-[11px]">{c.hand}</span></div>
                    <div className="mt-2 bg-white/60 rounded p-1.5 text-[10px] font-mono">{c.norm}</div>
                  </div>
                </div>
              </div>
            ))}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-xs">
              <div className="font-bold text-slate-700 dark:text-slate-300 mb-2">📌 Определение категории на практике</div>
              <ol className="list-decimal pl-5 space-y-1 text-slate-600 dark:text-slate-400">
                <li>Взять геотехнический отчёт (инженерно-геологические изыскания) — там категория указана явно</li>
                <li>Если отчёта нет — по визуальным признакам + лопата-тест: I/II — лопата входит без удара, III/IV — нужна кирка</li>
                <li>Коэффициент пористости и показатель текучести (IL) помогают уточнить по ГОСТ 25100</li>
                <li>В проекте организации строительства (ПОС) — раздел «Земляные работы» содержит категорию</li>
              </ol>
            </div>
          </div>
        )}

        {/* ── Крутизна откосов ─────────────────────────────────────────── */}
        {activeSection === "slopes" && (
          <div className="space-y-4">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3 text-xs text-red-800 dark:text-red-300">
              ⚠ <strong>Важно:</strong> без крепления допускаются только откосы по Табл. 1 ниже.
              При подземных водах, вибрации, нагрузках от техники — категорически нужен проект крепления (ЕН 1997, СП РК).
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800">
                    <th className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-left">Грунт</th>
                    <th className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-center">h ≤ 1.5 м</th>
                    <th className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-center">{"1.5 < h"} ≤ 3 м</th>
                    <th className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-center">{"3 < h"} ≤ 5 м</th>
                  </tr>
                </thead>
                <tbody>
                  {SLOPE_TABLE.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 font-medium">{row[0]}</td>
                      {[1, 2, 3].map((j) => (
                        <td key={j} className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center font-mono">
                          <span className={row[j] === "0:1  (вертик.)" ? "text-emerald-700 font-bold" : row[j].startsWith("1:1") ? "text-red-600" : "text-slate-700 dark:text-slate-300"}>
                            {row[j]}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-[10px] text-slate-500 italic">
              Формат m:1 — горизонтальное : вертикальное. m=0.5 означает: на 1м высоты — 0.5м горизонтального смещения.
              0:1 (вертик.) — вертикальная стенка без откоса.
            </div>
            <SlopeCalc />
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-xs">
              <div className="font-bold text-slate-700 dark:text-slate-300 mb-2">📐 Как использовать в расчёте</div>
              <div className="font-mono bg-slate-50 dark:bg-slate-800 rounded p-3 text-[11px] space-y-1">
                <div>Ширина котлована по верху = Ширина по дну + 2 × m × h</div>
                <div className="text-slate-500">Пример: дно 5.0м, h=2.5м, грунт суглинок (m=0.50)</div>
                <div className="text-indigo-700 dark:text-indigo-300">По верху = 5.0 + 2×0.50×2.5 = 5.0 + 2.5 = 7.5 м</div>
              </div>
            </div>
          </div>
        )}

        {/* ── Коэффициент разрыхления ───────────────────────────────────── */}
        {activeSection === "loosen" && (
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 text-xs text-blue-800 dark:text-blue-300">
              💡 <strong>Два Кр:</strong> первоначальный (сразу после разработки, для расчёта транспорта)
              и остаточный (после уплотнения, для обратной засыпки).
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800">
                    <th className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-left">Грунт</th>
                    <th className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-center">Кр первоначальный</th>
                    <th className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-center">Кр остаточный</th>
                    <th className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-center">Применение</th>
                  </tr>
                </thead>
                <tbody>
                  {LOOSEN_TABLE.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 font-medium">{row[0]}</td>
                      <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center font-mono text-amber-700 dark:text-amber-400">{row[1]}</td>
                      <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center font-mono text-blue-700 dark:text-blue-400">{row[2]}</td>
                      <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-[10px] text-slate-500">
                        {i < 5 ? "Перевозка: объём × Кр1" : "Взрыв: объём × Кр1"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 text-xs">
                <div className="font-bold text-amber-800 dark:text-amber-300 mb-2">📦 Кр первоначальный — для транспорта</div>
                <div className="font-mono bg-white/60 rounded p-2 text-[11px] space-y-1">
                  <div>Объём плотный: 361 м³ (котлован)</div>
                  <div>Вывоз: 361 × 1.20 = <span className="font-bold text-amber-900">433 м³</span> в кузове</div>
                  <div className="text-[10px] text-amber-700">Суглинок: Кр = 1.18-1.24, принимаем 1.20</div>
                </div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4 text-xs">
                <div className="font-bold text-blue-800 dark:text-blue-300 mb-2">🔙 Кр остаточный — для засыпки</div>
                <div className="font-mono bg-white/60 rounded p-2 text-[11px] space-y-1">
                  <div>Нужно уплотнить: 80 м³ (в плотном)</div>
                  <div>Объём подвозки: 80 × 1.06 = <span className="font-bold text-blue-900">84.8 м³</span></div>
                  <div className="text-[10px] text-blue-700">Суглинок: Кр_ост = 1.04-1.08, принимаем 1.06</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Ширина траншей ───────────────────────────────────────────── */}
        {activeSection === "trenches" && (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800">
                    <th className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-left">Материал трубы</th>
                    <th className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-left">Диаметр</th>
                    <th className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-left font-bold">Ширина траншеи по дну</th>
                  </tr>
                </thead>
                <tbody>
                  {TRENCH_TABLE.map((row, i) => (
                    <tr key={i} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 ${i % 2 === 0 ? "" : "bg-slate-50/50 dark:bg-slate-800/20"}`}>
                      <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 font-medium">{row[0]}</td>
                      <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 font-mono text-slate-600 dark:text-slate-400">{row[1]}</td>
                      <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 font-mono font-bold text-blue-700 dark:text-blue-400">{row[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TrenchWidthCalc />
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-xs space-y-2">
              <div className="font-bold text-slate-700 dark:text-slate-300">📌 Доп. правила (СНиП РК 3.05.04-2002, п. 4.3)</div>
              <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-400">
                <li>Ширина не может быть меньше диаметра трубы + 0.5 м (абсолютный минимум для работы монтажника)</li>
                <li>При наличии распорного крепления ширина увеличивается на 0.15 м с каждой стороны</li>
                <li>При отрытии вручную — не менее 0.7 м (ширина рабочего)</li>
                <li>Откосы траншеи по тем же нормам, что котлованы (СНиП РК 5.01-03)</li>
                <li>Основание трубы: песчаная подушка 100-200 мм — ширина = ширина траншеи</li>
                <li>Обратная засыпка: 500 мм выше верха трубы вручную (нельзя механизмом — повредит)</li>
              </ul>
            </div>
          </div>
        )}

        {/* ── Рабочее пространство ─────────────────────────────────────── */}
        {activeSection === "workspace" && (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800">
                    <th className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-left">Вид работ</th>
                    <th className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-center">Рабочее пространство</th>
                  </tr>
                </thead>
                <tbody>
                  {WORKSPACE_TABLE.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="border border-slate-200 dark:border-slate-700 px-3 py-2">{row[0]}</td>
                      <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center font-mono font-bold text-indigo-700 dark:text-indigo-400">{row[1]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-xs">
              <div className="font-bold text-slate-700 dark:text-slate-300 mb-2">📏 Формула дна котлована под фундамент</div>
              <div className="font-mono bg-slate-50 dark:bg-slate-800 rounded p-3 text-[11px] space-y-1">
                <div>a_дна = a_фундамента + 2 × Δ (рабочее пространство)</div>
                <div>b_дна = b_фундамента + 2 × Δ</div>
                <div className="border-t border-slate-200 dark:border-slate-700 pt-1 mt-1 text-slate-500">
                  Пример: фундамент 12×8 м, монтаж без опалубки:
                </div>
                <div className="text-indigo-700 dark:text-indigo-300">
                  a_дна = 12.0 + 2×0.5 = 13.0 м
                  b_дна = 8.0 + 2×0.5 = 9.0 м
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Расценки ЭСН ─────────────────────────────────────────────── */}
        {activeSection === "rates" && (
          <div className="space-y-3">
            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-xs text-slate-700 dark:text-slate-300">
              <strong>Принцип выбора расценки ЭСН РК:</strong> сначала определяем вид механизма → затем категорию грунта → затем условия (с водоотливом/без, стеснённость).
            </div>
            {ESN_RATES.map((r, i) => (
              <div key={i} className={`border-2 ${r.color} rounded-xl p-4`}>
                <div className="flex items-start gap-3">
                  <code className="text-[10px] bg-white/60 px-2 py-1 rounded font-mono shrink-0 text-slate-800">{r.code}</code>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-900">{r.title}</div>
                    <div className="text-[11px] text-slate-600 mt-1"><span className="font-semibold">Условия:</span> {r.cond}</div>
                    <div className="text-[11px] text-slate-600"><span className="font-semibold">Ед.изм.:</span> {r.unit}</div>
                    <div className="text-[10px] mt-1.5 bg-white/50 rounded p-1.5 text-slate-700">💡 {r.note}</div>
                  </div>
                </div>
              </div>
            ))}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-xs">
              <div className="font-bold text-slate-700 dark:text-slate-300 mb-2">🔀 Алгоритм подбора расценки на земляные работы</div>
              <ol className="list-decimal pl-5 space-y-1.5 text-slate-600 dark:text-slate-400">
                <li><strong>Вид работ:</strong> котлован / траншея / планировка / обратная засыпка</li>
                <li><strong>Механизм:</strong> экскаватор (ёмкость ковша) / бульдозер / скрепер / вручную</li>
                <li><strong>Категория грунта:</strong> I–IV (из геотехнического отчёта)</li>
                <li><strong>Способ укладки:</strong> навымет (в отвал) / в транспортное средство</li>
                <li><strong>Особые условия:</strong> с водоотливом (+30%), в стеснённых условиях (+15%), в зимнее время (+Кз)</li>
                <li>Найти параграф в ЭСН РК Сб.1 и проверить единицу измерения (1000 м³ или м³)</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
