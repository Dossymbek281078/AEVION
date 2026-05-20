"use client";
import Link from "next/link";
import { useState } from "react";

export default function LandfillTboPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 36) <= 4;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 24_000_000_000) <= 2_400_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Полигоны ТБО (захоронение)</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🗑️ Полигоны ТБО (захоронение отходов)</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #245. Полигоны ТБО РК: Алматинский «Кеңқарасу» (350 000 т/год,
            крупнейший в РК), Астанинский «Қоянды» (250 000 т/год), Карагандинский,
            Шымкентский, региональные полигоны. Защитная многослойная гидроизоляция
            HDPE 2 мм + бентонитовые маты GCL (Geosynthetic Clay Liner) + дренаж
            фильтрата (lichivat) с насосной откачкой, газосбор биогаз CH₄ через
            скважины с факельным дожигом (или утилизацией в КГЭС-микроТЭЦ).
            СН РК 4.01-02, EU Landfill Directive 1999/31/EC, USEPA RCRA Subtitle D.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Конструкция полигона ТБО</h2>
          <p className="text-slate-300 leading-relaxed">
            EU Landfill Directive 1999/31/EC + USEPA RCRA Subtitle D:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li>Категории отходов: Class I (опасные), Class II (бытовые ТБО), Class III (инертные строительные).</li>
            <li>Основание полигона (снизу вверх): подстил. грунт уплотн. → бентонитовый мат GCL Bentofix 6 мм (защита от вертик. фильтрации) → геомембрана HDPE 2 мм (двойная для опасных отходов) → защитный геотекстиль 600 г/м² → дренажный слой щебня 300 мм с трубами Ø200 мм перфор. → защитный слой грунта 500 мм.</li>
            <li>Карты-секции 5-10 га каждая, разделены валами высотой 2 м для последовательного заполнения.</li>
            <li>Дренаж фильтрата (lichivat) — перфорированные трубы PE Ø160-250 мм с уклоном 2-3% к сборному колодцу + насосная откачка → очистные сооружения фильтрата.</li>
            <li>Газосбор биогаза CH₄ (50-60% метана) — вертикальные перфор. скважины Ø600 мм через 30-50 м, обвязка в кольцо, отвод на факел или КГЭС-микроТЭЦ.</li>
            <li>Финальное покрытие (Final Cover) при достижении проектной высоты 20-40 м: грунтовая шапка 0.5 м + геомембрана HDPE 1.5 мм + плодородный слой 0.5 м + посев трав.</li>
            <li>Мониторинг: пьезометры по периметру 4-8 шт для контроля грунтовых вод, газоанализаторы CH₄/H₂S/CO₂ в скважинах биогаза.</li>
            <li>Подъездная дорога + весовая (для авто-мусоровозов) + контейнерное хранилище для мониторинга проб.</li>
            <li>Площадка приёма + хозблок для персонала + санитарно-эпид. контроль.</li>
            <li>Санитарная зона 500-1000 м от жилья (СанПиН РК 4.01-007).</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Гидроизоляция основания</h2>
          <p className="text-slate-300">
            Полигон ТБО Class II (бытовые отходы) для Алматы 350 000 т/год.
            Какая защита грунтовых вод и почвы от фильтрата по EU Landfill Directive
            1999/31/EC и СН РК 4.01-02?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только слой глины 500 мм — традиционно дёшево" },
              { v: "b", t: "Одна геомембрана HDPE 1 мм с дренажным слоем сверху" },
              { v: "c", t: "Бентонит GCL + одна HDPE 2 мм без защитного слоя" },
              { v: "d", t: "Composite Liner Double Containment по EU 1999/31/EC Annex I: 1) Подстил. грунт уплотнённый Купл=0.95 (геол. барьер k≤10⁻⁹ м/с по фильтрации, толщ. ≥1 м); 2) Geosynthetic Clay Liner Bentofix BFG 5300 — бентонитовые маты 6 мм между 2 геотекстилями (саморасширяющийся бентонит при контакте с водой образует k=5×10⁻¹¹ м/с барьер); 3) Геомембрана HDPE 2 мм Solmax SOLMAX 2D Drain (тёмный анти-УФ, сварка горячим клином с тестированием каждого шва Air Pressure Test 30 кПа × 5 мин); 4) Защитный геотекстиль 1200 г/м² NoNonwoven (защита HDPE от перфорации щебнем); 5) Дренажный слой щебня 30-50 мм фракции толщ. 500 мм с дренажными трубами PE Ø200 мм перфор. шагом 6 м (отвод фильтрата с уклоном 2%); 6) Защитный слой грунта 300 мм (буфер между мусором и дренажом); 7) Для опасных отходов Class I — двойная HDPE + leak detection слой между мембранами с собств. дренажом (мониторинг утечек); 8) Геотехнический контроль каждые 100 м² на этапе монтажа (Geomembrane Quality Assurance Plan GQAP); 9) Сертификация GRI GM13 (HDPE specs) + ASTM D7466; 10) Подкарантинный мониторинг 30 лет после закрытия полигона; EU 1999/31/EC + USEPA RCRA Subtitle D + СН РК 4.01-02" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Площадь полигона</h2>
          <p className="text-slate-300">
            Алматы 2 млн жителей, удельный объём отходов 1.5 кг/чел/сутки = 350 000 т/год.
            Плотность сжатого мусора в полигоне 0.8 т/м³, проектная высота полигона
            25 м, срок эксплуатации 25 лет. Какая площадь полигона нужна (га)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            V_суммарн = M × T / γ_сжат<br />
            S = V / H_полигона<br />
            +30% доп. площадь под подъездные, очистные, санзону
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Площадь, га"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: V = 350 000 × 25 / 0.8 = 10 937 500 м³; S_рабочая = 10 937 500 / 25 = 437 500 м² = 43.75 га; +30% инфра = ~57 га. С учётом сужения «пирамиды» сверху (откосы 1:3) и резервных секций — типично ~36 га на 350 тыс. т/год × 25 лет (как реальный Кеңқарасу).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет полигона 36 га</h2>
          <p className="text-slate-300">
            ССЦ + импорт: подготовка участка 50 га (рекультивация, дороги техн.) — 1.8 млрд тг,
            земляные работы (отрывка под чашу полигона ср. глубина 8 м) — 4.2 млрд тг,
            гидроизоляция многослойная HDPE 2 мм + GCL + геотекстиль 36 га — 6.8 млрд тг,
            дренаж фильтрата (12 км PE Ø200 + 16 колодцев + насосная) — 1.6 млрд тг,
            очистные фильтрата (физико-хим. + биол. + обратный осмос RO) 200 м³/сут — 3.6 млрд тг,
            газосбор биогаза (180 скважин + кольцевая обвязка + 2 факела дожига) — 1.4 млрд тг,
            микроТЭЦ КГЭС на биогазе 1.5 МВт (Caterpillar G3520C) — 2.4 млрд тг,
            пьезометры мониторинг ГВ × 12 шт + лаборатория — 0.4 млрд тг,
            весовая + хозблок + дороги внутрипл. + санзона — 1.2 млрд тг,
            периметровое ограждение 4 км + камеры + СКУД — 0.6 млрд тг,
            автомусоровозы Volvo FE × 8 + бульдозеры Caterpillar D8 × 2 — 0.6 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~24 млрд тг (допуск ±10%). 1.8+4.2+6.8+1.6+3.6+1.4+2.4+0.4+1.2+0.6+0.6 = 24.6 млрд тг. Удельная стоимость ~70 тыс. тг/т годовой ёмкости — соответствует современным EU-стандартам полигонов 2-го поколения.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Биогаз и парниковые газы</h2>
          <p className="text-slate-300">
            Полигон ТБО выделяет биогаз 60-100 м³ CH₄ на тонну отходов (метан — в 28× более
            мощный парниковый газ чем CO₂). Что обязательно по EU Landfill Directive +
            Парижское соглашение по климату?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только выпуск биогаза в атмосферу без обработки" },
              { v: "b", t: "Достаточно одной факельной свечи для дожига" },
              { v: "c", t: "Комплексная утилизация биогаза по EU 1999/31/EC + Парижское соглашение CDM Clean Development Mechanism: 1) Вертикальные скважины газосбора PE Ø600 мм перфор. через 30-50 м (плотность 1 скв/0.5 га), на полную глубину полигона + 2 м запас; 2) Кольцевая обвязка горизонтальными ПВХ Ø200 мм с конденсатоотводчиками каждые 100 м; 3) Газовая компрессорная (Roots-blower + дожимной компрессор + осушка) для подачи на утилизацию или факел; 4) Микро-ТЭЦ на биогазе (Caterpillar G3520C 1.5 МВт или Jenbacher J620 3.4 МВт) — выработка электроэнергии + тепла для собственных нужд полигона + продажа в сеть; 5) Очистка биогаза перед двигателем — H₂S → активир. уголь (Sulfur Treatment 30 ppm на выходе), Cl/F-соединения → keramic filter, силоксаны → угольный фильтр (для защиты двигателя); 6) Резервный высокотемпературный факел (T=+1000°C × 0.3 с — обеспечивает разрушение CH₄ → CO₂ + H₂O с эффективностью &gt;99.5%) на случай аварии ТЭЦ; 7) CDM сертификация — продажа углеродных кредитов CO₂-эквив. (каждая тонна CH₄ = 28 т CO₂eq, экономия эквивалентная вырубке леса); 8) Continuous emission monitoring CEM анализаторы CH₄/H₂S/CO₂; 9) Финальное покрытие полигона после закрытия с продолжающейся газосборкой 15-20 лет (пост-эксплуатационный мониторинг); 10) EU 1999/31/EC Art. 5 + Парижское соглашение + Kyoto Protocol Annex B + ISO 14064 (GHG Inventory)" },
              { v: "d", t: "Только установка нескольких маленьких факелов по периметру" },
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
                {score === 4 ? "Отлично — готовы к проектированию полигона ТБО" : score >= 2 ? "Перечитайте EU 1999/31/EC + USEPA RCRA + СН РК 4.01-02" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> EU Landfill Directive 1999/31/EC, USEPA RCRA Subtitle D, СН РК 4.01-02, СанПиН РК 4.01-007, GRI GM13, ASTM D7466, ISO 14064.</p>
          <p><strong>Реальные объекты РК:</strong> Алматинский полигон «Кеңқарасу» 350 000 т/год, Астанинский «Қоянды», Карагандинский, Шымкентский, региональные полигоны (всего ~3500 несанкционир. свалок в РК подлежат рекультивации).</p>
        </section>
      </main>
    </div>
  );
}
