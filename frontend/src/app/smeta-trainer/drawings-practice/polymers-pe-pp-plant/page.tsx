"use client";
import Link from "next/link";
import { useState } from "react";

export default function PolymersPePpPlantPage() {
  const [ex1, setEx1] = useState("");
  const [ex2, setEx2] = useState("");
  const [ex3, setEx3] = useState("");
  const [ex4, setEx4] = useState("");
  const [showResults, setShowResults] = useState(false);
  const ex2N = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2OK = !isNaN(ex2N) && Math.abs(ex2N - 95) <= 10;
  const ex3N = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3OK = !isNaN(ex3N) && Math.abs(ex3N - 380_000_000_000) <= 38_000_000_000;
  const correct = { ex1: ex1 === "d", ex2: ex2OK, ex3: ex3OK, ex4: ex4 === "c" };
  const score = Object.values(correct).filter(Boolean).length;
  const oc = (s: string, v: string, ok: boolean) => !showResults || s !== v ? (s === v ? "border-blue-500 bg-blue-500/20" : "border-slate-700 hover:border-slate-500") : ok ? "border-emerald-500 bg-emerald-500/20" : "border-rose-500 bg-rose-500/20";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300 hover:text-blue-200">← К разделам</Link>
          <div className="text-xs text-slate-500">PE/PP Polymerization Plant</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold">🧴 PE/PP — Polyethylene + Polypropylene</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #302. КазМунайГаз GPC Атырау — план polypropylene 500 кт/год
            + polyethylene HDPE 400 кт/год (после ethylene cracker). Технологии:
            INEOS Innovene G gas-phase fluidized bed (HDPE) + LyondellBasell
            Spheripol or Hostalen (PP). Catalysts — Ziegler-Natta (Ti-Al
            organometallic) + metallocene Mt-Cp2 single-site high-tacticity.
            Polymer grades — HDPE blow-molding (Hostalen ACP6541), LLDPE
            film extrusion, PP injection moulding (Borealis BJ300MO),
            PP fiber (Borealis HC205TF) для нетканых масок и автомобильных
            тканей. EU IED BAT Polymers + ASTM D1898 + ISO 1872 + СН РК 4.04-15.
          </p>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав HDPE plant 400 кт/год Innovene G</h2>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Feed preparation:</strong> ethylene 99.95% + comonomer (1-butene или 1-hexene) для LLDPE, hydrogen для molecular weight control;</li>
            <li><strong>Catalyst preparation:</strong> Ziegler-Natta TiCl4/MgCl2 на silica support OR metallocene Cp2ZrCl2 со MAO co-catalyst (methylaluminoxane), prep в N2-glove box;</li>
            <li><strong>Polymerization reactor:</strong> fluidized bed gas-phase Ø4.5 м H=12 м UCC Innovene G design, 80-90 °C × 25 бар, ethylene partial pressure 8-15 бар, gas velocity 0.5-1.0 м/с;</li>
            <li><strong>Bed inventory:</strong> 30-50 т polymer powder в fluidized bed, residence time 1-3 h, productivity 25-40 кг PE/g catalyst;</li>
            <li><strong>Heat removal:</strong> external loop heat exchanger + recycle gas cooler 40 МВт thermal (heat of polymerization 3500 кДж/кг ethylene);</li>
            <li><strong>Powder discharge:</strong> rotary valve + cyclones separate polymer powder from recycle gas, transfer к degassing column;</li>
            <li><strong>Degassing column:</strong> N2 stripping removes residual hydrocarbons + comonomer от polymer powder, output к extrusion;</li>
            <li><strong>Extruder/Pelletizer:</strong> twin-screw Coperion ZSK 350 mm + underwater pelletizer Gala UMP 1000, output PE pellets Ø3-5 мм производительность 100 т/час;</li>
            <li><strong>Additive package:</strong> antioxidant Irganox 1010 + Irgafos 168 + stearate carrier + slip agent + UV stabilizer Tinuvin, dosed via Diosna gravimetric blender;</li>
            <li><strong>Dryer + silo:</strong> centrifugal dryer для surface water + 4-6 storage silos × 2000 т каждый, N2 blanket для prevent dust explosion;</li>
            <li><strong>Bagging line:</strong> automated 25 kg bag filler + palletizer + stretch wrap для container shipment к customers;</li>
            <li><strong>Bulk loading:</strong> railcar rotary loader 100 т/час + truck bulk loader для domestic delivery;</li>
            <li><strong>QC lab:</strong> melt flow index MFI Tinius Olsen + density Mettler + GPC Agilent для molecular weight + DSC Mettler для crystallinity;</li>
            <li><strong>Flare + emergency relief:</strong> elevated flare 80 м для emergency relief при reactor runaway (high-MW polymer fouling);</li>
            <li><strong>DCS Honeywell Experion + emergency stop:</strong> reactor isolated через 6 SS valves в 30 sec при abnormal pressure/temperature.</li>
          </ul>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Process selection HDPE</h2>
          <div className="space-y-2">
            {[
              { v: "a", t: "Solution polymerization в hexane — устарело" },
              { v: "b", t: "Slurry polymerization в loop reactor — для HDPE narrow MWD" },
              { v: "c", t: "Только bulk autoclave high-pressure" },
              { v: "d", t: "Gas-phase fluidized bed Innovene G UCC/INEOS для HDPE/LLDPE: (1) Ziegler-Natta TiCl4/MgCl2 или metallocene catalyst на silica, productivity 25-40 кг PE/g cat, (2) fluidized bed Ø4.5 м H=12 м 80-90 °C × 25 бар gas-phase, no slurry/solution = no solvent recovery = simpler + cheaper, (3) heat of polymerization removed via external recycle gas cooler 40 МВт, (4) residence time 1-3 h, granular polymer 0.3-0.5 мм size, (5) Innovene G supports multi-modal MWD через staged reactors (bimodal HDPE для pipe applications), (6) capital cost 30-40% lower than slurry, (7) operational simplicity + reduced solvent inventory = safer EHS profile. Licensed by INEOS Technologies, deployed >50 plants worldwide; alternative Spherilene LyondellBasell или CB-Stamicarbon. EU IED BAT Polymers + ASTM D1898" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />{o.t}
              </label>
            ))}
          </div>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Ethylene conversion</h2>
          <p className="text-slate-300">HDPE plant 400 кт/год @ ethylene conversion 95% per pass + 99% overall (recycle). Расход ethylene (кт/год)?</p>
          <input type="text" value={ex2} onChange={(e) => setEx2(e.target.value)} placeholder="кт/год" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${correct.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p>400 / 0.99 + ~5% comonomer + losses = <strong>~420 кт PE</strong> → ~395 кт ethylene + 25 кт comonomer. На 100 кт PE отвечает 95 кт ethylene at typical HDPE process.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс HDPE 400 кт/год</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>Polymerization reactor Innovene G Ø4.5 H=12 м + cooler = 75 млрд</li>
            <li>Catalyst prep + feed system + comonomer = 22 млрд</li>
            <li>Degassing column + N2 stripping + recycle = 35 млрд</li>
            <li>Extruder/Pelletizer Coperion ZSK 350 + Gala underwater + dryer = 65 млрд</li>
            <li>Additive package blender Diosna + 4× silos 2000 т + N2 blanket = 35 млрд</li>
            <li>Bagging line 25 kg automated + palletizer + bulk loaders = 25 млрд</li>
            <li>QC lab MFI Tinius + GPC Agilent + DSC + density = 12 млрд</li>
            <li>DCS Honeywell + safety + flare 80 м + EU IED BAT + проект 4% + PNR + insurance = 110 млрд</li>
          </ul>
          <input type="text" value={ex3} onChange={(e) => setEx3(e.target.value)} placeholder="тг" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${correct.ex3 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p><strong>~380 млрд тг (~$800M USD)</strong> на HDPE 400 кт/год. Удельная — $2000/т PE capacity. PP plant 500 кт/год аналогичный $1B.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Dust explosion prevention</h2>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только обычная пыль — не взрывается" },
              { v: "b", t: "Только sprinkler без N2" },
              { v: "c", t: "Multi-barrier dust explosion prevention per NFPA 654 + 484: (1) PE/PP fine powder MIE Minimum Ignition Energy 20-50 mJ → static + spark explosion risk, (2) all silos N2-blanket continuous (O2 <8% vol) prevents combustion, (3) ATEX Zone 22 classification all powder handling areas, electrical Eex tD A21 IP6X, (4) explosion vents Erie Defraf на крыше silos 0.1-0.3 м² per м³ space, (5) explosion isolation valves Ø250 mm rotary chemical valves Pneumat KEM, (6) deflagration suppression Fenwal HRD chemicals 50 ms response, (7) grounding all conveyor + bagging line <10 Ω, (8) static dissipative shoes ESD + cotton clothing for operators, (9) housekeeping ≤1/4 inch dust accumulation rule OSHA per NFPA 654, (10) annual DHA Dust Hazard Analysis OSHA NEP combustible dust; NFPA 654 + NFPA 484 + IEC 60079-10-2 + OSHA NEP CPL 03-00-008 + СН РК 4.04-15" },
              { v: "d", t: "Только вытяжная вентиляция" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex4, o.v, correct.ex4)}`}>
                <input type="radio" name="ex4" value={o.v} checked={ex4 === o.v} onChange={() => setEx4(o.v)} className="mr-3" />{o.t}
              </label>
            ))}
          </div>
        </section>
        <button onClick={() => setShowResults(true)} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-lg font-semibold">Проверить ответы</button>
        {showResults && <section className={`p-6 rounded-xl border-2 ${score === 4 ? "border-emerald-500 bg-emerald-500/10" : score >= 2 ? "border-amber-500 bg-amber-500/10" : "border-rose-500 bg-rose-500/10"}`}><h2 className="text-2xl font-bold">Результат: {score} / 4</h2></section>}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-cyan-300">Нормативная база</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li><strong>EU IED BAT Reference Polymers (POL BREF)</strong> 2007</li>
            <li><strong>ASTM D1898</strong> — Sampling of Plastics</li>
            <li><strong>ASTM D1238</strong> — Melt Flow Rate of Thermoplastics</li>
            <li><strong>ISO 1872</strong> — Polyethylene molding compounds</li>
            <li><strong>ISO 1873</strong> — Polypropylene molding compounds</li>
            <li><strong>NFPA 654</strong> — Prevention Fire/Dust Explosions in Manufacturing</li>
            <li><strong>NFPA 484</strong> — Combustible Metals</li>
            <li><strong>OSHA NEP CPL 03-00-008</strong> — Combustible Dust National Emphasis Program</li>
            <li><strong>IEC 60079-10-2</strong> — Explosive Dust Atmospheres</li>
            <li><strong>СН РК 4.04-15</strong> — Цветная + нефтехимическая</li>
            <li><strong>API RP 752</strong> — Management of Hazards Associated with Location of Buildings</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
