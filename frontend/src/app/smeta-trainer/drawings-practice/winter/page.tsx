"use client";
import Link from "next/link";
import { useState } from "react";

function check(i: string, a: string[], tol = 0.01) {
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
    id: "ex1-coef",
    title: "Упражнение 1: Зимнее удорожание для бетонных работ",
    q: `Объект: монолитные конструкции, г. Караганда, январь.
Стоимость бетонных работ за зимний период (по ЭСН РК) = 12 500 000 тг.
Применяемый зимний коэффициент Кз = 1.30 (бетон с электропрогревом, СН РК 8.02-02-2002).

Рассчитайте сумму зимнего удорожания (только удорожание, без базовой суммы).`,
    ss: [
      {
        id: "uddor",
        l: "Сумма зимнего удорожания, тг",
        a: ["3750000", "3 750 000", "3750000.0"],
        e: "12 500 000 · (1.30 − 1.0) = 12 500 000 · 0.30 = 3 750 000 тг. К ЭСН-стоимости работ применяется коэффициент Кз — итоговая сумма умножается на Кз. Удорожание = база · (Кз − 1).",
      },
    ],
    vor: "Зимнее удорожание бетонных работ (Кз=1.30, СН РК 8.02-02-2002): 12 500 000 · 0.30 = 3 750 000 тг",
    theory:
      "Кз применяется ТОЛЬКО к стоимости работ за календарный зимний период, а не ко всему контракту. Журнал производства работ (КС-6) — основное доказательство периода.",
  },
  {
    id: "ex2-elec",
    title: "Упражнение 2: Расход электроэнергии на прогрев бетона",
    q: `Объект: монолитная плита перекрытия, V=250 м³, t=−12°C.
Метод: электропрогрев греющими проводами ПНСВ.
Удельный расход эл/энергии на прогрев бетона: 80 кВт·ч/м³ (среднее по справочнику).
Тариф на электроэнергию для стройплощадки: 28 тг/кВт·ч.

Рассчитайте: 1) общий расход эл/энергии и 2) стоимость эл/энергии (любой из двух ответов принимается).`,
    ss: [
      {
        id: "energy",
        l: "Расход эл/энергии (кВт·ч) ИЛИ стоимость (тг)",
        a: ["20000", "20 000", "560000", "560 000"],
        e: "Q = 250 м³ · 80 кВт·ч/м³ = 20 000 кВт·ч. Стоимость = 20 000 · 28 тг = 560 000 тг. Эта статья включается в смету как «Дополнительные затраты на зимнее производство работ» отдельной позицией ЛСР.",
      },
    ],
    vor: "Электропрогрев бетона V=250 м³ (ЭСН РК Сб.6 §6-12-x): 20 000 кВт·ч × 28 тг = 560 000 тг",
    theory:
      "При −12°C электропрогрев — основной метод для тонких конструкций (плиты, монолитные стены). Расход 50-100 кВт·ч/м³ зависит от модуля поверхности и температуры.",
  },
  {
    id: "ex3-additive",
    title: "Упражнение 3: Расход противоморозных добавок (нитрит натрия)",
    q: `Объект: бетонирование при t=−10°C, V=100 м³.
Расход цемента в бетоне: 350 кг/м³.
Дозировка противоморозной добавки (нитрит натрия NaNO₂): 2% от массы цемента.

Рассчитайте требуемое количество нитрита натрия (в кг).`,
    ss: [
      {
        id: "additive",
        l: "Масса нитрита натрия, кг",
        a: ["700", "700.0"],
        e: "Цемент: 100 м³ · 350 кг/м³ = 35 000 кг. Добавка: 35 000 · 0.02 = 700 кг. При −10°C достаточно 1-2%, при −15°C нужно 3%. Нитрит натрия NaNO₂ продаётся в мешках по 25 кг → 700/25 = 28 мешков.",
        tol: 0.02,
      },
    ],
    vor: "Противоморозная добавка NaNO₂ для V=100 м³ при t=−10°C: 35 000 кг цем · 2% = 700 кг (28 мешков по 25 кг)",
    theory:
      "Противоморозные добавки эффективны до t=−15°C. Снижение прочности на 10-15% — компенсируется повышением марки на +5%.",
  },
];

