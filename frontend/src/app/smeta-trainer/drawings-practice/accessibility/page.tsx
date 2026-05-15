"use client";
import Link from "next/link";
import { useState } from "react";
import { DimLine, Arrow } from "../_svg";

function check(i: string, a: string[]) {
  const v = parseFloat(i.replace(",", "."));
  return a.some(x => {
    const e = parseFloat(x.replace(",", "."));
    return !isNaN(v) && !isNaN(e) && Math.abs((v - e) / e) < 0.05;
  });
}
function checkExact(i: string, a: string[]) {
  const v = parseFloat(i.replace(",", "."));
  return a.some(x => {
    const e = parseFloat(x.replace(",", "."));
    return !isNaN(v) && !isNaN(e) && Math.abs(v - e) < 0.01;
  });
}

// ── SVG: Боковой вид пандуса с уклоном 1:12 ─────────────────────────────────
function RampSVG() {
  // Масштаб: 1 м = 60 px по горизонтали, 1 м = 200 px по вертикали (для наглядности)
  const SX = 60;
  const SY = 200;
  const RAMP_L = 9; // 9 м длина
  const RAMP_H = 0.75; // 0.75 м подъём
  const PAD = 1.5; // 1.5 м площадка отдыха
  const OX = 70;
  const OY = 280; // нижний уровень земли

  // Координаты ключевых точек
  const padBottomR = OX + PAD * SX;
  const rampTopX = padBottomR + RAMP_L * SX;
  const rampTopY = OY - RAMP_H * SY;
  const padTopR = rampTopX + PAD * SX;

  return (
    <svg viewBox="0 0 720 360" className="w-full h-auto" style={{ maxHeight: 360 }}>
      <defs>
        <pattern id="hatch-ground" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#a8a29e" strokeWidth="0.6" />
        </pattern>
        <pattern id="hatch-ramp" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke="#7dd3fc" strokeWidth="0.8" />
        </pattern>
      </defs>

      {/* Земля (нижний уровень) */}
      <rect x={0} y={OY} width={OX + PAD * SX} height={50} fill="url(#hatch-ground)" stroke="#78716c" strokeWidth={0.5} />
      <line x1={0} y1={OY} x2={padBottomR} y2={OY} stroke="#57534e" strokeWidth={1} />

      {/* Площадка отдыха внизу */}
      <rect x={OX} y={OY - 8} width={PAD * SX} height={8} fill="#e0f2fe" stroke="#0284c7" strokeWidth={1} />
      <text x={OX + PAD * SX / 2} y={OY + 22} textAnchor="middle" fontSize={8} fill="#0c4a6e" fontWeight="600">
        Площадка 1.5×1.5
      </text>

      {/* Тело пандуса (наклонная плоскость) */}
      <polygon
        points={`${padBottomR},${OY} ${rampTopX},${rampTopY} ${rampTopX},${OY} ${padBottomR},${OY}`}
        fill="url(#hatch-ramp)"
        stroke="#0284c7"
        strokeWidth={1.5}
      />
      {/* Поверхность пандуса (антискольз. покрытие) */}
      <line x1={padBottomR} y1={OY} x2={rampTopX} y2={rampTopY} stroke="#0369a1" strokeWidth={2.5} />

      {/* Площадка отдыха вверху */}
      <rect x={rampTopX} y={rampTopY - 8} width={PAD * SX} height={8} fill="#e0f2fe" stroke="#0284c7" strokeWidth={1} />
      <rect x={rampTopX} y={rampTopY} width={PAD * SX} height={OY - rampTopY + 50} fill="url(#hatch-ground)" stroke="#78716c" strokeWidth={0.5} />
      <text x={rampTopX + PAD * SX / 2} y={rampTopY - 15} textAnchor="middle" fontSize={8} fill="#0c4a6e" fontWeight="600">
        Площадка 1.5×1.5
      </text>

      {/* Бортик 50 мм по краю пандуса (нижний край) */}
      <line x1={padBottomR} y1={OY - 4} x2={rampTopX} y2={rampTopY - 4} stroke="#dc2626" strokeWidth={2} />
      <text x={padBottomR + 60} y={OY - 8} fontSize={7} fill="#dc2626" fontStyle="italic">бортик 50 мм</text>

      {/* Маркировка края — жёлтая полоса */}
      <line x1={padBottomR - 4} y1={OY - 0.5} x2={padBottomR + 4} y2={OY - 0.5} stroke="#facc15" strokeWidth={4} />
      <line x1={rampTopX - 4} y1={rampTopY - 0.5} x2={rampTopX + 4} y2={rampTopY - 0.5} stroke="#facc15" strokeWidth={4} />

      {/* Поручни (верхний 0.9 м и нижний 0.7 м) — стойки и горизонтали */}
      {/* Стойки */}
      {[0, 0.25, 0.5, 0.75, 1].map(t => {
        const x = padBottomR + t * (rampTopX - padBottomR);
        const y = OY + t * (rampTopY - OY);
        return (
          <g key={t}>
            <line x1={x} y1={y} x2={x} y2={y - 0.9 * SY * 0.3} stroke="#475569" strokeWidth={1.2} />
          </g>
        );
      })}
      {/* Поручень 0.9 м (верхний) */}
      <line x1={padBottomR} y1={OY - 0.9 * SY * 0.3} x2={rampTopX} y2={rampTopY - 0.9 * SY * 0.3} stroke="#1e293b" strokeWidth={2.5} />
      {/* Поручень 0.7 м (нижний) */}
      <line x1={padBottomR} y1={OY - 0.7 * SY * 0.3} x2={rampTopX} y2={rampTopY - 0.7 * SY * 0.3} stroke="#475569" strokeWidth={2} />

      <text x={padBottomR - 22} y={OY - 0.9 * SY * 0.3 + 3} fontSize={8} fill="#1e293b" textAnchor="end">0.9 м</text>
      <text x={padBottomR - 22} y={OY - 0.7 * SY * 0.3 + 3} fontSize={8} fill="#475569" textAnchor="end">0.7 м</text>

      {/* Размер: длина пандуса (горизонталь снизу) */}
      <DimLine x1={padBottomR} y1={OY + 38} x2={rampTopX} y2={OY + 38} label="9 м длина пандуса" color="#0284c7" />

      {/* Размер: подъём (вертикаль справа) */}
      <line x1={rampTopX + 30} y1={OY} x2={rampTopX + 30} y2={rampTopY} stroke="#0284c7" strokeWidth={0.8} strokeDasharray="3 2" />
      <Arrow x1={rampTopX + 30} y1={OY} x2={rampTopX + 30} y2={rampTopY} color="#0284c7" />
      <text
        x={rampTopX + 42}
        y={(OY + rampTopY) / 2 + 3}
        fontSize={9}
        fill="#0284c7"
        fontStyle="italic"
        transform={`rotate(-90, ${rampTopX + 42}, ${(OY + rampTopY) / 2 + 3})`}
      >
        h = 0.75 м подъём
      </text>

      {/* Уклон — подпись на пандусе */}
      <text
        x={(padBottomR + rampTopX) / 2}
        y={(OY + rampTopY) / 2 - 14}
        textAnchor="middle"
        fontSize={11}
        fontWeight="700"
        fill="#0c4a6e"
        transform={`rotate(${(Math.atan2(rampTopY - OY, rampTopX - padBottomR) * 180) / Math.PI}, ${(padBottomR + rampTopX) / 2}, ${(OY + rampTopY) / 2 - 14})`}
      >
        Уклон 1:12 (≈ 8.3 %)
      </text>

      {/* Уровни ▽ */}
      <line x1={20} y1={OY} x2={50} y2={OY} stroke="#64748b" strokeWidth={0.8} />
      <text x={18} y={OY + 4} fontSize={8} fill="#64748b" textAnchor="end">▽ 0.000</text>
      <line x1={rampTopX + 80} y1={rampTopY} x2={rampTopX + 110} y2={rampTopY} stroke="#64748b" strokeWidth={0.8} />
      <text x={rampTopX + 114} y={rampTopY + 4} fontSize={8} fill="#64748b">▽ +0.750</text>

      {/* Заголовок */}
      <text x={360} y={20} textAnchor="middle" fontSize={11} fontWeight="700" fill="#0c4a6e">
        Пандус для МГН — боковой вид
      </text>
      <text x={360} y={32} textAnchor="middle" fontSize={8} fill="#64748b" fontStyle="italic">
        М 1:30 · СНиП РК 3.06-09-2007 · Доступная среда
      </text>
    </svg>
  );
}

