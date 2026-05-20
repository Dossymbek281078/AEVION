"use client";
import Link from "next/link";
import { useState } from "react";

export default function FloatingStorageFpsoPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 1_750_000) <= 175_000;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 750_000_000_000) <= 75_000_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · FPSO + плавучие хранилища</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">⚓ FPSO — Floating Production Storage Offloading</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #281. FPSO (Floating Production Storage and Offloading) —
            суда-фабрики для глубоководной добычи нефти/газа. Для Каспия —
            альтернатива GBS-платформам для удалённых месторождений
            (Хвалынское, Каламкас-море, Кашаган Phase II). Прототипы: Petrobras
            Búzios FPSO Almirante Tamandaré (180 000 барр/сут), Equinor Johan
            Castberg, BP Schiehallion. Конвертированный танкер Афрамакс
            110 000 dwt + topside 30 000 т modules для processing. Riser turret
            mooring (YME-style) для weathervaning вокруг 360°. BOP subsea
            Cameron CSE/IsoBeam. Класс ABS / DNV / LR. IMO MARPOL Annex I +
            USCG Subchapter L + СН РК 2.05-15.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав FPSO для Каспия</h2>
          <p className="text-slate-300 leading-relaxed">
            IMO MARPOL Annex I + USCG Subchapter L + ABS Rules + DNV-OS-A101 + СН РК 2.05-15:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Hull (корпус):</strong> конвертированный танкер Афрамакс класса (LBP=240 м, B=42 м, D=21 м, dwt 110 000 т), сталь D / E grade ABS, толщина оболочки 18-25 мм, ice strengthening Class IA для Каспия (зимой лёд 1.5 м).</li>
            <li><strong>Cargo tanks:</strong> 12-15 танков двойной обшивки (по IMO MARPOL Annex I Reg 19 — double hull standard с 2000 г), общий объём storage 1.5-2 млн барр (~250-330 тыс м³), inert gas Cl-blanket для prevention взрыва.</li>
            <li><strong>Topside processing modules:</strong> 30 000 т modules на палубе, 6 этажей: separation 3-phase (oil-gas-water), gas compression 4× Solar Centaur 13 МВт, water injection pump Sulzer MSD, chemical injection (corrosion inhibitor + scale inhibitor + biocide).</li>
            <li><strong>Riser Turret:</strong> поворотная башня в носовой части FPSO (Yme-style или SBM Offshore design), позволяет FPSO «weathervane» вокруг turret на 360° в зависимости от ветра/волн; через turret проходят 6-10 риcеров + control umbilical + power cable из subsea.</li>
            <li><strong>Mooring system:</strong> 12-16 mooring lines (chain-wire-chain 800 м каждая) с anchor pile в дне Каспия на 100 м (suction pile 5×5 м) или drag anchor (Vryhof Bruce); расчёт по DNV-OS-E301 для 100-year storm.</li>
            <li><strong>Offloading system:</strong> кормовой shuttle tanker offloading через hawser 100 м + floating hose Ø16" Ø20", для VLCC shuttle tanker 320 000 dwt; offload rate 100 000 барр/час (2 раза в неделю при добыче 180 тыс барр/сут).</li>
            <li><strong>Subsea BOP (Blowout Preventer):</strong> Cameron CSE (Compact Subsea Equipment) или IsoBeam, mounted на well christmas tree, давление работы 10 000-15 000 psi, hydraulic control via umbilical от FPSO.</li>
            <li><strong>Production wells:</strong> 8-12 subsea wells на дне моря, gathered через PLEM/PLET к одной flowline к risers FPSO, ESD valve на каждой well + downhole safety valve (DHSV).</li>
            <li><strong>Helideck:</strong> Sikorsky S-92 (12 пассажиров) или AW189, размер 35×35 м на надстройке, ICAO Annex 14 Vol II compliance, fire-fighting foam Skum.</li>
            <li><strong>Жилой модуль:</strong> 200-250 коек для вахтовиков 28/28, размещение на надстройке (поднято на 3 этажа над main deck для блокировки от спрея), кафе, спортзал, медпункт, гелипад top deck.</li>
            <li><strong>Power generation:</strong> 4× Solar Centaur 13 МВт газовые турбины = 52 МВт совокупно, на сепарированном газе (sweet gas after amine treatment); резерв DG-2000 Caterpillar 2 МВт на 72 ч.</li>
            <li><strong>Safety systems:</strong> ESD (Emergency Shutdown), F&G (Det-Tronics IR + UV-IR), deluge foam Skum + ESFR water mist, lifeboats Schat-Harding 70-passenger × 4 шт + life rafts × 30.</li>
            <li><strong>Ballast water management:</strong> IMO BWM Convention 2017 — UV-treatment Optimarin OBS + electrochlorination, prevention переноса invasive species.</li>
            <li><strong>Ice-protection:</strong> Каспий зимой 1.5-2 м льда — FPSO disconnect from turret + buoyancy storage + tug-assisted retreat в защищённый док Атырау на 4 мес зимы; альт. — fixed «caisson» turret под лёд.</li>
            <li><strong>SCADA + DCS:</strong> Honeywell Experion / Yokogawa CENTUM VP, contol room 24/7 двумя сменами, real-time monitoring 5000+ tag points.</li>
            <li><strong>Класс судна:</strong> ABS A1 Oil Tanker AMS / DNV +1A1 / LR ✠ Tanker, подкласс «FPSO Service».</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Mooring и weathervaning</h2>
          <p className="text-slate-300">
            FPSO 110 000 dwt converted Afromax на месторождении в Северном
            Каспии (глубина 80 м, для Кашагана-shelf не подходит, но для
            Хвалынского — да). Какая mooring система обеспечивает weathervaning?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "4 anchor якоря Stockless 5 т каждый в углах судна — фиксированно" },
              { v: "b", t: "Spread mooring 8 лебёдок по 4 угла без turret — фиксированный курс" },
              { v: "c", t: "Динамическое позиционирование Dynamic Positioning только thruster без mooring" },
              { v: "d", t: "Internal Turret Mooring (Yme-style / SBM Offshore) для 360° weathervaning по DNV-OS-E301: 1) Turret — поворотная башня в носовой части FPSO, intern. диаметр 12-18 м, height 30-40 м, weight 1500-3000 т, конструкция steel A36 / S355 с corrosion allowance 6 мм; 2) Bearings — slewing ring bearing 12-18 м диаметр (типа Rothe Erde, Liebherr) на upper и lower позициях, для свободного поворота FPSO вокруг turret 360°; 3) Mooring lines — 12-16 chain-wire-chain mooring (top chain R4 5 м + wire rope 6×36 IWRC 800 м + bottom chain R4 100 м), общая длина 900-1000 м, breaking load 1500-2000 т каждая; 4) Anchor system — Suction Pile (suction-installed pile) 5×5 м H=15 м из стали API 5L X65, забивка в грунт через вакуумирование; альт. — drag anchor Vryhof Bruce 30 т (для илистого дна); 5) Расчёт по DNV-OS-E301 — 100-year storm + 10000-year survival check, factor of safety FoS=2.5-3.0; 6) Riser stack — внутри turret 6-10 riser pipes Ø8-12 inch с swivel-joint, dynamic flexible jumper к topside через goose-neck; 7) Power & control swivel — Wartsila / Vator Marine swivel для передачи power 11 кВ AC + signals + hydraulics между turret (static) и FPSO (rotating) — sliprings 200+; 8) Disconnect функция — quick-disconnect mooring system QDS позволяет FPSO «отпрыгнуть» с turret за 30 мин при approaching hurricane или ice; turret остаётся на месте с buoy, FPSO retreat; 9) Weathervaning logic — FPSO ориентируется носом против преобладающего ветра/волны, минимизируя heeling moment и slamming; 10) Регулярные inspections — annual ROV survey mooring lines + 5-year диагностика swivel + 25-year drydock для turret refurbishment; DNV-OS-E301 (Position Mooring) + DNV-OS-A101 (Safety Principles) + API RP 2SK + ABS Rules for FPSO + IMO MODU Code 2009" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Объём storage FPSO</h2>
          <p className="text-slate-300">
            FPSO добывает 180 000 барр/сут. Shuttle tanker VLCC 320 000 dwt
            offloading 100 000 барр/час, 2 раза в неделю (= раз в 3.5 сут).
            Какой нужен объём cargo storage tanks FPSO между offloading
            операциями + 30% buffer для bad weather (нельзя offload при шторме)?
            Введи барр storage:
          </p>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="барр"
            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:border-blue-500 focus:outline-none"
          />
          {showResults && (
            <div className={`p-4 rounded-lg ${correct.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}>
              <p className="text-slate-200">
                <strong>Ответ:</strong> 180 000 × 3.5 = 630 000 барр накопление между
                offloading. + 30% bad weather buffer = 820 000 барр. Но
                стандарт FPSO Afromax-class = <strong>1.5-2 млн барр storage</strong>
                (~250-330 тыс м³) для 7-10 сут buffer (если шторм длинный).
                Реальное значение для Конвертированный Afromax 110 000 dwt
                ≈ 1.75 млн барр. IMO MARPOL Annex I Reg 19 (double hull).
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс FPSO</h2>
          <p className="text-slate-300">
            FPSO 110 000 dwt converted Afromax + 30 000 т topside «под ключ»:
          </p>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>Купить tanker Afromax 110 000 dwt 5-летний с рынка (Maersk / Frontline) = 75 млрд тг (~$150M)</li>
            <li>Conversion drydock Hyundai Heavy / DSME (Korea) 12 мес: гидроиспытания, IG-system, double hull retrofit = 45 млрд тг</li>
            <li>Ice-strengthening hull (Class IA Finnish-Swedish) для Каспия = 18 млрд тг</li>
            <li>Topside modules 30 000 т (predfab Korea SHI/Samsung) × 25 млн тг/т = 750 млрд тг</li>
            <li>Riser Turret Mooring (Internal Turret Yme-style SBM Offshore) + slewing rings + swivel = 60 млрд тг</li>
            <li>12 mooring lines chain-wire-chain 900 м × 200 млн тг/линию = 2.4 млрд тг</li>
            <li>Suction Pile 12 шт × 5×5×15 м × 800 млн тг = 9.6 млрд тг</li>
            <li>Anchor handling tug AHTS 4 шт × 6 мес mob = 18 млрд тг</li>
            <li>Christmas trees subsea Cameron T-Bolt × 10 wells × 1.8 млрд тг = 18 млрд тг</li>
            <li>Subsea BOP Cameron CSE × 10 × 0.6 млрд тг + control umbilical = 12 млрд тг</li>
            <li>Risers + flowlines + tie-back to FPSO = 32 млрд тг</li>
            <li>Sep+compression+water injection topside (Sulzer + Solar 4× Centaur 13 МВт) = 95 млрд тг</li>
            <li>Жилой модуль LQ 250 коек + helideck S-92 + кухня + медпункт = 14 млрд тг</li>
            <li>SCADA Honeywell Experion + DCS control room + safety F&G + LDS = 8 млрд тг</li>
            <li>Offloading system + hawser 100 м + floating hose Ø16" + breakaway coupling = 4.2 млрд тг</li>
            <li>Ballast Water Management UV Optimarin + electrochlorination = 1.6 млрд тг</li>
            <li>Lifeboats Schat-Harding × 4 + life rafts × 30 + SCBA Drager + EEBD = 1.8 млрд тг</li>
            <li>Класс судна ABS / DNV / LR survey + сертификация ✠ + commissioning = 12 млрд тг</li>
            <li>Pre-FEED + FEED + EPCI integrated project management + offshore EIA + Caspian Convention = 25 млрд тг</li>
            <li>Проектирование (3% от бюджета) + insurance buy-back + financing fees + offshore installation = 235 млрд тг</li>
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
                <strong>Ответ:</strong> ~750 млрд тг (~$1.5B USD) за FPSO
                converted Afromax + topside 30 000 т. Топсайд — 60% бюджета.
                Для сравнения новостройка FPSO с нуля (как Petrobras Búzios) —
                $3.5B USD (1.75 трлн тг). Окупаемость 8-12 лет при $50-70/барр
                нефти и 180 000 барр/сут. IMO MARPOL + ABS Rules + DNV-OS-A101.
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Зимняя стоянка</h2>
          <p className="text-slate-300">
            FPSO в Северном Каспии зимой (Nov-Apr) — лёд 1.5-2 м, торосы 5-8 м.
            Что делать с FPSO в зимний период по DNV-OS-A101 + USCG Subchapter L?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Оставить FPSO на mooring, продолжать добычу — лёд не страшен" },
              { v: "b", t: "Полностью затопить FPSO на дно как защита от льда" },
              { v: "c", t: "Disconnect from turret + tug-assisted retreat в защищённый док Атырау на 4-5 мес + альтернатива fixed «caisson» turret под лёд: 1) Quick-Disconnect Mooring System QDS — расцепление FPSO от turret занимает 30-60 минут, специальная процедура: snub off catenary chain в swivel, hawser slip + clamp on turret buoy, FPSO стартует под собственной мощностью или с тагами; 2) Turret остаётся на месте с auxiliary buoy на поверхности (3-5 м над водой) и продолжает удерживать subsea risers + production trees в standby режиме; 3) Production shutdown — все wells закрыты на DHSV (Downhole Safety Valve) + Christmas tree master valve + ESD на subsea — добыча прекращается на 4-5 мес; 4) FPSO retreat — буксировка 2-4 AHTS буксирами Smit Lloyd 30 т bollard pull, путь Каспий → Атырау sheltered harbour (24-48 ч); 5) Альтернатива fixed «caisson» turret — для месторождений с длинным ice period — фиксированный underwater turret в caisson 30×30×40 м из бетона B60 на дне моря, FPSO connects/disconnects с caisson через riser column (концепт Husky White Rose Newfoundland); 6) Storage tanker shuttle — если добыча должна продолжаться зимой, использовать ice-class shuttle tanker Arctic Aframax-DAT (Double Action Tanker) с Azipod-движителями для самостоятельного ice-breaking; 7) Pre-disconnect checks — pressure drain testing risers, flushing с inhibitor, valve sealing — занимает 7-10 дн перед winter; 8) Re-commissioning весной (April-May) — подключение FPSO к turret, pressure restoration, well start-up sequence занимает 14-21 дн; 9) Climate compensation — alternate операция с летной добычи только при ASMR (Annual Summer Mooring Recovery) — экономически эффективно при условии запасов >50 млн барр и цене >$50/барр; 10) Регуляторный compliance — Caspian Convention требует EIA для disconnection events + аварийных пролив рисков; Реальный пример РК — для Хвалынского месторождения LUKOIL планирует именно sheltered winter retreat концепт; DNV-OS-A101 + USCG Subchapter L + IMO MARPOL Annex I + ABS Rules for FPSO + Caspian Convention 2018" },
              { v: "d", t: "Установить вокруг FPSO кольцо ледоколов на постоянной основе" },
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
              {score === 4 && "Отлично! Ты знаешь FPSO operations + Arctic offshore."}
              {score === 3 && "Хорошо. Перечитай DNV-OS-A101 + ABS Rules for FPSO для углубления."}
              {score === 2 && "Уровень C — пересмотри IMO MARPOL Annex I + USCG Subchapter L."}
              {score <= 1 && "Нужно повторить. См. SOLAS + DNV-OS-E301 + API RP 2SK."}
            </p>
          </section>
        )}

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-cyan-300">Нормативная база</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li><strong>IMO MARPOL Annex I</strong> — Prevention of pollution by oil (double hull для танкеров)</li>
            <li><strong>IMO SOLAS</strong> — Safety of Life at Sea Convention</li>
            <li><strong>IMO MODU Code 2009</strong> — Code for the Construction and Equipment of Mobile Offshore Drilling Units</li>
            <li><strong>IMO BWM Convention 2017</strong> — Ballast Water Management</li>
            <li><strong>USCG 46 CFR Subchapter L</strong> — Offshore Supply Vessels</li>
            <li><strong>USCG NVIC 09-83</strong> — Guidance for FPSOs</li>
            <li><strong>ABS Rules for FPSO Installations</strong> — классификационное общество American Bureau of Shipping</li>
            <li><strong>DNV-OS-A101</strong> — Safety Principles and Arrangements (для offshore units)</li>
            <li><strong>DNV-OS-E301</strong> — Position Mooring (расчёт mooring system)</li>
            <li><strong>DNV-OS-D101</strong> — Marine and Machinery Systems and Equipment</li>
            <li><strong>API RP 2SK</strong> — Design and Analysis of Stationkeeping Systems for Floating Structures</li>
            <li><strong>API RP 2T</strong> — Tension Leg Platforms (для TLP-класса)</li>
            <li><strong>API RP 17B</strong> — Recommended Practice for Flexible Pipe</li>
            <li><strong>ISO 19901</strong> — Petroleum and natural gas industries — Specific requirements for offshore structures</li>
            <li><strong>СН РК 2.05-15</strong> — Морские нефтегазовые сооружения</li>
            <li><strong>Caspian Convention 2018</strong> (Актау) — правовой статус Каспийского моря</li>
            <li><strong>OSPAR Convention 1992</strong> — Convention for the Protection of the Marine Environment</li>
            <li><strong>EBRD ESIA</strong> — Environmental and Social Impact Assessment</li>
            <li><strong>IADC HSE Case</strong> — Health, Safety and Environment для offshore drilling</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
