"use client";
import Link from "next/link";
import { useState } from "react";

export default function StormwaterDetentionTunnelPage() {
  const [ex1, setEx1] = useState(""); const [ex2, setEx2] = useState(""); const [ex3, setEx3] = useState(""); const [ex4, setEx4] = useState(""); const [showResults, setShowResults] = useState(false);
  const ex2N = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2OK = !isNaN(ex2N) && Math.abs(ex2N - 280_000) <= 28_000;
  const ex3N = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3OK = !isNaN(ex3N) && Math.abs(ex3N - 22_000_000_000) <= 2_200_000_000;
  const correct = { ex1: ex1 === "d", ex2: ex2OK, ex3: ex3OK, ex4: ex4 === "c" };
  const score = Object.values(correct).filter(Boolean).length;
  const oc = (s: string, v: string, ok: boolean) => !showResults || s !== v ? (s === v ? "border-blue-500 bg-blue-500/20" : "border-slate-700 hover:border-slate-500") : ok ? "border-emerald-500 bg-emerald-500/20" : "border-rose-500 bg-rose-500/20";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10"><div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between"><Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300">← К разделам</Link><div className="text-xs text-slate-500">Stormwater Detention</div></div></header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section><h1 className="text-3xl md:text-4xl font-bold">🌧️ Stormwater Detention Tunnel — городское ливневое</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">Модуль #304. Алматы 2024 наводнение Тысячелетие (350 м³/с peak) → план мегатоннеля ливневой канализации под город (cathedral-style TBM Robbins Ø8 м × 12 км под главными бульварами). Reference: Tokyo G-Cans Underground Discharge Channel (50 м H × 177 м wide × 5 chambers underground), Hong Kong WHHDS, London Lee Tunnel + Thames Tideway, Chicago TARP (175 mi tunnels). Detention buffers stormwater peak до treatment plant capacity 50-100 м³/с, prevents flooding city + combined sewer overflow CSO. ASCE Stormwater BMP + EPA Best Practices + СНиП 2.04.03.</p>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3"><h2 className="text-xl font-semibold text-emerald-300">1. Состав detention tunnel Ø8 м × 10 км</h2>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>TBM Tunnel Boring Machine:</strong> Robbins EPB Ø8.5 м внутренний rotating cutter head + slurry support, 1500 кВт + tail shield + segment installer, скорость 10-15 м/сут;</li>
            <li><strong>Pre-cast concrete segments:</strong> 6 segments/ring × 1.5 м length × 400 мм thick B45 W12 + reinforcement, gasket EPDM Sealtech B40 для watertightness;</li>
            <li><strong>Tunnel cross-section:</strong> Ø8 м internal diameter ⇒ flow area 50 м², capacity 300 м³/с при velocity 6 м/с (manning n=0.013 concrete);</li>
            <li><strong>Drop shafts:</strong> 15-20 vertical drop shafts Ø3-5 м H=40-60 м на каждом интерсекшн с street drains, energy dissipation vortex/spiral design ICOLD;</li>
            <li><strong>Inlet control structures:</strong> grit chambers + bar racks 50 мм mesh, debris removal перед tunnel inlet, mechanical raking;</li>
            <li><strong>Tunnel ventilation:</strong> exhaust fan stations Ø5 м axial fan × 4 шт + intake shafts, для prevent buildup H2S при stagnant water (sewer integrated);</li>
            <li><strong>Storage capacity:</strong> 10 km × 50 м² × 0.8 useable = 400 000 м³ live storage (для 4-hour 100-year storm event);</li>
            <li><strong>Pump station discharge:</strong> 12 vertical pumps Sulzer SMD 25 000 м³/час × 30 м H + VFD ABB, total capacity 100 м³/с к treatment plant;</li>
            <li><strong>Treatment-grade effluent:</strong> screening + grit removal + sand filter + UV disinfection для combined sewer storm overflow;</li>
            <li><strong>Pump station building:</strong> ж/б underground 50×30×15 м с emergency egress shafts;</li>
            <li><strong>Manhole access:</strong> 30-50 vertical access shafts Ø4 м H=40 м для maintenance + inspection;</li>
            <li><strong>Cathodic protection:</strong> ICCP MMO-аноды на reinforcement bars (corrosion от sulfides);</li>
            <li><strong>Real-time monitoring:</strong> level sensors каждые 200 м + flow meters Endress+Hauser Promag + CCTV cameras 100 шт, integrated в city SCADA;</li>
            <li><strong>Hydraulic model:</strong> InfoWorks ICM software для real-time storm tracking + automatic gate operations;</li>
            <li><strong>Sustainability/Green Infrastructure:</strong> integration с green roofs + permeable pavement + bio-retention swales для reduce inflow.</li>
          </ul>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Tunnel vs surface stormwater</h2>
          <div className="space-y-2">{[
            { v: "a", t: "Surface канавы — дешевле" },
            { v: "b", t: "Только дренаж под дорогами" },
            { v: "c", t: "Pumping везде" },
            { v: "d", t: "Detention tunnel Ø8 м для megacity dense urban + climate change extreme rainfall: (1) capacity 400 000 м³ buffer vs surface канавы 5-10 м³/100 м, (2) hydrosphere буферирует 100-year storm event (350 м³/с Алматы 2024) распределяя на 4-12 часов discharge к WWTP @ 50-100 м³/с, (3) underground = no surface land use conflict в city centre, (4) gravity flow + minimal pumping, (5) combined sewer overflow CSO prevention важно для combined sewer system (хотя Алматы separated), (6) TBM Robbins построение быстрее open-cut 5-7x, (7) maintained service life 100+ лет ж/б B45 W12 + ICCP. Reference Tokyo G-Cans + Chicago TARP + London Thames Tideway. ASCE Stormwater BMP + EPA Best Practices" },
          ].map((o) => (<label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex1, o.v, correct.ex1)}`}><input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />{o.t}</label>))}</div>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Объём storage</h2>
          <p className="text-slate-300">Tunnel Ø8 м × 10 км. Useable fraction 70% (gravity flow + air gap). Объём (м³)?</p>
          <input type="text" value={ex2} onChange={(e) => setEx2(e.target.value)} placeholder="м³" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${correct.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p>Площадь = π(8/2)² = 50.3 м². V = 50.3 × 10 000 × 0.7 = <strong>~280 000 м³</strong>. Покрывает 1-hr 100-year storm event 300 м³/с × 1 hr × 50% peak factor.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс tunnel</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>TBM Robbins EPB Ø8.5 м lease + boring 10 км × 1.5 млрд тг/км = 15 млрд</li>
            <li>Pre-cast segments B45 W12 + gasket = 2.2 млрд</li>
            <li>Drop shafts 20 × Ø3-5 м H=50 м = 1.8 млрд</li>
            <li>Pump station 12× Sulzer SMD 25 000 м³/ч + ВНС underground = 1.4 млрд</li>
            <li>Ventilation fans + manholes + access shafts = 0.6 млрд</li>
            <li>SCADA + InfoWorks ICM + monitoring = 0.4 млрд</li>
            <li>Cathodic protection ICCP + проектирование 5% + ПИР + PNR + страхование = 0.6 млрд</li>
          </ul>
          <input type="text" value={ex3} onChange={(e) => setEx3(e.target.value)} placeholder="тг" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${correct.ex3 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p><strong>~22 млрд тг (~$47M USD)</strong> на 10 км Ø8 м detention tunnel. Удельная — $4700/м tunnel. Тоже сэкономит $10-50M в damage prevention per major flood event.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — H2S corrosion</h2>
          <div className="space-y-2">{[
            { v: "a", t: "Никакой проблемы" },
            { v: "b", t: "Только концентрация oxygen control" },
            { v: "c", t: "H2S corrosion + sulfide aggression — sewer concrete corrosion: (1) stagnant water в tunnel anaerobic conditions → sulfate-reducing bacteria SRB Desulfovibrio convert SO4²⁻ → H2S, (2) H2S oxidises на crown ceiling concrete → H2SO4 sulfuric acid attack pH<1 → spalling 5-10 mm/year, (3) prevention measures: (a) high-density B45 W12 SS-resistant calcium aluminate cement liner Calcia / Densit 10-20 mm crown coating, (b) sodium hypochlorite NaOCl injection 1-2 mg/L при low-flow для oxidising H2S, (c) iron salts FeCl2 dosing для precipitating sulfide as FeS, (d) forced ventilation fans reduce H2S accumulation, (e) cathodic protection ICCP на reinforcement bars; ACI 313 + ASCE MOP 60 + WEF Sewer System Asset Management" },
            { v: "d", t: "Просто заменять трубы" },
          ].map((o) => (<label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex4, o.v, correct.ex4)}`}><input type="radio" name="ex4" value={o.v} checked={ex4 === o.v} onChange={() => setEx4(o.v)} className="mr-3" />{o.t}</label>))}</div>
        </section>
        <button onClick={() => setShowResults(true)} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-lg font-semibold">Проверить ответы</button>
        {showResults && <section className={`p-6 rounded-xl border-2 ${score === 4 ? "border-emerald-500 bg-emerald-500/10" : score >= 2 ? "border-amber-500 bg-amber-500/10" : "border-rose-500 bg-rose-500/10"}`}><h2 className="text-2xl font-bold">Результат: {score} / 4</h2></section>}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3"><h2 className="text-xl font-semibold text-cyan-300">Нормативная база</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li><strong>ASCE Stormwater BMP Standards</strong></li>
            <li><strong>EPA Stormwater Management Best Practices</strong></li>
            <li><strong>ACI 313</strong> — Standard Concrete Pipe</li>
            <li><strong>ASCE MOP 60</strong> — Gravity Sanitary Sewer Design</li>
            <li><strong>WEF Sewer System Asset Management</strong></li>
            <li><strong>СНиП 2.04.03-85</strong> — Канализация наружные сети</li>
            <li><strong>СН РК 4.01-03</strong> — Канализационные ОС</li>
            <li><strong>InfoWorks ICM</strong> — Hydraulic modeling software</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