// ── Зимнее SVG: схема прогрева бетона ──────────────────────────────────────
function WinterSVG({ active }: { active: string }) {
  return (
    <svg viewBox="0 0 600 340" className="w-full h-auto" style={{ maxHeight: 340 }}>
      {/* Снежинки фон */}
      {[
        [50, 30],
        [120, 60],
        [200, 25],
        [320, 50],
        [430, 30],
        [520, 65],
        [80, 90],
        [560, 110],
      ].map(([x, y], i) => (
        <text key={i} x={x} y={y} fontSize={14} fill="#bae6fd" opacity={0.6}>
          ❄
        </text>
      ))}

      {/* Грунт (земля) */}
      <rect x={20} y={260} width={560} height={60} fill="#1e293b" opacity={0.15} />
      <text x={30} y={278} fontSize={9} fill="#475569">
        мёрзлый грунт (h промерзания 1.2-2.0 м)
      </text>

      {/* Опалубка - утеплённая (метод термос) */}
      <g opacity={active === "ex1-coef" || active === "ex2-elec" ? 1 : 0.45}>
        <rect
          x={60}
          y={160}
          width={140}
          height={100}
          fill={active === "ex1-coef" ? "#dbeafe" : "#e0f2fe"}
          stroke={active === "ex1-coef" ? "#2563eb" : "#0284c7"}
          strokeWidth={2}
        />
        {/* Утеплитель минвата */}
        <rect x={55} y={155} width={150} height={5} fill="#fbbf24" opacity={0.7} />
        <rect x={55} y={260} width={150} height={5} fill="#fbbf24" opacity={0.7} />
        <rect x={50} y={155} width={10} height={110} fill="#fbbf24" opacity={0.7} />
        <rect x={200} y={155} width={10} height={110} fill="#fbbf24" opacity={0.7} />
        <text x={130} y={150} textAnchor="middle" fontSize={9} fill="#92400e">
          утепление минватой δ=50мм
        </text>
        <text x={130} y={215} textAnchor="middle" fontSize={10} fontWeight="600" fill="#1e40af">
          БЕТОН В25
        </text>
        <text x={130} y={230} textAnchor="middle" fontSize={9} fill="#1e40af">
          метод «термос»
        </text>
        <text x={130} y={285} textAnchor="middle" fontSize={9} fill="#475569" fontStyle="italic">
          для b ≥ 0.4 м
        </text>
      </g>

      {/* Электропрогрев ПНСВ */}
      <g opacity={active === "ex2-elec" ? 1 : 0.45}>
        <rect
          x={240}
          y={180}
          width={140}
          height={80}
          fill={active === "ex2-elec" ? "#fef3c7" : "#fef9c3"}
          stroke={active === "ex2-elec" ? "#d97706" : "#ca8a04"}
          strokeWidth={2}
        />
        {/* Греющие провода (волнистые линии) */}
        {[200, 215, 230, 245].map((y) => (
          <path
            key={y}
            d={`M 250 ${y} Q 270 ${y - 5} 290 ${y} T 330 ${y} T 370 ${y}`}
            stroke="#dc2626"
            strokeWidth={1.5}
            fill="none"
          />
        ))}
        <text x={310} y={195} textAnchor="middle" fontSize={9} fill="#92400e">
          провод ПНСВ
        </text>
        <text x={310} y={275} textAnchor="middle" fontSize={9} fontWeight="600" fill="#92400e">
          электропрогрев
        </text>
        <text x={310} y={290} textAnchor="middle" fontSize={9} fill="#475569" fontStyle="italic">
          50-100 кВт·ч/м³
        </text>

        {/* Трансформатор */}
        <rect x={400} y={195} width={50} height={40} fill="#dc2626" opacity={0.85} stroke="#7f1d1d" strokeWidth={1.5} />
        <text x={425} y={220} textAnchor="middle" fontSize={9} fontWeight="700" fill="white">
          ТР-Р
        </text>
        <line x1={380} y1={215} x2={400} y2={215} stroke="#dc2626" strokeWidth={2} />
      </g>

      {/* Противоморозные добавки */}
      <g opacity={active === "ex3-additive" ? 1 : 0.45}>
        <rect
          x={470}
          y={180}
          width={110}
          height={80}
          fill={active === "ex3-additive" ? "#cffafe" : "#ecfeff"}
          stroke={active === "ex3-additive" ? "#0891b2" : "#0e7490"}
          strokeWidth={2}
        />
        {/* Капли добавки */}
        {[[490, 200], [510, 215], [530, 200], [550, 215], [490, 235], [530, 235], [560, 240]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={3} fill="#06b6d4" opacity={0.8} />
        ))}
        <text x={525} y={275} textAnchor="middle" fontSize={9} fontWeight="600" fill="#155e75">
          NaNO₂ 1-3%
        </text>
        <text x={525} y={290} textAnchor="middle" fontSize={9} fill="#475569" fontStyle="italic">
          до t=−15°C
        </text>
      </g>

      {/* Заголовок */}
      <text x={300} y={20} textAnchor="middle" fontSize={12} fontWeight="700" fill="#1e3a8a">
        ❄ Три метода зимнего бетонирования (СН РК 8.02-02-2002)
      </text>
      <text x={300} y={35} textAnchor="middle" fontSize={9} fill="#64748b" fontStyle="italic">
        термос · электропрогрев ПНСВ · противоморозные добавки
      </text>

      {/* Термометр */}
      <g transform="translate(15, 100)">
        <rect x={0} y={0} width={20} height={120} rx={10} fill="#e0f2fe" stroke="#0284c7" strokeWidth={1.5} />
        <rect x={5} y={70} width={10} height={45} fill="#0284c7" />
        <circle cx={10} cy={120} r={12} fill="#0284c7" />
        <text x={28} y={15} fontSize={8} fill="#475569">
          0°C
        </text>
        <text x={28} y={45} fontSize={8} fill="#475569">
          −10°C
        </text>
        <text x={28} y={75} fontSize={8} fill="#dc2626" fontWeight="700">
          −15°C
        </text>
        <text x={28} y={105} fontSize={8} fill="#475569">
          −25°C
        </text>
      </g>
    </svg>
  );
}

