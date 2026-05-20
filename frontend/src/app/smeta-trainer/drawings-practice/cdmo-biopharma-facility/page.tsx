"use client";
import Link from "next/link";
import { useState } from "react";

export default function CdmoBiopharmaFacilityPage() {
  const [ex1, setEx1] = useState(""); const [ex2, setEx2] = useState(""); const [ex3, setEx3] = useState(""); const [ex4, setEx4] = useState(""); const [showResults, setShowResults] = useState(false);
  const e2 = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const e2OK = !isNaN(e2) && Math.abs(e2 - 2000) <= 200;
  const e3 = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const e3OK = !isNaN(e3) && Math.abs(e3 - 60_000_000_000) <= 6_000_000_000;
  const ok = { ex1: ex1 === "d", ex2: e2OK, ex3: e3OK, ex4: ex4 === "c" };
  const score = Object.values(ok).filter(Boolean).length;
  const oc = (s: string, v: string, isok: boolean) => !showResults || s !== v ? (s === v ? "border-blue-500 bg-blue-500/20" : "border-slate-700 hover:border-slate-500") : isok ? "border-emerald-500 bg-emerald-500/20" : "border-rose-500 bg-rose-500/20";
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10"><div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between"><Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300">← К разделам</Link><div className="text-xs text-slate-500">CDMO Biopharma Facility</div></div></header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section><h1 className="text-3xl md:text-4xl font-bold">🧬 CDMO Biopharma Contract Manufacturing</h1>
          <p className="mt-3 text-slate-400 max-w-3xl">Модуль #312. CDMO Contract Development & Manufacturing Organization — план Astana Hub Biotech фасилити для monoclonal antibodies + recombinant proteins + cell-based therapies. Reference: Lonza Visp (Switzerland) 200K L bioreactors, Wuxi Biologics Wuxi China, Samsung Biologics Songdo, FUJIFILM Diosynth Texas. Mammalian cell culture CHO Chinese Hamster Ovary в bioreactors 2000-20000 L. Downstream processing protein A chromatography + viral inactivation + ultrafiltration. EU GMP Annex 1 (2022) + FDA CFR 21 + ICH Q5A/Q5B + СН РК 3.02-19.</p>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав CDMO 2000 L bioreactor capacity</h2>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li>Cleanroom suite ISO 14644 class 5 (process areas) + class 7 (gowning) + class 8 (background) per EU GMP Annex 1 grade A/B/C/D;</li>
            <li>Stainless steel bioreactor train 2000 L Sartorius Biostat STR + cell culture vessel single-use ABEC × 3 redundant;</li>
            <li>Seed bioreactor cascade 50 L → 200 L → 500 L → 2000 L (200x scale-up factor) для inoculation;</li>
            <li>Mammalian cell line CHO-K1 GS-CHO Lonza + reverse-genetic plasmid expression vector;</li>
            <li>Buffer prep tanks SS 316L electropolished 2 м³ × 12 шт для phosphate / acetate / Tris / NaOH / NaCl;</li>
            <li>Media prep — chemical defined media + filtered 0.22 мкм UF полтава Pall Fluorodyne;</li>
            <li>Cell harvest — depth filtration Millipore Pod + centrifuge Westfalia disc-stack;</li>
            <li>Protein A chromatography — MabSelect SuRe LX GE / Cytiva 200 L column, 80-95% recovery monoclonal antibody;</li>
            <li>Viral inactivation low-pH 3.5 × 60 min hold tank SS 316L;</li>
            <li>Polishing chromatography — anion + cation exchange Capto Adhere + Q Sepharose Fast Flow;</li>
            <li>UF/DF Ultrafiltration / Diafiltration TFF tangential flow Pall Millipore Pellicon 50 м² для concentration + buffer exchange;</li>
            <li>Final fill-finish — sterile filtration 0.22 мкм + aseptic vial filling Optima Pharma + lyophilization Telstar LyoBeta для freeze-dried;</li>
            <li>QC lab — HPLC Agilent для purity + SDS-PAGE + ELISA + bioassay potency + endotoxin LAL Charles River + sterility USP;</li>
            <li>Stability chamber — Memmert ICH 25 °C/60% RH long-term + 40 °C/75% RH accelerated;</li>
            <li>Cold storage 2-8 °C + −20 °C + −80 °C ULT + LN2 для seed banks;</li>
            <li>Validation IQ/OQ/PQ + computer system 21 CFR Part 11 + data integrity ALCOA+.</li>
          </ul>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Bioreactor scale-up</h2>
          <div className="space-y-2">{[
            { v: "a", t: "Просто увеличить объём в 10x за один шаг" },
            { v: "b", t: "Использовать только batch fermentation" },
            { v: "c", t: "Все в одном bioreactor 20000 L" },
            { v: "d", t: "Stepwise scale-up cascade 5 L vial → 50 L → 200 L → 500 L → 2000 L cell culture per EU GMP Annex 1 + ICH Q5A: (1) каждый stage 4-7 days growth → seed next stage; (2) maintain critical parameters constant — DO 30%, pH 7.0 ± 0.1, T 37 °C ± 0.5, agitation P/V power-per-volume W/L; (3) total process 21-28 days seed to harvest; (4) cell density target 10⁷-10⁸ cells/mL в final 2000 L; (5) titer monoclonal antibody 3-5 g/L; (6) downstream protein A chromatography 80-95% recovery, polishing 50-70%, overall 50-65% recovery; (7) batch size 2000 L × 3.5 g/L × 60% = 4.2 кг finished mAb per batch; (8) annual capacity 24 batches × 4.2 kg = 100 kg mAb. EU GMP Annex 1 + ICH Q5A/Q5B/Q6B + FDA CFR 21 + ASTM E2363" },
          ].map((o) => (<label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex1, o.v, ok.ex1)}`}><input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />{o.t}</label>))}</div>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Bioreactor capacity (L)</h2>
          <input type="text" value={ex2} onChange={(e) => setEx2(e.target.value)} placeholder="L" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${ok.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p>Working volume Sartorius Biostat STR 2000 L (vessel 2500 L total). Pilot scale.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс CDMO 2000 L</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>Cleanroom suite ISO 14644 cl.5+7 + GMP Annex 1 (4000 m²) = 15 млрд</li>
            <li>Bioreactor train Sartorius Biostat STR 2000 L + cascade = 12 млрд</li>
            <li>Downstream — chromatography Cytiva MabSelect + UF/DF Pellicon + viral inactivation = 10 млрд</li>
            <li>Fill-finish Optima Pharma + lyophilizer Telstar = 8 млрд</li>
            <li>QC lab HPLC Agilent + ELISA + LAL endotoxin + sterility USP = 4 млрд</li>
            <li>Stability + cold storage ULT + LN2 = 2.5 млрд</li>
            <li>Validation + IT 21 CFR Part 11 + проект 5% + insurance + PNR = 8.5 млрд</li>
          </ul>
          <input type="text" value={ex3} onChange={(e) => setEx3(e.target.value)} placeholder="тг" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${ok.ex3 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p><strong>~60 млрд тг (~$130M USD)</strong> на 2000 L CDMO pilot. Wuxi Biologics 20K L plant $500-700M.</p></div>
          }
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Single-use vs stainless steel</h2>
          <div className="space-y-2">{[
            { v: "a", t: "Только SS 316L — старое надёжно" },
            { v: "b", t: "Только Single-use SU — никогда не CIP" },
            { v: "c", t: "Только glass bioreactor" },
            { v: "d", t: "Hybrid approach SU для clinical phase 1-3 + SS 316L для commercial >5000 L per BioPhorum + ISPE: (1) SU advantages — no CIP cleaning validation, fast changeover 1-2 days, lower upfront capex 30-50%, reduced cross-contamination risk; (2) SU disadvantages — single-use plastic waste 200-500 kg/batch, supply chain risk irradiated bags, higher opex consumables; (3) SS 316L advantages — economy at scale >5000 L, validated CIP/SIP cycles, lower opex long-term; (4) Single-use limit ~2000 L per vessel (mechanical stability); (5) trend — large CDMOs Lonza Visp 200K L SS, Samsung Biologics mix 12,000 L SS + 2000 L SU; (6) Single-use vendors — Sartorius Biostat STR, GE Cytiva XDR, Pall Allegro; SS vendors — Sartorius BBI, ABEC; ISPE Baseline Biomanufacturing + BioPhorum Operations + EU GMP Annex 1 + USP Class VI" },
            { v: "d", t: "Только metal Hastelloy" },
          ].map((o) => (<label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex4, o.v, ok.ex4)}`}><input type="radio" name="ex4" value={o.v} checked={ex4 === o.v} onChange={() => setEx4(o.v)} className="mr-3" />{o.t}</label>))}</div>
        </section>
        <button onClick={() => setShowResults(true)} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-lg font-semibold">Проверить ответы</button>
        {showResults && <section className={`p-6 rounded-xl border-2 ${score === 4 ? "border-emerald-500 bg-emerald-500/10" : score >= 2 ? "border-amber-500 bg-amber-500/10" : "border-rose-500 bg-rose-500/10"}`}><h2 className="text-2xl font-bold">Результат: {score} / 4</h2></section>}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3"><h2 className="text-xl font-semibold text-cyan-300">Нормативная база</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>EU GMP Annex 1 (2022)</li>
            <li>FDA 21 CFR Parts 210/211/600</li>
            <li>ICH Q5A/Q5B/Q5C/Q5D/Q5E/Q6B</li>
            <li>USP &lt;1043&gt; Ancillary Materials</li>
            <li>ISPE Baseline Biomanufacturing</li>
            <li>BioPhorum Operations Group BPOG</li>
            <li>ASTM E2363 — Bioprocess Equipment</li>
            <li>ASME BPE Bioprocess Equipment</li>
            <li>СН РК 3.02-19 — Лечебно-проф. учреждения</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
