"use client";

import Link from "next/link";
import { useState } from "react";

export default function ModularConstructionPage() {
  const [ex1, setEx1] = useState<string | null>(null);
  const [ex1Res, setEx1Res] = useState<null | "ok" | "bad">(null);
  const [ex1Sol, setEx1Sol] = useState(false);

  const [ex2, setEx2] = useState("");
  const [ex2Res, setEx2Res] = useState<null | "ok" | "bad">(null);
  const [ex2Sol, setEx2Sol] = useState(false);

  const [ex3, setEx3] = useState<string | null>(null);
  const [ex3Res, setEx3Res] = useState<null | "ok" | "bad">(null);
  const [ex3Sol, setEx3Sol] = useState(false);

  const [ex4, setEx4] = useState<string | null>(null);
  const [ex4Res, setEx4Res] = useState<null | "ok" | "bad">(null);
  const [ex4Sol, setEx4Sol] = useState(false);

  const checkEx1 = () => setEx1Res(ex1 === "b" ? "ok" : "bad");
  const checkEx2 = () => {
    // 50 модулей × 24 м² × 180 тыс. = 216 млн тг (модульный многоквартирный дом)
    const v = parseFloat(ex2);
    if (!isFinite(v)) return setEx2Res("bad");
    setEx2Res(Math.abs(v - 216_000_000) <= 5_000_000 ? "ok" : "bad");
  };
  const checkEx3 = () => setEx3Res(ex3 === "c" ? "ok" : "bad");
  const checkEx4 = () => setEx4Res(ex4 === "d" ? "ok" : "bad");

  const types = [
    {
      name: "Контейнерные дома (Container Homes)",
      what: "Морские контейнеры 20/40 ft (6/12 м длины) как готовые модули",
      cost: "1.5-5 млн тг за контейнер 30 м² (с отделкой и инж.)",
      speed: "Установка 1 день, готовность к жизни 1-2 недели",
      example: "Стройплощадочные офисы, временное жильё, гламкемпинги (Чимбулак, Карачаганак)",
      pros_cons: "+ Очень дёшево, мобильно, − Маленькая площадь, плохая теплоизоляция в РК",
    },
    {
      name: "Сэндвич-панели (Prefab Panels)",
      what: "Готовые стены, пол, потолок из заводских панелей, монтаж на месте",
      cost: "60-150 тыс. тг/м² готового дома",
      speed: "Монтаж дома 60 м² — 5-7 дней с фундаментом",
      example: "Каркасные коттеджи, торговые павильоны, склады, ЛВЭС-станции",
      pros_cons: "+ Быстро, средняя цена, лёгкое утепление, − Срок службы 30-50 лет vs 100+ кирпич",
    },
    {
      name: "Объёмно-модульное (3D-модули)",
      what: "Целые комнаты собираются на заводе (с отделкой, инж.) — монтаж 90% на стройке готово",
      cost: "180-300 тыс. тг/м² (быстрая отделка) до 350 тыс. тг (премиум)",
      speed: "Гостиница на 100 номеров — 6-9 мес., обычная — 18-24 мес.",
      example: "Hilton Garden Inn модульный (Англия), общежития РК — Politech Almaty, ЧОПы строек",
      pros_cons: "+ В 2-3 раза быстрее, контроль качества на заводе, − Транспортные ограничения, дорогая логистика",
    },
    {
      name: "СИП-панели (SIP — Structural Insulated Panels)",
      what: "Структурные изолированные панели с ОСП + ППС/ППУ внутри",
      cost: "80-130 тыс. тг/м²",
      speed: "Каркасник 100 м² за 30-45 дней",
      example: "Дачные дома, коттеджи эконом-класса, посёлки (Капшагай, Кошкино)",
      pros_cons: "+ Дёшево, тёплая стена, − Пожарная опасность пенопласта, дерево требует ухода",
    },
    {
      name: "3D-печать домов (3D Printed Construction)",
      what: "Бетонный экструдер печатает стены слоями 1-2 см, до 100 м²/день",
      cost: "150-250 тыс. тг/м² (экспериментально, цена падает)",
      speed: "Дом 60 м² — 24-48 часов печать стен + 1 месяц отделка",
      example: "WASP (Италия), COBOD (Дания) — пилоты в РК через Astana Innovations 2024-2025",
      pros_cons: "+ Минимум отходов, низкая стоимость рабочей силы, − Только малоэтажное, ограниченная архитектура",
    },
    {
      name: "Стальной каркас + лёгкие обшивки (LSF — Light Steel Frame)",
      what: "Гнутый профиль из оцинкованной стали + гипсокартон + утеплитель",
      cost: "100-180 тыс. тг/м²",
      speed: "Многоэтажный жилой 6 эт., 60 квартир — 8-12 мес.",
      example: "Многоэтажные жилые комплексы AzbeStroy в Алматы, торговые центры",
      pros_cons: "+ Быстро для многоэтажного, лёгкий, − Сложная сейсмика, дорогая шумоизоляция",
    },
  ];

  const advantages = [
    { metric: "Скорость стр-ва", classic: "100% (база)", modular: "30-50% (в 2-3 раза быстрее)" },
    { metric: "Стоимость", classic: "100% (база)", modular: "60-110% (в зависимости от типа)" },
    { metric: "Качество (контроль)", classic: "Полевой", modular: "Заводской — выше в среднем" },
    { metric: "Отходы материалов", classic: "10-15%", modular: "2-5% (заводская оптимизация)" },
    { metric: "Зависимость от погоды", classic: "Высокая", modular: "Низкая (модуль готов на заводе)" },
    { metric: "Срок службы", classic: "50-100 лет", modular: "30-80 лет (зависит от типа)" },
    { metric: "Ремонтопригодность", classic: "Любые перепланировки", modular: "Ограниченная (модуль = единый блок)" },
    { metric: "Архитектурная гибкость", classic: "Высокая", modular: "Средняя (стандартные модули)" },
  ];

  const challenges = [
    { ch: "Транспортные ограничения", what: "Модуль шире 3.5 м или выше 4 м — спец. разрешение МВД РК + сопровождение. Удорожание логистики 5-15%" },
    { ch: "Сейсмостойкость РК", what: "Алматы 9 баллов — требует усиленных соединений модулей. Не все заводские системы сертифицированы для 8-9 баллов" },
    { ch: "Холодный климат", what: "Гофрированные стыки между модулями — мостики холода. Дополнительное утепление + герметизация на месте" },
    { ch: "Восприятие рынком", what: "Покупатели до сих пор воспринимают модульное как «несерьёзное». Имидж улучшается, но медленно" },
    { ch: "Финансирование", what: "Банки осторожны с ипотекой на модульные. КИК (Казахстанская ипотечная компания) выдаёт, но с дисконтом на залог 10-20%" },
    { ch: "Кадры", what: "Дефицит специалистов по модульному строительству, особенно в регионах" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-sky-300 hover:text-sky-200 transition">
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Модульное стр-во</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            🧩 Модульное и быстровозводимое строительство
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            <strong className="text-cyan-300">Modular construction</strong> — это
            технологии, в которых здание (или его части) изготавливаются на заводе и
            собираются на стройплощадке. Скорость в 2-3 раза выше, отходы в 3-5 раз ниже,
            качество контролируется на заводе. В РК набирает обороты с 2020 г. — особенно
            для общежитий, временного жилья на стройплощадках (вахтовые посёлки нефтегаз),
            социальных программ. 3D-печать домов — пилоты в Астане 2024-2025.
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Рост рынка РК</div>
              <div className="text-slate-300">+25-35% в год (2020-2025)</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Скорость стр-ва</div>
              <div className="text-slate-300">В 2-3 раза быстрее монолита</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Сейсмика Алматы</div>
              <div className="text-slate-300">Ограничения для 9 баллов (нужны спец. узлы)</div>
            </div>
          </div>
        </section>

        {/* Section 1: 6 типов */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🏗 Section 1. Шесть типов модульного стр-ва
          </h2>
          <div className="space-y-3">
            {types.map((t) => (
              <div key={t.name} className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
                <h3 className="text-base font-semibold text-cyan-300 mb-2">{t.name}</h3>
                <dl className="text-sm grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Технология</dt>
                    <dd className="text-slate-300 text-xs">{t.what}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Цена</dt>
                    <dd className="text-emerald-300 text-xs">{t.cost}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Скорость</dt>
                    <dd className="text-amber-300 text-xs">{t.speed}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Примеры</dt>
                    <dd className="text-slate-400 text-xs italic">{t.example}</dd>
                  </div>
                  <div className="md:col-span-2">
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Плюсы / Минусы</dt>
                    <dd className="text-xs">{t.pros_cons}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Сравнение */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🆚 Section 2. Сравнение классического vs модульного
          </h2>
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Параметр</th>
                  <th className="text-left px-4 py-3">Классическое</th>
                  <th className="text-left px-4 py-3">Модульное</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {advantages.map((a) => (
                  <tr key={a.metric} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 text-slate-100 text-xs">{a.metric}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{a.classic}</td>
                    <td className="px-4 py-3 text-cyan-300 text-xs">{a.modular}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: Особенности смет */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            📋 Section 3. Особенности смет на модульное
          </h2>
          <div className="border border-cyan-800/60 bg-cyan-950/30 rounded-xl p-5">
            <h3 className="text-cyan-300 font-semibold mb-3">Структура сметы — отличия от обычной</h3>
            <ul className="text-sm space-y-2 text-slate-300 list-disc list-inside">
              <li><strong>Гл. 2 (Основные объекты)</strong> разделена на:
                <ul className="list-disc list-inside ml-6 mt-1 space-y-1 text-xs">
                  <li>Заводское изготовление модулей (60-80% стоимости)</li>
                  <li>Транспортировка модулей до площадки (5-15%)</li>
                  <li>Сборка и подключение на месте (10-25%)</li>
                </ul>
              </li>
              <li><strong>Гл. 1 (Подготовка площадки)</strong> минимизирована — нет долгих стройплощадок</li>
              <li><strong>Гл. 9 (Прочие)</strong> увеличена — спец. техника (краны 50+ т для монтажа модулей)</li>
              <li><strong>НР</strong> ниже обычной — нет долгих стройплощадочных накладных. Обычно 8-12% вместо 14-16%</li>
              <li><strong>СП</strong> часто ниже — заводское производство массовое, низкая маржа на модуль</li>
              <li><strong>Резерв на риски</strong> часто 3-5% (vs 5-7% обычно) — заводское качество предсказуемо</li>
            </ul>
          </div>
        </section>

        {/* Section 4: Вызовы */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            ⚠️ Section 4. Шесть вызовов модульного стр-ва в РК
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {challenges.map((c) => (
              <div key={c.ch} className="border border-rose-900/40 bg-rose-950/20 rounded-lg p-4">
                <h3 className="font-semibold text-rose-300 mb-2 text-sm">{c.ch}</h3>
                <p className="text-xs text-slate-300">{c.what}</p>
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
              Упражнение 1 / 4 — Когда выбирать модульное
            </div>
            <div className="text-slate-200 mb-4">
              Нефтегазовая компания планирует построить <strong>вахтовый посёлок на
              500 человек</strong> в районе Кашагана (Атырауская область, удалённое место,
              суровый климат). Срок — <strong>5 месяцев</strong>. Какая технология
              оптимальна?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Классический кирпичный посёлок — самый надёжный" },
                { v: "b", t: "Объёмно-модульное / контейнерные дома с заводской сборкой — за 5 мес. классику не построить, модули доставляются и собираются за 2-3 мес." },
                { v: "c", t: "Только палаточный лагерь" },
                { v: "d", t: "Монолитное с гипсокартонной отделкой" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex1 === opt.v ? "border-cyan-600 bg-cyan-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex1" value={opt.v} checked={ex1 === opt.v} onChange={() => setEx1(opt.v)} className="accent-cyan-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx1} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx1Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex1Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex1Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — модульное</span>}
              {ex1Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-cyan-300">Решение:</strong> Вахтовые посёлки — идеальное
                применение модульного:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li><strong>Скорость</strong> — за 5 мес. невозможно построить 500 человек
                  классикой (нужно 18-24 мес.). Модульное — 2-3 мес. собрать на заводе,
                  1 мес. транспорт + 1-2 мес. монтаж</li>
                  <li><strong>Удалённость</strong> — рабочих сложно привезти в Кашаган.
                  Модули собираются в Алматы/Атырау, доставляются готовыми</li>
                  <li><strong>Климат</strong> — заводская сборка устраняет погодные риски</li>
                  <li><strong>Временный характер</strong> — после 5-10 лет вахта закроется,
                  модули можно демонтировать и продать или переместить</li>
                </ul>
                Реальные примеры в РК: вахтовые посёлки Кашагана, Тенгиза, Карачаганака —
                все используют модульные технологии (поставщики: Camp Solutions Group,
                IAC Industries, КазМунайСервис).
              </div>
            )}
          </div>

          {/* Упр.2 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Стоимость модульного МКД
            </div>
            <div className="text-slate-200 mb-4">
              Планируется модульный многоквартирный дом для соц. программы: <strong>50
              модулей-квартир</strong> по <strong>24 м²</strong> каждый. Цена
              объёмно-модульного — <strong>180 тыс. тг/м²</strong>. Какая общая стоимость
              строительства в тенге?
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Стоимость, тг</span>
              <input value={ex2} onChange={(e) => setEx2(e.target.value)} type="number" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="216000000" />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx2} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx2Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex2Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex2Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 216 млн тг</span>}
              {ex2Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Перепроверь</span>}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-cyan-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Стоимость = N_модулей × S_модуля × Цена/м²
          = 50 × 24 × 180 000
          = 216 000 000 тг = 216 млн тг

В долларах: ~ 480 тыс. $

Сравнение с классическим МКД:
• Классика бизнес-класса Алматы — 290 тыс. тг/м²
• Модульное соц. жильё — 180 тыс. тг/м²
• Экономия: (290-180) × 1200 = 132 млн тг (38% дешевле)

Срок стр-ва:
• Классика 50-квартирного — 14-18 мес.
• Модульное — 6-8 мес. (в 2-3 раза быстрее)

Это объясняет популярность модульного для соц. жилья
(программа «Бакыт», субсидии акиматов). В Астане модульные
МКД на 1000+ квартир строятся за 12-18 мес. вместо обычных 30-36.

Сметчик модульного должен уметь:
1. Считать заводскую часть (по прайс-листу производителя)
2. Считать транспортную составляющую (тарифы СН РК 8.02-05)
3. Считать монтажную часть (специальная сметная база на сборку)

Производители модулей в РК: Astana Group, BI Group Modular,
Tatami Modular (бывший узбекский), импорт RU/CN.`}
                </pre>
              </div>
            )}
          </div>

          {/* Упр.3 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — 3D-печать дома
            </div>
            <div className="text-slate-200 mb-4">
              На пилоте в Астане 2024 г. 3D-принтер построил дом <strong>60 м²</strong>
              за <strong>24 часа</strong> печати. Какие <strong>главные ограничения</strong>
              этой технологии в РК сегодня?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Слишком дорого — миллион $ за дом" },
                { v: "b", t: "Не работает в холодном климате" },
                { v: "c", t: "Только малоэтажное (до 2 эт.), ограниченная архитектура (преимущ. криволинейные), сейсмика для Алматы пока не сертифицирована (9 баллов), нет нормативной базы РК на 3D-печать, рынок только тестируется" },
                { v: "d", t: "Запрещено законом" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex3 === opt.v ? "border-cyan-600 bg-cyan-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex3" value={opt.v} checked={ex3 === opt.v} onChange={() => setEx3(opt.v)} className="accent-cyan-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx3} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx3Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex3Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex3Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — комплекс ограничений</span>}
              {ex3Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-cyan-300">Решение:</strong> 3D-печать домов — это
                реальная, но пока ограниченная технология. По состоянию на 2025 в РК:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li><strong>Этажность</strong> — пока только 1-2 этажа, экспериментально
                  до 3-4 этажей (Дубай, Китай)</li>
                  <li><strong>Архитектура</strong> — лучше всего криволинейные стены,
                  прямоугольные дома менее выгодны (теряется преимущество)</li>
                  <li><strong>Сейсмика</strong> — для 9 баллов (Алматы) нет сертификации,
                  бетонный 3D-печать слабее монолитного армирования</li>
                  <li><strong>Нормативы РК</strong> — отдельный СНиП на 3D-печать
                  отсутствует, проекты согласовываются по аналогии с монолитом</li>
                  <li><strong>Стоимость</strong> — 150-250 тыс. тг/м², уже близка к
                  классике, преимущество в скорости</li>
                  <li><strong>Сроки массового внедрения</strong> — 2027-2030 при условии
                  развития нормативов и доверия рынка</li>
                </ul>
                Лидеры мирового рынка: COBOD (Дания), WASP (Италия), Apis Cor (RU/USA).
                В РК пилоты ведут Astana Innovations, КазНИИ Строительства, BI Group Tech.
              </div>
            )}
          </div>

          {/* Упр.4 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — Структура сметы модульного
            </div>
            <div className="text-slate-200 mb-4">
              В смете на модульное здание заводская часть составляет <strong>70%</strong>,
              транспортировка <strong>10%</strong>, монтаж <strong>20%</strong>. Какой
              <strong>главный риск</strong> для сметчика при подаче такой сметы в банк
              для финансирования?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Никакого — модульное проще обычной" },
                { v: "b", t: "Только цены материалов" },
                { v: "c", t: "Только погодные условия" },
                { v: "d", t: "Банк может потребовать аванс производителю модулей (50-70% заводской части = 35-50% от ССР) — необычная для классики структура платежей, нужно отдельное обоснование графика оплат" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex4 === opt.v ? "border-cyan-600 bg-cyan-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex4" value={opt.v} checked={ex4 === opt.v} onChange={() => setEx4(opt.v)} className="accent-cyan-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx4} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx4Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex4Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex4Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — нестандартный график платежей</span>}
              {ex4Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex4Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-cyan-300">Решение:</strong> Главная финансовая
                особенность модульного — банкам непривычно. В классическом строительстве:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Аванс 10-30%</li>
                  <li>Поэтапная оплата по КС-2/КС-3 (земля, бетон, отделка...)</li>
                  <li>Окончательный платёж после ввода</li>
                </ul>
                В модульном:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Аванс производителю 30-50% (он закупает материалы заранее)</li>
                  <li>Окончательная оплата заводской части — при отгрузке модулей (70-80%
                  от заводской стоимости)</li>
                  <li>Транспорт оплачивается до отгрузки</li>
                  <li>Монтаж — поэтапно как обычно</li>
                </ul>
                Это означает: ~ 50-60% средств уходит подрядчику до того, как на стройке
                что-то видно физически. Банки требуют:
                <ol className="list-decimal list-inside mt-2 space-y-1 text-xs">
                  <li>Гарантию завода-производителя</li>
                  <li>Страхование контракта</li>
                  <li>Эскроу-счёт с раскрытием по этапам</li>
                  <li>Регулярные фото/видео-отчёты с завода</li>
                </ol>
                Сметчик должен предусмотреть отдельный раздел сметы с обоснованием
                графика платежей. Это «бумажная» работа, но критичная для финансирования.
              </div>
            )}
          </div>
        </section>

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">
          СН РК 5.04-23 (для каркасных), отдельных нормативов на модульное в РК пока нет
          (используется по аналогии с классикой). ISO 22156 (Bamboo Structural Design),
          ISO 19030 (Modular Buildings). Производители РК: Astana Group Modular,
          BI Group Tech, Camp Solutions Group, IAC Industries. 3D-печать пилоты —
          Astana Innovations, КазНИИ Строительства. Международные: COBOD, WASP, Apis Cor.
        </div>
      </main>
    </div>
  );
}
