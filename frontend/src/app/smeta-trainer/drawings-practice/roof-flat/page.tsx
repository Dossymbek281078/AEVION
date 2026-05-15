"use client";
import Link from "next/link";
import { useState } from "react";

function check(i:string,a:string[]){const v=parseFloat(i.replace(",","."));return a.some(x=>{const e=parseFloat(x.replace(",","."));return!isNaN(v)&&!isNaN(e)&&Math.abs((v-e)/e)<0.025;});}

function RoofFlatSVG({hl}:{hl:Set<string>}){
  const OX=60,OY=60,W=320;
  // Узел плоской кровли: слои снизу вверх
  const layers=[
    {id:"slab",     h:22, label:"Ж/б плита перекрытия (220 мм)",   fill:"#e2e8f0",stroke:"#64748b"},
    {id:"vb",       h:4,  label:"Пароизоляция ПВХ",                 fill:"#e0e7ff",stroke:"#6366f1"},
    {id:"insul",    h:36, label:"Утеплитель PIR 150 мм",             fill:hl.has("insul-area")?"#a7f3d0":"#d1fae5",stroke:hl.has("insul-area")?"#059669":"#6ee7b7"},
    {id:"slope",    h:12, label:"Стяжка уклонообр. 20-80 мм (ср.50)",fill:"#e2e8f0",stroke:"#94a3b8"},
    {id:"membrane", h:4,  label:"Мембрана ПВХ 1.5 мм",               fill:hl.has("membrane")?"#bfdbfe":"#dbeafe",stroke:hl.has("membrane")?"#2563eb":"#93c5fd"},
    {id:"gravel",   h:10, label:"Галька пригрузочная 50 мм",          fill:"#d4b483",stroke:"#92400e"},
  ];
  let curY=OY;
  return (
    <svg viewBox={`${OX-70} ${OY-60} 580 340`} className="w-full h-auto" style={{maxHeight:320}}>
      {/* Парапет слева */}
      <rect x={OX-50} y={OY-40} width={30} height={130} fill="#fef9c3" stroke="#ca8a04" strokeWidth={1}/>
      <text x={OX-35} y={OY-48} textAnchor="middle" fontSize={8} fill="#92400e">Парапет</text>
      {/* Парапет справа */}
      <rect x={OX+W+20} y={OY-40} width={30} height={130} fill="#fef9c3" stroke="#ca8a04" strokeWidth={1}/>

      {layers.map(l=>{
        const ly=curY;curY+=l.h;
        return (
          <g key={l.id}>
            <rect x={OX} y={ly} width={W} height={l.h} fill={l.fill} stroke={l.stroke} strokeWidth={1}/>
            <text x={OX+W+24} y={ly+l.h/2+3} fontSize={8} fill="#475569">{l.label}</text>
            {l.h>6&&<text x={OX+W/2} y={ly+l.h/2+3} textAnchor="middle" fontSize={7} fill="#94a3b8" fontStyle="italic">{l.label.split("(")[0].trim()}</text>}
          </g>
        );
      })}

      {/* Слив — воронка */}
      <ellipse cx={OX+W/3} cy={OY+22+4+36+12} rx={8} ry={4} fill="#60a5fa" stroke="#2563eb" strokeWidth={1}/>
      <line x1={OX+W/3} y1={OY+22+4+36+12+4} x2={OX+W/3} y2={OY+22+4+36+12+30} stroke="#2563eb" strokeWidth={1.5}/>
      <text x={OX+W/3} y={OY+22+4+36+12+42} textAnchor="middle" fontSize={8} fill="#2563eb">Воронка Ø100</text>

      {/* Размеры */}
      <line x1={OX} y1={curY+30} x2={OX+W} y2={curY+30} stroke="#94a3b8" strokeWidth={0.8}/>
      <text x={OX+W/2} y={curY+42} textAnchor="middle" fontSize={9} fill="#475569" fontStyle="italic">34.0 м (ширина здания)</text>
      <line x1={OX-55} y1={OY} x2={OX-55} y2={curY} stroke="#94a3b8" strokeWidth={0.8}/>
      <text x={OX-45} y={(OY+curY)/2+4} textAnchor="middle" fontSize={8} fill="#475569" fontStyle="italic" transform={`rotate(-90,${OX-45},${(OY+curY)/2+4})`}>300 мм (пирог)</text>

      <text x={OX+W/2} y={OY-45} textAnchor="middle" fontSize={10} fontWeight="600" fill="#1e293b">Узел плоской кровли (инверсионная)</text>
      <text x={OX+W/2} y={OY-33} textAnchor="middle" fontSize={8} fill="#94a3b8" fontStyle="italic">М 1:20 · {hl.has("insul-area")?"утеплитель":hl.has("membrane")?"мембрана":"Разрез К-1"} · Школа №47</text>
    </svg>
  );
}

