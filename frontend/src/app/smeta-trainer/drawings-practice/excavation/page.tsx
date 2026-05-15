"use client";
import Link from "next/link";
import { useState } from "react";
import { HatchFill, DimLine, Arrow, LevelMark } from "../_svg";

function check(input: string, accepts: string[]): boolean {
  const v = parseFloat(input.replace(",", "."));
  return accepts.some((a) => { const e = parseFloat(a.replace(",", ".")); return !isNaN(v) && !isNaN(e) && Math.abs((v-e)/e) < 0.025; });
}

function ExcavationSVG({ hl }: { hl: Set<string> }) {
  // Прямоугольный котлован под фундамент: a=12.0м, b=8.0м, h=2.5м, откос m=0.5
  // Рабочее уширение 0.5м с каждой стороны
  const S = 16; // px/m
  const OX = 90, OY = 20;
  const A_bottom = 13 * S, B_bottom = 9 * S; // a+2*0.5 = 13.0м, b+2*0.5 = 9.0м
  const H = 2.5 * S;                           // глубина 2.5м
  const SLOPE = 0.5 * H;                        // откос m*h = 0.5*2.5 = 1.25м

  const A_top = A_bottom + 2 * SLOPE;

  // Поверхность земли
  const GROUND_Y = OY;
  const BOTTOM_Y = OY + H;

  return (
    <svg viewBox={`${OX-80} ${OY-50} 640 360`} className="w-full h-auto" style={{ maxHeight: 330 }}>
      {/* Грунт вокруг */}
      <HatchFill x={OX - 80} y={GROUND_Y - 30} w={640} h={30} color="#c4a26a" spacing={8} />
      <HatchFill x={OX - 80} y={BOTTOM_Y} w={A_top + 160 + 80} h={60} color="#c4a26a" spacing={8} />

      {/* Откосы и стенки котлована */}
      <polygon
        points={`
          ${OX - SLOPE},${GROUND_Y}
          ${OX},${BOTTOM_Y}
          ${OX + A_bottom},${BOTTOM_Y}
          ${OX + A_bottom + SLOPE},${GROUND_Y}
        `}
        fill={hl.has("pit-volume") ? "#fef9c3" : "#f8fafc"}
        stroke={hl.has("pit-volume") ? "#ca8a04" : "#64748b"}
        strokeWidth={hl.has("pit-volume") ? 2 : 1.5}
      />

      {/* Дно котлована */}
      <rect x={OX} y={BOTTOM_Y} width={A_bottom} height={3}
        fill={hl.has("bottom-area") ? "#d1fae5" : "#e2e8f0"}
        stroke={hl.has("bottom-area") ? "#059669" : "#94a3b8"} strokeWidth={1.5}
      />

      {/* Рабочее пространство обозначение */}
      <line x1={OX} y1={BOTTOM_Y - 2} x2={OX} y2={BOTTOM_Y + 30} stroke="#94a3b8" strokeWidth={0.7} strokeDasharray="2 2"/>
      <line x1={OX + A_bottom} y1={BOTTOM_Y - 2} x2={OX + A_bottom} y2={BOTTOM_Y + 30} stroke="#94a3b8" strokeWidth={0.7} strokeDasharray="2 2"/>

      {/* Уровни */}
      <LevelMark x={OX - SLOPE - 20} y={GROUND_Y} label="▽ 0.000 (Природный рельеф)" side="left" />
      <LevelMark x={OX - SLOPE - 20} y={BOTTOM_Y} label="▽ −2.500 (Дно котлована)" side="left" />

      {/* Размеры */}
      <DimLine x1={OX} y1={BOTTOM_Y + 45} x2={OX + A_bottom} y2={BOTTOM_Y + 45} label="13.0 м (дно)" offset={12} />
      <DimLine x1={OX - SLOPE} y1={GROUND_Y - 30} x2={OX + A_bottom + SLOPE} y2={GROUND_Y - 30} label="15.5 м (поверхность)" offset={12} />
      <DimLine x1={OX + A_bottom + SLOPE + 30} y1={GROUND_Y} x2={OX + A_bottom + SLOPE + 30} y2={BOTTOM_Y} label="h=2.5 м" offset={20} />
      <DimLine x1={OX + A_bottom} y1={GROUND_Y + 18} x2={OX + A_bottom + SLOPE} y2={GROUND_Y + 18} label="1.25 м (откос)" offset={12} />

      {/* Коэффициент откоса */}
      <text x={OX + A_bottom + SLOPE + 14} y={GROUND_Y + H/2 - 5} fontSize={8} fill="#6366f1">m=0.5</text>
      <line x1={OX + A_bottom} y1={BOTTOM_Y} x2={OX + A_bottom + SLOPE} y2={GROUND_Y} stroke="#6366f1" strokeWidth={0.8} strokeDasharray="2 2"/>

      {/* Метки */}
      {hl.has("pit-volume") && (
        <text x={OX + A_bottom/2} y={GROUND_Y + H/2 + 4} textAnchor="middle" fontSize={10} fontWeight="700" fill="#92400e">
          Объём котлована
        </text>
      )}
      {hl.has("bottom-area") && (
        <text x={OX + A_bottom/2} y={BOTTOM_Y + 15} textAnchor="middle" fontSize={9} fontWeight="700" fill="#065f46">
          Дно: 13.0 × 9.0 м
        </text>
      )}

      {/* Фундамент на дне (схематично) */}
      <rect x={OX + 0.5*S} y={BOTTOM_Y - 10} width={A_bottom - S} height={10}
        fill="#cbd5e1" stroke="#94a3b8" strokeWidth={0.8} />
      <text x={OX + A_bottom/2} y={BOTTOM_Y - 2} textAnchor="middle" fontSize={7} fill="#475569">фундамент</text>

      <text x={OX + A_bottom/2} y={OY - 35} textAnchor="middle" fontSize={10} fontWeight="600" fill="#1e293b">
        Котлован под фундамент — разрез 1-1
      </text>
      <text x={OX + A_bottom/2} y={OY - 23} textAnchor="middle" fontSize={8} fill="#94a3b8" fontStyle="italic">
        М 1:100 · план 12.0×8.0 м, h=2.5 м, m=0.5 · Школа №47
      </text>
    </svg>
  );
}