// ── Упражнения ──────────────────────────────────────────────────────────────
const STEPS = [
  {
    id: "ramp-length",
    title: "Длина пандуса при подъёме 0.6 м",
    q: "Подъём пандуса h = 0.6 м. Уклон по СНиП РК 3.06-09-2007 п. 3.9 — основной норматив для МГН: 1:12 (≈ 8.3 %). Найдите длину пандуса L.",
    label: "Длина пандуса L, м",
    a: ["7.2", "7,2"],
    e: "L = h × 12 = 0.6 × 12 = 7.2 м. На каждый метр подъёма — 12 метров пандуса. Это основной норматив для МГН по СНиП РК 3.06-09-2007 п. 3.9.",
    vor: "Пандус бетонный с покрытием, h=0.6 м, L=7.2 м (СНиП РК 3.06-09-2007 п. 3.9, ЭСН Сб.27-1-008)",
    theory: "Уклон 1:12 = 8.3 % — допустимый для самостоятельного движения колясочника. В стеснённых условиях допускается 1:8 (12.5 %), но только с сопровождающим.",
    tol: "soft" as const,
  },
  {
    id: "ramp-area",
    title: "Площадь пандуса для подсчёта объёма работ",
    q: "Длина пандуса L = 7.2 м (из задачи 1). Ширина пандуса b = 1.2 м (для одностороннего движения с запасом). Рассчитайте площадь покрытия F.",
    label: "Площадь пандуса F, м²",
    a: ["8.64", "8,64", "8.6"],
    e: "F = L × b = 7.2 × 1.2 = 8.64 м². Ширина пандуса по СНиП РК 3.06-09 п. 3.10 — минимум 1.0 м, типично 1.2-1.5 м.",
    vor: "Покрытие пандуса антискольз. F = 7.2×1.2 = 8.64 м² (СНиП РК 3.06-09 п. 3.10, ЭСН Сб.27-1-008)",
    theory: "Ширина 1.0 м — для одного колясочника, 1.5 м — для двух. Для общественных объектов лучше принимать 1.2 м (с запасом на манёвр).",
    tol: "soft" as const,
  },
  {
    id: "tactile",
    title: "Кол-во тактильной плитки 300×300 на лестницу",
    q: "Лестница шириной 2.5 м. Перед ступенями нужна предупреждающая полоса тактильной плитки 600 мм = 2 ряда плиток 300×300. Сколько плиток в одном ряду?",
    label: "Плиток в ряду, шт",
    a: ["9"],
    e: "На один ряд: 2.5 / 0.3 = 8.33 → 9 шт (округление вверх). Полоса = 2 ряда × 9 = 18 шт суммарно. Предупреждающая полоса перед лестницей по ГОСТ Р 52131 — минимум 600 мм.",
    vor: "Тактильная плитка 300×300 жёлтая бетонная — 18 шт (2 ряда × 9), ЭСН Сб.27-3-005, ССЦ 4 200 тг/шт",
    theory: "Перед каждой лестницей и перепадом обязательна предупреждающая полоса тактильных плиток. Цвет — ярко-жёлтый RAL 1016, контраст ≥ 70 % с покрытием.",
    tol: "exact" as const,
  },
  {
    id: "wc-equip",
    title: "Стоимость комплекта оборудования санузла МГН",
    q: "Комплект для санузла МГН: унитаз + 4 поручня + кнопка экстренного вызова + раковина МГН + зеркало с наклоном. Учебная цена комплекта — 285 000 тг. Установка — 65 000 тг. Итого, тыс. тг?",
    label: "Итого, тыс. тг",
    a: ["350"],
    e: "285 + 65 = 350 тыс. тг. Эта позиция включается отдельной строкой в смете для общественных объектов. На один санузел МГН — увеличение стоимости отделки на 30-50 % против обычного.",
    vor: "Комплект оборудования санузла МГН + установка = 350 000 тг (СНиП РК 3.06-09 п. 5.4, ЭСН Сб.16-05-x + ССЦ)",
    theory: "Санузел МГН — обязательно минимум 1 на этаже общественного здания. Размеры: мин. 1.65×1.80 м, рекоменд. 2.20×2.40 м.",
    tol: "soft" as const,
  },
];

