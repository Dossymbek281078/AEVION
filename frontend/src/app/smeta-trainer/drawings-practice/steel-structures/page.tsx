"use client";
import Link from "next/link";
import { useState } from "react";

function check(input: string, accepts: number[], tol = 0.05): boolean {
  const v = parseFloat(input.replace(/\s/g, "").replace(",", "."));
  if (isNaN(v)) return false;
  return accepts.some((a) => Math.abs((v - a) / a) <= tol);
}

type Exercise = {
  id: string;
  title: string;
  question: string;
  hint: string;
  accepts: number[];
  tol: number;
  unit: string;
  expl: string;
};

const EXERCISES: Exercise[] = [
  {
    id: "ex1",
    title: "Объём стали для каркаса школы №47",
    question: "12 колонн Двутавр K35, длина каждой 13.2 м (3 этажа). Удельный вес K35 = 87 кг/м.п. Рассчитайте суммарную массу колонн в тоннах.",
    hint: "Масса = кол-во × длина × удельный вес.",
    accepts: [13.78],
    tol: 0.02,
    unit: "т",
    expl: "12 × 13.2 × 87 = 13 779 кг = 13.78 т.",
  },
  {
    id: "ex2",
    title: "Стоимость стальных колонн (материал + монтаж)",
    question: "Из задачи 1: масса 13.78 т. Цена двутавра K = 350 000 тг/т. Монтаж стальных колонн = 80 000 тг/т. Найдите итоговую стоимость в тенге.",
    hint: "Материал + монтаж считаются по массе раздельно, потом суммируются.",
    accepts: [5925000, 5925400],
    tol: 0.05,
    unit: "тг",
    expl: "Материал: 13.78 × 350 000 = 4 823 000 тг. Монтаж: 13.78 × 80 000 = 1 102 400 тг. Итого: ≈ 5 925 000 тг.",
  },
  {
    id: "ex3",
    title: "Площадь огнезащиты колонн (R45, краска)",
    question: "12 колонн K35 длиной 13.2 м. Периметр сечения (упрощённо квадратная заделка): 4 × 0.35 = 1.4 м. Найдите площадь огнезащитного покрытия (м²).",
    hint: "Площадь = кол-во колонн × длина × периметр сечения.",
    accepts: [222, 221.76],
    tol: 0.05,
    unit: "м²",
    expl: "12 × 13.2 × 1.4 = 221.76 ≈ 222 м². Стоимость для R45 (вспуч. краска ~3000 тг/м²): 222 × 3000 = 666 000 тг.",
  },
  {
    id: "ex4",
    title: "Болты с натяжением (HV) для соединения колонн с балками",
    question: "12 колонн × 4 балки на колонну (в среднем) = 48 узлов. На 1 узел колонна-балка идёт 8 болтов M20 HV. Сколько болтов нужно всего?",
    hint: "Кол-во узлов × болтов на узел.",
    accepts: [384],
    tol: 0.05,
    unit: "шт",
    expl: "48 × 8 = 384 болта. Стоимость: 384 × 1850 = 710 400 тг (только болты, без работ по натяжению).",
  },
];

