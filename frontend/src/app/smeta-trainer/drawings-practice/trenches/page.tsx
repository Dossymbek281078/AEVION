"use client";
import Link from "next/link";
import { useState } from "react";

function check(i:string,a:string[]){const v=parseFloat(i.replace(",","."));return a.some(x=>{const e=parseFloat(x.replace(",","."));return!isNaN(v)&&!isNaN(e)&&Math.abs((v-e)/e)<0.025;});}

// ── SVG: Разрез траншеи под водопровод ───────────────────────────────────────
function TrenchSVG({hl}:{hl:Set<string>}){
  const OX=90,OY=30;
  const S=60; // px/m — масштаб 1:20
  const PIPE_D=0.3*S; // Ø300мм
  const BED=0.1*S;    // подушка 100мм
  const DEPTH=2.0*S;  // глубина 2.0м
  const TRENCH_W=(0.3+0.8)*S; // ширина 1.1м (Ø300+0.8=1.1)
  const SIDE_SLOPE=0.5*DEPTH; // откос m=0.5 → 1.0м с каждой стороны

  return (
    <svg viewBox={`${OX-90} ${OY-45} 640 380`} className="w-full h-auto" style={{maxHeight:340}}>
      {/* Грунт поверхность */}
      {/* Шттиховка грунта по бокам */}
      {[-1,1].map(side=>(
        <g key={side}>
          {[0,1,2,3,4,5,6,7].map(i=>{
            const y=OY+i*20;
            const innerX=OX+(side<0?-TRENCH_W/2-SIDE_SLOPE*(DEPTH-i*20/S)*0:0);
            return <line key={i} x1={OX+(side<0?-TRENCH_W/2-20:TRENCH_W/2)} y1={y} x2={OX+(side<0?-TRENCH_W/2-60:TRENCH_W/2+60)} y2={y+20} stroke="#c4a26a" strokeWidth={0.6} clipPath={`url(#clip-${side})`}/>;
          })}
        </g>
      ))}

      {/* Стенки и откосы траншеи */}
      <polygon
        points={`
          ${OX-TRENCH_W/2-SIDE_SLOPE},${OY}
          ${OX-TRENCH_W/2},${OY+DEPTH}
          ${OX+TRENCH_W/2},${OY+DEPTH}
          ${OX+TRENCH_W/2+SIDE_SLOPE},${OY}
        `}
        fill={hl.has("trench-vol")?"#fef9c3":"#f8fafc"}
        stroke={hl.has("trench-vol")?"#ca8a04":"#64748b"}
        strokeWidth={hl.has("trench-vol")?2:1.5}
      />

      {/* Песчаная подушка */}
      <rect x={OX-TRENCH_W/2} y={OY+DEPTH-BED} width={TRENCH_W} height={BED}
        fill={hl.has("bed")?"#fde68a":"#fef3c7"}
        stroke={hl.has("bed")?"#f59e0b":"#d97706"} strokeWidth={1.5}/>
      <text x={OX} y={OY+DEPTH-BED/2+3} textAnchor="middle" fontSize={8}
        fill={hl.has("bed")?"#92400e":"#d97706"}>Подушка песч. 100мм</text>

      {/* Труба */}
      <circle cx={OX} cy={OY+DEPTH-BED-PIPE_D/2} r={PIPE_D/2}
        fill={hl.has("pipe")?"#bfdbfe":"#dbeafe"}
        stroke={hl.has("pipe")?"#2563eb":"#3b82f6"} strokeWidth={2}/>
      <text x={OX} y={OY+DEPTH-BED-PIPE_D/2+3} textAnchor="middle" fontSize={8} fill="#1d4ed8">Ø300</text>

      {/* Зона ручной засыпки */}
      <rect x={OX-TRENCH_W/2} y={OY+DEPTH-BED-PIPE_D-0.5*S} width={TRENCH_W} height={0.5*S}
        fill={hl.has("backfill-manual")?"rgba(251,191,36,0.3)":"rgba(200,200,200,0.2)"}
        stroke={hl.has("backfill-manual")?"#f59e0b":"none"} strokeWidth={hl.has("backfill-manual")?1.5:0}/>
      {hl.has("backfill-manual")&&(
        <text x={OX} y={OY+DEPTH-BED-PIPE_D-0.25*S+3} textAnchor="middle" fontSize={8} fill="#92400e">
          ручная засыпка ≥500мм
        </text>
      )}

      {/* Размеры */}
      {/* Ширина по дну */}
      <line x1={OX-TRENCH_W/2} y1={OY+DEPTH+22} x2={OX+TRENCH_W/2} y2={OY+DEPTH+22} stroke="#94a3b8" strokeWidth={0.8}/>
      <text x={OX} y={OY+DEPTH+34} textAnchor="middle" fontSize={9} fill="#475569" fontStyle="italic">1.1 м (по дну)</text>
      {/* Ширина по верху */}
      <line x1={OX-TRENCH_W/2-SIDE_SLOPE} y1={OY-22} x2={OX+TRENCH_W/2+SIDE_SLOPE} y2={OY-22} stroke="#94a3b8" strokeWidth={0.8}/>
      <text x={OX} y={OY-10} textAnchor="middle" fontSize={9} fill="#475569" fontStyle="italic">3.1 м (по верху)</text>
      {/* Глубина */}
      <line x1={OX+TRENCH_W/2+SIDE_SLOPE+35} y1={OY} x2={OX+TRENCH_W/2+SIDE_SLOPE+35} y2={OY+DEPTH} stroke="#94a3b8" strokeWidth={0.8}/>
      <text x={OX+TRENCH_W/2+SIDE_SLOPE+47} y={OY+DEPTH/2+4} textAnchor="middle" fontSize={9} fill="#475569" fontStyle="italic" transform={`rotate(-90,${OX+TRENCH_W/2+SIDE_SLOPE+47},${OY+DEPTH/2+4})`}>h=2.0 м</text>
      {/* Откос */}
      <text x={OX-TRENCH_W/2-SIDE_SLOPE/2-10} y={OY+DEPTH/2} fontSize={8} fill="#6366f1">m=0.5</text>
      <line x1={OX-TRENCH_W/2} y1={OY+DEPTH} x2={OX-TRENCH_W/2-SIDE_SLOPE} y2={OY} stroke="#6366f1" strokeWidth={0.8} strokeDasharray="2 2"/>

      {/* Уровни */}
      <line x1={OX-TRENCH_W/2-SIDE_SLOPE-50} y1={OY} x2={OX-TRENCH_W/2-SIDE_SLOPE+10} y2={OY} stroke="#94a3b8" strokeWidth={0.8}/>
      <text x={OX-TRENCH_W/2-SIDE_SLOPE-52} y={OY+4} textAnchor="end" fontSize={8} fill="#64748b">▽ 0.000</text>
      <line x1={OX-TRENCH_W/2-50} y1={OY+DEPTH} x2={OX-TRENCH_W/2+10} y2={OY+DEPTH} stroke="#94a3b8" strokeWidth={0.8}/>
      <text x={OX-TRENCH_W/2-52} y={OY+DEPTH+4} textAnchor="end" fontSize={8} fill="#64748b">▽−2.000</text>

      <text x={OX} y={OY-35} textAnchor="middle" fontSize={10} fontWeight="600" fill="#1e293b">
        Разрез траншеи под водопровод Ø300 · суглинок m=0.5
      </text>
      <text x={OX} y={OY-23} textAnchor="middle" fontSize={8} fill="#94a3b8" fontStyle="italic">
        М 1:20 · СНиП РК 3.05.04-2002 · Водопровод В1 · Школа №47
      </text>
    </svg>
  );
}

