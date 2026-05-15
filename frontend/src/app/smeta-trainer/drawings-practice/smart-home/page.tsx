"use client";

import Link from "next/link";
import { useState } from "react";

export default function SmartHomePage() {
  // Упражнение 1 — выбор системы (multiple choice)
  const [ex1Answer, setEx1Answer] = useState<string>("");
  const [ex1Show, setEx1Show] = useState(false);

  // Упражнение 2 — каналы диммирования (numeric)
  const [ex2Input, setEx2Input] = useState("");
  const [ex2Show, setEx2Show] = useState(false);

  // Упражнение 3 — длина магистрали KNX (numeric)
  const [ex3Input, setEx3Input] = useState("");
  const [ex3Show, setEx3Show] = useState(false);

  // Упражнение 4 — стоимость умного дома (numeric)
  const [ex4Input, setEx4Input] = useState("");
  const [ex4Show, setEx4Show] = useState(false);

  // Проверки с tolerance
  const ex2Correct = 18;
  const ex2Tol = 0.2;
  const ex2Num = parseFloat(ex2Input.replace(",", "."));
  const ex2Pass = !isNaN(ex2Num) && Math.abs(ex2Num - ex2Correct) / ex2Correct <= ex2Tol;

  const ex3Correct = 180;
  const ex3Tol = 0.15;
  const ex3Num = parseFloat(ex3Input.replace(",", "."));
  const ex3Pass = !isNaN(ex3Num) && Math.abs(ex3Num - ex3Correct) / ex3Correct <= ex3Tol;

  const ex4Correct = 750000;
  const ex4Tol = 0.15;
  const ex4Num = parseFloat(ex4Input.replace(/[\s,]/g, ""));
  const ex4Pass = !isNaN(ex4Num) && Math.abs(ex4Num - ex4Correct) / ex4Correct <= ex4Tol;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <header className="mb-8">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-emerald-400 hover:text-emerald-300 text-sm transition"
          >
            ← К разделам
          </Link>
          <h1 className="mt-3 text-3xl md:text-4xl font-bold text-emerald-300">
            🏠 Умный дом — KNX, Crestron, автоматизация
          </h1>
          <p className="mt-2 text-slate-400 text-sm">
            Модуль AEVION Smeta Trainer · drawings-practice · smart-home
          </p>
        </header>

        {/* Intro */}
        <section className="mb-10 rounded-2xl border border-emerald-900/40 bg-slate-900/60 p-6">
          <h2 className="text-xl font-semibold text-emerald-200 mb-3">
            Что такое «умный дом» в проекте сметы
          </h2>
          <p className="text-slate-300 leading-relaxed">
            Системы автоматизации зданий (BMS / Home Automation) объединяют
            управление светом, климатом, шторами, мультирумом, видеонаблюдением и
            сценариями в единую сеть. В смете включаются в раздел слаботочных
            систем (СС), а провод и кабель — в раздел электромонтажа.
          </p>

          <div className="mt-4 grid md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-xl bg-slate-950/70 p-4 border border-slate-800">
              <h3 className="text-emerald-300 font-medium mb-2">Нормативы</h3>
              <ul className="space-y-1 text-slate-300">
                <li>• ISO/IEC 14543-3 — KNX (Open Building Automation)</li>
                <li>• ГОСТ Р 56213 — системы автоматизации зданий</li>
                <li>• СН РК 4.04-04 — электротехнические устройства</li>
                <li>• СНиП РК 5.04-23 — автоматизация инженерных систем</li>
              </ul>
            </div>
            <div className="rounded-xl bg-slate-950/70 p-4 border border-slate-800">
              <h3 className="text-emerald-300 font-medium mb-2">
                Стоимость в РК (2025)
              </h3>
              <ul className="space-y-1 text-slate-300">
                <li>• Бюджетный (Wiren Board / MajorDoMo): 4 500 - 8 000 тг/м²</li>
                <li>• Средний (ZigBee Tuya / Aqara): 8 000 - 14 000 тг/м²</li>
                <li>• Премиум (KNX): 14 000 - 20 000 тг/м²</li>
                <li>• VIP (Crestron / Lutron): 18 000 - 25 000 тг/м²</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 1 — системы */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-emerald-200 mb-4">
            1. Системы автоматизации
          </h2>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-emerald-300">
                <tr>
                  <th className="text-left p-3">Система</th>
                  <th className="text-left p-3">Класс</th>
                  <th className="text-left p-3">Шина / протокол</th>
                  <th className="text-left p-3">Применение</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                <tr className="bg-slate-950/40">
                  <td className="p-3 font-medium text-slate-100">KNX / EIB</td>
                  <td className="p-3 text-emerald-300">Премиум</td>
                  <td className="p-3 text-slate-300">TP1 (витая пара) + IP</td>
                  <td className="p-3 text-slate-300">
                    Европейский стандарт ISO/IEC 14543-3, премиум-жильё, БЦ
                  </td>
                </tr>
                <tr className="bg-slate-950/20">
                  <td className="p-3 font-medium text-slate-100">Crestron</td>
                  <td className="p-3 text-emerald-300">VIP</td>
                  <td className="p-3 text-slate-300">Cresnet / IP</td>
                  <td className="p-3 text-slate-300">
                    Премиальная закрытая, VIP-резиденции, AV-интеграция
                  </td>
                </tr>
                <tr className="bg-slate-950/40">
                  <td className="p-3 font-medium text-slate-100">Wiren Board</td>
                  <td className="p-3 text-teal-300">Бюджет/средний</td>
                  <td className="p-3 text-slate-300">Modbus RTU / 1-Wire</td>
                  <td className="p-3 text-slate-300">
                    Российская проводная, открытая, малый и средний жил.фонд
                  </td>
                </tr>
                <tr className="bg-slate-950/20">
                  <td className="p-3 font-medium text-slate-100">MajorDoMo</td>
                  <td className="p-3 text-teal-300">Бюджет</td>
                  <td className="p-3 text-slate-300">PHP / MQTT</td>
                  <td className="p-3 text-slate-300">
                    Бюджетная open-source, DIY-инсталляции, типовые квартиры
                  </td>
                </tr>
                <tr className="bg-slate-950/40">
                  <td className="p-3 font-medium text-slate-100">
                    ZigBee / Z-Wave
                  </td>
                  <td className="p-3 text-teal-300">Средний</td>
                  <td className="p-3 text-slate-300">2.4 ГГц / 868 МГц</td>
                  <td className="p-3 text-slate-300">
                    Беспроводная: Tuya, Aqara, Sonoff — без штробления
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 2 — подсистемы */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-emerald-200 mb-4">
            2. Подсистемы автоматизации
          </h2>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-emerald-300">
                <tr>
                  <th className="text-left p-3">Подсистема</th>
                  <th className="text-left p-3">Оборудование</th>
                  <th className="text-left p-3">Особенности проектирования</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                <tr className="bg-slate-950/40">
                  <td className="p-3 font-medium text-slate-100">
                    Освещение
                  </td>
                  <td className="p-3 text-slate-300">
                    Диммеры, RGB/RGBW-контроллеры, реле
                  </td>
                  <td className="p-3 text-slate-300">
                    Сценарии «утро/вечер/кино», диммируемые драйверы LED 0-10 В
                  </td>
                </tr>
                <tr className="bg-slate-950/20">
                  <td className="p-3 font-medium text-slate-100">Климат</td>
                  <td className="p-3 text-slate-300">
                    Термостаты MCS, Salus, Devireg
                  </td>
                  <td className="p-3 text-slate-300">
                    Управление тёплыми полами, фанкойлами, VRV/VRF
                  </td>
                </tr>
                <tr className="bg-slate-950/40">
                  <td className="p-3 font-medium text-slate-100">
                    Шторы и жалюзи
                  </td>
                  <td className="p-3 text-slate-300">
                    Приводы Somfy, Aqara, Dooya
                  </td>
                  <td className="p-3 text-slate-300">
                    Сценарии по освещённости и времени суток
                  </td>
                </tr>
                <tr className="bg-slate-950/20">
                  <td className="p-3 font-medium text-slate-100">Мультирум</td>
                  <td className="p-3 text-slate-300">
                    Sonos, Crestron AV, Bluesound
                  </td>
                  <td className="p-3 text-slate-300">
                    Зональный звук, синхронизация, потолочные АС
                  </td>
                </tr>
                <tr className="bg-slate-950/40">
                  <td className="p-3 font-medium text-slate-100">
                    Видеонаблюдение
                  </td>
                  <td className="p-3 text-slate-300">
                    Hikvision, Dahua, Ajax CCTV
                  </td>
                  <td className="p-3 text-slate-300">
                    Интегрированное в сценарии тревоги/входа
                  </td>
                </tr>
                <tr className="bg-slate-950/20">
                  <td className="p-3 font-medium text-slate-100">
                    Голосовое управление
                  </td>
                  <td className="p-3 text-slate-300">
                    Алиса, Маруся, Marusya, Google
                  </td>
                  <td className="p-3 text-slate-300">
                    Локальный шлюз (Home Assistant) + облачные навыки
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3 — упражнения */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-emerald-200 mb-6">
            3. Интерактивные упражнения
          </h2>

          {/* Упр.1 */}
          <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h3 className="text-lg font-semibold text-emerald-300 mb-2">
              Упражнение 1 — Подбор системы для квартиры
            </h3>
            <p className="text-slate-300 mb-4">
              Квартира 90 м². Задача: бюджетный умный свет + климат
              (тёплый пол) + удалённый доступ через смартфон. Какую систему
              выбрать?
            </p>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "KNX (TP1) — европейский премиум-стандарт" },
                { v: "b", t: "Crestron — VIP-инсталляция" },
                { v: "c", t: "Wiren Board — открытая, Modbus, бюджет" },
                { v: "d", t: "ZigBee Tuya — облачное беспроводное" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                    ex1Answer === opt.v
                      ? "border-emerald-500 bg-emerald-950/30"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex1"
                    value={opt.v}
                    checked={ex1Answer === opt.v}
                    onChange={(e) => setEx1Answer(e.target.value)}
                    className="mt-1 accent-emerald-500"
                  />
                  <span className="text-slate-200">
                    <span className="font-mono text-emerald-400">{opt.v})</span>{" "}
                    {opt.t}
                  </span>
                </label>
              ))}
            </div>

            {ex1Answer && (
              <div
                className={`mt-4 p-3 rounded-lg text-sm ${
                  ex1Answer === "c"
                    ? "bg-emerald-950/40 border border-emerald-700 text-emerald-200"
                    : "bg-rose-950/40 border border-rose-800 text-rose-200"
                }`}
              >
                {ex1Answer === "c"
                  ? "Верно! Wiren Board — оптимальный бюджетный выбор."
                  : "Неверно. Подумайте про бюджет и наличие проводных линий."}
              </div>
            )}

            <button
              onClick={() => setEx1Show(!ex1Show)}
              className="mt-4 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition"
            >
              {ex1Show ? "Скрыть" : "Показать"} решение
            </button>

            {ex1Show && (
              <div className="mt-4 p-4 rounded-lg bg-slate-950/70 border border-emerald-900/50 text-sm text-slate-200 leading-relaxed">
                <p className="font-semibold text-emerald-300 mb-2">
                  Решение: c) Wiren Board
                </p>
                <p className="mb-2">
                  KNX (a) и Crestron (b) — это премиум за 14-25 тыс. тг/м²,
                  избыточно для бюджетной квартиры. ZigBee Tuya (d) — облачный
                  (зависит от китайских серверов), нет надёжного локального
                  управления климатом.
                </p>
                <p>
                  Wiren Board даёт проводной Modbus к термостатам тёплого пола,
                  модули реле для света, локальный веб-интерфейс + MQTT для
                  смартфона. Бюджет — около 4 500 - 7 000 тг/м².
                </p>
              </div>
            )}
          </div>

          {/* Упр.2 */}
          <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h3 className="text-lg font-semibold text-emerald-300 mb-2">
              Упражнение 2 — Каналы диммирования для коттеджа
            </h3>
            <p className="text-slate-300 mb-4">
              Коттедж 200 м². Свет в 12 комнатах + 4 уличные группы (фасад,
              дорожки, навес, въезд) + 2 декоративные группы (бассейн, сад).
              Сколько диммируемых каналов заложить в проект? Допуск ±20%.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="text"
                inputMode="decimal"
                value={ex2Input}
                onChange={(e) => setEx2Input(e.target.value)}
                placeholder="Каналов"
                className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 w-32 focus:outline-none focus:border-emerald-500"
              />
              <span className="text-slate-400 text-sm">каналов</span>
              {ex2Input && (
                <span
                  className={`text-sm font-medium ${
                    ex2Pass ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {ex2Pass ? "В допуске ±20%" : "Вне допуска"}
                </span>
              )}
            </div>

            <button
              onClick={() => setEx2Show(!ex2Show)}
              className="mt-4 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition"
            >
              {ex2Show ? "Скрыть" : "Показать"} решение
            </button>

            {ex2Show && (
              <div className="mt-4 p-4 rounded-lg bg-slate-950/70 border border-emerald-900/50 text-sm text-slate-200 leading-relaxed">
                <p className="font-semibold text-emerald-300 mb-2">
                  Решение: 18 каналов
                </p>
                <p className="mb-2">Расчёт по группам:</p>
                <ul className="list-disc list-inside space-y-1 text-slate-300">
                  <li>12 комнат × 1 канал основного света = 12 каналов</li>
                  <li>4 уличные группы = 4 канала</li>
                  <li>2 декоративные группы = 2 канала</li>
                  <li className="font-medium text-emerald-300">
                    Итого: 12 + 4 + 2 = 18 диммируемых каналов
                  </li>
                </ul>
                <p className="mt-2">
                  В премиум-проекте дополнительно закладывают 4-6 каналов под
                  торшеры, бра и сценический свет (трекинг). Допуск ±20%
                  покрывает 14-22 канала.
                </p>
              </div>
            )}
          </div>

          {/* Упр.3 */}
          <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h3 className="text-lg font-semibold text-emerald-300 mb-2">
              Упражнение 3 — Длина магистрали KNX
            </h3>
            <p className="text-slate-300 mb-4">
              Коттедж 250 м² (2 этажа, по 125 м²). Шина KNX TP1 идёт по
              периметру каждого этажа + соединение между этажами. Периметр
              этажа 50 м. Заложить +20% запаса. Какую длину кабеля KNX
              указать в смете? Допуск ±15%.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="text"
                inputMode="decimal"
                value={ex3Input}
                onChange={(e) => setEx3Input(e.target.value)}
                placeholder="Метров"
                className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 w-32 focus:outline-none focus:border-emerald-500"
              />
              <span className="text-slate-400 text-sm">м</span>
              {ex3Input && (
                <span
                  className={`text-sm font-medium ${
                    ex3Pass ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {ex3Pass ? "В допуске ±15%" : "Вне допуска"}
                </span>
              )}
            </div>

            <button
              onClick={() => setEx3Show(!ex3Show)}
              className="mt-4 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition"
            >
              {ex3Show ? "Скрыть" : "Показать"} решение
            </button>

            {ex3Show && (
              <div className="mt-4 p-4 rounded-lg bg-slate-950/70 border border-emerald-900/50 text-sm text-slate-200 leading-relaxed">
                <p className="font-semibold text-emerald-300 mb-2">
                  Решение: 180 м
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-300">
                  <li>Периметр этажа: 50 м × 2 этажа = 100 м</li>
                  <li>Стояк (магистраль между этажами): 5 м</li>
                  <li>Спуски к щитам и группам: ≈ 45 м</li>
                  <li>Итого «чистая» длина: 100 + 5 + 45 = 150 м</li>
                  <li className="font-medium text-emerald-300">
                    С запасом 20%: 150 × 1.2 = 180 м
                  </li>
                </ul>
                <p className="mt-2">
                  Используется кабель KNX TP1 (J-Y(St)Y 2×2×0.8) — один цвет
                  для шины, второй — для резерва. Максимальная длина сегмента
                  KNX — 1000 м, до 64 устройств.
                </p>
              </div>
            )}
          </div>

          {/* Упр.4 */}
          <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h3 className="text-lg font-semibold text-emerald-300 mb-2">
              Упражнение 4 — Стоимость умного дома Wiren Board
            </h3>
            <p className="text-slate-300 mb-4">
              Квартира 100 м². Состав: свет 8 групп (диммеры) + климат 4 зоны
              (термостаты) + шторы 6 окон + сценарии + установка/наладка. База —
              Wiren Board. Сколько заложить в смету? Допуск ±15%.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="text"
                inputMode="decimal"
                value={ex4Input}
                onChange={(e) => setEx4Input(e.target.value)}
                placeholder="Тенге"
                className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 w-40 focus:outline-none focus:border-emerald-500"
              />
              <span className="text-slate-400 text-sm">тг</span>
              {ex4Input && (
                <span
                  className={`text-sm font-medium ${
                    ex4Pass ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {ex4Pass ? "В допуске ±15%" : "Вне допуска"}
                </span>
              )}
            </div>

            <button
              onClick={() => setEx4Show(!ex4Show)}
              className="mt-4 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition"
            >
              {ex4Show ? "Скрыть" : "Показать"} решение
            </button>

            {ex4Show && (
              <div className="mt-4 p-4 rounded-lg bg-slate-950/70 border border-emerald-900/50 text-sm text-slate-200 leading-relaxed">
                <p className="font-semibold text-emerald-300 mb-2">
                  Решение: ≈ 750 000 тг
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-300">
                  <li>Контроллер Wiren Board 7 + блок питания: ≈ 95 000 тг</li>
                  <li>Диммеры (8 каналов, WB-MDM3): ≈ 110 000 тг</li>
                  <li>Термостаты MCS (4 шт.) + реле тёплого пола: ≈ 90 000 тг</li>
                  <li>Приводы штор Aqara (6 шт.): ≈ 120 000 тг</li>
                  <li>Кабель KNX/витая пара + UTP: ≈ 45 000 тг</li>
                  <li>Щитовое оборудование, корпус, автоматика: ≈ 80 000 тг</li>
                  <li>Программирование сценариев, наладка: ≈ 110 000 тг</li>
                  <li>Монтажные работы (электромонтаж + слаботочка): ≈ 100 000 тг</li>
                  <li className="font-medium text-emerald-300">
                    Итого: ≈ 750 000 тг (= 7 500 тг/м²)
                  </li>
                </ul>
                <p className="mt-2">
                  Это укладывается в бюджетный диапазон 4 500 - 8 000 тг/м².
                  Допуск ±15% покрывает 637 500 - 862 500 тг.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Расценки ЭСН */}
        <section className="mb-10 rounded-2xl border border-teal-900/40 bg-slate-900/60 p-6">
          <h2 className="text-xl font-semibold text-teal-200 mb-3">
            Расценки ЭСН РК — на что ссылаться в смете
          </h2>
          <ul className="space-y-2 text-sm text-slate-300">
            <li>
              <span className="text-teal-300 font-medium">Сб. 62</span> —
              низковольтные системы автоматизации (контроллеры, шлюзы,
              интерфейсы)
            </li>
            <li>
              <span className="text-teal-300 font-medium">Сб. 10</span> —
              структурированные кабельные системы (СКС, KNX TP1, Modbus, UTP)
            </li>
            <li>
              <span className="text-teal-300 font-medium">Сб. 61</span> —
              электромонтажные работы (диммеры, реле, силовая часть)
            </li>
            <li>
              <span className="text-teal-300 font-medium">Сб. 8</span> —
              слаботочные сети и охранные сигнализации (для интеграции с
              видеонаблюдением)
            </li>
          </ul>
          <p className="mt-3 text-slate-400 text-xs">
            При составлении сметы по ССЦ РК используйте актуальные индексы из
            new-shop.ksm.kz (раздел «Низковольтные комплектные устройства»).
          </p>
        </section>

        {/* Emerald factoid */}
        <section className="mb-10 rounded-2xl border-2 border-emerald-600/60 bg-emerald-950/30 p-6">
          <div className="flex items-start gap-4">
            <div className="text-3xl">⚡</div>
            <div>
              <h2 className="text-lg font-semibold text-emerald-200 mb-2">
                Важно: KNX требует сертифицированного партнёра
              </h2>
              <p className="text-slate-200 text-sm leading-relaxed">
                KNX-инсталляция в РК должна выполняться сертифицированным
                KNX-партнёром (KNX Certified Partner) — иначе инсталляция не
                поддерживается официально и теряется гарантия на интероп
                устройств. Рекомендуется{" "}
                <span className="text-emerald-300 font-medium">AEVION Bureau</span>{" "}
                либо официальные KNX-партнёры в Казахстане (список на{" "}
                <span className="font-mono text-emerald-300">knx.org/partners</span>
                ). Для Crestron — аналогично, требуется Authorized Independent
                Programmer (AIP).
              </p>
            </div>
          </div>
        </section>

        {/* Footer nav */}
        <footer className="mt-12 pt-6 border-t border-slate-800 flex justify-between text-sm">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-emerald-400 hover:text-emerald-300 transition"
          >
            ← К разделам
          </Link>
          <span className="text-slate-500">
            AEVION Smeta Trainer · smart-home
          </span>
        </footer>
      </div>
    </div>
  );
}
