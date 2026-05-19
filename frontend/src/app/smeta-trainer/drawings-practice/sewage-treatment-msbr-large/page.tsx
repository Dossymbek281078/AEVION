"use client";
import Link from "next/link";
import { useState } from "react";

export default function SewageTreatmentMsbrLargePage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);
  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 30) <= 3;
  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 95_000_000_000) <= 9_500_000_000;
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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Городские ОСК MSBR</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🚱 Городские ОСК MSBR + удаление N/P</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #295. Алматинские ОСК «Кенасары» (450 тыс. м³/сут), Астанинские
            ОСК «Қарашоқы» (220 тыс. м³/сут), Шымкентские «Сайрам» (180 тыс. м³/сут).
            MSBR (Modified Sequencing Batch Reactor) — современная биотехнология
            удаления N+P+BOD: один тенк работает в циклах fill→aerate→anoxic→settle→decant
            (4-6 часов цикл). Удалено BOD5 95-98% (3000 → 5-10 мг/л), TN 80-90%
            (50 → 5-8 мг/л) через nitrification-denitrification + biological P-removal
            EBPR (Enhanced Biological Phosphorus Removal). Сжигание ила thermal
            (Andritz Bertrams BFB) или anaerobic digestion → biogas + cogeneration.
            EU 91/271/EEC + EU 2020/741 + СНиП 2.04.03 + СН РК 4.01-03 + ISO 24513.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав ОСК 450 тыс м³/сут MSBR</h2>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Главный канализационный коллектор:</strong> Ø2000 мм самотёчная + Ø1000 мм напорная (от насосных подстанций), приёмная камера ОСК на dummy-площадке;</li>
            <li><strong>Прёт-treatment (mechanical):</strong> coarse screen Hydrasieve 50 мм + fine 6 мм + grit chamber Mecana aerated 200 м³, удаление песка + sand (0.2 мм) + плавающего жира FOG;</li>
            <li><strong>Primary sedimentation:</strong> 4 круглых ж/б tanks Ø40 м H=4 м (8 000 м³ каждый) с center-fed scraper, BOD removal 30-40%, retention time 2-4 ч;</li>
            <li><strong>MSBR reactors:</strong> 6 ж/б tanks 50×30×6 м (9000 м³ каждый), цикл fill 1 ч → aerate 2 ч → anoxic 0.5 ч → settle 0.5 ч → decant 0.5 ч + sludge wasting; общий цикл 4-6 ч;</li>
            <li><strong>Aeration system:</strong> EDI fine-bubble diffuser 9-mil pores ROEFLEX × 5000 на пол tanks, blower Kaeser CB 250 КВт × 6 шт (5 раб + 1 рез), O2 demand 80-120 g/m³ wastewater;</li>
            <li><strong>Decant mechanism:</strong> automated floating decanter Aqua-Aerobic AquaDDM ±25 мм точность, separates clarified effluent (TSS &lt;10 мг/л) после settle phase;</li>
            <li><strong>Activated sludge management:</strong> RAS Recycle Activated Sludge 50-80% от inflow + WAS Waste Activated Sludge 1-2% к dewatering, SRT (Sludge Retention Time) 10-15 days для nitrification optimum;</li>
            <li><strong>Tertiary filtration:</strong> Mecana Pile Cloth Filter или sand filter для polishing TSS до {"<"}5 мг/л + BOD до {"<"}3 мг/л (для discharge в reuse / sensitive water body);</li>
            <li><strong>UV disinfection:</strong> Wedeco TAK 55 medium-pressure 100 кВт × 4 модуля, дозa 30-40 mJ/cm² для elimination E.coli + viruses 99.9999%; альтернатива — ozone Wedeco OZW;</li>
            <li><strong>Sludge dewatering:</strong> Andritz belt filter press 2 м × 4 шт или centrifuge ANDRITZ D6L, output 22-28% dry solids cake;</li>
            <li><strong>Anaerobic digestion:</strong> 2 ж/б mesophilic digesters Ø35 м H=20 м (объём 18 000 м³ каждый), T=35 °C, retention 20-25 days, biogas output 0.3-0.4 м³/кг VS reduced, CH4 60-65%;</li>
            <li><strong>Biogas cogeneration:</strong> GE Jenbacher J420 1.4 МВт × 2 engines = 2.8 МВт electricity + heat для digester heating + plant operations (energy self-sufficient ~70%);</li>
            <li><strong>Final sludge handling:</strong> dry sludge cake 25% DS → composting (для landscape mulch) или incineration Andritz Bertrams BFB + ash to landfill class III;</li>
            <li><strong>Effluent reuse (опц.):</strong> tertiary-treated water используется для индустриальных целей (city CHP cooling) или для irrigation green spaces (compliance EU 2020/741 standards);</li>
            <li><strong>SCADA + DCS Schneider EcoStruxure + DCS:</strong> 24/7 monitoring 2000+ tag points (DO + pH + ORP + level + flow + sludge density), automatic phasing MSBR cycle оптимизация.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Технология MSBR vs CAS</h2>
          <p className="text-slate-300">
            Кенасары ОСК Алматы — какая технология по EU 91/271/EEC + WEF + СН РК 4.01-03?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только septic tanks (для частного дома)" },
              { v: "b", t: "Простой stream без обработки" },
              { v: "c", t: "Только chlorination перед сбросом" },
              { v: "d", t: "MSBR Modified Sequencing Batch Reactor с biological N+P removal по EU 91/271/EEC + WEF Operations Manual + Cornell Wastewater: 1) Преимущества MSBR над CAS (Continuous Activated Sludge): один тенк выполняет несколько функций (fill+aerate+settle+decant) → footprint 30-40% меньше; 2) Cycle phases: Fill 1 час (с stop-aeration для anaerobic phase EBPR), Aerate 2 часа DO=2.0 mg/L для nitrification NH4+ → NO3-, Anoxic 0.5 ч DO=0 для denitrification NO3- → N2 gas, Settle 0.5 ч quiescent (TSS settles из mixed liquor), Decant 0.5 ч floating decanter; 3) BOD removal 95-98% — мобилизация organic carbon в активный ил MLSS 3000-4500 mg/L; 4) Nitrification — autotrophic bacteria Nitrosomonas + Nitrobacter оксидируют NH4+ → NO2- → NO3- (требует SRT 10-15 days + DO 2+); 5) Denitrification — heterotrophic bacteria reduce NO3- → N2 в anoxic phase + organic carbon из raw wastewater (BOD source); TN removal 80-90%; 6) EBPR Enhanced Biological Phosphorus Removal — anaerobic phase PHA Poly-HydroxyAlkanoate accumulation в PAOs Phosphorus-Accumulating Organisms → aerobic phase poly-P storage → P removed via WAS sludge; TP removal 80-90% без chemical (ferric chloride backup); 7) Footprint vs CAS — MSBR 30% меньше (один тенк vs 3-tank serial CAS), но peak flow demand больше; 8) Automation — automatic phase switching + flow equalisation buffer перед MSBR (для smooth diurnal peak); 9) Operational expertise — MSBR требует skilled operators (vs CAS simpler), но cost savings из smaller footprint + reduced chemical use; 10) Discharge limits EU 91/271/EEC sensitive areas: TN <10 mg/L, TP <1 mg/L, BOD5 <25 mg/L, TSS <35 mg/L — MSBR с tertiary полишинг достигает; EU 91/271/EEC + WEF Operations Manual + Cornell Wastewater Best Practices + СН РК 4.01-03 + ISO 24513" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Объём MSBR reactors</h2>
          <p className="text-slate-300">
            ОСК 450 тыс м³/сут = 5.21 м³/с. MSBR cycle 6 ч (fill+aerate+anoxic+settle+decant).
            HRT (Hydraulic Retention Time) = 12-18 ч. Используется 6 параллельных tanks
            (3 в active cycle, 3 в other phases). Какой объём ОДНОГО tank (тыс. м³)?
          </p>
          <input type="text" value={ex2} onChange={(e) => setEx2(e.target.value)} placeholder="тыс. м³" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:border-blue-500 focus:outline-none" />
          {showResults && (
            <div className={`p-4 rounded-lg ${correct.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}>
              <p className="text-slate-200">
                <strong>Ответ:</strong> Q × HRT = 5.21 м³/с × 15 ч × 3600 = 281 000 м³ total volume MSBR.
                Делим на 6 tanks = 47 000 м³/tank. С 30% buffer = ~55 000 м³.
                Реально для Кенасары tank 50×30×6 м ≈ <strong>9 000 м³ × 6 параллельных
                + 12 серий = 30 тыс м³</strong> total. Округл. 30 тыс м³.
                EU 91/271/EEC + СН РК 4.01-03.
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс ОСК 450 тыс м³/сут</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>Земляные + коллектор Ø2000 мм 5 км до ОСК = 8.5 млрд тг</li>
            <li>Pre-treatment Hydrasieve 50+6 мм + grit chamber Mecana = 2.8 млрд тг</li>
            <li>Primary sedimentation 4×Ø40 м H=4 м ж/б + scraper = 6.8 млрд тг</li>
            <li>MSBR reactors 6×50×30×6 м ж/б B40 + EPDM lining = 18 млрд тг</li>
            <li>Aeration EDI fine-bubble diffuser 30 000 шт + blowers Kaeser CB 250 кВт × 6 = 6.5 млрд тг</li>
            <li>Decanter Aqua-Aerobic AquaDDM × 6 + automation = 1.5 млрд тг</li>
            <li>Tertiary filter Mecana Pile Cloth + sand filter polishing = 3.2 млрд тг</li>
            <li>UV disinfection Wedeco TAK 55 × 4 modules 100 кВт + tube replacement = 1.8 млрд тг</li>
            <li>Sludge dewatering Andritz belt 2 м × 4 + centrifuge backup = 4.5 млрд тг</li>
            <li>Anaerobic digesters 2×Ø35 H=20 м ж/б heated + mixing = 12 млрд тг</li>
            <li>Biogas cogeneration GE Jenbacher J420 × 2 × 1.4 МВт + heat exchanger = 7.5 млрд тг</li>
            <li>Sludge incineration Andritz Bertrams BFB + ash handling = 5.8 млрд тг</li>
            <li>Pump stations RAS+WAS+effluent + насосы Sulzer NPS Flygt = 2.2 млрд тг</li>
            <li>SCADA Schneider EcoStruxure 2000+ tags + DCS + control room 24/7 = 2.5 млрд тг</li>
            <li>Лаборатория QA BOD/COD/TSS/N/P + ICP-MS + GC-MS + microbiology = 1.6 млрд тг</li>
            <li>ТП 35 кВ 16 МВА + UPS 1 МВА + DG 5 МВт + связь = 3.5 млрд тг</li>
            <li>Адм. блок 2000 м² + рабочие 200 чел + maintenance shop = 2.8 млрд тг</li>
            <li>Effluent reuse pipeline (опц для irrigation 50 км) + treatment + ECC certification + проектирование 5% + ПИР + НР + СП + PNR + insurance = 3.5 млрд тг</li>
          </ul>
          <p className="text-slate-300">Итого capex (тг, округл. до млрд):</p>
          <input type="text" value={ex3} onChange={(e) => setEx3(e.target.value)} placeholder="тг" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:border-blue-500 focus:outline-none" />
          {showResults && (
            <div className={`p-4 rounded-lg ${correct.ex3 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}>
              <p className="text-slate-200">
                <strong>Ответ:</strong> ~95 млрд тг (~$200M USD) на ОСК 450 тыс м³/сут MSBR.
                Удельная — $445/м³/сут capacity (vs simple CAS $250-300).
                Окупаемость через wastewater tariff $0.20-0.40/м³ + biogas energy revenue.
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Sludge management</h2>
          <p className="text-slate-300">
            ОСК 450 тыс м³/сут производит ~70 т сухого ила/сут. Что делать по EU 86/278/EEC?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Просто сбросить в реку" },
              { v: "b", t: "Captured Pondage без обработки" },
              { v: "c", t: "Anaerobic digestion + cogeneration biogas + thermal incineration или landspread + ash to landfill class III по EU 86/278/EEC + EU 2018/851 + ISO 24510: 1) Stage 1 — gravity thickening primary sludge (5-8% DS) + secondary sludge waste activated (0.8-1% DS) в DAF/gravity belt thickener → 4-6% DS; 2) Stage 2 — Anaerobic Digestion (AD) — mesophilic 35 °C × 20-25 days SRT в 2 closed digesters 18 000 м³ each (covered top для prevent odor + biogas capture), HRT 20 days, organic loading rate 1.5-2.5 кг VS/m³/day; 3) Biogas production 0.3-0.4 м³/кг VS reduced, output 5000-8000 м³/сут @ 60-65% CH4; cogeneration GE Jenbacher J420 1.4 МВт electrical × 2 + 1.4 МВт heat (для digester heating + plant operations); 4) Energy self-sufficiency — 70-80% от plant energy demand покрывается biogas (rest из grid); 5) Stage 3 — dewatering Andritz belt filter press 2-м wide × 4 шт, output 22-28% DS cake; alternative centrifuge ANDRITZ D6L (deeper dewatering 30% DS но higher polymer consumption); 6) Disposal options: (a) Composting с wood chips bulking agent → biosolids landscape mulch (но heavy metal limits Cd<10 mg/kg, Pb<300 mg/kg per EU 86/278), (b) Thermal incineration Andritz Bertrams BFB Bubbling Fluidized Bed 850 °C × 2 sec residence для destruction pathogens + organics, ash 5-10% original mass to landfill class III, (c) Landspread агропромышленным (только если соответствует EU 86/278 limits); 7) Heavy metals concern — особенно для ОСК с industrial wastewater inflow (Pb/Cd/Cu/Zn/Cr/Ni) — quarterly analysis ICP-MS; 8) Pathogen reduction — anaerobic digestion + 30 day storage обеспечивает 6-log reduction E.coli + Salmonella per EU PAD Standard A; 9) Odor management — закрытые digesters + biofilter Biotage 5000 м³/ч на edge tanks + carbon adsorption emergency; 10) Regulatory — quarterly reporting Минэкологии РК + ESG ESCAP score; EU 86/278/EEC + EU 2018/851 Circular Economy + ISO 24510 + WEF Sludge Manual + СН РК 4.01-03 + Закон РК Об охране окруж. среды" },
              { v: "d", t: "Только закопать без обработки" },
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
            <li><strong>EU 91/271/EEC</strong> — Urban Waste Water Treatment Directive</li>
            <li><strong>EU 86/278/EEC</strong> — Sewage sludge in agriculture</li>
            <li><strong>EU 2020/741</strong> — Water Reuse Regulation</li>
            <li><strong>EU 2018/851</strong> — Circular Economy Action Plan</li>
            <li><strong>СН РК 4.01-03</strong> — Канализационные очистные сооружения</li>
            <li><strong>СНиП 2.04.03-85</strong> — Канализация наружные сети и сооружения</li>
            <li><strong>WEF Operations Manual</strong> — Water Environment Federation</li>
            <li><strong>ISO 24510 / 24512</strong> — Drinking water + Wastewater services</li>
            <li><strong>WHO Guidelines Sanitation</strong></li>
            <li><strong>USEPA Method 1664B</strong> — Oil and grease measurement</li>
            <li><strong>EN 12255</strong> — Wastewater treatment plants</li>
            <li><strong>Cornell Wastewater Best Practices</strong></li>
            <li><strong>WEF MOP 11/30</strong> — Manuals of Practice</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
