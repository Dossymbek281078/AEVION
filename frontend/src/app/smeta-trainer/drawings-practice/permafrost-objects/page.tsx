"use client";
import Link from "next/link";
import { useState } from "react";

export default function PermafrostObjectsPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 42) <= 4;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 6_800_000_000) <= 650_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Объекты на вечной мерзлоте</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">❄️ Объекты на вечной мерзлоте</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #224. Проектирование объектов в зоне многолетнемёрзлых грунтов (ММГ)
            на севере Казахстана (СКО, Костанайская, Павлодарская обл. близ границы РФ) и
            анализ опыта Норильска/Ямала. Термостабилизирующие сваи Long Yang Cooling,
            термосифоны СВВ-25 (CO₂ заполнение), грунтовые охладители, защита фундамента
            от оттайки. СНиП 2.02.04 «Основания и фундаменты на ММГ», СН РК 5.01-01,
            ГОСТ 25100 (Классификация грунтов), СП 25.13330.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Принципы строительства на ММГ</h2>
          <p className="text-slate-300 leading-relaxed">
            СНиП 2.02.04 определяет 2 основных принципа:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Принцип I (сохранение мёрзлого состояния):</strong> для зданий с тёплым контуром на льдонасыщ. грунтах. Проветриваемое подполье h≥1.2 м между зданием и грунтом, термосифоны для отвода летнего тепла, теплоизоляция перекрытия 1-го этажа min 200 мм.</li>
            <li><strong>Принцип II (допущение оттайки):</strong> для надёжных пластичных грунтов и малоэтажных зданий. Расчёт деформаций при оттайке (ε≤8% для каменных, ≤4% для кирпичных), фундамент-плита с прогрессивным армированием.</li>
            <li>Сваи Long Yang Cooling (термосваи) — стальная труба Ø219-426 мм заполнена CO₂ или аммиаком, конденсация на верх. оребрении выше уровня снега, испарение внутри сваи отводит тепло из грунта (естеств. конвекция, без энергии).</li>
            <li>Геокриологический мониторинг скважинами 5-10 м с термисторами (год за годом контроль глубины оттайки/промерзания).</li>
            <li>Запрет утечек тепла: канализация с теплоспутниками, водоснабжение в каналах с тепловыми защитами, отопл. трубы НЕ в грунте.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Свайное основание</h2>
          <p className="text-slate-300">
            5-этажное жилое здание 60×15 м на грунтах с льдистостью I=0.4
            (льдонасыщенные пески), глубина мёрзлой кровли 2.5 м, температура грунта −2°C.
            Какое решение по СНиП 2.02.04?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Ленточный фундамент мелкого заложения 1.5 м — экономично" },
              { v: "b", t: "Свайный из забивных свай С40-12 длиной 8 м без термостабилизации" },
              { v: "c", t: "Плитный фундамент с подушкой из щебня без вентилируемого подполья" },
              { v: "d", t: "Свайно-винтовое с термостабилизацией: сваи буроопускные Ø325 мм L=12-15 м (заведение в твёрдомёрзлый слой ≥8 м), Long Yang Cooling термосифоны на каждой 2-3 свае (расход 0.06-0.08 шт/м² застройки), проветриваемое подполье h=1.5-2.0 м с защитной решёткой от снега, ростверк ж/б B30 H=600 мм с теплоизоляцией PIR 200 мм снизу, мониторинг температуры свай (3 термистора по высоте) с дист. передачей в DCS, расчёт несущей способности по СП 25.13330 с учётом снижения cмёрз. за счёт повышения t° на 0.5°C через 30 лет (глобальное потепление), СНиП 2.02.04 + СП 25.13330" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Кол-во термосифонов</h2>
          <p className="text-slate-300">
            Здание 60×15 м (900 м²) на 5 этажей. Расход термосифонов СВВ-25
            по нормам 0.04-0.05 шт/м² застройки для умеренного температурного режима
            (t°грунта −2°C, годовая теплоотдача из здания 30 Вт/м²).
            Сколько штук термосифонов нужно?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            N = S_здания × норма + 20% запас на критические зоны<br />
            (углы, входы, под коммуникациями)
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Кол-во термосифонов, шт"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: 900 × 0.04 = 36 шт; +20% = ~42 шт термосифонов (расставлены по периметру 2×60+2×15=150 м через 3.6 м + усиление на углах).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет на ММГ</h2>
          <p className="text-slate-300">
            5-этажный жилой дом 60×15 м (4500 м² общ. площ.) в зоне ММГ.
            ССЦ + специфика: свайно-винтовое основание 60 свай Ø325 мм L=15 м + ростверк — 580 млн тг,
            42 термосифона СВВ-25 + мониторинг датчики — 180 млн тг,
            проветриваемое подполье H=2 м (стены, продухи, защита от снега) — 240 млн тг,
            теплоизоляция перекрытия 1 эт. PIR 200 мм + защитная мембрана — 165 млн тг,
            монолит каркас + перекрытия 4500 м² (бетон B30 с морозостойкостью F300) — 2.4 млрд тг,
            фасад НВФ с теплоизоляц. 250 мм + витражи с трип. стеклопак. — 980 млн тг,
            отопление с теплоспутниками канализ./водопр. внутри здания — 380 млн тг,
            автономная электростанция + резерв (зимы −45°C, аварии сети) — 420 млн тг,
            благоустройство в условиях ММГ (тротуары на свайн. ростверке) — 280 млн тг,
            проектирование + геокриологические изыскания + мониторинг 1 год — 720 млн тг,
            НР+СП на 25% увеличены за счёт сезонности и климата — 435 млн тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~6.8 млрд тг (допуск ±10%). 0.58+0.18+0.24+0.165+2.4+0.98+0.38+0.42+0.28+0.72+0.435 = 6.78 млрд тг. Удельная стоимость ~1.5 млн тг/м² — в 2 раза выше юга РК из-за термостабилизации и сезонности.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Защита от термокарста</h2>
          <p className="text-slate-300">
            Утечка тепла из здания может привести к локальному оттаиванию ММГ и термокарсту
            (просадке грунта до 2 м). Какие защитные меры обязательны?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только увеличить толщину утеплителя перекрытия 1-го этажа" },
              { v: "b", t: "Отопление при +18°C круглый год — это норма" },
              { v: "c", t: "Комплексная защита: 1) Тепловой барьер — проветриваемое подполье H=1.5-2 м с продухами 25-30% площади, ориентированными на господств. ветры; 2) Термосифоны Long Yang по периметру; 3) Сеть мониторинга — 8-12 термических скважин глубиной 5-10 м с термисторами (1 на 100 м² застройки), измерения 4 раза/год; 4) Канализация и водопровод внутри здания — НЕ закопаны в грунт, проложены по тёплым каналам с теплоспутниками + теплоизоляция; 5) Сток дождевой воды от здания через ливнёвку с отводом ≥30 м от фундамента; 6) Обязательная вентиляция подвального пространства; 7) Запрет посадки деревьев и кустарников в радиусе 5 м (затрудняют сезонное промерзание); СНиП 2.02.04 + СП 25.13330" },
              { v: "d", t: "Газовое отопление вместо электрического" },
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
                {score === 4 ? "Отлично — готовы к проектированию на ММГ" : score >= 2 ? "Перечитайте СНиП 2.02.04 + СП 25.13330" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> СНиП 2.02.04 (Основания на ММГ), СП 25.13330, СН РК 5.01-01, ГОСТ 25100, ГОСТ 24847 (Грунты ММГ).</p>
          <p><strong>Реальные объекты:</strong> Жилые дома Норильска, Ямбург ЯНАО (Газпром), г. Игарка, объекты Salym Petroleum, северо-Казахстанские пограничные посты.</p>
        </section>
      </main>
    </div>
  );
}