const STEPS=[
  {id:"trench-width",hl:[],title:"Нормативная ширина траншеи (по СНиП РК 3.05.04)",
    q:"Труба стальная Ø300 мм. По СНиП РК 3.05.04-2002 пункт 4.3 для Ø 200-700 мм сталь/чугун: ширина = Ø + 0.8 м. Рассчитайте ширину траншеи по дну.",
    ss:[
      {id:"w",l:"Ширина траншеи по дну, м",a:["1.1","1,1"],e:"0.30 + 0.80 = 1.10 м. Это нормативная ширина по СНиП РК 3.05.04-2002, п. 4.3."},
    ],
    vor:"Ширина траншеи по дну: Ø300 + 0.8 = 1.10 м (СНиП РК 3.05.04-2002, п. 4.3, Табл.6)",
    theory:"Нормативная ширина — минимально допустимая для монтажных работ. Если грунт требует крепления — добавляется 0.15 м с каждой стороны. По верху — с откосами.",
  },
  {id:"trench-vol",hl:["trench-vol"],title:"Объём грунта для разработки траншеи",
    q:"Траншея: длина 85.0 м, дно 1.10 м, глубина 2.0 м. Грунт суглинок, h≤3м → m=0.50. Площадь поперечного сечения — трапеция. Рассчитайте объём грунта.",
    ss:[
      {id:"top",   l:"Ширина по верху, м",          a:["3.1","3,1"],    e:"1.10 + 2×(0.50×2.0) = 1.10+2.0 = 3.10 м"},
      {id:"sect",  l:"Площадь поперечного сечения, м²",a:["4.2","4,2"],e:"(1.10+3.10)/2 × 2.0 = 4.20/2×2 = 4.20 м²"},
      {id:"vol",   l:"Объём разработки грунта, м³", a:["357","357.0"],  e:"4.20 × 85.0 = 357.0 м³"},
    ],
    vor:"Разработка грунта экскаватором В1 (суглинок II кат.): 4.20×85.0 = 357.0 м³ (ЭСН РК §1-1-10, Чертёж С-01)",
    theory:"Поперечное сечение траншеи — трапеция: S = (b_дна + b_верха)/2 × h. При постоянной глубине: V = S × L. При переменной — делить на участки.",
  },
  {id:"bed",hl:["bed"],title:"Объём песчаного основания (подушки)",
    q:"Под трубу Ø300 укладывается песчаная подушка: ширина = ширина траншеи = 1.10 м, толщина 100 мм. Длина 85.0 м.",
    ss:[
      {id:"vol",l:"Объём песчаной подушки, м³",a:["9.35","9,35","9.4"],e:"1.10 × 0.10 × 85.0 = 9.35 м³"},
    ],
    vor:"Подушка песчаная 100мм под трубу: 1.10×0.10×85.0 = 9.35 м³ (ЭСН РК §1-3-1, Чертёж С-01 узел 1)",
    theory:"Песчаное основание обязательно для труб на нестабильном грунте. Толщина 100-200 мм по нормам (СНиП РК 3.05.04-2002, п. 5.2). Для ПВХ труб — всегда.",
  },
  {id:"backfill-manual",hl:["backfill-manual"],title:"Объём ручной засыпки над трубой",
    q:"По СНиП РК 3.05.04-2002 п. 5.3: первые 500 мм над верхом трубы засыпают вручную (механизм повредит). Верх трубы: 2.0-0.1-0.3=1.6 м от дна. 500мм выше = засыпка до 1.6-0.5=1.1м от дна.",
    ss:[
      {id:"h",  l:"Высота слоя ручной засыпки, м",  a:["0.5","0,5"],    e:"500 мм = 0.5 м (норма СНиП РК 3.05.04-2002 п. 5.3)"},
      {id:"vol",l:"Объём ручной засыпки, м³",        a:["46.75","46,75","46.8"],e:"1.10 × 0.5 × 85.0 = 46.75 м³"},
    ],
    vor:"Засыпка вручную над трубой 500мм: 1.10×0.50×85.0 = 46.75 м³ (ЭСН РК §1-2-5, СНиП РК 3.05.04-2002 п.5.3)",
    theory:"Ручная засыпка — отдельная позиция с повышенной стоимостью. Механическая засыпка остатка (выше 500мм над трубой) — ЭСН §1-1-xx с уплотнением трамбовкой.",
  },
];

