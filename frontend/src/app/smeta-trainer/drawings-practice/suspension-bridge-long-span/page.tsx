"use client";
import Link from "next/link";
import { useState } from "react";

export default function SuspensionBridgeLongSpanPage() {
  const [ex1, setEx1] = useState(""); const [ex2, setEx2] = useState(""); const [ex3, setEx3] = useState(""); const [ex4, setEx4] = useState(""); const [showResults, setShowResults] = useState(false);
  const e2 = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const e2OK = !isNaN(e2) && Math.abs(e2 - 1200) <= 120;
  const e3 = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const e3OK = !isNaN(e3) && Math.abs(e3 - 420_000_000_000) <= 42_000_000_000;
  const ok = { ex1: ex1 === "d", ex2: e2OK, ex3: e3OK, ex4: ex4 === "c" };
  const score = Object.values(ok).filter(Boolean).length;
  const oc = (s: string, v: string, isok: boolean) => !showResults || s !== v ? (s === v ? "border-blue-500 bg-blue-500/20" : "border-slate-700 hover:border-slate-500") : isok ? "border-emerald-500 bg-emerald-500/20" : "border-rose-500 bg-rose-500/20";
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10"><div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between"><Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300">← К разделам</Link><div className="text-xs text-slate-500">Suspension Bridge — Long Span</div></div></header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section><h1 className="text-3xl md:text-4xl font-bold">🌉 Висячий мост (Long-Span Suspension Bridge)</h1>
          <p className="mt-3 text-slate-400 max-w-3xl">Модуль #307. Концепт «Yellow River Bridge» Алтай (предлагаемый), а также reference world records: Akashi Kaikyo Japan main span 1991 m (1998), 1915 Çanakkale Turkey 2023 m (2022), Great Belt Denmark 1624 m, Verrazzano-Narrows USA 1298 m, Golden Gate 1280 m. Suspension bridge — главный кабель из 30 000-50 000 high-tensile steel wires Ø5 mm draped over two pylons + hangers vertical to deck. Aerodynamic instability (Tacoma Narrows 1940) requires wind tunnel testing + truss/box girder design. AASHTO LRFD + Eurocode EN 1993 + СН РК 5.04-10.</p>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав bridge 1200 m main span</h2>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li>Pylons (towers) H=220 м ж/б B60 + steel frame composite, foundation caisson Ø40 м H=60 м;</li>
            <li>Main cable Ø600 мм parallel-wire strands PWS, 30 000 wires Ø5 мм high-tensile steel 1860 МПа, 90 strands × 333 wires each;</li>
            <li>Cable wrapping galvanized + paste для corrosion + 3-layer paint;</li>
            <li>Anchor block ж/б В60 50×40×30 м (60 000 т) embedded в подстилка через rock anchors;</li>
            <li>Hangers Ø100 мм Cu-coated high-strength steel rods 10-30 м spacing along main span;</li>
            <li>Deck steel orthotropic box-girder 35 m wide × 4.5 m high welded SM490 plate 14-25 мм;</li>
            <li>Aerodynamic shape — streamlined trapezoid через wind tunnel test scale 1:50 ChinaCAFE 2022;</li>
            <li>Stay cables for cable-stayed approach segments (если hybrid design);</li>
            <li>Tuned Mass Dampers TMD на pylon top 200-500 т suppress vortex shedding;</li>
            <li>Expansion joints Maurer XLN-1500 для 1500 мм movement summer-winter;</li>
            <li>Wind monitoring 6 anemometers Vaisala WMT700 каждые 200 м;</li>
            <li>Structural Health Monitoring SHM — 200+ strain gauges + accelerometers + displacement sensors;</li>
            <li>Cathodic protection ICCP anchor blocks + main cable + deck;</li>
            <li>Inspection gondola travel rail along underside deck для maintenance;</li>
            <li>Lighting + aviation warning red flashing on pylon top per ICAO Annex 14.</li>
          </ul>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Bridge type для 1200 m span</h2>
          <div className="space-y-2">{[
            { v: "a", t: "Beam bridge монолитный из ж/б — простой" },
            { v: "b", t: "Arch bridge как Старый Каирский" },
            { v: "c", t: "Truss bridge стальной" },
            { v: "d", t: "Suspension bridge с aerodynamic box-girder deck + TMD для 1200 m span: (1) только cable-stayed возможно до ~1000 м эффективно, suspension до 2000+ м (1915 Çanakkale 2023), (2) main cable parallel-wire 30 000 wires Ø5 мм high-tensile carry deck dead load + live load + wind, (3) aerodynamic box-girder streamlined shape minimises vortex shedding induced flutter (Tacoma Narrows lesson 1940), (4) wind tunnel testing scale 1:50-100 за 12-18 месяцев для verify critical wind speed > design + 30% safety, (5) TMD Tuned Mass Damper 200-500 т на pylon top для damping resonance frequencies; (6) anchor blocks ж/б 50 000-100 000 т соответствуют tensile force в кабеле ~1 ГН; AASHTO LRFD + Eurocode EN 1993" },
          ].map((o) => (<label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex1, o.v, ok.ex1)}`}><input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />{o.t}</label>))}</div>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Main span length</h2>
          <p className="text-slate-300">Для прохода судов Ø1000 m clearance + safety margin. Spam length (м)?</p>
          <input type="text" value={ex2} onChange={(e) => setEx2(e.target.value)} placeholder="м" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${ok.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p>1000 + 2×100 м clearance + 50 м margin ≈ <strong>1200 м main span</strong>. World-class long-span.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс 1200 m bridge</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>Pylons 2× H=220 м ж/б + steel composite + caisson foundation = 95 млрд</li>
            <li>Main cable 30 000 wires PWS + erection = 120 млрд</li>
            <li>Anchor blocks 2× 60 000 т ж/б + rock anchoring = 65 млрд</li>
            <li>Box-girder deck 1200 м × 35 м × 50 тыс. т steel SM490 = 75 млрд</li>
            <li>Hangers + saddles + dampers TMD = 18 млрд</li>
            <li>Wind tunnel + aerodynamic testing + SHM monitoring = 8 млрд</li>
            <li>Approach spans + expansion joints + lighting + safety + проект 6% + ESIA + PNR + insurance = 39 млрд</li>
          </ul>
          <input type="text" value={ex3} onChange={(e) => setEx3(e.target.value)} placeholder="тг" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${ok.ex3 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p><strong>~420 млрд тг (~$900M USD)</strong>. Akashi Kaikyo 1991 m = $4.3B (1998), цена per linear m ≈ $700K-1M.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Aeroelastic stability</h2>
          <div className="space-y-2">{[
            { v: "a", t: "Никакого учёта ветра" },
            { v: "b", t: "Только статический wind load" },
            { v: "c", t: "Comprehensive aerodynamic analysis per AASHTO LRFD + IABSE Wind Engineering: (1) wind tunnel testing scale 1:50-100 sectional model + full bridge aeroelastic model за 12-18 мес, critical wind speed flutter onset > design wind 150% safety margin, (2) box-girder shape streamlined trapezoid lessons learned Tacoma Narrows 1940 (плоское deck → vortex-induced flutter); (3) Tuned Mass Dampers TMD 200-500 т на pylon top tuned to dominant frequencies 1-2 Hz, suppress resonance, (4) buffeting analysis для random wind turbulence using power spectral density PSD; (5) galloping mode для cable structures; (6) full-scale wind monitoring 6 anemometers continuously, automatic shutdown bridge при wind >150 km/h; AASHTO LRFD + Eurocode EN 1993 + IABSE + JSCE + EN 1991-1-4 + СН РК 5.04-10" },
            { v: "d", t: "Закрыть мост при ветре" },
          ].map((o) => (<label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex4, o.v, ok.ex4)}`}><input type="radio" name="ex4" value={o.v} checked={ex4 === o.v} onChange={() => setEx4(o.v)} className="mr-3" />{o.t}</label>))}</div>
        </section>
        <button onClick={() => setShowResults(true)} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-lg font-semibold">Проверить ответы</button>
        {showResults && <section className={`p-6 rounded-xl border-2 ${score === 4 ? "border-emerald-500 bg-emerald-500/10" : score >= 2 ? "border-amber-500 bg-amber-500/10" : "border-rose-500 bg-rose-500/10"}`}><h2 className="text-2xl font-bold">Результат: {score} / 4</h2></section>}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3"><h2 className="text-xl font-semibold text-cyan-300">Нормативная база</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>AASHTO LRFD Bridge Design Specifications 9th</li>
            <li>Eurocode EN 1993-2 Steel Bridges</li>
            <li>EN 1991-1-4 Wind Loads on Structures</li>
            <li>JSCE Cable Stay Bridge Specifications</li>
            <li>IABSE Long-Span Cable Structures</li>
            <li>СН РК 5.04-10 Мосты</li>
            <li>FHWA Bridge Design Manual</li>
            <li>ASTM A586 — Bridge Strand Wire</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
