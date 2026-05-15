"use client";
import Link from "next/link";
import { useState } from "react";

function check(i: string, a: string[], tol = 0.1) {
  const v = parseFloat(i.replace(",", "."));
  return a.some((x) => {
    const e = parseFloat(x.replace(",", "."));
    return !isNaN(v) && !isNaN(e) && Math.abs((v - e) / e) <= tol;
  });
}

interface Step {
  id: string;
  l: string;
  a: string[];
  e: string;
  tol?: number;
}
interface Exercise {
  id: string;
  title: string;
  q: string;
  ss: Step[];
  vor: string;
  theory: string;
  variant?: "calc" | "choice";
  options?: { id: string; label: string }[];
  correct?: string;
}

const NORMS: { code: string; title: string }[] = [
  { code: "ГОСТ 14782-86", title: "Контроль ультразвуковой сварных соединений" },
  { code: "ГОСТ 7512-82", title: "Контроль радиографический сварных соединений" },
  { code: "ГОСТ 3242-79", title: "Соединения сварные. Методы контроля качества" },
  { code: "СНиП РК 5.04-23-2002", title: "«Стальные конструкции»" },
  { code: "РД 03-606-03", title: "Инструкция по визуальному и измерительному контролю" },
];

const METHODS: {
  method: string;
  code: string;
  detect: string;
  cost: string;
  use: string;
}[] = [
  {
    method: "Визуальный осмотр (ВИК)",
    code: "RT",
    detect: "Поверхностные дефекты, геометрия",
    cost: "Включён в работу сварщика",
    use: "Все сварные швы",
  },
  {
    method: "Цветная дефектоскопия (капиллярная)",
    code: "PT",
    detect: "Поверхностные трещины ≥ 0.05 мм",
    cost: "350-650 тг/100мм шва",
    use: "Поверхностные швы",
  },
  {
    method: "Магнитопорошковая",
    code: "MT",
    detect: "Поверхностные/подповерхностные дефекты",
    cost: "280-450 тг/100мм",
    use: "Только ферромагнитные стали",
  },
  {
    method: "Ультразвуковой контроль (УЗК)",
    code: "UT",
    detect: "Внутренние дефекты от 1.5-2 мм",
    cost: "1 200-2 800 тг/м шва",
    use: "Толстостенные швы > 6 мм",
  },
  {
    method: "Радиографический (рентген)",
    code: "RT",
    detect: "Внутренние дефекты от 1 мм",
    cost: "4 500-8 500 тг/м шва",
    use: "Ответственные конструкции, трубопроводы",
  },
  {
    method: "Гидравлические испытания",
    code: "—",
    detect: "Герметичность",
    cost: "12 000-25 000 тг за тест",
    use: "Трубопроводы, резервуары",
  },
  {
    method: "Пневматические испытания",
    code: "—",
    detect: "Герметичность газовых сетей",
    cost: "18 000-35 000 тг за тест",
    use: "Газопроводы",
  },
  {
    method: "Механические испытания (на образцах)",
    code: "—",
    detect: "Прочность шва",
    cost: "35 000-65 000 тг/проба",
    use: "Аттестация сварщиков",
  },
];

const CATEGORIES: { cat: string; pct: string; use: string }[] = [
  {
    cat: "I категория",
    pct: "100%",
    use: "Несущие, ответственные конструкции, газопроводы ВД",
  },
  {
    cat: "II категория",
    pct: "25% (выборочно)",
    use: "Несущие второстепенные, теплосеть, водопровод",
  },
  { cat: "III категория", pct: "10%", use: "Ограждающие, второстепенные" },
  { cat: "IV категория", pct: "5%", use: "Технологические, малонагруженные" },
];

