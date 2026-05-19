"use client";
import Link from "next/link";
import { useState } from "react";

export default function HpcSupercomputingCenterPage() {
  const [ex1, setEx1] = useState(""); const [ex2, setEx2] = useState(""); const [ex3, setEx3] = useState(""); const [ex4, setEx4] = useState(""); const [showResults, setShowResults] = useState(false);
  const e2 = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const e2OK = !isNaN(e2) && Math.abs(e2 - 100) <= 10;
  const e3 = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const e3OK = !isNaN(e3) && Math.abs(e3 - 65_000_000_000) <= 6_500_000_000;
  const ok = { ex1: ex1 === "d", ex2: e2OK, ex3: e3OK, ex4: ex4 === "c" };
  const score = Object.values(ok).filter(Boolean).length;
  const oc = (s: string, v: string, isok: boolean) => !showResults || s !== v ? (s === v ? "border-blue-500 bg-blue-500/20" : "border-slate-700 hover:border-slate-500") : isok ? "border-emerald-500 bg-emerald-500/20" : "border-rose-500 bg-rose-500/20";
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10"><div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between"><Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300">← К разделам</Link><div className="text-xs text-slate-500">HPC Supercomputing</div></div></header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section><h1 className="text-3xl md:text-4xl font-bold">🖥️ HPC Supercomputing Center (Exascale)</h1>
          <p className="mt-3 text-slate-400 max-w-3xl">Модуль #319. Astana Nazarbayev University Computer Center + Almaty Институт ИИВТ. Reference: Frontier ORNL (1.7 ExaFlops Top500 #1 2024), Fugaku Japan (442 PFlops), LUMI Finland (380 PFlops). HPC for climate modeling + drug discovery + AI training + nuclear physics simulation. Architecture: ~10 000 nodes × CPU AMD EPYC 9954 96-core + GPU NVIDIA H100/B200 80GB HBM3 × 4-8 per node, InfiniBand HDR 200 Gbps interconnect, parallel storage Lustre 100 PB. Liquid cooling direct-to-chip + adiabatic outdoor chillers. ISO 27001 + TIA-942 Tier IV + Green Grid PUE &lt;1.2 + СН РК 4.04-12.</p>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав HPC 100 PFlops cluster</h2>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li>Compute nodes — 2500 servers Dell PowerEdge XE9680 / HPE Cray EX235n + AMD EPYC 9954 96-core × 2 (192 cores/node);</li>
            <li>GPU acceleration — NVIDIA H100 80GB HBM3 × 4 per node = 10 000 GPUs total, 60 PFlops FP16 compute;</li>
            <li>Memory — 1.5 TB DDR5-4800 per node, 3.75 PB total;</li>
            <li>Storage — Lustre parallel filesystem 100 PB (50 PB usable raid-6) + flash tier 1 PB NVMe;</li>
            <li>Interconnect — InfiniBand NDR 400 Gbps fat-tree topology, Mellanox QM9700 switches;</li>
            <li>Cooling — direct-to-chip liquid cooling DLC 100% (water-cooled cold plate Coolant Distribution Unit CDU);</li>
            <li>Heat removal — outdoor adiabatic chiller Bell+Gossett 5 MW thermal capacity (PUE 1.05-1.15);</li>
            <li>Power — 5 MW IT + 1 MW cooling + 0.5 MW UPS losses = 6.5 MW total; ATS automatic transfer от 2x utility feeds + 4× 1.5 MW DG;</li>
            <li>UPS — Eaton 9395 1 MVA × 5 N+1 redundancy + 30-min battery + 5-min flywheel ride-through;</li>
            <li>Networking — 100 Gbps fiber backbone к Almaty Internet eXchange + dark fiber до universities;</li>
            <li>Security — TIA-942 Tier IV: biometric + mantrap + 24/7 NOC monitoring + cybersecurity Falcon Crowdstrike;</li>
            <li>Cleanroom — ISO 14644 cl.8 (data center grade, dust control), pressurised positive +25 Pa;</li>
            <li>Building — 5000 m² total, 2500 m² data hall raised-floor 1.5 m, ceiling 6 m hot aisle containment;</li>
            <li>Office + visitor centre + classroom для researchers + workshops;</li>
            <li>Green sustainability — PUE 1.10 target, 30% PV onsite + waste heat recovery to district heating;</li>
            <li>Compliance — ISO 27001 + SOC 2 Type II + Green Grid + LEED Platinum BD+C.</li>
          </ul>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Cooling technology</h2>
          <div className="space-y-2">{[
            { v: "a", t: "Только обычный воздушный fan" },
            { v: "b", t: "Только chilled water 6-12 °C" },
            { v: "c", t: "Только AC unit per server" },
            { v: "d", t: "Direct-to-chip liquid cooling DLC per ASHRAE TC9.9 + Open Compute Project: (1) cold plate water-cooled directly on CPU + GPU 40-50 °C inlet, 60-65 °C outlet; removes 90-95% heat от silicon (vs air 30-40%); (2) Coolant Distribution Unit CDU 250-500 kW thermal capacity each, manifold к rack-level distribution; (3) deionized + glycol mix (avoid corrosion), continuous filtration + monitoring; (4) outdoor heat rejection — adiabatic chiller Bell+Gossett когда outdoor T<30 °C можно использовать direct dry cooling (no compressor), free cooling 80% от year в Almaty climate; (5) PUE Power Usage Effectiveness = total/IT power = 1.05-1.15 (vs traditional air-cooled 1.5-1.8) = 25-35% energy savings; (6) waste heat recovery 60 °C outlet water → district heating loop (Frontier ORNL Cray EX uses this 92% of waste heat recovered); (7) noise reduction — no fans = whisper quiet datacenter; (8) density 100-200 kW/rack (vs air 20-30 kW); enables ExaFlops compute в same footprint; ASHRAE TC9.9 Liquid Cooling Guidelines + OCP Liquid Cooling Standards + Green Grid PUE + TIA-942" },
          ].map((o) => (<label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex1, o.v, ok.ex1)}`}><input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />{o.t}</label>))}</div>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — FP16 peak (PFlops)</h2>
          <input type="text" value={ex2} onChange={(e) => setEx2(e.target.value)} placeholder="PFlops" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${ok.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p>NVIDIA H100 6 PFlops FP16 × 10 000 GPUs ÷ duty cycle 60% = <strong>~100 PFlops sustained</strong>. Top500 list position ~25-30 2024.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс 100 PFlops HPC</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>Compute 2500 nodes EPYC + H100 GPUs × $25K avg = 30 млрд</li>
            <li>Interconnect InfiniBand NDR fat-tree + switches Mellanox = 6 млрд</li>
            <li>Storage Lustre 100 PB + flash tier = 8 млрд</li>
            <li>Liquid cooling DLC + CDU + chillers Bell+Gossett 5 MW = 6 млрд</li>
            <li>UPS Eaton 9395 5 MVA + flywheel + DG 6 MW = 5 млрд</li>
            <li>Building 5000 м² + raised floor + structural reinforce = 5 млрд</li>
            <li>Security TIA-942 Tier IV + cybersecurity + NOC = 2 млрд</li>
            <li>Networking + IT + проект 5% + commissioning + insurance = 3 млрд</li>
          </ul>
          <input type="text" value={ex3} onChange={(e) => setEx3(e.target.value)} placeholder="тг" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${ok.ex3 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p><strong>~65 млрд тг (~$140M USD)</strong> на 100 PFlops HPC. Frontier ORNL $600M; LUMI Finland $200M.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Power efficiency</h2>
          <div className="space-y-2">{[
            { v: "a", t: "Никакой роли PUE не играет" },
            { v: "b", t: "Чем выше PUE тем лучше" },
            { v: "c", t: "Multi-strategy PUE Power Usage Effectiveness optimization per Green Grid + Open Compute Project: (1) PUE = Total Facility Power / IT Equipment Power, target <1.2 modern (vs 2.0+ traditional), means <20% overhead для cooling+lighting+UPS losses; (2) liquid cooling DLC dominant — 30% PUE improvement vs air cooling (1.5 → 1.1); (3) free cooling — Almaty climate 80% year T<15 °C ideal direct dry cooling no chiller needed; (4) variable speed fans + pumps Driving с predictive AI workload-aware control; (5) waste heat recovery 60 °C outlet water → district heating sells 5 MW thermal back to grid; (6) PV solar 30% onsite generation + BESS grid arbitrage; (7) UPS efficiency 96-98% modern Li-ion BESS Eaton 9395; (8) hot aisle containment + Computer Room AC vs distributed cooling; (9) Frontier ORNL achieved PUE 1.03 lowest в exascale class; (10) annual energy report Green Grid + LEED Platinum certification + carbon offset. Green Grid PUE + Open Compute Project + ASHRAE TC9.9 + LEED" },
            { v: "d", t: "Только grid green energy" },
          ].map((o) => (<label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex4, o.v, ok.ex4)}`}><input type="radio" name="ex4" value={o.v} checked={ex4 === o.v} onChange={() => setEx4(o.v)} className="mr-3" />{o.t}</label>))}</div>
        </section>
        <button onClick={() => setShowResults(true)} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-lg font-semibold">Проверить ответы</button>
        {showResults && <section className={`p-6 rounded-xl border-2 ${score === 4 ? "border-emerald-500 bg-emerald-500/10" : score >= 2 ? "border-amber-500 bg-amber-500/10" : "border-rose-500 bg-rose-500/10"}`}><h2 className="text-2xl font-bold">Результат: {score} / 4</h2></section>}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3"><h2 className="text-xl font-semibold text-cyan-300">Нормативная база</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>TIA-942 — Data Center Standards</li>
            <li>Green Grid PUE</li>
            <li>ASHRAE TC9.9 — Mission Critical Facilities</li>
            <li>Open Compute Project OCP</li>
            <li>ISO 27001 + SOC 2 Type II</li>
            <li>LEED Platinum BD+C</li>
            <li>Top500 Standards</li>
            <li>СН РК 4.04-12 — Связь и информатика</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
