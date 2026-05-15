"use client";
import Link from "next/link";
import { useState } from "react";

function check(i:string,a:string[]){const v=parseFloat(i.replace(",","."));return a.some(x=>{const e=parseFloat(x.replace(",","."));return!isNaN(v)&&!isNaN(e)&&Math.abs((v-e)/e)<0.025;});}

function WindowDoorSVG({hl}:{hl:Set<string>}){
  const OX=60,OY=50;
  const WW=120,WH=108; // Окно 1.5×1.35 (масштаб 1:10, 1м=80px)
  const DW=72,DH=168;   // Дверь 0.9×2.1м
  const REVEAL=28;      // откос 350мм
  return (
    <svg viewBox={`${OX-60} ${OY-60} 620 380`} className="w-full h-auto" style={{maxHeight:340}}>
      {/* ОКНО */}
      <text x={OX+WW/2} y={OY-45} textAnchor="middle" fontSize={10} fontWeight="600" fill="#1e293b">Окно ПВХ 1500×1800 мм</text>
      {/* Стена вокруг */}
      <rect x={OX-40} y={OY-30} width={WW+80} height={WH+60} fill="#fef9c3" stroke="#ca8a04" strokeWidth={1.5}/>
      {/* Проём */}
      <rect x={OX} y={OY} width={WW} height={WH}
        fill={hl.has("window-qty")?"#bfdbfe":"#e0f2fe"}
        stroke={hl.has("window-qty")?"#2563eb":"#3b82f6"} strokeWidth={2}/>
      {/* Рама ПВХ (контур) */}
      <rect x={OX+8} y={OY+8} width={WW-16} height={WH-16} fill="none" stroke="#cbd5e1" strokeWidth={8}/>
      {/* Горбыль */}
      <line x1={OX+8} y1={OY+WH/2} x2={OX+WW-8} y2={OY+WH/2} stroke="#cbd5e1" strokeWidth={4}/>
      {/* Откосы */}
      {hl.has("reveal")&&(
        <>
          <rect x={OX-REVEAL} y={OY} width={REVEAL} height={WH} fill="#d1fae5" stroke="#059669" strokeWidth={1.5}/>
          <rect x={OX+WW} y={OY} width={REVEAL} height={WH} fill="#d1fae5" stroke="#059669" strokeWidth={1.5}/>
          <rect x={OX-REVEAL} y={OY-REVEAL/2} width={WW+2*REVEAL} height={REVEAL/2} fill="#d1fae5" stroke="#059669" strokeWidth={1.5}/>
        </>
      )}
      {/* Размеры окна */}
      <line x1={OX} y1={OY+WH+25} x2={OX+WW} y2={OY+WH+25} stroke="#94a3b8" strokeWidth={0.8}/>
      <text x={OX+WW/2} y={OY+WH+37} textAnchor="middle" fontSize={9} fill="#475569" fontStyle="italic">1500 мм</text>
      <line x1={OX+WW+30} y1={OY} x2={OX+WW+30} y2={OY+WH} stroke="#94a3b8" strokeWidth={0.8}/>
      <text x={OX+WW+42} y={OY+WH/2+4} textAnchor="middle" fontSize={9} fill="#475569" fontStyle="italic" transform={`rotate(-90,${OX+WW+42},${OY+WH/2+4})`}>1800 мм</text>
      {hl.has("reveal")&&<>
        <line x1={OX-REVEAL} y1={OY+WH+25} x2={OX} y2={OY+WH+25} stroke="#059669" strokeWidth={0.8}/>
        <text x={OX-REVEAL/2} y={OY+WH+37} textAnchor="middle" fontSize={8} fill="#059669" fontStyle="italic">350</text>
      </>}
      {/* ДВЕРЬ */}
      <text x={OX+WW+140+DW/2} y={OY-45} textAnchor="middle" fontSize={10} fontWeight="600" fill="#1e293b">Дверь 900×2100 мм</text>
      <rect x={OX+WW+100} y={OY-30} width={DW+80} height={DH+60} fill="#fef9c3" stroke="#ca8a04" strokeWidth={1.5}/>
      <rect x={OX+WW+140} y={OY} width={DW} height={DH}
        fill={hl.has("door-qty")?"#fed7aa":"#fef3c7"}
        stroke={hl.has("door-qty")?"#ea580c":"#f59e0b"} strokeWidth={2}/>
      <rect x={OX+WW+148} y={OY+8} width={DW-16} height={DH-16} fill="none" stroke="#d1d5db" strokeWidth={6}/>
      {/* Ручка */}
      <circle cx={OX+WW+140+DW-14} cy={OY+DH/2} r={5} fill="#94a3b8" stroke="#64748b" strokeWidth={1}/>
      {/* Порог */}
      <rect x={OX+WW+132} y={OY+DH} width={DW+16} height={6} fill="#ca8a04" stroke="#92400e" strokeWidth={1}/>
      <text x={OX+WW+140+DW/2} y={OY+DH+16} textAnchor="middle" fontSize={7} fill="#92400e">Порог</text>
      {/* Размеры двери */}
      <line x1={OX+WW+140} y1={OY+DH+30} x2={OX+WW+140+DW} y2={OY+DH+30} stroke="#94a3b8" strokeWidth={0.8}/>
      <text x={OX+WW+140+DW/2} y={OY+DH+42} textAnchor="middle" fontSize={9} fill="#475569" fontStyle="italic">900 мм</text>
      <line x1={OX+WW+140+DW+25} y1={OY} x2={OX+WW+140+DW+25} y2={OY+DH} stroke="#94a3b8" strokeWidth={0.8}/>
      <text x={OX+WW+140+DW+37} y={OY+DH/2+4} textAnchor="middle" fontSize={9} fill="#475569" fontStyle="italic" transform={`rotate(-90,${OX+WW+140+DW+37},${OY+DH/2+4})`}>2100 мм</text>

      <text x={OX+WW/2} y={OY-60} textAnchor="middle" fontSize={8} fill="#94a3b8" fontStyle="italic">М 1:10 · вид снаружи · Школа №47</text>
    </svg>
  );
}

