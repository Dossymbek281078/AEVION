"use client";
import Link from "next/link";
import { useState } from "react";

function checkNum(input: string, answers: string[], tol = 0.05) {
  const v = parseFloat(input.replace(",", "."));
  if (isNaN(v)) return false;
  return answers.some(a => {
    const e = parseFloat(a.replace(",", "."));
    return !isNaN(e) && Math.abs((v - e) / e) <= tol;
  });
}

type NumExercise = {
  id: string;
  kind: "num";
  title: string;
  question: string;
  answers: string[];
  tol?: number;
  formula: string;
  explanation: string;
};

type MCExercise = {
  id: string;
  kind: "mc";
  title: string;
  question: string;
  options: { key: string; label: string }[];
  correct: string[]; // допустимые правильные ключи
  explanation: string;
};

type Exercise = NumExercise | MCExercise;

const EXERCISES: Exercise[] = [
  {
    id: "ex1",
    kind: "num",
    title: "Упражнение 1. Мощность котельной",
    question:
      "Жилой 9-этажный дом на 36 квартир. По норме 10 кВт/квартира с учётом ГВС и отопления. Найдите минимальную тепловую мощность котельной, кВт.",
    answers: ["360"],
    tol: 0.15,
    formula: "Q = n · q = 36 · 10 = 360 кВт (минимум, допуск 250–415 кВт)",
    explanation:
      "Норма СНиП РК 4.02-15: 10–12 кВт на квартиру с учётом ГВС и отопления. Для 36 квартир минимум 360 кВт; обычно принимают диапазон 250–360 кВт в зависимости от площади квартир и теплоизоляции фасадов. Допуск ±15% — типичный для предпроекта.",
  },
  {
    id: "ex2",
    kind: "num",
    title: "Упражнение 2. Стоимость крышной котельной 360 кВт",
    question:
      "Стоимость крышной котельной 360 кВт по укрупнённому расчёту: 60 000 тг/кВт + усиление кровли 1.5 млн + дымоход через кровлю 1.8 млн + проектирование 0.85 млн. Найдите ИТОГО, млн тг.",
    answers: ["25.75", "25", "25.7", "25.8"],
    tol: 0.2,
    formula:
      "C = 360 · 60 000 + 1 500 000 + 1 800 000 + 850 000 = 21 600 000 + 4 150 000 = 25 750 000 ≈ 25 млн тг",
    explanation:
      "Укрупнённый расчёт по объекту-аналогу (рынок РК 2025): 60 тыс. тг/кВт под ключ для крышной газовой котельной + индивидуальные работы по кровле и дымоходу. Допуск ±20% — типовой коридор для бюджетного решения на стадии Эскиза.",
  },
  {
    id: "ex3",
    kind: "num",
    title: "Упражнение 3. Срок ввода котельной в эксплуатацию",
    question:
      "Сроки: проектирование и согласования 3.5 мес, поставка оборудования 2.5 мес, монтаж 1.75 мес, пусконаладка и аттестация 1 мес. Найдите ВСЕГО, мес (последовательно).",
    answers: ["8.75", "8.5", "9", "8"],
    tol: 0.25,
    formula: "T = 3.5 + 2.5 + 1.75 + 1 = 8.75 мес (диапазон 7–10 мес от старта)",
    explanation:
      "Закладывайте 7–10 месяцев в график проекта. Часть этапов можно вести параллельно (поставка во время монтажа фундамента), но в РК согласования с КазТрансГаз + Газовая инспекция выпадают в критический путь. Допуск ±25%.",
  },
  {
    id: "ex4",
    kind: "mc",
    title: "Упражнение 4. Выбор типа котельной",
    question:
      "Новостройка: 9-этажный жилой дом без подвала, нет подключения к городской теплосети, площадка плотной городской застройки. Какой тип котельной выбрать?",
    options: [
      { key: "a", label: "a) Отдельностоящая на участке" },
      { key: "b", label: "b) Крышная" },
      { key: "c", label: "c) Встроенная в подвал" },
      { key: "d", label: "d) Любая — без разницы" },
    ],
    correct: ["b"],
    explanation:
      "Правильный ответ: b) Крышная. Подвала нет → встроенная отпадает. Плотная застройка → отдельностоящая невозможна (нужна своя территория и санзона). Крышная — типовое решение для жилых высоток в РК: проще согласование, нет потери полезной площади. Требует усиления кровли и вертикального газохода.",
  },
];

