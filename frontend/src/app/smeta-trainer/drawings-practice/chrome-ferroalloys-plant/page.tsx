"use client";
import Link from "next/link";
import { useState } from "react";

export default function ChromeFerroalloysPlantPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 4_400) <= 440;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 420_000_000_000) <= 42_000_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Феррохром и ферросплавы</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">⚙️ Феррохром — ферросплавный завод</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #284. Аксуский ферросплавный завод (АксЗФ ERG/ENRC, г. Аксу
            Павлодарская обл., 1 500 тыс. т FeCr/год — крупнейший в мире
            производитель high-carbon ferrochrome), Актюбинский ФЗ (АктФЗ ERG,
            850 тыс. т FeCr/год), Темиртау Кармет (низкоуглеродистый FeCr).
            РК — мировой лидер по запасам хромитов (Кемпирсайский массив
            300 млн т высокосортной руды Cr2O3 50-52%). Технология — DC SAF
            (Submerged Arc Furnace) 60-72 МВА Outotec / Tenova Pyromet,
            восстановление Cr2O3 коксом C → Cr + CO + энергия. Продукт —
            high-carbon FeCr 62-68% Cr (chr-grade FeCrCG) для нержавеющей
            стали (316L Inox), charge-chrome 50-55% Cr для углерод. стали.
            EU IED BAT NFM + ICDA Code (Cr Toxicity) + СН РК 4.04-15.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав ферросплавного завода (ФСЗ)</h2>
          <p className="text-slate-300 leading-relaxed">
            EU IED BAT Reference NFM 2017 + ICDA Chromium Toxicity Code + СН РК 4.04-15:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Plavilny korpus (Melt shop):</strong> 4-8 SAF (Submerged Arc Furnace) ёмкостью 60-72 МВА каждая, диаметр ванны Ø13-15 м, height 8-10 м, мощность 18-22 МВт/электрод × 3 электрода (3-фазная сеть Y-connected); годовой выпуск 100-150 тыс. т FeCr/SAF.</li>
            <li><strong>Электроды Сёдерберг (Soderberg):</strong> непрерывный самообжигающийся электрод Ø1.6-2.0 м, паста — graphite + binder (anthracite + pitch), масса пасты 3.5-4.5 кг/т FeCr, slipping rate 0.5-1.0 мм/мин (электрод опускается по мере расхода).</li>
            <li><strong>Шихта (charge mix):</strong> Cr2O3 руды Кемпирсайские concentrate (52% Cr2O3), коксовая мелочь (Карагандинский кокс 88% C), известняк CaO + кварцит SiO2 для шлакообразующих (CaO/SiO2 = 1.0-1.5), агломерация briquetting перед загрузкой.</li>
            <li><strong>Загрузка шихты:</strong> charge bins 8-12 шт × 100-200 т над SAF, conveyor + chute drop через roof, automated weighing Mettler-Toledo + recipe-control.</li>
            <li><strong>Шлаковый и металлический выпуск:</strong> taphole 2-3 шт на SAF, выпуск каждые 2-3 ч (период), металл tap температурой 1650-1700 °C → ladle 50-60 т → casting на slab beds или granulation; шлак 1500-1550 °C → slag pots или granulation для cement.</li>
            <li><strong>Кокс газоочистки (Off-gas treatment):</strong> hood с water-cooled gas duct → settler (cyclone) → bag house Outotec/FLSmidth (фильтры PTFE membrane Donaldson, эффект. 99.9%) → CO-rich gas (~50% CO энергии) → recovery в энерго-блоке или flare.</li>
            <li><strong>Co-generation (recovery):</strong> CO-газ из SAF 50% CO (т.е. 2.0-2.5 МВт тепловой энергии/МВА SAF) → котёл-утилизатор + газовая турбина 30-50 МВт electrical → собственная ТЭС возвращает 20-25% затраченной energy.</li>
            <li><strong>Кокс-цех / агломерация:</strong> sintering plant Outotec circular belt sinter Ø22 м (производство sinter из Cr-руды fines) или briquetting press 800 т, выпуск 5-10 мм гранул для SAF.</li>
            <li><strong>Цех слитков и упаковка:</strong> finished FeCr — crushing 10-300 мм + screening + magnetic separation + sampling + packaging в Big Bags 1-2 т, отгрузка ж/д Х-вагоны на экспорт CN/EU/JP (90% продукции экспортируется).</li>
            <li><strong>Газо-, водоочистка:</strong> wet scrubber для SO2 (для S-rich кокса) + dust collector recycle pyrgenic pellet, water recycle 95% closed-loop.</li>
            <li><strong>Cr6+ control:</strong> NEW BAT-IED — гексавалентный хром Cr(VI) — канцероген IARC group 1, контроль в воде ≤50 мкг/л + воздухе ≤0.5 мкг/м³ (OSHA PEL), redox treatment Fe²⁺ восстанавливает до Cr³⁺ (безопасный).</li>
            <li><strong>Хранение хромита:</strong> 100 000-300 000 т concentrate в крытых складах (ил pile prevention windborne dust), conveyor + agitated charge.</li>
            <li><strong>ТП + DC выпрямители:</strong> ТЭС или ЛЭП 500 кВ от КЕГОК → ТП 500/35 кВ × 800 МВА → выпрямители Siemens SVC 50-72 МВА × SAF + transformer step-down для arc voltage 120-200 В × ток 60-80 кА.</li>
            <li><strong>Laboratory + QA:</strong> ICP-OES Spectroport + XRF Thermo ARL + spark spectrometer + sieving (Endecott), QA по EN 10204 3.1 + ASTM A101.</li>
            <li><strong>Адм. блок:</strong> 3000-5000 рабочих 4-сменка, столовая, медпункт (chrome-poisoning prevention), training centre.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — SAF technology choice</h2>
          <p className="text-slate-300">
            АксЗФ строит новую очередь FeCr 350 тыс. т/год. Какая технология
            по EU IED BAT NFM 2017 + Outotec/Tenova best practice?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Mini-furnace 5 МВА — несколько штук, дешевле" },
              { v: "b", t: "Доменная печь (как ДП-9 в Карметкомбинате) — для FeCr" },
              { v: "c", t: "Электролиз водных растворов (как для Al) — без кокса" },
              { v: "d", t: "Closed-roof DC SAF (Submerged Arc Furnace) 60-72 МВА с Soderberg-электродами + sinter feed + off-gas recovery по EU IED BAT NFM: 1) SAF design Outotec / Tenova Pyromet — closed-roof ванна Ø13-15 м H=8-10 м с водоохлаждаемой sided panels + magnesia-graphite refractory bottom 800-1000 мм; 2) 3 электрода Soderberg (self-baking) Ø1.6-2.0 м, расход пасты 3.5-4.5 кг/т FeCr, slipping 0.5-1.0 мм/мин (непрерывное опускание + добавление anthracite-pitch paste сверху); 3) Power 60-72 МВА на SAF, electrode current 60-80 кА × arc voltage 120-200 В = 18-22 МВт на электрод × 3 электрода; 4) Sinter feed — Cr-руда fines + coke + flux briquetted на Outotec sinter belt circular Ø22 м → sinter 5-10 мм → стабильный SAF feed (без агломерации pulverised dust в шихте); 5) Off-gas closed-roof — энергия в виде CO-rich gas 50% CO (lower heating value 7-9 МДж/Нм³, температура 700-900 °C) → котёл-утилизатор + газовая турбина Siemens SGT-600 30-50 МВт electrical (20-25% энергии возврат); 6) Dust collection — Donaldson bag house с PTFE membrane filter 99.9% efficiency, дust 80-100 г/Нм³ → <5 мг/Нм³ output, recycle обратно в sinter; 7) Tap practice — taphole 2-3 шт, выпуск каждые 2-3 ч × 30-40 т металла + 50-60 т шлака; slag granulation в water pit → cement additive (~ 5% SO3 ground); 8) Cr6+ prevention — closed roof prevents oxidation хром-fume в Cr(VI), reducing atmosphere в плавильной зоне (95% CO + 5% CO2), нет canopy losses; 9) Energy intensity — best practice 3.5-4.0 МВт·ч/т FeCr (vs 4.5-5.5 для устаревшего OPEN-arc furnace); 10) BAT-IED limits — dust <5 мг/Нм³, Cr(VI) <0.05 мг/Нм³, SO2 <300 мг/Нм³, NOx <500 мг/Нм³; closed-roof DC SAF — BAT (Best Available Technique) для FeCr; EU IED BAT NFM 2017 + ICDA Chromium Toxicity Code + ASTM A101 + EN 10204 3.1 + СН РК 4.04-15" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Расход электроэнергии</h2>
          <p className="text-slate-300">
            АксЗФ производит 1 500 тыс. т FeCr/год. Energy intensity современного
            closed-roof DC SAF (best practice) = 3.5-4.0 МВт·ч/т FeCr. Учти что
            завод возвращает 20% energy из CO-gas через cogeneration (gas turbine).
            Чистый годовой расход электроэнергии (ГВт·ч/год):
          </p>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="ГВт·ч/год"
            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:border-blue-500 focus:outline-none"
          />
          {showResults && (
            <div className={`p-4 rounded-lg ${correct.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}>
              <p className="text-slate-200">
                <strong>Ответ:</strong> 1 500 000 т × 3.75 МВт·ч/т = 5 625 000 МВт·ч
                = 5 625 ГВт·ч/год валовое потребление. Возврат 20% через
                cogeneration = 1 125 ГВт·ч. Чистый расход ≈ <strong>4 500 ГВт·ч/год</strong>.
                Это эквивалент полугодового потребления г. Караганды.
                АксЗФ запитан от собственной ТЭЦ ERG Аксу 800 МВт + ЛЭП 500 кВ
                от КЕГОК. EU IED BAT NFM + ICDA Code.
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс ФСЗ 350 тыс. т FeCr/год</h2>
          <p className="text-slate-300">
            Ферросплавный завод 350 тыс. т FeCr/год (1 SAF 72 МВА) «под ключ»:
          </p>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>Земляные + фундамент ж/б плита B40 (под SAF 5×5×3 м) + дороги + ж/д подъездные пути = 5.5 млрд тг</li>
            <li>SAF 72 МВА Outotec closed-roof Ø13 м H=10 м (под ключ pyrometallurgy) = 120 млрд тг</li>
            <li>Корпус plavki ВРС 25 м (50×80 м площадь) + крыша steel S355 = 14 млрд тг</li>
            <li>Электроды Soderberg Ø1.8 м × 3 + casings + slipping mechanism = 8 млрд тг</li>
            <li>Sinter plant Outotec belt circular Ø22 м (на оба завода = 220 тыс т fines/год) = 38 млрд тг</li>
            <li>Charge handling — bins 12×150 т + conveyor + weighing Mettler + chute drop = 9 млрд тг</li>
            <li>Off-gas treatment Donaldson bag house PTFE + CO-recovery duct + flare backup = 22 млрд тг</li>
            <li>Cogeneration Siemens SGT-600 gas turbine 35 МВт + HRSG + steam turbine 8 МВт = 28 млрд тг</li>
            <li>DC выпрямитель Siemens SVC 72 МВА + 500/35 кВ transformer 100 МВА + cable busbar = 35 млрд тг</li>
            <li>Tap floor — ladle 50 т × 4 + crane 100 т + casting beds + slag granulation pit = 8.5 млрд тг</li>
            <li>Crushing+screening+packaging line (готовый FeCr 10-300 мм + Big Bag 2 т) = 6.5 млрд тг</li>
            <li>Cr6+ wet scrubber + Fe(II) redox plant + water treatment closed-loop 95% recycle = 7.5 млрд тг</li>
            <li>Хранение Cr-руды 200 000 т под крышей + конвейер 800 м = 5.2 млрд тг</li>
            <li>ТП 35/6 кВ 100 МВА + ЛЭП 500 кВ tie-in (от Аксу ГРЭС или КЕГОК) = 12 млрд тг</li>
            <li>Лаборатория ICP-OES Spectroport + XRF Thermo ARL + sieving Endecott QA = 2.4 млрд тг</li>
            <li>SCADA + DCS Siemens PCS7 + control room + IT-инфраструктура = 4.2 млрд тг</li>
            <li>Адм. блок 3000 м² + столовая 600 чел + медпункт + training centre + школа = 12 млрд тг</li>
            <li>ESIA EBRD + ICDA compliance + EU IED BAT-AEL audit + строит. лицензия + проектирование 5% + ПИР + НР + СП + PNR + страхование = 84 млрд тг</li>
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
                <strong>Ответ:</strong> ~420 млрд тг (~$880M USD) на новую очередь
                FeCr 350 тыс. т/год greenfield. Удельная — $2500 / т capacity FeCr.
                Окупаемость 5-8 лет при cash-cost $700-900/т FeCr и
                LME-спот цене $1700-2200/т high-carbon FeCr (для нержавеющей
                стали в КНР/EU). Главные статьи — SAF (29%) + cogeneration (7%) +
                sinter plant (9%). EU IED BAT NFM + ICDA + AC ESPP.
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Cr6+ канцероген</h2>
          <p className="text-slate-300">
            На ФСЗ важна борьба с Cr6+ (хром-VI). Что обязательно по ICDA
            Chromium Toxicity Code + OSHA + EU IED BAT?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Никаких мер — Cr безопасен" },
              { v: "b", t: "Только обычная вентиляция и спецодежда" },
              { v: "c", t: "Полная программа Cr6+ control по ICDA + OSHA + IARC Group 1: 1) Source prevention — closed-roof SAF design предотвращает oxidation Cr⁰/Cr³⁺ в Cr⁶⁺ в hot gas + reducing atmosphere 95% CO в melt zone (Cr⁶⁺ образуется когда хром-fume контактирует с O2 при 600-1200 °C); 2) Workplace monitoring — personal samplers Casella + benchtop sampling NIOSH 7600 для air Cr⁶⁺ — limit OSHA PEL 5 мкг/м³ 8-h TWA, action level 2.5 мкг/м³, GOST 12.1.005 РК для production zones; 3) Wet scrubber на gas line — caustic NaOH 5% spray для absorption Cr⁶⁺-fume из off-gas → CrO4²⁻ ion в воду; 4) Wastewater treatment — Cr⁶⁺ reduction Fe²⁺ (sulphate of iron) + lime → Cr⁶⁺ + 3Fe²⁺ → Cr³⁺ + 3Fe³⁺ (нетоксичный) → settling + filtration → recovery as Cr(OH)3 hydroxide cake (нетоксичный landfill); 5) Solid waste — ферро-шлак содержит residual Cr³⁺ stable (не водорастворимый), но dust может содержать Cr⁶⁺ при oxidation на воздухе — collection в hermetic bins; 6) Medical surveillance — periodic exam рабочих SAF area: chest X-ray + lung function spirometry + blood Cr + urinary Cr⁶⁺ (биомаркер); годовой report медкомиссии; 7) Personal protective equipment PPE — half-face респиратор 3M 6200 с P100 filter + chemical-resistant suit Tychem F + face shield + lab coat; spec. wash station для одежды (не домой); 8) Training — annual Cr⁶⁺ awareness training + emergency response drill 2 раза/год + signage всех зон; 9) Regulatory — REACH SVHC entry CrO3 (chromium trioxide) — restricted в EU с 2017, требует authorisation для produces/imports; 10) BAT-IED limit — Cr⁶⁺ в выбросах <0.05 мг/Нм³, в сточных водах <50 мкг/л, обязательная отчётность КАЭН РК ежеквартально; ICDA Chromium Toxicity Code + OSHA 29 CFR 1910.1026 + IARC Monograph 49 + REACH Regulation EU 1907/2006 + EU IED BAT NFM + СН РК 4.04-15 + ГОСТ 12.1.005" },
              { v: "d", t: "Только годовой замер концентрации в воде" },
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
              {score === 4 && "Отлично! Ты владеешь pyrometallurgy + Cr6+ control."}
              {score === 3 && "Хорошо. Перечитай EU IED BAT NFM + ICDA Code."}
              {score === 2 && "Уровень C — пересмотри СН РК 4.04-15 + OSHA 29 CFR 1910.1026."}
              {score <= 1 && "Нужно повторить. См. ASTM A101 + EN 10204 + IARC Monograph 49."}
            </p>
          </section>
        )}

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-cyan-300">Нормативная база</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li><strong>EU IED BAT Reference NFM 2017</strong> — Best Available Techniques for Non-Ferrous Metals (включая FeCr / FeMn / FeSi)</li>
            <li><strong>EU IED Directive 2010/75/EU</strong> — Industrial Emissions Directive</li>
            <li><strong>ICDA Chromium Toxicity Code</strong> — International Chromium Development Association</li>
            <li><strong>OSHA 29 CFR 1910.1026</strong> — Hexavalent Chromium standard (USA)</li>
            <li><strong>IARC Monograph 49</strong> — Chromium and Chromium Compounds (Cr⁶⁺ = Group 1 carcinogen)</li>
            <li><strong>REACH Regulation EU 1907/2006</strong> — restricted SVHC CrO3 (chromium trioxide)</li>
            <li><strong>ISO 14001 / ISO 45001</strong> — Environmental + Occupational Health Management</li>
            <li><strong>ISO 14064</strong> — Greenhouse Gas Accounting (для углерод-emission FeCr ≈ 2.0 т CO2/т)</li>
            <li><strong>ASTM A101</strong> — Standard Specification for Ferrochrome</li>
            <li><strong>EN 10204 3.1</strong> — Inspection documents for metal products (Mill Certificate)</li>
            <li><strong>СН РК 4.04-15</strong> — Цветная металлургия (производственные здания)</li>
            <li><strong>ГОСТ 4757-91</strong> — Феррохром технические условия</li>
            <li><strong>ГОСТ 12.1.005-88</strong> — Общие санитарно-гигиенические требования воздуха рабочей зоны</li>
            <li><strong>ПУЭ-7</strong> — Электроустановки потребителей (для DC {">"}1 кВ электродов)</li>
            <li><strong>СНиП 2.04.05-91*</strong> — ОВК для металлургических цехов</li>
            <li><strong>ICMM Mining Principles</strong> — International Council on Mining and Metals</li>
            <li><strong>Equator Principles / IFC PS6</strong> — финансовые ESG-стандарты</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
