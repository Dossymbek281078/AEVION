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
    title: "Расход стропил для кровли 200 м² (по плану)",
    question:
      "Скатная кровля площадью 200 м² (в плане). Норма расхода стропил из сосны 1 сорт сечением 50×150 мм с шагом 600 мм составляет 0.025 м³ на 1 м² плана. Сколько кубометров пиломатериала нужно?",
    hint: "V = площадь × норма расхода.",
    accepts: [5],
    tol: 0.05,
    unit: "м³",
    expl: "200 × 0.025 = 5 м³ сосны 1 сорт. Без учёта обрешётки и контробрешётки.",
  },
  {
    id: "ex2",
    title: "Стоимость стропильной системы из сосны 1 сорт",
    question:
      "Из задачи 1: 5 м³ сосны 1 сорт по 165 000 тг/м³. Монтаж 35 000 тг/м³. Огнезащита «Сенеж Огнебио»: площадь поверхности стропил ≈ 134.4 м² (42 шт × 3.2 м²), расход 1.5 кг/м² × 1800 тг/кг ≈ 363 000 тг. Найдите итоговую стоимость в тенге.",
    hint: "Материал + монтаж + огнезащита.",
    accepts: [1363000],
    tol: 0.15,
    unit: "тг",
    expl:
      "Материал: 5 × 165 000 = 825 000 тг. Монтаж: 5 × 35 000 = 175 000 тг. Огнезащита: ≈ 363 000 тг. Итого: ≈ 1 363 000 тг (допуск ±15% — есть приближения по площади поверхности).",
  },
  {
    id: "ex3",
    title: "Срок строительства каркасного дома 100 м² бригадой 4 чел",
    question:
      "Каркасный дом «под ключ» 100 м². Полный цикл: фундамент + каркас + кровля + утепление + отделка. Бригада 4 человека. Сколько календарных дней займёт стройка (среднее по диапазону)?",
    hint: "ВНИМАНИЕ: норма выработки только каркаса (8-12 м²/чел/день) даёт нереально малый срок. Нужен полный цикл, а не только каркас.",
    accepts: [75, 60, 90],
    tol: 0.2,
    unit: "дней",
    expl:
      "Голая норма каркаса даёт 100/(4×10) = 2.5 дня — нереально. Полный цикл «под ключ» (фундамент + каркас + кровля + утепление + отделка + инженерка) для каркасника 100 м² бригадой 4 чел — 60-90 дней. Среднее ≈ 75 дней. Допуск ±20%.",
  },
  {
    id: "ex4",
    title: "Стоимость каркасного дома 80 м² «эконом»",
    question:
      "Каркасный дом 80 м² в категории «эконом». Базовая удельная цена каркасного «под ключ» эконом-класса по РК 2025 — 220 000 тг/м². Найдите итоговую стоимость в тенге.",
    hint: "S × удельная цена.",
    accepts: [17600000],
    tol: 0.15,
    unit: "тг",
    expl:
      "80 × 220 000 = 17 600 000 тг. Реальный диапазон 14-21 млн тг (зависит от утеплителя, кровли, окон, отделки). Допуск ±15%.",
  },
];

