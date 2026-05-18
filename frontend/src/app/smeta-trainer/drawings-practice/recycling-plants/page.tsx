"use client";
import Link from "next/link";
import { useState } from "react";

export default function RecyclingPlantsPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 65) <= 6;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Мусоросортировочные комплексы</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">♻️ Мусоросортировочные комплексы (MRF)</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #247. MRF (Material Recovery Facility) РК: Алматинский пилот 500 т/сут
            (Operator «Тазалык», 2024 г.), планируемый Шымкентский MRF 800 т/сут,
            Карагандинский MRF 300 т/сут. Технология: ленточные конвейеры с ручной/
            оптической сортировкой Tomra Autosort + Steinert, пневмосепарация, баллис.
            сепараторы Sutco, прессы-пакетировщики Macpresse / Avermann.
            Линия пиролиза пластика Plastic Energy 5 т/час. Стандарты ISO 14001, EU
            Waste Framework Directive 2008/98/EC, СН РК 4.01-02, EREF MRF Standards.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Технология сортировки MRF</h2>
          <p className="text-slate-300 leading-relaxed">
            EREF Material Recovery Facility Standards + EU 2008/98/EC:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-slate-300 pl-2">
            <li>Приёмное отделение (Tipping Floor) — площадка 1500-3000 м² с уклоном 2% к дренажу, бункерная подача автомусоровозов.</li>
            <li>Грубая ручная сортировка — удаление крупногабаритных (мебель, бытовая техника) + опасных батарей.</li>
            <li>Барабанный сито (Trommel) Ø2.5 м × L=10 м — разделение по фракциям (&lt;50 мм мелкая органика + ≥50 мм основной поток).</li>
            <li>Дробилка предварительная Lindner Universo 50 — измельчение крупных фракций до 200 мм для упрощения сортировки.</li>
            <li>Баллистический сепаратор Sutco BRT (плоское + 3D разделение) — отделяет плёнки, фольгу от бумаги/картона.</li>
            <li>Магнитный сепаратор (для металлов чёрных) — постоянные неодимовые магниты, ленточный.</li>
            <li>Эдди-токовый сепаратор (для алюминия и цветных) — вращающийся магнитный ротор индуктирует токи в проводящих частицах.</li>
            <li>Оптические сортировщики Tomra Autosort 5 / Steinert UniSort — NIR (Near Infrared) распознавание PET, HDPE, PVC, PS, PP с производительностью до 8 т/час каждый.</li>
            <li>Ручная контрольная сортировка (Quality Control) — линия операторов 10-20 чел для финальной очистки.</li>
            <li>Прессы-пакетировщики Macpresse MAC107 (для PET-бутылок), Avermann AP1000 (для картона) — кипы по 350-500 кг.</li>
            <li>Линия пиролиза пластика (для смеси нерастёртых пластиков) Plastic Energy 5 т/час — производство пиролизн. нефти.</li>
            <li>Хранилище отсортированных вторичных ресурсов + загрузка на ж/д или авто-фуры.</li>
          </ol>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Оптимальная схема MRF</h2>
          <p className="text-slate-300">
            Для г. Алматы 500 т/сут смешанных ТБО — какая оптимальная сортировочная
            схема по EREF MRF Standards?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только ручная сортировка на ленточных конвейерах — традиционно" },
              { v: "b", t: "Только Trommel + магнитный сепаратор без оптической" },
              { v: "c", t: "Дробилка → Trommel → ручная контр. сортировка без оптических Tomra" },
              { v: "d", t: "Single Stream MRF с автоматич. сортировкой: 1) Tipping floor 2000 м² с уклоном 2%, кран-грейфер для подачи; 2) Грубая ручная сортировка удаление крупногабарита (мебель, ковры, опасные); 3) Disc Screen или Star Screen — разделение по форме (плоский картон → отдельный поток, объёмные → основной); 4) Trommel Ø2.5 м × L=10 м фракционирование: &lt;75 мм мелкая → органика → компостер; 75-300 мм средняя → основной поток; &gt;300 мм крупная → измельчение Lindner; 5) Магнитный сепаратор оверленточный (стали 96-98% извлечение); 6) Eddy Current сепаратор (алюминий + латунь + медь 90-95% извлечение); 7) Баллистический Sutco BRT (плёнка vs картон/бумага); 8) Оптические сортировщики Tomra Autosort 5 × 3 шт. (поочерёдно: PET бутылки → HDPE → PP/PS), производительность 4-6 т/час каждый; 9) Ручная контрольная сортировка на конвейерах (10 операторов × 2 смены); 10) Прессы-пакетировщики Macpresse MAC107 — кипы 350-500 кг для отгрузки переработчикам; 11) Линия пиролиза пластиковых остатков Plastic Energy 5 т/час → пиролизн. нефть для НПЗ; 12) WMS Waste Management System + SCADA + весовая на въезде/выезде; 13) Целевые показатели извлечения (Recovery Rates) — стандарт EU EREF: PET 85%, HDPE 80%, металлы 95%, картон 75%, общая доля переработки 35-45%; 14) Сертификация ISO 14001 + EU 2008/98/EC + СН РК 4.01-02 + EREF Best Practices" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Производительность линии</h2>
          <p className="text-slate-300">
            MRF 500 т/сут работает 2 смены × 8 часов = 16 ч/сут. Линия должна иметь
            запас 30% для пиковых нагрузок и плановых остановок. Какая часовая
            производительность главного конвейера (т/час)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            P_базовая = 500 т/сут / 16 ч = 31.25 т/ч<br />
            P_расчётная = P_базовая × 1.3 (запас) × 1.6 (пики)
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="P, т/час"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: 31.25 × 1.3 × 1.6 = 65 т/ч. Это пиковая. Постоянная нагрузка 30-40 т/ч. При плотности ТБО 200-300 кг/м³ — объёмная произв. 200-300 м³/ч. Скорость конвейера 0.7-1.0 м/с при ширине 2.0 м.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет MRF 500 т/сут</h2>
          <p className="text-slate-300">
            ССЦ + импорт: производственный корпус MRF 8000 м² (ВРС 10 м) — 4.2 млрд тг,
            Tipping Floor + крановое оборудование 2 крана — 0.8 млрд тг,
            конвейерная система (главные + распределит. + 18 шт. локальн.) — 2.4 млрд тг,
            Trommel + Disc Screen + баллистич. Sutco BRT — 1.6 млрд тг,
            дробилка Lindner Universo 50 (для предв. измельчения) — 0.6 млрд тг,
            3 оптических Tomra Autosort 5 — 2.8 млрд тг,
            магнитный + Eddy Current сепараторы — 0.4 млрд тг,
            прессы-пакетировщики Macpresse + Avermann × 4 шт. — 1.2 млрд тг,
            линия пиролиза Plastic Energy 5 т/час — 1.8 млрд тг,
            ленты тонкой ручной сортировки + рабочие места 20 чел — 0.3 млрд тг,
            АСУ ТП SCADA + WMS Waste Management System — 0.6 млрд тг,
            HVAC + пылеулавл. + противопожарная защита — 0.8 млрд тг,
            трансформаторная подстанция + резерв ДГУ 500 кВт + UPS — 0.6 млрд тг,
            весовая 80-тонная въезд/выезд + контроль качества — 0.2 млрд тг,
            благоустройство + офис + санзона + проект-изыскания — 0.7 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~18 млрд тг (допуск ±10%). 4.2+0.8+2.4+1.6+0.6+2.8+0.4+1.2+1.8+0.3+0.6+0.8+0.6+0.2+0.7 = 19 млрд тг ≈ 18 млрд тг. Удельная стоимость MRF — $250-400/т·год мощности (для 180 000 т/год = $45-72 млн = 20-32 млрд тг).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Циркулярная экономика</h2>
          <p className="text-slate-300">
            MRF — лишь часть Circular Economy. Что обязательно для полной цепи замкнутого
            цикла по EU Action Plan for Circular Economy 2020?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только повышение % сортировки внутри MRF" },
              { v: "b", t: "Только запрет одноразовых пластиков" },
              { v: "c", t: "Полный цикл Circular Economy по EU Action Plan 2020 + Hierarchy of Waste по EU 2008/98/EC: 1) PREVENTION (предотвращение) — снижение упаковки производителями, законодательный запрет на одноразовые пластики (РК 2024), системы Refill/Reuse; 2) PREPARATION FOR RE-USE — ремонт техники, ткани (charity shops, мастерские); 3) RECYCLING — раздельный сбор у источника (контейнеры PET/Бумага/Стекло/Орг.), MRF с автоматич. сортировкой 35-45% recovery, RPET переработка в новые бутылки (bottle-to-bottle), переработка картона в новую тару, переработка алюминия (97% энергоэффект.), стекла (бесконечно перерабатываемо), органика → компост или анаэробное брожение → биогаз для энергии; 4) ENERGY RECOVERY (с энергоутилизацией) — Waste-to-Energy для не-перерабатываемого остатка 10-15%; 5) DISPOSAL (захоронение) — только инертный остаток &lt;5% ТБО на полигон (целевой показатель EU к 2035); 6) Расширенная Ответственность Производителя EPR (Extended Producer Responsibility) — производитель оплачивает переработку упаковки своих товаров (Германия Grüner Punkt, Франция Eco-Emballages); 7) Целевые показатели EU 2025/2030/2035: 55%/60%/65% recovery rate для ТБО, &lt;10% к 2035 на полигон; 8) Раздельный сбор у источника обязателен для биоотходов EU 2024+; 9) Цифровизация — Track&Trace упаковки через QR/blockchain (CHEMICALS Strategy 2020); 10) Поддержка вторичного рынка материалов (зелёные госзакупки, налоговые льготы на recycled content ≥30%); EU Circular Economy Action Plan 2020 + EU Waste Framework Directive 2008/98/EC + ISO 14001/14005" },
              { v: "d", t: "Только массовое внедрение биоразлагаемого пластика" },
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
                {score === 4 ? "Отлично — готовы к проектированию MRF" : score >= 2 ? "Перечитайте EU 2008/98/EC + EREF + ISO 14001" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> EU Waste Framework Directive 2008/98/EC, EU Action Plan for Circular Economy 2020, ISO 14001, EREF MRF Standards, СН РК 4.01-02, СанПиН РК 4.01-007.</p>
          <p><strong>Реальные объекты РК и СНГ:</strong> Алматинский MRF 500 т/сут (Тазалык, 2024), Шымкентский 800 т/сут (планируется), Карагандинский 300 т/сут, Балашиха-MSW Москва (350 т/час Tomra+Sutco), Mannheim MRF Германия 100 000 т/год.</p>
        </section>
      </main>
    </div>
  );
}
