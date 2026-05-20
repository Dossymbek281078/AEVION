"use client";
import Link from "next/link";
import { useState } from "react";

export default function EthyleneSteamCrackerPage() {
  const [ex1, setEx1] = useState("");
  const [ex2, setEx2] = useState("");
  const [ex3, setEx3] = useState("");
  const [ex4, setEx4] = useState("");
  const [showResults, setShowResults] = useState(false);
  const ex2N = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2OK = !isNaN(ex2N) && Math.abs(ex2N - 850) <= 85;
  const ex3N = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3OK = !isNaN(ex3N) && Math.abs(ex3N - 1_400_000_000_000) <= 140_000_000_000;
  const correct = { ex1: ex1 === "d", ex2: ex2OK, ex3: ex3OK, ex4: ex4 === "c" };
  const score = Object.values(correct).filter(Boolean).length;
  const oc = (s: string, v: string, ok: boolean) => !showResults || s !== v ? (s === v ? "border-blue-500 bg-blue-500/20" : "border-slate-700 hover:border-slate-500") : ok ? "border-emerald-500 bg-emerald-500/20" : "border-rose-500 bg-rose-500/20";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300 hover:text-blue-200">← К разделам</Link>
          <div className="text-xs text-slate-500">Steam Cracker — Ethylene Plant</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold">🔥 Steam Cracker — Ethylene Production</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #301. КазМунайГаз GPC (Kazakhstan Petrochemical Complex)
            Атырау, anonsed 2022 — ethylene plant 600 кт/год + polymer chain.
            Reference: SABIC Yanbu 4.0 Mt, Reliance Jamnagar 1.5 Mt, Borealis
            Stenungsund Sweden 0.6 Mt, INEOS Cologne 2.5 Mt. Steam cracking —
            thermal cracking saturated hydrocarbons (ethane, propane, naphtha)
            при 800-850 °C × 0.5-2 sec residence в furnace coils → продукты
            ethylene (C2H4 ~25-50% wt) + propylene + butadiene + pyrolysis
            gasoline. После cracking — cooling в transfer line exchanger TLE,
            каскад distillation columns. Linde / Technip / Lummus licensed
            технологии. EU IED BAT LVOC + API + СН РК 4.04-15.
          </p>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав ethylene plant 600 кт/год</h2>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Cracking furnace:</strong> 6-8 furnaces в parallel, twin-radiant box design Stone & Webster USC type, height 30 м, ширина 5 м; coil tubes Cr-Ni alloy 9%Cr (HK-40) / 25Cr-35Ni-Nb (HP-Mod), inside diameter 60-90 мм длиной 150 м serpentine;</li>
            <li><strong>Burners:</strong> 80-200 floor + side burners per furnace, dual-fuel natural gas + methane-hydrogen tail-gas, low-NOx selective non-catalytic reduction;</li>
            <li><strong>Steam-to-hydrocarbon ratio:</strong> 0.3-0.4 wt/wt for ethane crack, 0.7-1.0 для naphtha (steam dilutes hydrocarbon partial pressure → minimises coking);</li>
            <li><strong>Transfer Line Exchanger TLE:</strong> rapid quench cracked gas from 850 °C to 400 °C в 50-100 ms (HHTE Linde / SHG Technip), generates HP steam 110-120 бар superheated;</li>
            <li><strong>Quench tower:</strong> water + oil quench cools gas to 200 °C, separates fuel oil + pyrolysis gasoline drop-out;</li>
            <li><strong>Cracked Gas Compressor CGC:</strong> 4-5 stage centrifugal compressor 80 МВт steam-turbine driven, compresses cracked gas from 1.5 to 35 бар;</li>
            <li><strong>Caustic + amine treating:</strong> NaOH 10% scrubber removes H2S + CO2 to {"<"}1 ppm;</li>
            <li><strong>Cold Box (Demethanizer prep):</strong> propane refrigeration -40 °C + ethylene refrigeration -101 °C cascade, prepares feed для cryogenic distillation;</li>
            <li><strong>Demethanizer:</strong> cryogenic column -100 °C × 35 бар, separates CH4 from C2+ hydrocarbons (CH4 used as tail-gas fuel back в furnaces);</li>
            <li><strong>Deethanizer:</strong> separates C2 (ethylene + ethane) overhead from C3+ bottom;</li>
            <li><strong>Acetylene hydrogenation:</strong> Pt catalyst @ 50 °C, converts trace acetylene C2H2 → ethylene (acetylene poisons downstream polymer catalyst);</li>
            <li><strong>C2 splitter:</strong> high-purity ethylene 99.95% overhead, ethane bottom recycled к cracker;</li>
            <li><strong>Depropanizer + propylene unit:</strong> propylene 99.5% polymer-grade overhead;</li>
            <li><strong>BD extraction:</strong> butadiene 99.5% via NMP extraction column (BASF process), valuable feedstock для rubber industry;</li>
            <li><strong>Pyrolysis gasoline + fuel oil:</strong> by-products fed к BTX complex (aromatics extraction) или direct fuel oil sale;</li>
            <li><strong>Olefins flare:</strong> 100 м tall H ground-flare + elevated flare для emergencies, hydrocarbon emissions 0.05% от throughput per EU IED BAT.</li>
          </ul>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Cracking technology</h2>
          <div className="space-y-2">
            {[
              { v: "a", t: "Простая distillation сырой нефти" },
              { v: "b", t: "Только catalytic cracking FCC" },
              { v: "c", t: "Только oxidative coupling OCM" },
              { v: "d", t: "Steam Cracking thermal pyrolysis Linde/Technip/Lummus furnace coil 850 °C × 0.5-2 sec residence: (1) feed naphtha/ethane/propane + steam 0.3-1.0 ratio в radiant coil тубы HP-Mod alloy 25Cr-35Ni-Nb 150 м serpentine, (2) thermal cracking C-C bond breakage → smaller olefins ethylene 25-35% wt yield (naphtha) или 50-55% (ethane), (3) quench TLE Transfer Line Exchanger 50 ms rapid cool 850→400 °C для prevent secondary reactions, (4) cracked gas compression 4-5 stages centrifugal, (5) cryogenic separation demethanizer-deethanizer-C2 splitter, (6) propylene 99.5% poly-grade + butadiene 99.5% by-products, (7) coke deposition требует de-coking every 30-90 дней (steam-air decoke 800 °C). EU IED BAT LVOC + API RP + AIChE Pyrolysis Conference + СН РК 4.04-15" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />{o.t}
              </label>
            ))}
          </div>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Cracking temperature</h2>
          <p className="text-slate-300">Coil outlet temperature COT для naphtha cracker (°C)?</p>
          <input type="text" value={ex2} onChange={(e) => setEx2(e.target.value)} placeholder="°C" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${correct.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p>COT = <strong>850 °C</strong> для high-severity (ethylene yield 30-32% naphtha) vs 820 °C low-severity (yield 26%). Limited by coke deposition rate + tube metallurgy (HP-Mod max 1100 °C tube wall).</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс ethylene plant 600 кт/год</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>Cracking furnaces 8× Linde radiant box + TLE = 350 млрд</li>
            <li>CGC compressor 80 МВт + steam turbine + intercoolers = 180 млрд</li>
            <li>Caustic + amine treating + sour water = 65 млрд</li>
            <li>Cold box propane/ethylene cascade refrigeration = 220 млрд</li>
            <li>Demethanizer/Deethanizer/C2-C3 splitters + reboilers = 280 млрд</li>
            <li>BD extraction NMP + propylene unit + acetylene hydrog. = 95 млрд</li>
            <li>Steam ТЭЦ 200 МВт + cooling water + utilities = 90 млрд</li>
            <li>Flare 100 м + ground flare + EU IED BAT + проект 4% + PNR = 120 млрд</li>
          </ul>
          <input type="text" value={ex3} onChange={(e) => setEx3(e.target.value)} placeholder="тг" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${correct.ex3 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p><strong>~1.4 трлн тг (~$3B USD)</strong> на 600 кт ethylene + 350 кт propylene + 100 кт butadiene. Удельная — $5000/т ethylene.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — De-coking maintenance</h2>
          <div className="space-y-2">
            {[
              { v: "a", t: "Никогда не нужно — coke выходит сам" },
              { v: "b", t: "Каждые 10 лет полная замена furnaces" },
              { v: "c", t: "De-coking каждые 30-90 days по AIChE Best Practices: (1) coke deposition внутри coil tubes снижает heat transfer +30% energy demand + риск burnout, (2) decoke сменяет hydrocarbon feed на steam-air mixture, (3) 800 °C × 24-48 hr controlled burnoff C + 1/2 O2 → CO + CO2, (4) decoke gas routed к decoke drum + CO scrubber + flare, (5) после decoke tube wall thickness measurement + radiography для assess remaining wall, replace coil каждые 5-7 years (creep + carburization wear), (6) decoke schedule 4-12 times/year, lost production 0.5-1% annual, (7) advanced anti-coke coatings BASF CoatAlloy GT-1 + Quantiam CarbosafeOn reduce coking 30-50% + extend decoke interval. AIChE Pyrolysis Conference + API RP 581 + EU IED BAT LVOC + СН РК 4.04-15" },
              { v: "d", t: "Только раз в год по графику" },
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
            <li><strong>EU IED BAT Reference LVOC</strong> — Large Volume Organic Chemicals 2017</li>
            <li><strong>API RP 530</strong> — Calculation of Heater-Tube Thickness in Petroleum Refineries</li>
            <li><strong>API RP 538</strong> — Industrial Fired Boilers</li>
            <li><strong>API RP 581</strong> — Risk-Based Inspection</li>
            <li><strong>ASME Section VIII Div 2</strong> — Pressure Vessels</li>
            <li><strong>ASME B31.3</strong> — Process Piping</li>
            <li><strong>IEC 61511</strong> — Safety Instrumented Systems</li>
            <li><strong>NFPA 30</strong> — Flammable + Combustible Liquids</li>
            <li><strong>СН РК 4.04-15</strong> — Цветная + нефтехимическая</li>
            <li><strong>OSHA PSM 29 CFR 1910.119</strong></li>
          </ul>
        </section>
      </main>
    </div>
  );
}
