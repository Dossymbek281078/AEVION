"use client";
import Link from "next/link";
import { useState } from "react";

function check(i:string,a:string[]){const v=parseFloat(i.replace(",","."));return a.some(x=>{const e=parseFloat(x.replace(",","."));return!isNaN(v)&&!isNaN(e)&&Math.abs((v-e)/e)<0.025;});}

function UtilitySVG({hl}:{hl:Set<string>}){
  const OX=80,OY=60;
  // Аксонометрическая схема трубопровода (упрощённая)
  // Вертикальный стояк + горизонтальные подводки
  const stY=[OY,OY+60,OY+120,OY+180]; // 4 этажа
  const stX=OX;
  return (
    <svg viewBox={`${OX-70} ${OY-60} 580 380`} className="w-full h-auto" style={{maxHeight:340}}>
      {/* Вертикальный стояк */}
      <line x1={stX} y1={OY-30} x2={stX} y2={OY+210}
        stroke={hl.has("riser-len")?"#dc2626":"#64748b"} strokeWidth={hl.has("riser-len")?4:3}/>
      <text x={stX-30} y={OY-40} fontSize={9} fill={hl.has("riser-len")?"#dc2626":"#475569"}>Стояк В1 Ø50</text>

      {/* Горизонтальные подводки к санузлам на каждом этаже */}
      {stY.map((y,i)=>(
        <g key={i}>
          {/* Подводка к ванне (левая) */}
          <line x1={stX} y1={y} x2={stX-100} y2={y}
            stroke={hl.has("branch-len")?"#2563eb":"#3b82f6"} strokeWidth={hl.has("branch-len")?3:2}/>
          {/* Подводка к унитазу (правая) */}
          <line x1={stX} y1={y+15} x2={stX+80} y2={y+15}
            stroke={hl.has("branch-len")?"#2563eb":"#3b82f6"} strokeWidth={hl.has("branch-len")?3:2}/>
          {/* Приборы */}
          <rect x={stX-120} y={y-10} width={20} height={20} fill="#e0f2fe" stroke="#0284c7" strokeWidth={1}/>
          <text x={stX-110} y={y+4} textAnchor="middle" fontSize={6} fill="#0284c7">ВН</text>
          <circle cx={stX+90} cy={y+15} r={10} fill="#e0f2fe" stroke="#0284c7" strokeWidth={1}/>
          <text x={stX+90} y={y+19} textAnchor="middle" fontSize={6} fill="#0284c7">WC</text>
          {/* Этаж */}
          <text x={stX+120} y={y+4} fontSize={8} fill="#94a3b8">{4-i} эт.</text>
          {/* Размер */}
          {i===0&&hl.has("branch-len")&&<>
            <line x1={stX} y1={y-25} x2={stX-100} y2={y-25} stroke="#2563eb" strokeWidth={0.8}/>
            <text x={stX-50} y={y-14} textAnchor="middle" fontSize={8} fill="#2563eb" fontStyle="italic">1.0 м</text>
          </>}
        </g>
      ))}

      {/* Изоляция стояка */}
      {hl.has("insulation")&&(
        <rect x={stX-10} y={OY-30} width={20} height={240}
          fill="rgba(251,191,36,0.3)" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 2"/>
      )}

      {/* Размер стояка */}
      <line x1={stX+30} y1={OY-30} x2={stX+30} y2={OY+210} stroke="#94a3b8" strokeWidth={0.8}/>
      <text x={stX+42} y={(OY-30+OY+210)/2+4} textAnchor="middle" fontSize={9} fill="#475569" fontStyle="italic" transform={`rotate(-90,${stX+42},${(OY-30+OY+210)/2+4})`}>
        h=3.2×4=12.8 м
      </text>

      {/* Легенда */}
      <g transform={`translate(${stX+80},${OY+230})`}>
        <line x1={0} y1={5} x2={20} y2={5} stroke="#dc2626" strokeWidth={3}/>
        <text x={24} y={9} fontSize={8} fill="#475569">Стояк В1 Ø50</text>
        <line x1={100} y1={5} x2={120} y2={5} stroke="#3b82f6" strokeWidth={2}/>
        <text x={124} y={9} fontSize={8} fill="#475569">Подводка Ø20</text>
        {hl.has("insulation")&&<>
          <rect x={220} y={0} width={12} height={10} fill="rgba(251,191,36,0.3)" stroke="#f59e0b" strokeWidth={1}/>
          <text x={235} y={9} fontSize={8} fill="#92400e">Изоляция</text>
        </>}
      </g>

      <text x={stX+60} y={OY-45} textAnchor="middle" fontSize={10} fontWeight="600" fill="#1e293b">Аксонометрическая схема В1 (ХВС)</text>
      <text x={stX+60} y={OY-33} textAnchor="middle" fontSize={8} fill="#94a3b8" fontStyle="italic">М 1:100 · 4 санузла, по 2 подводки · Школа №47</text>
    </svg>
  );
}

