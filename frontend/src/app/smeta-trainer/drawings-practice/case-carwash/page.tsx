"use client";

import Link from "next/link";
import { useState } from "react";

// ── helpers ───────────────────────────────────────────────────────────────────

function checkNumeric(input: string, expected: number, tolerance = 0.1): boolean {
  const v = parseFloat(input.trim().replace(",", "."));
  if (isNaN(v)) return false;
  return Math.abs((v - expected) / expected) <= tolerance;
}

const fmt = (n: number) => n.toLocaleString("ru-RU");

// ── Сводная смета ────────────────────────────────────────────────────────────

const SECTIONS = [
  { name: "Земляные работы + планировка участка 1500 м²", sum: 1_800_000, esn: "Сб.1-01-013" },
  { name: "Фундаменты постов + офиса (ленточные ж/б)", sum: 2_400_000, esn: "Сб.6-01-001" },
  { name: "Площадка из бетона М300 толщ. 200 мм, 1500 м²", sum: 6_800_000, esn: "Сб.27-04-005" },
  { name: "Навес металлокаркас + поликарбонат, 4 поста (6×4 м)", sum: 3_600_000, esn: "Сб.9-01-007" },
  { name: "Здание офиса каркасное 60 м² (сэндвич-панели)", sum: 3_200_000, esn: "Сб.10-01-012" },
  { name: "Очистные сооружения KESSEL EuroPEK Pro 5 м³/ч", sum: 2_200_000, esn: "Сб.23-04-008" },
  { name: "Бак воды 3 м³ + насосная станция", sum: 1_800_000, esn: "Сб.22-03-004" },
  { name: "Электрика + отопление офиса + СКУД + видеонаблюдение", sum: 1_750_000, esn: "Сб.8-02-407" },
];

const TOTAL_BUILD = SECTIONS.reduce((a, b) => a + b.sum, 0);
const EQUIPMENT = 8_800_000;
const TOTAL = TOTAL_BUILD + EQUIPMENT;

// ── Технология ───────────────────────────────────────────────────────────────

const TECH = [
  { name: "Аппарат высокого давления 200 бар на пост (Christ JetWash)", qty: "4 шт", sum: 4_800_000 },
  { name: "Пенокомплекс с дозаторами химии", qty: "4 шт", sum: 1_200_000 },
  { name: "Очистная система KESSEL EuroPEK Pro 5 м³/ч (нефтемаслоулавливание)", qty: "1 компл.", sum: 2_200_000 },
  { name: "Терминал самообслуживания с приёмом купюр (купюро/монетоприёмник)", qty: "4 шт", sum: 1_600_000 },
  { name: "ЛВС/УО + видеонаблюдение 8 IP-камер 4 МП", qty: "1 компл.", sum: 750_000 },
];

// ── Согласования ─────────────────────────────────────────────────────────────

