"use client";
import Link from "next/link";
import { useState } from "react";

function check(i:string,a:string[]){const v=parseFloat(i.replace(",","."));return a.some(x=>{const e=parseFloat(x.replace(",","."));return!isNaN(v)&&!isNaN(e)&&Math.abs((v-e)/e)<0.025;});}

function FinishingSVG({hl}:{hl:Set<string>}){
  const OX=60,OY=40,W=300,H=220;
  const S=26;
  // Санузел: 2.4×3.0м
  const RW=2.4*S,RH=3.0*S;
  const GRID=0.3*S; // плитка 300×300

  return (
    <svg viewBox={`${OX-70} ${OY-55} 580 380`} className="w-full h-auto" style={{maxHeight:340}}>
      {/* Пол — плитка */}
      <g id="floor-tile">
        {Array.from({length:Math.ceil(RW/GRID)+1},(_,c)=>
          Array.from({length:Math.ceil(RH/GRID)+1},(_,r)=>{
            const tx=OX+c*GRID,ty=OY+r*GRID;
            if(tx>=OX+RW||ty>=OY+RH)return null;
            return <rect key={`${c}-${r}`} x={tx} y={ty}
              width={Math.min(GRID,OX+RW-tx)} height={Math.min(GRID,OY+RH-ty)}
              fill={hl.has("floor-tile")?"#d1fae5":"#f0fdf4"}
              stroke={hl.has("floor-tile")?"#059669":"#86efac"} strokeWidth={0.8}/>;
          })
        )}
        <rect x={OX} y={OY} width={RW} height={RH}
          fill="none" stroke={hl.has("floor-tile")?"#059669":"#64748b"} strokeWidth={hl.has("floor-tile")?2:1.5}/>
      </g>

      {/* Стены — плитка (показываем условно как полосы вокруг) */}
      {hl.has("wall-tile")&&(
        <>
          <rect x={OX-12} y={OY} width={12} height={RH} fill="#bfdbfe" stroke="#2563eb" strokeWidth={1}/>
          <rect x={OX+RW} y={OY} width={12} height={RH} fill="#bfdbfe" stroke="#2563eb" strokeWidth={1}/>
          <rect x={OX-12} y={OY-12} width={RW+24} height={12} fill="#bfdbfe" stroke="#2563eb" strokeWidth={1}/>
          <rect x={OX-12} y={OY+RH} width={RW+24} height={12} fill="#bfdbfe" stroke="#2563eb" strokeWidth={1}/>
          <text x={OX+RW+20} y={OY+RH/2+4} fontSize={9} fill="#1d4ed8">Стены</text>
        </>
      )}

      {/* Сантехника схематично */}
      <rect x={OX+RW-1.2*S} y={OY+RH-0.8*S} width={1.0*S} height={0.6*S} fill="#e0f2fe" stroke="#0284c7" strokeWidth={1}/>
      <text x={OX+RW-0.7*S} y={OY+RH-0.4*S} textAnchor="middle" fontSize={6} fill="#0284c7">ванна</text>
      <circle cx={OX+0.5*S} cy={OY+RH-0.6*S} r={0.4*S} fill="#e0f2fe" stroke="#0284c7" strokeWidth={1}/>
      <text x={OX+0.5*S} y={OY+RH-0.55*S} textAnchor="middle" fontSize={6} fill="#0284c7">WC</text>

      {/* Размеры */}
      <line x1={OX} y1={OY+RH+30} x2={OX+RW} y2={OY+RH+30} stroke="#94a3b8" strokeWidth={0.8}/>
      <text x={OX+RW/2} y={OY+RH+42} textAnchor="middle" fontSize={9} fill="#475569" fontStyle="italic">2.4 м</text>
      <line x1={OX-42} y1={OY} x2={OX-42} y2={OY+RH} stroke="#94a3b8" strokeWidth={0.8}/>
      <text x={OX-30} y={OY+RH/2+4} textAnchor="middle" fontSize={9} fill="#475569" fontStyle="italic" transform={`rotate(-90,${OX-30},${OY+RH/2+4})`}>3.0 м</text>

      {/* Плитка 300×300 */}
      <rect x={OX+RW+30} y={OY+20} width={GRID} height={GRID} fill={hl.has("floor-tile")?"#d1fae5":"#f0fdf4"} stroke={hl.has("floor-tile")?"#059669":"#86efac"} strokeWidth={1}/>
      <text x={OX+RW+42+GRID} y={OY+20+GRID/2+4} fontSize={8} fill="#475569">300×300 мм</text>

      {/* Коэффициент потерь */}
      {hl.has("waste")&&(
        <text x={OX+RW/2} y={OY+RH/2} textAnchor="middle" fontSize={11} fontWeight="700" fill="rgba(220,38,38,0.3)">+ 10% отходы</text>
      )}

      <text x={OX+RW/2} y={OY-40} textAnchor="middle" fontSize={10} fontWeight="600" fill="#1e293b">План санузла — раскладка плитки пола</text>
      <text x={OX+RW/2} y={OY-28} textAnchor="middle" fontSize={8} fill="#94a3b8" fontStyle="italic">М 1:20 · Санузел 2.4×3.0 м · Плитка 300×300 мм</text>
    </svg>
  );
}