const STEPS=[
  {id:"riser-len",hl:["riser-len"],title:"Длина стояка холодного водоснабжения",
    q:"Стояк В1 Ø50 мм обслуживает 4 этажа × 3.2 м + 2.0 м на техэтаж и подвал = итого. Рассчитайте суммарную длину стояка.",
    ss:[
      {id:"h",  l:"Высота стояка (4 эт + подвал), м", a:["14.8","14,8"],  e:"4×3.2 + 2.0 = 14.8 м"},
      {id:"all",l:"Итого стояк В1, м.п.",              a:["14.8","14,8"],  e:"14.8 м.п. (1 стояк). Если 8 санузловых стояков: 8×14.8 = 118.4 м.п."},
    ],
    vor:"Трубопровод В1 Ø50 ПП (стояк): 8×14.8 = 118.4 м.п. (Чертёж С-01, аксонометрия В1)",
    theory:"Трубопровод в ВОР — в м.п. по длине трассы. Трубы разных диаметров — разные позиции ЛСР (разные расценки). Фасонные части (угольники, тройники) — отдельно в шт.",
  },
  {id:"branch-len",hl:["branch-len"],title:"Длина подводки к санприборам",
    q:"На каждом из 4 этажей — 2 подводки Ø20 мм: к ванне 1.0 м и к унитазу 0.8 м. 2 санузла на этаж. Посчитайте суммарную длину подводок.",
    ss:[
      {id:"one",  l:"Подводки на 1 санузел (ванна+WC), м.п.",    a:["1.8","1,8"],   e:"1.0+0.8 = 1.8 м.п."},
      {id:"floor",l:"На 1 этаж (2 санузла), м.п.",                a:["3.6","3,6"],   e:"2 × 1.8 = 3.6 м.п."},
      {id:"total",l:"На 4 этажа, м.п.",                            a:["14.4","14,4"], e:"4 × 3.6 = 14.4 м.п."},
    ],
    vor:"Трубопровод В1 Ø20 ПП (подводка): 4×2×(1.0+0.8) = 14.4 м.п. (Чертёж С-01, аксонометрия В1)",
    theory:"Подводки к приборам — Ø15-20 мм. Считают по длине трассы от стояка до прибора. Гибкие подводки (сталь) под раковину, бачок — отдельно в шт.",
  },
  {id:"insulation",hl:["insulation"],title:"Площадь тепловой изоляции трубопровода",
    q:"Стояк ХВС Ø50 нужно изолировать (конденсат). Длина 118.4 м.п., внешний диаметр Ø50 мм, изоляция Energoflex 13 мм. Площадь изолируемой поверхности = π × (Ø+2t) × L.",
    ss:[
      {id:"dout",  l:"Внешний диаметр с изоляцией, мм",  a:["76","76.0"],    e:"50 + 2×13 = 76 мм = 0.076 м"},
      {id:"area",  l:"Площадь изоляции стояков, м²",      a:["28.27","28,27","28.3","28.2"],e:"π × 0.076 × 118.4 = 3.1416×0.076×118.4 = 28.27 м²"},
    ],
    vor:"Изоляция труб В1 Energoflex 13мм: π×0.076×118.4 = 28.27 м² (Чертёж С-01, спецификация изоляции)",
    theory:"Изоляция труб — в м² (по внешней поверхности изолированной трубы). Формула: S = π×(D_нар + 2t)×L. Для хладагентов — другие нормы изоляции.",
  },
];

