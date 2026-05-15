"use client";

import Link from "next/link";
import { useState } from "react";

export default function TechConnectionPage() {
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

  const checkEx1 = () => setEx1Res(ex1 === "c" ? "ok" : "bad");
  const checkEx2 = () => setEx2Res(ex2 === "b" ? "ok" : "bad");
  const checkEx3 = () => {
    // 500 кВт нагрузка, тариф ТП электр. ~ 30 000 тг/кВт (Алматы 2025)
    // 500 × 30 000 = 15 000 000 тг
    const v = parseFloat(ex3);
    if (!isFinite(v)) return setEx3Res("bad");
    setEx3Res(Math.abs(v - 15_000_000) <= 1_000_000 ? "ok" : "bad");
  };
  const checkEx4 = () => setEx4Res(ex4 === "d" ? "ok" : "bad");

  const networks = [
    {
      net: "Электроснабжение",
      org: "АлматыЭнергоСбыт (Алматы), KEGOC (магистраль), региональные РЭС",
      tu_term: "30 рабочих дней (для &lt; 10 кВт) до 3 мес (мощные объекты)",
      cost: "Плата за ТП: 15-50 тыс. тг/кВт нагрузки + работы",
      stages: "Заявка → ТУ → проект ЭС → согласование РЭС → монтаж → испытания → акт ТП",
    },
    {
      net: "Водоснабжение",
      org: "КазВодоКанал, Алматы Су, МВК районные",
      tu_term: "20 рабочих дней",
      cost: "Плата за ТП: 20-100 тыс. тг/м³/сутки потребления",
      stages: "Заявка → ТУ → проект ВК → согласование ВК → монтаж → промывка/дезинф. → акт ТП",
    },
    {
      net: "Канализация (бытовая)",
      org: "Городские и районные КСК/канализационные организации",
      tu_term: "20 рабочих дней",
      cost: "Плата за ТП: 10-50 тыс. тг/м³/сутки сброса",
      stages: "Заявка → ТУ → проект К → монтаж → телеинспекция трубы → акт ТП",
    },
    {
      net: "Газоснабжение",
      org: "ҚазТрансГаз Аймақ (региональные дистрибьюторы), КазГазСервис",
      tu_term: "30 рабочих дней",
      cost: "Плата за ТП: 30-100 тыс. тг/м³/час расхода",
      stages: "Заявка → ТУ → проект ГС → согласование КТА → монтаж → испытание давлением → акт ТП",
    },
    {
      net: "Теплоснабжение",
      org: "АлматыТеплоКоммунЭнерго, СамрукЭнерго, муниц. ТЭЦ",
      tu_term: "20 рабочих дней",
      cost: "Плата за ТП: 50-200 тыс. тг/Гкал/час нагрузки + ИТП",
      stages: "Заявка → ТУ → проект ОВ/ИТП → согласование ТСО → монтаж → промывка/наладка ИТП → акт ТП",
    },
    {
      net: "Телекоммуникации (интернет/телефон)",
      org: "Казахтелеком, Beeline, Tele2, Kcell",
      tu_term: "5-10 рабочих дней",
      cost: "Оптоволокно: 3-10 млн тг за прокладку кабеля до здания",
      stages: "Заявка → ТУ → прокладка ВОЛС → разварка → тест → активация",
    },
  ];

  const documents = [
    { doc: "Заявка на выдачу ТУ", content: "Форма организации-поставщика сети, указывается нагрузка / расход, адрес, назначение объекта" },
    { doc: "Технические условия (ТУ)", content: "Выдаются сетевой организацией. Содержат: точку подключения, допустимую нагрузку, диаметр/мощность подключения, требования к проекту" },
    { doc: "Проект технологического присоединения", content: "Разрабатывает проектная организация на основе ТУ. Согласовывается с сетевой организацией. Входит в состав рабочего проекта" },
    { doc: "Договор ТП с сетевой организацией", content: "Фиксирует плату за ТП, сроки выполнения работ, условия разграничения ответственности (балансовая принадлежность)" },
    { doc: "Разграничительный акт", content: "Определяет, до какой точки ответственна сетевая организация, а дальше — потребитель. Часто это счётчик или вводной автомат" },
    { doc: "Акт технологического присоединения (акт ТП)", content: "Финальный документ. Подписывается после проверки монтажа, испытаний, наличия всех согласований" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-sky-300 hover:text-sky-200 transition">← К разделам</Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Технологическое присоединение</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">⚡ Технологическое присоединение к сетям</h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            <strong className="text-sky-300">Технологическое присоединение (ТП)</strong> — подключение объекта к инженерным сетям (электр., вода, газ, тепло, канализация). Без ТП объект не введут в эксплуатацию. В смете ТП выделяется в отдельные позиции — <strong>Глава 6 ССР</strong> «Наружные сети и сооружения». Плата за ТП может составлять <strong>5-30%</strong> от ССР на крупных объектах. Регулируется ЗРК «Об электроэнергетике» + отраслевые правила каждого вида сети.
          </p>
          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">В ССР</div>
              <div className="text-slate-300">Глава 4 (наружные сети) + Глава 6 (ТП)</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Плата за ТП</div>
              <div className="text-slate-300">5-30% от ССР на крупных объектах</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">ТУ получать</div>
              <div className="text-slate-300">До начала проектирования</div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">🔌 Section 1. Шесть видов сетей и порядок ТП</h2>
          <div className="space-y-3">
            {networks.map((n) => (
              <div key={n.net} className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
                <h3 className="text-base font-semibold text-sky-300 mb-2">{n.net}</h3>
                <dl className="text-sm grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                  <div><dt className="text-slate-500 text-xs uppercase tracking-wider">Организация РК</dt><dd className="text-slate-300 text-xs">{n.org}</dd></div>
                  <div><dt className="text-slate-500 text-xs uppercase tracking-wider">Срок выдачи ТУ</dt><dd className="text-amber-300 text-xs">{n.tu_term}</dd></div>
                  <div><dt className="text-slate-500 text-xs uppercase tracking-wider">Плата за ТП</dt><dd className="text-emerald-300 text-xs">{n.cost}</dd></div>
                  <div><dt className="text-slate-500 text-xs uppercase tracking-wider">Этапы</dt><dd className="text-slate-400 text-xs">{n.stages}</dd></div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">📄 Section 2. Пакет документов ТП</h2>
          <div className="space-y-3">
            {documents.map((d, i) => (
              <div key={d.doc} className="border border-sky-800/40 bg-sky-950/20 rounded-xl p-4 flex gap-4">
                <div className="text-2xl font-bold text-sky-400 w-10 text-center shrink-0">{i + 1}</div>
                <div>
                  <h3 className="text-base font-semibold text-slate-100 mb-1">{d.doc}</h3>
                  <p className="text-sm text-slate-300">{d.content}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Section 3. Упражнения</h2>

          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Упражнение 1 / 4 — Когда получать ТУ</div>
            <div className="text-slate-200 mb-4">На какой стадии проекта нужно получить Технические условия на подключение?</div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "После завершения строительства" },
                { v: "b", t: "После начала монтажа" },
                { v: "c", t: "До начала проектирования — ТУ определяют точки подключения, допустимые нагрузки, диаметры. Без ТУ проектировщик не может разработать наружные сети" },
                { v: "d", t: "При сдаче объекта" },
              ].map((opt) => (
                <label key={opt.v} className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${ex1 === opt.v ? "border-sky-600 bg-sky-950/30" : "border-slate-800 hover:border-slate-700"}`}>
                  <input type="radio" name="ex1" value={opt.v} checked={ex1 === opt.v} onChange={() => setEx1(opt.v)} className="accent-sky-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx1} className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx1Sol(v => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">{ex1Sol ? "Скрыть" : "Показать решение"}</button>
              {ex1Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно</span>}
              {ex1Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-sky-300">Решение:</strong> ТУ — первый документ для проектировщика. Без них нельзя проектировать: неизвестно от какой точки тянуть трубу, какого диаметра, с каким давлением. Сначала ТУ → потом АГПЗ → потом рабочий проект. На практике ТУ получают параллельно с ГПЗУ (градостроительным планом участка).
              </div>
            )}
          </div>

          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Упражнение 2 / 4 — ТП в ССР</div>
            <div className="text-slate-200 mb-4">В какую Главу ССР включается плата за технологическое присоединение к электрическим сетям?</div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Глава 2 — основные объекты строительства" },
                { v: "b", t: "Глава 4 — объекты энергетического хозяйства (наружные электр. сети) + Глава 6 (само подключение). По СН РК 8.02-05 плата за ТП — в Главе 6 «Наружные сети и сооружения вне площадки»" },
                { v: "c", t: "Глава 12 — ПИР" },
                { v: "d", t: "Вне ССР" },
              ].map((opt) => (
                <label key={opt.v} className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${ex2 === opt.v ? "border-sky-600 bg-sky-950/30" : "border-slate-800 hover:border-slate-700"}`}>
                  <input type="radio" name="ex2" value={opt.v} checked={ex2 === opt.v} onChange={() => setEx2(opt.v)} className="accent-sky-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx2} className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx2Sol(v => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">{ex2Sol ? "Скрыть" : "Показать решение"}</button>
              {ex2Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно</span>}
              {ex2Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-sky-300">Решение:</strong> В ССР ТП разбивается:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Глава 4 — работы по прокладке кабеля от ТП до здания (если за счёт заказчика)</li>
                  <li>Глава 6 — собственно плата за технологическое присоединение (взнос в сетевую организацию)</li>
                  <li>Если сетевая организация сама тянет кабель — это включено в плату ТП</li>
                  <li>Иногда Глава 5 — если затрагивает объекты транспорта (пересечение дорог)</li>
                </ul>
                Сметчик должен чётко разграничивать: что входит в плату ТП (сетевая организация работает) и что делает подрядчик заказчика (ЛСР по ЭСН).
              </div>
            )}
          </div>

          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Упражнение 3 / 4 — Плата за ТП электроснабжения</div>
            <div className="text-slate-200 mb-4">
              Торговый центр запрашивает мощность <strong>500 кВт</strong>. Тариф платы за ТП в Алматы — <strong>30 000 тг/кВт</strong>. Какова плата за технологическое присоединение?
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Плата за ТП, тг</span>
              <input value={ex3} onChange={e => setEx3(e.target.value)} type="number" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="15000000" />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx3} className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx3Sol(v => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">{ex3Sol ? "Скрыть" : "Показать решение"}</button>
              {ex3Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 15 млн тг</span>}
              {ex3Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Перепроверь</span>}
            </div>
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-sky-300">Решение:</strong>
                <pre className="mt-2 text-xs font-mono text-slate-300">
{`Плата = Мощность × Тариф
     = 500 кВт × 30 000 тг/кВт
     = 15 000 000 тг = 15 млн тг

Дополнительно к плате за ТП:
• Прокладка кабеля от ПС до здания (если &gt; 100 м): +5-20 млн тг
• Трансформаторная подстанция (если &gt; 300 кВт): +15-50 млн тг
• Ввод в здание + ГРЩ: +3-8 млн тг

Итого подключение 500 кВт Алматы: 25-50 млн тг полная стоимость.
Это типичная статья, которую забывают в смете на начальной стадии.`}
                </pre>
              </div>
            )}
          </div>

          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Упражнение 4 / 4 — Все ТУ одновременно?</div>
            <div className="text-slate-200 mb-4">Для жилого комплекса нужны ТУ на: электр., воду, канализацию, газ и тепло. Можно ли получить их параллельно?</div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Нет — только последовательно" },
                { v: "b", t: "Только электр. и вода параллельно" },
                { v: "c", t: "Все параллельно, но первое — электр." },
                { v: "d", t: "Да — все ТУ можно получать параллельно (независимые организации). Рекомендуется подавать все заявки одновременно с самого начала, чтобы не ждать по очереди. Критический путь — самое долгое ТУ определит общий срок получения пакета" },
              ].map((opt) => (
                <label key={opt.v} className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${ex4 === opt.v ? "border-sky-600 bg-sky-950/30" : "border-slate-800 hover:border-slate-700"}`}>
                  <input type="radio" name="ex4" value={opt.v} checked={ex4 === opt.v} onChange={() => setEx4(opt.v)} className="accent-sky-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx4} className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx4Sol(v => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">{ex4Sol ? "Скрыть" : "Показать решение"}</button>
              {ex4Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — все параллельно</span>}
              {ex4Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex4Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-sky-300">Решение:</strong> Все ТУ получаются независимо от разных организаций — никаких ограничений на параллельность нет. Грамотный менеджер проекта/сметчик подаёт все заявки в День 1. Сроки: газ — 30 дней, электр. — 30, вода — 20, тепло — 20. Критический путь = 30 дней (газ и электр.). Если делать последовательно: 30+30+20+20+20 = 120 дней лишнего ожидания. На практике задержки ТУ — одна из главных причин срыва сроков проектирования в РК.
              </div>
            )}
          </div>
        </section>

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">ЗРК «Об электроэнергетике» от 09.07.2004 № 588-II. ЗРК «О газе и газоснабжении». ЗРК «О водных ресурсах». СН РК 8.02-05 (ССР — Глава 4, 6). АлматыЭнергоСбыт — alme.kz. КазТрансГаз — kaztransgas.kz. Алматы Су — almatyvodokanal.kz.</div>
      </main>
    </div>
  );
}
