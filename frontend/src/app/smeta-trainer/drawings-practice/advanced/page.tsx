"use client";

import Link from "next/link";
import { useState } from "react";

// ── helpers ───────────────────────────────────────────────────────────────────

function check(input: string, accepts: string[]): boolean {
  const v = parseFloat(input.trim().replace(",", "."));
  return accepts.some((a) => {
    const e = parseFloat(a.replace(",", "."));
    return !isNaN(v) && !isNaN(e) && Math.abs((v - e) / e) < 0.015;
  });
}

// ── SVG: Разрез кровли ───────────────────────────────────────────────────────

function RoofSVG({ highlight }: { highlight: Set<string> }) {
  const W = 360, H = 260;
  const OX = 70, OY = 30;
  const SPAN = 220;      // горизонтальная проекция 10.0 м
  const RISE = 80;       // подъём ~3.7 м (тангенс 15° × 10 = 2.68, но для наглядности больше)
  // Скат крыши: гипотенуза = √(SPAN²+RISE²)
  const HYPO = Math.sqrt(SPAN * SPAN + RISE * RISE);
  const ANGLE_DEG = Math.atan2(RISE, SPAN) * 180 / Math.PI;

  return (
    <svg viewBox={`0 0 ${W + 120} ${H + 60}`} className="w-full h-auto" style={{ maxHeight: 300 }}>
      {/* Чердак / пространство под кровлей */}
      <polygon
        points={`${OX},${OY + RISE}  ${OX + SPAN / 2},${OY}  ${OX + SPAN},${OY + RISE}`}
        fill={highlight.has("roof-slope") ? "#d1fae5" : "#f1f5f9"}
        stroke={highlight.has("roof-slope") ? "#059669" : "#64748b"}
        strokeWidth={highlight.has("roof-slope") ? 2.5 : 1.5}
      />
      {/* Основание (перекрытие) */}
      <rect x={OX} y={OY + RISE} width={SPAN} height={18}
        fill="#cbd5e1" stroke="#475569" strokeWidth={1} />

      {/* Слои кровли (условно) */}
      <polygon
        points={`${OX - 4},${OY + RISE - 2}  ${OX + SPAN / 2},${OY - 4}  ${OX + SPAN + 4},${OY + RISE - 2}`}
        fill="#fde68a" stroke="#d97706" strokeWidth={1} />

      {/* Размер — горизонтальная проекция */}
      <line x1={OX} y1={OY + RISE + 35} x2={OX + SPAN} y2={OY + RISE + 35}
        stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="3 2" />
      <text x={OX + SPAN / 2} y={OY + RISE + 48} textAnchor="middle" fontSize="10" fill="#475569" fontStyle="italic">
        10.0 м (пролёт)
      </text>

      {/* Уклон скатa */}
      {/* Дуга угла */}
      <path d={`M ${OX + 40} ${OY + RISE} A 35 35 0 0 0 ${OX + 40 * Math.cos(-ANGLE_DEG * Math.PI / 180)} ${OY + RISE - 40 * Math.sin(ANGLE_DEG * Math.PI / 180)}`}
        fill="none" stroke="#6366f1" strokeWidth={1} />
      <text x={OX + 50} y={OY + RISE - 12} fontSize="9" fill="#6366f1">15°</text>

      {/* Надпись ската */}
      {highlight.has("roof-slope") && (
        <text
          x={OX + SPAN / 4 + 10} y={OY + RISE / 2 + 10}
          textAnchor="middle" fontSize="9" fontWeight="700" fill="#065f46"
          transform={`rotate(-${ANGLE_DEG.toFixed(1)}, ${OX + SPAN / 4 + 10}, ${OY + RISE / 2 + 10})`}
        >
          L = 10.35 м ?
        </text>
      )}

      {/* Размер наклонной длины стрелки */}
      <line x1={OX + SPAN / 2 + 30} y1={OY + RISE + 70} x2={OX + SPAN / 2 + 30} y2={OY + 20}
        stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="3 2" />

      {/* Длина крыла по оси здания */}
      <text x={OX + SPAN + 60} y={OY + RISE / 2} fontSize="10" fill="#475569" fontStyle="italic">
        Ось=32.0 м
      </text>

      {/* Легенда */}
      <g transform={`translate(${OX - 10}, ${OY + RISE + 75})`}>
        <rect width={10} height={10} fill="#fde68a" stroke="#d97706" strokeWidth={1} />
        <text x={14} y={9} fontSize="8" fill="#64748b">Кровельный ковёр</text>
        <rect x={130} width={10} height={10} fill={highlight.has("roof-slope") ? "#d1fae5" : "#f1f5f9"}
          stroke={highlight.has("roof-slope") ? "#059669" : "#94a3b8"} strokeWidth={1} />
        <text x={144} y={9} fontSize="8" fill={highlight.has("roof-slope") ? "#065f46" : "#64748b"}
          fontWeight={highlight.has("roof-slope") ? "700" : "400"}>Скат кровли</text>
        <text x={240} y={9} fontSize="8" fill="#94a3b8" fontStyle="italic">М 1:200 · Разрез 2-2</text>
      </g>

      <text x={OX + SPAN / 2} y={OY - 15} textAnchor="middle" fontSize="10" fontWeight="600" fill="#334155">
        Разрез 2-2 · Кровля, уклон 15°
      </text>
    </svg>
  );
}

