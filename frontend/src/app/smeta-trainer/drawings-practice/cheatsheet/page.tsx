"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * Шпаргалка-плакат сметчика РК.
 * Все ключевые формулы, коэффициенты и расценки на одной странице.
 * Печатается как A1 портрет (594×841 mm) и вешается над рабочим местом.
 */

type SectionId =
  | "formulas"
  | "soils"
  | "slopes"
  | "kr"
  | "kz"
  | "cables"
  | "water"
  | "sewage"
  | "heating"
  | "gas"
  | "esn"
  | "overhead"
  | "tariffs"
  | "concrete-cover"
  | "index"
  | "trench-width"
  | "winter-period"
  | "documents"
  | "ratios";

interface Section {
  id: SectionId;
  icon: string;
  title: string;
  tone: "amber" | "yellow" | "orange" | "lime" | "stone";
  rows: { k?: string; v: string }[];
}

const SECTIONS: Section[] = [
  {
    id: "formulas",
    icon: "🧮",
    title: "Формулы расчёта объёмов",
    tone: "amber",
    rows: [
      { k: "V призматоида",   v: "((F₁ + F₂) / 2) · h" },
      { k: "V котлована",     v: "((F_низа + F_верха) / 2) · h" },
      { k: "F верха",         v: "(a + 2·m·h) · (b + 2·m·h)" },
      { k: "V траншеи",       v: "((b + b+2·m·h) / 2) · h · L" },
      { k: "V цилиндра",      v: "π · r² · h" },
      { k: "F трубы (изол.)", v: "π · (D + 2t) · L" },
      { k: "V наклон. призмы",v: "F · L" },
      { k: "L кровли с укл.", v: "L_горизонт. / cos(α)" },
    ],
  },
  {
    id: "soils",
    icon: "🪨",
    title: "Категории грунтов",
    tone: "stone",
    rows: [
      { k: "I",    v: "лёгкие — рыхлый песок, торф, лёгкий суглинок" },
      { k: "II",   v: "средние — суглинок, лёсс, супесь, гравий" },
      { k: "III",  v: "тяжёлые — тяжёлый суглинок, плотная глина" },
      { k: "IV",   v: "мёрзлый, скала разрыхлённая" },
      { k: "V-VI", v: "скала средн.-крепкая (только взрыв)" },
      { k: "VII",  v: "крепкая скала (E > 7000)" },
    ],
  },
  {
    id: "slopes",
    icon: "📐",
    title: "Откосы (СНиП РК 5.01-03 Табл.1)",
    tone: "yellow",
    rows: [
      { k: "h ≤ 1.5 м",   v: "суглинок 0:1 · песок 1:0.5" },
      { k: "h = 1.5-3 м", v: "суглинок 1:0.5 · глина 1:0.25" },
      { k: "h = 3-5 м",   v: "суглинок 1:0.75 · глина 1:0.5" },
    ],
  },
  {
    id: "kr",
    icon: "🔢",
    title: "Кр (коэф. разрыхления)",
    tone: "orange",
    rows: [
      { k: "Песок, супесь",            v: "1.10-1.15" },
      { k: "Суглинок лёгкий",          v: "1.12-1.18" },
      { k: "Сугл. тяжёлый, глина мяг.",v: "1.18-1.24" },
      { k: "Глина жирная, твёрдая",    v: "1.24-1.30" },
      { k: "Скала разрыхлённая",       v: "1.30-1.45" },
      { k: "Скала крепкая",            v: "1.45-1.50" },
    ],
  },
  {
    id: "kz",
    icon: "❄️",
    title: "Кз (зимние коэффициенты)",
    tone: "amber",
    rows: [
      { k: "Бетон + электропрогрев",     v: "1.20-1.30" },
      { k: "Бетон + добавки",            v: "1.15-1.25" },
      { k: "Кладка + тепляки",           v: "1.18-1.30" },
      { k: "Земляные мёрзлые",           v: "1.30-1.60" },
      { k: "Кровля рулонная",            v: "1.20-1.30" },
      { k: "Штукатурка внутри без отопл.", v: "1.05-1.10" },
    ],
  },
  {
    id: "cables",
    icon: "⚡",
    title: "ПУЭ — кабельные траншеи",
    tone: "yellow",
    rows: [
      { k: "Глубина",            v: "≥ 0.7 м (до 35 кВ); 0.5 м (до 1 кВ без проезда)" },
      { k: "Расст. между каб.",  v: "≥ 100 мм" },
      { k: "Песок",              v: "100 мм снизу + 100 мм сверху" },
      { k: "Защита",             v: "кирпич глиняный, ЛСО-450 на h+250" },
    ],
  },
  {
    id: "water",
    icon: "💧",
    title: "ХВС / ГВС минимальные глубины",
    tone: "amber",
    rows: [
      { k: "ХВС Алматы",   v: "1.7-2.0 м (h_пром + 0.5)" },
      { k: "ХВС Астана",   v: "2.5-2.8 м (h_пром + 0.5)" },
      { k: "ГВС",          v: "то же + изоляция" },
      { k: "Канализация",  v: "h_пром + 0.3 м" },
    ],
  },
  {
    id: "sewage",
    icon: "🚰",
    title: "Канализация (СНиП РК 4.01-41)",
    tone: "lime",
    rows: [
      { k: "Уклон Ø150",        v: "i = 0.008" },
      { k: "Уклон Ø200",        v: "i = 0.005" },
      { k: "Уклон Ø300",        v: "i = 0.003" },
      { k: "Колодцы Ø200",      v: "≤ 50 м между ними" },
    ],
  },
  {
    id: "heating",
    icon: "♨️",
    title: "Тепловые сети (СП РК 4.02-42)",
    tone: "orange",
    rows: [
      { k: "Глубина бесканал.",   v: "≥ 0.7 м" },
      { k: "Изол. Ø108 (95°C)",   v: "минвата 60 мм" },
      { k: "Опоры Ø108",          v: "через 6 м" },
      { k: "Расст. между труб.",  v: "≥ 100 мм" },
    ],
  },
  {
    id: "gas",
    icon: "🔥",
    title: "Газ (СНиП РК 4.03-01)",
    tone: "amber",
    rows: [
      { k: "НД",               v: "0.8-1.0 м глубина" },
      { k: "СД",               v: "1.0-1.2 м" },
      { k: "ВД",               v: "1.5 м" },
      { k: "Лента ЛСО-450",    v: "жёлтая, h ≥ 200 над трубой" },
      { k: "Футляр на пересеч.", v: "+5 м с каждой стороны" },
    ],
  },
  {
    id: "esn",
    icon: "📋",
    title: "Расценки ЭСН — основные сборники",
    tone: "stone",
    rows: [
      { k: "Сб.1",  v: "Земляные работы" },
      { k: "Сб.6",  v: "Бетон и ж/б монолитный" },
      { k: "Сб.7",  v: "Бетон и ж/б сборный" },
      { k: "Сб.8",  v: "Кирпич и блоки" },
      { k: "Сб.10", v: "Окна, двери" },
      { k: "Сб.12", v: "Кровли" },
      { k: "Сб.15", v: "Отделочные работы" },
      { k: "Сб.16", v: "Водопровод и канализация (внутр.)" },
      { k: "Сб.20", v: "Вентиляция" },
      { k: "Сб.22", v: "Канализация наружная" },
      { k: "Сб.24", v: "Тепловые сети, газ" },
      { k: "Сб.26", v: "Изоляция трубопроводов" },
      { k: "Сб.27", v: "Дороги" },
      { k: "Сб.46", v: "Реконструкция, демонтаж" },
      { k: "Сб.47", v: "Озеленение" },
    ],
  },
  {
    id: "overhead",
    icon: "💼",
    title: "Накладные и СП (МДС 81-33)",
    tone: "yellow",
    rows: [
      { k: "НР типовое здание",     v: "95 %" },
      { k: "НР сложное",            v: "105 %" },
      { k: "НР реконструкция",      v: "120 %" },
      { k: "СП бюджетные",          v: "50 %" },
      { k: "СП коммерческие",       v: "65 %" },
      { k: "СП сложные",            v: "75-85 %" },
    ],
  },
  {
    id: "tariffs",
    icon: "🏷",
    title: "Тарифы по разрядам (РК 2025)",
    tone: "amber",
    rows: [
      { k: "1 разр.", v: "1850 тг/час" },
      { k: "2 разр.", v: "2008 тг/час (×1.085)" },
      { k: "3 разр.", v: "2200 тг/час (×1.189)" },
      { k: "4 разр.", v: "2472 тг/час (×1.336)" },
      { k: "5 разр.", v: "2851 тг/час (×1.541)" },
      { k: "6 разр.", v: "3317 тг/час (×1.793)" },
    ],
  },
  {
    id: "concrete-cover",
    icon: "📐",
    title: "Защитный слой бетона (мин.)",
    tone: "stone",
    rows: [
      { k: "Фундамент",      v: "50 мм нижний, 25 мм боковой" },
      { k: "Колонна",        v: "25 мм" },
      { k: "Балка",          v: "25 мм" },
      { k: "Перекрытие",     v: "25 мм осн., 20 мм верхний" },
      { k: "Стена",          v: "25 мм" },
      { k: "Подвал агресс.", v: "50 мм" },
    ],
  },
  {
    id: "index",
    icon: "📊",
    title: "Индекс перехода (Алматы Q3 2025)",
    tone: "orange",
    rows: [
      { k: "Общий",    v: "11.42" },
      { k: "Земляные", v: "11.05" },
      { k: "Бетонные", v: "11.85" },
      { k: "Кладка",   v: "11.95" },
      { k: "Окна",     v: "12.20" },
      { k: "Кровля",   v: "11.65" },
      { k: "Отделка",  v: "11.42" },
      { k: "Дороги",   v: "10.85" },
    ],
  },
  {
    id: "trench-width",
    icon: "🔧",
    title: "Ширина траншей (СНиП РК 3.05.04)",
    tone: "lime",
    rows: [
      { k: "Сталь Ø ≤ 200",       v: "Ø + 0.5 м (мин. 0.7)" },
      { k: "Сталь Ø 200-700",     v: "Ø + 0.8 м" },
      { k: "Сталь Ø 700-1500",    v: "Ø + 1.0 м" },
      { k: "ПВХ безнапорная",     v: "Ø + 0.5 м" },
      { k: "Ж/б раструб. Ø ≤ 700",v: "Ø + 1.2 м (мин. 0.9)" },
    ],
  },
  {
    id: "winter-period",
    icon: "⏱",
    title: "Зимний период по регионам",
    tone: "amber",
    rows: [
      { k: "Алматы / Шымкент",     v: "01.11 - 31.03 (5 мес)" },
      { k: "Астана / Караганда",   v: "15.10 - 15.04 (6 мес)" },
      { k: "Атырау",               v: "01.12 - 28.02 (3 мес)" },
    ],
  },
  {
    id: "documents",
    icon: "📑",
    title: "Документы — что когда оформлять",
    tone: "yellow",
    rows: [
      { k: "АОСР", v: "до закрытия скрытых работ" },
      { k: "КС-2", v: "помесячно за выполненные работы" },
      { k: "КС-3", v: "одновременно с КС-2 для оплаты" },
      { k: "КС-6", v: "ежедневно (общий журнал)" },
      { k: "АОПС", v: "приёмка строит.продукции, на сдаче" },
      { k: "КС-11",v: "в государственную приёмочную комиссию" },
    ],
  },
  {
    id: "ratios",
    icon: "✅",
    title: "Соотношения для расходов",
    tone: "orange",
    rows: [
      { k: "НДС РК",            v: "12 %" },
      { k: "ОТ от ФОТ",         v: "0.4-1.0 %" },
      { k: "Резерв заказчика",  v: "2-3 % от СМР" },
      { k: "ВЗС (врем. здания)",v: "2.5-3.5 %" },
      { k: "ПИР новое",         v: "5-7 %" },
      { k: "ПИР реконструкция", v: "7-10 %" },
    ],
  },
];

