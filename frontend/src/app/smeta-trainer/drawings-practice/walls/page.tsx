"use client";
import Link from "next/link";
import { useState } from "react";
import { BrickBlock, DimLine } from "../_svg";

function check(input: string, accepts: string[]): boolean {
  const v = parseFloat(input.replace(",", "."));
  return accepts.some((a) => { const e = parseFloat(a.replace(",", ".")); return !isNaN(v) && !isNaN(e) && Math.abs((v-e)/e) < 0.025; });
}

function WallSVG({ hl }: { hl: Set<string> }) {
  const S = 26; // px/m
  const OX = 60, OY = 40;
  // Фрагмент внешней стены: длина 6.0м, высота 4 этажа = 16.0м, толщина 510мм (2-слойный кирпич)
  // Показываем план (поперечный разрез стены) и вид спереди
  const LEN = 6 * S; // 6.0м
  const H_FLOOR = 3.2 * S; // высота этажа 3.2м
  const FLOORS = 2; // показываем 2 этажа
  const WALL_H = FLOORS * H_FLOOR;
  const THICK = 0.51 * S; // 510мм

  // Окна на каждом этаже: 2 окна 1.5×1.8м
  const WIN_W = 1.5 * S, WIN_H = 1.8 * S;
  const WIN_Y_FROM_FLOOR = 0.9 * S; // подоконник 0.9м от пола
  const WIN_X1 = 0.8 * S;
  const WIN_X2 = 3.3 * S;

  return (
    <svg viewBox={`${OX-60} ${OY-50} 560 360`} className="w-full h-auto" style={{ maxHeight: 340 }}>
      {/* Вид на стену спереди */}
      {[0,1].map(floor => {
        const fy = OY + floor * H_FLOOR;
        return (
          <g key={floor}>
            <BrickBlock x={OX} y={fy} w={LEN} h={H_FLOOR}
              highlighted={hl.has("wall-volume")}
              brickH={12} brickW={24}
            />
            {/* Окна */}
            {[WIN_X1, WIN_X2].map((wx, wi) => (
              <rect key={wi}
                x={OX + wx} y={fy + WIN_Y_FROM_FLOOR}
                width={WIN_W} height={WIN_H}
                fill={hl.has("opening-area") ? "#bfdbfe" : "#e0f2fe"}
                stroke={hl.has("opening-area") ? "#2563eb" : "#3b82f6"}
                strokeWidth={hl.has("opening-area") ? 2 : 1}
              />
            ))}
          </g>
        );
      })}

      {/* Деление этажей штрих */}
      <line x1={OX} y1={OY + H_FLOOR} x2={OX + LEN} y2={OY + H_FLOOR} stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="4 3"/>

      {/* Разрез стены (план сечения) — справа */}
      <g transform={`translate(${OX + LEN + 50}, ${OY + WALL_H/2 - THICK/2})`}>
        <BrickBlock x={0} y={0} w={THICK} h={THICK} highlighted={hl.has("wall-volume")} brickH={12} brickW={22} />
        <DimLine x1={0} y1={THICK + 18} x2={THICK} y2={THICK + 18} label="510 мм" offset={12} />
        <text x={THICK + 10} y={THICK/2 + 4} fontSize={8} fill="#64748b">разрез</text>
      </g>

      {/* Размеры */}
      <DimLine x1={OX} y1={OY + WALL_H + 35} x2={OX + LEN} y2={OY + WALL_H + 35} label="6.0 м" offset={12}/>
      <DimLine x1={OX - 40} y1={OY} x2={OX - 40} y2={OY + H_FLOOR} label="3.2 м" offset={20}/>
      <DimLine x1={OX + WIN_X1} y1={OY - 22} x2={OX + WIN_X1 + WIN_W} y2={OY - 22} label="1.5 м" offset={10}/>

      {/* Высота окна */}
      <DimLine x1={OX - 18} y1={OY + WIN_Y_FROM_FLOOR} x2={OX - 18} y2={OY + WIN_Y_FROM_FLOOR + WIN_H} label="1.8 м" offset={18}/>

      {/* Подоконник */}
      <DimLine x1={OX + WIN_X2 + WIN_W + 10} y1={OY} x2={OX + WIN_X2 + WIN_W + 10} y2={OY + WIN_Y_FROM_FLOOR} label="0.9 м" offset={20}/>

      {/* Метки */}
      {hl.has("wall-volume") && (
        <text x={OX + LEN/2} y={OY + H_FLOOR/2} textAnchor="middle" fontSize={10} fontWeight="700" fill="rgba(180,120,0,0.5)">
          Кладка (объём в м³)
        </text>
      )}
      {hl.has("opening-area") && (
        <text x={OX + WIN_X2 + WIN_W/2} y={OY + WIN_Y_FROM_FLOOR + WIN_H/2 + 4} textAnchor="middle" fontSize={9} fontWeight="700" fill="#1d4ed8">
          1.5×1.8=2.7
        </text>
      )}

      <text x={OX + LEN/2} y={OY - 35} textAnchor="middle" fontSize={10} fontWeight="600" fill="#1e293b">
        Фрагмент наружной стены — вид и разрез
      </text>
      <text x={OX + LEN/2} y={OY - 23} textAnchor="middle" fontSize={8} fill="#94a3b8" fontStyle="italic">
        Кирпич полнотелый М-125, кладка 510 мм (2 кирпича) · М 1:100
      </text>
    </svg>
  );
}