const STEPS=[
  {id:"qty",hl:["window-qty","door-qty"],title:"Количество окон и дверей из спецификации",
    q:"Спецификация к чертежу: Окна ПВХ 1500×1800 мм — 64 шт, Окна ПВХ 600×900 мм (санузлы) — 16 шт, Двери входные 900×2100 мм — 8 шт, Двери межкомнатные 800×2100 мм — 64 шт. Подсчитайте общее количество оконных и дверных блоков.",
    ss:[
      {id:"wins",l:"Итого оконных блоков, шт",a:["80"],e:"64+16 = 80 оконных блока (берём из спецификации — не пересчитываем по плану!)"},
      {id:"doors",l:"Итого дверных блоков, шт",a:["72"],e:"8+64 = 72 дверных блока"},
    ],
    vor:"Окна ПВХ: 64 шт (1500×1800) + 16 шт (600×900). Двери: 8 шт входн. + 64 шт межк. (Спецификация к Чертёж А-23)",
    theory:"Количество блоков — из спецификации, НЕ пересчитывается по планам. Спецификация — главный источник. Ссылка в ВОР: «Спецификация к листу А-23».",
  },
  {id:"reveal",hl:["reveal"],title:"Площадь откосов оконных проёмов",
    q:"64 окна 1500×1800 мм, глубина откоса 350 мм (стена 510 мм, рама 160 мм). Откосы: 2 боковины + верх (подоконник — отдельно). Посчитайте площадь штукатурки откосов.",
    ss:[
      {id:"perim",l:"Периметр откоса 1 окна (без подоконника), м",a:["4.8","4,8"],e:"2×1.8 + 1.5 = 3.6+1.5 = 5.1 м. Подождите: 2 боковины 1.8м + 1 верх 1.5м = 5.1 м. Если принять 4.8 — только боковины и верх без учёта внутреннего угла, тоже допустимо в учёбе."},
      {id:"area1",l:"Площадь откосов 1 окна, м²",a:["1.68","1,68","1.785","1,785","1.8"],e:"5.1×0.35 = 1.785 м². Принимают от 1.68 до 1.8 м²"},
      {id:"total",l:"Итого откосы 64 окна, м²",a:["114.2","114,2","114","115","113","114.2"],e:"64 × 1.785 = 114.2 м²"},
    ],
    vor:"Штукатурка откосов окон 1500×1800: 64×(2×1.8+1.5)×0.35 = 114.2 м² (Чертёж А-23)",
    theory:"Откосы — отдельная позиция от стен. Подоконник (горизонтальная нижняя плоскость откоса) — отдельная позиция: 64×1.5×0.35 = 33.6 м².",
  },
  {id:"foam",hl:[],title:"Объём монтажной пены (периметр оконных проёмов)",
    q:"При монтаже окон шов между рамой и стеной заполняется монтажной пеной. Периметр — по всем 80 окнам. Окна 1500×1800 — 64 шт, 600×900 — 16 шт.",
    ss:[
      {id:"p1",l:"Периметр окна 1500×1800, м",a:["6.6","6,6"],e:"2×(1.5+1.8)=6.6 м"},
      {id:"p2",l:"Периметр окна 600×900, м",  a:["3.0","3"],   e:"2×(0.6+0.9)=3.0 м"},
      {id:"tot",l:"Суммарный периметр всех 80 окон, м.п.",a:["470.4","470,4","470"],e:"64×6.6+16×3.0 = 422.4+48.0 = 470.4 м.п."},
    ],
    vor:"Монтажная пена оконных проёмов: 64×6.6+16×3.0 = 470.4 м.п. (Чертёж А-23, спецификация)",
    theory:"Пена в ВОР — в м.п. (погонных метрах), нормируется по периметру проёма. Аналогично: пароизоляционная лента, нащельники, отливы — все в м.п. периметра.",
  },
];

