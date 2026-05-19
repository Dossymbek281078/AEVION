"use client";
import Link from "next/link";
import { useState } from "react";

export default function MrnaVaccinePilotPage() {
  const [ex1, setEx1] = useState(""); const [ex2, setEx2] = useState(""); const [ex3, setEx3] = useState(""); const [ex4, setEx4] = useState(""); const [showResults, setShowResults] = useState(false);
  const e2 = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const e2OK = !isNaN(e2) && Math.abs(e2 - 10_000_000) <= 1_000_000;
  const e3 = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const e3OK = !isNaN(e3) && Math.abs(e3 - 32_000_000_000) <= 3_200_000_000;
  const ok = { ex1: ex1 === "d", ex2: e2OK, ex3: e3OK, ex4: ex4 === "c" };
  const score = Object.values(ok).filter(Boolean).length;
  const oc = (s: string, v: string, isok: boolean) => !showResults || s !== v ? (s === v ? "border-blue-500 bg-blue-500/20" : "border-slate-700 hover:border-slate-500") : isok ? "border-emerald-500 bg-emerald-500/20" : "border-rose-500 bg-rose-500/20";
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10"><div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between"><Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300">← К разделам</Link><div className="text-xs text-slate-500">mRNA Vaccine Pilot</div></div></header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section><h1 className="text-3xl md:text-4xl font-bold">💉 mRNA Vaccine Pilot Plant</h1>
          <p className="mt-3 text-slate-400 max-w-3xl">Модуль #314. Pilot mRNA Vaccine Plant Almaty/Astana — план посткованая капасити для emergency response (BioNTech / Moderna model). Reference: BioNTech Marburg 1B doses/year, Moderna Norwood Massachusetts 600M doses, Pfizer Puurs Belgium 4B/year. Process: linearized plasmid template + IVT in-vitro transcription (T7 RNA polymerase + NTPs) → mRNA + Cap analog ARCA + 5-mC + pseudouridine modified → LNP Lipid Nanoparticle encapsulation (4 lipids ALC-0315/ALC-0159/cholesterol/DSPC) → fill-finish sterile vials. Capacity 10M doses/year pilot. EU GMP Annex 1 + FDA + ICH Q5/Q6 + СН РК 3.02-19.</p>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав mRNA pilot 10M doses/year</h2>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li>Plasmid DNA production — E.coli fermentation 100 L Sartorius + lysis Roche + alkaline purification + DNase + linearisation with restriction enzyme;</li>
            <li>IVT in-vitro transcription bioreactor 50 L — T7 RNA polymerase + NTPs (ATP/UTP/CTP/GTP + ARCA cap) + DNA template + buffer, 37 °C × 4 hr;</li>
            <li>mRNA modification — pseudouridine + 5-methylcytidine для immune evasion + stability (Karikó/Weissman 2005 Nobel Prize 2023);</li>
            <li>mRNA purification — DNase digestion + chromatography Cytiva Capto Core 700 + Oligo dT для poly-A capture + TFF Pall Pellicon 50 м²;</li>
            <li>LNP Lipid Nanoparticle formulation — microfluidic mixer Precision NanoSystems NanoAssemblr Ignite, mRNA + ethanol-dissolved lipids → 80-100 nm particles dynamic light scattering DLS confirmation;</li>
            <li>Lipid components — ALC-0315 ionisable + ALC-0159 PEG-lipid + cholesterol + DSPC (Pfizer recipe); или SM-102 + PEG-DMG (Moderna);</li>
            <li>Buffer exchange — TFF Diafiltration removes ethanol + buffer exchange to formulation buffer (sucrose Tris saline);</li>
            <li>Sterile filtration — 0.22 μm Millipore Express + dual-stage 0.45+0.22 redundant;</li>
            <li>Fill-finish — aseptic vial filling line Optima Pharma 200 vials/min, freeze-thaw stability storage -80 °C ULT;</li>
            <li>Lyophilisation Telstar LyoBeta для freeze-dried стабильность 2-8 °C (vs frozen -80 °C);</li>
            <li>QC lab — HPLC reverse-phase Agilent для mRNA integrity + RT-qPCR для intactness + DLS Malvern для LNP size + endotoxin LAL Charles River;</li>
            <li>Cleanroom suite ISO 14644 cl.5+7 + EU GMP Annex 1 grade A/B/C/D, 2000 m² total;</li>
            <li>Cold chain -80 °C ULT × 30 для bulk storage + -20 °C distribution + 2-8 °C lyo;</li>
            <li>Regulatory team — FDA BLA + EU EMA Marketing Authorisation + WHO PreQ submission;</li>
            <li>Cybersecurity 21 CFR Part 11 + data integrity ALCOA+ + electronic batch records SAP S/4HANA.</li>
          </ul>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Why mRNA platform</h2>
          <div className="space-y-2">{[
            { v: "a", t: "Только дешёвый ingredient" },
            { v: "b", t: "Только быстрая разработка" },
            { v: "c", t: "Только COVID-specific" },
            { v: "d", t: "mRNA technology advantages per Nature Reviews Drug Discovery + BioNTech/Moderna: (1) rapid design — antigen sequence → mRNA synthesis 1-2 weeks vs traditional protein vaccine 6-12 months; (2) platform technology — same manufacturing process для any pathogen, only sequence changes (Pfizer pivoted COVID-2 vaccine в недели); (3) no cell culture — IVT enzymatic synthesis cell-free, scalable 1 L → 200 L without traditional bioreactor scale-up issues; (4) no infectious viral material in manufacturing (vs traditional inactivated vaccine); (5) self-amplifying mRNA saRNA Variant gives 10-100x dose reduction; (6) cancer therapeutic mRNA Cancer Immunotherapy CIT trials Moderna mRNA-4157 personalised neoantigen tumor vaccine; (7) other diseases — influenza universal vaccine, RSV maternal protect newborn, herpes simplex genital infection; (8) emerging — therapeutic protein replacement therapy CFTR cystic fibrosis through mRNA; (9) limitations — cold chain logistics challenging (-80 °C BioNTech, -20 °C Moderna), shelf life shorter; (10) pricing — $20-40 per dose (vs $5-10 traditional inactivated). Nature Rev Drug Discovery + BioNTech/Moderna scientific publications + FDA EUA + EU EMA CHMP" },
          ].map((o) => (<label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex1, o.v, ok.ex1)}`}><input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />{o.t}</label>))}</div>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Doses per year</h2>
          <input type="text" value={ex2} onChange={(e) => setEx2(e.target.value)} placeholder="доз" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${ok.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p>50 L IVT × 1 g mRNA/L × 30 doses per μg × 1000 µg/g = ~1.5M doses/batch × 7 batches/year = <strong>~10M doses/year</strong> pilot scale.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс mRNA pilot</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>Cleanroom suite ISO 14644 cl.5 + GMP Annex 1 (2000 m²) = 10 млрд</li>
            <li>IVT bioreactor 50 L + downstream chromatography Cytiva = 6 млрд</li>
            <li>LNP formulation Precision NanoSystems NanoAssemblr Ignite = 4 млрд</li>
            <li>Fill-finish Optima Pharma aseptic + lyophilizer Telstar = 5 млрд</li>
            <li>QC lab — HPLC Agilent + DLS Malvern + LAL + RT-qPCR = 2.5 млрд</li>
            <li>Cold chain -80 °C ULT × 30 + -20 °C distribution = 1.5 млрд</li>
            <li>Validation + проектирование 5% + EU GMP audit + insurance = 3 млрд</li>
          </ul>
          <input type="text" value={ex3} onChange={(e) => setEx3(e.target.value)} placeholder="тг" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${ok.ex3 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p><strong>~32 млрд тг (~$70M USD)</strong> на 10M doses/year mRNA pilot. BioNTech Marburg 1B doses = $400M.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Cold chain</h2>
          <div className="space-y-2">{[
            { v: "a", t: "Просто холодильник 4 °C" },
            { v: "b", t: "Только домашняя заморозка -20 °C" },
            { v: "c", t: "Multi-tier cold chain per WHO PQS + BioNTech Distribution Manual: (1) ULT -80 °C BioNTech original — Pfizer Thermal Shipper dry ice 5 days holding + GPS tracking; -80 °C ULT freezer Thermo TSX Series 30 days at distribution centre; (2) -20 °C Moderna — domestic medical freezer 30-day stability; (3) 2-8 °C refrigerator — 5-day stability (BioNTech) или 30-day (Moderna lyophilised version); (4) freezing damage — LNP membrane disruption if slow thaw, multiple freeze-thaw cycles degrade mRNA; (5) lyophilisation Telstar или CSU Universa freeze-dryer removes water → product stable at 2-8 °C for 18-24 months (vs frozen 6-12 months); (6) sub-zero distribution — Pfizer Thermal Shipper insulated foam + dry ice; PCM phase change material containers EcoCool; (7) tracking — Sensitech digital data loggers RFID + GPS continuous T+humidity monitoring, alarm at deviation; (8) WHO Prequalification PQ для emerging markets requires 2-8 °C stability (lyo form preferred); WHO PQS + BioNTech Cold Chain Manual + USP <659> + ICH Q1A/Q1B + ASHRAE Pharmaceutical Refrigeration Guidelines" },
            { v: "d", t: "В обычной комнатной температуре" },
          ].map((o) => (<label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex4, o.v, ok.ex4)}`}><input type="radio" name="ex4" value={o.v} checked={ex4 === o.v} onChange={() => setEx4(o.v)} className="mr-3" />{o.t}</label>))}</div>
        </section>
        <button onClick={() => setShowResults(true)} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-lg font-semibold">Проверить ответы</button>
        {showResults && <section className={`p-6 rounded-xl border-2 ${score === 4 ? "border-emerald-500 bg-emerald-500/10" : score >= 2 ? "border-amber-500 bg-amber-500/10" : "border-rose-500 bg-rose-500/10"}`}><h2 className="text-2xl font-bold">Результат: {score} / 4</h2></section>}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3"><h2 className="text-xl font-semibold text-cyan-300">Нормативная база</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>EU GMP Annex 1 (2022)</li>
            <li>FDA 21 CFR 600/610 — Biologics</li>
            <li>ICH Q5A/Q5B/Q5C/Q5D/Q5E/Q6B + Q1A/Q1B Stability</li>
            <li>WHO Prequalification PQS</li>
            <li>USP &lt;1043&gt; / &lt;659&gt; — Ancillary Materials / Refrigerator Standards</li>
            <li>ISPE Baseline Biomanufacturing</li>
            <li>ASHRAE Pharmaceutical Refrigeration Guidelines</li>
            <li>СН РК 3.02-19 — Лечебно-проф. учреждения</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
