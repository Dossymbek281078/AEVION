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

// ── SVG: Поперечный разрез траншеи + продольная схема с водомерным колодцем ──
function WaterSVG({ hl }: { hl: Set<string> }) {
  // ── Поперечный разрез (слева) ────────────────────────────────────────────
  // Геометрия: глубина 2.0 м, ширина по низу 0.7 м, откос m=0.5
  // → ширина по верху = 0.7 + 2·0.5·2.0 = 2.7 м
  const SX = 60;             // X-масштаб поперечника: 1 м = 60 px
  const SY = 80;             // Y-масштаб глубины: 1 м = 80 px
  const CX = 150;            // ось траншеи (X центр)
  const GY = 60;             // отметка земли (Y)
  const DEPTH = 2.0 * SY;    // глубина 2.0 м → 160 px
  const BOT_W = 0.7 * SX;    // ширина по низу 0.7 м → 42 px
  const TOP_W = 2.7 * SX;    // ширина по верху 2.7 м → 162 px
  const BED = 0.1 * SY;      // песчаное основание 100 мм → 8 px
  const COVER = 0.3 * SY;    // подсыпка 300 мм → 24 px
  const PIPE_D = 14;         // условный размер трубы Ø160 на чертеже

  // Координаты траншеи
  const xTopL = CX - TOP_W / 2;
  const xTopR = CX + TOP_W / 2;
  const xBotL = CX - BOT_W / 2;
  const xBotR = CX + BOT_W / 2;
  const yBot = GY + DEPTH;          // дно траншеи

  // Труба (низ трубы лежит на основании)
  const yPipeBot = yBot - BED;      // верх основания = низ трубы
  const yPipeTop = yPipeBot - PIPE_D;

  // ── Продольная схема (справа) ────────────────────────────────────────────
  const PX = 360;            // левый край продольной схемы
  const PY = GY;             // отметка земли (та же)
  const PLEN = 280;          // длина участка по X
  const yPipeP = PY + DEPTH - BED - PIPE_D / 2;  // ось трубы на продольной
  const MH_X = PX + 200;     // X центра водомерного колодца ВК
  const MH_W = 50;           // диаметр колодца Ø1500 на чертеже
  const MH_WALL = 4;
  const COVER_H = 8;

  return (
    <svg viewBox="0 0 720 400" className="w-full h-auto" style={{ maxHeight: 400 }}>
      {/* Заголовок */}
      <g transform="translate(20, 18)">
        <DrawingTitle
          title="Наружный водопровод В1 · разрез траншеи + продольная схема"
          subtitle="ПЭ100 SDR17 Ø160 · h=2.00 м · ВК-1500 на вводе"
          scale="1:25 / 1:100"
          number="Школа №47 · В1-01"
        />
      </g>

      {/* ───────────── ПОПЕРЕЧНЫЙ РАЗРЕЗ ───────────── */}
      <text x={CX} y={GY - 30} textAnchor="middle" fontSize={9} fontWeight="700" fill="#0e7490">
        Поперечный разрез траншеи
      </text>

      {/* Линия земли (поперечник) */}
      <line x1={20} y1={GY} x2={300} y2={GY} stroke="#475569" strokeWidth={1.6} />
      {/* Штриховка грунта по поверхности */}
      <HatchFill x={20} y={GY - 12} w={280} h={12} color="#c4a26a" spacing={10} />

      {/* Грунт обратной засыпки (суглинок) — внутри траншеи поверх подсыпки */}
      <polygon
        points={`
          ${xTopL},${GY}
          ${xTopR},${GY}
          ${xBotR},${yBot - BED - PIPE_D - COVER + COVER}
          ${xBotL},${yBot - BED - PIPE_D - COVER + COVER}
        `}
        fill={hl.has("backfill") ? "rgba(251,191,36,0.18)" : "rgba(203,213,225,0.25)"}
      />
      {/* Штриховка обратной засыпки (суглинок) */}
      <g clipPath="url(#clip-backfill)">
        <defs>
          <clipPath id="clip-backfill">
            <polygon
              points={`
                ${xTopL},${GY}
                ${xTopR},${GY}
                ${xBotR},${yPipeTop - COVER}
                ${xBotL},${yPipeTop - COVER}
              `}
            />
          </clipPath>
        </defs>
        <HatchFill x={xTopL} y={GY} w={TOP_W} h={DEPTH - BED - PIPE_D - COVER} color="#c4a26a" spacing={12} />
      </g>
      <text x={CX} y={GY + (DEPTH - BED - PIPE_D - COVER) / 2 + 3} textAnchor="middle" fontSize={8} fill="#92400e">
        обратная засыпка (суглинок)
      </text>

      {/* Подсыпка над трубой (300 мм песок) */}
      <rect
        x={xBotL}
        y={yPipeTop - COVER}
        width={BOT_W}
        height={COVER}
        fill={hl.has("cover") ? "#fde68a" : "#fef3c7"}
        stroke="#d97706"
        strokeWidth={0.8}
        strokeDasharray="3 2"
        opacity={0.85}
      />
      <text x={CX} y={yPipeTop - COVER / 2 + 3} textAnchor="middle" fontSize={7} fill="#92400e">
        подсыпка песком 300 мм
      </text>

      {/* Труба ПЭ Ø160 — круг в поперечнике */}
      <circle
        cx={CX}
        cy={(yPipeTop + yPipeBot) / 2}
        r={PIPE_D / 2}
        fill={hl.has("pipe") ? "#bfdbfe" : "#dbeafe"}
        stroke={hl.has("pipe") ? "#0e7490" : "#0891b2"}
        strokeWidth={1.6}
      />
      <text x={CX + 16} y={(yPipeTop + yPipeBot) / 2 + 3} fontSize={8} fontWeight="600" fill="#0c4a6e">
        ПЭ100 Ø160
      </text>

      {/* Песчаное основание под трубой (100 мм) */}
      <rect
        x={xBotL}
        y={yBot - BED}
        width={BOT_W}
        height={BED}
        fill={hl.has("bed") ? "#fde68a" : "#fef3c7"}
        stroke={hl.has("bed") ? "#f59e0b" : "#d97706"}
        strokeWidth={1.2}
      />
      <text x={CX} y={yBot - BED / 2 + 3} textAnchor="middle" fontSize={7} fill="#92400e">
        песок 100 мм
      </text>

      {/* Контур траншеи (откосы m=0.5) */}
      <polygon
        points={`
          ${xTopL},${GY}
          ${xTopR},${GY}
          ${xBotR},${yBot}
          ${xBotL},${yBot}
        `}
        fill="none"
        stroke="#0c4a6e"
        strokeWidth={1.4}
      />

      {/* Размеры поперечника */}
      <DimLine x1={xTopL} y1={GY - 12} x2={xTopR} y2={GY - 12} label="bв = 2.70 м" />
      <DimLine x1={xBotL} y1={yBot + 14} x2={xBotR} y2={yBot + 14} label="bн = 0.70 м" />
      <DimLine x1={xTopR + 36} y1={GY} x2={xTopR + 36} y2={yBot} label="h = 2.00 м" />

      {/* Метки уровней (поперечник) */}
      <LevelMark x={xTopL - 20} y={GY} label="▽ 0.000" side="left" />
      <LevelMark x={xTopL - 20} y={yPipeTop} label="▽ −2.000" side="left" />
      <LevelMark x={xTopL - 20} y={yPipeBot} label="▽ −2.160" side="left" />

      {/* Откосы — подпись */}
      <text x={xTopL + 8} y={GY + 22} fontSize={7} fill="#475569" fontStyle="italic">
        m=0.5
      </text>

      {/* ───────────── ПРОДОЛЬНАЯ СХЕМА ───────────── */}
      <text x={PX + PLEN / 2} y={GY - 30} textAnchor="middle" fontSize={9} fontWeight="700" fill="#0e7490">
        Продольная схема (ввод в здание)
      </text>

      {/* Линия земли (продольная) */}
      <line x1={PX - 10} y1={PY} x2={PX + PLEN + 10} y2={PY} stroke="#475569" strokeWidth={1.6} />
      <HatchFill x={PX - 10} y={PY - 10} w={PLEN + 20} h={10} color="#c4a26a" spacing={10} />

      {/* Труба (продольная) — две параллельные линии */}
      <rect
        x={PX}
        y={yPipeP - PIPE_D / 2}
        width={PLEN}
        height={PIPE_D}
        fill={hl.has("pipe") ? "#bfdbfe" : "#dbeafe"}
        stroke={hl.has("pipe") ? "#0e7490" : "#0891b2"}
        strokeWidth={1.4}
      />
      <text x={PX + 70} y={yPipeP + 3} fontSize={9} fontWeight="600" fill="#0c4a6e">
        ПЭ100 SDR17 Ø160 · L=80 м
      </text>

      {/* Водомерный колодец ВК Ø1500 */}
      <g>
        {/* Внешние стенки колодца */}
        <rect
          x={MH_X - MH_W / 2 - MH_WALL}
          y={PY - COVER_H}
          width={MH_W + 2 * MH_WALL}
          height={DEPTH + COVER_H + 10}
          fill="#e2e8f0"
          stroke={hl.has("manhole") ? "#0e7490" : "#475569"}
          strokeWidth={hl.has("manhole") ? 2 : 1.4}
        />
        {/* Внутренняя полость */}
        <rect
          x={MH_X - MH_W / 2}
          y={PY - COVER_H + 4}
          width={MH_W}
          height={DEPTH + COVER_H - 4}
          fill="#f8fafc"
          stroke="#94a3b8"
          strokeWidth={0.8}
        />
        {/* Люк */}
        <rect x={MH_X - 9} y={PY - COVER_H} width={18} height={3} fill="#1e293b" />

        {/* Задвижка (на трубе слева от водомера) */}
        <g>
          <rect
            x={MH_X - MH_W / 2 + 4}
            y={yPipeP - PIPE_D / 2 - 4}
            width={6}
            height={PIPE_D + 8}
            fill={hl.has("valve") ? "#fde68a" : "#fef3c7"}
            stroke="#b45309"
            strokeWidth={1}
          />
          {/* Шток задвижки вверх */}
          <line
            x1={MH_X - MH_W / 2 + 7}
            y1={yPipeP - PIPE_D / 2 - 4}
            x2={MH_X - MH_W / 2 + 7}
            y2={PY + 2}
            stroke="#b45309"
            strokeWidth={1}
            strokeDasharray="2 2"
          />
          <circle
            cx={MH_X - MH_W / 2 + 7}
            cy={PY + 4}
            r={3}
            fill="none"
            stroke="#b45309"
            strokeWidth={1}
          />
          <text
            x={MH_X - MH_W / 2 - 4}
            y={yPipeP - PIPE_D / 2 - 8}
            fontSize={7}
            fill="#b45309"
            textAnchor="end"
          >
            задв.
          </text>
        </g>

        {/* Водомер (центральный блок) */}
        <g>
          <rect
            x={MH_X - 14}
            y={yPipeP - PIPE_D / 2 - 5}
            width={28}
            height={PIPE_D + 10}
            fill={hl.has("meter") ? "#bfdbfe" : "#e0f2fe"}
            stroke="#0e7490"
            strokeWidth={1}
          />
          <circle
            cx={MH_X}
            cy={yPipeP}
            r={5}
            fill="#fff"
            stroke="#0e7490"
            strokeWidth={1}
          />
          <text x={MH_X} y={yPipeP + 2} fontSize={6} textAnchor="middle" fill="#0e7490" fontWeight="700">
            М
          </text>
          <text x={MH_X} y={yPipeP - PIPE_D / 2 - 8} fontSize={7} textAnchor="middle" fill="#0e7490" fontWeight="600">
            водомер
          </text>
        </g>

        {/* Подпись колодца */}
        <text
          x={MH_X}
          y={PY - COVER_H - 5}
          textAnchor="middle"
          fontSize={9}
          fontWeight="700"
          fill="#0c4a6e"
        >
          ВК-1500
        </text>
      </g>

      {/* Стрелка движения воды */}
      <Arrow
        x1={PX + 10}
        y1={yPipeP + PIPE_D / 2 + 14}
        x2={MH_X - MH_W / 2 - 12}
        y2={yPipeP + PIPE_D / 2 + 14}
        color="#0891b2"
      />
      <text
        x={(PX + MH_X - MH_W / 2) / 2}
        y={yPipeP + PIPE_D / 2 + 26}
        textAnchor="middle"
        fontSize={8}
        fill="#0891b2"
        fontWeight="600"
      >
        от городской сети →
      </text>

      {/* Размер: диаметр трубы Ø160 на продольной */}
      <g>
        <line
          x1={PX + 30}
          y1={yPipeP - PIPE_D / 2}
          x2={PX + 30}
          y2={yPipeP + PIPE_D / 2}
          stroke="#94a3b8"
          strokeWidth={0.8}
        />
        <text
          x={PX + 24}
          y={yPipeP + 3}
          textAnchor="end"
          fontSize={9}
          fill="#475569"
          fontStyle="italic"
        >
          Ø160
        </text>
      </g>

      {/* Размер: глубина заложения у колодца */}
      <DimLine
        x1={PX + PLEN + 22}
        y1={PY}
        x2={PX + PLEN + 22}
        y2={yPipeP}
        label="2.00 м"
      />

      {/* Метка отметок справа у колодца */}
      <LevelMark x={MH_X + MH_W / 2 + MH_WALL + 8} y={PY} label="▽ 0.000" side="right" />
      <LevelMark x={MH_X + MH_W / 2 + MH_WALL + 8} y={yPipeP} label="▽ −2.080" side="right" />
    </svg>
  );
}

