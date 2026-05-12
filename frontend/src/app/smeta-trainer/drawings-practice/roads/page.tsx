"use client";
import Link from "next/link";
import { useState } from "react";
import { DimLine, HatchFill, Arrow, LevelMark, DrawingTitle } from "../_svg";

function check(i: string, a: string[], tol = 0.01) {
  const v = parseFloat(i.replace(",", "."));
  return a.some(x => {
    const e = parseFloat(x.replace(",", "."));
    return !isNaN(v) && !isNaN(e) && Math.abs((v - e) / e) <= tol;
  });
}

// ── SVG: Поперечный разрез автодороги местного значения ──────────────────────
function RoadSVG({ hl }: { hl: Set<string> }) {
  // Геометрия (в px)
  const cx = 400;            // центр чертежа по X
  const topY = 90;           // верх асфальта (отметка 0.000)
  const SX = 40;             // px на 1 м по горизонтали
  const SY = 220;            // px на 1 м по вертикали (для слоёв толщиной мм)
  const carriageW = 6.0 * SX;     // 6.0 м
  const sidewalkW = 1.5 * SX;     // 1.5 м
  const curbW = 0.15 * SX;        // 150 мм (в плане)
  const curbH = 0.30 * SY;        // 300 мм над верхом асфальта (бордюр выступает)

  // X-границы
  const carLeft = cx - carriageW / 2;
  const carRight = cx + carriageW / 2;
  const swLeftR = carLeft - curbW;          // правый край левого тротуара (у бордюра)
  const swLeftL = swLeftR - sidewalkW;      // левый край левого тротуара
  const swRightL = carRight + curbW;
  const swRightR = swRightL + sidewalkW;

  // Слои дорожной одежды (Y в px, отсчёт сверху)
  const t1 = 0.050 * SY;   // А/б верхний 50 мм
  const t2 = 0.070 * SY;   // А/б нижний 70 мм
  const t3 = 0.080 * SY;   // Чёрный щебень 80 мм
  const t4 = 0.150 * SY;   // Щебень 150 мм
  const t5 = 0.200 * SY;   // Песок 200 мм

  const y1 = topY;
  const y2 = y1 + t1;
  const y3 = y2 + t2;
  const y4 = y3 + t3;
  const y5 = y4 + t4;
  const y6 = y5 + t5;     // низ песка = -0.550

  // Слои тротуара (правый и левый)
  const sw1 = 0.060 * SY;  // плитка 60 мм
  const sw2 = 0.030 * SY;  // ц/п раствор 30 мм
  const sw3 = 0.100 * SY;  // щебень 100 мм
  const swY2 = y1 + sw1;
  const swY3 = swY2 + sw2;
  const swY4 = swY3 + sw3;

  const isHL = (k: string) => hl.has(k);

  return (
    <svg viewBox="0 0 800 460" className="w-full h-auto" style={{ maxHeight: 420 }}>
      {/* Заголовок чертежа */}
      <g transform="translate(20,20)">
        <DrawingTitle
          title="Поперечный разрез автодороги местного значения (категория III)"
          subtitle="Дорожная одежда · бордюр БР 100.30.15 · тротуары"
          scale="1:25"
          number="Школа №47 · ген.план"
        />
      </g>

      {/* Грунт основание (HatchFill) */}
      <HatchFill x={swLeftL - 40} y={y6} w={(swRightR - swLeftL) + 80} h={70} color="#c4a26a" spacing={9} />
      <rect x={swLeftL - 40} y={y6} width={(swRightR - swLeftL) + 80} height={70} fill="none" stroke="#92723d" strokeWidth={1.2} />
      <text x={cx} y={y6 + 50} textAnchor="middle" fontSize={9} fill="#78350f" fontStyle="italic">
        Уплотнённое грунтовое основание (Ку≥0.95)
      </text>

      {/* ===== Дорожная одежда проезжей части (5 слоёв) ===== */}
      {/* 1. А/б верхний 50 мм (тип А) */}
      <rect x={carLeft} y={y1} width={carriageW} height={t1}
        fill={isHL("asph") ? "#fde68a" : "#1f2937"}
        stroke={isHL("asph") ? "#d97706" : "#0f172a"} strokeWidth={isHL("asph") ? 2 : 1} />
      <text x={cx} y={y1 + t1 / 2 + 3} textAnchor="middle" fontSize={8}
        fill={isHL("asph") ? "#78350f" : "#fef3c7"}>А/б тип А · 50мм</text>

      {/* 2. А/б нижний 70 мм (тип Б) */}
      <rect x={carLeft} y={y2} width={carriageW} height={t2}
        fill={isHL("asph") ? "#fcd34d" : "#374151"}
        stroke={isHL("asph") ? "#d97706" : "#0f172a"} strokeWidth={isHL("asph") ? 2 : 1} />
      <text x={cx} y={y2 + t2 / 2 + 3} textAnchor="middle" fontSize={8}
        fill={isHL("asph") ? "#78350f" : "#f3f4f6"}>А/б тип Б · 70мм</text>

      {/* 3. Чёрный щебень 80 мм */}
      <rect x={carLeft} y={y3} width={carriageW} height={t3}
        fill={isHL("crush") ? "#fed7aa" : "#475569"}
        stroke={isHL("crush") ? "#ea580c" : "#334155"} strokeWidth={isHL("crush") ? 2 : 1} />
      <text x={cx} y={y3 + t3 / 2 + 3} textAnchor="middle" fontSize={8}
        fill={isHL("crush") ? "#7c2d12" : "#e2e8f0"}>Чёрный щебень фр.40-70 · 80мм</text>

      {/* 4. Щебень основание 150 мм */}
      <rect x={carLeft} y={y4} width={carriageW} height={t4}
        fill={isHL("crush") ? "#fdba74" : "#94a3b8"}
        stroke={isHL("crush") ? "#ea580c" : "#475569"} strokeWidth={isHL("crush") ? 2 : 1} />
      {/* точечная имитация щебня */}
      {Array.from({ length: 30 }).map((_, i) => (
        <circle key={i} cx={carLeft + 8 + (i * 19) % (carriageW - 16)} cy={y4 + 8 + ((i * 13) % (t4 - 16))} r={1.4} fill="#1e293b" opacity={0.55} />
      ))}
      <text x={cx} y={y4 + t4 / 2 + 3} textAnchor="middle" fontSize={9} fill={isHL("crush") ? "#7c2d12" : "#0f172a"} fontWeight={600}>Щебень фр.40-70 · 150мм</text>

      {/* 5. Песок подстилающий 200 мм */}
      <rect x={carLeft} y={y5} width={carriageW} height={t5}
        fill={isHL("sand") ? "#fef3c7" : "#fde68a"}
        stroke={isHL("sand") ? "#d97706" : "#ca8a04"} strokeWidth={isHL("sand") ? 2 : 1} />
      <text x={cx} y={y5 + t5 / 2 + 3} textAnchor="middle" fontSize={9} fill="#78350f" fontWeight={600}>Песок подстилающий · 200мм</text>

      {/* Поперечный уклон 2-2.5% — стрелка по верху проезжей части */}
      <Arrow x1={cx - 10} y1={y1 - 10} x2={carRight - 8} y2={y1 - 4} color={isHL("slope") ? "#dc2626" : "#0ea5e9"} />
      <text x={(cx + carRight) / 2} y={y1 - 14} textAnchor="middle" fontSize={9}
        fill={isHL("slope") ? "#dc2626" : "#0369a1"} fontWeight={600}>i=2.0–2.5%</text>

      {/* ===== Бордюры БР 100.30.15 ===== */}
      {/* Левый */}
      <rect x={swLeftR} y={y1 - curbH} width={curbW} height={curbH + t1 + t2}
        fill={isHL("curb") ? "#fde68a" : "#cbd5e1"}
        stroke={isHL("curb") ? "#d97706" : "#475569"} strokeWidth={isHL("curb") ? 2 : 1.2} />
      <text x={swLeftR + curbW / 2} y={y1 - curbH - 4} textAnchor="middle" fontSize={7}
        fill={isHL("curb") ? "#78350f" : "#475569"}>БР</text>
      {/* Правый */}
      <rect x={carRight} y={y1 - curbH} width={curbW} height={curbH + t1 + t2}
        fill={isHL("curb") ? "#fde68a" : "#cbd5e1"}
        stroke={isHL("curb") ? "#d97706" : "#475569"} strokeWidth={isHL("curb") ? 2 : 1.2} />
      <text x={carRight + curbW / 2} y={y1 - curbH - 4} textAnchor="middle" fontSize={7}
        fill={isHL("curb") ? "#78350f" : "#475569"}>БР</text>

      {/* ===== Тротуары (левый и правый) ===== */}
      {[{ xL: swLeftL, xR: swLeftR }, { xL: swRightL, xR: swRightR }].map((sw, i) => (
        <g key={i}>
          {/* Плитка 60 мм */}
          <rect x={sw.xL} y={y1} width={sw.xR - sw.xL} height={sw1}
            fill={isHL("tile") ? "#fde68a" : "#e2e8f0"}
            stroke={isHL("tile") ? "#d97706" : "#64748b"} strokeWidth={isHL("tile") ? 2 : 1} />
          {/* швы плитки */}
          {Array.from({ length: 5 }).map((_, j) => (
            <line key={j} x1={sw.xL + (j + 1) * (sw.xR - sw.xL) / 6} y1={y1}
              x2={sw.xL + (j + 1) * (sw.xR - sw.xL) / 6} y2={swY2}
              stroke="#94a3b8" strokeWidth={0.5} />
          ))}
          {/* Раствор 30 мм */}
          <rect x={sw.xL} y={swY2} width={sw.xR - sw.xL} height={sw2}
            fill="#cbd5e1" stroke="#64748b" strokeWidth={0.8} />
          {/* Щебень 100 мм */}
          <rect x={sw.xL} y={swY3} width={sw.xR - sw.xL} height={sw3}
            fill="#94a3b8" stroke="#475569" strokeWidth={0.8} />
          {/* Грунт под тротуаром (продолжение) */}
          {/* подписи */}
          {i === 1 && (
            <>
              <text x={sw.xR + 4} y={y1 + sw1 / 2 + 3} fontSize={7} fill="#475569">плитка 60</text>
              <text x={sw.xR + 4} y={swY2 + sw2 / 2 + 3} fontSize={7} fill="#475569">р-р 30</text>
              <text x={sw.xR + 4} y={swY3 + sw3 / 2 + 3} fontSize={7} fill="#475569">щеб. 100</text>
            </>
          )}
        </g>
      ))}

      {/* Засыпка между тротуаром и низом дорожной одежды (грунт) */}
      <rect x={swLeftL} y={swY4} width={sidewalkW} height={y6 - swY4} fill="#e7d6a8" stroke="#92723d" strokeWidth={0.6} />
      <rect x={swRightL} y={swY4} width={sidewalkW} height={y6 - swY4} fill="#e7d6a8" stroke="#92723d" strokeWidth={0.6} />

      {/* ===== Размеры (DimLine) ===== */}
      {/* Ширина проезжей части */}
      <DimLine x1={carLeft} y1={y6 + 90} x2={carRight} y2={y6 + 90} label="Проезжая часть 6.0 м (2×3.0)" color="#0f172a" />
      {/* Тротуары */}
      <DimLine x1={swLeftL} y1={y6 + 90} x2={swLeftR} y2={y6 + 90} label="1.5 м" />
      <DimLine x1={swRightL} y1={y6 + 90} x2={swRightR} y2={y6 + 90} label="1.5 м" />
      {/* Полная ширина */}
      <DimLine x1={swLeftL} y1={y6 + 110} x2={swRightR} y2={y6 + 110} label="Полная ширина 9.3 м" color="#475569" />

      {/* Толщины слоёв (справа) */}
      <line x1={carRight + 60} y1={y1} x2={carRight + 60} y2={y6} stroke="#94a3b8" strokeWidth={0.6} />
      <text x={carRight + 70} y={y1 + t1 / 2 + 3} fontSize={8} fill="#475569">50</text>
      <text x={carRight + 70} y={y2 + t2 / 2 + 3} fontSize={8} fill="#475569">70</text>
      <text x={carRight + 70} y={y3 + t3 / 2 + 3} fontSize={8} fill="#475569">80</text>
      <text x={carRight + 70} y={y4 + t4 / 2 + 3} fontSize={8} fill="#475569">150</text>
      <text x={carRight + 70} y={y5 + t5 / 2 + 3} fontSize={8} fill="#475569">200</text>
      <text x={carRight + 65} y={y6 + 12} fontSize={8} fill="#1e293b" fontWeight={600}>Σ=550мм</text>

      {/* ===== Уровни (LevelMark) — слева ===== */}
      <LevelMark x={swLeftL - 20} y={y1} label="0.000" side="left" />
      <LevelMark x={swLeftL - 20} y={y2} label="−0.050" side="left" />
      <LevelMark x={swLeftL - 20} y={y3} label="−0.120" side="left" />
      <LevelMark x={swLeftL - 20} y={y4} label="−0.200" side="left" />
      <LevelMark x={swLeftL - 20} y={y5} label="−0.350" side="left" />
      <LevelMark x={swLeftL - 20} y={y6} label="−0.550" side="left" />
    </svg>
  );
}

