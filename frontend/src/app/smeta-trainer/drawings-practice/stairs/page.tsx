"use client";
import Link from "next/link";
import { useState } from "react";

function check(i:string,a:string[]){const v=parseFloat(i.replace(",","."));return a.some(x=>{const e=parseFloat(x.replace(",","."));return!isNaN(v)&&!isNaN(e)&&Math.abs((v-e)/e)<0.025;});}

function StairSVG({hl}:{hl:Set<string>}){
  const OX=80,OY=30;const S=20;
  const STEPS_N=11;const TW=S,TH=S;const W=1.4*S*4;
  // Марш: 11 ступеней, проступь 300мм, подступёнок 165мм
  const pts:string[]=[];
  pts.push(`${OX},${OY+STEPS_N*TH}`);
  for(let i=0;i<STEPS_N;i++){
    pts.push(`${OX+i*TW},${OY+(STEPS_N-i)*TH}`);
    pts.push(`${OX+(i+1)*TW},${OY+(STEPS_N-i)*TH}`);
  }
  pts.push(`${OX+STEPS_N*TW},${OY}`);
  const plitePoints=`${OX},${OY+STEPS_N*TH+12} ${OX+STEPS_N*TW+12},${OY+12} ${OX+STEPS_N*TW},${OY} ${pts.join(" ")}`;

  return (
    <svg viewBox={`${OX-70} ${OY-55} 580 360`} className="w-full h-auto" style={{maxHeight:330}}>
      {/* Плита марша */}
      <polygon points={plitePoints} fill="#e2e8f0" stroke="#64748b" strokeWidth={1.5}/>
      {/* Ступени */}
      {Array.from({length:STEPS_N},(_,i)=>{
        const sx=OX+i*TW,sy=OY+(STEPS_N-i)*TH-TH;
        return (
          <g key={i}>
            {/* Проступь */}
            <rect x={sx} y={sy} width={TW} height={TH}
              fill={hl.has("tread")?"#d1fae5":"#f8fafc"}
              stroke={hl.has("tread")?"#059669":"#94a3b8"} strokeWidth={1}/>
            {/* Подступёнок */}
            {hl.has("riser")&&<rect x={sx+TW-2} y={sy} width={2} height={TH} fill="#bfdbfe" stroke="#2563eb" strokeWidth={1}/>}
          </g>
        );
      })}
      {/* Арматура марша */}
      {[0.3,0.7].map((f,i)=>(
        <circle key={i} cx={OX+5} cy={OY+STEPS_N*TH+12-(STEPS_N*TH+12)*f} r={4} fill={hl.has("slab-vol")?"#fca5a5":"#9ca3af"} stroke={hl.has("slab-vol")?"#dc2626":"#6b7280"} strokeWidth={1}/>
      ))}

      {/* Площадка верхняя */}
      <rect x={OX+STEPS_N*TW} y={OY-20} width={W} height={TH*2}
        fill="#e2e8f0" stroke="#64748b" strokeWidth={1.5}/>
      <text x={OX+STEPS_N*TW+W/2} y={OY-5} textAnchor="middle" fontSize={8} fill="#475569">Площадка</text>

      {/* Площадка нижняя */}
      <rect x={OX-W} y={OY+STEPS_N*TH-TH*1.5} width={W} height={TH*2}
        fill="#e2e8f0" stroke="#64748b" strokeWidth={1.5}/>
      <text x={OX-W/2} y={OY+STEPS_N*TH+TH*0.5} textAnchor="middle" fontSize={8} fill="#475569">Площадка</text>

      {/* Размеры */}
      <line x1={OX} y1={OY+STEPS_N*TH+45} x2={OX+STEPS_N*TW} y2={OY+STEPS_N*TH+45} stroke="#94a3b8" strokeWidth={0.8}/>
      <text x={OX+STEPS_N*TW/2} y={OY+STEPS_N*TH+57} textAnchor="middle" fontSize={9} fill="#475569" fontStyle="italic">11 × 300 = 3300 мм (горизонт.)</text>
      <line x1={OX+STEPS_N*TW+60} y1={OY} x2={OX+STEPS_N*TW+60} y2={OY+STEPS_N*TH} stroke="#94a3b8" strokeWidth={0.8}/>
      <text x={OX+STEPS_N*TW+72} y={OY+STEPS_N*TH/2+4} textAnchor="middle" fontSize={9} fill="#475569" fontStyle="italic" transform={`rotate(-90,${OX+STEPS_N*TW+72},${OY+STEPS_N*TH/2+4})`}>11×165=1815 мм</text>
      {/* Ширина марша */}
      <text x={OX+STEPS_N*TW/2} y={OY-38} textAnchor="middle" fontSize={9} fill="#64748b" fontStyle="italic">ширина марша 1400 мм</text>

      {hl.has("tread")&&<text x={OX+TW*5+10} y={OY+STEPS_N*TH/2-30} fontSize={9} fontWeight="700" fill="#065f46">11 проступей 300мм</text>}
      {hl.has("riser")&&<text x={OX+STEPS_N*TW+10} y={OY+TH*4} fontSize={9} fontWeight="700" fill="#1d4ed8">11 подступёнков 165мм</text>}

      <text x={OX+STEPS_N*TW/2} y={OY-50} textAnchor="middle" fontSize={10} fontWeight="600" fill="#1e293b">Разрез 4-4 · Лестничный марш</text>
      <text x={OX+STEPS_N*TW/2} y={OY-38} textAnchor="middle" fontSize={8} fill="#94a3b8" fontStyle="italic">М 1:20 · 11 ступеней 300×165 · Школа №47</text>
    </svg>
  );
}

