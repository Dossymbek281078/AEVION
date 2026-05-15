"use client";

import Link from "next/link";
import { useState } from "react";

export default function FoodProductionPage() {
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
    const v = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
    if (!isFinite(v)) return setEx3Res("bad");
    setEx3Res(Math.abs(v - 1_650_000_000) <= 50_000_000 ? "ok" : "bad");
  };
  const checkEx4 = () => setEx4Res(ex4 === "d" ? "ok" : "bad");

  const enterpriseTypes = [
    {
      type: "Хлебозавод",
      features: "Печи туннельные и ротационные, мощные системы вентиляции от теплоизбытков",
      norms: "ГОСТ Р 52462-2005, СанПиН «Хлебопекарное производство»",
      cost: "300–500 тыс. тг/м²",
    },
    {
      type: "Молочный завод",
      features: "Пастеризаторы, сепараторы, CIP-мойка, холодильные туннели (0–4°C)",
      norms: "ТР ТС 033/2013, СанПиН молочная промышленность",
      cost: "400–700 тыс. тг/м²",
    },
    {
      type: "Мясокомбинат",
      features: "Охлаждаемые камеры убоя, морозильники −18°C, жёсткое зонирование потоков",
      norms: "ТР ТС 034/2013, ветеринарные нормы РК",
      cost: "450–750 тыс. тг/м²",
    },
    {
      type: "Кондитерская фабрика",
      features: "Температурный контроль цехов (+18–20°C), шоколадные темперирующие машины",
      norms: "ГОСТ 15.015-90, СанПиН кондитерское производство",
      cost: "350–600 тыс. тг/м²",
    },
    {
      type: "Птицефабрика",
      features: "Инкубаторы, цех убоя, глубокая заморозка, биозащитные шлюзы",
      norms: "ТР ТС 021/2011, ветнадзор РК",
      cost: "400–650 тыс. тг/м²",
    },
    {
      type: "Элеватор и мукомольный завод",
      features: "Силосные башни, нории, аспирация зерновой пыли (взрывоопасность!)",
      norms: "ПБ 14-586-03, ГОСТ Р 54463-2011",
      cost: "200–400 тыс. тг/м²",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/smeta-trainer/drawings-practice"
            className="text-sm text-lime-300 hover:text-lime-200 transition"
          >
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Пищевые производства</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            🏭 Пищевые производства (заводы и цеха)
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            Строительство пищевых предприятий — специализированная область с жёсткими
            санитарными требованиями, системой HACCP и специальными материалами отделки.
            Стоимость варьируется от{" "}
            <strong className="text-lime-300">300 до 750 тыс. тг/м²</strong> в зависимости
            от типа производства.
          </p>
          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-lime-900/40 rounded-lg p-3 bg-lime-950/20">
              <div className="text-lime-500 uppercase tracking-wider mb-1">Система безопасности</div>
              <div className="text-slate-300">HACCP (обязательна для экспорта ЕС/РФ)</div>
            </div>
            <div className="border border-lime-900/40 rounded-lg p-3 bg-lime-950/20">
              <div className="text-lime-500 uppercase tracking-wider mb-1">Материал оборудования</div>
              <div className="text-slate-300">Нержавеющая сталь AISI 304/316</div>
            </div>
            <div className="border border-lime-900/40 rounded-lg p-3 bg-lime-950/20">
              <div className="text-lime-500 uppercase tracking-wider mb-1">Уклон полов</div>
              <div className="text-slate-300">1–2% к трапам — обязателен</div>
            </div>
          </div>
        </section>

        {/* Раздел 1 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-lime-300">
            📊 Раздел 1. Типы пищевых предприятий
          </h2>
          <p className="text-sm text-slate-400">
            Каждый тип пищевого предприятия имеет свои технологические особенности,
            нормативную базу и диапазон стоимости строительства.
          </p>
          <div className="overflow-x-auto border border-lime-900/30 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 w-40">Тип предприятия</th>
                  <th className="text-left px-4 py-3">Особенности</th>
                  <th className="text-left px-4 py-3 w-52">Нормативы</th>
                  <th className="text-left px-4 py-3 w-40">Стоимость строит.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {enterpriseTypes.map((r) => (
                  <tr key={r.type} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 font-bold text-lime-300 text-sm whitespace-nowrap">
                      {r.type}
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{r.features}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{r.norms}</td>
                    <td className="px-4 py-3 font-mono text-emerald-300 text-xs whitespace-nowrap">
                      {r.cost}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Раздел 2 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-lime-300">
            🔩 Раздел 2. Специальные требования строительства
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                icon: "🔧",
                title: "Нержавеющая сталь AISI 304/316",
                desc: "Оборудование, трубопроводы, поверхности, контактирующие с продуктом. AISI 316 — для кислых сред (молочное, фруктовое). Все сварные швы — зачищены, полированы.",
              },
              {
                icon: "🌊",
                title: "Полы с уклоном 1–2% к трапу",
                desc: "Эпоксидный или полиуретановый наливной пол, либо кислотостойкая плитка. Антискользящая поверхность обязательна. Трапы из нержавеющей стали с сетчатыми корзинами.",
              },
              {
                icon: "🏛",
                title: "Гигиеническая штукатурка (EP/PU-покрытие)",
                desc: "Стены: эпоксидное или полиуретановое покрытие на 2–2.4 м от пола. Все углы — радиусные (нет прямых углов — нет грязевых ловушек). Моется под давлением паром.",
              },
              {
                icon: "❄",
                title: "Холодильные камеры",
                desc: "Камеры хранения: +2..+6°C. Камеры заморозки: −18..−25°C. Стены — сэндвич-панели PIR 100–200 мм. Полы с подогревом (предотвращение промерзания грунта).",
              },
            ].map((f) => (
              <div key={f.title} className="border border-lime-900/30 bg-lime-950/10 rounded-xl p-5">
                <h3 className="text-base font-semibold text-lime-300 mb-2">
                  {f.icon} {f.title}
                </h3>
                <p className="text-sm text-slate-300">{f.desc}</p>
              </div>
            ))}
          </div>
          <div className="border border-slate-800 rounded-xl p-4 bg-slate-900/30 text-sm text-slate-400">
            <strong className="text-lime-300">Система HACCP в строительстве:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
              <li>
                Определяет зонирование: «грязные» и «чистые» зоны разделяются физически
              </li>
              <li>
                Между зонами — шлюзы с умывальниками, дезинфекционными ваннами и
                воздушными завесами
              </li>
              <li>
                Материалы отделки должны выдерживать химическую дезинфекцию (хлор,
                перекись)
              </li>
              <li>
                Вентиляция: от «чистых» зон к «грязным» (избыточное давление в чистой
                зоне)
              </li>
            </ul>
          </div>
        </section>

        {/* Раздел 3 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-lime-300">
            🧼 Раздел 3. Санитарные нормы пищевых предприятий
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-slate-800 bg-slate-900/30 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-lime-300">Разделение потоков</h3>
              <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                <li>
                  «Грязные» потоки (сырьё, отходы) не пересекаются с «чистыми» (готовая
                  продукция)
                </li>
                <li>
                  Шлюзы между зонами: умывальники с локтевым/сенсорным управлением
                </li>
                <li>
                  Дезинфекционные ванны для обуви при входе в производственные цеха
                </li>
                <li>Воздушные завесы или двери-ловушки между зонами</li>
              </ul>
            </div>
            <div className="border border-slate-800 bg-slate-900/30 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-lime-300">Санузлы и вентиляция</h3>
              <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                <li>Санузел: 1 на 25 человек (СанПиН «Пищевые предприятия»)</li>
                <li>Отдельные туалеты для персонала «грязной» и «чистой» зон</li>
                <li>
                  Вентиляция: приточная — в чистые зоны, вытяжная — из грязных
                </li>
                <li>
                  Температурный режим в рабочих зонах: +16..+20°C (нормируется по типу)
                </li>
                <li>
                  Системы холодоснабжения: отдельный технический проект (СП РК)
                </li>
              </ul>
            </div>
          </div>
          <div className="border border-lime-900/20 bg-lime-950/10 rounded-xl p-4 text-sm">
            <strong className="text-lime-300">Ключевые нормативные документы:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1 text-xs text-slate-400">
              <li>
                СанПиН РК «Санитарные правила для предприятий пищевой промышленности»
              </li>
              <li>
                ТР ТС 021/2011 «О безопасности пищевой продукции» (технический регламент
                ЕАЭС)
              </li>
              <li>
                ГОСТ ISO 22000-2019 «Системы менеджмента безопасности пищевой продукции»
                (HACCP)
              </li>
              <li>
                СП РК 4.02-101 «Отопление, вентиляция и кондиционирование» (для пищевых
                объектов)
              </li>
              <li>
                СН РК 3.02-43 «Предприятия пищевой промышленности» — объёмно-планировочные
                решения
              </li>
            </ul>
          </div>
        </section>

        {/* Раздел 4 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-lime-300">
            💰 Раздел 4. Бенчмарки стоимости строительства в РК
          </h2>
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Тип предприятия</th>
                  <th className="text-left px-4 py-3 w-52">Стоимость строит. (тг/м²)</th>
                  <th className="text-left px-4 py-3">Комментарий</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {[
                  ["Хлебозавод", "300 000 – 500 000", "Основные затраты: печи, вентиляция, полы"],
                  [
                    "Молочный завод",
                    "400 000 – 700 000",
                    "Пастеризаторы, CIP-системы, холодильники",
                  ],
                  [
                    "Мясокомбинат",
                    "450 000 – 750 000",
                    "Холодильные цепочки, санитарные шлюзы",
                  ],
                  [
                    "Кондитерская фабрика",
                    "350 000 – 600 000",
                    "Климат-контроль, чистые зоны",
                  ],
                  [
                    "Птицефабрика",
                    "400 000 – 650 000",
                    "Биозащита, инкубаторы, заморозка",
                  ],
                  [
                    "Элеватор/мукомольный",
                    "200 000 – 400 000",
                    "Силосы, нории, аспирация пыли",
                  ],
                ].map((row) => (
                  <tr key={row[0]} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 font-bold text-lime-300 text-sm">{row[0]}</td>
                    <td className="px-4 py-3 font-mono text-emerald-300 text-xs whitespace-nowrap">
                      {row[1]} тг/м²
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs italic">{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">
            * Бенчмарки для РК на 2024–2025 гг. Стоимость «под ключ» включает: строительные
            работы, отделку пищевого класса, вентиляцию, технологические трубопроводы,
            инженерные сети. Оборудование (линии, автоматика) учитывается отдельно.
          </p>
        </section>

        {/* Упражнения */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Упражнения</h2>

          {/* Упр. 1 */}
          <div className="border border-lime-900/30 rounded-xl p-5 bg-lime-950/10">
            <div className="text-xs text-lime-600 uppercase tracking-wider mb-2">
              Упражнение 1 / 4 — Требования к полам
            </div>
            <div className="text-slate-200 mb-4">
              Полы в цехах пищевых предприятий по СанПиН требуют:
            </div>
            <div className="space-y-2 text-sm">
              {[
                {
                  v: "a",
                  t: "Плитка любого типа — главное, чтобы была влагостойкой",
                },
                {
                  v: "b",
                  t: "Деревянный или ламинатный пол с антисептической пропиткой — разрешён в сухих зонах",
                },
                {
                  v: "c",
                  t: "Уклон 1–2% к трапам + антискользящее покрытие + материал, устойчивый к моющим средствам (эпоксидный/полиуретановый наливной пол или кислотостойкая плитка)",
                },
                {
                  v: "d",
                  t: "Наливной пол любого состава — достаточно ровной и гладкой поверхности",
                },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-start gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex1 === opt.v
                      ? "border-lime-600 bg-lime-950/30"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex1"
                    value={opt.v}
                    checked={ex1 === opt.v}
                    onChange={() => setEx1(opt.v)}
                    className="accent-lime-500 mt-0.5"
                  />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button
                onClick={checkEx1}
                className="px-4 py-2 bg-lime-700 hover:bg-lime-600 text-white rounded transition text-sm"
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
                  ✅ Верно!
                </span>
              )}
              {ex1Res === "bad" && (
                <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">
                  ❌ Неверно — перечитай раздел 2
                </span>
              )}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-lime-300">Решение:</strong> Правильный ответ —{" "}
                <strong>в</strong>. Полы в пищевых цехах должны одновременно:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>
                    Иметь уклон 1–2% к трапам для стока воды при мойке
                  </li>
                  <li>
                    Быть антискользящими (требование охраны труда — мокрый пол при работе)
                  </li>
                  <li>
                    Выдерживать агрессивные моющие и дезинфицирующие средства
                  </li>
                  <li>
                    Эпоксидный или ПУ-наливной пол: стоимость 4 000–8 000 тг/м² (ЭСН Сб.11)
                  </li>
                  <li>
                    Кислотостойкая плитка: 6 000–12 000 тг/м² с укладкой
                  </li>
                </ul>
              </div>
            )}
          </div>

          {/* Упр. 2 */}
          <div className="border border-lime-900/30 rounded-xl p-5 bg-lime-950/10">
            <div className="text-xs text-lime-600 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Система HACCP
            </div>
            <div className="text-slate-200 mb-4">
              HACCP — что это такое и как влияет на строительство?
            </div>
            <div className="space-y-2 text-sm">
              {[
                {
                  v: "a",
                  t: "Hazard Awareness Construction Control Program — программа безопасности труда на стройке",
                },
                {
                  v: "b",
                  t: "Hazard Analysis Critical Control Points — система пищевой безопасности, обязательная для экспорта в ЕС/РФ. В строительстве определяет зонирование, материалы отделки, температурные требования",
                },
                {
                  v: "c",
                  t: "High Automated Cooling and Cleaning Process — автоматическая система мойки оборудования",
                },
                {
                  v: "d",
                  t: "Health Approved Construction Certificate — строительный сертификат санитарного соответствия",
                },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-start gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex2 === opt.v
                      ? "border-lime-600 bg-lime-950/30"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex2"
                    value={opt.v}
                    checked={ex2 === opt.v}
                    onChange={() => setEx2(opt.v)}
                    className="accent-lime-500 mt-0.5"
                  />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button
                onClick={checkEx2}
                className="px-4 py-2 bg-lime-700 hover:bg-lime-600 text-white rounded transition text-sm"
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
                  ✅ Верно!
                </span>
              )}
              {ex2Res === "bad" && (
                <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">
                  ❌ Неверно
                </span>
              )}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-lime-300">Решение:</strong> HACCP (Hazard Analysis
                Critical Control Points) — международная система управления безопасностью
                пищевой продукции.
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Обязательна для экспорта продукции в ЕС и РФ (ТР ТС 021/2011)</li>
                  <li>
                    В РК внедрена через ГОСТ ISO 22000 и технические регламенты ЕАЭС
                  </li>
                  <li>
                    Для строителя: диктует планировочные решения (разделение потоков, шлюзы)
                  </li>
                  <li>
                    Определяет тип отделки, материалы трубопроводов, требования к вентиляции
                  </li>
                  <li>
                    Без HACCP завод не получит сертификат для поставки в торговые сети
                  </li>
                </ul>
              </div>
            )}
          </div>

          {/* Упр. 3 */}
          <div className="border border-lime-900/30 rounded-xl p-5 bg-lime-950/10">
            <div className="text-xs text-lime-600 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — Расчёт бюджета молочного завода
            </div>
            <div className="text-slate-200 mb-4">
              Молочный завод площадью <strong>3 000 м²</strong>. Стоимость строительства:{" "}
              <strong>550 тыс. тг/м²</strong> (среднее по бенчмарку). Рассчитайте бюджет
              строительства в тенге.
            </div>
            <div className="text-xs text-slate-400 italic mb-3">
              💡 Бюджет = площадь × стоимость за м²
            </div>
            <div className="flex gap-3 items-center flex-wrap">
              <input
                type="text"
                value={ex3}
                onChange={(e) => setEx3(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && checkEx3()}
                placeholder="Введите число (тг)..."
                className="flex-1 min-w-[200px] border border-slate-700 rounded px-3 py-2 text-sm font-mono bg-slate-900 text-slate-200 focus:outline-none focus:ring-1 focus:ring-lime-500"
              />
              <button
                onClick={checkEx3}
                className="px-4 py-2 bg-lime-700 hover:bg-lime-600 text-white rounded transition text-sm"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx3Sol((v) => !v)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm"
              >
                {ex3Sol ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {ex3Res === "ok" && (
              <p className="mt-3 text-emerald-300 text-sm">
                ✅ Верно! Бюджет рассчитан правильно.
              </p>
            )}
            {ex3Res === "bad" && (
              <p className="mt-3 text-red-300 text-sm">❌ Неверно. Проверьте расчёт.</p>
            )}
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-lime-300">Решение:</strong> 3 000 м² × 550 000
                тг/м² ={" "}
                <strong className="text-emerald-300">
                  1 650 000 000 тг (1.65 млрд тг)
                </strong>
                .
                <p className="text-xs mt-2 text-slate-400">
                  Допуск ±50 000 000 тг (±3%). В данную сумму входит строительство, отделка
                  пищевого класса, вентиляция, технологические трубопроводы, инженерные
                  сети. Оборудование (пастеризаторы, сепараторы) — отдельная статья бюджета.
                </p>
              </div>
            )}
          </div>

          {/* Упр. 4 */}
          <div className="border border-lime-900/30 rounded-xl p-5 bg-lime-950/10">
            <div className="text-xs text-lime-600 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — Запрещённые материалы
            </div>
            <div className="text-slate-200 mb-4">
              В молочном цехе нельзя применять:
            </div>
            <div className="space-y-2 text-sm">
              {[
                {
                  v: "a",
                  t: "Нержавеющую сталь AISI 304 для трубопроводов — слишком дорого, можно заменить оцинковкой",
                },
                {
                  v: "b",
                  t: "Эпоксидные покрытия стен — не выдерживают паровую мойку",
                },
                {
                  v: "c",
                  t: "Кислотостойкую плитку — накапливает загрязнения в швах",
                },
                {
                  v: "d",
                  t: "Деревянные конструкции и покрытия — гигиена невозможна, впитывают бактерии, не выдерживают паровую стерилизацию",
                },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-start gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex4 === opt.v
                      ? "border-lime-600 bg-lime-950/30"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex4"
                    value={opt.v}
                    checked={ex4 === opt.v}
                    onChange={() => setEx4(opt.v)}
                    className="accent-lime-500 mt-0.5"
                  />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button
                onClick={checkEx4}
                className="px-4 py-2 bg-lime-700 hover:bg-lime-600 text-white rounded transition text-sm"
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
                  ✅ Верно!
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
                <strong className="text-lime-300">Решение:</strong> Правильный ответ —{" "}
                <strong>г</strong>. Дерево категорически запрещено в пищевых производствах.
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>
                    Пористая структура дерева впитывает жиры, белки и влагу — питательная
                    среда для бактерий
                  </li>
                  <li>
                    Не выдерживает паровую стерилизацию (120°C, давление) — деформируется,
                    трескается
                  </li>
                  <li>
                    Запрещено СанПиН и ТР ТС 021/2011 для поверхностей в производственных
                    зонах
                  </li>
                  <li>
                    Оцинкованная сталь: допустима для несущих конструкций вне контакта с
                    продуктом
                  </li>
                  <li>
                    Эпоксид и кислотостойкая плитка — оба варианта разрешены и применяются
                  </li>
                </ul>
              </div>
            )}
          </div>
        </section>

        {/* Нормативная база */}
        <section className="border border-lime-900/20 bg-lime-950/10 rounded-xl p-5 space-y-2">
          <h2 className="text-base font-bold text-lime-300">
            📚 Нормативная база и ЭСН для пищевых предприятий
          </h2>
          <ul className="text-xs text-slate-400 space-y-1.5">
            <li>
              <strong className="text-lime-300">ЭСН Сб.11</strong> «Полы» — наливные,
              кислотостойкие покрытия
            </li>
            <li>
              <strong className="text-lime-300">ЭСН Сб.15</strong> «Отделочные работы» —
              эпоксидные покрытия стен и потолков
            </li>
            <li>
              <strong className="text-lime-300">СН РК 3.02-43</strong> «Предприятия пищевой
              промышленности» — основной нормативный документ планировки
            </li>
            <li>
              <strong className="text-lime-300">ТР ТС 021/2011</strong> «О безопасности
              пищевой продукции» (технический регламент ЕАЭС)
            </li>
            <li>
              <strong className="text-lime-300">ГОСТ ISO 22000-2019</strong> — системы
              менеджмента HACCP
            </li>
            <li>
              <strong className="text-lime-300">ССЦ РК</strong> — сборники сметных цен на
              материалы: нержавеющая сталь, эпоксидные составы, холодильные панели
            </li>
          </ul>
        </section>

        {/* Факт сметчика */}
        <section className="bg-slate-900 border border-slate-700 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <h3 className="text-sm font-bold mb-1 text-lime-300">Факт сметчика</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                В смете пищевого производства отделка пола и стен составляет{" "}
                <strong className="text-lime-300">15–25%</strong> от стоимости строительства.
                Отдельно учитывайте:{" "}
                <strong>технологические трубопроводы (нержавейка)</strong> — до 20% бюджета,{" "}
                <strong>холодоснабжение</strong> — 10–15%, и{" "}
                <strong>вентиляцию с фильтрацией</strong> — 10–15%. Оборудование (линии,
                автоматика) — это отдельный раздел сметы, не строительный.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
