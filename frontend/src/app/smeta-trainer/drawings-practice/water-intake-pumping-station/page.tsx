"use client";
import Link from "next/link";
import { useState } from "react";

export default function WaterIntakePumpingStationPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);
  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 18) <= 2;
  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 35_000_000_000) <= 3_500_000_000;
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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Водозаборы + насосные I подъёма</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">💧 Водозаборы + Насосные I-II подъёма (Городские)</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #294. Алматы Балтаалинский водозабор (поверхностный
            самотёчный из реки Малая Алматинка, 800 тыс. м³/сут для города),
            Каракудукский водозабор Шымкент (300 тыс. м³/сут), Астана Аршалы
            водозабор Ишим (350 тыс. м³/сут). Surface intake — головное
            сооружение с решёткой ringing + sandtraps + travelling screens
            Brackett Green; underground groundwater intake — скважины-куст
            Ø500 мм H=200-400 м с погружн. насосами Grundfos SP. Насосные
            I-II подъёма (НС-1 / НС-2) с многоступенчатыми pumps Sulzer
            APP / KSB CPK 3000-8000 м³/ч × 60-80 м H + frequency drive ABB
            для регулировки + soft-start + protective tank water hammer.
            СНиП 2.04.02-84 + СН РК 4.01-02 + ISO 9906 + ВНиПИ-Союз ГИДРО.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав водозабора 800 тыс м³/сут (Балтаалинский)</h2>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Головное сооружение (intake structure):</strong> ж/б монолит 30×20×8 м на берегу реки, fish-friendly решётка Ringing 50 мм mesh + sandtrap 4-camera (отстой песка 0.5 мм каждые 30 мин);</li>
            <li><strong>Travelling screens:</strong> Brackett Green 4 шт × 2.5 м wide × 8 м H, fine 2 мм mesh, automatic washing high-pressure 6 бар спрей removes debris;</li>
            <li><strong>Самотёчный канал (gravity tunnel):</strong> ж/б Ø3 м × 500 м длиной с уклоном 0.5‰, переходит в pressure pipeline после Pump Station I;</li>
            <li><strong>Pump Station I (НС-1):</strong> вертикал. погружные pumps KSB Sewatec 4 шт × 12 000 м³/ч × 25 м H (3 раб. + 1 рез.), мотор 1500 кВт × 3000 V, VFD ABB ACS6080;</li>
            <li><strong>Pre-treatment (отстойник):</strong> ж/б круглый Ø50 м H=6 м (объём 12 000 м³), горизонтальный отстой particles {">"}50 мкм, время отстоя 4-6 ч;</li>
            <li><strong>Pump Station II (НС-2):</strong> горизонтальные multistage Sulzer APP-XA 4 шт × 8000 м³/ч × 80 м H для подачи в city pressure zone, мотор 2200 кВт × 6000 V с VFD;</li>
            <li><strong>Hydrosphere (compensation surge tank):</strong> 200-500 м³ для water hammer protection (closure времён pump trip), pressurised N2-gas blanket Sentinel;</li>
            <li><strong>Chlorination station (pre-treatment):</strong> NaOCl 12% dosing 2-5 мг/л для disinfection источника (river bacteria E.coli + Giardia), pump Prominent Sigma 3 + storage tanks 50 т × 2;</li>
            <li><strong>Backup pumps + storage:</strong> резервные генераторы 5 МВт DG + UPS 500 кВА на 30 мин + spinning reserve power from Алматы CHP, для critical service 24/7;</li>
            <li><strong>Pipework Ø2400 мм:</strong> предварительно-напряжённые ж/б трубы PCCP-Pretensa или steel-lined ductile iron, длиной 25-40 км от НС до city distribution; CP cathodic protection + sacrificial anodes;</li>
            <li><strong>Flow + pressure metering:</strong> Endress+Hauser Promag E magnetic flowmeter Ø2400 мм ±0.5% + pressure Endress Cerabar S 0-16 бар каждые 2 км pipe, SCADA real-time monitoring;</li>
            <li><strong>Reservoirs (городские резервуары):</strong> 2-4 шт × 20 000-50 000 м³ ж/б tanks D=80 м H=10 м (объём для 4-6 ч city demand), обеспеч. firefighting + emergency reserve;</li>
            <li><strong>Booster stations (3-5 районных):</strong> каждый residential район, 2-4 pumps Wilo Strato BL × 200-500 м³/ч × 30 м H для поддержания pressure;</li>
            <li><strong>SCADA + DCS:</strong> Schneider Electric EcoStruxure / Siemens PCS7, real-time flow + pressure + tank level + pump status, automatic dispatch 24/7 от city control centre;</li>
            <li><strong>Лаборатория QA:</strong> daily sampling 50-100 points в city, parameters — pH + турбидность + Cl residual + bacteria E.coli + heavy metals; СанПин РК ГОСТ Р 51232.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Surface vs Groundwater intake</h2>
          <p className="text-slate-300">
            Алматы — рекомендуется surface intake (Малая Алматинка) или
            groundwater (скважины Талгарское нагорье)? По СН РК 4.01-02 + WHO Water Quality?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только groundwater — чистая вода, не нужна очистка" },
              { v: "b", t: "Только surface — самая дешёвая" },
              { v: "c", t: "Только rainwater harvesting — недостаточно" },
              { v: "d", t: "Гибридный source: 60% surface intake Балтаалинский + 40% groundwater Талгарское нагорье + emergency 5% reservoir storage по СН РК 4.01-02 + WHO + IWA Water Source Best Practices: 1) Surface intake преимущества — дешевле абстракции ($0.02/м³ vs groundwater $0.05/м³), большой recharge rate (естеств. сезонные осадки + талые ледники Тянь-Шань), хорошо для bulk demand 800 тыс м³/сут; 2) Surface недостатки — turbidity 50-500 NTU spring runoff (требует coagulation + sand-filter), bacteria E.coli + Giardia (требует chlorination 2-5 mg/L + UV), seasonal variation потоковый объём 30-100%; 3) Groundwater преимущества — стабильный T 8-12 °C год-кругло, низкая turbidity <1 NTU, естественно отфильтрован через грунт; 4) Groundwater недостатки — медленный recharge (decades vs years), risk over-abstraction → land subsidence (Talgar тоже подвержен), требует deep wells 200-400 м + power для pumps; 5) Hybrid approach — surface as primary для bulk + groundwater как peak-shaving / emergency reserve + reservoir storage 24-48 ч для backup при maintenance; 6) Water Quality Source Protection Plan WQSPP — Балтаалинский catchment areas обозначены как water protection zone в 1-2 км radius (no industry, no agriculture chemicals); 7) Pre-treatment differential — surface требует обширный pre-treatment (грабарка, sandtrap, отстойник, coagulation FeCl3, sand-filter, UV); groundwater только iron removal + softening; 8) Climate change adaptation — degradation ледников Тянь-Шань уменьшит surface runoff к 2050 на 30-40% — стратегия diversifies sources; 9) Regulatory — каждый источник проходит KAЗГИДРОМЕТ assessment quarterly + лимит abstraction permit от Минсельхоз + Минэкологии; 10) Source rotation — 12-month cycling между surface/groundwater для allow aquifer recharge; СН РК 4.01-02 + СНиП 2.04.02-84 + WHO Guidelines for Drinking Water Quality + ISO 24512 + IWA Water Source Best Practices + СанПин РК 2.1.4.1074" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Диаметр магистрали</h2>
          <p className="text-slate-300">
            Балтаалинский водозабор 800 тыс м³/сут = 9.3 м³/с. Pipeline до
            city CPS — длина 25 км, безопасная скорость water v ≤ 1.5 м/с
            (выше — кавитация / erosion). Площадь = Q/v. Минимальный диаметр
            pipe (мм, округл. до стандарта ISO 4427 — 2000/2200/2400/2600):
          </p>
          <input type="text" value={ex2} onChange={(e) => setEx2(e.target.value)} placeholder="dm" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:border-blue-500 focus:outline-none" />
          {showResults && (
            <div className={`p-4 rounded-lg ${correct.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}>
              <p className="text-slate-200">
                <strong>Ответ:</strong> A = Q/v = 9.3/1.5 = 6.2 м², D = √(4A/π) = 2.81 м.
                Округл. до ISO 4427 ⇒ <strong>Ø2.8-3.0 м (= 28-30 dm)</strong>.
                Реально для бэкап-redundancy 2 parallel pipes Ø1.8-2.0 м каждая.
                ISO 4427 + СН РК 4.01-02.
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс водозабора 800 тыс м³/сут</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>Земляные + foundation головного сооружения 30×20×8 м ж/б B40 = 0.85 млрд тг</li>
            <li>Travelling screens Brackett Green 4 шт + sandtrap + grit removal = 0.45 млрд тг</li>
            <li>Самотёчный канал ж/б Ø3 м × 500 м + ремонтные шахты = 0.65 млрд тг</li>
            <li>Pump Station I 4×KSB Sewatec 12 000 м³/ч + VFD ABB 1500 кВт = 2.2 млрд тг</li>
            <li>Отстойник Ø50 м × 6 м + scraper + drain = 1.2 млрд тг</li>
            <li>Pump Station II 4×Sulzer APP-XA 8000 м³/ч × 80 м H + VFD 2200 кВт = 3.8 млрд тг</li>
            <li>Hydrosphere surge tank 500 м³ + N2-blanket + safety relief = 0.65 млрд тг</li>
            <li>Chlorination station NaOCl 12% Prominent Sigma + 2× 50 т tanks = 0.42 млрд тг</li>
            <li>Backup DG 5 МВт + UPS 500 кВА 30 мин + automatic transfer ATS = 1.8 млрд тг</li>
            <li>Pipework PCCP Ø2.4 м × 25 км = 8.5 млрд тг</li>
            <li>Cathodic protection ICCP MMO-аноды + monitoring stations каждые 2 км = 0.35 млрд тг</li>
            <li>Flow + pressure metering E+H Promag + Cerabar S + SCADA = 0.65 млрд тг</li>
            <li>City reservoirs 4×30 000 м³ ж/б + roof cover + insulation = 6.5 млрд тг</li>
            <li>Booster stations 4 районных × Wilo Strato BL + VFD + control = 1.8 млрд тг</li>
            <li>SCADA Schneider EcoStruxure / Siemens PCS7 + control room 24/7 = 1.4 млрд тг</li>
            <li>Лаборатория QA daily sampling + ICP-MS + IC + microbiology + GC-MS = 1.2 млрд тг</li>
            <li>Подъезд + ЛЭП 35 кВ + сертификация СанПин РК + проектирование 5% + ПИР + НР + СП + PNR + страхование = 3.2 млрд тг</li>
          </ul>
          <p className="text-slate-300">Итого capex (тг, округл. до млрд):</p>
          <input type="text" value={ex3} onChange={(e) => setEx3(e.target.value)} placeholder="тг" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:border-blue-500 focus:outline-none" />
          {showResults && (
            <div className={`p-4 rounded-lg ${correct.ex3 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}>
              <p className="text-slate-200">
                <strong>Ответ:</strong> ~35 млрд тг (~$73M USD) на водозабор 800 тыс м³/сут
                + насосные I-II + transmission + city reservoirs. Удельная — $90/м³/сут.
                Окупаемость через water tariff $0.30-0.50/м³ × 800 тыс = $90M/year.
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Water hammer protection</h2>
          <p className="text-slate-300">
            Pump trip в НС-1 → water hammer в 25-км pipe. Что нужно по AWWA + ISO 9906?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Просто закрыть pump быстрее" },
              { v: "b", t: "Никакой защиты — pipe сам выдержит" },
              { v: "c", t: "Hydrosphere surge tank N2-pressurised + air-vac valve Vag + check-valve slow-closing + анализ Bentley HAMMER software по AWWA M11 + ISO 9906 + AWWA C504: 1) Phenomenon — резкое closure valve / pump trip → pressure wave скорости c=√(K/ρ) ≈ 1200 м/с distill вверх по pipe, может вызвать pressure spike +100 to +500 psi (overpressure) или -50 psi (vacuum + cavity → reverse hammer); 2) Computation Joukowsky equation ΔP = ρ·c·Δv, для 25 км pipe v=1.5 м/с trip → ΔP = 1000×1200×1.5 = 1.8 МПа = 18 бар overpressure (vs design 10 бар = катастрофа); 3) Hydrosphere — 500 м³ pressurised vessel с N2 blanket cushion (initial pressure 8 бар), при pump trip nitrogen expands освобождая объём для water back-flow, absorption pressure pulse 80-90%; 4) Air-vac vacuum-relief valve VAG Antimoss каждые 1-2 км pipe high points, allows air entry при vacuum для prevent collapse; 5) Slow-closing check valve KSB Boa-RVK или Cla-Val 81-01 с dampening cylinder (closing time 5-10 сек vs instant), uses внутр. spring + counter-weight; 6) Pressure relief valve PRV Bermad 700-PRV set 1.2× design pressure, allows overflow в drain perfectly maint pressure; 7) VFD soft-stop — frequency drive ABB ACS6080 program ramp-down 60 сек from full speed на coast-down, минимизирует Δv; 8) Pipe class upgrade — PCCP Pretensa class 4 (16 бар working + 24 бар surge) с factor of safety 1.5; 9) HAMMER software Bentley / FLUE-IT simulation transient analysis перед commissioning, identifies critical valve closure time + surge protection sizing; 10) Operational protocol — pump start sequence soft-start 30 сек + automatic isolation при unusual pressure; AWWA M11 (Manual of Water Supply Practices) + ISO 9906 + AWWA C504 + Bentley HAMMER + EN 805 + СН РК 4.01-02" },
              { v: "d", t: "Только разгрузить pipe" },
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
            <li><strong>СН РК 4.01-02</strong> — Водоснабжение населённых мест</li>
            <li><strong>СНиП 2.04.02-84*</strong> — Водоснабжение наружные сети</li>
            <li><strong>СанПин РК 2.1.4.1074</strong> — Питьевая вода требования</li>
            <li><strong>WHO Guidelines for Drinking Water Quality 4th</strong></li>
            <li><strong>ISO 24512</strong> — Drinking water service activities</li>
            <li><strong>ISO 9906</strong> — Rotodynamic pumps acceptance tests</li>
            <li><strong>AWWA M11</strong> — Steel Pipe Manual</li>
            <li><strong>AWWA C504</strong> — Rubber-Seated Butterfly Valves</li>
            <li><strong>EN 805</strong> — Water supply requirements</li>
            <li><strong>ISO 4427</strong> — Plastics piping for water supply</li>
            <li><strong>IWA International Water Association Best Practices</strong></li>
            <li><strong>Закон РК «О питьевой воде»</strong> — № 188-VI от 11.07.2017</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
