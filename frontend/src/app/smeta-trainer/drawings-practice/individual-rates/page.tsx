"use client";
import Link from "next/link";
import { useState } from "react";

function check(i: string, a: string[], tol = 0.02) {
  const v = parseFloat(i.replace(",", "."));
  return a.some((x) => {
    const e = parseFloat(x.replace(",", "."));
    return !isNaN(v) && !isNaN(e) && Math.abs((v - e) / e) < tol;
  });
}

interface Step {
  id: string;
  l: string;
  a: string[];
  e: string;
}
interface Exercise {
  id: string;
  title: string;
  q: string;
  ss: Step[];
  vor: string;
  theory: string;
}

const STRUCT_ROWS: { n: string; art: string; cont: string; src: string }[] = [
  {
    n: "1",
    art: "Прямые затраты — материалы",
    cont: "По спецификации проекта",
    src: "ССЦ РК + первичные документы",
  },
  {
    n: "2",
    art: "Прямые затраты — ФОТ",
    cont: "По нормам выработки + тарифные ставки",
    src: "ЕНиР РК + штатное расписание",
  },
  {
    n: "3",
    art: "Прямые затраты — машины",
    cont: "Маш-час × количество",
    src: "СНиР Сб.81",
  },
  {
    n: "4",
    art: "Накладные расходы",
    cont: "% от ФОТ (зависит от типа работ)",
    src: "МДС 81-33",
  },
  {
    n: "5",
    art: "Сметная прибыль",
    cont: "% от ФОТ + НР",
    src: "МДС 81-25",
  },
  {
    n: "6",
    art: "Лимит затрат на материалы (если применим)",
    cont: "По проекту",
    src: "—",
  },
  {
    n: "7",
    art: "Стоимость работ в текущих ценах (× индекс)",
    cont: "Применить квартальный индекс",
    src: "ССЦ РК 8.04",
  },
  {
    n: "8",
    art: "НДС 12%",
    cont: "После всех расчётов",
    src: "НК РК",
  },
];

const STAGES: { n: string; title: string; body: string }[] = [
  {
    n: "1",
    title: "ОПИСАНИЕ ТЕХНОЛОГИИ",
    body:
      "Подробно расписать, какие операции включает работа.\nНапример: «Облицовка фасада плитами природного камня размером 400×600×30 мм на стальных кронштейнах с предварительной обработкой швов герметиком».",
  },
  {
    n: "2",
    title: "РАЗРАБОТКА ТЕХНОЛОГИЧЕСКОЙ КАРТЫ (ТК)",
    body:
      "Указать последовательность операций, оборудование, материалы.\nПривязка к нормам выработки (если есть аналогичные в ЕНиР).",
  },
  {
    n: "3",
    title: "РАСЧЁТ ТРУДОЗАТРАТ",
    body:
      "Время на единицу работ × разряд работников × часовая ставка.\nДопускается приведение к аналогичным расценкам ЭСН.",
  },
  {
    n: "4",
    title: "РАСЧЁТ МАТЕРИАЛОВ",
    body:
      "По спецификации с учётом нормативных потерь.\nНапример: камень 1.05 (отходы) + клей 4 кг/м² + герметик 0.05 кг/м.п.",
  },
  {
    n: "5",
    title: "РАСЧЁТ ТРАНСПОРТА И МАШИН",
    body:
      "Стоимость аренды или расчёт по СНиР Сб.81.\nВключить: погрузка, доставка, разгрузка, монтаж/демонтаж.",
  },
  {
    n: "6",
    title: "ОФОРМЛЕНИЕ В ВИДЕ КАРТЫ ИНДИВИДУАЛЬНОЙ РАСЦЕНКИ",
    body:
      "Шаблон утверждённый Госкомстатом РФ (применяется в РК).\nПодпись: исполнитель + ГИП + проверяющий.",
  },
  {
    n: "7",
    title: "СОГЛАСОВАНИЕ",
    body:
      "С техническим надзором заказчика — обязательно ДО начала работ.\nИзменения после начала работ — только дополнительными соглашениями.",
  },
];

