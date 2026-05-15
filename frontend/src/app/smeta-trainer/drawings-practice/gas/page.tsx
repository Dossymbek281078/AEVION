"use client";
import Link from "next/link";
import { useState } from "react";
import { DimLine, HatchFill, Arrow, LevelMark, DrawingTitle } from "../_svg";

function check(i: string, a: string[]) {
  const v = parseFloat(i.replace(",", "."));
  return a.some((x) => {
    const e = parseFloat(x.replace(",", "."));
    return !isNaN(v) && !isNaN(e) && Math.abs((v - e) / e) < 0.025;
  });
}

// ── SVG: Поперечный разрез траншеи газопровода низкого давления ─────────────
function GasSVG({ hl }: { hl: Set<string> }) {
  // Геометрия поперечного сечения (масштаб 1:25 условно)
  // Глубина 1.0 м, b по низу 0.6 м, откос m=0.5 → b по верху = 0.6 + 2·0.5·1.0 = 1.6 м
  const SY = 130;             // 1 м по глубине = 130 px
  const SX = 130;             // 1 м по ширине = 130 px (одинаковый для разреза)
  const CX = 360;             // центр траншеи по X
  const yGround = 80;         // линия земли в SVG
  const DEPTH = 1.0 * SY;     // 130 px (1.0 м)
  const BOT_W = 0.6 * SX;     // 78 px (ширина по низу)
  const TOP_W = 1.6 * SX;     // 208 px (ширина по верху)
  const PIPE_D = 0.11 * SX;   // Ø110 = 14.3 px (условно увеличим до 22 для видимости)
  const PIPE_DR = 22;         // отрисовочный диаметр трубы
  const BED = 0.1 * SY;       // 13 px — постель 100 мм
  const COVER = 0.2 * SY;     // 26 px — подсыпка над трубой 200 мм
  const TAPE_DEPTH = 0.4 * SY; // лента на глубине 400 мм

  // Координаты ключевых точек траншеи
  const xL_top = CX - TOP_W / 2;
  const xR_top = CX + TOP_W / 2;
  const xL_bot = CX - BOT_W / 2;
  const xR_bot = CX + BOT_W / 2;
  const yBot = yGround + DEPTH;

  // Песчаная постель (на дне)
  const bedY = yBot - BED;

  // Труба: ось трубы на глубине -1.110 (верх трубы -1.000, ось -1.055, низ -1.110)
  // Спецификация: верх трубы на глубине 1.0 м от земли
  const pipeTopY = yGround + 1.0 * SY;     // верх трубы
  const pipeAxisY = pipeTopY + PIPE_DR / 2; // ось трубы
  const pipeBotY = pipeTopY + PIPE_DR;      // низ трубы

  // Сигнальная лента
  const tapeY = yGround + TAPE_DEPTH;

  return (
    <svg viewBox="0 0 720 360" className="w-full h-auto" style={{ maxHeight: 360 }}>
      {/* Заголовок */}
      <g transform="translate(20, 18)">
        <DrawingTitle
          title="Поперечный разрез траншеи · газопровод низкого давления"
          subtitle="ПЭ100 SDR11 Ø110 · h=1.0 м · откос m=0.5 (суглинок)"
          scale="1:25"
          number="Школа №47 · ГСН-01"
        />
      </g>

      {/* Линия земли — слева и справа от траншеи */}
      <line x1={20} y1={yGround} x2={xL_top} y2={yGround} stroke="#475569" strokeWidth={1.6} />
      <line x1={xR_top} y1={yGround} x2={700} y2={yGround} stroke="#475569" strokeWidth={1.6} />

      {/* Штриховка природного грунта слева */}
      <HatchFill x={20} y={yGround} w={xL_top - 20} h={DEPTH + 30} color="#c4a26a" spacing={10} />
      {/* Штриховка природного грунта справа */}
      <HatchFill x={xR_top} y={yGround} w={700 - xR_top} h={DEPTH + 30} color="#c4a26a" spacing={10} />
      {/* Тонкая полоса дёрна над землёй */}
      <HatchFill x={20} y={yGround - 12} w={680} h={12} color="#86a36a" spacing={9} />

      {/* Обратная засыпка грунта (тело траншеи сверху до подсыпки) */}
      <polygon
        points={`
          ${xL_top},${yGround}
          ${xR_top},${yGround}
          ${xR_bot},${pipeTopY - COVER}
          ${xL_bot},${pipeTopY - COVER}
        `}
        fill={hl.has("backfill") ? "rgba(251,191,36,0.18)" : "rgba(203,213,225,0.30)"}
        stroke="#94a3b8"
        strokeWidth={0.6}
      />
      {/* Штриховка обратной засыпки (более редкая, поверх) */}
      <g opacity={0.4}>
        <HatchFill
          x={xL_bot}
          y={yGround}
          w={xR_bot - xL_bot + (TOP_W - BOT_W) / 2}
          h={pipeTopY - COVER - yGround}
          color="#94a3b8"
          spacing={14}
        />
      </g>
      <text x={CX} y={yGround + 40} textAnchor="middle" fontSize={9} fill="#475569">
        обратная засыпка грунтом
      </text>

      {/* Подсыпка песком над трубой (200 мм) — трапеция */}
      <polygon
        points={`
          ${xL_bot - ((COVER) * 0.5)},${pipeTopY - COVER}
          ${xR_bot + ((COVER) * 0.5)},${pipeTopY - COVER}
          ${xR_bot},${pipeTopY}
          ${xL_bot},${pipeTopY}
        `}
        fill={hl.has("sand-cover") ? "#fde68a" : "#fef3c7"}
        stroke="#d97706"
        strokeWidth={0.8}
        strokeDasharray="3 2"
        opacity={0.85}
      />
      <text x={CX} y={pipeTopY - COVER / 2 + 3} textAnchor="middle" fontSize={8} fill="#92400e">
        подсыпка песком h=200мм
      </text>

      {/* Сигнальная лента ЛСО-450 «ОСТОРОЖНО ГАЗ» — на h=400 мм */}
      <g>
        <rect
          x={CX - 70}
          y={tapeY - 4}
          width={140}
          height={8}
          fill={hl.has("tape") ? "#facc15" : "#fde047"}
          stroke="#a16207"
          strokeWidth={1}
        />
        <text x={CX} y={tapeY + 2.5} textAnchor="middle" fontSize={7} fontWeight="700" fill="#713f12">
          ⚠ ОСТОРОЖНО ГАЗ ⚠
        </text>
        <text x={CX + 90} y={tapeY + 2} fontSize={8} fill="#92400e" fontStyle="italic">
          ЛСО-450
        </text>
      </g>

      {/* Песчаное основание (постель 100 мм на дне траншеи) */}
      <rect
        x={xL_bot}
        y={bedY}
        width={xR_bot - xL_bot}
        height={BED}
        fill={hl.has("bed") ? "#fde68a" : "#fef3c7"}
        stroke={hl.has("bed") ? "#f59e0b" : "#d97706"}
        strokeWidth={1.2}
      />
      <text x={CX} y={bedY + BED / 2 + 3} textAnchor="middle" fontSize={7.5} fill="#92400e">
        песчаная постель 100 мм
      </text>

      {/* Откосы траншеи — линии */}
      <line x1={xL_top} y1={yGround} x2={xL_bot} y2={yBot} stroke="#475569" strokeWidth={1.6} />
      <line x1={xR_top} y1={yGround} x2={xR_bot} y2={yBot} stroke="#475569" strokeWidth={1.6} />
      {/* Дно траншеи */}
      <line x1={xL_bot} y1={yBot} x2={xR_bot} y2={yBot} stroke="#475569" strokeWidth={1.6} />

      {/* Газопровод ПЭ100 SDR11 Ø110 — круг (поперечный разрез) */}
      <circle
        cx={CX}
        cy={pipeAxisY}
        r={PIPE_DR / 2}
        fill={hl.has("pipe") ? "#fde047" : "#fef08a"}
        stroke={hl.has("pipe") ? "#a16207" : "#ca8a04"}
        strokeWidth={2}
      />
      {/* Тонкая обводка стенки трубы (PE) */}
      <circle cx={CX} cy={pipeAxisY} r={PIPE_DR / 2 - 2} fill="none" stroke="#fbbf24" strokeWidth={0.8} />
      {/* Маркер — ось трубы */}
      <line
        x1={CX - PIPE_DR / 2 - 6}
        y1={pipeAxisY}
        x2={CX + PIPE_DR / 2 + 6}
        y2={pipeAxisY}
        stroke="#a16207"
        strokeWidth={0.6}
        strokeDasharray="2 2"
      />
      <text x={CX} y={pipeAxisY - PIPE_DR / 2 - 6} textAnchor="middle" fontSize={9} fontWeight="700" fill="#713f12">
        ПЭ100 SDR11 Ø110
      </text>

      {/* Выноска: стальной футляр Ø159 */}
      <Arrow x1={CX + 130} y1={pipeAxisY - 60} x2={CX + 30} y2={pipeAxisY - 6} color="#dc2626" />
      <g>
        <rect x={CX + 130} y={pipeAxisY - 80} width={180} height={36} fill="#fef2f2" stroke="#dc2626" strokeWidth={0.8} rx={3} />
        <text x={CX + 138} y={pipeAxisY - 68} fontSize={8} fontWeight="700" fill="#991b1b">
          ⚠ при пересечениях:
        </text>
        <text x={CX + 138} y={pipeAxisY - 58} fontSize={8} fill="#7f1d1d">
          стальной футляр Ø159 мм
        </text>
        <text x={CX + 138} y={pipeAxisY - 49} fontSize={7.5} fill="#7f1d1d" fontStyle="italic">
          L = ширина препятств. + 2×5 м
        </text>
      </g>

      {/* Размер: глубина заложения 1.0 м (от земли до верха трубы) */}
      <DimLine
        x1={xL_top - 80}
        y1={yGround}
        x2={xL_top - 80}
        y2={pipeTopY}
        label="h = 1.0 м"
      />

      {/* Размер: ширина по низу 0.6 м */}
      <DimLine
        x1={xL_bot}
        y1={yBot + 32}
        x2={xR_bot}
        y2={yBot + 32}
        label="b = 0.6 м"
      />

      {/* Размер: ширина по верху 1.6 м */}
      <DimLine
        x1={xL_top}
        y1={yGround - 30}
        x2={xR_top}
        y2={yGround - 30}
        label="B = 1.6 м"
      />

      {/* Размер: высота сигнальной ленты 0.4 м */}
      <DimLine
        x1={xR_top + 60}
        y1={yGround}
        x2={xR_top + 60}
        y2={tapeY}
        label="0.4 м"
      />

      {/* Размер: подсыпка над трубой 0.2 м (≥200 мм) */}
      <DimLine
        x1={xR_top + 110}
        y1={pipeTopY - COVER}
        x2={xR_top + 110}
        y2={pipeTopY}
        label="≥200 мм"
      />

      {/* Размер: диаметр трубы Ø110 */}
      <g>
        <line
          x1={CX + PIPE_DR / 2 + 4}
          y1={pipeTopY}
          x2={CX + PIPE_DR / 2 + 18}
          y2={pipeTopY}
          stroke="#94a3b8"
          strokeWidth={0.6}
        />
        <line
          x1={CX + PIPE_DR / 2 + 4}
          y1={pipeBotY}
          x2={CX + PIPE_DR / 2 + 18}
          y2={pipeBotY}
          stroke="#94a3b8"
          strokeWidth={0.6}
        />
        <text
          x={CX + PIPE_DR / 2 + 22}
          y={pipeAxisY + 3}
          fontSize={8}
          fill="#475569"
          fontStyle="italic"
        >
          Ø110
        </text>
      </g>

      {/* Отметки уровней — слева */}
      <LevelMark x={xL_top - 20} y={yGround} label="▽ 0.000 (планировка)" side="left" />
      <LevelMark x={xL_top - 20} y={pipeTopY} label="▽ −1.000 (верх)" side="left" />
      <LevelMark x={xL_top - 20} y={pipeAxisY} label="▽ −1.055 (ось)" side="left" />
      <LevelMark x={xL_top - 20} y={pipeBotY} label="▽ −1.110 (низ)" side="left" />

      {/* Откос — обозначение m=0.5 на левом откосе */}
      <text
        x={xL_top - (TOP_W - BOT_W) / 4 + 4}
        y={yGround + DEPTH / 2}
        fontSize={8}
        fill="#475569"
        fontStyle="italic"
        transform={`rotate(-63 ${xL_top - (TOP_W - BOT_W) / 4 + 4} ${yGround + DEPTH / 2})`}
      >
        m = 0.5
      </text>
    </svg>
  );
}

