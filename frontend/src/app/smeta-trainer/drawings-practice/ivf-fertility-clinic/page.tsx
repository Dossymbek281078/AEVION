"use client";
import Link from "next/link";
import { useState } from "react";

export default function IvfFertilityClinicPage() {
  const [ex1, setEx1] = useState(""); const [ex2, setEx2] = useState(""); const [ex3, setEx3] = useState(""); const [ex4, setEx4] = useState(""); const [showResults, setShowResults] = useState(false);
  const e2 = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const e2OK = !isNaN(e2) && Math.abs(e2 - 1500) <= 150;
  const e3 = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const e3OK = !isNaN(e3) && Math.abs(e3 - 9_500_000_000) <= 950_000_000;
  const ok = { ex1: ex1 === "d", ex2: e2OK, ex3: e3OK, ex4: ex4 === "c" };
  const score = Object.values(ok).filter(Boolean).length;
  const oc = (s: string, v: string, isok: boolean) => !showResults || s !== v ? (s === v ? "border-blue-500 bg-blue-500/20" : "border-slate-700 hover:border-slate-500") : isok ? "border-emerald-500 bg-emerald-500/20" : "border-rose-500 bg-rose-500/20";
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10"><div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between"><Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300">← К разделам</Link><div className="text-xs text-slate-500">IVF Fertility Clinic</div></div></header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section><h1 className="text-3xl md:text-4xl font-bold">👶 IVF Fertility Clinic + ART лаборатории</h1>
          <p className="mt-3 text-slate-400 max-w-3xl">Модуль #310. ЭКО клиника Институт репродуктивной медицины (ИРМ Алматы), ESCRH-стандарт (European Society Human Reproduction & Embryology). IVF Lab — strict ISO 14644 class 7 cleanroom + IVF-grade air HEPA + activated carbon + UV для VOC removal (volatile organic compounds toxic to embryos), CO2 incubators 5% CO2 + 5% O2 + 90% N2 atmosphere + 37 °C ± 0.1, LN2 cryostorage embryos + sperm + oocytes, embryoscope time-lapse Cooperative Vitrolife EmbryoScope+. Capacity 1500 ART cycles/year. WHO 6th + ESHRE Guidelines + HFEA UK + СН РК 3.02-19.</p>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав IVF lab 1500 cycles/year</h2>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li>IVF lab cleanroom ISO 14644 class 7 (10 000 particles/m³ ≥0.5 мкм) — 300 m² с HEPA H14 + Vaisala continuous monitoring;</li>
            <li>IVF-grade air system — HEPA H14 + activated carbon Camfil ChemFlow + UV-185 nm для VOC destruction (embryos sensitive to {"<"}100 ppb VOC);</li>
            <li>IVF workstation MOMI / Bayer Esco MAC 2D — biosafety cabinet class II A2 + warm-stage 37 °C + microscope Zeiss AxioObserver Z1;</li>
            <li>CO2 incubators Cooperative G185 / EmbryoScope+ time-lapse 16 chambers с individual gas mix 5% CO2/5% O2/90% N2;</li>
            <li>LN2 storage Dewar Air Liquide LD-5K × 6 — 30 000 vials embryos + 10 000 vials sperm + 5 000 vials oocytes;</li>
            <li>Vitrification + thaw protocols Kitazato Cryotop, survival {">"}95%;</li>
            <li>Andrology lab — sperm analysis WHO 6th edition manual + CASA Computer Assisted Sperm Analysis Hamilton-Thorne CEROS II;</li>
            <li>OR oocyte retrieval room — transvaginal ultrasound-guided needle aspiration, ANESTH semi-conscious sedation, под 30-min procedure;</li>
            <li>Embryo transfer room — soft catheter Cook Sydney + abdominal US guidance + ICC International Council Standards;</li>
            <li>Genetic lab PGT-A — NGS Illumina MiSeq aneuploidy screening + PGT-M monogenic disease detection;</li>
            <li>ICSI workstation — Eppendorf TransferMan 4r micromanipulator + Olympus IX73 inverted scope;</li>
            <li>Hormone lab — Roche Cobas e801 estradiol + progesterone + AMH + FSH измерения;</li>
            <li>Pharmacy — gonadotropins Gonal-F Follitropin alpha + Cetrotide + Pregnyl + Crinone;</li>
            <li>Recovery room + counselling rooms + patient registration;</li>
            <li>Documentation electronic SART CORS-style registry + ESHRE EIM annual reports.</li>
          </ul>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — IVF lab air quality</h2>
          <div className="space-y-2">{[
            { v: "a", t: "Обычная вентиляция как офис" },
            { v: "b", t: "Класс 5 ISO как операционная" },
            { v: "c", t: "Sterile gas mix без особой фильтрации" },
            { v: "d", t: "ISO 14644 class 7 + IVF-grade air HEPA H14 + Camfil ChemFlow activated carbon + UV-185 + low-VOC discipline per ESHRE Guidelines + Cohen et al 1997: (1) embryos 1-100 ppb VOC threshold for development arrest, vs office air 100-5000 ppb (cleaning products, plastics outgassing); (2) HEPA H14 99.995% removes particulates, but VOC pass through — need activated carbon Camfil ChemFlow + KMnO4 for ozone-aldehyde-organic compounds; (3) UV-185 nm photocatalytic destroys remaining VOCs to CO2+H2O; (4) Vaisala VOC monitor continuous baseline 0-200 ppb TVOC, alarm at 100 ppb; (5) Materials selection — no plastic furniture (polyethylene, PVC outgassing), only stainless steel + glass + epoxy paint; (6) Cleaning protocol — special low-VOC cleaners Sporicidin или Decon-Quat (no isopropanol or chlorine), wiping down daily; (7) Operator clothing — Tyvek IsoClean (no street clothes inside); (8) Result — IVF success rate +5-15% improvement vs conventional lab. ESHRE Guidelines + HFEA + Cohen 1997 Hum Reprod 12:1742" },
          ].map((o) => (<label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex1, o.v, ok.ex1)}`}><input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />{o.t}</label>))}</div>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Cycles per year</h2>
          <p className="text-slate-300">Clinic capacity 4 cycles/day × 6 days × 50 weeks = ART cycles/year:</p>
          <input type="text" value={ex2} onChange={(e) => setEx2(e.target.value)} placeholder="cycles" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${ok.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p>4 × 6 × 50 = <strong>1200-1500 cycles/year</strong>, scale-up to 2000 with night shifts.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс IVF clinic</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>IVF lab cleanroom ISO 14644 cl.7 + HEPA + activated carbon + UV-185 = 1.8 млрд</li>
            <li>Time-lapse EmbryoScope+ × 4 + incubators G185 × 8 = 1.4 млрд</li>
            <li>LN2 Dewar Air Liquide × 6 + vitrification + cryostorage = 0.8 млрд</li>
            <li>ICSI Eppendorf TransferMan + Olympus IX73 + Zeiss AxioObserver = 1.2 млрд</li>
            <li>Andrology CASA Hamilton-Thorne + WHO manual lab = 0.4 млрд</li>
            <li>OR oocyte retrieval + embryo transfer rooms = 1 млрд</li>
            <li>PGT-A NGS Illumina MiSeq + Roche Cobas hormone lab = 1.3 млрд</li>
            <li>Recovery + counselling + pharmacy + building + проект 5% + PNR = 1.6 млрд</li>
          </ul>
          <input type="text" value={ex3} onChange={(e) => setEx3(e.target.value)} placeholder="тг" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${ok.ex3 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p><strong>~9.5 млрд тг (~$20M USD)</strong>. Окупаемость 5-7 лет при $5000-8000 per IVF cycle.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Vitrification protocol</h2>
          <div className="space-y-2">{[
            { v: "a", t: "Обычная заморозка в холодильнике −20 °C" },
            { v: "b", t: "Slow freezing −1 °C/min protocol" },
            { v: "c", t: "Vitrification ultra-rapid cooling -20 000 °C/min с Kitazato Cryotop per ESHRE + ASRM: (1) sucrose + ethylene glycol + DMSO permeating cryoprotectant solution dehydrates cells; (2) Cryotop open-pulled straw 0.1 μl volume direct LN2 immersion -196 °C; (3) cooling rate 20 000 °C/min suppresses ice crystal formation (vitreous glass state); (4) survival >95% vs slow-freezing 70-80%; (5) PGT-A NGS friendly — no biopsy damage in vitrified state; (6) Single Embryo Transfer SET protocol — vitrify all blastocysts, transfer one fresh, store others for FET Frozen Embryo Transfer (lower multiple pregnancy risk); (7) Day-5 blastocyst preferred over Day-3 cleavage; (8) HFEA limits 10-year storage embryos + 55-year UK gametes. Kitazato Cryotop Manual + ESHRE Cryopreservation Guidelines + ASRM" },
            { v: "d", t: "Только сегодня использовать яйцеклетки" },
          ].map((o) => (<label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex4, o.v, ok.ex4)}`}><input type="radio" name="ex4" value={o.v} checked={ex4 === o.v} onChange={() => setEx4(o.v)} className="mr-3" />{o.t}</label>))}</div>
        </section>
        <button onClick={() => setShowResults(true)} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-lg font-semibold">Проверить ответы</button>
        {showResults && <section className={`p-6 rounded-xl border-2 ${score === 4 ? "border-emerald-500 bg-emerald-500/10" : score >= 2 ? "border-amber-500 bg-amber-500/10" : "border-rose-500 bg-rose-500/10"}`}><h2 className="text-2xl font-bold">Результат: {score} / 4</h2></section>}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3"><h2 className="text-xl font-semibold text-cyan-300">Нормативная база</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>ESHRE Guidelines for IVF / ART</li>
            <li>WHO Sperm Manual 6th edition 2021</li>
            <li>ASRM American Society Reproductive Medicine</li>
            <li>HFEA UK Human Fertilisation Embryology Authority</li>
            <li>ISO 14644-1 Cleanroom</li>
            <li>ISO 15189 — Medical Laboratory Quality</li>
            <li>СН РК 3.02-19 — Лечебно-проф. учреждения</li>
            <li>Закон РК Об охране здоровья</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
