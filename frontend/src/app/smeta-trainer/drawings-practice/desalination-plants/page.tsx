"use client";
import Link from "next/link";
import { useState } from "react";

export default function DesalinationPlantsPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 36) <= 4;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 145_000_000_000) <= 14_000_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Опреснительные станции</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🌊 Опреснительные станции SWRO</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #236. Опреснительные станции на Каспии: МАЭК-Казатомпром Актау
            (50 000 м³/сутки питьевой воды), Карабогаз-Кулсары промышленная (Атырау),
            планируемые установки для Мангистау 5 млн м³/сутки. Технология SWRO
            (Seawater Reverse Osmosis) — мембранный обратный осмос Toray TM820V-440,
            рекуперация энергии ERI ERD (Energy Recovery Inc, экономия 60% эл-энергии),
            предочистка UF Toray HFU-2020, постобработка кальцинированием (CaCO₃)
            и хлорированием/УФ. СНиП 2.04.02, NSF 61, WHO Guidelines Drinking-Water,
            IDA Desalination Standards.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Технологическая цепочка SWRO</h2>
          <p className="text-slate-300 leading-relaxed">
            IDA + WHO Drinking-Water Guidelines:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-slate-300 pl-2">
            <li>Водозабор Open Intake (морской) или Beach Well (скважины под пляжем) — фильтр через грунт защита от водорослей.</li>
            <li>Грубая очистка: сита 5-10 мм + барабанные фильтры 80 мкм (защита от ракушек, медуз, рыбы).</li>
            <li>Предочистка флокуляция/коагуляция (FeCl₃ или Al₂(SO₄)₃) + DAF (Dissolved Air Flotation) — удаление взвесей и водорослей.</li>
            <li>Тонкая фильтрация: UF (ультрафильтрация) мембраны Toray HFU-2020 (Ø1.3 мм половолоконные, 0.02 мкм отсечение).</li>
            <li>SDI (Silt Density Index) измерение для контроля качества (требование &lt;3 для SWRO).</li>
            <li>Картриджные фильтры 5 мкм (Pall, 3M) — последняя ступень перед мембранами.</li>
            <li>Антискалянт + дозирование биоцида (DBNPA) для защиты мембран.</li>
            <li>SWRO membranes Toray TM820V-440 в напорных корпусах 8×40' Ø8" L=1м, рабочее давление 55-70 бар (TDS Каспий ~13 000 мг/л).</li>
            <li>Energy Recovery ERI PX-300 ERD (Pressure Exchanger) — передача давления из концентрата (brine) в питательную воду.</li>
            <li>Постобработка: декарбонизация CO₂, добавление CaCO₃ для минерализации (post-treatment), дозирование Cl₂ (или ClO₂) и УФ-обеззар.</li>
          </ol>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Технология для Каспия</h2>
          <p className="text-slate-300">
            Каспий: солёность TDS 13 000 мг/л (солоновато-морская, в 3× меньше Океана 35 000),
            t° летом до +30°C (риск засорения мембран биообрастанием), сильное ветровое
            волнение. Какая технология опреснения оптимальна?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "MED (Multi-Effect Distillation) термическая — традиционно для солёной воды" },
              { v: "b", t: "MSF (Multi-Stage Flash) — для крупных установок 50+ млн м³/сутки" },
              { v: "c", t: "Только UF без обратного осмоса — этого достаточно для солоноватой воды" },
              { v: "d", t: "SWRO Seawater Reverse Osmosis + ERI Pressure Exchanger: 1) Водозабор Beach Well (защита от водорослей+штормов, естественная пред-фильтрация через песок); 2) Pre-treatment UF Toray HFU-2020 (надёжно, низкая SDI); 3) Two-pass SWRO с мембранами Toray TM820V-440 (1-pass для основной соли, 2-pass для дополнит. снижения NaCl); 4) Energy Recovery ERI PX-300 (КПД 96%, снижает удельный расход энергии с 4-5 кВт·ч/м³ до 2.5-3 кВт·ч/м³); 5) Anti-Scaling + биоцид DBNPA дозирование (защита от обрастания при +30°C); 6) Post-treatment кальцинирование CaCO₃ + хлор + УФ; 7) CIP (Cleaning-In-Place) каждые 3 мес кислотой (HCl 2%) + щёлочью (NaOH 2%) + биоцидом; 8) Управление SCADA Siemens PCS7 + контроль SDI/мутности/pH/Cl в режиме реального времени; 9) Brine (концентрат) сброс в море в 1 км от берега с диффузором на глубине 15 м (защита экосистемы); 10) IDA Desalination Standards + СНиП 2.04.02 + NSF 61 + WHO Drinking-Water Guidelines" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Кол-во мембран</h2>
          <p className="text-slate-300">
            Установка 100 000 м³/сутки питьевой воды. Производительность одной мембраны
            Toray TM820V-440 при t°=20°C, давлении 60 бар, TDS Каспия 13 000 мг/л —
            ~40 м³/сутки. Recovery rate 45% (т.е. 100 м³ морской → 45 м³ пресной).
            Сколько мембран нужно (с резервом +15% на замену/чистку)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            Q_питат = Q_продукт / recovery = 100000 / 0.45 = 222 222 м³/сутки<br />
            N_мембран = Q_продукт / производ. + резерв 15%<br />
            (для упрощения — расчёт от Q_продукт)
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Кол-во мембран, ×100 (для 3600 → 36)"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: N = 100 000 / 40 = 2500 шт. + 15% резерв = ~2875 шт. (в корпусах 8×40' по 8 мембран в корпусе = 360 корпусов). Введите 36 (×100). С учётом 2-pass и резервных корпусов на чистку — реально 3600 мембран в установленных. Округление до 36 ×100 = 3600 мембран всего.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет SWRO 100 000 м³/сутки</h2>
          <p className="text-slate-300">
            ССЦ + импорт: водозабор Beach Well 12 скважин × 200 м³/час + подающие трубопроводы — 8 млрд тг,
            пред-очистка: коагуляция/флок/DAF — 6 млрд тг,
            UF-станция Toray HFU-2020 (200 модулей × 250 м³/час) — 12 млрд тг,
            картриджные фильтры 5 мкм (200 корпусов) — 1.4 млрд тг,
            SWRO мембраны Toray TM820V-440 × 3600 шт + напорные корпуса (450 корпусов) + ВД-насосы 60 бар — 38 млрд тг,
            Energy Recovery ERI PX-300 × 24 единицы (экономия 60% эл-эн.) — 14 млрд тг,
            пост-обработка кальцинирование + хлор + УФ-обеззар. — 4.8 млрд тг,
            резервуары пресной воды 4 × РВС-5000 — 3.2 млрд тг,
            насосная подающая в город + магистральн. водопровод 8 км — 5.4 млрд тг,
            здание машзала 18 000 м² с климат-контролем — 12 млрд тг,
            энергоснабжение (ввод 110 кВ + ТП + резерв ДГУ 5 МВт) — 14 млрд тг,
            АСУ ТП Siemens PCS7 + SCADA + лаборатория ASTM/EPA — 6 млрд тг,
            диффузор сброса концентрата 2 км в море на глубине 15 м — 4 млрд тг,
            благоустройство + охрана + проектир. + ОВОС — 16.2 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~145 млрд тг (допуск ±10%). 8+6+12+1.4+38+14+4.8+3.2+5.4+12+14+6+4+16.2 = 145 млрд тг. Удельная стоимость ~1.45 млн тг/(м³/сутки) ≈ $3200/(м³/сутки) — соответствует мировым SWRO-проектам (Sorek Израиль $3500, Carlsbad США $4000).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Сброс концентрата (brine)</h2>
          <p className="text-slate-300">
            Установка 100 000 м³/сутки питьевой воды сбрасывает 122 222 м³/сутки
            концентрата (brine) с TDS ~25 000 мг/л (в 2× солонее Каспия). Как защитить
            экосистему Каспия по IDA + ICZM (Integrated Coastal Zone Management)?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Достаточно сбрасывать прямо на берег — море перемешает" },
              { v: "b", t: "Только разбавление пресной водой 1:1 перед сбросом" },
              { v: "c", t: "Многоуровневая защита экосистемы: 1) Концентрат сбрасывается по подводному трубопроводу длиной 2 км от берега на глубину ≥15 м (избежание прибрежной зоны с молодью рыб и водорослей); 2) Диффузор-распылитель Maccaferri Marine Diffuser — мульти-портовый (16-24 порта Ø150-300 мм с восходящим углом 45°) для быстрого разбавления с морской водой 1:50 в радиусе 50 м (target initial dilution); 3) Контроль температуры brine — охлаждение до t°_моря ±3°C через теплообменники (защита от термошока); 4) Удаление антискалянта/биоцида перед сбросом — биоразлагаемые в течение часов препараты Genesys LF (или альтернативы); 5) Мониторинг качества воды в зоне смешения 3 раза в сутки — TDS, t°, pH, DO, прозрачность, бентос (закладка контрольных образцов); 6) Сезонный режим — летом увеличение разбавления (тише слой), зимой — обратное; 7) Биомониторинг — раз в квартал проба молодь рыб, моллюски в радиусе 1 км; 8) IDA Brine Discharge Standards + ICZM Integrated Coastal Zone Management + EU Marine Strategy Framework Directive 2008/56/EC; 9) Альтернатива — Zero Liquid Discharge (ZLD) технология с испарителями и кристаллизацией соли (для проекта Мангистау 5 млн м³/сутки рассматривается); 10) Каспийская Конвенция 2018 о защите морской среды" },
              { v: "d", t: "Сбрасывать в реку с разбавлением пресной речной водой" },
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
                {score === 4 ? "Отлично — готовы к проектированию SWRO" : score >= 2 ? "Перечитайте IDA + NSF 61 + WHO Drinking-Water Guidelines" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> СНиП 2.04.02 (Водоснабжение), NSF/ANSI 61 (Drinking Water System Components), WHO Drinking-Water Quality Guidelines 4th ed, IDA Desalination Standards, ISO 9001/14001, EU MSFD 2008/56/EC.</p>
          <p><strong>Реальные объекты РК:</strong> МАЭК-Казатомпром Актау (50 000 м³/сутки SWRO с 1973 г.), планируемые Мангистау 5 млн м³/сутки (Saudi-Korean консорциум), Карабогазсульфат Атырау, Тенгиз-Шевронойл (Северный Каспий, промышл.).</p>
        </section>
      </main>
    </div>
  );
}
