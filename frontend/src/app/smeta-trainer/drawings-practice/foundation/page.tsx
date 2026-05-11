"use client";

import Link from "next/link";
import { useState } from "react";
import { saveDrawingsProgress } from "../../lib/useDrawingsProgress";

// ── Допуск ±2% ───────────────────────────────────────────────────────────────
function check(input: string, accepts: string[]): boolean {
  const v = parseFloat(input.trim().replace(",", "."));
  return accepts.some((a) => {
    const e = parseFloat(a.replace(",", "."));
    return !isNaN(v) && !isNaN(e) && Math.abs((v - e) / e) < 0.025;
  });
}

// ── SVG: Разрез фундамента ───────────────────────────────────────────────────

function FoundationSVG({ highlight }: { highlight: Set<string> }) {
  const OX = 70, OY = 20;
  const S = 26; // scale (px per 100mm)

  // Ленточный ж/б фундамент: подошва 900 мм, стена 600 мм, высота 800 мм
  // Подошва: 900 мм wide, 200 мм high
  // Тело: 600 мм wide, 600 мм high
  const FW_SHOE = 9 * S, FH_SHOE = 2 * S; // подошва
  const FW_BODY = 6 * S, FH_BODY = 6 * S; // тело
  const SHOE_Y = OY + FH_BODY;
  const SHOE_X = OX - (FW_SHOE - FW_BODY) / 2;

  // Обратная засыпка (слева)
  const BACKFILL_W = 40;

  // Гидроизоляция под подошвой
  const GI_H = 4;

  return (
    <svg viewBox={`${OX - 80} ${OY - 30} 560 340`} className="w-full h-auto" style={{ maxHeight: 320 }}>
      {/* Обратная засыпка */}
      <rect x={SHOE_X - BACKFILL_W} y={OY} width={BACKFILL_W} height={FH_BODY + FH_SHOE}
        fill="#fef9c3" stroke="#ca8a04" strokeWidth={0.5} strokeDasharray="2 2" />
      <text x={SHOE_X - BACKFILL_W / 2} y={OY + FH_BODY / 2} textAnchor="middle"
        fontSize="7" fill="#92400e" transform={`rotate(-90, ${SHOE_X - BACKFILL_W / 2}, ${OY + FH_BODY / 2})`}>
        обратная засыпка
      </text>

      {/* Гидроизоляция под подошвой */}
      <rect x={SHOE_X} y={SHOE_Y + FH_SHOE} width={FW_SHOE} height={GI_H}
        fill={highlight.has("gi-under") ? "#a7f3d0" : "#d1d5db"}
        stroke={highlight.has("gi-under") ? "#059669" : "#9ca3af"}
        strokeWidth={highlight.has("gi-under") ? 1.5 : 0.8}
      />

      {/* Подошва фундамента */}
      <rect x={SHOE_X} y={SHOE_Y} width={FW_SHOE} height={FH_SHOE}
        id="foundation-shoe"
        fill={highlight.has("foundation-shoe") ? "#bfdbfe" : "#e2e8f0"}
        stroke={highlight.has("foundation-shoe") ? "#2563eb" : "#64748b"}
        strokeWidth={highlight.has("foundation-shoe") ? 2 : 1.5}
      />
      {/* Штриховка бетона подошвы */}
      {[0, 1, 2, 3, 4].map((i) => (
        <line key={i} x1={SHOE_X + i * 24} y1={SHOE_Y} x2={SHOE_X + i * 24 - 10} y2={SHOE_Y + FH_SHOE}
          stroke="#94a3b8" strokeWidth={0.5} />
      ))}

      {/* Тело фундамента */}
      <rect x={OX} y={OY} width={FW_BODY} height={FH_BODY}
        id="foundation-body"
        fill={highlight.has("foundation-body") ? "#bfdbfe" : "#e2e8f0"}
        stroke={highlight.has("foundation-body") ? "#2563eb" : "#64748b"}
        strokeWidth={highlight.has("foundation-body") ? 2 : 1.5}
      />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <line key={i} x1={OX + i * 22} y1={OY} x2={OX + i * 22 - 10} y2={OY + FH_BODY}
          stroke="#94a3b8" strokeWidth={0.5} />
      ))}

      {/* Гидроизоляция боковая */}
      <rect x={OX + FW_BODY} y={OY} width={4} height={FH_BODY}
        fill={highlight.has("gi-side") ? "#a7f3d0" : "#d1fae5"}
        stroke={highlight.has("gi-side") ? "#059669" : "#a7f3d0"}
        strokeWidth={highlight.has("gi-side") ? 1.5 : 0.8}
      />

      {/* Арматура (условно) */}
      {[1, 2, 3].map((i) => (
        <circle key={i} cx={SHOE_X + i * (FW_SHOE / 4)} cy={SHOE_Y + FH_SHOE - 10}
          r={4} fill="#9ca3af" stroke="#6b7280" strokeWidth={1} />
      ))}
      {[1, 2].map((i) => (
        <circle key={i} cx={OX + i * (FW_BODY / 3)} cy={OY + 10}
          r={4} fill="#9ca3af" stroke="#6b7280" strokeWidth={1} />
      ))}

      {/* Размеры */}
      {/* Ширина подошвы */}
      <line x1={SHOE_X} y1={SHOE_Y + FH_SHOE + GI_H + 18} x2={SHOE_X + FW_SHOE} y2={SHOE_Y + FH_SHOE + GI_H + 18}
        stroke="#94a3b8" strokeWidth={0.8} />
      <text x={SHOE_X + FW_SHOE / 2} y={SHOE_Y + FH_SHOE + GI_H + 30} textAnchor="middle"
        fontSize="9" fill="#475569" fontStyle="italic">900 мм</text>

      {/* Ширина тела */}
      <line x1={OX} y1={OY - 18} x2={OX + FW_BODY} y2={OY - 18}
        stroke="#94a3b8" strokeWidth={0.8} />
      <text x={OX + FW_BODY / 2} y={OY - 6} textAnchor="middle"
        fontSize="9" fill="#475569" fontStyle="italic">600 мм</text>

      {/* Высота тела */}
      <line x1={OX - 35} y1={OY} x2={OX - 35} y2={OY + FH_BODY}
        stroke="#94a3b8" strokeWidth={0.8} />
      <text x={OX - 22} y={OY + FH_BODY / 2 + 4} textAnchor="middle"
        fontSize="9" fill="#475569" fontStyle="italic"
        transform={`rotate(-90, ${OX - 22}, ${OY + FH_BODY / 2 + 4})`}>
        600 мм
      </text>

      {/* Высота подошвы */}
      <line x1={OX + FW_BODY + 40} y1={SHOE_Y} x2={OX + FW_BODY + 40} y2={SHOE_Y + FH_SHOE}
        stroke="#94a3b8" strokeWidth={0.8} />
      <text x={OX + FW_BODY + 55} y={SHOE_Y + FH_SHOE / 2 + 4} textAnchor="middle"
        fontSize="9" fill="#475569" fontStyle="italic"
        transform={`rotate(-90, ${OX + FW_BODY + 55}, ${SHOE_Y + FH_SHOE / 2 + 4})`}>
        200 мм
      </text>

      {/* Обозначения */}
      <text x={OX + FW_BODY + 70} y={OY + FH_BODY / 2 + 4} fontSize="8" fill="#475569">ФЛ-1 (монолит)</text>
      <text x={OX + FW_BODY + 70} y={SHOE_Y + FH_SHOE / 2 + 4} fontSize="8" fill="#475569">Подошва 200 мм</text>
      {highlight.has("gi-side") && (
        <text x={OX + FW_BODY + 8} y={OY + FH_BODY / 2 + 4} fontSize="7" fill="#059669">
          Г/И
        </text>
      )}
      {highlight.has("gi-under") && (
        <text x={SHOE_X + FW_SHOE / 2} y={SHOE_Y + FH_SHOE + GI_H + 10} textAnchor="middle"
          fontSize="8" fill="#059669" fontWeight="700">Г/И подошвы</text>
      )}

      <text x={OX + FW_BODY / 2} y={OY - 25} textAnchor="middle"
        fontSize="10" fontWeight="600" fill="#334155">
        Разрез 3-3 · Фундамент ленточный
      </text>
      <text x={OX + FW_BODY / 2} y={OY - 14} textAnchor="middle"
        fontSize="8" fill="#94a3b8" fontStyle="italic">
        М 1:20 · Школа №47
      </text>
    </svg>
  );
}