const EXAMPLE_LINES: { l: string; v: string; sect?: boolean; total?: boolean }[] = [
  { l: "МАТЕРИАЛЫ:", v: "", sect: true },
  { l: "  Травертин 400×600×30 (105 м² с отходами 5%)", v: "1 575 000" },
  { l: "  Кронштейны нерж. сталь L-образ. (200 шт × 850 тг)", v: "170 000" },
  { l: "  Анкеры химические (200 шт × 350 тг)", v: "70 000" },
  { l: "  Герметик силиконовый бесцв. (3 кг × 5500 тг)", v: "16 500" },
  { l: "  Сетка пароветрозащитная (105 м² × 320 тг)", v: "33 600" },
  { l: "  ИТОГО МАТЕРИАЛЫ:", v: "1 865 100", total: true },
  { l: "ФОТ:", v: "", sect: true },
  { l: "  Каменщик-монтажник 5 разряд (35 чел.час × 2851 тг)", v: "99 785" },
  { l: "  Подсобный рабочий 2 разряд (15 чел.час × 2008 тг)", v: "30 120" },
  { l: "  ИТОГО ФОТ:", v: "129 905", total: true },
  { l: "МАШИНЫ И МЕХАНИЗМЫ:", v: "", sect: true },
  { l: "  Леса инвентарные (2 дня × 5800 тг)", v: "11 600" },
  { l: "  Перфоратор (15 час × 380 тг)", v: "5 700" },
  { l: "  ИТОГО МАШИНЫ:", v: "17 300", total: true },
  { l: "ПРЯМЫЕ ЗАТРАТЫ ИТОГО (на 100 м²):", v: "2 012 305", total: true },
  { l: "+ НР 105% × ФОТ × 0.5:", v: "68 200" },
  { l: "+ СП 75% × ФОТ × 0.5:", v: "48 700" },
  { l: "СТОИМОСТЬ В ЦЕНАХ 2025:", v: "2 129 205", total: true },
  { l: "ИЛИ за 1 м² фасада:", v: "21 292", total: true },
];

const STEPS: Exercise[] = [
  {
    id: "ex1-fot",
    title: "Упражнение 1: Расчёт ФОТ для индивидуальной расценки",
    q: `Облицовка фасада природным камнем по индивидуальной расценке.
Нормы выработки:
  • монтажник 5 разряда: 0.35 чел.час/м²
  • подсобный рабочий 2 разряда: 0.15 чел.час/м²

Объём работ: 200 м² фасада.
Тарифные ставки: 5 разр. = 2851 тг/час, 2 разр. = 2008 тг/час.

Рассчитайте ФОТ (в тг).`,
    ss: [
      {
        id: "fot",
        l: "ФОТ, тг",
        a: ["259800", "259 800", "259800.0"],
        e: "ФОТ = 200 · (0.35·2851 + 0.15·2008) = 200 · (998 + 301) = 200 · 1299 = 259 800 тг. Ставки берутся из штатного расписания подрядчика, утверждённого ГИП.",
      },
    ],
    vor: "ФОТ для индивидуальной расценки И-1 (облицовка камнем 200 м²): 259 800 тг (ЕНиР Е8 + штатное расписание)",
    theory:
      "ФОТ — основа индивидуальной расценки. От него считают НР и СП. Тарифные ставки берутся из штатного расписания, согласованного с ГИП заказчика.",
  },
  {
    id: "ex2-mat",
    title: "Упражнение 2: Расчёт стоимости материала с отходами",
    q: `Облицовка фасада природным камнем.
Площадь облицовки: 100 м².
Норма расхода материала: 1 м²/м² фасада.
Отходы и подгонка: 5% (К=1.05).
Цена материала: 15 000 тг/м² (по прайс-листу поставщика).

Рассчитайте стоимость материала (в тг).`,
    ss: [
      {
        id: "mat",
        l: "Стоимость материала, тг",
        a: ["1575000", "1 575 000", "1575000.0"],
        e: "Стоимость = 100 · 1.05 · 15 000 = 1 575 000 тг. Коэффициент потерь 1.05 — стандартное значение для облицовочных работ. Для штучных нестандартных материалов может доходить до 1.10-1.15.",
      },
    ],
    vor: "Материал — травертин с отходами 5% (100 м²): 1 575 000 тг (ССЦ РК + прайс поставщика)",
    theory:
      "Норма потерь для индивидуальных расценок берётся из технологической карты или СН РК. Без обоснования заказчик не примет К > 1.05.",
  },
  {
    id: "ex3-full",
    title: "Упражнение 3: Полная стоимость индивидуальной расценки",
    q: `Индивидуальная расценка И-2.
Прямые затраты (материалы + ФОТ + машины) = 2 000 000 тг.
В том числе ФОТ = 100 000 тг.
НР: 100% от ФОТ × 0.5 = 50 000 тг.
СП: 70% от ФОТ × 0.5 = 35 000 тг.

Рассчитайте итоговую стоимость индивидуальной расценки (в тг).`,
    ss: [
      {
        id: "full",
        l: "Итого по расценке, тг",
        a: ["2085000", "2 085 000", "2085000.0"],
        e: "Итого = 2 000 000 + 50 000 + 35 000 = 2 085 000 тг. Коэффициент 0.5 к НР и СП применяется для индивидуальных расценок (МДС 81-25 п. 4.6) — снижение из-за отсутствия рисков типового производства.",
      },
    ],
    vor: "Итоговая стоимость индивидуальной расценки И-2: 2 085 000 тг (МДС 81-25 п. 4.6)",
    theory:
      "К индивидуальным расценкам всегда применяется понижающий коэффициент 0.5 к НР и СП. Это компенсирует «замкнутый» характер расценки (нет общестроительных накладных).",
  },
];