const STEPS=[
  {id:"floor-tile",hl:["floor-tile"],title:"Площадь напольной плитки санузла",
    q:"Санузел 2.4×3.0 м. Рассчитайте площадь пола и количество плитки 300×300 мм с учётом коэффициента потерь 1.10.",
    ss:[
      {id:"area",  l:"Площадь пола, м²",             a:["7.2","7,2"],   e:"2.4 × 3.0 = 7.2 м²"},
      {id:"tiles", l:"Количество плиток без запаса",  a:["80"],           e:"7.2 м² / (0.3×0.3) = 7.2/0.09 = 80 шт"},
      {id:"total", l:"Количество с запасом 10%, шт",  a:["88"],           e:"80 × 1.10 = 88 шт"},
    ],
    vor:"Плитка пол санузел 300×300: 7.2 м² (88 шт с 10% запасом) (Чертёж А-42, ведомость отделки)",
    theory:"Запас на отходы: прямая раскладка = 5-7%; диагональная = 15-20%; сложный рисунок = до 25%. Для санузла 10% — стандарт.",
  },
  {id:"wall-tile",hl:["wall-tile"],title:"Площадь настенной плитки санузла",
    q:"Санузел 2.4×3.0 м, высота h=2.7 м. Плитка на стенах до потолка. Вычесть 1 дверь 0.9×2.1 м и 1 окно 0.6×0.9 м.",
    ss:[
      {id:"gross",l:"Площадь стен брутто, м²",   a:["14.58","14,58","14.6"],e:"2×(2.4+3.0)×2.7 = 2×5.4×2.7 = 29.16 м² — нет, это 4 стены: 2×(2.4+3.0)×2.7 = 29.16 м²"},
      {id:"open", l:"Площадь проёмов, м²",        a:["2.43","2,43"],e:"0.9×2.1 + 0.6×0.9 = 1.89+0.54 = 2.43 м²"},
      {id:"net",  l:"Площадь плитки стен нетто, м²",a:["26.73","26,73","26.7"],e:"29.16 − 2.43 = 26.73 м²"},
    ],
    vor:"Плитка стен санузел: 2×(2.4+3.0)×2.7 − (0.9×2.1+0.6×0.9) = 26.73 м² (Чертёж А-42, ведомость отделки)",
    theory:"Ведомость отделки помещений — специальная таблица в проекте, где для каждого типа помещения указан тип отделки. Многие сметчики берут площади из неё, не пересчитывая по чертежам.",
  },
  {id:"paint",hl:[],title:"Окраска потолков этажа",
    q:"Этаж школы: 32 класса по 51 м², 8 санузлов по 7.2 м², коридор 76.8 м², лестничная клетка 42 м². Рассчитайте суммарную площадь потолков под окраску водоэмульсионной краской.",
    ss:[
      {id:"class",l:"Классы: 32 × 51.0, м²",     a:["1632","1632.0"],  e:"32 × 51.0 = 1632.0 м²"},
      {id:"wc",   l:"Санузлы: 8 × 7.2, м²",       a:["57.6","57,6"],   e:"8 × 7.2 = 57.6 м²"},
      {id:"total",l:"Итого потолков на этаже, м²", a:["1808.4","1808,4","1808"],e:"1632.0+57.6+76.8+42.0 = 1808.4 м²"},
    ],
    vor:"Окраска потолков (1 этаж): 32×51.0+8×7.2+76.8+42.0 = 1808.4 м² (Чертёж А-42, ведомость отделки)",
    theory:"При 4 типовых этажах × 1808 м² = 7232 м². Нетиповой 1-й этаж — отдельный подсчёт. Итого: 7232 + отдельно 1-й этаж. Никогда не применяй 4 как коэф. ко всему зданию без анализа.",
  },
  {id:"grout",hl:[],title:"Затирка швов плитки — погонные метры",
    q:"Санузел: плитка пола 7.2 м², плитка стен 26.73 м². Размер плитки 300×300 мм. Погонные метры швов считают как периметр всех плиток / 2 (т.к. шов общий). Проще: на 1 м² плитки 300×300 приходится 6.67 м.п. швов.",
    ss:[
      {id:"total-s",l:"Суммарная площадь плитки (пол+стены), м²",a:["33.93","33,93","34"],e:"7.2+26.73 = 33.93 м²"},
      {id:"grout",  l:"Погонные метры швов, м.п.",                a:["226.3","226,3","226"],e:"33.93 × 6.67 = 226.3 м.п."},
    ],
    vor:"Затирка швов плитки 300×300: (7.2+26.73)×6.67 = 226.3 м.п. (Чертёж А-42)",
    theory:"Формула 6.67 м.п./м² — для плитки 300×300мм (шов 3мм): (1000/300)²×2×(300+300)/1000 × 1/2 → проще: 1/0.3 × 2 = 6.67 м.п./м². Для 600×600: 3.33 м.п./м².",
  },
  {id:"paint-walls",hl:[],title:"Окраска стен класса в 2 слоя",
    q:"Стены класса К-201 (уже считали): нетто 85.5 м². Краска наносится в 2 слоя, предварительно шпатлёвка 1 слой. Расход краски ВД-АК: 0.15 кг/м² на слой, шпатлёвки: 1.2 кг/м².",
    ss:[
      {id:"paint-kg",  l:"Расход краски на 2 слоя, кг", a:["25.65","25,65","25.7"],e:"85.5 × 0.15 × 2 = 25.65 кг"},
      {id:"shpatl-kg", l:"Расход шпатлёвки, кг",         a:["102.6","102,6","102.5","103"],e:"85.5 × 1.2 = 102.6 кг"},
    ],
    vor:"Шпатлёвка стен 1 сл: 85.5 м², краска ВД-АК 2 сл: 85.5 м²; расход: шп. 102.6 кг, кр. 25.65 кг (Чертёж А-42)",
    theory:"Расход материала в ВОР — информационная строка для МТО (снабжения). В ЛСР цена берётся из ССЦ за кг или м². Нормы расхода — из технической документации на материал.",
  },
];