const DEFECTS: { name: string; desc: string }[] = [
  {
    name: "Трещины (продольные, поперечные)",
    desc: "Самый опасный дефект, не допускается во ВСЕХ категориях.",
  },
  {
    name: "Поры (одиночные, групповые)",
    desc: "В I кат. ≤ 2 шт/м, в II-III кат. ≤ 4 шт/м.",
  },
  { name: "Шлаковые включения", desc: "Допуск зависит от размера и категории шва." },
  {
    name: "Непровары",
    desc: "Отсутствие полного провара корня шва, не допускаются в I-II кат.",
  },
  {
    name: "Подрезы",
    desc: "Углубления вдоль шва: ≤ 0.5 мм для I кат., ≤ 1 мм для II кат.",
  },
  { name: "Прожоги", desc: "Сквозные отверстия в шве — недопустимы." },
  { name: "Натёки и брызги", desc: "Устранимы зачисткой, не критичны." },
  {
    name: "Смещение кромок",
    desc: "Допустимо ≤ толщины/4 (например, при толщине 8 мм — до 2 мм).",
  },
];

const STEPS: Exercise[] = [
  {
    id: "ex1-uzk-pipe",
    title: "Упражнение 1: Стоимость УЗК для трубопровода теплосети",
    q: `Трубопровод теплосети Ø108 мм, длина 200 м.п.
Трубы поставляются длиной 6 м → 1 стык на 6 м.
Категория швов: II (25% контроля).
Тариф УЗК: 2 000 тг/м (среднее).

Длина шва на стыке = π · 0.108 = 0.34 м.

Рассчитайте стоимость УЗК (только УЗК, без визуального осмотра).`,
    ss: [
      {
        id: "cost",
        l: "Стоимость УЗК, тг",
        a: ["5600", "5 600", "5600.0"],
        e:
          "Кол-во стыков: 200/6 ≈ 33 шт. Длина швов: 33 · 0.34 = 11.2 м. Под контроль (II кат., 25%): 11.2 · 0.25 = 2.8 м. Стоимость: 2.8 · 2 000 = 5 600 тг. С учётом обязательного визуального ВИК всех стыков: + 33 · 350 = 11 550 тг → итого 17 150 тг.",
        tol: 0.1,
      },
    ],
    vor: "УЗК сварных стыков теплосети Ø108 (200 м.п., II кат.): 2.8 м · 2 000 = 5 600 тг (ГОСТ 14782-86)",
    theory:
      "Тариф УЗК даётся на 1 м.п. шва, а не на стык. Для расчёта длины шва кольцевого стыка используют формулу окружности π·D. Объём контроля — по категории шва (СНиП РК 5.04-23-2002).",
    variant: "calc",
  },
  {
    id: "ex2-method-gas",
    title:
      "Упражнение 2: Метод контроля для сварного шва газопровода НД Ø110 ПЭ",
    q: `На объекте смонтирован газопровод низкого давления из полиэтиленовых труб Ø110.
Сварка муфтовая (электросварные муфты) и встык (нагретым инструментом).

Какой метод контроля применить?`,
    ss: [
      {
        id: "method",
        l: "Выберите правильный метод",
        a: ["c"],
        e:
          "Гидравлические/пневматические испытания. Для ПЭ-труб рентген НЕ применяется (полимер прозрачен для гамма-излучения, дефекты не визуализируются), УЗК малоинформативен для пластика. Контроль ПЭ-стыков: визуальный + испытание давлением (СП 42-103-2003, СН РК 4.03-08-2010).",
      },
    ],
    vor: "Контроль ПЭ-газопровода НД Ø110: визуальный осмотр + гидро/пневмоиспытания (СН РК 4.03-08-2010)",
    theory:
      "ПЭ-трубы не контролируются рентгеном или УЗК — материал не имеет нужных акустических/радиационных характеристик. Только испытание давлением + визуальный контроль валика расплава.",
    variant: "choice",
    options: [
      { id: "a", label: "УЗК (ультразвуковой контроль)" },
      { id: "b", label: "Радиографический (рентген)" },
      { id: "c", label: "Гидравлические/пневматические испытания" },
      { id: "d", label: "Цветная дефектоскопия (капиллярная)" },
    ],
    correct: "c",
  },
  {
    id: "ex3-attest",
    title: "Упражнение 3: Затраты на аттестацию бригады сварщиков (в месяц)",
    q: `Бригада: 4 сварщика.
Стоимость аттестации НАКС: 60 000 тг/чел (среднее).
Срок действия удостоверения: 2 года = 24 месяца.

Рассчитайте средние затраты на аттестацию в пересчёте на месяц (тг/мес).`,
    ss: [
      {
        id: "perMonth",
        l: "Затраты на аттестацию, тг/мес",
        a: ["10000", "10 000", "10000.0"],
        e:
          "Общая стоимость: 4 · 60 000 = 240 000 тг. На 24 месяца действия: 240 000 / 24 = 10 000 тг/мес. Эта статья закладывается в накладные расходы либо в обоснование индивидуальной расценки на сварку.",
        tol: 0.1,
      },
    ],
    vor: "Аттестация НАКС бригады (4 чел · 60 000 тг / 24 мес): 10 000 тг/мес (накладные)",
    theory:
      "Без удостоверения НАКС сварщик не допускается к ответственным работам (I-II категория швов). Расходы на аттестацию — обоснованная статья накладных расходов подрядчика.",
    variant: "calc",
  },
  {
    id: "ex4-pores",
    title: "Упражнение 4: Допустимое количество пор в шве II категории",
    q: `Контролируется сварной шов II категории, длина 5 м.
Норма (ГОСТ 3242-79, II кат.): не более 4 пор на 1 м шва.

Какое максимально допустимое количество пор на всей длине?`,
    ss: [
      {
        id: "pores",
        l: "Допустимое количество пор, шт",
        a: ["20"],
        e:
          "II кат.: ≤ 4 пор/м. На 5 м шва: 5 · 4 = 20 пор. Если фактически больше — шов идёт на переварку. Критично: считается допуск по групповым порам, одиночные крупные поры (> допустимого размера) — отдельный критерий браковки.",
        tol: 0,
      },
    ],
    vor: "Допуск по порам шва II кат. (5 м): 5 · 4 = 20 шт (ГОСТ 3242-79)",
    theory:
      "Поры — газовые включения, образуются при загрязнении кромок, влажных электродах, неверной полярности. Допустимое количество жёстко регламентировано категорией шва и толщиной металла.",
    variant: "calc",
  },
];

