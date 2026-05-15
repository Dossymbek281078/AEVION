"use client";
import Link from "next/link";
import { useState } from "react";

function check(i: string, a: string[]) {
  const v = parseFloat(i.replace(",", "."));
  return a.some((x) => {
    const e = parseFloat(x.replace(",", "."));
    return !isNaN(v) && !isNaN(e) && Math.abs((v - e) / e) < 0.025;
  });
}

function checkExact(i: string, a: string[]) {
  const v = parseFloat(i.replace(",", "."));
  return a.some((x) => {
    const e = parseFloat(x.replace(",", "."));
    return !isNaN(v) && !isNaN(e) && v === e;
  });
}

const SMETA_ROWS = [
  { n: 1, what: "Затраты на ОТ (общая статья)", norm: "МДС 81-33 п.4.31", unit: "0.4-1.0% от ФОТ" },
  { n: 2, what: "Временные ограждения", norm: "ЭСН РК Сб.46 §46-1-001", unit: "м.п." },
  { n: 3, what: "Защитные навесы у входов", norm: "ЭСН РК Сб.46 §46-2-005", unit: "шт" },
  { n: 4, what: "Сигнальная лента + знаки", norm: "ССЦ + расход", unit: "м.п. + шт" },
  { n: 5, what: "Заземление эл/инструмента", norm: "ЭСН РК Сб.8 (доп.)", unit: "шт" },
  { n: 6, what: "Спецодежда + СИЗ работников", norm: "СН РК 8.02 + ССЦ", unit: "по нормам выдачи" },
  { n: 7, what: "Аптечка + укомплектованный пост", norm: "ССЦ + норматив", unit: "шт" },
  { n: 8, what: "Обучение и инструктаж", norm: "НР включает", unit: "—" },
];

const FENCE_TYPES = [
  {
    title: "Сплошное",
    desc:
      "высота 2.0 м, материал ОСБ/металлопрофиль на каркасе. Применяется в населённых пунктах.",
    price: "≈ 4500-6500 тг/м.п. (с монтажом)",
  },
  {
    title: "Сетчатое",
    desc: "рабица 50×50 мм, высота 1.6 м. На объектах вне жилой застройки.",
    price: "≈ 2800 тг/м.п.",
  },
  {
    title: "Защитные сетки на лесах",
    desc:
      "пластиковая 2×100 м, плотность 100 г/м². Защита от падения предметов с высоты ≥ 4 этажа.",
    price: "—",
  },
  {
    title: "Защитные козырьки",
    desc: "на входах в эксплуатируемые здания во время работ.",
    price: "≈ 18000-25000 тг/шт.",
  },
];

type Exercise = {
  id: string;
  title: string;
  q: string;
  label: string;
  answers: string[];
  exact?: boolean;
  hint: string;
  formula: string;
};

const EXERCISES: Exercise[] = [
  {
    id: "ex1",
    title: "Упражнение 1: Расчёт затрат на ОТ для объекта",
    q:
      "ФОТ по объекту = 45 000 000 тг. Норматив затрат на ОТ = 0.7% (среднее значение по МДС 81-33 п.4.31). Найдите сумму затрат на ОТ в смете (в тенге).",
    label: "Сумма затрат на ОТ, тг",
    answers: ["315000"],
    hint:
      "Эта статья проходит отдельной строкой в смете «Затраты на ОТ» сверх ЭСН. Включается до начисления НР и СП.",
    formula: "45 000 000 · 0.007 = 315 000 тг",
  },
  {
    id: "ex2",
    title: "Упражнение 2: Длина временного ограждения участка",
    q:
      "Прямоугольный участок 50×80 м. По периметру устанавливается сплошное ограждение, оставляются ворота 6 м. Найдите длину ограждения (м).",
    label: "Длина ограждения, м",
    answers: ["254"],
    hint:
      "Ворота не считаются ограждением, но в смету включаются отдельной позицией ЭСН Сб.46 (распашные/откатные).",
    formula: "Периметр = 2·(50+80) = 260 м; минус ворота 6 м → 260 − 6 = 254 м",
  },
  {
    id: "ex3",
    title: "Упражнение 3: Количество СИЗ для бригады каменщиков",
    q:
      "Бригада 6 чел., работа на высоте до 2 м (леса). Норма выдачи перчаток на каждого: 12 пар на 6 мес. Сколько пар перчаток нужно закупить на бригаду на полугодие?",
    label: "Количество перчаток на бригаду, пар",
    answers: ["72"],
    exact: true,
    hint:
      "Нормы выдачи СИЗ — по «Типовым нормам бесплатной выдачи СИЗ» (приказ МЗСР РК). Каска, жилет, ботинки, монтажный пояс — отдельные позиции.",
    formula: "6 чел. · 12 пар = 72 пары",
  },
];