// ── Упражнения ────────────────────────────────────────────────────────────────

const EXERCISES = [
  {
    id: "f-body-volume",
    highlight: ["foundation-body"],
    title: "Объём тела фундамента (ФЛ-1)",
    question: "Периметр фундамента по средней оси — 48.0 м. По разрезу видно сечение тела: 0.60×0.60 м. Рассчитайте объём бетона тела фундамента (без учёта подошвы).",
    steps: [
      { id: "section", label: "Площадь сечения тела, м²", accepts: ["0.36", "0,36"], explanation: "0.60 м × 0.60 м = 0.36 м²" },
      { id: "length",  label: "Длина по оси без угловых задвоений, м", accepts: ["46.8", "46,8", "47"], explanation: "Периметр 48.0 м − 4 угла × 0.30 м (половина ширины) = 48.0 − 1.2 = 46.8 м. На каждом углу вычитаем половину ширины тела с одной стороны." },
      { id: "volume",  label: "Объём бетона тела, м³", accepts: ["16.85", "16,85", "16.9", "16.85", "16.848"], explanation: "0.36 × 46.8 = 16.85 м³" },
    ],
    vorRow: "Бетон В20 тело ФЛ-1: 0.60×0.60×46.8 м = 16.85 м³ (Чертёж А-11, разрез 3-3)",
    theory: "Угловые пересечения: при расчёте длины по оси из каждого угла вычитаем по одному полурасстоянию. Для прямоугольного контура без внутренних стен: L = Периметр − 4 × (B/2). Для B=0.6 м: −4×0.3 = −1.2 м.",
  },
  {
    id: "f-shoe-area",
    highlight: ["foundation-shoe"],
    title: "Площадь гидроизоляции под подошвой",
    question: "Подошва фундамента: ширина 0.90 м. Длина по нейтральной оси (уже с учётом углов): 48.2 м. Гидроизоляция кладётся на всю ширину подошвы.",
    steps: [
      { id: "area",   label: "Площадь гидроизоляции под подошвой, м²", accepts: ["43.38", "43,38", "43.4", "43,4"], explanation: "0.90 м × 48.2 м = 43.38 м². Ширина берётся из разреза: 900 мм = 0.90 м." },
    ],
    vorRow: "Г/И под подошвой ФЛ-1: 0.90 × 48.2 = 43.38 м² (Чертёж А-11, разрез 3-3)",
    theory: "Гидроизоляция подошвы — отдельная позиция от гидроизоляции стен фундамента. Длина берётся по НАРУЖНОЙ оси подошвы (она шире тела), не по средней оси тела.",
  },
  {
    id: "f-gi-side",
    highlight: ["gi-side"],
    title: "Площадь боковой гидроизоляции тела",
    question: "Боковая гидроизоляция тела фундамента: 2 стороны × высота 0.60 м × длина 46.8 м. Считается по вертикальной поверхности без подошвы.",
    steps: [
      { id: "sides",  label: "Площадь одной стороны, м²", accepts: ["28.08", "28,08", "28.1", "28,1"], explanation: "1.0 × 0.60 × 46.8 = 28.08 м² (одна сторона: высота × длина)" },
      { id: "total",  label: "Итого обе стороны, м²", accepts: ["56.16", "56,16", "56.2", "56"], explanation: "2 × 28.08 = 56.16 м² (оклеечная г/и наносится с двух сторон тела)" },
    ],
    vorRow: "Г/И боковая тела ФЛ-1: 2 × 0.60 × 46.8 = 56.16 м² (Чертёж А-11, разрез 3-3)",
    theory: "Боковая гидроизоляция наносится на вертикальные грани тела фундамента. Вычитать углы не надо (продольные стороны стыкуются вертикально). Высота = от подошвы до верха тела.",
  },
];

