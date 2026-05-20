"use client";
import Link from "next/link";
import { useState } from "react";

export default function SpacePayloadProcessingPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 3_000) <= 300;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 45_000_000_000) <= 4_500_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · PIF — обработка полезной нагрузки</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🛰️ PIF — Payload Integration Facility</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #288. Байконур MIK ППО (Монтажно-Испытательный Корпус
            Подготовки ПО) для подготовки спутников и пилотируемых ПН перед
            запуском (ширина 60 м, длина 200 м, ВРС 30 м). Аналоги:
            ESA Kourou S5 PPF, NASA KSC PHSF Vehicle Assembly Building VAB
            (160 м H), CASC Wenchang LC-2 PIF. Чистые комнаты ISO 14644 класс
            8 (100 000 частиц/м³ ≥0.5 мкм) для сборки ПН + класс 7 для optical
            payload, HVAC HEPA H14 + 50-100 air changes/hr + температура
            20±2 °C / RH 50±10%. Заправка гидразином N2H4 (toxic, LC50=560 ppm)
            в hazardous fueling hall с anti-explosive HVAC + Halon 1301 fire
            suppression. ECSS-Q-ST-70-50 + NASA-STD-6001 + ISO 14952 + СН РК 4.04-04.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав PIF Payload Integration Facility</h2>
          <p className="text-slate-300 leading-relaxed">
            ECSS-Q-ST-70-50 + NASA-STD-6001 + ISO 14644 + СН РК 4.04-04:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>High Bay (главный зал):</strong> 60×200×30 м, ВРС 30 м, monolithic concrete floor B40 W12 для нагрузок 50 т/м² (рулевые телескопические опоры спутников), нулевая статическая электризация (special anti-static epoxy coating).</li>
            <li><strong>Кран overhead bridge crane:</strong> Demag 300 т грузоподъёмность × 50 м пролёт × 25 м height-of-lift, скорость micro-mode 0.1 м/мин (для precise mating fairing к ракете), redundant brake system.</li>
            <li><strong>Чистая комната ISO 14644 класс 8 (100 000 частиц/м³ ≥0.5 мкм):</strong> вся зона сборки ПН с HEPA H14 99.995% (Camfil Megalam) на потолке + воздушный экран positive pressure +25 Па; температура 22±2 °C, RH 50±10%.</li>
            <li><strong>Чистая комната ISO 14644 класс 7 (10 000 частиц/м³):</strong> для optical payload (Telescope mirror, IR detectors), 100 air changes/hr.</li>
            <li><strong>Шлюзы (Personnel/Equipment Airlock):</strong> 5×5 м + 3×3 м с одно-направ. door interlock + air shower 30 сек + sticky mat floor; персонал в бахилы Tyvek + cleanroom garments Coverstar.</li>
            <li><strong>Hazardous fueling hall (зал заправки):</strong> ATEX Zone 1, separate from clean room через decontamination chamber; заправка гидразином N2H4 / MMH (Monomethyl Hydrazine) + NTO oxidiser (Nitrogen Tetroxide N2O4) для bipropellant rocket engines спутников.</li>
            <li><strong>SCAPE suit (Self-Contained Atmospheric Protective Ensemble):</strong> ILC Dover полный изолированный костюм с PLSS жизнеобеспечения 30 мин O2, для заправщиков hydrazine; sealed visor + radio communication.</li>
            <li><strong>Spin balancing test stand:</strong> Schenck dynamic balancer 100 т грузоподъёмность × 0-1000 rpm для balancing satellite rotor + проверка центра масс ±0.5 мм (критично для spin-stabilised sat).</li>
            <li><strong>Thermal-vacuum chamber TVC:</strong> цилиндр Ø8 м H=15 м, vacuum 10⁻⁶ мбар (Pfeiffer turbomolecular pumps + Sumitomo cryopump) + LN2 shroud −180 °C + IR heater +150 °C (имитация орбитального thermal-cycling 100+ циклов).</li>
            <li><strong>Acoustic chamber:</strong> reverberation chamber 600 м³ × 145-150 дБ SPL (имитация sound во время liftoff ракеты), TestLine / Brüel & Kjær multi-channel speaker array.</li>
            <li><strong>Vibration table (mechanical shaker):</strong> LDS / Unholtz-Dickie electrodynamic shaker 80 кН × 50-2000 Гц, sine + random + shock testing по NASA GEVS / ECSS-E-ST-32-10.</li>
            <li><strong>EMC anechoic chamber:</strong> 20×20×15 м фарадей-cage Cu mesh 2×2 мм + RF-absorbing foam ETS-Lindgren, для EMI/EMC testing по MIL-STD-461 + ECSS-E-ST-20-07.</li>
            <li><strong>Anti-explosive HVAC:</strong> ATEX Eex d IIA T3 (для hydrazine vapor), Halon 1301 fire suppression total flooding 5 кг/м³ (NFPA 12A), gas detection Drager Polytron NH3-sensor каждые 5 м.</li>
            <li><strong>Personnel facility:</strong> changing rooms 200-400 чел, gowning sequence (street → garment → cleanroom), washing station for cleanroom suits (Class 100 laundry).</li>
            <li><strong>Метрологическая лаб + QA:</strong> CMM Zeiss PRISMO 5×3×3 м coordinate measuring (±2 мкм) + laser tracker Faro Vantage для геометрии 30 м диапазона, calibration все измерительные средства ISO 17025.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Classification Cleanroom</h2>
          <p className="text-slate-300">
            Спутник KazSat-3 в PIF Байконур. Какой класс по ISO 14644 + ECSS-Q-ST-70-50?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "ISO 9 (300 000 частиц/м³) — обычная мастерская" },
              { v: "b", t: "ISO 14 — нет такого класса" },
              { v: "c", t: "ISO 14644 класс 5 (Class 100) — too strict, для микроэлектроники не нужно" },
              { v: "d", t: "ISO 14644 класс 8 для main assembly (Class 100 000) + класс 7 для optical payload (Class 10 000) по ECSS-Q-ST-70-50 + ESA PA Standards: 1) ISO 14644-1 классификация — class 8 = max 3 520 000 particles ≥0.5 мкм/м³, class 7 = 352 000, class 6 = 35 200, class 5 = 3 520 (Class 100); 2) For satellite assembly главное правило — class 8 sufficient для structural assembly (не optical-sensitive parts), HEPA H13 99.95% efficiency + 30-50 air changes/hr; 3) Для optical payload (Telescope mirrors, IR sensors, star trackers) — class 7 mandatory: H14 99.995% + 60-100 air changes/hr; mirror contamination 1 particle 5 мкм может ruin spectral performance; 4) HVAC design — laminar airflow ceiling-to-floor 0.45 м/с (uni-directional), terminal HEPA H14 filters Camfil Megalam с DOP test certificate каждый год; 5) Positive pressure +25 Па к external corridor (+15 Па к coridor → +10 Па к clean) для prevention contamination ingress; 6) Personnel — gowning sequence: street clothes → smock → cleanroom suit Tyvek IsoClean → bonnet + booties + nitrile gloves + face mask, no skin exposed; 7) Materials — все equipment должно быть outgassing-low по ASTM E595 (TML <1%, CVCM <0.1%) — special concern для plastics + adhesives + paints на satellite parts; 8) Particle monitoring — Lasair III + Met One 3413 portable counters 28.3 L/min, real-time monitoring 6 точек/100 м² floor area, weekly NEBB certification; 9) Surface cleanliness — IEST-STD-CC1246 уровни 50-300 (max particle size 50-300 мкм на 0.1 м²), wipe testing methods ASTM E2090; 10) Contamination control plan — обязательный документ ECSS-Q-ST-70-50 на каждый payload: пред-/во время-/пост-flight cleanliness budget, контактные материалы, газовая среда, monitoring schedule; ECSS-Q-ST-70-50 + NASA-STD-6001 + ISO 14644-1/-2 + IEST-STD-CC1246 + ASTM E595 + MIL-STD-1246" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Объём чистой комнаты</h2>
          <p className="text-slate-300">
            PIF main hall 60×200×30 м = 360 000 м³. Из них чистая комната
            class 8 занимает 25% (Mating + Final Assembly), class 7 — 5%
            (optical bay). Air changes для class 8 = 50/час, для class 7 = 80/час.
            Какова часовая производительность HVAC (тыс. м³/час)?
          </p>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="тыс. м³/час"
            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:border-blue-500 focus:outline-none"
          />
          {showResults && (
            <div className={`p-4 rounded-lg ${correct.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}>
              <p className="text-slate-200">
                <strong>Ответ:</strong> Class 8 zone: 360 000 × 25% × 50/час = 4 500 000 м³/час.
                Class 7 zone: 360 000 × 5% × 80/час = 1 440 000 м³/час.
                Общая ≈ <strong>3 000 тыс м³/час</strong> (около 6 млн с учётом
                non-cleanroom HVAC + offices). Это ~150 МВт холодильной
                нагрузки на HVAC, поэтому PIF Байконур имеет свой чиллер-холод
                CARRIER AquaForce 1200 МВт холода. ECSS-Q-ST-70-50.
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс PIF Байконур</h2>
          <p className="text-slate-300">
            PIF Payload Integration Facility 60×200×30 м «под ключ»:
          </p>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>Земляные + фундамент monolitic ж/б плита B40 W12 50 т/м² (12 000 м² × 35 000 тг) = 0.42 млрд тг</li>
            <li>Каркас стальной + monolitic ж/б опоры ВРС 30 м (12 000 м² × 95 000 тг) = 1.14 млрд тг</li>
            <li>Сэндвич стены + кровля Kingspan PIR 200 мм (3 800 м² фасад + 12 000 м² кровля × 22 000 тг) = 0.35 млрд тг</li>
            <li>Эпокс. пол antistatic + lacobel + 0.1 Ω/sq grounded (12 000 м² × 12 000 тг) = 0.14 млрд тг</li>
            <li>Bridge crane Demag 300 т 50 м span 25 м H-lift + micro-mode = 6.5 млрд тг</li>
            <li>Чистая комната ISO 14644 класс 8 (3 000 м² × 250 000 тг + HEPA H14 Camfil Megalam) = 0.95 млрд тг</li>
            <li>Чистая комната класс 7 optical bay (600 м² × 380 000 тг) = 0.23 млрд тг</li>
            <li>HVAC 3 млн м³/ч + chiller Carrier AquaForce 1200 МВт холод + 4 AHU = 8.5 млрд тг</li>
            <li>Personnel airlocks + gowning rooms + air showers 6 шт = 1.8 млрд тг</li>
            <li>Hazardous fueling hall ATEX Zone 1 + Halon 1301 system 5 кг/м³ + N2H4 storage = 4.5 млрд тг</li>
            <li>SCAPE suits ILC Dover × 12 + PLSS + decon shower + emergency washdown = 1.2 млрд тг</li>
            <li>Spin balancing Schenck 100 т 0-1000 rpm = 2.8 млрд тг</li>
            <li>Thermal-vacuum chamber TVC Ø8 м H=15 м + cryopump + LN2 shroud = 6.5 млрд тг</li>
            <li>Acoustic chamber 600 м³ + B&K speaker array 145 дБ = 2.2 млрд тг</li>
            <li>Vibration shaker LDS 80 кН + cooling + control system = 1.8 млрд тг</li>
            <li>EMC anechoic chamber 20×20×15 м Faraday + ETS-Lindgren foam = 3.4 млрд тг</li>
            <li>Метрологическая лаб CMM Zeiss PRISMO + Faro Vantage laser tracker = 1.5 млрд тг</li>
            <li>SCADA + DCS + monitoring particle counters + EMS = 0.85 млрд тг</li>
            <li>Адм. блок 2000 м² + кабинеты engineering + конференц-зал + lab QA = 1.6 млрд тг</li>
            <li>ECSS-Q-ST-70-50 audit + NASA TIPS + Roscosmos certification + проектирование 4% + ПИР + НР + СП + commissioning + insurance = 0.95 млрд тг</li>
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
                <strong>Ответ:</strong> ~45 млрд тг (~$95M USD) на PIF под ключ.
                Удельная — $8000/м² (vs обычный production hall $1000-1500/м²).
                Главные статьи — HVAC 19% + краны/balancing/TVC 30%. ECSS Standards.
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Hydrazine safety</h2>
          <p className="text-slate-300">
            Заправка спутника гидразином N2H4 (toxic, carcinogen, hypergolic
            с NTO). Что обязательно по NASA STD 8719.17 + ECSS-Q-ST-40-04?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Обычная промышленная вентиляция + резиновые перчатки" },
              { v: "b", t: "Только маска N95 типа covid" },
              { v: "c", t: "Полный комплекс по NASA STD 8719.17 + NFPA 12A + ATEX: 1) Hazard classification — N2H4 toxic (TLV-TWA 0.01 ppm OSHA, LC50 inhalation 560 ppm/4h), carcinogen IARC 2B, flammable (LEL 4.7-100% в air), hypergolic с NTO (instantaneous ignition при контакте); 2) Facility — separate building от main PIF через 30 м wall + decontamination chamber + dedicated HVAC (отсасывает к scrubber NaOH neutraliser, не recirculate в clean room); 3) ATEX Zone 1 classification — все electrical Eex d IIA T3, fully sealed JB, intrinsically safe instrumentation; 4) Fire suppression — Halon 1301 total flooding 5 кг/м³ (NFPA 12A), CO2 backup, ESFR sprinkler dry pipe; 5) PPE — SCAPE suit ILC Dover полная изоляция с PLSS 30-min O2 + viseofac, никаких goggles или регулярных респираторов (N2H4 absorbs через skin!); 6) Detection — Drager Polytron N2H4-sensor каждые 3-5 м, alarm 0.05 ppm, evacuation 0.1 ppm, automatic ESD при 1 ppm; 7) Spill response — neutralisation с NaOCl bleach 5% solution (oxidises N2H4 → N2 + H2O + HCl), emergency wash station 5 минут eyewash + body shower; 8) Transport N2H4 to facility — special tank truck UN 2029 PG I + escort + GPS tracking + Schedule 80 SS pipe rigid + всё bonded grounded; 9) Storage — Schedule 80 304L SS tank 1-5 т, double-wall с N2 blanket (prevent air oxidation N2H4 → diaminoazine), monthly verification по chem analysis; 10) Training + Permit — 80-hr hazmat training + annual refresher, written hot work permit для каждой fueling operation (manager signature + safety officer + medical standby с antidote vitamin B12 hydroxocobalamin), drill 4 раза/год; NASA STD 8719.17 + NFPA 12A + ECSS-Q-ST-40-04 + IEC 60079 ATEX + OSHA 29 CFR 1910.119 PSM + UN 2029" },
              { v: "d", t: "Только дистанционно работа без персонала" },
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
              {score === 4 && "Отлично! Ты знаешь ECSS + NASA PA Standards."}
              {score === 3 && "Хорошо. Перечитай ECSS-Q-ST-70-50 + NASA-STD-6001."}
              {score === 2 && "Уровень C — пересмотри ISO 14644 + IEST CC1246."}
              {score <= 1 && "Нужно повторить. См. NASA STD 8719.17 + NFPA 12A."}
            </p>
          </section>
        )}

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-cyan-300">Нормативная база</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li><strong>ECSS-Q-ST-70-50</strong> — Particles contamination control (European Cooperation for Space Standardization)</li>
            <li><strong>ECSS-E-ST-32-10</strong> — Structural factors of safety for spaceflight hardware</li>
            <li><strong>ECSS-E-ST-20-07</strong> — Electromagnetic compatibility</li>
            <li><strong>ECSS-Q-ST-40-04</strong> — Safety</li>
            <li><strong>NASA-STD-6001</strong> — Flammability, Odor, Offgassing and Compatibility Requirements</li>
            <li><strong>NASA STD 8719.17</strong> — Hazardous Operations Safety</li>
            <li><strong>NASA-HDBK-4002</strong> — Mitigating In-Space Charging Effects</li>
            <li><strong>ISO 14644-1/-2</strong> — Cleanrooms and associated controlled environments classification</li>
            <li><strong>ISO 14952</strong> — Surface cleanliness of fluid systems</li>
            <li><strong>IEST-STD-CC1246</strong> — Product Cleanliness Levels</li>
            <li><strong>ASTM E595</strong> — Total Mass Loss and Collected Volatile Condensable Materials Outgassing</li>
            <li><strong>MIL-STD-461</strong> — Requirements for the Control of Electromagnetic Interference</li>
            <li><strong>MIL-STD-1540</strong> — Test Requirements for Launch, Upper-Stage, and Space Vehicles</li>
            <li><strong>NFPA 12A</strong> — Halon 1301 Fire Extinguishing Systems</li>
            <li><strong>IEC 60079</strong> — Explosive atmospheres (ATEX)</li>
            <li><strong>UN 2029</strong> — Hydrazine, anhydrous transport regulations</li>
            <li><strong>СН РК 4.04-04</strong> — Машиностроительные здания</li>
            <li><strong>OSHA 29 CFR 1910.119 PSM</strong> — Process Safety Management</li>
            <li><strong>Roscosmos GOST P 75</strong> — Космическая техника</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
