"use client";
import Link from "next/link";
import { useState } from "react";

export default function RocketEngineTestStandPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 1_500) <= 150;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 38_000_000_000) <= 3_800_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Стенды испытаний ракетных двигателей</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🚀 Стенды испытаний ракетных двигателей</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #290. Байконур стенд НИЦ РКП (Научно-Исследовательский
            Центр Ракетного Производства) для испытаний РД-180 / РД-191
            (200 т тяги, кислород-керосин LOX/RP-1, для ракет «Зенит» и
            «Союз-5 Иртыш»). Аналоги: NASA Stennis Space Center A-Tunnel
            (Apollo F-1 + RS-25 SLS), SpaceX McGregor Texas (Merlin/Raptor),
            ESA Lampoldshausen P3.2 (Vulcain Ariane). Vertical / Horizontal
            test stand с пламеотвод. каналом (flame deflector duct) +
            ablation lining + water deluge 100 000 л/с для cooling +
            sound suppression до 145 дБ. Vibration measurement Brüel & Kjær
            accelerometers 50-2000 Гц на 200+ точках. ASME PTC 51 +
            NASA SP-8120 + ECSS-E-ST-32-10 + СН РК 4.04-04.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав стенда РД-191 vertical 200 т thrust</h2>
          <p className="text-slate-300 leading-relaxed">
            ASME PTC 51 + NASA SP-8120 + NFPA 51A + СН РК 4.04-04:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Test cell (испытательный кубрик):</strong> ж/б монолит 30×30×40 м (B45 W12, армирование A-III двойной сеткой Ø32), стены 2.0 м толщ. для звукоизоляции + radiation shielding от пламени; полу-открытая крыша steel grating для venting горячих газов.</li>
            <li><strong>Engine mount frame:</strong> сталь S690 high-strength frame 5×5×8 м, с load cell HBM C16i 250 т для прямого измерения thrust ±0.1% точность; lateral support struts для side load tolerance.</li>
            <li><strong>Flame deflector duct (пламеотводный канал):</strong> H=15 м depth × W=8 м × L=25 м, наклон 45° от engine vertical → горизонтальный exit; бетон B45 W12 + ablation lining FRP-phenolic 200 мм (отгорает 50-100 мм за один тест, replace каждые 5-10 циклов).</li>
            <li><strong>Water deluge system (вода-distinguisher):</strong> 100 000 л/с × 60 сек = 6 000 м³ (3 насос. group × 2 АНС-Сан 25 м³/с каждая); водозабор из 50 000 м³ pond, разбрызгивание под двигателем для (а) cooling flame deflector до 200 °C, (б) sound attenuation 15-20 дБ через water curtain.</li>
            <li><strong>LOX tank (Liquid Oxygen):</strong> двойной cryogenic tank stainless steel 304L внутри + углеродистая сталь + vacuum-jacketed insulation, объём 100 т (90 м³ при −183 °C plotnost 1140 кг/м³), boil-off rate 0.5%/сут.</li>
            <li><strong>RP-1 tank (kerosene):</strong> stainless 316L tank 35 т (45 м³ при ρ=810 кг/м³), N2-blanket для inert atmosphere, filter 5 мкм перед feed line.</li>
            <li><strong>Pre-press helium tanks:</strong> high-pressure 300 бар He для pneumatic actuators + tank pressurisation, сталь A-516 Gr.70.</li>
            <li><strong>GN2 purge system:</strong> 100 000 м³ inert nitrogen для pre-/post-test purge feed lines + emergency shut-down, prevent O2+kerosene combustion перед start.</li>
            <li><strong>Bunker (control room):</strong> ж/б защищённый бункер 50×30×6 м на 500 м от test cell (за blast shield), персонал 50-100 во время теста, бронестёкла 100 мм Tyvek-laminated для observation; emergency stop кнопки в bunker + outside.</li>
            <li><strong>Vibration measurement:</strong> Brüel & Kjær 4513-001 accelerometers piezoelectric 50-2000 Гц × 200 точек на engine + frame (для structural integrity check), data acquisition LMS Test.Lab system 24-bit 100 ksps.</li>
            <li><strong>Strain gauge — load measurement:</strong> HBM C16i 250 т load cell на main thrust frame ±0.1% точность, secondary lateral cells 50 т на side-struts; calibration с reference load cell ISO 376.</li>
            <li><strong>Temperature instrumentation:</strong> 1000+ thermocouples K + R + B на feedlines + nozzle + combustion chamber (refractory metals 2000 °C max), pyrometer optical Photonfocus для exhaust plume temperature 3000 °C.</li>
            <li><strong>Pressure transducer:</strong> 200+ Kulite pressure sensors strain-gauge type, 100-30 000 psi range на pumps + manifolds + chamber pressure (chamber pressure РД-191 = 280 бар).</li>
            <li><strong>High-speed video:</strong> Phantom V2511 1 Мпикс × 1000 fps для observation injector pattern + valve sequencing + plume; thermal camera FLIR X8500sc 320×256 max 3000 °C.</li>
            <li><strong>Optical access ports:</strong> sapphire viewports Ø100 мм × 6-10 шт в combustion chamber + nozzle, для spectroscopy + thermal imaging; protected by sapphire shield + N2 purge.</li>
            <li><strong>SCADA + DAQ:</strong> National Instruments PXI / Yokogawa DAQ-MX с 1000+ channels × 100 ksps × 16-bit, real-time analysis + safety interlocks (emergency shutdown в 50 ms если parameter out of range).</li>
            <li><strong>Exhaust scrubber:</strong> wet scrubber для NOx + CO scrubbing perform PostBurn, обработка 100 000 м³ горячих газов; output to atmosphere через 80-м стек stack.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Vertical vs Horizontal test stand</h2>
          <p className="text-slate-300">
            РД-191 тяга 196 т, время тестов 200-600 сек. Какая конфигурация
            стенда по NASA SP-8120 + ESA Lampoldshausen опыт?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Horizontal — кладёт engine на бок для удобства" },
              { v: "b", t: "Подвешенный (suspended) — engine висит на крюке" },
              { v: "c", t: "Mobile — на колёсной платформе для гибкости" },
              { v: "d", t: "Vertical fired-down configuration с flame deflector duct по NASA SP-8120 + ASME PTC 51: 1) Vertical fired-down — engine монтируется вверх ногами nozzle-down в раму (как стенд NASA Stennis A-1 для SLS RS-25), пламя направлено вниз в deflector; преимущества — gravity-feed propellants как in flight, простой propellant loading, точное измерение thrust по single load cell; 2) Flame deflector — наклонный канал 45° под engine + ablation lining FRP-phenolic 200 мм (отгорает за каждый длинный тест 30-50 мм, replace до 100 циклов); 3) Water deluge — массовый расход 100 000 л/с × 60 сек = 6000 м³ для (а) cool flame deflector ablative liner до <200 °C, (б) sound attenuation 15-20 дБ через water curtain spray; 4) Sound — РД-191 generates 175 дБ SPL at 100 м (без deluge), с water deluge 145-150 дБ — на границе допустимого для structural integrity нагрузок stand frame; 5) Thrust measurement — single axial load cell HBM C16i 250 т ±0.1% (для axial thrust), 4 lateral 50 т cells для side load tolerance; ISO 376 calibration с reference cell, traceable to NIST; 6) Time history — измерения 100 ksps × 1000+ channels × 600 сек = 60 ГБ raw data per test, real-time analysis + Brüel & Kjær LMS Test.Lab; 7) Safety — bunker control room 500 м от engine + blast shield 30 м ж/б 2 м толщ.; персонал в bunker во время firing; 8) Emergency shutdown ESD — automatic при chamber pressure overshoot >+10% или undershoot >-15% от nominal; valve closure 50 ms (Brennan Industries SS valves); 9) Disadvantages — sealed combustion chamber inside test cell, тяжёлые pumps suspended; gravity не помогает stage separation simulation; 10) Horizontal alternative — для very large engines где vertical mount impractical (RD-180 Energomash, F-1 Apollo) — sideway thrust frame, но требует side load cell + double dead-weight calibration; для РД-191 vertical предпочтительный; ASME PTC 51 + NASA SP-8120 + NASA-STD-5012 + ECSS-E-ST-32-10 + ISO 376 + DIN 5475" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Расход воды deluge</h2>
          <p className="text-slate-300">
            РД-191 тяга 196 т, exhaust mass flow ṁ=623 кг/с, T_exhaust ≈ 3500 K
            (хотя ~3000 °C measured). Тепловой поток на deflector duct
            Q ≈ 30% от мощности engine = 0.3 × 5 ГВт = 1.5 ГВт thermal. Какой
            нужен расход воды deluge для cooling deflector до 200 °C
            (ΔT_water = 80 °C, теплоёмкость 4.18 кДж/кг·°C)? Расход в л/с:
          </p>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="л/с"
            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:border-blue-500 focus:outline-none"
          />
          {showResults && (
            <div className={`p-4 rounded-lg ${correct.ex2 ? "bg-emerald-500/20 border border-emerald-500" : "bg-rose-500/20 border border-rose-500"}`}>
              <p className="text-slate-200">
                <strong>Ответ:</strong> Q = ṁ_water × Cp × ΔT ⇒ ṁ_water = Q / (Cp × ΔT)
                = 1 500 000 кВт / (4.18 × 80) ≈ 4 500 кг/с. С учётом 30% потерь
                на эвакуацию пара + safety margin = 6 000 кг/с водой ≈ 6 000 л/с
                для cooling. Реальная Stennis A-1 deluge ~14 000 л/с
                (overdesign на 2× для max thrust 3300 kN F-1 Apollo), для РД-191
                достаточно ~<strong>1 500 л/с</strong> базового насоса (но с 4-кратной
                redundancy = 6 000 л/с installed capacity). NASA SP-8120.
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Капекс test stand 200 т thrust</h2>
          <p className="text-slate-300">
            Стенд vertical РД-191 200 т thrust LOX/RP-1 + measurement instrumentation «под ключ»:
          </p>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li>Земляные + foundation ж/б 60×60×5 м B45 W12 (для блок-bunker + test cell) = 5.5 млрд тг</li>
            <li>Test cell ж/б монолит 30×30×40 м (стены 2.0 м толщ. + потолок + steel-grating roof) = 8.5 млрд тг</li>
            <li>Flame deflector duct H=15 м B45 + ablation FRP-phenolic 200 мм + steel reinforcement = 3.8 млрд тг</li>
            <li>Engine mount frame steel S690 high-strength 5×5×8 м + load cell HBM C16i 250 т = 2.4 млрд тг</li>
            <li>Water deluge 6 000 л/с (АНС-Сан 25 м³/с × 3) + pond 50 000 м³ + piping = 1.8 млрд тг</li>
            <li>LOX tank 100 т vacuum-jacketed cryo SS 304L + boil-off control + safety relief = 2.2 млрд тг</li>
            <li>RP-1 tank 35 т SS 316L + N2-blanket + filtration 5 мкм = 0.55 млрд тг</li>
            <li>Pre-press He tanks 300 бар × 4 + valves Wendt = 0.85 млрд тг</li>
            <li>GN2 purge supply 100 000 м³ daily + cryo-pump + storage = 1.5 млрд тг</li>
            <li>Bunker control room 500 м от cell + blast shield + bronze stёкла 100 мм = 1.4 млрд тг</li>
            <li>Vibration measurement B&K accelerometers 4513-001 × 200 + LMS Test.Lab system = 0.8 млрд тг</li>
            <li>Strain gauge load cells HBM × 5 + ISO 376 calibration set = 0.45 млрд тг</li>
            <li>Thermocouples K+R+B 1000+ шт + cabling + zero-junction + DAQ Yokogawa = 0.65 млрд тг</li>
            <li>Pressure transducers Kulite 200+ шт + signal conditioning + DAQ = 0.7 млрд тг</li>
            <li>High-speed Phantom V2511 1Мпикс 1000 fps + FLIR X8500sc thermal = 0.4 млрд тг</li>
            <li>Optical sapphire viewports Ø100 мм × 8 шт + N2 purge + spectroscopy Acton = 0.35 млрд тг</li>
            <li>SCADA + DAQ NI PXI 1000 channels × 100 ksps × 16-bit + safety interlock 50 ms = 1.1 млрд тг</li>
            <li>Exhaust scrubber NaOH wet + stack 80 м H = 0.85 млрд тг</li>
            <li>SCADA-комната + офисы engineers + лаборатория calibration ISO 17025 = 0.8 млрд тг</li>
            <li>Подъездная дорога + ЛЭП 35 кВ + сертификация Roscosmos + проектирование 4% + ПИР + НР + СП + PNR + страхование = 3.8 млрд тг</li>
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
                <strong>Ответ:</strong> ~38 млрд тг (~$80M USD) на vertical stand 200 т
                thrust LOX/RP-1. Главные статьи — test cell + deflector + frame
                (35%) + измерительная аппаратура (15%). NASA SP-8120 + ASME PTC 51.
              </p>
            </div>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Hazard analysis</h2>
          <p className="text-slate-300">
            Испытание РД-191 при 196 т тяги. Что обязательно по NASA STD 8719
            + NFPA 51A + ESA Safety Manual?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Никаких особых мер — обычная индустриальная безопасность" },
              { v: "b", t: "Только пожарная сигнализация" },
              { v: "c", t: "Полный комплекс по NASA STD 8719 + NFPA 51A + ECSS-Q-ST-40-04: 1) Hazard zones — 4 концентрических зоны: Zone A (engine cell) — no entry during test (вход 500 м blast radius), Zone B (1-3 км) — restricted, Zone C (3-10 км) — controlled access, Zone D (>10 км) — public; 2) Pre-test safety review — written Test Readiness Review (TRR) с участием test director + safety officer + engine engineer + NASA TIPS audit; 3) Hazard analysis — preliminary hazard list (PHL) + system hazard analysis (SHA) + operating hazard analysis (OHA) per MIL-STD-882E; 4) LOX hazard — cryogenic frostbite + enhanced combustibility (oil + LOX = explosion); LOX-clean equipment (degreased + acetone wash + nitrogen purge), no organic gaskets (только PTFE / Vespel); 5) RP-1 hazard — flammable kerosene flash point +43 °C; explosion-proof electrical IEC 60079 Eex d IIA T2 в RP-1 area; 6) GN2 purge sequence — pre-test 5 air-changes for feedline + post-test 10 air-changes для cooldown engine to <100 °C; 7) Emergency shutdown ESD — 4 trigger conditions: chamber pressure ±10%, mixture ratio off-spec, vibration >RMS limit, fire detector activation; valve closure 50 ms (Brennan SS valves); 8) Fire suppression — Halon 1301 alternative (CO2) deluge всей cell + foam Hi-Ex backup для kerosene fires; ESFR sprinkler dry pipe не используется (вода + LOX = explosion); 9) Bunker design — ж/б 2 м толщ. + blast shield 30 м radius + line of sight закрыт; persons в bunker во время firing (50-100 чел), camera observation only; 10) Post-test inspection — wait 1 hour after shutdown (cool-down + N2 purge) перед entry, mandatory 2-man rule + gas detector + escape harness; NASA STD 8719.13 + NASA SP-8120 + NFPA 51A (Combustible Metals) + NFPA 12 (CO2) + NFPA 30 (Flammable Liquids) + ECSS-Q-ST-40-04 + MIL-STD-882E + IEC 60079 + UN 1077 LOX transport" },
              { v: "d", t: "Только водные огнетушители рядом со стендом" },
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
              {score === 4 && "Отлично! Ты владеешь rocket engine test stands."}
              {score === 3 && "Хорошо. Перечитай NASA SP-8120 + ASME PTC 51."}
              {score === 2 && "Уровень C — пересмотри NFPA 51A + ECSS-Q-ST-40-04."}
              {score <= 1 && "Нужно повторить. См. MIL-STD-882E + ISO 376."}
            </p>
          </section>
        )}

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-cyan-300">Нормативная база</h2>
          <ul className="list-disc list-inside text-slate-300 text-sm pl-2 space-y-1">
            <li><strong>NASA SP-8120</strong> — Liquid Rocket Engine Combustion Stabilization Devices</li>
            <li><strong>NASA STD 8719.13</strong> — Software Safety Standard</li>
            <li><strong>NASA-STD-5012</strong> — Strength and Life Assessment Requirements for Liquid Fuel Rocket Engines</li>
            <li><strong>ASME PTC 51</strong> — Performance Test Code — Rocket Engines</li>
            <li><strong>ECSS-E-ST-32-10</strong> — Structural factors of safety for spaceflight hardware</li>
            <li><strong>ECSS-Q-ST-40-04</strong> — Safety</li>
            <li><strong>NFPA 51A</strong> — Standard for Acetylene Cylinder Charging Plants</li>
            <li><strong>NFPA 30</strong> — Flammable and Combustible Liquids Code</li>
            <li><strong>NFPA 12</strong> — CO2 Fire Extinguishing Systems</li>
            <li><strong>MIL-STD-882E</strong> — Standard Practice for System Safety</li>
            <li><strong>ISO 376</strong> — Calibration of force-proving instruments</li>
            <li><strong>IEC 60079</strong> — Explosive atmospheres (ATEX)</li>
            <li><strong>СН РК 4.04-04</strong> — Машиностроительные здания</li>
            <li><strong>ГОСТ 26824-86</strong> — Стенды испытательные для ракетных двигателей</li>
            <li><strong>Roscosmos РД-50-25.645</strong> — Испытания ЖРД</li>
            <li><strong>UN 1077</strong> — Liquid Oxygen transport classification</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