const STEPS = [
  {
    id: "trench-vol",
    hl: ["bed"],
    title: "Объём траншеи газопровода",
    q:
      "Газопровод ПЭ100 SDR11 Ø110 низкого давления, прокладка вдоль здания школы. " +
      "Длина L=60 м, глубина заложения h=1.0 м, ширина по низу b=0.6 м. " +
      "Грунт суглинок (II гр.), откос m=0.5. Сечение — трапеция. Рассчитайте объём грунта.",
    ss: [
      {
        id: "top",
        l: "Ширина по верху, м",
        a: ["1.6", "1,6"],
        e: "B = b + 2·m·h = 0.60 + 2×(0.50×1.00) = 0.60 + 1.00 = 1.60 м",
      },
      {
        id: "sect",
        l: "Площадь поперечного сечения, м²",
        a: ["1.1", "1,1"],
        e: "A = (b + B)/2 × h = (0.60 + 1.60)/2 × 1.00 = 2.20/2 × 1.00 = 1.10 м²",
      },
      {
        id: "vol",
        l: "Объём разработки грунта, м³",
        a: ["66", "66.0", "66,0"],
        e: "V = A × L = 1.10 × 60.0 = 66.0 м³ (формула призматоида V = ((b+B)/2)·h·L)",
      },
    ],
    vor:
      "Разработка грунта в траншее под газопровод (II гр.): 1.10×60.0 = 66.0 м³ " +
      "(СНиП РК 4.03-01-2007, ЭСН РК Сб.1-01-013)",
    theory:
      "Газопровод низкого давления укладывается в траншею с откосами по СНиП РК 5.01-15. " +
      "Для суглинка глубиной до 1.5 м откос m=0.5. Объём считается по формуле трапециевидной призмы.",
  },
  {
    id: "casing",
    hl: ["pipe"],
    title: "Длина стальных футляров на пересечениях",
    q:
      "На трассе газопровода 2 пересечения с подземными коммуникациями (водопровод и кабель связи). " +
      "Ширина препятствия в каждом случае — 1 м. По СНиП РК 4.03-01-2007 п. 5.5.7 футляр должен " +
      "выходить на 5 м в каждую сторону от препятствия. Рассчитайте суммарную длину футляров Ø159.",
    ss: [
      {
        id: "one",
        l: "Длина одного футляра, м",
        a: ["11", "11.0", "11,0"],
        e: "L₁ = 1 (препятствие) + 2×5 = 11 м",
      },
      {
        id: "total",
        l: "Суммарная длина футляров, м",
        a: ["22", "22.0", "22,0"],
        e: "L = 11 × 2 = 22 м футляра Ø159 мм",
      },
    ],
    vor:
      "Стальной футляр Ø159 мм на пересечениях: 22 м (2 шт. × 11 м) " +
      "(СНиП РК 4.03-01-2007 п. 5.5.7, ЭСН РК Сб.24-01-015)",
    theory:
      "Футляр обязателен при пересечениях газопровода с водопроводом, канализацией, теплосетью, " +
      "кабелями связи и силовыми. Концы футляра выводятся минимум на 5 м с каждой стороны от " +
      "препятствия (для среднего давления — 7 м, для высокого — 10 м).",
  },
  {
    id: "sand",
    hl: ["bed", "sand-cover"],
    title: "Расход песка на постель и подсыпку",
    q:
      "Под газопровод ПЭ Ø110 укладывается песчаная постель толщиной 100 мм по дну траншеи " +
      "(b=0.6 м), а сверху трубы — подсыпка песком толщиной 200 мм на полную ширину дна. " +
      "Длина L=60 м. Рассчитайте суммарный расход песка (упрощённо, без вычета объёма трубы).",
    ss: [
      {
        id: "bed",
        l: "Объём постели, м³",
        a: ["3.6", "3,6"],
        e: "Vпостели = 0.10 × 0.60 × 60.0 = 3.60 м³",
      },
      {
        id: "cover",
        l: "Объём подсыпки над трубой, м³",
        a: ["7.2", "7,2"],
        e: "Vподсыпки = 0.20 × 0.60 × 60.0 = 7.20 м³ (на полную ширину дна, упрощённо)",
      },
      {
        id: "total",
        l: "Суммарный расход песка, м³",
        a: ["10.8", "10,8"],
        e:
          "Vпеска = 3.60 + 7.20 = 10.80 м³. На практике объём трубы (≈0.29 м³) " +
          "из расхода песка не вычитают — упрощают.",
      },
    ],
    vor:
      "Песок для постели и подсыпки газопровода Ø110: 10.8 м³ " +
      "(СНиП РК 4.03-01-2007, ЭСН РК Сб.1-03-001)",
    theory:
      "Песчаная постель толщиной 100 мм обязательна для ПЭ-газопроводов (СНиП РК 4.03-01-2007). " +
      "Подсыпка над трубой минимум 200 мм — для защиты от механических повреждений и обеспечения " +
      "равномерной нагрузки. Сверху подсыпки укладывается сигнальная лента ЛСО-450 «ОСТОРОЖНО ГАЗ».",
  },
];

