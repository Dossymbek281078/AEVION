"use client";
import Link from "next/link";
import { useState } from "react";

export default function UltraPureWaterUfRoPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);
  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 350_000) <= 35_000;
  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 8_500_000_000) <= 850_000_000;
  const correct = { ex1: ex1 === "d", ex2: ex2Correct, ex3: ex3Correct, ex4: ex4 === "c" };
  const score = Object.values(correct).filter(Boolean).length;
  const optClass = (state: string, value: string, ok: boolean) => {
    if (!showResults || state !== value) return state === value ? "border-blue-500 bg-blue-500/20" : "border-slate-700 hover:border-slate-500";
    return ok ? "border-emerald-500 bg-emerald-500/20" : "border-rose-500 bg-rose-500/20";
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300 hover:text-blue-200 transition">← К разделам</Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · UPW Ultra Pure Water</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">💎 Ultra Pure Water (UPW) — UF + RO + EDI + MB</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #296. UPW (Ultra Pure Water) — для semiconductor production
            (resistivity 18.2 МΩ·см, total organic carbon TOC &lt;1 ppb,
            particles &lt;0.1 мкм). Применение в РК: фарм. заводы Химфарм Шымкент
            (USP Purified Water + WFI Water for Injection), Алматинский
            микроэлектроник (план Astana microchip), биотех CDMO. Технологии —
            UF Ultrafiltration (0.01-0.1 мкм removal bacteria + colloids) +
            RO Reverse Osmosis (0.0001 мкм removal salts + organics 99.5%) +
            EDI Electrodeionization (continuous deionization без regeneration
            ion-exchange resins) + final polishing MB Mixed Bed + UF terminal
            + UV-254 для residual organics. ASTM D5127 + USP &lt;1231&gt; +
            ISPE Baseline Pharma Water + ITRS Semiconductor + СН РК 4.04-09.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав UPW plant 50 м³/час (для фарм. завода)</h2>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Pre-treatment (городская вода):</strong> multimedia filter (sand + anthracite) для удаления particles {">"}50 мкм + activated carbon GAC (Granular Activated Carbon) для chlorine removal (хлор kills RO membranes);</li>
            <li><strong>Softener (опц., при hard water):</strong> Na-ion exchange resin Lewatit для Ca/Mg → Na replacement, при hard water {">"}10 dH ⇒ scaling RO membrane prevention;</li>
            <li><strong>UF Ultrafiltration:</strong> capillary hollow fiber membrane Suez Inge Aquasource 0.02 мкм pore size, polyethersulfone PES, removal bacteria 6-log + viruses 4-log + colloids; outside-in flow + backwash + CIP;</li>
            <li><strong>1st pass RO (Reverse Osmosis):</strong> Dow Filmtec BW30-440FR thin-film polyamide membranes, 16 pressure vessels × 6 elements per stage, recovery 70-75%, salt rejection 99.5%, output 30-50 мкСм/см conductivity;</li>
            <li><strong>2nd pass RO:</strong> повторный RO для final salt removal до conductivity 0.5-2 мкСм/см (resistivity 0.5-2 МΩ·см); recovery 85% (от 1st pass permeate, не raw);</li>
            <li><strong>EDI (Electrodeionization):</strong> Suez E-Cell MK-3 или Evoqua Ionpure IP-LX, parallel plate cells с anion + cation exchange resin + DC electric field, output resistivity 17-18 МΩ·см без resin regeneration (electricity-driven);</li>
            <li><strong>UV-185 nm + UV-254 nm:</strong> для TOC destruction Trojan UVOXIDATION, output TOC &lt;1 ppb; double UV doses 100-300 mJ/cm² (vs disinfection 30 mJ/cm²);</li>
            <li><strong>MB Mixed Bed polish (опц. для semiconductor):</strong> mixed cation + anion ion-exchange resins в одной vessel, final polish до 18.2 МΩ·см resistivity (theoretical max);</li>
            <li><strong>UF terminal (final filtration):</strong> 0.04 мкм PVDF membrane Pall Microza для removing any leached particles от resin/EDI, point-of-use filter перед distribution loop;</li>
            <li><strong>UPW storage tank:</strong> N2-blanket SS 316L electropolished 1-5 м³ (no plastic, no rubber gaskets!), conical bottom для drainage, vent через 0.2 мкм HEPA filter;</li>
            <li><strong>Distribution loop:</strong> sanitary stainless 316L electropolished pipe Ø50-100 мм с 1.5 м/с min velocity (для prevent biofilm), все weld orbital автомат-сварка, slope 1% для full drainage;</li>
            <li><strong>Sanitization:</strong> hot water 80 °C × 1 час weekly (для kill bacteria в loop), или ozone Wedeco при 0.05-0.5 mg/L continuous (для semiconductor), CIP NaOH 1% monthly;</li>
            <li><strong>Online monitoring:</strong> resistivity Mettler Toledo M300 ±0.1%, TOC analyser Sievers M9 ±2 ppb, particle counter Pall HRM с laser 0.1-25 мкм, real-time SCADA Wonderware/AVEVA;</li>
            <li><strong>QC laboratory:</strong> ICP-MS Agilent 7900 для metals (Al/Fe/Cu/Na 0.1-1 ppb each), IC Dionex для anions (SO4/Cl/NO3 ng/L), TOC offline Shimadzu TOC-L;</li>
            <li><strong>Documentation + validation:</strong> IQ Installation Qualification + OQ Operational Q + PQ Performance Q + annual revalidation per ISPE Baseline Guide; full data integrity 21 CFR Part 11.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Sequence фарм UPW</h2>
          <p className="text-slate-300">
            Химфарм Шымкент строит UPW plant для USP Purified Water +
            WFI distillation. Какая sequence по USP &lt;1231&gt; + ISPE?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только обычный водопровод, после ozone-обработки" },
              { v: "b", t: "Только distillation МПВ без RO" },
              { v: "c", t: "Только electrolysis" },
              { v: "d", t: "Полная sequence Pre-treatment → 2-pass RO → EDI → UV-TOC → MB → UF terminal → distribution loop sanitized + WFI distillation column по USP &lt;1231&gt; + ISPE Baseline Pharma Water + EP 0008: 1) Source — городская drinking water (conductivity 200-500 мкСм/см, TOC 1-5 ppm); 2) Pre-treatment — softener Na-IX (if hardness >5 dH) + carbon filter Calgon GAC (для chlorine free <0.1 ppm — RO membrane killed by chlorine); 3) UF Ultrafiltration — Suez Aquasource 0.02 мкм PES capillary, bacteria 6-log removal, output turbidity <0.05 NTU; 4) 1st pass RO Dow Filmtec BW30-440FR, 75% recovery, 99.5% salt rejection ⇒ conductivity 5-15 мкСм/см; 5) 2nd pass RO ⇒ conductivity 0.5-2 мкСм/см (соответствует USP Purified Water specs); 6) EDI Suez E-Cell continuous electrodeionization ⇒ resistivity 16-18 МΩ·см без regeneration (vs traditional mixed-bed exhausted каждые 6 мес); 7) UV-254 nm 30-40 mJ/cm² для disinfection; UV-185 nm Trojan UVOXIDATION для TOC destruction до <50 ppb; 8) MB Mixed Bed polish — для USP Purified Water не обязательно (EDI достаточно), но для semiconductor UPW нужно для 18.2 МΩ·см final; 9) UF terminal Pall Microza 0.04 мкм PVDF point-of-use filtration перед distribution; 10) WFI Water for Injection — additional distillation column Stilmas multi-effect (4-6 columns) или vapor compression для endotoxin <0.25 EU/mL, sterile pyrogen-free; loop hot-sanitized 80 °C weekly + ozone continuous 0.05 mg/L; USP <1231> Water for Pharmaceutical Purposes + EP 0008 + JP 16 + ISPE Baseline Pharmaceutical Water + ASTM D5127 + 21 CFR Part 11 + EU GMP Annex 1" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Объём 24/7 distribution</h2>
          <p className="text-slate-300">
            Фарм. завод нуждается 50 м³/час UPW. UPW тенк storage 4-часовой
            buffer + 50% safety reserve. Какой объём storage tank (литров)?
          </p>
          <input type="text" value={ex2} onChange={(e) => setEx2(e.target.value)} placeholder="л" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:border-blue-500 focus:outline-none" />
          {showResults && (
            <div className={`p-4 rounded-lg ${correct.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}>
              <p className="text-slate-200">
                <strong>Ответ:</strong> 50 м³/час × 4 часа × 1.5 safety = 300 м³ = 300 000 л.
                ≈ <strong>350 000 л</strong> с 17% extra сверх 4-ч buffer. Тенки SS 316L
                electropolished, conical bottom, N2-blanket. ISPE Baseline.
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс UPW plant 50 м³/час</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>Здание UPW 500 м² + cleanroom ISO 14644 кл.8 = 0.5 млрд тг</li>
            <li>Pre-treatment multimedia + GAC carbon filter 50 м³/ч = 0.18 млрд тг</li>
            <li>Softener Na-IX 2-train для 50 м³/ч + brine system = 0.12 млрд тг</li>
            <li>UF Suez Aquasource 0.02 мкм 4 modules + CIP system = 0.45 млрд тг</li>
            <li>1st pass RO Dow BW30-440FR × 16 PV × 6 elements + booster pump 75 кВт = 0.85 млрд тг</li>
            <li>2nd pass RO smaller × 8 PV + booster pump 35 кВт = 0.45 млрд тг</li>
            <li>EDI Suez E-Cell MK-3 × 3 modules + power supply + automation = 0.32 млрд тг</li>
            <li>UV-185 + UV-254 Trojan UVOXIDATION 250 кВт total + UV sensors = 0.28 млрд тг</li>
            <li>MB Mixed Bed × 2 polish vessel + regeneration skid = 0.18 млрд тг</li>
            <li>UF terminal Pall Microza 0.04 мкм PVDF + replacement filters = 0.12 млрд тг</li>
            <li>UPW storage tank SS 316L electropolished 350 м³ × 2 + N2 blanket = 0.95 млрд тг</li>
            <li>Distribution loop 316L electropolished pipe Ø50-100 мм × 1000 м orbital welded = 1.2 млрд тг</li>
            <li>Heat exchanger plate Tranter GX-91 для hot sanitization 80 °C = 0.18 млрд тг</li>
            <li>Online monitoring resistivity Mettler M300 + TOC Sievers M9 + particle Pall HRM = 0.85 млрд тг</li>
            <li>QC lab ICP-MS Agilent 7900 + IC Dionex + offline TOC Shimadzu + microbiology = 1.4 млрд тг</li>
            <li>SCADA Wonderware AVEVA + validation IQ/OQ/PQ + 21 CFR Part 11 + data integrity = 0.4 млрд тг</li>
            <li>Проектирование 5% + ПИР + НР + СП + USP/EP audit + PNR + insurance = 0.18 млрд тг</li>
          </ul>
          <p className="text-slate-300">Итого capex (тг, округл. до млрд):</p>
          <input type="text" value={ex3} onChange={(e) => setEx3(e.target.value)} placeholder="тг" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:border-blue-500 focus:outline-none" />
          {showResults && (
            <div className={`p-4 rounded-lg ${correct.ex3 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}>
              <p className="text-slate-200">
                <strong>Ответ:</strong> ~8.5 млрд тг (~$18M USD) на UPW plant 50 м³/час
                для фарм. (USP Purified Water + WFI). Distribution loop = 14% капекса.
                Удельная — $360/м³/час capacity.
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Biofilm prevention в loop</h2>
          <p className="text-slate-300">
            UPW distribution loop SS 316L electropolished. Risk — biofilm
            (microbiological contamination). Что обязательно по USP + ISPE?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Никаких мер — high-purity sufficient" },
              { v: "b", t: "Только annual cleaning" },
              { v: "c", t: "Multi-barrier biofilm prevention strategy по USP <1231> + ISPE Baseline + ASME BPE: 1) Material — SS 316L electropolished surface roughness Ra <0.4 мкм (vs general 1-2 мкм) — uniform smooth surface prevents bacterial attachment + permits effective sanitization; 2) Velocity — minimum 1.5 м/с continuous flow в всём loop (Reynolds Number >10 000 turbulent) для prevent stagnation zones где biofilm establishes — dead-leg <6× pipe diameter rule (max stagnant pipe 30 cm для 50 мм pipe); 3) Slope 1% — entire loop slopes для full drainage (gravity-drained when offline), no horizontal pipe без slope; 4) Sanitization — weekly hot water 80 °C × 60 minutes (thermal disinfection kills planktonic bacteria + retards biofilm), monthly chemical CIP с NaOH 1% + acid 1% phosphoric для scale removal; 5) Ozone continuous — для semiconductor UPW 0.05-0.5 mg/L ozone в loop постоянно (kills bacteria + organics), removed at POU точках через UV-185 нм; 6) UV-185 nm — постоянная continuous TOC oxidation, 0.25-1.0 кВт/м³ flow; 7) Welding — orbital automatic Schweissmaschinen Magnatech para-fluid pipe joints (no manual welds), 100% borescope inspection + dye penetrant test ASTM E165; 8) Validation — quarterly TOC + endotoxin + bacterial count + identity (Gram-positive/negative Bacillus / Pseudomonas / Mycobacterium), action limit 10 CFU/mL, alert limit 1 CFU/mL; 9) Sampling — sterile sample ports every 50 м loop + critical user points + before/after sanitization; 10) Data integrity 21 CFR Part 11 — все sanitization records + microbiological results electronic signature + audit trail; USP <1231> + ISPE Baseline Pharmaceutical Water + ASME BPE Bioprocessing Equipment + EU GMP Annex 1 + 21 CFR Part 11 + ASTM D5127 + JP 16 + EP 0008" },
              { v: "d", t: "Только periodic flushing" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex4, o.v, correct.ex4)}`}>
                <input type="radio" name="ex4" value={o.v} checked={ex4 === o.v} onChange={() => setEx4(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <button onClick={() => setShowResults(true)} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-lg font-semibold transition">
          Проверить ответы
        </button>
        {showResults && (
          <section className={`p-6 rounded-xl border-2 ${score === 4 ? "border-emerald-500 bg-emerald-500/10" : score >= 2 ? "border-amber-500 bg-amber-500/10" : "border-rose-500 bg-rose-500/10"}`}>
            <h2 className="text-2xl font-bold text-slate-50">Результат: {score} / 4</h2>
          </section>
        )}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-cyan-300">Нормативная база</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li><strong>USP &lt;1231&gt;</strong> — Water for Pharmaceutical Purposes (United States Pharmacopeia)</li>
            <li><strong>EP 0008 + JP 16</strong> — European + Japanese Pharmacopoeia water specs</li>
            <li><strong>ISPE Baseline Pharmaceutical Water</strong> — International Society for Pharmaceutical Engineering</li>
            <li><strong>ASTM D5127</strong> — Standard Guide for Ultra-Pure Water in Electronic Industry</li>
            <li><strong>ASME BPE 2022</strong> — Bioprocessing Equipment</li>
            <li><strong>21 CFR Part 11</strong> — Electronic Records / Signatures</li>
            <li><strong>EU GMP Annex 1 (2022)</strong> — Manufacture of Sterile Medicinal Products</li>
            <li><strong>FDA Guidance Process Validation 2011</strong></li>
            <li><strong>ITRS</strong> — International Technology Roadmap for Semiconductors (UPW for semi)</li>
            <li><strong>SEMI F63</strong> — Semiconductor UPW grade</li>
            <li><strong>ISO 14644</strong> — Cleanroom classification</li>
            <li><strong>СН РК 4.04-09</strong> — Электрические станции (applicable for UPW)</li>
            <li><strong>WHO TRS 957</strong> — Water for Pharmaceutical Use</li>
            <li><strong>ICH Q7</strong> — Good Manufacturing Practice for Active Pharmaceutical Ingredients</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