export default function AccessibilityPage() {
  const [xi, sxi] = useState(0);
  const [inp, setInp] = useState<Record<string, string>>({});
  const [rev, setRev] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Set<string>>(new Set());
  const [checks, setChecks] = useState<Set<number>>(new Set());

  const ex = STEPS[xi];
  const k = ex.id;
  const isOk = ex.tol === "exact" ? checkExact(inp[k] ?? "", ex.a) : check(inp[k] ?? "", ex.a);
  const ok = rev[k] && isOk;
  const err = rev[k] && !isOk;

  function go() {
    setRev(r => ({ ...r, [k]: true }));
    if (isOk) {
      setTimeout(() => setDone(d => new Set([...d, ex.id])), 700);
    }
  }
  const allDone = done.size === STEPS.length;

  function toggleCheck(i: number) {
    setChecks(c => {
      const n = new Set(c);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  }

  const checklist = [
    "Пандус у всех входов (если есть ступени)",
    "Поручни на лестницах с обеих сторон",
    "Тактильная плитка перед всеми ступенями",
    "Контрастные полосы на крайних ступенях",
    "Лифт с речевым оповещением (для зданий >2 этажей)",
    "Расширенные дверные проёмы ≥ 0.9 м",
    "Санузел МГН минимум 1 на этаже",
    "Кнопки в лифте на h ≤ 1.4 м (для коляски)",
    "Световые/звуковые индикаторы (для слабослышащих/слабовидящих)",
    "Парковочные места МГН (1 на каждые 25)",
  ];

  return (
    <div className="min-h-screen bg-sky-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-sky-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link href="/smeta-trainer/drawings-practice/hub" className="text-xs text-sky-200 hover:text-white">
            ← К разделам
          </Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold">♿ Доступная среда — пандусы, поручни, тактильная плитка</h1>
            <p className="text-[10px] text-sky-200">
              СНиП РК 3.06-09-2007 · ГОСТ Р 52131-2003 · {done.size}/{STEPS.length} упражнений пройдено
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 space-y-4">
        {/* Введение */}
        <section className="bg-white dark:bg-slate-900 border-2 border-sky-500 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">📌</span>
            <div className="flex-1 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              <div className="font-bold text-sky-800 dark:text-sky-300 mb-2">
                Доступная среда — обязательный раздел для:
              </div>
              <ul className="list-disc ml-4 space-y-0.5 mb-3">
                <li>Всех общественных зданий (школы, больницы, ТРЦ, гос. учреждения)</li>
                <li>Жилых домов 5+ этажей</li>
                <li>Транспортных объектов (вокзалы, аэропорты, остановки)</li>
                <li>Открытых пространств (тротуары, парки)</li>
              </ul>
              <div className="font-bold text-sky-800 dark:text-sky-300 mb-1">
                Сметчик ОТДЕЛЬНОЙ статьёй закладывает:
              </div>
              <ul className="list-disc ml-4 space-y-0.5">
                <li>Пандусы и подъёмники</li>
                <li>Поручни (внутренние и наружные)</li>
                <li>Тактильные плитки и наземные знаки</li>
                <li>Лифты с речевым оповещением</li>
                <li>Дверные проёмы расширенные</li>
                <li>Санузлы для МГН</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Нормативный блок */}
        <section className="bg-sky-50 dark:bg-sky-900/20 border border-sky-300 dark:border-sky-700 rounded-xl p-4">
          <h2 className="text-sm font-bold text-sky-800 dark:text-sky-300 mb-2">📚 Нормативная база</h2>
          <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
            <li>
              <span className="font-mono font-bold text-sky-700 dark:text-sky-400">СНиП РК 3.06-09-2007</span>
              {" — "}«Доступность зданий и сооружений для маломобильных групп населения»
            </li>
            <li>
              <span className="font-mono font-bold text-sky-700 dark:text-sky-400">СН РК 3.02-19-2011</span>
              {" — "}«Общественные здания и сооружения»
            </li>
            <li>
              <span className="font-mono font-bold text-sky-700 dark:text-sky-400">ГОСТ Р 52131-2003</span>
              {" — "}«Средства отображения информации тактильные»
            </li>
            <li>
              <span className="font-mono font-bold text-sky-700 dark:text-sky-400">Постановление РК № 754 (2008)</span>
              {" — "}требования к доступной среде
            </li>
          </ul>
        </section>

        {/* Раздел 1: Пандусы — нормативы */}
        <section className="bg-white dark:bg-slate-900 border border-sky-200 dark:border-slate-700 rounded-xl p-4">
          <h2 className="text-sm font-bold text-sky-800 dark:text-sky-300 mb-3">📐 Раздел 1. Пандусы — нормативы</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-300">
                  <th className="text-left px-2 py-1.5 font-bold">Параметр</th>
                  <th className="text-left px-2 py-1.5 font-bold">Значение</th>
                  <th className="text-left px-2 py-1.5 font-bold">Источник</th>
                </tr>
              </thead>
              <tbody className="text-slate-700 dark:text-slate-300">
                {[
                  ["Уклон пандуса для МГН", "≤ 1:12 (~8.3 %) — основной", "СНиП РК 3.06-09 п. 3.9"],
                  ["Уклон в стеснённых условиях", "≤ 1:8 (~12.5 %)", "СНиП РК 3.06-09 п. 3.9"],
                  ["Ширина пандуса", "≥ 1.0 м (для одного), 1.5 м (для двух)", "СНиП РК 3.06-09 п. 3.10"],
                  ["Высота поручней", "0.7 + 0.9 м (двойной поручень)", "СНиП РК 3.06-09 п. 3.18"],
                  ["Длина пролёта без отдыха", "≤ 9 м (далее площадка 1.5×1.5 м)", "СНиП РК 3.06-09 п. 3.11"],
                  ["Бортик пандуса", "≥ 50 мм по краям", "СНиП РК 3.06-09 п. 3.13"],
                  ["Покрытие пандуса", "Антискольз. (не металл!)", "СНиП РК 3.06-09 п. 3.14"],
                  ["Уличный пандус — водоотвод", "Подогрев или дренаж", "СНиП РК 3.06-09 п. 3.15"],
                  ["Маркировка края", "Жёлтая полоса 50 мм", "СНиП РК 3.06-09 п. 3.16"],
                ].map((row, i) => (
                  <tr key={i} className="border-b border-sky-100 dark:border-slate-700">
                    <td className="px-2 py-1.5">{row[0]}</td>
                    <td className="px-2 py-1.5 font-mono text-[11px]">{row[1]}</td>
                    <td className="px-2 py-1.5 text-[11px] text-sky-700 dark:text-sky-400">{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Чертёж пандуса */}
          <div className="mt-4 bg-sky-50 dark:bg-slate-800 border border-sky-200 dark:border-slate-700 rounded-lg p-2">
            <RampSVG />
          </div>
        </section>

        {/* Раздел 2: Тактильные плитки */}
        <section className="bg-white dark:bg-slate-900 border border-sky-200 dark:border-slate-700 rounded-xl p-4">
          <h2 className="text-sm font-bold text-sky-800 dark:text-sky-300 mb-3">📍 Раздел 2. Тактильные плитки</h2>
          <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-300 dark:border-sky-700 rounded-lg p-3 mb-3 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            <div className="font-bold text-sky-800 dark:text-sky-300 mb-2">📍 Виды тактильных указателей:</div>
            <div className="space-y-2">
              <div>
                <span className="font-bold">• КОНУСООБРАЗНЫЕ (тактильные кнопки)</span> — предупреждение опасности.
                <br />
                <span className="ml-3 text-[11px]">Применение: перед лестницей, перепадом, перекрёстком тротуара. Размер: 300×300 мм или 500×500 мм.</span>
              </div>
              <div>
                <span className="font-bold">• ЛИНЕЙНЫЕ (тактильные полосы)</span> — направляющие.
                <br />
                <span className="ml-3 text-[11px]">Применение: указание направления движения. Размер: 250×500 или 300×500 мм.</span>
              </div>
              <div>
                <span className="font-bold">• ПРЕДУПРЕЖДАЮЩИЕ (точечные)</span> — внимание зона ожидания.
                <br />
                <span className="ml-3 text-[11px]">Применение: остановки, входы. Размер: квадрат 500×500.</span>
              </div>
              <div className="mt-2 inline-flex items-center gap-2 bg-yellow-100 dark:bg-yellow-900/40 border border-yellow-400 dark:border-yellow-600 rounded px-2 py-1">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: "#FAC600" }} />
                <span className="text-[11px] text-yellow-900 dark:text-yellow-200 font-bold">ЦВЕТ: ярко-жёлтый (RAL 1016) — стандарт для всех типов</span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-300">
                  <th className="text-left px-2 py-1.5 font-bold">Вид</th>
                  <th className="text-left px-2 py-1.5 font-bold">Расценка ЭСН</th>
                  <th className="text-left px-2 py-1.5 font-bold">Цена ССЦ</th>
                </tr>
              </thead>
              <tbody className="text-slate-700 dark:text-slate-300">
                {[
                  ["Тактильная плитка 300×300 жёлтая бетонная", "Сб.27-3-005", "4 200 тг/шт"],
                  ["Тактильная плитка ПВХ 500×500 предупр.", "Сб.27-3-006", "3 800 тг/шт"],
                  ["Резиновое покрытие 1 м² (резина)", "Сб.27-3-007", "8 500 тг/м²"],
                  ["Установка с заделкой швов", "Сб.27-3-008", "1 200 тг/м² (работа)"],
                ].map((row, i) => (
                  <tr key={i} className="border-b border-sky-100 dark:border-slate-700">
                    <td className="px-2 py-1.5">{row[0]}</td>
                    <td className="px-2 py-1.5 font-mono text-[11px] text-sky-700 dark:text-sky-400">{row[1]}</td>
                    <td className="px-2 py-1.5 font-mono text-[11px]">{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Раздел 3: Поручни */}
        <section className="bg-white dark:bg-slate-900 border border-sky-200 dark:border-slate-700 rounded-xl p-4">
          <h2 className="text-sm font-bold text-sky-800 dark:text-sky-300 mb-3">🟦 Раздел 3. Поручни</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-300">
                  <th className="text-left px-2 py-1.5 font-bold">Тип</th>
                  <th className="text-left px-2 py-1.5 font-bold">Применение</th>
                  <th className="text-left px-2 py-1.5 font-bold">Норма</th>
                </tr>
              </thead>
              <tbody className="text-slate-700 dark:text-slate-300">
                {[
                  ["Внутренние круглые Ø32-45 мм", "Все коридоры с уклоном", "СНиП п. 3.18"],
                  ["Уличные нерж. сталь Ø45 мм", "Лестницы и пандусы", "СНиП п. 3.19"],
                  ["Двухуровневые (детский+взрослый)", "Школы, детсады", "СНиП п. 3.20"],
                  ["С теплозащитой (мороз)", "Объекты в северных регионах", "СН РК 8.02"],
                  ["Контрастный цвет (от стены)", "Для слабовидящих", "ГОСТ Р 52131"],
                ].map((row, i) => (
                  <tr key={i} className="border-b border-sky-100 dark:border-slate-700">
                    <td className="px-2 py-1.5">{row[0]}</td>
                    <td className="px-2 py-1.5">{row[1]}</td>
                    <td className="px-2 py-1.5 text-sky-700 dark:text-sky-400 text-[11px]">{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Раздел 4: Санузлы для МГН */}
        <section className="bg-white dark:bg-slate-900 border border-sky-200 dark:border-slate-700 rounded-xl p-4">
          <h2 className="text-sm font-bold text-sky-800 dark:text-sky-300 mb-3">🚽 Раздел 4. Санузлы для МГН</h2>
          <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-300 dark:border-sky-700 rounded-lg p-3 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            <div className="font-bold text-sky-800 dark:text-sky-300 mb-2">КАБИНА САНУЗЛА ДЛЯ МГН (СНиП РК 3.06-09 п. 5.4):</div>
            <div className="mb-2">
              <span className="font-bold">Минимум:</span> 1.65 × 1.80 м (1.65 — глубина, 1.80 — ширина)
              <br />
              <span className="font-bold">Рекомендуется:</span> 2.20 × 2.40 м (для удобства разворота на коляске)
            </div>
            <div className="font-bold text-sky-800 dark:text-sky-300 mb-1">ОБЯЗАТЕЛЬНО:</div>
            <ul className="list-disc ml-4 space-y-0.5 mb-2">
              <li>Унитаз с поручнями (откидной + стационарный)</li>
              <li>Кнопка экстренного вызова на h = 0.7 м</li>
              <li>Раковина на h = 0.7 м (без тумбы под низом)</li>
              <li>Зеркало с наклоном (для пользователей в коляске)</li>
              <li>Дверь с открытием НАРУЖУ (или сдвижная)</li>
              <li>Ширина двери ≥ 0.9 м</li>
              <li>Поручни вдоль стен</li>
            </ul>
            <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 dark:border-yellow-600 rounded px-2 py-1.5 text-[11px] text-yellow-900 dark:text-yellow-200">
              💰 <span className="font-bold">Стоимость отделки санузла МГН в смете:</span> +30-50 % к стоимости обычного (специальное оборудование).
            </div>
          </div>
        </section>

        {/* Раздел 5: Упражнения */}
        <section className="bg-white dark:bg-slate-900 border-2 border-sky-500 rounded-xl p-4">
          <h2 className="text-sm font-bold text-sky-800 dark:text-sky-300 mb-3">🧮 Раздел 5. Интерактивные упражнения</h2>

          {allDone ? (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-400 dark:border-emerald-700 rounded-lg p-4 text-center">
              <div className="text-4xl mb-2">♿</div>
              <h3 className="text-base font-bold text-emerald-800 dark:text-emerald-300 mb-2">Доступная среда освоена!</h3>
              <div className="bg-white dark:bg-slate-900 border rounded-lg p-3 text-left mb-3 text-xs space-y-1">
                {STEPS.map(s => (
                  <div key={s.id} className="flex gap-2">
                    <span className="text-emerald-500">✓</span>
                    <code className="text-[10px] font-mono text-slate-700 dark:text-slate-300">{s.vor}</code>
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  sxi(0);
                  setInp({});
                  setRev({});
                  setDone(new Set());
                }}
                className="px-4 py-2 bg-sky-600 text-white text-sm font-semibold rounded-lg hover:bg-sky-700"
              >
                Пройти снова
              </button>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex gap-1 flex-wrap mb-3">
                {STEPS.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      sxi(i);
                    }}
                    className={`text-[10px] px-2.5 py-1 rounded font-semibold ${
                      i === xi
                        ? "bg-sky-600 text-white"
                        : done.has(s.id)
                        ? "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                    }`}
                  >
                    {done.has(s.id) ? "✓" : i + 1}. {s.title.split(" ").slice(0, 3).join(" ")}…
                  </button>
                ))}
              </div>

              <div className="bg-sky-50 dark:bg-slate-800 border border-sky-200 dark:border-slate-700 rounded-lg p-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                  Упр. {xi + 1}. {ex.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">{ex.q}</p>

                {!done.has(ex.id) ? (
                  <div
                    className={`border-2 rounded-lg p-3 ${
                      ok
                        ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20"
                        : err
                        ? "border-red-400 bg-red-50 dark:bg-red-900/20"
                        : "border-sky-300 dark:border-sky-700 bg-white dark:bg-slate-900"
                    }`}
                  >
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                      {ex.label}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={inp[k] ?? ""}
                        onChange={e => setInp(p => ({ ...p, [k]: e.target.value }))}
                        onKeyDown={e => e.key === "Enter" && !rev[k] && go()}
                        disabled={!!rev[k]}
                        placeholder="Число..."
                        className="flex-1 border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sky-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                      />
                      {!rev[k] && (
                        <button
                          onClick={go}
                          disabled={!inp[k]?.trim()}
                          className="px-4 py-1.5 bg-sky-600 text-white text-xs font-bold rounded hover:bg-sky-700 disabled:opacity-40"
                        >
                          ✓ Проверить
                        </button>
                      )}
                    </div>
                    {rev[k] && (
                      <div
                        className={`mt-2 text-xs leading-relaxed ${
                          ok ? "text-emerald-800 dark:text-emerald-300" : "text-red-800 dark:text-red-300"
                        }`}
                      >
                        {ok ? "✓ " : "✗ "}
                        {ex.e}
                      </div>
                    )}
                    {err && (
                      <button
                        onClick={() => {
                          setInp(p => ({ ...p, [k]: "" }));
                          setRev(r => ({ ...r, [k]: false }));
                        }}
                        className="mt-1 text-[10px] text-amber-700 dark:text-amber-400 underline"
                      >
                        Попробовать снова
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="border-2 border-sky-400 bg-sky-50 dark:bg-sky-900/20 rounded-lg p-3">
                    <div className="text-xs font-bold text-sky-800 dark:text-sky-300 mb-1">✓ Завершено</div>
                    <code className="text-[10px] font-mono text-sky-700 dark:text-sky-400 block">{ex.vor}</code>
                  </div>
                )}

                <div className="mt-2 bg-sky-100 dark:bg-sky-900/30 border border-sky-300 dark:border-sky-700 rounded p-2 text-[11px] text-sky-800 dark:text-sky-300">
                  📖 {ex.theory}
                </div>
              </div>

              {done.has(ex.id) && xi + 1 < STEPS.length && (
                <button
                  onClick={() => sxi(xi + 1)}
                  className="mt-3 w-full py-2 bg-sky-600 text-white text-sm font-semibold rounded-lg hover:bg-sky-700"
                >
                  Следующее упражнение →
                </button>
              )}
            </>
          )}
        </section>

        {/* Расценки ЭСН */}
        <section className="bg-slate-100 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl p-4">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">💰 Расценки ЭСН (сводная карточка)</h2>
          <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
            <li>
              <span className="font-bold">Пандусы:</span> ЭСН <code className="font-mono text-sky-700 dark:text-sky-400">Сб.27-1-008</code>{" "}
              «Устройство пандуса бетонного с покрытием»
            </li>
            <li>
              <span className="font-bold">Поручни:</span> ЭСН <code className="font-mono text-sky-700 dark:text-sky-400">Сб.46-2-005</code>{" "}
              «Установка поручней нерж. сталь»
            </li>
            <li>
              <span className="font-bold">Тактильные плитки:</span> ЭСН{" "}
              <code className="font-mono text-sky-700 dark:text-sky-400">Сб.27-3-005..008</code>
            </li>
            <li>
              <span className="font-bold">Санузел МГН (комплект):</span> ЭСН{" "}
              <code className="font-mono text-sky-700 dark:text-sky-400">Сб.16-05-x</code> + ССЦ
            </li>
            <li>
              <span className="font-bold">Лифт МГН (с озвучкой этажей):</span>{" "}
              <code className="font-mono text-sky-700 dark:text-sky-400">Сб.46</code> (увеличить расценку базовую на 15 %)
            </li>
          </ul>
        </section>

        {/* Чек-лист */}
        <section className="bg-white dark:bg-slate-900 border-2 border-sky-500 rounded-xl p-4">
          <h2 className="text-sm font-bold text-sky-800 dark:text-sky-300 mb-1">
            ✅ Чек-лист «Доступная среда — что должно быть на объекте»
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
            Отмечено: {checks.size}/{checklist.length}
          </p>
          <ul className="space-y-1.5">
            {checklist.map((item, i) => (
              <li key={i}>
                <label className="flex items-start gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-sky-900/20 rounded p-1">
                  <input
                    type="checkbox"
                    checked={checks.has(i)}
                    onChange={() => toggleCheck(i)}
                    className="mt-0.5 accent-sky-600 w-4 h-4"
                  />
                  <span className={checks.has(i) ? "line-through text-slate-400 dark:text-slate-500" : ""}>{item}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>

        {/* Фактоид */}
        <section className="bg-sky-100 dark:bg-sky-900/30 border-l-4 border-sky-600 rounded-r-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div className="text-xs text-sky-900 dark:text-sky-200 leading-relaxed">
              <span className="font-bold">ВАЖНО:</span> При сдаче объекта без раздела «Доступная среда» — отказ в эксплуатации
              (Закон РК «О социальной защите инвалидов» ст. 17). Заложи в смету{" "}
              <span className="font-bold">1.5–3 % от общей стоимости</span> на специальное оборудование и адаптацию.
            </div>
          </div>
        </section>

        {/* Footer-навигация */}
        <div className="flex items-center justify-between pt-2">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-xs text-sky-700 dark:text-sky-400 hover:underline"
          >
            ← К разделам
          </Link>
          <span className="text-[10px] text-slate-400">СНиП РК 3.06-09-2007 · ГОСТ Р 52131-2003</span>
        </div>
      </div>
    </div>
  );
}