// ── Упражнения ──────────────────────────────────────────────────────────────
const STEPS = [
  {
    id: "asphalt-vol",
    hl: ["asph"],
    title: "Объём асфальтобетона на участок дороги",
    q: "Длина участка L=200 м, ширина проезжей части b=6.0 м. Дорожная одежда: верхний слой а/б тип А — 50 мм, нижний слой а/б тип Б — 70 мм. Рассчитайте суммарный объём асфальтобетона (по геометрии).",
    ss: [
      { id: "h", l: "Суммарная толщина асфальта, м", a: ["0.12", "0,12"], e: "50 + 70 = 120 мм = 0.12 м" },
      { id: "v", l: "Объём асфальтобетона, м³", a: ["144", "144.0"], e: "V = 200 · 6.0 · 0.12 = 144 м³" },
    ],
    tol: 0.01,
    vor: "Асфальтобетон проезжей части: 200×6.0×0.12 = 144 м³ (ЭСН РК Сб.27-1-001/002)",
    theory: "Асфальтобетон считается отдельно по слоям — верхний (тип А, мелкозернистый) и нижний (тип Б, крупнозернистый) идут по разным расценкам. Геометрия одна, но материалы и трудозатраты разные.",
  },
  {
    id: "tile-area",
    hl: ["tile"],
    title: "Площадь тротуарной плитки",
    q: "Тротуары шириной 1.5 м с обеих сторон проезжей части на длине 200 м. Покрытие — тротуарная плитка 60 мм. Рассчитайте проектную площадь плитки.",
    ss: [
      { id: "f", l: "Площадь тротуарной плитки, м²", a: ["600", "600.0"], e: "F = 2 · 1.5 · 200 = 600 м²" },
    ],
    tol: 0.005,
    vor: "Тротуарная плитка: 2×1.5×200 = 600 м² (ЭСН РК Сб.27-3-002)",
    theory: "Расход плитки с отходами на резку — коэффициент 1.05–1.07 от проектной площади. Расценка ЭСН РК Сб.27 §27-3-x.",
  },
  {
    id: "curb-len",
    hl: ["curb"],
    title: "Длина бордюрного камня БР 100.30.15",
    q: "Бордюр устанавливается с двух сторон проезжей части на длине 200 м. Размер бордюра БР 100.30.15 — 1000×300×150 мм. Рассчитайте длину бордюра в погонных метрах (или количество штук — оба ответа принимаются).",
    ss: [
      { id: "l", l: "Длина бордюра, м.п. (или шт)", a: ["400", "400.0"], e: "L = 2 · 200 = 400 м.п. → при длине блока 1 м это 400 шт." },
    ],
    tol: 0.005,
    vor: "Бордюр БР 100.30.15: 2×200 = 400 м.п. (400 шт) (ЭСН РК Сб.27-2-001)",
    theory: "На криволинейных участках добавляется ещё ~5% запаса (резка). Расценка ЭСН РК Сб.27 §27-2-x — установка с устройством бетонного основания.",
  },
  {
    id: "crushed-vol",
    hl: ["crush"],
    title: "Объём щебня для основания проезжей части",
    q: "Под проезжей частью два слоя: чёрный щебень 80 мм + щебень фракции 40-70 мм 150 мм. Длина 200 м, ширина проезжей части 6.0 м (тротуары не считаем — там своя конструкция).",
    ss: [
      { id: "h", l: "Суммарная толщина щебня, м", a: ["0.23", "0,23"], e: "80 + 150 = 230 мм = 0.23 м" },
      { id: "v", l: "Объём щебня (проектный), м³", a: ["276", "276.0"], e: "V = 200 · 6.0 · 0.23 = 276 м³" },
    ],
    tol: 0.02,
    vor: "Щебёночное основание (2 слоя): 200×6.0×0.23 = 276 м³ проектных (ЭСН РК Сб.27-1-005)",
    theory: "Щебёночные основания имеют коэффициент уплотнения Ку=1.30. На 276 м³ проектного объёма нужно закупить 276 · 1.30 = 358.8 м³ щебня навалом.",
  },
];

