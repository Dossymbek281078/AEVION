"use client";
import Link from "next/link";
import { useState } from "react";

export default function LeaningTowerPage() {
  const [ex1, setEx1] = useState(""); const [ex2, setEx2] = useState(""); const [ex3, setEx3] = useState(""); const [ex4, setEx4] = useState(""); const [showResults, setShowResults] = useState(false);
  const e2 = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const e2OK = !isNaN(e2) && Math.abs(e2 - 18) <= 2;
  const e3 = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const e3OK = !isNaN(e3) && Math.abs(e3 - 35_000_000_000) <= 3_500_000_000;
  const ok = { ex1: ex1 === "d", ex2: e2OK, ex3: e3OK, ex4: ex4 === "c" };
  const score = Object.values(ok).filter(Boolean).length;
  const oc = (s: string, v: string, isok: boolean) => !showResults || s !== v ? (s === v ? "border-blue-500 bg-blue-500/20" : "border-slate-700 hover:border-slate-500") : isok ? "border-emerald-500 bg-emerald-500/20" : "border-rose-500 bg-rose-500/20";
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10"><div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between"><Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300">← К разделам</Link><div className="text-xs text-slate-500">Leaning Tower — Intentional Tilt</div></div></header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section><h1 className="text-3xl md:text-4xl font-bold">🗼 Башня с намеренным наклоном (Intentional Lean)</h1>
          <p className="mt-3 text-slate-400 max-w-3xl">Модуль #308. Архитектурно-туристическая башня-достопримечательность (концепт Astana / Алматы). Reference: Capital Gate Abu Dhabi (18° tilt vs Pisa 4° accidental), Gate of Europe Torres KIO Madrid (15°), Sloping Tower Wanaka NZ. Engineering challenge — eccentric load на foundation, requires diaphragm wall pile foundation, post-tensioned column system, finite element analysis ETABS / SAP2000. Wind load increased 30% per ASCE 7-22 для tilted geometry. Tuned Mass Damper TMD compensates lateral motion. ICC + ASCE 7-22 + СН РК 5.04-13.</p>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав leaning tower H=80 м tilt 15°</h2>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li>Foundation diaphragm wall H=30 м + 12-meter circular piles Bored Pile Ø1500 мм × 50 шт, для resistance eccentric moment 200 МН·м;</li>
            <li>Pile cap ж/б plate 40×40×3 м B45 + post-tensioned cables;</li>
            <li>Core wall ж/б B50 × 2 м thick на «high side» tilt (compression edge);</li>
            <li>Steel frame perimeter S690 high-strength + bolted moment connections;</li>
            <li>Floor slab post-tensioned ж/б 300 мм + perimeter beam 1.5 м high;</li>
            <li>Curtain wall double-glazed Schueco mullion structurally inclined;</li>
            <li>TMD Tuned Mass Damper 200-300 т на crown floor для damping lateral motion 0.1-0.3 Hz;</li>
            <li>Tilt monitoring 5 inclinometer Geokon + GPS surveying каждые 6 мес;</li>
            <li>Wind tunnel test scale 1:300 LDSWT-2 + aeroelastic full model 1:50;</li>
            <li>Lift Schindler 7000 inclined shaft + AGV-style track + tilting cabin platform для passenger comfort;</li>
            <li>Seismic isolation если зона 7-9 баллов (Almaty Алматы) — base isolator LRB Bridgestone;</li>
            <li>Fire safety pressurised stair core + sprinkler ESFR + emergency lighting EN 1838;</li>
            <li>Lightning protection IEC 62305 LPL-1 ESE early streamer emission air terminal;</li>
            <li>Tourism + observation deck 65 м high + restaurant + lift entrance hall;</li>
            <li>Foundation monitoring — strain gauge ANCS + piezometers + settlement plates каждые 3 мес.</li>
          </ul>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Foundation design</h2>
          <div className="space-y-2">{[
            { v: "a", t: "Обычная mat foundation - дешевле" },
            { v: "b", t: "Только bored piles без cap" },
            { v: "c", t: "Точечные ножки как Эйфелева" },
            { v: "d", t: "Diaphragm wall + bored pile group + post-tensioned cap для eccentric load 200 МН·м: (1) center of gravity offset 10-20 m от base center → 200 МН·м tipping moment, (2) diaphragm wall H=30 м perimeter resists overturning by passive earth pressure + uplift resistance, (3) 50 bored piles Ø1500 мм H=20 м carry vertical 200 МН + tension on uplift side; (4) post-tensioned cables in pile cap distribute eccentric load uniformly; (5) Capital Gate Abu Dhabi (18° world record) использует this exactly approach; (6) finite element analysis ETABS + SAP2000 + Plaxis 3D verifies soil-structure interaction; (7) construction sequence critical — install diaphragm wall first, then bored piles, then progressive deck construction maintain balance; (8) instrumentation — settlement plates + inclinometers + piezometers monitor real-time during + after construction. ICC + ASCE 7-22 + Eurocode 7" },
          ].map((o) => (<label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex1, o.v, ok.ex1)}`}><input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />{o.t}</label>))}</div>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Tilt angle (degrees)</h2>
          <p className="text-slate-300">Tower H=80 m, offset crown 25 m vs base. Tilt angle = arctan(offset/H):</p>
          <input type="text" value={ex2} onChange={(e) => setEx2(e.target.value)} placeholder="°" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${ok.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p>tan⁻¹(25/80) = 17.4° ≈ <strong>18°</strong>. Capital Gate Abu Dhabi 18°, world record.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс tower H=80 m</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>Foundation diaphragm wall + 50 bored piles Ø1.5 м + post-tensioned cap = 12 млрд</li>
            <li>Core wall ж/б B50 + steel frame S690 + composite columns = 9 млрд</li>
            <li>Floor slabs post-tensioned 25 floors × 1000 м² each = 5 млрд</li>
            <li>Curtain wall Schueco double glazed inclined = 3.5 млрд</li>
            <li>TMD 300 т + inclinometer monitoring + GPS surveying = 1.4 млрд</li>
            <li>Inclined lift Schindler + tilting cabin + AGV track = 1.2 млрд</li>
            <li>MEP + fire ESFR + lightning IEC 62305 + observation deck fit-out = 1.5 млрд</li>
            <li>Wind tunnel + ETABS analysis + сертификация + projecting 6% + PNR = 1.4 млрд</li>
          </ul>
          <input type="text" value={ex3} onChange={(e) => setEx3(e.target.value)} placeholder="тг" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${ok.ex3 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p><strong>~35 млрд тг (~$75M USD)</strong>. Capital Gate Abu Dhabi 35 floors $400M (2010); удельная ~$2000/м² (vs обычный $1000/м²).</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Tilt monitoring</h2>
          <div className="space-y-2">{[
            { v: "a", t: "Никакого мониторинга после строительства" },
            { v: "b", t: "Только годовая проверка" },
            { v: "c", t: "Continuous Structural Health Monitoring SHM per FEMA + ICC + EN 1991: (1) 5-10 inclinometers Geokon на crown + middle floors continuous record tilt drift, alarm at +0.1° от baseline; (2) GPS survey RTK pillars каждые 3 мес для absolute position verification; (3) strain gauges 200+ embedded в structural columns + post-tensioned cables tension monitoring; (4) piezometers + extensometers in foundation для settlement/pore pressure changes; (5) wind anemometers на crown for vortex shedding response; (6) accelerometer triax для seismic response + TMD effectiveness; (7) automated data acquisition Campbell CR6 + cloud upload + AI anomaly detection ML model; (8) quarterly reports to building owner + insurance + government; (9) Capital Gate lessons learned 2010-present — monitoring detected 5 mm settlement first year, stabilized с zero subsequent. FEMA + ICC IBC + ASCE 41 + EN 1991-1-4 + СН РК 5.04-13" },
            { v: "d", t: "Просто покрасить чтобы не ржавело" },
          ].map((o) => (<label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex4, o.v, ok.ex4)}`}><input type="radio" name="ex4" value={o.v} checked={ex4 === o.v} onChange={() => setEx4(o.v)} className="mr-3" />{o.t}</label>))}</div>
        </section>
        <button onClick={() => setShowResults(true)} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-lg font-semibold">Проверить ответы</button>
        {showResults && <section className={`p-6 rounded-xl border-2 ${score === 4 ? "border-emerald-500 bg-emerald-500/10" : score >= 2 ? "border-amber-500 bg-amber-500/10" : "border-rose-500 bg-rose-500/10"}`}><h2 className="text-2xl font-bold">Результат: {score} / 4</h2></section>}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3"><h2 className="text-xl font-semibold text-cyan-300">Нормативная база</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>ASCE 7-22 — Minimum Design Loads</li>
            <li>ASCE 41 — Seismic Evaluation</li>
            <li>ICC IBC International Building Code</li>
            <li>Eurocode 7 — Geotechnical Design</li>
            <li>EN 1991-1-4 — Wind Loads</li>
            <li>СН РК 5.04-13 — Бетонные и железобетонные конструкции</li>
            <li>СН РК 2.03-30 — Сейсмостойкое проектирование</li>
            <li>IEC 62305 — Protection against Lightning</li>
            <li>FEMA SHM Guide</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