const ESN_ITEMS = [
  { code: "ЭСН РК Сб.36", title: "Котельные — монтаж котлов, насосов, баков, обвязка", unit: "компл./ед." },
  { code: "ЭСН РК Сб.39", title: "Электротехнические установки — ВРУ, щиты, кабельная разводка", unit: "т/100 м" },
  { code: "ЭСН РК Сб.24", title: "Газопроводы — наружные и внутренние, узлы учёта", unit: "м.п." },
  { code: "ЭСН РК Сб.26", title: "Тепловая изоляция оборудования и трубопроводов котельной", unit: "м²/м³" },
  { code: "ЭСН РК Сб.12", title: "Кровли — усиление под крышную котельную, проход дымохода", unit: "м²" },
];

const TYPES_TABLE = [
  {
    type: "Крышная (на кровле)",
    use: "Жилые многоэтажные, без подвала",
    notes: "Требует усиление кровли, газоход через шахту",
    cost: "15–25 млн тг (250 кВт)",
  },
  {
    type: "Встроенная (в подвал)",
    use: "Жилые с подвалом, общественные",
    notes: "Газоход вертикальный по фасаду",
    cost: "12–18 млн тг",
  },
  {
    type: "Отдельностоящая (на участке)",
    use: "Производственные, мощные",
    notes: "Свой газопровод, своя территория",
    cost: "18–35 млн тг + земля",
  },
  {
    type: "Блочно-модульная",
    use: "Временные, удалённые объекты",
    notes: "Заводская готовность, быстрый монтаж",
    cost: "12–22 млн тг + транспорт",
  },
];

const EQUIPMENT_250 = [
  { name: "Газовые котлы De Dietrich GT-330, 2 шт × 125 кВт", price: "9 000 000" },
  { name: "Дымовая труба нерж. Ø250 (с насадкой и оголовком)", price: "850 000" },
  { name: "Узел учёта газа G-100 (с корректором)", price: "1 250 000" },
  { name: "Питательные насосы 2 шт (1 резервный)", price: "580 000" },
  { name: "Бак-аккумулятор 1500 л", price: "850 000" },
  { name: "Циркуляционные насосы", price: "320 000" },
  { name: "Распределительный коллектор", price: "285 000" },
  { name: "Автоматика безопасности (датчики газа, температуры)", price: "750 000" },
  { name: "Электрощит ВРУ", price: "380 000" },
];

