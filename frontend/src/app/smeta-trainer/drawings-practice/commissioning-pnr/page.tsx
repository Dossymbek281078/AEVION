"use client";

import Link from "next/link";
import { useState } from "react";

export default function CommissioningPnrPage() {
  const [ex1, setEx1] = useState<string | null>(null);
  const [ex1Res, setEx1Res] = useState<null | "ok" | "bad">(null);
  const [ex1Sol, setEx1Sol] = useState(false);
  const [ex2, setEx2] = useState<string | null>(null);
  const [ex2Res, setEx2Res] = useState<null | "ok" | "bad">(null);
  const [ex2Sol, setEx2Sol] = useState(false);
  const [ex3, setEx3] = useState("");
  const [ex3Res, setEx3Res] = useState<null | "ok" | "bad">(null);
  const [ex3Sol, setEx3Sol] = useState(false);
  const [ex4, setEx4] = useState<string | null>(null);
  const [ex4Res, setEx4Res] = useState<null | "ok" | "bad">(null);
  const [ex4Sol, setEx4Sol] = useState(false);

  const checkEx1 = () => setEx1Res(ex1 === "b" ? "ok" : "bad");
  const checkEx2 = () => setEx2Res(ex2 === "c" ? "ok" : "bad");
  const checkEx3 = () => {
    // 500 000 000 × 7% = 35 000 000 тг
    const v = parseFloat(ex3);
    if (!isFinite(v)) return setEx3Res("bad");
    setEx3Res(Math.abs(v - 35_000_000) <= 1_000_000 ? "ok" : "bad");
  };
  const checkEx4 = () => setEx4Res(ex4 === "d" ? "ok" : "bad");

  const stages = [
    { n: 1, name: "Предмонтажная проверка", what: "Входной контроль оборудования: комплектность, маркировка, внешний осмотр, проверка сопроводительной документации", who: "Монтажная организация + заказчик", norm: "ГОСТ 24444-87 + ЭСН Сб. 36-41" },
    { n: 2, name: "Монтаж оборудования", what: "Установка на фундамент, центровка, выравнивание, крепление. Входит в ЭСН Сб. 36-41", who: "Монтажная организация", norm: "ЭСН Сб. 36-41, технические условия (ТУ) завода" },
    { n: 3, name: "Индивидуальные испытания", what: "Испытание каждой единицы оборудования отдельно: насосы, вентиляторы, двигатели. Проверка работоспособности, вибраций, шума", who: "Монтажная орг. + пуско-наладчики", norm: "СНиП 3.05.06 (электроустановки), СНиП 3.05.07 (ОВ)" },
    { n: 4, name: "Комплексное опробование (70 часов)", what: "Одновременная работа всего технологического комплекса. Выявление взаимных влияний, некорректных настроек, утечек", who: "Пуско-наладочная организация", norm: "ЭСН Сб. 4 часть 1 (ПНР), требование СНиП/СН 3.05.01-85" },
    { n: 5, name: "Режимная наладка", what: "Настройка рабочих режимов под реальные нагрузки. Регулировка клапанов, балансировка сетей, программирование контроллеров", who: "Специализированные наладочники", norm: "Инструкции заводов + типовые программы ПНР" },
    { n: 6, name: "Испытания и замеры", what: "Протоколы испытаний: температура, давление, расход, вибрации, КПД. Сравнение с проектными показателями", who: "Пуско-наладочная орг. + независимая лаборатория", norm: "ГОСТ + ТУ производителя + проект" },
    { n: 7, name: "Обучение персонала", what: "Обучение эксплуатационного персонала работе на оборудовании, ТО и аварийным действиям", who: "Завод-изготовитель или пуско-наладочная орг.", norm: "Требование контракта на поставку" },
    { n: 8, name: "Подписание акта о вводе в эксплуатацию", what: "Сдача комплекса заказчику с полным пакетом исполнительной документации, паспортов, протоколов испытаний", who: "Все участники", norm: "ПП РК № 353 + СНиП РК и ТКП" },
  ];

  const esn_rates = [
    { code: "ЭСН Сб. 4 ч.1", name: "Электротехнические установки", pnr_pct: "5-8%", note: "Электрощиты, трансформаторы, кабель" },
    { code: "ЭСН Сб. 4 ч.2", name: "Системы автоматизации и диспетчеризации", pnr_pct: "15-25%", note: "АСУТП, контроллеры, датчики" },
    { code: "ЭСН Сб. 36-38", name: "Насосное и вентиляционное оборудование", pnr_pct: "6-10%", note: "Центровка, балансировка, режимы" },
    { code: "ЭСН Сб. 39-40", name: "Теплоэнергетическое оборудование", pnr_pct: "8-12%", note: "Котлы, ИТП, горелки" },
    { code: "ЭСН Сб. 41", name: "Технологическое оборудование", pnr_pct: "4-8%", note: "Производственные линии, станки" },
    { code: "ЭСН Сб. 42", name: "Гидротехническое оборудование", pnr_pct: "10-15%", note: "Турбины, насосные агрегаты ГЭС" },
    { code: "ЭСН Сб. 33-35", name: "Электромонтажные (ВЛ, КЛ, подстанции)", pnr_pct: "3-5%", note: "Наладка релейной защиты, автоматики" },
    { code: "Комплексная АСУТП", name: "Интегрированные системы управления", pnr_pct: "20-40%", note: "Для нефтехимии, металлургии" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-sky-300 hover:text-sky-200 transition">← К разделам</Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · ПНР</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🔌 Пуско-наладочные работы (ПНР)</h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            <strong className="text-yellow-300">ПНР — пуско-наладочные работы</strong> — финальный этап строительства перед сдачей объекта. Без ПНР оборудование смонтировано, но не работает. В смете ПНР составляют <strong>4-25% от стоимости оборудования</strong> в зависимости от сложности. Регулируется ЭСН Сб. 4 (ч.1 и ч.2), СНиП 3.05.01-85 «Внутренние санит.-техн. системы», СНиП 3.05.06 «Электроустановки».
          </p>
          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Доля ПНР в смете</div>
              <div className="text-slate-300">4-25% от стоимости оборудования</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Норматив</div>
              <div className="text-slate-300">ЭСН Сб. 4 (ч.1 и ч.2), СНиП 3.05</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Опробование</div>
              <div className="text-slate-300">70 часов непрерывной работы (норма)</div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">🪜 Section 1. Восемь этапов ПНР</h2>
          <div className="space-y-3">
            {stages.map((s) => (
              <div key={s.n} className="border border-slate-800 rounded-xl p-4 bg-slate-900/40 flex gap-4">
                <div className="text-3xl font-bold text-yellow-400 w-12 text-center shrink-0">{s.n}</div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-slate-100 mb-1">{s.name}</h3>
                  <dl className="text-sm grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-1">
                    <div><dt className="text-slate-500 text-xs uppercase tracking-wider">Что</dt><dd className="text-slate-300 text-xs">{s.what}</dd></div>
                    <div><dt className="text-slate-500 text-xs uppercase tracking-wider">Кто</dt><dd className="text-amber-300 text-xs">{s.who}</dd></div>
                    <div><dt className="text-slate-500 text-xs uppercase tracking-wider">Норматив</dt><dd className="text-slate-400 text-xs italic">{s.norm}</dd></div>
                  </dl>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">📊 Section 2. Доля ПНР по сборникам ЭСН</h2>
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 w-36">Сборник ЭСН</th>
                  <th className="text-left px-4 py-3">Вид работ</th>
                  <th className="text-left px-4 py-3 w-32">% ПНР от оборуд.</th>
                  <th className="text-left px-4 py-3">Комментарий</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {esn_rates.map((r) => (
                  <tr key={r.code} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 font-mono text-yellow-300 text-xs">{r.code}</td>
                    <td className="px-4 py-3 text-slate-100 text-xs">{r.name}</td>
                    <td className="px-4 py-3 text-emerald-300 text-xs font-mono">{r.pnr_pct}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Section 3. Упражнения</h2>

          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Упражнение 1 / 4 — Когда ПНР начинается</div>
            <div className="text-slate-200 mb-4">В каком порядке выполняются ПНР по отношению к монтажу?</div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "До монтажа — сначала пуско-наладка, потом монтаж" },
                { v: "b", t: "После монтажа, до подписания акта ввода. Последовательность: монтаж → индивидуальные испытания → комплексное опробование 70 ч → режимная наладка → ввод в эксплуатацию" },
                { v: "c", t: "Параллельно с монтажом" },
                { v: "d", t: "После ввода в эксплуатацию (через год)" },
              ].map((opt) => (
                <label key={opt.v} className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${ex1 === opt.v ? "border-yellow-600 bg-yellow-950/30" : "border-slate-800 hover:border-slate-700"}`}>
                  <input type="radio" name="ex1" value={opt.v} checked={ex1 === opt.v} onChange={() => setEx1(opt.v)} className="accent-yellow-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx1} className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx1Sol(v => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">{ex1Sol ? "Скрыть" : "Показать решение"}</button>
              {ex1Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно</span>}
              {ex1Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-yellow-300">Решение:</strong> ПНР всегда после монтажа. Схема: монтаж → предмонтажная проверка → индивидуальные испытания (каждый агрегат) → комплексное опробование 70 ч (всё вместе) → режимная наладка → сдача. Без ПНР объект не примут в ГосЭкспертизе — нет протоколов испытаний.
              </div>
            )}
          </div>

          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Упражнение 2 / 4 — АСУТП</div>
            <div className="text-slate-200 mb-4">Для нефтехимического завода смонтирована АСУТП (автоматизированная система управления). Какой процент ПНР от стоимости оборудования?</div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "3-5% — минимум" },
                { v: "b", t: "8-12% — стандарт" },
                { v: "c", t: "20-40% — для комплексных АСУТП, поскольку программирование, интеграция и проверка логики занимают до 40% от стоимости оборудования" },
                { v: "d", t: "1% — дешевле монтажа" },
              ].map((opt) => (
                <label key={opt.v} className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${ex2 === opt.v ? "border-yellow-600 bg-yellow-950/30" : "border-slate-800 hover:border-slate-700"}`}>
                  <input type="radio" name="ex2" value={opt.v} checked={ex2 === opt.v} onChange={() => setEx2(opt.v)} className="accent-yellow-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx2} className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx2Sol(v => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">{ex2Sol ? "Скрыть" : "Показать решение"}</button>
              {ex2Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно</span>}
              {ex2Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-yellow-300">Решение:</strong> АСУТП — самый трудоёмкий вид ПНР. Программирование ПЛК, настройка HMI, тестирование алгоритмов аварийной защиты, интеграция со смежными системами — это квалифицированный труд специалистов. По ЭСН Сб. 4 ч.2 ПНР = 20-40% от стоимости АСУТП-оборудования. Для нефтегаза, химии, энергетики — всегда верхняя граница.
              </div>
            )}
          </div>

          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Упражнение 3 / 4 — Расчёт стоимости ПНР</div>
            <div className="text-slate-200 mb-4">
              Стоимость оборудования по смете — <strong>500 000 000 тг</strong>. Средняя ставка ПНР — <strong>7%</strong> от стоимости оборудования. Какова стоимость ПНР?
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Стоимость ПНР, тг</span>
              <input value={ex3} onChange={e => setEx3(e.target.value)} type="number" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="35000000" />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx3} className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx3Sol(v => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">{ex3Sol ? "Скрыть" : "Показать решение"}</button>
              {ex3Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 35 млн тг</span>}
              {ex3Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Перепроверь</span>}
            </div>
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-yellow-300">Решение:</strong>
                <pre className="mt-2 text-xs font-mono text-slate-300">
{`ПНР = Стоим_оборуд × % / 100
    = 500 000 000 × 7%
    = 35 000 000 тг

В ССР это Глава 5 «Пусконаладочные работы».
При заполнении ССР по СН РК 8.02-05 ПНР выделяются
отдельной строкой. Включают НР 8% + СП 8%.`}
                </pre>
              </div>
            )}
          </div>

          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Упражнение 4 / 4 — Ответственность за ПНР</div>
            <div className="text-slate-200 mb-4">Кто несёт ответственность за качество ПНР и гарантию на настроенные системы?</div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Завод-изготовитель оборудования" },
                { v: "b", t: "Монтажная организация" },
                { v: "c", t: "Генеральный подрядчик" },
                { v: "d", t: "Пуско-наладочная организация несёт ответственность за качество настройки и работоспособность в режимах, определённых проектом. Гарантия ПНР — 1-2 года по ГК РК ст. 723. Если оборудование сломалось из-за неверной настройки — ответственность ПНО. Если из-за брака оборудования — завода." },
              ].map((opt) => (
                <label key={opt.v} className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${ex4 === opt.v ? "border-yellow-600 bg-yellow-950/30" : "border-slate-800 hover:border-slate-700"}`}>
                  <input type="radio" name="ex4" value={opt.v} checked={ex4 === opt.v} onChange={() => setEx4(opt.v)} className="accent-yellow-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx4} className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx4Sol(v => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">{ex4Sol ? "Скрыть" : "Показать решение"}</button>
              {ex4Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно</span>}
              {ex4Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex4Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-yellow-300">Решение:</strong> Ответственность разделена: ПНО отвечает за настройки (что запрограммировали), завод — за само оборудование. При аварии проводят расследование — ошибка настройки или дефект. ПНО должна предоставить протоколы испытаний, подтверждающие корректность режимов.
              </div>
            )}
          </div>
        </section>

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">ЭСН Сб. 4 (ч.1 и ч.2). СНиП 3.05.01-85 (Санит.-техн. системы). СНиП 3.05.06 (Электроустановки). СНиП 3.05.07 (ОВ системы). ГОСТ 24444-87 (Входной контроль). СН РК 8.02-05 (ССР — Глава 5 ПНР).</div>
      </main>
    </div>
  );
}
