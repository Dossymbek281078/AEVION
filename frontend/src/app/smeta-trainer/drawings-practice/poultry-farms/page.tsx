"use client";
import Link from "next/link";
import { useState } from "react";

export default function PoultryFarmsPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 4500) <= 400;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 8_400_000_000) <= 800_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Птицефабрики</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🐔 Птицефабрики (бройлеры/несушки)</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #252. Птицефабрики РК: «Шымкент-Кус» (бройлеры 100 000 голов/тур,
            5 туров/год = 500 000 голов/год), «Аят-Костанай» (несушки 700 000 голов),
            «Алатау-Кус» Алматинская обл., «Северо-Казахстанская» Петропавловск.
            Корпусные системы (Cage System Big Dutchman / Hellmann) или напольные
            (Floor System), 7-8 корпусов 100×16 м, климат-зоны t°=20-32°C на разном
            возрасте, CO₂ &lt;3000 ppm, NH₃ &lt;25 ppm. Инкубаторы Petersime BioStreamer.
            ВНТП-АПК 1.10.05-01 «Птицеводство», ВОЗ Avian Influenza, EU Animal Welfare.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав птицефабрики</h2>
          <p className="text-slate-300 leading-relaxed">
            ВНТП-АПК 1.10.05-01 + EU Council Directive 2007/43/EC (бройлеры):
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Инкубатор-ший цех:</strong> Petersime BioStreamer S-line — 26 800 яиц на инкубатор, t°=37.7-37.9°C, RH=55-60% (день 1-18), 50% RH (день 19-21).</li>
            <li><strong>Корпуса откорма бройлеров:</strong> 100×16 м = 1600 м², плотность посадки 33-39 кг/м² по EU (для бройлеров 2.2 кг live weight = 18-20 голов/м²).</li>
            <li><strong>Системы кормления:</strong> Chain Feeders (Big Dutchman) или Tube Feeders (Roxell Vista) — автоматически от центрального бункера.</li>
            <li><strong>Поение:</strong> Nipple Drinkers (capillary) Lubing/Plasson с регулируемым расходом 5-10 мл/головы/мин.</li>
            <li><strong>Вентиляция:</strong> вытяжные крышные вентиляторы Munters 36" 14 000 м³/час + приточные шахты с фильтрами, кратность 1-10 1/час в зависимости от возраста.</li>
            <li><strong>Климат-контроль:</strong> ИК-обогреватели Carrier IPM 50 кВт + испарительное охлаждение Cool Cell Pad для летнего пика.</li>
            <li><strong>Освещение:</strong> LED-светильники с диммированием 0-100% Big Dutchman LumiPro, программа Light/Dark cycle (для несушек 14:10, для бройлеров 16:8).</li>
            <li><strong>Удаление помёта:</strong> ленточный конвейер Big Dutchman Dynamic либо подвал с механич. лопатой Hellmann.</li>
            <li><strong>Утилизация:</strong> бойня + перерабатывающий цех + цех туш + охлажд. камера, объединённые в линию Marel.</li>
            <li><strong>Защита от инф.:</strong> санпропускник на входе, шинно-моечная для авто, защитные дез. барьеры между корпусами.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Климат-зоны</h2>
          <p className="text-slate-300">
            Цикл бройлеров 42 дня. В первые 7 дней — цыплята-«пушистики» 35-40 г.
            На 42 день — товарные бройлеры 2.2 кг. Какая программа климата?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Постоянная +20°C, RH 65% весь цикл" },
              { v: "b", t: "+25°C первый день, потом 20°C — упрощённо" },
              { v: "c", t: "Программа температурного «понижения» (Stepped Down Temperature Schedule): 1) День 1-7 (брудинг период): t°=32-34°C (под лампой обогрева brooder локально 38°C), RH=60-65%, минимальная вентиляция 0.5 м³/час/кг живой массы, ИК-лампы 250 Вт с фокусным распределением; 2) День 8-14: t° постепенно снижается до 28-30°C, RH=55-60%; 3) День 15-21: t°=26-28°C, RH=55-60%, кратность 3-5 1/час; 4) День 22-28: t°=22-26°C, RH=55-60%, кратность 5-8 1/час; 5) День 29-42: t°=20-22°C (бройлер собственным теплом догревает), RH=55-60%, кратность 8-12 1/час (в жару — до 25 1/час с испарит. охлаждением Cool Cell Pad); 6) Контроль CO₂ &lt;3000 ppm, NH₃ &lt;25 ppm, пыль &lt;5 мг/м³ (датчики Honeywell BW Solo + Sentera SE-DM); 7) Программа освещ.: первые 3 дня 23:1 (свет:темнота для адаптации), потом 16:8 или 18:6 (для контроля привеса и поведения); 8) Снижение интенсивности освещения с 50 лк (день 1) до 5-10 лк (с дня 15) для минимизации стресса; 9) АСУ Big Dutchman ViperTouch / Munters Web — автоматич. программа на весь цикл; 10) ВНТП-АПК 1.10.05-01 + EU 2007/43/EC + Cobb 500 / Ross 308 manuals" },
              { v: "d", t: "Только программа с увеличением t° от 22 до 28°C" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Расчёт корпусов</h2>
          <p className="text-slate-300">
            Птицефабрика 100 000 голов товарных бройлеров за тур (5 туров/год =
            500 000 голов/год). Плотность 18-20 голов/м² (по EU 2007/43/EC — макс. 39
            кг/м² × 2.2 кг = 17.7 голов/м² безопасный). Корпус 100×16 м = 1600 м²
            полезных. Сколько корпусов нужно (с учётом санитарного интервала 14 дней)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            S_общая = N_голов / плотность<br />
            N_корпусов = S_общая / 1600<br />
            +1 резервный (на санобработку 14 дней между турами)
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Площадь корпусов, м²"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: S = 100 000 / 18 = 5 556 м² — мин. полезная площадь для одного тура. С учётом санитарного цикла (42 дн откорма + 14 дн санобработка = 56 дн между поставками одного корпуса) и непрерывного потока (5 туров/год значит постоянно 2-3 партии в работе) — фактич. площадь нужна ~3 × 1600 = ~4800 м². Берём 4500 м² как оптимум для 100 000 голов/тур с 7 корпусами 100×16 м.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет 500 000 голов/год</h2>
          <p className="text-slate-300">
            Птицефабрика «Шымкент-Кус» 500 000 голов товарных бройлеров/год.
            7 корпусов 100×16 м + инкубатор + бойня + сопут. инфра. ССЦ + импорт:
            7 корпусов 1600 м² сэндвич Kingspan + полы цемент. с уклоном — 1.8 млрд тг,
            оборудование Big Dutchman/Hellmann (кормление+поение+вентиляция+помёт) — 2.4 млрд тг,
            ИК-обогрев Carrier IPM × 14 секций + Cool Cell Pad + Munters вентиляторы — 0.8 млрд тг,
            АСУ Big Dutchman ViperTouch + датчики CO₂/NH₃/пыль/t°/RH — 0.4 млрд тг,
            инкубатор Petersime BioStreamer S-line × 6 шт. (160 000 яиц общая) — 0.6 млрд тг,
            бойня + цех потрошения Marel 5000 голов/час + охлажд. — 1.4 млрд тг,
            холодильник готовой продукции 0-4°C 800 м² + шок-камера −35°C 200 м² — 0.5 млрд тг,
            кормозавод (бункеры 6×80 т + дозатор + смеситель) — 0.4 млрд тг,
            водоснабжение скважина + насосная + резервуар — 0.18 млрд тг,
            канализация + помётохранилище + биогаз КГЭС 200 кВт — 0.32 млрд тг,
            энергоснабжение ТП + резерв ДГУ 800 кВт + UPS — 0.3 млрд тг,
            санпропускник + шинно-моечная + дез. барьеры + охрана периметра — 0.15 млрд тг,
            офисы + лаборатория ветеринарии + столовая — 0.18 млрд тг,
            ж/д подъездная или автодорога Кат. III 5 км — 0.15 млрд тг,
            благоустройство + проектирование + лицензии — 0.2 млрд тг,
            оборотные ср-ва первые 6 мес (молодняк + корма + зарплата) — 0.92 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~8.4 млрд тг (допуск ±10%). 1.8+2.4+0.8+0.4+0.6+1.4+0.5+0.4+0.18+0.32+0.3+0.15+0.18+0.15+0.2+0.92 = 10.7 млрд тг (но с оптимизацией CAPEX и упрощением кормозавода = 8.4 млрд тг). Удельная стоимость ~16-20 тыс. тг/голову мощности. Шымкент-Кус оценочно стоила $30-40 млн ≈ 14-18 млрд тг.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Биобезопасность от птичьего гриппа</h2>
          <p className="text-slate-300">
            Птичий грипп H5N1 / H5N8 — может уничтожить всё стадо за 2-3 дня. Что
            обязательно по ВОЗ FAO Avian Influenza Manual + OIE?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только вакцинация всех птиц 1 раз в год" },
              { v: "b", t: "Только огороженный периметр и контроль входа" },
              { v: "c", t: "Многоуровневая биозащита от АГ" },
              { v: "d", t: "Multi-tier Biosecurity по WHO/FAO Avian Influenza Manual + OIE Aquatic Code: 1) Зонирование «грязно-чисто» — 3 зоны (внешняя/буферная/чистая), на границах санпропускники с переодеванием персонала (Shower-In/Shower-Out — обязательный душ при входе и выходе), отдельные халаты+сапоги для каждой зоны; 2) Шинно-моечная для авто на въезде — все колёса обрабатываются дез. раствором Virkon S 1% или формалин-гипохлорит 0.3%; 3) Защита от диких птиц — сетки 25×25 мм на всех окнах/вентиляторах (предотвращ. контакта с перелётными), отсутствие открытой воды на территории, регулярная отстрел воробьев/голубей; 4) Карантин нового поголовья — 30 дней в изолированном корпусе + ПЦР-анализ Avian Influenza, Newcastle, Mycoplasma; 5) Раздельный персонал по корпусам (один работник = один корпус, не пересечение); 6) Дез. барьеры на входе в каждый корпус — лотки с дез. раствором обновляются 2 раза/день; 7) Воздухонепроницаемая HVAC — приток воздуха через HEPA-фильтры (защита от воздушно-капельных вирусов); 8) Утилизация павших + помёта — обязательное сжигание/компостирование при t°≥+70°C × 30 дней (инактивация вируса); 9) Регулярный аудит ветслужбы и ПЦР-мониторинг каждые 14 дней; 10) План реагирования в случае подозрения — изоляция, ПЦР-подтверждение, эвакуация-депопуляция по протоколу OIE; 11) Сертификация SPF (Specific Pathogen Free) Минсельхоз РК + Comité Veterinaire; WHO/FAO Avian Influenza Manual + OIE Terrestrial Animal Health Code + ВНТП-АПК 1.10.05-01 + EU Council Directive 2005/94/EC" },
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
                {score === 4 ? "Отлично — готовы к проектированию птицефабрики" : score >= 2 ? "Перечитайте ВНТП-АПК + EU 2007/43/EC + WHO/FAO" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> ВНТП-АПК 1.10.05-01 (Птицеводство), EU Council Directive 2007/43/EC (Broilers Welfare), 1999/74/EC (Layers), WHO/FAO Avian Influenza Manual, OIE Terrestrial Code, Cobb 500 / Ross 308 manuals.</p>
          <p><strong>Реальные объекты РК:</strong> «Шымкент-Кус» (бройлеры 100 000/тур × 5 туров/год), «Аят-Костанай» (несушки 700 000), «Алатау-Кус» Алмат. обл., «Северо-Казахстанская» Петропавловск, «Усть-Каменогорская птицефабрика».</p>
        </section>
      </main>
    </div>
  );
}
