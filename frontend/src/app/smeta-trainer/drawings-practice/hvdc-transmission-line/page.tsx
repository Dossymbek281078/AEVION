"use client";
import Link from "next/link";
import { useState } from "react";

export default function HvdcTransmissionLinePage() {
  const [ex1, setEx1] = useState("");
  const [ex2, setEx2] = useState("");
  const [ex3, setEx3] = useState("");
  const [ex4, setEx4] = useState("");
  const [showResults, setShowResults] = useState(false);
  const ex2N = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2OK = !isNaN(ex2N) && Math.abs(ex2N - 1500) <= 150;
  const ex3N = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3OK = !isNaN(ex3N) && Math.abs(ex3N - 1_800_000_000_000) <= 180_000_000_000;
  const correct = { ex1: ex1 === "d", ex2: ex2OK, ex3: ex3OK, ex4: ex4 === "c" };
  const score = Object.values(correct).filter(Boolean).length;
  const oc = (s: string, v: string, ok: boolean) => !showResults || s !== v ? (s === v ? "border-blue-500 bg-blue-500/20" : "border-slate-700 hover:border-slate-500") : ok ? "border-emerald-500 bg-emerald-500/20" : "border-rose-500 bg-rose-500/20";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300 hover:text-blue-200">← К разделам</Link>
          <div className="text-xs text-slate-500">HVDC передача постоянного тока</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold">⚡ HVDC — High Voltage Direct Current</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #298. План КЕГОК/Россети — HVDC Экибастуз-Урумчи 1500 км
            ±800 кВ 6 ГВт для экспорта казахстанской мощности в Китай (Алашанькоу
            пограничный перевал). Reference: Cross-Border HVDC Tianzhong UHVDC
            ±800 кВ Китай (2000 км, 8 ГВт), Belo Monte Brazil ±800 кВ 2540 км,
            Rio Madeira Brazil ±600 кВ. HVDC vs HVAC преимущества: 30-50%
            меньше потерь на 1500+ км, нет реактивной мощности, точная
            controllability flow direction + magnitude, asynchronous link
            между разными частотными сетями. Технология — VSC (Voltage Source
            Converter) Siemens HVDC PLUS / ABB HVDC Light с IGBT modular
            multilevel converter MMC. Альтернатива LCC (Line-Commutated
            Converter) с thyristor для bulk power transfer. IEEE 1158-1991 +
            IEC 60633 + CIGRE B4 + СН РК 4.04-09.
          </p>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав HVDC ±800 кВ 6 ГВт 1500 км</h2>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Converter station rectifier (Sending):</strong> Экибастуз — AC 500 кВ from grid → DC ±800 кВ через 12-pulse thyristor valves (LCC) или MMC (VSC), 6 ГВт capacity, footprint 30 га;</li>
            <li><strong>Thyristor valves (LCC):</strong> ABB Senktan Smart Wireless / Siemens DC PLUS valve, каждая cell содержит 12-pulse bridge с 2000-3000 series thyristors 8.5 кВ each;</li>
            <li><strong>Converter transformer:</strong> 1 трансформатор Y-Yd 1500 МВА × 12 шт (6 на rectifier + 6 на inverter), oil-immersed convertor service with high impedance 18-22%;</li>
            <li><strong>DC reactor:</strong> air-core 200-400 мГн × 6 ГВт current 3750 А, dampens DC current ripple + faults;</li>
            <li><strong>Smoothing capacitor:</strong> для VSC option — DC bus capacitor 5-10 mF total, allows fast power reversal;</li>
            <li><strong>AC filters:</strong> на rectifier + inverter ends, harmonic filters AC 5/7/11/13 + DC ripple suppression filters;</li>
            <li><strong>Overhead transmission line:</strong> бипольная +800/-800 кВ DC, conductor ACSR Bluebird 1431 kcmil bundled 6× per phase, structure quad-tower 220-280 кНм torque rating, span 500-700 м;</li>
            <li><strong>Tower:</strong> guyed-V tower H=60-80 м, base footprint 5×5 м, угол 0-30° turn capability, anchoring 4 guy-cables 60-90 м;</li>
            <li><strong>Ground electrode (Earth Return Mode):</strong> 50 km from converter, 100-300 А earth current при normal bipolar operation = symmetric flow, но в monopolar emergency возможно 3750 А earth return — мониторинг corrosion + utility coordination;</li>
            <li><strong>Converter station inverter (Receiving):</strong> Урумчи Western China — DC ±800 кВ → AC 500 кВ, mirror configuration to rectifier;</li>
            <li><strong>Cooling system:</strong> closed-loop deionized water + ethylene-glycol для valve hall — 12-15 МВт thermal removal на converter station (5-7% losses);</li>
            <li><strong>Valve hall:</strong> shielded building Faraday cage Cu mesh + EMI suppression filters, suspended thyristor valves in вертикал. конфигурация, H=15-25 м;</li>
            <li><strong>SCADA + protection:</strong> Siemens SIPROTEC + ABB RELION; high-speed DC fault detection 1-2 ms;</li>
            <li><strong>Control building:</strong> redundant N+N control system + UPS 30 мин backup + Honeywell DCS, 24/7 operations;</li>
            <li><strong>HVDC ground electrode protection:</strong> 24-hour electrochemical sensor monitoring + sacrificial anodes Mg/Al for corrosion mitigation along pipeline crossings.</li>
          </ul>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — VSC vs LCC choice</h2>
          <p className="text-slate-300">Для Экибастуз-Урумчи 1500 км 6 ГВт что выбрать по CIGRE B4?</p>
          <div className="space-y-2">
            {[
              { v: "a", t: "HVAC 500 кВ только — старые технологии лучше" },
              { v: "b", t: "LCC только — нет преимуществ VSC для bulk" },
              { v: "c", t: "VSC только — несмотря на более высокий капекс" },
              { v: "d", t: "LCC Line-Commutated Converter ±800 кВ для bulk transfer (6 ГВт, дальние LCC дешевле VSC 30%), но с STATCOM для voltage support при weak AC system. CIGRE B4 best practice: LCC для P>3 ГВт + distance >1000 км, VSC для black-start capability + offshore wind. CIGRE TB 269 + IEEE 1158-1991 + IEC 60633" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />{o.t}
              </label>
            ))}
          </div>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Длина ЛЭП</h2>
          <p className="text-slate-300">HVDC Экибастуз-Алашанькоу (Хоргос) сколько км?</p>
          <input type="text" value={ex2} onChange={(e) => setEx2(e.target.value)} placeholder="км" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${correct.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p>Экибастуз → Алашанькоу прямой ≈ <strong>1500 км</strong>. HVDC break-even с HVAC при ≥600 км — здесь однозначно HVDC.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс HVDC ±800 кВ 6 ГВт 1500 км</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>Rectifier converter station Siemens HVDC PLUS LCC + valves + transformers + filters = 500 млрд</li>
            <li>Inverter converter station (Урумчи mirror) = 500 млрд</li>
            <li>Overhead transmission ±800 кВ bipolar 1500 км × 350 млн тг/км (conductor + towers) = 525 млрд</li>
            <li>Ground electrode + earth return system = 30 млрд</li>
            <li>Right-of-way + permits + ESIA EBRD 1500 км corridor = 80 млрд</li>
            <li>Control building + SCADA + protection redundant N+N = 35 млрд</li>
            <li>EPC managing + projecting 3% + insurance + ICCP grounding = 130 млрд</li>
          </ul>
          <input type="text" value={ex3} onChange={(e) => setEx3(e.target.value)} placeholder="тг" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${correct.ex3 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p><strong>~1.8 трлн тг (~$3.8B USD)</strong>. Удельная — $1.2M/MW-km capacity (LCC ±800 кВ).</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — DC fault protection</h2>
          <p className="text-slate-300">DC short-circuit в pole conductor → что нужно?</p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Просто закрыть AC breaker на входе" },
              { v: "b", t: "Никаких особых мер" },
              { v: "c", t: "Multi-stage DC fault protection per CIGRE TB 387: (1) DCCB DC Circuit Breaker Siemens DCKAB с 1-3 ms operation (vs 100 ms AC), (2) hybrid mechanical-power-electronic, (3) traveling wave protection (light velocity) с distance detection ±5 km accuracy, (4) DC line surge arrester ZnO Pinceti type IV, (5) bipolar configuration позволяет monopolar operation при single-pole fault (50% capacity continue), (6) DC reactor 200 мГн limits di/dt to safe values, (7) auto-reclosure после 200 ms для transient faults; CIGRE TB 387 + IEC 62501 + IEEE 1158" },
              { v: "d", t: "Перейти на AC" },
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
            <li><strong>IEEE 1158-1991</strong> — HVDC Systems</li>
            <li><strong>IEC 60633</strong> — Terminology for HVDC Power Transmission</li>
            <li><strong>IEC 62501</strong> — DC Circuit Breakers</li>
            <li><strong>CIGRE B4 (Brochures 269, 387, 533)</strong> — HVDC and Power Electronics Working Group</li>
            <li><strong>CIGRE TB 533</strong> — HVDC Grid Feasibility Study</li>
            <li><strong>IEEE 519</strong> — Harmonic Control</li>
            <li><strong>СН РК 4.04-09</strong> — Электрические станции</li>
            <li><strong>ПУЭ-7</strong> — Электроустановки</li>
            <li><strong>СНиП 2.05.06-85</strong> — Магистральные линии электропередачи</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
