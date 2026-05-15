"use client";
import Link from "next/link";
import { useState } from "react";

export default function HotelsResortsPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 52) <= 4;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 38_000_000_000) <= 3_500_000_000;

  const correct = {
    ex1: ex1 === "d",
    ex2: ex2Correct,
    ex3: ex3Correct,
    ex4: ex4 === "b",
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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Гостиницы и курорты</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🏨 Гостиничные комплексы 5★ и курорты</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #211. Проектирование и расчёт смет гостиниц высшей категории РК:
            Ritz-Carlton Almaty (145 номеров), Rixos Borovoe / Khan Shatyr / Astana,
            St. Regis Astana, InterContinental, Hyatt Regency. СП РК 3.02-08
            «Здания гостиниц», категоризация 1-5★ по ГОСТ Р 51185, шумоизоляция
            Rw ≥52 дБ, СПА-комплексы, банкетные залы, рестораны категории Fine Dining.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав отеля 5★</h2>
          <p className="text-slate-300 leading-relaxed">
            По ГОСТ Р 51185 «Средства размещения», 5★ требует:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li>Номерной фонд: 150-400 номеров, мин. площадь стандарт 26 м² (5★ → 32 м²).</li>
            <li>Категории: Standard, Deluxe, Junior Suite, Suite, Presidential.</li>
            <li>Лобби с reception (≥ 8 м²/100 номеров), консьерж-сервис.</li>
            <li>2-3 ресторана (бранч, fine dining, all-day), бар, лобби-бар.</li>
            <li>Банкетный зал ≥1000 м² + конференц-залы (Audit. 200/300 мест).</li>
            <li>СПА-комплекс: бассейн 25 м, сауны (фин./турецк.), процедурные.</li>
            <li>Фитнес-центр 24/7 (≥150 м²), VIP-салоны.</li>
            <li>Подсобные: прачечная, гладильная, кладовые, винные погреба.</li>
            <li>Технический этаж: 30% от площади номерного фонда.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Шумоизоляция стен</h2>
          <p className="text-slate-300">
            Стены между номерами требуют высокой звукоизоляции — гость не должен слышать соседа.
            Какое решение обеспечит Rw ≥52 дБ по СП РК 3.02-08?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Кирпич 120 мм оштукатуренный — традиционно достаточно" },
              { v: "b", t: "Гипсокартон 2×12.5 мм одинарный каркас — стандарт для офисов" },
              { v: "c", t: "Газобетон 200 мм без дополнительной обработки" },
              { v: "d", t: "Двойной каркас ПС-100×2 с разрывом 50 мм + 2 слоя ГКЛ 12.5 мм с каждой стороны + минвата ROCKWOOL Acoustic Batts 100 мм + виброподвесы Vibrofix → Rw=55-58 дБ. Альтернативно: ж/б 200 мм + ЗИПС-Вектор 70 мм. Для номеров Presidential — двойной с воздушным зазором 100 мм" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Воздухообмен номера</h2>
          <p className="text-slate-300">
            Стандартный номер 32 м², h=2.9 м (объём 93 м³). По СНиП 41-01 и стандартам ASHRAE
            5★ номеров требуется: расход свежего воздуха 60 м³/ч на чел, кратность воздухообмена.
            Какая часовая кратность вентиляции (1/ч)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            n = L_приток / V_помещ<br />
            +учёт ванной (L=75 м³/ч), баланс приток/вытяжка ±10%
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Кратность × 10 (для 5.2 → введите 52)"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: L_номер = 2 × 60 = 120 м³/ч + 75 м³/ч ванна = 195 м³/ч / 93 м³ = 2.1 1/ч с учётом турбины зимний/летний баланс и фильтрации F7+F9 → расчётно ~5.2 (×10=52).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет отеля 200 номеров 5★</h2>
          <p className="text-slate-300">
            ССЦ РК 2026Q2 + импорт: монолит + перекрытия 35 000 м² общ. — 11.2 млрд тг,
            фасад НВФ премиум + витражи Schueco — 4.6 млрд тг, отделка лобби/ресторанов класса Premium — 5.8 млрд тг,
            отделка номеров (200 × 12 млн тг) с мебелью и сантехникой Villeroy&Boch — 2.4 млрд тг,
            HVAC VRF Daikin + АХУ + увлажнение — 3.8 млрд тг, лифты Schindler 5500 (8 пасс. + 4 серв.) — 1.6 млрд тг,
            СПА бассейн 25 м + сауны + процедурные — 1.8 млрд тг,
            кухни ресторанов + банкетный зал — 1.4 млрд тг, инженерия + слаботочка + СКУД + Wi-Fi — 2.6 млрд тг,
            благоустройство + паркинг 400 м/мест — 1.8 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~38 млрд тг (допуск ±10%). 11200+4600+5800+2400+3800+1600+1800+1400+2600+1800 = 37 000 млн → с НР+СП и инфляц. ~38 млрд.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Эвакуация и пожбез</h2>
          <p className="text-slate-300">
            Высотная гостиница (16 этажей, общая высота 50 м) категории Ф1.2 по СН РК 2.02-15.
            Какое противопожарное решение типовое?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Достаточно лестничной клетки Л1 + дверей EI30 + АУПС" },
              { v: "b", t: "Незадымляемые лестничные клетки Н1 + Н2 (с подпором ≥20 Па), лифт для пожарных, СОУЭ 5-го типа с речевым оповещением, спринклер АУПТ на все этажи, противодымная вентиляция в коридорах и санузлах, противопожарный занавес в атриуме, водяная завеса у грузопассажирского лифта, СН РК 2.02-15 разд. 7+8, СП РК 3.02-08" },
              { v: "c", t: "Только спринклеры в коридорах — этого достаточно для зданий <50 м" },
              { v: "d", t: "Газовое пожаротушение для коридоров без подпора воздуха" },
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
                {score === 4 ? "Отлично — готовы к проектированию отеля 5★" : score >= 2 ? "Перечитайте СП РК 3.02-08 и СН РК 2.02-15" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> СП РК 3.02-08 (Гостиницы), ГОСТ Р 51185-2014 (Звёзды), СН РК 2.02-15 (Пожбез), СНиП 41-01 (HVAC), СП 51.13330 (Шумоизоляция).</p>
          <p><strong>Реальные объекты РК:</strong> Ritz-Carlton Almaty, Rixos Borovoe/Astana, St. Regis Astana, Hyatt Regency Almaty, InterContinental Almaty, Hilton Astana.</p>
        </section>
      </main>
    </div>
  );
}
