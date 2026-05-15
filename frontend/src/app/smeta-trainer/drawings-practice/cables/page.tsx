"use client";
import Link from "next/link";
import { useState } from "react";
import { DimLine, HatchFill, Arrow, LevelMark, DrawingTitle } from "../_svg";

function check(i: string, a: string[]) {
  const v = parseFloat(i.replace(",", "."));
  return a.some((x) => {
    const e = parseFloat(x.replace(",", "."));
    return !isNaN(v) && !isNaN(e) && Math.abs((v - e) / e) < 0.05;
  });
}

// Более жёсткая проверка (для упражнения 3, ±0.5 от значения)
function checkAbs(i: string, a: string[], tol: number) {
  const v = parseFloat(i.replace(",", "."));
  return a.some((x) => {
    const e = parseFloat(x.replace(",", "."));
    return !isNaN(v) && !isNaN(e) && Math.abs(v - e) <= tol;
  });
}

// ── SVG: Поперечный разрез кабельной траншеи ───────────────────────────────────
function CableTrenchSVG({ hl }: { hl: Set<string> }) {
  // Масштаб: 1 м = 220 px (траншея узкая, нужно крупно)
  const S = 220;
  const OX = 360; // центр траншеи по X
  const OY = 90;  // верх (планировка) по Y

  const DEPTH = 0.7 * S;       // глубина 0.7 м → 154 px
  const W_BOT = 0.4 * S;       // ширина по низу 0.4 м → 88 px
  const M = 0.25;              // откос
  const SIDE = M * DEPTH;      // 0.25*154=38.5 px с каждой стороны
  const W_TOP = W_BOT + 2 * SIDE; // 165 px

  const BED = 0.1 * S;         // постель 100 мм → 22 px
  const SAND_TOP = 0.1 * S;    // песок над кабелем 100 мм → 22 px
  const BRICK_H = 0.065 * S;   // высота кирпича 65 мм → 14.3 px
  const TAPE_OFFSET = 0.25 * S; // лента на 250 мм от планировки

  const CABLE_D = 0.05 * S;    // Ø50 мм → 11 px
  const CABLE_GAP = 0.1 * S;   // 100 мм между кабелями
  // 3 кабеля по центру, расстояние между центрами 50+100=150мм между Ø+зазор
  const CABLE_PITCH = CABLE_D + CABLE_GAP; // 11 + 22 = 33 px
  const cableCY = OY + DEPTH - BED - CABLE_D / 2;
  const cableXs = [OX - CABLE_PITCH, OX, OX + CABLE_PITCH];

  // Y-координаты ключевых уровней
  const Y_GROUND = OY;
  const Y_BOT = OY + DEPTH;
  const Y_TOP_SAND = Y_BOT - BED;       // верх постели
  const Y_TOP_CABLE = cableCY - CABLE_D / 2;
  const Y_TOP_SAND_OVER = Y_TOP_CABLE - SAND_TOP; // верх верхнего песка
  const Y_TOP_BRICK = Y_TOP_SAND_OVER - BRICK_H;
  const Y_TAPE = OY + TAPE_OFFSET;

  return (
    <svg viewBox="0 -10 720 360" className="w-full h-auto" style={{ maxHeight: 360 }}>
      <DrawingTitle
        title="Поперечный разрез кабельной траншеи"
        subtitle="Силовые АВВГ-1кВ 4×95 · 3 шт в одной траншее · М 1:10"
        scale="1:10"
        number="ЭО-01 · Школа №47"
      />

      {/* Грунт обратной засыпки — суглинок (HatchFill сверху траншеи и по бокам) */}
      <HatchFill x={OX - W_TOP / 2} y={Y_TAPE} w={W_TOP} h={Y_TOP_BRICK - Y_TAPE} color="#a8896a" spacing={9} />
      {/* Боковой грунт слева */}
      <HatchFill x={20} y={Y_GROUND} w={OX - W_TOP / 2 - 20} h={DEPTH + 20} color="#c4a26a" spacing={10} />
      {/* Боковой грунт справа */}
      <HatchFill x={OX + W_TOP / 2} y={Y_GROUND} w={720 - 20 - (OX + W_TOP / 2)} h={DEPTH + 20} color="#c4a26a" spacing={10} />

      {/* Линия планировки — поверхность земли */}
      <line x1={20} y1={Y_GROUND} x2={700} y2={Y_GROUND} stroke="#475569" strokeWidth={1.4} />

      {/* Контур траншеи (откосы + дно) */}
      <polygon
        points={`
          ${OX - W_TOP / 2},${Y_GROUND}
          ${OX - W_BOT / 2},${Y_BOT}
          ${OX + W_BOT / 2},${Y_BOT}
          ${OX + W_TOP / 2},${Y_GROUND}
        `}
        fill={hl.has("trench") ? "#fef9c3" : "none"}
        stroke="#475569"
        strokeWidth={1.4}
      />

      {/* Постель песчаная (нижние 100 мм) */}
      <rect
        x={OX - W_BOT / 2}
        y={Y_TOP_SAND}
        width={W_BOT}
        height={BED}
        fill={hl.has("sand") ? "#fde68a" : "#fef3c7"}
        stroke="#d97706"
        strokeWidth={1}
      />
      <text x={OX + W_BOT / 2 + 6} y={Y_TOP_SAND + BED / 2 + 3} fontSize={8} fill="#92400e">
        песок 100мм (постель)
      </text>

      {/* Кабели — 3 кружка АВВГ-1кВ 4×95 */}
      {cableXs.map((cx, i) => (
        <g key={i}>
          <circle
            cx={cx}
            cy={cableCY}
            r={CABLE_D / 2}
            fill={hl.has("cables") ? "#1d4ed8" : "#1e293b"}
            stroke="#0f172a"
            strokeWidth={0.8}
          />
          {/* Внутренние жилы — 4 точки крест-накрест */}
          {[
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
          ].map(([dx, dy], j) => (
            <circle
              key={j}
              cx={cx + (dx * CABLE_D) / 5}
              cy={cableCY + (dy * CABLE_D) / 5}
              r={CABLE_D / 9}
              fill="#fbbf24"
            />
          ))}
        </g>
      ))}
      <text x={OX} y={cableCY + CABLE_D / 2 + 12} textAnchor="middle" fontSize={8} fill="#1e293b" fontStyle="italic">
        АВВГ-1кВ 4×95 · 3шт · Ø50
      </text>

      {/* Засыпка песком над кабелем (100 мм) */}
      <rect
        x={OX - W_BOT / 2 + (Y_TOP_CABLE - Y_GROUND) * M / DEPTH * 0}
        y={Y_TOP_SAND_OVER}
        width={W_BOT}
        height={SAND_TOP}
        fill={hl.has("sand") ? "#fde68a" : "#fef3c7"}
        stroke="#d97706"
        strokeWidth={1}
      />
      <text x={OX + W_BOT / 2 + 6} y={Y_TOP_SAND_OVER + SAND_TOP / 2 + 3} fontSize={8} fill="#92400e">
        песок 100мм (защита)
      </text>

      {/* Защита кирпичом — ряд кирпичей поперёк */}
      {(() => {
        const brickW = W_BOT / 5; // условно 5 кирпичей (в плане поперёк) — здесь показываем торцы
        const bricks: React.ReactElement[] = [];
        for (let i = 0; i < 5; i++) {
          bricks.push(
            <rect
              key={i}
              x={OX - W_BOT / 2 + i * brickW}
              y={Y_TOP_BRICK}
              width={brickW - 0.5}
              height={BRICK_H}
              fill={hl.has("brick") ? "#fde68a" : "#dc2626"}
              stroke="#7f1d1d"
              strokeWidth={0.8}
            />
          );
        }
        return bricks;
      })()}
      <text x={OX + W_BOT / 2 + 6} y={Y_TOP_BRICK + BRICK_H / 2 + 3} fontSize={8} fill="#7f1d1d">
        кирпич глин. полнотелый
      </text>

      {/* Сигнальная лента ЛСО-450 — пунктиром на глубине 250 мм */}
      <line
        x1={OX - W_TOP / 2 + (TAPE_OFFSET / DEPTH) * SIDE}
        y1={Y_TAPE}
        x2={OX + W_TOP / 2 - (TAPE_OFFSET / DEPTH) * SIDE}
        y2={Y_TAPE}
        stroke={hl.has("tape") ? "#ea580c" : "#f59e0b"}
        strokeWidth={2.5}
        strokeDasharray="4 2"
      />
      <text x={OX + W_TOP / 2 + 6} y={Y_TAPE + 3} fontSize={8} fill="#ea580c" fontWeight="600">
        лента ЛСО-450 (h=250)
      </text>

      {/* Размерные линии */}
      {/* Ширина по низу */}
      <DimLine
        x1={OX - W_BOT / 2}
        y1={Y_BOT + 22}
        x2={OX + W_BOT / 2}
        y2={Y_BOT + 22}
        label="0.4 м (по дну)"
        offset={14}
      />
      {/* Ширина по верху */}
      <DimLine
        x1={OX - W_TOP / 2}
        y1={Y_GROUND - 22}
        x2={OX + W_TOP / 2}
        y2={Y_GROUND - 22}
        label="0.75 м (по верху)"
        offset={14}
      />
      {/* Глубина траншеи (справа) */}
      <line x1={OX + W_TOP / 2 + 90} y1={Y_GROUND} x2={OX + W_TOP / 2 + 90} y2={Y_BOT} stroke="#94a3b8" strokeWidth={0.8} />
      <text
        x={OX + W_TOP / 2 + 102}
        y={Y_GROUND + DEPTH / 2}
        fontSize={9}
        fill="#475569"
        fontStyle="italic"
        textAnchor="middle"
        transform={`rotate(-90, ${OX + W_TOP / 2 + 102}, ${Y_GROUND + DEPTH / 2})`}
      >
        h = 0.7 м
      </text>
      <Arrow x1={OX + W_TOP / 2 + 90} y1={Y_GROUND + 4} x2={OX + W_TOP / 2 + 90} y2={Y_GROUND} />
      <Arrow x1={OX + W_TOP / 2 + 90} y1={Y_BOT - 4} x2={OX + W_TOP / 2 + 90} y2={Y_BOT} />

      {/* Расстояние между кабелями — стрелка */}
      <line
        x1={cableXs[0]}
        y1={cableCY + CABLE_D / 2 + 28}
        x2={cableXs[1]}
        y2={cableCY + CABLE_D / 2 + 28}
        stroke="#6366f1"
        strokeWidth={0.8}
      />
      <text
        x={(cableXs[0] + cableXs[1]) / 2}
        y={cableCY + CABLE_D / 2 + 40}
        textAnchor="middle"
        fontSize={8}
        fill="#6366f1"
        fontStyle="italic"
      >
        ≥100 мм
      </text>

      {/* Откос */}
      <text
        x={OX - W_TOP / 2 - 4}
        y={Y_GROUND + DEPTH / 2}
        fontSize={8}
        fill="#6366f1"
        textAnchor="end"
      >
        m=0.25
      </text>

      {/* Уровни (LevelMark) */}
      <LevelMark x={OX - W_TOP / 2 - 30} y={Y_GROUND} label="▽ 0.000 (планировка)" side="left" />
      <LevelMark x={OX - W_TOP / 2 - 30} y={Y_TOP_CABLE} label="▽ −0.500 (верх кабеля)" side="left" />
      <LevelMark x={OX - W_TOP / 2 - 30} y={Y_BOT} label="▽ −0.700 (дно траншеи)" side="left" />
    </svg>
  );
}

