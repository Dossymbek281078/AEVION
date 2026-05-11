"use client";

import Link from "next/link";
import { useMemo, useEffect, useState } from "react";
import { saveDrawingsProgress, loadDrawingsProgress } from "../lib/useDrawingsProgress";

// ── Типы упражнений ──────────────────────────────────────────────────

interface Step {
  id: string;
  label: string;
  hint?: string;
  accepts: string[];
  explanation: string;
}

interface Exercise {
  id: string;
  title: string;
  view: "plan" | "section";
  /** Какие зоны подсвечивать на чертеже (id элементов SVG). */
  highlight: string[];
  question: string;
  /** Шаги: несколько вводов (например, сначала длина, потом ширина, потом итог). */
  steps: Step[];
  /** ВОР-строка после сдачи. */
  vorRow: string;
}

// ── Упражнения: класс + коридор + разрез ─────────────────────────────
const EXERCISES: Exercise[] = [
  {
    id: "floor-area",
    title: "Площадь пола классной комнаты К-201",
    view: "plan",
    highlight: ["room-201"],
    question:
      "По плану этажа определите площадь пола класса К-201. В ВОР записывается «в чистоте» (внутренние размеры по осям минус конструктив стен).",
    steps: [
      { id: "len",   label: "Длина помещения, м",  accepts: ["8.5", "8,5"],              explanation: "По чертежу: ось-ось 8.9 м, минус 2 × 0.2 м стены = 8.5 м" },
      { id: "width", label: "Ширина помещения, м", accepts: ["6.0", "6"],                 explanation: "По чертежу: ось-ось 6.4 м, минус 2 × 0.2 м стены = 6.0 м" },
      { id: "area",  label: "Площадь пола, м²",    accepts: ["51", "51.0", "51,0"],       explanation: "8.5 × 6.0 = 51.0 м². Дверные проёмы из площади пола НЕ вычитаются (стяжка и линолеум заходят под дверь)." },
    ],
    vorRow: "Площадь пола К-201: 8.5 × 6.0 = 51.0 м² (Чертёж А-23, лист 2)",
  },
  {
    id: "wall-plaster",
    title: "Площадь стен под штукатурку К-201",
    view: "plan",
    highlight: ["room-201", "window-201a", "window-201b", "door-201"],
    question:
      "Рассчитайте площадь стен класса К-201 для позиции «Штукатурка стен по маякам». Из полной площади нужно вычесть проёмы окон и двери.",
    steps: [
      { id: "perimeter", label: "Периметр помещения, м",          accepts: ["29", "29.0", "29,0"],   explanation: "2 × (8.5 + 6.0) = 2 × 14.5 = 29.0 м" },
      { id: "gross",     label: "Площадь стен (gross), м²",        accepts: ["92.8", "92,8"],         explanation: "29.0 × 3.2 м (высота) = 92.8 м²" },
      { id: "openings",  label: "Сумма проёмов (окна + дверь), м²", accepts: ["7.29", "7,29", "7.3", "7,3"], explanation: "2 окна: 2 × 1.5 × 1.8 = 5.4 м²; 1 дверь: 0.9 × 2.1 = 1.89 м²; итого 7.29 м²" },
      { id: "net",       label: "Площадь нетто, м²",               accepts: ["85.5", "85,5", "85.51", "85,51"], explanation: "92.8 − 7.29 = 85.51 ≈ 85.5 м²" },
    ],
    vorRow: "Штукатурка стен К-201: 2×(8.5+6.0)×3.2 − 2×(1.5×1.8) − 0.9×2.1 = 85.5 м² (Чертёж А-23, лист 2)",
  },
  {
    id: "ceiling",
    title: "Площадь потолка К-201 и К-202",
    view: "plan",
    highlight: ["room-201", "room-202"],
    question:
      "Определите суммарную площадь потолков двух смежных классов (К-201 и К-202). Потолок не вычитает проёмы — только встроенные колонны, которых тут нет.",
    steps: [
      { id: "one",  label: "Площадь одного класса, м²", accepts: ["51", "51.0"],  explanation: "8.5 × 6.0 = 51.0 м² (те же размеры, что и пол)" },
      { id: "total", label: "Сумма двух классов, м²",   accepts: ["102", "102.0"], explanation: "2 × 51.0 = 102.0 м²" },
    ],
    vorRow: "Окраска потолков К-201, К-202: 2 × (8.5×6.0) = 102.0 м² (Чертёж А-23, лист 2)",
  },
  {
    id: "corridor",
    title: "Площадь пола коридора",
    view: "plan",
    highlight: ["corridor"],
    question:
      "По плану определите площадь пола коридора крыла Б (без учёта лестничной клетки, она — отдельная позиция).",
    steps: [
      { id: "len",   label: "Длина коридора, м",   accepts: ["32", "32.0"],   explanation: "4 класса × 8.5 м + 3 межкомнатных перегородки (≈ 0.2 м) ≈ 34.6 м, но по внутр. размеру = 32.0 м (без торцевых стен)" },
      { id: "width", label: "Ширина коридора, м",  accepts: ["2.4", "2,4"],   explanation: "По чертежу: ось-ось 2.8 м минус 2 × 0.2 м = 2.4 м" },
      { id: "area",  label: "Площадь коридора, м²", accepts: ["76.8", "76,8"], explanation: "32.0 × 2.4 = 76.8 м²" },
    ],
    vorRow: "Линолеум в коридоре: 32.0 × 2.4 = 76.8 м² (Чертёж А-23, лист 2)",
  },
  {
    id: "screed-volume",
    title: "Объём стяжки — все классы этажа",
    view: "section",
    highlight: ["screed-layer", "room-section"],
    question:
      "По разрезу определите толщину стяжки. Рассчитайте объём цементной стяжки для всех 4 классов на одном этаже крыла Б.",
    steps: [
      { id: "thickness", label: "Толщина стяжки, м",      accepts: ["0.04", "0,04"],             explanation: "По разрезу: стяжка 40 мм = 0.04 м (слой ЦПС марки M150 под линолеум)" },
      { id: "one-area",  label: "Площадь одного класса, м²", accepts: ["51", "51.0"],             explanation: "Уже считали: 8.5 × 6.0 = 51.0 м²" },
      { id: "four",      label: "Площадь 4 классов, м²",   accepts: ["204", "204.0"],             explanation: "4 × 51.0 = 204.0 м²" },
      { id: "volume",    label: "Объём стяжки, м³",         accepts: ["8.16", "8,16"],             explanation: "204.0 м² × 0.04 м = 8.16 м³" },
    ],
    vorRow: "Стяжка цем. М150 t=40мм: 4×(8.5×6.0)×0.04 = 8.16 м³ (Чертёж А-23+А-24, разрез 1-1)",
  },
];

