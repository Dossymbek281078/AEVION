"use client";
import Link from "next/link";
import { useState } from "react";

export default function AquacultureFarmsPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 850) <= 80;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 8_400_000_000) <= 800_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Рыбоводные хозяйства</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🐟 Аквакультура и рыбоводные хозяйства</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #232. Рыбоводные хозяйства РК: садковые хозяйства «Балхаш Бекіре» —
            осетровые в Балхашском пруду, «Сарыагаш Рыбоводный» (Шымкент, форель),
            бассейновые RAS (Recirculating Aquaculture Systems) с замкнутым водообменом,
            рыбоводные пруды площадные 50-200 га (карп, белый амур). Водоподготовка
            УФ-обеззараживание + озон-окисление, биофильтры, кислородные станции.
            СНиП 2.06.07 (Гидротехн. рыбоводные), СН РК 4.01-12, FAO Aquaculture.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Типы рыбоводных систем</h2>
          <p className="text-slate-300 leading-relaxed">
            FAO Aquaculture Engineering + СНиП 2.06.07:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Прудовое (extensive):</strong> 0.5-2 т/га, естеств. водообмен, низкая плотность (карп, белый амур, толстолобик).</li>
            <li><strong>Прудовое intensive:</strong> 10-30 т/га с аэрацией и кормлением (форель, осетровые).</li>
            <li><strong>Садковое (cage culture):</strong> 50-150 кг/м³, сетчатые садки в пруду/водохранилище 8×8×6 м (форель, осетровые).</li>
            <li><strong>Бассейновое (flow-through):</strong> 30-80 кг/м³, постоянный приток свежей воды (форель горных рек).</li>
            <li><strong>RAS (Recirculating Aquaculture System):</strong> 80-200 кг/м³, замкнутый цикл с механич./биол./УФ-фильтрами, экономия воды 95%.</li>
            <li><strong>IMTA (Integrated Multi-Trophic Aquaculture):</strong> рыба + моллюски + водоросли — экосистемный подход.</li>
            <li>Инкубационный цех: лотки 2×0.5×0.3 м для икры, плотность 30-50 тыс. икринок/м².</li>
            <li>Подращивание мальков: бассейны Ø2-4 м или прямоугольные 6×2×1 м с аэрацией.</li>
            <li>Кормовой блок: автокормушки Innovasea AKVA или Akvasmart с управлением через мобильное приложение.</li>
            <li>Узел водоподготовки: фильтры механич. (Hydrotech Drum Filter HDF), биофильтр (Moving Bed K1 от RKL), УФ-обеззар. Wedeco, озон-генератор.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Выбор системы для осётра</h2>
          <p className="text-slate-300">
            Рыбоводное хозяйство 200 т/год осетровых (сибирский осётр и стерлядь) в
            Алматинской обл. (вода р. Иссык 8-12°C круглый год, доступна 80 л/с).
            Какая система оптимальна?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Прудовое extensive — самое дешёвое, но 100 га требуется" },
              { v: "b", t: "Чистое садковое в р. Иссык — экологически чувствительно к зимним льдам и сезон. колебаниям" },
              { v: "c", t: "Только flow-through без замкнутого цикла — расход воды 5000 л/с — нереально" },
              { v: "d", t: "Гибрид RAS + flow-through: 12 бассейнов прямоугольных 12×4×1.5 м (V=72 м³ каждый) для разделения по возрастным группам (0+, 1+, 2+, товарная) с плотностью 80-150 кг/м³, общий объём 850 м³, замкнутый цикл RAS с обменом 4-6%/сутки = 4080-5100 л/час свежей воды (компромисс с расходом 80 л/с = 288 м³/час доступной воды), очистка: 1) Drum filter Hydrotech HDF1600 (механика, удаление 50-200 мкм), 2) Биофильтр Moving Bed K1 280 м³ (нитрификация NH4→NO2→NO3), 3) Скиммер белковый Aquatic Eco-Systems APS, 4) Дегазация CO2, 5) Кислородная станция конусные оксигенаторы Faivre RDC (DO 80-120%), 6) УФ-обеззар. Wedeco BX2000 1500 м³/час, 7) Озон-окисление Primozone GM12 (для воды бассейна 0+), pH-стабилизатор кальцием, температурный контроль 12-16°C через титановые теплообменники, аварийный аэратор поршн. + резерв О2 жидкий 6000 л, СНиП 2.06.07 + FAO + Norwegian Seafood Research Fund" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Объём бассейнов</h2>
          <p className="text-slate-300">
            Хозяйство 200 т товарной рыбы (вес товарной 2.5 кг) к концу 2-летнего цикла.
            Плотность в товарной фазе 120 кг/м³ при сборе. Сколько суммарного объёма
            бассейнов потребуется (с учётом всех возрастных групп)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            V_товарн = M / плотность = 200 000 кг / 120 = 1667 м³<br />
            +V_подращ (1+) 50%, +V_малек (0+) 15%, +V_инкубат 5%<br />
            Используйте 50% общего использования (срез по времени)
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="V_общ, м³"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: V_товарн = 1667 м³, +50%+15%+5% = +70% = 2833 м³. С учётом фактич. одновременного содержания (срез по времени) на ~50% — реально работающий объём ~850 м³. Если все возрастные группы единомоментно — 1700-2000 м³.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет фермы 200 т/год</h2>
          <p className="text-slate-300">
            ССЦ РК 2026Q2 + импорт оборудования: производственный корпус 4500 м² (отопл./изоляция/HVAC) — 1.6 млрд тг,
            12 бассейнов 72 м³ + инкубационный цех + цех подращивания — 980 млн тг,
            водозабор + насосная (4 насоса 80 л/с с резерв.) — 320 млн тг,
            водоподготовка RAS полный комплекс (drum + биофильтр + УФ + озон) — 1.4 млрд тг,
            кислородная станция (генератор ASCO N₂/O₂ + жидкий резерв) — 240 млн тг,
            автокормушки Innovasea + кормокухня + холод. камера — 380 млн тг,
            энергоснабжение (ТП 1000 кВА + резерв ДГУ 300 кВт + бесперебой UPS) — 580 млн тг,
            канализация + локальные очистные стоков (БПК 3000→6 мг/л) — 420 млн тг,
            АСУ ТП — мониторинг pH/DO/t°/NH4/NO2 с алармами — 240 млн тг,
            благоустройство + офис + СКУД + видеонаблюдение — 320 млн тг,
            проектирование + лицензии + ветсанэкспертиза — 280 млн тг,
            рыбопосадочный материал (мальки) первой загрузки + 6 мес кормов — 1.6 млрд тг,
            НР+СП и резерв на запуск — 40 млн тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~8.4 млрд тг (допуск ±10%). 1.6+0.98+0.32+1.4+0.24+0.38+0.58+0.42+0.24+0.32+0.28+1.6+0.04 = 8.42 млрд тг. Удельный CAPEX осетровой RAS-фермы — $80-120/кг производ. мощности (200 000 кг × $90 = $18 млн ≈ 8.4 млрд тг).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Биобезопасность RAS</h2>
          <p className="text-slate-300">
            RAS-хозяйство — закрытая экосистема, попадание патогена может уничтожить
            всё стадо. Что обязательно по FAO Biosecurity Guidelines?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только видеонаблюдение и периметральное ограждение" },
              { v: "b", t: "Достаточно УФ-обеззараживания на входе воды" },
              { v: "c", t: "Многоуровневая биобезопасность: 1) Шлюз входа (биосекьюрити-душ + переодевание персонала, спец. сапоги/халаты для каждой зоны); 2) Зонирование «чистая-грязная»: цех 0+ малеков НЕ соединён с цехом товарной рыбы (отдельные водопроводы, инструмент, персонал); 3) Карантин для новых поступлений икры/малеков — 30 сут в изолированном цеху, проба ПЦР на 15 патогенов (KHV, IPN, IHN, VHS, аэромоноз, фурункулёз); 4) Водоподготовка многоступенчатая — УФ Wedeco 40 мДж/см² (инактивация 99.9% патогенов) + озон-окисление 0.3-0.5 мг/л 5 мин (NaCl, KMnO4 как backup); 5) Дезинфекция оборудования после каждого зала — Virkon S 1% или хлорсодерж., автоматич. помывка лотков; 6) Запрет дикой рыбы и кормления свежей рыбой; 7) Утилизация павших Inactivator AlcoVet + сжигание; 8) План реагирования на болезнь — изоляция, лечение, депопуляция; 9) Сертификация SPF (Specific Pathogen Free) от Минсельхоза РК/МЭБ ВОЗЖ ОИЭ; 10) Регулярный аудит и обучение персонала; FAO Biosecurity for Aquaculture + СН РК 4.01-12 + ВОЗЖ OIE Standards" },
              { v: "d", t: "Антибиотики профилактически в корме — упрощает биобезопасность" },
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
                {score === 4 ? "Отлично — готовы к проектированию рыбоводной фермы" : score >= 2 ? "Перечитайте СНиП 2.06.07 + FAO + СН РК 4.01-12" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> СНиП 2.06.07 (Гидротехн. рыбоводные), СН РК 4.01-12, FAO Aquaculture Engineering, OIE/WOAH Aquatic Code, EU Aquaculture Directive, Norwegian Standard NS 9415 (RAS).</p>
          <p><strong>Реальные объекты РК:</strong> «Балхаш Бекіре» (осетровые), «Сарыагаш Рыбоводный» (форель), «Атаман» Костанай (карп), форелевые хоз. в Каскеленском, Талгарском, Алматинском районах.</p>
        </section>
      </main>
    </div>
  );
}