// ── SVG: Фасад ───────────────────────────────────────────────────────────────

function FacadeSVG({ highlight }: { highlight: Set<string> }) {
  const FLOORS = 4, ROOMS_PER_FLOOR = 4;
  const FW = 52, FH = 52;     // ячейка фасада
  const WW = 30, WH = 30;     // окно внутри ячейки
  const OX = 60, OY = 30;
  const TOTAL_W = ROOMS_PER_FLOOR * FW;
  const TOTAL_H = FLOORS * FH;

  return (
    <svg viewBox={`${OX - 50} ${OY - 25} ${TOTAL_W + 120} ${TOTAL_H + 90}`}
      className="w-full h-auto" style={{ maxHeight: 300 }}>
      {/* Фасад фон */}
      <rect x={OX} y={OY} width={TOTAL_W} height={TOTAL_H}
        fill={highlight.has("facade-wall") ? "#dbeafe" : "#f8fafc"}
        stroke={highlight.has("facade-wall") ? "#3b82f6" : "#475569"}
        strokeWidth={highlight.has("facade-wall") ? 2 : 1.5}
      />
      {/* Окна */}
      {Array.from({ length: FLOORS }, (_, fi) =>
        Array.from({ length: ROOMS_PER_FLOOR }, (_, ri) => {
          const wx = OX + ri * FW + (FW - WW) / 2;
          const wy = OY + fi * FH + (FH - WH) / 2;
          return (
            <rect key={`w-${fi}-${ri}`}
              id={`win-${fi}-${ri}`}
              x={wx} y={wy} width={WW} height={WH}
              fill={highlight.has("windows") ? "#bfdbfe" : "#e0f2fe"}
              stroke={highlight.has("windows") ? "#2563eb" : "#3b82f6"}
              strokeWidth={highlight.has("windows") ? 2 : 1}
            />
          );
        })
      )}
      {/* Горизонтальные делители этажей */}
      {Array.from({ length: FLOORS - 1 }, (_, i) => (
        <line key={`fl-${i}`} x1={OX} y1={OY + (i + 1) * FH} x2={OX + TOTAL_W} y2={OY + (i + 1) * FH}
          stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="4 3" />
      ))}
      {/* Размер — ширина */}
      <line x1={OX} y1={OY + TOTAL_H + 22} x2={OX + TOTAL_W} y2={OY + TOTAL_H + 22}
        stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="3 2" />
      <text x={OX + TOTAL_W / 2} y={OY + TOTAL_H + 35} textAnchor="middle" fontSize="9" fill="#475569" fontStyle="italic">
        ≈ 34.0 м (4 оси × 8.5 м)
      </text>
      {/* Размер — высота */}
      <line x1={OX - 30} y1={OY} x2={OX - 30} y2={OY + TOTAL_H}
        stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="3 2" />
      <text x={OX - 20} y={OY + TOTAL_H / 2} textAnchor="middle" fontSize="9" fill="#475569" fontStyle="italic"
        transform={`rotate(-90, ${OX - 20}, ${OY + TOTAL_H / 2})`}>
        ≈ 16.0 м (4 этажа)
      </text>
      {/* Окно — размер */}
      <text x={OX + TOTAL_W + 10} y={OY + FH / 2 + 4} fontSize="8" fill="#2563eb">1.5×1.8 м</text>
      {/* Подпись */}
      <text x={OX + TOTAL_W / 2} y={OY - 12} textAnchor="middle" fontSize="10" fontWeight="600" fill="#334155">
        Фасад Б · Школа №47
      </text>
      <text x={OX + TOTAL_W / 2} y={OY - 2} textAnchor="middle" fontSize="8" fill="#94a3b8" fontStyle="italic">
        М 1:200 · 4 этажа × 4 оси
      </text>
      {/* Кол-во окон */}
      {highlight.has("windows") && (
        <text x={OX + TOTAL_W / 2} y={OY + TOTAL_H / 2} textAnchor="middle"
          fontSize="14" fontWeight="700" fill="rgba(37,99,235,0.3)">
          16 окон
        </text>
      )}
    </svg>
  );
}

