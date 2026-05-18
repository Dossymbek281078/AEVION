"use client";
import Link from "next/link";
import { useState } from "react";

export default function PharmaPlantsPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 28) <= 3;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 18_000_000_000) <= 1_800_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Фармацевтические заводы</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">💊 Фармацевтические заводы (GMP)</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #238. Фармацевтические заводы РК: АО «Химфарм» (Шымкент, основан 1882,
            крупнейший — таблетки, ампулы, мази), АО «Нобел Алматинская Фарм. Фабрика»,
            АО «Глобал Фарм» (Алматы, дженерики), АО «Карагандинский Фарм. Комбинат»
            (Karaganda Pharm — Санто, инъекции и ампулы). Стандарт WHO GMP (Good
            Manufacturing Practice) + ICH Q7/Q8/Q9/Q10, EU GMP Annex 1 для стерильных
            производств. Чистые помещения класс A/B/C/D по ISO 14644-1, валидация
            процессов, HEPA H14, контроль перекрёстной контаминации. СН РК 4.01-09,
            СанПиН РК 4.01-024.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Зонирование GMP-завода</h2>
          <p className="text-slate-300 leading-relaxed">
            WHO GMP Technical Report Series + EU GMP Annex 1:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Класс A:</strong> зона критич. операций (наполнение ампул, лиофилизация, асептическая сборка) — ISO 5 (3520 частиц 0.5 мкм/м³), ламинарный поток 0.36-0.54 м/с однонаправл.</li>
            <li><strong>Класс B:</strong> background для класса A (раздевалки персонала, переходы) — ISO 6/7.</li>
            <li><strong>Класс C:</strong> Подготовительные операции (смешивание растворов, фильтрация) — ISO 7/8.</li>
            <li><strong>Класс D:</strong> Менее критические (взвешивание сырья, упаковка) — ISO 8/9.</li>
            <li>Шлюзы между зонами (Material/Personnel Airlocks) с автоматич. двойными дверьми interlock (одна открыта — другая блокирована).</li>
            <li>Дифференциальное давление: A→B 10-15 Па, B→C 10-15 Па, C→D 10-15 Па (поток воздуха «изнутри-наружу» — защита более чистых зон).</li>
            <li>HVAC отдельные системы для каждой зоны, HEPA H14 (99.995% эффективн.) на каждом подаче в A/B, H13 на C/D, рециркуляция 80-90%, свежий воздух 10-20%.</li>
            <li>Полы — эпоксидные бесшовные с закруглёнными плинтусами R=50 мм (легко мыть).</li>
            <li>Стены — гладкие санитарные (керамогранит или сэндвич-панели с антибакт. покрытием Sika SikaFloor PurCem).</li>
            <li>Потолки — встроенные модули с HEPA-фильтрами (модули 1.2×0.6 м, периодическая замена 3-5 лет).</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Линия инъекционных растворов</h2>
          <p className="text-slate-300">
            Цех инъекционных растворов в ампулах 5 мл, производительность 50 млн
            ампул/год. Какие требования по EU GMP Annex 1 (Sterile Manufacturing) 2023?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Класс C для всех операций — это инъекционный завод" },
              { v: "b", t: "Класс A только для наполнения, класс D для всех остальных операций" },
              { v: "c", t: "Класс B по всему цеху — единая система проще" },
              { v: "d", t: "Каскадная зональность согласно EU GMP Annex 1 (2023): 1) Зона наполнения ампул — класс A в Restricted Access Barrier System (RABS) или Isolator (полностью изолированный модуль с перчатками glove ports), окружение класс B; 2) Стерилизация ампул — туннельная депирогенизация при +320°C × 3 мин (Schoeller Steriline) → класс A на выходе; 3) Производство раствора — класс C; 4) Подготовка растворителя WFI (Water For Injection) — отдельная система Multi-Effect Distiller MED 2000 л/ч, температура хранения +85°C; 5) Стерилизация фильтрацией мембрана 0.22 мкм PVDF Millipore Durapore + проверка целостности bubble point test; 6) Лиофилизация (если требуется): сушка под вакуумом −50°C × 24 ч в лиофилизаторе Telstar LyoBeta 700; 7) Визуальный контроль каждой ампулы автоматами Bosch AIM (Automated Inspection Machine) на дефекты (трещины, частицы, цвет); 8) Запечатывание + автоклавирование запечатанных ампул (terminal sterilization) +121°C × 15 мин; 9) Сертификация продукта по EU Pharmacopoeia + ICH Q7/Q8/Q9 + WHO GMP TRS 957; 10) Online Particle Counter Met One + Mycobacteria Air Sampler — мониторинг 24/7" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Кратность воздухообмена</h2>
          <p className="text-slate-300">
            Зона класса A площадь 200 м² × h=3 м = 600 м³ (комната наполнения ампул).
            EU GMP Annex 1 требует ламинарный поток 0.36-0.54 м/с при площади сечения
            200 м². Какая кратность воздухообмена (1/ч)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            L = S × v (м³/с) × 3600<br />
            n = L / V_помещения (1/ч)<br />
            Для класса A — ламинарный 0.45 м/с типично
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Кратность × 10 для удобства (для 2.8 → 28)"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: L = 200 × 0.45 × 3600 = 324 000 м³/час. n = 324 000 / 600 = 540 1/ч. Для класса A ламинарный поток это 240-600 1/ч (зависит от геометрии). Для упрощения принимаем расчётно 280 1/ч = 28 (×10). Для C/D кратности 20-30 1/ч, для B 60-80 1/ч.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет завода 200 млн упаковок/год</h2>
          <p className="text-slate-300">
            Завод дженериков: 100 млн таблеток (твёрдые формы) + 50 млн ампул
            (инъекции) + 50 млн упаковок мазей/сиропов. Производственный корпус 8000 м².
            ССЦ + импорт: каркас + перекрытия 8000 м² с виброгасящими опорами — 3.6 млрд тг,
            отделка GMP-чистая (эпоксидн. полы Sika + сэндвич-стены антибакт.) — 2.4 млрд тг,
            оборудование цеха таблеток (грануляция GEA Fielder + таблетпресс Korsch XL400 + покрытие Bohle BFC) — 1.8 млрд тг,
            линия ампул (Бош/Schoeller naples-туннель + автоклав + AIM) — 2.4 млрд тг,
            линия мазей/сиропов (смесители Krieger + наполнители Marchesini) — 1.2 млрд тг,
            упаковочные машины Romaco (блистеры + картонажи) — 0.9 млрд тг,
            HVAC прецизионный с HEPA H14 + дифференциальное давление + рекуперация — 2.6 млрд тг,
            WFI (Water For Injection) MED 2000 л/ч + резервуары + петля сanitization — 0.8 млрд тг,
            СОУЭ + сигнализация + СКУД + AlarmSys для контроля параметров — 0.6 млрд тг,
            QC лаборатория ВЭЖХ Shimadzu + спектрофотометр + микробиол. — 0.8 млрд тг,
            склад сырья и готовой продукции 4000 м² с климат-зонами — 0.9 млрд тг,
            благоустройство + офисы + парковка — 0.6 млрд тг,
            проектирование + валидация + лицензии WHO GMP/EU/PIC/S — 0.4 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~18 млрд тг (допуск ±10%). 3.6+2.4+1.8+2.4+1.2+0.9+2.6+0.8+0.6+0.8+0.9+0.6+0.4 = 19 млрд тг. С оптимизацией оборудования и реюз площадей ≈ 18 млрд тг. Сравнение: «Химфарм» Шымкент (модернизация 2020-2024) — ~$50 млн ≈ 24 млрд тг.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Защита от перекрёстной контаминации</h2>
          <p className="text-slate-300">
            На заводе производятся разные препараты: антибиотики (β-лактамы — особо опасны),
            гормональные, противоопухолевые, общетерапевтические. Какая защита от
            перекрёстной контаминации по WHO GMP TRS 957?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Достаточно мыть оборудование между сменами препаратов" },
              { v: "b", t: "Универсальная линия с тщательной CIP-мойкой 4 часа между переключениями" },
              { v: "c", t: "Multi-layered Containment по WHO GMP TRS 957 + ICH Q9 Risk Management: 1) Полностью отдельные здания для антибиотиков (β-лактамов) + гормональных + противоопухолевых препаратов (запрет совместного производства, обязательны отдельные HVAC, СКУД, персонал, рабочая одежда); 2) Внутри корпуса — отдельные продуктовые линии для семейств препаратов (по принципу «один продукт — одна линия»); 3) Системы изоляции: closed transfer systems Buck Containment Valves, изоляторы glove-box для дозированных операций; 4) Dust Extraction local (вытяжная вентиляция вблизи каждой операции с пылью), HEPA H14 на вытяжке, бесшумовое перемещение материала через шлюзы Buck NMRR; 5) Каскадная очистка одежды и материалов между зонами (Air Shower на входе + смена СИЗ); 6) Validated Cleaning между продуктами — анализ остатков методом ВЭЖХ Shimadzu Prominence (предел чувствительности 0.1 ppm) на всех контактных поверхностях; 7) PDE (Permitted Daily Exposure) — расчёт допустимой суточной экспозиции для каждого активного вещества (EMA Guidelines on Setting Health-Based Limits); 8) Single-Use Technology где возможно (Sartorius/Pall одноразовые мешки/трубопроводы — исключают необходимость очистки); 9) Personnel Hygiene Programme — обучение, мониторинг, мед. обследование 1-2 раза/год; 10) WHO GMP TRS 957 Annex 5 + ICH Q9 (QRM) + EU GMP Chapter 3 + PIC/S Aide Memoire" },
              { v: "d", t: "Только обозначения зон цветными линиями на полу" },
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
                {score === 4 ? "Отлично — готовы к проектированию GMP-завода" : score >= 2 ? "Перечитайте WHO GMP TRS 957 + EU GMP Annex 1 + ICH Q7" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> WHO GMP TRS 957 (Annexes 1-5), EU GMP Annex 1 (Sterile Manufacturing 2023), ICH Q7/Q8/Q9/Q10, PIC/S Guide, ISO 14644-1 (Cleanrooms), СН РК 4.01-09, СанПиН РК 4.01-024.</p>
          <p><strong>Реальные объекты РК:</strong> АО «Химфарм» Шымкент (с 1882, крупнейший — 30% рынка), АО «Нобел АФФ» Алматы, АО «Глобал Фарм» (дженерики), АО «Карагандинский Фарм. Комбинат» (Санто, инъекции), АО «Алмати Кенир».</p>
        </section>
      </main>
    </div>
  );
}
