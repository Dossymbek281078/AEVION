"use client";
import Link from "next/link";
import { useState } from "react";

export default function RadioTelescopeVlbiPage() {
  const [ex1, setEx1] = useState(""); const [ex2, setEx2] = useState(""); const [ex3, setEx3] = useState(""); const [ex4, setEx4] = useState(""); const [showResults, setShowResults] = useState(false);
  const e2 = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const e2OK = !isNaN(e2) && Math.abs(e2 - 32) <= 3;
  const e3 = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const e3OK = !isNaN(e3) && Math.abs(e3 - 42_000_000_000) <= 4_200_000_000;
  const ok = { ex1: ex1 === "d", ex2: e2OK, ex3: e3OK, ex4: ex4 === "c" };
  const score = Object.values(ok).filter(Boolean).length;
  const oc = (s: string, v: string, isok: boolean) => !showResults || s !== v ? (s === v ? "border-blue-500 bg-blue-500/20" : "border-slate-700 hover:border-slate-500") : isok ? "border-emerald-500 bg-emerald-500/20" : "border-rose-500 bg-rose-500/20";
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10"><div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between"><Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300">← К разделам</Link><div className="text-xs text-slate-500">Radio Telescope VLBI</div></div></header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section><h1 className="text-3xl md:text-4xl font-bold">📡 Радиотелескоп VLBI</h1>
          <p className="mt-3 text-slate-400 max-w-3xl">Модуль #306. РТ-32 IVS (International VLBI Service) — план Алматинский предгорный радиотелескоп для участия в EVN European VLBI Network. Reference: Effelsberg 100 m, Green Bank 100 m, Yebes 40 m, Sheshan 65 m China. Antenna Ø32 m Cassegrain, surface accuracy λ/40 RMS = 0.3 мм для 30 GHz Ka-band. Дрифт-tracking 0.001° точность для VLBI baseline interferometry (combine с глоб. сетью телескопов → resolution arc-microsecond). Cryogenic LNA 4 K helium для T_sys {"<"}30 K. IAU + IVS + ITU-R RA.769 (RFI protection) + СН РК 4.04-04.</p>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав РТ-32 VLBI</h2>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li>Antenna Ø32 m Cassegrain dual-reflector, Vertex / IRA aluminium panels 0.3 мм RMS, CFRP backing;</li>
            <li>Mount AZ-EL Bonfiglioli precision gear, Siemens S120 servo + Heidenhain 28-bit encoder, accuracy 0.001°;</li>
            <li>Foundation 30×30×4 м ж/б B45 + isolation joints (free-floating от soil vibration);</li>
            <li>Sub-reflector Ø3 м CFRP с active focus correction (5-axis hexapod actuator) для compensation gravity sag;</li>
            <li>RF feed dual-pol horn + OMT + cryogenic dewar 4 K Cryomech PT-415 He pulse-tube;</li>
            <li>LNA HEMT InP 0.5-50 GHz Cryo3 Caltech, T_sys 20-50 K в L/S/C/X/Ku/Ka bands;</li>
            <li>Sampler + digital back-end CASPER ROACH-2 + DBE-3 Rb-rated 16 GHz Nyquist;</li>
            <li>Hydrogen maser frequency reference T4Science iMaser 3000 ±2×10⁻¹⁵ stability;</li>
            <li>Data recorder Mark6 24 Gbps × 4 streams → fiber link к JIVE Joint Institute for VLBI Europe correlator;</li>
            <li>Control building + станция operations 24/7 + lab + workshop 500 м²;</li>
            <li>Met station Vaisala WMT700 + atmospheric water vapor radiometer 22/31 GHz;</li>
            <li>Quiet zone 5-10 км radius без mobile transmitters per ITU-R RA.769;</li>
            <li>Fiber-optic link к ALMA-grid + RFI shielding mu-metal + filters;</li>
            <li>Backup DG 500 kVA + UPS 100 kVA × 30 min для observation continuity;</li>
            <li>Maintenance crane 50 t для panel replacement + LNA dewar service.</li>
          </ul>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — VLBI vs single dish</h2>
          <div className="space-y-2">{[
            { v: "a", t: "Single dish даёт лучшее разрешение" },
            { v: "b", t: "VLBI только для radar" },
            { v: "c", t: "Не нужно объединять телескопы" },
            { v: "d", t: "VLBI Very-Long-Baseline Interferometry с глобальной сетью EVN/IVS: (1) angular resolution θ = λ/B где B = baseline 10 000 км (transcontinental); для λ=1 см ⇒ θ=10⁻⁹ rad = 0.2 mas (milliarcsecond) vs single 32 m dish = 1 arcmin = 60 000 mas, (2) correlator JIVE Dwingeloo комбинирует data 20+ телескопов в realtime, (3) H-maser timing ±10⁻¹⁵ stability обеспечивает coherence over 10 km baseline; cryogenic LNA T_sys 20-30 K увеличивает sensitivity 5-10x vs uncooled; (4) РК участвует в EVN observations 100+ sessions/year для астрофизики (AGN, masers, pulsars) + geodesy (Earth rotation, plate tectonics); (5) Future SKA Square Kilometre Array Phase 2 includes РК as candidate site южная пустыня Бетпак-Дала; IAU + IVS + ITU-R RA.769" },
          ].map((o) => (<label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex1, o.v, ok.ex1)}`}><input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />{o.t}</label>))}</div>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Antenna diameter</h2>
          <p className="text-slate-300">Для G/T ≥40 dB/K @ Ka-band T_sys 30 K, η 60%, λ 1 см. Diameter (м)?</p>
          <input type="text" value={ex2} onChange={(e) => setEx2(e.target.value)} placeholder="м" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${ok.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p>G/T = 40 = 10·log(η·(πD/λ)²) − 10·log(T_sys) ⇒ G = 40+15 = 55 dBi = η·(πD/λ)² = 3.2·10⁵ ⇒ D ≈ <strong>32 м</strong>. Соответствует РТ-32 Effelsberg-style.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс РТ-32 VLBI</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>Antenna Ø32 m Vertex Cassegrain panels = 18 млрд</li>
            <li>Mount + servo + encoder + brakes = 4 млрд</li>
            <li>Foundation 30×30×4 ж/б + isolation = 1.5 млрд</li>
            <li>Cryogenic LNA dewar HE + Cryomech + bands setup = 3.2 млрд</li>
            <li>H-maser iMaser 3000 + GPS UTC + Mark6 recorder = 2.5 млрд</li>
            <li>Control building + 500 м² lab + операторы = 1.8 млрд</li>
            <li>Fiber-optic link 50 км до Almaty + maintenance crane + RFI shielding = 4 млрд</li>
            <li>Подъезд + ЛЭП + projecting 5% + PNR + insurance = 7 млрд</li>
          </ul>
          <input type="text" value={ex3} onChange={(e) => setEx3(e.target.value)} placeholder="тг" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${ok.ex3 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p><strong>~42 млрд тг (~$90M USD)</strong>. Effelsberg 100 m = ~$300M (1972), Green Bank 100 m = $75M USD.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — RFI protection</h2>
          <div className="space-y-2">{[
            { v: "a", t: "Никакая защита не нужна" },
            { v: "b", t: "Только bandpass фильтр" },
            { v: "c", t: "Multi-layer RFI protection per ITU-R RA.769 + IAU: (1) Radio Quiet Zone RQZ 5-10 km radius around telescope, no mobile transmitters / WiFi / radar / power lines, (2) topographic terrain blocking — telescope в bowl-shape valley, (3) bandpass filters Pasternack mc2-LP frontend для reject out-of-band, (4) Faraday cage mu-metal для shielding на control building, (5) careful site selection — Bёtpak-Dala desert minimal interference, (6) cryogenic LNA bottom of dewar = no electronic emission from cabinets, (7) all power lines underground fiber data, (8) RFI monitoring 1 GHz spectrum analyser 24/7 + database flag bad observations, (9) coordination with local mobile operator для clear shift hours; ITU-R RA.769 + IAU + EVN Operational Procedures" },
            { v: "d", t: "Только мобильник выключить" },
          ].map((o) => (<label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex4, o.v, ok.ex4)}`}><input type="radio" name="ex4" value={o.v} checked={ex4 === o.v} onChange={() => setEx4(o.v)} className="mr-3" />{o.t}</label>))}</div>
        </section>
        <button onClick={() => setShowResults(true)} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-lg font-semibold">Проверить ответы</button>
        {showResults && <section className={`p-6 rounded-xl border-2 ${score === 4 ? "border-emerald-500 bg-emerald-500/10" : score >= 2 ? "border-amber-500 bg-amber-500/10" : "border-rose-500 bg-rose-500/10"}`}><h2 className="text-2xl font-bold">Результат: {score} / 4</h2></section>}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3"><h2 className="text-xl font-semibold text-cyan-300">Нормативная база</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>ITU-R RA.769 — Protection criteria для radio astronomy</li>
            <li>IAU + IVS Standards — International VLBI Service</li>
            <li>EVN European VLBI Network Operational</li>
            <li>SKA Square Kilometre Array Specifications</li>
            <li>ECSS-E-ST-50C — Communications</li>
            <li>IEC 60945 — Radio equipment</li>
            <li>СН РК 4.04-04 — Машиностроительные здания</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
