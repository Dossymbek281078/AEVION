"use client";

import Link from "next/link";
import { useState } from "react";

export default function DataCentersPage() {
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

  const checkEx1 = () => setEx1Res(ex1 === "d" ? "ok" : "bad");
  const checkEx2 = () => setEx2Res(ex2 === "b" ? "ok" : "bad");
  const checkEx3 = () => {
    const v = parseFloat(ex3);
    if (!isFinite(v)) return setEx3Res("bad");
    setEx3Res(Math.abs(v - 800) <= 10 ? "ok" : "bad");
  };
  const checkEx4 = () => setEx4Res(ex4 === "c" ? "ok" : "bad");

  const tiers = [
    {
      tier: "Tier I",
      uptime: "99.671% (~28 ч/год простоя)",
      redundancy: "Нет резервирования (N)",
      maintenance: "Плановое ТО с остановом",
      cost: "$0.5–1 млн/МВт IT",
    },
    {
      tier: "Tier II",
      uptime: "99.741% (~22 ч/год)",
      redundancy: "Частичное резервирование (N+1)",
      maintenance: "Плановое ТО с частичным остановом",
      cost: "$1–2 млн/МВт IT",
    },
    {
      tier: "Tier III",
      uptime: "99.982% (~1.6 ч/год)",
      redundancy: "Полное резервирование (N+1)",
      maintenance: "ТО без останова (concurrent maintainability)",
      cost: "$2–4 млн/МВт IT",
    },
    {
      tier: "Tier IV",
      uptime: "99.995% (~26 мин/год)",
      redundancy: "Полное резервирование 2(N+1) — Fault Tolerant",
      maintenance: "Полный отказоустойчивый режим без влияния",
      cost: "$4–8 млн/МВт IT",
    },
  ];

  const systems = [
    {
      name: "Электроснабжение / ИБП / ДГУ",
      desc: "Бесперебойное питание (ИБП) + дизельные генераторы (ДГУ) на 24–72 ч автономии. В Tier IV — двойная система ИБП 2(N+1). Занимает 30–40% бюджета ЦОД.",
      icon: "⚡",
    },
    {
      name: "Кондиционирование CRAC/CRAH",
      desc: "Computer Room Air Conditioner (CRAC) или Computer Room Air Handler (CRAH). Поддержание температуры 18–27°C, влажности 40–60%. Горячие/холодные коридоры, containment-системы.",
      icon: "❄️",
    },
    {
      name: "Пожаротушение газовое (NOVEC/ИнертGas)",
      desc: "Чистые агенты: NOVEC 1230 (3M), FM-200, IG-541 (инертные газы). Не повреждают оборудование, не проводят электричество. Обязательны по NFPA 75/76.",
      icon: "🔥",
    },
    {
      name: "Мониторинг DCIM",
      desc: "Data Center Infrastructure Management — мониторинг PUE, температуры, влажности, состояния ИБП/ДГУ в реальном времени. Критичен для сертификации Tier.",
      icon: "📊",
    },
    {
      name: "Безопасность СКУД",
      desc: "Система контроля управления доступом: многоуровневая — периметр, здание, зал, стойка. Биометрия, магнитные карты, манловые шлюзы. Видеонаблюдение 24/7.",
      icon: "🔐",
    },
    {
      name: "Кабельная система (СКС)",
      desc: "Структурированная кабельная система: оптоволокно (OM4/OS2) + патч-панели. Концепция HOT Aisle/Cold Aisle: оптимизирует воздушные потоки и снижает PUE.",
      icon: "🔌",
    },
  ];

  const benchmarksRk = [
    {
      project: "Qazcloud (Казтелерадио)",
      location: "Астана",
      tier: "Tier III",
      capacity: "2 МВт IT",
      area: "2 000 м²",
      note: "Первый государственный коммерческий ЦОД РК",
    },
    {
      project: "Beeline Kazakhstan ЦОД",
      location: "Алматы",
      tier: "Tier III",
      capacity: "1.5 МВт IT",
      area: "1 500 м²",
      note: "Для телеком-оборудования и enterprise-клиентов",
    },
    {
      project: "ГосЦОД (Мининформатизации)",
      location: "Астана",
      tier: "Tier III+",
      capacity: "3 МВт IT",
      area: "3 500 м²",
      note: "Единая платформа «Электронного правительства» РК",
    },
    {
      project: "Казахтелеком ЦОД Алматы",
      location: "Алматы",
      tier: "Tier III",
      capacity: "1 МВт IT",
      area: "1 200 м²",
      note: "Хостинг, colocation, облачные сервисы для бизнеса",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-slate-300 hover:text-slate-200 transition">
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Дата-центры (ЦОД)</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            💻 Дата-центры (ЦОД)
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            Дата-центр (ЦОД — Центр обработки данных) — специализированное здание для
            размещения серверного оборудования. Одно из самых технически сложных и
            дорогостоящих видов строительства: инженерные системы составляют
            <strong className="text-slate-300"> 60–80% общей стоимости</strong>.
            В РК стремительно растёт рынок ЦОД в связи с развитием «Цифрового Казахстана».
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-slate-700 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-400 uppercase tracking-wider mb-1">Доля инженерии в бюджете</div>
              <div className="text-slate-200">60–80% стоимости ЦОД</div>
            </div>
            <div className="border border-slate-700 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-400 uppercase tracking-wider mb-1">Срок окупаемости</div>
              <div className="text-slate-200">5–10 лет (colocation)</div>
            </div>
            <div className="border border-slate-700 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-400 uppercase tracking-wider mb-1">Рынок РК (2024)</div>
              <div className="text-slate-200">~15 коммерческих ЦОД, рост 20%/год</div>
            </div>
          </div>
        </section>

        {/* Section 1: Tier */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            📊 Section 1. Классификация Tier I–IV (Uptime Institute)
          </h2>
          <p className="text-sm text-slate-400">
            Международный стандарт Uptime Institute определяет 4 уровня надёжности ЦОД.
            Сметчик ЦОД обязан знать, какой Tier требует заказчик — это напрямую
            определяет бюджет строительства в разы.
          </p>
          <div className="overflow-x-auto border border-slate-700 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 w-20">Уровень</th>
                  <th className="text-left px-4 py-3">Доступность</th>
                  <th className="text-left px-4 py-3">Резервирование</th>
                  <th className="text-left px-4 py-3">Плановое ТО</th>
                  <th className="text-left px-4 py-3 w-40">Стоимость</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {tiers.map((t) => (
                  <tr key={t.tier} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 font-bold text-slate-200 text-base">{t.tier}</td>
                    <td className="px-4 py-3 text-emerald-300 font-mono text-xs">{t.uptime}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{t.redundancy}</td>
                    <td className="px-4 py-3 text-amber-300 text-xs">{t.maintenance}</td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">{t.cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">
            * Большинство коммерческих ЦОД РК — Tier III. Государственные объекты стремятся
            к Tier III+ или Tier IV. Tier IV в РК единичные проекты.
          </p>
        </section>

        {/* Section 2: Системы */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            ⚙️ Section 2. Критические инженерные системы ЦОД
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {systems.map((s) => (
              <div key={s.name} className="border border-slate-700 bg-slate-900/30 rounded-xl p-5">
                <h3 className="text-base font-semibold text-slate-200 mb-2">
                  {s.icon} {s.name}
                </h3>
                <p className="text-sm text-slate-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: PUE */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            📈 Section 3. PUE — Power Usage Effectiveness
          </h2>
          <div className="border border-slate-700 rounded-xl p-6 bg-slate-900/30">
            <div className="mb-4">
              <div className="text-slate-400 text-sm mb-2">Формула:</div>
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-lg text-slate-100 text-center">
                PUE = Общее потребление (кВт) / IT-нагрузка (кВт)
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
              <div className="border border-emerald-900/40 bg-emerald-950/10 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-emerald-300 mb-1">1.0</div>
                <div className="text-xs text-emerald-400 uppercase tracking-wider mb-2">Идеальный</div>
                <div className="text-xs text-slate-400">
                  100% энергии — серверам. Теоретически недостижим. Только при
                  свободном охлаждении (free cooling) в холодных регионах.
                </div>
              </div>
              <div className="border border-sky-900/40 bg-sky-950/10 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-sky-300 mb-1">≤ 1.4</div>
                <div className="text-xs text-sky-400 uppercase tracking-wider mb-2">Хороший</div>
                <div className="text-xs text-slate-400">
                  Современные ЦОД с системами свободного охлаждения, жидкостным
                  охлаждением, hot/cold aisle containment. Google, Microsoft — PUE ≈ 1.1–1.2.
                </div>
              </div>
              <div className="border border-amber-900/40 bg-amber-950/10 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-amber-300 mb-1">1.6 – 2.0</div>
                <div className="text-xs text-amber-400 uppercase tracking-wider mb-2">Типичный (устаревший)</div>
                <div className="text-xs text-slate-400">
                  Традиционные ЦОД без оптимизации. На каждый 1 кВт IT — 0.6–1 кВт
                  накладных расходов. Большинство ЦОД РК 2010–2018 гг. постройки.
                </div>
              </div>
            </div>
            <div className="mt-4 p-3 bg-slate-950 border border-slate-800 rounded text-xs text-slate-400">
              <strong className="text-slate-300">Экономика PUE:</strong> Снижение PUE с 2.0 до 1.4
              для ЦОД 1 МВт IT дает экономию ~600 кВт × 8760 ч × 25 тг/кВт·ч ≈ 130 млн тг/год.
              Окупаемость инвестиций в модернизацию охлаждения — 2–4 года.
            </div>
          </div>
        </section>

        {/* Section 4: Бенчмарки РК */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🇰🇿 Section 4. Строительство ЦОД в РК — примеры проектов
          </h2>
          <div className="overflow-x-auto border border-slate-700 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Проект</th>
                  <th className="text-left px-4 py-3 w-28">Город</th>
                  <th className="text-left px-4 py-3 w-24">Tier</th>
                  <th className="text-left px-4 py-3 w-28">Мощность IT</th>
                  <th className="text-left px-4 py-3 w-24">Площадь</th>
                  <th className="text-left px-4 py-3">Примечание</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {benchmarksRk.map((b) => (
                  <tr key={b.project} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 text-slate-200 font-medium text-xs">{b.project}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{b.location}</td>
                    <td className="px-4 py-3 font-mono text-emerald-300 text-xs">{b.tier}</td>
                    <td className="px-4 py-3 text-amber-300 text-xs">{b.capacity}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{b.area}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs italic">{b.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="border border-slate-700 rounded-lg p-4 bg-slate-900/30">
              <div className="text-slate-400 uppercase tracking-wider mb-2">Ориентировочный бюджет строительства (РК)</div>
              <ul className="space-y-1 text-slate-300">
                <li>Tier II: $500–1 000/м² (~225–450 тыс. тг/м²)</li>
                <li>Tier III: $1 500–3 000/м² (~675 тыс. – 1.35 млн тг/м²)</li>
                <li>Tier IV: $4 000–8 000/м² (~1.8–3.6 млн тг/м²)</li>
              </ul>
            </div>
            <div className="border border-slate-700 rounded-lg p-4 bg-slate-900/30">
              <div className="text-slate-400 uppercase tracking-wider mb-2">Структура бюджета ЦОД (Tier III)</div>
              <ul className="space-y-1 text-slate-300">
                <li>Инженерные системы (ИБП, ДГУ, охлажд.): 55–65%</li>
                <li>Строительная часть (конструктив): 20–25%</li>
                <li>СКС и СКУД: 8–12%</li>
                <li>Пожаротушение и безопасность: 5–8%</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Упражнения */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Упражнения</h2>

          {/* Упр.1 */}
          <div className="border border-slate-700 rounded-xl p-5 bg-slate-900/30">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 1 / 4 — Tier IV
            </div>
            <div className="text-slate-200 mb-4">
              Заказчик требует строительство ЦОД с сертификатом <strong>Tier IV</strong>
              по стандарту Uptime Institute. Что это означает?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "99.671% uptime, нет резервирования, плановые остановы допустимы" },
                { v: "b", t: "99.741% uptime, частичное резервирование N+1" },
                { v: "c", t: "99.982% uptime, полное N+1, ТО без останова" },
                {
                  v: "d",
                  t: "99.995% uptime (~26 мин простоя в год), полное резервирование 2(N+1) — Fault Tolerant, любое плановое и аварийное обслуживание без влияния на работу ЦОД",
                },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex1 === opt.v
                      ? "border-slate-500 bg-slate-800/50"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex1"
                    value={opt.v}
                    checked={ex1 === opt.v}
                    onChange={() => setEx1(opt.v)}
                    className="accent-slate-400"
                  />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button
                onClick={checkEx1}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded transition text-sm"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx1Sol((v) => !v)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm"
              >
                {ex1Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex1Res === "ok" && (
                <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">
                  ✅ Верно — Tier IV: 99.995%, Fault Tolerant
                </span>
              )}
              {ex1Res === "bad" && (
                <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">
                  ❌ Неверно — изучи таблицу Tier
                </span>
              )}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-slate-200">Решение:</strong> Tier IV — высший уровень
                сертификации Uptime Institute. Ключевые характеристики:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>99.995% доступность = максимум 26.3 минут простоя в год</li>
                  <li>Полная отказоустойчивость: 2(N+1) для всех систем (два независимых ИБП, две цепи электроснабжения, два блока охлаждения)</li>
                  <li>Любой единичный отказ оборудования не влияет на работу ЦОД</li>
                  <li>Любое плановое обслуживание — без останова и без деградации</li>
                  <li>Стоимость: в 4–8 раз выше Tier I, занимает 5% от общего количества ЦОД в мире</li>
                </ul>
                В РК Tier IV стандарты применяются в критической инфраструктуре (финансовый сектор,
                ядерные объекты, военные ведомства). Для коммерческих заказчиков достаточен Tier III.
              </div>
            )}
          </div>

          {/* Упр.2 */}
          <div className="border border-slate-700 rounded-xl p-5 bg-slate-900/30">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Оценка PUE
            </div>
            <div className="text-slate-200 mb-4">
              ЦОД имеет показатель <strong>PUE = 1.8</strong>. Как правильно
              интерпретировать этот показатель?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Отличный показатель — только 20% энергии тратится «впустую»" },
                {
                  v: "b",
                  t: "Плохой показатель — 80% дополнительной энергии (сверх IT-нагрузки) расходуется на инфраструктуру: охлаждение, ИБП, освещение, UPS-потери",
                },
                { v: "c", t: "Нормальный показатель для современного ЦОД, оптимизация не нужна" },
                { v: "d", t: "PUE = 1.8 означает, что ЦОД работает на 80% мощности" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex2 === opt.v
                      ? "border-slate-500 bg-slate-800/50"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex2"
                    value={opt.v}
                    checked={ex2 === opt.v}
                    onChange={() => setEx2(opt.v)}
                    className="accent-slate-400"
                  />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button
                onClick={checkEx2}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded transition text-sm"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx2Sol((v) => !v)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm"
              >
                {ex2Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex2Res === "ok" && (
                <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">
                  ✅ Верно — PUE 1.8 неэффективен
                </span>
              )}
              {ex2Res === "bad" && (
                <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">
                  ❌ Неверно — разберись с формулой PUE
                </span>
              )}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-slate-200">Решение:</strong> PUE = 1.8 означает:
                на каждый 1 кВт, потребляемый IT-оборудованием, расходуется ещё 0.8 кВт
                на инфраструктуру. Это 44.4% overhead (0.8/1.8 = 44.4%).
                <pre className="mt-2 text-xs font-mono whitespace-pre-wrap text-slate-300">
{`Пример: IT-нагрузка = 1 000 кВт
Общее потребление = 1 000 × 1.8 = 1 800 кВт
Потери на инфраструктуру = 800 кВт

Стоимость потерь/год (25 тг/кВт·ч):
800 кВт × 8760 ч × 25 тг = 175 200 000 тг/год
                = 175 млн тг/год "впустую"

Лучшие мировые показатели:
Google (2024):   PUE = 1.10
Facebook/Meta:   PUE = 1.08
Microsoft Azure: PUE = 1.12
Средний РК ЦОД: PUE = 1.6–2.0`}
                </pre>
              </div>
            )}
          </div>

          {/* Упр.3 */}
          <div className="border border-slate-700 rounded-xl p-5 bg-slate-900/30">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — Расчёт общего потребления
            </div>
            <div className="text-slate-200 mb-4">
              ЦОД имеет IT-нагрузку <strong>500 кВт</strong> и показатель <strong>PUE = 1.6</strong>.
              Каково общее потребление электроэнергии (кВт)?
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Общий расход, кВт</span>
              <input
                value={ex3}
                onChange={(e) => setEx3(e.target.value)}
                type="number"
                className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100"
                placeholder="800"
              />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button
                onClick={checkEx3}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded transition text-sm"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx3Sol((v) => !v)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm"
              >
                {ex3Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex3Res === "ok" && (
                <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">
                  ✅ Верно — 800 кВт
                </span>
              )}
              {ex3Res === "bad" && (
                <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">
                  ❌ Перепроверь: PUE × IT-нагрузка
                </span>
              )}
            </div>
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-slate-200">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`PUE = Общее потребление / IT-нагрузка
Общее = PUE × IT = 1.6 × 500 кВт = 800 кВт

Структура 800 кВт:
• IT-оборудование (серверы):  500 кВт (62.5%)
• Охлаждение (CRAC/CRAH):     ~200 кВт (25%)
• ИБП и потери:                ~60 кВт  (7.5%)
• Освещение, прочее:           ~40 кВт  (5%)

Годовое потребление:
800 кВт × 8760 ч = 7 008 000 кВт·ч/год

Стоимость электричества (25 тг/кВт·ч):
7 008 000 × 25 = 175 200 000 тг/год ≈ 175 млн тг/год`}
                </pre>
              </div>
            )}
          </div>

          {/* Упр.4 */}
          <div className="border border-slate-700 rounded-xl p-5 bg-slate-900/30">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — Выбор системы пожаротушения
            </div>
            <div className="text-slate-200 mb-4">
              При проектировании ЦОД Tier III (серверный зал) выбирается система
              пожаротушения. Почему применяется <strong>газовое тушение NOVEC 1230</strong>
              вместо спринклерной водяной системы?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Газ дешевле воды при монтаже и обслуживании" },
                { v: "b", t: "Спринклеры запрещены СНиП для помещений площадью менее 500 м²" },
                {
                  v: "c",
                  t: "NOVEC 1230 не повреждает серверное оборудование при срабатывании (в отличие от воды, пены или порошка, которые выводят серверы из строя)",
                },
                { v: "d", t: "Газ быстрее тушит, чем вода, поэтому выбор только скоростной" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex4 === opt.v
                      ? "border-slate-500 bg-slate-800/50"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex4"
                    value={opt.v}
                    checked={ex4 === opt.v}
                    onChange={() => setEx4(opt.v)}
                    className="accent-slate-400"
                  />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button
                onClick={checkEx4}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded transition text-sm"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx4Sol((v) => !v)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm"
              >
                {ex4Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex4Res === "ok" && (
                <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">
                  ✅ Верно — не повреждает оборудование
                </span>
              )}
              {ex4Res === "bad" && (
                <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">
                  ❌ Неверно
                </span>
              )}
            </div>
            {ex4Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-slate-200">Решение:</strong> NOVEC 1230 (3M Novec)
                и аналоги (FM-200, CO₂, IG-541) — «чистые агенты». Их преимущества:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Испаряются без остатка, не проводят электричество, не вызывают коррозию</li>
                  <li>Серверы, после срабатывания, как правило, продолжают работу (или требуют минимального ТО)</li>
                  <li>Спринклерная вода — мгновенное короткое замыкание на стойку = потеря оборудования на $1–10 млн</li>
                  <li>Порошок — оседает внутри серверов, засоряет вентиляторы и разъёмы</li>
                  <li>Пена — то же самое, плюс проводит электричество</li>
                </ul>
                В смете: модуль газового тушения 1 зоны 50–100 м² — 5–15 млн тг.
                Норматив: NFPA 75 (защита IT-оборудования), NFPA 76 (телекоммуникации),
                СП РК 2.02-05 (раздел специальных систем пожаротушения).
              </div>
            )}
          </div>
        </section>

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">
          Стандарт: Uptime Institute Tier Standard (2022). Norms: NFPA 75, NFPA 76, TIA-942,
          ISO/IEC 22237. СП РК 2.02-05 (пожарная безопасность). Примеры РК: Qazcloud,
          Beeline Kazakhstan, КТ ЦОД, ГосЦОД РК. PUE-эталоны: Google 1.10, Meta 1.08.
        </div>
      </main>
    </div>
  );
}