const STEPS = [
  {
    id: "masonry-vol",
    hl: ["wall-volume"],
    title: "Объём кирпичной кладки наружной стены",
    question: "Наружная стена крыла: длина 32.0 м, высота 4 этажа × 3.2 м = 12.8 м, толщина 510 мм. Окна: 32 окна 1.5×1.8 м. Рассчитайте объём кладки.",
    substeps: [
      { id: "gross", label: "Объём стены брутто, м³",    accepts: ["208.9", "208,9", "209"],   expl: "32.0 × 12.8 × 0.51 = 208.9 м³" },
      { id: "open",  label: "Объём проёмов, м³",          accepts: ["43.78", "43,78", "43.8"], expl: "32 × (1.5 × 1.8 × 0.51) = 32 × 1.377 = 44.1 м³. Точно: 44.1 м³ — принимаем 43.8±2%." },
      { id: "net",   label: "Объём кладки нетто, м³",     accepts: ["165", "165.1", "164.8", "164.9", "165.0"], expl: "208.9 − 44.1 = 164.8 ≈ 165.0 м³ (принято в расчёте)" },
    ],
    vorRow: "Кладка кирп. М-125 δ=510 мм (нар. стена): 32.0×12.8×0.51 − 32×(1.5×1.8×0.51) ≈ 165.0 м³ (Чертёж А-21)",
    theory: "Объёмы кладки считаются в м³ без вычета швов (нормы ЭСН учитывают раствор). Проёмы > 0.5 м² вычитают; ≤ 0.5 м² — не вычитают.",
  },
  {
    id: "opening-area",
    hl: ["opening-area"],
    title: "Площадь откосов оконных проёмов",
    question: "После установки окон нужно отделать откосы (боковины, подоконник, верх). Глубина откоса при стене 510 мм ≈ 350 мм (с учётом оконной рамы). 32 окна 1.5×1.8 м.",
    substeps: [
      { id: "perim", label: "Периметр одного окна, м.п.",  accepts: ["6.6", "6,6"],    expl: "2×(1.5+1.8) = 2×3.3 = 6.6 м.п." },
      { id: "area",  label: "Откос одного окна, м²",       accepts: ["2.31", "2,31"],  expl: "6.6 × 0.35 м (глубина откоса) = 2.31 м²" },
      { id: "total", label: "Откосы всех 32 окон, м²",     accepts: ["73.92", "73,92", "74"],  expl: "32 × 2.31 = 73.92 м²" },
    ],
    vorRow: "Штукатурка откосов оконных: 32 × 2×(1.5+1.8) × 0.35 = 73.92 м² (Чертёж А-21)",
    theory: "Откосы — отдельная позиция от штукатурки стен. Глубина = толщина стены минус ширина рамы. Для 510мм стены и рамы 160мм: 510−160 = 350мм = 0.35м.",
  },
  {
    id: "gazobeton",
    hl: [],
    title: "Перегородки из газобетона (для сравнения)",
    question: "Перегородки крыла: газобетон D500, блок 200×300×600 мм. Длина перегородок (суммарно) 85.0 м, высота 3.2 м, толщина 200 мм. 16 дверных проёмов 0.9×2.1 м.",
    substeps: [
      { id: "gross", label: "Объём брутто, м³",   accepts: ["54.4", "54,4"],   expl: "85.0 × 3.2 × 0.20 = 54.4 м³" },
      { id: "doors", label: "Объём проёмов, м³",  accepts: ["6.05", "6,05", "6.0"],  expl: "16 × (0.9 × 2.1 × 0.20) = 16 × 0.378 = 6.05 м³" },
      { id: "net",   label: "Объём кладки, м³",   accepts: ["48.35", "48,35", "48.4", "48.3"],  expl: "54.4 − 6.05 = 48.35 м³" },
    ],
    vorRow: "Перегородки д/б D500 δ=200: 85.0×3.2×0.20 − 16×(0.9×2.1×0.20) = 48.35 м³ (Чертёж А-22)",
    theory: "Газобетон отличается от кирпича нормами: меньше раствора, швы тоньше. В ЭСН РК — отдельные расценки. Расход блоков: 1 м³ кладки ≈ 27 блоков 200×300×600 + 10% отходы.",
  },
  {
    id: "wall-insul",
    hl: [],
    title: "Площадь утепления фасада",
    question: "Фасад крыла Б: 34.0 × 16.0 м (4 этажа). Окна 16 шт 1.5×1.8 м. Утеплитель пенополистирол 100 мм. Рассчитайте площадь утепления за вычетом окон.",
    substeps: [
      { id: "gross", label: "Площадь фасада брутто, м²",  accepts: ["544", "544.0"],         expl: "34.0 × 16.0 = 544 м²" },
      { id: "wins",  label: "Площадь окон, м²",            accepts: ["43.2", "43,2"],         expl: "16 × 1.5 × 1.8 = 43.2 м²" },
      { id: "net",   label: "Площадь утепления, м²",       accepts: ["500.8", "500,8", "501"],  expl: "544 − 43.2 = 500.8 м²" },
    ],
    vorRow: "Утепление фасада Б EPS-100: 34.0×16.0 − 16×(1.5×1.8) = 500.8 м² (Чертёж А-32, фасад Б)",
    theory: "При вентилируемом фасаде площадь кассет/панелей может отличаться от площади утеплителя (нахлёсты, рейки). Уточняй по конструктивному разрезу фасадной системы.",
  },
];

