"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * Строительные леса — типы, монтаж, аренда.
 * ЭСН РК Сб.46, СНиП РК 1.03-05-2001, ГОСТ Р 52086-2003, ПОТ РК 218-2.04-2010.
 * Учебная выборка, цены ориентировочные на III квартал 2025 г. (г. Алматы).
 */

interface ScaffoldType {
  id: string;
  name: string;
  application: string;
  maxHeight: string;
  rentRate: string;
}

const SCAFFOLD_TYPES: ScaffoldType[] = [
  { id: "lh50",   name: "Хомутовые ЛХ-50",          application: "Универсальные, фасадные",                maxHeight: "50 м",      rentRate: "145" },
  { id: "lrsp40", name: "Рамные ЛРСП-40",            application: "Простые фасады",                          maxHeight: "40 м",      rentRate: "95" },
  { id: "lk50",   name: "Клиновые ЛК-50",            application: "Скоростной монтаж",                       maxHeight: "50 м",      rentRate: "175" },
  { id: "lsh30",  name: "Штыревые ЛШ-30",            application: "Реставрация, малые объёмы",               maxHeight: "30 м",      rentRate: "125" },
  { id: "podv",   name: "Подвесные (на крыше)",       application: "Высотные мойка/ремонт",                   maxHeight: "до 100+",   rentRate: "850" },
  { id: "perd",   name: "Передвижные (на колёсах)",   application: "Внутренние отделочные",                   maxHeight: "6-15 м",    rentRate: "1850 за день" },
  { id: "pnev",   name: "Пневматические",             application: "Особые случаи (вентилируемые фасады)",    maxHeight: "60 м",      rentRate: "280" },
  { id: "samp",   name: "Самоподъёмные платформы",     application: "Для высотных кровельных",                 maxHeight: "100+",      rentRate: "12 000 за день" },
];

const SAFETY_CHECKLIST: string[] = [
  "Высота настила от стены ≤ 50 мм",
  "Ограждение перил h≥1.0 м с двух сторон",
  "Бортовая доска h≥150 мм по периметру настила",
  "Лестницы или сходни через каждые 25 м",
  "Освещение настила (для работы в тёмное время)",
  "Заземление металлических лесов",
  "Прогрев в зимнее время (для нагревательных лесов)",
  "Проверка ежедневно мастером",
  "Защитные сетки от падения предметов (для пешеходов снизу)",
  "Обучение работников + инструктаж",
];

function fmt(n: number): string {
  return n.toLocaleString("ru-RU");
}

function check(input: string, expected: number, tolerance = 0.02): boolean {
  const v = parseFloat(input.replace(/\s/g, "").replace(",", "."));
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
    title: "Площадь лесов для школы №47",
    description:
      "Здание 18×24 м, высота лесов 10 м (9 м по этажу + 1 м запас по парапету). Найди площадь лесов по периметру.",
    fields: [
      { id: "area", label: "Площадь лесов, м²", expected: 840, unit: "м²" },
    ],
    tolerance: 0.02,
    explanation:
      "Периметр = 2·(18+24) = 84 м. Площадь = 84 × 10 = 840 м². Леса считают по фасадной поверхности, а не по проёмам.",
  },
  {
    id: "ex2",
    title: "Стоимость аренды лесов на 90 дней",
    description:
      "Хомутовые леса ЛХ-50, 840 м², ставка 145 тг/м²·сут, срок аренды 90 дней. Найди стоимость аренды (без монтажа и доставки).",
    fields: [
      { id: "rent", label: "Стоимость аренды, тг", expected: 10962000, unit: "тг" },
    ],
    tolerance: 0.02,
    explanation:
      "Аренда = 840 × 145 × 90 = 10 962 000 тг. Монтаж/демонтаж (≈250 000 тг) и доставка (≈85 000 тг) — отдельными позициями.",
  },
  {
    id: "ex3",
    title: "Кол-во хомутов на 840 м² хомутовых лесов",
    description:
      "Норма: 4 хомута на каждый узел стойки/перекладины. На 1 м² леса приходится ~4 узла. Найди общее количество хомутов на 840 м².",
    fields: [
      { id: "cnt", label: "Кол-во хомутов, шт", expected: 13440, unit: "шт" },
    ],
    tolerance: 0.10,
    explanation:
      "На 1 м² → 4 узла × 4 хомута = 16 хомутов/м². Всего: 840 × 16 = 13 440 шт. Хомуты — самая частая позиция доукомплектации (потери при монтаже до 5%).",
  },
  {
    id: "ex4",
    title: "Подвесные vs хомутовые — разница на 100 м²",
    description:
      "Хомутовые: 145 тг/м²·сут × 30 дней. Подвесные: 850 тг/м²·сут × 7 дней. Найди разницу стоимости на 100 м² (положительное число — насколько подвесные дороже).",
    fields: [
      { id: "diff", label: "Разница, тг", expected: 160000, unit: "тг" },
    ],
    tolerance: 0.05,
    explanation:
      "Хомутовые: 145 × 30 = 4 350 тг/м². Подвесные: 850 × 7 = 5 950 тг/м². Разница: (5950 − 4350) × 100 = 160 000 тг. Подвесные дороже даже за быстрый срок — но экономят время на высотных работах.",
  },
];