// ── Упражнения L4 ──────────────────────────────────────────────────────────────

const ADV_EXERCISES = [
  {
    id: "roof-area",
    title: "Площадь кровли с учётом уклона",
    view: "roof" as const,
    highlight: ["roof-slope"],
    question:
      "Плановая проекция скатной кровли — 10.0 × 32.0 м. Уклон = 15°. Фактическая площадь кровельного ковра больше проекции — нужно делить на cos(15°).",
    steps: [
      {
        id: "proj", label: "Плановая проекция, м²",
        accepts: ["320", "320.0"], explanation: "10.0 м (пролёт) × 32.0 м (длина здания) = 320.0 м². Это проекция, не фактическая кровля."
      },
      {
        id: "coef", label: "Поправочный коэффициент (1/cos 15°)",
        accepts: ["1.035", "1.04", "1.036"],
        explanation: "cos 15° = 0.966; K = 1/0.966 = 1.035. В таблицах НДЦС К для уклона 15° = 1.035."
      },
      {
        id: "actual", label: "Фактическая площадь кровли, м²",
        accepts: ["331", "331.2", "331.3", "332"],
        explanation: "320.0 × 1.035 = 331.2 м². Именно эта площадь вносится в ВОР, т.к. кровельщик крыл фактическую, не плановую."
      },
    ],
    vorRow: "Кровельный ковёр (скат 15°): 10.0×32.0/cos(15°) = 320.0×1.035 = 331.2 м² (Чертёж А-31, разрез 2-2)",
    theory: "Поправочный коэффициент на уклон: К = 1/cos(α). При α=15°: К=1.035; при 20°: К=1.064; при 30°: К=1.155.",
  },
  {
    id: "facade-wall",
    title: "Площадь фасада под утепление",
    view: "facade" as const,
    highlight: ["facade-wall", "windows"],
    question:
      "Фасад крыла Б: 34.0 × 16.0 м (4 этажа × 4 оси). На фасаде — 16 окон 1.5 × 1.8 м. Рассчитайте площадь утепляемой стены (бруто − проёмы).",
    steps: [
      {
        id: "gross", label: "Площадь фасада бруто, м²",
        accepts: ["544", "544.0"], explanation: "34.0 м (ширина) × 16.0 м (высота) = 544.0 м²"
      },
      {
        id: "wins", label: "Суммарная площадь окон, м²",
        accepts: ["43.2", "43,2"], explanation: "16 окон × 1.5 м × 1.8 м = 16 × 2.7 = 43.2 м²"
      },
      {
        id: "net", label: "Площадь утепления (нетто), м²",
        accepts: ["500.8", "500,8", "501", "500.9"],
        explanation: "544.0 − 43.2 = 500.8 м². Это нетто-площадь для позиции «Утепление фасада» в ЛСР."
      },
    ],
    vorRow: "Утепление фасада Б: 34.0×16.0 − 16×(1.5×1.8) = 544.0−43.2 = 500.8 м² (Чертёж А-32, фасад Б)",
    theory: "Из площади фасада вычитаются оконные и дверные проёмы. Для откосов — отдельная позиция. Балконы — отдельная позиция.",
  },
  {
    id: "stair-finish",
    title: "Площадь отделки лестничного марша",
    view: "roof" as const,
    highlight: [],
    question:
      "Лестничный марш: 9 ступеней, проступь 0.30 м, подступёнок 0.18 м, ширина марша 1.4 м. Рассчитайте площадь под отделку (проступи + подступёнки) — не наклонную, а сумму горизонтальных и вертикальных грaней.",
    steps: [
      {
        id: "tread", label: "Площадь всех проступей (горизонт.), м²",
        accepts: ["3.78", "3,78"],
        explanation: "9 ступ × 0.30 м × 1.4 м = 3.78 м². Это горизонтальные грани — основа для плиточной отделки."
      },
      {
        id: "riser", label: "Площадь всех подступёнков (верт.), м²",
        accepts: ["2.268", "2.27", "2,27", "2.27"],
        explanation: "9 ступ × 0.18 м × 1.4 м = 2.268 м². Вертикальные грани (если отделываются — напр., мраморная плитка)."
      },
      {
        id: "total", label: "Итого площадь отделки марша, м²",
        accepts: ["6.05", "6,05", "6.05", "6.0", "6.048"],
        explanation: "3.78 + 2.268 = 6.05 м². В некоторых расценках проступи и подступёнки — отдельные позиции (разные материалы)."
      },
    ],
    vorRow: "Отделка марша (9 ст × 1.4 м): проступи 3.78 + подступёнки 2.27 = 6.05 м² (Чертёж А-35, разрез 3-3)",
    theory: "Ступени НЕ считают по наклонной длине марша. Считают: отдельно горизонтальные грани (проступи) и вертикальные (подступёнки).",
  },
];

