"use client";

import Link from "next/link";
import { useState } from "react";

export default function SafetyIncidentsPage() {
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
    // 250 чел × 12 мес × 30 тыс. (ср. ОТ) × 0.02 (2%) = 1.8 млн тг страховой взнос за год
    // Упрощённо для упражнения: 250 чел × 360 000 тг × 2% = 1 800 000 тг
    const v = parseFloat(ex3);
    if (!isFinite(v)) return setEx3Res("bad");
    setEx3Res(Math.abs(v - 1_800_000) <= 50_000 ? "ok" : "bad");
  };
  const checkEx4 = () => setEx4Res(ex4 === "a" ? "ok" : "bad");

  const categories = [
    {
      name: "Лёгкий несчастный случай",
      what: "Травма с временной утратой трудоспособности до 60 дней",
      doc: "Акт Н-1 (форма утв. Приказом МТСЗН РК № 1108)",
      time: "Расследование 3 дня",
      who: "Комиссия предприятия (специалист ОТ + представитель работников + руководитель)",
    },
    {
      name: "Тяжёлый несчастный случай",
      what: "Травма свыше 60 дней, инвалидность",
      doc: "Акт Н-1 + Акт о расследовании (свободная форма + протокол)",
      time: "Расследование 15 дней",
      who: "Комиссия с участием Гос. инспекции труда (МТСЗН РК) — обязательно",
    },
    {
      name: "Групповой несчастный случай",
      what: "Пострадало ≥ 2 работников одновременно",
      doc: "Акт Н-1 на каждого + общий протокол расследования",
      time: "Расследование 15 дней",
      who: "Комиссия с Гос. инспекцией + ЧС МВД + СЭС (при необходимости)",
    },
    {
      name: "Смертельный несчастный случай",
      what: "Травма привела к гибели работника",
      doc: "Акт Н-1 + протокол + прокурорская проверка по ст. 152 УК РК",
      time: "Расследование 15 дней + уголовное дело",
      who: "Гос. инспекция + Прокуратура + следственный комитет + ЧС МВД",
    },
  ];

  const causes = [
    { cat: "Технические", examples: "Неисправность оборудования, отсутствие ограждений, неисправность СИЗ", share: "~ 25%" },
    { cat: "Организационные", examples: "Отсутствие инструктажа, нарушение технологии, отсутствие наряда-допуска", share: "~ 45%" },
    { cat: "Личностные", examples: "Алкоголь/наркотики, усталость, спешка, игнорирование требований", share: "~ 20%" },
    { cat: "Внешние / погодные", examples: "Ветер, гололёд, грозы, неустойчивая почва, оползень", share: "~ 10%" },
  ];

  const steps = [
    { n: 1, name: "Оказание первой помощи + вызов скорой", time: "Немедленно", responsible: "Любой работник + прораб + специалист ОТ" },
    { n: 2, name: "Сохранение обстановки до прихода комиссии", time: "До конца смены", responsible: "Прораб (огородить, не убирать)" },
    { n: 3, name: "Уведомление руководства + Гос. инспекции труда (если тяжёлый)", time: "В течение часа (тяжёлый), сутки (лёгкий)", responsible: "Директор предприятия" },
    { n: 4, name: "Создание комиссии по расследованию", time: "В течение 24 часов", responsible: "Приказ директора" },
    { n: 5, name: "Сбор доказательств: фото, свидетели, документы", time: "1-3 дня", responsible: "Комиссия" },
    { n: 6, name: "Опрос пострадавшего и свидетелей", time: "В первые дни", responsible: "Комиссия + юрист" },
    { n: 7, name: "Составление Акта Н-1 (по форме)", time: "До 3 дней (лёгкий) / 15 дней (тяжёлый)", responsible: "Комиссия" },
    { n: 8, name: "Передача в гос. фонд социального страхования", time: "5 раб. дней", responsible: "Бухгалтерия + специалист ОТ" },
    { n: 9, name: "Возмещение ущерба пострадавшему", time: "По решению комиссии + страх. выплаты ГФСС", responsible: "Работодатель + ГФСС" },
    { n: 10, name: "Меры по предотвращению повторения", time: "Постоянно", responsible: "Специалист ОТ + Главный инженер" },
  ];

  const liability = [
    { type: "Административная (ст. 187 КоАП РК)", who: "Юридическое лицо (предприятие)", penalty: "100-3000 МРП штраф (1.85-55.5 млн тг в 2025)" },
    { type: "Административная (ст. 187 КоАП РК)", who: "Должностное лицо (прораб, гл. инженер)", penalty: "20-200 МРП штраф (370 тыс. - 3.7 млн тг)" },
    { type: "Уголовная (ст. 152 УК РК)", who: "Лицо, ответственное за безопасность", penalty: "Штраф до 5000 МРП / исправительные работы / лишение свободы до 5 лет (при смерти — до 10 лет)" },
    { type: "Гражданская (ст. 932-952 ГК РК)", who: "Работодатель", penalty: "Возмещение материального ущерба + морального вреда (1-10 млн тг по практике РК)" },
    { type: "Страховая (ОПС МТСЗН РК)", who: "Гос. фонд социального страхования", penalty: "Выплаты пострадавшему: единовр. (от 10 МРП) + ежемес. (% утраты трудоспособности)" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-sky-300 hover:text-sky-200 transition">
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Несчастные случаи</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            🚑 Несчастные случаи и расследование
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            Стройка — <strong className="text-red-300">одна из самых опасных отраслей</strong>:
            по статистике МТСЗН РК, на строительство приходится 30-40% всех тяжёлых
            несчастных случаев в РК. Грамотное оформление и расследование защищают как
            работника (страховые выплаты), так и работодателя (минимизация ответственности
            при правильном документировании). Регулируется Трудовым кодексом РК (ст. 322-326),
            Приказом МТСЗН РК № 1108 (Акт Н-1) и УК РК (ст. 152).
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Норматив</div>
              <div className="text-slate-300">ТК РК ст. 322-326 + Приказ МТСЗН № 1108</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Обязательное ОПС</div>
              <div className="text-slate-300">Тариф 1-3% от ФОТ (в зав. от риска)</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Штраф юрлицу</div>
              <div className="text-slate-300">До 3000 МРП (~55 млн тг в 2025)</div>
            </div>
          </div>
        </section>

        {/* Section 1: Категории */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🔴 Section 1. Четыре категории несчастных случаев
          </h2>
          <div className="space-y-3">
            {categories.map((c) => (
              <div key={c.name} className="border border-rose-900/40 bg-rose-950/20 rounded-xl p-4">
                <h3 className="text-base font-semibold text-rose-300 mb-2">{c.name}</h3>
                <dl className="text-sm grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Определение</dt>
                    <dd className="text-slate-300 text-xs">{c.what}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Документация</dt>
                    <dd className="text-slate-300 text-xs">{c.doc}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Срок расследования</dt>
                    <dd className="text-amber-300 text-xs">{c.time}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Состав комиссии</dt>
                    <dd className="text-slate-400 text-xs">{c.who}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Причины */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            📊 Section 2. Структура причин (по статистике МТСЗН РК)
          </h2>
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Категория</th>
                  <th className="text-left px-4 py-3">Примеры</th>
                  <th className="text-left px-4 py-3 w-32">Доля</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {causes.map((c) => (
                  <tr key={c.cat} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 text-slate-100">{c.cat}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{c.examples}</td>
                    <td className="px-4 py-3 text-amber-300 font-mono">{c.share}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-amber-950/30 border border-amber-800/60 rounded-lg p-4 text-sm text-amber-200">
            <strong>Парадокс:</strong> технические причины — лишь 25%, тогда как 70% — это
            человеческий фактор (организационные + личностные). Поэтому фокус на инструктажах,
            нарядах-допусках и проверке СИЗ даёт больше пользы, чем покупка новой техники.
          </div>
        </section>

        {/* Section 3: 10 шагов */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            📋 Section 3. Десять шагов оформления Н-1
          </h2>
          <div className="space-y-3">
            {steps.map((s) => (
              <div key={s.n} className="border border-slate-800 rounded-xl p-4 bg-slate-900/40 flex gap-4">
                <div className="text-3xl font-bold text-red-400 w-12 text-center shrink-0">{s.n}</div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-slate-100 mb-1">{s.name}</h3>
                  <div className="flex gap-4 text-xs">
                    <span className="text-amber-300">⏱ {s.time}</span>
                    <span className="text-slate-400">→ {s.responsible}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 4: Ответственность */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            ⚖️ Section 4. Виды ответственности
          </h2>
          <div className="space-y-3">
            {liability.map((l) => (
              <div key={l.type + l.who} className="border border-rose-800/60 bg-rose-950/30 rounded-xl p-4">
                <h3 className="text-base font-semibold text-rose-300 mb-2">{l.type}</h3>
                <dl className="text-sm grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Кто</dt>
                    <dd className="text-slate-300 text-xs">{l.who}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Санкции</dt>
                    <dd className="text-amber-300 text-xs">{l.penalty}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* Упражнения */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Section 5. Упражнения</h2>

          {/* Упр.1 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 1 / 4 — Срок расследования тяжёлого НС
            </div>
            <div className="text-slate-200 mb-4">
              На стройке произошёл тяжёлый несчастный случай (рабочий упал с высоты,
              сложный перелом, инвалидность). В какой срок должно быть завершено
              расследование с составлением Акта Н-1 по ТК РК?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "3 дня — общий срок для всех НС" },
                { v: "b", t: "7 дней" },
                { v: "c", t: "15 дней (для тяжёлых, групповых и смертельных)" },
                { v: "d", t: "30 дней — на личное усмотрение комиссии" },
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
              {ex1Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 15 дней</span>}
              {ex1Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-red-300">Решение:</strong> ТК РК ст. 325 и Приказ
                МТСЗН РК № 1108 устанавливают: <strong>3 дня</strong> для лёгких НС
                (комиссия предприятия) и <strong>15 дней</strong> для тяжёлых, групповых
                и смертельных (комиссия с участием Гос. инспекции труда). При особо
                сложных обстоятельствах срок может быть продлён до 1 месяца главным
                гос. инспектором труда области. На время расследования работа на участке
                может быть остановлена по требованию инспекции. Несвоевременное
                расследование — отдельное нарушение, штраф 20-200 МРП должностному лицу.
              </div>
            )}
          </div>

          {/* Упр.2 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Основная причина по статистике
            </div>
            <div className="text-slate-200 mb-4">
              Главная категория причин несчастных случаев в строительстве РК по статистике
              МТСЗН — что нужно усиливать в первую очередь?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Технические — закупать новую технику и СИЗ" },
                { v: "b", t: "Организационные (~ 45%) — инструктажи, наряды-допуски, контроль" },
                { v: "c", t: "Личностные — алкоголь и усталость" },
                { v: "d", t: "Внешние — погода и геология" },
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
              {ex2Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — организационные ~45%</span>}
              {ex2Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-red-300">Решение:</strong> Организационные причины
                дают ~ 45% всех НС, что означает: лучшие инвестиции в безопасность — это
                <strong> система ОТ</strong>, а не дорогая техника. Конкретно:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Регулярные инструктажи (вводный, на рабочем месте, повторный 1 раз/3 мес)</li>
                  <li>Наряд-допуск на работы повышенной опасности (высота, газоопасные, замкнутые объёмы)</li>
                  <li>Проверка знаний ОТ ежегодно (для прорабов и ИТР)</li>
                  <li>Журналы регистрации инструктажей с подписями</li>
                  <li>Стенды и плакаты по технике безопасности на стройплощадке</li>
                  <li>Внутренние проверки специалистом ОТ (минимум 1 раз/нед)</li>
                </ul>
                Стоимость хорошей системы ОТ — 0.5-1.5% от ФОТ. Стоимость одного тяжёлого
                НС — 5-15 млн тг штрафов + 1-10 млн моральный вред + потеря репутации.
                Окупаемость инвестиций в ОТ — 5-15× за год.
              </div>
            )}
          </div>

          {/* Упр.3 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — Тариф ОПС
            </div>
            <div className="text-slate-200 mb-4">
              Подрядчик имеет <strong>250 рабочих</strong>. Средняя зарплата —
              <strong> 30 000 тг/мес</strong>. ОПС (обязательное профессиональное страхование
              от несчастных случаев) для строительства — <strong>2%</strong> от ФОТ. Какой
              годовой страховой взнос в Гос. фонд социального страхования? (Годовой расчёт.)
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Взнос за год, тг</span>
              <input value={ex3} onChange={(e) => setEx3(e.target.value)} type="number" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="1800000" />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx3} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx3Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex3Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex3Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 1.8 млн тг</span>}
              {ex3Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Перепроверь</span>}
            </div>
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-red-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Взнос = Кол-во рабочих × ОТ × Мес × Тариф
      = 250 × 30 000 × 12 × 2%
      = 250 × 30 000 × 12 × 0.02
      = 250 × 360 000 × 0.02
      = 90 000 000 × 0.02
      = 1 800 000 тг/год

Тарифы ОПС в РК (Закон РК «Об обязательном страховании
работника от НС при исполнении ими трудовых обязанностей»):
  • Класс риска 1 (офисы) — 0.18%
  • Класс риска 8 (легкая промышленность) — 0.42%
  • Класс риска 15 (строительство, дороги) — 1.50-2.10%
  • Класс риска 20 (подземные, высотные) — 2.50-3.00%
  • Класс риска 25 (горно-добывающая) — 3.50-4.10%

Строительство по классификатору — обычно класс 15-18 →
тариф 1.5-2.5%. При систематических нарушениях работодателя
страховщик может повысить тариф (бонус-малус как в КАСКО).

Выплаты пострадавшим:
• Лёгкий НС — единовр. 10 МРП (~ 37 000 тг в 2025)
• Тяжёлый НС — единовр. 100 МРП + ежемес. 30-60% от ОТ
• Смерть — единовр. 1000 МРП семье + ежемес. иждивенцам`}
                </pre>
              </div>
            )}
          </div>

          {/* Упр.4 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — Уголовная ответственность
            </div>
            <div className="text-slate-200 mb-4">
              Произошёл смертельный несчастный случай — упала балка из-за нарушения
              технологии монтажа, погиб монтажник. Расследование показало: прораб не
              провёл инструктаж и не выдал наряд-допуск на высотные работы. По какой
              статье УК РК прораб может быть привлечён к уголовной ответственности?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Ст. 152 УК РК «Нарушение правил охраны труда» — до 10 лет лишения свободы при смерти" },
                { v: "b", t: "Ст. 273 УК РК «Заведомо ложное сообщение» — штраф" },
                { v: "c", t: "Ст. 99 УК РК «Убийство» — до 15 лет" },
                { v: "d", t: "Только дисциплинарное взыскание" },
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
              {ex4Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — ст. 152 УК РК</span>}
              {ex4Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex4Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-red-300">Решение:</strong> Ст. 152 УК РК «Нарушение
                правил охраны и безопасности труда» предусматривает:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Ч.1 — Нарушение без последствий: штраф до 1000 МРП или испр. работы</li>
                  <li>Ч.2 — С причинением вреда здоровью: штраф 1000-3000 МРП / огранич. свободы до 3 лет / лишение свободы до 3 лет</li>
                  <li><strong>Ч.3 — Со смертью человека:</strong> лишение свободы <strong>до 5 лет</strong> с лишением права занимать определённые должности до 3 лет</li>
                  <li>Ч.4 — Со смертью 2 и более человек: лишение свободы <strong>до 10 лет</strong></li>
                </ul>
                <strong>На практике РК:</strong> при смертельном НС прокуратура почти всегда
                возбуждает дело по ст. 152 УК РК. Прораб и/или главный инженер привлекаются
                как обвиняемые. Юрлицо платит штраф по КоАП РК ст. 187 (до 3000 МРП) и
                возмещает ущерб семье погибшего (1-5 млн тг компенсации морального вреда +
                ежемесячные выплаты иждивенцам).
                <br /><br />
                <strong>Защита</strong>: должным образом оформленные журналы инструктажей и
                наряды-допуски доказывают, что работодатель сделал всё необходимое, и могут
                быть смягчающим обстоятельством или основанием для оправдания.
              </div>
            )}
          </div>
        </section>

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">
          Трудовой кодекс РК (Кодекс РК от 23.11.2015 № 414-V), особенно ст. 322-326.
          Приказ МТСЗН РК № 1108 от 17.11.2015 (Форма Н-1). Закон РК «Об обязательном
          страховании работника от НС». УК РК ст. 152, 273. КоАП РК ст. 187. Государственная
          инспекция труда — МТСЗН РК, enbek.gov.kz.
        </div>
      </main>
    </div>
  );
}
