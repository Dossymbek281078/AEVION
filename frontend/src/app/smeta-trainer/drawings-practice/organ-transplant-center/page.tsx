"use client";
import Link from "next/link";
import { useState } from "react";

export default function OrganTransplantCenterPage() {
  const [ex1, setEx1] = useState(""); const [ex2, setEx2] = useState(""); const [ex3, setEx3] = useState(""); const [ex4, setEx4] = useState(""); const [showResults, setShowResults] = useState(false);
  const e2 = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const e2OK = !isNaN(e2) && Math.abs(e2 - 24) <= 3;
  const e3 = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const e3OK = !isNaN(e3) && Math.abs(e3 - 28_000_000_000) <= 2_800_000_000;
  const ok = { ex1: ex1 === "d", ex2: e2OK, ex3: e3OK, ex4: ex4 === "c" };
  const score = Object.values(ok).filter(Boolean).length;
  const oc = (s: string, v: string, isok: boolean) => !showResults || s !== v ? (s === v ? "border-blue-500 bg-blue-500/20" : "border-slate-700 hover:border-slate-500") : isok ? "border-emerald-500 bg-emerald-500/20" : "border-rose-500 bg-rose-500/20";
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10"><div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between"><Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300">← К разделам</Link><div className="text-xs text-slate-500">Organ Transplant Center</div></div></header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section><h1 className="text-3xl md:text-4xl font-bold">🫀 Центр трансплантации органов</h1>
          <p className="mt-3 text-slate-400 max-w-3xl">Модуль #309. Республиканский Координационный Центр Трансплантации РК (РККТ Астана) — kidney + heart + liver + lung + pancreas трансплантации (15-20 transplants/год). Reference: Mayo Clinic Rochester, Cleveland Clinic, Yonsei Univ Hospital Seoul (Asian leader). Includes донорские OR + reception ICU + recipient OR + post-op ICU + immunosuppression unit + tissue match lab (HLA typing) + organ preservation labs. Specialised — kidney machine perfusion XVIVO LifePort, liver normothermic machine perfusion OrganOx, heart-lung warm preservation. WHO + ISHLT + ABTO Asociation + СН РК 3.02-19.</p>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав transplant center 24 koek</h2>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li>Operating Theatres OR 8-12 modular Belimed HM12000 ISO 14644 class 5 (HEPA H14 99.995% + 25 air changes), включая 4 dedicated transplant ORs;</li>
            <li>Donor OR + recipient OR в parallel pairs для simultaneous kidney pairs (paired exchange);</li>
            <li>ICU recipient post-op 24 beds isolated single-rooms + positive pressure +25 Pa + HEPA;</li>
            <li>Tissue typing lab HLA — Luminex xMAP One Lambda + PCR-SSP Olerup (HLA-A,-B,-C,-DR class I+II);</li>
            <li>Cross-match lab — Flow Cytometry FACSCanto + CDC Complement Dependent Cytotoxicity;</li>
            <li>Organ preservation OR — XVIVO LifePort kidney machine perfusion 4-12 hr cold preservation extension;</li>
            <li>Liver pump OrganOx metra normothermic + heart-lung TransMedics OCS Heart;</li>
            <li>Immunosuppression pharmacy — IV Tacrolimus + MMF + steroids + biologics IL-2R blockers ATG-Fresenius;</li>
            <li>Helicopter landing pad на крыше для urgent organ delivery (4-hr cold ischemia heart, 8-hr kidney);</li>
            <li>Bone marrow + tissue bank — −80 °C cryostorage + LN2 −196 °C для stem cells;</li>
            <li>Outpatient clinic + dialysis 20 chairs для kidney pre-transplant patients;</li>
            <li>24/7 transplant coordinator team + matching algorithm UNOS-style;</li>
            <li>Genetic lab — NGS Illumina MiSeq для donor/recipient genome match;</li>
            <li>Quality lab — ISO 15189 accreditation + HFEA-equivalent oversight;</li>
            <li>Documentation + traceability — chip embedded in organ + блокчейн-trace donor-to-recipient.</li>
          </ul>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Organ preservation</h2>
          <div className="space-y-2">{[
            { v: "a", t: "Только ice cooler box -4 °C" },
            { v: "b", t: "Static cold storage 4-8 hours max" },
            { v: "c", t: "Просто бытовой холодильник" },
            { v: "d", t: "Machine perfusion preservation extends ischemic time + improves outcomes: (1) Kidney — XVIVO LifePort hypothermic 4 °C continuous oxygenated UW solution perfusion 6-24 hr (vs static cold 4-8 hr); reduces DGF Delayed Graft Function 30%; (2) Liver — OrganOx metra normothermic 37 °C oxygenated blood perfusion 12-24 hr; allows extended donation criteria DCD donors; (3) Heart — TransMedics OCS Heart warm 35 °C ex-vivo perfusion 8-12 hr; reanimate brain-dead donors; (4) Lung — XPS Lung перевозят 24 hr at 4 °C; (5) Cold ischemia time impact на graft survival — kidney <24 hr good vs >36 hr 30% DGF; heart <4 hr; (6) Trend — move away from static cold storage к machine perfusion для marginal donors. ISHLT + UNOS Standards + EATB Tissue Banking" },
          ].map((o) => (<label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex1, o.v, ok.ex1)}`}><input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />{o.t}</label>))}</div>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Annual transplants</h2>
          <p className="text-slate-300">15 kidney + 5 liver + 3 heart + 1 lung = capacity transplants/year:</p>
          <input type="text" value={ex2} onChange={(e) => setEx2(e.target.value)} placeholder="штук" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${ok.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p>15+5+3+1 = <strong>24 transplants/year</strong>. РКТЦ Астана план ramp 50+ к 2030 через donor awareness campaign.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс transplant center</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>OR 8 modular Belimed HM12000 ISO 14644 cl.5 = 6 млрд</li>
            <li>ICU 24 beds isolated + positive pressure + HEPA = 4.5 млрд</li>
            <li>HLA typing Luminex + Flow + PCR-SSP = 1.8 млрд</li>
            <li>Organ preservation XVIVO LifePort + OrganOx + TransMedics OCS = 3.5 млрд</li>
            <li>Cryo storage LN2 + tissue bank = 1 млрд</li>
            <li>Helicopter pad + emergency entrance + transport unit = 1.2 млрд</li>
            <li>Pharmacy + outpatient + dialysis 20 chairs + genetic lab = 3.5 млрд</li>
            <li>Building 8000 м² + MEP + fire ESFR + ESIA + проект 5% + insurance = 6.5 млрд</li>
          </ul>
          <input type="text" value={ex3} onChange={(e) => setEx3(e.target.value)} placeholder="тг" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${ok.ex3 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p><strong>~28 млрд тг (~$60M USD)</strong>. Cleveland Clinic transplant centre ~$300M scale.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Tissue matching</h2>
          <div className="space-y-2">{[
            { v: "a", t: "Только blood type ABO" },
            { v: "b", t: "Только Rh-factor" },
            { v: "c", t: "Multi-step compatibility per UNOS Histocompatibility Standards: (1) ABO blood type compatibility (mandatory); (2) HLA Human Leukocyte Antigen typing class I (HLA-A, -B, -C) + class II (HLA-DR, -DQ, -DP) via Luminex xMAP one Lambda SSO + PCR-SSP Olerup; (3) Cross-match Complement Dependent Cytotoxicity CDC + Flow Cytometry FACSCanto для detect preformed donor-specific antibodies; (4) Virtual cross-match для urgent cases; (5) PRA Panel Reactive Antibody screening recipient sera against panel donor HLAs (high PRA recipients more difficult to match); (6) Better mismatch tolerance with newer immunosuppression Tacrolimus + MMF + Belatacept ICOS-blocker; (7) Paired exchange algorithm — incompatible pairs swap kidneys через national registry UNOS-style; (8) ISHLT + WHO + ABTO standards. SOT outcomes — 90% 1-year kidney graft survival, 95% pancreas, 85% heart" },
            { v: "d", t: "Только возраст донора" },
          ].map((o) => (<label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex4, o.v, ok.ex4)}`}><input type="radio" name="ex4" value={o.v} checked={ex4 === o.v} onChange={() => setEx4(o.v)} className="mr-3" />{o.t}</label>))}</div>
        </section>
        <button onClick={() => setShowResults(true)} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-lg font-semibold">Проверить ответы</button>
        {showResults && <section className={`p-6 rounded-xl border-2 ${score === 4 ? "border-emerald-500 bg-emerald-500/10" : score >= 2 ? "border-amber-500 bg-amber-500/10" : "border-rose-500 bg-rose-500/10"}`}><h2 className="text-2xl font-bold">Результат: {score} / 4</h2></section>}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3"><h2 className="text-xl font-semibold text-cyan-300">Нормативная база</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>WHO Guidelines Transplantation 2010</li>
            <li>ISHLT International Society Heart Lung Transplant</li>
            <li>UNOS United Network for Organ Sharing Standards</li>
            <li>ABTO Asociación Brasileira de Transplante Órgãos</li>
            <li>ISO 15189 — Medical Laboratory Quality</li>
            <li>EATB European Association Tissue Banks</li>
            <li>СН РК 3.02-19 — Лечебно-профилактические учреждения</li>
            <li>Закон РК Об охране здоровья</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
