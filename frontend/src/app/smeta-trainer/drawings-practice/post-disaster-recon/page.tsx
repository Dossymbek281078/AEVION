"use client";

import Link from "next/link";
import { useState } from "react";

export default function PostDisasterReconPage() {
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
    // 250 домов × 12 млн (бенчмарк) = 3 млрд тг базовая стоимость
    // + сейсмостойкость 15% надбавка = 3.45 млрд тг
    const v = parseFloat(ex3);
    if (!isFinite(v)) return setEx3Res("bad");
    setEx3Res(Math.abs(v - 3_450) <= 100 ? "ok" : "bad");
  };
  const checkEx4 = () => setEx4Res(ex4 === "d" ? "ok" : "bad");

  const disasters = [
    {
      name: "Паводки в РК",
      year: "Ежегодно — пик 2024 (массовые)",
      regions: "Северные области (Костанай, Северо-Казахстанская, Акмолинская), Атырау, ЗКО",
      damage: "Десятки тысяч домов затоплены, миллиарды тенге ущерба",
      response: "Эвакуация → инвентаризация ущерба → выплаты по утратам → восстановление",
      who: "ЧС МВД РК + МЧС + акиматы + Самрук-Энерго + банки",
    },
    {
      name: "Землетрясения (потенциал)",
      year: "Последнее крупное Алматы — 1911 (10 баллов)",
      regions: "Алматы 9 б., Талдыкорган 8-9, Шымкент 7-8, Тараз 8",
      damage: "Потенциальный ущерб от 9-балльного — миллиарды $ при катастрофе",
      response: "Спасение → разбор завалов → временное жильё → массовое восстановление",
      who: "ЧС МВД + Армия РК + Международная помощь (Турция, СНГ) + банки",
    },
    {
      name: "Пожары лесных и степных",
      year: "Регулярно — пик 2023 (Костанайская обл.)",
      regions: "Северные и центральные области, лесо-степная зона",
      damage: "Гектары лесов, отдельные посёлки, сельхоз. инфраструктура",
      response: "Тушение → выплаты пострадавшим → восстановление инфраструктуры",
      who: "Лесхоз + ЧС МВД + акиматы",
    },
    {
      name: "Оползни (горные регионы)",
      year: "Ежегодно — Алматы, Талдыкорган, Усть-Камень",
      regions: "Алматинский, Жетысуйский, Жамбылский, ВКО",
      damage: "Локально 5-50 домов, точечные дороги, мосты",
      response: "Эвакуация → расчистка → перевод участка из жилого в др. категорию",
      who: "ЧС МВД + Геологоразведка РК + акиматы",
    },
    {
      name: "Промышленные аварии",
      year: "Спорадически — взрыв на шахте Карагандинского угольного бассейна",
      regions: "Производственные регионы (Караганда, Темиртау, Жезказган)",
      damage: "Локально, но катастрофические потери людей и инфраструктуры",
      response: "Спасение → расследование → ликвидация → восстановление",
      who: "ЧС МВД + Минтруд + специализированные службы + Прокуратура",
    },
    {
      name: "Подтопления городов",
      year: "Регулярно — Алматы (Атакент, Сейфуллина), Шымкент",
      regions: "Городские агломерации с устаревшей ливнёвой канализацией",
      damage: "Подвалы, цоколи, парковки, отдельные дома и магазины",
      response: "Откачка воды → выплаты пострадавшим → модернизация ливневой",
      who: "Акиматы + ЖКХ + страховые компании",
    },
  ];

  const stages = [
    { n: 1, name: "Спасательные работы (Response)", days: "0-3 дня", what: "Эвакуация, поиск пострадавших, мед. помощь", who: "ЧС МВД, СБ ВС РК, волонтёры" },
    { n: 2, name: "Оценка ущерба (Damage Assessment)", days: "3-30 дней", what: "Инвентаризация повреждений, фото-фиксация, акты", who: "Акиматы + СЭС + комиссии оценки ущерба" },
    { n: 3, name: "Временное размещение пострадавших", days: "От 1 мес. до 2 лет", what: "ПВР, гостиницы, временные модульные посёлки", who: "ЧС МВД + МТСЗН + акиматы + ОО Красный Полумесяц" },
    { n: 4, name: "Расчистка территории (Clearing)", days: "1-6 мес.", what: "Демонтаж разрушенного, вывоз мусора, дезинфекция", who: "Подрядчики СМР (часто после конкурса)" },
    { n: 5, name: "Проектирование восстановления", days: "3-12 мес.", what: "Проекты с улучшениями (Build Back Better)", who: "Проектные институты + сметчики + Минстрой" },
    { n: 6, name: "Строительство (Reconstruction)", days: "1-5 лет", what: "Восстановление жилья, инфраструктуры, соц. объектов", who: "Подрядчики, государство, международная помощь" },
    { n: 7, name: "Восстановление экономики", days: "5-15 лет", what: "Восстановление сельхоз., малого бизнеса, занятости", who: "Государство + МСП + НПО + банки развития" },
    { n: 8, name: "Предотвращение повторения (Build Back Better)", days: "Постоянно", what: "Усиление защитных дамб, сейсмостойкости, лесозащиты", who: "Госпрограммы + международные стандарты UN/Sendai" },
  ];

  const features = [
    {
      feat: "Build Back Better (BBB)",
      what: "Концепция ООН: восстанавливать не «как было», а лучше. Усиление, модернизация, защита от повторения",
      cost: "Удорожание +15-30% к простому восстановлению, окупается за следующую катастрофу",
    },
    {
      feat: "Ускоренные тендеры",
      what: "ПП РК «О ЧС» позволяет упрощённые тендеры (10 дней vs 30) и прямые контракты",
      cost: "Снижение прозрачности, риск завышенных цен — нужен пост-аудит",
    },
    {
      feat: "Международная помощь",
      what: "Гранты UNICEF/UNDP/Красный Крест/Турции/RU — обычно для соц. объектов (школы, больницы)",
      cost: "Условия: целевое использование, отчётность в долларах, аудит",
    },
    {
      feat: "Страховые выплаты",
      what: "По полисам имущества (если были). В РК страхование от ЧС необязательно — массовое отсутствие полисов",
      cost: "После 2024 паводков обсуждается обязательное страхование жилья в зонах ЧС",
    },
    {
      feat: "Психологическая поддержка",
      what: "Учёт стресса пострадавших, не торопить с принятием решений о восстановлении",
      cost: "Минимально влияет на смету, но важно для социального аспекта",
    },
    {
      feat: "Документация утрат",
      what: "Без фотофиксации и актов до расчистки — невозможно получить компенсации",
      cost: "Самая важная задача первых 3-7 дней после ЧС",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-sky-300 hover:text-sky-200 transition">
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Послеаварийное восст.</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            🆘 Послеаварийное восстановление
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            Стихийные бедствия и техногенные катастрофы — <strong className="text-red-300">
            тяжелейшее испытание</strong> для строительной отрасли. Паводки 2024 г. в РК
            показали масштаб: пострадало 16 регионов, ~ 7000 семей, ущерб 240+ млрд тг.
            Эффективное восстановление требует особого подхода: ускоренные процедуры,
            упрощённые тендеры, международная координация, концепция Build Back Better
            (восстанавливать лучше, чем было). Регулируется ЗРК «О гражданской защите»
            от 11.04.2014 № 188-V.
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Норматив РК</div>
              <div className="text-slate-300">ЗРК «О гражданской защите» № 188-V</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Паводки 2024</div>
              <div className="text-slate-300">16 регионов, 7000 семей, 240+ млрд тг</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Принцип ООН</div>
              <div className="text-slate-300">Build Back Better — +15-30% затрат</div>
            </div>
          </div>
        </section>

        {/* Section 1: 6 типов ЧС */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            ⚠️ Section 1. Шесть типов ЧС в РК
          </h2>
          <div className="space-y-3">
            {disasters.map((d) => (
              <div key={d.name} className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
                <div className="flex items-baseline justify-between gap-4 mb-2">
                  <h3 className="text-base font-semibold text-red-300">{d.name}</h3>
                  <span className="text-xs text-amber-300 italic shrink-0">{d.year}</span>
                </div>
                <dl className="text-sm space-y-1.5">
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Регионы</dt>
                    <dd className="text-slate-300 text-xs">{d.regions}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Ущерб</dt>
                    <dd className="text-rose-300 text-xs">{d.damage}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Сценарий восстановления</dt>
                    <dd className="text-slate-300 text-xs">{d.response}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Кто отвечает</dt>
                    <dd className="text-slate-400 text-xs italic">{d.who}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Этапы */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🪜 Section 2. Восемь этапов восстановления
          </h2>
          <div className="space-y-3">
            {stages.map((s) => (
              <div key={s.n} className="border border-slate-800 rounded-xl p-4 bg-slate-900/40 flex gap-4">
                <div className="text-3xl font-bold text-red-400 w-12 text-center shrink-0">{s.n}</div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-slate-100 mb-1">{s.name}</h3>
                  <dl className="text-sm grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-1">
                    <div>
                      <dt className="text-slate-500 text-xs uppercase tracking-wider">Срок</dt>
                      <dd className="text-amber-300 text-xs">{s.days}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 text-xs uppercase tracking-wider">Содержание</dt>
                      <dd className="text-slate-300 text-xs">{s.what}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 text-xs uppercase tracking-wider">Кто</dt>
                      <dd className="text-slate-400 text-xs">{s.who}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Особенности смет */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            💎 Section 3. Особенности смет на восстановление
          </h2>
          <div className="space-y-3">
            {features.map((f) => (
              <div key={f.feat} className="border border-red-900/40 bg-red-950/20 rounded-xl p-4">
                <h3 className="text-base font-semibold text-red-300 mb-2">{f.feat}</h3>
                <dl className="text-sm space-y-1">
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Что это</dt>
                    <dd className="text-slate-300 text-xs">{f.what}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Влияние на смету</dt>
                    <dd className="text-amber-300 text-xs">{f.cost}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* Section 4: Источники финансирования */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            💰 Section 4. Источники финансирования восстановления в РК
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="border border-red-800/40 bg-red-950/20 rounded-lg p-4 text-sm">
              <h3 className="font-semibold text-red-300 mb-1">Республиканский бюджет</h3>
              <p className="text-xs text-slate-300">Основной источник — выплаты пострадавшим, восстановление инфраструктуры. Через ЧС МВД РК + Минфин РК. Лимиты по статье «Резерв Президента» — до 200 млрд тг/год.</p>
            </div>
            <div className="border border-red-800/40 bg-red-950/20 rounded-lg p-4 text-sm">
              <h3 className="font-semibold text-red-300 mb-1">Местные бюджеты акиматов</h3>
              <p className="text-xs text-slate-300">Дополнительные средства из областных и районных бюджетов. На локальные ЧС — основной источник. Соц. поддержка пострадавших.</p>
            </div>
            <div className="border border-red-800/40 bg-red-950/20 rounded-lg p-4 text-sm">
              <h3 className="font-semibold text-red-300 mb-1">Фонд Президента</h3>
              <p className="text-xs text-slate-300">Личный фонд Президента РК для оперативных выплат. После паводков 2024 — 50+ млрд тг на восстановление + социальные программы.</p>
            </div>
            <div className="border border-red-800/40 bg-red-950/20 rounded-lg p-4 text-sm">
              <h3 className="font-semibold text-red-300 mb-1">Международная помощь</h3>
              <p className="text-xs text-slate-300">UNICEF, UNDP, UN OCHA, Красный Крест, Турция, РФ, Узбекистан, Япония. Гранты на школы, больницы. Условие — целевое использование, аудит.</p>
            </div>
            <div className="border border-red-800/40 bg-red-950/20 rounded-lg p-4 text-sm">
              <h3 className="font-semibold text-red-300 mb-1">Бизнес-благотворительность</h3>
              <p className="text-xs text-slate-300">«Бирлесейик», «Қазақстан халкына». В 2024 г. от бизнеса собрали 12+ млрд тг. Кашаган, Тенгиз, BI Group, КаспийБанк и др.</p>
            </div>
            <div className="border border-red-800/40 bg-red-950/20 rounded-lg p-4 text-sm">
              <h3 className="font-semibold text-red-300 mb-1">Льготные кредиты</h3>
              <p className="text-xs text-slate-300">Жилстройсбербанк, КИК, БВУ — рефинансирование под 0-5% для пострадавших, отсрочка платежей до 24 мес.</p>
            </div>
          </div>
        </section>

        {/* Упражнения */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Section 5. Упражнения</h2>

          {/* Упр.1 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 1 / 4 — Первые дни после ЧС
            </div>
            <div className="text-slate-200 mb-4">
              После сильного паводка в селе подтоплено 200 домов. Что должны сделать
              <strong> в первые 3-7 дней</strong> ответственные за смету и восстановление?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Сразу начать строительство новых домов" },
                { v: "b", t: "Подождать, пока сойдёт вода — это не наша работа" },
                { v: "c", t: "Сначала: фото/видео-фиксация всех повреждений, составление актов с подписями пострадавших, инвентаризация утрат. Без этой документации — невозможно получить компенсации" },
                { v: "d", t: "Только заполнить таблицу Excel" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex1 === opt.v ? "border-red-600 bg-red-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex1" value={opt.v} checked={ex1 === opt.v} onChange={() => setEx1(opt.v)} className="accent-red-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx1} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx1Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex1Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex1Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — документация утрат</span>}
              {ex1Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-red-300">Решение:</strong> Документация — самая
                критичная задача первой недели. Без неё:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Невозможно получить компенсации пострадавшим</li>
                  <li>Невозможно требовать страховые выплаты</li>
                  <li>Невозможно подать заявку на международную помощь</li>
                  <li>Невозможно обосновать бюджет восстановления перед Парламентом</li>
                </ul>
                Минимальный пакет документации:
                <ol className="list-decimal list-inside mt-2 space-y-1 text-xs">
                  <li>Фото каждого пострадавшего дома (внутри и снаружи) с привязкой к
                  GPS и адресу</li>
                  <li>Акт оценки повреждений с подписями: пострадавший + представитель
                  акимата + представитель ЧС МВД</li>
                  <li>Список утраченного имущества (с примерной оценкой)</li>
                  <li>Свидетельские показания (если возможно)</li>
                  <li>Видео-обход территории с комментариями</li>
                </ol>
                В 2024 г. в РК создан Единый реестр пострадавших (через egov.kz) — пострадавшие
                подают заявку с прикреплением фотографий и документов. Сметчики и акиматы
                проверяют и подтверждают.
              </div>
            )}
          </div>

          {/* Упр.2 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Принцип Build Back Better
            </div>
            <div className="text-slate-200 mb-4">
              ООН рекомендует при восстановлении после ЧС применять принцип
              <strong> Build Back Better (BBB)</strong>. Что это означает для смет?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Восстанавливать дешевле, чем было — экономия бюджета" },
                { v: "b", t: "Восстанавливать с улучшениями: повышение сейсмостойкости, защита от повторения, модернизация инфраструктуры. Удорожание +15-30%, но окупается за следующую катастрофу" },
                { v: "c", t: "Восстанавливать любыми материалами, лишь бы быстро" },
                { v: "d", t: "Только новые модульные дома" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex2 === opt.v ? "border-red-600 bg-red-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex2" value={opt.v} checked={ex2 === opt.v} onChange={() => setEx2(opt.v)} className="accent-red-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx2} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx2Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex2Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex2Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — +15-30% с улучшениями</span>}
              {ex2Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-red-300">Решение:</strong> Build Back Better — это
                принцип ООН (Sendai Framework 2015-2030), основанный на статистике:
                восстановленные с улучшениями объекты в 4-5 раз лучше переносят следующие
                катастрофы. Удорожание окупается за одну предотвращённую катастрофу.
                <br /><br />
                Примеры BBB в РК после паводков 2024:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Восстанавливаемые дома — на цокольном этаже из бетона (вместо
                  саманного), с приподнятым полом 50-80 см</li>
                  <li>Системы защиты — дамбы на 30 см выше расчётной отметки</li>
                  <li>Ливневая канализация увеличенного диаметра</li>
                  <li>Эвакуационные пути обозначены на жилых улицах</li>
                  <li>В сейсмически активных районах — антисейсмические пояса по всем
                  стенам, не только наружным</li>
                </ul>
                Удорожание 15-30% означает, что вместо 12 млн тг за дом эконом —
                14-16 млн тг. На больших масштабах (3000 домов) это +6-12 млрд тг
                к бюджету, но за следующий паводок будет сохранено в 5-10 раз больше.
              </div>
            )}
          </div>

          {/* Упр.3 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — Бюджет программы восстановления
            </div>
            <div className="text-slate-200 mb-4">
              После паводка в области пострадало <strong>250 жилых домов</strong>.
              Бенчмарк восстановления — <strong>12 млн тг/дом</strong> (как обычный
              сельский дом эконом-класса). Применяется концепция <strong>Build Back
              Better</strong> — улучшения 15% (антисейсмические пояса + защита от
              паводков). Какой <strong>общий бюджет</strong> программы в <strong>МЛН тг</strong>?
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Бюджет, млн тг</span>
              <input value={ex3} onChange={(e) => setEx3(e.target.value)} type="number" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="3450" />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx3} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx3Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex3Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex3Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 3.45 млрд тг</span>}
              {ex3Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Перепроверь</span>}
            </div>
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-red-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Базовая стоимость = 250 × 12 = 3 000 млн тг

С BBB +15%: 3 000 × 1.15 = 3 450 млн тг = 3.45 млрд тг

Источники финансирования (типовая структура):
• Респ. бюджет: 60% = 2 070 млн тг
• Областной/районный бюджеты: 15% = 517 млн тг
• Фонд Президента: 10% = 345 млн тг
• Международная помощь: 8% = 276 млн тг
• Бизнес-благотворительность: 5% = 173 млн тг
• Льготные кредиты пострадавшим: 2% = 69 млн тг

Срок реализации программы:
• Расчистка + проектирование: 6-12 мес.
• Строительство 250 домов: 12-18 мес.
• Полное закрытие программы: 18-30 мес.

В сравнении с реальными РК-программами:
• Паводки 2024 — пострадало ~ 7000 семей
  Бюджет восстановления: 100+ млрд тг
• Бенчмарк подтверждается на масштабе

ВАЖНО: эта сумма — только восстановление жилья. Полная
программа включает: инфраструктуру (дороги, мосты, ВК),
соц. объекты (школы, больницы), компенсации за утраченное
имущество. Общий бюджет может в 2-3 раза превышать чисто
жильё.`}
                </pre>
              </div>
            )}
          </div>

          {/* Упр.4 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — Упрощённые тендеры при ЧС
            </div>
            <div className="text-slate-200 mb-4">
              При объявлении режима ЧС в РК применяются <strong>упрощённые процедуры</strong>
              госзакупок. Какие <strong>главные риски</strong> для сметчика и аудита?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Никаких рисков — главное быстро восстановить" },
                { v: "b", t: "Только риск завышенных цен на материалы" },
                { v: "c", t: "Только риск низкого качества" },
                { v: "d", t: "Комплекс рисков: завышенные цены (нет конкуренции), низкое качество (нет строгого отбора), коррупция (прямые контракты), несоответствие BBB (восстановление 'как было'). Контр-меры: пост-аудит, фотофиксация работ, ИНДО (Независимый Надзор Общественный)" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex4 === opt.v ? "border-red-600 bg-red-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex4" value={opt.v} checked={ex4 === opt.v} onChange={() => setEx4(opt.v)} className="accent-red-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx4} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx4Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex4Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex4Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — комплекс рисков</span>}
              {ex4Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex4Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-red-300">Решение:</strong> Упрощённые процедуры
                госзакупок при ЧС — палка о двух концах. С одной стороны, ускорение
                восстановления (10 дней vs 30 на тендер). С другой — серьёзные риски:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li><strong>Завышение цен</strong> — без конкуренции подрядчики
                  завышают на 20-50%. Пример: после паводков 2024 цены на стройматериалы
                  в пострадавших регионах выросли на 30-80%</li>
                  <li><strong>Низкое качество</strong> — нет времени на проверку
                  подрядчиков, привлекаются случайные ТОО без репутации</li>
                  <li><strong>Коррупция</strong> — прямые контракты привлекают
                  «нужных» исполнителей. Расследования AnticorRK 2024 — 30+ дел по
                  паводковому восстановлению</li>
                  <li><strong>Несоответствие BBB</strong> — спешка приводит к
                  восстановлению «как было», без улучшений</li>
                </ul>
                Контр-меры (международная практика и опыт РК):
                <ol className="list-decimal list-inside mt-2 space-y-1 text-xs">
                  <li><strong>Пост-аудит</strong> Счётным комитетом РК через 6-12 мес.</li>
                  <li><strong>Фотофиксация</strong> каждого этапа работ для последующей
                  проверки</li>
                  <li><strong>Независимый общественный надзор</strong> (НПО, журналисты,
                  волонтёры)</li>
                  <li><strong>Публичная отчётность</strong> через egov.kz по каждому
                  объекту</li>
                  <li><strong>Уголовные дела</strong> за хищения и завышения
                  (ст. 189 УК РК «Хищение» + ст. 366 «Получение взятки»)</li>
                </ol>
                Это создаёт нишу для независимых сметчиков-аудиторов после ЧС —
                востребованная и высокооплачиваемая работа (1-3 млн тг/мес).
              </div>
            )}
          </div>
        </section>

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">
          ЗРК «О гражданской защите» от 11.04.2014 № 188-V. Sendai Framework for Disaster
          Risk Reduction 2015-2030 (UN). Принцип Build Back Better (BBB). UN OCHA, UNICEF,
          UNDP — международные источники помощи. В РК: ЧС МВД РК (emer.gov.kz),
          МТСЗН РК (выплаты), egov.kz (единый реестр пострадавших), Фонд Президента,
          «Бирлесейик» и «Қазақстан халкына» (бизнес-благотворительность).
        </div>
      </main>
    </div>
  );
}