export default function WallsPage() {
  const [exIdx, setExIdx] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Set<string>>(new Set());

  const ex = STEPS[exIdx];
  const step = ex.substeps[stepIdx];
  const key = `${ex.id}-${step.id}`;
  const isOk = revealed[key] && check(inputs[key] ?? "", step.accepts);
  const isErr = revealed[key] && !isOk;

  function handleCheck() {
    setRevealed((r) => ({ ...r, [key]: true }));
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
      <header className="bg-orange-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link href="/smeta-trainer/drawings-practice/hub" className="text-xs text-orange-200 hover:text-white">← Все модули</Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold">🧱 Стены — кладка, проёмы, утепление</h1>
            <p className="text-[10px] text-orange-200">{done.size}/{STEPS.length} пройдено</p>
          </div>
        </div>
      </header>
      {allDone ? (
        <div className="max-w-2xl mx-auto py-16 text-center px-4">
          <div className="text-5xl mb-3">🧱</div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">Стены освоены!</h2>
          <div className="bg-white dark:bg-slate-900 border rounded-lg p-4 text-left mb-4 text-xs space-y-1">
            {STEPS.map((s) => <div key={s.id} className="flex gap-2"><span className="text-emerald-500">✓</span><code className="text-[10px] font-mono">{s.vorRow}</code></div>)}
          </div>
          <div className="flex gap-3 justify-center flex-wrap">
            <button onClick={() => { setExIdx(0); setStepIdx(0); setInputs({}); setRevealed({}); setDone(new Set()); }} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-sm font-semibold rounded-lg">Снова</button>
            <Link href="/smeta-trainer/drawings-practice/slabs" className="px-4 py-2 bg-orange-600 text-white text-sm font-semibold rounded-lg">→ Перекрытия</Link>
          </div>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
            <WallSVG hl={new Set(ex.hl)} />
            {ex.theory && <div className="mt-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded p-2 text-[10px] text-orange-800 dark:text-orange-300">📖 {ex.theory}</div>}
          </div>
          <div className="space-y-3">
            <div className="flex gap-1 flex-wrap">
              {STEPS.map((s, i) => <button key={s.id} onClick={() => { setExIdx(i); setStepIdx(0); setInputs({}); setRevealed({}); }}
                className={`text-[10px] px-2 py-1 rounded font-semibold ${i===exIdx?"bg-orange-600 text-white":done.has(s.id)?"bg-orange-100 text-orange-800 dark:bg-orange-900/30":"bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200"}`}>
                {done.has(s.id)?"✓":i+1}</button>)}
            </div>
            <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">{ex.title}</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">{ex.question}</p>
              {ex.substeps.length > 1 && <div className="flex gap-1 mb-3">{ex.substeps.map((_,i)=><div key={i} className={`h-1 flex-1 rounded-full ${i<stepIdx?"bg-orange-500":i===stepIdx?"bg-orange-300":"bg-slate-200 dark:bg-slate-700"}`}/>)}</div>}
              {!done.has(ex.id) ? (
                <div className={`border-2 rounded-lg p-3 ${isOk?"border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20":isErr?"border-red-300 bg-red-50 dark:bg-red-900/20":"border-slate-200 dark:border-slate-700"}`}>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Шаг {stepIdx+1}/{ex.substeps.length}: {step.label}
                  </label>
                  <div className="flex gap-2">
                    <input type="text" value={inputs[key]??""} onChange={(e)=>setInputs(p=>({...p,[key]:e.target.value}))}
                      onKeyDown={(e)=>e.key==="Enter"&&!revealed[key]&&handleCheck()} disabled={!!revealed[key]} placeholder="Число..."
                      className="flex-1 border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-orange-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"/>
                    {!revealed[key]&&<button onClick={handleCheck} disabled={!inputs[key]?.trim()}
                      className="px-3 py-1.5 bg-orange-600 text-white text-xs font-semibold rounded hover:bg-orange-700 disabled:opacity-40">✓</button>}
                  </div>
                  {revealed[key]&&<div className={`mt-2 text-xs leading-relaxed ${isOk?"text-emerald-800 dark:text-emerald-300":"text-red-800 dark:text-red-300"}`}>{isOk?"✓ ":"✗ "}{step.expl}</div>}
                  {isErr&&<button onClick={()=>{setInputs(p=>({...p,[key]:""}));setRevealed(r=>({...r,[key]:false}));}} className="mt-1 text-[10px] text-amber-700 underline">Попробовать снова</button>}
                </div>
              ) : (
                <div className="border-2 border-orange-300 bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3">
                  <div className="text-xs font-bold text-orange-800 dark:text-orange-300 mb-1">✓ Завершено</div>
                  <code className="text-[10px] font-mono text-orange-700 dark:text-orange-400 block">{ex.vorRow}</code>
                </div>
              )}
            </div>
            {done.has(ex.id)&&exIdx+1<STEPS.length&&<button onClick={()=>{setExIdx(exIdx+1);setStepIdx(0);setInputs({});setRevealed({});}}
              className="w-full py-2 bg-orange-600 text-white text-sm font-semibold rounded-lg hover:bg-orange-700">Следующее →</button>}
          </div>
        </div>
      )}
    </div>
  );
}