export default function SafetyPage() {
  const [inp, setInp] = useState<Record<string, string>>({});
  const [rev, setRev] = useState<Record<string, boolean>>({});

  function go(ex: Exercise) {
    setRev((r) => ({ ...r, [ex.id]: true }));
  }

  function reset(ex: Exercise) {
    setInp((p) => ({ ...p, [ex.id]: "" }));
    setRev((r) => ({ ...r, [ex.id]: false }));
  }

  const doneCount = EXERCISES.filter((ex) => {
    if (!rev[ex.id]) return false;
    const v = inp[ex.id] ?? "";
    return ex.exact ? checkExact(v, ex.answers) : check(v, ex.answers);
  }).length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-orange-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-xs text-orange-200 hover:text-white"
          >
            ← К разделам
          </Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold">
              🦺 Охрана труда — расценки, ППР, ограждения
            </h1>
            <p className="text-[10px] text-orange-200">
              ПОТ РК 218-2.04-2010 · СНиП РК 1.03-05-2001 · МДС 81-33 · {doneCount}/
              {EXERCISES.length} упражнений
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Нормативный блок */}
        <section className="border-2 border-orange-500 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-700 rounded-xl p-4">
          <h2 className="text-sm font-bold text-orange-800 dark:text-orange-300 mb-2">
            📋 Нормативная база
          </h2>
          <ul className="text-xs text-orange-800 dark:text-orange-300 space-y-1.5 leading-relaxed">
            <li>
              <strong>ПОТ РК 218-2.04-2010</strong> — «Правила охраны труда при производстве
              строительно-монтажных работ»
            </li>
            <li>
              <strong>СНиП РК 1.03-05-2001</strong> — «Охрана труда в строительстве»
            </li>
            <li>
              <strong>МДС 81-33.2004 п.4.31</strong> — Затраты на ОТ в смете: 0.4-1.0% от ФОТ
            </li>
            <li>
              <strong>ССЦ РК 8.04-08-2025</strong> — индивидуальные расценки
            </li>
          </ul>
        </section>

        {/* Раздел 1: Расценки на ОТ */}
        <section>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-3">
            Раздел 1: Расценки на охрану труда в смете
          </h2>
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300">
                <tr>
                  <th className="px-2 py-2 text-left font-bold w-8">№</th>
                  <th className="px-2 py-2 text-left font-bold">Что включается в смету</th>
                  <th className="px-2 py-2 text-left font-bold">Норматив / расценка</th>
                  <th className="px-2 py-2 text-left font-bold">% или ед.</th>
                </tr>
              </thead>
              <tbody className="text-slate-700 dark:text-slate-300">
                {SMETA_ROWS.map((r) => (
                  <tr
                    key={r.n}
                    className="border-t border-slate-200 dark:border-slate-700 hover:bg-orange-50/40 dark:hover:bg-orange-900/10"
                  >
                    <td className="px-2 py-1.5 font-mono text-slate-500">{r.n}</td>
                    <td className="px-2 py-1.5">{r.what}</td>
                    <td className="px-2 py-1.5 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                      {r.norm}
                    </td>
                    <td className="px-2 py-1.5 text-[11px]">{r.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Раздел 2: Ограждения */}
        <section>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-3">
            Раздел 2: Ограждения строительных площадок
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {FENCE_TYPES.map((f) => (
              <div
                key={f.title}
                className="bg-white dark:bg-slate-900 border-2 border-orange-200 dark:border-orange-800 rounded-xl p-3"
              >
                <h3 className="text-sm font-bold text-orange-800 dark:text-orange-300 mb-1">
                  {f.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {f.desc}
                </p>
                {f.price !== "—" && (
                  <div className="mt-1.5 text-xs font-mono text-orange-700 dark:text-orange-400">
                    {f.price}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg p-3 text-xs text-amber-900 dark:text-amber-300 leading-relaxed">
            ⚡ <strong>Расчёт длины ограждения</strong> = периметр участка + откидывание на ширину
            тротуара (минимум 1.5 м с обеих сторон проездов).
          </div>
        </section>

        {/* Раздел 3: Упражнения */}
        <section>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-3">
            Раздел 3: Интерактивные упражнения
          </h2>
          <div className="space-y-4">
            {EXERCISES.map((ex) => {
              const v = inp[ex.id] ?? "";
              const okFn = ex.exact ? checkExact : check;
              const ok = rev[ex.id] && okFn(v, ex.answers);
              const err = rev[ex.id] && !ok;
              return (
                <div
                  key={ex.id}
                  className={`bg-white dark:bg-slate-900 border-2 rounded-xl p-4 ${
                    ok
                      ? "border-emerald-400 dark:border-emerald-600"
                      : err
                      ? "border-red-400 dark:border-red-600"
                      : "border-orange-200 dark:border-orange-800"
                  }`}
                >
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1.5">
                    {ex.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
                    {ex.q}
                  </p>
                  <div
                    className={`border-2 rounded-lg p-3 ${
                      ok
                        ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20"
                        : err
                        ? "border-red-300 bg-red-50 dark:bg-red-900/20"
                        : "border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                      {ex.label}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={v}
                        onChange={(e) => setInp((p) => ({ ...p, [ex.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && !rev[ex.id] && go(ex)}
                        disabled={!!rev[ex.id]}
                        placeholder="Число..."
                        className="flex-1 border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-orange-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                      />
                      {!rev[ex.id] && (
                        <button
                          onClick={() => go(ex)}
                          disabled={!v.trim()}
                          className="px-3 py-1.5 bg-orange-600 text-white text-xs font-semibold rounded hover:bg-orange-700 disabled:opacity-40"
                        >
                          Проверить
                        </button>
                      )}
                    </div>
                    {rev[ex.id] && (
                      <div
                        className={`mt-2 text-xs leading-relaxed ${
                          ok
                            ? "text-emerald-800 dark:text-emerald-300"
                            : "text-red-800 dark:text-red-300"
                        }`}
                      >
                        {ok ? "✓ Верно. " : "✗ Неверно. "}
                        <span className="font-mono">{ex.formula}</span>
                        <div className="mt-1 text-slate-700 dark:text-slate-300 not-italic">
                          {ex.hint}
                        </div>
                      </div>
                    )}
                    {err && (
                      <button
                        onClick={() => reset(ex)}
                        className="mt-2 text-[10px] text-amber-700 dark:text-amber-400 underline"
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

        {/* Раздел 4: ППР */}
        <section>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-3">
            Раздел 4: Затраты на ППР (план производства работ)
          </h2>
          <div className="bg-white dark:bg-slate-900 border-2 border-orange-300 dark:border-orange-700 rounded-xl p-4 space-y-2 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            <div>
              <strong className="text-orange-800 dark:text-orange-300">ППР</strong> — обязателен
              для объектов выше 2 этажей или с применением кранов (СНиП РК 1.03-05 п. 4.5).
            </div>
            <div>
              <strong>Разработка:</strong> специализированная организация или техотдел подрядчика.
            </div>
            <div>
              <strong>Стоимость:</strong> 0.5-1.5% от стоимости СМР (отдельной позицией в смете не
              указывается, входит в накладные расходы — МДС 81-33).
            </div>
            <div>
              <strong>Содержание:</strong> технологические карты, графики, схемы строповки, схемы
              безопасности, ППР для отдельных работ (бетонирование, монтаж кровли).
            </div>
          </div>
        </section>

        {/* Фактоид: предупреждение */}
        <section className="border-2 border-red-500 bg-red-50 dark:bg-red-900/20 dark:border-red-700 rounded-xl p-4">
          <h2 className="text-sm font-bold text-red-800 dark:text-red-300 mb-1.5">
            ⚠ ВНИМАНИЕ
          </h2>
          <p className="text-xs text-red-900 dark:text-red-200 leading-relaxed">
            Без оформления Журнала вводного инструктажа и инструктажа на рабочем месте — работники
            не допускаются к работам. При несчастном случае без записи об инструктаже — уголовная
            ответственность руководителя по <strong>статье 152 УК РК</strong>.
          </p>
        </section>
      </div>
    </div>
  );
}
