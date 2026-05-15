"use client";
import Link from "next/link";
import { useState } from "react";

// ── Допуски ───────────────────────────────────────────────────────────────
function checkTol(input: string, expected: number, tol: number) {
  const v = parseFloat(input.replace(",", "."));
  if (isNaN(v)) return false;
  if (tol === 0) return Math.abs(v - expected) < 0.0001;
  return Math.abs((v - expected) / expected) <= tol;
}
function checkOneOf(input: string, options: number[], tol: number) {
  return options.some((o) => checkTol(input, o, tol));
}

// ── Таблица материалов ────────────────────────────────────────────────────
const MATERIALS: { name: string; use: string; price: string }[] = [
  { name: "Труба ПВХ Ø50 (1.5 м)", use: "Подключение раковин, посудомоек", price: "850 тг/м" },
  { name: "Труба ПВХ Ø110 (3 м)", use: "Стояк, унитазы", price: "1 850 тг/м" },
  { name: "Тройник ПВХ Ø110×50 87°", use: "Подключение к стояку", price: "1 200 тг" },
  { name: "Колено 87° ПВХ Ø110", use: "Изменения направления", price: "850 тг" },
  { name: "Колено 45° ПВХ Ø50", use: "Подключения раковин", price: "450 тг" },
  { name: "Ревизия ПВХ Ø110", use: "Чистка стояка", price: "1 500 тг" },
  { name: "Гидрозатвор для душа (трап)", use: "Душевые поддоны", price: "8 500 тг" },
  { name: "Унитаз с подводкой к стояку", use: "Сан. узлы", price: "35 000 – 185 000 тг" },
];

// ── Упражнения ────────────────────────────────────────────────────────────
type Ex = {
  id: string;
  title: string;
  hint: string;
  answer: number;
  alternatives?: number[];
  tol: number;
  unit: string;
  explanation: string[];
};

const EXERCISES: Ex[] = [
  {
    id: "ex1",
    title: "Ex 1. Стоимость комплекта труб для квартиры 80 м²",
    hint: "Стояк + подводки + тройники + колена 87° + ревизия. Тенге.",
    answer: 21275,
    tol: 0.05,
    unit: "тг",
    explanation: [
      "Стояк Ø110: 3 м · 1 850 = 5 550 тг",
      "Подводки Ø50: 8.5 м · 850 = 7 225 тг",
      "Тройники Ø110×50: 3 шт · 1 200 = 3 600 тг",
      "Колена 87° Ø110: 4 шт · 850 = 3 400 тг",
      "Ревизия Ø110: 1 шт · 1 500 = 1 500 тг",
      "ИТОГО только труб и фасонины: 21 275 тг",
      "Допуск ±5 %.",
    ],
  },
  {
    id: "ex2",
    title: "Ex 2. Унитаз для квартиры (бизнес-класс) — комплект «под ключ»",
    hint: "Среднее по диапазону + гибкая подводка + монтаж. Тенге.",
    answer: 78500,
    tol: 0.15,
    unit: "тг",
    explanation: [
      "Среднее значение из диапазона 35 000 – 185 000 тг ≈ 65 000 тг (бизнес-класс).",
      "Подводка с гибким шлангом: +5 000 тг.",
      "Монтаж унитаза с подключением к стояку: +8 500 тг.",
      "ИТОГО: 65 000 + 5 000 + 8 500 = 78 500 тг.",
      "Допуск ±15 % — диапазон сильно зависит от модели и санфаянса.",
    ],
  },
  {
    id: "ex3",
    title: "Ex 3. Кол-во ревизий на 9-этажный стояк (1 секция)",
    hint: "Шт. По СНиП РК 4.01-02 / СП.",
    answer: 5,
    alternatives: [9, 10],
    tol: 0,
    unit: "шт",
    explanation: [
      "СНиП РК 4.01-02 / СП «Внутренний водопровод и канализация»:",
      "  · ревизия на стояке Ø110 — на каждом этаже (новое строительство по проекту);",
      "  · допускается через 2 этажа в реконструкции;",
      "  · обязательно — на верхнем и нижнем этажах + на поворотах.",
      "Варианты ответа:",
      "  · 5 шт — через 2 этажа (минимум для реконструкции, цоколь+3+5+7+9);",
      "  · 9 шт — на каждом этаже (поэтажно по проекту);",
      "  · 10 шт — поэтажно + дополнительная на верху.",
      "Все три значения принимаются — зависит от проекта и стадии.",
    ],
  },
  {
    id: "ex4",
    title: "Ex 4. Уклон внутренней канализации Ø110",
    hint: "Минимальный уклон по СНиП РК 4.01-02. Допускается 0.02 ИЛИ 2 (в %).",
    answer: 0.02,
    alternatives: [2],
    tol: 0,
    unit: "(доля или %)",
    explanation: [
      "СНиП РК 4.01-02 «Внутренний водопровод и канализация»:",
      "  · Ø110 — минимальный уклон i ≥ 0.02 (2 %);",
      "  · Ø50  — минимальный уклон i ≥ 0.025 (2.5 %).",
      "Уклон считается отношением падения к длине: i = Δh / L.",
      "Допуск: 0 % — норма строгая.",
      "Ответ: 0.02 или 2 (если в процентах).",
    ],
  },
];

