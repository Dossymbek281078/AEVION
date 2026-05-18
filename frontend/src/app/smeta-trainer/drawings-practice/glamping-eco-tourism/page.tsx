"use client";
import Link from "next/link";
import { useState } from "react";

export default function GlampingEcoTourismPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 32) <= 3;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 850_000_000) <= 85_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Глэмпинги и эко-туризм</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">⛺ Глэмпинги и эко-отели</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #266. Глэмпинги (Glamour + Camping) и эко-отели РК: Charyn Canyon
            Glamping (20 шатров premium на краю каньона), Borovoe Eco-Resort (юрты +
            tipi), Балхаш Eco-Camp (палатки premium на берегу озера), Алаколь Eco-
            Lodge. Тент-палатки Tipi/Yurt/Safari Tent с системами обогрева + санузлами,
            off-grid энергоснабжение СЭС 5-10 кВт + аккумулятор LiFePO₄ 50 кВт·ч,
            биотуалеты Phoenix Composting (компостирование человеческих отходов),
            восстановление территории после демонтажа. Стандарты GSTC (Global
            Sustainable Tourism Criteria), СН РК 4.04, ISO 14001 Environmental.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Типы глэмпинг-юнитов</h2>
          <p className="text-slate-300 leading-relaxed">
            GSTC Industry Criteria + Glamping Hub Standards:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Safari Tent (Сафари-палатка):</strong> 30-45 м² premium тент-конструкция Stout Tent / Bushtec на деревянной платформе h=400 мм, стены canvas water-/UV-proof 540 г/м², кровля двойная.</li>
            <li><strong>Юрта (Yurt):</strong> традиционная казахская конструкция Ø6-8 м, деревянный каркас (кереге, уык) + войлок 8 мм + наружный канвас.</li>
            <li><strong>Tipi (Типи):</strong> индейский конический шатёр H=6-8 м, деревянные шесты + canvas 360°.</li>
            <li><strong>Bubble Hotel:</strong> прозрачная сферическая капсула Ø4 м с надувной структурой PVC + полиэтилен (наблюдение за звёздами).</li>
            <li><strong>Treehouse (Дом на дереве):</strong> деревянная конструкция на платформе на стволе дерева, лестница, балкон.</li>
            <li><strong>Cabin / Eco-lodge:</strong> деревянный сруб 25-40 м² 4 спальни + санузел, ground source heat pump (geothermal).</li>
            <li>Внутри юнита: кровати queen-size с премиум-постельным, освещение LED + керосиновые лампы (атмосфера), санузел с биотуалетом, душ с подогревом.</li>
            <li>Деревянные платформы — фундамент без бетона (legkий монтаж/демонтаж, минимальное воздействие на природу).</li>
            <li>Обогрев — дровяная печь (для романтики) + резервный электрообогреватель / heat pump.</li>
            <li>Освещение — minimum dark sky friendly (защита наблюдения звёзд), янтарные LED 2700 K, ≤200 лм на источник.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Off-grid энергоснабжение</h2>
          <p className="text-slate-300">
            Глэмпинг Charyn Canyon — 20 юнитов, удалённость от электросетей 25 км.
            Расчётная нагрузка 4 кВт/юнит (освещение + холодильник + санузлы + Wi-Fi).
            Какое off-grid решение по GSTC?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только дизель-генератор 100 кВт круглосуточно" },
              { v: "b", t: "Только солнечные панели без аккумуляторов" },
              { v: "c", t: "Только ветрогенератор без других источников" },
              { v: "d", t: "Гибридная off-grid система: 1) Солнечная электростанция СЭС 80 кВт пиковая мощность (200 фотомодулей JinkoSolar Tiger Neo 400 Вт каждая, общая площадь 480 м²) на вспомогательной конструкции (не на жилых юнитах для свободного снятия зимой); 2) Литий-железо-фосфатные аккумуляторы LiFePO₄ Sungrow SBR HV 100 кВт·ч ёмкости (8 часов автономии при полной нагрузке) — самые безопасные (нет термического разгона), срок службы 6000 циклов (16 лет); 3) Контроллер заряда MPPT Victron Cerbo GX + инверторы Multiplus II 15 кВА × 3 (для трёхфазной 380 В сети); 4) Резервный ДГУ Cummins C50D5 50 кВА (с автозапуском при разряде батарей &lt;20% или при погодных условиях, например затяжной пасмурный день); 5) Wi-Fi через спутниковую связь Starlink Business 200 Мбит/с (для удалённой location); 6) Контроль нагрузки через Home Assistant + Tesla Powerwall-style мониторинг; 7) Smart Grid — приоритезация энергии (свет важнее холодильника, который важнее Wi-Fi, который важнее джакузи); 8) Микро-ГЭС на горном ручье (если есть, Charyn 50-100 кВт круглый год); 9) Низковольтное освещение 12 В DC (без потерь на инверсию) — снижение нагрузки и пожароопасности; 10) Геотермальный тепловой насос Stiebel Eltron WPL 9 кВт для отопления (зимой Charyn -25°C); 11) Сертификация LEED Net Zero + GSTC; GSTC Industry Criteria + ISO 14001 + IEC 62109 (Inverter Safety)" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Биотуалет Phoenix Composting</h2>
          <p className="text-slate-300">
            Phoenix Composting Toilet ÆR 200 — биотуалет с компостированием. Лагерь
            20 юнитов × 2 гостя × 3 дня = 120 чел-дней средняя занятость. Норматив
            производительности Phoenix ÆR 200: 200 чел-дней между опорожнениями.
            Сколько биотуалетов нужно (с резервом 50%)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            N_расч = чел-дней / 200 (для ÆR 200)<br />
            Для нормальной работы у каждого юнита свой биотуалет<br />
            +50% резерв на пиковые сезоны и резерв на обслуживание
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Кол-во биотуалетов"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: 20 юнитов = 20 индивид. биотуалетов + 4-6 общественных (бар, ресепшен) = ~26-28 шт. С учётом резерва +50% = 32 биотуалета общая инсталляция. Phoenix ÆR 200 — Top-of-class (нет запаха, аэробная компостирование 6-12 мес → удобрение для ландшафтов).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет глэмпинга 20 юнитов</h2>
          <p className="text-slate-300">
            Premium глэмпинг Charyn Canyon. ССЦ + импорт:
            20 Safari Tent Stout Tent премиум 30-45 м² с canvas, double-pole — 120 млн тг,
            деревянные платформы под палатками (без бетона) — 36 млн тг,
            внутренняя отделка palatok (кровать + санузел + дровяная печь) — 80 млн тг,
            СЭС 80 кВт солнечная + LiFePO₄ 100 кВт·ч + Victron инверторы — 95 млн тг,
            резервный ДГУ Cummins 50 кВА + автоматика — 18 млн тг,
            32 биотуалета Phoenix Composting ÆR 200 — 56 млн тг,
            водоснабжение скважинное + резервуар 50 м³ + насосная — 38 млн тг,
            ресепшен + ресторан-юрта 200 м² с центральной кухней — 95 млн тг,
            СПА-юрта (хаммам + сауна + джакузи открытое) — 55 млн тг,
            смотровая площадка + пешие тропы + лестницы — 28 млн тг,
            спутниковая связь Starlink Business + Wi-Fi mesh — 6 млн тг,
            охрана периметра + видеонаблюдение IP + сигнализация — 18 млн тг,
            подъездная дорога Кат. V 8 км + парковка 30 м/мест — 75 млн тг,
            ландшафт + малые арх. формы + декор. освещение dark sky — 32 млн тг,
            проектирование + ОВОС + лицензии + GSTC сертификация — 38 млн тг,
            оборотные ср-ва первый сезон (персонал 30 чел + расходники) — 60 млн тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~850 млн тг (допуск ±10%). 120+36+80+95+18+56+38+95+55+28+6+18+75+32+38+60 = 850 млн тг. Удельная стоимость ~42 млн тг/юнит — премиум-эко. С аналогом: Eco-Lodge класс «Six Senses» (Шри-Ланка, Бутан) — ~$200-300 тыс./юнит = 92-138 млн тг (выше за счёт международного бренда).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Экологический сертификат</h2>
          <p className="text-slate-300">
            Глэмпинг позиционируется как «эко-туризм». Что обязательно для подлинной
            сертификации по GSTC + ISO 14001 (а не «гринвошинг»)?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Использование надписи «эко» в маркетинге без сертификации" },
              { v: "b", t: "Только солнечные панели на крыше офиса" },
              { v: "c", t: "GSTC Industry Criteria + ISO 14001 Multi-Domain Audit: 1) **Management & Compliance** — Sustainability Management System (SMS), стратегия снижения воздействия с измеримыми KPI; 2) **Socio-economic Impact** — приоритет местного найма (≥60% персонала из ближайших деревень), местные поставщики продукции (≥50%), поддержка местных школ/мед. учреждений; 3) **Cultural Impact** — уважение к традициям (предложение казахских блюд, юрты, фольклорные программы), запрет на коммерциализацию священных мест; 4) **Environmental Impact**: a) Энергия — ≥80% возобновл. источников + общая экономия 30% от стандарта; b) Вода — recycling ≥30%, потребление ≤200 л/чел/день; c) Отходы — ≥90% recycling/композирование (Phoenix Composting); d) Эмиссии CO₂ — Net Zero к 2030 (компенсация лесопосадками или buying carbon credits Gold Standard); e) Дикая природа — запрет на загрязнение почвы, регулярный мониторинг биоразнообразия; 5) **Wildlife & Biodiversity** — никаких animal shows, минимальное освещение ночью (защита миграций птиц/насекомых), buffer zones между туристическими тропами и местами обитания диких животных; 6) **Construction Sustainability** — материалы локальные (camel wool, river stone), демонтируемая конструкция (без бетона), углеродный след стройки ≤15 кг CO₂eq/м²/год; 7) **Education** — гид по экологии для гостей, информационные таблички о флоре/фауне; 8) **Annual Audit** — независимая верификация GSTC-сертификатором, отчёт публикуется для общественности; GSTC v3 + ISO 14001 + EU Ecolabel + LEED Recreation Industry" },
              { v: "d", t: "Только использование биоразлагаемых пакетов" },
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
                {score === 4 ? "Отлично — готовы к проектированию глэмпинга" : score >= 2 ? "Перечитайте GSTC v3 + ISO 14001 + IEC 62109" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> GSTC (Global Sustainable Tourism Criteria) v3, ISO 14001 (Environmental Management), EU Ecolabel, LEED Recreation, IEC 62109 (Inverter Safety), СН РК 4.04, EN 14502 (Tents).</p>
          <p><strong>Реальные объекты РК и мир:</strong> Charyn Canyon Glamping, Borovoe Eco-Resort, Балхаш Eco-Camp, Алаколь Eco-Lodge, Sigiriya Lodges Шри-Ланка, Soneva Six Senses Мальдивы, Atlas Mountains Glamping Марокко.</p>
        </section>
      </main>
    </div>
  );
}
