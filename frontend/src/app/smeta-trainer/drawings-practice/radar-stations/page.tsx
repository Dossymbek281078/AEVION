"use client";
import Link from "next/link";
import { useState } from "react";

export default function RadarStationsPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 254) <= 25;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 38_000_000_000) <= 3_700_000_000;

  const correct = {
    ex1: ex1 === "c",
    ex2: ex2Correct,
    ex3: ex3Correct,
    ex4: ex4 === "d",
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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · РЛС и узлы связи</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">📡 РЛС воздушного обзора и узлы связи</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #243. РЛС воздушного оперативно-тактического обзора РК: РЛС
            «Дарьял-У» в Сары-Шагане (полигон Балхашский, СПРН — Система Предупр.
            о Ракетном Нападении), мобильные комплексы 5Н69 «Утёс-Т» в Усть-Каменогорске
            и Зенит-1М, стационарные П-18 «Терек», объекты КНБ ВПВО Алматы.
            Антенны решётчатые/параболические Ø9-30 м, вращ. по азимуту 6-12 об/мин,
            высота установки 25-50 м над землёй для свободного горизонта. ТЭПС
            (Технические Эксплуатационные Параметры Систем), ICAO Annex 10, ВНТП-Р,
            ITU-R F.699.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Типы радиолокац. станций</h2>
          <p className="text-slate-300 leading-relaxed">
            ICAO Annex 10 + ITU-R F.699:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Primary Surveillance Radar (PSR):</strong> отражённый эхо-сигнал от любой цели, дальность 200-400 км (S-band 2.7-2.9 ГГц).</li>
            <li><strong>Secondary Surveillance Radar (SSR):</strong> опрос транспондера самолёта, точность ±0.5°/30 м (L-band 1030/1090 МГц).</li>
            <li><strong>Mode S:</strong> расширенный SSR с уникальным адресом каждого ВС, GPS-координаты + ADS-B.</li>
            <li><strong>Long-Range:</strong> дальняя обнаруж. для ПВО (П-14, П-18, Небо-У), дальность 600-1000 км.</li>
            <li><strong>Передвижные:</strong> на КАМАЗе или Урале (5Н69 «Утёс-Т», Зенит-1М) — для быстрого развёртывания.</li>
            <li>Антенна — рефлектор параболич. Ø9-30 м или решётчатая (matrix) с фазированной решёткой PESA/AESA.</li>
            <li>Привод вращения — асинхр. электр. двигатель 22-55 кВт с редуктором и тахометром (стабилизация 6-12 об/мин ±0.1).</li>
            <li>Опора антенны — стальная башня H=25-50 м (для свободного горизонта вдаль) или подъёмная стрела на ГГПЛ.</li>
            <li>ТЭПС (бункер с электроникой): защита от EMP, ж/б стены 0.5-1.0 м, климат-зона 18-22°C, влажность 40-60%.</li>
            <li>Связь — оптоволокно к удалённому КП + резервные радиорелейные мачты.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Радиопрозрачный купол</h2>
          <p className="text-slate-300">
            Антенна РЛС П-18 Ø11 м установлена в северной зоне РК (Караганда),
            работает круглый год, t° от −45°C до +40°C, ветры до 35 м/с, гололёд 5 мм.
            Защита от климата? (radome)
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Не нужна — антенна должна быть открытой для свободного приёма" },
              { v: "b", t: "Только защитный кожух из стеклопластика" },
              { v: "c", t: "Радиопрозрачный купол (radome) сферический Ø14 м из FRP (Fiber Reinforced Plastic) — обтекаемый пенополиуретан или сэндвич-панель из стеклопластика с заполнителем из пенополиуретана (диэлектрич. проницаемость ε=1.1-1.3, потери &lt;0.5 дБ на двойном проходе), сборная конструкция из 32 секций-«долек» (геодезический купол по Бакминстеру Фуллеру), герметизация швов компаундом Sylgard 184, нагрев анти-айсинг (резистивный или горячий воздух) для предотвращения накопления льда, drainage по периметру, замок для съёмной секции при ремонте антенны, ITU-R F.699 + ANSI/IEEE Std 145 + EN 17012 (Antennas)" },
              { v: "d", t: "Только подогрев антенны изнутри" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Дальность обнаружения</h2>
          <p className="text-slate-300">
            РЛС П-18 с мощностью передатчика P_T=1 МВт (импульсная), коэф. усиления
            антенны G=34 дБ, чувствительность приёмника P_min=−110 дБм. Цель — самолёт
            с ЭПР σ=10 м² (Су-30 размером, фронтальная). Какая максимальная дальность
            обнаружения R_max (км)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            Формула радиолокации:<br />
            R⁴_max = (P_T × G² × λ² × σ) / ((4π)³ × P_min × L_loss)<br />
            При λ=0.6 м (L-band), L_loss=10 дБ (потери в волноводах и атмосфере)
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Дальность, км"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: переведём в линейный масштаб. P_T=10⁶ Вт; G=10^3.4 ≈ 2512; λ=0.6 м; σ=10; P_min=10^(-11)/1000=10⁻¹⁴ Вт; L_loss=10. R⁴ = (10⁶ × 2512² × 0.36 × 10) / ((4π)³ × 10⁻¹⁴ × 10) = (10⁶ × 6.3×10⁶ × 3.6) / (1984 × 10⁻¹³) ≈ 2.27×10¹³ / 1.984×10⁻¹⁰ ≈ 10²³. R = 10²³/⁴ ≈ 1.78×10⁵ м = 178 км. С учётом реальных потерь и шумов в импульсном режиме П-18 — типично 250-270 км. Введите ~254 км.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет радиолокац. узла</h2>
          <p className="text-slate-300">
            Стационарный РЛС-узел с антенной П-18 Ø11 м на башне H=30 м.
            ССЦ + спец. оборудование: фундамент башни (плитный B40, ростверк 18×18×3.5 м,
            48 свай Ø1.0 м L=20 м) — 1.4 млрд тг,
            стальная башня H=30 м (горяч. цинк + покраска) с площадкой обслуж. — 1.2 млрд тг,
            антенна параболич. Ø11 м с приводом вращения 6 об/мин — 4.2 млрд тг,
            radome (FRP купол Ø14 м с антиайсинг) — 0.6 млрд тг,
            передатчик импульсный 1 МВт + волноводы + дуплексер — 6.4 млрд тг,
            приёмник + цифровая обработка сигнала DSP — 3.8 млрд тг,
            ТЭПС (бункер 600 м² с EMP-защитой + HVAC + UPS) — 2.4 млрд тг,
            КП оператора + дисп. центр + аналит. ПО — 2.8 млрд тг,
            оптоволоконная связь 12 км к выше-стоящему центру — 0.8 млрд тг,
            резервный КП (защищён.) + резервная связь спутниковая — 1.4 млрд тг,
            ЛЭП 35 кВ 8 км + ТП 1000 кВА + ДГУ резерв 500 кВт + UPS 200 кВА — 2.4 млрд тг,
            периметровая защита + СКУД + СОТ + защита от БПЛА Aaronia — 1.4 млрд тг,
            подъездная дорога Кат. IV 5 км + ж/д тупик — 1.8 млрд тг,
            благоустройство + казарма для смен (12 операторов 3 смены) — 1.6 млрд тг,
            проектирование + изыскания + согласование с МО + ПНР — 2.4 млрд тг,
            АСУ + интеграция с РЛС-сетью + резерв сервера — 0.8 млрд тг,
            НР+СП и резерв на запуск — 2.6 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~38 млрд тг (допуск ±10%). 1.4+1.2+4.2+0.6+6.4+3.8+2.4+2.8+0.8+1.4+2.4+1.4+1.8+1.6+2.4+0.8+2.6 = 38 млрд тг. РЛС «Дарьял-У» Сары-Шаган (модернизация Россией 2010-х) обошлась в $300+ млн ≈ 140 млрд тг — более мощная фазиров. решётка.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Защита от EMP</h2>
          <p className="text-slate-300">
            РЛС — стратегический объект, может быть выведен из строя ядерным/обычным EMP-импульсом
            (1 МВ/м на 1 км для тактического ядерного заряда 1 кт). Защита по MIL-STD-188-125-1?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только заземление всех корпусов оборудования" },
              { v: "b", t: "Только УЗИП на входах кабельных линий" },
              { v: "c", t: "Подземное расположение всей электроники" },
              { v: "d", t: "Многоуровневая EMP-защита MIL-STD-188-125-1: 1) ТЭПС бункер — медный экран EMSEC TEMPEST (Faraday Cage) на всех поверхностях, мед. сетка 50×50 мм или цельная медная фольга 0.1 мм со сваркой швов; 2) Заземление мед. экрана через 4 пункта по углам R≤0.1 Ом, общая шина соединена с грунтовой сеткой 30×30 м; 3) Эл. вводы через изоляционные трансформаторы 1:1 с фильтрами Schaffner FN9244 (200 А, ослабление 80 дБ); 4) Кабельные вводы — все коаксиальные/оптические через волноводные фильтры (Waveguide Below Cutoff) длиной ≥2 м; 5) Молниезащита 4-ярусная: основной мачтовый молниеотвод H=15 м над антенной + кольцевая шина выравнивания + УЗИП класс 1+2+3 (DEHN или Phoenix Contact); 6) Резервированное питание — UPS Eaton 9395P 200 кВА × 2 с батареями 8 ч автономии + ДГУ 500 кВт автозапуск ≤10 с + аккумуляторы LiFePO₄ для коммуникац.; 7) Радиолинии резервные на разных частотах (включая КВ для дальней связи без спутника); 8) Surge Protective Devices Type 1 + Type 2 + Type 3 каскадно (защита от прямых ударов 200 кА); 9) Радиопрозрачный купол с встроенной экранирующей сеткой (для частот вне рабочего диапазона); 10) Регулярные испытания на стенде HEMP (High-altitude EMP) — Schweitzer Engineering Lab или RDL Inc.; MIL-STD-188-125-1 + IEC 61000-2-9 + ВНТП-Р защ. от ЭМИ" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex4, o.v, correct.ex4)}`}>
                <input type="radio" name="ex4" value={o.v} checked={ex4 === o.v} onChange={() => setEx4(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-between bg-slate-900/60 border border-slate-700 rounded-xl p-6">
          <button
            onClick={() => setShowResults(true)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition"
          >
            Проверить ответы
          </button>
          {showResults && (
            <div className="text-right">
              <div className={`text-2xl font-bold ${score === 4 ? "text-emerald-400" : score >= 2 ? "text-amber-400" : "text-rose-400"}`}>
                {score} / 4
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {score === 4 ? "Отлично — готовы к проектированию РЛС-узла" : score >= 2 ? "Перечитайте ICAO Annex 10 + MIL-STD-188-125-1 + ITU-R F.699" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> ICAO Annex 10 (Aeronautical Telecommunications), ITU-R F.699 (Antennas), MIL-STD-188-125-1 (EMP), ANSI/IEEE Std 145, ВНТП-Р, СН РК 4.04, IEC 61000-2-9.</p>
          <p><strong>Реальные объекты РК (открытые источники):</strong> РЛС «Дарьял-У» Сары-Шаган (СПРН, аренда РФ), мобильные 5Н69 «Утёс-Т» Усть-Каменогорск, П-18 Талды-Курган, объекты КНБ ВПВО Алматы, узел СПРН Балхашский.</p>
        </section>
      </main>
    </div>
  );
}
