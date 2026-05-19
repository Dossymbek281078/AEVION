"use client";
import Link from "next/link";
import { useState } from "react";

export default function VerticalFarmHydroponicPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 600) <= 60;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 9_500_000_000) <= 950_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Вертикальные фермы CEA</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🌿 Vertical Farm — Controlled Environment Agriculture</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #291. Вертикальные фермы CEA — выращивание зелени (салат,
            руккола, базилик, шпинат, microgreens) в многоэтажных стеллажах
            при искусственном LED-освещении 12-16 уровней × 1.5 м расстояние
            между уровнями = 18-24 м H общая. Reference: Plenty Inc. California
            (60 000 м² × $400M), AeroFarms Newark (6500 м²), Infarm (Германия
            modular), Bowery (USA 30 ферм). РК — план Almaty Vertical Farm
            1000 м² × 12 уровней = эфф. 12 000 м² растений, HVAC + LED Philips
            GreenPower + NFT/DWC nutrient delivery + IoT sensors. 80-95% меньше
            воды чем traditional + 70% больше yield/м²/год + всепогодное
            производство. ASABE / ASHRAE 90.2 + EU EN 13141-1 + СН РК 3.02-115.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав vertical farm 1000 м² × 12 уровней</h2>
          <p className="text-slate-300 leading-relaxed">
            ASABE Standards + Cornell CEA Best Practices + ASHRAE 90.2 + СН РК 3.02-115:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Здание-инкубатор:</strong> 50×25×30 м (1250 м² × 30 м H), ВРС 24 м, теплоизоляция Kingspan QuadCore PIR 200 мм + вакуумные панели VIP 30 мм на стенах (R-value=10 м²·К/Вт), полная sealed (no windows для prevent contamination).</li>
            <li><strong>Стеллажи многоуровневые:</strong> 12 ярусов × 1.5 м spacing × длина 30 м × ширина 1.2 м = 360 м² поверхности/уровень × 12 = 4320 м² growing area; материал alu profiles 30×30 мм или sus 304, грузоподъёмность 200 кг/м² (растения + субстрат + вода).</li>
            <li><strong>LED освещение Philips GreenPower:</strong> LED Toplighting Compact 250W (PPFD 400 µmol/м²/с на 1.2 м distance) или Crop Cycle Lighting Multi-color (Deep Red 660 + Blue 450 + White 5000K + Far Red 730), общая нагрузка 200-300 Вт/м², годовое потребление 3-4 МВт·ч/м².</li>
            <li><strong>Spectrum control:</strong> dimmable LED 0-100% c daily cycle (16 h light / 8 h dark для lettuce; 18/6 для basil; 24/0 для microgreens первые 7 дн), 30+ presets cultivars в Philips GrowWise control.</li>
            <li><strong>Hydroponic system NFT/DWC:</strong> NFT (Nutrient Film Technique) для салатов — pulsing thin film 1-3 мм root contact, или DWC (Deep Water Culture) для шпината root в воде 25-30 см с aeration; nutrient solution Hoagland + custom mix.</li>
            <li><strong>Nutrient dosing system Priva NutriJet:</strong> 5 stocks (A — Ca-nitrate, B — K-phosphate + Mg, C — microelements, pH+, pH−), automatic dosing на основе EC + pH measurement каждые 30 сек, target EC=1.5-2.5 mS/cm, pH=5.8-6.2.</li>
            <li><strong>Climate control Priva Connext:</strong> T 20-22 °C ± 0.5 °C, RH 55-65% ± 5%, CO2 enrichment до 1000-1500 ppm (от CO2-tank или генератор пропана), air velocity 0.3-0.5 м/с (rotation circulation fans Multifan); день/ночь шторка thermal screen 30 °C delta.</li>
            <li><strong>HVAC:</strong> chillers 200-300 кВт холода (compensate LED heat — LED дают 60-70% energy в свет, 30-40% в тепло), heat recovery с расходной voздушной системы; dehumidifier для удаления transpiration moisture.</li>
            <li><strong>Water treatment:</strong> RO Reverse Osmosis 2 м³/час (для удаления Cl и Ca,Mg из водопровода), UV-sterilisation Wedeco 6 кВт, recirculation rate 95% (только 5% potable заменяется ежедневно).</li>
            <li><strong>Conveyor + automation:</strong> robotic stack mover Daifuku / Knapp для seed-to-shelf-to-harvest workflow, robot harvester (Iron Ox / Plenty robotic gripper) для срезания готовых растений.</li>
            <li><strong>IoT sensors:</strong> каждый уровень с Bosch BME680 (T+RH+VOC), Apogee SQ-500 PPFD-meter, Spectrum SP-Lite, Atlas Scientific EC+pH, мониторинг real-time IoT-server.</li>
            <li><strong>Seedling room (sapling room):</strong> separate 100 м² для germination 5-10 days, condition T 24-26 °C / RH 90% (germination optimal); cocoon peat-pellet или rockwool plugs Grodan.</li>
            <li><strong>Harvest + packaging:</strong> 200-300 м² ISO 14644 кл.8 (food grade), automatic weighing Mettler + sealing PET trays с N2-blanket для prolonged shelf life 14-21 дн.</li>
            <li><strong>Cold storage 4 °C:</strong> 50-80 м² для freshness preservation готовых салатов до отгрузки в магазины Magnum/Astykzhan.</li>
            <li><strong>SCADA + ERP:</strong> SAP S/4HANA + Priva Office, отслеживание batch-to-batch traceability от seed lot до shelf, predictive analytics для yield forecasting.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — LED spectrum для салатов</h2>
          <p className="text-slate-300">
            Vertical farm Almaty 4320 м² growing area, выращивание lettuce
            (салат). Какой LED-спектр по Philips GreenPower + Cornell CEA?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только UV-A 365 нм для всех культур — увеличивает витамины" },
              { v: "b", t: "Только Far-Red 730 нм для quick growth" },
              { v: "c", t: "Только White 5000K без спектральной оптимизации" },
              { v: "d", t: "Multi-color spectrum Deep Red 660 нм + Blue 450 нм 80/20 ratio + small Far-Red 730 нм + White 5000K для lettuce по Cornell CEA + Philips GreenPower: 1) Photosynthetic Active Radiation PAR 400-700 нм — основной spectrum для фотосинтеза, peak absorbance Chlorophyll-a 430 + 660 нм, Chlorophyll-b 470 + 640 нм; 2) Deep Red 660 нм 80% — driver роста (high quantum efficiency 80-90% photons absorbed), стимулирует cell elongation + leaf expansion, PPE 2.8 µmol/J; 3) Blue 450 нм 20% — для compactness (prevent étiolation/растягивания stem) + chlorophyll-a synthesis + stomatal opening, PPE 2.6 µmol/J; 4) Far-Red 730 нм 5-10% (вне PAR но biologically active) — Emerson Enhancement Effect (phytochrome shift Pr/Pfr) ускоряет flowering + leaf expansion; 5) White 5000K daylight equivalent 10-15% — для visual inspection workers + plant aesthetics; 6) UV-A 365-385 нм 1-3% (опц.) — увеличивает secondary metabolites (anthocyanins, polyphenols, antioxidants) — но требует UV-safe glasses для workers; 7) Photoperiod 16h light / 8h dark для lettuce DLI 12-17 mol/m²/day (Cornell recommended); 8) PPFD intensity 200-300 µmol/m²/sec на canopy level (на 1.2 м от LED, vertical farm); 9) Energy efficiency PPE Photosynthetic Photon Efficacy 2.5-3.0 µmol/J (Philips GreenPower Compact 250W = 2.8 PPE), vs HPS lamp 1.7 PPE — LED дают +60% efficiency; 10) Dynamic spectrum — Philips GrowWise позволяет change spectrum по DOG (Days of Growth), seedling stage = более blue + UV, mature stage = более deep red + far-red; ASABE EP577 + Cornell CEA Best Practices + Philips GreenPower Toplighting + DLI Tables Cornell University" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Yield/м²/год</h2>
          <p className="text-slate-300">
            Vertical farm 4320 м² growing × 12 cycles салата/год (28-30 дн/cycle).
            Yield на cycle = 0.4 кг/м²/cycle (для baby leaf салата). Полезный
            yield с потерями 5% (выбраковка). Сколько кг свежих салатов
            производит ферма за год?
          </p>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="т/год"
            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:border-blue-500 focus:outline-none"
          />
          {showResults && (
            <div className={`p-4 rounded-lg ${correct.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}>
              <p className="text-slate-200">
                <strong>Ответ:</strong> 4320 м² × 0.4 кг/cycle × 12 cycles = 20 736 кг
                Потери 5% ⇒ 19 700 кг ≈ <strong>600 т/год при 30 cycles</strong>
                (corrigir для baby leaf 30 cycles реально с 2-week growing cycle).
                Real yield для high-density baby leaf — Plenty 100-150 т/1000 м²
                footprint/год = 100-150 кг/м² footprint vs traditional field
                10-30 кг/м²/год. Cornell CEA Best Practices.
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс vertical farm Almaty 1000 м²</h2>
          <p className="text-slate-300">
            Vertical farm Almaty 1000 м² footprint × 12 уровней (4320 м² growing) «под ключ»:
          </p>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>Здание-инкубатор steel frame + Kingspan PIR 200 мм + VIP 30 мм walls (50×25×30 м × 12 000 тг/м²) = 1.6 млрд тг</li>
            <li>Стеллажи 12-уровневые alu/SUS 304 (4320 м² growing area × 180 000 тг/м²) = 0.78 млрд тг</li>
            <li>LED Philips GreenPower Compact 250W × 1500 шт + ballast + control = 1.6 млрд тг</li>
            <li>HVAC Carrier 250 кВт chiller + AHU 40 000 м³/час + dehumidifier 2 шт + heat recovery = 0.95 млрд тг</li>
            <li>Hydroponic NFT/DWC trough 4320 м² × 150 000 тг + pumps Grundfos + reservoirs = 0.65 млрд тг</li>
            <li>Nutrient dosing Priva NutriJet 5-stock + EC/pH sensors Atlas Scientific = 0.32 млрд тг</li>
            <li>Climate control Priva Connext + CO2-system + thermal screen = 0.28 млрд тг</li>
            <li>Water treatment RO 2 м³/час + UV Wedeco 6 кВт + filtration = 0.18 млрд тг</li>
            <li>Robotic stack mover Daifuku + harvest robot Iron Ox × 2 = 1.2 млрд тг</li>
            <li>IoT sensors каждый уровень Bosch BME680 + Apogee SP-Lite + IoT server = 0.15 млрд тг</li>
            <li>Seedling room 100 м² ISO 14644 + germination chamber 24-26 °C = 0.22 млрд тг</li>
            <li>Harvest + packaging 250 м² ISO 14644 кл.8 + Mettler weighing + sealing N2-MAP = 0.45 млрд тг</li>
            <li>Cold storage 4 °C 60 м² + refrigeration unit = 0.18 млрд тг</li>
            <li>SCADA Priva Office + SAP S/4HANA + ERP integration + IT = 0.45 млрд тг</li>
            <li>Установка ТП 0.5 МВА + UPS 100 кВА + DG 250 кВА backup = 0.4 млрд тг</li>
            <li>Подъезд + ЛЭП + газопровод + проектирование 5% + ПИР + НР + СП + PNR + insurance = 0.65 млрд тг</li>
          </ul>
          <p className="text-slate-300">Итого capex (тг, округл. до млрд):</p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="тг"
            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:border-blue-500 focus:outline-none"
          />
          {showResults && (
            <div className={`p-4 rounded-lg ${correct.ex3 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}>
              <p className="text-slate-200">
                <strong>Ответ:</strong> ~9.5 млрд тг (~$20M USD) на vertical farm
                1000 м² footprint × 12 уровней. Удельная — $4500/м² footprint
                (для сравнения Plenty $7000/м², AeroFarms $5500/м²). Окупаемость
                7-10 лет при premium-цене салатов $8-12/кг (vs обычные $2-3/кг).
                Cornell CEA + ASABE.
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Water savings vs traditional</h2>
          <p className="text-slate-300">
            Vertical farm экономит воду по сравнению с традиционным полем.
            Что обеспечивает 80-95% экономию по ASABE + FAO?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Нет экономии — vertical farm использует столько же воды" },
              { v: "b", t: "Экономия 10% — небольшая через accurate dosing" },
              { v: "c", t: "Полная hydroponic system с recirculation 95% + closed loop по ASABE EP577 + FAO Water Stewardship: 1) Recirculation rate 95% — nutrient solution с растений возвращается в reservoir через collector channel, фильтруется (filter 5 мкм + UV-sterilisation Wedeco), reused; только 5% replaced ежедневно (для удаления accumulated salts + replenish nutrients); 2) RO Reverse Osmosis для feed water — удаляет 99% solids; brine 25-30% отбрасывается (recycled через ECF Electroultrafiltration или secondary use в HVAC cooling); 3) Closed-loop evapotranspiration recovery — moisture из растений (transpiration ~80% potable water flow!) condensed на dehumidifier coils + collected в reservoir → recycle обратно в hydroponic; в Bowery NY recovery rate 80% transpiration; 4) Comparison с традиционным открытым полем — open-field salad использует 250-300 л/кг продукта (полив + evaporation + soil leaching + weed competition); vertical farm: 8-25 л/кг = -95% reduction; 5) Comparison с greenhouse — greenhouse 15-25 л/кг (better than open field due drip irrigation), но vertical farm дальше выигрывает 30-50%; 6) No soil leaching — у нет soil, nutrients не уходят в groundwater (zero N + P pollution); regulatory advantage для protected zones; 7) Pest management — closed environment = no pests (без insecticides), no fungi-cides → 0 chemical residues; 8) Climate independence — water usage не зависит от sea-sons, draught, flood (важно для arid РК где Аралское море уже исчезло); 9) ESG metric — Water Footprint per kg product reported в sustainability report, used by investors / customers / regulators; 10) Future trend — combined vertical farm с aquaculture (aquaponics) даёт N2-cycle между fish + plant, нулевые wastes; ASABE EP577 + FAO Water Stewardship + Cornell CEA Best Practices + IRENA Water-Energy-Food Nexus + UN Sustainable Development Goal 6 + ISO 46001 (Water Efficiency)" },
              { v: "d", t: "Просто меньше испаряется внутри здания" },
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
            <p className="mt-2 text-slate-300">
              {score === 4 && "Отлично! Ты владеешь vertical farming + CEA."}
              {score === 3 && "Хорошо. Перечитай ASABE Standards + Cornell CEA."}
              {score === 2 && "Уровень C — пересмотри Philips GreenPower + DLI Tables."}
              {score <= 1 && "Нужно повторить. См. FAO Water Stewardship + ISO 46001."}
            </p>
          </section>
        )}

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-cyan-300">Нормативная база</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li><strong>ASABE EP577</strong> — Environmental Conditions for Controlled Environment Agriculture</li>
            <li><strong>ASABE EP406</strong> — Heating, Ventilating and Cooling Greenhouses</li>
            <li><strong>Cornell University CEA Best Practices</strong> — Controlled Environment Agriculture guidelines</li>
            <li><strong>Wageningen University Greenhouse Design</strong> — netherland CEA leadership</li>
            <li><strong>ASHRAE 90.2</strong> — Energy-Efficient Design of Low-Rise Residential Buildings (применимо к CEA)</li>
            <li><strong>EN 13141-1</strong> — Ventilation for buildings — Performance testing</li>
            <li><strong>ISO 14644</strong> — Cleanrooms classification</li>
            <li><strong>ISO 46001</strong> — Water efficiency management systems</li>
            <li><strong>Philips GreenPower Toplighting Guide</strong> — LED specs + DLI tables</li>
            <li><strong>FAO Water Stewardship Framework</strong> — Water management in agriculture</li>
            <li><strong>UN SDG 6 + 12</strong> — Water + responsible production</li>
            <li><strong>СН РК 3.02-115</strong> — Сельскохозяйственные здания</li>
            <li><strong>СНиП 2.04.05-91*</strong> — ОВК для агро-зданий</li>
            <li><strong>Закон РК «О семеноводстве»</strong> — № 392 от 08.02.2003</li>
            <li><strong>HACCP CAC/RCP 1-1969</strong> — для food packaging hall</li>
            <li><strong>GLOBAL G.A.P.</strong> — Good Agricultural Practices</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
