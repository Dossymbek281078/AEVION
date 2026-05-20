"use client";
import Link from "next/link";
import { useState } from "react";

export default function IncineratorPlantsPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 12500) <= 1200;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 95_000_000_000) <= 9_500_000_000;

  const correct = {
    ex1: ex1 === "c",
    ex2: ex2Correct,
    ex3: ex3Correct,
    ex4: ex4 === "d",
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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Мусоросжигательные заводы</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🔥 Мусоросжигательные заводы (Waste-to-Energy)</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #246. Мусоросжигательные заводы Waste-to-Energy РК: Шымкентский
            проект Veolia 500 т/сут (планируется 2026-2028), Алматинский проект
            Hitachi Zosen Inova 600 т/сут (стадия ТЭО). Технологии: решёточные колосниковые
            печи Martin GmbH / Hitachi (стандарт EU), кипящий слой Sumitomo SHI FW,
            паровой котёл-утилизатор 25-40 бар × 400°C + турбина 10-15 МВт.
            Газоочистка: ESP (электрофильтр) + DeNOx SCR + сухой сорбент Ca(OH)₂ +
            активир. уголь (для диоксинов/фуранов/ртути). EU IED 2010/75/EU Annex VI,
            СН РК 2.04-29, NFPA 850.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Технологическая цепочка WTE</h2>
          <p className="text-slate-300 leading-relaxed">
            EU IED 2010/75/EU Annex VI + WTERT Best Practices:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-slate-300 pl-2">
            <li>Приёмное отделение (Bunker) — глубина 8-12 м, ёмкость на 4-7 дней работы (для 500 т/сут — 3000 м³).</li>
            <li>Краны грейферные 2-3 шт. — 8 т подачи на колосниковую решётку.</li>
            <li>Колосниковая печь (Reverse-acting grate Martin или Volund) — площадь решётки 30-50 м² для 500 т/сут, T_горения = +850-1100°C, время удержания газов ≥2 сек при T &gt;850°C (требование EU для разрушения диоксинов).</li>
            <li>Котёл-утилизатор (Boiler) — паропроиз. 70-80 т/час при 40 бар × 400°C, КПД котла 80%.</li>
            <li>Турбина паровая Siemens SST-400 / 12 МВт + конденсатор + градирня (для электр.).</li>
            <li>Газоочистка многоступенчатая: 1) ESP электрофильтр (пыль до 30 мг/м³); 2) SCR DeNOx с впрыском NH₃/мочевины (NOx ≤200 мг/м³); 3) Сухой сорбент Ca(OH)₂ (нейтрализация HCl, SO₂); 4) Активир. уголь (диоксины 0.1 нг/м³, ртуть ≤0.05 мг/м³); 5) Рукавный фильтр (Bag House) — финальная пыль ≤10 мг/м³.</li>
            <li>Дымовая труба H=60-80 м из жаропрочной стали с термостойкой футеровкой.</li>
            <li>Бункер шлака (Bottom Ash) — выход 20-25% от веса исходн. мусора, утилизация в стройматериалы или захоронение.</li>
            <li>Бункер летучей золы (Fly Ash) — выход 3-5%, обязательная стабилизация (цементирование) перед захоронением как опасные.</li>
            <li>Centre Control Room + Lab + Office Block + системы безопасности.</li>
          </ol>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Тип печи для ТБО</h2>
          <p className="text-slate-300">
            Завод 500 т/сут ТБО влажность 35%, теплотворная способность 9-11 МДж/кг,
            высокая доля пластика и органики. Какая печь оптимальна по EU BREF WI?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Барабанная вращающаяся печь (rotary kiln) — для опасных отходов" },
              { v: "b", t: "Пиролизная установка — для пластика и резины" },
              { v: "c", t: "Reverse-acting grate (обратная решёточная колосниковая) Martin GmbH или Volund: 1) Площадь решётки 36 м² для 500 т/сут (производительность 14 т/(м²·сутки)); 2) 4 секции решётки с обратным движением (сушка → пиролиз → сжигание → дожигание шлака), скорость 1-2 м/час каждая независимо; 3) Подача первичного воздуха через решётку снизу (60% от общего) + вторичного воздуха в свод печи (40%) для дожигания пиролизных газов; 4) Температура +850-1100°C, время удержания газов ≥2 сек при &gt;850°C (требование EU IED для разрушения диоксинов/фуранов до концентрации &lt;0.1 нг/м³); 5) Подача СНГ или природного газа на стартап и поддержание T при низкокалорийном мусоре; 6) Боковые стены футерованы шамотным кирпичом + охлаждаемые трубные панели (тепло уходит в котёл); 7) Шлак сваливается через шлакоотвод в водяной затвор → ленточный конвейер → бункер шлака; 8) Контроль слойности: горящий слой 0.5-1.0 м толщиной (визуальный + температурные термисторы); 9) AСУ ТП Honeywell Experion с регулированием подачи воздуха и скорости решётки по O₂ в дымовых газах (target 6-9% O₂); 10) Капремонт каждые 1.5-2 года (замена изношенных колосниковых элементов); EU BREF WI 2019 + EU IED 2010/75/EU + WTERT" },
              { v: "d", t: "Кипящий слой с песком (Fluidized Bed) — лучше для ТКО" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Электрическая выработка</h2>
          <p className="text-slate-300">
            500 т/сут ТБО × 10 МДж/кг теплотворная способность = 5×10⁹ Дж/сут = 58 МВт_тепло.
            КПД котла 80%, КПД турбины (т/эл) 25% (для пара 40 бар × 400°C), собств.
            нужды 20%. Какая нетто электрическая мощность (кВт)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            P_тепло_input = 500_000 × 10 / 86400 = ~58 000 кВт<br />
            P_тепло_котёл = P_input × 0.8<br />
            P_эл_брутто = P_тепло × 0.25<br />
            P_нетто = P_брутто × 0.8 (собств. нужды)
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Мощность, кВт"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: 58 000 × 0.8 × 0.25 × 0.8 = 9 280 кВт. Для увеличения КПД до 30% (выше параметры пара 50 бар × 450°C) и снижения соб. нужд до 15% → ~12 500 кВт. Это соответствует турбине Siemens SST-400 12 МВт.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет 500 т/сут</h2>
          <p className="text-slate-300">
            ССЦ + импорт Veolia/Hitachi-Zosen: приёмное отделение (бункер 3000 м³ + 3 крана) — 8 млрд тг,
            колосниковая печь Martin/Volund 36 м² + футеровка + системы воздуха — 18 млрд тг,
            котёл-утилизатор 75 т/час 40 бар × 400°C — 16 млрд тг,
            турбина Siemens SST-400 12 МВт + конденсатор + градирня — 14 млрд тг,
            газоочистка многоступенчатая ESP + SCR + dry sorbent + AC + Bag House — 24 млрд тг,
            дымовая труба H=80 м с термостойкой футеровкой — 2.4 млрд тг,
            обработка шлака (бункер + цех стабилизации цементом) — 1.8 млрд тг,
            обработка летучей золы (цех цементирования в Big Bag для безопасн. захоронения) — 1.4 млрд тг,
            здание главного корпуса 12 000 м² 4 этажа (печь+котёл+газоочистка) — 8 млрд тг,
            АСУ ТП Honeywell Experion + лаборатория CEM Continuous Emission Monitoring — 1.6 млрд тг,
            трансформаторная подстанция + ЛЭП в KEGOC + резерв ДГУ + UPS — 1.4 млрд тг,
            подъездная дорога Кат. III + ж/д ветка + автомусоровозы — 0.8 млрд тг,
            благоустройство + санзона 300 м + офисы 2000 м² + проектирование — 1.2 млрд тг,
            FIDIC EPC контракт + ОВОС + лицензии EU BAT — 2.4 млрд тг,
            НР+СП и резерв — 1.4 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~95 млрд тг (допуск ±10%). 8+18+16+14+24+2.4+1.8+1.4+8+1.6+1.4+0.8+1.2+2.4+1.4 = 95 млрд тг. Удельная стоимость WTE-завода — $400-600/т·год мощности (для 180 000 т/год = $90 млн ≈ 40 млрд тг + газоочистка + турбина = ~95 млрд тг). Veolia Шымкент — оценочно €280 млн ≈ 140 млрд тг (полная инфраструктура).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Газоочистка диоксинов</h2>
          <p className="text-slate-300">
            Диоксины и фураны (PCDD/F) — самые токсичные соединения, образуются при горении
            хлорсодерж. отходов (PVC). EU IED 2010/75/EU требует ≤0.1 нг TEQ/м³.
            Что обязательно по WTERT Best Practices?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только высокая температура +850°C в течение 2 сек — этого достаточно" },
              { v: "b", t: "Только активир. уголь на финальной ступени" },
              { v: "c", t: "ESP электрофильтр + Bag House — только для пыли" },
              { v: "d", t: "Комплексная многоступенчатая очистка (Multi-stage APC Air Pollution Control) по EU BREF WI: 1) Primary destruction в печи — T ≥850°C × ≥2 сек удержания (разрушение исходных диоксинов на 99%, образованных в зоне горения); 2) Quench rapid cooling в котле — быстрое охлаждение дымовых газов от 850°C до &lt;200°C за &lt;1 сек (предотвращает повторный синтез de novo в диапазоне 250-450°C); 3) Сухой сорбент Ca(OH)₂ инжекция в дымовой канал (нейтрализация HCl, SO₂) + Активированный уголь Powdered Activated Carbon (PAC) инжекция 100-300 мг/Нм³ (адсорбция диоксинов, фуранов, ртути); 4) Bag House рукавный фильтр (PTFE Teflon мембрана с 99.99% эффект.) — улавливает пыль с адсорбированными загрязнениями; 5) Полный мониторинг CEMS Continuous Emission Monitoring System: 24/7 NOx, SO₂, CO, HCl, HF, общая пыль, O₂, температура, расход; диоксины — периодич. отбор проб long-term sampling 30 дней с лаборант. анализом GC-HRMS Thermo Q-Exactive; 6) Резервная вторая ступень активир. угля Catalytic V₂O₅/TiO₂ (катализатор разложения диоксинов на CO₂+H₂O+HCl) при недостатке адсорб. ёмкости PAC; 7) Утилизация отработанного PAC и пыли Bag House как опасные отходы с цементированием; 8) Регулярный аудит экологической инспекцией каждые 12 мес; 9) Опубликованные показатели выбросов на сайте предприятия (Right to Know); 10) EU IED 2010/75/EU Annex VI + EU BREF WI 2019 + WTERT BAT + EPA MACT Standards" },
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
                {score === 4 ? "Отлично — готовы к проектированию WTE" : score >= 2 ? "Перечитайте EU IED 2010/75/EU + EU BREF WI" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> EU IED 2010/75/EU Annex VI, EU BREF WI 2019, EPA MACT Standards 40 CFR Part 60, СН РК 2.04-29, NFPA 850, ISO 14001, WTERT Best Practices.</p>
          <p><strong>Реальные объекты РК и СНГ:</strong> Шымкент WTE-проект Veolia 500 т/сут (2026-2028), Алматинский проект Hitachi Zosen Inova 600 т/сут (ТЭО), Москва-Восток-Запад заводы (Hitachi/Volund), Sumitomo MES Spittelau Вена.</p>
        </section>
      </main>
    </div>
  );
}