const STEPS=[
  {id:"roof-area",hl:[],title:"Площадь плоской кровли",q:"Размер кровли в плане: 34.0×16.0 м. Воронки и трубы: площадь не вычитается (≤0.1 м² каждая). Рассчитайте площадь кровли.",
    ss:[{id:"a",l:"Площадь кровли, м²",a:["544","544.0"],e:"34.0 × 16.0 = 544.0 м²"}],
    vor:"Кровля плоская (все слои): 34.0×16.0 = 544.0 м² (Чертёж А-30)",
    theory:"Плоская кровля считается по горизонтальной проекции. Парапет — отдельная позиция (вертикальная). Водоприёмные воронки не вычитаются.",
  },
  {id:"insul",hl:["insul-area"],title:"Площадь утеплителя (PIR 150 мм)",q:"Утеплитель укладывается на всю площадь кровли между парапетами. Парапеты — 0.38 м с каждой стороны. Рассчитайте площадь утеплителя.",
    ss:[
      {id:"l",l:"Длина по внутренним граням парапетов, м",a:["33.24","33,24","33.2"],e:"34.0 − 2×0.38 = 33.24 м"},
      {id:"b",l:"Ширина по внутренним граням, м",          a:["15.24","15,24","15.2"],e:"16.0 − 2×0.38 = 15.24 м"},
      {id:"s",l:"Площадь утеплителя, м²",                   a:["506.5","506,5","507","506"],e:"33.24 × 15.24 = 506.6 м²"},
    ],
    vor:"Утеплитель PIR-150 кровля: (34.0−2×0.38)×(16.0−2×0.38) = 506.6 м² (Чертёж А-30)",
    theory:"Утеплитель не заходит на парапет — делается отдельный клин-компенсатор примыкания. Поэтому площадь меньше горизонтальной проекции на ширину парапетов.",
  },
  {id:"parapet",hl:[],title:"Площадь парапета (гидроизоляция примыкания)",q:"Парапет: высота 0.60 м, периметр по внешней грани 2×(34.0+16.0)=100.0 м. Мембрана заворачивается на парапет снаружи.",
    ss:[
      {id:"perim",l:"Периметр парапета, м",          a:["100","100.0"],e:"2×(34.0+16.0) = 100.0 м"},
      {id:"area", l:"Площадь обклейки парапета, м²", a:["60","60.0"],e:"100.0 × 0.60 = 60.0 м²"},
    ],
    vor:"Г/И примыкание мембр. к парапету: 2×(34.0+16.0)×0.60 = 60.0 м² (Чертёж А-30, узел К-1)",
    theory:"Примыкание к парапету — обязательная отдельная позиция. Высота заворота нормируется (обычно от 250 мм выше уровня кровли). Углы парапета — дополнительные полотна.",
  },
  {id:"drains",hl:[],title:"Количество водоприёмных воронок",q:"Плоская кровля 544 м². По СП РК нормируется 1 воронка на 200-400 м². Архитектор принял 3 воронки Ø100 мм. Рассчитайте трубопровод внутреннего водостока от каждой воронки до выхода (h_этаж=3.2м × 4 эт = 12.8 м).",
    ss:[
      {id:"qty",  l:"Количество воронок, шт",              a:["3"],   e:"3 воронки (по проекту, 1 на ~181 м²)"},
      {id:"pipe", l:"Труба на одну воронку Ø110, м",        a:["12.8","12,8"],e:"12.8 м (вертикаль от кровли до 1-го этажа)"},
      {id:"total",l:"Итого труба внутренний водосток, м.п.",a:["38.4","38,4"],e:"3 × 12.8 = 38.4 м.п. (без горизонтальных участков)"},
    ],
    vor:"Водоприёмная воронка кровельная: 3 шт; Труба Ø110 ПВХ: 3×12.8 = 38.4 м.п. (Чертёж А-30+С-01)",
    theory:"Внутренний водосток: воронки → стояки → отводной трубопровод → выход в ливневую канализацию. Горизонтальные участки — отдельный расчёт по схеме канализации.",
  },
];