const STEPS = [
  {
    id: "trench-vol",
    hl: ["backfill"],
    title: "Объём траншеи под водопровод",
    q:
      "Наружный водопровод ПЭ100 SDR17 Ø160, L=80 м. Глубина заложения h=2.0 м " +
      "(ниже глубины промерзания для Алматы hпром=1.2 м + запас 0.8 м, СНиП РК 4.01-02-2009). " +
      "Ширина по низу b=0.7 м, грунт суглинок (II гр.), откос m=0.5. " +
      "Сечение траншеи — трапеция. Рассчитайте объём грунта.",
    ss: [
      {
        id: "top",
        l: "Ширина по верху, м",
        a: ["2.7", "2,7"],
        e: "0.70 + 2×(0.50×2.00) = 0.70 + 2.00 = 2.70 м",
      },
      {
        id: "sect",
        l: "Площадь поперечного сечения, м²",
        a: ["3.4", "3,4"],
        e: "(0.70 + 2.70)/2 × 2.00 = 3.40/2 × 2.00 = 3.40 м²",
      },
      {
        id: "vol",
        l: "Объём разработки грунта, м³",
        a: ["272", "272.0", "272,0"],
        e: "3.40 × 80.0 = 272 м³ (формула призматоида V = ((bн+bв)/2)·h·L)",
      },
    ],
    vor:
      "Разработка грунта в траншее под водопровод (II гр., суглинок): 3.40×80.0 = 272 м³ " +
      "(СНиП РК 4.01-02-2009, ЭСН РК Сб.1-01-013)",
    theory:
      "Глубина заложения водопровода — НЕ меньше hпром + 0.5 м (СНиП РК 4.01-02-2009 п.8.42). " +
      "Для Алматы hпром = 1.2 м → минимум 1.7 м, типично закладывают 2.0 м. " +
      "Откос для суглинка глубиной до 3 м — m=0.5 (СНиП РК 5.01-15 табл.4).",
  },
  {
    id: "bed",
    hl: ["bed", "cover"],
    title: "Объём песчаного основания и подсыпки",
    q:
      "Под трубу ПЭ Ø160 укладывается песчаное основание h=100 мм, после монтажа — " +
      "защитная подсыпка песком h=300 мм (от низа трубы до отметки 'верх трубы + 300 мм'). " +
      "Ширина по низу b=0.7 м, длина L=80 м. Рассчитайте объёмы по слоям и итог.",
    ss: [
      {
        id: "base",
        l: "Объём песчаного основания (100 мм), м³",
        a: ["5.6", "5,6"],
        e: "0.10 × 0.70 × 80.0 = 5.60 м³",
      },
      {
        id: "cover",
        l: "Объём подсыпки над трубой (300 мм), м³",
        a: ["16.8", "16,8"],
        e: "0.30 × 0.70 × 80.0 = 16.80 м³",
      },
      {
        id: "total",
        l: "Итого песок, м³",
        a: ["22.4", "22,4"],
        e: "5.60 + 16.80 = 22.40 м³",
      },
    ],
    vor:
      "Песчаное основание + подсыпка ПЭ Ø160: 5.60 + 16.80 = 22.40 м³ песка " +
      "(СНиП РК 4.01-02-2009, ЭСН РК Сб.1-03-001)",
    theory:
      "Для ПЭ-труб обязательно песчаное основание 100–150 мм и подсыпка 300 мм над верхом трубы " +
      "(СНиП РК 4.01-02-2009 п.8.55). Песок защищает пластик от точечных нагрузок и " +
      "повреждений при засыпке.",
  },
  {
    id: "pipe-len",
    hl: ["pipe"],
    title: "Длина трубы ПЭ Ø160 с запасом",
    q:
      "По проекту участок водопровода L=80 м. ПЭ-трубы укладываются с запасом 1% " +
      "на температурную деформацию (полиэтилен — материал с большим коэффициентом " +
      "линейного расширения). Рассчитайте фактическую длину трубы для закупа " +
      "(округлить до целого метра в большую сторону).",
    ss: [
      {
        id: "len",
        l: "Длина трубы с запасом, м",
        a: ["80.8", "80,8", "81"],
        e:
          "L = 80 × 1.01 = 80.80 м → округляем до 81 м (закуп). " +
          "Принимается 80.8 (для расчёта) или 81 м (для заявки).",
      },
    ],
    vor:
      "Труба ПЭ100 SDR17 Ø160: 80 × 1.01 = 80.8 м (с запасом 1% на термодеформацию), " +
      "к закупу 81 м (СНиП РК 4.01-02-2009, ЭСН РК Сб.16-01-001)",
    theory:
      "Полиэтилен имеет коэффициент линейного расширения α≈2×10⁻⁴ 1/°C — это в 20 раз " +
      "больше, чем у стали. При перепаде температуры в траншее 30°C труба длиной 80 м " +
      "может удлиниться/укоротиться на ~0.5 м. Запас 1% укладки 'змейкой' компенсирует это.",
  },
  {
    id: "manhole",
    hl: ["manhole"],
    title: "Объём ж/б колодца водомерного ВК-1500",
    q:
      "Водомерный колодец ВК на вводе в здание: внутренний Ø=1.5 м, толщина стенок 75 мм " +
      "(серия 3.900.1-14), высота тела колодца h=3 м. Рассчитайте объём бетона " +
      "только на стенки (без днища и плиты перекрытия).",
    ss: [
      {
        id: "vext",
        l: "Объём по наружному диаметру (Ø1.65), м³",
        a: ["6.42", "6,42", "6.41", "6,41"],
        e: "Vвнеш = π × 0.825² × 3 = π × 0.681 × 3 ≈ 6.42 м³",
      },
      {
        id: "vint",
        l: "Объём по внутреннему диаметру (Ø1.50), м³",
        a: ["5.30", "5,30", "5.3", "5,3"],
        e: "Vвнутр = π × 0.75² × 3 = π × 0.5625 × 3 ≈ 5.30 м³",
      },
      {
        id: "vc",
        l: "Объём бетона стенок, м³",
        a: ["1.12", "1,12", "1.1", "1,1"],
        e: "Vбет = 6.42 − 5.30 = 1.12 м³ (только стенки, без днища и плиты)",
      },
    ],
    vor:
      "Тело ж/б колодца ВК-1500 (h=3 м, стенки 75 мм): 1.12 м³ бетона B25 " +
      "(серия 3.900.1-14, ЭСН РК Сб.16-03-001)",
    theory:
      "Объём бетона цилиндрической стенки = π·(R²−r²)·h, где R — наружный, r — внутренний радиус. " +
      "Колодцы по серии 3.900.1-14 — сборные ж/б кольца КС10.9, КС15.9 и т.п. " +
      "Толщина стенки кольца Ø1500 — 75–100 мм в зависимости от глубины.",
  },
];

