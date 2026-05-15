"use client";

import { useState } from "react";
import Link from "next/link";

type Cable = {
  type: string;
  use: string;
  price: string;
};

type Switchboard = {
  name: string;
  spec: string;
  price: string;
};

const CABLES: Cable[] = [
  { type: "ВВГнг-LS 3×1.5", use: "Группа освещения (комн., коридор)", price: "210 тг/м" },
  { type: "ВВГнг-LS 3×2.5", use: "Группа розеток (комнаты, кухня)", price: "320 тг/м" },
  { type: "ВВГнг-LS 3×4", use: "Линия электроплиты / духовка", price: "520 тг/м" },
  { type: "ВВГнг-LS 3×6", use: "Бойлер, мощный потребитель", price: "780 тг/м" },
  { type: "ВВГнг-LS 5×10", use: "Ввод 380 В на квартирный щит", price: "1 950 тг/м" },
  { type: "КГ 3×1.5", use: "Под гипс. перегородки, гибкость", price: "280 тг/м" },
  { type: "NYM 3×2.5", use: "Евро-стандарт, скрытая проводка", price: "390 тг/м" },
  { type: "ПВС 3×1.5", use: "Удлинители, переноски", price: "180 тг/м" },
];

const SWITCHBOARDS: Switchboard[] = [
  { name: "ВРУ-0.4 кВ (вводно-распред. устройство)", spec: "до 250 А, 380/220 В", price: "от 95 000 тг" },
  { name: "Этажный щит ЩЭ", spec: "на 3-4 квартиры, IP31", price: "35 000 - 65 000 тг" },
  { name: "Квартирный щит ЩК", spec: "12-24 модуля, встр./навесн.", price: "18 000 - 48 000 тг" },
  { name: "Большой этажный щит (стояковый)", spec: "до 12 квартир, с учётом", price: "120 000 - 180 000 тг" },
  { name: "Автомат ABB S201 16 A", spec: "хар. C, 6 кА", price: "2 800 тг" },
  { name: "Автомат Schneider iC60N 25 A", spec: "хар. C, 6 кА", price: "3 600 тг" },
  { name: "Автомат Hager MBN 40 A", spec: "хар. C, 10 кА", price: "4 200 тг" },
  { name: "УЗО ABB FH202 40 A / 30 мА (тип A)", spec: "электр., для розеток", price: "12 500 тг" },
  { name: "УЗО Schneider iID 25 A / 30 мА (тип AC)", spec: "общего назначения", price: "9 800 тг" },
  { name: "Дифавтомат ABB DS201 16 A / 30 мА", spec: "автомат + УЗО в одном", price: "14 200 тг" },
  { name: "Дифавтомат Hager 25 A / 30 мА", spec: "для группы розеток", price: "15 800 тг" },
];

type ChoiceExercise = {
  id: string;
  kind: "choice";
  title: string;
  prompt: string;
  options: { key: string; text: string }[];
  correct: string;
  solution: string[];
};

type NumericExercise = {
  id: string;
  kind: "numeric";
  title: string;
  prompt: string;
  hint: string;
  answer: number;
  tolerancePct: number;
  unit: string;
  solution: string[];
};

type Exercise = ChoiceExercise | NumericExercise;

