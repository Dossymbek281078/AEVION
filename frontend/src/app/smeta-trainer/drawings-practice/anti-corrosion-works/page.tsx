"use client";

import Link from "next/link";
import { useState } from "react";

export default function AntiCorrosionWorksPage() {
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
    const v = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
    if (!isFinite(v)) return setEx3Res("bad");
    setEx3Res(Math.abs(v - 250_000) <= 5_000 ? "ok" : "bad");
  };
  const checkEx4 = () => setEx4Res(ex4 === "c" ? "ok" : "bad");

  const aggressivenessLevels = [
    {
      level: "Слабоагрессивная",
      iso: "C1",
      examples: "Отапливаемые закрытые помещения: офисы, жилые дома",
      protection: "Грунт-эмаль 1 слой, срок 5–10 лет",
    },
    {
      level: "Умеренноагрессивная",
      iso: "C2–C3",
      examples: "Наружные конструкции в сухом климате, склады",
      protection: "Грунт + 2 слоя эмали, срок 7–15 лет",
    },
    {
      level: "Сильноагрессивная",
      iso: "C4",
      examples: "Химические производства, морской берег, нефтяные объекты",
      protection: "Zn-грунт + эпоксид + ПУ-финиш, срок 10–20 лет",
    },
    {
      level: "Особо агрессивная",
      iso: "C5-M / Im",
      examples: "Морские платформы, Каспий, химические реакторы, подземные трубы",
      protection: "Многослойная система + катодная защита, срок 20–40 лет",
    },
  ];

  const protectionMethods = [
    {
      method: "Лакокрасочные покрытия (ЛКП)",
      use: "Металлоконструкции зданий, резервуары, трубопроводы",
      life: "15–25 лет",
      cost: "1.2–2.5 тыс. тг/м²",
    },
    {
      method: "Горячее цинкование",
      use: "Фермы, опоры, эстакады, элементы ограждений",
      life: "40–80 лет",
      cost: "95–145 тыс. тг/т",
    },
    {
      method: "Холодное цинкование (Zn-силикатные грунты)",
      use: "Крупногабаритные конструкции (не влезающие в ванну)",
      life: "20–35 лет",
      cost: "3–6 тыс. тг/м²",
    },
    {
      method: "Металлизация (напыление Zn/Al)",
      use: "Мосты, резервуары, морские конструкции",
      life: "30–50 лет",
      cost: "8–15 тыс. тг/м²",
    },
    {
      method: "Протекторная защита (катодная)",
      use: "Подземные трубопроводы, опоры мостов в воде, причалы",
      life: "Срок = ресурс анодов (5–15 лет)",
      cost: "По проекту",
    },
    {
      method: "Спецпокрытия (ПУ/эпоксид) для нефтегаза",
      use: "Внутренняя поверхность нефте- и газопроводов",
      life: "15–30 лет",
      cost: "12–25 тыс. тг/м²",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/smeta-trainer/drawings-practice"
            className="text-sm text-orange-300 hover:text-orange-200 transition"
          >
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">
            AEVION Smeta Trainer · Антикоррозионная защита
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            🛡 Антикоррозионная защита
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            Антикоррозионная защита — обязательный раздел сметы для металлоконструкций,
            трубопроводов и мостовых сооружений. Без надлежащей защиты срок службы
            стальных конструкций снижается с{" "}
            <strong className="text-orange-300">40–80 до 5–15 лет</strong>. В РК
            особую роль играет защита нефтегазовой инфраструктуры на Каспии.
          </p>
          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-orange-900/40 rounded-lg p-3 bg-orange-950/20">
              <div className="text-orange-500 uppercase tracking-wider mb-1">
                Стандарт классификации
              </div>
              <div className="text-slate-300">ISO 12944 (степень коррозионной активности)</div>
            </div>
            <div className="border border-orange-900/40 rounded-lg p-3 bg-orange-950/20">
              <div className="text-orange-500 uppercase tracking-wider mb-1">
                Лучший метод по сроку службы
              </div>
              <div className="text-slate-300">Горячее цинкование — до 80 лет</div>
            </div>
            <div className="border border-orange-900/40 rounded-lg p-3 bg-orange-950/20">
              <div className="text-orange-500 uppercase tracking-wider mb-1">
                Нормативная база РК
              </div>
              <div className="text-slate-300">ЭСН Сб.12, СП РК 5.04-23, ГОСТ 9.032-74</div>
            </div>
          </div>
        </section>

        {/* Раздел 1 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-orange-300">
            📊 Раздел 1. Степени агрессивности среды
          </h2>
          <p className="text-sm text-slate-400">
            По ISO 12944 выделяют 4 основные категории коррозионной активности среды.
            Чем выше категория — тем сложнее и дороже требуемая система защиты.
          </p>
          <div className="overflow-x-auto border border-orange-900/30 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 w-44">Степень агрессивности</th>
                  <th className="text-left px-4 py-3 w-28">ISO 12944</th>
                  <th className="text-left px-4 py-3">Примеры</th>
                  <th className="text-left px-4 py-3">Требуемая защита</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {aggressivenessLevels.map((r) => (
                  <tr key={r.level} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 font-bold text-orange-300 text-sm whitespace-nowrap">
                      {r.level}
                    </td>
                    <td className="px-4 py-3 font-mono text-amber-300 text-xs">{r.iso}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{r.examples}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{r.protection}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Раздел 2 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-orange-300">
            🔧 Раздел 2. Методы антикоррозионной защиты
          </h2>
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Метод</th>
                  <th className="text-left px-4 py-3">Применение</th>
                  <th className="text-left px-4 py-3 w-32">Срок службы</th>
                  <th className="text-left px-4 py-3 w-40">Стоимость</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {protectionMethods.map((r) => (
                  <tr key={r.method} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 font-semibold text-orange-300 text-sm">
                      {r.method}
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{r.use}</td>
                    <td className="px-4 py-3 text-emerald-300 text-xs font-mono whitespace-nowrap">
                      {r.life}
                    </td>
                    <td className="px-4 py-3 text-amber-300 text-xs font-mono whitespace-nowrap">
                      {r.cost}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border border-slate-800 rounded-xl p-4 bg-slate-900/30 text-sm text-slate-400">
            <strong className="text-orange-300">Системы покрытий для Алматы (C3–C4):</strong>
            <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
              <li>
                Базовый минимум: эпоксидный Zn-фосфатный грунт 60–80 мкм + алкидная эмаль
                2 × 40 мкм
              </li>
              <li>
                Расширенная: Zn-богатый грунт 60 мкм + эпоксид 120 мкм + ПУ-финиш 50 мкм
              </li>
              <li>
                Для нефтегаза (C5): Zn-силикатный 75 мкм + эпоксид 150 мкм + ПУ 75 мкм
              </li>
              <li>Общая сухая толщина для C3: минимум 160 мкм; для C5: минимум 300 мкм</li>
            </ul>
          </div>
        </section>

        {/* Раздел 3 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-orange-300">
            📚 Раздел 3. Нормативная база (ЭСН и ГОСТы)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                icon: "📋",
                title: "ЭСН Сб.12 «Антикоррозионная защита»",
                desc: "Основной сборник ЭСН для антикора в РК. Содержит расценки на все виды покрытий: грунтование, окраска, цинкование. Единица измерения — м² поверхности или т конструкций.",
              },
              {
                icon: "🌍",
                title: "ISO 12944 (степень коррозионной активности)",
                desc: "Международный стандарт классификации сред и требований к покрытиям. Применяется при проектировании объектов с иностранным участием и в нефтегазовой отрасли РК.",
              },
              {
                icon: "🏗",
                title: "СП РК 5.04-23 «Металлоконструкции»",
                desc: "Свод правил для стальных конструкций в РК. Устанавливает требования к антикоррозионной защите в зависимости от условий эксплуатации и срока службы объекта.",
              },
              {
                icon: "🔬",
                title: "ГОСТ 9.032-74 «ЛКП. Группы, технические требования»",
                desc: "Классификация лакокрасочных покрытий по условиям эксплуатации (группы У/УХЛ/ХЛ/Т/О/В/ОМ/М). Определяет допустимые материалы и число слоёв для каждой группы.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="border border-orange-900/30 bg-orange-950/10 rounded-xl p-5"
              >
                <h3 className="text-base font-semibold text-orange-300 mb-2">
                  {f.icon} {f.title}
                </h3>
                <p className="text-sm text-slate-300">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Раздел 4 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-orange-300">
            ⚖ Раздел 4. Горячее цинкование vs ЛКП в Алматы
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-orange-900/30 bg-orange-950/10 rounded-xl p-5">
              <h3 className="text-base font-semibold text-orange-300 mb-3">
                🔥 Горячее цинкование
              </h3>
              <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside">
                <li>Погружение конструкции в расплавленный цинк (450°C)</li>
                <li>
                  <strong className="text-emerald-300">Срок службы: 40–80 лет</strong> без
                  обслуживания
                </li>
                <li>
                  Цинк «лечит» царапины: жертвенная анодная защита (Zn растворяется вместо Fe)
                </li>
                <li>
                  Стоимость: 95 000–145 000 тг/т (зависит от завода и объёма партии)
                </li>
                <li>Ограничение: габариты ванны; не для сборных конструкций на месте</li>
                <li>Применение: фермы, опоры ЛЭП, ограждения, мачты</li>
              </ul>
            </div>
            <div className="border border-slate-800 bg-slate-900/30 rounded-xl p-5">
              <h3 className="text-base font-semibold text-slate-300 mb-3">
                🎨 Лакокрасочные покрытия (ЛКП)
              </h3>
              <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside">
                <li>Нанесение кистью, валиком, пневмо- или безвоздушным распылением</li>
                <li>
                  <strong className="text-amber-300">Срок службы: 15–25 лет</strong> (при
                  правильном нанесении и условиях)
                </li>
                <li>Требуют подготовки поверхности: очистка Sa 2.5 по ISO 8501-1</li>
                <li>
                  Стоимость системы Zn-эпокси+ПУ: 3 500–6 000 тг/м² (ЭСН Сб.12)
                </li>
                <li>Гибкость: можно наносить на смонтированные конструкции на объекте</li>
                <li>Применение: любые конструкции, крупногабаритные блоки</li>
              </ul>
            </div>
          </div>
          <div className="border border-orange-900/20 bg-orange-950/10 rounded-xl p-4 text-sm">
            <strong className="text-orange-300">Вывод для сметчика:</strong>
            <p className="text-xs text-slate-400 mt-2">
              Для ответственных конструкций с расчётным сроком эксплуатации 50+ лет
              (мосты, опоры эстакад) горячее цинкование экономически выгоднее на
              жизненном цикле, несмотря на более высокую первоначальную стоимость.
              Перекраска ЛКП каждые 15–20 лет обходится дороже в сумме.
            </p>
          </div>
        </section>

        {/* Упражнения */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Упражнения</h2>

          {/* Упр. 1 */}
          <div className="border border-orange-900/30 rounded-xl p-5 bg-orange-950/10">
            <div className="text-xs text-orange-600 uppercase tracking-wider mb-2">
              Упражнение 1 / 4 — Категория агрессивности
            </div>
            <div className="text-slate-200 mb-4">
              Нефтепровод в морской среде (Каспийское море) — какая категория
              коррозионной агрессивности по ISO 12944?
            </div>
            <div className="space-y-2 text-sm">
              {[
                {
                  v: "a",
                  t: "C1 — слабоагрессивная, стандартная окраска достаточна",
                },
                {
                  v: "b",
                  t: "C2 — умеренноагрессивная, достаточно грунта и одного слоя эмали",
                },
                {
                  v: "c",
                  t: "C4 — сильноагрессивная, требует Zn-грунт + эпоксид",
                },
                {
                  v: "d",
                  t: "C5-M / Im (особо агрессивная) — требует многослойной системы Zn-грунт + эпоксид + ПУ-финиш; для подводной части — катодная защита",
                },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-start gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex1 === opt.v
                      ? "border-orange-600 bg-orange-950/30"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex1"
                    value={opt.v}
                    checked={ex1 === opt.v}
                    onChange={() => setEx1(opt.v)}
                    className="accent-orange-500 mt-0.5"
                  />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button
                onClick={checkEx1}
                className="px-4 py-2 bg-orange-700 hover:bg-orange-600 text-white rounded transition text-sm"
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
                  ❌ Неверно — см. таблицу раздела 1
                </span>
              )}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-orange-300">Решение:</strong> Правильный ответ —{" "}
                <strong>г</strong>. Морская среда Каспия — особо агрессивная.
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>
                    ISO 12944 категория C5-M (Marine) — для атмосферы морского побережья
                  </li>
                  <li>
                    Im (Immersion) — для конструкций, постоянно или периодически
                    погружённых в морскую воду
                  </li>
                  <li>
                    Система покрытий: Zn-силикатный грунт 75 мкм + эпоксид 2 × 100 мкм +
                    ПУ-финиш 75 мкм = итого 350+ мкм
                  </li>
                  <li>
                    Для подводной части — обязательна катодная протекторная защита
                    (жертвенные аноды из Al-Zn-In)
                  </li>
                  <li>
                    Нормируется: РД 39-132-94 (нефтяная и газовая промышленность РФ/ЕАЭС),
                    ISO 12944-5
                  </li>
                </ul>
              </div>
            )}
          </div>

          {/* Упр. 2 */}
          <div className="border border-orange-900/30 rounded-xl p-5 bg-orange-950/10">
            <div className="text-xs text-orange-600 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Преимущества горячего цинкования
            </div>
            <div className="text-slate-200 mb-4">
              Горячее цинкование — в чём главное преимущество перед лакокрасочными
              покрытиями (ЛКП)?
            </div>
            <div className="space-y-2 text-sm">
              {[
                {
                  v: "a",
                  t: "Дешевле по первоначальной стоимости, чем ЛКП",
                },
                {
                  v: "b",
                  t: "Защита 40–80 лет без обслуживания (vs 15–25 лет ЛКП), цинк «лечит» царапины путём жертвенной анодной защиты",
                },
                {
                  v: "c",
                  t: "Можно наносить на конструкции любого размера прямо на строительной площадке",
                },
                {
                  v: "d",
                  t: "Не требует подготовки поверхности перед нанесением",
                },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-start gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex2 === opt.v
                      ? "border-orange-600 bg-orange-950/30"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex2"
                    value={opt.v}
                    checked={ex2 === opt.v}
                    onChange={() => setEx2(opt.v)}
                    className="accent-orange-500 mt-0.5"
                  />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button
                onClick={checkEx2}
                className="px-4 py-2 bg-orange-700 hover:bg-orange-600 text-white rounded transition text-sm"
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
                <strong className="text-orange-300">Решение:</strong> Правильный ответ —{" "}
                <strong>б</strong>. Ключевые преимущества горячего цинкования:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>
                    Жертвенная анодная защита: Zn электрохимически активнее Fe, поэтому
                    цинк «жертвует собой», защищая сталь даже в местах царапин
                  </li>
                  <li>
                    Срок службы 40–80 лет подтверждён объектами 1950-х годов (мосты,
                    опоры ЛЭП) в Западной Европе
                  </li>
                  <li>
                    Горячее цинкование ДОРОЖЕ ЛКП по первоначальной стоимости, но дешевле
                    на жизненном цикле объекта
                  </li>
                  <li>
                    Требует доставки конструкций на завод горячего цинкования (в Алматы —
                    несколько предприятий)
                  </li>
                  <li>
                    Расценка в смете: ССЦ (цена материала) + ЭСН Сб.12 (работы по
                    доставке и доп. обработке)
                  </li>
                </ul>
              </div>
            )}
          </div>

          {/* Упр. 3 */}
          <div className="border border-orange-900/30 rounded-xl p-5 bg-orange-950/10">
            <div className="text-xs text-orange-600 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — Расчёт стоимости горячего цинкования
            </div>
            <div className="text-slate-200 mb-4">
              Металлическая ферма с площадью поверхности <strong>50 м²</strong>. Стоимость
              горячего цинкования: <strong>5 000 тг/м²</strong>. Рассчитайте стоимость
              антикоррозионной защиты в тенге.
            </div>
            <div className="text-xs text-slate-400 italic mb-3">
              💡 Стоимость = площадь поверхности × цена за м²
            </div>
            <div className="flex gap-3 items-center flex-wrap">
              <input
                type="text"
                value={ex3}
                onChange={(e) => setEx3(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && checkEx3()}
                placeholder="Введите число (тг)..."
                className="flex-1 min-w-[200px] border border-slate-700 rounded px-3 py-2 text-sm font-mono bg-slate-900 text-slate-200 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
              <button
                onClick={checkEx3}
                className="px-4 py-2 bg-orange-700 hover:bg-orange-600 text-white rounded transition text-sm"
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
              <p className="mt-3 text-emerald-300 text-sm">✅ Верно!</p>
            )}
            {ex3Res === "bad" && (
              <p className="mt-3 text-red-300 text-sm">❌ Неверно. Проверьте расчёт.</p>
            )}
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-orange-300">Решение:</strong> 50 м² × 5 000 тг/м²
                ={" "}
                <strong className="text-emerald-300">250 000 тг</strong>.
                <p className="text-xs mt-2 text-slate-400">
                  Допуск ±5 000 тг. Примечание: в реальной смете горячее цинкование чаще
                  считается по массе (тг/т), а не по площади. Площадь поверхности
                  указывается при расчёте ЛКП. Данный расчёт — учебный.
                </p>
              </div>
            )}
          </div>

          {/* Упр. 4 */}
          <div className="border border-orange-900/30 rounded-xl p-5 bg-orange-950/10">
            <div className="text-xs text-orange-600 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — Протекторная катодная защита
            </div>
            <div className="text-slate-200 mb-4">
              Протекторная катодная защита (аноды-протекторы) применяется для:
            </div>
            <div className="space-y-2 text-sm">
              {[
                {
                  v: "a",
                  t: "Покраски фасадов зданий в агрессивной атмосфере города",
                },
                {
                  v: "b",
                  t: "Огнезащиты стальных конструкций в промышленных зданиях",
                },
                {
                  v: "c",
                  t: "Подземных трубопроводов и опор мостов в воде — электрохимическая защита без покраски (ток от жертвенного анода защищает сталь)",
                },
                {
                  v: "d",
                  t: "Защиты кровельного покрытия от атмосферных осадков",
                },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-start gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex4 === opt.v
                      ? "border-orange-600 bg-orange-950/30"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex4"
                    value={opt.v}
                    checked={ex4 === opt.v}
                    onChange={() => setEx4(opt.v)}
                    className="accent-orange-500 mt-0.5"
                  />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button
                onClick={checkEx4}
                className="px-4 py-2 bg-orange-700 hover:bg-orange-600 text-white rounded transition text-sm"
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
                <strong className="text-orange-300">Решение:</strong> Правильный ответ —{" "}
                <strong>в</strong>. Протекторная (катодная) защита — электрохимический метод.
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>
                    Принцип: жертвенный анод (Zn, Al, Mg) имеет более низкий
                    электрохимический потенциал, чем сталь — анод растворяется, сталь
                    защищена
                  </li>
                  <li>
                    Применяется там, где ЛКП недостаточно или невозможно нанести: подземные
                    трубопроводы, морские сваи, опоры мостов
                  </li>
                  <li>
                    Аноды-протекторы: Zn (морская вода), Mg (грунт), Al-Zn-In (Каспий)
                  </li>
                  <li>
                    В смете учитывается: стоимость анодов + установочные работы + система
                    мониторинга (датчики потенциала)
                  </li>
                  <li>
                    Нормативы: ГОСТ 9.015-74 (подземные сооружения), ISO 15589-1
                    (трубопроводы)
                  </li>
                </ul>
              </div>
            )}
          </div>
        </section>

        {/* Нормативная база */}
        <section className="border border-orange-900/20 bg-orange-950/10 rounded-xl p-5 space-y-2">
          <h2 className="text-base font-bold text-orange-300">
            📑 Расценки ЭСН РК (Сборник 12)
          </h2>
          <ul className="text-xs text-slate-400 space-y-1.5">
            <li>
              <strong className="text-orange-300">ЭСН Сб.12-1-001..050</strong> — Покрытия
              лакокрасочные (грунтование, окраска кистью, валиком, распылением)
            </li>
            <li>
              <strong className="text-orange-300">ЭСН Сб.12-2-001..020</strong> — Цинковые
              покрытия (горячее, холодное цинкование, металлизация)
            </li>
            <li>
              <strong className="text-orange-300">ЭСН Сб.12-3-001..010</strong> — Катодная
              и протекторная защита подземных конструкций
            </li>
            <li>
              <strong className="text-orange-300">ССЦ РК</strong> — Сметные цены на
              антикоррозионные материалы: грунты, эмали, Zn-порошок, аноды-протекторы
            </li>
          </ul>
        </section>

        {/* Факт сметчика */}
        <section className="bg-slate-900 border border-slate-700 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <h3 className="text-sm font-bold mb-1 text-orange-300">Факт сметчика</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Антикоррозионная защита часто недооценивается в сметах — её доля составляет
                всего <strong className="text-orange-300">3–8%</strong> от стоимости
                металлоконструкций. Однако отсутствие или некачественное выполнение антикора
                приводит к полной замене конструкций через 10–15 лет, что обходится в{" "}
                <strong>5–10 раз дороже</strong>. Всегда уточняйте категорию агрессивности
                среды по ISO 12944 до составления сметы.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
