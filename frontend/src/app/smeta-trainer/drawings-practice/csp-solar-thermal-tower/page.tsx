"use client";
import Link from "next/link";
import { useState } from "react";

export default function CspSolarThermalTowerPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 8_000) <= 800;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 320_000_000_000) <= 32_000_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · CSP — концентрированная солнечная башня</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">☀️ CSP башенного типа (Concentrated Solar Tower)</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #287. Концентрированная солнечная энергетика CSP (Concentrated
            Solar Power) tower-type — отличается от PV (фотовольтаика) тем, что
            гелиостаты (двуосные зеркала) фокусируют солнечный свет на receiver
            на верху башни H=200-260 м, нагревая расплавленные соли (Solar Salt
            60% NaNO3 + 40% KNO3) до 565 °C; соль аккумулируется в hot tank
            10-15 ч, затем через парогенератор Rankine cycle вращает турбину
            Siemens SST-700 → 100-200 МВт electricity 24/7. Reference projects:
            Ivanpah USA 392 МВт (2014), Crescent Dunes Nevada 110 МВт (2015,
            10 ч storage), Noor Ouarzazate Morocco III 150 МВт, DEWA Phase IV
            UAE 700 МВт. РК план — Aksu CSP (Тюлькубас Жамбылская обл.) 100 МВт
            к 2030 (МЭ РК + Korean KEPCO). NREL CSP Best Practices + IEC 62862
            + IEC 62963 + СН РК 4.04-09.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав CSP башенного типа 100 МВт</h2>
          <p className="text-slate-300 leading-relaxed">
            NREL CSP Best Practices + IEC 62862-1 + Sandia CSP Reports + EU SolarPACES:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Heliostat field (поле гелиостатов):</strong> 6 000-10 000 двуосных зеркал (eSolar / Brightsource / Sener), каждое 6-10 м² apertura, общая зеркальная площадь 60 000-100 000 м²; распределение radial circular pattern вокруг tower с радиусом 600-1000 м; ground coverage 30-40%.</li>
            <li><strong>Heliostat:</strong> два sun-tracking motor (azimuth + elevation) с точностью ±0.6 мrad (= 4 угл. мин), зеркало low-iron float glass 4 мм + Ag silver back layer + protective Pb-Cu coating; коэф. отражения 92-94%; срок службы 25-30 лет.</li>
            <li><strong>Solar Tower (башня-приёмник):</strong> ж/б монолит. H=200-260 м (как Crescent Dunes Невада 195 м), диаметр в основании 30-40 м → top 15-20 м (Burj Khalifa-style taper), толщина стенки 1.0-1.5 м B45 W12.</li>
            <li><strong>Receiver (приёмник):</strong> внешний tubular receiver — cylinder Ø10-15 м H=15-25 м из nickel-based alloy Inconel 625 / Hastelloy X tubes Ø50 мм длиной 18 м, всего 5000-10 000 tubes; absorptivity 94% (black Pyromark 2500 ceramic paint), thermal flux peak 800-1000 кВт/м².</li>
            <li><strong>Solar Salt:</strong> 60% NaNO3 + 40% KNO3 binary mix, freezing point 220 °C (хранится always {">"}250 °C), max operating 565 °C (decomposes {">"}600 °C); thermal capacity 1.5 кДж/(кг·К), плотность 1899 кг/м³ при 300 °C; объём в системе 30 000-50 000 т.</li>
            <li><strong>Hot tank (горячий бак):</strong> Ø35-45 м H=15 м, толщина стенки 8-12 мм 316L stainless steel + ceramic fiber insulation 600 мм + внешняя металлокожух; температура 565 °C, объём 25 000-40 000 м³.</li>
            <li><strong>Cold tank (холодный бак):</strong> идентичный hot tank, температура 290 °C (после прохода через парогенератор) — выдерживает менее жёсткие условия.</li>
            <li><strong>Steam generator + Rankine cycle:</strong> кожухотрубный теплообменник Babcock & Wilcox / GEA молт. соль → пар 540 °C × 130 бар; турбина Siemens SST-700 одновальная reheat → конденсатор воздушный (air-cooled condenser ACC) для пустыни (вода в дефиците).</li>
            <li><strong>Thermal Energy Storage (TES):</strong> 8-15 hr storage (Crescent Dunes — 10 hr, Noor III — 7 hr); позволяет генерировать после захода солнца + dispatchable как conventional ТЭЦ; LCOE 30-40% выше PV но dispatchable.</li>
            <li><strong>Heat trace (heating tracing):</strong> все pipe + valve обогреваются до {">"}250 °C (предотвращает замерзание соли); electric heat trace Pyrotenax MI-cable или steam tracing; кризис на Crescent Dunes 2016 — потеря heat trace = замерзание salt в pipe = $200M repair.</li>
            <li><strong>Salt pumps:</strong> high-temperature vertical pumps Sulzer JTC / Flowserve HPX, сталь Sandvik Sanicro 28 или Hastelloy C-22, capacity 5000-10 000 м³/ч на pump.</li>
            <li><strong>Heliostat control system:</strong> SCADA c real-time sun tracker, BMI (Beam Misalignment Indicator) для контроля aiming точности, individual heliostat control каждые 1-2 секунды через wireless mesh ZigBee / LoRaWAN.</li>
            <li><strong>Cleaning system:</strong> robot-cleaners (Robotic Mirror Wash) каждые 2-4 недели; от dust = -1.5% reflectance/day в пустыне, total -30% эффективности без cleaning.</li>
            <li><strong>Air-cooled condenser ACC:</strong> 1000-2000 fans Ø10 м каждый, общая площадь heat exchange 50 000-100 000 м², COP 3-5 (vs water-cooled COP 6-8); экономит 90% воды vs conventional.</li>
            <li><strong>Step-up transformer + grid:</strong> 230 МВА YNd11 18/220 кВ + GIS Siemens 8DJH switchyard + ЛЭП 220 кВ до КЕГОК; 100 МВт plant ⇒ один трансформатор.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Технология CSP vs PV+BESS</h2>
          <p className="text-slate-300">
            РК планирует Aksu CSP 100 МВт + 8 ч TES. Какие преимущества CSP
            tower по NREL CSP Best Practices vs PV+BESS?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Никаких — PV+BESS всегда дешевле и эффективнее" },
              { v: "b", t: "Только эстетический — красивая башня выглядит" },
              { v: "c", t: "Только в Африке работает — РК слишком холодный" },
              { v: "d", t: "CSP с TES имеет 4 ключевых преимущества над PV+BESS по NREL + Sandia + DOE CSP Program: 1) Dispatchable energy 24/7 — TES (Thermal Energy Storage) 8-15 ч позволяет генерировать в peak hours (18-22:00) когда PV уже off и spot price максимальный $80-120/МВт·ч (vs PV+BESS round-trip 85-90% но BESS expensive >$300/кВт·ч); 2) Long-duration storage — соляное TES дешевле $30-40/кВт·ч·thermal (vs батареи $400-500/кВт·ч·electrical), идеально для 8-12 ч storage; деградация TES 0.5%/year (vs Li-ion BESS 3-5%/year); 3) Inertia + frequency support — CSP plant имеет synchronous generator с physical rotational inertia как conventional ТЭЦ → отлично поддерживает grid frequency 50 Гц (PV+BESS — это inverter-based, нет inertia, требует synthetic inertia controllers); 4) Hybrid potential — CSP можно гибридизировать с natural gas burner для backup (NREL Hybrid CSP), or coupling с green H2 production (high temperature electrolysis SOEC ~700 °C native для CSP steam); 5) Concentration ratio 600-1000× — позволяет нагрев до 565 °C (Solar Salt limit) или 1000 °C (high-T receiver с supercritical CO2 cycle) — недостижимо для PV; 6) Disadvantages — capex 2-3× выше PV+BESS ($3500-4500/кВт vs $1500-2000/кВт), needs DNI (Direct Normal Irradiance) >2200 кВт·ч/м²/год = только пустыни и polusen (Юг РК Кызылорда / Тюлькубас); 7) Water — air-cooled condenser ACC снижает воду 10× (Crescent Dunes 100 м³/МВт·ч vs water-cooled CSP 3000 м³/МВт·ч), но электрическая потеря ~5% efficiency; 8) Land — CSP 5-7 га/МВт (heliostat field + tower) vs PV 1.5-2 га/МВт; 9) LCOE — CSP с TES 8 ч ~$80-100/МВт·ч (2024), PV+BESS 4 ч ~$50-70/МВт·ч — но при 8 ч storage сравнимы; CSP конкурентен для dispatchable applications; 10) Climate change role — CSP+TES может стать «батареей пустыни» для baseload generation, EU REPowerEU предусматривает 30 ГВт CSP в Mediterranean к 2030; NREL CSP Best Practices + Sandia CSP Reports + IEC 62862 + EU SolarPACES + IRENA Solar Thermal Roadmap" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Площадь heliostat field</h2>
          <p className="text-slate-300">
            Aksu CSP 100 МВт, башня 200 м, DNI Тюлькубас 2200 кВт·ч/м²/год.
            Эффективность optical 60% (cosine + atmospheric + reflectivity) ×
            thermal 75% (receiver) × Rankine cycle 40% (соль→пар→эл-во) =
            overall 18%. Год работы 4500 ч (DNI-windows). Какова требуемая
            зеркальная площадь heliostats (м², округл. до тыс.)?
          </p>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="м²"
            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:border-blue-500 focus:outline-none"
          />
          {showResults && (
            <div className={`p-4 rounded-lg ${correct.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}>
              <p className="text-slate-200">
                <strong>Ответ:</strong> Pavg = 100 МВт × (4500/8760) ≈ 51 МВт средняя.
                E_year = P × t = 100 × 4500 = 450 000 МВт·ч/год = 450 ГВт·ч.
                E_solar_needed = E_year / 0.18 = 2500 ГВт·ч/год DNI-energy.
                A = E / DNI = 2 500 000 / 2200 ≈ 1 136 000 м² ⇒ это для PV pure.
                CSP-tower имеет concentration & пиковую мощность design point, поэтому
                реальная mirror area для CSP 100 МВт × 8 ч TES ≈ <strong>800 000 м²</strong>
                = 80 000 гелиостатов по 10 м² или 6-10 тыс по 80-100 м² (eSolar 14 м²,
                Brightsource 14 м²). NREL CSP + IEC 62862. (Округл. до 8 тыс ст.га = 8 000 ст.га)
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс Aksu CSP 100 МВт</h2>
          <p className="text-slate-300">
            Aksu CSP tower 100 МВт + 8 ч TES «под ключ»:
          </p>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>Земляные + дороги + промплощадка 600 га + дренаж = 3.5 млрд тг</li>
            <li>Heliostat field 800 000 м² (6 000 шт × 130 м² или 80 000 шт × 10 м²) + foundations + cabling = 95 млрд тг</li>
            <li>Solar Tower башня ж/б монолит H=200 м (B45 W12 объём 15 000 м³ + 1500 т арматура) = 22 млрд тг</li>
            <li>Receiver tubular Inconel 625 / Hastelloy X tubes 5000 шт + insulation + Pyromark coating = 38 млрд тг</li>
            <li>Solar Salt 30 000 т (NaNO3 + KNO3 60/40) + initial filling = 14 млрд тг</li>
            <li>Hot tank Ø40 м H=15 м 316L stainless + ceramic insulation 600 мм = 14 млрд тг</li>
            <li>Cold tank Ø40 м H=15 м (less stringent) = 9 млрд тг</li>
            <li>Salt pumps Sulzer JTC high-T × 6 шт (3+3 hot/cold) Sandvik Sanicro = 8 млрд тг</li>
            <li>Steam generator Babcock & Wilcox shell-and-tube 130 бар + 540 °C = 22 млрд тг</li>
            <li>Steam turbine Siemens SST-700 100 МВт reheat + condenser ACC = 38 млрд тг</li>
            <li>Air-cooled condenser ACC 1500 fans Ø10 м + heat exchanger 80 000 м² = 18 млрд тг</li>
            <li>Heat trace Pyrotenax MI-cable + steam tracing all pipes = 6.5 млрд тг</li>
            <li>Generator 100 МВА синхронный + AVR + step-up transformer 230 МВА 220/18 кВ = 9.5 млрд тг</li>
            <li>GIS switchyard 220 кВ Siemens 8DJH + ЛЭП 220 кВ 30 км до КЕГОК = 8 млрд тг</li>
            <li>SCADA + heliostat control wireless ZigBee + DCS + IT-инфраструктура = 12 млрд тг</li>
            <li>Robotic mirror wash система + storage tank воды + DI water = 5 млрд тг</li>
            <li>Подъездная дорога 25 км + ж/д подвоз turbine 200 т + special transport башни = 7 млрд тг</li>
            <li>Жилой блок 150 рабочих вахта + столовая + медпункт + спортзал = 5 млрд тг</li>
            <li>ESIA EBRD + IFC PS6 + CSP-сертификация + проектирование 5% + ПИР + НР + СП + PNR + страхование стр.-монт. + interest during construction = 35 млрд тг</li>
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
                <strong>Ответ:</strong> ~320 млрд тг (~$670M USD) на 100 МВт CSP-tower
                + 8 ч TES. Удельная — $6700 / кВт capacity (vs PV+BESS 8 ч
                $4000-5500 / кВт). Heliostat field — 30% бюджета. Окупаемость
                12-18 лет при LCOE ~$80-100/МВт·ч и dispatchable PPA с надбавкой
                за peak generation. NREL CSP Best Practices + Sandia CSP Reports.
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Solar Salt safety</h2>
          <p className="text-slate-300">
            Solar Salt 60% NaNO3 + 40% KNO3 — freezing 220 °C. Что критично
            предотвратить по Crescent Dunes lessons learned + NREL?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Salt безопасен — нет специальных мер" },
              { v: "b", t: "Только daily testing — раз в сутки" },
              { v: "c", t: "Salt freeze prevention + decomposition control + corrosion mitigation по NREL CSP Best Practices + Crescent Dunes RCA: 1) Salt Freeze Prevention — критично! Salt freezing point 220 °C, если pipe или tank остывают ниже — соль кристаллизуется → pipe rupture + repair $50-200M; решение: heat trace electric Pyrotenax MI-cable на ВСЕ pipes 24/7 (400 °C target temperature), steam tracing для critical sections, нет single point of failure (redundant power); 2) Crescent Dunes 2016 case — потеря heat trace на 8 ч → salt freeze в central receiver → restart cost $200M + 2 года downtime; lessons learned — N+1 redundancy on heat trace circuit + battery backup 4 ч; 3) Salt Decomposition — выше 600 °C соли разлагаются: 4NaNO3 → 4NaO + 4NO2 + 2O2 + N2 (toxic NO2 fume); решение — temperature interlock в receiver, automatic defocus гелиостаты при T>590 °C; 4) Corrosion — горячая соль corrosive для углеродистых сталей (>500 °C), требуется 316L stainless или 316L+TiN-coated для tank wall; pumps — high-T alloy Sandvik Sanicro 28 (austenitic) или Hastelloy C-22 (nickel-based); 5) Thermal cycling fatigue — pipe + tank + valve проходят 200-300 циклов нагрева-охлаждения в год (cycle 290↔565 °C), fatigue analysis по ASME Section VIII Div 2; expansion joints Witzenmann SP-EJM каждые 30-50 м pipe; 6) Insulation aging — ceramic fiber Calcium Silicate degrades >700 °C → loose insulation → heat loss + risk burn personnel; replacement каждые 7-10 лет; 7) Spill containment — salt at 565 °C is similar to molten lead — burns concrete + steel; secondary containment dike вокруг hot tank + drain to expansion pit + automatic dump valve при leak detection; 8) Personnel safety — proper PPE (heat-resistant gloves + Nomex suit + face shield), no permits unless temperature <100 °C, never approach hot piping без safety briefing; 9) Maintenance shutdown — annual planned outage 14-21 day для inspection + recoating + replace components, требует «cold start» 7 дней (gradual heating 5 °C/час чтобы избежать thermal shock); 10) Fire risk — NaNO3+KNO3 are oxidisers (Class 5.1), если контактируют с organic fuel → fire intensification; никаких лесов / mulch в зоне tank + sprinkler dry pipe (вода в контакте с salt 565 °C делает steam explosion!); NREL CSP Best Practices + Sandia CSP Reports + Crescent Dunes RCA 2016 + ASME Section VIII Div 2 + IEC 62862-3-2" },
              { v: "d", t: "Только при пуске и остановке" },
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
              {score === 4 && "Отлично! Ты знаешь CSP tower + TES."}
              {score === 3 && "Хорошо. Перечитай NREL CSP Best Practices + Sandia CSP."}
              {score === 2 && "Уровень C — пересмотри IEC 62862 + EU SolarPACES."}
              {score <= 1 && "Нужно повторить. См. Crescent Dunes RCA + ASME Section VIII Div 2."}
            </p>
          </section>
        )}

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-cyan-300">Нормативная база</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li><strong>NREL CSP Best Practices</strong> — National Renewable Energy Laboratory (USA)</li>
            <li><strong>Sandia National Laboratories CSP Reports</strong> — receiver + tower design</li>
            <li><strong>DOE CSP Program (Gen3)</strong> — high temperature 700 °C supercritical CO2 cycle</li>
            <li><strong>IEC 62862-1/-2/-3</strong> — Solar thermal electric plants — General requirements</li>
            <li><strong>IEC 62963</strong> — Solar thermal plants — Common terminology</li>
            <li><strong>EU SolarPACES Guidelines</strong> — IEA Implementing Agreement</li>
            <li><strong>ASME Section VIII Div 2</strong> — Pressure Vessels Alternative Rules (для hot/cold tanks)</li>
            <li><strong>ASME B31.1</strong> — Power Piping (для пара 540 °C)</li>
            <li><strong>IRENA Solar Thermal Roadmap</strong> — International Renewable Energy Agency</li>
            <li><strong>IEA SolarPACES Annual Report</strong> — Concentrating Solar Power 2024</li>
            <li><strong>СН РК 4.04-09</strong> — Электрические станции (применимо к CSP)</li>
            <li><strong>СНиП 2.02.01-83*</strong> — Основания зданий (для tower fundament)</li>
            <li><strong>IEEE 421 + IEEE 1547</strong> — Excitation + distributed resources interconnect</li>
            <li><strong>ENTSO-E Network Code</strong> — grid connection requirements</li>
            <li><strong>Equator Principles + IFC PS6</strong> — финансовые ESG-стандарты</li>
            <li><strong>EBRD ESIA</strong> — Environmental and Social Impact Assessment</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