const STEPS = [
  {
    id: "trench-vol",
    hl: ["trench"],
    title: "Объём кабельной траншеи",
    q:
      "Кабельная траншея под 3 силовых кабеля АВВГ-1кВ 4×95: длина L=80 м, глубина h=0.7 м, ширина по дну b=0.4 м, грунт суглинок плотный → откос m=0.25 (СНиП РК 5.01-03 табл.4, h≤1.5 м). Рассчитайте объём грунта.",
    label: "Объём грунта, м³",
    answers: ["32.2", "32,2", "32.0", "32"],
    expl:
      "Ширина по верху: 0.4 + 2·0.25·0.7 = 0.75 м. Площадь сечения (трапеция): (0.4+0.75)/2 = 0.575 м². Объём: 0.575·0.7·80 = 32.2 м³. Для кабельных траншей малой глубины принимаем m=0.25 (плотный суглинок, h≤1.5 м).",
    vor: "Разработка грунта вручную (II гр.) для кабельной траншеи 0.4×0.7×80 = 32.2 м³ (ЭСН РК Сб.1-01-013)",
    theory:
      "Кабельные траншеи — узкие и неглубокие. По СНиП РК 5.01-03 при h≤1.5 м для плотного суглинка допускается откос m=0.25. Если глубина больше — m=0.5.",
  },
  {
    id: "sand",
    hl: ["sand"],
    title: "Расход песка на постель и засыпку",
    q:
      "По ПУЭ 7-е изд. п.2.3.84: песчаная постель снизу 100 мм + засыпка над кабелем 100 мм. Ширина по дну 0.4 м, длина 80 м. Считаем суммарный расход.",
    label: "Суммарный объём песка, м³",
    answers: ["6.4", "6,4"],
    expl:
      "Постель: 0.1·0.4·80 = 3.2 м³. Засыпка над кабелем: 0.1·0.4·80 = 3.2 м³. Итого: 6.4 м³. Песок должен быть мелкий или средней крупности, без камней и строительного мусора.",
    vor: "Подсыпка песком кабельной трассы (постель + защита) 6.4 м³ (ЭСН РК Сб.1-02-005)",
    theory:
      "Песок защищает оболочку кабеля от точечных нагрузок и острых включений в грунте. Слои постели и защиты обязательны по ПУЭ независимо от типа грунта.",
  },
  {
    id: "cable-len",
    hl: ["cables"],
    title: "Длина кабеля с учётом запаса",
    q:
      "Трасса 80 м, 3 кабеля АВВГ-1кВ 4×95 в одной траншее. ПУЭ требует укладки 'змейкой' с запасом 1-3% на температурные деформации. Считаем длину кабеля с запасом 2%.",
    label: "Длина кабеля, м (3 шт суммарно)",
    answers: ["244.8", "244,8", "240"],
    expl:
      "Без запаса: 3·80 = 240 м. С запасом 2% на укладку 'змейкой': 240·1.02 = 244.8 м. В смете оба варианта применимы — учитывайте по ПОС или указаниям РД. Принимаются оба ответа.",
    vor: "Прокладка кабеля АВВГ-1кВ 4×95 в траншее: 244.8 м (ЭСН РК Сб.8-02-148, сечение до 95 мм²)",
    theory:
      "Запас по длине компенсирует тепловое сжатие/расширение кабеля и обеспечивает возможность повторной разделки муфт при ремонте. Без запаса кабель может порваться зимой.",
    customCheck: (v: string) =>
      checkAbs(v, ["244.8", "244,8"], 0.5) || checkAbs(v, ["240"], 0.1),
  },
  {
    id: "brick",
    hl: ["brick"],
    title: "Количество кирпича на защиту трассы",
    q:
      "Защита кабеля сверху — кирпич глиняный полнотелый, поперёк трассы. Длина кирпича 250 мм укладывается перпендикулярно трассе (накрывает ширину 400 мм с запасом). По ширине 65 мм кирпич+шов закрывают 65 мм трассы. Считаем количество на 80 м.",
    label: "Количество кирпича, шт",
    answers: ["1230", "1231", "1200", "1250"],
    expl:
      "Длина трассы 80 м = 80000 мм. Один кирпич с швом закрывает 65 мм. Количество: 80000 / 65 = 1230 шт (округляем вверх). Внимание: кирпич должен быть глиняный полнотелый — силикатный категорически запрещён ПУЭ (разрушается во влажном грунте).",
    vor: "Защита кабеля кирпичом глиняным полнотелым 1230 шт на 80 м трассы (ПУЭ 7 п.2.3.84)",
    theory:
      "Альтернатива кирпичу — плита ПЗК (полимерная защитная). Применение силикатного кирпича запрещено: он разрушается в грунте за 2-3 года и теряет защитные свойства.",
  },
];