const STEPS=[
  {id:"treads",hl:["tread"],title:"Площадь проступей (горизонтальные грани)",
    q:"Лестничный марш: 11 ступеней, ширина проступи 300 мм, ширина марша 1400 мм. Рассчитайте площадь всех проступей.",
    ss:[
      {id:"one",l:"Площадь одной проступи, м²",  a:["0.42","0,42"],e:"0.30 × 1.40 = 0.42 м²"},
      {id:"all",l:"Площадь всех проступей, м²",  a:["4.62","4,62"],e:"11 × 0.42 = 4.62 м²"},
    ],
    vor:"Плитка ступеней (проступи): 11×0.30×1.40 = 4.62 м² (Чертёж А-35, разрез 4-4)",
    theory:"Проступи и подступёнки считаются ОТДЕЛЬНО — у них разные материалы (напр. гранит горизонталь + мрамор вертикаль) и разные расценки.",
  },
  {id:"risers",hl:["riser"],title:"Площадь подступёнков (вертикальные грани)",
    q:"Те же 11 ступеней: высота подступёнка 165 мм, ширина марша 1400 мм.",
    ss:[
      {id:"one",l:"Площадь одного подступёнка, м²",a:["0.231","0,231","0.23"],e:"0.165 × 1.40 = 0.231 м²"},
      {id:"all",l:"Площадь всех подступёнков, м²", a:["2.541","2,541","2.54"],e:"11 × 0.231 = 2.541 м²"},
    ],
    vor:"Плитка ступеней (подступёнки): 11×0.165×1.40 = 2.54 м² (Чертёж А-35, разрез 4-4)",
    theory:"Марш из 11 ступеней: проступи + подступёнки итого 4.62+2.54 = 7.16 м² плитки. Наклонная длина марша НЕ используется — только горизонтальные и вертикальные грани.",
  },
  {id:"slab-vol",hl:["slab-vol"],title:"Объём бетона монолитного марша",
    q:"Несущая плита марша: толщина 160 мм, наклонная длина = √(3300²+1815²) = 3789 мм. Ширина 1.4 м. Объём бетона плиты без ступеней.",
    ss:[
      {id:"len",l:"Наклонная длина марша, м",  a:["3.789","3,789","3.79","3.8"],e:"√(3.30²+1.815²) = √(10.89+3.294) = √14.184 ≈ 3.789 м"},
      {id:"vol",l:"Объём бетона плиты, м³",    a:["0.848","0,848","0.85","0.84"],e:"3.789 × 1.40 × 0.16 = 0.848 м³"},
    ],
    vor:"Бетон В25 марш (плита): √(3.30²+1.815²)×1.40×0.16 = 0.848 м³ (Чертёж А-35, разрез 4-4)",
    theory:"Объём ступеней (треугольная часть) — отдельная позиция: 11 × 0.5×0.30×0.165×1.40 = 0.38 м³. Итого марш: 0.848 + 0.38 = 1.23 м³.",
  },
];

