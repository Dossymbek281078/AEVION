"use client";
import Link from "next/link";
import { useState } from "react";

export default function ThermalSpaBalneologyPage() {
  const [ex1, setEx1] = useState(""); const [ex2, setEx2] = useState(""); const [ex3, setEx3] = useState(""); const [ex4, setEx4] = useState(""); const [showResults, setShowResults] = useState(false);
  const e2 = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const e2OK = !isNaN(e2) && Math.abs(e2 - 42) <= 4;
  const e3 = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const e3OK = !isNaN(e3) && Math.abs(e3 - 8_500_000_000) <= 850_000_000;
  const ok = { ex1: ex1 === "d", ex2: e2OK, ex3: e3OK, ex4: ex4 === "c" };
  const score = Object.values(ok).filter(Boolean).length;
  const oc = (s: string, v: string, isok: boolean) => !showResults || s !== v ? (s === v ? "border-blue-500 bg-blue-500/20" : "border-slate-700 hover:border-slate-500") : isok ? "border-emerald-500 bg-emerald-500/20" : "border-rose-500 bg-rose-500/20";
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10"><div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between"><Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300">← К разделам</Link><div className="text-xs text-slate-500">Thermal Spa Balneology</div></div></header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section><h1 className="text-3xl md:text-4xl font-bold">♨️ Thermal Spa + Бальнеология</h1>
          <p className="mt-3 text-slate-400 max-w-3xl">Модуль #317. Сауранский Cарыагаш (юг РК) минерально-термальный источник, Капал-Арасан, Алмаарасан Алматинская обл — медицинские термальные курорты лечение oporno-двигательного, кардиоваскулярного, gastrointestinal disease. Reference: Karlovy Vary Czech, Baden-Baden Germany, Beppu Japan, Iceland Blue Lagoon. Geothermal water 38-42 °C с mineral content (S, Mg, Ca, Br, I, radon). Закрытый thermal circuit + open-air pool + flotation chamber + mud therapy + sauna complex. Bath Standards ISO 24813 + Balneology ISMH + СН РК 3.02-08.</p>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав thermal spa 1000 visitors/day</h2>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li>Geothermal well — drilled 500-2000 m H для access thermal aquifer, casing steel + grouted annulus, flow rate 50-200 L/sec at 38-50 °C source water;</li>
            <li>Heat exchanger + distribution — primary thermal water vs secondary potable circuit для pool filling, prevents corrosion mineral scaling;</li>
            <li>Treatment — sand filter Bayer F-30 + activated carbon + chlorine alternative ozone Wedeco OZW 200 g/hr для pool water disinfection;</li>
            <li>Indoor pools — 4 thermal pools 50-200 m² @ T 38-42 °C, depth 1.0-1.5 m, accessible ramps для disabled;</li>
            <li>Outdoor pool — 500 m² infinity pool с panoramic view, T 36-39 °C year-round (snow falling but warm bathing iconic);</li>
            <li>Flotation chamber Float Lab 25% magnesium sulfate brine 1.25 SG, sensory deprivation room dim light + earplugs;</li>
            <li>Mud therapy — peat / silt mud baths heated 38-42 °C, bring local mineralogenic muds от nearby lake (similar to Dead Sea);</li>
            <li>Sauna complex — Finnish dry sauna 80-95 °C + Russian banya 60-70 °C + steam room 45-50 °C / 100% RH + Turkish hammam;</li>
            <li>Cold plunge contrast — 8-12 °C dip pool после sauna для cardiovascular thermal cycling;</li>
            <li>Massage rooms 10-20 private + open-plan для groups, hot stone + Thai + Swedish + reflexology;</li>
            <li>Medical wing — doctor consultation + ECG + spirometry + lab QA + Hippocratic baseline check before treatments;</li>
            <li>Restaurant ayurvedic + nutritionist-designed menu (low sodium, anti-inflammatory);</li>
            <li>Accommodation 100-200 rooms 4-5★ hotel attached;</li>
            <li>Spa management software Mindbody + scheduling + member loyalty;</li>
            <li>HVAC humidification special — pools moisture load 50-100 kg/hr → industrial dehumidifier + heat recovery от exhaust air.</li>
          </ul>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Thermal water treatment</h2>
          <div className="space-y-2">{[
            { v: "a", t: "Никакой обработки — natural" },
            { v: "b", t: "Только chlorination" },
            { v: "c", t: "Только sand filter" },
            { v: "d", t: "Multi-stage treatment для balance preserving therapeutic mineral content + safety per WHO + ISMH + ISO 24813: (1) primary heat exchanger separates raw thermal water (sometimes radon-bearing) from potable circuit; (2) sand filter Bayer F-30 для particulates >5 μm; (3) activated carbon GAC для organic + chlorinated VOC removal; (4) ozone Wedeco OZW preferred over chlorine — preserves natural sulfur/mineral content, avoids THM trihalomethane byproducts; (5) UV-185 nm UVOXIDATION для TOC + biological control; (6) pH neutralisation 7.4 ± 0.2 + alkalinity 80-120 mg/L CaCO3; (7) bromide tracer testing — pool water 4-6 hr turnover time для contaminant dilution; (8) Legionella prevention — Legionella SOP semi-annual + thermal shock 70 °C × 30 min + sampling per WHO; (9) cryptosporidium UV-treatment + microfiltration 0.5 μm absolute; (10) radon decay chamber if radon-content >100 Bq/L — natural decay 3.8-day half-life в storage tank. WHO Pool Standards + ISMH International Society Medical Hydrology + ISO 24813 + DIN 19643 (German bath water)" },
          ].map((o) => (<label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex1, o.v, ok.ex1)}`}><input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />{o.t}</label>))}</div>
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Pool temperature</h2>
          <input type="text" value={ex2} onChange={(e) => setEx2(e.target.value)} placeholder="°C" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${ok.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p><strong>38-42 °C</strong> therapeutic, no fever risk (avg <strong>42 °C</strong>). Above 44 °C dangerous prolonged immersion (heat stroke).</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс thermal spa</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>Geothermal well 1500 m drill + casing + pump = 0.8 млрд</li>
            <li>Pool complex 4 indoor + 1 outdoor + heat exchanger + treatment = 2 млрд</li>
            <li>Sauna complex Finnish + Russian + Turkish + steam + cold plunge = 1.2 млрд</li>
            <li>Float lab + mud therapy + massage rooms = 0.8 млрд</li>
            <li>Medical wing + lab + doctor consult + ECG = 0.4 млрд</li>
            <li>Restaurant + accommodation 100 rooms 4★ = 2.5 млрд</li>
            <li>HVAC dehumidification + heat recovery + проект 5% + insurance = 0.8 млрд</li>
          </ul>
          <input type="text" value={ex3} onChange={(e) => setEx3(e.target.value)} placeholder="тг" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg" />
          {showResults && <div className={`p-4 rounded-lg ${ok.ex3 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}><p><strong>~8.5 млрд тг (~$18M USD)</strong>. Karlovy Vary historical sites $50M+, modern German Therme $80-150M scale.</p></div>}
        </section>
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4"><h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Legionella prevention</h2>
          <div className="space-y-2">{[
            { v: "a", t: "Никаких мер — горячая вода стерилизует" },
            { v: "b", t: "Только хлорка" },
            { v: "c", t: "Comprehensive Legionella control per WHO + UK HSG274 + ASHRAE 188: (1) hot water storage T ≥60 °C minimum (Legionella killed within 1 min at 60 °C), distribution T ≥55 °C; (2) cold water storage T <20 °C; (3) all dead-legs eliminated <2x pipe diameter; (4) shower heads + tap aerators clean monthly + replace 6 months (biofilm accumulation hotspot); (5) thermal shock — entire hot water system 70 °C × 30 min once monthly для disinfection; (6) chemical disinfection alternative — monochloramine 1-2 mg/L continuous OR chlorine dioxide 0.5 mg/L; (7) sampling quarterly — Legionella culture + PCR per ISO 11731, action level 1000 CFU/L, alert 100; (8) cooling tower drift eliminator + biocide rotation; (9) high-risk groups isolation — elderly + immunocompromised separate pools maintained higher disinfection; (10) staff training annual + outbreak response plan + immediate reporting Health Department per Закон РК Об охране здоровья. WHO Pool Standards + UK HSG274 + ASHRAE 188 + ISO 11731 + DIN 19643" },
            { v: "d", t: "Только годовая проверка" },
          ].map((o) => (<label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${oc(ex4, o.v, ok.ex4)}`}><input type="radio" name="ex4" value={o.v} checked={ex4 === o.v} onChange={() => setEx4(o.v)} className="mr-3" />{o.t}</label>))}</div>
        </section>
        <button onClick={() => setShowResults(true)} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-lg font-semibold">Проверить ответы</button>
        {showResults && <section className={`p-6 rounded-xl border-2 ${score === 4 ? "border-emerald-500 bg-emerald-500/10" : score >= 2 ? "border-amber-500 bg-amber-500/10" : "border-rose-500 bg-rose-500/10"}`}><h2 className="text-2xl font-bold">Результат: {score} / 4</h2></section>}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3"><h2 className="text-xl font-semibold text-cyan-300">Нормативная база</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>WHO Pool + Spa Water Quality Standards</li>
            <li>ISMH International Society Medical Hydrology</li>
            <li>ISO 24813 — Thermal spa water</li>
            <li>DIN 19643 — Bath Water Treatment Germany</li>
            <li>UK HSG274 — Legionnaires Disease Control</li>
            <li>ASHRAE 188 — Legionellosis Management</li>
            <li>ISO 11731 — Legionella enumeration</li>
            <li>СН РК 3.02-08 — Гостиницы и курорты</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
