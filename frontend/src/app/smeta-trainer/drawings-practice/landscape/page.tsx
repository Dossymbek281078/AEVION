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
  tol?: number;
}
interface Exercise {
  id: string;
  title: string;
  q: string;
  ss: Step[];
  vor: string;
  theory: string;
}

const STEPS: Exercise[] = [
  {
    id: "ex1-lawn-area",
    title: "Упражнение 1: Площадь газона на участке",
    q: `Дворовая территория 60 × 40 м.
Из общей площади исключаются:
- здание 18 × 24 = 432 м²
- площадка с твёрдым покрытием 12 × 15 = 180 м²
- дорожки шириной 1.5 м общей длиной 80 м = 120 м²

Рассчитайте площадь газона (м²).`,
    ss: [
      {
        id: "area",
        l: "Площадь газона, м²",
        a: ["1668", "1668.0"],
        e: "F = 60·40 − 432 − 180 − 120 = 2400 − 732 = 1668 м². Газон укладывается ТОЛЬКО на свободные от твёрдых покрытий и зданий территории — это базовое правило ведомости подсчёта.",
        tol: 0.02,
      },
    ],
    vor: "Площадь газона на дворовой территории: 60·40 − (432+180+120) = 1668 м² (СНиП РК 3.07-01-2007)",
    theory:
      "Площадь газона = площадь участка минус все твёрдые покрытия, здания, отмостки. Зелёная зона рассчитывается по контурам в плане благоустройства.",
  },
  {
    id: "ex2-seeds",
    title: "Упражнение 2: Расход семян для обыкновенного газона",
    q: `Площадь обыкновенного садово-паркового газона: 1668 м².
Норма расхода семян: 25 г/м² (ЭСН РК Сб.47-1-002).
С запасом 10% на пересев — для подстраховки прорастания.

Рассчитайте массу семян: основной расход (кг) ИЛИ с запасом 10% (кг). Принимаются оба ответа.`,
    ss: [
      {
        id: "mass",
        l: "Масса семян, кг (основной расход или +10%)",
        a: ["41.7", "41,7", "45.9", "45,9"],
        e: "Основной расход: 1668 · 25 = 41 700 г = 41.7 кг. С запасом 10% (на пересев): 41.7 · 1.10 = 45.87 ≈ 45.9 кг. Семена газонной травы фасуются в мешки по 1, 5, 10 кг — округляем вверх до целых мешков.",
        tol: 0.02,
      },
    ],
    vor: "Семена газонной травы (норма 25 г/м²): 1668·25 = 41.7 кг, с запасом 10% = 45.9 кг (ССЦ РК 8.04-08-2025)",
    theory:
      "Норма расхода семян зависит от типа газона: партерный 30-40 г/м², обыкновенный 20-25, луговой 15-20, спортивный 35-50. Рулонный газон — 0.4 кг/м² сухого веса.",
  },
  {
    id: "ex3-trees",
    title: "Упражнение 3: Количество деревьев для аллеи",
    q: `Длина аллеи = 80 м.
Шаг посадки = 5 м (стандарт для среднерослых деревьев).
Посадка с двух сторон аллеи.
Первое и последнее дерево на каждой стороне обязательны (принцип «забор»).

Рассчитайте общее количество деревьев (шт).`,
    ss: [
      {
        id: "qty",
        l: "Количество деревьев, шт",
        a: ["34"],
        e: "На одну сторону: 80/5 + 1 = 16 + 1 = 17 деревьев (формула «забор» — на N интервалов нужно N+1 столбов). С двух сторон: 17 · 2 = 34 дерева. Без +1 студенты часто получают 32 — это типовая ошибка!",
        tol: 0.005,
      },
    ],
    vor: "Деревья для аллеи L=80 м, шаг 5 м, две стороны: (80/5+1)·2 = 34 шт (Сб.47-2-001)",
    theory:
      "Расстояние между деревьями: крупные 5-7 м, среднерослые 3-5 м, кустарники 0.7-1.5 м. От стены здания ≥ 5 м, от подземных коммуникаций ≥ 2-3 м.",
  },
  {
    id: "ex4-soil",
    title: "Упражнение 4: Объём растительного грунта",
    q: `Растительный грунт нужен для всех насаждений:
1) Газон 1668 м² × 0.20 м (толщина растительного слоя)
2) Посадочные ямы для 34 деревьев лиственных: 0.8 × 0.8 × 0.6 м каждая

Рассчитайте суммарный объём растительного грунта (м³).`,
    ss: [
      {
        id: "vol",
        l: "Объём растительного грунта, м³",
        a: ["346.7", "346,7", "347"],
        e: "Газон: 1668 · 0.20 = 333.6 м³. Ямы: 34 · 0.8·0.8·0.6 = 34 · 0.384 = 13.06 м³. Итого: 333.6 + 13.06 ≈ 346.7 м³. Растительный грунт идёт отдельной позицией ЛСР (ССЦ РК 8.04, цена 4500-7000 тг/м³).",
        tol: 0.03,
      },
    ],
    vor: "Растительный грунт: газон 1668·0.20 + ямы 34·0.384 = 333.6 + 13.06 = 346.7 м³ (ССЦ РК 8.04-08-2025)",
    theory:
      "Растительный грунт — отдельная позиция. Толщина под газон 150-200 мм, под цветники 300 мм. При наличии существующего плодородного слоя — применяется коэффициент к объёму.",
  },
];