export default function FinishingPage(){
  const [xi,sxi]=useState(0);const [si,ssi]=useState(0);const [inp,setInp]=useState<Record<string,string>>({});
  const [rev,setRev]=useState<Record<string,boolean>>({});const [done,setDone]=useState<Set<string>>(new Set());
  const ex=STEPS[xi];const step=ex.ss[si];const k=`${ex.id}-${step.id}`;
  const ok=rev[k]&&check(inp[k]??"",step.a);const err=rev[k]&&!ok;
  function go(){setRev(r=>({...r,[k]:true}));if(check(inp[k]??"",step.a)){setTimeout(()=>{if(si+1<ex.ss.length){ssi(si+1);setRev({});}else setDone(d=>new Set([...d,ex.id]));},700);}}
  const allDone=done.size===STEPS.length;
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-emerald-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link href="/smeta-trainer/drawings-practice/hub" className="text-xs text-emerald-200 hover:text-white">← Все модули</Link>
          <div className="flex-1"><h1 className="text-sm font-bold">🎨 Отделка — плитка, окраска, шпатлёвка</h1><p className="text-[10px] text-emerald-200">{done.size}/{STEPS.length} пройдено</p></div>
        </div>
      </header>
      {allDone?(
        <div className="max-w-2xl mx-auto py-16 text-center px-4">
          <div className="text-5xl mb-3">🎨</div><h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">Отделка освоена!</h2>
          <div className="bg-white dark:bg-slate-900 border rounded-lg p-4 text-left mb-4 text-xs space-y-1">{STEPS.map(s=><div key={s.id} className="flex gap-2"><span className="text-emerald-500">✓</span><code className="text-[10px] font-mono">{s.vor}</code></div>)}</div>
          <div className="flex gap-3 justify-center flex-wrap">
            <button onClick={()=>{sxi(0);ssi(0);setInp({});setRev({});setDone(new Set());}} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-sm font-semibold rounded-lg">Снова</button>
            <Link href="/smeta-trainer/drawings-practice/utilities" className="px-4 py-2 bg-emerald-700 text-white text-sm font-semibold rounded-lg">→ Инженерные системы</Link>
          </div>
        </div>
      ):(
        <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
            <FinishingSVG hl={new Set(ex.hl)}/>
            {ex.theory&&<div className="mt-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded p-2 text-[10px] text-emerald-800 dark:text-emerald-300">📖 {ex.theory}</div>}
          </div>
          <div className="space-y-3">
            <div className="flex gap-1 flex-wrap">{STEPS.map((s,i)=><button key={s.id} onClick={()=>{sxi(i);ssi(0);setInp({});setRev({});}} className={`text-[10px] px-2 py-1 rounded font-semibold ${i===xi?"bg-emerald-600 text-white":done.has(s.id)?"bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30":"bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200"}`}>{done.has(s.id)?"✓":i+1}</button>)}</div>
            <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">{ex.title}</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">{ex.q}</p>
              {ex.ss.length>1&&<div className="flex gap-1 mb-3">{ex.ss.map((_,i)=><div key={i} className={`h-1 flex-1 rounded-full ${i<si?"bg-emerald-500":i===si?"bg-emerald-300":"bg-slate-200 dark:bg-slate-700"}`}/>)}</div>}
              {!done.has(ex.id)?(
                <div className={`border-2 rounded-lg p-3 ${ok?"border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20":err?"border-red-300 bg-red-50 dark:bg-red-900/20":"border-slate-200 dark:border-slate-700"}`}>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">Шаг {si+1}/{ex.ss.length}: {step.l}</label>
                  <div className="flex gap-2">
                    <input type="text" value={inp[k]??""} onChange={e=>setInp(p=>({...p,[k]:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&!rev[k]&&go()} disabled={!!rev[k]} placeholder="Число..." className="flex-1 border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"/>
                    {!rev[k]&&<button onClick={go} disabled={!inp[k]?.trim()} className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded hover:bg-emerald-700 disabled:opacity-40">✓</button>}
                  </div>
                  {rev[k]&&<div className={`mt-2 text-xs leading-relaxed ${ok?"text-emerald-800 dark:text-emerald-300":"text-red-800 dark:text-red-300"}`}>{ok?"✓ ":"✗ "}{step.e}</div>}
                  {err&&<button onClick={()=>{setInp(p=>({...p,[k]:""}));setRev(r=>({...r,[k]:false}));}} className="mt-1 text-[10px] text-amber-700 underline">Попробовать снова</button>}
                </div>
              ):(
                <div className="border-2 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3">
                  <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 mb-1">✓ Завершено</div>
                  <code className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 block">{ex.vor}</code>
                </div>
              )}
            </div>
            {done.has(ex.id)&&xi+1<STEPS.length&&<button onClick={()=>{sxi(xi+1);ssi(0);setInp({});setRev({});}} className="w-full py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700">Следующее →</button>}
          </div>
        </div>
      )}
    </div>
  );
}
