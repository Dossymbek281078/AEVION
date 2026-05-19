"use client";
import Link from "next/link";
import { useState } from "react";

export default function SupercapacitorFlywheelStoragePage() {
  const [ex1, setEx1] = useState("");
  const [ex2, setEx2] = useState("");
  const [ex3, setEx3] = useState("");
  const [ex4, setEx4] = useState("");
  const [showResults, setShowResults] = useState(false);
  const ex2N = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2OK = !isNaN(ex2N) && Math.abs(ex2N - 30) <= 4;
  const ex3N = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3OK = !isNaN(ex3N) && Math.abs(ex3N - 18_000_000_000) <= 1_800_000_000;
  const correct = { ex1: ex1 === "d", ex2: ex2OK, ex3: ex3OK, ex4: ex4 === "c" };
  const score = Object.values(correct).filter(Boolean).length;
  const oc = (s: string, v: string, ok: boolean) => !showResults || s !== v ? (s === v ? "border-blue-500 bg-blue-500/20" : "border-slate-700 hover:border-slate-500") : ok ? "border-emerald-500 bg-emerald-500/20" : "border-rose-500 bg-rose-500/20";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300 hover:text-blue-200">← К разделам</Link>
          <div className="text-xs text-slate-500">Supercapacitor + Flywheel — короткое storage</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold">🌀 Supercapacitor + Flywheel — Fast Storage</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #299. Maxwell BoostCap Supercapacitor (ультраконденсаторы)
            + Beacon Power Flywheel Energy Storage (FES) — категория «fast
            storage» для frequency regulation ({"<"}1 sec response) + voltage
            sag mitigation. Supercapacitor 2.7 В × 3000 F = 8200 Дж/cell,
            100 000+ cycles, 95% round-trip efficiency, calendar life 10-15 лет.
            Flywheel 25 кВт·ч @ 5 кВт × 5 ч @ 16 000 rpm composite rim
            (Beacon Power Smart Matrix), vacuum housing + magnetic bearing.
            Applications: railway regenerative braking, wind farm grid-tie
            stabilization, UPS critical loads data centers. NEMA / IEC 61881
            (railway) + IEC 62933-5-2 + СН РК 4.04-09.
          </p>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав 5 МВт hybrid Supercap+Flywheel</h2>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Supercapacitor modules:</strong> Maxwell BoostCap 3.0V 3000F × 1000 series = 3000V × 3000 F = 13.5 МДж capacity, layout 6 modules в каждом cabinet × 50 cabinets;</li>
            <li><strong>Flywheel array:</strong> Beacon Power Smart Matrix 100 kWh × 25 units = 2.5 МВт·ч @ 16 000 rpm; composite carbon fiber rim Ø1 м H=1.5 m в vacuum housing 10⁻⁴ Torr;</li>
            <li><strong>Magnetic bearing:</strong> active + passive Halbach array, no contact = no wear, vacuum eliminates aerodynamic drag, self-discharge 1-2%/час;</li>
            <li><strong>Motor-generator:</strong> high-speed permanent magnet synchronous Toshiba PMSM 100 кВт each, induction + flux-weakening control;</li>
            <li><strong>Power conversion:</strong> ABB ACS800 4-quadrant inverter, output 480 В AC 3-phase, response 1-5 ms;</li>
            <li><strong>Vacuum housing:</strong> SS 316L pressure vessel ASME Section VIII, burst containment shield 10 mm thick для catastrophic flywheel failure (energy 10-50 МДж);</li>
            <li><strong>Building enclosure:</strong> reinforced concrete bunker для catastrophic containment, separate cells per flywheel unit (chain failure prevention);</li>
            <li><strong>Cooling:</strong> closed-loop water for motor + supercap, 50-100 кВт thermal removal;</li>
            <li><strong>Grid-tie transformer:</strong> 0.48/33 кВ 6 МВА low-impedance + step-up к КЕГОК 220 кВ;</li>
            <li><strong>SCADA + control:</strong> Wonderware AVEVA real-time с millisecond response для frequency regulation;</li>
            <li><strong>Fire suppression:</strong> NFPA 855 enhanced — dry chemical (vs water для vacuum housing risk);</li>
            <li><strong>Spinning reserve replacement:</strong> 5 МВт × 15 min = 1.25 МВт·ч для covering primary frequency response (1-30 sec) before slower BESS catches up;</li>
            <li><strong>Mounting:</strong> heavy-duty steel platform с anti-vibration isolation + seismic 8-9 баллов compliance;</li>
            <li><strong>Auxiliary loads:</strong> vacuum pumps + cooling chiller + control electronics + lighting = 50-100 кВт;</li>
            <li><strong>Maintenance:</strong> bearing inspection visual каждые 5 лет, full rebuild каждые 20 лет (vs Li-ion BESS battery replacement каждые 10-15 лет).</li>
          </ul>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Когда supercap+flywheel vs BESS</h2>
          <div className="space-y-2">
            {[
              { v: "a", t: "Никогда — BESS всегда лучше" },
              { v: "b", t: "Только для railway метро" },
              { v: "c", t: "Только для academic research" },
              { v: "d", t: "Hybrid Supercap+Flywheel вместо Li-ion BESS когда нужны: (1) high power short duration (P/E ratio >10:1), (2) frequency response <100 ms (BESS 100-500 ms), (3) >100 000 cycles per day (BESS deteriorates after 5000), (4) extreme temperature -40 +60 °C (Li-ion only -20 +40), (5) explosion-prone environments (Li-ion thermal runaway risk). Applications: PJM/CAISO frequency regulation, regenerative braking metro, wind farm grid-tie smoothing, data center UPS critical loads с millisecond ride-through. Beacon Power 20 MW Stephentown NY (2011) — 2,500,000 cycles vs Li-ion 5,000 в same period" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />{o.t}
              </label>
            ))}
          </div>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Energy storage MJ</h2>
          <p className="text-slate-300">Flywheel 1000 кг compositе carbon fiber rim, Ø1 м, ω = 16 000 rpm = 1675 rad/s. I=0.5·m·r² для тонкого цилиндра. Сколько МДж?</p>
          <input type="text" value={ex2} onChange={(e) => setEx2(e.target.value)} placeholder="МДж" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${correct.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p>E = ½·I·ω² = ½·(0.5·1000·0.25)·1675² = 175 МДж теоретическая. С учётом max stress in CF (1500 MPa) reality ≈ <strong>30-40 МДж</strong> = 25 кВт·ч max (Beacon Power Smart Matrix).</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс 5 МВт hybrid</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>Maxwell BoostCap supercap 50 cabinets × 200 млн = 10 млрд</li>
            <li>Beacon Power Smart Matrix flywheel 25 unit × 100 kWh × 50 млн = 1.25 млрд</li>
            <li>Magnetic bearing + vacuum housing + motor-generator = 1.8 млрд</li>
            <li>Power conversion ABB ACS800 4-quadrant + filters = 0.85 млрд</li>
            <li>Building reinforced concrete bunker burst containment = 1.2 млрд</li>
            <li>Grid-tie 6 МВА + 220 кВ tie-line + protection = 1.5 млрд</li>
            <li>SCADA + control + fire suppression NFPA 855 = 0.5 млрд</li>
            <li>Cooling + auxiliaries + spare + insurance + project 5% = 0.9 млрд</li>
          </ul>
          <input type="text" value={ex3} onChange={(e) => setEx3(e.target.value)} placeholder="тг" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${correct.ex3 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p><strong>~18 млрд тг (~$38M USD)</strong> 5 МВт × 15 мин. Удельная — $7600/кВт (vs BESS $375/кВт·ч = $1500/кВт @ 4-час). Supercap+Flywheel premium для fast response.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Containment burst failure</h2>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только перфорированный кожух" },
              { v: "b", t: "Никакой особой защиты" },
              { v: "c", t: "Multi-layer containment per UL 9540 + IEC 62933-5-2: (1) inner vacuum housing SS 316L 10 мм ASME Section VIII Class 2, (2) middle steel ring 50 мм surrounding rotor, (3) outer reinforced concrete bunker 0.5 м thick для catastrophic burst (energy 30-50 МДж), (4) seismic isolation 8-9 баллов, (5) separate cell per flywheel unit (Beacon Stephentown lesson: 1 unit failure 2011 contained), (6) automatic safe spin-down при > vibration threshold detection 100 µm displacement, (7) burst pattern modeling FEA Abaqus + bench test full-scale 1 unit, (8) annual non-destructive testing UT ultrasonic on rotor + bearings; IEC 62933-5-2 + UL 9540 + ASME Section VIII + ANSI N14.5" },
              { v: "d", t: "Только пожарная сигнализация" },
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
            <li><strong>IEC 62933-5-2</strong> — Electrical Energy Storage Safety</li>
            <li><strong>IEC 62619</strong> — Secondary Cells Safety</li>
            <li><strong>UL 9540 / 9540A</strong> — Energy Storage Systems</li>
            <li><strong>IEC 61881</strong> — Railway Power Storage</li>
            <li><strong>NFPA 855</strong> — Stationary Energy Storage</li>
            <li><strong>ASME Section VIII Div 1 + 2</strong> — Pressure Vessels (для vacuum housing)</li>
            <li><strong>ANSI N14.5</strong> — Containment Leakage Tests</li>
            <li><strong>IEEE 2030</strong> — Smart Grid Interoperability</li>
            <li><strong>СН РК 4.04-09</strong> — Электрические станции</li>
            <li><strong>ENTSO-E Network Code</strong> — Grid balance</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
