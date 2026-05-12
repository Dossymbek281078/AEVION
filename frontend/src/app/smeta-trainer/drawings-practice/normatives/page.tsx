"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * Нормативный справочник — подсчёт объёмов по всем разделам строительства.
 * Источники:
 *  Земля: СНиП РК 5.01-03-2002; ЭСН РК Сб.1; СНиП РК 3.05.04-2002; МДС 81-25.2004; ГОСТ 25100-2011
 *  Бетон: ЭСН РК Сб.6 «Бетонные и ж/б конструкции монолитные»; СП РК 5.03-106
 *  Кладка: ЭСН РК Сб.8 «Конструкции из кирпича и блоков»; ГОСТ 530, 6133
 *  Кровля: ЭСН РК Сб.12 «Кровли»; СНиП РК 2.04-01; СП РК 2.04-106
 *  Отделка: ЭСН РК Сб.15 «Отделочные работы»; ГОСТ 30246; ССЦ РК 8.04-08-2025
 */

type Section = "soils" | "slopes" | "loosen" | "trenches" | "workspace" | "rates"
             | "concrete" | "masonry" | "roofing" | "finishing-norms" | "engineering";

const SECTIONS: { id: Section; icon: string; title: string; normRef: string }[] = [
  { id: "soils",          icon: "🪨", title: "Грунты I-IV кат.",             normRef: "ЭСН РК Сб.1, ГОСТ 25100" },
  { id: "slopes",         icon: "📐", title: "Откосы котлованов",            normRef: "СНиП РК 5.01-03-2002, Табл. 1" },
  { id: "loosen",         icon: "🔢", title: "Кр разрыхления",               normRef: "ЭСН РК Сб.1 Общая часть" },
  { id: "trenches",       icon: "🔗", title: "Ширина траншей",               normRef: "СНиП РК 3.05.04-2002, п. 4.3" },
  { id: "workspace",      icon: "📏", title: "Рабочее пространство",         normRef: "МДС 81-25.2004, Прил. А" },
  { id: "rates",          icon: "📋", title: "Расценки ЭСН — земля",        normRef: "ЭСН РК Сб.1" },
  { id: "concrete",       icon: "🔲", title: "Бетонные работы",              normRef: "ЭСН РК Сб.6; СП РК 5.03-106" },
  { id: "masonry",        icon: "🧱", title: "Каменные работы",              normRef: "ЭСН РК Сб.8; ГОСТ 530" },
  { id: "roofing",        icon: "🏠", title: "Кровельные работы",            normRef: "ЭСН РК Сб.12; СНиП РК 2.04-01" },
  { id: "finishing-norms",icon: "🎨", title: "Отделка — нормы расхода",     normRef: "ЭСН РК Сб.15; ССЦ РК 8.04-08-2025" },
  { id: "engineering",    icon: "🔧", title: "Инженерные сети",              normRef: "СНиП РК 4.01-41 · СП РК 4.02-42 · ПУЭ 7" },
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

        {/* ── Бетонные работы ───────────────────────────────────────────── */}
        {activeSection === "concrete" && (
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 text-xs text-blue-800 dark:text-blue-300">
              📖 <strong>ЭСН РК Сборник 6</strong> «Бетонные и железобетонные конструкции монолитные».
              Единица измерения — <strong>1 м³</strong> бетона в деле (с учётом уплотнения).
            </div>
            <table className="w-full text-xs border-collapse">
              <thead><tr className="bg-slate-100 dark:bg-slate-800">
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-left">Конструкция</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-center">Расценка ЭСН РК</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-center">Опалубка, м²/м³</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-center">Арматура, кг/м³</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-left">Примечание</th>
              </tr></thead>
              <tbody>
                {[
                  ["Фундаменты ленточные", "§6-1-1...§6-1-4", "3.0–5.5", "80–120", "Зависит от ширины: чем уже — больше опалубки"],
                  ["Фундаменты под колонны", "§6-1-5...§6-1-8", "5.0–8.0", "120–180", "Много ребер → много опалубки на 1 м³"],
                  ["Колонны h≤6м", "§6-2-1...§6-2-4", "12.0–18.0", "200–350", "Очень много опалубки — узкое сечение"],
                  ["Балки и ригели", "§6-3-1...§6-3-6", "5.0–8.0", "150–250", "Боковые + дно; Т-образный профиль = меньше"],
                  ["Плиты перекрытий h=200мм", "§6-6-1...§6-6-4", "5.5–6.5", "80–120", "Горизонталь + торцы; без колонн — меньше опалубки"],
                  ["Стены подвала", "§6-4-1...§6-4-6", "8.0–12.0", "100–150", "Две стороны + торцы; чем тоньше — больше м²/м³"],
                  ["Лестничные марши", "§6-8-1...§6-8-4", "4.0–6.0", "100–160", "Плита наклонная + ступени — отдельный параграф"],
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 font-medium">{row[0]}</td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center font-mono text-[11px] text-indigo-700 dark:text-indigo-400">{row[1]}</td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center font-mono text-amber-700 dark:text-amber-400">{row[2]}</td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center font-mono text-slate-600 dark:text-slate-400">{row[3]}</td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-[10px] text-slate-500">{row[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-xs space-y-2">
              <div className="font-bold text-slate-700 dark:text-slate-300">📌 Порядок позиций ЛСР для монолитного бетона</div>
              <ol className="list-decimal pl-5 space-y-1 text-slate-600 dark:text-slate-400">
                <li><strong>Установка опалубки</strong> — §6-1-x: ед. изм. <strong>100 м²</strong> контакта с бетоном</li>
                <li><strong>Вязка арматуры</strong> — §6-10-x или §7-x: ед. изм. <strong>т</strong> арматуры</li>
                <li><strong>Укладка и уплотнение бетона</strong> — §6-1-x: ед. изм. <strong>м³</strong></li>
                <li><strong>Разборка опалубки</strong> — иногда в комплекте §6-1-x, иногда отдельно §6-9-x</li>
                <li><strong>Уход за бетоном</strong> (Жаркий климат РК!) — §6-20-x: плёнка, полив — <strong>100 м²</strong></li>
              </ol>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded p-2 text-[10px] text-amber-800 dark:text-amber-300">
                ⚠ В условиях Казахстана (жаркое лето, суточный перепад t° до 30°C) уход за бетоном <strong>обязателен</strong> по СП РК 5.03-106. Отдельная позиция в ЛСР.
              </div>
            </div>
          </div>
        )}

        {/* ── Каменные работы ────────────────────────────────────────────── */}
        {activeSection === "masonry" && (
          <div className="space-y-4">
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg p-3 text-xs text-orange-800 dark:text-orange-300">
              📖 <strong>ЭСН РК Сборник 8</strong> «Конструкции из кирпича и блоков».
              Единица измерения — <strong>1 м³</strong> кладки «в деле».
            </div>
            <table className="w-full text-xs border-collapse">
              <thead><tr className="bg-slate-100 dark:bg-slate-800">
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-left">Конструкция</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-center">Расценка</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-center">Кирпич, шт/м³</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-center">Раствор, м³/м³</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-left">Норматив</th>
              </tr></thead>
              <tbody>
                {[
                  ["Стены из кирпича полнот. δ=120 мм", "§8-1-1", "400 ± 10%", "0.19", "Шов 10мм; по ГОСТ 530-2012"],
                  ["Стены из кирпича δ=250 мм (1 кирп.)", "§8-1-3", "404 ± 10%", "0.22", "Полуторный шов; учёт толщины"],
                  ["Стены из кирпича δ=380 мм (1.5 кирп.)", "§8-1-4", "394 ± 10%", "0.234", "Стандартная наружная стена"],
                  ["Стены из кирпича δ=510 мм (2 кирп.)", "§8-1-5", "394 ± 10%", "0.234", "Утолщённая стена"],
                  ["Перегородки 120 мм (0.5 кирп.)", "§8-7-1", "400", "0.19", "Шов 10мм; высота до 4м"],
                  ["Газобетон D500, блок 200×300×600", "§8-4-1", "27 блок/м³", "0.05", "Клей вместо раствора; ССЦ §402"],
                  ["Газобетон D600, блок 100×250×600", "§8-4-2", "67 блок/м³", "0.03", "Перегородки тонкие"],
                  ["Блоки пустотел. бетон 390×190×188", "§8-6-1", "12.5 бл/м²", "0.016 м³/м²", "Ед. изм. 1 м² кладки (НЕ м³)"],
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 font-medium">{row[0]}</td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center font-mono text-[11px] text-orange-700 dark:text-orange-400">{row[1]}</td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center font-mono text-amber-700 dark:text-amber-400">{row[2]}</td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center font-mono text-slate-600 dark:text-slate-400">{row[3]}</td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-[10px] text-slate-500">{row[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-xs space-y-2">
              <div className="font-bold text-slate-700 dark:text-slate-300">🧮 Пример расчёта потребности в кирпиче</div>
              <div className="font-mono bg-slate-50 dark:bg-slate-800 rounded p-3 text-[11px] space-y-1">
                <div>Стена δ=510мм (2 кирп.): объём кладки = 165.0 м³</div>
                <div>Кирпич: 165.0 × 394 шт. = <span className="font-bold text-orange-700">65 010 шт.</span> (базис)</div>
                <div>+ бой и отходы 5%: 65 010 × 1.05 = <span className="font-bold">68 261 шт.</span></div>
                <div>Раствор М-75: 165.0 × 0.234 = <span className="font-bold text-slate-700">38.6 м³</span></div>
              </div>
              <div className="text-[10px] text-slate-500 italic">Нормы расхода — из спецификации к ЭСН РК. Отходы принимаются по производственным нормам: кирпич — 3-5%, газобетон — 2-3%.</div>
            </div>
          </div>
        )}

        {/* ── Кровельные работы ────────────────────────────────────────── */}
        {activeSection === "roofing" && (
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 text-xs text-blue-800 dark:text-blue-300">
              📖 <strong>ЭСН РК Сборник 12</strong> «Кровли». Единица измерения — <strong>100 м²</strong> кровли.
              СНиП РК 2.04-01-2003 «Строительная климатология».
            </div>
            <table className="w-full text-xs border-collapse">
              <thead><tr className="bg-slate-100 dark:bg-slate-800">
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-left">Вид кровли</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-center">Расценка ЭСН</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-center">Коэф. уклона К</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-left">Особенности расчёта</th>
              </tr></thead>
              <tbody>
                {[
                  ["Мягкая кровля (рубероид 3 слоя)", "§12-1-1...§12-1-3", "1.000 (плоская)", "По горизонтальной проекции"],
                  ["Мембранная ПВХ 1.5 мм", "§12-4-1...§12-4-4", "1.000 – 1.035", "При уклоне >5° — по наклонной"],
                  ["Металлочерепица (уклон 22-30°)", "§12-8-1...§12-8-6", "1.082 – 1.155", "С учётом нахлёста +15-20% к материалу"],
                  ["Профнастил НС-35", "§12-9-1...§12-9-4", "По уклону", "Нахлёст 150-200мм; +12% к материалу"],
                  ["Черепица керамическая", "§12-10-1", "По уклону", "Нахлёст min 75мм; материал × 1.03"],
                  ["Кровля из шифера (8-волновой)", "§12-6-1...§12-6-3", "По уклону", "Нахлёст 120-200мм; × 1.05 отходы"],
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 font-medium">{row[0]}</td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center font-mono text-[11px] text-blue-700 dark:text-blue-400">{row[1]}</td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center font-mono font-bold text-indigo-700 dark:text-indigo-400">{row[2]}</td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-[10px] text-slate-500">{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="overflow-x-auto">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">📐 Коэффициент уклона К = 1/cos(α)</div>
              <table className="w-full text-xs border-collapse">
                <thead><tr className="bg-slate-100 dark:bg-slate-800">
                  {["Уклон α°", "5°", "10°", "15°", "20°", "25°", "30°", "35°", "40°", "45°"].map(h => (
                    <th key={h} className="border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-center">{h}</th>
                  ))}
                </tr></thead>
                <tbody><tr>
                  {["К =", "1.004", "1.015", "1.035", "1.064", "1.103", "1.155", "1.221", "1.305", "1.414"].map((v, i) => (
                    <td key={i} className={`border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center font-mono ${i > 0 ? "text-indigo-700 dark:text-indigo-400 font-bold" : "text-slate-500"}`}>{v}</td>
                  ))}
                </tr></tbody>
              </table>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-xs space-y-2">
              <div className="font-bold text-slate-700 dark:text-slate-300">⚠ Что считается отдельно от кровли (ЭСН Сб.12)</div>
              <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-400">
                <li><strong>Пароизоляция</strong> — §12-21-x (паробарьер) — м² отдельно</li>
                <li><strong>Утеплитель</strong> — ЭСН Сб.19 §19-x — м³</li>
                <li><strong>Водосток</strong> — трубы ЭСН Сб.18, желоба — м.п.</li>
                <li><strong>Парапет + окантовка</strong> — §12-23-x — м.п. или м²</li>
                <li><strong>Воронки водоприёмные</strong> — §12-24-x — шт</li>
                <li><strong>Примыкания к стенам, трубам</strong> — §12-22-x — м.п.</li>
              </ul>
            </div>
          </div>
        )}

        {/* ── Отделочные работы — нормы расхода ────────────────────────── */}
        {activeSection === "finishing-norms" && (
          <div className="space-y-4">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-lg p-3 text-xs text-emerald-800 dark:text-emerald-300">
              📖 <strong>ЭСН РК Сборник 15</strong> «Отделочные работы». Цены материалов — из <strong>ССЦ РК 8.04-08-2025</strong>.
            </div>
            <table className="w-full text-xs border-collapse">
              <thead><tr className="bg-slate-100 dark:bg-slate-800">
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-left">Вид работы</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-center">Расценка ЭСН</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-center">Ед. изм.</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-center">Расход материала</th>
              </tr></thead>
              <tbody>
                {[
                  ["Штукатурка стен (цем.-известк. 20мм)", "§15-1-1...§15-1-6", "100 м²", "Раствор 0.020 м³/м²; сетка — при нестаб. осн."],
                  ["Штукатурка потолков (цем.-изв. 15мм)", "§15-2-1...§15-2-3", "100 м²", "Раствор 0.015 м³/м²; К=1.05 к расценке"],
                  ["Шпатлёвка стен (2 слоя)", "§15-4-1...§15-4-4", "100 м²", "Шпатлёвка 1.0–1.4 кг/м² на слой"],
                  ["Окраска ВД (2 слоя, с грунтом)", "§15-6-1...§15-6-6", "100 м²", "Краска 0.12–0.15 кг/м² на слой; грунт 0.10"],
                  ["Плитка керамическая пол 300×300", "§15-12-1...§15-12-4", "100 м²", "Плитка с отходами ×1.08–1.12; клей 4–6 кг/м²"],
                  ["Плитка керамическая стены 250×400", "§15-13-1...§15-13-4", "100 м²", "Клей 3–5 кг/м²; фуга 0.15–0.30 кг/м²"],
                  ["Облицовка натуральным камнем", "§15-14-1...§15-14-6", "100 м²", "Клей специальный; отходы ×1.15–1.20"],
                  ["Линолеум коммерческий", "§15-20-1...§15-20-4", "100 м²", "Линолеум ×1.05 (раскрой); клей 0.35 кг/м²"],
                  ["Ламинат 33 класс", "§15-21-1", "100 м²", "Ламинат ×1.07–1.10 (раскрой по диагонали)"],
                  ["Гипсокартон стены (1 слой)", "§15-30-1...§15-30-4", "100 м²", "ГКЛ ×1.03; профиль CW/UW; шурупы; лента"],
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 font-medium">{row[0]}</td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center font-mono text-[11px] text-emerald-700 dark:text-emerald-400">{row[1]}</td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center font-mono text-slate-500">{row[2]}</td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-[10px] text-slate-500">{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-xs space-y-2">
              <div className="font-bold text-slate-700 dark:text-slate-300">⚡ Ключевые правила подсчёта объёмов отделки</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="font-semibold text-slate-600 dark:text-slate-400 mb-1">Вычитать из площади:</div>
                  <ul className="list-disc pl-5 space-y-0.5 text-slate-500 text-[11px]">
                    <li>{"Оконные проёмы (>0.5 м²)"}</li>
                    <li>{"Дверные проёмы (>0.5 м²)"}</li>
                    <li>Арки и ниши</li>
                    <li>Пилоны и ригели (если отдельная позиция)</li>
                  </ul>
                </div>
                <div>
                  <div className="font-semibold text-slate-600 dark:text-slate-400 mb-1">НЕ вычитать:</div>
                  <ul className="list-disc pl-5 space-y-0.5 text-slate-500 text-[11px]">
                    <li>Проёмы ≤0.5 м²</li>
                    <li>Площадь пола под дверью</li>
                    <li>Потолок — из площади пола (одинаково)</li>
                    <li>Плинтус из площади пола</li>
                  </ul>
                </div>
              </div>
              <div className="font-mono bg-slate-50 dark:bg-slate-800 rounded p-2 text-[11px]">
                Расход плитки 300×300: 1/0.09 = 11.11 шт/м² × 1.10 (отходы) = <span className="font-bold">12.2 шт/м²</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Инженерные сети — детальные нормативы ──────────────────────── */}
        {activeSection === "engineering" && (
          <div className="space-y-4">
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-3 text-xs text-purple-800 dark:text-purple-300">
              🔧 <strong>Три типа наружных сетей</strong> с разными нормативными требованиями:
              канализация (СНиП РК 4.01-41), теплосети (СП РК 4.02-42), кабельные трассы (ПУЭ 7-е изд.).
              Каждый тип — своя глубина, своя ширина траншеи, свой набор расценок.
            </div>

            {/* Канализация */}
            <div className="bg-white dark:bg-slate-900 border-2 border-blue-200 dark:border-blue-700 rounded-xl p-4 space-y-3">
              <div className="flex items-baseline gap-2 border-b border-blue-200 dark:border-blue-700 pb-2">
                <span className="text-2xl">🚰</span>
                <h2 className="text-sm font-bold text-blue-900 dark:text-blue-300">Канализация — наружные сети</h2>
                <span className="text-[10px] text-slate-500 ml-auto font-mono">СНиП РК 4.01-41-2006</span>
              </div>
              <table className="w-full text-xs border-collapse">
                <thead><tr className="bg-blue-50 dark:bg-blue-900/30">
                  <th className="border border-blue-200 dark:border-blue-700 px-2 py-1.5 text-left">Параметр</th>
                  <th className="border border-blue-200 dark:border-blue-700 px-2 py-1.5 text-center">Значение</th>
                  <th className="border border-blue-200 dark:border-blue-700 px-2 py-1.5 text-left">Норматив</th>
                </tr></thead>
                <tbody>
                  {[
                    ["Минимальный уклон Ø150", "i = 0.008 (8‰)", "СНиП РК 4.01-41 п. 4.18"],
                    ["Минимальный уклон Ø200", "i = 0.005 (5‰)", "СНиП РК 4.01-41 п. 4.18"],
                    ["Минимальный уклон Ø300", "i = 0.003 (3‰)", "СНиП РК 4.01-41 п. 4.18"],
                    ["Глубина заложения", "≥ hпром + 0.3 м", "СНиП РК 4.01-41 п. 4.8"],
                    ["Колодцы — расстояние Ø150", "≤ 35 м", "СНиП РК 4.01-41 п. 4.30"],
                    ["Колодцы — расстояние Ø200-450", "≤ 50 м", "СНиП РК 4.01-41 п. 4.30"],
                    ["Колодец стандартный КК", "Ø1000 (серия 3.900.1-14)", "ГОСТ 8020-90"],
                    ["Песчаное основание", "100-150 мм", "СНиП РК 3.05.04-2002 п. 5.7"],
                    ["Засыпка пазух — материал", "Песок, выше трубы +300 мм", "СНиП РК 3.05.04 п. 5.16"],
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-blue-50/50 dark:hover:bg-blue-900/10">
                      <td className="border border-blue-100 dark:border-blue-800 px-2 py-1.5 font-medium">{row[0]}</td>
                      <td className="border border-blue-100 dark:border-blue-800 px-2 py-1.5 text-center font-mono text-blue-700 dark:text-blue-300 font-bold">{row[1]}</td>
                      <td className="border border-blue-100 dark:border-blue-800 px-2 py-1.5 text-[10px] text-slate-500">{row[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-[10px] bg-blue-50 dark:bg-blue-900/20 rounded p-2 font-mono text-blue-800 dark:text-blue-300">
                <strong>Расценки ЭСН:</strong> Сб.22-01-001 (укладка ПВХ), Сб.22-03-002 (колодец КК-1000),
                Сб.1-01-013 (разработка экскаватором), Сб.1-02-005 (засыпка вручную)
              </div>
              <Link href="/smeta-trainer/drawings-practice/sewage"
                className="inline-block text-[11px] px-3 py-1.5 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-700">
                🚰 К чертежу и упражнениям →
              </Link>
            </div>

            {/* Теплосети */}
            <div className="bg-white dark:bg-slate-900 border-2 border-orange-200 dark:border-orange-700 rounded-xl p-4 space-y-3">
              <div className="flex items-baseline gap-2 border-b border-orange-200 dark:border-orange-700 pb-2">
                <span className="text-2xl">♨️</span>
                <h2 className="text-sm font-bold text-orange-900 dark:text-orange-300">Тепловые сети — двухтрубная прокладка</h2>
                <span className="text-[10px] text-slate-500 ml-auto font-mono">СП РК 4.02-42-2006</span>
              </div>
              <table className="w-full text-xs border-collapse">
                <thead><tr className="bg-orange-50 dark:bg-orange-900/30">
                  <th className="border border-orange-200 dark:border-orange-700 px-2 py-1.5 text-left">Параметр</th>
                  <th className="border border-orange-200 dark:border-orange-700 px-2 py-1.5 text-center">Значение</th>
                  <th className="border border-orange-200 dark:border-orange-700 px-2 py-1.5 text-left">Норматив</th>
                </tr></thead>
                <tbody>
                  {[
                    ["Глубина заложения (бесканальная)", "≥ 0.7 м до верха изоляции", "СП РК 4.02-42 п. 9.4"],
                    ["Глубина заложения (канальная)", "≥ 0.5 м до верха канала", "СП РК 4.02-42 п. 9.4"],
                    ["Расстояние между трубами в свету", "≥ 100 мм (по изоляции)", "СП РК 4.02-42 п. 9.7"],
                    ["Изоляция Ø108 (Т=95°C)", "Минвата 60 мм + покровный слой", "СП РК 2.04-104-2012"],
                    ["Изоляция Ø159 (Т=95°C)", "Минвата 70 мм + покровный слой", "СП РК 2.04-104-2012"],
                    ["Опоры скользящие Ø108", "Через 6 м", "Серия 4.903-10"],
                    ["Опоры скользящие Ø159", "Через 7 м", "Серия 4.903-10"],
                    ["Компенсаторы П-образные", "При L > 50 м", "СП РК 4.02-42 п. 8.16"],
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-orange-50/50 dark:hover:bg-orange-900/10">
                      <td className="border border-orange-100 dark:border-orange-800 px-2 py-1.5 font-medium">{row[0]}</td>
                      <td className="border border-orange-100 dark:border-orange-800 px-2 py-1.5 text-center font-mono text-orange-700 dark:text-orange-300 font-bold">{row[1]}</td>
                      <td className="border border-orange-100 dark:border-orange-800 px-2 py-1.5 text-[10px] text-slate-500">{row[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-[10px] bg-orange-50 dark:bg-orange-900/20 rounded p-2 font-mono text-orange-800 dark:text-orange-300">
                <strong>Расценки ЭСН:</strong> Сб.24-02-001 (прокладка стальных труб),
                Сб.26-01-027 (изоляция минватой 60 мм), Сб.26-02-005 (покровный слой ПЭ)
              </div>
              <div className="text-[10px] bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded p-2 text-amber-800 dark:text-amber-300">
                ⚡ Площадь изоляции = π·(D + 2t)·L, где D — Ø трубы, t — толщина изоляции, L — длина.
                Для Ø108 + 60 мм: π·(0.108 + 0.12) = π·0.228 = 0.716 м²/м.п.
              </div>
              <Link href="/smeta-trainer/drawings-practice/heating"
                className="inline-block text-[11px] px-3 py-1.5 bg-orange-600 text-white rounded-full font-semibold hover:bg-orange-700">
                ♨️ К чертежу и упражнениям →
              </Link>
            </div>

            {/* Кабельные трассы */}
            <div className="bg-white dark:bg-slate-900 border-2 border-violet-200 dark:border-violet-700 rounded-xl p-4 space-y-3">
              <div className="flex items-baseline gap-2 border-b border-violet-200 dark:border-violet-700 pb-2">
                <span className="text-2xl">⚡</span>
                <h2 className="text-sm font-bold text-violet-900 dark:text-violet-300">Кабельные трассы — силовые и слаботочные</h2>
                <span className="text-[10px] text-slate-500 ml-auto font-mono">ПУЭ 7-е изд., гл. 2.3</span>
              </div>
              <table className="w-full text-xs border-collapse">
                <thead><tr className="bg-violet-50 dark:bg-violet-900/30">
                  <th className="border border-violet-200 dark:border-violet-700 px-2 py-1.5 text-left">Параметр</th>
                  <th className="border border-violet-200 dark:border-violet-700 px-2 py-1.5 text-center">Значение</th>
                  <th className="border border-violet-200 dark:border-violet-700 px-2 py-1.5 text-left">Норматив</th>
                </tr></thead>
                <tbody>
                  {[
                    ["Глубина для U ≤ 35 кВ", "≥ 0.7 м", "ПУЭ п. 2.3.84"],
                    ["Глубина для U ≤ 1 кВ (без проезда)", "≥ 0.5 м", "ПУЭ п. 2.3.84"],
                    ["Расстояние между силовыми кабелями", "≥ 100 мм", "ПУЭ п. 2.3.86"],
                    ["Песчаная постель снизу", "100 мм", "ПУЭ п. 2.3.83"],
                    ["Песчаная подсыпка над кабелем", "100 мм", "ПУЭ п. 2.3.83"],
                    ["Защита (для U > 1 кВ)", "Кирпич глиняный (НЕ силикатный)", "ПУЭ п. 2.3.83"],
                    ["Защита (для U ≤ 1 кВ)", "Сигнальная лента ЛСО-450", "ПУЭ п. 2.3.83"],
                    ["Сигнальная лента — глубина", "На 250 мм выше кабеля", "ПУЭ п. 2.3.83"],
                    ["Запас на «змейку»", "1-3% к длине трассы", "ПУЭ п. 2.3.83"],
                    ["Соединительные муфты — расстояние", "≥ 250 мм друг от друга", "ПУЭ п. 2.3.51"],
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-violet-50/50 dark:hover:bg-violet-900/10">
                      <td className="border border-violet-100 dark:border-violet-800 px-2 py-1.5 font-medium">{row[0]}</td>
                      <td className="border border-violet-100 dark:border-violet-800 px-2 py-1.5 text-center font-mono text-violet-700 dark:text-violet-300 font-bold">{row[1]}</td>
                      <td className="border border-violet-100 dark:border-violet-800 px-2 py-1.5 text-[10px] text-slate-500">{row[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-[10px] bg-violet-50 dark:bg-violet-900/20 rounded p-2 font-mono text-violet-800 dark:text-violet-300">
                <strong>Расценки ЭСН:</strong> Сб.8-02-148 (прокладка кабеля до 95 мм²),
                Сб.8-02-435 (концевая муфта до 1 кВ), Сб.1-02-005 (засыпка вручную)
              </div>
              <Link href="/smeta-trainer/drawings-practice/cables"
                className="inline-block text-[11px] px-3 py-1.5 bg-violet-600 text-white rounded-full font-semibold hover:bg-violet-700">
                ⚡ К чертежу и упражнениям →
              </Link>
            </div>

            {/* Газоснабжение */}
            <div className="bg-white dark:bg-slate-900 border-2 border-yellow-400 dark:border-yellow-600 rounded-xl p-4 space-y-3">
              <div className="flex items-baseline gap-2 border-b border-yellow-400 dark:border-yellow-700 pb-2">
                <span className="text-2xl">🔥</span>
                <h2 className="text-sm font-bold text-yellow-900 dark:text-yellow-300">Газоснабжение — наружные сети</h2>
                <span className="text-[10px] text-slate-500 ml-auto font-mono">СНиП РК 4.03-01-2007</span>
              </div>
              <table className="w-full text-xs border-collapse">
                <thead><tr className="bg-yellow-50 dark:bg-yellow-900/20">
                  <th className="border border-yellow-200 dark:border-yellow-800 px-2 py-1.5 text-left">Параметр</th>
                  <th className="border border-yellow-200 dark:border-yellow-800 px-2 py-1.5 text-center">Значение</th>
                  <th className="border border-yellow-200 dark:border-yellow-800 px-2 py-1.5 text-left">Норматив</th>
                </tr></thead>
                <tbody>
                  {[
                    ["Глубина — низкое давление", "≥ 0.8 м (вне проездов), 1.0 м под проездами", "СНиП РК 4.03-01 п. 5.4.1"],
                    ["Глубина — среднее давление", "≥ 1.0-1.2 м", "СНиП РК 4.03-01 п. 5.4.1"],
                    ["Глубина — высокое давление", "≥ 1.5 м", "СНиП РК 4.03-01 п. 5.4.1"],
                    ["Тип трубы (НД, СД)", "ПЭ100 SDR11, жёлтая или с жёлтой полосой", "ГОСТ Р 50838-95"],
                    ["Сигнальная лента", "ЛСО-450 жёлтая «ОСТОРОЖНО ГАЗ»", "СНиП РК 4.03-01 п. 5.5.4"],
                    ["Глубина ленты над трубой", "≥ 200 мм", "СНиП РК 4.03-01 п. 5.5.4"],
                    ["Стальной футляр на пересечениях", "Длина = ширина препятствия + 5 м с каждой стороны", "СНиП РК 4.03-01 п. 5.5.7"],
                    ["Расстояние до фундаментов", "≥ 2 м (НД), ≥ 4 м (СД)", "СНиП РК 4.03-01 Прил. Б"],
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-yellow-50/50 dark:hover:bg-yellow-900/10">
                      <td className="border border-yellow-100 dark:border-yellow-900 px-2 py-1.5 font-medium">{row[0]}</td>
                      <td className="border border-yellow-100 dark:border-yellow-900 px-2 py-1.5 text-center font-mono text-yellow-800 dark:text-yellow-300 font-bold">{row[1]}</td>
                      <td className="border border-yellow-100 dark:border-yellow-900 px-2 py-1.5 text-[10px] text-slate-500">{row[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-[10px] bg-yellow-50 dark:bg-yellow-900/20 rounded p-2 font-mono text-yellow-800 dark:text-yellow-300">
                <strong>Расценки ЭСН:</strong> Сб.24-01-001 (укладка ПЭ Ø110), Сб.24-01-015 (футляр Ø159),
                Сб.24-04-002 (задвижка газовая)
              </div>
              <Link href="/smeta-trainer/drawings-practice/gas"
                className="inline-block text-[11px] px-3 py-1.5 bg-yellow-500 text-white rounded-full font-semibold hover:bg-yellow-600">
                🔥 К чертежу и упражнениям →
              </Link>
            </div>

            {/* Водоснабжение */}
            <div className="bg-white dark:bg-slate-900 border-2 border-cyan-400 dark:border-cyan-700 rounded-xl p-4 space-y-3">
              <div className="flex items-baseline gap-2 border-b border-cyan-400 dark:border-cyan-700 pb-2">
                <span className="text-2xl">💧</span>
                <h2 className="text-sm font-bold text-cyan-900 dark:text-cyan-300">Водоснабжение — наружный водопровод</h2>
                <span className="text-[10px] text-slate-500 ml-auto font-mono">СНиП РК 4.01-02-2009</span>
              </div>
              <table className="w-full text-xs border-collapse">
                <thead><tr className="bg-cyan-50 dark:bg-cyan-900/30">
                  <th className="border border-cyan-200 dark:border-cyan-700 px-2 py-1.5 text-left">Параметр</th>
                  <th className="border border-cyan-200 dark:border-cyan-700 px-2 py-1.5 text-center">Значение</th>
                  <th className="border border-cyan-200 dark:border-cyan-700 px-2 py-1.5 text-left">Норматив</th>
                </tr></thead>
                <tbody>
                  {[
                    ["Глубина заложения", "hпром + 0.5 м (Алматы 1.7-2.0 м)", "СНиП РК 4.01-02 п. 8.42"],
                    ["Тип трубы (ХВС)", "ПЭ100 SDR17 (PN10) или PN16", "ГОСТ 18599-2001"],
                    ["Песчаное основание", "100-150 мм", "СНиП РК 3.05.04 п. 5.7"],
                    ["Подсыпка над трубой", "≥ 300 мм песком", "СНиП РК 3.05.04 п. 5.16"],
                    ["Колодцы водомерные ВК", "Ø1500 ж/б, серия 3.900.1-14", "ГОСТ 8020-90"],
                    ["Задвижки", "Фланцевые 30ч6бр Ø равный трубе", "ГОСТ 9698-86"],
                    ["Гидравлическое испытание", "Двукратное рабочее давление, 30 мин", "СНиП РК 3.05.04 п. 7.5"],
                    ["Дезинфекция перед сдачей", "Раствор хлора 75-100 мг/л на 5-6 ч", "СНиП РК 3.05.04 п. 7.16"],
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-cyan-50/50 dark:hover:bg-cyan-900/10">
                      <td className="border border-cyan-100 dark:border-cyan-800 px-2 py-1.5 font-medium">{row[0]}</td>
                      <td className="border border-cyan-100 dark:border-cyan-800 px-2 py-1.5 text-center font-mono text-cyan-700 dark:text-cyan-300 font-bold">{row[1]}</td>
                      <td className="border border-cyan-100 dark:border-cyan-800 px-2 py-1.5 text-[10px] text-slate-500">{row[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-[10px] bg-cyan-50 dark:bg-cyan-900/20 rounded p-2 font-mono text-cyan-800 dark:text-cyan-300">
                <strong>Расценки ЭСН:</strong> Сб.16-01-001 (прокладка ПЭ Ø160), Сб.16-04-002 (задвижка),
                Сб.16-03-001 (колодец ВК), Сб.16-05-001 (водомер)
              </div>
              <Link href="/smeta-trainer/drawings-practice/water"
                className="inline-block text-[11px] px-3 py-1.5 bg-cyan-600 text-white rounded-full font-semibold hover:bg-cyan-700">
                💧 К чертежу и упражнениям →
              </Link>
            </div>

            {/* Вентиляция */}
            <div className="bg-white dark:bg-slate-900 border-2 border-teal-400 dark:border-teal-700 rounded-xl p-4 space-y-3">
              <div className="flex items-baseline gap-2 border-b border-teal-400 dark:border-teal-700 pb-2">
                <span className="text-2xl">🌬</span>
                <h2 className="text-sm font-bold text-teal-900 dark:text-teal-300">Вентиляция — воздуховоды и оборудование</h2>
                <span className="text-[10px] text-slate-500 ml-auto font-mono">СП РК 4.02-101-2012</span>
              </div>
              <table className="w-full text-xs border-collapse">
                <thead><tr className="bg-teal-50 dark:bg-teal-900/30">
                  <th className="border border-teal-200 dark:border-teal-700 px-2 py-1.5 text-left">Параметр</th>
                  <th className="border border-teal-200 dark:border-teal-700 px-2 py-1.5 text-center">Значение</th>
                  <th className="border border-teal-200 dark:border-teal-700 px-2 py-1.5 text-left">Норматив</th>
                </tr></thead>
                <tbody>
                  {[
                    ["Класс воздуховодов", "Н — нормальной плотности (общественные)", "СП РК 4.02-101 п. 7.10.5"],
                    ["Толщина стали (до 1000 мм)", "0.5-0.7 мм оцинковка", "СП РК 4.02-101 п. 7.10.6"],
                    ["Толщина стали (1000-2000 мм)", "0.7-0.9 мм", "СП РК 4.02-101 п. 7.10.6"],
                    ["Площадь поверхности", "F = 2·(a+b)·L (прямоугольный)", "Геометрия"],
                    ["Изоляция магистрали", "Минвата 40-60 мм + покровный слой", "СП РК 2.04-104"],
                    ["Фланцевое соединение", "Через 1.25-1.5 м (зависит от размера)", "СП РК 4.02-101 п. 7.10.13"],
                    ["Хомуты крепления", "Через 1.5-3 м (по размеру воздуховода)", "СП РК 4.02-101 п. 7.10.16"],
                    ["Огнезащита (через противопожарные стены)", "EI 60 / EI 90 минвата + кожух", "СНиП РК 2.02-05-2002"],
                    ["Кратность воздухообмена — школа класс", "20 м³/ч на ученика, 8-кратная", "СП РК 4.02-101 Прил. К"],
                    ["Кратность — операционная", "10-15 крат/ч, 100% наружн.", "СН РК 3.02-25"],
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-teal-50/50 dark:hover:bg-teal-900/10">
                      <td className="border border-teal-100 dark:border-teal-800 px-2 py-1.5 font-medium">{row[0]}</td>
                      <td className="border border-teal-100 dark:border-teal-800 px-2 py-1.5 text-center font-mono text-teal-700 dark:text-teal-300 font-bold">{row[1]}</td>
                      <td className="border border-teal-100 dark:border-teal-800 px-2 py-1.5 text-[10px] text-slate-500">{row[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-[10px] bg-teal-50 dark:bg-teal-900/20 rounded p-2 font-mono text-teal-800 dark:text-teal-300">
                <strong>Расценки ЭСН:</strong> Сб.20-01-001 (монтаж воздуховодов), Сб.20-02-005 (АДН),
                Сб.26-01-027 (изоляция), Сб.20-04-001 (дроссель-клапан)
              </div>
              <Link href="/smeta-trainer/drawings-practice/ventilation"
                className="inline-block text-[11px] px-3 py-1.5 bg-teal-600 text-white rounded-full font-semibold hover:bg-teal-700">
                🌬 К чертежу и упражнениям →
              </Link>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-xs space-y-2">
              <div className="font-bold text-slate-700 dark:text-slate-300">📌 Сравнительная таблица — все 6 типов сетей</div>
              <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead><tr className="bg-slate-100 dark:bg-slate-800">
                  <th className="border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-left">Этап</th>
                  <th className="border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-center">🚰 Канал.</th>
                  <th className="border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-center">♨️ Тепло</th>
                  <th className="border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-center">⚡ Кабель</th>
                  <th className="border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-center">🔥 Газ НД</th>
                  <th className="border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-center">💧 Вода</th>
                  <th className="border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-center">🌬 Венти.</th>
                </tr></thead>
                <tbody>
                  {[
                    ["Глубина, м",       "≥ 1.5",      "≥ 0.7",  "≥ 0.7",   "≥ 0.8-1.0", "≥ 1.7-2.0", "В подвесном"],
                    ["Ширина низа, мм",  "Ø + 500",    "800-1000","400",     "600",        "Ø + 500-700", "—"],
                    ["Песок снизу, мм",  "100",        "100",    "100",     "100",        "100-150",     "—"],
                    ["Засыпка, мм",      "+300 над",   "+200 над","+100",   "+200 + лента","+300 над",   "—"],
                    ["Защита",           "—",          "—",      "Кирпич+лента", "Жёлтая лента", "—",      "Огнезащита"],
                    ["Расценка ЭСН",     "Сб.22",      "Сб.24/26","Сб.8",   "Сб.24",      "Сб.16",       "Сб.20/26"],
                  ].map((row, i) => (
                    <tr key={i}>
                      <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 font-medium">{row[0]}</td>
                      {[1, 2, 3, 4, 5, 6].map(j => (
                        <td key={j} className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center font-mono text-slate-600 dark:text-slate-300">{row[j]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