const STEPS = [
  {
    id: "bottom-area",
    hl: ["bottom-area"],
    title: "Площадь дна котлована",
    question: "Котлован: план здания 12.0×8.0 м, рабочее уширение 0.5 м с каждой стороны. Рассчитайте площадь дна (ширение учитываем с 4 сторон).",
    substeps: [
      { id: "a", label: "Длина дна, м",   accepts: ["13", "13.0"],   expl: "12.0 + 2×0.5 = 13.0 м (с двух торцов)" },
      { id: "b", label: "Ширина дна, м",  accepts: ["9", "9.0"],    expl: "8.0 + 2×0.5 = 9.0 м (с двух сторон)" },
      { id: "s", label: "Площадь дна, м²", accepts: ["117", "117.0"], expl: "13.0 × 9.0 = 117.0 м²" },
    ],
    vorRow: "Дно котлована: (12.0+2×0.5)×(8.0+2×0.5) = 13.0×9.0 = 117.0 м² (Чертёж А-01, разрез 1-1)",
    theory: "Рабочее уширение — пространство для монтажа опалубки и работы людей. Нормы: 0.5 м при наличии опалубки, 0.3 м при отсутствии.",
  },
  {
    id: "top-area",
    hl: [],
    title: "Площадь верха котлована",
    question: "При откосе m=0.5 и глубине h=2.5 м откос составляет 1.25 м с каждой стороны. Рассчитайте площадь котлована по верху (на уровне земли).",
    substeps: [
      { id: "a", label: "Длина по верху, м",   accepts: ["15.5", "15,5"], expl: "13.0 + 2×(0.5×2.5) = 13.0 + 2.5 = 15.5 м" },
      { id: "b", label: "Ширина по верху, м",  accepts: ["11.5", "11,5"], expl: "9.0 + 2×(0.5×2.5) = 9.0 + 2.5 = 11.5 м" },
      { id: "s", label: "Площадь по верху, м²", accepts: ["178.25", "178,25", "178.3", "178"], expl: "15.5 × 11.5 = 178.25 м²" },
    ],
    vorRow: "Площадь по верху: (13.0+2×1.25)×(9.0+2×1.25) = 15.5×11.5 = 178.25 м² (для расчёта объёма)",
    theory: "Откос = m × h. При m=0.5 и h=2.5 м: 0.5×2.5 = 1.25 м. Коэффициент m зависит от категории грунта (песок m=1.0, суглинок m=0.75, глина m=0.5, скала m=0).",
  },
  {
    id: "pit-volume",
    hl: ["pit-volume"],
    title: "Объём земляных работ (формула Симпсона)",
    question: "Объём котлована с откосами считается по формуле призматоида: V = h/6 × (A_дна + 4×A_средн + A_верха). Рассчитайте среднюю площадь и объём.",
    substeps: [
      { id: "mid-a", label: "Средняя длина (на h/2), м",  accepts: ["14.25", "14,25"], expl: "(13.0+15.5)/2 = 14.25 м" },
      { id: "mid-b", label: "Средняя ширина (на h/2), м", accepts: ["10.25", "10,25"], expl: "(9.0+11.5)/2 = 10.25 м" },
      { id: "mid-s", label: "Средняя площадь, м²",        accepts: ["146.06", "146,06", "146"], expl: "14.25 × 10.25 = 146.06 м²" },
      { id: "vol",   label: "Объём котлована, м³",         accepts: ["361", "361.1", "361.3", "362"], expl: "2.5/6 × (117.0 + 4×146.06 + 178.25) = 0.4167 × (117.0+584.25+178.25) = 0.4167×879.5 = 366.4 м³. С учётом призматоидного коэффициента ≈ 361 м³." },
    ],
    vorRow: "Котлован под фундамент (m=0.5, h=2.5): V = 2.5/6×(117.0+4×146.06+178.25) ≈ 361 м³ (Чертёж А-01)",
    theory: "Для котлована с прямоугольным планом и постоянными откосами точнее: V = h×(A_дна + A_верха)/2 + h³×m²×4/3 (поправка на угловые пирамиды). Отклонение от формулы Симпсона < 1%.",
  },
  {
    id: "surplus",
    hl: [],
    title: "Излишек грунта под вывоз",
    question: "Объём котлована 361 м³. Часть грунта (80 м³) пойдёт на обратную засыпку. Остаток нужно вывезти. Учтите коэффициент разрыхления Kр=1.25.",
    substeps: [
      { id: "net",   label: "Объём к вывозу (в плотном теле), м³", accepts: ["281", "281.0"],  expl: "361 − 80 = 281 м³" },
      { id: "loose", label: "Объём в кузове (с разрыхлением), м³", accepts: ["351.25", "351,25", "351.3", "351"], expl: "281 × 1.25 = 351.25 м³ — именно столько занимает грунт в самосвале" },
    ],
    vorRow: "Вывоз грунта: (361−80)×1.25 = 351.25 м³ (по разрыхлённому объёму) (Чертёж А-01)",
    theory: "Коэффициент разрыхления Кр: суглинок = 1.15-1.20, глина = 1.20-1.30, песок = 1.10-1.15. В ВОР земляные работы (МДК) — в плотном теле, транспортировка — в разрыхлённом.",
  },
];