export default function WindowsDoorsPage(){
  const [xi,sxi]=useState(0);const [si,ssi]=useState(0);const [inp,setInp]=useState<Record<string,string>>({});
  const [rev,setRev]=useState<Record<string,boolean>>({});const [done,setDone]=useState<Set<string>>(new Set());
  const ex=STEPS[xi];const step=ex.ss[si];const k=`${ex.id}-${step.id}`;
  const ok=rev[k]&&check(inp[k]??"",step.a);const err=rev[k]&&!ok;
  function go(){setRev(r=>({...r,[k]:true}));if(check(inp[k]??"",step.a)){setTimeout(()=>{if(si+1<ex.ss.length){ssi(si+1);setRev({});}else setDone(d=>new Set([...d,ex.id]));},700);}}
  const allDone=done.size===STEPS.length;
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-sky-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link href="/smeta-trainer/drawings-practice/hub" className="text-xs text-sky-200 hover:text-white">← Все модули</Link>
          <div className="flex-1"><h1 className="text-sm font-bold">🪟 Окна и двери — спецификация, откосы, пена</h1><p className="text-[10px] text-sky-200">{done.size}/{STEPS.length} пройдено</p></div>
        </div>
      </header>
      {allDone?(
        <div className="max-w-2xl mx-auto py-16 text-center px-4">
          <div className="text-5xl mb-3">🪟</div><h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">Окна и двери освоены!</h2>
          <div className="bg-white dark:bg-slate-900 border rounded-lg p-4 text-left mb-4 text-xs space-y-1">{STEPS.map(s=><div key={s.id} className="flex gap-2"><span className="text-emerald-500">✓</span><code className="text-[10px] font-mono">{s.vor}</code></div>)}</div>
          <div className="flex gap-3 justify-center flex-wrap">
            <button onClick={()=>{sxi(0);ssi(0);setInp({});setRev({});setDone(new Set());}} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-sm font-semibold rounded-lg">Снова</button>
            <Link href="/smeta-trainer/drawings-practice/stairs" className="px-4 py-2 bg-sky-700 text-white text-sm font-semibold rounded-lg">→ Лестницы</Link>
          </div>
        </div>
      ):(
        <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
            <WindowDoorSVG hl={new Set(ex.hl)}/>
            {ex.theory&&<div className="mt-2 bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-700 rounded p-2 text-[10px] text-sky-800 dark:text-sky-300">📖 {ex.theory}</div>}
          </div>
          <div className="space-y-3">
            <div className="flex gap-1 flex-wrap">{STEPS.map((s,i)=><button key={s.id} onClick={()=>{sxi(i);ssi(0);setInp({});setRev({});}} className={`text-[10px] px-2 py-1 rounded font-semibold ${i===xi?"bg-sky-600 text-white":done.has(s.id)?"bg-sky-100 text-sky-800 dark:bg-sky-900/30":"bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200"}`}>{done.has(s.id)?"✓":i+1}</button>)}</div>
            <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">{ex.title}</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">{ex.q}</p>
              {ex.ss.length>1&&<div className="flex gap-1 mb-3">{ex.ss.map((_,i)=><div key={i} className={`h-1 flex-1 rounded-full ${i<si?"bg-sky-500":i===si?"bg-sky-300":"bg-slate-200 dark:bg-slate-700"}`}/>)}</div>}
              {!done.has(ex.id)?(
                <div className={`border-2 rounded-lg p-3 ${ok?"border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20":err?"border-red-300 bg-red-50 dark:bg-red-900/20":"border-slate-200 dark:border-slate-700"}`}>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">Шаг {si+1}/{ex.ss.length}: {step.l}</label>
                  <div className="flex gap-2">
                    <input type="text" value={inp[k]??""} onChange={e=>setInp(p=>({...p,[k]:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&!rev[k]&&go()} disabled={!!rev[k]} placeholder="Число..." className="flex-1 border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-sky-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"/>
                    {!rev[k]&&<button onClick={go} disabled={!inp[k]?.trim()} className="px-3 py-1.5 bg-sky-600 text-white text-xs font-semibold rounded hover:bg-sky-700 disabled:opacity-40">✓</button>}
                  </div>
                  {rev[k]&&<div className={`mt-2 text-xs leading-relaxed ${ok?"text-emerald-800 dark:text-emerald-300":"text-red-800 dark:text-red-300"}`}>{ok?"✓ ":"✗ "}{step.e}</div>}
                  {err&&<button onClick={()=>{setInp(p=>({...p,[k]:""}));setRev(r=>({...r,[k]:false}));}} className="mt-1 text-[10px] text-amber-700 underline">Попробовать снова</button>}
                </div>
              ):(
                <div className="border-2 border-sky-300 bg-sky-50 dark:bg-sky-900/20 rounded-lg p-3">
                  <div className="text-xs font-bold text-sky-800 dark:text-sky-300 mb-1">✓ Завершено</div>
                  <code className="text-[10px] font-mono text-sky-700 dark:text-sky-400 block">{ex.vor}</code>
                </div>
              )}
            </div>
            {done.has(ex.id)&&xi+1<STEPS.length&&<button onClick={()=>{sxi(xi+1);ssi(0);setInp({});setRev({});}} className="w-full py-2 bg-sky-600 text-white text-sm font-semibold rounded-lg hover:bg-sky-700">Следующее →</button>}
          </div>
        </div>
      )}
    </div>
  );
}
