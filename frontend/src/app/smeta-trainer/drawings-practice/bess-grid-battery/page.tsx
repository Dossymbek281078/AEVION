"use client";
import Link from "next/link";
import { useState } from "react";

export default function BessGridBatteryPage() {
  const [ex1, setEx1] = useState("");
  const [ex2, setEx2] = useState("");
  const [ex3, setEx3] = useState("");
  const [ex4, setEx4] = useState("");
  const [showResults, setShowResults] = useState(false);
  const ex2N = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2OK = !isNaN(ex2N) && Math.abs(ex2N - 200) <= 20;
  const ex3N = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3OK = !isNaN(ex3N) && Math.abs(ex3N - 75_000_000_000) <= 7_500_000_000;
  const correct = { ex1: ex1 === "d", ex2: ex2OK, ex3: ex3OK, ex4: ex4 === "c" };
  const score = Object.values(correct).filter(Boolean).length;
  const oc = (s: string, v: string, ok: boolean) => !showResults || s !== v ? (s === v ? "border-blue-500 bg-blue-500/20" : "border-slate-700 hover:border-slate-500") : ok ? "border-emerald-500 bg-emerald-500/20" : "border-rose-500 bg-rose-500/20";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300 hover:text-blue-200">← К разделам</Link>
          <div className="text-xs text-slate-500">BESS — Battery Energy Storage System</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold">🔋 BESS — Grid-Scale Battery Storage</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #297. План КЕГОК — BESS 200-400 МВт·ч в Алматинской области
            для частотной регуляции + peak-shaving. Reference: Hornsdale Power
            Reserve South Australia (Tesla Megapack 150 МВт / 194 МВт·ч 2017),
            Moss Landing California (1600 МВт·ч), Vistra Texas (1.2 ГВт·ч).
            Технология — Tesla Megapack 4 МВт·ч/блок Li-ion LFP (LiFePO4)
            или NMC (Nickel-Manganese-Cobalt). LFP — safer (no thermal runaway
            up to 270 °C), longer cycle life 6000+ cycles, lower energy
            density 160 Wh/kg vs NMC 240 Wh/kg. AC-coupled inverter SMA Sunny
            Central или Power Electronics PFM, 1500 В DC bus, grid-tie 33-220 кВ
            transformer step-up. NFPA 855 + UL 9540 + IEC 62619 + СН РК 4.04-09.
          </p>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав BESS 200 МВт·ч (50 Tesla Megapack)</h2>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Battery containers:</strong> Tesla Megapack 4 МВт·ч 1.5 МВт inverter × 50 шт (или Fluence Cube, Wartsila GridSolv), размер 6.7×1.6×2.6 м (40 ft container scaled), weight 17-23 т каждый;</li>
            <li><strong>Battery cells:</strong> Tesla 2170 Li-ion LFP cells (3.2 В × 90 Ah) × millions, паковка в modules → racks → containers; battery management system BMS Tesla proprietary;</li>
            <li><strong>Cooling system:</strong> liquid-cooled glycol-water 35-40% propylene glycol, chiller 100-150 кВт thermal per Megapack, T cell maintenance 15-35 °C для optimal life;</li>
            <li><strong>Power conversion system PCS:</strong> bi-directional inverter SMA Sunny Central 2500 кВА × 25 (1 на 2 Megapacks), DC 1500 В → AC 0.69 кВ, efficiency 98% one-way / 88% round-trip;</li>
            <li><strong>Medium voltage transformer:</strong> 0.69/33 кВ × 1500 кВА × 50 шт + LV combiner, oil-immersed ONAN cooling;</li>
            <li><strong>HV step-up + switchyard:</strong> 33/220 кВ 200 МВА transformer + GIS switchgear Siemens 8DJH + protection relays SEL-411L;</li>
            <li><strong>Site SCADA:</strong> Wonderware AVEVA / Schneider Power Operation, dispatch algorithm для arbitrage + ancillary services frequency regulation (response 100 ms);</li>
            <li><strong>Fire suppression:</strong> per NFPA 855 — water mist FOG-100, deflagration vents + gas detection HFC-134a, deep-seated fire может длиться days для Li-ion (cooling primary);</li>
            <li><strong>Aerosol detection:</strong> Stat-X aerosol generators, lithium-ion off-gas detection LION CO + HF + HCl 3-mode sensor;</li>
            <li><strong>Spacing per NFPA 855:</strong> 3 м между Megapack containers (или 1 м с FM Global approved spacing), perimeter 4.5 м от property line;</li>
            <li><strong>Site security:</strong> 2.5 м забор + CCTV-IP + biometric СКУД + monitored alarm 24/7;</li>
            <li><strong>Connectivity:</strong> fiber-optic к KEGOK Almaty + 4G backup, latency &lt;50 ms для frequency response;</li>
            <li><strong>Auxiliary loads:</strong> office + cooling chiller + lighting 500-1000 кВт, draws от grid (не от BESS);</li>
            <li><strong>Spare parts inventory:</strong> 2 spare Megapack containers + 10% inverter modules + cooling subsystem parts;</li>
            <li><strong>Annual maintenance:</strong> ~$15/кВт·ч/год (battery degradation 2-3%/year + inverter PM + thermal management).</li>
          </ul>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — LFP vs NMC chemistry</h2>
          <p className="text-slate-300">Для grid-scale BESS 200 МВт·ч в Алматы какая chemistry?</p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Lead-acid классические — дёшево, но cycle life 500" },
              { v: "b", t: "Sodium-ion CATL — слишком новая технология 2024" },
              { v: "c", t: "Только NMC для максимальной энергии" },
              { v: "d", t: "LFP LiFePO4 Tesla Megapack для grid-scale: безопасность (thermal runaway threshold 270 °C vs NMC 150 °C, no oxygen release), 6000+ cycles@80% DoD, no Co/Ni критич. минералы, $200/кВт·ч 2024; NMC 240 Wh/kg лучше для EV (mass-constrained) но Hornsdale + Vistra все на LFP" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />{o.t}
              </label>
            ))}
          </div>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Power rating</h2>
          <p className="text-slate-300">BESS 200 МВт·ч × 4-час discharge. Какова power rating (МВт)?</p>
          <input type="text" value={ex2} onChange={(e) => setEx2(e.target.value)} placeholder="МВт" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${correct.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p>P = E/t = 200/1 = <strong>200 МВт</strong> (4h * 50 МВт). C-rate = 0.25 (E/P=4 h). NFPA 855 + IEEE 1547.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс BESS 200 МВт·ч</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>50 Tesla Megapack × 4 МВт·ч @ $250/кВт·ч = 50 × 1 млрд = 50 млрд тг</li>
            <li>Medium voltage transformer 50 × 1500 кВА = 1.2 млрд</li>
            <li>HV step-up 33/220 kV 200 МВА + GIS switchyard = 6 млрд</li>
            <li>SCADA + grid tie + protection relays SEL = 1.4 млрд</li>
            <li>Fire suppression NFPA 855 + aerosol detection + deflagration vents = 2.2 млрд</li>
            <li>Подключение к КЕГОК fiber + 4G + 220 кВ ЛЭП 10 км = 5.5 млрд</li>
            <li>Foundation + roadways + security 2.5 м fence + CCTV + biometric СКУД = 4 млрд</li>
            <li>Спецификация + EPC + projecting 5% + insurance + PNR = 4.7 млрд</li>
          </ul>
          <input type="text" value={ex3} onChange={(e) => setEx3(e.target.value)} placeholder="тг" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${correct.ex3 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p><strong>~75 млрд тг (~$160M USD)</strong>. Удельная — $375/кВт·ч installed (vs $250 cell-level, +50% balance-of-plant).</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Thermal runaway prevention</h2>
          <p className="text-slate-300">Что обязательно по NFPA 855 + UL 9540?</p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Без особых мер — Li-ion безопасен" },
              { v: "b", t: "Только дымовая сигнализация" },
              { v: "c", t: "Multi-barrier по NFPA 855 + UL 9540 + IEC 62619: (1) LFP chemistry choice (270 °C threshold), (2) BMS Tesla с individual cell monitoring (over-T over-V) + protection 100 ms isolation, (3) liquid cooling 15-35 °C maintain, (4) deflagration vents Erie Defraf на крыше container 1.0 м²/30 м³ space, (5) FOG-100 water mist suppression, (6) lithium-off-gas detection (CO + HF + HCl) 3-mode sensor LION, (7) container spacing 3 м per NFPA 855 (или 1 м с FM Global approval), (8) failure modes propagation prevention — each module thermally isolated (ceramic fiber 25 мм), (9) emergency response plan + local FD training 8-hr course, (10) annual UL 9540A unit-level test compliance check; Hornsdale lessons learned 2019: bushfire-triggered Megapack fire contained в 2 cells with no propagation thanks to design" },
              { v: "d", t: "Просто построить дальше от людей" },
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
            <li><strong>NFPA 855</strong> — Installation of Stationary Energy Storage Systems</li>
            <li><strong>UL 9540</strong> — Energy Storage Systems and Equipment</li>
            <li><strong>UL 9540A</strong> — Test Method for Evaluating Thermal Runaway Fire Propagation</li>
            <li><strong>IEC 62619</strong> — Secondary Cells and Batteries Safety Requirements</li>
            <li><strong>IEC 62933</strong> — Electrical Energy Storage Systems</li>
            <li><strong>IEEE 1547</strong> — Distributed Resources Interconnection</li>
            <li><strong>IEEE 2030</strong> — Smart Grid Interoperability</li>
            <li><strong>FM Global Property Loss Prevention 5-33</strong> — Battery Energy Storage</li>
            <li><strong>СН РК 4.04-09</strong> — Электрические станции</li>
            <li><strong>СНиП 3.05.06-85</strong> — Электротехнические устройства</li>
            <li><strong>ENTSO-E Network Code</strong> — Grid connection</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
