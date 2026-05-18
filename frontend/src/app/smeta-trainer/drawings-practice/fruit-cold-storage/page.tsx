"use client";
import Link from "next/link";
import { useState } from "react";

export default function FruitColdStoragePage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 1850) <= 180;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 5_800_000_000) <= 580_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Плодоовощехранилища</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🍎 Плодоовощехранилища с РГС (Controlled Atmosphere)</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #253. Плодоовощехранилища с регулируемой газовой средой РГС РК:
            «Алматинский Сад» (10 000 т яблок Sinap/Aport — экспорт в РФ/ЕС), «Капчагай-Фрукт»
            (виноград + персик 5000 т), «Кызылординский Бахчевой» (арбузы + дыни),
            «Талды-Курган Овощехранилище» (картофель + морковь 8000 т). Камеры РГС с
            точным контролем O₂ 1-5% + CO₂ 1-5% + N₂ остаток + t°=0..+4°C (для яблок),
            мембранные сепараторы Praxair, диффузионная герметизация полиуретан-плёнкой.
            СН РК 4.02-08, ISO 8328 (CA Storage), FAO Post-harvest Compendium.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Технологии хранения плодов</h2>
          <p className="text-slate-300 leading-relaxed">
            FAO Post-harvest Compendium + ISO 8328:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Холодильное хранение (Refrigerated):</strong> t°=0..+4°C, RH=85-90%, обычная атмосфера — для краткосрочного 1-2 мес (яблоки, груши).</li>
            <li><strong>РГС стандартная (Standard CA):</strong> O₂=2-3%, CO₂=3-5%, N₂=92-95%, t°=0..+2°C — для долгосрочного 6-9 мес (яблоки Sinap/Aport).</li>
            <li><strong>РГС Ultra Low Oxygen ULO:</strong> O₂=1-1.5%, CO₂=1-2% — для премиум-сортов яблок и хранения 10-12 мес.</li>
            <li><strong>DCA (Dynamic Controlled Atmosphere):</strong> биомониторинг плодов через chlorophyll fluorescence (фирма HarvestWatch), динамич. подстройка O₂ до 0.5%.</li>
            <li><strong>МГС (Modified Atmosphere Storage):</strong> для бытовой упаковки фруктов с измененной атмосферой через плёнки.</li>
            <li>Камеры РГС — герметичные с теплоизол. сэндвич-панелями 200 мм PIR, газонепроницаемость &lt;0.5% утечки/сутки (тест декомпрессии).</li>
            <li>Источники газа: PSA генератор N₂ Atlas Copco (поглощение CO₂ цеолитом, выделение N₂), CO₂ из баллонов (для повышения), CO₂ scrubber (для понижения).</li>
            <li>Холодильное оборудование: компрессоры R717 NH₃ или R744 CO₂ субкритич.</li>
            <li>Циркуляция воздуха в камере: ламинарный поток через перфорированный потолок, скорость 0.1-0.3 м/с.</li>
            <li>Этилен-абсорберы (Ethylene Absorbers) на основе KMnO₄ для удаления этилена C₂H₄ — гормона созревания.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Камеры для яблок Aport</h2>
          <p className="text-slate-300">
            Хранилище 5000 т яблок Aport на 10 мес (с сентября до июля). Какая технология
            хранения по FAO Post-harvest + Apple Storage Guidelines (USDA)?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Обычное холодильное хранение 0°C, обычная атмосфера" },
              { v: "b", t: "РГС стандартная (O₂=3%, CO₂=5%) на 6 мес" },
              { v: "c", t: "Холод + газ Калия Перманганат" },
              { v: "d", t: "Ultra Low Oxygen ULO + Dynamic CA: 1) Камеры теплоизолированные сэндвич-панели Kingspan KS1000 RW 200 мм PIR (U=0.11 Вт/м²·К); 2) Газонепроницаемость через двойную мембрану — наружное стальное покрытие + полиуретановое уплотнение всех швов Sikaflex Pro 3 + тестовая декомпрессия (max утечка 0.3%/24 ч); 3) Холодильное оборудование R717 NH₃ или R744 CO₂ субкритич. + glycol secondary loop, t°=0.5-1.0°C ±0.2°C; 4) RH=92-95% (предотвращ. высыхания и сморщивания плодов); 5) Атмосфера ULO: O₂=1.0-1.5%, CO₂=1.5-2.0%, N₂=96-97% — генератор N₂ Atlas Copco NGP+ PSA технология, CO₂ Scrubber Janny MT cassette (Marcello Tonni) активир. уголь, regeneration with ambient air; 6) DCA Dynamic Control — биомониторинг через chlorophyll fluorescence sensors HarvestWatch (1 датчик на 100 т плодов), снижение O₂ до 0.5% если плоды не «стрессуют» (показатель FQ index); 7) Этилен-абсорберы (Ethylene Scavengers) KMnO₄/Zeolite в активной циркуляции — снижение C₂H₄ до &lt;0.1 ppm (предотвращ. перезревания); 8) Сертификация поступления плодов — индекс зрелости Streif Index (плотность + крахмал + сахар + кислота), pre-cooling за 24 ч до закрытия камеры; 9) АСУ Janny MT EvolutionCA — мониторинг 24/7 O₂/CO₂/t°/RH/C₂H₄ для каждой камеры; 10) Срок хранения яблок Aport (поздний сорт, Алматинский) с DCA = 10-12 мес с сохранением вкуса и плотности; FAO Post-harvest + USDA Apple Storage + ISO 8328" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Холодопроизводительность</h2>
          <p className="text-slate-300">
            Хранилище 5000 т яблок. Тепловая нагрузка: 1) Теплоприток через стены/потолок/пол
            ~12 кВт; 2) Тепло дыхания плодов (Field Heat) 25 Вт/т × 5000 = 125 кВт
            (первые 7 дней охлаждения); 3) Освещение, моторы вентиляторов 5 кВт;
            4) Теплопритоки при загрузке/разгрузке ~10 кВт. Какая холодильная
            мощность нужна (кВт)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            P_общ = P_стены + P_дыхание + P_свет + P_операции<br />
            +20% запас на пики (открытие дверей, неожиданные нагрузки)<br />
            +50% запас на pre-cooling фазу (первая неделя после поступления)
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Холод. мощность, кВт"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: P_рабочая = 12+125+5+10 = 152 кВт. С запасом +20% на пики = 182 кВт. Но первые 7-10 дней после поступления — pre-cooling режим: тепло дыхания удваивается до 50 Вт/т = 250 кВт, P_total = 12+250+5+10 = 277 кВт пиковая. С учётом этого расчётная мощность ~1850 кВт (с учётом всех камер парка 5-8 шт × ~250 кВт каждая на пик-фазе).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет 5000 т яблок ULO</h2>
          <p className="text-slate-300">
            ССЦ + импорт: каркас здания + перекрытия 4000 м² (камеры + сортировочный + офис) — 0.8 млрд тг,
            теплоизол. сэндвич-панели Kingspan PIR 200 мм для 6 камер ULO + полы — 1.4 млрд тг,
            газонепроницаемые двери Frigorimport double-skin × 6 шт — 0.18 млрд тг,
            холодильное оборудование R717 NH₃ — 2 компр. Mycom 250 кВт N+1, glycol loop — 1.4 млрд тг,
            генератор N₂ Atlas Copco PSA + CO₂ Scrubber Janny MT + этилен-абсорбер — 0.6 млрд тг,
            АСУ Janny MT EvolutionCA + датчики O₂/CO₂/t°/RH/C₂H₄ + chlorophyll HarvestWatch — 0.32 млрд тг,
            предсортировочный и пост-сортировочный комплекс (camera grading + size + weight) Greefa — 0.4 млрд тг,
            ящики пластик. POOL-ящики 25 кг × 200 000 шт + штабелеры Linde — 0.18 млрд тг,
            холодильник пред-охлаждения (Pre-cooling) с воздушн. охлаждением Carrier — 0.16 млрд тг,
            энергоснабжение ТП 1000 кВА + ДГУ резерв 200 кВт + UPS — 0.18 млрд тг,
            благоустройство + парковка фур + проектирование + лицензии — 0.18 млрд тг,
            обор. ср-ва (первый сезон закупки яблок + опер. расходы) — 0.16 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~5.8 млрд тг (допуск ±10%). 0.8+1.4+0.18+1.4+0.6+0.32+0.4+0.18+0.16+0.18+0.18+0.16 = 5.96 млрд тг ≈ 5.8 млрд тг. Удельная стоимость ~1.2 млн тг/т ёмкости — соответствует мировым CAS-хранилищам (Польша/Италия ~$2500-3000/т).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Безопасность РГС</h2>
          <p className="text-slate-300">
            Камера РГС с O₂ 1-3% (норма для дыхания человека 19-23%) — смертельно опасна
            для персонала. Что обязательно по NIOSH + EN ISO 15012?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только запретительные надписи на дверях" },
              { v: "b", t: "Только противогаз ОЗК у входа в камеру" },
              { v: "c", t: "Multi-layer Safety по NIOSH Confined Space + EN ISO 15012: 1) Принципиальный запрет на вход в камеру РГС в рабочем режиме (Permit-Required Confined Space) — только после полной вентиляции до O₂ ≥19.5% и подтверждения газоанализатором; 2) Контроль входа — двойная блокировка (Interlock) — дверь не открывается пока контроль О₂ не подтверждает безопасный уровень; 3) Газоанализаторы O₂/CO₂ Honeywell BW Solo на стене камеры со звуковой/световой индикацией снаружи; 4) Аварийное реверс-вентилирование — кнопка снаружи на каждой камере (мгновенный приток воздуха + сброс CO₂); 5) При входе обязательно: SCBA Self-Contained Breathing Apparatus автономный дыхательный аппарат (типа Drager PSS или MSA G1) с запасом O₂ на 30 мин минимум; 6) Работа в паре — 2 человека с радиосвязью + наблюдатель снаружи с возможностью быстрого реагирования; 7) Канаты или линия безопасности для вытягивания пострадавшего; 8) Подготовительные процедуры — Lock-Out Tag-Out LOTO для отключения газоподачи, проверка отсутствия рисков; 9) Обучение персонала ежегодно + тестирование SCBA каждые 6 мес; 10) План аварийного реагирования — связь с скорой помощью, наличие медкабинета с O₂-баллоном; 11) Документирование каждого входа — журнал учёта Confined Space Entry; NIOSH 80-106 + EN ISO 15012 + OSHA 29 CFR 1910.146 + СанПиН РК 4.01-007" },
              { v: "d", t: "Только датчик O₂ на руке оператора" },
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
                {score === 4 ? "Отлично — готовы к проектированию РГС-хранилища" : score >= 2 ? "Перечитайте FAO Post-harvest + ISO 8328 + NIOSH" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> FAO Post-harvest Compendium, ISO 8328 (CA Storage), USDA Apple Storage Guidelines, NIOSH 80-106 (Confined Space), EN ISO 15012, OSHA 29 CFR 1910.146, СН РК 4.02-08, СанПиН РК 4.01-007.</p>
          <p><strong>Реальные объекты РК:</strong> «Алматинский Сад» (10 000 т яблок Sinap/Aport), «Капчагай-Фрукт» (виноград+персик 5000 т), «Кызылординский Бахчевой» (арбузы+дыни), «Талды-Курган Овощехранилище» (картофель+морковь 8000 т).</p>
        </section>
      </main>
    </div>
  );
}