export default function GasPage() {
  const [xi, sxi] = useState(0);
  const [si, ssi] = useState(0);
  const [inp, setInp] = useState<Record<string, string>>({});
  const [rev, setRev] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Set<string>>(new Set());
  const ex = STEPS[xi];
  const step = ex.ss[si];
  const k = `${ex.id}-${step.id}`;
  const ok = rev[k] && check(inp[k] ?? "", step.a);
  const err = rev[k] && !ok;
  function go() {
    setRev((r) => ({ ...r, [k]: true }));
    if (check(inp[k] ?? "", step.a)) {
      setTimeout(() => {
        if (si + 1 < ex.ss.length) {
          ssi(si + 1);
          setRev({});
        } else {
          setDone((d) => new Set([...d, ex.id]));
        }
      }, 700);
    }
  }
  const allDone = done.size === STEPS.length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-yellow-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-xs text-yellow-100 hover:text-white"
          >
            ← К разделам
          </Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold">🔥 Газоснабжение — наружный газопровод низкого давления</h1>
            <p className="text-[10px] text-yellow-100">
              СНиП РК 4.03-01-2007 · ЭСН РК Сб.24 · {done.size}/{STEPS.length} пройдено
            </p>
          </div>
          <Link
            href="/smeta-trainer/drawings-practice/normatives#gas"
            className="text-[10px] bg-yellow-800 text-yellow-100 px-2 py-1 rounded hover:bg-yellow-900"
          >
            📋 Нормативы
          </Link>
        </div>
      </header>

      {allDone ? (
        <div className="max-w-2xl mx-auto py-16 text-center px-4">
          <div className="text-5xl mb-3">🔥</div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            Газоснабжение освоено!
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
                ssi(0);
                setInp({});
                setRev({});
                setDone(new Set());
              }}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-sm font-semibold rounded-lg"
            >
              Снова
            </button>
            <Link
              href="/smeta-trainer/drawings-practice/hub"
              className="px-4 py-2 bg-yellow-600 text-white text-sm font-semibold rounded-lg"
            >
              → К разделам
            </Link>
          </div>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-3">
            <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
              <GasSVG hl={new Set(ex.hl)} />
              {ex.theory && (
                <div className="mt-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded p-2 text-[10px] text-yellow-800 dark:text-yellow-300">
                  📖 {ex.theory}
                </div>
              )}
            </div>

            {/* Нормативный блок */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-400 dark:border-yellow-600 rounded-xl p-3 text-xs text-yellow-900 dark:text-yellow-200">
              <div className="font-bold mb-1.5 text-sm">📘 Нормативная база</div>
              <ul className="space-y-1 list-disc list-inside leading-relaxed">
                <li>
                  <b>СНиП РК 4.03-01-2007</b> «Газораспределительные системы» —
                  основной норматив проектирования и устройства газопроводов.
                </li>
                <li>
                  <b>Минимальная глубина заложения</b> для низкого давления:{" "}
                  <code>0.8 м</code> (вне проездов), <code>1.0 м</code> (под проездами).
                  Среднее давление: <code>1.0–1.2 м</code>, высокое: <code>1.5 м</code>.
                </li>
                <li>
                  <b>Сигнальная лента</b> ЛСО-450 жёлтая «ОСТОРОЖНО ГАЗ» — обязательно
                  на отметке ≥200 мм над верхом трубы.
                </li>
                <li>
                  <b>Цвет ПЭ-трубы</b>: жёлтый или чёрный с продольной жёлтой полосой —
                  обязательная маркировка для газопроводов.
                </li>
                <li>
                  <b>Стальной футляр</b> при пересечениях с подземными коммуникациями
                  (водопровод, канализация, теплосеть, кабели). Длина = ширина препятствия + 5 м
                  с каждой стороны (низкое давление).
                </li>
                <li>
                  <b>Расстояние до фундаментов зданий</b>: ≥<b>2 м</b> для низкого давления,
                  ≥<b>4 м</b> для среднего давления (СНиП РК 4.03-01-2007 табл. 5).
                </li>
              </ul>
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
                      ? "bg-yellow-600 text-white"
                      : done.has(s.id)
                      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {done.has(s.id) ? "✓" : i + 1}
                </button>
              ))}
            </div>

            <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                {ex.title}
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
                {ex.q}
              </p>
              {ex.ss.length > 1 && (
                <div className="flex gap-1 mb-3">
                  {ex.ss.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full ${
                        i < si
                          ? "bg-yellow-500"
                          : i === si
                          ? "bg-yellow-300"
                          : "bg-slate-200 dark:bg-slate-700"
                      }`}
                    />
                  ))}
                </div>
              )}
              {!done.has(ex.id) ? (
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
                    Шаг {si + 1}/{ex.ss.length}: {step.l}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inp[k] ?? ""}
                      onChange={(e) =>
                        setInp((p) => ({ ...p, [k]: e.target.value }))
                      }
                      onKeyDown={(e) => e.key === "Enter" && !rev[k] && go()}
                      disabled={!!rev[k]}
                      placeholder="Число..."
                      className="flex-1 border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-yellow-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                    />
                    {!rev[k] && (
                      <button
                        onClick={go}
                        disabled={!inp[k]?.trim()}
                        className="px-3 py-1.5 bg-yellow-600 text-white text-xs font-semibold rounded hover:bg-yellow-700 disabled:opacity-40"
                      >
                        Проверить
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
                      className="mt-1 text-[10px] text-amber-700 underline"
                    >
                      Попробовать снова
                    </button>
                  )}
                </div>
              ) : (
                <div className="border-2 border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
                  <div className="text-xs font-bold text-yellow-800 dark:text-yellow-300 mb-1">
                    ✓ Завершено
                  </div>
                  <code className="text-[10px] font-mono text-yellow-700 dark:text-yellow-400 block">
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
                className="w-full py-2 bg-yellow-600 text-white text-sm font-semibold rounded-lg hover:bg-yellow-700"
              >
                Следующее →
              </button>
            )}

            {/* Расценки ЭСН */}
            <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-[11px] text-slate-700 dark:text-slate-300">
              <div className="font-bold mb-1.5 text-xs text-slate-800 dark:text-slate-200">
                💰 Применимые расценки ЭСН РК
              </div>
              <ul className="space-y-1 leading-relaxed">
                <li>
                  <code className="font-mono text-[10px] text-yellow-700 dark:text-yellow-400">
                    Сб.24-01-001
                  </code>
                  {" "}— Прокладка наружных газопроводов из ПЭ труб Ø110
                </li>
                <li>
                  <code className="font-mono text-[10px] text-yellow-700 dark:text-yellow-400">
                    Сб.24-01-015
                  </code>
                  {" "}— Установка стального футляра Ø159 на пересечениях
                </li>
                <li>
                  <code className="font-mono text-[10px] text-yellow-700 dark:text-yellow-400">
                    Сб.1-01-013
                  </code>
                  {" "}— Разработка грунта экскаватором, II группа
                </li>
                <li>
                  <code className="font-mono text-[10px] text-yellow-700 dark:text-yellow-400">
                    Сб.1-02-005
                  </code>
                  {" "}— Засыпка вручную
                </li>
                <li>
                  <code className="font-mono text-[10px] text-yellow-700 dark:text-yellow-400">
                    Сб.24-04-002
                  </code>
                  {" "}— Установка задвижки газовой Ø100
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