export default function StairsPage(){
  const [xi,sxi]=useState(0);const [si,ssi]=useState(0);const [inp,setInp]=useState<Record<string,string>>({});
  const [rev,setRev]=useState<Record<string,boolean>>({});const [done,setDone]=useState<Set<string>>(new Set());
  const ex=STEPS[xi];const step=ex.ss[si];const k=`${ex.id}-${step.id}`;
  const ok=rev[k]&&check(inp[k]??"",step.a);const err=rev[k]&&!ok;
  function go(){setRev(r=>({...r,[k]:true}));if(check(inp[k]??"",step.a)){setTimeout(()=>{if(si+1<ex.ss.length){ssi(si+1);setRev({});}else setDone(d=>new Set([...d,ex.id]));},700);}}
  const allDone=done.size===STEPS.length;
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-violet-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link href="/smeta-trainer/drawings-practice/hub" className="text-xs text-violet-200 hover:text-white">← Все модули</Link>
          <div className="flex-1"><h1 className="text-sm font-bold">🪜 Лестницы — ступени, марш, бетон</h1><p className="text-[10px] text-violet-200">{done.size}/{STEPS.length} пройдено</p></div>
        </div>
      </header>
      {allDone?(
        <div className="max-w-2xl mx-auto py-16 text-center px-4">
          <div className="text-5xl mb-3">🪜</div><h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">Лестницы освоены!</h2>
          <div className="bg-white dark:bg-slate-900 border rounded-lg p-4 text-left mb-4 text-xs space-y-1">{STEPS.map(s=><div key={s.id} className="flex gap-2"><span className="text-emerald-500">✓</span><code className="text-[10px] font-mono">{s.vor}</code></div>)}</div>
          <div className="flex gap-3 justify-center flex-wrap">
            <button onClick={()=>{sxi(0);ssi(0);setInp({});setRev({});setDone(new Set());}} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-sm font-semibold rounded-lg">Снова</button>
            <Link href="/smeta-trainer/drawings-practice/finishing" className="px-4 py-2 bg-violet-700 text-white text-sm font-semibold rounded-lg">→ Отделка</Link>
          </div>
        </div>
      ):(
        <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
            <StairSVG hl={new Set(ex.hl)}/>
            {ex.theory&&<div className="mt-2 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 rounded p-2 text-[10px] text-violet-800 dark:text-violet-300">📖 {ex.theory}</div>}
          </div>
          <div className="space-y-3">
            <div className="flex gap-1 flex-wrap">{STEPS.map((s,i)=><button key={s.id} onClick={()=>{sxi(i);ssi(0);setInp({});setRev({});}} className={`text-[10px] px-2 py-1 rounded font-semibold ${i===xi?"bg-violet-600 text-white":done.has(s.id)?"bg-violet-100 text-violet-800 dark:bg-violet-900/30":"bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200"}`}>{done.has(s.id)?"✓":i+1}</button>)}</div>
            <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">{ex.title}</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">{ex.q}</p>
              {ex.ss.length>1&&<div className="flex gap-1 mb-3">{ex.ss.map((_,i)=><div key={i} className={`h-1 flex-1 rounded-full ${i<si?"bg-violet-500":i===si?"bg-violet-300":"bg-slate-200 dark:bg-slate-700"}`}/>)}</div>}
              {!done.has(ex.id)?(
                <div className={`border-2 rounded-lg p-3 ${ok?"border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20":err?"border-red-300 bg-red-50 dark:bg-red-900/20":"border-slate-200 dark:border-slate-700"}`}>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">Шаг {si+1}/{ex.ss.length}: {step.l}</label>
                  <div className="flex gap-2">
                    <input type="text" value={inp[k]??""} onChange={e=>setInp(p=>({...p,[k]:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&!rev[k]&&go()} disabled={!!rev[k]} placeholder="Число..." className="flex-1 border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-violet-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"/>
                    {!rev[k]&&<button onClick={go} disabled={!inp[k]?.trim()} className="px-3 py-1.5 bg-violet-600 text-white text-xs font-semibold rounded hover:bg-violet-700 disabled:opacity-40">✓</button>}
                  </div>
                  {rev[k]&&<div className={`mt-2 text-xs leading-relaxed ${ok?"text-emerald-800 dark:text-emerald-300":"text-red-800 dark:text-red-300"}`}>{ok?"✓ ":"✗ "}{step.e}</div>}
                  {err&&<button onClick={()=>{setInp(p=>({...p,[k]:""}));setRev(r=>({...r,[k]:false}));}} className="mt-1 text-[10px] text-amber-700 underline">Попробовать снова</button>}
                </div>
              ):(
                <div className="border-2 border-violet-300 bg-violet-50 dark:bg-violet-900/20 rounded-lg p-3">
                  <div className="text-xs font-bold text-violet-800 dark:text-violet-300 mb-1">✓ Завершено</div>
                  <code className="text-[10px] font-mono text-violet-700 dark:text-violet-400 block">{ex.vor}</code>
                </div>
              )}
            </div>
            {done.has(ex.id)&&xi+1<STEPS.length&&<button onClick={()=>{sxi(xi+1);ssi(0);setInp({});setRev({});}} className="w-full py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700">Следующее →</button>}
          </div>
        </div>
      )}
    </div>
  );
}