// ── Цветовые карты для tone (статические — Tailwind JIT не подхватывает динамику)

const TONE_BG: Record<Section["tone"], string> = {
  amber:  "bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-700",
  yellow: "bg-yellow-50 dark:bg-yellow-950/40 border-yellow-400 dark:border-yellow-700",
  orange: "bg-orange-50 dark:bg-orange-950/40 border-orange-400 dark:border-orange-700",
  lime:   "bg-lime-50 dark:bg-lime-950/40 border-lime-400 dark:border-lime-700",
  stone:  "bg-stone-50 dark:bg-stone-900/60 border-stone-400 dark:border-stone-700",
};

const TONE_HEADER: Record<Section["tone"], string> = {
  amber:  "text-amber-900 dark:text-amber-200",
  yellow: "text-yellow-900 dark:text-yellow-200",
  orange: "text-orange-900 dark:text-orange-200",
  lime:   "text-lime-900 dark:text-lime-200",
  stone:  "text-stone-900 dark:text-stone-200",
};

const TONE_KEY: Record<Section["tone"], string> = {
  amber:  "text-amber-800 dark:text-amber-300",
  yellow: "text-yellow-800 dark:text-yellow-300",
  orange: "text-orange-800 dark:text-orange-300",
  lime:   "text-lime-800 dark:text-lime-300",
  stone:  "text-stone-700 dark:text-stone-300",
};