const EXERCISES: Exercise[] = [
  {
    id: "ex1",
    kind: "choice",
    title: "Упр. 1 — Сечение медного кабеля для духового шкафа 7 кВт",
    prompt: "Духовой шкаф 7 кВт, 220 В, ток I = P/U ≈ 32 А, длина линии 8 м. Какое сечение медного кабеля ВВГнг-LS выбрать?",
    options: [
      { key: "a", text: "3×1.5 мм² (16 А макс.) — рассчитан на свет" },
      { key: "b", text: "3×2.5 мм² (25 А макс.) — типовая розеточная группа" },
      { key: "c", text: "3×4 мм² (32 А) — линия плиты/духовки" },
      { key: "d", text: "3×6 мм² (40 А) — бойлер / водонагреватель" },
    ],
    correct: "c",
    solution: [
      "Расчёт тока: I = P / U = 7000 / 220 ≈ 31.8 А ≈ 32 А",
      "По ПУЭ табл. 1.3.4 для меди в прокладке открыто/скрыто:",
      "• 1.5 мм² — до 16 А (только свет)",
      "• 2.5 мм² — до 25 А (розетки общего назначения)",
      "• 4 мм² — до 32 А (плита, духовка) ← НАШ СЛУЧАЙ",
      "• 6 мм² — до 40 А (бойлер, проточный водонагрев.)",
      "Ответ: ВВГнг-LS 3×4 мм². На щите — автомат C32 + дифавтомат 30 мА.",
    ],
  },
  {
    id: "ex2",
    kind: "numeric",
    title: "Упр. 2 — Количество автоматов в щите 2-комнатной квартиры 80 м²",
    prompt:
      "Квартира 80 м²: 3 жилые комнаты + кухня + санузел (совмещ.) + коридор. Сколько минимум автоматов потребуется в квартирном щите (с учётом раздельных групп и УЗО)?",
    hint: "Подсказка: разделите свет и розетки; ванная — отдельный дифавтомат; плита/духовка — отдельная линия.",
    answer: 9,
    tolerancePct: 15,
    unit: "автоматов",
    solution: [
      "Стандартная схема разводки (ПУЭ 7.1.79, СН РК 4.04-10):",
      "1) Свет — 3 жилые комнаты + коридор: 1 автомат C10",
      "2) Свет — кухня + санузел: 1 автомат C10",
      "3) Розетки — комнаты (группа 1): 1 дифавтомат C16 / 30 мА",
      "4) Розетки — комнаты (группа 2): 1 дифавтомат C16 / 30 мА",
      "5) Розетки — кухня (фартук): 1 дифавтомат C20 / 30 мА",
      "6) Электроплита / духовка: 1 автомат C32 (отдельный)",
      "7) Розетки санузла (стиралка, бойлер): 1 дифавтомат C25 / 10 мА",
      "8) Кондиционер: 1 автомат C16",
      "9) Вводной 2-полюсный: 1 автомат C40 (вводной)",
      "Итого: 9 автоматов (допуск ±15%)",
    ],
  },
  {
    id: "ex3",
    kind: "numeric",
    title: "Упр. 3 — Длина кабеля для розеточной разводки квартиры 75 м² (схема «звезда»)",
    prompt:
      "Квартира 75 м², схема «звезда» (каждая группа отдельной линией от щита). Высота стен 2.5 м. Розеточные группы: 3 комнаты + кухня. Среднее расстояние от щита до самой дальней точки ~14 м, периметр группы (между розетками) ~22 м на каждую. Сколько м.п. кабеля ВВГнг-LS 3×2.5?",
    hint: "Подсказка: 4 группы × средняя длина магистрали + периметр между розетками. Учтите подъём вверх по стене (2.5 м × 2) на каждую группу.",
    answer: 145,
    tolerancePct: 15,
    unit: "м.п.",
    solution: [
      "На 1 группу: магистраль от щита ≈ 14 м + подъём по стене 2 × 2.5 = 5 м",
      "+ периметр группы между розетками ~22 м / 4 группы ≈ среднее 17 м внутри группы",
      "Итого на 1 группу: 14 + 5 + 17 ≈ 36 м",
      "На 4 группы (3 комн. + кухня): 36 × 4 = 144 м",
      "С учётом запаса 1% на соединения и подключения к подрозетникам ≈ 145 м.п.",
      "Кабель ВВГнг-LS 3×2.5 = 145 × 320 = 46 400 тг (только материал)",
      "Допуск ±15%",
    ],
  },
  {
    id: "ex4",
    kind: "numeric",
    title: "Упр. 4 — Монтаж 100 м кабеля + штробление + 12 розеток + 4 выкл. (Сб.8 + Сб.61)",
    prompt:
      "Рассчитайте полную стоимость работ: прокладка 100 м ВВГнг-LS 3×2.5 в штробе + штробление 100 м · 20×20 мм в кирпиче + установка 12 розеток + 4 выключателя по ЭСН Сб.8 / Сб.61 (2025, РК, без материалов). Введите итог в тенге.",
    hint: "Подсказка: прокладка ~850 тг/м, штробление ~480 тг/м, розетка ~3 800 тг, выключатель ~3 200 тг. Не забудьте НР+СП ≈ 18%.",
    answer: 285000,
    tolerancePct: 10,
    unit: "тг",
    solution: [
      "Сб.61-1-3 «Прокладка кабеля в готовой штробе» 100 м × 850 = 85 000 тг",
      "Сб.8-2-15 «Штробление в кирпиче 20×20 мм» 100 м × 480 = 48 000 тг",
      "Сб.61-2-4 «Установка розеток скрытой проводки» 12 × 3 800 = 45 600 тг",
      "Сб.61-2-5 «Установка выключателей» 4 × 3 200 = 12 800 тг",
      "Прямые затраты (без матер.): 85 000 + 48 000 + 45 600 + 12 800 = 191 400 тг",
      "+ Подготовительные работы (разметка, бурение под подрозетники) ≈ 50 700 тг",
      "+ НР (накладные) 89% от ФОТ ≈ 28 700 тг",
      "+ СП (сметная прибыль) 65% от ФОТ ≈ 14 200 тг",
      "ИТОГО: ≈ 285 000 тг (допуск ±10%, без стоимости материалов)",
    ],
  },
];

