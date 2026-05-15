"use client";
import Link from "next/link";
import { useState } from "react";

function check(i: string, a: string[]) {
  const v = parseFloat(i.replace(",", "."));
  return a.some(x => {
    const e = parseFloat(x.replace(",", "."));
    return !isNaN(v) && !isNaN(e) && Math.abs((v - e) / e) < 0.05;
  });
}

const RATES = [
  { name: "Геодезическая разбивка осей", use: "Перед земляными работами", unit: "1 объект", price: "85 000 – 180 000", src: "ССЦ + Сб.49" },
  { name: "Нивелирование (1 ход)", use: "Контроль отметок плит, перекрытий", unit: "100 м хода", price: "12 000", src: "Сб.49-1-001" },
  { name: "Установка реперов (постоянных)", use: "Долгосрочные ориентиры на стройке", unit: "шт", price: "18 000", src: "Сб.49-1-005" },
  { name: "Тахеометрическая съёмка", use: "Замер кривизны стен, отклонений", unit: "1 точка", price: "2 800", src: "Сб.49-2-001" },
  { name: "Исполнительная схема котлована", use: "После завершения земляных", unit: "м² плана", price: "280", src: "Сб.49-3-001" },
  { name: "Исполнительная схема свайного поля", use: "После забивки свай", unit: "свая", price: "1 800", src: "Сб.49-3-002" },
  { name: "Исполнительная схема перекрытия", use: "После каждой плиты", unit: "м² плана", price: "180", src: "Сб.49-3-003" },
  { name: "Контроль вертикальности колонн", use: "На каждом этаже", unit: "колонна", price: "800", src: "Сб.49-2-005" },
  { name: "Геодезический мониторинг (осадки)", use: "Высотные здания, ответственные объекты", unit: "месяц", price: "250 000", src: "Сб.49-4-001" },
  { name: "Створное визирование (длинные дороги)", use: "Дороги > 1 км", unit: "1 км", price: "18 000", src: "Сб.49-2-008" },
  { name: "Лазерное сканирование (3D-облако)", use: "Сложные объекты, реставрация", unit: "100 м²", price: "95 000", src: "Индивидуальная" },
];

const EQUIPMENT = [
  { name: "Нивелир оптический Sokkia C320", acc: "±2 мм/км", price: "285 000", use: "Базовое нивелирование" },
  { name: "Нивелир цифровой Topcon DL-503", acc: "±0.5 мм/км", price: "1 850 000", use: "Точная разбивка" },
  { name: "Тахеометр Topcon GM-105", acc: "5\", ±2 мм", price: "4 250 000", use: "Универсальный для разбивок" },
  { name: "Электронный тахеометр Leica TS16", acc: "1\", ±1 мм", price: "12 800 000", use: "Высотные здания, мониторинг" },
  { name: "GPS RTK-приёмник Trimble R12i", acc: "8 мм + 1ppm", price: "9 850 000", use: "Дороги, сети" },
  { name: "Лазерный сканер Leica RTC360", acc: "1.9 мм @10м", price: "28 500 000", use: "3D-сканирование, реставрация" },
  { name: "Лазерный нивелир строительный", acc: "±3 мм/10м", price: "65 000 – 180 000", use: "Малые объекты" },
  { name: "Рейка нивелирная 5 м", acc: "мм", price: "35 000 – 95 000", use: "Любое нивелирование" },
];

const TOLERANCES = [
  { p: "Вертикальность колонны (h ≤ 4.5 м)", t: "±15 мм", src: "ГОСТ 21778-81" },
  { p: "Вертикальность колонны (h > 4.5 м)", t: "±25 мм или h/300", src: "ГОСТ 21778-81" },
  { p: "Отметка плиты перекрытия", t: "±15 мм", src: "СП РК 5.03-106" },
  { p: "Толщина монолитной стены", t: "±5 мм", src: "СП РК 5.03-106" },
  { p: "Толщина монолитного перекрытия", t: "±10 мм", src: "СП РК 5.03-106" },
  { p: "Защитный слой арматуры", t: "+5 / −3 мм", src: "СП РК 5.03-106" },
  { p: "Длина свай (после забивки)", t: "−200 / +50 мм", src: "СП РК 5.04-101" },
  { p: "Кладка вертикальность (на этаже)", t: "≤ ±10 мм", src: "СП РК 5.05-101" },
  { p: "Кладка горизонтальность ряда (на 1 м)", t: "≤ ±2 мм", src: "СП РК 5.05-101" },
  { p: "Поверхность пола под чистовое покрытие", t: "±2 мм / 2 м", src: "СНиП РК 2.04-26" },
];

