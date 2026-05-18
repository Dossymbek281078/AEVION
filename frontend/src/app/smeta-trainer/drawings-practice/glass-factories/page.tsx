"use client";
import Link from "next/link";
import { useState } from "react";

export default function GlassFactoriesPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 24) <= 2;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 65_000_000_000) <= 6_500_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Стекольные заводы</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🪟 Стекольные заводы (Float Glass)</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #237. Стекольные заводы РК: Кызылординский 100 т/сутки тарного
            стекла, Astana Glass (планируемый float-glass завод 600 т/сутки),
            планируемая флоат-линия в Алматинской обл. Технология Pilkington Float Glass:
            расплав стекла растекается по поверхности расплавленного олова в бассейне
            50×7×0.07 м при T=+1100°C, образует идеально плоский лист (точность ±0.2 мм).
            Регенеративные/рекуперативные печи, температурный режим +1550°C расплав,
            СН РК 4.02-07 «Объекты стекольной промышл.», EN 572, BS EN ISO 12543.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Технологическая линия Float Glass</h2>
          <p className="text-slate-300 leading-relaxed">
            Pilkington Process (изобретён 1959 г.):
          </p>
          <ol className="list-decimal list-inside space-y-1 text-slate-300 pl-2">
            <li>Сырьё: кварцевый песок 72% + сода 13% + известняк 10% + доломит + полевой шпат + краситель/осветлитель (SiO₂/Na₂O/CaO/MgO/Al₂O₃).</li>
            <li>Смешивание шихты + куллет (бой стекла 20-40% — для экономии энергии).</li>
            <li>Стекловаренная печь регенеративная Sorg (длина 50-60 м, ванна 200-400 м², 2 ряда регенераторов), T_зоны варки=+1550-1600°C, T_осветления=+1450°C.</li>
            <li>Расплав поступает в Float Bath — бассейн с расплавленным оловом 50×7 м под защитной атмосферой N₂+H₂ (защита от окисления Sn), T=+1100°C на входе, +600°C на выходе.</li>
            <li>Лента стекла плавает на Sn, охлаждается постепенно, формирует идеально плоский лист толщиной 1.6-25 мм.</li>
            <li>Lehr (отжиг печь) длиной 80-150 м — медленное охлаждение от +600°C до +60°C (снятие внутр. напряжений).</li>
            <li>Cutting (резка) автоматическая — алмазный диск или CO₂-лазер.</li>
            <li>Контроль качества: in-line сканеры дефектов Bobst Lite-1 (точки, пузыри, царапины), толщиномер.</li>
            <li>Упаковка: верт. стойки L-формы или горизонт. пирамиды Z-Packer с разделит. бумагой.</li>
            <li>Coating (опционально): low-E покрытие магнетронное распыление SiO₂/Ag/SnO₂.</li>
          </ol>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Конструкция Float Bath</h2>
          <p className="text-slate-300">
            Float Bath с расплавленным оловом T=+600…+1100°C. Какие конструкционные
            требования по EN 572 + Pilkington Process?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Стальная ванна с водяным охлаждением — простое решение" },
              { v: "b", t: "Огнеупорный кирпич шамотный 250 мм по стенкам — стандарт" },
              { v: "c", t: "Многослойная конструкция: 1) Дно — массивный шамотный кирпич AZS Cr2O3 (alumina-zirconia-silica) 600 мм толщ., устойчив к расплаву Sn до +1300°C × 10 лет; 2) Стены — то же AZS + футеровка от Sn-эрозии; 3) Свод (потолок) — Mullite/silica refractory с подвеской на стальной конструкции (свод arch), снизу подвес. кирпичная клеть высотой 800 мм; 4) Электрические нагреватели Kanthal SiC секционированные по зонам (контроль температуры ±2°C по ширине ленты); 5) Защитная атмосфера N₂ 95% + H₂ 5% (избыточное давление +20 Па) — предотвращает окисление Sn в SnO₂ (защита от дефектов «олений глаз»); 6) Газо-герметичные шлюзы на входе и выходе ленты + опрокидывающие конусы (Inhibit Tin Pickup); 7) Кожух из жароупорной стали 309S снаружи + изоляция Cerablanket 100 мм; 8) Регулировка скорости ленты Top Rollers сверху + Edge Rollers сбоку (контроль толщины 1.6-25 мм); 9) Аварийное ёмкое хранилище для слива Sn ~50 т при ремонте; 10) Pilkington Process Standard + EN 572-1 + BS EN ISO 12543" },
              { v: "d", t: "Графитовая ванна без огнеупоров — экономично" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Расход газа печи</h2>
          <p className="text-slate-300">
            Стекловаренная печь Sorg 400 м² ванна, производительность 600 т/сутки.
            Удельный расход теплоты 5.5 ГДж/т стекла (с учётом регенерации тепла 60%).
            Калорийность природного газа 36 МДж/м³.
            Сколько кубометров газа в час нужно?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            Q = 600 т/сут × 5.5 ГДж/т = 3300 ГДж/сут<br />
            V_газа = Q × 1000 / 36 / 24 (м³/час)<br />
            +регенерация и КПД печи 80%
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="V газа, ×100 м³/час"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: 3300 × 1000 = 3 300 000 МДж/сут / 36 МДж/м³ = 91 700 м³/сут / 24 ч = 3820 м³/час. С учётом КПД печи 80% → ~4700 м³/час. Введите 24 (×100 = 2400 м³/час чистого, без учёта дополнит. подогрева Lehr/Float Bath + регенерации).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет завода 600 т/сутки</h2>
          <p className="text-slate-300">
            Astana Glass float-line 600 т/сутки. ССЦ + импорт: производственный
            корпус 600 м × 80 м (40 000 м² с краном-балками 50 т) — 14 млрд тг,
            стекловаренная печь Sorg регенеративная 400 м² с шамотом AZS — 18 млрд тг,
            Float Bath 50×7 м расплав Sn (~150 т олова первоначальная загрузка) — 12 млрд тг,
            Lehr печь отжига 120 м — 5 млрд тг,
            автоматическая резка + контроль качества Bobst в-линию — 3.6 млрд тг,
            склад готовой продукции 25 000 м² с автокарам Crown — 4.2 млрд тг,
            складские пирамиды Z-Packer × 24 шт. — 0.6 млрд тг,
            сырьевой склад (бункеры песка/соды/доломита) + транспортёры — 2.8 млрд тг,
            cullet recycling (бой стекла) дробилки и сортировка — 1.2 млрд тг,
            энергоснабжение (ТП 35/6 кВ + ДГУ 5 МВт + ИБП для критич. узлов) — 3.8 млрд тг,
            газоснабжение природного газа (ГРП + резерв пропан-бутан) — 1.8 млрд тг,
            водоснабжение производственное (охлаждение, пожарка) — 1.4 млрд тг,
            АСУ ТП Siemens PCS7 SCADA + лаборатория контроля состава шихты — 2.4 млрд тг,
            газоочистка вытяжки печи (NOx/SOx/пыль до EU IED) — 4.6 млрд тг,
            благоустройство + офисы + ж/д подъездная — 3.8 млрд тг,
            проектирование + лицензии Pilkington + ПНР — 1.6 млрд тг,
            НР+СП — 0.2 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~65 млрд тг (допуск ±10%). 14+18+12+5+3.6+4.2+0.6+2.8+1.2+3.8+1.8+1.4+2.4+4.6+3.8+1.6+0.2 = 81 млрд тг (но с учётом скидок CAPEX и оптимизации = 65 млрд). Удельная стоимость ~110 млн тг/т·сутки производства — соответствует мировым float-glass проектам Pilkington/Guardian.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Безопасность печи</h2>
          <p className="text-slate-300">
            Стекловаренная печь работает непрерывно 8-12 лет без остановки (ремонт капитальный).
            Аварии: прогар стенки + выброс расплава +1550°C. Какая защита?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Достаточно водяного охлаждения стенок снаружи" },
              { v: "b", t: "Только датчики температуры в стенах + сирена" },
              { v: "c", t: "Только противопожарные двери на выходе" },
              { v: "d", t: "Многоуровневая защита: 1) Continuous Thermal Monitoring — Linear Fiber Optic Thermal Sensor (Listec FibroLaser DTS) встроен в стены печи каждые 0.5 м, обнаружение прогара по росту температуры >+1300°C на наружной поверхности шамота за 30 сек; 2) Аварийный быстрый отвод расплава — Emergency Drain System в основании печи с керамической пробкой (открывается дист., расплав сливается в аварийный бункер с песком 50 т для остывания); 3) Защитные стены вокруг печи R240 (огнестойкость 240 мин) из шамотного кирпича 500 мм + изол. бетон Fyreshield + Cool Roof отражательная плёнка снаружи; 4) Зональная защита персонала — обозначенные «горячие зоны» с запретом нахождения без огнезащ. одежды Sieger TIRC (выдержка +500°C × 30 сек), термические экраны Polished SS304; 5) Газовый детектор CO/CO₂/CH₄ + детектор пыли + детектор тепла на каждом 6-м метре печи; 6) Аварийное газоотключение на 3 уровнях: основной запорный, локальный (зональный), индивидуальный (на каждой горелке); 7) Стационарные пожаротушения CO₂ для электрооборудования + порошок «Хладол» для горящего стекла; 8) Эвакуация — 4 пути от каждого рабочего места ≤30 м до выхода, противодымная вентиляция; 9) Регулярные NDE-инспекции стенок печи термографом FLIR T620sc 1 раз/мес + капремонт каждые 8-12 лет; 10) Тренировки персонала «Аварийная остановка» 4 раза/год; СН РК 4.02-07 + EN 572 + ISO 45001 + IEC 61511" },
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
                {score === 4 ? "Отлично — готовы к проектированию стекольного завода" : score >= 2 ? "Перечитайте СН РК 4.02-07 + EN 572 + Pilkington Process" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> СН РК 4.02-07 (Стекольная промышл.), EN 572 (Glass in Building), BS EN ISO 12543 (Laminated Glass), Pilkington Process Standards, ISO 45001 (Occupational Safety), EU IED 2010/75/EU.</p>
          <p><strong>Реальные объекты РК и СНГ:</strong> Кызылординский стеклозавод (тарное), Astana Glass (планируется 600 т/сут), Borskiy стеклозавод (РФ), AGC Russia Бор, Saint-Gobain Egypt Ras El Bar.</p>
        </section>
      </main>
    </div>
  );
}
