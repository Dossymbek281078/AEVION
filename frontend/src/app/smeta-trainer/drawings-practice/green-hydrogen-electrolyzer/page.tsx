"use client";
import Link from "next/link";
import { useState } from "react";

export default function GreenHydrogenElectrolyzerPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 110_000_000) <= 11_000_000;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 25_000_000_000_000) <= 2_500_000_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Зелёный водород — PEM электролиз</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">💧 Зелёный водород — PEM/AEL электролиз</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #285. Hyrasia One — проект Svevind / KAZ Hydrogen на
            территории РК Мангистау, anonsed 2022: 20 ГВт PV + ветро-генерация
            → 2 млн т H2/год через PEM electrolyzer (~$50B USD capex, 2030).
            Электролиз воды H2O → H2 + ½O2 в реактивной ячейке: PEM (Proton
            Exchange Membrane) Siemens Silyzer 300 17.5 МВт modules, ITM Power
            Trident, Cummins HyLYZER-1000; альтернативы — AEL (Alkaline) Nel
            или SOEC (Solid Oxide) Topsoe. Удельный расход 50-55 кВт·ч/кг H2
            (PEM) или 48-52 кВт·ч/кг (AEL). Hydrogen Carrier — пайплайн H2
            (опц. Yamburg-style) или NH3 ammonia carrier через Haber-Bosch
            (3H2 + N2 → 2NH3) для дальней транспортировки. IRENA Hydrogen
            Roadmap 2050 + EU Hydrogen Strategy 2020 + СН РК 4.04-09.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав водородного комплекса 1 ГВт</h2>
          <p className="text-slate-300 leading-relaxed">
            IRENA Hydrogen Roadmap + EU Hydrogen Strategy + IEC 60079 (взрыв.) + ASME B31.12 (трубопроводы H2):
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Возобновляемая энергетика на входе:</strong> 1.4-1.6 ГВт PV (~3500 га монокристаллов JinkoSolar Tiger Neo 600 Вт + bifacial), 0.5-1.0 ГВт ветро (~80-150 турбин Vestas V162-6.2MW башни 140 м) → суммарно 2.0-2.5 ГВт пиковая → capacity factor 35-45% даёт 1 ГВт средняя на electrolyzer.</li>
            <li><strong>Распределительная подстанция HV:</strong> 220-500 кВ от PV + ветер → step-down 33/0.4 кВ для electrolyzer; transformer 2×800 МВА, ВАБТ (HVDC link опц. для дальней передачи).</li>
            <li><strong>Электролизный корпус:</strong> PEM modules Siemens Silyzer 300 × 60 шт (17.5 МВт каждый = 1050 МВт) или ITM Power Trident 5 МВт × 200 шт, размер модуля 12×3×4 м, weight 30-50 т, container-mounted.</li>
            <li><strong>PEM stack:</strong> bipolar plates Ti (titanium) + Pt-catalyst membrane Nafion DuPont (3M variant), удельный расход Pt 0.5 мг/см² катод + 1.5 мг/см² анод (Ir-Ru-oxide) — дорогостоящие материалы (Pt $30/г, Ir $200/г).</li>
            <li><strong>Деминерализованная вода (Water treatment):</strong> RO-system (Reverse Osmosis) Suez Veolia 200 м³/ч + EDI (Electrodeionization) → удельный расход 9-10 л DI-воды/кг H2 (теоретический 9 л + расход на охлаждение); общий годовой 18 млн м³ для 2 млн т H2.</li>
            <li><strong>O2 byproduct:</strong> 8 кг O2/кг H2 (стехиометрия), часть выбрасывается в атмосферу или продаётся (medical-grade O2 99.5%, $200-300/т для больниц).</li>
            <li><strong>H2 storage:</strong> compressed gas tanks 350-700 бар (Hexagon Composites Type IV или сталь Type I), объём 100 000-500 000 м³ (для 7 сут buffer); альт. — liquid H2 cryogenic при -253 °C (Linde process).</li>
            <li><strong>Haber-Bosch NH3 synthesis (опц. для carrier):</strong> N2 from ASU (Air Separation Unit cryogenic Linde) + H2 from electrolyzer → синтез N2 + 3H2 ⇌ 2NH3 при 450 °C × 200 бар (Fe-catalyst), output 1 млн т NH3/год от 2 млн т H2; NH3 carrier позволяет shipping 17.6 кг H2/100 кг NH3.</li>
            <li><strong>Pipeline H2:</strong> внутренний trunk pipeline Ø32-48 inch X70 sour service для H2 (ASME B31.12), длина 100-2000 км (на экспорт до Прикаспийского региона); compressor stations каждые 100-200 км.</li>
            <li><strong>Safety:</strong> H2 detection sensors Drager Polytron 8200 каждые 10-15 м (LEL 4%, alarm 25% LEL = 1%), purge nitrogen N2 systems перед maintenance, флаги вентиляции на крышах модулей (H2 легче воздуха — поднимается вверх).</li>
            <li><strong>Cooling water:</strong> closed-loop с cooling tower 200-300 МВт термальной нагрузки (electrolyzer ηLHV = 60-72%, остальное — тепло), drift loss {"<"}0.01%.</li>
            <li><strong>SCADA + DCS:</strong> Honeywell Experion / Siemens PCS7, real-time control 10 000+ tag points, dispatch optimisation для variable renewable input.</li>
            <li><strong>Балансирующая система:</strong> грид-connected с КЕГОК + battery storage BESS 200-500 МВт·ч (Tesla Megapack) для frequency regulation и smooth ramp electrolyzer (PEM может ramp 0-100% за минуты, AEL — за 30-60 мин).</li>
            <li><strong>Адм. блок + control room 24/7:</strong> 500-1000 рабочих 4-сменка, центральный диспетч., охрана периметра 30 км забор + CCTV-IP.</li>
            <li><strong>Сертификация:</strong> CertifHy Green H2 EU (по carbon intensity ≤3 кг CO2eq/кг H2, vs grey H2 from SMR ~9 кг CO2/кг), TÜV SÜD H2 certification, EBRD ESIA.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — PEM vs AEL vs SOEC</h2>
          <p className="text-slate-300">
            Hyrasia One 1 ГВт electrolyzer на variable renewable input PV+ветер.
            Какая технология по IRENA Hydrogen Roadmap + DOE H2 Production?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "AEL Alkaline McPhy с KOH 30% — старая, ramp 30 мин — не для variable renewable" },
              { v: "b", t: "SOEC Solid Oxide Topsoe — высокий η 80% но требует +700 °C steam (только для nuclear)" },
              { v: "c", t: "Электролиз HCl без воды для очистки от хлора" },
              { v: "d", t: "PEM (Proton Exchange Membrane) Siemens Silyzer 300 17.5 МВт modules — оптимально для variable renewable + future-proof по IRENA Hydrogen Roadmap 2050: 1) Membrane Nafion DuPont 3M (perfluorosulfonic acid polymer) 175 мкм, проводник H⁺ proton; катод — Pt 0.5 мг/см² nanoparticles на carbon support; анод — Ir-Ru oxide 1.5 мг/см² (для O2 evolution reaction OER); 2) Operating conditions — T=70-90 °C, P=30-50 бар (output H2 высокое давление прямо из cell, без external compressor), current density 1.5-2.5 А/см² (vs AEL 0.4-0.6 А/см²); 3) Ramp response 0-100% за 1-2 минуты (vs AEL 30-60 мин, SOEC часы) — идеально для variable renewable input PV/wind с интермиттенцией; 4) Удельный расход 50-55 кВт·ч/кг H2 (HHV = 142 МДж/кг = 39.4 кВт·ч/кг → η = 70-72% LHV); 5) Module size 17.5 МВт each Silyzer 300 (output 350 кг H2/час), 60 модулей × 17.5 МВт = 1050 МВт plant; 6) Output H2 — purity 99.99% после dryer + deoxidiser, pressure 30 бар без external compression; 7) Платина-стоимость — 0.5 мг/см² × 50 м²/МВт = 25 г Pt/МВт × $30/г = $750/МВт (на материалы — не критично, но Ir расход больше); 8) AEL alternative Nel Hydrogen — дешевле capex ($600-800/кВт vs PEM $1000-1500/кВт) но ramp slower и output 1-30 бар требует external compressor; 9) SOEC alternative Topsoe — η 80% LHV (theoretically) но требует heat source 700-850 °C steam (для электролиза при высокой T) — подходит для combined nuclear/H2 или industrial heat; 10) Hybrid trend — PEM для daily/hourly ramp + AEL для baseload, mixed по 60/40 для optimal capex/opex; IRENA Hydrogen Roadmap 2050 + DOE H2 Production Pathways + IEC 62282 + ISO 22734" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Расход DI-воды</h2>
          <p className="text-slate-300">
            Hyrasia One выпуск 2 млн т H2/год. Стехиометрический расход воды
            H2O → H2 + ½O2 ⇒ 9 кг H2O/кг H2. + 1 кг H2O/кг H2 на охлаждение
            и потери. Итого 10 л DI-воды/кг H2. Сколько м³ воды/год нужно
            для RO-системы Suez Veolia (округл. до млн м³)?
          </p>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="м³/год"
            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:border-blue-500 focus:outline-none"
          />
          {showResults && (
            <div className={`p-4 rounded-lg ${correct.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}>
              <p className="text-slate-200">
                <strong>Ответ:</strong> 2 000 000 т × 10 л/кг = 20 000 000 000 л
                = <strong>20 млн м³/год DI-воды</strong>. С учётом потерь
                на RO-recovery 70-75% (концентрат сбрасывается) → ~28 млн м³
                сырой воды/год = 90 000 м³/сут. Для Мангистау это полугодовой
                расход г. Актау, поэтому Hyrasia One планирует использовать
                Каспийскую воду через desalination (Doosan / Hyflux MED-MSF),
                делая проект на самом деле «синим» H2 (нужна спецификация
                desalination energy). IRENA + EU Hydrogen Strategy. (Корр.: 110 млн)
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс Hyrasia One</h2>
          <p className="text-slate-300">
            Hyrasia One на полную мощность 20 ГВт PV+ветер + 10 ГВт electrolyzer +
            2 млн т H2/год + NH3 export terminal:
          </p>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>PV-станция 14 ГВт JinkoSolar Tiger Neo 600 Вт (35 000 га монокристаллов) = 7 000 млрд тг ($14B)</li>
            <li>Ветропарк 6 ГВт Vestas V162-6.2MW (1000 турбин башни 140 м) = 4 500 млрд тг ($9B)</li>
            <li>HV-инфраструктура 500 кВ — collector сеть 200 км + 4 substation 800 МВА + UHV-DC link 1500 км = 1 800 млрд тг</li>
            <li>Electrolyzer — PEM Siemens Silyzer 300 × 600 шт × 17.5 МВт = 10 500 МВт capacity, под ключ $1200/кВт = 6 300 млрд тг ($12.6B)</li>
            <li>RO desalination Suez Veolia 100 000 м³/сут (для воды Каспия) + DI-EDI = 380 млрд тг</li>
            <li>Compression + storage compressed H2 350-700 бар tanks 500 000 м³ объём = 250 млрд тг</li>
            <li>Haber-Bosch NH3 plant 1 млн т NH3/год (Thyssenkrupp Uhde Casale) + ASU Linde N2 production = 950 млрд тг ($1.9B)</li>
            <li>NH3 storage cryogenic -33 °C × 4 sphere tanks 80 000 т каждая + jetty NH3-export = 280 млрд тг</li>
            <li>H2/NH3 pipeline на экспорт 200 км Ø32 inch X70 sour service = 850 млрд тг</li>
            <li>Безопасность — H2 detection Drager + N2 purge + sprinkler ESFR + противопожар. инфраструктура = 180 млрд тг</li>
            <li>BESS 500 МВт·ч Tesla Megapack для frequency regulation = 145 млрд тг</li>
            <li>Cooling tower 3000 МВт термальной нагрузки замкнутый цикл + насосы Sulzer = 220 млрд тг</li>
            <li>Дороги + ЛЭП + ж/д подъезды + промплощадка благоустройство (50 000 га) = 380 млрд тг</li>
            <li>Жильё для строителей 50 000 рабочих × 4 года + соц.-инфраструктура = 250 млрд тг</li>
            <li>SCADA + DCS Honeywell + IT + дата-центр + connectivity = 60 млрд тг</li>
            <li>ESIA EBRD + IFC Performance Standards + EBRD financing fees + сертификация TÜV SÜD CertifHy = 280 млрд тг</li>
            <li>Проектирование (4% бюджета) + ПИР + НР + СП + PNR + страхование стр.-монт. (2% от capex × 4 года) + interest during construction = 1 100 млрд тг</li>
          </ul>
          <p className="text-slate-300">Итого capex (тг, округл. до трлн):</p>
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
                <strong>Ответ:</strong> ~25 трлн тг (~$50B USD) — анонсированная
                Svevind стоимость Hyrasia One на полную мощность 20 ГВт PV+ветер
                + 10 ГВт electrolyzer. Это самый дорогой green H2 проект в мире
                (для сравнения NEOM SAUDI ~$8.4B на 1 ГВт). Удельная — $5000/кВт
                H2 capacity (электролиз ~$1200/кВт, но с RES + infra + NH3 на это
                выходит). LCOH (Levelised Cost of Hydrogen) на этом проекте ~$3-4/кг
                к 2030, vs grey H2 $1.5-2/кг. IRENA + EU Hydrogen Strategy + EBRD.
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Hydrogen safety</h2>
          <p className="text-slate-300">
            H2 является взрывоопасным газом (Range 4-75% в воздухе, AIT
            500 °C). Что обязательно по IEC 60079 + ASME B31.12 + NFPA 2?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "H2 безопаснее природного газа — никаких особых мер" },
              { v: "b", t: "Только обычные газовые детекторы как для метана" },
              { v: "c", t: "Полный комплекс H2 safety по IEC 60079 ATEX Zone 1/2 + NFPA 2 + ASME B31.12: 1) Hazardous area classification — все зоны где H2 может скапливаться классифицируются по IEC 60079 как Zone 0 (постоянно взрывоопасно — внутри tanks), Zone 1 (возможно — около flange + valve), Zone 2 (маловероятно — в general area); все электрооборудование Ex-rated Eex d IIC T1 (для group IIC H2-acetylene); 2) H2 detection — Drager Polytron 8200 sensor каждые 10-15 м в zoned area, LEL 4% (lower explosive limit), alarm 1% LEL (= 0.04% vol H2), shutdown 25% LEL; sensor type — catalytic (для concentration check), thermal conductivity (для high range), electrochemical (для low ppm); 3) Ventilation — закрытые помещения с electrolyzer должны иметь принудительную вентиляцию ≥ 6 air-changes/hr с outlet на крыше (H2 легче воздуха, M=2 г/моль vs воздух M=29 г/моль — поднимается вверх со скоростью 20 м/с); 4) Material compatibility — H2 embrittlement проблема для high-strength steels (X80 OK, но X100 нет), recommended 316L stainless steel, Inconel 625, Hastelloy C-276; ASME B31.12 для трубопроводов; 5) Pressure relief PSV (Pressure Safety Valves) Crosby JOS-E + rupture disk Fike + flare boom для аварийной разгрузки в открытое пламя на 30-50 м H высоте; 6) Purge nitrogen N2 system перед maintenance — все vessel/pipe purged 5 × volumes N2 до O2 <0.5% (предотвращает explosive mix); 7) Static electricity — все pipe + tank grounded резистор <10 Ом, рабочие в antistatic shoes ESD, нет polyester clothing (only cotton/Nomex), conductive flooring; 8) Fire protection — sprinkler ESFR + foam Hi-Ex для жидкого H2, но H2-fire почти невидимый (UV blue + IR) → flame detector Det-Tronics X3301 dual UV-IR; 9) Emergency Response — Spill Response Plan, evacuation distance 100-200 м, SCBA Drager PSS-7000 у oncall команды, договор с пожарной частью; 10) Training — annual H2 awareness + hot work permit + confined space entry training + drill 4 раза/год; IEC 60079-0/-10/-14 + NFPA 2 (Hydrogen Technologies Code) + ASME B31.12 + ISO 19880 + DOE Hydrogen Safety Best Practices" },
              { v: "d", t: "H2 в принципе не горит — это инертный газ" },
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
              {score === 4 && "Отлично! Ты владеешь green H2 + PEM electrolysis."}
              {score === 3 && "Хорошо. Перечитай IRENA Hydrogen Roadmap + NFPA 2."}
              {score === 2 && "Уровень C — пересмотри IEC 60079 + ASME B31.12."}
              {score <= 1 && "Нужно повторить. См. DOE H2 Production + IEA Energy Outlook."}
            </p>
          </section>
        )}

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-cyan-300">Нормативная база</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li><strong>IRENA Hydrogen Roadmap 2050</strong> — International Renewable Energy Agency</li>
            <li><strong>EU Hydrogen Strategy 2020</strong> — European Commission COM(2020) 301</li>
            <li><strong>EU REPowerEU Plan 2022</strong> — 10 млн т green H2 + 10 млн т import к 2030</li>
            <li><strong>DOE Hydrogen Program Plan 2020</strong> — US Department of Energy</li>
            <li><strong>IEA Hydrogen Outlook 2023</strong> — Net Zero Scenarios</li>
            <li><strong>ISO 22734</strong> — Hydrogen generators using water electrolysis</li>
            <li><strong>ISO 19880-1/-3/-8</strong> — Gaseous hydrogen — Fuelling stations</li>
            <li><strong>IEC 62282</strong> — Fuel cell technologies</li>
            <li><strong>IEC 60079-0/-10/-14</strong> — Explosive atmospheres (Ex-rated electrical)</li>
            <li><strong>NFPA 2</strong> — Hydrogen Technologies Code (USA)</li>
            <li><strong>ASME B31.12</strong> — Hydrogen Piping and Pipelines</li>
            <li><strong>ASME B31.3</strong> — Process Piping</li>
            <li><strong>CertifHy EU</strong> — Green/Low-Carbon H2 certification scheme</li>
            <li><strong>TÜV SÜD Hydrogen Certification</strong> — Industry leader 3rd party</li>
            <li><strong>СН РК 4.04-09</strong> — Газораспределительные системы (применимо к H2 пайплайнам)</li>
            <li><strong>ПУЭ-7 Гл. 7</strong> — Электроустановки во взрывоопасных зонах</li>
            <li><strong>Equator Principles + IFC PS6</strong> — финансовые ESG-стандарты</li>
            <li><strong>EBRD ESIA</strong> — Environmental and Social Impact Assessment</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
