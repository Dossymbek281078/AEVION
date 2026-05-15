"use client";

import Link from "next/link";
import { useState } from "react";

export default function TransportLogisticsPage() {
  // Упр.1 — выбор транспорта
  const [ex1, setEx1] = useState<string | null>(null);
  const [ex1Res, setEx1Res] = useState<null | "ok" | "bad">(null);
  const [ex1Sol, setEx1Sol] = useState(false);

  // Упр.2 — стоимость автоперевозки
  const [ex2, setEx2] = useState("");
  const [ex2Res, setEx2Res] = useState<null | "ok" | "bad">(null);
  const [ex2Sol, setEx2Sol] = useState(false);

  // Упр.3 — % транспортных в смете
  const [ex3, setEx3] = useState<string | null>(null);
  const [ex3Res, setEx3Res] = useState<null | "ok" | "bad">(null);
  const [ex3Sol, setEx3Sol] = useState(false);

  // Упр.4 — экономия от ж/д vs авто
  const [ex4, setEx4] = useState("");
  const [ex4Res, setEx4Res] = useState<null | "ok" | "bad">(null);
  const [ex4Sol, setEx4Sol] = useState(false);

  const checkEx1 = () => setEx1Res(ex1 === "c" ? "ok" : "bad");
  const checkEx2 = () => {
    // 25 т × 200 км × 80 тг/т·км = 400 000 тг
    const v = parseFloat(ex2);
    if (!isFinite(v)) return setEx2Res("bad");
    setEx2Res(Math.abs(v - 400_000) <= 20_000 ? "ok" : "bad");
  };
  const checkEx3 = () => setEx3Res(ex3 === "b" ? "ok" : "bad");
  const checkEx4 = () => {
    // 1000 т × 600 км: авто 1000×600×40 = 24 000 000; ж/д 1000×600×12 = 7 200 000 + перевалка 1500×1000 = 1 500 000
    // итог ж/д = 8 700 000; экономия = 24 000 000 − 8 700 000 = 15 300 000
    const v = parseFloat(ex4);
    if (!isFinite(v)) return setEx4Res("bad");
    setEx4Res(Math.abs(v - 15_300_000) <= 500_000 ? "ok" : "bad");
  };

  const modes = [
    {
      mode: "Автомобильный (КамАЗ, MAN, Volvo)",
      cargo: "Все виды — от сыпучих до спецоборудования",
      capacity: "10-25 т (бортовой), 10-30 м³ (самосвал), 20 т (контейнер)",
      tariff: "80-150 тг/т·км в РК (2025), для самосвала 1500-2500 тг/час",
      pros: "Доставка «от двери до двери», гибкость, скорость",
      cons: "Дороже на расстояния &gt; 500 км, ограничения по большегрузам через мосты/центр",
    },
    {
      mode: "Железнодорожный (КТЖ — Қазақстан темір жолы)",
      cargo: "Сыпучие (цемент, щебень, песок), металл, ж/б крупный",
      capacity: "Полувагон 60-69 т, цементовоз 67 т, платформа 60 т",
      tariff: "8-15 тг/т·км (тариф КТЖ), + перевалка 1000-2000 тг/т на станции",
      pros: "Экономично на расстояния &gt; 300 км, большие объёмы",
      cons: "Только до ближайшей ж/д станции, перевалка, простои",
    },
    {
      mode: "Водный (по Каспию, Иртышу)",
      cargo: "Крупногабарит, металл, сыпучие — Атырау, Актау, Павлодар, Семей",
      capacity: "Баржа 1500-3000 т, сухогруз до 5000 т",
      tariff: "4-8 тг/т·км — самый дешёвый, но сезонный (апр-окт)",
      pros: "Минимальная цена за тонна·км",
      cons: "Сезонность 6-7 месяцев, только западные/северо-восточные регионы",
    },
    {
      mode: "Воздушный (Air Astana Cargo, Avia Service)",
      cargo: "Спецоборудование, экстренные поставки, мед. техника",
      capacity: "10-40 т (грузовой Boeing), 100 кг малая авиация",
      tariff: "500-1500 тг/кг (для груза, дистанция Алматы-Астана)",
      pros: "Скорость — часы вместо суток",
      cons: "Очень дорого, не для массовых стройматериалов",
    },
    {
      mode: "Спецтранспорт (трал, тягач)",
      cargo: "Негабарит — сваи, фермы, оборудование &gt; 12 м длины или 4 м ширины",
      capacity: "Трал 60-100 т, тягач + полуприцеп",
      tariff: "8000-25000 тг/час, по часам + дороги/сопровождение",
      pros: "Возможность перевозки уникальных грузов",
      cons: "Разрешения акимата на негабарит (по ПДД ст. 17), скорость 40 км/ч",
    },
  ];

  const materials = [
    { mat: "Цемент М500", group: "I — сыпучий пылящий", tariff: "автоцементовоз 100-150 тг/т·км, ж/д цементовоз 10 тг/т·км", note: "Только закрытый ТС, сертификат партии при загрузке" },
    { mat: "Щебень фракции 5-20", group: "II — сыпучий нерудный", tariff: "автосамосвал 80-120 тг/т·км, ж/д полувагон 8-10 тг/т·км", note: "Карьеры Алмалинский, Каскелен — Алматы; Кокпекты, Тогызак — Караганда" },
    { mat: "Песок речной", group: "II — сыпучий нерудный", tariff: "автосамосвал 70-100 тг/т·км, ж/д 8-10 тг/т·км", note: "Месторождения Иле, Жетысу, Каркаралинск" },
    { mat: "Арматура А500С", group: "III — металлические", tariff: "автоплатформа 100-150 тг/т·км, ж/д платформа 9-12 тг/т·км", note: "Поставщики — АрселорМиттал Темиртау, КарМет, импорт RU/CN" },
    { mat: "Кирпич М150", group: "IV — штучные тяжёлые", tariff: "автоплатформа 80-110 тг/т·км", note: "На паллетах 480-500 шт. × 4 кг = 2 т, упаковка стрейч + ленты" },
    { mat: "Газоблок Ytong", group: "V — штучные лёгкие", tariff: "автоплатформа 75-100 тг/т·км", note: "Поддон 1.8-2.5 м³ × 500-700 кг/м³" },
    { mat: "Окна ПВХ", group: "VI — крупногабарит хрупкие", tariff: "автофургон 200-300 тг/т·км", note: "Вертикальная пирамида, ремни, прокладки. Часто +страховка 0.5%" },
    { mat: "Краска / лак / клей", group: "VII — опасные ЛВЖ", tariff: "автофургон 200-400 тг/т·км + ДОПОГ", note: "ADR/ДОПОГ — водитель со свид., красные оранж. знаки, ОСАГО грузопер." },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-sky-300 hover:text-sky-200 transition">
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Транспортная логистика</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            🚛 Транспортная логистика стройки
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            Доставка стройматериалов занимает <strong className="text-amber-300">5-15% от
            ССР</strong> (сметной стоимости работ). Грамотный выбор транспорта — авто vs ж/д vs
            вода — может сэкономить десятки миллионов на крупных объектах. В РК с её протяжёнными
            маршрутами (Алматы–Атырау 2700 км, Шымкент–Усть-Каменогорск 2300 км) логистика —
            ключевой элемент сметы. Регулируется ЗРК «О ж/д транспорте» от 08.12.2001 № 266 и
            ПДД РК (Приказ № 295 от 13.05.2014).
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Доля в смете</div>
              <div className="text-slate-300">5-15% от ССР (отдельная строка в Гл.10 ССР)</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Норматив РК</div>
              <div className="text-slate-300">СН РК 8.02-05 (учёт трансп. затрат)</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Точка перехода авто→ж/д</div>
              <div className="text-slate-300">~ 300-500 км для массовых материалов</div>
            </div>
          </div>
        </section>

        {/* Section 1: Виды транспорта */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🚂 Section 1. Пять видов транспорта для стройки
          </h2>
          <div className="space-y-3">
            {modes.map((m) => (
              <div key={m.mode} className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
                <h3 className="text-base font-semibold text-amber-300 mb-3">{m.mode}</h3>
                <dl className="text-sm grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Груз</dt>
                    <dd className="text-slate-300 text-xs">{m.cargo}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Грузоподъёмность</dt>
                    <dd className="text-slate-300 text-xs">{m.capacity}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Тариф (РК 2025)</dt>
                    <dd className="text-emerald-300 text-xs font-mono">{m.tariff}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Плюсы / Минусы</dt>
                    <dd className="text-slate-400 text-xs">
                      <div className="text-emerald-400">+ {m.pros}</div>
                      <div className="text-rose-400">− {m.cons}</div>
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Группы материалов */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            📦 Section 2. Группы материалов и тарифы перевозки
          </h2>
          <p className="text-slate-400 text-sm max-w-4xl">
            По ЕНиР Сб.1 «Внутрипостроечный транспорт» материалы делятся на 8 групп. От группы
            зависит выбор ТС, упаковки и тарифа. На основе этой группировки сметчик заполняет
            графу «транспортные затраты» в смете.
          </p>

          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Материал</th>
                  <th className="text-left px-4 py-3 w-44">Группа</th>
                  <th className="text-left px-4 py-3">Тарифы</th>
                  <th className="text-left px-4 py-3">Особенности</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {materials.map((m) => (
                  <tr key={m.mat} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 text-slate-100">{m.mat}</td>
                    <td className="px-4 py-3 text-amber-300 text-xs">{m.group}</td>
                    <td className="px-4 py-3 text-emerald-300 text-xs font-mono">{m.tariff}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{m.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: Расчёт */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🧮 Section 3. Формула расчёта транспортных затрат
          </h2>

          <div className="border border-amber-800/60 bg-amber-950/30 rounded-xl p-5">
            <div className="text-amber-300 font-mono text-lg mb-3 text-center">
              T = Σ (Q_i × L_i × t_i) + T_перевалки + T_простои + НДС
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="border border-slate-800 rounded p-3 bg-slate-900/60">
                <div className="text-amber-300 font-mono mb-1">Q_i</div>
                <div className="text-slate-300 text-xs">Объём груза i-го материала, т</div>
              </div>
              <div className="border border-slate-800 rounded p-3 bg-slate-900/60">
                <div className="text-amber-300 font-mono mb-1">L_i</div>
                <div className="text-slate-300 text-xs">Расстояние от поставщика до площадки, км</div>
              </div>
              <div className="border border-slate-800 rounded p-3 bg-slate-900/60">
                <div className="text-amber-300 font-mono mb-1">t_i</div>
                <div className="text-slate-300 text-xs">Тариф перевозки, тг/(т·км). Зависит от группы материала и вида ТС</div>
              </div>
              <div className="border border-slate-800 rounded p-3 bg-slate-900/60">
                <div className="text-amber-300 font-mono mb-1">T_перевалки</div>
                <div className="text-slate-300 text-xs">При мульти-режимной доставке (ж/д→авто) — 1000-2000 тг/т</div>
              </div>
              <div className="border border-slate-800 rounded p-3 bg-slate-900/60">
                <div className="text-amber-300 font-mono mb-1">T_простои</div>
                <div className="text-slate-300 text-xs">Простой ТС под разгрузкой свыше нормы (~30 мин), 5000-15000 тг/час</div>
              </div>
              <div className="border border-slate-800 rounded p-3 bg-slate-900/60">
                <div className="text-amber-300 font-mono mb-1">НДС 12%</div>
                <div className="text-slate-300 text-xs">Накручивается сверху, перевозчик выставляет СФ</div>
              </div>
            </div>
          </div>

          <div className="bg-emerald-950/30 border border-emerald-800/60 rounded-lg p-4 text-sm text-emerald-200">
            <strong>Правило 300 км:</strong> при расстоянии до поставщика &gt; 300 км для
            массовых материалов (цемент, щебень, металл) выгоднее ж/д вариант, даже с учётом
            перевалки. На дистанции 100-300 км — авто обычно дешевле из-за «двери в дверь».
            До 100 км — однозначно автомобильный транспорт.
          </div>
        </section>

        {/* Упражнения */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Section 4. Упражнения</h2>

          {/* Упр.1 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 1 / 4 — Выбор транспорта
            </div>
            <div className="text-slate-200 mb-4">
              Нужно доставить <strong>500 т цемента М500</strong> с завода в Шымкенте на стройку
              в Алматы (расстояние <strong>770 км по трассе</strong>). На стройплощадке есть
              удобный подъезд для самосвалов, но рядом — ж/д станция «Алматы-1». Какой
              транспорт выбрать?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Авто (КамАЗ-самосвал) — самый быстрый и гибкий" },
                { v: "b", t: "Воздушный (грузовой Boeing) — для скорости" },
                { v: "c", t: "Ж/д цементовоз + перевалка на авто у Алматы-1" },
                { v: "d", t: "Водный по Иртышу — самое дешёвое" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex1 === opt.v ? "border-amber-600 bg-amber-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex1" value={opt.v} checked={ex1 === opt.v} onChange={() => setEx1(opt.v)} className="accent-amber-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx1} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx1Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex1Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex1Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — ж/д с перевалкой</span>}
              {ex1Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-amber-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Сравнение вариантов на 500 т × 770 км:

Авто (КамАЗ-цементовоз, тариф 120 тг/т·км):
500 × 770 × 120 = 46 200 000 тг

Ж/д цементовоз КТЖ (тариф 10 тг/т·км):
500 × 770 × 10 = 3 850 000 тг
+ перевалка на станции 1500 тг/т × 500 = 750 000 тг
+ автодоставка от Алматы-1 до площадки 30 км × 500 × 120 = 1 800 000 тг
= ИТОГО 6 400 000 тг

ЭКОНОМИЯ: 46 200 000 − 6 400 000 = 39 800 000 тг (-86%)

Водный по Иртышу для маршрута Шымкент-Алматы не применим
(нет водных путей в нужном направлении). Воздушный для 500 т
цемента — абсурд (стоил бы > 100 млн тг).

Правило 300 км подтверждается: на 770 км ж/д выгоднее в 7 раз.`}
                </pre>
              </div>
            )}
          </div>

          {/* Упр.2 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Стоимость автоперевозки
            </div>
            <div className="text-slate-200 mb-4">
              Доставка арматуры А500С: масса <strong>25 т</strong>, расстояние
              <strong> 200 км</strong> (карьер за Капшагаем — Алматы), тариф автоплатформы
              <strong> 80 тг/т·км</strong>. Сколько тенге стоит перевозка (без НДС)?
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Стоимость, тг</span>
              <input value={ex2} onChange={(e) => setEx2(e.target.value)} type="number" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="400000" />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx2} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx2Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex2Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex2Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 400 000 тг</span>}
              {ex2Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Перепроверь</span>}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-amber-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`T = Q × L × t
T = 25 т × 200 км × 80 тг/(т·км)
T = 400 000 тг (без НДС)

С НДС 12%:
T_с_НДС = 400 000 × 1.12 = 448 000 тг

В смете:
• Арматура (25 т × 350 000 тг/т) = 8 750 000 тг
• Транспорт (без НДС) = 400 000 тг
• Транспорт / стоимость материала = 4.6%
  — попадает в диапазон 4-8% для арматуры

Если бы взять КамАЗ-бортовой грузоподъёмностью 15 т,
пришлось бы делать 2 рейса:
2 × 200 × 80 × 15 + неполная загрузка = ~ 540 000 тг → дороже
Решение: автоплатформа 25 т — оптимальный выбор для 25-тонн. партии.`}
                </pre>
              </div>
            )}
          </div>

          {/* Упр.3 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — Доля транспорта в смете
            </div>
            <div className="text-slate-200 mb-4">
              Какова <strong>типичная доля</strong> транспортных затрат в сметной стоимости
              строительных работ (ССР) для жилого дома в РК с поставщиками в радиусе 200-500 км?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "1-3% от ССР — транспорт незначителен" },
                { v: "b", t: "5-15% от ССР (обычный диапазон для жилья)" },
                { v: "c", t: "20-30% от ССР — основная часть бюджета" },
                { v: "d", t: "Свыше 50% — для удалённых строек" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex3 === opt.v ? "border-amber-600 bg-amber-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex3" value={opt.v} checked={ex3 === opt.v} onChange={() => setEx3(opt.v)} className="accent-amber-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx3} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx3Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex3Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex3Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 5-15%</span>}
              {ex3Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-amber-300">Решение:</strong> 5-15% — обычный диапазон
                для жилого дома в крупном городе с близкими поставщиками. В отдалённых районах
                (Балхаш, Аркалык, Уральск) доля может быть 20-25% за счёт километража. На
                месторождениях за 1000+ км (Жанаозен, Кашаган) — до 30-40%. В смете
                транспортные затраты по СН РК 8.02-05 показываются:
                • В Гл.4 ССР — затраты на доставку строительных материалов
                • В Гл.10 ССР — затраты на перевозку рабочих от места жительства до площадки
                • В составе ЭСН — некоторые расценки уже включают «нормативный» транспорт.
                Сметчик должен анализировать, не задвоился ли учёт.
              </div>
            )}
          </div>

          {/* Упр.4 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — Экономия ж/д vs авто
            </div>
            <div className="text-slate-200 mb-4">
              Поставка <strong>1 000 т щебня</strong> Караганда → Алматы (<strong>600 км</strong>).
              Тарифы: автосамосвал — <strong>40 тг/т·км</strong>, ж/д полувагон —
              <strong> 12 тг/т·км</strong>, перевалка на станции прибытия —
              <strong> 1 500 тг/т</strong>. Какая экономия в тенге при выборе ж/д?
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Экономия, тг</span>
              <input value={ex4} onChange={(e) => setEx4(e.target.value)} type="number" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="15300000" />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx4} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx4Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex4Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex4Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 15.3 млн тг</span>}
              {ex4Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Перепроверь</span>}
            </div>
            {ex4Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-amber-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Вариант 1 — Авто:
T_авто = 1000 × 600 × 40 = 24 000 000 тг

Вариант 2 — Ж/д с перевалкой:
T_ж/д = 1000 × 600 × 12 = 7 200 000 тг
T_перевалка = 1000 × 1500 = 1 500 000 тг
ИТОГО ж/д = 8 700 000 тг

Экономия: 24 000 000 − 8 700 000 = 15 300 000 тг (-64%)

Дополнительные факторы:
+ Ж/д надёжнее в зимнее время (нет рисков по трассам Караганда-Алматы)
+ КТЖ даёт скидку 5-10% при длинных партиях
− Срок доставки ж/д 5-8 дней vs 1-2 дня авто (важно при срочности)
− Требуется планирование под расписание КТЖ

На объёмах > 500 т и расстояниях > 500 км — ж/д всегда выгоднее.
Экономия 15 млн тг = бюджет на 1.5 мес. зарплат прорабов.`}
                </pre>
              </div>
            )}
          </div>
        </section>

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">
          СН РК 8.02-05 (Учёт транспортных затрат). ЕНиР Сб.1 (Внутрипостроечный транспорт).
          ЗРК «О ж/д транспорте» от 08.12.2001 № 266. ПДД РК (Приказ № 295 от 13.05.2014) —
          ст. 17 о негабарите. Тарифы КТЖ — railways.kz / РЖД-Кз. Калькуляторы — Wialon
          Trip Planner, GLONASSSoft Logistics.
        </div>
      </main>
    </div>
  );
}