export default function WoodStructuresPage() {
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
    <div className="min-h-screen bg-amber-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100">
      <header className="bg-amber-900 dark:bg-stone-900 text-white border-b border-amber-800 dark:border-stone-700">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-xs text-amber-200 hover:text-white"
          >
            ← К разделам
          </Link>
          <div className="flex-1">
            <h1 className="text-base font-bold">
              🪵 Деревянные конструкции — балки, стропила, обработка
            </h1>
            <p className="text-[11px] text-amber-300 dark:text-stone-400">
              {done.size}/{EXERCISES.length} задач решено
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Intro */}
        <section className="bg-white dark:bg-stone-900 border border-amber-200 dark:border-stone-700 rounded-xl p-5">
          <h2 className="text-sm font-bold text-amber-900 dark:text-amber-200 mb-3">
            🪵 Где применяется дерево
          </h2>
          <div className="grid md:grid-cols-2 gap-4 text-xs leading-relaxed">
            <div>
              <p className="font-semibold mb-1 text-stone-700 dark:text-stone-300">
                Деревянные конструкции применяются в:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-stone-600 dark:text-stone-400">
                <li>Малоэтажных жилых (брус, каркасные)</li>
                <li>Кровельных стропилах (даже в кирпичных и панельных)</li>
                <li>Эколодж, гостевых домах</li>
                <li>Реставрации</li>
                <li>Внутренних перегородках</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold mb-1 text-stone-700 dark:text-stone-300">
                Стоимость стройки из дерева в РК (2025):
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-stone-600 dark:text-stone-400">
                <li>Каркасное жильё: 180 000–280 000 тг/м²</li>
                <li>Из бруса: 220 000–380 000 тг/м²</li>
                <li>Срубы (премиум): 350 000–550 000 тг/м²</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Norms */}
        <section className="bg-amber-100 dark:bg-stone-900/50 border border-amber-300 dark:border-stone-700 rounded-xl p-5">
          <h2 className="text-sm font-bold text-amber-900 dark:text-amber-200 mb-2">
            📚 Нормативная база
          </h2>
          <ul className="text-xs space-y-1 text-amber-900 dark:text-stone-300">
            <li>• СНиП РК 5.04-23-2002 раздел 4 «Деревянные конструкции»</li>
            <li>• ЭСН РК Сб.10 «Деревянные конструкции, окна, двери»</li>
            <li>• ГОСТ 8486-86 Пиломатериалы хвойных пород</li>
            <li>• ГОСТ 6782.1-75 Расчёт усушки и усадки</li>
            <li>• ТР ТС 014/2011 Безопасность лесоматериалов</li>
          </ul>
        </section>

        {/* Section 1: Виды пиломатериалов */}
        <section className="bg-white dark:bg-stone-900 border border-amber-200 dark:border-stone-700 rounded-xl p-5">
          <h2 className="text-sm font-bold text-amber-900 dark:text-amber-200 mb-3">
            1. Виды пиломатериалов
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-amber-100 dark:bg-stone-800 text-left">
                  <th className="px-3 py-2 font-semibold">Вид</th>
                  <th className="px-3 py-2 font-semibold text-center">Сорт</th>
                  <th className="px-3 py-2 font-semibold text-right">
                    Цена 2025, тг/м³
                  </th>
                  <th className="px-3 py-2 font-semibold">Применение</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-200 dark:divide-stone-700">
                {[
                  ["Сосна обрезная 1 сорт", "1", "165 000", "Балки, стропила, обвязка"],
                  ["Сосна обрезная 2 сорт", "2", "125 000", "Обрешётка, временные"],
                  ["Лиственница 1 сорт", "1", "285 000", "Долговечные элементы (терраса)"],
                  ["Дуб 1 сорт (премиум)", "1", "450 000–650 000", "Несущие в эколодж"],
                  ["Брус сухой 100×100", "1", "185 000", "Каркасные стены"],
                  ["Брус 150×150", "1", "195 000", "Балки, стойки тяжёлые"],
                  ["Брус клееный 200×400", "1", "285 000", "Большие пролёты, мансарды"],
                  ["Доска необрезная 25 мм", "2", "95 000", "Обшивка, опалубка"],
                ].map((row, i) => (
                  <tr
                    key={i}
                    className="hover:bg-amber-50 dark:hover:bg-stone-800/50"
                  >
                    <td className="px-3 py-2 font-mono text-stone-700 dark:text-stone-300">
                      {row[0]}
                    </td>
                    <td className="px-3 py-2 text-center text-stone-600 dark:text-stone-400">
                      {row[1]}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-stone-800 dark:text-stone-200">
                      {row[2]}
                    </td>
                    <td className="px-3 py-2 text-stone-600 dark:text-stone-400">
                      {row[3]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 2: Конструкции и расход */}
        <section className="bg-white dark:bg-stone-900 border border-amber-200 dark:border-stone-700 rounded-xl p-5">
          <h2 className="text-sm font-bold text-amber-900 dark:text-amber-200 mb-3">
            2. Конструкции и их расход
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-amber-100 dark:bg-stone-800 text-left">
                  <th className="px-3 py-2 font-semibold">Конструкция</th>
                  <th className="px-3 py-2 font-semibold">Сечение</th>
                  <th className="px-3 py-2 font-semibold">Шаг</th>
                  <th className="px-3 py-2 font-semibold text-right">
                    Расход, м³/м² плана
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-200 dark:divide-stone-700">
                {[
                  ["Стропила скатной кровли", "50×150 мм", "600 мм", "0.025"],
                  ["Обрешётка под металлочерепицу", "50×50 мм", "350 мм", "0.018"],
                  ["Обрешётка под мягкую кровлю (сплошная)", "OSB 9 мм", "сплошная", "0.009 (на 1 м²)"],
                  ["Балки перекрытия", "100×200 мм", "600 мм", "0.040"],
                  ["Лаги пола", "50×150 мм", "400 мм", "0.025"],
                  ["Каркас стены", "50×150 мм", "600 мм", "0.025"],
                  ["Стропила фермы (затяжки)", "100×100 мм", "1500 мм", "0.012"],
                ].map((row, i) => (
                  <tr
                    key={i}
                    className="hover:bg-amber-50 dark:hover:bg-stone-800/50"
                  >
                    <td className="px-3 py-2 font-semibold text-stone-700 dark:text-stone-300">
                      {row[0]}
                    </td>
                    <td className="px-3 py-2 font-mono text-stone-600 dark:text-stone-400">
                      {row[1]}
                    </td>
                    <td className="px-3 py-2 font-mono text-stone-600 dark:text-stone-400">
                      {row[2]}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-stone-800 dark:text-stone-200">
                      {row[3]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: Защитная обработка */}
        <section className="bg-white dark:bg-stone-900 border border-amber-200 dark:border-stone-700 rounded-xl p-5">
          <h2 className="text-sm font-bold text-amber-900 dark:text-amber-200 mb-3">
            3. Защитная обработка
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              {
                t: "🔥 Огнезащита",
                v: "1 200 тг/л",
                n: "Пропитка ОЗ-1 (1 группа эффективности). Расход 0.4 кг/м².",
              },
              {
                t: "🧪 Биозащита",
                v: "850 тг/л",
                n: "Антисептик «Сенеж Био». Расход 0.25 л/м². Защита от гнили, грибка, синевы.",
              },
              {
                t: "🛡 Совмещённая огне-биозащита",
                v: "1 800 тг/кг",
                n: "«Сенеж Огнебио». Расход 1 кг/м². Самый частый выбор для скрытых деревянных элементов.",
              },
              {
                t: "🏭 Кубовая обработка (под давлением)",
                v: "+285 000 тг/м³",
                n: "Для невидимых элементов (лаги в полу, нижняя обвязка). Пропитка автоклавом — на десятилетия.",
              },
            ].map((c, i) => (
              <div
                key={i}
                className="border border-amber-200 dark:border-stone-700 rounded-lg p-3 bg-amber-50/50 dark:bg-stone-800/50"
              >
                <div className="text-xs font-bold text-stone-800 dark:text-stone-200 mb-1">
                  {c.t}
                </div>
                <div className="text-sm font-mono text-amber-700 dark:text-amber-400 mb-1">
                  {c.v}
                </div>
                <div className="text-[11px] text-stone-600 dark:text-stone-400 leading-snug">
                  {c.n}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 4: Interactive exercises */}
        <section className="bg-white dark:bg-stone-900 border border-amber-200 dark:border-stone-700 rounded-xl p-5">
          <h2 className="text-sm font-bold text-amber-900 dark:text-amber-200 mb-3">
            4. Практика: расчёт деревянных конструкций
          </h2>

          {allDone ? (
            <div className="text-center py-10 px-4 border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <div className="text-4xl mb-2">🪵</div>
              <h3 className="text-lg font-bold text-amber-800 dark:text-amber-300 mb-2">
                Все 4 задачи решены!
              </h3>
              <p className="text-xs text-amber-700 dark:text-amber-400 mb-4">
                Стропила, каркас, защитная обработка — всё посчитано. Дом простоит 50+ лет.
              </p>
              <button
                onClick={() => {
                  setExIdx(0);
                  setInputs({});
                  setRevealed({});
                  setDone(new Set());
                }}
                className="px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white text-sm font-semibold rounded-lg"
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
                        ? "bg-amber-800 text-white"
                        : done.has(e.id)
                        ? "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300"
                        : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700"
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
                    : "border-amber-200 dark:border-stone-700 bg-amber-50/30 dark:bg-stone-800/30"
                }`}
              >
                <h3 className="text-sm font-bold text-stone-800 dark:text-stone-200 mb-2">
                  Задача {exIdx + 1}. {ex.title}
                </h3>
                <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed mb-2">
                  {ex.question}
                </p>
                <p className="text-[11px] italic text-amber-700 dark:text-amber-400 mb-3">
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
                        className="flex-1 border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-amber-500 dark:bg-stone-800 dark:border-stone-600 dark:text-stone-200"
                      />
                      <span className="text-xs text-stone-500 dark:text-stone-400 font-mono w-12 text-right">
                        {ex.unit}
                      </span>
                      {!revealed[key] && (
                        <button
                          onClick={handleCheck}
                          disabled={!inputs[key]?.trim()}
                          className="px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white text-xs font-semibold rounded disabled:opacity-40"
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
                    className="mt-3 w-full py-2 bg-amber-800 hover:bg-amber-900 text-white text-sm font-semibold rounded-lg"
                  >
                    Следующая задача →
                  </button>
                )}
              </div>
            </>
          )}
        </section>

        {/* ЭСН расценки */}
        <section className="bg-white dark:bg-stone-900 border border-amber-200 dark:border-stone-700 rounded-xl p-5">
          <h2 className="text-sm font-bold text-amber-900 dark:text-amber-200 mb-2">
            📑 Расценки ЭСН РК (Сборник 10)
          </h2>
          <ul className="text-xs space-y-1 text-stone-700 dark:text-stone-300 font-mono">
            <li>• ЭСН Сб.10-1-001..030 «Изготовление и монтаж деревянных конструкций»</li>
            <li>• ЭСН Сб.10-2-001..010 «Защитная обработка»</li>
            <li>• ЭСН Сб.10-3-001..015 «Обшивка и отделка деревянных»</li>
          </ul>
        </section>

        {/* Factoid */}
        <section className="bg-amber-900 dark:bg-stone-900 border border-amber-800 dark:border-stone-700 rounded-xl p-5 text-amber-50">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <h3 className="text-sm font-bold mb-1 text-amber-100">
                Факт сметчика
              </h3>
              <p className="text-xs text-amber-200 leading-relaxed">
                При расчёте дерева <strong className="text-amber-300">ВСЕГДА</strong>{" "}
                учитывай:{" "}
                <strong>1)</strong> усушку{" "}
                <strong className="text-amber-300">8–12%</strong> от свежего
                пиломатериала, <strong>2)</strong> отходы при раскрое{" "}
                <strong className="text-amber-300">5–15%</strong>,{" "}
                <strong>3)</strong> защитную обработку (без неё — гниль за 3-5
                лет). Без этих 3 поправок смета занижена на{" "}
                <strong className="text-amber-300">25–30%</strong>.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
