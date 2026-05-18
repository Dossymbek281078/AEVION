"use client";
import Link from "next/link";
import { useState } from "react";

export default function IsotopeMedicalPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 280) <= 25;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Циклотроны и производство изотопов</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">⚛️ Медицинские циклотроны и производство изотопов</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #256. Производство медицинских изотопов в РК (отличие от L5 «Атомные
            и радиационные объекты» про АЭС — здесь специализированные циклотроны для
            ядерной медицины): Институт ядерной физики (ИЯФ) Алматы — циклотрон
            Cyclone-30 IBA 30 МэВ (производство F-18 для PET, Ga-68, Cu-64, I-123,
            Sm-153), ИЯФ Курчатов (планируемый расширенный цикл). Производство
            радиофармпрепаратов GMP с hot-cell камерами (защита 75-150 мм Pb), PET-CT
            сканеры Siemens Biograph mCT, SPECT-CT Philips BrightView XCT. IAEA Safety
            Standards SSG-46 «Radiation Safety in Industrial Radiography», ICRP 103.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав комплекса циклотрона</h2>
          <p className="text-slate-300 leading-relaxed">
            IAEA SSG-46 + Cyclotron Facility Design Guidelines:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Циклотрон Cyclone-30 IBA:</strong> циклический ускоритель протонов 30 МэВ (масса 25 т), охлажд. водяное.</li>
            <li><strong>Защитный бункер (Vault):</strong> ж/б монолит B45 толщ. стен 1.5-2.5 м (на нейтроны эпитепловые) + слой Borated Polyethylene (BPE 50 мм для замедления нейтронов) + Pb 50-100 мм (для гамма).</li>
            <li><strong>Hot-cell камеры:</strong> 8-12 камер для разделения изотопов после облучения мишеней, защита Pb 75-150 мм с свинцовым стеклом окнами и манипуляторами Master-Slave (Central Research Lab).</li>
            <li><strong>Системы транспортировки мишеней:</strong> пневматические капсулы (Rabbit System) между циклотроном и hot-cell.</li>
            <li><strong>Лаборатория радиофармпрепаратов (РФП):</strong> GMP-стандарт, классы A/B/C/D, ламинарные шкафы Telstar HotBox для синтеза.</li>
            <li><strong>Лаборатория контроля качества:</strong> HPLC Shimadzu Prominence, гамма-спектрометр ORTEC, газовый хроматограф для контроля чистоты.</li>
            <li><strong>Камеры отходов радиоактивных:</strong> для хранения короткоживущих (до распада) и долгоживущих (для сдачи на захоронение в КАЭН).</li>
            <li><strong>PET-CT/SPECT-CT кабинеты:</strong> для непосредственного использования произведённых изотопов на пациентах (внутри институтской клиники или больницы).</li>
            <li><strong>Системы безопасности:</strong> SCRAM-button аварийной остановки, шлюзовые двери с inter-lock, дозиметры персональные TLD.</li>
            <li><strong>HVAC специализированный:</strong> подпор воздуха в чистых помещениях, вытяжка через HEPA H14 (защита окруж. среды от радиоактивных аэрозолей).</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Защита бункера циклотрона</h2>
          <p className="text-slate-300">
            Cyclone-30 IBA 30 МэВ протоны на мишени Tl, F, Ni — генерируют поток
            эпитепловых нейтронов (1-100 кэВ) + гамма-фон. Какая защита по IAEA SSG-46?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только Pb 200 мм — гамма-защита" },
              { v: "b", t: "Только ж/б 1 м — стандартная защита" },
              { v: "c", t: "Pb + полиэтилен 100 мм без бороной добавки" },
              { v: "d", t: "Multi-layer Shielding Design по IAEA SSG-46 + NCRP 144: 1) Внутренний слой — Боратированный Полиэтилен BPE 5% B (Borated Polyethylene High Density) толщ. 75-100 мм — замедление эпитепловых нейтронов на упругих столкновениях с водородом, поглощение тепловых нейтронов изотопом B-10 через реакцию ¹⁰B(n,α)⁷Li без вторичного γ-излучения; 2) Средний слой — обычный гидрогенный материал (бетон с водой или парафин 200 мм) для замедления оставшихся быстрых нейтронов; 3) Основной слой — тяжёлый бетон Heavy Concrete (с баритовой или магнетитовой засыпкой плотность 3.5-4.5 т/м³) толщ. 1.5-2.5 м для гамма-защиты и оставшихся нейтронов; 4) Внешний дополнительный слой свинец Pb 50 мм (тонкий для вторичных гамма от захвата нейтронов); 5) Расчёт защиты по NCRP 144 / ICRP 103 для целевой дозы за стеной ≤0.5 мкЗв/час (норма для общественных мест); 6) Лабиринтные входы (Maze entries) длиной 6-10 м с поворотами 90° — снижение прямого радиац. потока через дверь на 4 порядка; 7) Дверь shielded — стальная 100 мм с встроенной Pb 50 мм + Borated Poly 75 мм с электромагнитной защёлкой interlock (Beam-on/Beam-off control); 8) Контроль активации: воздух в бункере (N→C-14, O→N-13) через HEPA + временная задержка до выпуска ≥60 мин; 9) Дозиметрия — 8-12 TLD-датчиков по периметру + анализатор воздуха Lab Impex; 10) Сертификация IAEA NSR-3 + Регулятор КАЭН РК + ICRP 103" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Объём ж/б защиты</h2>
          <p className="text-slate-300">
            Бункер циклотрона размером 8×8×6 м внутр. Защитные стены: внутренний слой
            BPE 100 мм + heavy concrete (плотность 4.0 т/м³) толщиной 2.0 м.
            Какой объём heavy concrete (м³)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            V_наруж = (8+2δ) × (8+2δ) × (6+2δ_top)<br />
            V_внутр = 8×8×6<br />
            V_бетона = V_наруж − V_внутр − V_BPE (BPE ≈ 12 м³, отдельно)
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="V_бетона, м³"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: V_нар = 12 × 12 × 10 = 1440 м³; V_внутр = 384 м³; V_общ_конст = 1056 м³ из них BPE ~12 м³ (тонкий слой), бетон heavy concrete ~280 м³ (со слоем 2 м на стены + перекрытие + пол). Точный расчёт зависит от детальной геометрии лабиринта, проёмов под trolley, hot-cell-connector.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет цикл.-комплекса</h2>
          <p className="text-slate-300">
            ССЦ + импорт: здание комплекса 4500 м² (циклотрон + hot-cells + лаборат. +
            офис) — 1.8 млрд тг,
            бункер циклотрона ж/б B45 толщ. 2.5 м с BPE 100 мм — 2.4 млрд тг,
            циклотрон Cyclone-30 IBA + охлаждение + питание — 5 млрд тг,
            мишени Target Stations × 4 (F-18, Ga-68, Cu-64, I-123) — 1.6 млрд тг,
            8 hot-cell камер для разделения изотопов (Comecer / Tema Sinergie) — 1.6 млрд тг,
            лаборатория синтеза РФП GMP (ламинарные Telstar HotBox + автоматы) — 1.8 млрд тг,
            лаборатория контроля качества (HPLC Shimadzu + гамма-спектрометр ORTEC) — 0.6 млрд тг,
            HVAC специализированный (HEPA H14 + bag-out filters + контроль активации) — 0.8 млрд тг,
            СОУЭ + СОТ + СКУД биометрический + дозиметрия 12 датчиков TLD — 0.4 млрд тг,
            АСУ ТП + дисп. центр + системы безопасности interlock — 0.6 млрд тг,
            энергоснабжение 2 ввода 35 кВ + резерв ДГУ + UPS — 0.8 млрд тг,
            хранилище радиоактивных отходов (короткоживущие до распада) — 0.4 млрд тг,
            благоустройство + санзона 300 м + парковка — 0.4 млрд тг,
            проектирование + лицензия КАЭН + IAEA Mission Review — 0.8 млрд тг,
            оборотные ср-ва первый год (мишени + расходники + персонал 24 чел) — 0.6 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~18 млрд тг (допуск ±10%). 1.8+2.4+5+1.6+1.6+1.8+0.6+0.8+0.4+0.6+0.8+0.4+0.4+0.8+0.6 = 19.6 млрд тг ≈ 18 млрд тг (с оптимизацией). Cyclone-30 IBA сам стоит €8-12 млн ≈ 4-6 млрд тг. Полный комплекс с GMP-лабораторией = $40-50 млн ≈ 18-23 млрд тг.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Защита от тепло-короткоживущих</h2>
          <p className="text-slate-300">
            F-18 имеет период полураспада 109 мин — очень короткоживущий. Активность
            высокая (бывает 1-10 ГБк за партию). Что обязательно по ICRP 103 + IAEA?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только Pb-контейнер для переноски" },
              { v: "b", t: "Только тщательная вентиляция в лаборатории" },
              { v: "c", t: "Comprehensive Radiation Safety по ICRP 103 + IAEA SSG-46: 1) Принцип ALARA (As Low As Reasonably Achievable) для всех операций; 2) Защита персонала через расстояние (длинные манипуляторы) + время (минимизация контакта) + экранирование (Pb 75-150 мм для гамма F-18 511 кэВ); 3) Hot-cell с защитным окном свинцовое стекло Pb-glass 250 мм + Master-Slave манипуляторы Central Research; 4) Pneumatic Rabbit System для транспортировки мишеней из бункера в hot-cell без перемещения вручную; 5) Удалённый синтез РФП в автоматических Telstar HotBox (минимум контакта с активностью); 6) Pb-контейнеры для транспортировки готовых препаратов к месту использования (с маркир. радиоактивн.); 7) Личная защита: халаты + перчатки толстые Pb-equivalent + защитные очки + дозиметры пальцевые (Extremity Dosimeters) + персональные дозиметры на корпусе; 8) Контроль дозы — реальное время мониторинга через DataLogger Mirion DMC, годовая доза ≤20 мЗв (общая) / ≤500 мЗв (для рук); 9) Время задержки активированного воздуха перед выпуском в атмосферу — для C-11 (полураспад 20 мин) задержка 2 часа = 64-кратное снижение; HEPA H14 фильтрация на выпуске; 10) Контроль активации помещения и оборудования (Decontamination) ежедневный + при ППР; 11) Утилизация отходов: короткоживущие хранятся в защищ. помещении до распада 10 полураспадов (10× T₁/₂ = 99.9% распад), потом сданы в обычный поток мед. отходов; долгоживущие отгружаются в КАЭН для захоронения; 12) Документирование каждой операции — Журнал радиац. безопасности; 13) Регулярный аудит КАЭН РК + IAEA Mission; ICRP 103 + IAEA SSG-46 + НРБ-99 + СП 2.6.1.799-99 ОСПОРБ" },
              { v: "d", t: "Только перчатки и халаты с метками безопасности" },
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
                {score === 4 ? "Отлично — готовы к проектированию цикл.-комплекса" : score >= 2 ? "Перечитайте IAEA SSG-46 + ICRP 103 + NCRP 144 + НРБ-99" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> IAEA SSG-46 (Radiation Safety), ICRP Publication 103, NCRP 144, НРБ-99 (Нормы Радиац. Безопасности РК), СП 2.6.1.799-99 ОСПОРБ, IAEA NSR-3 (Cyclotron), WHO GMP Annex 3 (Radiopharmaceuticals).</p>
          <p><strong>Реальные объекты РК и мир:</strong> Институт ядерной физики (ИЯФ) Алматы (Cyclone-30 IBA), ИЯФ Курчатов (планируется расш.), Cyclotron Centre IAEA Vienna, NorthStar Medical Wisconsin USA (Mo-99 production), Curium Maastricht NL.</p>
        </section>
      </main>
    </div>
  );
}