const CHECKLIST: string[] = [
  "Удостоверения НАКС у всех сварщиков",
  "Технологическая карта сварки (PQR)",
  "Журнал сварочных работ (ежедневный)",
  "Сертификаты сварочной проволоки/электродов",
  "Акты ВИК (визуального осмотра)",
  "Протоколы УЗК / РК / гидроиспытаний (по проекту)",
  "Заключение специализированной лаборатории (для I-II кат.)",
  "Сводный акт приёмки сварных работ",
];

export default function WeldControlPage() {
  const [xi, sxi] = useState(0);
  const [si, ssi] = useState(0);
  const [inp, setInp] = useState<Record<string, string>>({});
  const [rev, setRev] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Set<string>>(new Set());
  const [checks, setChecks] = useState<Set<number>>(new Set());

  const ex = STEPS[xi];
  const step = ex.ss[si];
  const k = `${ex.id}-${step.id}`;
  const tol = step.tol ?? 0.1;
  const ok = rev[k] && check(inp[k] ?? "", step.a, tol);
  const err = rev[k] && !ok;

  function go() {
    setRev((r) => ({ ...r, [k]: true }));
    if (check(inp[k] ?? "", step.a, tol)) {
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

  function pickChoice(optId: string) {
    setInp((p) => ({ ...p, [k]: optId }));
    setRev((r) => ({ ...r, [k]: true }));
    if (optId === ex.correct) {
      setTimeout(() => setDone((d) => new Set([...d, ex.id])), 700);
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

  const choiceCorrect =
    ex.variant === "choice" && rev[k] && inp[k] === ex.correct;
  const choiceWrong =
    ex.variant === "choice" && rev[k] && inp[k] !== ex.correct;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-zinc-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-xs text-zinc-200 hover:text-white"
          >
            ← К разделам
          </Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold">
              🔥 Контроль сварных соединений — УЗК, рентген, цветная дефектоскопия
            </h1>
            <p className="text-[10px] text-zinc-300">
              ГОСТ 14782-86 · ГОСТ 7512-82 · ГОСТ 3242-79 · СНиП РК 5.04-23-2002 ·
              РД 03-606-03
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Введение */}
        <section className="bg-white dark:bg-slate-900 border-l-4 border-zinc-500 rounded-lg p-4 shadow-sm">
          <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-2">
            📌 Зачем нужен контроль сварных соединений
          </h2>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mb-2">
            Контроль сварных соединений — обязательная процедура для:
          </p>
          <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1 list-disc list-inside mb-2">
            <li>Металлоконструкций несущих (балки, колонны, рамы)</li>
            <li>Трубопроводов под давлением (теплосеть, газопровод)</li>
            <li>Сварных стыков арматуры в ж/б</li>
            <li>Резервуаров и ёмкостей</li>
          </ul>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            Без актов контроля — конструкции в эксплуатацию{" "}
            <b className="text-red-700 dark:text-red-400">НЕ ВВОДЯТСЯ</b>.
            <br />В смете отдельной статьёй: стоимость контроля{" "}
            <b className="text-zinc-800 dark:text-zinc-200">3-8% от стоимости сварки</b>.
          </p>
        </section>

        {/* Нормативная база */}
        <section className="bg-white dark:bg-slate-900 border-l-4 border-zinc-500 rounded-lg p-4 shadow-sm">
          <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-2">
            📋 Нормативная база
          </h2>
          <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
            {NORMS.map((n) => (
              <li key={n.code}>
                <b className="text-zinc-700 dark:text-zinc-300">{n.code}</b> — {n.title}
              </li>
            ))}
          </ul>
        </section>

        {/* Раздел 1: Методы контроля */}
        <section className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg p-4 shadow-sm">
          <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-200 mb-3">
            Раздел 1. Методы контроля сварных соединений
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-100 dark:bg-zinc-900/40">
                  <th className="border border-zinc-300 dark:border-slate-700 px-2 py-1.5 text-left text-zinc-800 dark:text-zinc-200">
                    Метод
                  </th>
                  <th className="border border-zinc-300 dark:border-slate-700 px-2 py-1.5 text-left text-zinc-800 dark:text-zinc-200">
                    Шифр
                  </th>
                  <th className="border border-zinc-300 dark:border-slate-700 px-2 py-1.5 text-left text-zinc-800 dark:text-zinc-200">
                    Что выявляет
                  </th>
                  <th className="border border-zinc-300 dark:border-slate-700 px-2 py-1.5 text-left text-zinc-800 dark:text-zinc-200">
                    Стоимость
                  </th>
                  <th className="border border-zinc-300 dark:border-slate-700 px-2 py-1.5 text-left text-zinc-800 dark:text-zinc-200">
                    Применение
                  </th>
                </tr>
              </thead>
              <tbody>
                {METHODS.map((r) => (
                  <tr
                    key={r.method}
                    className="hover:bg-zinc-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="border border-zinc-300 dark:border-slate-700 px-2 py-1 text-zinc-800 dark:text-zinc-200 font-semibold">
                      {r.method}
                    </td>
                    <td className="border border-zinc-300 dark:border-slate-700 px-2 py-1 font-mono text-[11px] text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                      {r.code}
                    </td>
                    <td className="border border-zinc-300 dark:border-slate-700 px-2 py-1 text-slate-700 dark:text-slate-300">
                      {r.detect}
                    </td>
                    <td className="border border-zinc-300 dark:border-slate-700 px-2 py-1 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {r.cost}
                    </td>
                    <td className="border border-zinc-300 dark:border-slate-700 px-2 py-1 text-slate-600 dark:text-slate-400">
                      {r.use}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Раздел 2: Объёмы контроля */}
        <section className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg p-4 shadow-sm">
          <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-200 mb-3">
            Раздел 2. Объёмы контроля по категориям швов
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-100 dark:bg-zinc-900/40">
                  <th className="border border-zinc-300 dark:border-slate-700 px-2 py-1.5 text-left text-zinc-800 dark:text-zinc-200">
                    Категория шва
                  </th>
                  <th className="border border-zinc-300 dark:border-slate-700 px-2 py-1.5 text-left text-zinc-800 dark:text-zinc-200">
                    % швов под контроль УЗК
                  </th>
                  <th className="border border-zinc-300 dark:border-slate-700 px-2 py-1.5 text-left text-zinc-800 dark:text-zinc-200">
                    Применение
                  </th>
                </tr>
              </thead>
              <tbody>
                {CATEGORIES.map((r) => (
                  <tr
                    key={r.cat}
                    className="hover:bg-zinc-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="border border-zinc-300 dark:border-slate-700 px-2 py-1 font-bold text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                      {r.cat}
                    </td>
                    <td className="border border-zinc-300 dark:border-slate-700 px-2 py-1 font-mono text-zinc-800 dark:text-zinc-200 whitespace-nowrap">
                      {r.pct}
                    </td>
                    <td className="border border-zinc-300 dark:border-slate-700 px-2 py-1 text-slate-700 dark:text-slate-300">
                      {r.use}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Раздел 3: Дефекты */}
        <section className="space-y-3">
          <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-200">
            Раздел 3. Дефекты сварных швов
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {DEFECTS.map((d) => (
              <div
                key={d.name}
                className="bg-zinc-100 dark:bg-zinc-900/30 border border-zinc-300 dark:border-zinc-700 rounded-lg p-3"
              >
                <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-1">
                  {d.name}
                </h3>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {d.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Раздел 4: Аттестация сварщиков */}
        <section className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg p-4 shadow-sm">
          <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-200 mb-3">
            Раздел 4. Аттестация сварщиков (НАКС)
          </h2>
          <div className="bg-zinc-100 dark:bg-zinc-900/30 border border-zinc-300 dark:border-zinc-700 rounded-lg p-3">
            <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5 list-disc list-inside">
              <li>
                <b className="text-zinc-800 dark:text-zinc-200">НАКС</b> — Национальное
                агентство контроля сварки (российская система, действует и в РК)
              </li>
              <li>
                <b className="text-zinc-800 dark:text-zinc-200">5 уровней</b> (1 —
                простые работы, 5 — сложные ответственные конструкции)
              </li>
              <li>
                Аттестация на конкретный материал + способ сварки + положение шва
              </li>
              <li>
                <b className="text-zinc-800 dark:text-zinc-200">Срок действия:</b> 2
                года, далее переаттестация
              </li>
              <li>
                <b className="text-zinc-800 dark:text-zinc-200">Стоимость:</b> 35 000-85
                000 тг/сварщик/уровень
              </li>
              <li className="text-red-700 dark:text-red-400 font-semibold">
                Без удостоверения НАКС сварщик НЕ ДОПУСКАЕТСЯ к ответственным работам
              </li>
            </ul>
          </div>
        </section>

        {/* Раздел 5: Упражнения */}
        <section className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg p-4 shadow-sm">
          <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-200 mb-3">
            Раздел 5. Интерактивные упражнения ({done.size}/{STEPS.length})
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
                    ? "bg-zinc-600 text-white"
                    : done.has(s.id)
                    ? "bg-zinc-200 dark:bg-zinc-900/40 text-zinc-800 dark:text-zinc-300"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {done.has(s.id) ? "✓ " : ""}
                Упр. {i + 1}
              </button>
            ))}
          </div>

          <div className="border-l-4 border-zinc-400 pl-3">
            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-1">
              {ex.title}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3 whitespace-pre-line">
              {ex.q}
            </p>

            {!done.has(ex.id) ? (
              ex.variant === "choice" && ex.options ? (
                <div
                  className={`border-2 rounded-lg p-3 ${
                    choiceCorrect
                      ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20"
                      : choiceWrong
                      ? "border-red-300 bg-red-50 dark:bg-red-900/20"
                      : "border-zinc-200 dark:border-slate-700"
                  }`}
                >
                  <div className="space-y-1.5">
                    {ex.options.map((opt) => {
                      const picked = inp[k] === opt.id;
                      const isCorrect = opt.id === ex.correct;
                      const showResult = rev[k];
                      return (
                        <button
                          key={opt.id}
                          onClick={() => !rev[k] && pickChoice(opt.id)}
                          disabled={!!rev[k]}
                          className={`w-full text-left text-xs px-3 py-2 rounded border transition ${
                            showResult && isCorrect
                              ? "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-400 text-emerald-900 dark:text-emerald-200"
                              : showResult && picked && !isCorrect
                              ? "bg-red-100 dark:bg-red-900/30 border-red-400 text-red-900 dark:text-red-200"
                              : picked
                              ? "bg-zinc-200 dark:bg-zinc-800 border-zinc-400 text-zinc-900 dark:text-zinc-200"
                              : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-zinc-50 dark:hover:bg-slate-700"
                          }`}
                        >
                          <span className="font-mono mr-2 text-zinc-500 dark:text-zinc-400">
                            {opt.id})
                          </span>
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  {rev[k] && (
                    <div
                      className={`mt-2 text-xs leading-relaxed ${
                        choiceCorrect
                          ? "text-emerald-800 dark:text-emerald-300"
                          : "text-red-800 dark:text-red-300"
                      }`}
                    >
                      {choiceCorrect ? "✓ " : "✗ "}
                      {step.e}
                    </div>
                  )}
                  {choiceWrong && (
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
                <div
                  className={`border-2 rounded-lg p-3 ${
                    ok
                      ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20"
                      : err
                      ? "border-red-300 bg-red-50 dark:bg-red-900/20"
                      : "border-zinc-200 dark:border-slate-700"
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
                      className="flex-1 border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                    />
                    {!rev[k] && (
                      <button
                        onClick={go}
                        disabled={!inp[k]?.trim()}
                        className="px-3 py-1.5 bg-zinc-600 text-white text-xs font-semibold rounded hover:bg-zinc-700 disabled:opacity-40"
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
              )
            ) : (
              <div className="border-2 border-zinc-400 bg-zinc-100 dark:bg-zinc-900/30 rounded-lg p-3">
                <div className="text-xs font-bold text-zinc-800 dark:text-zinc-300 mb-1">
                  ✓ Завершено
                </div>
                <code className="text-[10px] font-mono text-zinc-700 dark:text-zinc-300 block">
                  {ex.vor}
                </code>
              </div>
            )}

            <div className="mt-2 bg-zinc-50 dark:bg-zinc-900/20 border border-zinc-200 dark:border-zinc-700 rounded p-2 text-[11px] text-zinc-700 dark:text-zinc-300">
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
                className="mt-3 w-full py-2 bg-zinc-600 text-white text-sm font-semibold rounded-lg hover:bg-zinc-700"
              >
                Следующее упражнение →
              </button>
            )}
          </div>
        </section>

        {/* Чек-лист */}
        <section className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg p-4 shadow-sm">
          <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-200 mb-3">
            Чек-лист «Контроль сварки — что должно быть»
          </h2>
          <ul className="space-y-1.5">
            {CHECKLIST.map((item, i) => (
              <li key={i}>
                <button
                  onClick={() => toggleCheck(i)}
                  className="flex items-start gap-2 text-left w-full hover:bg-zinc-50 dark:hover:bg-slate-800/40 rounded px-1.5 py-1"
                >
                  <span
                    className={`flex-shrink-0 w-4 h-4 mt-0.5 border-2 rounded text-[10px] font-bold flex items-center justify-center ${
                      checks.has(i)
                        ? "bg-zinc-600 border-zinc-600 text-white"
                        : "border-zinc-400 dark:border-zinc-500"
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
        <section className="bg-zinc-100 dark:bg-zinc-900/30 border-l-4 border-zinc-500 rounded-lg p-4 shadow-sm">
          <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-2">
            💡 ВНИМАНИЕ
          </h2>
          <p className="text-xs text-zinc-900 dark:text-zinc-200 leading-relaxed">
            Сварной шов с дефектами — это потенциальная авария. Стоимость переделки
            сварки в эксплуатируемой конструкции в{" "}
            <b>50-100 раз выше</b> стоимости предотвращения через контроль. Никогда не
            экономь на УЗК и аттестации сварщиков.
          </p>
        </section>
      </div>
    </div>
  );
}
