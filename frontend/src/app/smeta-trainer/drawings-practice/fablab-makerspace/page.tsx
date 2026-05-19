"use client";
import Link from "next/link";
import { useState } from "react";

export default function FablabMakerspacePage() {
  const [ex1, setEx1] = useState(""); const [ex2, setEx2] = useState(""); const [ex3, setEx3] = useState(""); const [ex4, setEx4] = useState(""); const [showResults, setShowResults] = useState(false);
  const e2 = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const e2OK = !isNaN(e2) && Math.abs(e2 - 800) <= 80;
  const e3 = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const e3OK = !isNaN(e3) && Math.abs(e3 - 1_800_000_000) <= 180_000_000;
  const ok = { ex1: ex1 === "d", ex2: e2OK, ex3: e3OK, ex4: ex4 === "c" };
  const score = Object.values(ok).filter(Boolean).length;
  const oc = (s: string, v: string, isok: boolean) => !showResults || s !== v ? (s === v ? "border-blue-500 bg-blue-500/20" : "border-slate-700 hover:border-slate-500") : isok ? "border-emerald-500 bg-emerald-500/20" : "border-rose-500 bg-rose-500/20";
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10"><div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between"><Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300">← К разделам</Link><div className="text-xs text-slate-500">FabLab Makerspace</div></div></header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section><h1 className="text-3xl md:text-4xl font-bold">🛠️ FabLab Makerspace MIT-Style</h1>
          <p className="mt-3 text-slate-400 max-w-3xl">Модуль #318. FabLab Astana Hub + Алматинский Politech FabLab — открытые мастерские для prototyping студентов + стартапов. Reference: MIT Center for Bits & Atoms (originator 2001), FabLab Network 2500+ globally. Equipment: laser cutter Trotec Speedy 400 + CNC mill Tormach PCNC + 3D printer Ultimaker S5 + Bambu X1C + microscope + electronics bench + PCB fabrication. Mission — democratize digital fabrication. Open-source culture, peer learning, university+industry partnerships. ISO 17025 + Fab Foundation Standards + СН РК 3.02-12.</p>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав FabLab 800 m²</h2>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li>Laser cutter Trotec Speedy 400 1200×750 mm 120 W CO2 (cuts wood/acrylic/leather до 20 mm) + exhaust scrubber для VOC;</li>
            <li>CNC mill Tormach PCNC 1100 vertical machining + automatic tool changer 10-position, для aluminum/steel;</li>
            <li>3D printers — Ultimaker S5 dual-extruder × 4 + Bambu Lab X1C high-speed × 4 + Formlabs Form 3+ SLA resin × 2;</li>
            <li>Industrial 3D printer Stratasys F370 dual-material PolyJet для professional prototyping;</li>
            <li>Vinyl cutter Roland GR-540 60-cm width + heat press T-shirt printing;</li>
            <li>PCB fabrication LPKF ProtoMat S104 + Mantis vision system + reflow oven OK Manncorp MC301-SQ;</li>
            <li>Electronics bench — soldering station Hakko FX-888D × 10 + Rigol DSO oscilloscope × 5 + Keysight DMM × 10 + Mantis stereo microscope;</li>
            <li>Hand tools — workbench × 30 + drill + grinder + scroll saw + table saw + planer + thicknesser SafetyCage;</li>
            <li>Sewing + textiles — Bernina industrial sewing × 5 + Brother PR-680W embroidery machine + fabric storage;</li>
            <li>Material storage — wood + acrylic + metal stock + electronic components + filament rolls (250+ SKUs);</li>
            <li>Computer lab — 20 workstations Dell + AutoCAD + Fusion 360 + KiCad + Inkscape + Blender open-source-licensed;</li>
            <li>Meeting room + classroom 30 seats + projector для workshops + invited speakers;</li>
            <li>Photo studio — backdrop lighting + DSLR equipment для product photography;</li>
            <li>Safety — ventilation + fume extraction Donaldson + first aid + fire ESFR sprinkler + safety briefing mandatory;</li>
            <li>Membership management — RFID + 24/7 access + Mindbody scheduling.</li>
          </ul>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — FabLab vs traditional workshop</h2>
          <div className="space-y-2">{[
            { v: "a", t: "Только для hobby — не серьёзная фабрика" },
            { v: "b", t: "Только для образования школы" },
            { v: "c", t: "Только для университета" },
            { v: "d", t: "FabLab Makerspace — democratised digital fabrication per MIT CBA + Fab Foundation: (1) open-access membership $50-200/month vs traditional contract $10K+ за prototype; (2) digital fabrication 3D printing/CNC/laser-cutting позволяет complex geometry от CAD-file прямо к object; (3) iteration speed — design morning, prototype afternoon, test evening (vs traditional manufacturing 4-12 weeks lead time); (4) Open Knowledge — design files shared via GitHub Hardware + Thingiverse, leverage global community improvements; (5) STEAM education K-12 + university students learn real engineering skills hands-on; (6) Entrepreneurship — startup acceleration: Pebble Watch, Square POS, GoPro все started в makerspaces; (7) Community building — meetup events + maker faires + hackathons monthly; (8) Industry adoption — Tesla, SpaceX, GM all have internal FabLabs для rapid prototyping; (9) Sustainability — local production reduces logistics + waste vs mass manufacturing imports; (10) Future trend — distributed manufacturing networks Fab City — neighborhoods produce 50% goods locally by 2054. MIT CBA + Fab Foundation Standards + ISO 17025 + IEEE Maker Education + UNESCO Maker Education" },
          ].map((o) => (<label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex1, o.v, ok.ex1)}`}><input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />{o.t}</label>))}</div>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Space (m²)</h2>
          <input type="text" value={ex2} onChange={(e) => setEx2(e.target.value)} placeholder="м²" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${ok.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p>Typical FabLab MIT CBA-style <strong>800 м²</strong> for full equipment + members. Large 1500-2500 м², small starter 200-400 м².</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс FabLab 800 м²</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>Laser Trotec Speedy 400 + exhaust = 0.15 млрд</li>
            <li>CNC Tormach PCNC + tooling + workholding = 0.12 млрд</li>
            <li>3D printers Ultimaker × 4 + Bambu × 4 + Formlabs × 2 + Stratasys F370 = 0.18 млрд</li>
            <li>PCB LPKF ProtoMat + reflow oven OK + electronics benches = 0.12 млрд</li>
            <li>Hand tools workshop + woodshop + sewing + photo studio = 0.18 млрд</li>
            <li>Computer lab Dell × 20 + AutoCAD + Fusion 360 + Adobe = 0.12 млрд</li>
            <li>Building 800 м² fitting-out + HVAC + проект 5% + insurance = 0.93 млрд</li>
          </ul>
          <input type="text" value={ex3} onChange={(e) => setEx3(e.target.value)} placeholder="тг" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${ok.ex3 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p><strong>~1.8 млрд тг (~$4M USD)</strong>. Sustainable через membership fees + grants + workshop revenue.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Safety policies</h2>
          <div className="space-y-2">{[
            { v: "a", t: "Только знаки опасно" },
            { v: "b", t: "Только годовой инструктаж" },
            { v: "c", t: "Multi-layer safety per OSHA + Fab Foundation Best Practices: (1) mandatory safety briefing 8-hr before first independent access + tool-specific certification (laser-cutter, CNC-mill separate); (2) buddy system — never alone with high-risk equipment (CNC mill, table saw, laser); (3) PPE policy — safety glasses + closed-toe shoes + long pants mandatory; specific PPE for sewing + welding + 3D printer; (4) tool sign-out + booking system — RFID tracks who used what when; (5) workstation cleanup mandatory after each session, fines for non-compliance; (6) emergency stops on every powered equipment + first aid kit + AED defibrillator + fire extinguishers А-B-C; (7) fume extraction Donaldson local exhaust on laser-cutter + welding + 3D printing (some filaments toxic — ABS, PA, нейлон); (8) annual safety drill + monthly equipment inspection log; (9) liability insurance + member waiver; (10) age restrictions — adult supervision under 16, family memberships available. OSHA 29 CFR 1910 + Fab Foundation Safety Manual + NFPA 1 + СН РК 3.02-12" },
            { v: "d", t: "Только взрослые" },
          ].map((o) => (<label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex4, o.v, ok.ex4)}`}><input type="radio" name="ex4" value={o.v} checked={ex4 === o.v} onChange={() => setEx4(o.v)} className="mr-3" />{o.t}</label>))}</div>
        </section>
        <button onClick={() => setShowResults(true)} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-lg font-semibold">Проверить ответы</button>
        {showResults && <section className={`p-6 rounded-xl border-2 ${score === 4 ? "border-emerald-500 bg-emerald-500/10" : score >= 2 ? "border-amber-500 bg-amber-500/10" : "border-rose-500 bg-rose-500/10"}`}><h2 className="text-2xl font-bold">Результат: {score} / 4</h2></section>}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3"><h2 className="text-xl font-semibold text-cyan-300">Нормативная база</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>MIT CBA Center for Bits and Atoms</li>
            <li>Fab Foundation Standards 2024</li>
            <li>ISO 17025 — Testing Laboratory</li>
            <li>OSHA 29 CFR 1910 — General Industry</li>
            <li>NFPA 1 — Fire Code</li>
            <li>IEEE Maker Education Standards</li>
            <li>UNESCO Maker Education</li>
            <li>СН РК 3.02-12 — Учебные заведения</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
