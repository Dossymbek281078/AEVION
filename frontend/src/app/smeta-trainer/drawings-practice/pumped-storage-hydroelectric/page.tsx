"use client";
import Link from "next/link";
import { useState } from "react";

export default function PumpedStorageHydroelectricPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 11_000_000) <= 1_100_000;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 950_000_000_000) <= 95_000_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · ГАЭС — гидроаккумулирующие электростанции</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">⚡ ГАЭС (Pumped Storage) — гидроаккумуляция</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #286. Алакольская ГАЭС (план 1200 МВт КЕГОК + Korea Hydro
            KHNP), Мойнакская ГЭС-2 (план), Жонгар-Алатау PSH. Pumped Storage
            Hydroelectric (PSH) — крупнейший в мире класс grid-scale energy
            storage ({">"}95% мировой ёмкости storage), works так: ночью при
            дешёвой энергии (off-peak) насосы перекачивают воду из нижнего
            резервуара (lower reservoir) в верхний (upper reservoir, head
            100-700 м); днём при peak demand вода идёт обратно через
            reversible turbine, генерируя 800-3000 МВт за 4-12 часов.
            Эффективность round-trip 70-80% (с учётом потерь насосов +
            турбин + испарения). Voith Hydro / GE Renewable / Andritz Hydro
            делают reversible Francis turbines. ICOLD 2020 (Bulletin 170) +
            СНиП 2.06.01 + IEC 60193 (модельные испытания турбин).
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав ГАЭС 1200 МВт</h2>
          <p className="text-slate-300 leading-relaxed">
            ICOLD 2020 + СНиП 2.06.01 + IEC 60193 + Voith Hydro design guidelines:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Upper reservoir (верхний резервуар):</strong> искусственный бассейн на холме / горном плато, ёмкость 5-15 млн м³, площадь 30-100 га, dam height 30-60 м (asphaltic concrete ACC face или CFRD concrete-faced rock fill), геомембрана HDPE 2 мм для гидроизоляции; контурный канал + аварийный спускной затвор.</li>
            <li><strong>Lower reservoir (нижний резервуар):</strong> существующее озеро (Алакольское) или искусственный bassin 7-20 млн м³ (на 30% больше upper для buffer), регуляторный закон сохранения уровня; intake screen для предотвращения попадания рыбы (fish-friendly screen ≤10 мм mesh).</li>
            <li><strong>Penstock (напорный трубопровод):</strong> подземный туннель Ø6-9 м длиной 1-3 км из бетона B45 W12 + steel-lined нижняя секция (high-pressure 5-8 МПа), стальная футеровка 30-50 мм X65, ИЛОТ-test 1.5× design pressure.</li>
            <li><strong>Surge tank / surge chamber:</strong> вертикальный «колодец» Ø15-25 м H=50-100 м для смягчения water-hammer при быстром закрытии затвора турбины; иначе давление прыгнет до 1.5× design — pipe rupture risk.</li>
            <li><strong>Powerhouse (машинный зал):</strong> подземная пещера 100×30×40 м (в скале на 200-400 м глубине ниже upper reservoir), бетон B40 + ankerage anchor bolts; 4-8 reversible turbine-pump units 200-400 МВт каждый.</li>
            <li><strong>Reversible Francis turbine-pump:</strong> Voith Hydro / GE Renewable / Andritz, диаметр runner 5-8 м, weight 200-400 т, скорость 250-500 rpm, η_turbine 92-93%, η_pump 89-91% → round-trip 70-80%; specific speed Ns 30-90 для head 100-700 м.</li>
            <li><strong>Spherical valve (затвор):</strong> Voith / Andritz сферическая задвижка Ø3-5 м между penstock и turbine — позволяет полную isolation для maintenance + аварийную закрытие за 60-90 сек.</li>
            <li><strong>Generator-motor:</strong> синхронная машина 200-400 МВА, напряжение 18-22 кВ, обмотка статора Cu водяное охлаждение, ротор salient-pole с возбуждением AVR Brushless; работает как мотор (pump mode) или generator (turbine mode), reversal по реверсу phase rotation.</li>
            <li><strong>Step-up transformer:</strong> 18/220 или 18/500 кВ × 400 МВА × 8 шт, oil-immersed YNd11, охлаждение ONAF / OFAF, BIL 1175 кВ; выход на 220-500 кВ open switchyard.</li>
            <li><strong>Open switchyard:</strong> 220-500 кВ GIS (Gas Insulated Switchgear) Siemens 8DJH SF6-free / ABB ELK-04, breakers 50-63 кА short-circuit, busbar Al pipe или Cu rod.</li>
            <li><strong>Cooling system:</strong> closed-loop water cooling для генераторов + maslo cooler через heat exchanger; outdoor cooling tower 100-200 МВт термальной нагрузки.</li>
            <li><strong>SCADA + AGC:</strong> Honeywell Experion / ABB Symphony Plus, real-time grid frequency regulation (response 1-2 сек), automatic generation control AGC для участия в balancing market КЕГОК.</li>
            <li><strong>Fish ladder / mitigation:</strong> для существующего lower reservoir с рыбой — отдельный bypass channel с baffle steps + fish screen на intake; EBRD ESIA требование.</li>
            <li><strong>Адм. + control room 24/7:</strong> 50-100 рабочих 4-сменка, центр диспетч + maintenance shop + помещение для генератора-emergency.</li>
            <li><strong>Сертификация:</strong> ICOLD certification для dam safety, IEC 60193 model testing турбин, IEEE 421 для AVR, КАЭН РК для электробезопасности.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Reversible turbine choice</h2>
          <p className="text-slate-300">
            ГАЭС 1200 МВт, head H=130 м (low-medium head). Какая турбина по
            IEC 60193 + Voith Hydro design + KHNP best practice?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Pelton turbine impulse — для очень высоких напоров H>500 м, не подходит для H=130 м" },
              { v: "b", t: "Kaplan turbine axial — для очень низких напоров H<60 м, не подходит" },
              { v: "c", t: "Bulb turbine pour-tube — для приливных, нет" },
              { v: "d", t: "Reversible Francis turbine-pump (RPT) Voith Hydro / GE Renewable / Andritz Hydro для H=130 м, η round-trip 75-80% по IEC 60193: 1) Конструкция — radial-axial reaction turbine, runner Ø5-7 м с 13-17 spiral blades curved, weight 150-300 т, материал stainless steel 13/4 Cr-Ni (для cavitation resistance + erosion); 2) Specific speed Ns = n·√P/H^(5/4) = 60-90 m·kW для H=130 м (Francis range), n=300-500 rpm; 3) Operating range — 60-100% rated output (турбина) и 70-100% (насос) — pump mode требует minimum flow >70% т.к. ниже cavitation в impeller; 4) Reversal — change in direction of rotation (CW for turbine ↔ CCW for pump) via phase-sequence switch on motor-generator, takes 3-5 минут с full stop → reverse → full speed; 5) Efficiency curves — η_turbine 92-93% at BEP (best efficiency point), η_pump 89-91% (потери выше в pump mode из-за inlet swirl); round-trip η = η_pump × η_turbine × η_motor × η_generator × η_pipe = 0.90 × 0.92 × 0.99 × 0.99 × 0.97 = 79%; 6) Cavitation protection — submergence Hs = (Hatm − Hvapor) / σ × η_critical, для Francis σ ≈ 0.10-0.15 при Ns=70 ⇒ Hs ≥ 5-8 м (turbine ниже tail water level); 7) Spiral case + draft tube — concrete-embedded steel casing 50-70 мм X65, conical draft tube с recovery 80-85% kinetic energy; 8) Ramp response — start-up из стенда 90 сек до full output, ramp 0-100% за 30 сек — отличный для frequency regulation grid; 9) Maintenance — major overhaul каждые 30-40 лет, runner re-machining (cavitation pitting repair) каждые 10-15 лет, balancing после repair; 10) Modern variable-speed Francis (DFIM doubly-fed induction motor) — позволяет efficient pump mode at part-load + grid frequency support даже без 100% load; IEC 60193 + IEC 61116 + Voith Hydro design + ICOLD Bulletin 170 + ASME PTC 18" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Объём upper reservoir</h2>
          <p className="text-slate-300">
            ГАЭС 1200 МВт работает в turbine mode 8 часов (peak hours).
            Head H=130 м, η_turbine = 0.92. Формула гидроэнергии:
            P = ρ·g·Q·H·η, где ρ=1000 кг/м³, g=9.81 м/с². Какой нужен объём
            воды (м³) в upper reservoir для 8 часов выдачи 1200 МВт?
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
                <strong>Ответ:</strong> P = 1200 МВт ⇒ расход Q = P / (ρ·g·H·η)
                = 1 200 000 000 / (1000 × 9.81 × 130 × 0.92) ≈ 1 023 м³/с.
                За 8 ч: V = 1023 × 8 × 3600 ≈ 29.5 млн м³. С запасом dead
                storage + испарение 30% ⇒ <strong>~11 млн м³</strong> (active
                storage), upper reservoir общий объём ≈ 15-20 млн м³.
                Реальные значения для PSH 1200 МВт × 8 ч — Bath County USA
                14 млн м³, Турлоф Швейцария 12.5 млн м³. ICOLD + СНиП 2.06.01.
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс ГАЭС 1200 МВт</h2>
          <p className="text-slate-300">
            ГАЭС Алакольская 1200 МВт × 8 ч × H=130 м «под ключ»:
          </p>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>Геотехн. изыскания + бурение 3 км × 20 скважин для bedrock + сейсм. обследование = 4.5 млрд тг</li>
            <li>Upper reservoir — dam 50 м H × 600 м L (CFRD concrete-faced rock fill 800 тыс м³ rock + 30 тыс м³ concrete face) = 110 млрд тг</li>
            <li>HDPE 2 мм гидроизоляция + GCL Bentofix 200 га дна + аварийный спускной затвор = 18 млрд тг</li>
            <li>Lower reservoir — dam 20 м H × 800 м L + intake screen fish-friendly + diversion tunnel = 65 млрд тг</li>
            <li>Penstock туннель Ø7 м × 1.5 км в скале — TBM Robbins или D&B drilling-blast = 95 млрд тг</li>
            <li>Steel lining penstock 30-50 мм X65 на high-pressure участке 500 м = 38 млрд тг</li>
            <li>Surge tank Ø20 м H=80 м (ж/б бетон B40 + waterstop) = 22 млрд тг</li>
            <li>Powerhouse подземная пещера 100×30×40 м (бетон B40 + anchor bolts + rock support) = 110 млрд тг</li>
            <li>Reversible Francis turbine-pump Voith Hydro 4×300 МВт (под ключ под установку) = 240 млрд тг</li>
            <li>Spherical valves Andritz 4 шт Ø4 м = 14 млрд тг</li>
            <li>Generator-motor 4×335 МВА синхронные + AVR Brushless = 95 млрд тг</li>
            <li>Step-up transformers 220/18 кВ 4×400 МВА (oil-immersed YNd11) = 28 млрд тг</li>
            <li>GIS switchyard 220 кВ Siemens 8DJH + breakers 63 кА + busbar = 35 млрд тг</li>
            <li>ЛЭП 220 кВ 50 км до КЕГОК + tie-in = 14 млрд тг</li>
            <li>Cooling tower 200 МВт + насосы Sulzer + closed-loop water = 12 млрд тг</li>
            <li>SCADA + AGC ABB Symphony Plus + DCS + control room 24/7 = 8 млрд тг</li>
            <li>Fish ladder mitigation + EBRD ESIA + environmental compensation = 9 млрд тг</li>
            <li>Подъездная дорога 30 км + ж/д подвоз turbine 300 т каждая (special transport) = 22 млрд тг</li>
            <li>Жилой блок 200 рабочих вахта 14/14 + столовая + медпункт + спортзал = 8 млрд тг</li>
            <li>ICOLD certification + dam safety review + IEEE 421 testing + проектирование 5% + ПИР + НР + СП + PNR + страхование стр.-мон. + interest during construction = 105 млрд тг</li>
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
                <strong>Ответ:</strong> ~950 млрд тг (~$2B USD) — стандарт PSH
                1200 МВт × 8 ч. Удельная capex — $1700 / кВт PSH-power
                (vs батарей BESS $400-500/кВт·ч × 10 ч = $4000-5000/кВт).
                PSH дешевле для storage {">"}4 часа и срок службы 80-100 лет (vs
                BESS 10-15 лет). Окупаемость 18-25 лет через day-ahead
                arbitrage ($30-50/МВт·ч peak-trough spread). ICOLD + IEC 61116.
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Round-trip efficiency</h2>
          <p className="text-slate-300">
            ГАЭС работает: night pump (off-peak 02:00-06:00) → day turbine
            (peak 18:00-22:00). Round-trip η = 75%. Что это значит экономически
            и как maximize ROI по EPRI Pumped Storage Handbook?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Round-trip 75% означает мы получаем 25% бесплатной energy" },
              { v: "b", t: "Round-trip это коэффициент капиталовложений" },
              { v: "c", t: "Round-trip η = E_out/E_in = 75% — из 100 МВт·ч закачанных ночью получаем 75 МВт·ч днём; экономика работает на peak-trough price spread по EPRI Pumped Storage Handbook + ENTSO-E methodology: 1) Energy losses 25% — потери в pump (10%) + turbine (8%) + pipe friction (3%) + transformer (1%) + generator (1%) + испарение (2%); 2) Economic principle — покупаем электричество в off-peak (ночь, по $20-30/МВт·ч из-за избытка baseload AЭС/ТЭЦ) и продаём в peak (вечер, по $80-120/МВт·ч когда максимальный спрос); 3) Per-MWh profit = $100 × 0.75 (selling 75 МВт·ч) − $30 × 1.0 (buying 100 МВт·ч) = $75 − $30 = $45/МВт·ч generated; 4) Annual revenue — 1200 МВт × 8 ч × 365 = 3.5 млн МВт·ч × $45 = $158M USD/год = 80 млрд тг/год; 5) Optimisation — Day-Ahead Market bidding + Intraday Market корректировки + Ancillary Services (frequency regulation, voltage support) с премией $20-50/МВт·ч; 6) Multi-day cycling — иногда выгоднее не работать ежедневно а раз в неделю (например в weekend off-peak → workday peak) для большего spread; 7) Capacity payments — в balanced market PSH получает $60-120/кВт/year capacity payment от TSO КЕГОК за «standby reliability»; 8) Black start — PSH имеет уникальную способность restart grid после blackout (нет внешнего питания требуется, hydraulically) — премия $50-100/кВт/year; 9) Renewable integration — PSH compensates intermittency wind/solar (over-supply → pump up, under-supply → discharge), это growing market РК с ростом доли ВИЭ (план КЕГОК 30% к 2030); 10) Climate change risk — изменение precipitation patterns может влиять на water availability в lower reservoir (для Алакольской ГАЭС критично — Алакольское озеро уже теряет 1-2% объёма/декаду); EPRI Pumped Storage Handbook + ENTSO-E Day-Ahead Market + IEA World Energy Outlook + IEEE 1547 + IEC 61400-25 (energy storage)" },
              { v: "d", t: "Round-trip это процент возврата кредита" },
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
              {score === 4 && "Отлично! Ты знаешь PSH + reversible Francis."}
              {score === 3 && "Хорошо. Перечитай ICOLD Bulletin 170 + EPRI PSH Handbook."}
              {score === 2 && "Уровень C — пересмотри IEC 60193 + СНиП 2.06.01."}
              {score <= 1 && "Нужно повторить. См. Voith Hydro design guidelines + IEEE 421."}
            </p>
          </section>
        )}

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-cyan-300">Нормативная база</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li><strong>ICOLD Bulletin 170 (2020)</strong> — Pumped Storage Hydroelectric Plants — Design Considerations</li>
            <li><strong>ICOLD Bulletin 137</strong> — Reservoirs and Seismicity</li>
            <li><strong>СНиП 2.06.01-86</strong> — Гидротехнические сооружения. Основные положения</li>
            <li><strong>СНиП 2.06.05-84*</strong> — Плотины из грунтовых материалов</li>
            <li><strong>СНиП 2.06.06-85</strong> — Плотины бетонные и железобетонные</li>
            <li><strong>СН РК 3.04-08</strong> — Гидротехнические сооружения</li>
            <li><strong>IEC 60193</strong> — Hydraulic turbines, storage pumps and pump-turbines — Model acceptance tests</li>
            <li><strong>IEC 60041</strong> — Field acceptance tests of hydraulic turbines</li>
            <li><strong>IEC 61116</strong> — Electromechanical equipment guide for small hydroelectric installations</li>
            <li><strong>IEC 61400-25</strong> — Communications for monitoring and control of energy storage</li>
            <li><strong>IEEE 421</strong> — Excitation systems for synchronous machines</li>
            <li><strong>ASME PTC 18</strong> — Performance Test Codes for Hydraulic Turbines and Pump-Turbines</li>
            <li><strong>EPRI Pumped Storage Handbook</strong> — Electric Power Research Institute (USA)</li>
            <li><strong>ENTSO-E Network Code on Grid Connection</strong> — европейский grid code для генераторов</li>
            <li><strong>IEEE 1547</strong> — Standards for Interconnecting Distributed Resources</li>
            <li><strong>Equator Principles + IFC PS6</strong> — финансовые ESG-стандарты</li>
            <li><strong>EBRD ESIA</strong> — Environmental and Social Impact Assessment</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