export default function WaterPage() {
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
      <header className="bg-cyan-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-xs text-cyan-200 hover:text-white"
          >
            ← К разделам
          </Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold">💧 Водоснабжение — наружный водопровод</h1>
            <p className="text-[10px] text-cyan-200">
              СНиП РК 4.01-02-2009 · ЭСН РК Сб.16 · {done.size}/{STEPS.length} пройдено
            </p>
          </div>
          <Link
            href="/smeta-trainer/drawings-practice/normatives#water"
            className="text-[10px] bg-cyan-900 text-cyan-200 px-2 py-1 rounded hover:bg-cyan-800"
          >
            📋 Нормативы
          </Link>
        </div>
      </header>

      {allDone ? (
        <div className="max-w-2xl mx-auto py-16 text-center px-4">
          <div className="text-5xl mb-3">💧</div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            Водопровод освоен!
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
              className="px-4 py-2 bg-cyan-700 text-white text-sm font-semibold rounded-lg"
            >
              → К разделам
            </Link>
          </div>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-3">
            <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
              <WaterSVG hl={new Set(ex.hl)} />
              {ex.theory && (
                <div className="mt-2 bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-700 rounded p-2 text-[10px] text-cyan-800 dark:text-cyan-300">
                  📖 {ex.theory}
                </div>
              )}
            </div>

            {/* Нормативный блок */}
            <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-400 dark:border-cyan-700 rounded-xl p-3 text-xs text-cyan-900 dark:text-cyan-200">
              <div className="font-bold mb-1.5 text-sm">📘 Нормативная база</div>
              <ul className="space-y-1 list-disc list-inside leading-relaxed">
                <li>
                  <b>СНиП РК 4.01-02-2009</b> «Водоснабжение. Наружные сети и сооружения» —
                  основной норматив проектирования и устройства.
                </li>
                <li>
                  <b>Минимальная глубина заложения</b> = hпром + 0.5 м.
                  Для Алматы hпром=1.2 м → минимум <b>1.7 м</b>, типично закладывают <b>2.0 м</b>
                  (с запасом для защиты от случайной разработки и нагрузки от транспорта).
                </li>
                <li>
                  <b>Тип трубы</b>: <code>ПЭ100 SDR17 (PN10)</code> — стандарт для холодного
                  водоснабжения, рабочее давление 1.0 МПа, морозостойкая.
                </li>
                <li>
                  <b>Песчаное основание</b>: 100–150 мм, <b>защитная подсыпка</b> 300 мм
                  над верхом трубы (п.8.55). Засыпка пазух песком — обязательно для пластика.
                </li>
                <li>
                  <b>Колодцы водомерные ВК</b> — на вводе в здание, ж/б по типовой
                  серии <b>3.900.1-14</b> (сборные ж/б кольца КС15.9 и т.п.).
                </li>
                <li>
                  <b>Задвижки фланцевые</b> чугунные <code>30ч6бр</code>, Ø равный трубе,
                  установка перед водомером (для возможности замены).
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
                      ? "bg-cyan-600 text-white"
                      : done.has(s.id)
                      ? "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30"
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
                          ? "bg-cyan-500"
                          : i === si
                          ? "bg-cyan-300"
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
                      className="flex-1 border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                    />
                    {!rev[k] && (
                      <button
                        onClick={go}
                        disabled={!inp[k]?.trim()}
                        className="px-3 py-1.5 bg-cyan-600 text-white text-xs font-semibold rounded hover:bg-cyan-700 disabled:opacity-40"
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
                <div className="border-2 border-cyan-300 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg p-3">
                  <div className="text-xs font-bold text-cyan-800 dark:text-cyan-300 mb-1">
                    ✓ Завершено
                  </div>
                  <code className="text-[10px] font-mono text-cyan-700 dark:text-cyan-400 block">
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
                className="w-full py-2 bg-cyan-600 text-white text-sm font-semibold rounded-lg hover:bg-cyan-700"
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
                  <code className="font-mono text-[10px] text-cyan-700 dark:text-cyan-400">
                    Сб.16-01-001
                  </code>
                  {" "}— Прокладка наружных водопроводов ПЭ Ø160
                </li>
                <li>
                  <code className="font-mono text-[10px] text-cyan-700 dark:text-cyan-400">
                    Сб.16-04-002
                  </code>
                  {" "}— Установка задвижки фланцевой 30ч6бр Ø150
                </li>
                <li>
                  <code className="font-mono text-[10px] text-cyan-700 dark:text-cyan-400">
                    Сб.16-03-001
                  </code>
                  {" "}— Установка колодца водопроводного ВК-1500
                </li>
                <li>
                  <code className="font-mono text-[10px] text-cyan-700 dark:text-cyan-400">
                    Сб.16-05-001
                  </code>
                  {" "}— Монтаж водомера турбинного Ø100
                </li>
                <li>
                  <code className="font-mono text-[10px] text-cyan-700 dark:text-cyan-400">
                    Сб.1-01-013
                  </code>
                  {" "}— Разработка грунта в отвал экскаватором, II гр.
                </li>
                <li>
                  <code className="font-mono text-[10px] text-cyan-700 dark:text-cyan-400">
                    Сб.1-02-005
                  </code>
                  {" "}— Засыпка траншей вручную, II гр.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
