"use client";

import Link from "next/link";
import { useState } from "react";

export default function DustNoiseControlPage() {
  const [ex1, setEx1] = useState<string | null>(null);
  const [ex1Res, setEx1Res] = useState<null | "ok" | "bad">(null);
  const [ex1Sol, setEx1Sol] = useState(false);

  const [ex2, setEx2] = useState("");
  const [ex2Res, setEx2Res] = useState<null | "ok" | "bad">(null);
  const [ex2Sol, setEx2Sol] = useState(false);

  const [ex3, setEx3] = useState<string | null>(null);
  const [ex3Res, setEx3Res] = useState<null | "ok" | "bad">(null);
  const [ex3Sol, setEx3Sol] = useState(false);

  const [ex4, setEx4] = useState("");
  const [ex4Res, setEx4Res] = useState<null | "ok" | "bad">(null);
  const [ex4Sol, setEx4Sol] = useState(false);

  const checkEx1 = () => setEx1Res(ex1 === "b" ? "ok" : "bad");
  const checkEx2 = () => {
    // L_итог = L1 - 10·lg(R²/R0²) ≈ 105 - 10·lg(40²/15²) ≈ 105 - 8.5 ≈ 96.5 дБ — приблизительно
    // Упрощённо для упражнения: при удвоении расстояния -6 дБ. R0=15м, R=60м → 4×=> -12 дБ → 105-12=93
    // Допустим тут расстояние 60 м: ответ 93
    const v = parseFloat(ex2);
    if (!isFinite(v)) return setEx2Res("bad");
    setEx2Res(Math.abs(v - 93) <= 2 ? "ok" : "bad");
  };
  const checkEx3 = () => setEx3Res(ex3 === "c" ? "ok" : "bad");
  const checkEx4 = () => {
    // 5 поливочных проездов/день × 30 дней × 25 000 тг/проезд = 3 750 000 тг
    const v = parseFloat(ex4);
    if (!isFinite(v)) return setEx4Res("bad");
    setEx4Res(Math.abs(v - 3_750_000) <= 100_000 ? "ok" : "bad");
  };

  const limits = [
    {
      type: "Пыль PM10 в жилой зоне",
      value: "0.06 мг/м³ (среднесут.) / 0.30 (макс. разовая)",
      norm: "СанПин «Гигиенические нормативы атм. воздуха» (Приказ Минздрава №331)",
      penalty: "до 200 МРП штраф + остановка работ (ст. 437 КоАП РК)",
    },
    {
      type: "Шум днём (07:00-23:00) у фасада",
      value: "55 дБА — жил. дома; 60 — обществ. здания",
      norm: "СН РК 2.04-03-2002 «Защита от шума» (актуализация 2018)",
      penalty: "до 100 МРП + жалоба санитарного врача",
    },
    {
      type: "Шум ночью (23:00-07:00)",
      value: "45 дБА — жил. дома; 50 — обществ. здания",
      norm: "СН РК 2.04-03, статья КоАП о ночном шуме (ст. 437)",
      penalty: "до 200 МРП для юрлиц + предписание остановить",
    },
    {
      type: "Вибрация в жилой застройке",
      value: "62 дБ (днём) / 57 дБ (ночью), L_v",
      norm: "СН РК 2.04-04 «Защита от вибрации»",
      penalty: "до 150 МРП + замеры аккредит. лабораторией",
    },
    {
      type: "Загрязнение дорог общего пользования",
      value: "Запрещён выезд грязной техники на дороги общего пользования",
      norm: "ПДД РК ст. 24 + Постановление акимата г. Алматы № 4-1067",
      penalty: "20-50 МРП + штраф водителю + предписание ГАСК",
    },
  ];

  const measures = [
    {
      title: "Поливочные машины",
      what: "КамАЗ-цистерна 8-12 м³, разбрызгиватель сзади",
      where: "По грунтовым дорогам внутри стройки и по подъездам",
      cost: "20-30 тыс. тг за проезд (~ 8 м³ воды), 3-7 проездов/день",
      norm: "ППР раздел 8 «Природоохранные мероприятия»",
    },
    {
      title: "Защитные сетки и ограждения",
      what: "Зелёная или коричневая сетка, плотность 80-160 г/м², по периметру + фасадам",
      where: "Сплошное закрытие фасадов на этажах работ, ограждение площадки",
      cost: "1500-3000 тг/м² с монтажом, аренда 200-400 тг/м²/мес",
      norm: "СНиП РК 1.03-05 «Охрана труда»",
    },
    {
      title: "Мойки колёс автотранспорта",
      what: "Стационарная (ванна 4×6 м + насосы) или мобильная (Mobydick, Quivar)",
      where: "У всех выездов со стройплощадки на дороги общего пользования",
      cost: "Стационарная: 3-8 млн тг + 200-500 тг/проезд воды и электр.",
      norm: "Постановление акимата г. Алматы № 4-1067 + Эколог. кодекс РК ст. 91",
    },
    {
      title: "Закрытие пылящих материалов",
      what: "Брезент, плёнка ПЭ 200 мкм, бункеры с пыле-улавливанием",
      where: "Склады цемента, песка, золы. Транспорт цемента — только закрытый",
      cost: "Брезент 600-900 тг/м², плёнка ПЭ 200-300 тг/м²",
      norm: "СанПин «Сан. требования к складам»",
    },
    {
      title: "Шумозащитные экраны",
      what: "Стационарные акустические панели Z-bock, Acoustic-Wood — H=3-6 м",
      where: "При работах рядом с школами, больницами, жилой застройкой",
      cost: "12-30 тыс. тг/м² (стационарные), мобильные 5-8 тыс. тг/м²",
      norm: "СН РК 2.04-03 — расчёт необходимой высоты экрана",
    },
    {
      title: "График шумных работ",
      what: "Запрет шумных работ в часы тихого отдыха: 22:00-07:00, 13:00-15:00 (суб/вс)",
      where: "ППР раздел «Режим работ» — согласование с акиматом района",
      cost: "Снижение производительности 5-15% — учитывается в Гл.10 ССР",
      norm: "СН РК 2.04-03 + Постановление акимата района",
    },
    {
      title: "Малошумная техника",
      what: "Электр. компрессоры вместо дизельных, виброкатки с шумоизоляцией",
      where: "При работах в плотной застройке",
      cost: "Аренда на 20-40% дороже обычной",
      norm: "ППР, согласование с СЭС",
    },
    {
      title: "Мониторинг и фиксация",
      what: "Установка стационарного шумомера-пылемера на границе стройки",
      where: "По периметру, 24/7 запись с передачей в облако",
      cost: "Оборудование 800 тыс. - 1.5 млн тг + аренда 50-100 тыс./мес",
      norm: "Эколог. кодекс РК + СанПин — производственный контроль",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-sky-300 hover:text-sky-200 transition">
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Пыле-шумозащита</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            🌫 Пыле-шумозащита и природоохрана
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            Стройка в жилой застройке РК — <strong className="text-yellow-300">постоянный
            источник жалоб</strong> от жителей по поводу пыли, грязи и шума. Государственный
            АрхСтройКонтроль, СЭС и местные акиматы активно штрафуют за нарушения, особенно
            в Алматы и Астане (Постановление акимата г. Алматы № 4-1067 2023 г. ужесточило
            требования). Природоохранные мероприятия — отдельная строка в Гл.9 ССР, обычно
            0.5-2% от ССР.
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Нормативы</div>
              <div className="text-slate-300">СН РК 2.04-03 (шум), СН РК 2.04-04 (вибрация), Эколог. кодекс РК</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Доля в смете</div>
              <div className="text-slate-300">0.5-2% от ССР (Гл.9 «Природоохранные»)</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Штрафы 2025</div>
              <div className="text-slate-300">20-200 МРП юрлицу + остановка работ</div>
            </div>
          </div>
        </section>

        {/* Section 1: ПДК и штрафы */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            ⚠️ Section 1. ПДК и нормативы — пять ключевых лимитов
          </h2>
          <div className="space-y-3">
            {limits.map((l) => (
              <div key={l.type} className="border border-rose-900/40 bg-rose-950/20 rounded-xl p-4">
                <div className="flex items-baseline justify-between gap-4 mb-2">
                  <h3 className="text-base font-semibold text-rose-300">{l.type}</h3>
                  <span className="text-xs text-amber-300 font-mono italic shrink-0">{l.value}</span>
                </div>
                <div className="text-xs text-slate-400 mb-1">
                  <span className="text-slate-500 uppercase tracking-wider mr-2">Норматив:</span>
                  {l.norm}
                </div>
                <div className="text-xs text-rose-400">
                  <span className="text-slate-500 uppercase tracking-wider mr-2">Штраф:</span>
                  {l.penalty}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Меры */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🛡 Section 2. Восемь обязательных мер защиты
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {measures.map((m) => (
              <div key={m.title} className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
                <h3 className="text-base font-semibold text-yellow-300 mb-2">{m.title}</h3>
                <dl className="text-sm space-y-1.5">
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Что</dt>
                    <dd className="text-slate-300 text-xs">{m.what}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Где применять</dt>
                    <dd className="text-slate-300 text-xs">{m.where}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Цена</dt>
                    <dd className="text-emerald-300 text-xs">{m.cost}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Норматив</dt>
                    <dd className="text-slate-400 text-xs italic">{m.norm}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Расчёт шума */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            📐 Section 3. Расчёт распространения шума
          </h2>
          <div className="border border-yellow-800/60 bg-yellow-950/30 rounded-xl p-5">
            <div className="text-yellow-300 font-mono text-lg mb-3 text-center">
              L₂ = L₁ − 20 · lg(R₂/R₁) − ΔL_атм − ΔL_экран
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="border border-slate-800 rounded p-3 bg-slate-900/60">
                <div className="text-yellow-300 font-mono mb-1">L₁</div>
                <div className="text-slate-300 text-xs">Уровень шума у источника, дБА (105-115 — отбойный молоток, 90-100 — компрессор, 80-90 — кран)</div>
              </div>
              <div className="border border-slate-800 rounded p-3 bg-slate-900/60">
                <div className="text-yellow-300 font-mono mb-1">L₂</div>
                <div className="text-slate-300 text-xs">Уровень шума у фасада защищаемого объекта, дБА</div>
              </div>
              <div className="border border-slate-800 rounded p-3 bg-slate-900/60">
                <div className="text-yellow-300 font-mono mb-1">R₁, R₂</div>
                <div className="text-slate-300 text-xs">Расстояние от источника до точки замера (м). При удвоении R снижение −6 дБ для точечного, −3 дБ для линейного</div>
              </div>
              <div className="border border-slate-800 rounded p-3 bg-slate-900/60">
                <div className="text-yellow-300 font-mono mb-1">ΔL_атм</div>
                <div className="text-slate-300 text-xs">Затухание в воздухе, 0.005 дБ/м для 500 Гц</div>
              </div>
              <div className="border border-slate-800 rounded p-3 bg-slate-900/60">
                <div className="text-yellow-300 font-mono mb-1">ΔL_экран</div>
                <div className="text-slate-300 text-xs">Эффект акустического экрана (5-25 дБ в зависимости от высоты и пористости)</div>
              </div>
              <div className="border border-slate-800 rounded p-3 bg-slate-900/60">
                <div className="text-yellow-300 font-mono mb-1">Норма у фасада</div>
                <div className="text-slate-300 text-xs">55 дБА днём / 45 дБА ночью для жил. дома</div>
              </div>
            </div>
          </div>
        </section>

        {/* Упражнения */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Section 4. Упражнения</h2>

          {/* Упр.1 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 1 / 4 — Ночные работы
            </div>
            <div className="text-slate-200 mb-4">
              Подрядчик хочет заливать монолитную плиту перекрытия большой захватки в Алматы в
              ночные часы (22:00-06:00), чтобы успеть до приёмки. Что обязательно нужно сделать?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Просто работать тихо, не привлекая внимания" },
                { v: "b", t: "Получить отдельное согласование акимата района на ночные работы + установить шумозащитные экраны + уведомить жильцов" },
                { v: "c", t: "Согласовать только с прорабом и журналом учёта" },
                { v: "d", t: "Заплатить штраф 50 МРП заранее" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex1 === opt.v ? "border-yellow-600 bg-yellow-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex1" value={opt.v} checked={ex1 === opt.v} onChange={() => setEx1(opt.v)} className="accent-yellow-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx1} className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx1Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex1Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex1Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — согласование + экраны + уведомление</span>}
              {ex1Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-yellow-300">Решение:</strong> По СН РК 2.04-03 ночной
                норматив шума 45 дБА у фасада. Бетононасос (95-100 дБА у источника) даже за
                30-50 м от жил. дома превышает норму на 20-30 дБА. Согласование акимата
                требует: пакет документов (ППР, обоснование срочности, акустический расчёт),
                подача за 14 дней, информирование жителей через подъезды/КСК. Без
                согласования — штраф 200 МРП (3.7 млн тг в 2025) + остановка работ + жалобы
                жителей через 109. На практике в Алматы 80% ночных монолитных захваток в
                жилой зоне получают отказ или ограничение «только до 24:00».
              </div>
            )}
          </div>

          {/* Упр.2 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Расчёт шума на расстоянии
            </div>
            <div className="text-slate-200 mb-4">
              Отбойный молоток (точечный источник) у фасада здания даёт уровень шума
              <strong> L₁ = 105 дБА</strong> на <strong>R₁ = 15 м</strong>. Жилой дом находится
              на <strong>R₂ = 60 м</strong>. Какой уровень шума будет у фасада жилого дома?
              (Используй формулу L₂ = L₁ − 20·lg(R₂/R₁), без учёта затухания и экранов.)
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">L₂, дБА</span>
              <input value={ex2} onChange={(e) => setEx2(e.target.value)} type="number" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="93" />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx2} className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx2Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex2Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex2Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — ~93 дБА</span>}
              {ex2Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Перепроверь формулу</span>}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-yellow-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`L₂ = L₁ − 20 · lg(R₂/R₁)
L₂ = 105 − 20 · lg(60/15)
L₂ = 105 − 20 · lg(4)
L₂ = 105 − 20 · 0.602
L₂ = 105 − 12.04
L₂ ≈ 93 дБА

При удвоении расстояния от точечного источника
уровень шума снижается на 6 дБ. R₂/R₁ = 4 = 2² →
снижение 2 × 6 = 12 дБ.

ВЫВОД: 93 дБА у фасада жилого дома намного выше
нормы 55 дБА (день) или 45 дБА (ночь). Превышение
38-48 дБ — это шум как у движения автомагистрали.
Нужно: экран ≥ 4 м (даст −10 дБ), запрет ночных работ,
переход на гидравлический разрушитель (−10 дБ против
пневматического отбойника).

С экраном 4м: L₂ = 93 − 10 = 83 дБА — всё ещё много, но
для дневных работ уже допустимо при кратковременности.`}
                </pre>
              </div>
            )}
          </div>

          {/* Упр.3 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — Мойка колёс на выезде
            </div>
            <div className="text-slate-200 mb-4">
              Стройка в Алматы. На выезде нет стационарной мойки колёс. КамАЗ-самосвал в
              грязный день после дождя выезжает на проспект Достык с глиной на колёсах.
              Какие последствия?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Никаких — дождь смоет грязь" },
                { v: "b", t: "Только штраф водителю КамАЗа (10 МРП)" },
                { v: "c", t: "Штраф водителю 10 МРП + предписание ГАСК подрядчику с штрафом 50-100 МРП + риск остановки работ до устранения" },
                { v: "d", t: "Уголовное дело по ст. 277 УК РК" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex3 === opt.v ? "border-yellow-600 bg-yellow-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex3" value={opt.v} checked={ex3 === opt.v} onChange={() => setEx3(opt.v)} className="accent-yellow-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx3} className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx3Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex3Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex3Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — комплекс ответственности</span>}
              {ex3Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-yellow-300">Решение:</strong> ПДД РК ст. 24 запрещает
                выезд грязной техники. ГАСК выставляет предписание подрядчику. Постановление
                акимата г. Алматы № 4-1067 ввело отдельную ответственность подрядчика за
                грязные подъезды на дороги общего пользования — штраф 50-100 МРП юрлицу
                (0.93-1.85 млн тг в 2025). Если жалуется ГАИ — штраф водителю 10 МРП по
                КоАП. При повторных нарушениях — предписание о остановке работ до
                установки стационарной мойки колёс. На крупных стройках Алматы сейчас почти
                все имеют мойки Mobydick / Quivar / стационарные ванны 4×6 м.
              </div>
            )}
          </div>

          {/* Упр.4 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — Стоимость поливки за месяц
            </div>
            <div className="text-slate-200 mb-4">
              Грунтовые дороги стройплощадки требуют <strong>5 проездов поливочной машины
              в день</strong>. Стоимость одного проезда (~ 8 м³ воды + работа КамАЗ-цистерны) —
              <strong> 25 000 тг</strong>. Стройка работает <strong>30 дней в месяц</strong>.
              Какая стоимость поливки за месяц?
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Стоимость, тг</span>
              <input value={ex4} onChange={(e) => setEx4(e.target.value)} type="number" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="3750000" />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx4} className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx4Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex4Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex4Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 3.75 млн тг/мес</span>}
              {ex4Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Перепроверь</span>}
            </div>
            {ex4Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-yellow-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Стоимость = проезды/день × дни × цена_проезда
        = 5 × 30 × 25 000
        = 3 750 000 тг/мес

Срок поливки — обычно май-октябрь (6 мес в Алматы):
6 × 3 750 000 = 22 500 000 тг за сезон

На крупной стройке + защитные сетки + мойка колёс +
шумозащитные экраны + закрытие материалов:
~ 2-3 млн тг/мес дополнительных природоохранных
затрат.

В смете идут строкой «природоохранные мероприятия» в
Гл.9 ССР (0.5-2% от ССР). Альтернатива — асфальтовое
покрытие площадки и подъездов (одноразовые 8-12
млн тг, но снимает 80% пыли).

Сравнение за сезон:
• Поливка: 22.5 млн тг (расходуется ежегодно)
• Временное асфальтирование: 10 млн тг + 2 млн тг
  ежегодное обслуживание — окупается за 1.5-2 года.`}
                </pre>
              </div>
            )}
          </div>
        </section>

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">
          СН РК 2.04-03-2002* (Защита от шума). СН РК 2.04-04 (Защита от вибрации).
          Эколог. кодекс РК. КоАП РК ст. 437 (нарушение требований к шуму).
          Постановление акимата г. Алматы № 4-1067 (мойки, сетки, контроль).
          Производители оборудования: Mobydick (мойки), Quivar, Z-bock (экраны).
        </div>
      </main>
    </div>
  );
}