export default function CheatsheetPage() {
  const initialOpen = SECTIONS.reduce<Record<string, boolean>>((acc, s) => {
    acc[s.id] = true;
    return acc;
  }, {});
  const [open, setOpen] = useState<Record<string, boolean>>(initialOpen);

  const toggle = (id: SectionId) =>
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }));

  const expandAll = () =>
    setOpen(SECTIONS.reduce<Record<string, boolean>>((acc, s) => { acc[s.id] = true; return acc; }, {}));

  const collapseAll = () =>
    setOpen(SECTIONS.reduce<Record<string, boolean>>((acc, s) => { acc[s.id] = false; return acc; }, {}));

  const handlePrint = () => {
    if (typeof window !== "undefined") window.print();
  };

  return (
    <div className="min-h-screen bg-amber-50/40 dark:bg-stone-950 text-stone-900 dark:text-amber-100">
      {/* ── Header (скрывается при печати) ───────────────────────────────── */}
      <header className="no-print sticky top-0 z-10 border-b border-amber-300 dark:border-amber-800 bg-amber-100/80 dark:bg-stone-900/80 backdrop-blur">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-sm text-amber-900 dark:text-amber-300 hover:text-amber-700 dark:hover:text-amber-100 transition"
          >
            ← К разделам
          </Link>
          <span className="ml-auto flex flex-wrap items-center gap-2">
            <button
              onClick={expandAll}
              className="text-xs px-3 py-1.5 rounded border border-amber-400 dark:border-amber-700 text-amber-900 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900/40 transition"
            >
              Развернуть всё
            </button>
            <button
              onClick={collapseAll}
              className="text-xs px-3 py-1.5 rounded border border-amber-400 dark:border-amber-700 text-amber-900 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900/40 transition"
            >
              Свернуть всё
            </button>
            <button
              onClick={handlePrint}
              className="text-xs px-3 py-1.5 rounded bg-amber-600 dark:bg-amber-500 text-white font-semibold hover:bg-amber-700 dark:hover:bg-amber-400 transition shadow"
            >
              🖨 Распечатать как плакат (A1)
            </button>
          </span>
        </div>
      </header>

      {/* ── Печатная страница ────────────────────────────────────────────── */}
      <main className="print-page max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="text-center mb-6 sm:mb-8 print-title">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-amber-900 dark:text-amber-200 leading-tight">
            📜 Шпаргалка сметчика — формулы, коэф-ты, расценки
          </h1>
          <p className="mt-2 text-sm sm:text-base text-amber-800 dark:text-amber-300/90">
            AEVION Smeta Trainer · РК 2025-2026 · A1 портрет (594 × 841 мм)
          </p>
        </div>

        {/* ── Сетка карточек ──────────────────────────────────────────── */}
        <section className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 print-grid">
          {SECTIONS.map((s) => {
            const isOpen = open[s.id];
            return (
              <article
                key={s.id}
                className={`rounded-lg border-2 ${TONE_BG[s.tone]} shadow-sm print:shadow-none print:break-inside-avoid`}
              >
                <button
                  type="button"
                  onClick={() => toggle(s.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left ${TONE_HEADER[s.tone]} font-bold print:cursor-default`}
                >
                  <span className="text-lg">{s.icon}</span>
                  <span className="flex-1 text-sm sm:text-base leading-tight">{s.title}</span>
                  <span className="no-print text-xs opacity-70 select-none">
                    {isOpen ? "−" : "+"}
                  </span>
                </button>
                {(isOpen) && (
                  <div className="border-t border-amber-300/60 dark:border-amber-800/60 px-3 py-2">
                    <ul className="space-y-1 text-xs sm:text-sm">
                      {s.rows.map((r, i) => (
                        <li key={i} className="flex gap-2 leading-snug">
                          {r.k && (
                            <span className={`shrink-0 font-mono font-semibold ${TONE_KEY[s.tone]}`}>
                              {r.k}:
                            </span>
                          )}
                          <span className="text-stone-800 dark:text-amber-100/90">
                            {r.v}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {/* Печать: всегда показываем содержимое (даже если свернуто на экране) */}
                {!isOpen && (
                  <div className="hidden print:block border-t border-amber-300/60 px-3 py-2">
                    <ul className="space-y-1 text-xs">
                      {s.rows.map((r, i) => (
                        <li key={i} className="flex gap-2 leading-snug">
                          {r.k && (
                            <span className={`shrink-0 font-mono font-semibold ${TONE_KEY[s.tone]}`}>
                              {r.k}:
                            </span>
                          )}
                          <span className="text-stone-800">{r.v}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            );
          })}
        </section>

        {/* ── Золотой фактоид ─────────────────────────────────────────── */}
        <aside className="mt-8 print:mt-6 rounded-lg border-2 border-amber-500 bg-gradient-to-br from-amber-100 to-yellow-100 dark:from-amber-900/40 dark:to-yellow-900/30 dark:border-amber-600 px-5 py-4 shadow print:shadow-none print:break-inside-avoid">
          <p className="text-sm sm:text-base text-amber-900 dark:text-amber-100 leading-relaxed">
            <span className="font-bold">💡 Совет:</span> Распечатай и повесь над рабочим
            местом. <span className="font-semibold">90 % повседневных вопросов сметчика</span> отвечаются
            с этого плаката. Мнемоника: <span className="font-mono font-semibold">«земля = Сб.1, бетон = Сб.6, кладка = Сб.8, отделка = Сб.15»</span>.
          </p>
        </aside>

        <footer className="mt-6 print:mt-4 text-center text-[11px] text-amber-700 dark:text-amber-400/70 print:text-stone-600">
          AEVION Smeta Trainer · drawings-practice / cheatsheet · версия для печати A1 ·
          источники: СНиП РК · ЭСН РК · СП РК · ПУЭ · МДС 81-33 · ССЦ РК Q3 2025
        </footer>
      </main>

      {/* ── Стили печати: A1 портрет (594 × 841 мм) ──────────────────── */}
      <style jsx global>{`
        @media print {
          @page {
            size: 594mm 841mm;
            margin: 12mm;
          }
          html,
          body {
            background: #fffaf0 !important;
            color: #1c1917 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .print-page {
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            zoom: 0.9;
          }
          .print-title h1 {
            font-size: 22pt !important;
          }
          .print-title p {
            font-size: 10pt !important;
          }
          .print-grid {
            display: grid !important;
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
            gap: 6mm !important;
          }
          .print-grid article {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            box-shadow: none !important;
          }
          .print-grid article button {
            font-size: 11pt !important;
            padding: 4mm 4mm 2mm 4mm !important;
          }
          .print-grid article ul {
            font-size: 9.5pt !important;
            line-height: 1.25 !important;
          }
          aside {
            font-size: 10pt !important;
          }
          footer {
            font-size: 8pt !important;
          }
        }
      `}</style>
    </div>
  );
}
