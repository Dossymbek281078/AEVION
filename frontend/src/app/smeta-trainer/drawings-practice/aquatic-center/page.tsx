"use client";
import Link from "next/link";
import { useState } from "react";

export default function AquaticCenterPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 3300) <= 300;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Олимпийские акватические центры</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🏊 Олимпийские акватические центры (FINA)</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #248. Акватические центры олимпийского уровня (отличие от L4
            «Аквапарки и бассейны» — здесь полная FINA-сертифицированная инфраструктура
            для международных соревнований): Almaty Aquatics Centre (планируется по
            FINA), Алматинский водноспортивный комплекс «Жетысу», Astana Diving
            Pool в Триатлон-Парк. Основной 50-м бассейн 8 дорожек 2.0 м глубиной +
            25-м тренировочный + бассейн для прыжков с 10-м вышкой + разминка.
            Дно/стенки фаянсовые плитки Mosaic Vidrepur, водоподготовка хлор + О₃ + УФ,
            СН РК 4.02-08, FINA FR-2.2 «Competition Pool Standards», ISO 7027.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав FINA-стандартного центра</h2>
          <p className="text-slate-300 leading-relaxed">
            FINA Facilities Rules FR-2 + FR-3 + FR-4:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Соревновательный бассейн (FR-2.2):</strong> 50.0 м × 25.0 м (8-10 дорожек), глубина равномерно 2.0-3.0 м, разделители Antiwave Vidrepur, стартовые тумбы Daktronics с системой автоматич. хронометража, табло.</li>
            <li><strong>Тренировочный бассейн:</strong> 25 м × 12.5 м, глубина 1.8-2.0 м.</li>
            <li><strong>Бассейн для прыжков (FR-2.3):</strong> 21 × 25 м, глубина 5.0-5.5 м, 10-м вышка + 7.5/5.0/3.0/1.0 м трамплины (Duraflex/Maxiflex).</li>
            <li><strong>Бассейн водного поло:</strong> 30 × 20 м, глубина 2.0-3.0 м, ворота 3 × 0.9 м.</li>
            <li><strong>Бассейн синхронного плавания:</strong> 30 × 20 м, глубина 3.0 м с подводной музыкой и окнами наблюдения.</li>
            <li><strong>Зал для разминки сухой:</strong> площадка 30×20 м с тренажёрами, татами для тренировки прыжков.</li>
            <li><strong>Зрительские трибуны:</strong> 5 000-15 000 мест (FINA Class A — до 15 000), уклон 30-35° для оптимальной видимости.</li>
            <li><strong>Раздевалки команд:</strong> 30 чел × 6 раздевалок + судейская + допинг-контроль (по WADA Standards).</li>
            <li><strong>Медиа-центр:</strong> 200-400 мест пресса + ТВ-комментаторские (8-12 кабин) + студии трансляции.</li>
            <li><strong>Технические:</strong> водоподготовка (фильтровальная + хлораторная + озонаторная), ИТП, ВРУ, серверная для ETSI.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Стенки и дно бассейна</h2>
          <p className="text-slate-300">
            Соревновательный бассейн FINA 50×25 м, глубина 2.0 м. Требования FR-2.2:
            ровность дна ±5 мм, идеальная чистота линий для оптической системы хронометража
            Omega. Какая конструкция?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Облицовка ПВХ-плёнкой 1.5 мм — стандарт для коммерческих" },
              { v: "b", t: "Только окраска специальной эпоксидной краской по бетону" },
              { v: "c", t: "Облицовка керамической плиткой обычной с цементной затиркой" },
              { v: "d", t: "Фаянсовая мозаика Vidrepur/Bisazza (Италия/Испания) 25×25 мм или 50×50 мм по технологии Multi-stage: 1) Монолитная ж/б чаша B40 W8 F300 (водонепроницаемый, морозостойкий) толщ. стенок 350 мм, дна 250 мм, армир. двойной сетка A-III Ø12 мм шагом 150 мм с учётом гидростат. давления и расширения; 2) Гидроизоляция Sika Sikaproof или Mapei Mapelastic Smart 2-компонентн. (3 мм толщина под облицовку), герметизация швов лентой Sika Sikadur Combiflex; 3) Подготовка под облицовку — выравнивающая стяжка Sika Sikafloor 161 с допуском ±3 мм по нивелиру; 4) Клей Mapei Granirapid SP белый (для светлых плиток, без диффузии); 5) Мозаика Vidrepur Edna White 25×25 мм или Bisazza Smalto (специальная фаянсовая 4 мм толщ., водопоглощение &lt;3%), стартовые и финишные линии чёрные Cobalto на дне (10 см ширина по FR-2.2.13); 6) Затирка эпоксидная Mapei Kerapoxy CQ (хим. и плесень-устойчивая); 7) Углы и канавки для подводных перетоков воды (Overflow gutter) Aqua-Loop тип Wesselbach; 8) Сертификация плитки EN 14411 BIa + FINA Pool Certification + ISO 9001; 9) Допуск ровности дна ±5 мм по FR-2.2.11 (для оптической Omega Quantum хронометражной системы); 10) Срок службы 25-30 лет без капремонта" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Водоподготовка</h2>
          <p className="text-slate-300">
            Бассейн 50×25×2 м объёмом 2500 м³. По FINA + WHO Pool Standards требуется
            циркуляция полного объёма за 4 часа (4-hour turnover). Какая
            производительность фильтровальной установки нужна (м³/час)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            Q_цирк = V_бассейн / T_turnover<br />
            +20% запас на ППР, регенерацию фильтров, обогрев<br />
            +дополнительно объём peripheral pools (warming, kids)
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Q, м³/час"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: Q_основн = 2500 / 4 = 625 м³/ч. С учётом 25-м тренировочного (625 м³), 21×25×5 м прыжки (2 625 м³), 30×20×3 м водного поло (1800 м³), синхро 30×20×3 (1800 м³) — суммарный объём ~9 350 м³. Циркуляция за 3-4 ч = 2 340-3 100 м³/ч. С учётом запаса +20% → 3 300 м³/час фильтровальной мощности.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет аква-центра</h2>
          <p className="text-slate-300">
            Almaty Aquatics Centre FINA Class A: монолит каркас + покрытие ферменное 18 000 м² — 8.4 млрд тг,
            трибуны 8000 мест + кресла Daplast + AV — 2.8 млрд тг,
            ж/б чаши 5 бассейнов (V_общ ~9350 м³) + гидроизол. + мозаика Vidrepur — 4.2 млрд тг,
            вышка 10 м с трамплинами Duraflex/Maxiflex + площадки — 0.6 млрд тг,
            водоподготовка (8 фильтров песочн. + хлор + О₃ + УФ) 3300 м³/ч — 2.4 млрд тг,
            HVAC специфический (контроль точки росы, удаление хлораминов NH₂Cl) — 1.8 млрд тг,
            раздевалки 12 шт + санузлы + душевые + допинг-контроль WADA — 1.4 млрд тг,
            освещение 1500 лк рабочее + 2400 лк FINA для трансляции LED Musco — 0.6 млрд тг,
            хронометраж Omega Quantum + Daktronics табло × 4 — 0.4 млрд тг,
            СОУЭ + СОТ + СКУД + противопожарная защита — 0.8 млрд тг,
            медиа-центр + ТВ-комментаторские + студии трансляции — 0.6 млрд тг,
            энергоснабжение ТП + ДГУ + UPS для критич. систем — 0.6 млрд тг,
            благоустройство + парковка 1500 м/мест + проект-изыск — 0.4 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~24 млрд тг (допуск ±10%). 8.4+2.8+4.2+0.6+2.4+1.8+1.4+0.6+0.4+0.8+0.6+0.6+0.4 = 25 млрд тг ≈ 24 млрд тг. London Aquatics Centre 2012 г. (Заха Хадид) обошёлся £269 млн ≈ 150 млрд тг — с уникальной архитектурой. Стандартный FINA Class A центр — ~$50-60 млн = 24-28 млрд тг.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Защита от хлораминов</h2>
          <p className="text-slate-300">
            Хлорамины (NH₂Cl, NHCl₂, NCl₃) образуются в воде бассейна из реакции хлора
            с органическими загрязнениями (моча, пот, косметика). Это та самая «химическая
            аура» в бассейне, опасная для здоровья. Что обязательно по WHO + FINA?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Достаточно увеличить хлорирование до 5 мг/л" },
              { v: "b", t: "Только вентиляция чаши с интенсивностью 6 крат/час" },
              { v: "c", t: "Многоуровневая защита по WHO Pool Standards + DIN 19643: 1) Pre-shower обязательный душ перед бассейном (50% снижение загрязнения); 2) Многоступенч. водоподготовка: коагуляция (полиалюминий хлорид PAC), кварц-песочная фильтрация 0.5-0.7 мм фракции, активир. уголь финальная адсорбция; 3) Combined oxidation хлор (1.0-3.0 мг/л свободного) + О₃ озон 1.5-2.5 мг/л на отдельной линии (разрушает прекурсоры хлораминов) + УФ-лампа Wedeco BX2000 (400 мДж/см² для воды, разрушение CombChl уже образованных); 4) Расходование циркуляции 3-4 turnover/сутки = свежая вода ~10% объёма в день (предотвращает накопление дисперсных загрязнений); 5) Контроль pH 7.2-7.4 (оптимум для гипохлорит. кислоты HOCl), ОВП ≥720 мВ; 6) Анализатор Connected Pool Monitor Hach SC4500 каждые 5 мин: pH, ОВП, остаточный хлор, температура, мутность, хлорамины; 7) HVAC специфический — вытяжка с уровня поверхности воды (где концентрация хлораминов max), приток воздуха сверху, кратность 8-10 в/час, добавл. воздуха 30 м³/час/чел, влажность ≤60%; 8) Поверхностные перетоки Overflow gutters Wesselbach (улавливают plumage слой загрязнений); 9) Удаление переливов в отдельный резервуар буферный (15-20% от V_бассейна); 10) Регулярный контроль трихлорамина NCl₃ в воздухе &lt;0.5 мг/м³ по EN 17276; WHO Pool Standards + DIN 19643 + FINA + СанПиН РК 4.01-007" },
              { v: "d", t: "Замена хлора на полностью УФ-обеззараживание" },
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
                {score === 4 ? "Отлично — готовы к проектированию FINA-центра" : score >= 2 ? "Перечитайте FINA FR-2.2 + DIN 19643 + WHO Pool Standards" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> FINA Facilities Rules FR-2 + FR-3 + FR-4, DIN 19643 (Pool Water Treatment), WHO Pool Standards 2006, СН РК 4.02-08, СанПиН РК 4.01-007, ISO 7027, EN 14411 BIa.</p>
          <p><strong>Реальные объекты РК и мир:</strong> Almaty Aquatics Centre (планируется по FINA), Алматинский водноспортивный «Жетысу», Astana Diving Pool в Триатлон-Парк, London Aquatics Centre 2012 (Хадид), Tokyo Aquatics Centre 2020.</p>
        </section>
      </main>
    </div>
  );
}