// ── Допуск при сравнении чисел ±1% ──────────────────────────────────
function checkAnswer(input: string, accepts: string[]): boolean {
  const clean = input.trim().replace(",", ".");
  return accepts.some((a) => {
    const expected = parseFloat(a.replace(",", "."));
    const got = parseFloat(clean);
    if (isNaN(got)) return false;
    return Math.abs((got - expected) / expected) < 0.015;
  });
}

// ════════════════════════════════════════════════════════════════════
//   SVG: ПЛАН ЭТАЖА — Крыло Б, Школа №47
// ════════════════════════════════════════════════════════════════════

function PlanSVG({ highlight }: { highlight: string[] }) {
  const hl = new Set(highlight);

  const room = (id: string, label: string, subLabel: string, x: number, y: number, w: number, h: number) => {
    const active = hl.has(id);
    return (
      <g key={id} id={id}>
        <rect x={x} y={y} width={w} height={h}
          fill={active ? "#d1fae5" : "#f8fafc"}
          stroke={active ? "#059669" : "#64748b"}
          strokeWidth={active ? 2.5 : 1.5} />
        <text x={x + w / 2} y={y + h / 2 - 10} textAnchor="middle" fontSize="11" fontWeight="600" fill={active ? "#065f46" : "#334155"}>
          {label}
        </text>
        <text x={x + w / 2} y={y + h / 2 + 8} textAnchor="middle" fontSize="10" fill={active ? "#047857" : "#64748b"}>
          {subLabel}
        </text>
      </g>
    );
  };

  const dim = (x1: number, y1: number, x2: number, y2: number, label: string, side: "top" | "bottom" | "left" | "right" = "bottom") => {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const isH = Math.abs(y1 - y2) < 2;
    return (
      <g key={`${x1}-${y1}-${x2}-${y2}`}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="3 2" />
        <text
          x={isH ? mx : (side === "left" ? mx - 8 : mx + 8)}
          y={isH ? (side === "top" ? my - 5 : my + 12) : my}
          textAnchor="middle"
          fontSize="9"
          fill="#475569"
          fontStyle="italic"
        >
          {label}
        </text>
      </g>
    );
  };

  // Параметры сетки
  const SCALE = 25;          // px per metre
  const OX = 60;             // left origin
  const OY = 60;             // top origin
  const WALL = 5;            // wall thickness px
  const RW = 8.5 * SCALE;    // room width (along corridor) = 212.5px
  const RH = 6.0 * SCALE;    // room depth = 150px
  const CW = 4;              // corridor from 4 rooms = 4*RW = 850; actual corridor internal length = 3*RW+RW = 4RW
  const CORR = 2.4 * SCALE;  // corridor internal width = 60px
  const STAIR = 4.0 * SCALE; // stairwell width = 100px

  // Координаты
  const rooms = [
    { id: "room-201", label: "К-201",  sub: "8.5 × 6.0 м" },
    { id: "room-202", label: "К-202",  sub: "8.5 × 6.0 м" },
    { id: "room-203", label: "К-203",  sub: "8.5 × 6.0 м" },
    { id: "room-204", label: "К-204",  sub: "8.5 × 6.0 м" },
  ];

  const totalW = rooms.length * (RW + WALL) + STAIR + WALL * 2;
  const totalH = RH + CORR + WALL * 3;

  return (
    <svg
      viewBox={`${OX - 55} ${OY - 55} ${totalW + 110} ${totalH + 110}`}
      className="w-full h-auto"
      style={{ maxHeight: 380 }}
      aria-label="План этажа крыла Б школы №47"
    >
      {/* Внешние стены */}
      <rect
        x={OX} y={OY}
        width={totalW} height={totalH}
        fill="none" stroke="#1e293b" strokeWidth={WALL}
      />

      {/* Комнаты */}
      {rooms.map((r, i) => {
        const rx = OX + WALL + i * (RW + WALL);
        const ry = OY + WALL;
        return (
          <g key={r.id}>
            {room(r.id, r.label, r.sub, rx, ry, RW, RH)}

            {/* Окно-1 на внешней стене (верх) */}
            <rect
              id={`window-${r.id.split("-")[1]}a`}
              x={rx + RW / 4} y={OY - WALL / 2}
              width={1.5 * SCALE} height={WALL + 2}
              fill={hl.has(`window-${r.id.split("-")[1]}a`) ? "#bfdbfe" : "#e0f2fe"}
              stroke="#3b82f6" strokeWidth={1}
            />
            {/* Окно-2 */}
            <rect
              id={`window-${r.id.split("-")[1]}b`}
              x={rx + RW * 0.6} y={OY - WALL / 2}
              width={1.5 * SCALE} height={WALL + 2}
              fill={hl.has(`window-${r.id.split("-")[1]}b`) ? "#bfdbfe" : "#e0f2fe"}
              stroke="#3b82f6" strokeWidth={1}
            />
            {/* Дверь в коридор */}
            <rect
              id={`door-${r.id.split("-")[1]}`}
              x={rx + RW / 2 - 0.45 * SCALE} y={ry + RH - 2}
              width={0.9 * SCALE} height={WALL + 2}
              fill={hl.has(`door-${r.id.split("-")[1]}`) ? "#fed7aa" : "#fef3c7"}
              stroke="#f59e0b" strokeWidth={1}
            />
          </g>
        );
      })}

      {/* Коридор */}
      {(() => {
        const cx = OX + WALL;
        const cy = OY + WALL + RH + WALL;
        const cw = rooms.length * (RW + WALL) - WALL;
        return (
          <g id="corridor">
            <rect
              x={cx} y={cy}
              width={cw} height={CORR}
              fill={hl.has("corridor") ? "#fef9c3" : "#f1f5f9"}
              stroke={hl.has("corridor") ? "#ca8a04" : "#94a3b8"}
              strokeWidth={hl.has("corridor") ? 2 : 1}
            />
            <text x={cx + cw / 2} y={cy + CORR / 2 + 5} textAnchor="middle" fontSize="11" fontWeight="600" fill={hl.has("corridor") ? "#713f12" : "#475569"}>
              Коридор 2.4 м
            </text>
          </g>
        );
      })()}

      {/* Лестничная клетка */}
      {(() => {
        const sx = OX + WALL + rooms.length * (RW + WALL);
        const sy = OY + WALL;
        const sh = RH + WALL + CORR;
        return (
          <g id="stairwell">
            <rect x={sx} y={sy} width={STAIR} height={sh} fill="#f1f5f9" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 3" />
            <text x={sx + STAIR / 2} y={sy + sh / 2 - 8} textAnchor="middle" fontSize="9" fill="#64748b">ЛК</text>
            <text x={sx + STAIR / 2} y={sy + sh / 2 + 6} textAnchor="middle" fontSize="9" fill="#64748b">(лестн.)</text>
          </g>
        );
      })()}

      {/* Размерные линии */}
      {/* Ширина класса */}
      {dim(OX + WALL, OY - 35, OX + WALL + RW, OY - 35, "8.5 м", "top")}
      {/* Глубина класса */}
      {dim(OX - 35, OY + WALL, OX - 35, OY + WALL + RH, "6.0 м", "left")}
      {/* Ширина коридора */}
      {dim(OX - 35, OY + WALL + RH + WALL, OX - 35, OY + WALL + RH + WALL + CORR, "2.4 м", "left")}
      {/* Длина коридора */}
      {dim(OX + WALL, OY + totalH + 30, OX + WALL + rooms.length * (RW + WALL) - WALL, OY + totalH + 30, "≈ 32.0 м", "bottom")}

      {/* Легенда */}
      <g transform={`translate(${OX - 10}, ${OY + totalH + 55})`}>
        <rect x={0} y={0} width={12} height={12} fill="#e0f2fe" stroke="#3b82f6" strokeWidth={1} />
        <text x={16} y={10} fontSize="9" fill="#475569">Окна 1.5×1.8 м</text>
        <rect x={100} y={0} width={12} height={12} fill="#fef3c7" stroke="#f59e0b" strokeWidth={1} />
        <text x={116} y={10} fontSize="9" fill="#475569">Двери 0.9×2.1 м</text>
        <text x={230} y={10} fontSize="9" fill="#64748b" fontStyle="italic">М 1:200  •  Школа №47, Крыло Б</text>
      </g>

      {/* Метка "Север" */}
      <text x={OX + totalW - 30} y={OY - 30} fontSize="9" fill="#94a3b8">↑ С</text>
    </svg>
  );
}