export default function ScaffoldingPage() {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [doneChecks, setDoneChecks] = useState<Record<number, boolean>>({});

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

  function toggleCheck(idx: number) {
    setDoneChecks((p) => ({ ...p, [idx]: !p[idx] }));
  }

  const checkedCount = Object.values(doneChecks).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-yellow-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Header bar */}
      <div className="border-b border-amber-200 dark:border-amber-900/40 bg-white/80 dark:bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-sm text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100 font-medium flex items-center gap-1"
          >
            <span>←</span>
            <span>К разделам</span>
          </Link>
          <div className="text-xs text-slate-500 dark:text-slate-400 ml-auto">
            ЭСН РК Сб.46 · СНиП РК 1.03-05-2001 · ГОСТ Р 52086-2003 · учебная выборка
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Title */}
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          🪜 Строительные леса — типы, монтаж, аренда
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          Расчёт площади лесов, стоимости аренды, выбор типа лесов под задачу. Сб.46 ЭСН РК.
        </p>

        {/* Intro */}
        <div className="mb-6 rounded-lg border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0">🪜</span>
            <div className="space-y-2 text-sm text-amber-900 dark:text-amber-200">
              <p className="font-semibold">Леса — обязательная статья сметы для:</p>
              <ul className="list-disc list-inside space-y-1 ml-1">
                <li>Фасадных работ выше 1.8 м</li>
                <li>Кладки стен выше 1.5 м</li>
                <li>Кровельных работ</li>
                <li>Внутренней отделки потолков и верхних зон стен</li>
              </ul>
              <p className="pt-2 border-t border-amber-300/50 dark:border-amber-800/50 text-amber-800 dark:text-amber-300/90">
                В смете идут <span className="font-semibold">отдельной статьёй</span> (Сб.46 раздел «Леса»).
                Стоимость: <span className="font-mono font-semibold">800-2 500 тг/м²</span> фасадной
                поверхности (за весь срок аренды).
              </p>
            </div>
          </div>
        </div>

        {/* Нормативный блок */}
        <div className="mb-8 rounded-lg border-2 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-700 p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">📚</span>
            <div className="space-y-2 text-sm text-yellow-900 dark:text-yellow-200">
              <p className="font-semibold">Нормативная база — строительные леса</p>
              <ul className="list-disc list-inside space-y-1 ml-1">
                <li><span className="font-semibold">ЭСН РК Сб.46</span> — раздел «Леса» (нормы расхода и трудозатрат)</li>
                <li><span className="font-semibold">СНиП РК 1.03-05-2001</span> — «Охрана труда в строительстве» п. 6.2-6.5</li>
                <li><span className="font-semibold">ГОСТ Р 52086-2003</span> — Леса инвентарные, технические условия</li>
                <li><span className="font-semibold">ПОТ РК 218-2.04-2010</span> — Правила охраны труда</li>
              </ul>
            </div>
          </div>
        </div>

        {/* ── Раздел 1: Типы лесов ── */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-3">
            1. Типы лесов
          </h2>
          <div className="overflow-x-auto rounded-lg border border-amber-200 dark:border-amber-900 bg-white dark:bg-slate-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-amber-100 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200">
                  <th className="text-left px-3 py-2 font-semibold">Тип</th>
                  <th className="text-left px-3 py-2 font-semibold">Применение</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Высота max</th>
                  <th className="text-right px-3 py-2 font-semibold whitespace-nowrap">Аренда тг/м²·сут</th>
                </tr>
              </thead>
              <tbody>
                {SCAFFOLD_TYPES.map((s) => (
                  <tr
                    key={s.id}
                    className="border-t border-amber-100 dark:border-amber-900/40 hover:bg-amber-50/40 dark:hover:bg-amber-950/20"
                  >
                    <td className="px-3 py-2 text-slate-900 dark:text-slate-200 font-medium">{s.name}</td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300 text-xs">{s.application}</td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300 text-xs whitespace-nowrap">{s.maxHeight}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-amber-700 dark:text-amber-300 whitespace-nowrap">
                      {s.rentRate}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Цены — ориентировочные на III квартал 2025 г. (г. Алматы), рынок аренды.
          </p>
        </section>

        {/* ── Раздел 2: Расчёт лесов ── */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-3">
            2. Расчёт лесов (формула + пример)
          </h2>
          <div className="rounded-lg border-2 border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 p-5">
            <div className="font-mono text-sm text-amber-800 dark:text-amber-300 mb-4 bg-amber-50 dark:bg-amber-950/40 rounded p-3 border border-amber-200 dark:border-amber-900">
              <div className="font-bold mb-1">ФОРМУЛА:</div>
              <div>Площадь лесов = Периметр здания × Высота лесов</div>
            </div>

            <div className="rounded border border-yellow-300 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-950/20 p-3 font-mono text-xs md:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
              <div className="font-bold text-yellow-800 dark:text-yellow-300 mb-2 not-italic">
                Пример (школа №47, 18×24×9):
              </div>
              <div>Периметр = 2·(18+24) = <span className="text-amber-700 dark:text-amber-300 font-bold">84 м</span></div>
              <div>Высота лесов: 9 м (по этажу) + 1 м (запас по парапету) = <span className="text-amber-700 dark:text-amber-300 font-bold">10 м</span></div>
              <div>Площадь лесов = 84 · 10 = <span className="text-amber-700 dark:text-amber-300 font-bold">840 м²</span></div>
              <div className="mt-3 pt-2 border-t border-yellow-300/50 dark:border-yellow-800/50">
                Срок аренды: ~3 месяца (фасадные работы)
              </div>
              <div>
                Стоимость = 840 м² · 145 тг/м²·сут · 90 дней ={" "}
                <span className="text-amber-700 dark:text-amber-300 font-bold">{fmt(10962000)} тг</span>
              </div>
              <div>+ Монтаж/демонтаж: <span className="text-amber-700 dark:text-amber-300">250 000 тг</span> (одноразово)</div>
              <div>+ Доставка: <span className="text-amber-700 dark:text-amber-300">85 000 тг</span></div>
              <div className="mt-2 pt-2 border-t border-yellow-300/50 dark:border-yellow-800/50 font-bold text-yellow-800 dark:text-yellow-300">
                ИТОГО: ~11.3 млн тг для фасадных работ школы №47
              </div>
            </div>
          </div>
        </section>

        {/* ── Раздел 3: Безопасность ── */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-3">
            3. Безопасность при работе на лесах
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
            Чек-лист 10 пунктов — перед каждой сменой обязан проверить мастер участка.
            Отметка <span className="font-semibold text-amber-700 dark:text-amber-300">{checkedCount}/10</span>.
          </p>
          <div className="rounded-lg border-2 border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 p-4">
            <ul className="space-y-2">
              {SAFETY_CHECKLIST.map((item, idx) => {
                const checked = doneChecks[idx] === true;
                return (
                  <li key={idx}>
                    <button
                      onClick={() => toggleCheck(idx)}
                      className={`w-full text-left flex items-start gap-3 p-2 rounded-md border transition-colors ${
                        checked
                          ? "bg-emerald-50 border-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-700"
                          : "bg-amber-50/30 border-amber-200 hover:bg-amber-50 dark:bg-slate-950/30 dark:border-amber-900/40 dark:hover:bg-amber-950/20"
                      }`}
                    >
                      <span
                        className={`shrink-0 mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded border-2 text-xs font-bold ${
                          checked
                            ? "bg-emerald-500 border-emerald-500 text-white dark:bg-emerald-600 dark:border-emerald-600"
                            : "border-amber-400 dark:border-amber-700 text-transparent"
                        }`}
                      >
                        {checked ? "✓" : "·"}
                      </span>
                      <span
                        className={`text-sm ${
                          checked
                            ? "text-emerald-900 dark:text-emerald-200 line-through decoration-emerald-500/50"
                            : "text-slate-800 dark:text-slate-200"
                        }`}
                      >
                        {item}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* ── Раздел 4: Упражнения ── */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-3">
            4. Интерактивные упражнения
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Введи ответ в поле и нажми «Проверить». Допуск ±2-10% (указан в каждом упражнении).
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
                      : "border-amber-300 bg-white dark:bg-slate-900 dark:border-amber-800"
                  }`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <span className="shrink-0 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-xs font-bold">
                      Упр. {idx + 1}
                    </span>
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                        {ex.title}
                      </h3>
                      <p className="text-sm text-slate-700 dark:text-slate-300">
                        {ex.description}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Допуск ±{(ex.tolerance * 100).toFixed(0)}%
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
                                  : "border-amber-300 dark:border-amber-800 focus:border-amber-500"
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
                        className="px-4 py-2 rounded-md bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 text-white text-sm font-semibold transition-colors"
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
              <span className="font-semibold">Леса — самая большая «временная» статья сметы.</span>{" "}
              На фасадные работы это <span className="font-semibold">8-15%</span> от стоимости фасада.
              Считай тщательно — округление в часах аренды × 30 дней даёт{" "}
              <span className="font-semibold">25% разницы</span>.
            </p>
          </div>
        </div>

        {/* Footer space */}
        <div className="h-12" />
      </div>
    </div>
  );
}