export default function BoilersPage() {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  function setInp(id: string, v: string) {
    setInputs(p => ({ ...p, [id]: v }));
  }
  function pickOpt(id: string, key: string) {
    setPicks(p => ({ ...p, [id]: key }));
  }
  function reveal(id: string) {
    setRevealed(r => ({ ...r, [id]: true }));
  }
  function reset(id: string) {
    setInputs(p => ({ ...p, [id]: "" }));
    setPicks(p => ({ ...p, [id]: "" }));
    setRevealed(r => ({ ...r, [id]: false }));
  }

  const doneCount = EXERCISES.filter(ex => {
    if (!revealed[ex.id]) return false;
    if (ex.kind === "num") return checkNum(inputs[ex.id] ?? "", ex.answers, ex.tol ?? 0.05);
    return ex.correct.includes(picks[ex.id] ?? "");
  }).length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-red-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-xs text-red-200 hover:text-white"
          >
            ← К разделам
          </Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold">
              🔥 Котельные — крышные, встроенные, отдельностоящие
            </h1>
            <p className="text-[10px] text-red-200">
              {doneCount}/{EXERCISES.length} упражнений решено
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Левая колонка: контент */}
        <div className="lg:col-span-2 space-y-4">
          {/* Intro */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2">
              Локальные котельные
            </h2>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              Локальные котельные применяются для объектов{" "}
              <b>без подключения к городской теплосети</b> или с собственным теплоснабжением.
              Различают <b>3 типа размещения</b> с разными требованиями к проекту: крышные,
              встроенные и отдельностоящие. Каждый тип имеет особенности по согласованию,
              нагрузке на конструкции и стоимости.
            </p>
          </div>

          {/* Норматив */}
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">📖</span>
              <h2 className="text-sm font-bold text-red-900 dark:text-red-200">
                Нормативная база
              </h2>
            </div>
            <ul className="text-xs text-red-900 dark:text-red-200 space-y-1.5 leading-relaxed list-disc pl-5">
              <li>
                <b>СНиП РК 4.02-15</b> «Котельные» — основной норматив по проектированию
                котельных установок РК.
              </li>
              <li>
                <b>СП РК 4.02-42</b> — свод правил по тепловым сетям и теплоснабжению.
              </li>
              <li>
                <b>ТР ТС 016/2011</b> «О безопасности аппаратов, работающих на газовом топливе» —
                требования к котлам и горелочным устройствам.
              </li>
              <li>
                <b>СН РК 1.04-08</b> «Газоснабжение зданий» — внутренние и наружные газопроводы,
                узлы учёта.
              </li>
            </ul>
          </div>

          {/* Раздел 1: Типы котельных */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
              📐 Раздел 1. Типы котельных
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-200">
                    <th className="border border-red-200 dark:border-red-800 px-2 py-1.5 text-left font-semibold">
                      Тип
                    </th>
                    <th className="border border-red-200 dark:border-red-800 px-2 py-1.5 text-left font-semibold">
                      Применение
                    </th>
                    <th className="border border-red-200 dark:border-red-800 px-2 py-1.5 text-left font-semibold">
                      Особенности
                    </th>
                    <th className="border border-red-200 dark:border-red-800 px-2 py-1.5 text-left font-semibold">
                      Стоимость 2025
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {TYPES_TABLE.map((row, i) => (
                    <tr
                      key={i}
                      className="text-slate-800 dark:text-slate-200 hover:bg-red-50 dark:hover:bg-red-900/10"
                    >
                      <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 font-semibold">
                        {row.type}
                      </td>
                      <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5">
                        {row.use}
                      </td>
                      <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5">
                        {row.notes}
                      </td>
                      <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 font-mono text-red-700 dark:text-red-300">
                        {row.cost}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Раздел 2: Оборудование 250 кВт */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
              ⚙️ Раздел 2. Оборудование для котельной 250 кВт
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3 italic">
              Типовая котельная для 9-этажного жилого дома
            </p>
            <ul className="space-y-1.5">
              {EQUIPMENT_250.map((it, i) => (
                <li
                  key={i}
                  className="flex justify-between items-baseline text-[11px] border-b border-dashed border-slate-200 dark:border-slate-700 pb-1"
                >
                  <span className="text-slate-700 dark:text-slate-300">{it.name}</span>
                  <span className="font-mono text-red-700 dark:text-red-300 font-semibold whitespace-nowrap pl-2">
                    {it.price} тг
                  </span>
                </li>
              ))}
              <li className="flex justify-between items-baseline text-xs pt-2 mt-2 border-t-2 border-red-300 dark:border-red-700">
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  ИТОГО (только оборудование)
                </span>
                <span className="font-mono text-red-800 dark:text-red-200 font-bold">
                  ~14 265 000 тг (~14.3 млн)
                </span>
              </li>
            </ul>
          </div>

          {/* Factoid */}
          <div className="bg-red-100 dark:bg-red-900/30 border-l-4 border-red-600 dark:border-red-500 rounded-r-xl p-4">
            <div className="flex items-start gap-2">
              <span className="text-xl leading-none">⚠️</span>
              <div>
                <h3 className="text-xs font-bold text-red-900 dark:text-red-100 mb-1">
                  Факт-якорь: разрешения занимают 3–6 месяцев
                </h3>
                <p className="text-[11px] text-red-900 dark:text-red-100 leading-relaxed">
                  Газовая котельная требует разрешения от <b>КазТрансГаз</b> +{" "}
                  <b>Газовой инспекции</b>. Сроки получения разрешений <b>3–6 мес</b> —
                  закладывай в график проекта в критический путь, иначе срыв ввода
                  гарантирован.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Правая колонка: упражнения + ЭСН */}
        <div className="space-y-3">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-3">
            <h2 className="text-xs font-bold text-red-900 dark:text-red-200">
              🧮 Раздел 3. Упражнения
            </h2>
            <p className="text-[10px] text-red-800 dark:text-red-300 mt-0.5">
              Закрепление: считай в уме, проверяй ответ
            </p>
          </div>

          {EXERCISES.map((ex, idx) => {
            const id = ex.id;
            const r = !!revealed[id];
            const ok =
              r &&
              (ex.kind === "num"
                ? checkNum(inputs[id] ?? "", ex.answers, ex.tol ?? 0.05)
                : ex.correct.includes(picks[id] ?? ""));
            const err = r && !ok;

            return (
              <div
                key={id}
                className={`bg-white dark:bg-slate-900 border rounded-xl p-3 ${
                  ok
                    ? "border-emerald-300 dark:border-emerald-700"
                    : err
                    ? "border-red-400 dark:border-red-600"
                    : "border-slate-200 dark:border-slate-700"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {ex.title}
                  </h3>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    #{idx + 1}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
                  {ex.question}
                </p>

                {ex.kind === "num" ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inputs[id] ?? ""}
                      onChange={e => setInp(id, e.target.value)}
                      onKeyDown={e => e.key === "Enter" && !r && reveal(id)}
                      disabled={r && ok}
                      placeholder="Ответ (число)..."
                      className="flex-1 border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-red-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                    />
                    {!r && (
                      <button
                        onClick={() => reveal(id)}
                        disabled={!(inputs[id] ?? "").trim()}
                        className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded hover:bg-red-700 disabled:opacity-40"
                      >
                        Проверить
                      </button>
                    )}
                    {err && (
                      <button
                        onClick={() => reset(id)}
                        className="px-2 py-1.5 bg-slate-200 dark:bg-slate-700 text-xs font-semibold rounded text-slate-700 dark:text-slate-200"
                      >
                        ↻
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {ex.options.map(opt => {
                      const selected = picks[id] === opt.key;
                      return (
                        <button
                          key={opt.key}
                          onClick={() => !r && pickOpt(id, opt.key)}
                          disabled={r}
                          className={`w-full text-left text-[11px] px-2 py-1.5 rounded border transition ${
                            selected
                              ? "bg-red-100 dark:bg-red-900/30 border-red-400 dark:border-red-600 text-red-900 dark:text-red-100"
                              : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-red-300"
                          } disabled:opacity-70 disabled:cursor-default`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                    <div className="flex gap-2 pt-1">
                      {!r && (
                        <button
                          onClick={() => reveal(id)}
                          disabled={!picks[id]}
                          className="flex-1 px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded hover:bg-red-700 disabled:opacity-40"
                        >
                          Проверить
                        </button>
                      )}
                      {err && (
                        <button
                          onClick={() => reset(id)}
                          className="px-2 py-1.5 bg-slate-200 dark:bg-slate-700 text-xs font-semibold rounded text-slate-700 dark:text-slate-200"
                        >
                          ↻ Сброс
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {r && (
                  <div
                    className={`mt-2 text-[11px] leading-relaxed rounded p-2 ${
                      ok
                        ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700"
                        : "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-700"
                    }`}
                  >
                    <div className="font-semibold mb-1">
                      {ok
                        ? "✓ Верно"
                        : ex.kind === "num"
                        ? `✗ Правильный ответ: ${ex.answers[0]}`
                        : `✗ Правильный ответ: ${ex.correct.join(" или ")}`}
                    </div>
                    {ex.kind === "num" && (
                      <code className="block text-[10px] font-mono mb-1 opacity-90">
                        {ex.formula}
                      </code>
                    )}
                    <div>{ex.explanation}</div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Расценки ЭСН */}
          <div className="bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">📋</span>
              <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Расценки ЭСН для котельной
              </h2>
            </div>
            <ul className="space-y-1.5">
              {ESN_ITEMS.map(it => (
                <li
                  key={it.code}
                  className="text-[10px] leading-snug border-l-2 border-red-500 dark:border-red-600 pl-2"
                >
                  <code className="font-mono text-slate-900 dark:text-slate-100 font-semibold">
                    {it.code}
                  </code>
                  <div className="text-slate-600 dark:text-slate-400">
                    {it.title}{" "}
                    <span className="text-slate-400 dark:text-slate-500">[{it.unit}]</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