// ════════════════════════════════════════════════════════════════════
//   SVG: РАЗРЕЗ 1-1 — узел пола
// ════════════════════════════════════════════════════════════════════

function SectionSVG({ highlight }: { highlight: string[] }) {
  const hl = new Set(highlight);
  const OX = 80, OY = 30;
  const SCALE = 25;
  const H = 3.2 * SCALE;   // room height 80px
  const W = 6 * SCALE;     // room width 150px

  const SLAB = 0.22 * SCALE;       // 22cm перекрытие
  const SCREED = 0.04 * SCALE;     // 4cm стяжка
  const LINOLEUM = 0.004 * SCALE;  // 4mm линолеум (визуально 3px)
  const PLASTER = 0.02 * SCALE;    // 2cm штукатурка

  return (
    <svg viewBox={`${OX - 60} ${OY - 30} 460 360`} className="w-full h-auto" style={{ maxHeight: 340 }} aria-label="Разрез 1-1 — узел пола">
      {/* Перекрытие снизу */}
      <rect x={OX} y={OY + H + SLAB} width={W} height={SLAB}
        fill="#cbd5e1" stroke="#475569" strokeWidth={1} />
      <text x={OX + W + 8} y={OY + H + SLAB * 1.2} fontSize="9" fill="#475569">ПБ-220 (перекрытие 220 мм)</text>

      {/* Стяжка */}
      <rect x={OX} y={OY + H} width={W} height={SCREED}
        id="screed-layer"
        fill={hl.has("screed-layer") ? "#a7f3d0" : "#e2e8f0"}
        stroke={hl.has("screed-layer") ? "#059669" : "#94a3b8"}
        strokeWidth={hl.has("screed-layer") ? 2 : 1}
      />
      <text x={OX + W + 8} y={OY + H + SCREED * 0.8} fontSize="9"
        fontWeight={hl.has("screed-layer") ? "700" : "400"}
        fill={hl.has("screed-layer") ? "#065f46" : "#64748b"}>
        ЦПС стяжка M150 → 40 мм
      </text>

      {/* Линолеум */}
      <rect x={OX} y={OY + H - LINOLEUM} width={W} height={LINOLEUM}
        fill="#fde68a" stroke="#d97706" strokeWidth={1} />
      <text x={OX + W + 8} y={OY + H - LINOLEUM + LINOLEUM * 0.8} fontSize="9" fill="#92400e">
        Линолеум 4 мм
      </text>

      {/* Помещение — воздух */}
      <rect x={OX} y={OY} width={W} height={H - LINOLEUM}
        id="room-section"
        fill={hl.has("room-section") ? "#d1fae5" : "#f8fafc"}
        stroke="none"
      />

      {/* Штукатурка левой стены */}
      <rect x={OX - PLASTER} y={OY} width={PLASTER} height={H}
        fill="#fef9c3" stroke="#ca8a04" strokeWidth={0.8} />

      {/* Левая стена (кирпич) */}
      <rect x={OX - PLASTER - 0.38 * SCALE} y={OY} width={0.38 * SCALE} height={H}
        fill="#e2e8f0" stroke="#64748b" strokeWidth={1}>
        <title>Кирпичная стена 380 мм</title>
      </rect>

      {/* Правая стена */}
      <rect x={OX + W + PLASTER} y={OY} width={0.38 * SCALE} height={H}
        fill="#e2e8f0" stroke="#64748b" strokeWidth={1} />
      <rect x={OX + W} y={OY} width={PLASTER} height={H}
        fill="#fef9c3" stroke="#ca8a04" strokeWidth={0.8} />

      {/* Потолок (штукатурка снизу плиты) */}
      <rect x={OX} y={OY} width={W} height={PLASTER}
        fill="#fef9c3" stroke="#ca8a04" strokeWidth={0.8} />

      {/* Размерная линия — высота помещения */}
      <line x1={OX - 50} y1={OY + LINOLEUM} x2={OX - 50} y2={OY + H} stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="3 2" />
      <text x={OX - 40} y={(OY + OY + H) / 2 + 4} fontSize="9" fill="#475569" fontStyle="italic">3.2 м</text>

      {/* Размерная линия — стяжка */}
      <line x1={OX + W + 85} y1={OY + H} x2={OX + W + 85} y2={OY + H + SCREED}
        stroke={hl.has("screed-layer") ? "#059669" : "#94a3b8"} strokeWidth={0.8} />
      <text x={OX + W + 95} y={OY + H + SCREED / 2 + 3} fontSize="9"
        fill={hl.has("screed-layer") ? "#065f46" : "#64748b"}
        fontWeight={hl.has("screed-layer") ? "700" : "400"}>
        40 мм
      </text>

      {/* Метка разреза */}
      <text x={OX + W / 2} y={OY - 15} textAnchor="middle" fontSize="10" fontWeight="600" fill="#334155">
        Разрез 1-1 · Узел пола
      </text>
      <text x={OX + W / 2} y={OY - 4} textAnchor="middle" fontSize="9" fill="#94a3b8" fontStyle="italic">
        М 1:20 · Школа №47, Крыло Б
      </text>

      {/* Легенда */}
      <g transform={`translate(${OX - 10}, 305)`}>
        <rect x={0} y={0} width={10} height={10} fill="#e2e8f0" stroke="#64748b" strokeWidth={1} />
        <text x={14} y={9} fontSize="8" fill="#64748b">Кирпич</text>
        <rect x={70} y={0} width={10} height={10} fill="#fef9c3" stroke="#ca8a04" strokeWidth={1} />
        <text x={84} y={9} fontSize="8" fill="#64748b">Штукатурка</text>
        <rect x={165} y={0} width={10} height={10} fill="#a7f3d0" stroke="#059669" strokeWidth={1} />
        <text x={179} y={9} fontSize="8" fill="#065f46" fontWeight="600">Стяжка</text>
        <rect x={235} y={0} width={10} height={10} fill="#fde68a" stroke="#d97706" strokeWidth={1} />
        <text x={249} y={9} fontSize="8" fill="#64748b">Линолеум</text>
      </g>
    </svg>
  );
}

