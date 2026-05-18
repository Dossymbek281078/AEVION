"use client";
import Link from "next/link";
import { useState } from "react";

export default function HighwayConstructionPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 980) <= 90;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 880_000_000_000) <= 85_000_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Магистрали и автобаны</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🛣️ Магистрали и автобаны</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #241. Автомагистрали РК: БАКАД Большая Алматинская Кольцевая
            Автодорога (66 км, 4-6 полос, 2017-2024), ВОАД Восточное Объездное
            Автомобиль. дорогу Алматы, Astana-Almaty Highway (1200 км, Pol-EU TEN-T
            маршрут), Западная Европа-Западный Китай (2787 км через РК — часть
            «Шёлкового пути»). Категория Ia/Ib (≥4 полос, V_расч=120 км/ч), асфальтобетон
            A1 + ЩМА сверху + ABS-21 щебёночный, СН РК 3.03-09, AASHTO LRFD Pavement
            Design, Superpave Mix Design, ГОСТ 9128.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Дорожная одежда категории Ia</h2>
          <p className="text-slate-300 leading-relaxed">
            СН РК 3.03-09 + AASHTO LRFD Pavement Design Guide:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Земляное полотно:</strong> уплотн. подстил. грунт песчано-щебёночн. К_упр≥0.95, отметка по геодезии ±20 мм.</li>
            <li><strong>Дополнительные слои:</strong> песчаный 200 мм (морозостойкость, дренаж), геотекстиль (защита от заиливания).</li>
            <li><strong>Основание:</strong> щебень фракции 40-70 мм (250 мм) + щебень 20-40 мм (180 мм) виброуплотн.</li>
            <li><strong>Нижний слой покрытия:</strong> асфальтобетон A1 крупнозернистый (битум БНД 60/90 + щебень 40 мм) толщиной 80 мм.</li>
            <li><strong>Верхний слой покрытия:</strong> ЩМА-15/20 щебёночно-мастичный (битум модифициров. SBS + чёрный песок + полимерн. волокно) 50-60 мм.</li>
            <li><strong>Альтернатива:</strong> Superpave PG 76-22 (Performance Graded битум) для жарких регионов РК (Кызылорда +50°C летом).</li>
            <li><strong>Армирование грунта:</strong> георешётка Tensar TX190 (повышает несущую способность слабых грунтов в 2×).</li>
            <li><strong>Краевые элементы:</strong> бордюрный камень БР 300×150, ограждения АО.</li>
            <li><strong>Разметка:</strong> термопластиковая ProRoad 3M Stamark (3 мм толщ., срок службы 5+ лет).</li>
            <li><strong>Освещение:</strong> опоры металл. 12 м через 30-40 м, светильники Philips LED 250 Вт RoadStar Gen3.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Конструкция дорожной одежды для БАКАД</h2>
          <p className="text-slate-300">
            БАКАД 66 км, категория Ia (6 полос, V=120 км/ч), грузопоток 70 000 авт./сутки
            (включая 25% грузовые). Грунты — суглинки пучинистые. Какая дорожная одежда?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Цементобетонная плитная одежда 250 мм — самая прочная, но дорогая" },
              { v: "b", t: "Асфальтобетон 50 мм только верхний слой ЩМА-15" },
              { v: "c", t: "Сборные ж/б плиты ПДН 14-30 — экономно, но шумно и неровно" },
              { v: "d", t: "Многослойная нежёсткая по СН РК 3.03-09 + AASHTO LRFD: 1) Подстил. слой песок 250 мм К_упл=0.95 (дренаж + морозозащита); 2) Геотекстиль NoNonwoven 400 г/м² (защита от заиливания + армирование); 3) Дополнит. слой ЩПС (щебёночно-песчаная смесь) 200 мм; 4) Нижнее основание — георешётка Tensar TX190 + щебень фр. 40-70 мм 250 мм виброуплотн. (повышает несущую способность); 5) Верхнее основание — щебень фр. 20-40 мм 180 мм; 6) Нижний слой покрытия А1 крупнозернистый битум БНД 60/90 + щебень 40 мм 90 мм толщ.; 7) Промежут. слой плотный А1 битум БНД 60/90 70 мм; 8) Верхний слой ЩМА-15 (щебёночно-мастичный с битумом SBS-модифициров. 5%) 50 мм с шумо-вибропоглощающими свойствами; 9) Шероховатая поверхность по ГОСТ 30412 — коэф. сцепления ≥0.4 в сухом / ≥0.3 в мокром; 10) Расчётный срок службы 25+ лет с одним капремонтом верхнего слоя на 10-й год; СН РК 3.03-09 + AASHTO LRFD 2020 + Superpave Mix Design + ГОСТ 9128" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Объём асфальтобетона</h2>
          <p className="text-slate-300">
            66 км × ширина проезжей части 27 м (6 полос по 3.75 м + обочины 2×2 м =
            22.5 + 4 = 26.5 ≈ 27 м с учётом разметки). Дорожная одежда: А1 крупнозерн. 90 мм
            + А1 плотный 70 мм + ЩМА-15 50 мм = 210 мм асфальтобетона всего.
            Плотность асфальтобетона 2.4 т/м³.
            Сколько тонн асфальтобетона нужно (с 5% запасом на потери)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            S = L × B = 66 000 × 27<br />
            V = S × δ = S × 0.21<br />
            M = V × γ × 1.05 (запас)
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Масса А/Б, тысяч тонн"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: S = 66000×27 = 1 782 000 м²; V = 1 782 000 × 0.21 = 374 220 м³; M = 374 220 × 2.4 × 1.05 = 942 824 т ≈ 980 тыс. т. Это масса всех слоёв А/Б на 66 км трассы (для сравнения, годовая производит. крупного асфальтобетонного завода 200-300 тыс. т).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет БАКАД 66 км</h2>
          <p className="text-slate-300">
            БАКАД — 6 полос (3 в каждую сторону), 76 путепроводов и мостов
            (общая длина 12 км эстакад), 13 транспортных развязок «клеверный лист».
            ССЦ: земляное полотно 66 км × шир. 35 м (с дамбами и откосами) — 38 млрд тг,
            дорожная одежда 980 000 т А/Б + основания + ЩПС — 145 млрд тг,
            76 искусственных сооружений (мосты Capitol 4 км эстакада, путепроводы, ливн. водопропуски Ø2-3 м) — 285 млрд тг,
            13 транспортных развязок «клевер» + петли + съезды — 145 млрд тг,
            ливневая канализация + дренажные сооружения 132 км — 28 млрд тг,
            освещение трассы (опоры 12 м, светильники LED Philips) 2200 опор — 18 млрд тг,
            СУДД (Светофоры приоритета + ITS пунктов автоматич. контроля + Variable Message Signs) — 22 млрд тг,
            барьерные ограждения 11 двусторонние / 11 односторонние × 132 км — 18 млрд тг,
            разметка + знаки + информация для водителей — 8 млрд тг,
            благоустройство (зелёные зоны + остановки + АЗС-нефтебазы) — 18 млрд тг,
            проектирование + изыскания + ОВОС + экспертиза — 38 млрд тг,
            FIDIC EPC контракт CRCC China Roads / Турк.Тойота консорциум — 15 млрд тг,
            НР+СП и резерв — 102 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~880 млрд тг (допуск ±10%). 38+145+285+145+28+18+22+18+8+18+38+15+102 = 880 млрд тг. Реальный БАКАД (2017-2024) обошёлся ~$1.6 млрд ≈ 745 млрд тг (без учёта инфляции) → 2026 цены 880 млрд. Удельная стоимость ~13.3 млрд тг/км.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Дренаж дорожной одежды</h2>
          <p className="text-slate-300">
            Без дренажа вода накапливается в основании и дорожная одежда быстро разрушается
            (особенно при морозе) — образуются «волны», ямы, продольные трещины.
            Что обязательно по AASHTO LRFD + СН РК 3.03-09?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только поперечный уклон проезжей части 20‰ для стока поверхностной воды" },
              { v: "b", t: "Достаточно ливнёвки по краям проезжей части и дренажа за бровкой" },
              { v: "c", t: "Многоуровневая дренажная система: 1) Поверхностный сток — поперечный уклон 20-25‰ (выпуклый профиль) + продольный 5-10‰ для стока в кювет/ливнёвку; 2) Ливневая канализация по краю проезжей части — приёмные решётки Saint-Gobain каждые 25-50 м, ливн. труба Ø400-600 мм с уклоном к выпуску, КК каждые 100 м для прочистки; 3) Грунтовый дренаж основания — перфорированная труба Ø100-200 мм Polypipe в геотекстиле NoNonwoven 250 г/м² на уровне нижнего основания (отвод фильтрационных вод из несущих слоёв); 4) Боковой дренажный кювет глубиной 0.8-1.2 м с уклоном (защита земляного полотна от грунтовых вод); 5) Геомембрана HDPE 1.5 мм в местах высокого УГВ (защита от капиллярного подъёма); 6) Защита от пучения — морозозащитный песчаный слой 250 мм (К_фильтр≥2 м/сут), морозозащитная глубина по карте промерзания РК (Астана 1.7 м, Алматы 1.0 м, Шымкент 0.8 м); 7) Регулярная очистка дренажа — 2 раза/год + после ливней; 8) Мониторинг УГВ автоматическими пьезометрами на критических участках; 9) AASHTO LRFD Pavement Design + Highway Drainage Guidelines + СН РК 3.03-09 + ГОСТ Р 52766" },
              { v: "d", t: "Только подбор дренажного коэф. фильтрации песка ≥2 м/сутки" },
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
                {score === 4 ? "Отлично — готовы к проектированию магистрали" : score >= 2 ? "Перечитайте СН РК 3.03-09 + AASHTO LRFD + Superpave" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> СН РК 3.03-09 (Автомобильные дороги), AASHTO LRFD Pavement Design 2020, Superpave Mix Design (NCHRP), ГОСТ 9128 (Асфальтобетон), ГОСТ Р 52766 (Дренаж), FIDIC Yellow/Red Book.</p>
          <p><strong>Реальные объекты РК:</strong> БАКАД 66 км Алматы (2017-2024, $1.6 млрд), ВОАД Восточн. объездная Алматы, Astana-Almaty Highway 1200 км, Западная Европа-Западный Китай 2787 км РК, КАД Шымкент, КАД Атырау.</p>
        </section>
      </main>
    </div>
  );
}