export default function RoofFlatPage(){
  const [xi,sxi]=useState(0);const [si,ssi]=useState(0);const [inp,setInp]=useState<Record<string,string>>({});
  const [rev,setRev]=useState<Record<string,boolean>>({});const [done,setDone]=useState<Set<string>>(new Set());
  const ex=STEPS[xi];const step=ex.ss[si];const k=`${ex.id}-${step.id}`;
  const ok=rev[k]&&check(inp[k]??"",step.a);const err=rev[k]&&!ok;
  function go(){setRev(r=>({...r,[k]:true}));if(check(inp[k]??"",step.a)){setTimeout(()=>{if(si+1<ex.ss.length){ssi(si+1);setRev({});}else setDone(d=>new Set([...d,ex.id]));},700);}}
  const allDone=done.size===STEPS.length;
  const C="bg-blue-600";
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-blue-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link href="/smeta-trainer/drawings-practice/hub" className="text-xs text-blue-200 hover:text-white">← Все модули</Link>
          <div className="flex-1"><h1 className="text-sm font-bold">🏠 Кровля плоская — пирог, утеплитель, водосток</h1><p className="text-[10px] text-blue-200">{done.size}/{STEPS.length} пройдено</p></div>
        </div>
      </header>
      {allDone?(
        <div className="max-w-2xl mx-auto py-16 text-center px-4">
          <div className="text-5xl mb-3">🏠</div><h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">Кровля освоена!</h2>
          <div className="bg-white dark:bg-slate-900 border rounded-lg p-4 text-left mb-4 text-xs space-y-1">{STEPS.map(s=><div key={s.id} className="flex gap-2"><span className="text-emerald-500">✓</span><code className="text-[10px] font-mono">{s.vor}</code></div>)}</div>
          <div className="flex gap-3 justify-center flex-wrap">
            <button onClick={()=>{sxi(0);ssi(0);setInp({});setRev({});setDone(new Set());}} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-sm font-semibold rounded-lg">Снова</button>
            <Link href="/smeta-trainer/drawings-practice/windows-doors" className="px-4 py-2 bg-blue-700 text-white text-sm font-semibold rounded-lg">→ Окна и двери</Link>
          </div>
        </div>
      ):(
        <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
            <RoofFlatSVG hl={new Set(ex.hl)}/>
            {ex.theory&&<div className="mt-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded p-2 text-[10px] text-blue-800 dark:text-blue-300">📖 {ex.theory}</div>}
          </div>
          <div className="space-y-3">
            <div className="flex gap-1 flex-wrap">{STEPS.map((s,i)=><button key={s.id} onClick={()=>{sxi(i);ssi(0);setInp({});setRev({});}} className={`text-[10px] px-2 py-1 rounded font-semibold ${i===xi?C+" text-white":done.has(s.id)?"bg-blue-100 text-blue-800 dark:bg-blue-900/30":"bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200"}`}>{done.has(s.id)?"✓":i+1}</button>)}</div>
            <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">{ex.title}</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">{ex.q}</p>
              {ex.ss.length>1&&<div className="flex gap-1 mb-3">{ex.ss.map((_,i)=><div key={i} className={`h-1 flex-1 rounded-full ${i<si?"bg-blue-500":i===si?"bg-blue-300":"bg-slate-200 dark:bg-slate-700"}`}/>)}</div>}
              {!done.has(ex.id)?(
                <div className={`border-2 rounded-lg p-3 ${ok?"border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20":err?"border-red-300 bg-red-50 dark:bg-red-900/20":"border-slate-200 dark:border-slate-700"}`}>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">Шаг {si+1}/{ex.ss.length}: {step.l}</label>
                  <div className="flex gap-2">
                    <input type="text" value={inp[k]??""} onChange={e=>setInp(p=>({...p,[k]:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&!rev[k]&&go()} disabled={!!rev[k]} placeholder="Число..." className="flex-1 border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"/>
                    {!rev[k]&&<button onClick={go} disabled={!inp[k]?.trim()} className={`px-3 py-1.5 ${C} text-white text-xs font-semibold rounded hover:bg-blue-700 disabled:opacity-40`}>✓</button>}
                  </div>
                  {rev[k]&&<div className={`mt-2 text-xs leading-relaxed ${ok?"text-emerald-800 dark:text-emerald-300":"text-red-800 dark:text-red-300"}`}>{ok?"✓ ":"✗ "}{step.e}</div>}
                  {err&&<button onClick={()=>{setInp(p=>({...p,[k]:""}));setRev(r=>({...r,[k]:false}));}} className="mt-1 text-[10px] text-amber-700 underline">Попробовать снова</button>}
                </div>
              ):(
                <div className="border-2 border-blue-300 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                  <div className="text-xs font-bold text-blue-800 dark:text-blue-300 mb-1">✓ Завершено</div>
                  <code className="text-[10px] font-mono text-blue-700 dark:text-blue-400 block">{ex.vor}</code>
                </div>
              )}
            </div>
            {done.has(ex.id)&&xi+1<STEPS.length&&<button onClick={()=>{sxi(xi+1);ssi(0);setInp({});setRev({});}} className={`w-full py-2 ${C} text-white text-sm font-semibold rounded-lg hover:bg-blue-700`}>Следующее →</button>}
          </div>
        </div>
      )}
    </div>
  );
}