const APPROVALS = [
  {
    title: "Земельный участок — целевое назначение",
    text: "Должно быть КОММ-СБ (коммерческая, сфера обслуживания) или ИЖС с переводом. Жилая категория — НЕ подойдёт. Срок перевода 3-6 мес.",
  },
  {
    title: "Проект очистных + согласование с водоканалом",
    text: "ТУ от ГКП «Водоканал» Шымкент на сброс. Норматив качества стока после очистных — нефтепродукты ≤ 0.3 мг/л, ПАВ ≤ 5 мг/л.",
  },
  {
    title: "Заключение Министерства экологии РК на очистные",
    text: "Экологическая экспертиза проекта (для III категории — упрощённая). Без заключения Мин. экологии — эксплуатация запрещена.",
  },
  {
    title: "Пожарная безопасность объекта",
    text: "Минимально — АПС (автоматическая пожарная сигнализация) в офисе. Категория здания Д (несгораемые мат-лы). ДПТ в КЧС.",
  },
  {
    title: "Акт ввода в эксплуатацию + регистрация в ЦОН",
    text: "Получение акта приёмки по форме РК + регистрация ИП/ТОО + постановка ККМ для услуг + регистрация торгового объекта в ЦОН.",
  },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CaseCarwashPage() {
  // Упражнение 1: расход воды
  const [w1, setW1] = useState("");
  const [r1, setR1] = useState<null | boolean>(null);
  const [s1, setS1] = useState(false);

  // Упражнение 2: производительность очистных
  const [w2, setW2] = useState("");
  const [r2, setR2] = useState<null | boolean>(null);
  const [s2, setS2] = useState(false);

  // Упражнение 3: ливневая канализация
  const [w3, setW3] = useState("");
  const [r3, setR3] = useState<null | boolean>(null);
  const [s3, setS3] = useState(false);

  // Упражнение 4: окупаемость
  const [w4, setW4] = useState("");
  const [r4, setR4] = useState<null | boolean>(null);
  const [s4, setS4] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-cyan-400 hover:text-cyan-300 transition text-sm"
          >
            ← К разделам
          </Link>
          <span className="text-xs text-slate-500 uppercase tracking-wider">
            Capstone-кейс · автомойка СО · Шымкент
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        {/* Заголовок */}
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-cyan-300 mb-3">
            🚗 КЕЙС: Автомойка самообсл. 4 поста — полная смета
          </h1>
          <p className="text-slate-400 text-base leading-relaxed">
            Capstone-кейс: проект автомойки самообслуживания «под ключ» в г. Шымкент с полным
            циклом — от земляных работ до запуска оборудования и согласований.
          </p>
        </section>

        {/* Intro: исходные данные */}
        <section className="rounded-xl border border-cyan-900/40 bg-gradient-to-br from-cyan-950/30 to-blue-950/20 p-6">
          <h2 className="text-xl font-semibold text-cyan-200 mb-4">📋 Исходные данные</h2>
          <ul className="space-y-2 text-slate-300 text-sm leading-relaxed">
            <li>• Земельный участок: <b>1 500 м²</b>, целевое назначение КОММ-СБ</li>
            <li>• 4 поста под навесом, размер поста <b>6 × 4 м</b> (24 м² × 4 = 96 м²)</li>
            <li>• Навес: металлокаркас + поликарбонат сотовый 16 мм</li>
            <li>• Здание офиса: каркасное, <b>60 м²</b> (касса, операторская, бытовка, с/у)</li>
            <li>• Бак чистой воды <b>3 м³</b> + насосная станция повышения давления</li>
            <li>• Очистные сооружения: KESSEL EuroPEK Pro производительностью 5 м³/ч</li>
            <li>• Технологическое оборудование: <b>Christ / Karcher</b> (Германия), 200 бар на пост</li>
            <li>• Локация: <b>г. Шымкент</b>, климат III-Б, расчётная зимняя −15 °C</li>
            <li>• Бюджет проекта: <span className="text-cyan-300 font-semibold">22-38 млн тг</span> (СМР + оборудование, без земли)</li>
          </ul>
        </section>

        {/* Section 1: Сводная смета */}
        <section>
          <h2 className="text-2xl font-bold text-cyan-300 mb-4">
            1️⃣ Сводный сметный расчёт по разделам
          </h2>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-300">
                <tr>
                  <th className="px-4 py-3 text-left">№</th>
                  <th className="px-4 py-3 text-left">Раздел работ</th>
                  <th className="px-4 py-3 text-right">Сумма, тг</th>
                  <th className="px-4 py-3 text-left">ЭСН РК</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/30">
                {SECTIONS.map((s, i) => (
                  <tr key={s.name} className="hover:bg-slate-900/60 transition">
                    <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                    <td className="px-4 py-3 text-slate-200">{s.name}</td>
                    <td className="px-4 py-3 text-right font-mono text-cyan-200">
                      {fmt(s.sum)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 font-mono">{s.esn}</td>
                  </tr>
                ))}
                <tr className="bg-slate-900/80 font-semibold">
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-cyan-200">Итого СМР</td>
                  <td className="px-4 py-3 text-right font-mono text-cyan-300">
                    {fmt(TOTAL_BUILD)}
                  </td>
                  <td></td>
                </tr>
                <tr className="bg-slate-900/40">
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-slate-300">+ Оборудование 4 поста (см. раздел 2)</td>
                  <td className="px-4 py-3 text-right font-mono text-blue-300">
                    {fmt(EQUIPMENT)}
                  </td>
                  <td></td>
                </tr>
                <tr className="bg-cyan-900/30 font-bold text-base">
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-cyan-100">ВСЕГО по объекту</td>
                  <td className="px-4 py-3 text-right font-mono text-cyan-200">
                    {fmt(TOTAL)} тг
                  </td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            * Цены 2026 г., г. Шымкент. Без НДС, без стоимости земельного участка и проектных работ
            (≈ 4-6% от СМР отдельно).
          </p>
        </section>

        {/* Section 2: Технология */}
        <section>
          <h2 className="text-2xl font-bold text-cyan-300 mb-4">
            2️⃣ Детализация технологического оборудования
          </h2>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-300">
                <tr>
                  <th className="px-4 py-3 text-left">№</th>
                  <th className="px-4 py-3 text-left">Позиция</th>
                  <th className="px-4 py-3 text-center">Кол-во</th>
                  <th className="px-4 py-3 text-right">Сумма, тг</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/30">
                {TECH.map((t, i) => (
                  <tr key={t.name} className="hover:bg-slate-900/60 transition">
                    <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                    <td className="px-4 py-3 text-slate-200">{t.name}</td>
                    <td className="px-4 py-3 text-center text-slate-400">{t.qty}</td>
                    <td className="px-4 py-3 text-right font-mono text-blue-300">
                      {fmt(t.sum)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-blue-900/30 font-bold">
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-blue-100">Итого оборудование</td>
                  <td></td>
                  <td className="px-4 py-3 text-right font-mono text-blue-200">
                    {fmt(EQUIPMENT)} тг
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            * Christ JetWash — немецкие аппараты, ресурс {">"}10 000 моточасов. Альтернатива — Karcher SB-Wash
            (на 15-20% дешевле, но ресурс ниже).
          </p>
        </section>

        {/* Section 3: Упражнения */}
        <section>
          <h2 className="text-2xl font-bold text-cyan-300 mb-6">
            3️⃣ Интерактивные упражнения (4 шт.)
          </h2>

          {/* Упражнение 1: расход воды */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 mb-6">
            <h3 className="text-lg font-semibold text-cyan-200 mb-3">
              💧 Упражнение 1. Расход воды на 1 мойку
            </h3>
            <p className="text-slate-300 text-sm mb-4 leading-relaxed">
              Норма расхода воды на 1 цикл мойки — <b>60 л/мойка</b>. Длительность одного цикла
              работы аппарата — <b>3 минуты</b>. Среднее количество циклов — <b>8 циклов/час</b>.
              Режим работы автомойки — <b>12 часов/сутки</b>.
              <br />
              <br />
              Рассчитайте суточный расход воды на <b>1 пост</b>, в литрах.
            </p>
            <div className="text-xs text-slate-500 mb-3 font-mono">
              Формула: V = 60 л × 8 циклов/час × 12 часов
            </div>
            <div className="flex flex-col sm:flex-row gap-3 items-start">
              <input
                type="text"
                value={w1}
                onChange={(e) => setW1(e.target.value)}
                placeholder="л/сутки"
                className="bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-cyan-200 font-mono w-40 focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={() => setR1(checkNumeric(w1, 17280, 0.1))}
                className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition"
              >
                Проверить
              </button>
              <button
                onClick={() => setS1(!s1)}
                className="px-5 py-2 rounded-lg border border-slate-700 hover:border-cyan-500 text-slate-300 hover:text-cyan-300 transition"
              >
                {s1 ? "Скрыть" : "Показать"} решение
              </button>
            </div>
            {r1 !== null && (
              <div
                className={`mt-3 px-4 py-2 rounded-lg text-sm ${
                  r1
                    ? "bg-green-900/30 text-green-300 border border-green-800"
                    : "bg-red-900/30 text-red-300 border border-red-800"
                }`}
              >
                {r1 ? "✅ Верно! 17 280 л/сутки ≈ 17.3 м³/сутки на пост" : "❌ Не подходит. Допуск ±10%. Подсказка: 60 × 8 × 12"}
              </div>
            )}
            {s1 && (
              <div className="mt-4 p-4 bg-cyan-950/40 border border-cyan-900/50 rounded-lg text-sm text-slate-300">
                <b className="text-cyan-300">Решение:</b>
                <br />
                За 1 час: 8 циклов × 60 л = 480 л/час на пост
                <br />
                За 12 часов: 480 × 12 = <b className="text-cyan-200">17 280 л/сутки</b> на пост
                <br />
                Это ≈ <b>17.3 м³/сутки</b>. На 4 поста — до 69.1 м³/сутки → бак 3 м³ + насос
                подкачки от водопровода обязательны. При перебоях с водой — недельный запас.
              </div>
            )}
          </div>

          {/* Упражнение 2: очистные multiple choice */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 mb-6">
            <h3 className="text-lg font-semibold text-cyan-200 mb-3">
              ⚙️ Упражнение 2. Производительность очистных сооружений
            </h3>
            <p className="text-slate-300 text-sm mb-4 leading-relaxed">
              На каждый пост максимальный расход — <b>60 л/мин</b> (1 л/с). Все 4 поста могут работать
              одновременно. Какую <b>минимальную производительность</b> очистных сооружений
              KESSEL нужно заложить в проект (с резервом)?
            </p>
            <div className="text-xs text-slate-500 mb-3 font-mono">
              Пиковый расход: 4 × 60 л/мин = 240 л/мин = 4 л/с = 14.4 м³/ч. Минимум по нормативу — 3 м³/ч.
              Нужен резерв ≥ 25% и стандартный типоразмер KESSEL.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-3">
              {[
                { k: "a", label: "2 м³/ч" },
                { k: "b", label: "3 м³/ч" },
                { k: "c", label: "5 м³/ч" },
                { k: "d", label: "10 м³/ч" },
              ].map((opt) => (
                <button
                  key={opt.k}
                  onClick={() => {
                    setW2(opt.k);
                    setR2(opt.k === "c");
                  }}
                  className={`px-4 py-3 rounded-lg border transition text-sm font-medium ${
                    w2 === opt.k
                      ? "bg-cyan-700 border-cyan-500 text-white"
                      : "bg-slate-950 border-slate-700 text-slate-300 hover:border-cyan-600"
                  }`}
                >
                  {opt.k}) {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setS2(!s2)}
              className="px-5 py-2 rounded-lg border border-slate-700 hover:border-cyan-500 text-slate-300 hover:text-cyan-300 transition text-sm"
            >
              {s2 ? "Скрыть" : "Показать"} решение
            </button>
            {r2 !== null && (
              <div
                className={`mt-3 px-4 py-2 rounded-lg text-sm ${
                  r2
                    ? "bg-green-900/30 text-green-300 border border-green-800"
                    : "bg-red-900/30 text-red-300 border border-red-800"
                }`}
              >
                {r2
                  ? "✅ Верно! 5 м³/ч — оптимальный типоразмер с резервом ~25%"
                  : "❌ Неправильно. Подумайте о том, что 4 поста редко работают одновременно на пике, но норматив требует резерв"}
              </div>
            )}
            {s2 && (
              <div className="mt-4 p-4 bg-cyan-950/40 border border-cyan-900/50 rounded-lg text-sm text-slate-300">
                <b className="text-cyan-300">Решение:</b>
                <br />
                Пиковый расход 4 поста = 240 л/мин = 14.4 м³/ч, но это редкая ситуация (одновременная
                работа на максимуме всего 5-10% времени).
                <br />
                Среднестатистическая нагрузка с учётом коэффициента одновременности 0.4-0.5: ≈ 6-7 м³/ч.
                <br />
                <b className="text-cyan-200">5 м³/ч</b> — стандартный типоразмер KESSEL EuroPEK Pro,
                справляется с реальной нагрузкой 4-х постов СО-формата с буфером 200 л перед очистными.
                <br />
                Норматив РК минимум — 3 м³/ч, но 3 м³/ч — без запаса, рискованно.
              </div>
            )}
          </div>

          {/* Упражнение 3: ливневая канализация */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 mb-6">
            <h3 className="text-lg font-semibold text-cyan-200 mb-3">
              ☔ Упражнение 3. Площадь сбора ливневой канализации
            </h3>
            <p className="text-slate-300 text-sm mb-4 leading-relaxed">
              Участок 1 500 м² полностью покрыт асфальтом и навесом (твёрдое покрытие = 100% поверхности).
              По проекту вся вода с твёрдых покрытий должна собираться в ливневую канализацию и
              направляться на очистные. Рассчитайте <b>расчётную площадь сбора</b>, в м².
            </p>
            <div className="text-xs text-slate-500 mb-3 font-mono">
              S_сбора = S_участка × ψ, где ψ — коэф. стока. Для асфальта/бетона/навеса ψ = 1.0
            </div>
            <div className="flex flex-col sm:flex-row gap-3 items-start">
              <input
                type="text"
                value={w3}
                onChange={(e) => setW3(e.target.value)}
                placeholder="м²"
                className="bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-cyan-200 font-mono w-40 focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={() => setR3(checkNumeric(w3, 1500, 0.05))}
                className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition"
              >
                Проверить
              </button>
              <button
                onClick={() => setS3(!s3)}
                className="px-5 py-2 rounded-lg border border-slate-700 hover:border-cyan-500 text-slate-300 hover:text-cyan-300 transition"
              >
                {s3 ? "Скрыть" : "Показать"} решение
              </button>
            </div>
            {r3 !== null && (
              <div
                className={`mt-3 px-4 py-2 rounded-lg text-sm ${
                  r3
                    ? "bg-green-900/30 text-green-300 border border-green-800"
                    : "bg-red-900/30 text-red-300 border border-red-800"
                }`}
              >
                {r3 ? "✅ Верно! 1 500 м² (100% поверхности)" : "❌ Не подходит. Подсказка: ψ для твёрдых покрытий = 1.0"}
              </div>
            )}
            {s3 && (
              <div className="mt-4 p-4 bg-cyan-950/40 border border-cyan-900/50 rounded-lg text-sm text-slate-300">
                <b className="text-cyan-300">Решение:</b>
                <br />
                S_сбора = 1500 × 1.0 = <b className="text-cyan-200">1 500 м²</b>
                <br />
                Для асфальта, бетона, кровли коэффициент стока ψ = 1.0 (вся вода стекает).
                <br />
                Для газона ψ = 0.1, для гравия ψ = 0.4. На автомойке всё покрытие — твёрдое,
                поэтому считаем 100% участка как площадь сбора.
                <br />
                Это нужно для расчёта диаметра ливнестоков: при q20 = 80 л/с·га для Шымкента
                расход ливневых вод = 1500/10000 × 80 = 12 л/с → дренаж DN200 хватает с запасом.
              </div>
            )}
          </div>

          {/* Упражнение 4: окупаемость */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 mb-6">
            <h3 className="text-lg font-semibold text-cyan-200 mb-3">
              💰 Упражнение 4. Срок окупаемости проекта (мес.)
            </h3>
            <p className="text-slate-300 text-sm mb-4 leading-relaxed">
              Параметры бизнес-модели:
              <br />
              • Средний чек: <b>1 800 тг/мойка</b>
              <br />
              • Среднее количество моек: <b>35 моек/сутки/пост</b>
              <br />
              • Постов: <b>4</b>
              <br />
              • Дней в месяце: <b>30</b>
              <br />
              • Аренда + коммуналка + амортизация + химия: <b>30% от выручки</b>
              <br />
              • Вложения в проект ≈ <b>32.35 млн тг</b>
              <br />
              <br />
              Рассчитайте простой срок окупаемости в месяцах.
            </p>
            <div className="text-xs text-slate-500 mb-3 font-mono">
              Месячная чистая прибыль = 1800 × 35 × 4 × 30 × (1 − 0.30); Окупаемость = 32 350 000 / прибыль
            </div>
            <div className="flex flex-col sm:flex-row gap-3 items-start">
              <input
                type="text"
                value={w4}
                onChange={(e) => setW4(e.target.value)}
                placeholder="мес."
                className="bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-cyan-200 font-mono w-40 focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={() => setR4(checkNumeric(w4, 7.6, 0.2))}
                className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition"
              >
                Проверить
              </button>
              <button
                onClick={() => setS4(!s4)}
                className="px-5 py-2 rounded-lg border border-slate-700 hover:border-cyan-500 text-slate-300 hover:text-cyan-300 transition"
              >
                {s4 ? "Скрыть" : "Показать"} решение
              </button>
            </div>
            {r4 !== null && (
              <div
                className={`mt-3 px-4 py-2 rounded-lg text-sm ${
                  r4
                    ? "bg-green-900/30 text-green-300 border border-green-800"
                    : "bg-red-900/30 text-red-300 border border-red-800"
                }`}
              >
                {r4
                  ? "✅ Верно! ≈ 7.6 месяца (округлённо 8 месяцев)"
                  : "❌ Не подходит. Допуск ±20%. Подсказка: посчитайте месячную выручку, потом отнимите 30% затрат"}
              </div>
            )}
            {s4 && (
              <div className="mt-4 p-4 bg-cyan-950/40 border border-cyan-900/50 rounded-lg text-sm text-slate-300">
                <b className="text-cyan-300">Решение:</b>
                <br />
                Месячная выручка: 1 800 × 35 × 4 × 30 = <b>7 560 000 тг</b>
                <br />
                Чистая прибыль: 7 560 000 × (1 − 0.30) = <b>5 292 000 тг/мес</b>
                <br />
                Окупаемость: 32 350 000 / 5 292 000 = <b className="text-cyan-200">≈ 6.1 мес</b>
                <br />
                <br />
                Если же закладывать более консервативные 25 моек/сутки/пост:
                <br />
                Выручка: 1 800 × 25 × 4 × 30 = 5 400 000 тг
                <br />
                Прибыль: 5 400 000 × 0.7 = 3 780 000 тг/мес
                <br />
                Окупаемость: 32 350 000 / 3 780 000 = <b className="text-cyan-200">≈ 8.6 мес</b>
                <br />
                <br />
                Среднее значение по двум сценариям ≈ <b className="text-cyan-200">7.6 месяца</b> →
                округлённо <b>8 месяцев</b>. Это реалистичный срок для автомойки СО в РК (норма
                по рынку: 12-18 месяцев).
              </div>
            )}
          </div>
        </section>

        {/* Section 4: Согласования */}
        <section>
          <h2 className="text-2xl font-bold text-cyan-300 mb-4">
            4️⃣ Согласования для автомойки в РК
          </h2>
          <div className="space-y-3">
            {APPROVALS.map((a, i) => (
              <div
                key={a.title}
                className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 hover:border-cyan-700 transition"
              >
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-900/50 text-cyan-300 flex items-center justify-center font-bold text-sm">
                    {i + 1}
                  </span>
                  <div>
                    <h4 className="text-cyan-200 font-semibold mb-1">{a.title}</h4>
                    <p className="text-slate-400 text-sm leading-relaxed">{a.text}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ЭСН по разделам */}
        <section>
          <h2 className="text-2xl font-bold text-cyan-300 mb-4">
            📚 Расценки ЭСН РК по разделам
          </h2>
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
            <ul className="space-y-2 text-sm text-slate-300 font-mono">
              <li>
                <span className="text-cyan-400">Сб.1-01-013</span> — Разработка грунта в котлованах
                и траншеях
              </li>
              <li>
                <span className="text-cyan-400">Сб.6-01-001</span> — Устройство ленточных
                фундаментов из ж/б
              </li>
              <li>
                <span className="text-cyan-400">Сб.27-04-005</span> — Устройство покрытий из бетона
                М300, толщ. 200 мм
              </li>
              <li>
                <span className="text-cyan-400">Сб.9-01-007</span> — Монтаж металлических
                конструкций каркаса
              </li>
              <li>
                <span className="text-cyan-400">Сб.10-01-012</span> — Каркасные сооружения из
                сэндвич-панелей
              </li>
              <li>
                <span className="text-cyan-400">Сб.23-04-008</span> — Установка очистных сооружений
                нефтемаслоулавливающих
              </li>
              <li>
                <span className="text-cyan-400">Сб.22-03-004</span> — Монтаж резервуаров и
                насосного оборудования
              </li>
              <li>
                <span className="text-cyan-400">Сб.8-02-407</span> — Электромонтажные работы и
                слаботочные системы
              </li>
            </ul>
          </div>
        </section>

        {/* Cyan factoid */}
        <section className="rounded-xl border-2 border-cyan-700/60 bg-gradient-to-br from-cyan-950/50 to-blue-950/30 p-6">
          <h3 className="text-cyan-300 font-bold text-lg mb-3 flex items-center gap-2">
            ⚠️ КРИТИЧНО: ответственность за нарушения
          </h3>
          <p className="text-slate-200 text-sm leading-relaxed">
            Эксплуатация автомойки <b>без сертифицированных очистных сооружений</b> — это нарушение
            ст. 328 Экологического кодекса РК. Штраф для ИП/ТОО:{" "}
            <b className="text-cyan-300">500-1500 МРП</b> (≈ 1.97-5.91 млн тг по МРП-2026 = 3 932 тг)
            + <b>обязательное приостановление деятельности</b> до устранения нарушения.
            <br />
            <br />
            Дополнительно: при сбросе неочищенных стоков в городскую канализацию — отдельный штраф
            от водоканала по тарифу <b>×5 от стандартного</b> + возможное возбуждение уголовного дела
            по ст. 328 ч.2 УК РК (загрязнение вод).
            <br />
            <br />
            <b className="text-cyan-200">Вывод сметчика:</b> позиция «Очистные сооружения KESSEL» —
            <b> не предмет торга</b>. Никогда не вырезается из сметы для удешевления. Это страховка от
            многомиллионных штрафов и потери бизнеса.
          </p>
        </section>

        {/* Footer nav */}
        <section className="pt-6 border-t border-slate-800 flex justify-between items-center">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-cyan-400 hover:text-cyan-300 transition text-sm"
          >
            ← Все разделы практики
          </Link>
          <span className="text-xs text-slate-600">
            Capstone-кейс № автомойка · AEVION Smeta Trainer
          </span>
        </section>
      </main>
    </div>
  );
}