// ════════════════════════════════════════════════════════════════════
//   Основная страница
// ════════════════════════════════════════════════════════════════════

export default function DrawingsPracticePage() {
  const [exIdx, setExIdx] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Set<string>>(new Set());

  // Восстановить сохранённый прогресс при монтировании
  useEffect(() => {
    const saved = loadDrawingsProgress();
    if (saved.basicDone > 0) {
      // Отмечаем первые N упражнений как пройденные
      setDone(new Set(EXERCISES.slice(0, saved.basicDone).map((e) => e.id)));
      setExIdx(Math.min(saved.basicDone, EXERCISES.length - 1));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ex = EXERCISES[exIdx];
  const step = ex.steps[stepIdx];
  const key = `${ex.id}-${step.id}`;
  const isCorrect = revealed[key] && checkAnswer(inputs[key] ?? "", step.accepts);
  const isWrong = revealed[key] && !isCorrect;

  function handleCheck() {
    setRevealed((r) => ({ ...r, [key]: true }));
    if (checkAnswer(inputs[key] ?? "", step.accepts)) {
      // pause briefly then advance step
      setTimeout(() => {
        if (stepIdx + 1 < ex.steps.length) {
          setStepIdx(stepIdx + 1);
          setRevealed({});
        } else {
          setDone((d) => {
            const next = new Set([...d, ex.id]);
            saveDrawingsProgress({ basicDone: next.size, basicTotal: EXERCISES.length });
            return next;
          });
        }
      }, 900);
    }
  }

  function nextExercise() {
    if (exIdx + 1 < EXERCISES.length) {
      setExIdx(exIdx + 1);
      setStepIdx(0);
      setInputs({});
      setRevealed({});
    }
  }

  const allDone = done.size === EXERCISES.length;

  const progressPct = useMemo(() => Math.round(
    (done.size / EXERCISES.length) * 100
  ), [done]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link href="/smeta-trainer" className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
            ← К курсу
          </Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              📐 Чтение чертежей → Подсчёт объёмов
            </h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Школа №47, Крыло Б · {EXERCISES.length} упражнений · {done.size} пройдено
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-400">{progressPct}%</div>
            <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        </div>
      </header>

      {/* Intro */}
      {/* Навигация */}
      <div className="bg-white dark:bg-slate-900 border-b dark:border-slate-700 px-4 py-2 flex items-center gap-2 flex-wrap">
        <Link href="/smeta-trainer/drawings-practice/hub"
          className="text-[11px] px-3 py-1 rounded-full bg-indigo-700 text-white font-semibold">
          🗂 Все разделы
        </Link>
        <Link href="/smeta-trainer/drawings-practice"
          className="text-[11px] px-3 py-1 rounded-full bg-emerald-600 text-white font-semibold">
          📐 Базовый L2
        </Link>
        <Link href="/smeta-trainer/drawings-practice/excavation" className="text-[11px] px-3 py-1 rounded-full bg-white dark:bg-slate-800 border border-amber-300 text-amber-700 hover:bg-amber-50 font-semibold">🔶 Котлован</Link>
        <Link href="/smeta-trainer/drawings-practice/walls" className="text-[11px] px-3 py-1 rounded-full bg-white dark:bg-slate-800 border border-orange-300 text-orange-700 hover:bg-orange-50 font-semibold">🧱 Стены</Link>
        <Link href="/smeta-trainer/drawings-practice/slabs" className="text-[11px] px-3 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-400 text-slate-700 hover:bg-slate-50 font-semibold">🔲 Перекр.</Link>
        <Link href="/smeta-trainer/drawings-practice/roof-flat" className="text-[11px] px-3 py-1 rounded-full bg-white dark:bg-slate-800 border border-blue-300 text-blue-700 hover:bg-blue-50 font-semibold">🏠 Кровля</Link>
        <Link href="/smeta-trainer/drawings-practice/windows-doors" className="text-[11px] px-3 py-1 rounded-full bg-white dark:bg-slate-800 border border-sky-300 text-sky-700 hover:bg-sky-50 font-semibold">🪟 Окна</Link>
        <Link href="/smeta-trainer/drawings-practice/stairs" className="text-[11px] px-3 py-1 rounded-full bg-white dark:bg-slate-800 border border-violet-300 text-violet-700 hover:bg-violet-50 font-semibold">🪜 Лестн.</Link>
        <Link href="/smeta-trainer/drawings-practice/finishing" className="text-[11px] px-3 py-1 rounded-full bg-white dark:bg-slate-800 border border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-semibold">🎨 Отделка</Link>
        <Link href="/smeta-trainer/drawings-practice/utilities" className="text-[11px] px-3 py-1 rounded-full bg-white dark:bg-slate-800 border border-purple-300 text-purple-700 hover:bg-purple-50 font-semibold">🔧 Инж.</Link>
        <Link href="/smeta-trainer/drawings-practice/advanced" className="text-[11px] px-3 py-1 rounded-full bg-white dark:bg-slate-800 border border-indigo-300 text-indigo-700 hover:bg-indigo-50 font-semibold">📐 L4</Link>
        <Link href="/smeta-trainer/drawings-practice/errors" className="text-[11px] px-3 py-1 rounded-full bg-white dark:bg-slate-800 border border-red-300 text-red-700 hover:bg-red-50 font-semibold">🔍 Ошибки</Link>
      </div>
      <div className="bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-200 dark:border-emerald-800 px-4 py-2 text-xs text-emerald-800 dark:text-emerald-300">
        💡 Чертёж слева — читайте размеры, которые на нём указаны. Подсвеченные зоны относятся к текущему упражнению.
        Допуск ±1.5% при вводе чисел.
      </div>

      {allDone ? (
        <div className="max-w-2xl mx-auto py-16 text-center px-4">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Все упражнения пройдены!
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
            Вы умеете читать план и разрез, подсчитывать площади и объёмы, вычитать проёмы.
            Теперь любая ВОР-строка в смете понятна: видно откуда каждое число.
          </p>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4 text-left mb-6 text-xs space-y-2">
            <div className="font-bold text-slate-700 dark:text-slate-300 mb-1">Ваш ВОР (Ведомость объёмов работ):</div>
            {EXERCISES.map((e) => (
              <div key={e.id} className="flex gap-2 text-slate-700 dark:text-slate-300">
                <span className="text-emerald-500 shrink-0">✓</span>
                <code className="text-[10px] font-mono">{e.vorRow}</code>
              </div>
            ))}
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => { setExIdx(0); setStepIdx(0); setInputs({}); setRevealed({}); setDone(new Set()); }}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-lg"
            >
              Пройти снова
            </button>
            <Link href="/smeta-trainer/level/2" className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700">
              → К составлению ЛСР (Уровень 2)
            </Link>
          </div>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Drawing panel — 2/3 */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                {ex.view === "plan" ? "📐 План 2-го этажа" : "↔ Разрез 1-1"}
              </span>
              <span className="text-[10px] text-slate-400 ml-auto italic">Красные/зелёные зоны — область упражнения</span>
            </div>
            {ex.view === "plan" ? (
              <PlanSVG highlight={ex.highlight} />
            ) : (
              <SectionSVG highlight={ex.highlight} />
            )}
          </div>

          {/* Exercise panel — 1/3 */}
          <div className="space-y-3">
            {/* Exercise selector */}
            <div className="flex gap-1 flex-wrap">
              {EXERCISES.map((e, i) => (
                <button
                  key={e.id}
                  onClick={() => { setExIdx(i); setStepIdx(0); setInputs({}); setRevealed({}); }}
                  className={`text-[10px] px-2 py-1 rounded font-semibold transition-colors ${
                    i === exIdx
                      ? "bg-emerald-600 text-white"
                      : done.has(e.id)
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200"
                  }`}
                >
                  {done.has(e.id) ? "✓ " : ""}{i + 1}
                </button>
              ))}
            </div>

            {/* Current exercise card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">{ex.title}</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">{ex.question}</p>

              {/* Steps progress */}
              {ex.steps.length > 1 && (
                <div className="flex gap-1 mb-3">
                  {ex.steps.map((s, i) => (
                    <div key={s.id} className={`h-1 flex-1 rounded-full ${
                      i < stepIdx ? "bg-emerald-500" : i === stepIdx ? "bg-emerald-300" : "bg-slate-200 dark:bg-slate-700"
                    }`} />
                  ))}
                </div>
              )}

              {/* Current step */}
              {!done.has(ex.id) ? (
                <div className={`border-2 rounded-lg p-3 ${
                  isCorrect ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20"
                    : isWrong ? "border-red-300 bg-red-50 dark:bg-red-900/20"
                      : "border-slate-200 dark:border-slate-700"
                }`}>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Шаг {stepIdx + 1}/{ex.steps.length}: {step.label}
                  </label>
                  {step.hint && (
                    <p className="text-[10px] text-slate-500 italic mb-2">💡 {step.hint}</p>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inputs[key] ?? ""}
                      onChange={(e) => setInputs((p) => ({ ...p, [key]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && !revealed[key] && handleCheck()}
                      disabled={!!revealed[key]}
                      placeholder="Введите число..."
                      className={`flex-1 border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 ${
                        isWrong ? "border-red-400" : isCorrect ? "border-emerald-400" : ""
                      }`}
                    />
                    {!revealed[key] && (
                      <button
                        onClick={handleCheck}
                        disabled={!inputs[key]?.trim()}
                        className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded hover:bg-emerald-700 disabled:opacity-40"
                      >
                        ✓
                      </button>
                    )}
                  </div>

                  {revealed[key] && (
                    <div className={`mt-2 text-xs leading-relaxed ${isCorrect ? "text-emerald-800 dark:text-emerald-300" : "text-red-800 dark:text-red-300"}`}>
                      {isCorrect ? "✓ Верно! " : "✗ Неверно. "}
                      {step.explanation}
                    </div>
                  )}
                  {isWrong && (
                    <button
                      onClick={() => { setInputs((p) => ({ ...p, [key]: "" })); setRevealed((r) => ({ ...r, [key]: false })); }}
                      className="mt-1.5 text-[10px] text-amber-700 underline"
                    >
                      Попробовать снова
                    </button>
                  )}
                </div>
              ) : (
                <div className="border-2 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3">
                  <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 mb-2">✓ Упражнение завершено</div>
                  <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800 rounded p-2 leading-relaxed">
                    📋 ВОР: {ex.vorRow}
                  </div>
                </div>
              )}
            </div>

            {/* Next button */}
            {done.has(ex.id) && exIdx + 1 < EXERCISES.length && (
              <button
                onClick={nextExercise}
                className="w-full py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700"
              >
                Следующее упражнение →
              </button>
            )}

            {/* Theory reminder */}
            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-[10px] text-slate-500 dark:text-slate-400 space-y-1">
              <div className="font-semibold text-slate-600 dark:text-slate-300">Помни:</div>
              <div>• Размеры на чертеже — в <strong>осях</strong>. Чистый размер = ось − стены.</div>
              <div>• Площадь пола: проёмы <em>не</em> вычитают.</div>
              <div>• Площадь стен: вычитают окна <em>и</em> двери.</div>
              <div>• Объём = площадь × толщину слоя.</div>
              <div className="pt-1">
                <Link href="/smeta-trainer/level/1" className="text-emerald-600 hover:underline">
                  → Урок «Как читать чертёж для сметчика»
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