const CHECKLIST: string[] = [
  "Утверждённая технологическая карта с расчётом ресурсов",
  "Согласие тех.надзора на использование индивидуальной расценки",
  "Прайс-лист от поставщика материалов (для подтверждения цены)",
  "Протокол согласования цены с заказчиком",
  "Подписи ГИП проектировщика и инженера ПТО",
  "Журнал учёта индивидуальных расценок объекта",
  "Включение в дополнительное соглашение к договору (если контракт уже подписан)",
];

export default function IndividualRatesPage() {
  const [xi, sxi] = useState(0);
  const [si, ssi] = useState(0);
  const [inp, setInp] = useState<Record<string, string>>({});
  const [rev, setRev] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Set<string>>(new Set());
  const [checks, setChecks] = useState<Set<number>>(new Set());

  const ex = STEPS[xi];
  const step = ex.ss[si];
  const k = `${ex.id}-${step.id}`;
  const ok = rev[k] && check(inp[k] ?? "", step.a);
  const err = rev[k] && !ok;

  function go() {
    setRev((r) => ({ ...r, [k]: true }));
    if (check(inp[k] ?? "", step.a)) {
      setTimeout(() => {
        if (si + 1 < ex.ss.length) {
          ssi(si + 1);
          setRev({});
        } else {
          setDone((d) => new Set([...d, ex.id]));
        }
      }, 700);
    }
  }

  function toggleCheck(i: number) {
    setChecks((c) => {
      const n = new Set(c);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  }

  return (
    <div className="min-h-screen bg-cyan-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-cyan-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-xs text-cyan-200 hover:text-white"
          >
            ← К разделам
          </Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold">
              📝 Индивидуальные расценки — когда ЭСН не подходит
            </h1>
            <p className="text-[10px] text-cyan-200">
              МДС 81-25.2004 п. 4.6 · МДС 81-3.99 · СН РК 1.04-26
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Введение */}
        <section className="bg-cyan-50 dark:bg-cyan-900/20 border-l-4 border-cyan-500 rounded-lg p-4 shadow-sm">
          <h2 className="text-sm font-bold text-cyan-800 dark:text-cyan-300 mb-2">
            📌 КОГДА НУЖНЫ ИНДИВИДУАЛЬНЫЕ РАСЦЕНКИ?
          </h2>
          <ol className="text-xs text-cyan-900 dark:text-cyan-200 space-y-1.5 list-decimal list-inside leading-relaxed">
            <li>Уникальные технологии (например, фанерные купола, лазерная резка стали)</li>
            <li>Применение нового оборудования с расходом, отличным от ЭСН</li>
            <li>Специфические условия работ (большая глубина, высота, теснота)</li>
            <li>Реставрация памятников (ручные работы, аутентичные технологии)</li>
            <li>Объекты культурного наследия с ограничениями</li>
          </ol>
          <p className="mt-3 text-xs text-red-800 dark:text-red-300 leading-relaxed">
            ❌ <b>НЕ применять для типовых работ</b> — даже если есть желание «оптимизировать».
            Базовые расценки ЭСН РК нужно использовать в первую очередь.
          </p>
        </section>

        {/* Нормативный блок */}
        <section className="bg-white dark:bg-slate-900 border-l-4 border-cyan-500 rounded-lg p-4 shadow-sm">
          <h2 className="text-sm font-bold text-cyan-800 dark:text-cyan-300 mb-2">
            📋 Нормативная база
          </h2>
          <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
            <li>
              <b className="text-cyan-700 dark:text-cyan-300">МДС 81-25.2004 п. 4.6</b> — порядок
              составления индивидуальных расценок
            </li>
            <li>
              <b className="text-cyan-700 dark:text-cyan-300">МДС 81-3.99</b> — методика расчёта
              стоимости маш-часа
            </li>
            <li>
              <b className="text-cyan-700 dark:text-cyan-300">СН РК 1.04-26</b> — для
              реставрационных работ
            </li>
            <li>
              <b className="text-cyan-700 dark:text-cyan-300">Согласование:</b> главным инженером
              заказчика и техническим надзором
            </li>
          </ul>
        </section>

        {/* Раздел 1: Структура */}
        <section className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg p-4 shadow-sm">
          <h2 className="text-base font-bold text-cyan-800 dark:text-cyan-300 mb-3">
            Раздел 1. Структура индивидуальной расценки
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-cyan-50 dark:bg-cyan-900/30">
                  <th className="border border-cyan-300 dark:border-slate-700 px-2 py-1.5 text-left text-cyan-800 dark:text-cyan-200 w-10">
                    №
                  </th>
                  <th className="border border-cyan-300 dark:border-slate-700 px-2 py-1.5 text-left text-cyan-800 dark:text-cyan-200">
                    Статья
                  </th>
                  <th className="border border-cyan-300 dark:border-slate-700 px-2 py-1.5 text-left text-cyan-800 dark:text-cyan-200">
                    Содержание
                  </th>
                  <th className="border border-cyan-300 dark:border-slate-700 px-2 py-1.5 text-left text-cyan-800 dark:text-cyan-200">
                    Источник
                  </th>
                </tr>
              </thead>
              <tbody>
                {STRUCT_ROWS.map((r) => (
                  <tr
                    key={r.n}
                    className="hover:bg-cyan-50/40 dark:hover:bg-slate-800/50"
                  >
                    <td className="border border-cyan-300 dark:border-slate-700 px-2 py-1 font-mono font-bold text-cyan-700 dark:text-cyan-300 text-center">
                      {r.n}
                    </td>
                    <td className="border border-cyan-300 dark:border-slate-700 px-2 py-1 text-slate-700 dark:text-slate-300 font-semibold">
                      {r.art}
                    </td>
                    <td className="border border-cyan-300 dark:border-slate-700 px-2 py-1 text-slate-600 dark:text-slate-400">
                      {r.cont}
                    </td>
                    <td className="border border-cyan-300 dark:border-slate-700 px-2 py-1 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {r.src}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Раздел 2: Этапы */}
        <section className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg p-4 shadow-sm">
          <h2 className="text-base font-bold text-cyan-800 dark:text-cyan-300 mb-3">
            Раздел 2. Этапы составления индивидуальной расценки
          </h2>
          <ol className="space-y-3">
            {STAGES.map((s) => (
              <li
                key={s.n}
                className="bg-cyan-50/60 dark:bg-cyan-900/20 border-l-4 border-cyan-400 rounded p-3"
              >
                <div className="flex gap-2 items-start">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-600 text-white text-xs font-bold flex items-center justify-center">
                    {s.n}
                  </span>
                  <div className="flex-1">
                    <h3 className="text-xs font-bold text-cyan-800 dark:text-cyan-300 mb-1">
                      {s.title}
                    </h3>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                      {s.body}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Раздел 3: Пример */}
        <section className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg p-4 shadow-sm">
          <h2 className="text-base font-bold text-cyan-800 dark:text-cyan-300 mb-3">
            Раздел 3. Пример индивидуальной расценки
          </h2>
          <div className="bg-cyan-50/40 dark:bg-cyan-900/10 border border-cyan-300 dark:border-cyan-700 rounded-lg p-3">
            <div className="border-b border-cyan-300 dark:border-cyan-700 pb-2 mb-2">
              <h3 className="text-sm font-bold text-cyan-800 dark:text-cyan-300">
                ИНДИВИДУАЛЬНАЯ РАСЦЕНКА И-1
              </h3>
              <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">
                Облицовка фасада плитами природного камня (травертин) 400×600×30 мм на стальных
                кронштейнах ВентФасада
              </p>
              <p className="text-[11px] text-cyan-700 dark:text-cyan-400 italic mt-0.5">
                Единица измерения: 100 м² фасада
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono border-collapse">
                <thead>
                  <tr className="bg-cyan-100 dark:bg-cyan-900/40">
                    <th className="border border-cyan-300 dark:border-cyan-700 px-2 py-1.5 text-left text-cyan-800 dark:text-cyan-200">
                      Состав затрат
                    </th>
                    <th className="border border-cyan-300 dark:border-cyan-700 px-2 py-1.5 text-right text-cyan-800 dark:text-cyan-200 w-32">
                      Сумма, тг
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {EXAMPLE_LINES.map((row, i) => (
                    <tr
                      key={i}
                      className={
                        row.sect
                          ? "bg-cyan-100/60 dark:bg-cyan-900/30 font-bold"
                          : row.total
                          ? "bg-cyan-50 dark:bg-cyan-900/20 font-semibold"
                          : ""
                      }
                    >
                      <td className="border border-cyan-200 dark:border-cyan-800 px-2 py-1 text-slate-700 dark:text-slate-300 whitespace-pre">
                        {row.l}
                      </td>
                      <td className="border border-cyan-200 dark:border-cyan-800 px-2 py-1 text-right text-slate-700 dark:text-slate-300">
                        {row.v}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Раздел 4: Упражнения */}
        <section className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg p-4 shadow-sm">
          <h2 className="text-base font-bold text-cyan-800 dark:text-cyan-300 mb-3">
            Раздел 4. Интерактивные упражнения ({done.size}/{STEPS.length})
          </h2>

          {/* Tabs */}
          <div className="flex gap-1 flex-wrap mb-3">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => {
                  sxi(i);
                  ssi(0);
                  setInp({});
                  setRev({});
                }}
                className={`text-[10px] px-2 py-1 rounded font-semibold ${
                  i === xi
                    ? "bg-cyan-600 text-white"
                    : done.has(s.id)
                    ? "bg-cyan-100 dark:bg-cyan-900/40 text-cyan-800 dark:text-cyan-300"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {done.has(s.id) ? "✓ " : ""}
                Упр. {i + 1}
              </button>
            ))}
          </div>

          <div className="border-l-4 border-cyan-400 pl-3">
            <h3 className="text-sm font-bold text-cyan-800 dark:text-cyan-300 mb-1">
              {ex.title}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3 whitespace-pre-line">
              {ex.q}
            </p>

            {ex.ss.length > 1 && (
              <div className="flex gap-1 mb-3">
                {ex.ss.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full ${
                      i < si
                        ? "bg-cyan-500"
                        : i === si
                        ? "bg-cyan-300"
                        : "bg-slate-200 dark:bg-slate-700"
                    }`}
                  />
                ))}
              </div>
            )}

            {!done.has(ex.id) ? (
              <div
                className={`border-2 rounded-lg p-3 ${
                  ok
                    ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20"
                    : err
                    ? "border-red-300 bg-red-50 dark:bg-red-900/20"
                    : "border-cyan-200 dark:border-slate-700"
                }`}
              >
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Шаг {si + 1}/{ex.ss.length}: {step.l}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inp[k] ?? ""}
                    onChange={(e) =>
                      setInp((p) => ({ ...p, [k]: e.target.value }))
                    }
                    onKeyDown={(e) => e.key === "Enter" && !rev[k] && go()}
                    disabled={!!rev[k]}
                    placeholder="Число..."
                    className="flex-1 border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                  />
                  {!rev[k] && (
                    <button
                      onClick={go}
                      disabled={!inp[k]?.trim()}
                      className="px-3 py-1.5 bg-cyan-600 text-white text-xs font-semibold rounded hover:bg-cyan-700 disabled:opacity-40"
                    >
                      Проверить
                    </button>
                  )}
                </div>
                {rev[k] && (
                  <div
                    className={`mt-2 text-xs leading-relaxed ${
                      ok
                        ? "text-emerald-800 dark:text-emerald-300"
                        : "text-red-800 dark:text-red-300"
                    }`}
                  >
                    {ok ? "✓ " : "✗ "}
                    {step.e}
                  </div>
                )}
                {err && (
                  <button
                    onClick={() => {
                      setInp((p) => ({ ...p, [k]: "" }));
                      setRev((r) => ({ ...r, [k]: false }));
                    }}
                    className="mt-1 text-[10px] text-amber-700 underline"
                  >
                    Попробовать снова
                  </button>
                )}
              </div>
            ) : (
              <div className="border-2 border-cyan-400 bg-cyan-50 dark:bg-cyan-900/30 rounded-lg p-3">
                <div className="text-xs font-bold text-cyan-800 dark:text-cyan-300 mb-1">
                  ✓ Завершено
                </div>
                <code className="text-[10px] font-mono text-cyan-700 dark:text-cyan-300 block">
                  {ex.vor}
                </code>
              </div>
            )}

            <div className="mt-2 bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-700 rounded p-2 text-[11px] text-cyan-800 dark:text-cyan-300">
              📖 {ex.theory}
            </div>

            {done.has(ex.id) && xi + 1 < STEPS.length && (
              <button
                onClick={() => {
                  sxi(xi + 1);
                  ssi(0);
                  setInp({});
                  setRev({});
                }}
                className="mt-3 w-full py-2 bg-cyan-600 text-white text-sm font-semibold rounded-lg hover:bg-cyan-700"
              >
                Следующее упражнение →
              </button>
            )}
          </div>
        </section>

        {/* Раздел 5: Чек-лист */}
        <section className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg p-4 shadow-sm">
          <h2 className="text-base font-bold text-cyan-800 dark:text-cyan-300 mb-3">
            Раздел 5. Чек-лист согласования индивидуальной расценки
          </h2>
          <ul className="space-y-1.5">
            {CHECKLIST.map((item, i) => (
              <li key={i}>
                <button
                  onClick={() => toggleCheck(i)}
                  className="flex items-start gap-2 text-left w-full hover:bg-cyan-50 dark:hover:bg-slate-800/40 rounded px-1.5 py-1"
                >
                  <span
                    className={`flex-shrink-0 w-4 h-4 mt-0.5 border-2 rounded text-[10px] font-bold flex items-center justify-center ${
                      checks.has(i)
                        ? "bg-cyan-600 border-cyan-600 text-white"
                        : "border-cyan-400 dark:border-cyan-500"
                    }`}
                  >
                    {checks.has(i) ? "✓" : ""}
                  </span>
                  <span
                    className={`text-xs leading-relaxed ${
                      checks.has(i)
                        ? "text-slate-400 dark:text-slate-500 line-through"
                        : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {item}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* Фактоид */}
        <section className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <h2 className="text-sm font-bold text-red-800 dark:text-red-300 mb-2">
            ⚠ ОСТОРОЖНО
          </h2>
          <p className="text-xs text-red-900 dark:text-red-200 leading-relaxed">
            Чрезмерное применение индивидуальных расценок (<b>&gt;10% сметы</b>) — основание для
            отказа в согласовании сметы заказчиком. Сначала исчерпай все возможности применения{" "}
            <b>ЭСН с коэффициентами</b>.
          </p>
        </section>
      </div>
    </div>
  );
}