export default function TrenchesPage(){
  const [xi,sxi]=useState(0);const [si,ssi]=useState(0);const [inp,setInp]=useState<Record<string,string>>({});
  const [rev,setRev]=useState<Record<string,boolean>>({});const [done,setDone]=useState<Set<string>>(new Set());
  const ex=STEPS[xi];const step=ex.ss[si];const k=`${ex.id}-${step.id}`;
  const ok=rev[k]&&check(inp[k]??"",step.a);const err=rev[k]&&!ok;
  function go(){setRev(r=>({...r,[k]:true}));if(check(inp[k]??"",step.a)){setTimeout(()=>{if(si+1<ex.ss.length){ssi(si+1);setRev({});}else setDone(d=>new Set([...d,ex.id]));},700);}}
  const allDone=done.size===STEPS.length;
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-teal-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link href="/smeta-trainer/drawings-practice/hub" className="text-xs text-teal-200 hover:text-white">← Все разделы</Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold">🔗 Траншеи — нормативная разработка и прокладка сетей</h1>
            <p className="text-[10px] text-teal-200">СНиП РК 3.05.04-2002 · ЭСН РК Сб.1 · {done.size}/{STEPS.length} пройдено</p>
          </div>
          <Link href="/smeta-trainer/drawings-practice/normatives#trenches" className="text-[10px] bg-teal-900 text-teal-200 px-2 py-1 rounded hover:bg-teal-800">📋 Нормативы</Link>
        </div>
      </header>
      {allDone?(
        <div className="max-w-2xl mx-auto py-16 text-center px-4">
          <div className="text-5xl mb-3">🔗</div><h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">Траншеи освоены!</h2>
          <div className="bg-white dark:bg-slate-900 border rounded-lg p-4 text-left mb-4 text-xs space-y-1">{STEPS.map(s=><div key={s.id} className="flex gap-2"><span className="text-emerald-500">✓</span><code className="text-[10px] font-mono">{s.vor}</code></div>)}</div>
          <div className="flex gap-3 justify-center flex-wrap">
            <button onClick={()=>{sxi(0);ssi(0);setInp({});setRev({});setDone(new Set());}} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-sm font-semibold rounded-lg">Снова</button>
            <Link href="/smeta-trainer/drawings-practice/rate-selector" className="px-4 py-2 bg-teal-700 text-white text-sm font-semibold rounded-lg">→ Выбор расценки ЭСН</Link>
          </div>
        </div>
      ):(
        <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
            <TrenchSVG hl={new Set(ex.hl)}/>
            {ex.theory&&<div className="mt-2 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-700 rounded p-2 text-[10px] text-teal-800 dark:text-teal-300">📖 {ex.theory}</div>}
          </div>
          <div className="space-y-3">
            <div className="flex gap-1 flex-wrap">{STEPS.map((s,i)=><button key={s.id} onClick={()=>{sxi(i);ssi(0);setInp({});setRev({});}} className={`text-[10px] px-2 py-1 rounded font-semibold ${i===xi?"bg-teal-600 text-white":done.has(s.id)?"bg-teal-100 text-teal-800 dark:bg-teal-900/30":"bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200"}`}>{done.has(s.id)?"✓":i+1}</button>)}</div>
            <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">{ex.title}</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">{ex.q}</p>
              {ex.ss.length>1&&<div className="flex gap-1 mb-3">{ex.ss.map((_,i)=><div key={i} className={`h-1 flex-1 rounded-full ${i<si?"bg-teal-500":i===si?"bg-teal-300":"bg-slate-200 dark:bg-slate-700"}`}/>)}</div>}
              {!done.has(ex.id)?(
                <div className={`border-2 rounded-lg p-3 ${ok?"border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20":err?"border-red-300 bg-red-50 dark:bg-red-900/20":"border-slate-200 dark:border-slate-700"}`}>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">Шаг {si+1}/{ex.ss.length}: {step.l}</label>
                  <div className="flex gap-2">
                    <input type="text" value={inp[k]??""} onChange={e=>setInp(p=>({...p,[k]:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&!rev[k]&&go()} disabled={!!rev[k]} placeholder="Число..." className="flex-1 border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-teal-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"/>
                    {!rev[k]&&<button onClick={go} disabled={!inp[k]?.trim()} className="px-3 py-1.5 bg-teal-600 text-white text-xs font-semibold rounded hover:bg-teal-700 disabled:opacity-40">✓</button>}
                  </div>
                  {rev[k]&&<div className={`mt-2 text-xs leading-relaxed ${ok?"text-emerald-800 dark:text-emerald-300":"text-red-800 dark:text-red-300"}`}>{ok?"✓ ":"✗ "}{step.e}</div>}
                  {err&&<button onClick={()=>{setInp(p=>({...p,[k]:""}));setRev(r=>({...r,[k]:false}));}} className="mt-1 text-[10px] text-amber-700 underline">Попробовать снова</button>}
                </div>
              ):(
                <div className="border-2 border-teal-300 bg-teal-50 dark:bg-teal-900/20 rounded-lg p-3">
                  <div className="text-xs font-bold text-teal-800 dark:text-teal-300 mb-1">✓ Завершено</div>
                  <code className="text-[10px] font-mono text-teal-700 dark:text-teal-400 block">{ex.vor}</code>
                </div>
              )}
            </div>
            {done.has(ex.id)&&xi+1<STEPS.length&&<button onClick={()=>{sxi(xi+1);ssi(0);setInp({});setRev({});}} className="w-full py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700">Следующее →</button>}
          </div>
        </div>
      )}
    </div>
  );
}