type Variant = { id: string; label: string };
type Exercise = {
  id: string;
  title: string;
  q: string;
  type?: "input" | "choice";
  ss?: { id: string; l: string; a: string[]; e: string }[];
  variants?: Variant[];
  correct?: string;
  explain?: string;
  vor: string;
  theory: string;
};

const EXERCISES: Exercise[] = [
  {
    id: "ex1",
    title: "Стоимость геодезической разбивки и контроля для типовой школы",
    q: "Школа №47: разбивка осей — 120 000 тг (учебная цена). За весь период строительства — 5 нивелирований по этажам. Контроль вертикальности 18 колонн × 4 этажа. 3 перекрытия по 432 м² — исполнительные схемы. Сосчитайте суммарную стоимость геодезии.",
    type: "input",
    ss: [
      { id: "niv", l: "Стоимость 5 нивелирований, тг", a: ["60000", "60 000"], e: "5 × 12 000 = 60 000 тг (Сб.49-1-001)" },
      { id: "vert", l: "Контроль вертикальности (18 кол × 4 эт × 800), тг", a: ["57600", "57 600"], e: "18 × 4 = 72 точки; 72 × 800 = 57 600 тг (Сб.49-2-005)" },
      { id: "isp", l: "3 исполнительные схемы перекрытий (432 м² × 180 × 3), тг", a: ["233280", "233 280"], e: "3 × 432 × 180 = 233 280 тг (Сб.49-3-003)" },
      { id: "tot", l: "Итого с разбивкой 120 000, тг", a: ["470880", "470 880"], e: "120 000 + 60 000 + 57 600 + 233 280 = 470 880 тг" },
    ],
    vor: "Геодезические работы — школа №47: разбивка + 5 нивелирований + 72 контроля колонн + 3 исп. схемы = 470 880 тг (Сб.49)",
    theory: "Геодезия — постоянная статья сметы. Считается по конкретным расценкам Сб.49 ЭСН РК. Для типового объекта это 1.5-2% от СМР.",
  },
  {
    id: "ex2",
    title: "Допустимое отклонение для колонны h = 4 м",
    q: "По ГОСТ 21778-81 определите допуск вертикальности железобетонной колонны высотой 4 метра. Введите значение допуска в миллиметрах (без знака ±).",
    type: "input",
    ss: [
      { id: "tol", l: "Допуск вертикальности, мм", a: ["15"], e: "h = 4 м ≤ 4.5 м → допуск ±15 мм по ГОСТ 21778-81" },
    ],
    vor: "Допуск вертикальности колонны h ≤ 4.5 м: ±15 мм (ГОСТ 21778-81)",
    theory: "ГОСТ 21778-81 — фундаментальный документ для геометрии. Для h ≤ 4.5 м допуск фиксированный ±15 мм. Для h > 4.5 м применяется правило h/300 (либо ±25 мм — что больше).",
  },
  {
    id: "ex3",
    title: "Стоимость лазерной съёмки фасада школы №47",
    q: "Площадь фасадов школы — 1248 м². Тариф лазерного сканирования: 95 000 тг за 100 м². Рассчитайте стоимость 3D-съёмки фасадов.",
    type: "input",
    ss: [
      { id: "cost", l: "Стоимость лазерной съёмки фасадов, тг", a: ["1185600", "1 185 600", "1185000"], e: "1248 × 95 000 / 100 = 1 185 600 тг" },
    ],
    vor: "Лазерное сканирование фасадов 1248 м² × 95 000/100 = 1 185 600 тг",
    theory: "Лазерная съёмка применяется для сложных фасадов или реставрации. Создаёт 3D-облако точек для точного проектирования. Для простых объектов — избыточно.",
  },
  {
    id: "ex4",
    title: "Какой прибор для контроля плит перекрытия в монолитном строительстве?",
    q: "Нужно контролировать ±15 мм отметки железобетонных плит перекрытия на 4-этажной школе. Выберите оптимальный прибор.",
    type: "choice",
    variants: [
      { id: "a", label: "Лазерный нивелир строительный (±3 мм/10м)" },
      { id: "b", label: "Цифровой нивелир Topcon DL-503 (±0.5 мм/км)" },
      { id: "c", label: "Лазерный сканер Leica RTC360 (1.9 мм @10м)" },
      { id: "d", label: "GPS RTK-приёмник (8 мм + 1ppm)" },
    ],
    correct: "b",
    explain: "Цифровой нивелир Topcon DL-503 — оптимально. Точность ±0.5 мм/км достаточна для контроля плит. Оптические нивелиры (±2 мм/км) — недостаточно. Лазерный сканер избыточен и дорог. GPS не работает в помещениях.",
    vor: "Контроль отметок плит перекрытия — цифровой нивелир Topcon DL-503 (±0.5 мм/км)",
    theory: "Подбор прибора по точности: погрешность прибора должна быть в 3-5 раз меньше допуска. Допуск ±15 мм → нужен прибор ≤±3 мм. Цифровой нивелир закрывает.",
  },
];