export default function SewerageInternalPage() {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [shown, setShown] = useState<Record<string, boolean>>({});

  const setAns = (id: string, v: string) => setAnswers((s) => ({ ...s, [id]: v }));
  const toggleShow = (id: string) => setShown((s) => ({ ...s, [id]: !s[id] }));

  const isCorrect = (ex: Ex) => {
    const v = answers[ex.id];
    if (!v) return null;
    const opts = [ex.answer, ...(ex.alternatives ?? [])];
    return checkOneOf(v, opts, ex.tol);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-slate-400 hover:text-slate-200 transition text-sm"
          >
            ← К разделам
          </Link>
          <span className="text-xs text-slate-500">Сметный тренажёр · Внутренние сети</span>
        </div>

        {/* Title */}
        <header className="border-b border-slate-800 pb-5">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-100">
            🚽 Внутренняя канализация — ПВХ, стояки, фасонина
          </h1>
          <p className="text-slate-400 mt-2 text-sm md:text-base">
            ЭСН РК Сб.17 · СНиП РК 4.01-02 · ГОСТ 22689-2014 · цены 2025 г.
          </p>
        </header>

        {/* 1. Intro */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
          <h2 className="text-xl font-semibold text-slate-100">Что это такое</h2>
          <p className="text-slate-300 leading-relaxed">
            <b>Внутренняя канализация</b> в зданиях — система отвода стоков от санузлов и кухонь
            до выпуска в наружную сеть (см.{" "}
            <Link
              href="/smeta-trainer/drawings-practice/sewage"
              className="text-sky-400 hover:text-sky-300 underline"
            >
              /sewage
            </Link>
            ). Состоит из <b>стояков Ø110</b>, <b>горизонтальных подводок Ø50</b>, фасонины
            (тройники, колёна, ревизии) и санитарных приборов.
          </p>
          <p className="text-slate-300 leading-relaxed">
            Ориентировочная стоимость материалов и санприборов для квартиры{" "}
            <b>70 – 100 м²</b>: <b>280 000 – 450 000 тг</b> (без работ и стяжки/гидроизоляции).
          </p>
        </section>

        {/* 2. Norms */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <h2 className="text-xl font-semibold text-slate-100 mb-3">Нормативная база</h2>
          <ul className="space-y-2 text-slate-300">
            <li className="flex gap-2">
              <span className="text-amber-400 shrink-0">•</span>
              <span>
                <b className="text-slate-100">ЭСН РК Сб.17</b> «Канализация внутренняя» — основной
                сборник элементных сметных норм.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-amber-400 shrink-0">•</span>
              <span>
                <b className="text-slate-100">СНиП РК 4.01-02</b> «Внутренний водопровод и
                канализация зданий» — правила проектирования (уклоны, размещение ревизий,
                диаметры).
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-amber-400 shrink-0">•</span>
              <span>
                <b className="text-slate-100">ГОСТ 22689-2014</b> «Трубы и фасонные части из
                непластифицированного поливинилхлорида (ПВХ-У) для канализации».
              </span>
            </li>
          </ul>
        </section>

        {/* 3. Section 1 — материалы */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
          <h2 className="text-xl font-semibold text-slate-100">
            § 1. Трубы и фасонина — что берём в смету
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left border-b border-slate-700 text-slate-300">
                  <th className="py-2 pr-3 font-medium">Элемент</th>
                  <th className="py-2 pr-3 font-medium">Применение</th>
                  <th className="py-2 pr-3 font-medium text-right whitespace-nowrap">
                    Цена 2025
                  </th>
                </tr>
              </thead>
              <tbody>
                {MATERIALS.map((m, i) => (
                  <tr
                    key={i}
                    className="border-b border-slate-800/60 hover:bg-slate-800/30 transition"
                  >
                    <td className="py-2 pr-3 text-slate-100">{m.name}</td>
                    <td className="py-2 pr-3 text-slate-400">{m.use}</td>
                    <td className="py-2 pr-3 text-right text-amber-300 whitespace-nowrap">
                      {m.price}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">
            Цены — Алматы / Астана, опт-розница, без НДС. Региональный разброс ±10 – 15 %.
          </p>
        </section>

        {/* 4. Section 2 — расчёт количества */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
          <h2 className="text-xl font-semibold text-slate-100">
            § 2. Расчёт количества — типовая 80 м², 1 санузел + кухня
          </h2>
          <ul className="space-y-2 text-slate-300">
            <li className="flex gap-2">
              <span className="text-sky-400 shrink-0">▸</span>
              <span>
                <b>Стояк Ø110:</b> 3 м (с этажа на этаж — высота этажа ≈ 3 м).
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-sky-400 shrink-0">▸</span>
              <span>
                <b>Подводки Ø50:</b> ванная 2 м + кухня 4 м + посудомойка 1.5 м + стиральная
                машина 1 м = <b>8.5 м</b>.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-sky-400 shrink-0">▸</span>
              <span>
                <b>Тройники Ø110×50 87°:</b> 3 шт (ванная + кухня + общий узел стояка).
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-sky-400 shrink-0">▸</span>
              <span>
                <b>Колена 87° Ø110:</b> 4 шт (повороты подводок и стояка в перекрытии).
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-sky-400 shrink-0">▸</span>
              <span>
                <b>Ревизия Ø110:</b> 1 шт (на этаже квартиры — обязательна).
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-sky-400 shrink-0">▸</span>
              <span>
                <b>Унитаз с подводкой:</b> комплект (сам прибор + гибкий шланг к стояку).
              </span>
            </li>
          </ul>
          <p className="text-xs text-slate-500 pt-1">
            Гидроизоляция пола, цементная стяжка, установка приборов и пуско-наладка — отдельные
            позиции (см. Сб.11, Сб.13, Сб.17-3).
          </p>
        </section>

        {/* 5. Section 3 — упражнения */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">§ 3. Упражнения</h2>

          {EXERCISES.map((ex) => {
            const ok = isCorrect(ex);
            const isShown = !!shown[ex.id];
            return (
              <div
                key={ex.id}
                className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-semibold text-slate-100">{ex.title}</h3>
                  {ok === true && (
                    <span className="text-xs px-2 py-1 rounded-md bg-emerald-900/40 text-emerald-300 border border-emerald-700/60 whitespace-nowrap">
                      ✓ верно
                    </span>
                  )}
                  {ok === false && (
                    <span className="text-xs px-2 py-1 rounded-md bg-rose-900/40 text-rose-300 border border-rose-700/60 whitespace-nowrap">
                      ✗ ещё раз
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-400">{ex.hint}</p>

                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={answers[ex.id] ?? ""}
                    onChange={(e) => setAns(ex.id, e.target.value)}
                    placeholder="Ваш ответ"
                    className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 w-44 focus:outline-none focus:border-sky-500"
                  />
                  <span className="text-slate-500 text-sm">{ex.unit}</span>
                  <button
                    onClick={() => toggleShow(ex.id)}
                    className="text-xs px-3 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition"
                  >
                    {isShown ? "Скрыть решение" : "Показать решение"}
                  </button>
                </div>

                {isShown && (
                  <div className="mt-2 bg-slate-950/70 border border-slate-800 rounded-lg p-4 space-y-1.5">
                    {ex.explanation.map((line, i) => (
                      <div
                        key={i}
                        className="text-sm text-slate-300 font-mono whitespace-pre-wrap"
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </section>

        {/* 6. Расценки */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-2">
          <h2 className="text-xl font-semibold text-slate-100">Расценки ЭСН для сметы</h2>
          <ul className="text-slate-300 text-sm space-y-1.5">
            <li>
              <b className="text-slate-100">Сб.17-1</b> — прокладка трубопроводов канализации
              (ПВХ, чугун, сталь).
            </li>
            <li>
              <b className="text-slate-100">Сб.17-2</b> — установка фасонных частей (тройники,
              отводы, ревизии).
            </li>
            <li>
              <b className="text-slate-100">Сб.17-3</b> — установка санитарно-технических приборов
              (унитазы, раковины, ванны, душевые поддоны, трапы).
            </li>
          </ul>
        </section>

        {/* 7. Factoid */}
        <section className="bg-slate-800/60 border-l-4 border-slate-500 rounded-r-lg p-5">
          <p className="text-slate-200 leading-relaxed">
            <b className="text-slate-100">Factoid.</b> Внутренняя канализация — наименее заметная,
            но критичная система. Протечки разрушают полы и потолки соседей и оборачиваются
            судами на годы. <b>Заложи в смету гидроизоляцию пола в санузлах ВСЕГДА</b> —
            обмазочную (Ceresit CR-65, Mapei) или рулонную, с заходом на стены 200 мм. Это
            копейки относительно ущерба от одной протечки.
          </p>
        </section>

        <div className="text-center text-xs text-slate-600 pt-4 pb-8">
          Сметный тренажёр AEVION · «Внутренняя канализация» · v1.0
        </div>
      </div>
    </div>
  );
}
