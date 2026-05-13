"use client";

import Link from "next/link";
import { useState } from "react";

export default function CareerPathwayPage() {
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
    // 450 000 × 12 × 0.10 = 540 000 тг пенсионных за год
    const v = parseFloat(ex3);
    if (!isFinite(v)) return setEx3Res("bad");
    setEx3Res(Math.abs(v - 540_000) <= 5_000 ? "ok" : "bad");
  };
  const checkEx4 = () => setEx4Res(ex4 === "d" ? "ok" : "bad");

  const levels = [
    {
      level: "Младший сметчик (Junior)",
      experience: "0-2 года",
      tasks: "ВОР по чертежам, помощь старшим, базовые расчёты простых работ",
      salary: "200-350 тыс. тг/мес (Алматы 2025)",
      growth: "Изучить АВС-4 / Смета РК, освоить ЭСН РК, понимать СНиП РК",
      time: "1-3 года до Сметчика",
    },
    {
      level: "Сметчик (Middle)",
      experience: "2-5 лет",
      tasks: "Самостоятельная разработка ЛСР, проверка ВОР субподряда, индексация",
      salary: "350-550 тыс. тг/мес",
      growth: "Овладеть FIDIC, BIM 5D, EVMS, soft skills (переговоры)",
      time: "3-5 лет до Старшего",
    },
    {
      level: "Старший сметчик (Senior)",
      experience: "5-10 лет",
      tasks: "Главные ЛСР сложных объектов, тендеры, защита смет в экспертизе",
      salary: "500-850 тыс. тг/мес",
      growth: "BIM-координация, ведение портфеля 5-10 объектов, наставничество",
      time: "2-4 года до Главного",
    },
    {
      level: "Главный сметчик (Chief / Lead)",
      experience: "10+ лет",
      tasks: "ССР объектов, бюджет компании, тендерная стратегия, переговоры с банками",
      salary: "800-1500 тыс. тг/мес + бонусы 10-30%",
      growth: "Управление отделом, открытие своего бюро",
      time: "Топ карьеры — далее либо консалтинг, либо менеджмент проектов",
    },
    {
      level: "Независимый эксперт / Консультант",
      experience: "15+ лет",
      tasks: "Эспертизы для судов, аудит смет, FIDIC-контракты, обучение",
      salary: "1500-5000 тыс. тг/мес (ставка 50-150 тыс. тг/день)",
      growth: "Аккредитация в Госорганах, авторство стандартов, публикации",
      time: "Финальная карьерная цель — высшая профессиональная категория",
    },
    {
      level: "Директор / Партнёр",
      experience: "Менеджерская траектория",
      tasks: "Управление компанией, развитие бизнеса, стратегия",
      salary: "1500-5000+ тыс. тг/мес + доля в бизнесе",
      growth: "От сметы — к управлению строительной компанией",
      time: "Альтернативная траектория к экспертизе",
    },
  ];

  const cert = [
    {
      name: "Профстандарт «Сметчик» МТСЗН РК",
      cost: "Бесплатно (государственный)",
      what: "Удостоверение об уровне квалификации (3-5 разряд)",
      where: "Региональные центры подтверждения квалификации",
      use: "Базовый документ для трудоустройства",
    },
    {
      name: "Удостоверение СМР МИИР РК",
      cost: "Через работодателя — обязательная для допуска",
      what: "Допуск к работам, удостоверение Безопасность стройки",
      where: "Центры обучения по охране труда",
      use: "Обязательное для работы на стройке",
    },
    {
      name: "Аккредитация ГосЭкспертиза РК",
      cost: "200-500 тыс. тг + экзамены",
      what: "Эксперт по проверке смет",
      where: "Министерство индустрии РК",
      use: "Право работать в Госэкспертизе",
    },
    {
      name: "RICS (Royal Institution of Chartered Surveyors)",
      cost: "$1500-3000 + членский взнос $500/год",
      what: "Международный сертификат Quantity Surveyor — премиум-уровень",
      where: "Онлайн через rics.org + экзамены в Лондоне/Дубае",
      use: "FIDIC-контракты, ЕБРР/МБРР/АБР проекты в РК",
    },
    {
      name: "PMP (Project Management Professional)",
      cost: "$555 + подготовка курсов 100-300 тыс. тг",
      what: "Управление проектами по PMBOK",
      where: "PMI.org, аккредит. центры в Алматы",
      use: "Для перехода с сметы в управление проектами",
    },
    {
      name: "AACE Certified Cost Professional (CCP)",
      cost: "$450 + членство $300/год",
      what: "Cost Engineering — международный стандарт",
      where: "AACE International (aacei.org)",
      use: "Для работы на нефтегазовых, инфраструктурных проектах",
    },
  ];

  const courses = [
    { name: "АВС-4 / Смета РК", duration: "1-2 нед", cost: "30-80 тыс. тг", where: "kazsoft.kz, avs-4.kz" },
    { name: "ЭСН РК + индексирование", duration: "1 мес", cost: "100-200 тыс. тг", where: "Центры повышения квалификации МИИР" },
    { name: "Revit / ArchiCAD для сметчика (BIM)", duration: "2-3 мес", cost: "150-300 тыс. тг", where: "Архитект.клуб, BIM Cluster Kazakhstan" },
    { name: "FIDIC / EVMS / Claims", duration: "3-6 мес", cost: "300-800 тыс. тг", where: "ВУЗы (АЛУ, Нархоз, СБ КАЗГУ)" },
    { name: "Soft skills + переговоры", duration: "1-2 мес", cost: "100-250 тыс. тг", where: "AlmaU, Школа НПП «Атамекен»" },
    { name: "Английский для FIDIC", duration: "6-12 мес", cost: "150-500 тыс. тг", where: "EnglishFirst, OnlineEnglish.kz, репетитор" },
    { name: "PMP / CCP / RICS подготовка", duration: "3-9 мес", cost: "300-1500 тыс. тг", where: "Аккредит. центры, онлайн (Coursera, Udemy)" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-sky-300 hover:text-sky-200 transition">
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Карьерный путь</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            🎓 Карьерный путь сметчика РК
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            Сметчик — это <strong className="text-emerald-300">не «низшая» специальность
            строителя</strong>, как думают многие. Это перспективная профессия с чёткой
            карьерной лестницей: от Junior с 200 тыс. тг до Главного сметчика с 1.5 млн тг
            и Эксперта с 5+ млн тг. По профстандартам МТСЗН РК есть 5 квалификационных
            уровней, по международным сертификациям — целый ряд возможностей (RICS, PMP,
            AACE). С BIM-обязательностью с 2025 г. спрос на 5D-сметчиков растёт быстрее
            предложения.
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Уровней профстандарта</div>
              <div className="text-slate-300">5 (3-7 разряды по ЕТКС)</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Зарплата Алматы 2025</div>
              <div className="text-slate-300">200 тыс. (Junior) — 5+ млн тг (Expert)</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Дефицит сметчиков РК</div>
              <div className="text-slate-300">~ 30% вакансий не заполняются (BIM 5D)</div>
            </div>
          </div>
        </section>

        {/* Section 1: Уровни */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🪜 Section 1. Шесть карьерных уровней
          </h2>
          <div className="space-y-3">
            {levels.map((l) => (
              <div key={l.level} className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
                <div className="flex items-baseline justify-between gap-4 mb-2">
                  <h3 className="text-base font-semibold text-emerald-300">{l.level}</h3>
                  <span className="text-xs text-amber-300 italic shrink-0">{l.experience}</span>
                </div>
                <dl className="text-sm grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Задачи</dt>
                    <dd className="text-slate-300 text-xs">{l.tasks}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Зарплата</dt>
                    <dd className="text-emerald-300 text-xs">{l.salary}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Что развивать</dt>
                    <dd className="text-slate-400 text-xs italic">{l.growth}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Срок до след. уровня</dt>
                    <dd className="text-amber-300 text-xs">{l.time}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Сертификации */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            📜 Section 2. Шесть сертификаций для роста
          </h2>
          <div className="space-y-3">
            {cert.map((c) => (
              <div key={c.name} className="border border-emerald-800/40 bg-emerald-950/20 rounded-xl p-4">
                <div className="flex items-baseline justify-between gap-4 mb-2">
                  <h3 className="text-base font-semibold text-emerald-300">{c.name}</h3>
                  <span className="text-xs text-amber-300 italic shrink-0">{c.cost}</span>
                </div>
                <dl className="text-sm grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Что даёт</dt>
                    <dd className="text-slate-300 text-xs">{c.what}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Где получить</dt>
                    <dd className="text-slate-400 text-xs">{c.where}</dd>
                  </div>
                  <div className="md:col-span-2">
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Применение</dt>
                    <dd className="text-slate-300 text-xs italic">{c.use}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Курсы */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            📚 Section 3. Курсы и обучение в РК
          </h2>
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Курс</th>
                  <th className="text-left px-4 py-3 w-32">Длительность</th>
                  <th className="text-left px-4 py-3 w-44">Стоимость</th>
                  <th className="text-left px-4 py-3">Где пройти</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {courses.map((c) => (
                  <tr key={c.name} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 text-slate-100 text-xs">{c.name}</td>
                    <td className="px-4 py-3 text-amber-300 text-xs">{c.duration}</td>
                    <td className="px-4 py-3 text-emerald-300 text-xs">{c.cost}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{c.where}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 4: ВУЗы */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🏫 Section 4. ВУЗы и колледжи РК
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
              <h3 className="text-base font-semibold text-emerald-300 mb-2">КазГАСУ (Алматы)</h3>
              <p className="text-xs text-slate-300">Казахский Государственный Архитектурно-Строительный Университет. Бакалавр «Строительство» (5В072900) с сметным уклоном. 4 года, 1.2-1.8 млн тг/год.</p>
            </div>
            <div className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
              <h3 className="text-base font-semibold text-emerald-300 mb-2">ЕНУ им. Гумилёва (Астана)</h3>
              <p className="text-xs text-slate-300">Евразийский Национальный Университет. Бакалавр «Строительство и инженерное дело». Сильная программа БИМ 5D.</p>
            </div>
            <div className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
              <h3 className="text-base font-semibold text-emerald-300 mb-2">КарГТУ (Караганда)</h3>
              <p className="text-xs text-slate-300">Карагандинский Технический Университет. Промышленное и гражданское строительство. Спец. сметная подготовка с 2-го курса.</p>
            </div>
            <div className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
              <h3 className="text-base font-semibold text-emerald-300 mb-2">МУИТ (Алматы)</h3>
              <p className="text-xs text-slate-300">Международный Университет Информационных Технологий. Цифровое строительство, BIM-моделирование. Современные программы.</p>
            </div>
            <div className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
              <h3 className="text-base font-semibold text-emerald-300 mb-2">Алматинский строит. колледж</h3>
              <p className="text-xs text-slate-300">Средне-специальное образование (2-3 года). Базовая подготовка сметчика. Стоимость 350-600 тыс. тг/год.</p>
            </div>
            <div className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
              <h3 className="text-base font-semibold text-emerald-300 mb-2">Самообучение + сертификация</h3>
              <p className="text-xs text-slate-300">Альтернативный путь: курсы АВС-4 + опыт в компании + сертификации. Подходит для перехода из смежных профессий (бухгалтер, инженер ПТО).</p>
            </div>
          </div>
        </section>

        {/* Упражнения */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Section 5. Упражнения</h2>

          {/* Упр.1 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 1 / 4 — Что развивать для FIDIC-проектов
            </div>
            <div className="text-slate-200 mb-4">
              Сметчик хочет работать на проектах с финансированием ЕБРР/МБРР (FIDIC-контракты).
              Что ему обязательно нужно для квалификации?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Только АВС-4 и хорошее знание ЭСН РК" },
                { v: "b", t: "Английский язык (Upper-Intermediate+) + знание FIDIC Sub-Clauses + EVMS (PMBOK) + желательно сертификат RICS или AACE CCP" },
                { v: "c", t: "Главное — связи в МИИР РК" },
                { v: "d", t: "Только бакалавр строительного вуза" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex1 === opt.v ? "border-emerald-600 bg-emerald-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex1" value={opt.v} checked={ex1 === opt.v} onChange={() => setEx1(opt.v)} className="accent-emerald-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx1} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx1Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex1Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex1Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — англ + FIDIC + EVMS + RICS</span>}
              {ex1Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-emerald-300">Решение:</strong> FIDIC-проекты в РК
                (БАКАД, аэропорт Алматы, ВЛ-500 кВ) требуют:
                <ol className="list-decimal list-inside mt-2 space-y-1 text-xs">
                  <li><strong>Английский</strong> Upper-Intermediate+ — все документы и
                  переговоры с Engineer/Заказчиком на английском</li>
                  <li><strong>Знание FIDIC Sub-Clauses</strong> — особенно 13 (Variations),
                  20 (Claims), 11 (DNP), 4.12 (Unforeseeable conditions)</li>
                  <li><strong>EVMS (Earned Value Management)</strong> по PMBOK — обязательная
                  отчётность для ЕБРР/МБРР/АБР/JICA</li>
                  <li><strong>Сертификат RICS</strong> Quantity Surveyor или <strong>AACE
                  CCP</strong> (Certified Cost Professional) — большой плюс</li>
                </ol>
                В РК всего ~ 30 RICS-сертифицированных сметчиков, спрос огромен. Зарплата
                FIDIC-сметчика — 1.5-3 млн тг/мес. RICS-экзамен — 1500-3000$ + взнос
                500$/год, окупается за 1-2 месяца после получения сертификата.
              </div>
            )}
          </div>

          {/* Упр.2 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Дефицит на рынке
            </div>
            <div className="text-slate-200 mb-4">
              Какая специализация сметчика на рынке РК в 2025 г. имеет <strong>самый высокий
              дефицит</strong> и быстрорастущий спрос?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Стандартный сметчик с АВС-4 — больше всего" },
                { v: "b", t: "Юристы со специализацией в строительстве" },
                { v: "c", t: "BIM 5D-сметчик (Revit/Cubicost) + FIDIC + английский" },
                { v: "d", t: "Сметчик ремонта квартир" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex2 === opt.v ? "border-emerald-600 bg-emerald-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex2" value={opt.v} checked={ex2 === opt.v} onChange={() => setEx2(opt.v)} className="accent-emerald-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx2} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx2Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex2Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex2Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — BIM 5D + FIDIC</span>}
              {ex2Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-emerald-300">Решение:</strong> С 2025 г. в РК
                обязательно BIM для бюджетных объектов &gt; 2 млрд тг (ПП МИИР № 132).
                Это создало острый дефицит:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>BIM 5D-сметчиков с Revit/Cubicost ~ 50 человек на всю РК</li>
                  <li>FIDIC-сметчиков (англ.+нормы) ~ 30 человек</li>
                  <li>Зарплата 1-3 млн тг/мес, многие международные проекты в долларах</li>
                </ul>
                Стандартных сметчиков с АВС-4 — около 5000+ в РК (полный рынок).
                Юристов-строителей много, но они в смежной нише. Сметчики ремонта —
                низкооплачиваемый сегмент. Тренд: BIM + цифровое моделирование +
                английский = премиум-сегмент рынка. Тот, кто инвестирует 1-2 года в эту
                квалификацию, существенно повышает зарплату.
              </div>
            )}
          </div>

          {/* Упр.3 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — Пенсионные отчисления
            </div>
            <div className="text-slate-200 mb-4">
              Сметчик зарабатывает <strong>450 000 тг/мес</strong> (после налогов). Стандартный
              ОПВ (Обязательные Пенсионные Взносы) в РК — <strong>10%</strong> от валовой
              зарплаты. Какая сумма ежегодных отчислений в ЕНПФ? (Допустим, зарплата та же
              весь год.)
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Отчисления за год, тг</span>
              <input value={ex3} onChange={(e) => setEx3(e.target.value)} type="number" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="540000" />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx3} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx3Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex3Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex3Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 540 000 тг/год</span>}
              {ex3Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Перепроверь</span>}
            </div>
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-emerald-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`ОПВ = ОТ × 12 × 10%
    = 450 000 × 12 × 0.10
    = 540 000 тг/год

Структура зарплаты сметчика в РК (на 450 тыс. тг):

ВАЛОВАЯ зарплата (брутто): 450 000 тг
─────────────────────────────────────────
ИПН (10%): 45 000 тг
ОПВ (10%): 45 000 тг — идёт в ЕНПФ на личный счёт
ОСМС (2%): 9 000 тг — медицинское страхование
─────────────────────────────────────────
К ВЫПЛАТЕ (нетто): 351 000 тг

Доп. отчисления работодателя (не вычитаются из ОТ):
• Социальный налог (9.5%): 42 750 тг — в бюджет
• Социальные отчисления (3.5%): 15 750 тг — в ГФСС
• ОПВР (5% с 2024): 22 500 тг — пенс. взносы работодателя

ИТОГО налоговая нагрузка работодателя:
450 000 + 81 000 = 531 000 тг — реальная стоимость
сотрудника для компании.

Накопления в ЕНПФ: 540 000 + 270 000 = 810 000 тг/год
(10% работника + 5% работодателя ОПВР). За 30 лет
работы — 24+ млн тг (с учётом инвест. дохода ЕНПФ).`}
                </pre>
              </div>
            )}
          </div>

          {/* Упр.4 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — Альтернативные карьерные пути
            </div>
            <div className="text-slate-200 mb-4">
              После 10 лет работы сметчиком профессионал хочет развить карьеру. Какие
              <strong>3 наиболее перспективных</strong> направления развития?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Только продолжать сметную работу — больше денег, больше опыта" },
                { v: "b", t: "Уйти в бухгалтерию — там стабильно" },
                { v: "c", t: "Стать прорабом или мастером" },
                { v: "d", t: "1) Главный сметчик в крупной компании, 2) Независимый эксперт-консультант (своя практика), 3) Менеджмент проектов (PMP) с переходом в управление" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex4 === opt.v ? "border-emerald-600 bg-emerald-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex4" value={opt.v} checked={ex4 === opt.v} onChange={() => setEx4(opt.v)} className="accent-emerald-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx4} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx4Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex4Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex4Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 3 пути роста</span>}
              {ex4Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex4Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-emerald-300">Решение:</strong> Три перспективных
                направления для опытного сметчика:
                <ol className="list-decimal list-inside mt-2 space-y-2 text-xs">
                  <li>
                    <strong>Главный сметчик</strong> в крупной строительной компании
                    (BI Group, Bazis Construction, Almaty Construction). Зарплата
                    1-2 млн тг + бонусы 10-30% от прибыли. Управление 5-10 сметчиками.
                  </li>
                  <li>
                    <strong>Независимый эксперт-консультант</strong>. Своя ИП или ТОО,
                    работа по часам (50-150 тыс. тг/день). Клиенты: суды, банки, страховые,
                    международные компании. Доход: 2-5 млн тг/мес.
                  </li>
                  <li>
                    <strong>Менеджмент проектов</strong> через PMP-сертификацию. Переход
                    с «сметчика» на «руководителя проекта» (Project Manager) — более
                    управленческая роль. Зарплата 1.5-3 млн тг, перспектива в директора
                    по строительству.
                  </li>
                </ol>
                Дополнительные пути: преподавание в ВУЗе (КазГАСУ, ЕНУ), открытие своего
                сметного бюро, написание книг/статей (имя в отрасли). НЕ перспективно
                переходить в бухгалтерию (другая профессия, начало с нуля) или
                в прорабы (это другая ветка строительной карьеры).
              </div>
            )}
          </div>
        </section>

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">
          Профстандарт МТСЗН РК «Сметчик» (Приказ № 165 от 04.04.2017). ЕНПФ — enpf.kz.
          RICS — rics.org. AACE — aacei.org. PMI — pmi.org. ВУЗы: kazgasa.kz, enu.kz,
          kstu.kz, iitu.kz. Курсы: kazsoft.kz, avs-4.kz, bim-cluster.kz, almau.edu.kz.
          Зарплаты — данные hh.kz / krisha.kz/work / linkedin.com на 2025 г.
        </div>
      </main>
    </div>
  );
}