// ── Компонент ────────────────────────────────────────────────────────────────

export default function FoundationPage() {
  const [exIdx, setExIdx] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Set<string>>(new Set());
  const [showHint, setShowHint] = useState(false);

  const ex = EXERCISES[exIdx];
  const step = ex.steps[stepIdx];
  const key = `${ex.id}-${step.id}`;
  const isCorrect = revealed[key] && check(inputs[key] ?? "", step.accepts);
  const isWrong   = revealed[key] && !isCorrect;

  function handleCheck() {
    setRevealed((r) => ({ ...r, [key]: true }));
    setShowHint(false);
    if (check(inputs[key] ?? "", step.accepts)) {
      setTimeout(() => {
        if (stepIdx + 1 < ex.steps.length) {
          setStepIdx(stepIdx + 1);
          setRevealed({});
        } else {
          setDone((d) => {
            const next = new Set([...d, ex.id]);
            saveDrawingsProgress({ advancedDone: next.size, advancedTotal: EXERCISES.length });
            return next;
          });
        }
      }, 800);
    }
  }

  const allDone = done.size === EXERCISES.length;
  const hl = new Set(ex.highlight);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-white dark:bg-slate-900 border-b dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link href="/smeta-trainer/drawings-practice/advanced" className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400">
            ← L4 Продвинутый
          </Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              📐 Фундамент: объёмы по разрезу
            </h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Школа №47 · ленточный ж/б фундамент · {done.size}/{EXERCISES.length} пройдено
            </p>
          </div>
        </div>
      </header>

      {allDone ? (
        <div className="max-w-2xl mx-auto py-16 text-center px-4">
          <div className="text-5xl mb-3">🏗</div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Фундамент освоен!</h2>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4 text-left mb-4 text-xs space-y-2">
            {EXERCISES.map((e) => (
              <div key={e.id} className="flex gap-2 text-slate-700 dark:text-slate-300">
                <span className="text-emerald-500 shrink-0">✓</span>
                <code className="text-[10px] font-mono">{e.vorRow}</code>
              </div>
            ))}
          </div>
          <Link href="/smeta-trainer/drawings-practice/advanced"
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700">
            ← Назад к продвинутым
          </Link>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <div className="text-xs font-bold text-slate-500 uppercase mb-2">📐 Разрез 3-3 — Фундамент ленточный ж/б</div>
            <FoundationSVG highlight={hl} />
            {ex.theory && (
              <div className="mt-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-2 text-[10px] text-slate-600 dark:text-slate-400">
                📖 {ex.theory}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex gap-1">
              {EXERCISES.map((e, i) => (
                <button key={e.id} onClick={() => { setExIdx(i); setStepIdx(0); setInputs({}); setRevealed({}); setShowHint(false); }}
                  className={`text-[10px] px-2 py-1 rounded font-semibold ${
                    i === exIdx ? "bg-indigo-600 text-white"
                      : done.has(e.id) ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 hover:bg-slate-200"
                  }`}>
                  {done.has(e.id) ? "✓" : i + 1}
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
                      placeholder="Число..."
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
                  {isWrong && !showHint && (
                    <button onClick={() => setShowHint(true)}
                      className="mt-1 text-[10px] text-amber-700 underline block">
                      💡 Показать подсказку
                    </button>
                  )}
                  {isWrong && showHint && (
                    <div className="mt-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded p-2 text-[10px] text-amber-800 dark:text-amber-300">
                      {step.explanation}
                      <button onClick={() => { setInputs((p) => ({ ...p, [key]: "" })); setRevealed((r) => ({ ...r, [key]: false })); setShowHint(false); }}
                        className="block mt-1 text-amber-700 underline">Попробовать снова</button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="border-2 border-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3">
                  <div className="text-xs font-bold text-indigo-800 dark:text-indigo-300 mb-1">✓ Завершено</div>
                  <code className="text-[10px] font-mono text-indigo-700 dark:text-indigo-400 block">{ex.vorRow}</code>
                </div>
              )}
            </div>

            {done.has(ex.id) && exIdx + 1 < EXERCISES.length && (
              <button onClick={() => { setExIdx(exIdx + 1); setStepIdx(0); setInputs({}); setRevealed({}); setShowHint(false); }}
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
