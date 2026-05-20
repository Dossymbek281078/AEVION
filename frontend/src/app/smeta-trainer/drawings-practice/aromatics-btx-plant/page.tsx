"use client";
import Link from "next/link";
import { useState } from "react";

export default function AromaticsBtxPlantPage() {
  const [ex1, setEx1] = useState("");
  const [ex2, setEx2] = useState("");
  const [ex3, setEx3] = useState("");
  const [ex4, setEx4] = useState("");
  const [showResults, setShowResults] = useState(false);
  const ex2N = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2OK = !isNaN(ex2N) && Math.abs(ex2N - 1_200_000) <= 120_000;
  const ex3N = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3OK = !isNaN(ex3N) && Math.abs(ex3N - 950_000_000_000) <= 95_000_000_000;
  const correct = { ex1: ex1 === "d", ex2: ex2OK, ex3: ex3OK, ex4: ex4 === "c" };
  const score = Object.values(correct).filter(Boolean).length;
  const oc = (s: string, v: string, ok: boolean) => !showResults || s !== v ? (s === v ? "border-blue-500 bg-blue-500/20" : "border-slate-700 hover:border-slate-500") : ok ? "border-emerald-500 bg-emerald-500/20" : "border-rose-500 bg-rose-500/20";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300 hover:text-blue-200">← К разделам</Link>
          <div className="text-xs text-slate-500">BTX — Aromatics Complex</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold">🛢️ BTX — Aromatics Complex (Benzene/Toluene/Xylene)</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #300. План КазМунайГаз — Атырау Aromatics Complex (на базе
            Атырауского НПЗ) для extraction BTX из reformate стрима. Reference:
            Aramco Yanbu (Saudi) 1.5 Mt/yr, Reliance Jamnagar India 1.8 Mt/yr,
            CNPC Dushanzi 1.0 Mt/yr. UOP Sulfolane / Tatoray / Parex / Isomar
            licensed processes. Output — para-xylene 70%, benzene 25%, toluene
            5% (after extraction). Para-xylene → PTA (Purified Terephthalic
            Acid) → PET resin для пластик. бутылок и текстиль. Atyrau target
            500 000 т PX/год = ~1.2 Mt BTX feed. EU IED BAT Refining + API RP
            581 + СН РК 4.04-15.
          </p>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав BTX Complex 1.2 Mt/yr</h2>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Naphtha hydrotreater:</strong> H2 + NiMo catalyst @ 320 °C × 50 бар, удаляет S/N до &lt;0.5 ppm (защита Pt reformer катализатора);</li>
            <li><strong>Catalytic Reformer CCR Platforming UOP:</strong> 4-reactor cascade + continuous catalyst regeneration, Pt-Sn/Al2O3 catalyst, 500 °C × 5 бар, H2 produced 80-100 Nm³/m³ feed;</li>
            <li><strong>Reformate fractionation:</strong> distillation column в depentanizer + extractive distillation, separates C6-C9 для BTX downstream;</li>
            <li><strong>UOP Sulfolane extraction:</strong> liquid-liquid extraction с sulfolane solvent (3,3-thiolane-1,1-dioxide), high-selectivity для aromatics over paraffins/naphthenes, recovery 99.5%;</li>
            <li><strong>Tatoray process:</strong> conversion toluene + heavy aromatics → mixed xylenes + benzene (transalkylation), zeolite catalyst @ 350-450 °C × 30 бар;</li>
            <li><strong>Parex (UOP) PX separation:</strong> simulated moving bed SMB chromatography с zeolite Y, output PX purity 99.7-99.9%;</li>
            <li><strong>Isomar isomerization:</strong> remaining ortho-xylene + meta-xylene + ethylbenzene → equilibrium mixture, recycle обратно в Parex;</li>
            <li><strong>Heat integration network:</strong> 50+ shell-and-tube heat exchangers, energy savings 35-40% vs standalone;</li>
            <li><strong>Steam system:</strong> own ТЭЦ 50 МВт + boilers для HP/MP/LP steam grid;</li>
            <li><strong>Storage:</strong> 12 spheres × 1000 м³ для feedstock + 8 atmospheric tanks для PX/benzene/toluene storage 30 000-50 000 т каждый;</li>
            <li><strong>Loading + offloading:</strong> railcar gantry для PX export к PET plant (рыночный leader China) + truck loading для domestic chemical industry;</li>
            <li><strong>Flare:</strong> 80-100 м elevated flare для emergency vapors + tip steam-assisted smokeless;</li>
            <li><strong>Wastewater treatment:</strong> sour water stripper + bio-treatment + COD removal до &lt;100 mg/L per EU IED BAT;</li>
            <li><strong>Distributed Control System DCS:</strong> Honeywell Experion / Yokogawa CENTUM VP, 5000+ tags, ESD layer per IEC 61511;</li>
            <li><strong>Benzene exposure controls:</strong> OSHA PEL 1 ppm 8-h TWA, area monitors каждые 5-10 м, personal samplers для operators 50-100 чел.</li>
          </ul>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Process для PX 500 кт/год</h2>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только хроматография без reformer" },
              { v: "b", t: "Только distillation column из reformate" },
              { v: "c", t: "Только cumene process" },
              { v: "d", t: "Integrated UOP BTX Complex Reformer→Sulfolane→Tatoray→Parex→Isomar: (1) naphtha 70-110 °C feed hydrotreated сера<0.5 ppm, (2) CCR Platforming Pt-Sn catalyst converts naphthenes → aromatics @ 500 °C × 5 бар, продукт reformate aromatic content 65-72%, (3) Sulfolane extractive distillation separates BTX from paraffins recovery 99.5%, (4) Tatoray transalkylation toluene→benzene+xylenes equilibrium catalyst ZSM-5, (5) Parex SMB simulated moving bed separates PX 99.7% from mixed C8 aromatics, (6) Isomar isomerizes remaining ortho/meta/EB back to equilibrium, (7) recycle loops Parex+Isomar+Tatoray для 95% PX selectivity на total BTX feed. UOP licensed since 1971 most common worldwide for >50 BTX plants. EU IED BAT Refining + API RP 581 + СН РК 4.04-15" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />{o.t}
              </label>
            ))}
          </div>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Feed naphtha rate</h2>
          <p className="text-slate-300">Выпуск 500 000 т PX/год. Reformate aromatic content 70%, PX selectivity на aromatics 60%. Расход naphtha (т/год)?</p>
          <input type="text" value={ex2} onChange={(e) => setEx2(e.target.value)} placeholder="т/год" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${correct.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p>Naphtha = 500 000 / (0.7 × 0.6) = <strong>1.19 млн т/год</strong> naphtha feed. Атырау НПЗ ~5 млн т/год нефти, naphtha ~25% = 1.25 млн т ⇒ matches.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс BTX Complex 500 кт PX/год</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>CCR Platforming UOP licensed под ключ = 280 млрд</li>
            <li>Naphtha hydrotreater + H2 plant SMR = 95 млрд</li>
            <li>Sulfolane extraction columns + solvent inventory = 65 млрд</li>
            <li>Tatoray + Parex SMB + Isomar = 220 млрд</li>
            <li>Heat integration network 50+ HE + steam loop = 75 млрд</li>
            <li>ТЭЦ 50 МВт + boilers HP/MP/LP = 85 млрд</li>
            <li>Storage 12× 1000 м³ spheres + 8× tanks PX/B/T = 50 млрд</li>
            <li>Flare 80 м + DCS + safety + EU IED BAT compliance + проект 4% + ПИР + СП + PNR = 80 млрд</li>
          </ul>
          <input type="text" value={ex3} onChange={(e) => setEx3(e.target.value)} placeholder="тг" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${correct.ex3 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p><strong>~950 млрд тг (~$2B USD)</strong>. Удельная — $4000/т PX/год.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Benzene exposure control</h2>
          <div className="space-y-2">
            {[
              { v: "a", t: "Никаких мер — операторы привыкли" },
              { v: "b", t: "Только годовой осмотр" },
              { v: "c", t: "Comprehensive benzene exposure program per OSHA 29 CFR 1910.1028 + ECHA REACH SVHC: (1) PEL 1 ppm 8-h TWA, Action Level 0.5 ppm, STEL 5 ppm; (2) area monitors fixed Drager Polytron 8200 каждые 5-10 м + personal samplers Casella 3M 3520 для operators; (3) medical surveillance — annual benzene-specific blood (CBC complete blood count) + hematology + monthly urinary trans,trans-muconic acid biomarker; (4) PPE — supplied air respirator SAR Drager PSS 5000 (no half-face cartridge — benzene absorbed through skin); (5) closed-loop sample systems no open-air vapor; (6) leak detection LDAR EPA Method 21 portable FID каждый месяц all flange/valve; (7) cancer warning labels + restricted access + 40-hr training initial + 8-hr annual refresher; (8) IARC Group 1 carcinogen → REACH SVHC restricted + EU CMR substances; OSHA 29 CFR 1910.1028 + ECHA REACH + EU IED BAT + IARC Monograph 100F + СН РК 4.04-15" },
              { v: "d", t: "Только respirator polymask" },
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
            <li><strong>EU IED BAT Reference Refining (REF BREF)</strong> 2015</li>
            <li><strong>API RP 581</strong> — Risk-Based Inspection Methodology</li>
            <li><strong>API RP 538</strong> — Industrial Fired Boilers</li>
            <li><strong>OSHA 29 CFR 1910.1028</strong> — Benzene Standard</li>
            <li><strong>IARC Monograph 100F</strong> — Chemical Agents (benzene Group 1 carcinogen)</li>
            <li><strong>ECHA REACH Regulation 1907/2006</strong></li>
            <li><strong>IEC 61511</strong> — Safety Instrumented Systems</li>
            <li><strong>СН РК 4.04-15</strong> — Цветная и нефтехимическая металлургия</li>
            <li><strong>OPEC Refinery Standards</strong></li>
            <li><strong>UOP Process Licensors Documentation</strong></li>
          </ul>
        </section>
      </main>
    </div>
  );
}
