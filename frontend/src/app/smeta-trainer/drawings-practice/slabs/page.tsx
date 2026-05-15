"use client";
import Link from "next/link";
import { useState } from "react";

function check(i: string, a: string[]): boolean { const v=parseFloat(i.replace(",",".")); return a.some(x=>{const e=parseFloat(x.replace(",","."));return!isNaN(v)&&!isNaN(e)&&Math.abs((v-e)/e)<0.025;}); }

function SlabSVG({ hl }: { hl: Set<string> }) {
  const OX=60,OY=40,W=340,H=60,S=26;
  return (
    <svg viewBox={`${OX-60} ${OY-50} 560 360`} className="w-full h-auto" style={{maxHeight:320}}>
      {/* Монолитная плита перекрытия — вид сбоку */}
      {/* Нижняя опалубка */}
      <rect x={OX} y={OY+H+2} width={W} height={8} fill="#fef9c3" stroke="#ca8a04" strokeWidth={1}/>
      <text x={OX+W+12} y={OY+H+8} fontSize={8} fill="#92400e">Опалубка</text>

      {/* Плита */}
      <rect x={OX} y={OY} width={W} height={H}
        fill={hl.has("slab-vol")?"#bfdbfe":"#e2e8f0"}
        stroke={hl.has("slab-vol")?"#2563eb":"#64748b"} strokeWidth={hl.has("slab-vol")?2:1.5}/>
      {/* Бетонная штриховка */}
      {[0,1,2,3,4,5,6].map(i=>(
        <line key={i} x1={OX+i*55} y1={OY} x2={OX+i*55-H} y2={OY+H} stroke={hl.has("slab-vol")?"#93c5fd":"#94a3b8"} strokeWidth={0.4}/>
      ))}

      {/* Арматура нижняя */}
      {[0,1,2,3,4,5].map(i=>(
        <circle key={i} cx={OX+30+i*52} cy={OY+H-12} r={5}
          fill={hl.has("reinforcement")?"#fca5a5":"#9ca3af"}
          stroke={hl.has("reinforcement")?"#dc2626":"#6b7280"} strokeWidth={1}/>
      ))}
      {/* Арматура верхняя */}
      {[0,1,2].map(i=>(
        <circle key={i} cx={OX+50+i*120} cy={OY+12} r={5} fill="#9ca3af" stroke="#6b7280" strokeWidth={1}/>
      ))}

      {/* Стена слева */}
      <rect x={OX-20} y={OY-60} width={20} height={H+60} fill="#e2e8f0" stroke="#64748b" strokeWidth={1.5}/>
      {/* Стена справа */}
      <rect x={OX+W} y={OY-60} width={20} height={H+60} fill="#e2e8f0" stroke="#64748b" strokeWidth={1.5}/>
      <text x={OX-10} y={OY-30} textAnchor="middle" fontSize={7} fill="#475569">Стена</text>

      {/* Опирание */}
      {hl.has("bearing") && (
        <>
          <rect x={OX} y={OY} width={30} height={H} fill="rgba(251,191,36,0.3)" stroke="#f59e0b" strokeWidth={1.5}/>
          <rect x={OX+W-30} y={OY} width={30} height={H} fill="rgba(251,191,36,0.3)" stroke="#f59e0b" strokeWidth={1.5}/>
          <text x={OX+15} y={OY+H/2+4} textAnchor="middle" fontSize={8} fill="#92400e">150</text>
          <text x={OX+W-15} y={OY+H/2+4} textAnchor="middle" fontSize={8} fill="#92400e">150</text>
        </>
      )}

      {/* Размеры */}
      <line x1={OX} y1={OY+H+35} x2={OX+W} y2={OY+H+35} stroke="#94a3b8" strokeWidth={0.8}/>
      <text x={OX+W/2} y={OY+H+48} textAnchor="middle" fontSize={9} fill="#475569" fontStyle="italic">L=9.0 м (в свету)</text>
      <line x1={OX+W+50} y1={OY} x2={OX+W+50} y2={OY+H} stroke="#94a3b8" strokeWidth={0.8}/>
      <text x={OX+W+62} y={OY+H/2+4} textAnchor="middle" fontSize={9} fill="#475569" fontStyle="italic" transform={`rotate(-90,${OX+W+62},${OY+H/2+4})`}>h=200 мм</text>

      {/* Схема плана */}
      <rect x={OX+80} y={OY+H+80} width={180} height={100}
        fill={hl.has("slab-vol")?"#dbeafe":"#f8fafc"} stroke={hl.has("slab-vol")?"#3b82f6":"#94a3b8"} strokeWidth={1}/>
      <text x={OX+80+90} y={OY+H+135} textAnchor="middle" fontSize={9} fill="#475569">9.0 м × 6.5 м</text>
      <text x={OX+80+90} y={OY+H+150} textAnchor="middle" fontSize={8} fill="#94a3b8" fontStyle="italic">план плиты</text>
      <line x1={OX+80} y1={OY+H+195} x2={OX+80+180} y2={OY+H+195} stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="3 2"/>
      <text x={OX+80+90} y={OY+H+207} textAnchor="middle" fontSize={8} fill="#94a3b8" fontStyle="italic">9.0 м</text>

      {hl.has("formwork") && (
        <text x={OX+W/2} y={OY+H+15} textAnchor="middle" fontSize={9} fontWeight="700" fill="#92400e">Опалубка</text>
      )}

      <text x={OX+W/2} y={OY-35} textAnchor="middle" fontSize={10} fontWeight="600" fill="#1e293b">Разрез — Монолитная плита перекрытия h=200 мм</text>
      <text x={OX+W/2} y={OY-23} textAnchor="middle" fontSize={8} fill="#94a3b8" fontStyle="italic">М 1:50 · Бетон В25, арм. АIII Ø12-14 мм · Школа №47</text>
    </svg>
  );
}

