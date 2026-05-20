"use client";
import Link from "next/link";
import { useState } from "react";

export default function AluminumSmelterElectrolysisPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 13_500) <= 1_500;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 800_000_000_000) <= 80_000_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Алюминиевые электролизные заводы</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🔋 Алюминий — электролиз Hall-Héroult</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #282. Казахстанский электролизный завод KAP (Павлодарский
            ЭЗ ENRC/ERG, мощность 250 000 т/год Al первичного), сырьё — глинозём
            Al2O3 от Павлодарского АГК + Тургайского глинозёмного. Процесс
            Hall-Héroult с 1886 г: Al2O3 растворяется в расплавленном криолите
            Na3AlF6 при 950-980 °C, через расплав пропускают постоянный ток
            350-400 кА → катод (углерод) выделяет Al, анод (углерод) расходуется
            с выделением CO2. Энергопотребление 13.5 МВт·ч/т Al (лучшее мировое
            12.5 МВт·ч/т у Norsk Hydro Karmøy), удельный расход анодов
            420 кг C/т Al. EU IED BAT Reference для алюминия + ISO 14001 + СН РК 4.04-15.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав электролизного завода</h2>
          <p className="text-slate-300 leading-relaxed">
            EU IED BAT Reference Aluminium + ISO 14001 + Aluminium Stewardship Initiative ASI:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Электролизный корпус (potroom):</strong> 4-8 corpus-зданий длиной 1000-1200 м, ширина 30-35 м, ВРС 18-22 м, в каждом 200-300 электролизёров pre-baked anode типа AP-40 / AP-60 (Rio Tinto / Pechiney design) или Soderberg-устаревший.</li>
            <li><strong>Электролизёр (cell, pot):</strong> ванна-корпус сталь 8-12 мм + футеровка carbon-cathode 60-100 см толщ. + insulation refractory 30 см, размер 12×4×1 м, weight 50-80 т, ёмкость 8-12 т расплав. криолита.</li>
            <li><strong>Аноды (анодная масса):</strong> pre-baked anode block 1.5×0.7×0.6 м (1000 кг) — formed of petroleum coke + pitch binder, baked at 1200 °C в anode bake furnace; replaced каждые 25-28 сут.</li>
            <li><strong>Анодомассовый цех (Carbon Plant / Green Mill):</strong> производство «green anodes» — смесь нефтекокс (75%) + связующее каменноугольный pitch (15%) + recycled butt (10%), формование на vibroform 1200 т давление, weight 1100 кг.</li>
            <li><strong>Анодная обжиговая печь (Anode Bake Furnace):</strong> 2-3 печи cone-shaped, 50-80 sections × 24 цикла, режим 1200 °C × 14 сут × 56 анодов/section, газоочистка PFC + SO2.</li>
            <li><strong>Литейный цех (Casting House):</strong> печи отстаивания (settling furnace) 80-100 т ёмкость для AlSi5/AlMgZn сплавов + DC casters (Direct Chill) для слитков 7-12 т round/sheet ingots, или T-bar/slab.</li>
            <li><strong>Сухая газоочистка (Dry Scrubber FTP — Fluorine Treatment Plant):</strong> ALCAN dry scrubber или FLSmidth FFC, поглощение HF на свежем Al2O3 (поступающем как сырьё в электролизёр) → recovery эффективность 99.5% фтора.</li>
            <li><strong>Сухая газоочистка SO2 (опц.):</strong> для S-rich coke — Marubeni или Lurgi LP-FGD wet scrubber с известняком CaCO3 → CaSO4 (Gypsum byproduct).</li>
            <li><strong>Питание PFC (Perfluorocarbons) контроль:</strong> NEW BAT-RD анод-эффекты PFC (CF4, C2F6 — мощные парниковые газы GWP=6500-9200×CO2) — мониторинг 24/7 PFC sensor + automatic feed control.</li>
            <li><strong>Электропитание:</strong> ТЭЦ собственная 800-1200 МВт (для KAP — Аксу ГРЭС) → DC выпрямители Siemens SVC + transformers 800 МВА → busbar Al sheet, ток 400 кА × напряжение 4.0-4.5 В/cell × 200-300 cells = 1000-1300 В bus.</li>
            <li><strong>Рудный двор:</strong> хранение глинозёма Al2O3 100 000-200 000 т (под крышей silos 25-50 шт × 5000 т), pneumatic conveyor к potroom.</li>
            <li><strong>Литейные сплавы и продукция:</strong> primary Al ≥ 99.7% Al → ingot 22 кг, T-bar 1000-2000 кг, slab 7-12 т, billet (extrusion) Ø150-300 мм; secondary alloys (AlSi, AlMg, AlZn — для automotive).</li>
            <li><strong>Утилизация SPL (Spent Pot Lining):</strong> отработанная футеровка катода — содержит F + CN — обработка thermal destruction (Reynolds Process) или цементная инкапсуляция, ICCM Sustainable Industry.</li>
            <li><strong>Adm. блок + tester:</strong> метрологическая лаб ICP-OES Thermo + spark spectrometer Spectroport (анализ Al, Si, Fe, Cu), QA по AA1100/AA6061/EN 573-3.</li>
            <li><strong>Tankhouse pots в линейке (potline):</strong> 2-4 линии × 200-300 pots/линия, последовательное соединение (электрический series), общий ток 400 кА постоянный.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Электролизёр Hall-Héroult</h2>
          <p className="text-slate-300">
            Электролизный завод 250 000 т Al/год. Какая конструкция электролизёра
            по EU IED BAT Reference Aluminium + AP-40 design?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Soderberg cell с обжигом анода в самой ячейке — устаревший" },
              { v: "b", t: "Простой стальной куб без футеровки + графитовый анод сверху" },
              { v: "c", t: "Алюминиевая ванна с водяным охлаждением вместо стальной" },
              { v: "d", t: "Pre-baked anode point-feeder cell AP-40 / AP-60 (Rio Tinto / Pechiney) — текущий BAT по EU IED Reference: 1) Pot shell — стальная ванна 12 м × 4 м × 1 м, сталь S355 толщ. 8-12 мм с corrosion allowance, ребра жёсткости снаружи; weight pot empty 50-80 т, with electrolyte + Al = 130-160 т; 2) Cathode lining — углеродные блоки carbon-cathode (graphitised semi-graphitic) 60-100 см толщ. на дне pot, sealed with anthracite paste, connected к steel collector bar через cast iron; срок службы катода 4-6 лет; 3) Side lining — refractory insulating brick (Si-Mg-O alumina) 30 см толщ. на бортах pot, предотвращает теплопотери и contamination криолита; 4) Pre-baked anodes — 18-24 углеродные блока 1.5×0.7×0.6 м, masse каждый 1000-1200 кг, suspended на anode beam (mobile crane operation pot) с stub (стержень) Cu или Al, replacement через 25-28 сут; 5) Point feeders — 4-6 alumina hopper sensors с pneumatic conveyor, dosing Al2O3 каждые 60-90 секунд (concentration target 2-3% Al2O3 в криолите); 6) Anode beam — мобильная стальная конструкция 6×4×1 м с гидравлическим приводом для height adjustment (анод-катод gap 4.0-4.5 cm); 7) Side draft hood — крышка над pot со встроенным fume collection, gases HF + CO2 + dust → centralised FTP dry scrubber; 8) Magnetic field correction — busbars routed для минимизации electromagnetic disturbance расплавленного Al (Hall effect → stirring → metal pad oscillation); 9) Temperature monitoring — pyrometer optical + thermo-couple Pt-Pt/Rh каждый pot, target 955 °C ± 5 °C (выше — анодный effect, ниже — solidification); 10) Anode effect prevention — automatic feed control + voltage spike detection при concentration Al2O3 <1.5% → PFC emission CF4 (GWP=6500) и C2F6 (GWP=9200) — BAT-IED limit 0.05 кг CO2eq/т Al; EU IED BAT Reference Aluminium + ISO 14001 + ASI Performance Standard + AA SS-1 (Aluminum Association)" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Энергопотребление</h2>
          <p className="text-slate-300">
            Завод 250 000 т Al/год работает 24/7 × 365 сут = 8760 ч. Современный
            best practice (Norsk Hydro Karmøy Technology Pilot) = 12.5 МВт·ч/т Al.
            Российские/казахстанские заводы AP-40 → 14-15 МВт·ч/т Al. Каков
            годовой расход электроэнергии (МВт·ч/год для KAP при 13.5 МВт·ч/т)?
            Введи в формате (тыс. МВт·ч/год = ГВт·ч/год):
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
                <strong>Ответ:</strong> 250 000 т × 13.5 МВт·ч/т = <strong>3 375 000 МВт·ч/год = 3 375 ГВт·ч/год</strong>.
                Для KAP Павлодар нужна собственная ТЭЦ ≈ 400-500 МВт постоянной
                нагрузки (с учётом коэф. использования 85-90%). Это эквивалент
                полугодового энергопотребления г. Алматы. Поэтому алюм. заводы
                строят рядом с дешёвой энергетикой — KAP запитан от Аксу ГРЭС.
                EU IED BAT + AA Energy Intensity Benchmark.
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс завода 250 000 т Al/год</h2>
          <p className="text-slate-300">
            Алюминиевый электролизный завод KAP-уровня 250 000 т/год «под ключ»:
          </p>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>Земляные + фундаменты ж/б плита B30 4 corpus × 1000 × 35 м (140 000 м² × 12 000 тг) = 1.7 млрд тг</li>
            <li>Каркас стальной ЛМК S355 4 corpus ВРС 22 м (140 000 м² × 35 000 тг) = 4.9 млрд тг</li>
            <li>Сэндвич стен + кровля Kingspan PIR 200 мм (14 000 п.м × 28 000 тг + 140 000 м² × 18 000 тг) = 2.9 млрд тг</li>
            <li>800-1000 электролизёров Pre-baked AP-40 (50 т сталь + 100 т углерод + 50 т огнеупор каждый) = 380 млрд тг</li>
            <li>Углеродный (анодный) цех Green Mill + Anode Bake Furnace × 3 печи = 95 млрд тг</li>
            <li>Casting House: 6 settling furnaces 80 т + DC casters Wagstaff + ingot/T-bar/slab lines = 65 млрд тг</li>
            <li>Сухая газоочистка FTP (Fluorine Treatment Plant) Alcan dry scrubber × 4 corpus = 48 млрд тг</li>
            <li>SO2 wet scrubber Marubeni (опц для high-S coke) + gypsum recovery = 12 млрд тг</li>
            <li>PFC контроль + 24/7 sensors + automatic feed control = 4 млрд тг</li>
            <li>ТЭЦ собственная 500 МВт × 800 млн тг/МВт (если новая) = 400 млрд тг (либо подача с Аксу ГРЭС через ЛЭП 500 кВ = 22 млрд тг)</li>
            <li>DC выпрямители Siemens SVC 400 кА + transformers 800 МВА × 2 = 92 млрд тг</li>
            <li>Busbar Al sheet (1000 т Al для шинопровода) + полировка + изоляция = 18 млрд тг</li>
            <li>Рудный двор + 25-50 silos Al2O3 5000 т каждый + pneumatic conveyor + Аxu хранилище = 14 млрд тг</li>
            <li>Газопровод + насосные водоснабжения промцикла + замкнутая система охлаждения = 11 млрд тг</li>
            <li>SPL Spent Pot Lining утилизация Reynolds Process + landfill class III = 6 млрд тг</li>
            <li>Метрологическая лаб ICP-OES Thermo + spark Spectroport + QA по AA1100/AA6061 = 1.8 млрд тг</li>
            <li>Адм. корпус 5000 м² + LED освещение + помещ. для смены 4×600 чел + IT-инфраструктура = 14 млрд тг</li>
            <li>EIA + ESIA EBRD + ASI сертификация + строит. лицензия + проектирование 5% + ПИР + НР + СП + пуско-наладка PNR + страхование = 65 млрд тг</li>
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
                <strong>Ответ:</strong> ~800 млрд тг (~$1.7B USD) при размещении
                рядом с существующей ГРЭС, или ~1.2-1.4 трлн тг при включении
                собственной ТЭЦ 500 МВт. Удельная — $7000-9000 / т Al/год capacity.
                Окупаемость 12-18 лет при LME цене $2200-2800/т Al и
                cash-cost $1500-1800/т (60% энергия + 30% глинозём + 10% прочее).
                EU IED BAT Reference + AA Aluminum Cost Benchmark.
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Anode effect и PFC</h2>
          <p className="text-slate-300">
            На электролизном заводе случается «anode effect» — что это и как
            предотвратить по EU IED BAT Reference + IAI (International Aluminium Institute)?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Это нормальное явление, не требует контроля" },
              { v: "b", t: "Это поломка анода, ремонт раз в год" },
              { v: "c", t: "Anode effect (AE) — резкий рост напряжения на ячейке (с 4.2 В до 30-100 В) при дефиците Al2O3 в криолите → выделение PFC (CF4, C2F6) — мощных парниковых газов, требует предотвращения по EU IED BAT + IAI PFC Reduction Programme: 1) Механизм — когда концентрация Al2O3 в электролите падает <1.5% (норма 2-3%), на углеродном аноде вместо реакции 2Al2O3 + 3C → 4Al + 3CO2 начинается реакция 4C + 4F⁻ (из криолита) → CF4 (тетрафторметан) + C2F6 (гексафторэтан); 2) GWP — CF4 имеет Global Warming Potential 6630× CO2, C2F6 — 11 100× CO2 (IPCC AR5), 1 кг PFC = 6-11 т CO2eq, поэтому AE — крупнейший источник парниковых газов алюм. промышленности; 3) Detection — автоматический мониторинг напряжения каждый pot 24/7, alarm при V>8 V (норма 4.0-4.5 V), PFC-sensor FTIR Bruker continuous на выхлопе FTP; 4) BAT-IED limit — 0.05 кг CO2eq/т Al от PFC emissions (vs Soderberg технология 5-15 кг CO2eq/т); современные AP-60 + Karmøy достигают 0.02-0.04 кг CO2eq/т Al; 5) Prevention — automatic point feeders с pneumatic dosing Al2O3 каждые 60-90 сек по сигналу voltage + Al2O3-meter; 6) Anti-AE algorithm — при V>5.5 V автоматическая «overfeed» 50% extra Al2O3 в pot на 2-3 минуты для restoration concentration; 7) Anode positioning — automatic adjustment anode-cathode distance ACD 4.0-4.5 см через gear motor (если расплав поднимается, anode опускается); 8) Crust monitoring — surface frozen crust на электролите должен быть unbroken (точечный feeder через crust hole), иначе break-through cools pot; 9) Reporting — quarterly report PFC emissions в IAI database + национальный реестр выбросов МЭ РК (по ПП РК №934 от 2007); 10) Energy savings — AE elimination даёт 0.5-1% energy saving (less voltage spikes) + 5-10% CO2eq reduction; EU IED BAT Reference Aluminium + IAI 2018 PFC Reduction Programme + ASI Performance Standard + ISO 14064 GHG + IPCC AR5 GWP" },
              { v: "d", t: "Случается только при пуске ячейки" },
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
              {score === 4 && "Отлично! Ты знаешь Hall-Héroult и BAT-IED Aluminium."}
              {score === 3 && "Хорошо. Перечитай EU IED BAT Reference + IAI PFC Programme."}
              {score === 2 && "Уровень C — пересмотри AA Standards + СН РК 4.04-15."}
              {score <= 1 && "Нужно повторить. См. ISO 14001 + ASI Performance Standard."}
            </p>
          </section>
        )}

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-cyan-300">Нормативная база</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li><strong>EU IED BAT Reference Aluminium 2017</strong> — Best Available Techniques для производства алюминия (electrolysis + casting + anode plant)</li>
            <li><strong>EU IED Directive 2010/75/EU</strong> — Industrial Emissions Directive</li>
            <li><strong>ASI Performance Standard 2017</strong> — Aluminium Stewardship Initiative (sustainability)</li>
            <li><strong>ASI Chain of Custody Standard</strong> — для green/responsible aluminium</li>
            <li><strong>ISO 14001</strong> — Environmental management systems</li>
            <li><strong>ISO 50001</strong> — Energy management systems</li>
            <li><strong>ISO 14064</strong> — Greenhouse Gas Accounting and Verification</li>
            <li><strong>IPCC AR5/AR6</strong> — Global Warming Potential factors (CF4=6630, C2F6=11100)</li>
            <li><strong>IAI PFC Reduction Programme 2018</strong> — International Aluminium Institute</li>
            <li><strong>AA Standards (Aluminum Association)</strong> — AA1100, AA6061, AA7075 specifications</li>
            <li><strong>EN 573-3</strong> — Aluminium and aluminium alloys chemical composition</li>
            <li><strong>ASTM B221 / B247</strong> — Aluminum extrusions / forgings</li>
            <li><strong>СН РК 4.04-15</strong> — Цветная металлургия (производственные здания)</li>
            <li><strong>СНиП 2.04.05-91*</strong> — ОВК для металлургических цехов</li>
            <li><strong>ПУЭ-7</strong> — Электроустановки потребителей (DC ≥1 кВ для электролизёров)</li>
            <li><strong>ПП РК №934 от 2007</strong> — учёт выбросов парниковых газов (национальный реестр)</li>
            <li><strong>LME Special High Grade SHG</strong> — биржевая категория Al ≥ 99.7%</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