export default function RoadsPage() {
  const [xi, sxi] = useState(0);
  const [si, ssi] = useState(0);
  const [inp, setInp] = useState<Record<string, string>>({});
  const [rev, setRev] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Set<string>>(new Set());

  const ex = STEPS[xi];
  const step = ex.ss[si];
  const k = `${ex.id}-${step.id}`;
  const ok = rev[k] && check(inp[k] ?? "", step.a, ex.tol);
  const err = rev[k] && !ok;

  function go() {
    setRev(r => ({ ...r, [k]: true }));
    if (check(inp[k] ?? "", step.a, ex.tol)) {
      setTimeout(() => {
        if (si + 1 < ex.ss.length) {
          ssi(si + 1);
          setRev({});
        } else {
          setDone(d => new Set([...d, ex.id]));
        }
      }, 700);
    }
  }

  const allDone = done.size === STEPS.length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-slate-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link href="/smeta-trainer/drawings-practice/hub" className="text-xs text-slate-200 hover:text-white">← К разделам</Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold">🛣 Дороги и благоустройство — дорожная одежда, бордюры, тротуары</h1>
            <p className="text-[10px] text-slate-300">СНиП РК 3.03-09-2006 · ЭСН РК Сб.27 · {done.size}/{STEPS.length} пройдено</p>
          </div>
          <Link href="/smeta-trainer/drawings-practice/normatives#roads" className="text-[10px] bg-slate-900 text-slate-200 px-2 py-1 rounded hover:bg-slate-800">📋 Нормативы</Link>
        </div>
      </header>

      {allDone ? (
        <div className="max-w-2xl mx-auto py-16 text-center px-4">
          <div className="text-5xl mb-3">🛣</div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">Дороги освоены!</h2>
          <div className="bg-white dark:bg-slate-900 border rounded-lg p-4 text-left mb-4 text-xs space-y-1">
            {STEPS.map(s => (
              <div key={s.id} className="flex gap-2">
                <span className="text-emerald-500">✓</span>
                <code className="text-[10px] font-mono">{s.vor}</code>
              </div>
            ))}
          </div>
          <div className="flex gap-3 justify-center flex-wrap">
            <button
              onClick={() => { sxi(0); ssi(0); setInp({}); setRev({}); setDone(new Set()); }}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-sm font-semibold rounded-lg"
            >
              Снова
            </button>
            <Link href="/smeta-trainer/drawings-practice/rate-selector" className="px-4 py-2 bg-slate-700 text-white text-sm font-semibold rounded-lg">
              → Выбор расценки ЭСН
            </Link>
          </div>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-3">
            <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
              <RoadSVG hl={new Set(ex.hl)} />
              {ex.theory && (
                <div className="mt-2 bg-slate-100 dark:bg-slate-800/40 border border-slate-300 dark:border-slate-700 rounded p-2 text-[10px] text-slate-800 dark:text-slate-300">
                  📖 {ex.theory}
                </div>
              )}
            </div>

            {/* Нормативный блок */}
            <div className="bg-slate-100 dark:bg-slate-800/40 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-[11px] text-slate-800 dark:text-slate-300 space-y-1">
              <div className="font-bold text-slate-900 dark:text-slate-100 mb-1">📐 Нормативная база (РК)</div>
              <div>• <b>СНиП РК 3.03-09-2006</b> «Автомобильные дороги»</div>
              <div>• <b>СН РК 3.03-19-2006</b> «Технология строительства автомобильных дорог»</div>
              <div>• <b>ГОСТ 9128-2013</b> «Смеси асфальтобетонные дорожные»</div>
              <div>• Категории дорог РК: <b>I–IV</b> (по интенсивности движения)</div>
              <div>• Типичная конструкция местной дороги: А/б 5+7 + чёрный щебень 8 + щебень 15 + песок 20 = <b>55 см</b></div>
              <div>• Поперечный уклон: <b>2.0–2.5%</b> для асфальта, <b>2.5–3.0%</b> для тротуарной плитки</div>
            </div>

            {/* Сравнительная таблица */}
            <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3">
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-2">📊 Конструкции дорожной одежды РК (по категориям)</div>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] border-collapse">
                  <thead>
                    <tr className="bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                      <th className="border border-slate-300 dark:border-slate-700 px-2 py-1 text-left">Категория</th>
                      <th className="border border-slate-300 dark:border-slate-700 px-2 py-1 text-left">Покрытие</th>
                      <th className="border border-slate-300 dark:border-slate-700 px-2 py-1 text-left">Основание</th>
                      <th className="border border-slate-300 dark:border-slate-700 px-2 py-1 text-left">Подстилка</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700 dark:text-slate-300">
                    <tr>
                      <td className="border border-slate-300 dark:border-slate-700 px-2 py-1"><b>I</b> (магистраль)</td>
                      <td className="border border-slate-300 dark:border-slate-700 px-2 py-1">А/б тип А 50 + А/б тип Б 90 = 14 см</td>
                      <td className="border border-slate-300 dark:border-slate-700 px-2 py-1">Чёрный щебень 12 + щебень 25 = 37 см</td>
                      <td className="border border-slate-300 dark:border-slate-700 px-2 py-1">Песок 30 см</td>
                    </tr>
                    <tr className="bg-slate-50 dark:bg-slate-800/30">
                      <td className="border border-slate-300 dark:border-slate-700 px-2 py-1"><b>II</b> (республиканская)</td>
                      <td className="border border-slate-300 dark:border-slate-700 px-2 py-1">А/б тип А 50 + А/б тип Б 70 = 12 см</td>
                      <td className="border border-slate-300 dark:border-slate-700 px-2 py-1">Чёрный щебень 8 + щебень 20 = 28 см</td>
                      <td className="border border-slate-300 dark:border-slate-700 px-2 py-1">Песок 25 см</td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 dark:border-slate-700 px-2 py-1"><b>III</b> (местная)</td>
                      <td className="border border-slate-300 dark:border-slate-700 px-2 py-1">А/б тип А 40 + А/б тип Б 60 = 10 см</td>
                      <td className="border border-slate-300 dark:border-slate-700 px-2 py-1">Чёрный щебень 6 + щебень 15 = 21 см</td>
                      <td className="border border-slate-300 dark:border-slate-700 px-2 py-1">Песок 20 см</td>
                    </tr>
                    <tr className="bg-slate-50 dark:bg-slate-800/30">
                      <td className="border border-slate-300 dark:border-slate-700 px-2 py-1"><b>IV</b> (внутрипоселковая)</td>
                      <td className="border border-slate-300 dark:border-slate-700 px-2 py-1">А/б тип Б 50 = 5 см</td>
                      <td className="border border-slate-300 dark:border-slate-700 px-2 py-1">Щебень 12 см</td>
                      <td className="border border-slate-300 dark:border-slate-700 px-2 py-1">Песок 15 см</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Расценки ЭСН */}
            <div className="bg-slate-100 dark:bg-slate-800/40 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-[11px] text-slate-800 dark:text-slate-300 space-y-1">
              <div className="font-bold text-slate-900 dark:text-slate-100 mb-1">💼 Применяемые расценки ЭСН РК</div>
              <div>• <code className="font-mono text-[10px]">Сб.27-1-001</code> — Устройство покрытия из а/б тип А</div>
              <div>• <code className="font-mono text-[10px]">Сб.27-1-002</code> — Устройство нижнего слоя из а/б тип Б</div>
              <div>• <code className="font-mono text-[10px]">Сб.27-1-005</code> — Устройство щебёночного основания</div>
              <div>• <code className="font-mono text-[10px]">Сб.27-2-001</code> — Установка бордюра БР 100.30.15</div>
              <div>• <code className="font-mono text-[10px]">Сб.27-3-002</code> — Тротуарная плитка</div>
              <div>• <code className="font-mono text-[10px]">Сб.1-01-013</code> — Земляные работы под дорогу (корыто)</div>
            </div>

            {/* Фактоид */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-xl p-3 text-[11px] text-yellow-900 dark:text-yellow-200">
              💡 <b>Дорожная одежда</b> — самая дорогая часть строительства дороги (60–70% сметы). Вариативность типов покрытия позволяет проектировщику оптимизировать стоимость объекта.
            </div>
          </div>

          {/* Правая колонка — упражнения */}
          <div className="space-y-3">
            <div className="flex gap-1 flex-wrap">
              {STEPS.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => { sxi(i); ssi(0); setInp({}); setRev({}); }}
                  className={`text-[10px] px-2 py-1 rounded font-semibold ${
                    i === xi
                      ? "bg-slate-700 text-white"
                      : done.has(s.id)
                      ? "bg-slate-200 text-slate-800 dark:bg-slate-800/60 dark:text-slate-200"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {done.has(s.id) ? "✓" : i + 1}
                </button>
              ))}
            </div>

            <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">{ex.title}</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">{ex.q}</p>

              {ex.ss.length > 1 && (
                <div className="flex gap-1 mb-3">
                  {ex.ss.map((_, i) => (
                    <div key={i} className={`h-1 flex-1 rounded-full ${
                      i < si ? "bg-slate-600" : i === si ? "bg-slate-400" : "bg-slate-200 dark:bg-slate-700"
                    }`} />
                  ))}
                </div>
              )}

              {!done.has(ex.id) ? (
                <div className={`border-2 rounded-lg p-3 ${
                  ok ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20"
                  : err ? "border-red-300 bg-red-50 dark:bg-red-900/20"
                  : "border-slate-200 dark:border-slate-700"
                }`}>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Шаг {si + 1}/{ex.ss.length}: {step.l}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inp[k] ?? ""}
                      onChange={e => setInp(p => ({ ...p, [k]: e.target.value }))}
                      onKeyDown={e => e.key === "Enter" && !rev[k] && go()}
                      disabled={!!rev[k]}
                      placeholder="Число..."
                      className="flex-1 border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-slate-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                    />
                    {!rev[k] && (
                      <button
                        onClick={go}
                        disabled={!inp[k]?.trim()}
                        className="px-3 py-1.5 bg-slate-700 text-white text-xs font-semibold rounded hover:bg-slate-800 disabled:opacity-40"
                      >
                        ✓
                      </button>
                    )}
                  </div>
                  {rev[k] && (
                    <div className={`mt-2 text-xs leading-relaxed ${
                      ok ? "text-emerald-800 dark:text-emerald-300" : "text-red-800 dark:text-red-300"
                    }`}>
                      {ok ? "✓ " : "✗ "}{step.e}
                    </div>
                  )}
                  {err && (
                    <button
                      onClick={() => { setInp(p => ({ ...p, [k]: "" })); setRev(r => ({ ...r, [k]: false })); }}
                      className="mt-1 text-[10px] text-amber-700 underline"
                    >
                      Попробовать снова
                    </button>
                  )}
                </div>
              ) : (
                <div className="border-2 border-slate-400 bg-slate-100 dark:bg-slate-800/40 rounded-lg p-3">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">✓ Завершено</div>
                  <code className="text-[10px] font-mono text-slate-700 dark:text-slate-300 block">{ex.vor}</code>
                </div>
              )}
            </div>

            {done.has(ex.id) && xi + 1 < STEPS.length && (
              <button
                onClick={() => { sxi(xi + 1); ssi(0); setInp({}); setRev({}); }}
                className="w-full py-2 bg-slate-700 text-white text-sm font-semibold rounded-lg hover:bg-slate-800"
              >
                Следующее →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