export default function UtilitiesPage(){
  const [xi,sxi]=useState(0);const [si,ssi]=useState(0);const [inp,setInp]=useState<Record<string,string>>({});
  const [rev,setRev]=useState<Record<string,boolean>>({});const [done,setDone]=useState<Set<string>>(new Set());
  const ex=STEPS[xi];const step=ex.ss[si];const k=`${ex.id}-${step.id}`;
  const ok=rev[k]&&check(inp[k]??"",step.a);const err=rev[k]&&!ok;
  function go(){setRev(r=>({...r,[k]:true}));if(check(inp[k]??"",step.a)){setTimeout(()=>{if(si+1<ex.ss.length){ssi(si+1);setRev({});}else setDone(d=>new Set([...d,ex.id]));},700);}}
  const allDone=done.size===STEPS.length;
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-purple-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link href="/smeta-trainer/drawings-practice/hub" className="text-xs text-purple-200 hover:text-white">← Все модули</Link>
          <div className="flex-1"><h1 className="text-sm font-bold">🔧 Инженерные системы — трубы, изоляция, стояки</h1><p className="text-[10px] text-purple-200">{done.size}/{STEPS.length} пройдено</p></div>
        </div>
      </header>
      {allDone?(
        <div className="max-w-2xl mx-auto py-16 text-center px-4">
          <div className="text-5xl mb-3">🔧</div><h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">Инженерные системы освоены!</h2>
          <div className="bg-white dark:bg-slate-900 border rounded-lg p-4 text-left mb-4 text-xs space-y-1">{STEPS.map(s=><div key={s.id} className="flex gap-2"><span className="text-emerald-500">✓</span><code className="text-[10px] font-mono">{s.vor}</code></div>)}</div>
          <div className="flex gap-3 justify-center flex-wrap">
            <button onClick={()=>{sxi(0);ssi(0);setInp({});setRev({});setDone(new Set());}} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-sm font-semibold rounded-lg">Снова</button>
            <Link href="/smeta-trainer/drawings-practice/hub" className="px-4 py-2 bg-purple-700 text-white text-sm font-semibold rounded-lg">← Все модули</Link>
          </div>
        </div>
      ):(
        <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
            <UtilitySVG hl={new Set(ex.hl)}/>
            {ex.theory&&<div className="mt-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded p-2 text-[10px] text-purple-800 dark:text-purple-300">📖 {ex.theory}</div>}
          </div>
          <div className="space-y-3">
            <div className="flex gap-1 flex-wrap">{STEPS.map((s,i)=><button key={s.id} onClick={()=>{sxi(i);ssi(0);setInp({});setRev({});}} className={`text-[10px] px-2 py-1 rounded font-semibold ${i===xi?"bg-purple-600 text-white":done.has(s.id)?"bg-purple-100 text-purple-800 dark:bg-purple-900/30":"bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200"}`}>{done.has(s.id)?"✓":i+1}</button>)}</div>
            <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">{ex.title}</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">{ex.q}</p>
              {ex.ss.length>1&&<div className="flex gap-1 mb-3">{ex.ss.map((_,i)=><div key={i} className={`h-1 flex-1 rounded-full ${i<si?"bg-purple-500":i===si?"bg-purple-300":"bg-slate-200 dark:bg-slate-700"}`}/>)}</div>}
              {!done.has(ex.id)?(
                <div className={`border-2 rounded-lg p-3 ${ok?"border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20":err?"border-red-300 bg-red-50 dark:bg-red-900/20":"border-slate-200 dark:border-slate-700"}`}>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">Шаг {si+1}/{ex.ss.length}: {step.l}</label>
                  <div className="flex gap-2">
                    <input type="text" value={inp[k]??""} onChange={e=>setInp(p=>({...p,[k]:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&!rev[k]&&go()} disabled={!!rev[k]} placeholder="Число..." className="flex-1 border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-purple-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"/>
                    {!rev[k]&&<button onClick={go} disabled={!inp[k]?.trim()} className="px-3 py-1.5 bg-purple-600 text-white text-xs font-semibold rounded hover:bg-purple-700 disabled:opacity-40">✓</button>}
                  </div>
                  {rev[k]&&<div className={`mt-2 text-xs leading-relaxed ${ok?"text-emerald-800 dark:text-emerald-300":"text-red-800 dark:text-red-300"}`}>{ok?"✓ ":"✗ "}{step.e}</div>}
                  {err&&<button onClick={()=>{setInp(p=>({...p,[k]:""}));setRev(r=>({...r,[k]:false}));}} className="mt-1 text-[10px] text-amber-700 underline">Попробовать снова</button>}
                </div>
              ):(
                <div className="border-2 border-purple-300 bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
                  <div className="text-xs font-bold text-purple-800 dark:text-purple-300 mb-1">✓ Завершено</div>
                  <code className="text-[10px] font-mono text-purple-700 dark:text-purple-400 block">{ex.vor}</code>
                </div>
              )}
            </div>
            {done.has(ex.id)&&xi+1<STEPS.length&&<button onClick={()=>{sxi(xi+1);ssi(0);setInp({});setRev({});}} className="w-full py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700">Следующее →</button>}
          </div>
        </div>
      )}
    </div>
  );
}