export default function CablesPage() {
  const [xi, sxi] = useState(0);
  const [inp, setInp] = useState<Record<string, string>>({});
  const [rev, setRev] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Set<string>>(new Set());

  const ex = STEPS[xi];
  const k = ex.id;
  const checker = (ex as { customCheck?: (v: string) => boolean }).customCheck;
  const isOk = rev[k] && (checker ? checker(inp[k] ?? "") : check(inp[k] ?? "", ex.answers));
  const isErr = rev[k] && !isOk;

  function go() {
    setRev((r) => ({ ...r, [k]: true }));
    const okNow = checker ? checker(inp[k] ?? "") : check(inp[k] ?? "", ex.answers);
    if (okNow) {
      setTimeout(() => {
        setDone((d) => new Set([...d, ex.id]));
      }, 700);
    }
  }

  const allDone = done.size === STEPS.length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-amber-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-xs text-amber-200 hover:text-white"
          >
            ← К разделам
          </Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold">⚡ Кабельные трассы — силовые и слаботочные</h1>
            <p className="text-[10px] text-amber-200">
              ПУЭ 7-е изд. гл.2.3 · СН РК 4.04-10-2006 · ЭСН РК Сб.8 · {done.size}/{STEPS.length} пройдено
            </p>
          </div>
          <Link
            href="/smeta-trainer/drawings-practice/normatives"
            className="text-[10px] bg-amber-900 text-amber-200 px-2 py-1 rounded hover:bg-amber-800"
          >
            📋 Нормативы
          </Link>
        </div>
      </header>

      {allDone ? (
        <div className="max-w-2xl mx-auto py-16 text-center px-4">
          <div className="text-5xl mb-3">⚡</div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            Кабельные трассы освоены!
          </h2>
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg p-4 text-left mb-4 text-xs space-y-1">
            {STEPS.map((s) => (
              <div key={s.id} className="flex gap-2">
                <span className="text-emerald-500">✓</span>
                <code className="text-[10px] font-mono">{s.vor}</code>
              </div>
            ))}
          </div>
          <div className="flex gap-3 justify-center flex-wrap">
            <button
              onClick={() => {
                sxi(0);
                setInp({});
                setRev({});
                setDone(new Set());
              }}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 dark:text-slate-200 text-sm font-semibold rounded-lg"
            >
              Снова
            </button>
            <Link
              href="/smeta-trainer/drawings-practice/hub"
              className="px-4 py-2 bg-amber-700 text-white text-sm font-semibold rounded-lg"
            >
              → К разделам
            </Link>
          </div>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Левая колонка: чертёж + нормативы + расценки */}
          <div className="lg:col-span-2 space-y-3">
            <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
              <CableTrenchSVG hl={new Set(ex.hl)} />
              {ex.theory && (
                <div className="mt-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded p-2 text-[10px] text-amber-800 dark:text-amber-300">
                  📖 {ex.theory}
                </div>
              )}
            </div>

            {/* Нормативный блок (фиолетовая карточка) */}
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-xl p-4">
              <div className="text-xs font-bold text-purple-900 dark:text-purple-200 mb-2">
                📘 Нормативная база — кабельные линии
              </div>
              <ul className="text-[11px] text-purple-900 dark:text-purple-200 space-y-1 leading-relaxed">
                <li>
                  • <strong>ПУЭ 7-е изд., гл.2.3</strong> «Кабельные линии напряжением до 220 кВ»
                </li>
                <li>
                  • Минимальная глубина траншеи: <strong>0.7 м</strong> (для кабелей до 35 кВ); до 1
                  кВ — допустимо <strong>0.5 м</strong> в местах без проезда транспорта
                </li>
                <li>
                  • Расстояние между силовыми кабелями в одной траншее:{" "}
                  <strong>не менее 100 мм</strong>
                </li>
                <li>
                  • Песчаная постель: <strong>100 мм снизу</strong> + <strong>100 мм сверху</strong>{" "}
                  кабеля (мелкий/средний песок без камней)
                </li>
                <li>
                  • Защита: <strong>кирпич глиняный полнотелый</strong> (силикатный запрещён!) или{" "}
                  <strong>плита ПЗК</strong>
                </li>
                <li>
                  • Сигнальная лента <strong>ЛСО-450</strong>: на 250 мм выше верха защиты
                </li>
                <li>
                  • <strong>СН РК 4.04-10-2006</strong> «Электротехнические устройства»
                </li>
              </ul>
            </div>

            {/* Расценки ЭСН (серая карточка) */}
            <div className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl p-4">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">
                💼 Применимые расценки ЭСН РК
              </div>
              <ul className="text-[11px] text-slate-700 dark:text-slate-300 space-y-1 leading-relaxed font-mono">
                <li>
                  • <strong>Сб.8-02-148</strong> — Прокладка кабеля в траншее, сечение до 95 мм²
                </li>
                <li>
                  • <strong>Сб.8-02-435</strong> — Установка концевой муфты для кабеля до 1 кВ
                </li>
                <li>
                  • <strong>Сб.1-01-013</strong> — Разработка грунта вручную, II группа
                </li>
                <li>
                  • <strong>Сб.1-02-005</strong> — Засыпка траншей вручную
                </li>
              </ul>
            </div>
          </div>

          {/* Правая колонка: упражнения */}
          <div className="space-y-3">
            <div className="flex gap-1 flex-wrap">
              {STEPS.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => {
                    sxi(i);
                    setInp({});
                    setRev({});
                  }}
                  className={`text-[10px] px-2 py-1 rounded font-semibold ${
                    i === xi
                      ? "bg-amber-600 text-white"
                      : done.has(s.id)
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {done.has(s.id) ? "✓" : i + 1}
                </button>
              ))}
            </div>

            <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                Упражнение {xi + 1}: {ex.title}
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
                {ex.q}
              </p>

              {!done.has(ex.id) ? (
                <div
                  className={`border-2 rounded-lg p-3 ${
                    isOk
                      ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20"
                      : isErr
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
                      value={inp[k] ?? ""}
                      onChange={(e) => setInp((p) => ({ ...p, [k]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && !rev[k] && go()}
                      disabled={!!rev[k]}
                      placeholder="Число..."
                      className="flex-1 border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-amber-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                    />
                    {!rev[k] && (
                      <button
                        onClick={go}
                        disabled={!inp[k]?.trim()}
                        className="px-3 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded hover:bg-amber-700 disabled:opacity-40"
                      >
                        Проверить
                      </button>
                    )}
                  </div>
                  {rev[k] && (
                    <div
                      className={`mt-2 text-xs leading-relaxed ${
                        isOk
                          ? "text-emerald-800 dark:text-emerald-300"
                          : "text-red-800 dark:text-red-300"
                      }`}
                    >
                      {isOk ? "✓ " : "✗ "}
                      {ex.expl}
                    </div>
                  )}
                  {isErr && (
                    <button
                      onClick={() => {
                        setInp((p) => ({ ...p, [k]: "" }));
                        setRev((r) => ({ ...r, [k]: false }));
                      }}
                      className="mt-1 text-[10px] text-amber-700 underline"
                    >
                      Попробовать снова
                    </button>
                  )}
                </div>
              ) : (
                <div className="border-2 border-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
                  <div className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-1">
                    ✓ Завершено
                  </div>
                  <code className="text-[10px] font-mono text-amber-700 dark:text-amber-400 block">
                    {ex.vor}
                  </code>
                </div>
              )}
            </div>

            {done.has(ex.id) && xi + 1 < STEPS.length && (
              <button
                onClick={() => {
                  sxi(xi + 1);
                  setInp({});
                  setRev({});
                }}
                className="w-full py-2 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700"
              >
                Следующее упражнение →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