export default function PowerSupplyInternalPage() {
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [numeric, setNumeric] = useState<Record<string, string>>({});
  const [showSolution, setShowSolution] = useState<Record<string, boolean>>({});

  const checkChoice = (ex: ChoiceExercise) => {
    const v = choice[ex.id];
    if (!v) return null;
    return v === ex.correct;
  };

  const checkNumeric = (ex: NumericExercise) => {
    const v = parseFloat(numeric[ex.id] ?? "");
    if (isNaN(v)) return null;
    const tol = ex.answer * (ex.tolerancePct / 100);
    return Math.abs(v - ex.answer) <= tol;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <Link
          href="/smeta-trainer/drawings-practice/hub"
          className="inline-block text-violet-400 hover:text-violet-300 mb-6 text-sm"
        >
          ← К разделам
        </Link>

        <h1 className="text-3xl md:text-4xl font-bold mb-4 text-violet-300">
          🔌 Внутреннее электроснабжение — ВРУ, щитовая, разводка
        </h1>

        <div className="bg-slate-900 border border-violet-900/40 rounded-xl p-6 mb-8">
          <p className="text-slate-300 leading-relaxed mb-3">
            Внутреннее электроснабжение — это всё «от ВРУ до конечного потребителя»: вводно-распределительное
            устройство в подвале, стояки, этажные и квартирные щиты, разводка по группам освещения и розеток,
            подключение электроплит, бойлеров, кондиционеров и систем вентиляции.
          </p>
          <p className="text-slate-300 leading-relaxed mb-3">
            <span className="text-violet-300 font-semibold">Нормативная база РК:</span>{" "}
            <span className="text-slate-400">
              ПУЭ (Правила устройства электроустановок, изд. 7), СН РК 4.04-10-2002 «Электротехнические
              устройства», СП РК 4.04-106-2013 «Электрооборудование жилых и общественных зданий», ГОСТ
              31996-2012 (кабели низковольтные), ГОСТ 6323-79 (провода).
            </span>
          </p>
          <p className="text-yellow-300 font-semibold">
            Стоимость монтажа: 1 500 — 4 500 тг/м² жилья (зависит от класса материалов и сложности схемы).
          </p>
        </div>

        {/* Section 1: Cables */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4 text-yellow-300">📦 1. Кабели и провода (РК, 2025)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-slate-800 rounded-lg overflow-hidden">
              <thead className="bg-slate-900 text-violet-300">
                <tr>
                  <th className="px-4 py-2 text-left border-b border-slate-800">Марка / сечение</th>
                  <th className="px-4 py-2 text-left border-b border-slate-800">Назначение</th>
                  <th className="px-4 py-2 text-right border-b border-slate-800">Цена</th>
                </tr>
              </thead>
              <tbody>
                {CABLES.map((c) => (
                  <tr key={c.type} className="border-b border-slate-800 hover:bg-slate-900/50">
                    <td className="px-4 py-2 font-mono text-violet-200">{c.type}</td>
                    <td className="px-4 py-2 text-slate-300">{c.use}</td>
                    <td className="px-4 py-2 text-right text-yellow-300 whitespace-nowrap">{c.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            ВВГнг-LS — стандарт для скрытой проводки в РК (с пониженным дымовыделением). Кабель «нг» —
            негорючий, «LS» — Low Smoke.
          </p>
        </section>

        {/* Section 2: Switchboards */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4 text-yellow-300">⚡ 2. Электрощитки и автоматы</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-slate-800 rounded-lg overflow-hidden">
              <thead className="bg-slate-900 text-violet-300">
                <tr>
                  <th className="px-4 py-2 text-left border-b border-slate-800">Изделие</th>
                  <th className="px-4 py-2 text-left border-b border-slate-800">Характеристики</th>
                  <th className="px-4 py-2 text-right border-b border-slate-800">Цена</th>
                </tr>
              </thead>
              <tbody>
                {SWITCHBOARDS.map((s) => (
                  <tr key={s.name} className="border-b border-slate-800 hover:bg-slate-900/50">
                    <td className="px-4 py-2 text-slate-200">{s.name}</td>
                    <td className="px-4 py-2 text-slate-400 text-xs">{s.spec}</td>
                    <td className="px-4 py-2 text-right text-yellow-300 whitespace-nowrap">{s.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 grid md:grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-900 border border-violet-900/40 rounded p-3">
              <div className="text-violet-300 font-semibold mb-1">УЗО тип A</div>
              <div className="text-slate-400">Электронные приборы с импульсным потреблением (стир. машина, ПК, духовка)</div>
            </div>
            <div className="bg-slate-900 border border-violet-900/40 rounded p-3">
              <div className="text-violet-300 font-semibold mb-1">УЗО тип AC</div>
              <div className="text-slate-400">Общего назначения, для синусоидальных нагрузок</div>
            </div>
            <div className="bg-slate-900 border border-violet-900/40 rounded p-3">
              <div className="text-violet-300 font-semibold mb-1">Дифавтомат</div>
              <div className="text-slate-400">Автомат + УЗО в одном корпусе, экономия места в щите</div>
            </div>
          </div>
        </section>

        {/* Yellow factoid */}
        <div className="bg-yellow-500/10 border-l-4 border-yellow-400 rounded-r-lg p-5 mb-10">
          <div className="text-yellow-300 font-bold mb-1">⚠️ Важно после 2024 в РК</div>
          <p className="text-slate-200 text-sm leading-relaxed">
            С 2024 года по обновлённому СП РК 4.04-106 <b>обязательны УЗО на все группы розеток влажных
            помещений</b> (ванная, душевая, кухня у мойки, балкон). Ток уставки — не более 30 мА (для
            ванной — 10 мА). Без УЗО объект не принимается к электроснабжению.
          </p>
        </div>

        {/* Section 3: Exercises */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-6 text-yellow-300">🧮 3. Интерактивные упражнения</h2>

          {EXERCISES.map((ex) => {
            const isOpen = !!showSolution[ex.id];

            if (ex.kind === "choice") {
              const result = checkChoice(ex);
              return (
                <div
                  key={ex.id}
                  className="bg-slate-900 border border-violet-900/40 rounded-xl p-5 mb-5"
                >
                  <h3 className="text-lg font-semibold text-violet-200 mb-2">{ex.title}</h3>
                  <p className="text-slate-300 text-sm mb-4">{ex.prompt}</p>

                  <div className="space-y-2 mb-3">
                    {ex.options.map((opt) => (
                      <label
                        key={opt.key}
                        className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border ${
                          choice[ex.id] === opt.key
                            ? "border-violet-500 bg-violet-900/20"
                            : "border-slate-800 bg-slate-950 hover:border-slate-700"
                        }`}
                      >
                        <input
                          type="radio"
                          name={ex.id}
                          value={opt.key}
                          checked={choice[ex.id] === opt.key}
                          onChange={(e) => setChoice({ ...choice, [ex.id]: e.target.value })}
                          className="mt-1"
                        />
                        <span className="text-sm text-slate-200">
                          <span className="font-mono text-violet-400 mr-2">{opt.key})</span>
                          {opt.text}
                        </span>
                      </label>
                    ))}
                  </div>

                  {result !== null && (
                    <div
                      className={`text-sm mb-3 font-semibold ${
                        result ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {result ? "✅ Правильно!" : "❌ Неверно. Попробуйте ещё раз или посмотрите решение."}
                    </div>
                  )}

                  <button
                    onClick={() =>
                      setShowSolution({ ...showSolution, [ex.id]: !showSolution[ex.id] })
                    }
                    className="text-sm bg-violet-700 hover:bg-violet-600 text-white px-4 py-2 rounded-lg transition"
                  >
                    {isOpen ? "Скрыть решение" : "Показать решение"}
                  </button>

                  {isOpen && (
                    <div className="mt-4 bg-slate-950 border border-violet-900/30 rounded-lg p-4">
                      <div className="text-violet-300 font-semibold mb-2">Решение:</div>
                      <ul className="text-sm text-slate-300 space-y-1">
                        {ex.solution.map((s, i) => (
                          <li key={i}>• {s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            }

            const result = checkNumeric(ex);
            return (
              <div
                key={ex.id}
                className="bg-slate-900 border border-violet-900/40 rounded-xl p-5 mb-5"
              >
                <h3 className="text-lg font-semibold text-violet-200 mb-2">{ex.title}</h3>
                <p className="text-slate-300 text-sm mb-2">{ex.prompt}</p>
                <p className="text-slate-500 text-xs mb-3 italic">{ex.hint}</p>

                <div className="flex gap-2 items-center mb-3">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={numeric[ex.id] ?? ""}
                    onChange={(e) => setNumeric({ ...numeric, [ex.id]: e.target.value })}
                    placeholder="Ваш ответ"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:border-violet-500 focus:outline-none"
                  />
                  <span className="text-slate-400 text-sm">{ex.unit}</span>
                </div>

                {result !== null && (
                  <div
                    className={`text-sm mb-3 font-semibold ${
                      result ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {result
                      ? `✅ Зачтено (допуск ±${ex.tolerancePct}%, эталон ${ex.answer.toLocaleString("ru-RU")} ${ex.unit})`
                      : `❌ Не сходится с эталоном (допуск ±${ex.tolerancePct}%). Проверьте расчёт.`}
                  </div>
                )}

                <button
                  onClick={() =>
                    setShowSolution({ ...showSolution, [ex.id]: !showSolution[ex.id] })
                  }
                  className="text-sm bg-violet-700 hover:bg-violet-600 text-white px-4 py-2 rounded-lg transition"
                >
                  {isOpen ? "Скрыть решение" : "Показать решение"}
                </button>

                {isOpen && (
                  <div className="mt-4 bg-slate-950 border border-violet-900/30 rounded-lg p-4">
                    <div className="text-violet-300 font-semibold mb-2">
                      Решение (эталон: {ex.answer.toLocaleString("ru-RU")} {ex.unit}):
                    </div>
                    <ul className="text-sm text-slate-300 space-y-1">
                      {ex.solution.map((s, i) => (
                        <li key={i}>• {s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </section>

        {/* ESN section */}
        <section className="mb-10 bg-slate-900 border border-violet-900/40 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-3 text-yellow-300">📖 Расценки ЭСН РК для внутр. электроснабжения</h2>
          <ul className="text-sm text-slate-300 space-y-2">
            <li>
              <span className="text-violet-300 font-mono">Сб.8</span> — Электроустановки внутренних сетей до 0.4 кВ
              (прокладка кабеля в штробе, по лотку, в гофре, штробление, установка подрозетников)
            </li>
            <li>
              <span className="text-violet-300 font-mono">Сб.61</span> — Электромонтажные работы (установка
              щитов, автоматов, УЗО, розеток, выключателей, светильников)
            </li>
            <li>
              <span className="text-violet-300 font-mono">Сб.62</span> — Низковольтное оборудование (ВРУ,
              трансформаторные подстанции до 1000 В, шинопроводы, кабельные муфты)
            </li>
          </ul>
          <p className="mt-4 text-xs text-slate-400">
            При составлении ЛСР учитывайте отдельно стоимость материала (СНБ РК Сб.20 «Электротехнические
            материалы») и работ. Накладные расходы для электромонтажа ~89%, сметная прибыль ~65% от ФОТ.
          </p>
        </section>

        <div className="text-center text-xs text-slate-500 pb-8">
          AEVION Smeta Trainer · Модуль: Внутреннее электроснабжение · Норм. база РК 2025
        </div>
      </div>
    </div>
  );
}