// ── Компонент ──────────────────────────────────────────────────────────────────

export default function AdvancedDrawingsPage() {
  const [exIdx, setExIdx] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Set<string>>(new Set());

  const ex = ADV_EXERCISES[exIdx];
  const step = ex.steps[stepIdx];
  const key = `${ex.id}-${step.id}`;
  const isCorrect = revealed[key] && check(inputs[key] ?? "", step.accepts);
  const isWrong   = revealed[key] && !isCorrect;

  function handleCheck() {
    setRevealed((r) => ({ ...r, [key]: true }));
    if (check(inputs[key] ?? "", step.accepts)) {
      setTimeout(() => {
        if (stepIdx + 1 < ex.steps.length) {
          setStepIdx(stepIdx + 1);
          setRevealed({});
        } else {
          setDone((d) => new Set([...d, ex.id]));
        }
      }, 800);
    }
  }

  const allDone = done.size === ADV_EXERCISES.length;
  const hl = new Set(ex.highlight);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-white dark:bg-slate-900 border-b dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link href="/smeta-trainer/drawings-practice" className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400">
            ← К чертежам
          </Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              📐 Уровень 4 — Продвинутые объёмы
            </h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Кровля с уклоном · Фасад · Лестница · {done.size}/{ADV_EXERCISES.length} пройдено
            </p>
          </div>
        </div>
      </header>

      <div className="bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-200 dark:border-indigo-800 px-4 py-2 text-xs text-indigo-800 dark:text-indigo-300">
        💡 На этом уровне объёмы не всегда очевидны: уклон, разные грани, вычет проёмов на фасаде.
      </div>

      {allDone ? (
        <div className="max-w-2xl mx-auto py-16 text-center px-4">
          <div className="text-6xl mb-4">🏗️</div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Продвинутый уровень пройден!</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
            Теперь вы умеете считать кровлю с поправкой на уклон, фасад за вычетом окон
            и площадь ступеней по граням — это уже уровень проектировщика (Уровень 4).
          </p>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4 text-left mb-6 text-xs space-y-2">
            {ADV_EXERCISES.map((e) => (
              <div key={e.id} className="flex gap-2 text-slate-700 dark:text-slate-300">
                <span className="text-emerald-500 shrink-0">✓</span>
                <code className="text-[10px] font-mono">{e.vorRow}</code>
              </div>
            ))}
          </div>
          <div className="flex gap-3 justify-center flex-wrap">
            <button onClick={() => { setExIdx(0); setStepIdx(0); setInputs({}); setRevealed({}); setDone(new Set()); }}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-lg">
              Пройти снова
            </button>
            <Link href="/smeta-trainer/drawings-practice/errors"
              className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700">
              → Найди ошибку в ВОР (уровень 5)
            </Link>
          </div>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Drawing */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
              {ex.view === "roof" ? "📐 Разрез кровли / марша" : "📐 Фасад"}
            </div>
            {ex.view === "roof" ? <RoofSVG highlight={hl} /> : <FacadeSVG highlight={hl} />}
            {ex.theory && (
              <div className="mt-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded p-2 text-[10px] text-indigo-800 dark:text-indigo-300">
                📖 {ex.theory}
              </div>
            )}
          </div>

          {/* Exercise */}
          <div className="space-y-3">
            <div className="flex gap-1">
              {ADV_EXERCISES.map((e, i) => (
                <button key={e.id} onClick={() => { setExIdx(i); setStepIdx(0); setInputs({}); setRevealed({}); }}
                  className={`text-[10px] px-2 py-1 rounded font-semibold transition-colors ${
                    i === exIdx ? "bg-indigo-600 text-white"
                      : done.has(e.id) ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 hover:bg-slate-200"
                  }`}>
                  {done.has(e.id) ? "✓ " : ""}{i + 1}
                </button>
              ))}
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">{ex.title}</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">{ex.question}</p>

              {ex.steps.length > 1 && (
                <div className="flex gap-1 mb-3">
                  {ex.steps.map((_, i) => (
                    <div key={i} className={`h-1 flex-1 rounded-full ${
                      i < stepIdx ? "bg-indigo-500" : i === stepIdx ? "bg-indigo-300" : "bg-slate-200 dark:bg-slate-700"
                    }`} />
                  ))}
                </div>
              )}

              {!done.has(ex.id) ? (
                <div className={`border-2 rounded-lg p-3 ${
                  isCorrect ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20"
                    : isWrong ? "border-red-300 bg-red-50 dark:bg-red-900/20"
                      : "border-slate-200 dark:border-slate-700"
                }`}>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Шаг {stepIdx + 1}/{ex.steps.length}: {step.label}
                  </label>
                  <div className="flex gap-2">
                    <input type="text"
                      value={inputs[key] ?? ""}
                      onChange={(e) => setInputs((p) => ({ ...p, [key]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && !revealed[key] && handleCheck()}
                      disabled={!!revealed[key]}
                      placeholder="Введите число..."
                      className="flex-1 border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                    />
                    {!revealed[key] && (
                      <button onClick={handleCheck} disabled={!inputs[key]?.trim()}
                        className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded hover:bg-indigo-700 disabled:opacity-40">✓</button>
                    )}
                  </div>
                  {revealed[key] && (
                    <div className={`mt-2 text-xs leading-relaxed ${isCorrect ? "text-emerald-800 dark:text-emerald-300" : "text-red-800 dark:text-red-300"}`}>
                      {isCorrect ? "✓ " : "✗ "}{step.explanation}
                    </div>
                  )}
                  {isWrong && (
                    <button onClick={() => { setInputs((p) => ({ ...p, [key]: "" })); setRevealed((r) => ({ ...r, [key]: false })); }}
                      className="mt-1.5 text-[10px] text-amber-700 underline">Попробовать снова</button>
                  )}
                </div>
              ) : (
                <div className="border-2 border-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3">
                  <div className="text-xs font-bold text-indigo-800 dark:text-indigo-300 mb-2">✓ Завершено</div>
                  <code className="text-[10px] font-mono text-indigo-700 dark:text-indigo-400 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 rounded p-2 block leading-relaxed">
                    📋 {ex.vorRow}
                  </code>
                </div>
              )}
            </div>

            {done.has(ex.id) && exIdx + 1 < ADV_EXERCISES.length && (
              <button onClick={() => { setExIdx(exIdx + 1); setStepIdx(0); setInputs({}); setRevealed({}); }}
                className="w-full py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700">
                Следующее →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