export default function WinterPage() {
  const [xi, sxi] = useState(0);
  const [si, ssi] = useState(0);
  const [inp, setInp] = useState<Record<string, string>>({});
  const [rev, setRev] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Set<string>>(new Set());
  const ex = STEPS[xi];
  const step = ex.ss[si];
  const k = `${ex.id}-${step.id}`;
  const ok = rev[k] && check(inp[k] ?? "", step.a, step.tol ?? 0.01);
  const err = rev[k] && !ok;

  function go() {
    setRev((r) => ({ ...r, [k]: true }));
    if (check(inp[k] ?? "", step.a, step.tol ?? 0.01)) {
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
    <div className="min-h-screen bg-blue-50 dark:bg-slate-950">
      <header className="bg-blue-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-xs text-blue-200 hover:text-white"
          >
            ← К разделам
          </Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold">
              ❄️ Зимние работы — удорожание, прогрев, противоморозные добавки
            </h1>
            <p className="text-[10px] text-blue-200">
              СН РК 8.02-02-2002 · СНиП РК 5.03-37-2005 · {done.size}/{STEPS.length} пройдено
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 space-y-4">
        {/* Нормативный блок */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 dark:border-blue-400 rounded-r-lg p-4 space-y-2">
          <h2 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-1">
            📘 Нормативная база
          </h2>
          <ul className="text-xs text-blue-900 dark:text-blue-200 space-y-1 leading-relaxed">
            <li>
              • <b>СН РК 8.02-02-2002</b> «Сборник сметных норм дополнительных затрат при производстве СМР в зимнее время»
            </li>
            <li>
              • <b>СНиП РК 5.03-37-2005</b> «Бетонные и железобетонные работы» (раздел зимнего бетонирования)
            </li>
            <li>
              • <b>СН РК 4.03-04-2013</b> «Производство земляных работ в зимнее время»
            </li>
          </ul>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
            <div className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-700 rounded p-2 text-xs">
              <span className="font-semibold text-blue-800 dark:text-blue-300">Алматы:</span>{" "}
              <span className="text-slate-700 dark:text-slate-300">
                с 1 ноября по 31 марта (5 мес.)
              </span>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-700 rounded p-2 text-xs">
              <span className="font-semibold text-blue-800 dark:text-blue-300">Астана / Караганда:</span>{" "}
              <span className="text-slate-700 dark:text-slate-300">
                с 15 октября по 15 апреля (6 мес.)
              </span>
            </div>
          </div>
        </div>

        {/* Раздел 1: Коэффициенты */}
        <div className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-slate-700 rounded-xl p-4">
          <h2 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-2">
            📊 Раздел 1. Коэффициенты зимнего удорожания (СН РК 8.02-02-2002)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-blue-100 dark:bg-blue-900/40 text-blue-900 dark:text-blue-200">
                  <th className="text-left p-2 border border-blue-200 dark:border-blue-800">Группа работ</th>
                  <th className="text-left p-2 border border-blue-200 dark:border-blue-800">Кз</th>
                  <th className="text-left p-2 border border-blue-200 dark:border-blue-800">Применение</th>
                </tr>
              </thead>
              <tbody className="text-slate-700 dark:text-slate-300">
                {[
                  ["Земляные работы (мерзлый грунт)", "1.30 - 1.60", "Только при t<−5°C"],
                  ["Бетонные работы (наружные)", "1.20 - 1.45", "Прогрев + добавки + укрытие"],
                  ["Кладка кирпичная", "1.18 - 1.30", "Тепляки + раствор с добавками"],
                  ["Монтаж сборного ж/б", "1.10 - 1.15", "Подогрев бетонных стыков"],
                  ["Кровельные работы (рулонные)", "1.20 - 1.30", "Прогрев основания + клея"],
                  ["Штукатурные (внутренние)", "1.05 - 1.10", "Только если внутри без отопления"],
                  ["Малярные работы", "1.10 - 1.20", "Воздух >+10°C обязательно"],
                  ["Электромонтажные", "1.05 - 1.10", "Холодные руки = брак"],
                ].map((r, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-blue-50/40 dark:bg-slate-800/40" : ""}>
                    <td className="p-2 border border-blue-100 dark:border-slate-700">{r[0]}</td>
                    <td className="p-2 border border-blue-100 dark:border-slate-700 font-mono font-semibold text-blue-800 dark:text-blue-300">
                      {r[1]}
                    </td>
                    <td className="p-2 border border-blue-100 dark:border-slate-700 text-[11px]">{r[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded p-2 text-xs text-blue-900 dark:text-blue-200">
            ⚡ <b>Важно:</b> Кз применяется к стоимости работ за зимний период, а не ко всему контракту!
          </div>
        </div>

        {/* Раздел 2: Зимнее бетонирование */}
        <div className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-slate-700 rounded-xl p-4">
          <h2 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-3">
            🧊 Раздел 2. Зимнее бетонирование — три метода
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
              <div className="text-xs font-bold text-blue-800 dark:text-blue-300 mb-1">«Термос»</div>
              <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                Массивные конструкции (b ≥ 0.4 м, модуль поверхности до 6). Бетон М300+, ПЦ400+,
                утепление опалубки + укрытие минватой. Без внешнего подогрева. Доп. затраты:{" "}
                <b>+5-10%</b> на цемент.
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
              <div className="text-xs font-bold text-blue-800 dark:text-blue-300 mb-1">Электропрогрев</div>
              <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                Тонкие конструкции (плиты, монолитные стены). Греющие провода ПНСВ. Расход:{" "}
                <b>50-100 кВт·ч/м³</b>. Расценка: ЭСН РК Сб.6 §6-12-x.
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
              <div className="text-xs font-bold text-blue-800 dark:text-blue-300 mb-1">Противоморозные добавки</div>
              <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                Нитрит натрия + ускорители. До <b>t=−15°C</b>. Расход: 1-3% от массы цемента.
                Снижение прочности на 10-15%, требует +5% марки.
              </p>
            </div>
          </div>
          <div className="mt-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">
              📋 Пример расчёта: бетонирование монолитной плиты
            </div>
            <pre className="text-[11px] text-slate-700 dark:text-slate-300 font-mono leading-relaxed whitespace-pre-wrap">
{`Объект: монолитная плита 100 м³, t=−12°C
Метод: электропрогрев
Расход эл/энергии: 100 м³ · 80 кВт·ч/м³ = 8 000 кВт·ч
Стоимость эл/энергии: 8 000 · 28 тг = 224 000 тг
Доп. рабочие: круглосуточный надзор за прогревом, +0.4 чел/смену
Итого зимнее удорожание: ≈ 18-22% от стоимости бетонных работ`}
            </pre>
          </div>
        </div>

        {/* Раздел 3: Зимняя разработка грунта */}
        <div className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-slate-700 rounded-xl p-4">
          <h2 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-3">
            ⛏ Раздел 3. Зимняя разработка грунта (СН РК 4.03-04-2013)
          </h2>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 space-y-2">
            <div className="text-xs text-blue-900 dark:text-blue-200">
              <b>Мёрзлый грунт = IV категория</b> по ЭСН (даже если в тёплое время это I-II).
            </div>
            <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5 leading-relaxed list-disc pl-5">
              <li>
                <b>Предварительный прогрев:</b> тепляки, химический прогрев (NaCl), электропрогрев.
                Расход: <b>5-15 кВт·ч/м³</b>.
              </li>
              <li>
                <b>Послойное оттаивание:</b> бульдозером по мере оттайки (для больших площадок).
              </li>
              <li>
                <b>Механизированное рыхление:</b> рыхлитель + экскаватор. Расход:{" "}
                <b>+30-50% времени</b>.
              </li>
            </ul>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-700 rounded p-2 text-xs">
                <span className="font-semibold text-blue-800 dark:text-blue-300">Глубина промерзания Алматы:</span>{" "}
                <span className="text-slate-700 dark:text-slate-300 font-mono">1.2 м</span>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-700 rounded p-2 text-xs">
                <span className="font-semibold text-blue-800 dark:text-blue-300">Глубина промерзания Астана:</span>{" "}
                <span className="text-slate-700 dark:text-slate-300 font-mono">2.0 м</span>
              </div>
            </div>
          </div>
        </div>

        {/* Раздел 4: Интерактивные упражнения */}
        <div className="bg-white dark:bg-slate-900 border-2 border-blue-300 dark:border-blue-700 rounded-xl p-4">
          <h2 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-3">
            🎯 Раздел 4. Интерактивные упражнения
          </h2>

          {allDone ? (
            <div className="text-center py-8">
              <div className="text-5xl mb-3">❄️</div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-3">
                Зимние работы освоены!
              </h3>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 text-left mb-4 text-xs space-y-1.5 max-w-2xl mx-auto">
                {STEPS.map((s) => (
                  <div key={s.id} className="flex gap-2">
                    <span className="text-blue-600 dark:text-blue-400 shrink-0">✓</span>
                    <code className="text-[10px] font-mono text-blue-900 dark:text-blue-200">
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
                  className="px-4 py-2 bg-blue-700 text-white text-sm font-semibold rounded-lg hover:bg-blue-800"
                >
                  → К разделам
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-700 rounded-xl p-3">
                <WinterSVG active={ex.id} />
                <div className="mt-2 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded p-2 text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
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
                          ? "bg-blue-600 text-white"
                          : done.has(s.id)
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      {done.has(s.id) ? "✓" : i + 1}
                    </button>
                  ))}
                </div>
                <div className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-slate-700 rounded-xl p-3">
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
                          : "border-blue-200 dark:border-blue-700"
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
                          className="flex-1 border border-blue-200 dark:border-slate-600 rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-800 dark:text-slate-200"
                        />
                        {!rev[k] && (
                          <button
                            onClick={go}
                            disabled={!inp[k]?.trim()}
                            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700 disabled:opacity-40"
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
                    <div className="border-2 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                      <div className="text-xs font-bold text-blue-800 dark:text-blue-300 mb-1">
                        ✓ Завершено
                      </div>
                      <code className="text-[10px] font-mono text-blue-700 dark:text-blue-400 block">
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
                    className="w-full py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700"
                  >
                    Следующее →
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Сравнительная таблица по регионам */}
        <div className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-slate-700 rounded-xl p-4">
          <h2 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-3">
            🗺 Зимние условия по регионам РК
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-blue-100 dark:bg-blue-900/40 text-blue-900 dark:text-blue-200">
                  <th className="text-left p-2 border border-blue-200 dark:border-blue-800">Регион РК</th>
                  <th className="text-left p-2 border border-blue-200 dark:border-blue-800">Зимний период</th>
                  <th className="text-left p-2 border border-blue-200 dark:border-blue-800">Гл. промерзания, м</th>
                  <th className="text-left p-2 border border-blue-200 dark:border-blue-800">Преобладающий метод</th>
                </tr>
              </thead>
              <tbody className="text-slate-700 dark:text-slate-300">
                {[
                  ["Алматы / Шымкент", "01.11 - 31.03", "1.2", "Противоморозные добавки"],
                  ["Караганда / Астана", "15.10 - 15.04", "2.0", "Электропрогрев + тепляки"],
                  ["Костанай / Кокшетау", "15.10 - 15.04", "2.0", "Электропрогрев + добавки"],
                  ["Атырау / Актау", "01.12 - 28.02", "0.8", "Минимальные мероприятия"],
                ].map((r, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-blue-50/40 dark:bg-slate-800/40" : ""}>
                    <td className="p-2 border border-blue-100 dark:border-slate-700 font-semibold">
                      {r[0]}
                    </td>
                    <td className="p-2 border border-blue-100 dark:border-slate-700 font-mono">{r[1]}</td>
                    <td className="p-2 border border-blue-100 dark:border-slate-700 font-mono text-blue-800 dark:text-blue-300">
                      {r[2]}
                    </td>
                    <td className="p-2 border border-blue-100 dark:border-slate-700 text-[11px]">{r[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Фактоид-предупреждение */}
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 dark:border-red-600 rounded-r-lg p-4">
          <div className="text-sm font-bold text-red-800 dark:text-red-300 mb-1">
            ⚠ ВНИМАНИЕ
          </div>
          <p className="text-xs text-red-900 dark:text-red-200 leading-relaxed">
            Зимние коэффициенты применяются <b>ТОЛЬКО</b> к работам, выполненным в зимний период
            по календарю. Если работы шли с 15 ноября по 15 февраля — зимний Кз только за эти 3
            месяца, остальное — летние расценки. Журнал производства работ (КС-6) — основное
            доказательство периода!
          </p>
        </div>
      </div>
    </div>
  );
}