export default function LandscapePage() {
  const [xi, sxi] = useState(0);
  const [si, ssi] = useState(0);
  const [inp, setInp] = useState<Record<string, string>>({});
  const [rev, setRev] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Set<string>>(new Set());
  const ex = STEPS[xi];
  const step = ex.ss[si];
  const k = `${ex.id}-${step.id}`;
  const ok = rev[k] && check(inp[k] ?? "", step.a, step.tol ?? 0.02);
  const err = rev[k] && !ok;

  function go() {
    setRev((r) => ({ ...r, [k]: true }));
    if (check(inp[k] ?? "", step.a, step.tol ?? 0.02)) {
      setTimeout(() => {
        if (si + 1 < ex.ss.length) {
          ssi(si + 1);
          setRev({});
        } else setDone((d) => new Set([...d, ex.id]));
      }, 700);
    }
  }

  const allDone = done.size === STEPS.length;

  return (
    <div className="min-h-screen bg-green-50 dark:bg-slate-950">
      <header className="bg-green-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-xs text-green-200 hover:text-white"
          >
            ← К разделам
          </Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold">
              🌳 Благоустройство и озеленение — газоны, МАФ, посадочные работы
            </h1>
            <p className="text-[10px] text-green-200">
              СНиП РК 3.07-01-2007 · ЭСН РК Сб.47 · {done.size}/{STEPS.length} пройдено
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 space-y-4">
        {/* Нормативный блок */}
        <div className="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 dark:border-green-400 rounded-r-lg p-4 space-y-2">
          <h2 className="text-sm font-bold text-green-800 dark:text-green-300 mb-1">
            📘 Нормативная база
          </h2>
          <ul className="text-xs text-green-900 dark:text-green-200 space-y-1 leading-relaxed">
            <li>
              • <b>СНиП РК 3.07-01-2007</b> «Благоустройство территорий»
            </li>
            <li>
              • <b>МДС 81-25.2004</b> Прил. «Затраты на благоустройство в смете»
            </li>
            <li>
              • <b>ЭСН РК Сборник 47</b> «Озеленение, защитные лесонасаждения, многолетние плодовые насаждения»
            </li>
            <li>
              • <b>ССЦ РК 8.04-08-2025</b> — цены на саженцы, газонные смеси
            </li>
          </ul>
        </div>

        {/* Раздел 1: Газоны */}
        <div className="bg-white dark:bg-slate-900 border border-green-200 dark:border-slate-700 rounded-xl p-4">
          <h2 className="text-sm font-bold text-green-800 dark:text-green-300 mb-3">
            🌱 Раздел 1. Газоны — виды, нормы расхода семян
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-green-100 dark:bg-green-900/40 text-green-900 dark:text-green-200">
                  <th className="text-left p-2 border border-green-200 dark:border-green-800">Тип газона</th>
                  <th className="text-left p-2 border border-green-200 dark:border-green-800">Норма семян</th>
                  <th className="text-left p-2 border border-green-200 dark:border-green-800">Особенности</th>
                  <th className="text-left p-2 border border-green-200 dark:border-green-800">Расценка ЭСН</th>
                </tr>
              </thead>
              <tbody className="text-slate-700 dark:text-slate-300">
                {[
                  ["Партерный (декоративный)", "30-40 г/м²", "Низкая стрижка ≤ 3 см, требует постоянного ухода", "Сб.47-1-001"],
                  ["Обыкновенный садово-парковый", "20-25 г/м²", "Стандарт для парков и дворов", "Сб.47-1-002"],
                  ["Луговой (для быстрого озеленения)", "15-20 г/м²", "Цветение, мало воды", "Сб.47-1-003"],
                  ["Спортивный (футбольный)", "35-50 г/м²", "Износостойкие сорта (ryegrass)", "Сб.47-1-005"],
                  ["Рулонный (готовый)", "1 м² = 0.4 кг сухого", "Мгновенный эффект, дороже посева в 5-10 раз", "Сб.47-1-010"],
                ].map((r, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-green-50/40 dark:bg-slate-800/40" : ""}>
                    <td className="p-2 border border-green-100 dark:border-slate-700 font-semibold">{r[0]}</td>
                    <td className="p-2 border border-green-100 dark:border-slate-700 font-mono text-green-800 dark:text-green-300">
                      {r[1]}
                    </td>
                    <td className="p-2 border border-green-100 dark:border-slate-700 text-[11px]">{r[2]}</td>
                    <td className="p-2 border border-green-100 dark:border-slate-700 font-mono text-[11px]">{r[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">
              📋 Подготовка основания газона — последовательность позиций ЛСР
            </div>
            <pre className="text-[11px] text-slate-700 dark:text-slate-300 font-mono leading-relaxed whitespace-pre-wrap">
{`1. Снятие растительного слоя 150 мм + вывоз: ЭСН РК Сб.1-1-50
2. Завоз растительного грунта 200 мм: 0.20 м³/м² × количество м²
3. Планировка вручную: ЭСН РК Сб.47-1-008
4. Посев семян + укатка: ЭСН РК Сб.47-1-001/002/003
5. Полив до всходов: ССЦ + расход 30 л/м² на 1 полив`}
            </pre>
          </div>
        </div>

        {/* Раздел 2: Посадка деревьев и кустарников */}
        <div className="bg-white dark:bg-slate-900 border border-green-200 dark:border-slate-700 rounded-xl p-4">
          <h2 className="text-sm font-bold text-green-800 dark:text-green-300 mb-3">
            🌲 Раздел 2. Посадка деревьев и кустарников
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-green-100 dark:bg-green-900/40 text-green-900 dark:text-green-200">
                  <th className="text-left p-2 border border-green-200 dark:border-green-800">Растение</th>
                  <th className="text-left p-2 border border-green-200 dark:border-green-800">Размер ямы</th>
                  <th className="text-left p-2 border border-green-200 dark:border-green-800">Норма</th>
                  <th className="text-left p-2 border border-green-200 dark:border-green-800">Расценка</th>
                </tr>
              </thead>
              <tbody className="text-slate-700 dark:text-slate-300">
                {[
                  ["Дерево лиственное (саженец)", "0.8×0.8×0.6 м", "1 шт", "Сб.47-2-001"],
                  ["Дерево хвойное (саженец)", "1.0×1.0×0.8 м", "1 шт (с земляным комом!)", "Сб.47-2-002"],
                  ["Дерево крупномер (>2 м)", "1.5×1.5×1.2 м", "1 шт (только манипулятором)", "Сб.47-2-005"],
                  ["Кустарник одиночный", "0.5×0.5×0.4 м", "1 шт", "Сб.47-2-010"],
                  ["Кустарниковая живая изгородь", "Траншея 0.5×0.5", "4-6 шт/м.п.", "Сб.47-2-015"],
                ].map((r, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-green-50/40 dark:bg-slate-800/40" : ""}>
                    <td className="p-2 border border-green-100 dark:border-slate-700 font-semibold">{r[0]}</td>
                    <td className="p-2 border border-green-100 dark:border-slate-700 font-mono">{r[1]}</td>
                    <td className="p-2 border border-green-100 dark:border-slate-700 text-[11px]">{r[2]}</td>
                    <td className="p-2 border border-green-100 dark:border-slate-700 font-mono text-[11px]">{r[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3">
            <div className="text-xs font-bold text-green-800 dark:text-green-300 mb-2">
              📐 Стандартные расстояния посадки
            </div>
            <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1 leading-relaxed list-disc pl-5">
              <li>Деревья крупные между собой: <b>5-7 м</b></li>
              <li>Деревья среднерослые: <b>3-5 м</b></li>
              <li>От деревьев до здания: <b>≥ 5 м</b> (от стены)</li>
              <li>От деревьев до подземных коммуникаций: <b>≥ 2-3 м</b></li>
              <li>Кустарники между собой в группе: <b>0.7-1.5 м</b></li>
              <li>Живая изгородь однорядная: <b>0.4-0.5 м</b></li>
            </ul>
          </div>
        </div>

        {/* Раздел 3: МАФ */}
        <div className="bg-white dark:bg-slate-900 border border-green-200 dark:border-slate-700 rounded-xl p-4">
          <h2 className="text-sm font-bold text-green-800 dark:text-green-300 mb-3">
            🪑 Раздел 3. МАФ — Малые архитектурные формы
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-green-100 dark:bg-green-900/40 text-green-900 dark:text-green-200">
                  <th className="text-left p-2 border border-green-200 dark:border-green-800">МАФ</th>
                  <th className="text-left p-2 border border-green-200 dark:border-green-800">Стоимость ССЦ РК (2025), тг/шт</th>
                  <th className="text-left p-2 border border-green-200 dark:border-green-800">Установка</th>
                  <th className="text-left p-2 border border-green-200 dark:border-green-800">Норматив</th>
                </tr>
              </thead>
              <tbody className="text-slate-700 dark:text-slate-300">
                {[
                  ["Скамья парковая стандартная", "35 000-65 000", "На бетонную подушку", "ССЦ + ЭСН Сб.47-3-001"],
                  ["Урна металлическая", "12 000-25 000", "Анкерное крепление", "ЭСН Сб.47-3-002"],
                  ["Беседка металл. 3×3 м", "250 000-450 000", "Фундамент столбчатый", "Сб.47-3-005"],
                  ["Детский игровой комплекс", "600 000-2 500 000", "Песчаное основание + бортик", "Сб.47-4-001"],
                  ["Фонарь уличный", "85 000-180 000", "На фундамент Ø300×800", "Сб.47-3-008"],
                  ["Декоративный камень-валун", "По весу 50-150 тыс./т", "Манипулятором", "Сб.47-3-010"],
                  ["Цветочница железобетонная", "18 000-45 000", "Готовая, установка краном", "Сб.47-3-012"],
                ].map((r, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-green-50/40 dark:bg-slate-800/40" : ""}>
                    <td className="p-2 border border-green-100 dark:border-slate-700 font-semibold">{r[0]}</td>
                    <td className="p-2 border border-green-100 dark:border-slate-700 font-mono text-green-800 dark:text-green-300 text-[11px]">
                      {r[1]}
                    </td>
                    <td className="p-2 border border-green-100 dark:border-slate-700 text-[11px]">{r[2]}</td>
                    <td className="p-2 border border-green-100 dark:border-slate-700 font-mono text-[11px]">{r[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Раздел 4: Интерактивные упражнения */}
        <div className="bg-white dark:bg-slate-900 border-2 border-green-300 dark:border-green-700 rounded-xl p-4">
          <h2 className="text-sm font-bold text-green-800 dark:text-green-300 mb-3">
            🎯 Раздел 4. Интерактивные упражнения
          </h2>

          {allDone ? (
            <div className="text-center py-8">
              <div className="text-5xl mb-3">🌳</div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-3">
                Благоустройство освоено!
              </h3>
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4 text-left mb-4 text-xs space-y-1.5 max-w-2xl mx-auto">
                {STEPS.map((s) => (
                  <div key={s.id} className="flex gap-2">
                    <span className="text-green-600 dark:text-green-400 shrink-0">✓</span>
                    <code className="text-[10px] font-mono text-green-900 dark:text-green-200">
                      {s.vor}
                    </code>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 justify-center flex-wrap">
                <button
                  onClick={() => {
                    sxi(0);
                    ssi(0);
                    setInp({});
                    setRev({});
                    setDone(new Set());
                  }}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600"
                >
                  Снова
                </button>
                <Link
                  href="/smeta-trainer/drawings-practice/hub"
                  className="px-4 py-2 bg-green-700 text-white text-sm font-semibold rounded-lg hover:bg-green-800"
                >
                  → К разделам
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-green-50 dark:bg-slate-800 border border-green-200 dark:border-slate-700 rounded-xl p-3">
                <div className="bg-white dark:bg-slate-900 rounded-lg p-4 mb-2">
                  <div className="text-xs font-bold text-green-800 dark:text-green-300 mb-2">
                    🗺 Схема дворовой территории
                  </div>
                  <pre className="text-[11px] text-slate-700 dark:text-slate-300 font-mono leading-relaxed whitespace-pre-wrap">
{`┌──────────────────────────────────────────┐  60 м
│  ╔══════════╗      🌳🌳🌳 (аллея 80 м)  │
│  ║ Здание   ║   ┌──────────┐             │  40 м
│  ║ 18×24 м  ║   │ Площадка │  ░░ дорожки │
│  ╚══════════╝   │ 12×15 м  │  1.5 м×80 м │
│  ░░░░ (1.5 м × 80 м дорожек)             │
│      🌱  Газон обыкновенный 1668 м²      │
└──────────────────────────────────────────┘
   Расчёт газона = S − здание − площадка − дорожки
   F = 60·40 − 432 − 180 − 120 = 1668 м²`}
                  </pre>
                </div>
                <div className="bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded p-2 text-[11px] text-green-900 dark:text-green-200 leading-relaxed">
                  📖 {ex.theory}
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex gap-1 flex-wrap">
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
                          ? "bg-green-600 text-white"
                          : done.has(s.id)
                          ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      {done.has(s.id) ? "✓" : i + 1}
                    </button>
                  ))}
                </div>
                <div className="bg-white dark:bg-slate-900 border border-green-200 dark:border-slate-700 rounded-xl p-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                    {ex.title}
                  </h3>
                  <pre className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3 whitespace-pre-wrap font-sans">
                    {ex.q}
                  </pre>
                  {!done.has(ex.id) ? (
                    <div
                      className={`border-2 rounded-lg p-3 ${
                        ok
                          ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20"
                          : err
                          ? "border-red-300 bg-red-50 dark:bg-red-900/20"
                          : "border-green-200 dark:border-green-700"
                      }`}
                    >
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                        {step.l}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={inp[k] ?? ""}
                          onChange={(e) =>
                            setInp((p) => ({ ...p, [k]: e.target.value }))
                          }
                          onKeyDown={(e) =>
                            e.key === "Enter" && !rev[k] && go()
                          }
                          disabled={!!rev[k]}
                          placeholder="Число..."
                          className="flex-1 border border-green-200 dark:border-slate-600 rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-green-500 dark:bg-slate-800 dark:text-slate-200"
                        />
                        {!rev[k] && (
                          <button
                            onClick={go}
                            disabled={!inp[k]?.trim()}
                            className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded hover:bg-green-700 disabled:opacity-40"
                          >
                            ✓
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
                          className="mt-1 text-[10px] text-amber-700 dark:text-amber-400 underline"
                        >
                          Попробовать снова
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="border-2 border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                      <div className="text-xs font-bold text-green-800 dark:text-green-300 mb-1">
                        ✓ Завершено
                      </div>
                      <code className="text-[10px] font-mono text-green-700 dark:text-green-400 block">
                        {ex.vor}
                      </code>
                    </div>
                  )}
                </div>
                {done.has(ex.id) && xi + 1 < STEPS.length && (
                  <button
                    onClick={() => {
                      sxi(xi + 1);
                      ssi(0);
                      setInp({});
                      setRev({});
                    }}
                    className="w-full py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700"
                  >
                    Следующее →
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Раздел 5: Сезонность */}
        <div className="bg-white dark:bg-slate-900 border border-green-200 dark:border-slate-700 rounded-xl p-4">
          <h2 className="text-sm font-bold text-green-800 dark:text-green-300 mb-3">
            📅 Раздел 5. Сезонность работ по благоустройству
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3">
              <div className="text-xs font-bold text-green-800 dark:text-green-300 mb-1">
                🌸 Весна (апрель-май)
              </div>
              <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                Посадка деревьев и кустарников, посев газонов, ранняя обрезка.
              </p>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3">
              <div className="text-xs font-bold text-yellow-800 dark:text-yellow-300 mb-1">
                ☀ Лето (июнь-август)
              </div>
              <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                Уход (полив, стрижка), пересадка только с земляным комом, рулонные газоны.
              </p>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg p-3">
              <div className="text-xs font-bold text-orange-800 dark:text-orange-300 mb-1">
                🍂 Осень (сентябрь-октябрь)
              </div>
              <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                Посадка деревьев (<b>лучший сезон!</b>), посев газонов, мульчирование, обрезка.
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
              <div className="text-xs font-bold text-blue-800 dark:text-blue-300 mb-1">
                ❄ Зима
              </div>
              <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                Посадка крупномеров с замороженным комом, бордюры на песке, монтаж МАФ.
              </p>
            </div>
          </div>
          <div className="mt-3 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded p-2 text-xs text-blue-900 dark:text-blue-200">
            ❄ <b>Зимний коэффициент:</b> в смете применяется Кз = 1.10-1.20 для посадочных работ зимой.
          </div>
        </div>

        {/* Фактоид */}
        <div className="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 dark:border-green-600 rounded-r-lg p-4">
          <div className="text-sm font-bold text-green-800 dark:text-green-300 mb-1">
            🌱 ВАЖНО: Приживаемость насаждений
          </div>
          <p className="text-xs text-green-900 dark:text-green-200 leading-relaxed">
            По <b>СНиП РК 3.07-01</b> при сдаче объекта учитывается приживаемость насаждений{" "}
            <b>≥ 80%</b>. Если меньше — подрядчик за свой счёт делает подсадку. Поэтому в смете часто
            закладывают <b>+10% от количества саженцев</b> на случай гибели — это узаконенный резерв,
            а не «лишняя позиция».
          </p>
        </div>
      </div>
    </div>
  );
}
