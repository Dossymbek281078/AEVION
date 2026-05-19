"use client";
import Link from "next/link";
import { useState } from "react";

export default function HyperbaricOxygenChamberPage() {
  const [ex1, setEx1] = useState(""); const [ex2, setEx2] = useState(""); const [ex3, setEx3] = useState(""); const [ex4, setEx4] = useState(""); const [showResults, setShowResults] = useState(false);
  const e2 = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const e2OK = !isNaN(e2) && Math.abs(e2 - 60) <= 6;
  const e3 = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const e3OK = !isNaN(e3) && Math.abs(e3 - 4_500_000_000) <= 450_000_000;
  const ok = { ex1: ex1 === "d", ex2: e2OK, ex3: e3OK, ex4: ex4 === "c" };
  const score = Object.values(ok).filter(Boolean).length;
  const oc = (s: string, v: string, isok: boolean) => !showResults || s !== v ? (s === v ? "border-blue-500 bg-blue-500/20" : "border-slate-700 hover:border-slate-500") : isok ? "border-emerald-500 bg-emerald-500/20" : "border-rose-500 bg-rose-500/20";
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10"><div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between"><Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300">← К разделам</Link><div className="text-xs text-slate-500">HBO Hyperbaric Oxygen</div></div></header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section><h1 className="text-3xl md:text-4xl font-bold">🫁 Гипербарическая Оксигенация HBO</h1>
          <p className="mt-3 text-slate-400 max-w-3xl">Модуль #311. HBO центр Алматы / Астана медицинский для лечения CO-отравления, газовой гангрены, decompression sickness divers, diabetic foot ulcer, radiation osteonecrosis. Multiplace HBO chamber pressure 1.4-3.0 ATA (atmospheres absolute) × 60-120 min sessions. Reference: Sechenov Medical University Moscow, Karolinska Stockholm, Mayo Clinic. Технология — pressure vessel ASME PVHO-1 standard, certified for HBO use. Pure O2 mask delivery + chamber atmosphere air mix. NFPA 99 + ASME PVHO-1 + UHMS Guidelines + СН РК 3.02-19.</p>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав HBO unit multiplace 12-person</h2>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li>Multiplace HBO chamber Sechrist 8800 / Hyperbaric Modular Systems: 4 m × 2.5 m × 2.5 m internal, capacity 12 patients + 2 attendants, design pressure 3.0 ATA absolute (2 ATA gauge), ASME PVHO-1 certified;</li>
            <li>Chamber wall — steel SA-516 Gr 70 inside 25 mm thickness + insulation + outer cladding, hydrotest 1.3× design pressure;</li>
            <li>Door — circular hatch Ø1 m с quick-lock interlock + pressure equalisation port + sight glass;</li>
            <li>Air supply — main compressor 100 м³/час @ 6 bar + reserve, oil-free Atlas Copco LZ-30 + air dryer Atlas Copco MD;</li>
            <li>O2 supply — separate H2-cylinder bank 24× 12 m³ medical-grade 99.5% pure O2 + automatic switchover regulator;</li>
            <li>Inhalation mask + BIBs Built-In Breathing System hood + face-mask, individual O2 supply при 22.4-50 ATA;</li>
            <li>CO2 scrubber — soda lime canister Drager XCO2 для absorption exhaled CO2 ≤0.3%;</li>
            <li>Fire suppression — water deluge 100 L/sec inside chamber (NFPA 99 mandatory для O2-rich environment, fast 5-sec actuation);</li>
            <li>Pressure control — digital PLC Siemens S7-1500 + redundant analog backup, ramp pressurise 0.1-0.2 ATA/min;</li>
            <li>O2 monitor — gas analyzer continuous chamber atmosphere 21-23.5% O2 max, alarm at 23.6% (fire risk threshold);</li>
            <li>Communication — pneumatic intercom + waterproof speakers для contact с outside operator;</li>
            <li>Outside operator console + supervisor — pressure, depth, time displayed, manual override emergency vent;</li>
            <li>Patient ICU monitoring — vitals through chamber penetrators ECG + BP + SpO2 + capnography per ESC;</li>
            <li>Emergency egress — backup hatches + emergency rescue protocol training quarterly drills;</li>
            <li>Adjacent treatment room для diabetic ulcer dressing + decompression sickness consultation.</li>
          </ul>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Pressure для CO poisoning</h2>
          <div className="space-y-2">{[
            { v: "a", t: "1.0 ATA — обычное атмосферное давление" },
            { v: "b", t: "1.5 ATA — мало эффективно" },
            { v: "c", t: "5 ATA — слишком высоко, риск O2 toxicity" },
            { v: "d", t: "2.8-3.0 ATA для CO poisoning per UHMS Indications + ELHM protocol: (1) CO-Hb half-life в воздух 320 min, на 100% O2 1 ATA 80 min, на 100% O2 2.5 ATA 23 min; (2) 3.0 ATA × 100% O2 × 90 min × 3 sessions для severe poisoning (loss of consciousness, neurological symptoms); (3) prevention delayed neurological sequelae 30% incidence без HBO vs <5% с HBO; (4) другие indications: gas gangrene 2.5 ATA, decompression sickness Type II 2.8 ATA, radiation osteonecrosis 2.4 ATA × 30 sessions, diabetic foot ulcer 2.0-2.4 ATA × 30-60 sessions; (5) contraindications — untreated pneumothorax (absolute), COPD with bullae, claustrophobia; UHMS Indications + ELHM + NFPA 99 + ASME PVHO-1" },
          ].map((o) => (<label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex1, o.v, ok.ex1)}`}><input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />{o.t}</label>))}</div>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Sessions per day</h2>
          <p className="text-slate-300">12 patients × 2-hr session × 2-3 sessions/day × 6 days = total sessions/week:</p>
          <input type="text" value={ex2} onChange={(e) => setEx2(e.target.value)} placeholder="sessions" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${ok.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p>12 × 2.5 × 6 = ~180 patient-sessions/week ⇒ <strong>~60 sessions per chamber day</strong>.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс HBO unit</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>Multiplace chamber Sechrist ASME PVHO-1 certified 12-person = 1.5 млрд</li>
            <li>Air supply Atlas Copco compressor + dryer + reserve = 0.4 млрд</li>
            <li>O2 supply 24-cylinder manifold + automatic switchover = 0.18 млрд</li>
            <li>BIBs hood + face mask × 12 + CO2 scrubber Drager = 0.25 млрд</li>
            <li>Fire suppression NFPA 99 water deluge + redundant = 0.32 млрд</li>
            <li>PLC Siemens S7-1500 + control console + monitoring = 0.45 млрд</li>
            <li>Outside operator + ICU monitoring penetrators = 0.3 млрд</li>
            <li>Building + adjacent treatment room + проект 5% + UHMS audit + insurance = 1.1 млрд</li>
          </ul>
          <input type="text" value={ex3} onChange={(e) => setEx3(e.target.value)} placeholder="тг" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${ok.ex3 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p><strong>~4.5 млрд тг (~$10M USD)</strong> на 12-person multiplace HBO. Окупаемость 5-7 лет при $200-400 per session.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Fire safety</h2>
          <div className="space-y-2">{[
            { v: "a", t: "Огнетушители ABC обычные" },
            { v: "b", t: "Только smoke detectors" },
            { v: "c", t: "Multi-barrier per NFPA 99 + UHMS: (1) chamber atmosphere O2 limit 23.5% (NFPA threshold); above 23.6% fire risk доминирует, automatic vent activation; (2) zero ignition sources — no electronic devices not approved для chamber use, no cell phones, no electric medical devices unless explicitly chamber-rated (Drager Cato), no lighters/matches/smoking obviously; (3) all clothing 100% cotton (no synthetic acrylic/polyester) — synthetic fabrics retain static charge + melt; (4) water deluge 100 L/sec 5-sec actuation, не CO2/halon (would cause O2 displacement в chamber); (5) emergency depressurisation 0.5 ATA/min controlled rate (faster → barotrauma to patients); (6) monthly fire drill + annual full evac drill; (7) operator certification UHMS Hyperbaric Technician 80-hr course; (8) double interlock on doors — both closed before pressurise, both unlocked before vent. NFPA 99 + ASME PVHO-1 + UHMS Indications" },
            { v: "d", t: "Только запрет курения" },
          ].map((o) => (<label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex4, o.v, ok.ex4)}`}><input type="radio" name="ex4" value={o.v} checked={ex4 === o.v} onChange={() => setEx4(o.v)} className="mr-3" />{o.t}</label>))}</div>
        </section>
        <button onClick={() => setShowResults(true)} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-lg font-semibold">Проверить ответы</button>
        {showResults && <section className={`p-6 rounded-xl border-2 ${score === 4 ? "border-emerald-500 bg-emerald-500/10" : score >= 2 ? "border-amber-500 bg-amber-500/10" : "border-rose-500 bg-rose-500/10"}`}><h2 className="text-2xl font-bold">Результат: {score} / 4</h2></section>}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3"><h2 className="text-xl font-semibold text-cyan-300">Нормативная база</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>NFPA 99 — Health Care Facilities Code</li>
            <li>ASME PVHO-1 — Pressure Vessels for Human Occupancy</li>
            <li>UHMS Indications for HBO Therapy 14th</li>
            <li>ELHM European League Hyperbaric Medicine</li>
            <li>ECHM European Committee Hyperbaric Medicine</li>
            <li>СН РК 3.02-19 — Лечебно-проф. учреждения</li>
            <li>ISO 13485 — Medical Devices Quality</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
