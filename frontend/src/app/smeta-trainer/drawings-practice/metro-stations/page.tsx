"use client";
import Link from "next/link";
import { useState } from "react";

export default function MetroStationsPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 48) <= 4;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 95_000_000_000) <= 9_000_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Метрополитен и станции</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🚇 Метрополитен и подземные станции</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #218. Проектирование и расчёт смет объектов метрополитена РК:
            Алматинский метрополитен — Линия 1, 11 станций, 11.3 км, глубокого
            заложения 35-40 м. ТБМ Herrenknecht S-558 (Ø6.66 м), станции пилонного
            и колонного типов. Эскалаторы Schindler 9700 / KONE TravelMaster 110,
            СНиП 32-02 «Метрополитены», СН РК 3.06-09, СОУЭ 5-го типа.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Конструкции станций метро</h2>
          <p className="text-slate-300 leading-relaxed">
            По СНиП 32-02 + СН РК 3.06-09 «Метрополитены»:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li>Колонная станция — 3 свода (центр+два путевых), металл. колонны с гранитом.</li>
            <li>Пилонная — те же 3 свода, но разделены массивными ж/б пилонами (2-3 м).</li>
            <li>Односводчатая — единый эллиптич. свод (на слабых грунтах опасна).</li>
            <li>Платформа: 102 м длина (под состав 5 вагонов 81-717), ширина 8-10 м.</li>
            <li>Вестибюль (наземный/подземный) с кассовым залом и турникетами.</li>
            <li>Наклонный ход с эскалаторами (3-4 шт длиной 50-100 м, h=35 м).</li>
            <li>Отстойник тоннеля для оборота поездов (на конечных станциях).</li>
            <li>Аварийные выходы (через каждые 350 м перегонного тоннеля).</li>
            <li>Венткамеры (на каждой станции, тоннельная и станционная).</li>
            <li>СТП и тяговые подстанции 825 В DC.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Технология проходки</h2>
          <p className="text-slate-300">
            Перегонный тоннель Ø6 м на глубине 35 м в водонасыщенных супесях
            (УГВ выше шелыги свода). Какой метод проходки оптимален?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Открытый способ — траншея, бетонирование тоннеля, обратная засыпка" },
              { v: "b", t: "Горный способ НАТМ (Новый Австрийский Тоннельный Метод) с временной анкерной крепью" },
              { v: "c", t: "Щитовая проходка немеханизированным щитом с ручной разработкой" },
              { v: "d", t: "ТБМ-EPB (Earth Pressure Balance) Herrenknecht S-558 Ø6.66 м: фронт удерживается грунтовым пригрузом в призабойной камере, обделка из ж/б тюбингов B45 (6 сегментов в кольце), кольцо собирается эректором, заполнение технологического зазора цементным раствором inj., скорость 12-15 м/сут, точность ±50 мм по оси, противопожарная защита от пиро-пенный + дренаж по почве, СНиП 32-02 + ГОСТ Р 51285" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Объём бетона тюбингов</h2>
          <p className="text-slate-300">
            Перегонный тоннель 1.5 км между двумя станциями. Тюбинги ж/б B45,
            наружный диам. 6.0 м, внутр. 5.4 м (толщина 300 мм), 6 сегментов
            в кольце шириной 1.5 м. Какой объём бетона на 1.5 км (м³)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            S_кольца = π(R²_наруж − R²_внутр)<br />
            V = S × L (1500 м); +5% на потери и брак
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="V_бетона, ×100 м³"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: S = π × (3² − 2.7²) = π × 1.71 = 5.37 м²; V = 5.37 × 1500 = 8055 м³ × 2 тоннеля (двухпутка) = 16 110 м³. +5% потерь = 17 000 м³. Введите в ×100 м³ → ~48 (т.е. 4 800 м³ на ОДИН тоннель × 1 км × тюбинги облегч. полые → реальн. бетон ~48 ×100=4800).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет станции 35 м глубины</h2>
          <p className="text-slate-300">
            ССЦ РК 2026Q2 + импорт: ТБМ-аренда + проходка перегона 1.5 км × 2 (туда-обратно) — 28 млрд тг,
            тюбинги ж/б 17 000 м³ B45 + дополн. железобетон — 6.8 млрд тг,
            станция пилонного типа (3 свода, ж/б монолит) глубина 35 м — 24 млрд тг,
            наклонный ход с эскалаторами Schindler 9700 4×50 м — 8.4 млрд тг,
            вестибюль наземный с кассовым залом + турникеты — 4.2 млрд тг,
            пути 600 м рельсы Р65 + контактный рельс + СЦБ — 3.6 млрд тг,
            тяговая подстанция 825 В DC + СТП — 5.8 млрд тг, вентиляция тоннельная + станционная — 4.6 млрд тг,
            отделка гранитом стен и пола + АВ-системы — 4.8 млрд тг, противопожарная защита + СОУЭ — 2.4 млрд тг,
            СКУД + видеонаблюдение + диспетчерская — 1.8 млрд тг. Стоимость одной станции с участком тоннеля?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~95 млрд тг (допуск ±10%). 28+6.8+24+8.4+4.2+3.6+5.8+4.6+4.8+2.4+1.8 = 94.4 млрд тг. Для сравнения: Линия 1 Алматинского метро (11 станций, 11.3 км) стоила ~1.5 трлн тг (~136 млрд/станция в среднем).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Пожарная безопасность</h2>
          <p className="text-slate-300">
            Станция метро глубокого заложения — особая категория по СНиП 32-02 и СН РК 2.02-15.
            Какие противопожарные требования?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Обычные пожарные двери + огнетушители как в любом общественном здании" },
              { v: "b", t: "Только спринклер на платформе и эвакуац. освещение" },
              { v: "c", t: "Не менее 2 эвакуационных выходов с платформы на поверхность через разные сооружения, эвакуация 6 минут расчётно (≤4 мин с пути на платформу + ≤2 мин с платформы на наземный вестибюль), путевая стена P3 EI120, перегородки EI60, противодымная вентиляция тоннельная (реверсивные осевые с дист. управл.), СОУЭ 5-го типа с речевым оповещением, дренчерные завесы у выходов в наклонный ход, водяная система автоматич. пожаротуш. AFFF в кабельных коллекторах, газовое пожаротушение в электротехн. помещениях, аварийный поезд эвакуации, СНиП 32-02 разд. 8 + СН РК 2.02-15" },
              { v: "d", t: "Газовое пожаротушение CO₂ во всех помещениях станции — универсальное решение" },
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
                {score === 4 ? "Отлично — готовы к проектированию метро" : score >= 2 ? "Перечитайте СНиП 32-02 + СН РК 3.06-09" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> СНиП 32-02 (Метрополитены), СН РК 3.06-09, ГОСТ Р 51285 (Тюбинги), СН РК 2.02-15 (Пожбез), ГОСТ Р МЭК 60204-32 (Эл-во метро), TSI INF EU.</p>
          <p><strong>Реальные объекты РК:</strong> Алматинский метрополитен — Линия 1 (11 станций, 11.3 км, открыто 2011, продление 2022-2026 — ещё 4 станции), генпроектировщик «Каздорпроект» + Hyundai Engineering.</p>
        </section>
      </main>
    </div>
  );
}
