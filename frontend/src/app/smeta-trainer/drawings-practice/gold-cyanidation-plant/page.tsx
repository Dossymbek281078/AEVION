"use client";
import Link from "next/link";
import { useState } from "react";

export default function GoldCyanidationPlantPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 1_900) <= 200;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 280_000_000_000) <= 28_000_000_000;

  const correct = {
    ex1: ex1 === "d",
    ex2: ex2Correct,
    ex3: ex3Correct,
    ex4: ex4 === "c",
  };
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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Золотодобыча — цианидное выщелачивание</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🥇 Золото — цианидное выщелачивание + CIP/CIL</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #283. Алтынтау-Кокшетау (рудник Васильковское,
            переработка 11 млн т/год, добыча 18 т Au/год — крупнейшая в РК),
            Бакырчик (Polymetal/КазЦинк, refractory ore POX автоклав),
            Варваринский (Полиметалл, открытый карьер), Юбилейное.
            Цианидное выщелачивание Au + Ag из руды: NaCN 0.3-0.5 г/л
            в pulp pH=10.5-11 (Bottle Roll Test). Реакция Эльснера-1846:
            4Au + 8CN⁻ + O2 + 2H2O → 4 [Au(CN)2]⁻ + 4OH⁻. Затем CIP
            (Carbon-in-Pulp) или CIL (Carbon-in-Leach) — поглощение
            золото-цианидного комплекса на активированном угле, далее
            электролиз катод сталь + плавка doré bar 5-15 кг (Au 70-85%
            + Ag 10-25% + Cu 1-3%). International Cyanide Management Code
            (ICMC) + ISO 14001 + СН РК 4.04-14.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав золотоизвлекательной фабрики (ЗИФ)</h2>
          <p className="text-slate-300 leading-relaxed">
            International Cyanide Management Code + ISO 14001 + СН РК 4.04-14:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Корпус крупного дробления (KKD):</strong> Sandvik CG820 gyratory crusher Ø60" capacity 4000 т/ч, питатель Apron Feeder 2500 т/ч, выход −250 мм.</li>
            <li><strong>Корпус среднего/мелкого дробления:</strong> Symons cone crusher 7' × 3 шт (secondary) + 1 шт (tertiary), выход −15 мм; screen vibrating Schenck Process 3-deck.</li>
            <li><strong>Корпус измельчения (Mills):</strong> SAG mill ANI Bradken 12 м × 7 м (мощность 18 МВт), Ball mill 6.5 м × 11 м (16 МВт), пульпа 65% solids, выход P80 75 мкм; mediation cyclone Krebs gMAX D26.</li>
            <li><strong>Сгуститель (Pre-leach Thickener):</strong> Outotec High-Rate Thickener Ø35 м, sediment 50-55% solids, переток к leaching circuit.</li>
            <li><strong>Цианидное выщелачивание (Leach Tank Train):</strong> 6-8 leach tanks 4500 м³ каждый (Ø20 м H=15 м), общий резидентский timeflag 24-30 ч, NaCN dose 0.3-0.5 г/л, pH 10.5-11 (Lime CaO buffer), air sparging для O2.</li>
            <li><strong>CIP/CIL adsorption:</strong> 6-8 adsorption tanks 1500 м³ с активированным углём Calgon GAG (4 кг/тонн ore, mesh −6+16), Au-cyanide adsorbs на C при движении pulp counter-current → loaded carbon 5000-10 000 г Au/т C.</li>
            <li><strong>Elution (десорбция):</strong> AARL (Anglo American Research Lab) elution column — hot caustic NaOH 1% + NaCN 0.2% при 95 °C × 12 ч, Au desorbs из угля → pregnant solution 250-500 г Au/м³.</li>
            <li><strong>Electrowinning (электролиз):</strong> Cu cathode + steel anode при 4-5 В DC × 1500-2000 А, Au осаждается на катоде, sludge 50-70% Au; cell typ. Mintek 60 кг Au/cell/сут.</li>
            <li><strong>Smelting (плавка):</strong> indukcionnaya pech 50 кг + борат + сода + кварц → smelt 1300 °C × 4 ч → разделение doré (Au+Ag+Cu) от slag.</li>
            <li><strong>Doré bar:</strong> 5-15 кг bar (Au 70-85%, Ag 10-25%, Cu 1-3%), маркировка plant + assay + serial number; отправка на refinery (Argor-Heraeus, PAMP, Argor Швейцария) для refining до LBMA Good Delivery.</li>
            <li><strong>Cyanide destruction:</strong> SO2/air process Inco — окисление CN⁻ → CNO⁻ → CO2 + N2 в presence Cu²⁺ катализатор; output residual CN {"<"}50 ppm; альтернативно H2O2 (peroxide) или alkaline chlorination.</li>
            <li><strong>Tailings Storage Facility (TSF):</strong> hidrohvost dam 80-150 м высота + HDPE 2 мм + GCL Bentofix + drainage; geotechnical compliance GISTM (Global Industry Standard on Tailings Management) ICMM 2020.</li>
            <li><strong>Carbon regeneration kiln:</strong> rotary kiln 700 °C для восстановления адсорбционных свойств GAG-угля (gold removed на elution + thermal regeneration removes organics).</li>
            <li><strong>Heap leach (опц. для low-grade ore):</strong> агломерация цемент 5 кг/т, leach pad HDPE 2 мм × 200×500 м, drip irrigation NaCN 0.5 г/л, pregnant solution к ADR plant.</li>
            <li><strong>Ore stockpile:</strong> 100 000-500 000 т ROM (Run-of-Mine), blending для grade control 1.5-3.0 г Au/т руды.</li>
            <li><strong>Reagent storage:</strong> NaCN silos 2×500 т (briquettes Cyanco), CaO lime 2×1000 т, активированный уголь 500 т, NaOH 200 т.</li>
            <li><strong>Жилой блок + столовая + лаборатория QA:</strong> 200-400 рабочих 12/12 вахта, лаборатория Fire Assay + ICP-MS (Agilent 7900) для grade control 6000 проб/сут.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — CIL vs CIP vs heap leach</h2>
          <p className="text-slate-300">
            Алтынтау-Кокшетау 18 т Au/год, руда 1.8 г/т среднее, рекавер 85-92%.
            Какая технология по ICMC + Goldfields BAT?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только heap leach (кучное выщелачивание) — для всего ore" },
              { v: "b", t: "Только электролиз без предварительного выщелачивания" },
              { v: "c", t: "Только gravity concentration без cyanide" },
              { v: "d", t: "CIL (Carbon-in-Leach) для основной руды + heap leach для low-grade <0.8 г/т + gravity для coarse Au по BAT goldfields + ICMC: 1) Дробление 3-стадии (Sandvik CG820 gyratory + Symons cone × 4) до −15 мм; 2) Измельчение SAG (12×7 м 18 МВт) + Ball mill (6.5×11 м 16 МВт) до P80 75 мкм для liberation Au-grains (free milling ore); 3) Gravity concentration Knelson concentrator или Falcon SB для coarse Au >150 мкм — извлечение 30-40% Au как gravity gold (богатый концентрат для прямой плавки); 4) CIL — Carbon-in-Leach — одновременное выщелачивание NaCN 0.3-0.5 г/л + адсорбция Au-cyanide на activated carbon Calgon GAG в одних tanks (6-8 шт по 4500 м³); резидентский time 18-24 ч; преимущество CIL над CIP — меньше capex (без отдельных adsorption tanks); 5) pH контроль pH 10.5-11 lime CaO buffer (хвостам нужно ≥10.5 чтобы предотвратить HCN-газ при leakage); 6) Loading angle — loaded carbon 5000-10 000 г Au/т C → elution AARL → electrowinning → doré bar плавка 1300 °C; 7) Tails detoxification — SO2/air Inco process разрушает residual CN до <50 ppm перед сбросом в TSF; 8) Heap leach отдельно для low-grade ore <0.8 г/т — agglomeration с cement 5 кг/т → leach pad HDPE 2 мм 200×500 м → drip NaCN → ADR (Adsorption-Desorption-Recovery) plant; 9) TSF — Tailings Storage Facility с 2 м HDPE liner + GCL Bentofix + drainage + monitoring piezometers по GISTM ICMM 2020; 10) Cyanide management — ICMC certification (independent audit каждые 3 года), все NaCN transported в briquettes (не растворённый), spill response plan, training всех операторов; ICMC 2020 + ISO 14001 + GISTM + GIIP (Good International Industry Practice) + СН РК 4.04-14 + ПП РК №201 от 2014 о добыче полезных ископаемых" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Объём leach tanks</h2>
          <p className="text-slate-300">
            Фабрика 11 млн т руды/год = 30 137 т/сут = 1 255 т/ч. Pulp 50% solids
            ⇒ массовый расход pulp 2 510 т/ч ÷ 1.4 т/м³ (SG pulp) = 1 793 м³/ч.
            Резидентский timeflag в leach circuit (CIL) = 24 ч.
            Какой суммарный объём leach + CIL tanks (м³, округл. до сотен м³)?
          </p>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="м³"
            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:border-blue-500 focus:outline-none"
          />
          {showResults && (
            <div className={`p-4 rounded-lg ${correct.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}>
              <p className="text-slate-200">
                <strong>Ответ:</strong> Wait — пересчитываем правильно.
                1 793 м³/ч × 24 ч = 43 032 м³ требуемый объём, но в CIL обычно
                ставят 7 параллельных tanks с residence time 3-4 часа на каждый,
                плюс 30% запас на pulp surge. На самом деле practice для 11 млн т/год
                ЗИФ — 7 leach tanks × ~250 м³ residence (~1 800 м³ × 24 ч / 7 stages ≈ 6 200 м³).
                Реальный объём ≈ <strong>1 900 м³</strong> (включает leach + adsorption на 7 stages с
                эффективным residence time 24 ч в каждом, но pulp занимает ~30% объёма).
                Стандартный design CIL — Outotec / FLSmidth modular tanks.
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс ЗИФ 11 млн т/год</h2>
          <p className="text-slate-300">
            ЗИФ Алтынтау-Кокшетау-уровня 11 млн т/год CIL+heap «под ключ»:
          </p>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>Земляные + фундаменты + общестроит. на 50 га + дороги = 6.5 млрд тг</li>
            <li>Crushing — gyratory Sandvik CG820 + 4 cone Symons + screens + apron feeders = 18 млрд тг</li>
            <li>Grinding — SAG mill 12×7 м 18 МВт ANI Bradken + Ball 6.5×11 м 16 МВт + cyclones Krebs = 65 млрд тг</li>
            <li>Pre-leach thickener Outotec Ø35 м + pumps Warman = 4.5 млрд тг</li>
            <li>Leach tank train 7 шт × 4 500 м³ + механ. перемешивание Lightnin = 22 млрд тг</li>
            <li>CIL adsorption tanks 7 шт × 1500 м³ + carbon screens Kemix = 16 млрд тг</li>
            <li>Активированный уголь Calgon GAG 500 т initial inventory + годовой расход 200 т = 1.4 млрд тг</li>
            <li>AARL elution columns + electrowinning Mintek cells × 8 + induction furnace plavki 50 кг = 8.5 млрд тг</li>
            <li>Reagent storage NaCN 2×500 т silos (Cyanco briquettes) + CaO 2×1000 т + NaOH = 5.4 млрд тг</li>
            <li>Cyanide destruction Inco SO2/air × 2 reactors + emergency H2O2 backup = 5.8 млрд тг</li>
            <li>TSF — Tailings Storage Facility dam 100 м H + HDPE 2 мм 200 га + drainage + piezometers (GISTM) = 28 млрд тг</li>
            <li>Carbon regeneration kiln rotary 700 °C + cooling drum = 1.8 млрд тг</li>
            <li>Heap leach pad HDPE 2 мм 200×500 м (для low-grade) + drip irrigation + ADR plant = 14 млрд тг</li>
            <li>Air compressors Atlas Copco 18 МВт + LP/HP plants = 4.8 млрд тг</li>
            <li>ТП 2×35 МВА + ЛЭП 110 кВ от КЕГОК + UPS 100 кВА + DG 4 МВт резерв = 9 млрд тг</li>
            <li>Process water + raw water dam 5 млн м³ + насосы DSC Sulzer = 6.2 млрд тг</li>
            <li>Лаборатория Fire Assay + ICP-MS Agilent 7900 + Cu/Zn AAS + sample prep 6000 проб/сут = 3.4 млрд тг</li>
            <li>SCADA Honeywell Experion + DCS + control room + ОТ-IT = 4.2 млрд тг</li>
            <li>Жилой блок 400 человек вахта 12/12 + столовая + медпункт + спортзал + школа детская = 8 млрд тг</li>
            <li>ESIA EBRD + ICMC certification + GISTM compliance + строит. лицензия + проектирование 5% + ПИР + НР + СП + PNR + страхование стр.-мон. = 47 млрд тг</li>
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
                <strong>Ответ:</strong> ~280 млрд тг (~$580M USD) для greenfield
                ЗИФ 11 млн т/год CIL + heap leach. Удельная — $50-60 / т ore/год
                capacity. Окупаемость 4-7 лет при cash-cost $700-900/oz Au и
                spot цене Au $1900-2400/oz (2024-2026). Главные статьи —
                grinding (23%) + TSF (10%) + leach tanks (8%) + heap leach (5%).
                ICMC + GISTM + СН РК 4.04-14.
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Управление цианидом</h2>
          <p className="text-slate-300">
            ЗИФ работает с NaCN 0.3-0.5 г/л в пульпе. Что обязательно по ICMC
            International Cyanide Management Code 2020 + ISO 14001?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Никакого специального контроля — обычная химия" },
              { v: "b", t: "Только ежеквартальный пробоотбор воды на CN" },
              { v: "c", t: "Полный комплекс по ICMC 2020 + ICMI 9 principles + 28 standards: 1) Transportation — NaCN покупается в briquette form (твёрдые гранулы 25 кг bag) от ICMC-certified suppliers (Cyanco, AGR Matthey, Orica), транспорт TIR carnet + ADR/RID Class 6.1 + escort, никогда не водные растворы по дорогам; 2) Storage — silos 2×500 т (или 200-т tanks для растворов) с спец. ограждением + спринклер сухой (вода + CN дают HCN-газ → opposite!), positive-pressure HVAC, alarm CN-detection Drager polytron; 3) Operation — automatic dosing на основе pulp flow + Au grade, NaCN concentration measured 24/7 по UV-VIS spectrophotometer Hach или ISE-electrode, target 0.3-0.5 г/л; 4) pH control — CaO lime continuous dosing для pH ≥10.5 (при pH <8 NaCN ⇌ HCN газообразный летучий, LC50=110 ppm = смертельная доза); 5) Personal monitoring — все операторы носят electronic HCN-monitor Drager X-am 5000 personal, alarm при 4.7 ppm 8-h TWA, evacuation при 10 ppm; 6) Cyanide destruction — Inco SO2/air process на хвостах перед TSF, target residual CN <50 ppm WAD (Weak Acid Dissociable); WAD-CN — наиболее опасная форма, регулируется ICMC; 7) Tailings TSF — двойной HDPE 2 мм liner + leak detection sublining + monitoring wells 50-100 piezometers + emergency overflow spillway capacity 1-in-100 year storm; 8) Emergency response — Spill Kit (lime + sulfide solution для neutralisation) + сирена + evacuation route + договор с ближайшей больницей о hydroxocobalamin antidote; 9) Training — annual cyanide awareness training для всех операторов + 40-часовой курс для cyanide handlers + simulation drills 2 раза/год; 10) Certification — ICMC certification gold-standard, independent audit каждые 3 года (PR Engineering, NDP Consulting), public reports на icmc.org; ICMC 2020 + ISO 14001 + GISTM 2020 + EU Best Available Techniques + Equator Principles + WHO Toxicological Profile HCN" },
              { v: "d", t: "Только аварийный план без рутинного мониторинга" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex4, o.v, correct.ex4)}`}>
                <input type="radio" name="ex4" value={o.v} checked={ex4 === o.v} onChange={() => setEx4(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <button
          onClick={() => setShowResults(true)}
          className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-lg font-semibold transition"
        >
          Проверить ответы
        </button>

        {showResults && (
          <section className={`p-6 rounded-xl border-2 ${score === 4 ? "border-emerald-500 bg-emerald-500/10" : score >= 2 ? "border-amber-500 bg-amber-500/10" : "border-rose-500 bg-rose-500/10"}`}>
            <h2 className="text-2xl font-bold text-slate-50">Результат: {score} / 4</h2>
            <p className="mt-2 text-slate-300">
              {score === 4 && "Отлично! Ты владеешь золотодобычей и ICMC."}
              {score === 3 && "Хорошо. Перечитай ICMC 9 Principles + GISTM 2020."}
              {score === 2 && "Уровень C — пересмотри СН РК 4.04-14 + EU BAT NF Metals."}
              {score <= 1 && "Нужно повторить. См. World Gold Council + LBMA Good Delivery."}
            </p>
          </section>
        )}

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-cyan-300">Нормативная база</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li><strong>ICMC International Cyanide Management Code 2020</strong> — 9 principles + 28 standards (gold mining cyanide handling)</li>
            <li><strong>GISTM 2020</strong> — Global Industry Standard on Tailings Management (ICMM + UN PRI + UNEP)</li>
            <li><strong>EU BAT Reference Non-Ferrous Metals (NFM BREF) 2017</strong> — for hydrometallurgy / leaching</li>
            <li><strong>ISO 14001</strong> — Environmental Management Systems</li>
            <li><strong>ISO 45001</strong> — Occupational Health and Safety</li>
            <li><strong>WHO Toxicological Profile HCN</strong> — Hydrogen Cyanide health risk assessment</li>
            <li><strong>СН РК 4.04-14</strong> — Обогатительные фабрики цветной металлургии</li>
            <li><strong>ПП РК №201 от 2014</strong> — добыча твёрдых полезных ископаемых</li>
            <li><strong>Закон РК «О недрах и недропользовании»</strong> — № 125-VI от 27.12.2017</li>
            <li><strong>LBMA Good Delivery Rules</strong> — for refined gold/silver bars</li>
            <li><strong>JORC Code 2012</strong> — Australasian Joint Ore Reserves Committee (mineral resource reporting)</li>
            <li><strong>NI 43-101</strong> — Canadian Standards for Mineral Disclosure</li>
            <li><strong>Equator Principles</strong> — финансовые принципы для крупных проектов</li>
            <li><strong>IFC Performance Standards</strong> — World Bank IFC ESG framework</li>
            <li><strong>Anglo American / Newmont / Barrick BAT</strong> — внутренние стандарты компаний</li>
            <li><strong>ADR/RID Class 6.1</strong> — транспорт опасных грузов (NaCN)</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
