"use client";
import Link from "next/link";
import { useState } from "react";

export default function StadiumLargeFootballPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 21000) <= 2000;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 320_000_000_000) <= 32_000_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Большие футбольные стадионы</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🏟️ Большие футбольные стадионы 50 000+ мест</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #273. Большие стадионы РК (отличие от L5 «Футбольные арены»
            батча 66 про Astana Arena 30 000 с retract roof — здесь стадионы
            50 000+ мест бoул-структура): «Asgard Stadium» планируемый Астана
            50 000 мест (национальный), «Centralny» Алматы реновированный 35 000
            мест (2026), «Kazakhstan Stadium» проект Шымкент 45 000 мест. Открытая
            «bowl» структура без retract roof (экономия 30-40% бюджета), частичное
            покрытие трибун ETFE membrane, газон Desso GrassMaster, освещение
            UEFA Cat 4 / FIFA Stadium Guide Cat 4. AFC Asian Cup hosting standards.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Конструкция Bowl Stadium</h2>
          <p className="text-slate-300 leading-relaxed">
            FIFA Stadium Guide 2020 + UEFA Stadium Cat 4 + AFC Asian Cup Standards:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Bowl Structure:</strong> монолитный амфитеатр чашевидной формы 4 яруса (lower bowl 25 000 + middle bowl 15 000 + upper bowl 10 000), без перекрытия по центру (open air).</li>
            <li><strong>Поле UEFA Cat 4:</strong> 105×68 м, гибрид Desso GrassMaster (натур. + полипропилен. волокно), система подогрева гликолевый контур (для зимы −20°C игра), дренаж 100 мм Ø каждые 5 м.</li>
            <li><strong>Лёгкая крыша над трибунами:</strong> ETFE-мембрана (Ethylene TetraFluoroEthylene) на стальной радиальной ферме покрывает 80% мест зрителей (защита от дождя/снега), центр поля открыт (нужен для роста травы).</li>
            <li><strong>C-value &gt;90 мм:</strong> linе видимости (Sightline) для всех мест UEFA Cat 4 требование.</li>
            <li><strong>VIP-ложи и скайбоксы:</strong> 5-10% от вместимости = 2500-5000 premium мест с climate-controlled, индивидуальные кейтеринг-зоны.</li>
            <li><strong>Media zone:</strong> 400-600 мест для прессы + 12-20 ТВ-комментаторских кабин + студия трансляции в чаше стадиона.</li>
            <li><strong>Раздевалки команд:</strong> 4-6 шт (домашняя + гостевая + футбол + лёгк. атлетика + резервная), судейская, допинг-контроль.</li>
            <li><strong>Освещение FIFA Cat 4:</strong> 2400 лк рабочее EBU R.118, 240-320 LED-прожекторов Musco TLC-LED-1500 на крыше + мачты по периметру для дополнения.</li>
            <li><strong>Media cube:</strong> центральное LED-табло Daktronics 4K 12×8 м (для трансляции на стадион), угловые табло.</li>
            <li><strong>Эвакуация:</strong> 30 м/100 чел через 8-12 секторов, время эвакуации ≤8 мин для 50 000 чел (по FIFA Stadium Guide).</li>
            <li><strong>Парковка:</strong> 5000-10 000 м/мест + обязательное наличие метро/LRT в 800 м от стадиона.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Конструкция крыши</h2>
          <p className="text-slate-300">
            Стадион 50 000 мест с лёгкой крышей покрывает 80% мест (трибуны защищены
            от осадков, поле открыто для солнца и роста травы). Какая конструкция?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Сталь + битум-полимер кровля, классическое решение" },
              { v: "b", t: "Только тент-палаточная конструкция (не подходит для зимы)" },
              { v: "c", t: "Стационарная стеклянная крыша по периметру" },
              { v: "d", t: "ETFE Membrane Roof + Steel Cantilever Truss System (как Allianz Arena Munich, Mineirão Brazil): 1) Стальная радиальная ферма из труб Q460 (предел текучести 460 МПа) вылетом 80-100 м от внешней колоннады к центру поля (cantilever без опор внутри трибун — не закрывает обзор зрителям); 2) ETFE Membrane (Ethylene TetraFluoroEthylene) пневматич. подушки 2-3 слоя с воздухом между ними — общая толщ. 200 мм; 3) ETFE характеристики: вес всего 1% от стекла, светопрозрачность 90-95% (трибуны не темнеют), теплоизоляция U=2.0 Вт/м²·К (3-слойн.), пропускает UV (полезно для футбольного поля), срок службы 50+ лет; 4) Окраска ETFE — белые/прозрачные секции для естеств. освещения, цветные frit-printed точки в Allianz Arena style (40 000 декоративных подушек могут менять цвет LED-подсветкой); 5) Кровля наклонная 5-8° для стока воды + ливн. канализация Aco DrainLock по периметру; 6) Воздушный компрессор поддерживает давление в подушках 200-300 Па (постоянный мониторинг + автокомпенсация); 7) Защита от ветра: расчёт по EN 1991-1-4 для ветровой нагрузки 1.5 кПа (для региона II РК Алматы); 8) Аэродинамическая модель в Niigata Wind Tunnel — оптимизация формы; 9) Открытая центральная зона над полем без крыши (≈25% площади трибун) — для роста травы и эффекта open-air; 10) Эстетика: подсветка LED по контуру ETFE-подушек с RGB-мix (можно показывать цвета национальной команды или sponsor-брендов); 11) Снеговая нагрузка ETFE — самотающая (солнечный свет проходит сквозь, тает изнутри); FIFA Stadium Guide 2020 + UEFA Cat 4 + EN 1991 + Tensile Architecture Standards" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Площадь трибун стадиона</h2>
          <p className="text-slate-300">
            Стадион 50 000 мест, UEFA Cat 4: норма 0.5 м²/зрит. (сиденья + проходы)
            +20% (лестницы, проходы между секторами) +10% (VIP-зоны).
            Какая площадь трибун (м²)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            S_зрит = N × 0.5 м²<br />
            S_трибун = S_зрит × 1.3 (с инфра)<br />
            (Поверхность ступеней — наклонная)
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Площадь трибун, м²"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: 50 000 × 0.5 = 25 000 м² зрит.; ×1.3 = 32 500 м² с проходами. С учётом наклонной поверхности ступеней трибун (≈30-35°) реальная поверхность ~28 000 м² в плане. С учётом подтрибунных помещений (раздевалки, VIP, технические) общая полезная площадь стадиона ~80 000 м². Reception зоны и outside ~21 000 м² (в плане для расчёта стройки = ~21 000 м² зрительских поверхностей).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет стадиона 50 000 мест</h2>
          <p className="text-slate-300">
            «Asgard Stadium» планируемый Астана 50 000 мест UEFA Cat 4 (открытый bowl).
            ССЦ + импорт: монолитный ж/б каркас + перекрытия трибун 50 000 мест — 65 млрд тг,
            земляные работы (котлован для подтрибунных помещ. + дренаж поля) — 14 млрд тг,
            кресла Daplast Pivot × 50 000 + VIP кресла Daplast Premium — 8 млрд тг,
            ETFE-мембрана крыша 25 000 м² + стальная ферменная конструкция 4500 т — 48 млрд тг,
            поле UEFA Cat 4 (Desso GrassMaster + подогрев + дренаж) — 5 млрд тг,
            VIP-ложи 2500 мест + скайбоксы + restaurants Premium — 18 млрд тг,
            media zone + ТВ-комментаторские + студии трансляции — 14 млрд тг,
            кейтеринг + общепит 80 точек + кулинарные блоки — 12 млрд тг,
            освещение FIFA Cat 4 (320 LED Musco TLC-LED-1500 + мачты) — 8 млрд тг,
            media cube Daktronics 4K + 4 угловых табло — 11 млрд тг,
            HVAC (для VIP + раздевалок + СКУД-инфра) — 16 млрд тг,
            АУПС + СОУЭ 5-го типа + АУПТ + противопожарная — 12 млрд тг,
            раздевалки команд + допинг-контроль + медицина — 8 млрд тг,
            подзем. парковка 8000 м/мест + лифты Schindler — 25 млрд тг,
            благоустройство 30 га + LRT-станция integration — 15 млрд тг,
            энергоснабжение 2 ввода 110 кВ + резерв ДГУ 5 МВт + UPS — 12 млрд тг,
            СУДД + СКУД + СОТ HD + турникеты + рамки металлодетектор. — 14 млрд тг,
            проектирование + лицензии FIFA/UEFA Cat 4 + ПНР — 15 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~320 млрд тг (допуск ±10%). 65+14+8+48+5+18+14+12+8+11+16+12+8+25+15+12+14+15 = 320 млрд тг. Удельная стоимость ~6.4 млн тг/место (без retract roof, open-air). Сравнение: Allianz Arena Munich (75 000 мест, 2005) — €340 млн = 168 млрд тг (с инфляцией → 250 млрд тг). Asgard Stadium concept (планируется) — оценочно $700 млн = 320 млрд тг.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Эвакуация 50 000 человек</h2>
          <p className="text-slate-300">
            Стадион 50 000 чел при ЧС (пожар, теракт) должен эвакуироваться ≤8 мин по
            FIFA Stadium Guide. Что обязательно?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только сирены и пожарные двери" },
              { v: "b", t: "Только 4 эвакуац. выхода на каждые 12 500 мест" },
              { v: "c", t: "Multi-layered Evacuation System по FIFA Stadium Guide 2020 + UEFA Stadium Cat 4 + NFPA 101: 1) Минимум 8-12 эвакуац. выходов с равномерным распределением по периметру стадиона (по FIFA 1 выход на 4 000-6 000 зрителей); 2) Ширина прохода 1.2 м на 100 чел (по NFPA 101) — для 50 000 чел = 600 м суммарной ширины выходов, распределено по 8-12 выходам = 50-75 м каждый; 3) Время эвакуации ≤8 мин расчётно (по worst-case scenario), для верхних ярусов ≤6 мин, для нижних ≤4 мин; 4) Лестничные клетки незадымляемые с подпором воздуха (для проходов между уровнями трибун), ширина min 1.65 м на 250 чел; 5) Vomitories (тоннели входа/выхода на трибуну) каждые 200-250 мест шириной ≥2.4 м; 6) Разделение трибун на сектора по 8 000 чел макс. (FIFA) с эвакуационными выходами на сектор; 7) АУПС + СОУЭ 5-го типа с речевым оповещением на 3+ языках (русск./каз./англ.) + аварийное освещение Eaton CrouseHinds 1 ч автономии; 8) Crowd management — обученный персонал (стюарды) на ключевых точках (1 на 250 зрителей), радио-связь, видеонаблюдение с AI-аналитикой плотности толпы (давка = риск Hillsborough disaster 1989); 9) Многоуровневая координация — центр управления безопасностью (Stadium Control Room) с прямой связью полиции + пож. служба + скорая помощь; 10) Drills учения 4 раза в год + по календарю крупных матчей; 11) План реагирования на разные сценарии (пожар, теракт, погодная катастрофа); 12) Регулярная сертификация FIFA / UEFA inspector каждые 4 года; FIFA Stadium Guide 2020 + UEFA Stadium Cat 4 + NFPA 101 + EU 2006/123/EC Sports Events" },
              { v: "d", t: "Только запасные выходы каждые 50 мест" },
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
                {score === 4 ? "Отлично — готовы к проектированию большого стадиона" : score >= 2 ? "Перечитайте FIFA Stadium Guide + UEFA Cat 4 + NFPA 101" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> FIFA Stadium Guide 2020, UEFA Stadium Categories 1-4, AFC Asian Cup Standards, NFPA 101, EU 2006/123/EC, EN 1991-1-4 (Wind Load), Tensile Architecture Standards.</p>
          <p><strong>Реальные объекты РК и мир:</strong> «Asgard Stadium» планируемый Астана (50 000 мест, проект 2026), реновированный «Centralny» Алматы (35 000), Allianz Arena Munich (75 000, ETFE), Mineirão Brazil, Maracanã Rio, Wembley London.</p>
        </section>
      </main>
    </div>
  );
}