const STEPS = [
  { id:"vol", hl:["slab-vol"], title:"Объём монолитной плиты перекрытия",
    q:"Плита 9.0×6.5 м (в свету), толщина 200 мм. Опирание на стены по 150 мм с каждой стороны. Посчитайте полный объём бетона.",
    ss:[
      {id:"netL",l:"Длина плиты с опиранием, м", a:["9.3","9,3"],e:"9.0 + 2×0.15 = 9.3 м (с опиранием на стены)"},
      {id:"netB",l:"Ширина с опиранием, м",      a:["6.8","6,8"],e:"6.5 + 2×0.15 = 6.8 м"},
      {id:"vol", l:"Объём бетона, м³",            a:["12.65","12,65","12.7","12.6"],e:"9.3 × 6.8 × 0.20 = 12.648 ≈ 12.65 м³"},
    ],
    vor:"Бетон В25 монолит. плита h=200: (9.0+2×0.15)×(6.5+2×0.15)×0.20 = 12.65 м³ (Чертёж А-31)",
    theory:"Объём плиты считается с учётом опирания на стены. Опирание нормируется: ≥ 100 мм на кирпич/газобетон, ≥ 150 мм на монолитную стену.",
  },
  { id:"form", hl:["formwork"], title:"Площадь опалубки монолитной плиты",
    q:"Опалубка устанавливается снизу (горизонталь) и с боков (торцы). Те же размеры: 9.3×6.8 м, h=200 мм.",
    ss:[
      {id:"bot", l:"Горизонталь (дно), м²",  a:["63.24","63,24","63.2"],e:"9.3 × 6.8 = 63.24 м²"},
      {id:"sides",l:"Торцы (4 стороны), м²", a:["6.42","6,42","6.4"], e:"2×(9.3+6.8)×0.20 = 2×16.1×0.20 = 6.44 м²"},
      {id:"total",l:"Итого опалубка, м²",     a:["69.66","69,66","69.7","70"],e:"63.24 + 6.44 = 69.68 ≈ 69.7 м²"},
    ],
    vor:"Опалубка плиты перекрытия: 9.3×6.8 + 2×(9.3+6.8)×0.20 = 69.7 м² (Чертёж А-31)",
    theory:"Опалубка включает горизонтальную палубу + вертикальные щиты торцов. Единица — м² (нормируется по типу опалубки: деревянная, металлическая, несъёмная).",
  },
  { id:"rebar", hl:["reinforcement"], title:"Расчёт арматуры (приближённо)",
    q:"Для плиты 9.3×6.8×0.20 м расход арматуры ~ 100 кг/м³ (среднее значение из ЭСН для плиты h=200 мм). Посчитайте вес арматуры.",
    ss:[
      {id:"vol",   l:"Объём бетона плиты, м³",  a:["12.65","12,65","12.7"],e:"12.65 м³ (уже считали)"},
      {id:"weight",l:"Масса арматуры, т",         a:["1.265","1,265","1.27","1.26"],e:"12.65 × 100 кг/м³ = 1265 кг = 1.265 т"},
    ],
    vor:"Арматура АIII плиты: 12.65 м³ × 100 кг/м³ = 1265 кг = 1.265 т (Чертёж А-31, спецификация)",
    theory:"Расход арматуры по ЭСН — нормативный. Точный расчёт — по спецификации арматурных изделий (от конструктора). Для монолитной плиты h=200мм принимают 80-120 кг/м³.",
  },
];

