"use client";

import Link from "next/link";
import { useState } from "react";

export default function CadastreCommissioningPage() {
  // Упр.1 — кто подписывает акт ввода
  const [ex1, setEx1] = useState<string | null>(null);
  const [ex1Res, setEx1Res] = useState<null | "ok" | "bad">(null);
  const [ex1Sol, setEx1Sol] = useState(false);

  // Упр.2 — срок регистрации
  const [ex2, setEx2] = useState<string | null>(null);
  const [ex2Res, setEx2Res] = useState<null | "ok" | "bad">(null);
  const [ex2Sol, setEx2Sol] = useState(false);

  // Упр.3 — стоимость технического обследования
  const [ex3S, setEx3S] = useState("");
  const [ex3Res, setEx3Res] = useState<null | "ok" | "bad">(null);
  const [ex3Sol, setEx3Sol] = useState(false);

  // Упр.4 — последствия эксплуатации без акта ввода
  const [ex4, setEx4] = useState<string | null>(null);
  const [ex4Res, setEx4Res] = useState<null | "ok" | "bad">(null);
  const [ex4Sol, setEx4Sol] = useState(false);

  const checkEx1 = () => setEx1Res(ex1 === "c" ? "ok" : "bad");
  const checkEx2 = () => setEx2Res(ex2 === "b" ? "ok" : "bad");
  const checkEx3 = () => {
    // 800 м² × 500 тг = 400 000 тг (тариф 400-600 тг/м² по средним)
    const s = parseFloat(ex3S);
    if (!isFinite(s)) return setEx3Res("bad");
    setEx3Res(Math.abs(s - 400_000) <= 50_000 ? "ok" : "bad");
  };
  const checkEx4 = () => setEx4Res(ex4 === "d" ? "ok" : "bad");

  const stages = [
    { n: 1, name: "Уведомление об окончании СМР", who: "Подрядчик → Заказчик", doc: "Извещение в свободной форме + комплект исп. документации (АОСР, КС-6, протоколы)", days: "5-10 раб. дней" },
    { n: 2, name: "Внутренняя приёмка Заказчиком", who: "Заказчик + Тех. надзор + Авт. надзор", doc: "Акт внутр. приёмки, перечень дефектов (если есть)", days: "10-15 дней" },
    { n: 3, name: "Устранение замечаний", who: "Подрядчик", doc: "Журнал устранения, повторная приёмка по каждому пункту", days: "по объёму, обычно 10-30 дней" },
    { n: 4, name: "Заявление в МИО (акимат)", who: "Заказчик", doc: "Заявление + проект (АР, КЖ, ОВ, ВК, ЭО) + АОСР + протоколы лаб.", days: "10 раб. дней (по ПП РК №353)" },
    { n: 5, name: "Гос. приёмочная комиссия", who: "Акимат — МИО, Госархстройинспекция, СЭС, МЧС, балансодержатель сетей", doc: "Акт приёмки в эксплуатацию + Заключение ГосЭкспертизы (если требуется)", days: "30 раб. дней" },
    { n: 6, name: "Регистрация в кадастре (НКА)", who: "Заказчик в ГУ «Центр недвижимости»", doc: "Акт ввода + техпаспорт + правоустанавливающие документы", days: "5 раб. дней через ЦОН / 1 раб. день онлайн через egov.kz" },
    { n: 7, name: "Передача на баланс", who: "Заказчик → Эксплуатационная организация", doc: "Акт приёма-передачи ф. ОС-1, паспорта оборудования, гарантии", days: "после регистрации, 5-10 дней" },
  ];

  const docs = [
    { name: "Акт ввода объекта в эксплуатацию (ф.КС-14)", purpose: "Основной документ — подтверждает завершение и качество строительства", issuer: "Государственная приёмочная комиссия (МИО)", note: "По ПП РК №353 от 06.05.2008 (с изменениями 2023)" },
    { name: "Технический паспорт объекта", purpose: "Описание здания: этажность, S, V, мат-лы, инж. сети", issuer: "Центр обслуживания недвижимости РК (БТИ)", note: "Стоимость: 0.5 МРП за м² (≈ 300-500 тг/м² в 2025)" },
    { name: "Кадастровое дело", purpose: "Регистрация прав в Госкадастре недвижимости", issuer: "ГУ «Центр недвижимости» / e-gov", note: "Тариф: 0.5-3 МРП в зависимости от типа объекта" },
    { name: "Свидетельство о праве собственности", purpose: "Юридическое подтверждение прав", issuer: "Минюст РК", note: "Регистрируется через ЦОН или egov.kz, 1-5 раб. дней" },
    { name: "Заключение ГосАрхСтройКонтроля", purpose: "Подтверждение соблюдения СНиП и проекта", issuer: "Госархстройконтроль (ранее — ГАСК)", note: "Обязательно для соц. объектов и зданий > 3 этажей" },
    { name: "Заключение СЭС РК", purpose: "Санитарно-эпидемиологическое соответствие", issuer: "Комитет КН РК", note: "Для соц. объектов, общепита, мед. учреждений" },
    { name: "Заключение МЧС (пожнадзор)", purpose: "Пожарная безопасность по СН РК 2.02-05", issuer: "Комитет ЧС МВД РК", note: "АПС, СОУЭ, ВПВ, пути эвакуации — обязательно" },
    { name: "Акты подключения к сетям", purpose: "Технологическое присоединение", issuer: "Балансодержатели сетей (КЕГОК, Алсеко, Тенгизсу, КазТрансГаз и т.д.)", note: "Тех. условия + Акт ТП = разрешение на эксплуатацию" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-sky-300 hover:text-sky-200 transition">
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Ввод в эксплуатацию</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            🏛️ Ввод в эксплуатацию + кадастр РК
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            Объект юридически считается построенным <strong className="text-fuchsia-300">только после
            подписания Акта ввода в эксплуатацию</strong> и регистрации в Госкадастре. Без этого нельзя
            продать, заложить, прописаться, подключить коммуналку или сдать на баланс. Регулируется
            ЗРК «Об архитектурной, градостроительной и строительной деятельности» от 16.07.2001 № 242
            и <span className="text-sky-300 font-medium">ПП РК № 353 от 06.05.2008</span>{" "}
            «Правила ввода объектов в эксплуатацию» (актуализация 2023 г.).
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Основной норматив</div>
              <div className="text-slate-300">ПП РК № 353 + ЗРК «О гос. кадастре»</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Уполномоч. орган</div>
              <div className="text-slate-300">МИО (акимат) + НКА (Центр недвижимости)</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Срок ввода</div>
              <div className="text-slate-300">~2-4 мес. после окончания СМР</div>
            </div>
          </div>
        </section>

        {/* Section 1: Этапы */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            📋 Section 1. Семь этапов ввода в эксплуатацию
          </h2>
          <div className="space-y-3">
            {stages.map((s) => (
              <div key={s.n} className="border border-slate-800 rounded-xl p-4 bg-slate-900/40 flex gap-4">
                <div className="text-3xl font-bold text-fuchsia-400 w-12 text-center shrink-0">{s.n}</div>
                <div className="flex-1">
                  <div className="flex items-baseline justify-between gap-4 mb-2">
                    <h3 className="text-base font-semibold text-slate-100">{s.name}</h3>
                    <span className="text-xs text-amber-300 italic shrink-0">{s.days}</span>
                  </div>
                  <div className="text-sm text-slate-300 mb-1">
                    <span className="text-slate-500 text-xs uppercase tracking-wider mr-2">Кто:</span>
                    {s.who}
                  </div>
                  <div className="text-sm text-slate-400 text-xs">
                    <span className="text-slate-500 text-xs uppercase tracking-wider mr-2">Документ:</span>
                    {s.doc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Документы */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            📄 Section 2. Восемь обязательных документов
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {docs.map((d) => (
              <div key={d.name} className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
                <h3 className="text-base font-semibold text-fuchsia-300 mb-2">{d.name}</h3>
                <dl className="text-sm space-y-2">
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Зачем</dt>
                    <dd className="text-slate-300">{d.purpose}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Кто выдаёт</dt>
                    <dd className="text-slate-300 text-xs">{d.issuer}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Особенности</dt>
                    <dd className="text-slate-400 text-xs italic">{d.note}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Регистрация в кадастре */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🗺 Section 3. Регистрация в Госкадастре (НКА)
          </h2>
          <p className="text-slate-400 text-sm max-w-4xl">
            Национальный кадастровый адрес (НКА) — уникальный идентификатор объекта недвижимости в РК.
            Регистрация ведётся через ГУ «Центр недвижимости» (бывший БТИ) при Минюсте. Современный
            способ — портал <span className="text-sky-300">egov.kz</span> или мобильное приложение,
            срок 1 рабочий день при наличии полного пакета.
          </p>

          <div className="border border-fuchsia-800/60 bg-fuchsia-950/30 rounded-xl p-5">
            <h3 className="text-fuchsia-300 font-semibold mb-3">Пакет документов для НКА</h3>
            <ul className="text-sm text-slate-300 space-y-1 list-decimal list-inside">
              <li>Акт ввода в эксплуатацию (форма КС-14, заверенная МИО)</li>
              <li>Технический паспорт объекта (свежий, не старше 6 месяцев)</li>
              <li>Правоустанавливающие документы (договор купли-продажи земли / аренды)</li>
              <li>Удостоверение личности / Доверенность с нотар. заверением</li>
              <li>Квитанция об оплате гос. пошлины (0.5-3 МРП по типу объекта)</li>
              <li>Согласие супруга/совладельцев (если применимо)</li>
            </ul>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Жилой дом</div>
              <div className="text-slate-300">Пошлина 0.5 МРП ≈ 1 850 тг (2025)</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Квартира МКД</div>
              <div className="text-slate-300">Пошлина 1.5 МРП ≈ 5 550 тг (2025)</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Коммерческий объект</div>
              <div className="text-slate-300">Пошлина 3 МРП ≈ 11 100 тг + плата за обмер</div>
            </div>
          </div>
        </section>

        {/* Упражнения */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Section 4. Упражнения</h2>

          {/* Упр.1 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 1 / 4 — Кто подписывает Акт ввода
            </div>
            <div className="text-slate-200 mb-4">
              Многоквартирный жилой дом (100 квартир, 9 этажей) построен в Алматы. Кто из
              перечисленных <strong>не входит</strong> в обязательный состав Государственной
              приёмочной комиссии для подписания Акта ввода?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Представитель акимата (МИО)" },
                { v: "b", t: "Госархстройконтроль" },
                { v: "c", t: "Представитель банка-кредитора (БВУ)" },
                { v: "d", t: "Представитель ЧС МВД (пожнадзор)" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex1 === opt.v ? "border-fuchsia-600 bg-fuchsia-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex1" value={opt.v} checked={ex1 === opt.v} onChange={() => setEx1(opt.v)} className="accent-fuchsia-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx1} className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx1Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex1Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex1Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — банк не входит</span>}
              {ex1Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-fuchsia-300">Решение:</strong> Состав ГПК по ПП РК №353
                включает: представитель МИО (председатель), Госархстройконтроль, СЭС, ЧС МВД
                (пожнадзор), балансодержатели сетей (электр., тепло, вода, газ, связь),
                Заказчик и Подрядчик. Банк не входит, даже если кредитовал строительство —
                банковские требования регулируются ипотечным договором отдельно. Банк может
                запросить копию подписанного Акта для своего архива.
              </div>
            )}
          </div>

          {/* Упр.2 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Срок регистрации в кадастре
            </div>
            <div className="text-slate-200 mb-4">
              Через какой срок после подписания Акта ввода Заказчик <strong>обязан</strong>
              зарегистрировать объект в Госкадастре, чтобы избежать штрафов и проблем с правом
              собственности?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "3 рабочих дня" },
                { v: "b", t: "10 рабочих дней (стандартный срок по ЗРК «О гос. рег.»)" },
                { v: "c", t: "30 календарных дней" },
                { v: "d", t: "6 месяцев" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex2 === opt.v ? "border-fuchsia-600 bg-fuchsia-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex2" value={opt.v} checked={ex2 === opt.v} onChange={() => setEx2(opt.v)} className="accent-fuchsia-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx2} className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx2Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex2Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex2Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 10 раб. дней</span>}
              {ex2Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-fuchsia-300">Решение:</strong> По ЗРК «О государственной
                регистрации прав на недвижимое имущество» от 26.07.2007 № 310 (ст. 9) срок подачи
                заявления — 10 рабочих дней с момента подписания Акта ввода. Сама регистрация
                занимает 1 рабочий день через egov.kz или 5 раб. дней через ЦОН. Просрочка
                влечёт админ. штраф 5 МРП для физлиц, 20 МРП для юрлиц (КоАП РК ст. 461).
                Также невозможны сделки купли-продажи, ипотеки, наследования.
              </div>
            )}
          </div>

          {/* Упр.3 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — Стоимость технического обследования
            </div>
            <div className="text-slate-200 mb-4">
              Коммерческий объект S = <strong>800 м²</strong> вводится в эксплуатацию. Для
              получения техпаспорта НКА требуется обмер. Средний тариф Центра недвижимости —
              <strong> 500 тг/м²</strong> (≈ 0.13 МРП/м²). Какая стоимость обмера в тенге?
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Стоимость обмера, тг</span>
              <input value={ex3S} onChange={(e) => setEx3S(e.target.value)} type="number" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="400000" />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx3} className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx3Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex3Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex3Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 400 000 тг</span>}
              {ex3Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Перепроверь S × тариф</span>}
            </div>
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-fuchsia-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Стоимость = S × тариф
800 м² × 500 тг/м² = 400 000 тг

+ Гос. пошлина за регистрацию НКА: 3 МРП ≈ 11 100 тг
+ Заверение копий, нотариус: ~ 10 000 тг
ИТОГО ввод по линии кадастра: ~ 420 000 тг

Доля в смете: 420 000 / (800 м² × 200 тыс. тг/м²)
            = 420 000 / 160 000 000
            ≈ 0.26% от стоимости объекта

В смете строкой «затраты на ввод в эксплуатацию»
обычно закладывают 0.3-0.5% от ССР.`}
                </pre>
              </div>
            )}
          </div>

          {/* Упр.4 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — Эксплуатация без Акта ввода
            </div>
            <div className="text-slate-200 mb-4">
              Заказчик начал эксплуатацию торгового центра (продажа товаров покупателям) <strong>до
              подписания Акта ввода в эксплуатацию</strong>. Какие последствия наступают?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Никаких — главное, что объект построен" },
                { v: "b", t: "Только устное предупреждение от акимата" },
                { v: "c", t: "Штраф 100 МРП и предписание остановить деятельность" },
                { v: "d", t: "Админ. штраф 100-300 МРП юрлицу + запрет эксплуатации + риск принудит. сноса (КоАП РК ст. 318)" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex4 === opt.v ? "border-fuchsia-600 bg-fuchsia-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex4" value={opt.v} checked={ex4 === opt.v} onChange={() => setEx4(opt.v)} className="accent-fuchsia-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx4} className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx4Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex4Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex4Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — полный комплекс</span>}
              {ex4Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно — последствия серьёзнее</span>}
            </div>
            {ex4Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-fuchsia-300">Решение:</strong> Эксплуатация объекта без
                Акта ввода — ст. 318 КоАП РК. Юрлицу штраф 100-300 МРП (1.85-5.55 млн тг в 2025),
                плюс предписание Госархстройконтроля об остановке деятельности до устранения.
                В исключительных случаях (нарушение градостроительных норм или СНиП по пожарной
                безопасности) — иск МИО о принудительном сносе самовольной постройки (ст. 244 ГК
                РК). Реальные примеры: 2023 г. — снос ТЦ «Артём» в Алматы, 2024 г. — снос
                торговых рядов «Восток» в Шымкенте. Также: невозможно подключение к сетям
                (АлмаЭнергоСбыт откажет), невозможна аренда (договор будет ничтожным).
              </div>
            )}
          </div>
        </section>

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">
          ПП РК № 353 от 06.05.2008 (Правила ввода). ЗРК «Об архит., град. и стр. деятельности»
          от 16.07.2001 № 242. ЗРК «О гос. регистрации прав» от 26.07.2007 № 310. КоАП РК
          ст. 318, 461. egov.kz — портал гос. услуг. Центр недвижимости НКА — gov.kz/memleket/entities/nka.
        </div>
      </main>
    </div>
  );
}
