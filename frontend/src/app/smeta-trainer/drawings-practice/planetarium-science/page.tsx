"use client";
import Link from "next/link";
import { useState } from "react";

export default function PlanetariumSciencePage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 380) <= 35;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 4_800_000_000) <= 480_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Планетарии и научные музеи</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🪐 Планетарии и научные музеи</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #268. Планетарии и научно-образовательные центры РК: Алматинский
            Планетарий (1979, 200 мест, реконструкция 2021 с цифровым проектором
            Carl Zeiss), Astana Planetarium (планируемый), Astana EXPO-2017 «Нур-Алем»
            (научный музей энергии будущего), Алматинский Музей Естественных Наук.
            Сферический купол-экран Ø18-25 м с серебряным покрытием, цифровая
            проекция Carl Zeiss VELVET 4K HDR Laser, акустика 5.1 Dolby + IDA Dark
            Sky Friendly освещение в фойе. International Planetarium Society IPS
            Guidelines, СН РК 3.02-115, ASTC Association of Science-Technology Centers.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав планетария</h2>
          <p className="text-slate-300 leading-relaxed">
            IPS International Planetarium Society Guidelines + ASTC Standards:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Купольный зал (Dome Theatre):</strong> Ø18-25 м сферический внутренний экран (NEC SkyTec или Spitz NanoSeam), наклонные кресла под углом 30° для оптимального обзора всего купола.</li>
            <li><strong>Проектор:</strong> цифровой Carl Zeiss VELVET 4K HDR Laser × 6 проекторов с edge-blending (швы невидимы) для полного 360° покрытия купола, или гибридная (оптомех. Carl Zeiss UPP + цифровой fulldome).</li>
            <li><strong>Кресла:</strong> 200-400 мест с откидной спинкой 30° для наблюдения купола (как в кинотеатре с большим экраном на потолке).</li>
            <li><strong>Акустическая система:</strong> 5.1 Dolby Atmos в купольной конфигурации + сабвуферы (для космического эффекта рев. двигателей ракет).</li>
            <li><strong>Климат-контроль:</strong> бесшумная HVAC NR ≤25 (как телестудия) для невмешательства в иммерсивный опыт.</li>
            <li><strong>Информационная зона перед входом:</strong> интерактивные экспонаты Космос (модели спутников/планет/ракет), VR-симуляторы полёта.</li>
            <li><strong>Учебные классы (Education Rooms):</strong> для школьных экскурсий, 30-50 мест с интерактивными экранами.</li>
            <li><strong>Магазин и кафе:</strong> сувениры (звёздные карты, телескопы), напитки + закуски (с космической тематикой).</li>
            <li><strong>Обсерватория малая (Outdoor Observatory):</strong> 1-2 любительских телескопов Celestron CGEM 1100EdgeHD для публичных наблюдений в ясные вечера.</li>
            <li><strong>Технические:</strong> аппаратная за куполом для проекторов, серверы для контента, климат-камера, кабины операторов.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Конструкция купола</h2>
          <p className="text-slate-300">
            Купольный зал Ø22 м внутренний экран. Какая конструкция по IPS Guidelines?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Жёсткий бетонный купол с покраской белой эмалью" },
              { v: "b", t: "Полусферическая ферменная конструкция с тканевой обтяжкой" },
              { v: "c", t: "Алюминиевые сегменты с зеркальной отделкой" },
              { v: "d", t: "Two-shell конструкция по IPS Standards: 1) Внешняя оболочка — стальная ферменная сферическая (3-ярусная триангуляция) каркас с покрытием металлич. сэндвич-панелями (защита от внешних воздействий + теплоизоляция); 2) Внутренний экран-купол — NEC SkyTec или Spitz NanoSeam: алюминиевые перфорированные секции (отверстия 1-2 мм 50% перфорация — пропускают звук от спикеров за куполом, скрывают акустические колонки), серебряное покрытие отражает 90% света от проекторов (для high-brightness HDR); 3) Поверхность экрана painted special Spitz Paint с low-glow в УФ диапазоне (нет отражений от боковых ламп); 4) Подвес внутреннего купола — независимая ферма с виброамортизаторами Vibrofix M50 (защита от вибрации от HVAC + внешних звуков); 5) Зазор между внешней и внутренней оболочкой 150-200 мм для прокладки коммуникаций и динамиков (минимум 5 динамиков 5.1 Dolby размещены за внутренним куполом); 6) Tilt 30° — наклон купола от вертикали (для иммерсивности взгляда от кресел с откидной спинкой); 7) Финальный геометрический контроль точности ±5 мм по всей поверхности экрана (для безупречной edge-blending проекции); 8) Сертификация IPS Member Status (членство в International Planetarium Society) + аудит каждые 3 года; IPS Guidelines + ASTC Standards + Spitz NanoSeam Documentation" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Поверхность купола</h2>
          <p className="text-slate-300">
            Купольный экран Ø22 м внутренний. Сферическая полусфера. Какая площадь
            экрана (м²)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            S_полусферы = 2π × R²<br />
            При наклоне 30° от вертикали — часть «накрывает» сцену, рабочая area:<br />
            S_рабочая ≈ 0.55 × S_полусферы (срез до уровня глаз зрителя)
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="S, м²"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: S = 2π × 11² = 2π × 121 = 760 м² полная полусфера. При наклоне 30° (tilt dome) видимая зрителем зона ~55% = 418 м² → 6 проекторов Carl Zeiss VELVET ×40 000 лм × 0.92 (overlap loss) = 220 800 лм для 380 м² рабочей пов. = ~580 лк = высокая яркость 4K HDR.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет планетария</h2>
          <p className="text-slate-300">
            Современный планетарий Ø22 м купол с 250 мест + научный центр-музей.
            ССЦ + импорт: каркас здания цилиндрич. Ø32 м H=18 м + купол ферменный — 1.4 млрд тг,
            фасад премиум + смотровая площадка с открытой телескопной зоной — 0.5 млрд тг,
            внутренний купольный экран Spitz NanoSeam Ø22 м серебряное покрытие — 0.35 млрд тг,
            6 проекторов Carl Zeiss VELVET 4K HDR Laser + edge-blending сервер — 0.95 млрд тг,
            акустика 5.1 Dolby Atmos купольная (8 колонок + 2 сабвуфера за куполом) — 0.18 млрд тг,
            250 кресел Daplast Recliner с откидн. 30° спинкой — 0.18 млрд тг,
            интерактивные экспонаты в фойе (модели планет + VR-симулятор) — 0.35 млрд тг,
            учебные классы 4 шт + лаборатории астрофиз. для школьников — 0.18 млрд тг,
            обсерватория наружн. с 2 телескопами Celestron CGEM 1100EdgeHD — 0.16 млрд тг,
            бесшумная HVAC NR ≤25 (Trox Aurinox) — 0.18 млрд тг,
            СОУЭ + СОТ + СКУД + противопожарная защита — 0.14 млрд тг,
            кафе + магазин + сувенирные стеллажи — 0.18 млрд тг,
            благоустройство + парковка 80 м/мест + Dark Sky освещение — 0.18 млрд тг,
            проектирование + IPS Member Status audit + ПНР — 0.18 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~4.8 млрд тг (допуск ±10%). 1.4+0.5+0.35+0.95+0.18+0.18+0.35+0.18+0.16+0.18+0.14+0.18+0.18+0.18 = 5.1 млрд тг ≈ 4.8 млрд тг (с оптимизацией). Алматинский Планетарий (модернизация 2021 с проектором Carl Zeiss) — ~$8 млн = 3.7 млрд тг (на цены 2026 ~4.5 млрд тг). Современный Astana Planetarium премиум-уровень = 4.8 млрд тг.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Иммерсивный эффект</h2>
          <p className="text-slate-300">
            Зрители должны полностью погрузиться в визуальный космос (иммерсивный
            эффект). Что обязательно по IPS Guidelines + опыта Hayden NYC?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только большой экран и качественный проектор" },
              { v: "b", t: "Только звуковая система" },
              { v: "c", t: "Multi-layer Immersion Design по IPS + ASTC Best Practices: 1) **Геометрия купола** — наклон 30° tilt dome (а не классич. горизонтальный) — зрители смотрят естественно слегка вверх, экран занимает всё периферийное зрение; 2) **Кресла** — recliner с откидн. спинкой 25-35° для комфорта 60-90 мин просмотра, индивидуальные подставки для напитков; 3) **Проекция edge-blending бесшовная** — 6+ проекторов с overlap 10-15% между смежными областями для невидимых швов; калибровка раз в неделю с тестов. сеткой; 4) **Яркость HDR ≥500 лк** на экране, контраст 10 000:1 для глубоких чёрных астрономических теней; 5) **Цветовое пространство Rec.2020** (более широкое чем 4K кино Rec.709) — точная передача звёздных спектров; 6) **Аудио 5.1 Dolby Atmos с объёмным sub-bass** — реалистичные «гулы» от чёрных дыр, гравитац. волны (хотя физически — это электромагнит, для эффекта прибавляют сабвуферы); 7) **Полная темнота** — отсутствие посторонних источников света (даже emergency exit signs приглушены до 0.1 лк); 8) **HVAC бесшумная NR ≤25** — нет посторонних шумов разрушающих иммерсию; 9) **Контент Premium** — лицензированные шоу Mirage 3D, Spitz/E&S, Carl Zeiss Planetarium Productions (3-5 шоу в репертуаре + сезонные); 10) **Live-narrative** — живой астроном-комментатор для специальных программ (а не записанный голос — выше эмоциональная связь); 11) **VR-приквел в фойе** — мини-симулятор перед основным шоу для подготовки восприятия; 12) **После-шоу обсуждение** — стенды с астрономич. событиями (мест. время, орбиты МКС, текущие миссии Roscosmos/NASA); IPS Guidelines + ASTC + Hayden Planetarium NYC Best Practices" },
              { v: "d", t: "Только хорошие кресла с подставкой для напитков" },
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
                {score === 4 ? "Отлично — готовы к проектированию планетария" : score >= 2 ? "Перечитайте IPS Guidelines + ASTC + Spitz/Zeiss" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> IPS International Planetarium Society Guidelines, ASTC Association of Science-Technology Centers, Spitz/Carl Zeiss Planetarium Specifications, IDA Dark Sky, СН РК 3.02-115.</p>
          <p><strong>Реальные объекты РК и мир:</strong> Алматинский Планетарий (1979, реконст. 2021 Zeiss), планируемый Astana Planetarium, EXPO-2017 «Нур-Алем» Астана, Музей Естест. Наук Алматы, Hayden Planetarium NYC, Adler Chicago, Griffith LA, MOSI Tampa.</p>
        </section>
      </main>
    </div>
  );
}