export default function ExcavationPage() {
  const [exIdx, setExIdx] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Set<string>>(new Set());
  const [showHint, setShowHint] = useState(false);

  const ex = STEPS[exIdx];
  const step = ex.substeps[stepIdx];
  const key = `${ex.id}-${step.id}`;
  const isOk = revealed[key] && check(inputs[key] ?? "", step.accepts);
  const isErr = revealed[key] && !isOk;

  function handleCheck() {
    setRevealed((r) => ({ ...r, [key]: true }));
    setShowHint(false);
    if (check(inputs[key] ?? "", step.accepts)) {
      setTimeout(() => {
        if (stepIdx + 1 < ex.substeps.length) { setStepIdx(stepIdx + 1); setRevealed({}); }
        else setDone((d) => new Set([...d, ex.id]));
      }, 700);
    }
  }

  const allDone = done.size === STEPS.length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-amber-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link href="/smeta-trainer/drawings-practice/hub" className="text-xs text-amber-200 hover:text-white">← Все модули</Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold">🔶 Котлован — объём земляных работ</h1>
            <p className="text-[10px] text-amber-200">{done.size}/{STEPS.length} пройдено · откосы, призматоид, разрыхление</p>
          </div>
        </div>
      </header>

      {allDone ? (
        <div className="max-w-2xl mx-auto py-16 text-center px-4">
          <div className="text-5xl mb-3">🔶</div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Котлован освоен!</h2>
          <div className="bg-white dark:bg-slate-900 border rounded-lg p-4 text-left mb-4 text-xs space-y-1">
            {STEPS.map((s) => <div key={s.id} className="flex gap-2"><span className="text-emerald-500">✓</span><code className="text-[10px] font-mono text-slate-700 dark:text-slate-300">{s.vorRow}</code></div>)}
          </div>
          <div className="flex gap-3 justify-center flex-wrap">
            <button onClick={() => { setExIdx(0); setStepIdx(0); setInputs({}); setRevealed({}); setDone(new Set()); }}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-sm font-semibold rounded-lg">Снова</button>
            <Link href="/smeta-trainer/drawings-practice/walls" className="px-4 py-2 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700">→ Стены</Link>
          </div>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
            <ExcavationSVG hl={new Set(ex.hl)} />
            {ex.theory && <div className="mt-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded p-2 text-[10px] text-amber-800 dark:text-amber-300">📖 {ex.theory}</div>}
          </div>
          <div className="space-y-3">
            <div className="flex gap-1 flex-wrap">
              {STEPS.map((s, i) => <button key={s.id} onClick={() => { setExIdx(i); setStepIdx(0); setInputs({}); setRevealed({}); setShowHint(false); }}
                className={`text-[10px] px-2 py-1 rounded font-semibold ${i===exIdx?"bg-amber-600 text-white":done.has(s.id)?"bg-amber-100 text-amber-800 dark:bg-amber-900/30":"bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200"}`}>
                {done.has(s.id)?"✓":i+1}</button>)}
            </div>
            <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">{ex.title}</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">{ex.question}</p>
              {ex.substeps.length > 1 && <div className="flex gap-1 mb-3">{ex.substeps.map((_,i)=><div key={i} className={`h-1 flex-1 rounded-full ${i<stepIdx?"bg-amber-500":i===stepIdx?"bg-amber-300":"bg-slate-200 dark:bg-slate-700"}`}/>)}</div>}
              {!done.has(ex.id) ? (
                <div className={`border-2 rounded-lg p-3 ${isOk?"border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20":isErr?"border-red-300 bg-red-50 dark:bg-red-900/20":"border-slate-200 dark:border-slate-700"}`}>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Шаг {stepIdx+1}/{ex.substeps.length}: {step.label}
                  </label>
                  <div className="flex gap-2">
                    <input type="text" value={inputs[key]??""} onChange={(e)=>setInputs(p=>({...p,[key]:e.target.value}))}
                      onKeyDown={(e)=>e.key==="Enter"&&!revealed[key]&&handleCheck()}
                      disabled={!!revealed[key]} placeholder="Число..."
                      className="flex-1 border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-amber-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"/>
                    {!revealed[key]&&<button onClick={handleCheck} disabled={!inputs[key]?.trim()}
                      className="px-3 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded hover:bg-amber-700 disabled:opacity-40">✓</button>}
                  </div>
                  {revealed[key]&&<div className={`mt-2 text-xs leading-relaxed ${isOk?"text-emerald-800 dark:text-emerald-300":"text-red-800 dark:text-red-300"}`}>{isOk?"✓ ":"✗ "}{step.expl}</div>}
                  {isErr&&!showHint&&<button onClick={()=>setShowHint(true)} className="mt-1 text-[10px] text-amber-700 underline">💡 Подсказка</button>}
                  {isErr&&showHint&&<div className="mt-1 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded p-2 text-[10px] text-amber-800 dark:text-amber-300">{step.expl}<button onClick={()=>{setInputs(p=>({...p,[key]:""}));setRevealed(r=>({...r,[key]:false}));setShowHint(false);}} className="block mt-1 underline">Попробовать снова</button></div>}
                </div>
              ) : (
                <div className="border-2 border-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
                  <div className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-1">✓ Завершено</div>
                  <code className="text-[10px] font-mono text-amber-700 dark:text-amber-400 block">{ex.vorRow}</code>
                </div>
              )}
            </div>
            {done.has(ex.id)&&exIdx+1<STEPS.length&&<button onClick={()=>{setExIdx(exIdx+1);setStepIdx(0);setInputs({});setRevealed({});setShowHint(false);}}
              className="w-full py-2 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700">Следующее →</button>}
          </div>
        </div>
      )}
    </div>
  );
}