export default function SteelStructuresPage() {
  const [exIdx, setExIdx] = useState(0);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Set<string>>(new Set());

  const ex = EXERCISES[exIdx];
  const key = ex.id;
  const isOk = revealed[key] && check(inputs[key] ?? "", ex.accepts, ex.tol);
  const isErr = revealed[key] && !isOk;

  function handleCheck() {
    setRevealed((r) => ({ ...r, [key]: true }));
    if (check(inputs[key] ?? "", ex.accepts, ex.tol)) {
      setDone((d) => new Set([...d, ex.id]));
    }
  }

  function handleReset() {
    setInputs((p) => ({ ...p, [key]: "" }));
    setRevealed((r) => ({ ...r, [key]: false }));
  }

  const allDone = done.size === EXERCISES.length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <header className="bg-zinc-800 dark:bg-zinc-900 text-white border-b border-zinc-700">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-xs text-zinc-300 hover:text-white"
          >
            ← К разделам
          </Link>
          <div className="flex-1">
            <h1 className="text-base font-bold">
              🏗 Стальные конструкции — балки, колонны, фермы
            </h1>
            <p className="text-[11px] text-zinc-400">
              {done.size}/{EXERCISES.length} задач решено
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Intro */}
        <section className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-5">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">
            📋 Где применяются стальные конструкции
          </h2>
          <div className="grid md:grid-cols-2 gap-4 text-xs leading-relaxed">
            <div>
              <p className="font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Стальные конструкции (СК) применяются для:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-400">
                <li>Промышленных зданий (цеха, ангары, склады)</li>
                <li>Каркасов многоэтажных (если этажей &gt; 25)</li>
                <li>Покрытий больших пролётов (ТРЦ, спортзалы, аэропорты)</li>
                <li>Кровельных стропил (металлочерепица)</li>
                <li>Мостов, эстакад</li>
                <li>Резервуаров, башен</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Стоимость СК в РК (2025):
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-400">
                <li>Простые конструкции: 380 000–580 000 тг/т</li>
                <li>Средняя сложность: 580 000–850 000 тг/т</li>
                <li>Сложные (фермы, башни): 850 000–1 500 000 тг/т</li>
                <li>Огнезащита и антикор учитываются ОТДЕЛЬНО.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Norms */}
        <section className="bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-700 rounded-xl p-5">
          <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-2">
            📚 Нормативная база
          </h2>
          <ul className="text-xs space-y-1 text-zinc-700 dark:text-zinc-300">
            <li>• СНиП РК 5.04-23-2002 «Стальные конструкции»</li>
            <li>• ЭСН РК Сб.9 «Металлические конструкции»</li>
            <li>• ГОСТ 27772-2015 Прокат для строительных стальных конструкций</li>
            <li>• СП РК 5.04-101 «Соединения на болтах с контролируемым натяжением»</li>
          </ul>
        </section>

        {/* Section 1: Прокат */}
        <section className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-5">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">
            1. Типы стального проката
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 text-left">
                  <th className="px-3 py-2 font-semibold">Профиль</th>
                  <th className="px-3 py-2 font-semibold">Применение</th>
                  <th className="px-3 py-2 font-semibold text-right">Цена/тонна 2025 (тг)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {[
                  ["Двутавр Б1 (горячекатаный)", "Балки перекрытий", "320 000"],
                  ["Двутавр K (колонный)", "Колонны", "350 000"],
                  ["Швеллер П (прокатный)", "Прогоны кровли, мелкие балки", "305 000"],
                  ["Угол равнополочный 50×50×5", "Фермы, связи", "285 000"],
                  ["Уголок 100×100×7", "Фермы тяжёлые", "290 000"],
                  ["Труба прямоугольная 100×100×4", "Колонны лёгких зданий", "380 000"],
                  ["Лист стальной 6 мм", "Косынки, накладки", "295 000"],
                  ["Арматура А500С Ø10–25", "Армирование ж/б, сварные сетки", "285 000"],
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-300">
                      {row[0]}
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{row[1]}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-800 dark:text-slate-200">
                      {row[2]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 2: Соединения */}
        <section className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-5">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">
            2. Виды соединений стальных конструкций
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 text-left">
                  <th className="px-3 py-2 font-semibold">Тип</th>
                  <th className="px-3 py-2 font-semibold">Применение</th>
                  <th className="px-3 py-2 font-semibold">Контроль</th>
                  <th className="px-3 py-2 font-semibold">Стоимость</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {[
                  ["Сварные на заводе", "Балки, фермы (на заводе)", "УЗК + рентген", "Включено в стоимость заводской готовности"],
                  ["Сварные на стройке", "Монтажные стыки", "УЗК выборочно", "800–1200 тг/м.п. шва"],
                  ["Болтовые на обычных болтах", "Малонагруженные узлы", "Визуальный", "350 тг/болт"],
                  ["Болтовые с натяжением (HV)", "Ответственные узлы", "Динамометрический ключ", "1850 тг/болт"],
                  ["Заклёпочные", "Реставрация исторических", "Визуальный", "4500 тг/заклёпка"],
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">
                      {row[0]}
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{row[1]}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{row[2]}</td>
                    <td className="px-3 py-2 font-mono text-slate-800 dark:text-slate-200">
                      {row[3]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: Огнезащита и антикор */}
        <section className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-5">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">
            3. Огнезащита и антикоррозионная защита
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              {
                t: "🔥 Огнезащитная краска (вспуч.)",
                v: "1 800 – 4 500 тг/м²",
                n: "См. модуль fire-safety. Толщина и тип зависят от требуемого предела огнестойкости (R45/R60/R90/R120).",
              },
              {
                t: "🛡 Антикоррозионное покрытие",
                v: "1 200 – 2 500 тг/м²",
                n: "Грунт + 2 слоя эмали. Для агрессивной среды — больше слоёв.",
              },
              {
                t: "⚙ Цинкование (горячее)",
                v: "95 000 – 145 000 тг/т",
                n: "Долговечность 30–50 лет. Цена считается от массы конструкции.",
              },
              {
                t: "🎨 Полимерное покрытие (RAL)",
                v: "4 200 – 6 800 тг/м²",
                n: "Декоративное + защитное. Применяется в фасадных конструкциях.",
              },
            ].map((c, i) => (
              <div
                key={i}
                className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-slate-50 dark:bg-slate-800/50"
              >
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                  {c.t}
                </div>
                <div className="text-sm font-mono text-emerald-700 dark:text-emerald-400 mb-1">
                  {c.v}
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                  {c.n}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 4: Interactive exercises */}
        <section className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-5">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">
            4. Практика: расчёт стальных конструкций (школа №47)
          </h2>

          {allDone ? (
            <div className="text-center py-10 px-4 border-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <div className="text-4xl mb-2">🏗</div>
              <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-300 mb-2">
                Все 4 задачи решены!
              </h3>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 mb-4">
                Стальной каркас школы №47 рассчитан: материал, монтаж, огнезащита, болты.
              </p>
              <button
                onClick={() => {
                  setExIdx(0);
                  setInputs({});
                  setRevealed({});
                  setDone(new Set());
                }}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-800 text-white text-sm font-semibold rounded-lg"
              >
                Пройти заново
              </button>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex gap-1 flex-wrap mb-4">
                {EXERCISES.map((e, i) => (
                  <button
                    key={e.id}
                    onClick={() => setExIdx(i)}
                    className={`text-[11px] px-3 py-1.5 rounded font-semibold transition ${
                      i === exIdx
                        ? "bg-zinc-700 text-white"
                        : done.has(e.id)
                        ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {done.has(e.id) ? "✓ " : ""}
                    Задача {i + 1}
                  </button>
                ))}
              </div>

              <div
                className={`border-2 rounded-lg p-4 ${
                  isOk
                    ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20"
                    : isErr
                    ? "border-red-300 bg-red-50 dark:bg-red-900/20"
                    : "border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30"
                }`}
              >
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">
                  Задача {exIdx + 1}. {ex.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
                  {ex.question}
                </p>
                <p className="text-[11px] italic text-zinc-500 dark:text-zinc-400 mb-3">
                  💡 {ex.hint}
                </p>

                {!done.has(ex.id) ? (
                  <>
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={inputs[key] ?? ""}
                        onChange={(e) =>
                          setInputs((p) => ({ ...p, [key]: e.target.value }))
                        }
                        onKeyDown={(e) =>
                          e.key === "Enter" && !revealed[key] && handleCheck()
                        }
                        disabled={!!revealed[key]}
                        placeholder="Введите число..."
                        className="flex-1 border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                      />
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-mono w-8">
                        {ex.unit}
                      </span>
                      {!revealed[key] && (
                        <button
                          onClick={handleCheck}
                          disabled={!inputs[key]?.trim()}
                          className="px-4 py-2 bg-zinc-700 hover:bg-zinc-800 text-white text-xs font-semibold rounded disabled:opacity-40"
                        >
                          Проверить
                        </button>
                      )}
                    </div>

                    {revealed[key] && (
                      <div
                        className={`mt-3 text-xs leading-relaxed ${
                          isOk
                            ? "text-emerald-800 dark:text-emerald-300"
                            : "text-red-800 dark:text-red-300"
                        }`}
                      >
                        <strong>{isOk ? "✓ Верно!" : "✗ Не сходится."}</strong>{" "}
                        {ex.expl}
                      </div>
                    )}

                    {isErr && (
                      <button
                        onClick={handleReset}
                        className="mt-2 text-[11px] text-amber-700 dark:text-amber-400 underline"
                      >
                        Попробовать снова
                      </button>
                    )}
                  </>
                ) : (
                  <div className="border border-emerald-300 dark:border-emerald-700 bg-emerald-100/50 dark:bg-emerald-900/30 rounded p-3">
                    <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 mb-1">
                      ✓ Решено
                    </div>
                    <div className="text-[11px] text-emerald-700 dark:text-emerald-400 leading-relaxed">
                      {ex.expl}
                    </div>
                  </div>
                )}

                {done.has(ex.id) && exIdx + 1 < EXERCISES.length && (
                  <button
                    onClick={() => setExIdx(exIdx + 1)}
                    className="mt-3 w-full py-2 bg-zinc-700 hover:bg-zinc-800 text-white text-sm font-semibold rounded-lg"
                  >
                    Следующая задача →
                  </button>
                )}
              </div>
            </>
          )}
        </section>

        {/* ЭСН расценки */}
        <section className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-5">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">
            📑 Расценки ЭСН РК (Сборник 9 и 13)
          </h2>
          <ul className="text-xs space-y-1 text-slate-700 dark:text-slate-300 font-mono">
            <li>• ЭСН Сб.9-1-001..030 «Изготовление стальных конструкций» (на заводе)</li>
            <li>• ЭСН Сб.9-2-001..020 «Монтаж стальных конструкций»</li>
            <li>• ЭСН Сб.13-1-001..015 «Огнезащитная окраска»</li>
            <li>• ЭСН Сб.13-2-001..010 «Антикоррозионное покрытие»</li>
          </ul>
        </section>

        {/* Factoid */}
        <section className="bg-slate-800 dark:bg-slate-900 border border-slate-700 rounded-xl p-5 text-slate-100">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <h3 className="text-sm font-bold mb-1 text-slate-200">
                Факт сметчика
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                В стальных конструкциях стоимость{" "}
                <strong className="text-amber-300">ЗАВОДСКОЙ ГОТОВНОСТИ</strong>{" "}
                (изготовление + чертежи КМД) часто составляет{" "}
                <strong>60–70%</strong> от итога. Монтаж — <strong>20–30%</strong>.
                Огнезащита и антикор — <strong>10–15%</strong>. Считай каждую
                статью отдельно.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