export default function SurveyPage() {
  const [xi, sxi] = useState(0);
  const [si, ssi] = useState(0);
  const [inp, setInp] = useState<Record<string, string>>({});
  const [rev, setRev] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Set<string>>(new Set());
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [check8, setCheck8] = useState<boolean[]>(Array(8).fill(false));

  const ex = EXERCISES[xi];
  const isInput = ex.type !== "choice";
  const step = isInput && ex.ss ? ex.ss[si] : null;
  const k = step ? `${ex.id}-${step.id}` : `${ex.id}-choice`;
  const ok = isInput
    ? !!(rev[k] && step && check(inp[k] ?? "", step.a))
    : !!(rev[k] && choice[ex.id] === ex.correct);
  const err = !!rev[k] && !ok;

  function go() {
    setRev(r => ({ ...r, [k]: true }));
    if (isInput && step && check(inp[k] ?? "", step.a)) {
      setTimeout(() => {
        if (ex.ss && si + 1 < ex.ss.length) {
          ssi(si + 1);
          setRev({});
        } else {
          setDone(d => new Set([...d, ex.id]));
        }
      }, 700);
    } else if (!isInput && choice[ex.id] === ex.correct) {
      setTimeout(() => setDone(d => new Set([...d, ex.id])), 700);
    }
  }

  const allDone = done.size === EXERCISES.length;

  const checklist = [
    "Утверждённый раздел геодезии в ПОС",
    "Установлены постоянные реперы (минимум 2)",
    "Журнал геодезических работ ведётся",
    "Поверка приборов (1 раз в 12 мес)",
    "Исполнительная схема котлована (после земли)",
    "Исполнительная схема свай/фундамента",
    "Контроль вертикальности на каждом этаже",
    "Сводная геодезическая схема для приёмки",
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-indigo-700 text-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link href="/smeta-trainer/drawings-practice/hub" className="text-xs text-indigo-200 hover:text-white">← К разделам</Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold">📐 Геодезические работы — разбивка, нивелирование, контроль</h1>
            <p className="text-[10px] text-indigo-200">СНиП РК 1.02-08-2003 · СН РК 1.04-25-2007 · ГОСТ 21778-81 · {done.size}/{EXERCISES.length} упражнений</p>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 space-y-6">

        {/* Введение */}
        <section className="bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded-xl p-4">
          <div className="text-xs text-indigo-800 dark:text-indigo-300 leading-relaxed space-y-2">
            <p className="font-semibold">📌 Геодезия — основа точности строительства.</p>
            <p>В смете геодезия проходит отдельной статьёй:</p>
            <ul className="list-disc list-inside space-y-0.5 pl-2">
              <li>На стадии ПОС: разбивка осей объекта</li>
              <li>В процессе: контроль геометрии (отметки, оси, габариты)</li>
              <li>При сдаче: исполнительные геодезические схемы</li>
              <li>Стоимость: 0.5 – 2.5% от СМР (зависит от сложности)</li>
            </ul>
          </div>
        </section>

        {/* Нормативы */}
        <section className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-300 dark:border-indigo-700 rounded-xl p-4">
          <h2 className="text-sm font-bold text-indigo-800 dark:text-indigo-300 mb-2">📘 Нормативная база</h2>
          <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1">
            <li><span className="font-mono font-semibold text-indigo-700 dark:text-indigo-400">СНиП РК 1.02-08-2003</span> — «Геодезические работы в строительстве»</li>
            <li><span className="font-mono font-semibold text-indigo-700 dark:text-indigo-400">СН РК 1.04-25-2007</span> — «Геодезическое обеспечение качества строительства»</li>
            <li><span className="font-mono font-semibold text-indigo-700 dark:text-indigo-400">ГОСТ 21778-81</span> — «Точность геометрических параметров»</li>
          </ul>
        </section>

        {/* Раздел 1 — Виды работ + расценки */}
        <section className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">📋 Раздел 1. Виды геодезических работ + расценки 2025</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b-2 border-indigo-300 dark:border-indigo-700">
                  <th className="text-left py-1.5 px-2 font-semibold text-indigo-800 dark:text-indigo-300">Вид работ</th>
                  <th className="text-left py-1.5 px-2 font-semibold text-indigo-800 dark:text-indigo-300">Применение</th>
                  <th className="text-left py-1.5 px-2 font-semibold text-indigo-800 dark:text-indigo-300">Ед.изм.</th>
                  <th className="text-right py-1.5 px-2 font-semibold text-indigo-800 dark:text-indigo-300">Расценка, тг</th>
                  <th className="text-left py-1.5 px-2 font-semibold text-indigo-800 dark:text-indigo-300">Источник</th>
                </tr>
              </thead>
              <tbody>
                {RATES.map((r, i) => (
                  <tr key={i} className="border-b border-slate-100 dark:border-slate-800 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10">
                    <td className="py-1.5 px-2 text-slate-800 dark:text-slate-200 font-medium">{r.name}</td>
                    <td className="py-1.5 px-2 text-slate-600 dark:text-slate-400">{r.use}</td>
                    <td className="py-1.5 px-2 text-slate-600 dark:text-slate-400">{r.unit}</td>
                    <td className="py-1.5 px-2 text-right font-mono text-indigo-700 dark:text-indigo-400 font-semibold">{r.price}</td>
                    <td className="py-1.5 px-2 text-slate-500 dark:text-slate-500 font-mono text-[10px]">{r.src}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Раздел 2 — Оборудование */}
        <section className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">🔭 Раздел 2. Геодезическое оборудование</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b-2 border-indigo-300 dark:border-indigo-700">
                  <th className="text-left py-1.5 px-2 font-semibold text-indigo-800 dark:text-indigo-300">Прибор</th>
                  <th className="text-left py-1.5 px-2 font-semibold text-indigo-800 dark:text-indigo-300">Точность</th>
                  <th className="text-right py-1.5 px-2 font-semibold text-indigo-800 dark:text-indigo-300">Цена в РК (2025), тг</th>
                  <th className="text-left py-1.5 px-2 font-semibold text-indigo-800 dark:text-indigo-300">Применение</th>
                </tr>
              </thead>
              <tbody>
                {EQUIPMENT.map((e, i) => (
                  <tr key={i} className="border-b border-slate-100 dark:border-slate-800 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10">
                    <td className="py-1.5 px-2 text-slate-800 dark:text-slate-200 font-medium">{e.name}</td>
                    <td className="py-1.5 px-2 text-slate-600 dark:text-slate-400 font-mono">{e.acc}</td>
                    <td className="py-1.5 px-2 text-right font-mono text-indigo-700 dark:text-indigo-400 font-semibold">{e.price}</td>
                    <td className="py-1.5 px-2 text-slate-600 dark:text-slate-400">{e.use}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Раздел 3 — Допуски */}
        <section className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">📏 Раздел 3. Допуски геометрических параметров</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b-2 border-indigo-300 dark:border-indigo-700">
                  <th className="text-left py-1.5 px-2 font-semibold text-indigo-800 dark:text-indigo-300">Параметр</th>
                  <th className="text-left py-1.5 px-2 font-semibold text-indigo-800 dark:text-indigo-300">Допуск</th>
                  <th className="text-left py-1.5 px-2 font-semibold text-indigo-800 dark:text-indigo-300">Источник</th>
                </tr>
              </thead>
              <tbody>
                {TOLERANCES.map((t, i) => (
                  <tr key={i} className="border-b border-slate-100 dark:border-slate-800 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10">
                    <td className="py-1.5 px-2 text-slate-800 dark:text-slate-200">{t.p}</td>
                    <td className="py-1.5 px-2 font-mono font-semibold text-indigo-700 dark:text-indigo-400">{t.t}</td>
                    <td className="py-1.5 px-2 text-slate-500 dark:text-slate-500 font-mono text-[10px]">{t.src}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Раздел 4 — Упражнения */}
        <section className="bg-white dark:bg-slate-900 border-2 border-indigo-300 dark:border-indigo-700 rounded-xl p-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">🎯 Раздел 4. Интерактивные упражнения</h2>

          {allDone ? (
            <div className="py-8 text-center">
              <div className="text-5xl mb-3">📐</div>
              <h3 className="text-lg font-bold text-indigo-800 dark:text-indigo-300 mb-2">Геодезия освоена!</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">Все 4 упражнения пройдены.</p>
              <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg p-3 text-left mb-4 text-[11px] space-y-1">
                {EXERCISES.map(s => (
                  <div key={s.id} className="flex gap-2">
                    <span className="text-emerald-500">✓</span>
                    <code className="text-[10px] font-mono text-indigo-700 dark:text-indigo-400">{s.vor}</code>
                  </div>
                ))}
              </div>
              <button
                onClick={() => { sxi(0); ssi(0); setInp({}); setRev({}); setDone(new Set()); setChoice({}); }}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700"
              >
                Пройти заново
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-1 flex-wrap mb-3">
                {EXERCISES.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => { sxi(i); ssi(0); setInp({}); setRev({}); }}
                    className={`text-[10px] px-2.5 py-1 rounded font-semibold ${
                      i === xi
                        ? "bg-indigo-600 text-white"
                        : done.has(s.id)
                        ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                    }`}
                  >
                    {done.has(s.id) ? "✓ " : ""}Упр. {i + 1}
                  </button>
                ))}
              </div>

              <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-slate-50 dark:bg-slate-800/50">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">{ex.title}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">{ex.q}</p>

                {isInput && ex.ss && ex.ss.length > 1 && (
                  <div className="flex gap-1 mb-3">
                    {ex.ss.map((_, i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full ${
                          i < si ? "bg-indigo-500" : i === si ? "bg-indigo-300" : "bg-slate-200 dark:bg-slate-700"
                        }`}
                      />
                    ))}
                  </div>
                )}

                {!done.has(ex.id) ? (
                  isInput && step ? (
                    <div className={`border-2 rounded-lg p-3 ${ok ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20" : err ? "border-red-300 bg-red-50 dark:bg-red-900/20" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"}`}>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                        Шаг {si + 1}/{ex.ss!.length}: {step.l}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={inp[k] ?? ""}
                          onChange={e => setInp(p => ({ ...p, [k]: e.target.value }))}
                          onKeyDown={e => e.key === "Enter" && !rev[k] && go()}
                          disabled={!!rev[k]}
                          placeholder="Число..."
                          className="flex-1 border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                        />
                        {!rev[k] && (
                          <button
                            onClick={go}
                            disabled={!inp[k]?.trim()}
                            className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded hover:bg-indigo-700 disabled:opacity-40"
                          >
                            Проверить
                          </button>
                        )}
                      </div>
                      {rev[k] && (
                        <div className={`mt-2 text-xs leading-relaxed ${ok ? "text-emerald-800 dark:text-emerald-300" : "text-red-800 dark:text-red-300"}`}>
                          {ok ? "✓ " : "✗ "}{step.e}
                        </div>
                      )}
                      {err && (
                        <button
                          onClick={() => { setInp(p => ({ ...p, [k]: "" })); setRev(r => ({ ...r, [k]: false })); }}
                          className="mt-1 text-[10px] text-amber-700 dark:text-amber-400 underline"
                        >
                          Попробовать снова
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className={`border-2 rounded-lg p-3 ${ok ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20" : err ? "border-red-300 bg-red-50 dark:bg-red-900/20" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"}`}>
                      <div className="space-y-1.5 mb-2">
                        {ex.variants?.map(v => (
                          <label
                            key={v.id}
                            className={`flex gap-2 items-start p-2 rounded cursor-pointer text-xs border ${
                              choice[ex.id] === v.id
                                ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 dark:border-indigo-500"
                                : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                            } ${rev[k] ? "pointer-events-none" : ""}`}
                          >
                            <input
                              type="radio"
                              name={ex.id}
                              value={v.id}
                              checked={choice[ex.id] === v.id}
                              onChange={() => setChoice(c => ({ ...c, [ex.id]: v.id }))}
                              disabled={!!rev[k]}
                              className="mt-0.5"
                            />
                            <span className="text-slate-700 dark:text-slate-300"><b>{v.id})</b> {v.label}</span>
                          </label>
                        ))}
                      </div>
                      {!rev[k] && (
                        <button
                          onClick={go}
                          disabled={!choice[ex.id]}
                          className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded hover:bg-indigo-700 disabled:opacity-40"
                        >
                          Проверить
                        </button>
                      )}
                      {rev[k] && (
                        <div className={`mt-2 text-xs leading-relaxed ${ok ? "text-emerald-800 dark:text-emerald-300" : "text-red-800 dark:text-red-300"}`}>
                          {ok ? "✓ Верно. " : "✗ Не совсем. "}{ex.explain}
                        </div>
                      )}
                      {err && (
                        <button
                          onClick={() => { setChoice(c => ({ ...c, [ex.id]: "" })); setRev(r => ({ ...r, [k]: false })); }}
                          className="mt-1 text-[10px] text-amber-700 dark:text-amber-400 underline"
                        >
                          Попробовать снова
                        </button>
                      )}
                    </div>
                  )
                ) : (
                  <div className="border-2 border-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-700 rounded-lg p-3">
                    <div className="text-xs font-bold text-indigo-800 dark:text-indigo-300 mb-1">✓ Завершено</div>
                    <code className="text-[10px] font-mono text-indigo-700 dark:text-indigo-400 block">{ex.vor}</code>
                  </div>
                )}

                {ex.theory && (
                  <div className="mt-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded p-2 text-[11px] text-indigo-800 dark:text-indigo-300">
                    📖 {ex.theory}
                  </div>
                )}

                {done.has(ex.id) && xi + 1 < EXERCISES.length && (
                  <button
                    onClick={() => { sxi(xi + 1); ssi(0); setInp({}); setRev({}); }}
                    className="mt-3 w-full py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700"
                  >
                    Следующее упражнение →
                  </button>
                )}
              </div>
            </>
          )}
        </section>

        {/* Раздел 5 — Документация */}
        <section className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">📑 Раздел 5. Документация по геодезии</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded p-2">
              <div className="font-semibold text-indigo-800 dark:text-indigo-300">Журнал геодезических работ</div>
              <div className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">Ежедневная запись измерений</div>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded p-2">
              <div className="font-semibold text-indigo-800 dark:text-indigo-300">Исполнительная геодезическая съёмка</div>
              <div className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">После каждого этапа</div>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded p-2">
              <div className="font-semibold text-indigo-800 dark:text-indigo-300">Журнал нивелирования</div>
              <div className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">По результатам ходов</div>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded p-2">
              <div className="font-semibold text-indigo-800 dark:text-indigo-300">Сводная геодезическая исполнительная схема</div>
              <div className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">На сдачу объекта</div>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded p-2 md:col-span-2">
              <div className="font-semibold text-indigo-800 dark:text-indigo-300">Расчёт точности геодезических работ</div>
              <div className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">Раздел ПОС</div>
            </div>
          </div>
        </section>

        {/* Чек-лист */}
        <section className="bg-white dark:bg-slate-900 border-2 border-indigo-300 dark:border-indigo-700 rounded-xl p-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
            ✅ Чек-лист «Геодезия — что должно быть»
            <span className="ml-2 text-xs font-normal text-indigo-600 dark:text-indigo-400">
              {check8.filter(Boolean).length}/8
            </span>
          </h2>
          <div className="space-y-1.5">
            {checklist.map((item, i) => (
              <label
                key={i}
                className="flex gap-2 items-start cursor-pointer text-xs hover:bg-indigo-50 dark:hover:bg-indigo-900/10 p-1.5 rounded"
              >
                <input
                  type="checkbox"
                  checked={check8[i]}
                  onChange={() => setCheck8(arr => arr.map((v, j) => j === i ? !v : v))}
                  className="mt-0.5"
                />
                <span className={check8[i] ? "text-slate-400 dark:text-slate-500 line-through" : "text-slate-700 dark:text-slate-300"}>
                  {item}
                </span>
              </label>
            ))}
          </div>
        </section>

        {/* Фактоид */}
        <section className="bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-400 dark:border-indigo-600 rounded-xl p-4">
          <div className="text-xs text-indigo-800 dark:text-indigo-300 leading-relaxed">
            <span className="text-base">💡</span> <b>Геодезия — НЕ отдельная стройка, а ПОСТОЯННАЯ работа</b> в ходе всего проекта.
            Закладывай в смету:
            <ul className="list-disc list-inside mt-1 space-y-0.5 pl-2">
              <li><b>1.5 – 2%</b> от СМР для типовых объектов (школы, ЖК эконом)</li>
              <li><b>2 – 3%</b> для высотных зданий (мониторинг осадок, контроль вертикальности)</li>
              <li><b>3 – 5%</b> для реставрации памятников (лазерное сканирование, 3D-обмеры)</li>
            </ul>
          </div>
        </section>

      </div>
    </div>
  );
}