export default function SlabsPage() {
  const [xi,sxi]=useState(0);const [si,ssi]=useState(0);const [inp,setInp]=useState<Record<string,string>>({});
  const [rev,setRev]=useState<Record<string,boolean>>({});const [done,setDone]=useState<Set<string>>(new Set());
  const ex=STEPS[xi];const step=ex.ss[si];const k=`${ex.id}-${step.id}`;
  const ok=rev[k]&&check(inp[k]??"",step.a);const err=rev[k]&&!ok;
  function go(){setRev(r=>({...r,[k]:true}));if(check(inp[k]??"",step.a)){setTimeout(()=>{if(si+1<ex.ss.length){ssi(si+1);setRev({});}else setDone(d=>new Set([...d,ex.id]));},700);}}
  const allDone=done.size===STEPS.length;
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-slate-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link href="/smeta-trainer/drawings-practice/hub" className="text-xs text-slate-300 hover:text-white">← Все модули</Link>
          <div className="flex-1"><h1 className="text-sm font-bold">🔲 Перекрытия — монолит, опалубка, арматура</h1><p className="text-[10px] text-slate-300">{done.size}/{STEPS.length} пройдено</p></div>
        </div>
      </header>
      {allDone?(
        <div className="max-w-2xl mx-auto py-16 text-center px-4">
          <div className="text-5xl mb-3">🔲</div><h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">Перекрытия освоены!</h2>
          <div className="bg-white dark:bg-slate-900 border rounded-lg p-4 text-left mb-4 text-xs space-y-1">{STEPS.map(s=><div key={s.id} className="flex gap-2"><span className="text-emerald-500">✓</span><code className="text-[10px] font-mono">{s.vor}</code></div>)}</div>
          <div className="flex gap-3 justify-center flex-wrap">
            <button onClick={()=>{sxi(0);ssi(0);setInp({});setRev({});setDone(new Set());}} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-sm font-semibold rounded-lg">Снова</button>
            <Link href="/smeta-trainer/drawings-practice/roof-flat" className="px-4 py-2 bg-slate-700 text-white text-sm font-semibold rounded-lg">→ Кровля</Link>
          </div>
        </div>
      ):(
        <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
            <SlabSVG hl={new Set(ex.hl)}/>
            {ex.theory&&<div className="mt-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-2 text-[10px] text-slate-600 dark:text-slate-400">📖 {ex.theory}</div>}
          </div>
          <div className="space-y-3">
            <div className="flex gap-1">{STEPS.map((s,i)=><button key={s.id} onClick={()=>{sxi(i);ssi(0);setInp({});setRev({});}} className={`text-[10px] px-2 py-1 rounded font-semibold ${i===xi?"bg-slate-700 text-white":done.has(s.id)?"bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300":"bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200"}`}>{done.has(s.id)?"✓":i+1}</button>)}</div>
            <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">{ex.title}</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">{ex.q}</p>
              {ex.ss.length>1&&<div className="flex gap-1 mb-3">{ex.ss.map((_,i)=><div key={i} className={`h-1 flex-1 rounded-full ${i<si?"bg-slate-600":i===si?"bg-slate-400":"bg-slate-200 dark:bg-slate-700"}`}/>)}</div>}
              {!done.has(ex.id)?(
                <div className={`border-2 rounded-lg p-3 ${ok?"border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20":err?"border-red-300 bg-red-50 dark:bg-red-900/20":"border-slate-200 dark:border-slate-700"}`}>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">Шаг {si+1}/{ex.ss.length}: {step.l}</label>
                  <div className="flex gap-2">
                    <input type="text" value={inp[k]??""} onChange={e=>setInp(p=>({...p,[k]:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&!rev[k]&&go()} disabled={!!rev[k]} placeholder="Число..." className="flex-1 border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-slate-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"/>
                    {!rev[k]&&<button onClick={go} disabled={!inp[k]?.trim()} className="px-3 py-1.5 bg-slate-700 text-white text-xs font-semibold rounded hover:bg-slate-800 disabled:opacity-40">✓</button>}
                  </div>
                  {rev[k]&&<div className={`mt-2 text-xs leading-relaxed ${ok?"text-emerald-800 dark:text-emerald-300":"text-red-800 dark:text-red-300"}`}>{ok?"✓ ":"✗ "}{step.e}</div>}
                  {err&&<button onClick={()=>{setInp(p=>({...p,[k]:""}));setRev(r=>({...r,[k]:false}));}} className="mt-1 text-[10px] text-amber-700 underline">Попробовать снова</button>}
                </div>
              ):(
                <div className="border-2 border-slate-400 bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">✓ Завершено</div>
                  <code className="text-[10px] font-mono text-slate-600 dark:text-slate-400 block">{ex.vor}</code>
                </div>
              )}
            </div>
            {done.has(ex.id)&&xi+1<STEPS.length&&<button onClick={()=>{sxi(xi+1);ssi(0);setInp({});setRev({});}} className="w-full py-2 bg-slate-700 text-white text-sm font-semibold rounded-lg hover:bg-slate-800">Следующее →</button>}
          </div>
        </div>
      )}
    </div>
  );
}
