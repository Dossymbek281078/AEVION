"use client";
import Link from "next/link";
import { useState } from "react";

export default function DistrictCoolingChillerPage() {
  const [ex1, setEx1] = useState(""); const [ex2, setEx2] = useState(""); const [ex3, setEx3] = useState(""); const [ex4, setEx4] = useState(""); const [showResults, setShowResults] = useState(false);
  const ex2N = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2OK = !isNaN(ex2N) && Math.abs(ex2N - 50_000) <= 5_000;
  const ex3N = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3OK = !isNaN(ex3N) && Math.abs(ex3N - 35_000_000_000) <= 3_500_000_000;
  const correct = { ex1: ex1 === "d", ex2: ex2OK, ex3: ex3OK, ex4: ex4 === "c" };
  const score = Object.values(correct).filter(Boolean).length;
  const oc = (s: string, v: string, ok: boolean) => !showResults || s !== v ? (s === v ? "border-blue-500 bg-blue-500/20" : "border-slate-700 hover:border-slate-500") : ok ? "border-emerald-500 bg-emerald-500/20" : "border-rose-500 bg-rose-500/20";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10"><div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between"><Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300">← К разделам</Link><div className="text-xs text-slate-500">District Cooling</div></div></header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section><h1 className="text-3xl md:text-4xl font-bold">❄️ District Cooling — Централизованное холодоснабжение</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">Модуль #303. План «Астана-Холод» (Эспанаход, Астана-EXPO 2017 area) — централизованное cooling 50 МВт холода для офисных кварталов + EXPO Mall. Reference: ADWEA Empower Dubai (200 кв km coverage), Tabreed UAE 1300 МВт, Helsinki Energy DC. Технология — large chillers York YK 5000 RT (1 RT = 3.5 кВт холода) + ice storage thermal energy storage TES. Холод distributed через insulated chilled water pipe 5-7 °C supply → return 12-14 °C, primary loop с heat exchanger на zonal substations. ASHRAE 90.1 + IDEA District Cooling Best Practices + СНиП 41-01.</p>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав DC plant 50 МВт холода</h2>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Centrifugal chillers York YK 5000 RT:</strong> 4 шт × 12.5 МВт холода (3552 RT) каждый, R-1233zd hydrofluoroolefin HFO refrigerant (low GWP=1), COP 6.5 cooling;</li>
            <li><strong>Cooling tower:</strong> Marley NC8400 induced-draft × 6 cells × 20 МВт thermal reject, water consumption 50 м³/час evaporation, drift loss {"<"}0.01%;</li>
            <li><strong>Ice TES Thermal Energy Storage:</strong> 100 000 кВт·ч ice tank (для peak shaving 4 hr × 25 МВт holiday peak), Calmac Ice Bank tanks, ice formed nighttime cheap electricity, melted daytime;</li>
            <li><strong>Primary chilled water pump:</strong> 4 шт Sulzer SMS 1000 м³/час × 35 м H VFD ABB, 7 °C supply / 14 °C return;</li>
            <li><strong>Distribution loop pre-insulated pipe:</strong> Logstor PEX-c HD500 буровое pre-insulated direct burial Ø600 мм × 15 км city loop, 50 мм PUR insulation + HDPE outer 10 mm;</li>
            <li><strong>Zonal substations:</strong> 50 шт по building blocks, plate heat exchanger Tranter GX-91 200-500 кВт каждый, isolates primary loop от secondary internal building chilled water;</li>
            <li><strong>Make-up water:</strong> RO + softener для cooling tower water (zero scale + low conductivity), automatic chemistry control bromine biocide;</li>
            <li><strong>SCADA + BMS:</strong> Siemens DESIGO + Schneider EcoStruxure, real-time load optimisation cells optimization, predictive analytics;</li>
            <li><strong>Backup generators:</strong> 2× DG 2.5 МВт on 12 hr backup для critical operations;</li>
            <li><strong>Loops monitoring:</strong> pressure sensors каждые 500 м + leak detection acoustic;</li>
            <li><strong>Maintenance shop + spare parts:</strong> 500 м², 10% spare compressors stock;</li>
            <li><strong>Customer metering:</strong> Endress+Hauser BTU meters at each substation для billing per кВт·ч cooling;</li>
            <li><strong>Control room 24/7:</strong> 4-сменка 16 чел + dispatch optimisation algorithm;</li>
            <li><strong>EHS compliance:</strong> R-1233zd low GWP, no ozone depletion, F-Gas Regulation EU 517/2014 friendly;</li>
            <li><strong>Service tunnels:</strong> для multi-utility (DC + power + fiber + telecom) Ø3 м под главные проспекты.</li>
          </ul>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — DC vs individual chillers</h2>
          <div className="space-y-2">{[
            { v: "a", t: "Always individual chillers per building" },
            { v: "b", t: "Только в холодных климатах" },
            { v: "c", t: "Только для residential" },
            { v: "d", t: "District Cooling выигрывает в total opex при density >50 кВт холода/га + 24/7 commercial use: (1) economies of scale chillers 5000 RT @ COP 6.5 vs 500 RT @ COP 5.0 = 30% efficiency gain, (2) diversity factor 60-70% (peaks не одновременно во всех buildings) vs individual 100% sizing, (3) ice TES экономит 25-35% electricity bill через off-peak charging, (4) централизованная ESG reporting + R-1233zd vs scattered R-410A units, (5) lower total CO2 footprint 40-50% vs individual, (6) capital savings 20-30% всему metropolitan area, (7) hot water by-product от waste heat recovery (for nearby industrial), Reference Dubai Empower 200 km² coverage. IDEA District Cooling Best Practices + ASHRAE 90.1" },
          ].map((o) => (<label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex1, o.v, correct.ex1)}`}><input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />{o.t}</label>))}</div>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Capacity in RT</h2>
          <p className="text-slate-300">50 МВт холода = сколько RT (Refrigeration Tons)? 1 RT = 3.517 кВт холода</p>
          <input type="text" value={ex2} onChange={(e) => setEx2(e.target.value)} placeholder="RT" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${correct.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p>50 000 / 3.517 = <strong>~14 200 RT</strong>; округл. до 14 000-15 000 RT.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс DC 50 МВт</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>York YK 5000 RT × 4 + R-1233zd refrigerant = 8 млрд</li>
            <li>Cooling tower Marley NC8400 × 6 cells = 3.5 млрд</li>
            <li>Ice TES Calmac 100 000 кВт·ч + chillers = 4.5 млрд</li>
            <li>Distribution loop Logstor PEX-c Ø600 × 15 км = 8 млрд</li>
            <li>Zonal substations 50 × plate HE + pumps + valves = 5 млрд</li>
            <li>SCADA + BMS Siemens DESIGO + control room = 1.5 млрд</li>
            <li>Backup DG + UPS + civil works + проект 5% + PNR = 4.5 млрд</li>
          </ul>
          <input type="text" value={ex3} onChange={(e) => setEx3(e.target.value)} placeholder="тг" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${correct.ex3 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p><strong>~35 млрд тг (~$75M USD)</strong>. Удельная — $1500/кВт холода. Окупаемость 12-15 лет через cooling tariff $0.05-0.08/кВт·ч.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Refrigerant choice</h2>
          <div className="space-y-2">{[
            { v: "a", t: "R-22 HCFC устаревший" },
            { v: "b", t: "Аммиак NH3 в city centre — toxic" },
            { v: "c", t: "R-1233zd HFO Hydrofluoroolefin: GWP=1 (vs R-134a GWP=1430, R-410A GWP=2088), zero ODP, A1 non-flammable safety class, EU F-Gas Regulation 517/2014 compliant до 2030+, оптимально для centrifugal chillers York/Carrier/Trane, COP 6.5 efficient, capacity loss <2% vs R-134a. ASHRAE 34 + EU F-Gas + Kigali Amendment Montreal Protocol" },
            { v: "d", t: "CO2 transcritical для DC" },
          ].map((o) => (<label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex4, o.v, correct.ex4)}`}><input type="radio" name="ex4" value={o.v} checked={ex4 === o.v} onChange={() => setEx4(o.v)} className="mr-3" />{o.t}</label>))}</div>
        </section>
        <button onClick={() => setShowResults(true)} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-lg font-semibold">Проверить ответы</button>
        {showResults && <section className={`p-6 rounded-xl border-2 ${score === 4 ? "border-emerald-500 bg-emerald-500/10" : score >= 2 ? "border-amber-500 bg-amber-500/10" : "border-rose-500 bg-rose-500/10"}`}><h2 className="text-2xl font-bold">Результат: {score} / 4</h2></section>}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3"><h2 className="text-xl font-semibold text-cyan-300">Нормативная база</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li><strong>ASHRAE 90.1</strong> — Energy Standard for Buildings</li>
            <li><strong>ASHRAE 34</strong> — Designation Safety Classification of Refrigerants</li>
            <li><strong>IDEA District Cooling Best Practices</strong> — International District Energy Association</li>
            <li><strong>EU F-Gas Regulation 517/2014</strong> — Fluorinated Greenhouse Gases</li>
            <li><strong>Kigali Amendment 2016</strong> — Montreal Protocol HFC phase-down</li>
            <li><strong>СНиП 41-01-2003</strong> — Отопление, вентиляция, кондиционирование</li>
            <li><strong>СН РК 4.02-15</strong> — Холодоснабжение</li>
            <li><strong>EN 14511</strong> — Cooling capacity testing</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
