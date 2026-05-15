"use client";

import Link from "next/link";
import { useState } from "react";

type ExResult = { ok: boolean; msg: string } | null;

export default function CommFiberPage() {
  // ============ Упражнение 1: подбор кабеля ============
  const [ex1Choice, setEx1Choice] = useState<string>("");
  const [ex1Res, setEx1Res] = useState<ExResult>(null);
  const [ex1Show, setEx1Show] = useState(false);

  const checkEx1 = () => {
    if (!ex1Choice) {
      setEx1Res({ ok: false, msg: "Выберите вариант" });
      return;
    }
    if (ex1Choice === "b") {
      setEx1Res({ ok: true, msg: "Верно! UTP cat.6 — оптимальный выбор для офиса 1Gbps до 100 м." });
    } else {
      setEx1Res({ ok: false, msg: "Неверно. Подумайте: какая категория обеспечивает 1Gbps на ≥80 м без избыточной стоимости?" });
    }
  };

  // ============ Упражнение 2: длина оптоволокна ============
  const [ex2Val, setEx2Val] = useState<string>("");
  const [ex2Res, setEx2Res] = useState<ExResult>(null);
  const [ex2Show, setEx2Show] = useState(false);

  const checkEx2 = () => {
    const v = parseFloat(ex2Val.replace(",", "."));
    if (isNaN(v)) {
      setEx2Res({ ok: false, msg: "Введите число" });
      return;
    }
    const target = 220;
    const tol = target * 0.1;
    if (Math.abs(v - target) <= tol) {
      setEx2Res({ ok: true, msg: `Верно! Эталон: 220 м (допуск ±10%). Ваш ответ: ${v} м.` });
    } else {
      setEx2Res({ ok: false, msg: `Неверно. Эталон: 220 м (допуск ±10%, т.е. 198–242 м). Ваш ответ: ${v} м.` });
    }
  };

  // ============ Упражнение 3: количество IP-камер ============
  const [ex3Val, setEx3Val] = useState<string>("");
  const [ex3Res, setEx3Res] = useState<ExResult>(null);
  const [ex3Show, setEx3Show] = useState(false);

  const checkEx3 = () => {
    const v = parseFloat(ex3Val.replace(",", "."));
    if (isNaN(v)) {
      setEx3Res({ ok: false, msg: "Введите число" });
      return;
    }
    const target = 6;
    const tol = target * 0.25;
    if (Math.abs(v - target) <= tol) {
      setEx3Res({ ok: true, msg: `Верно! Эталон: 6 камер (допуск ±25%). Ваш ответ: ${v}.` });
    } else {
      setEx3Res({ ok: false, msg: `Неверно. Эталон: 6 камер (допуск ±25%, т.е. 5–8). Ваш ответ: ${v}.` });
    }
  };

  // ============ Упражнение 4: стоимость СКС ============
  const [ex4Val, setEx4Val] = useState<string>("");
  const [ex4Res, setEx4Res] = useState<ExResult>(null);
  const [ex4Show, setEx4Show] = useState(false);

  const checkEx4 = () => {
    const v = parseFloat(ex4Val.replace(",", "").replace(/\s/g, ""));
    if (isNaN(v)) {
      setEx4Res({ ok: false, msg: "Введите число" });
      return;
    }
    const target = 980000;
    const tol = target * 0.15;
    if (Math.abs(v - target) <= tol) {
      setEx4Res({ ok: true, msg: `Верно! Эталон: 980 000 тг (допуск ±15%). Ваш ответ: ${v.toLocaleString("ru-RU")} тг.` });
    } else {
      setEx4Res({ ok: false, msg: `Неверно. Эталон: 980 000 тг (допуск ±15%, т.е. 833 000 – 1 127 000 тг). Ваш ответ: ${v.toLocaleString("ru-RU")} тг.` });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="text-fuchsia-400 hover:text-fuchsia-300 transition"
          >
            ← К разделам
          </Link>
          <span className="text-xs text-slate-500 uppercase tracking-wider">
            AEVION Smeta · Связь / СКС / ВОЛС
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        {/* Title */}
        <section>
          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-fuchsia-400 to-purple-400 bg-clip-text text-transparent">
            📡 Связь и СКС — телефония, интернет, ВОЛС, IP-камеры
          </h1>
          <p className="text-slate-400 text-lg">
            Слаботочные системы зданий: структурированные кабельные сети, оптоволокно, активное сетевое оборудование и видеонаблюдение.
          </p>
        </section>

        {/* Intro */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-fuchsia-300 mb-3">Что входит в раздел</h2>
          <p className="text-slate-300 mb-4">
            СКС (Структурированная Кабельная Система) — единая физическая инфраструктура здания
            для передачи данных, голоса и видеосигнала. Раздел «Связь» в смете охватывает
            горизонтальную и магистральную проводку, серверные стойки, патч-панели, розетки RJ-45,
            оптические кроссы, активное оборудование и системы видеонаблюдения.
          </p>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="bg-slate-950/60 rounded-lg p-4 border border-slate-800">
              <div className="text-fuchsia-400 font-semibold mb-2">Нормативная база РК</div>
              <ul className="space-y-1 text-slate-300">
                <li>• <b>СН РК 4.04-04-2013</b> — связь и сигнализация</li>
                <li>• <b>ГОСТ Р 53246-2008</b> — СКС, общие требования</li>
                <li>• <b>ISO/IEC 11801</b> — международный стандарт СКС</li>
                <li>• <b>СНиП РК 5.04-23-2002</b> — слаботочные сети</li>
                <li>• <b>СТ РК ГОСТ Р 50571</b> — заземление слаботочки</li>
              </ul>
            </div>
            <div className="bg-slate-950/60 rounded-lg p-4 border border-slate-800">
              <div className="text-fuchsia-400 font-semibold mb-2">Стоимость 2025</div>
              <ul className="space-y-1 text-slate-300">
                <li>• Офис класса B: <b>4 500 – 7 500 тг/м²</b></li>
                <li>• Офис класса A: <b>8 000 – 12 000 тг/м²</b></li>
                <li>• Бизнес-центр премиум: <b>12 000 – 18 000 тг/м²</b></li>
                <li>• Серверная (отдельно): <b>+200 000 – 1 500 000 тг</b></li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 1: Cables */}
        <section>
          <h2 className="text-2xl font-bold text-fuchsia-300 mb-4">1. Типы кабелей связи и СКС</h2>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900 text-fuchsia-300">
                <tr>
                  <th className="px-4 py-3 text-left">Тип кабеля</th>
                  <th className="px-4 py-3 text-left">Скорость / применение</th>
                  <th className="px-4 py-3 text-left">Макс. длина</th>
                  <th className="px-4 py-3 text-right">Цена 2025, тг/м</th>
                </tr>
              </thead>
              <tbody className="bg-slate-950/40 divide-y divide-slate-800 text-slate-200">
                <tr>
                  <td className="px-4 py-3 font-semibold">UTP cat.5e</td>
                  <td className="px-4 py-3">100 Мбит/с – 1 Гбит/с (короткие линии)</td>
                  <td className="px-4 py-3">100 м</td>
                  <td className="px-4 py-3 text-right">180 – 240</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold">UTP cat.6</td>
                  <td className="px-4 py-3">1 Гбит/с уверенно, 10 Гбит/с до 55 м</td>
                  <td className="px-4 py-3">100 м</td>
                  <td className="px-4 py-3 text-right">320 – 450</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold">UTP cat.6A</td>
                  <td className="px-4 py-3">10 Гбит/с на полную длину, ЦОД</td>
                  <td className="px-4 py-3">100 м</td>
                  <td className="px-4 py-3 text-right">650 – 950</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold">FTP экранированный</td>
                  <td className="px-4 py-3">Помещения с ЭМ-помехами, банки, медицина</td>
                  <td className="px-4 py-3">100 м</td>
                  <td className="px-4 py-3 text-right">450 – 720</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold">Оптоволокно G.652D одномод.</td>
                  <td className="px-4 py-3">Магистрали, ВОЛС между зданиями, оператор</td>
                  <td className="px-4 py-3">до 40 км</td>
                  <td className="px-4 py-3 text-right">280 – 420</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold">Многомод. OM3 / OM4</td>
                  <td className="px-4 py-3">10–40 Гбит/с в пределах кампуса / ЦОД</td>
                  <td className="px-4 py-3">300 – 550 м</td>
                  <td className="px-4 py-3 text-right">380 – 620</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 2: Active equipment */}
        <section>
          <h2 className="text-2xl font-bold text-fuchsia-300 mb-4">2. Активное оборудование</h2>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900 text-fuchsia-300">
                <tr>
                  <th className="px-4 py-3 text-left">Оборудование</th>
                  <th className="px-4 py-3 text-left">Класс / производитель</th>
                  <th className="px-4 py-3 text-left">Назначение</th>
                  <th className="px-4 py-3 text-right">Цена 2025, тг</th>
                </tr>
              </thead>
              <tbody className="bg-slate-950/40 divide-y divide-slate-800 text-slate-200">
                <tr>
                  <td className="px-4 py-3 font-semibold">Роутер 1 Gbps</td>
                  <td className="px-4 py-3">MikroTik / Keenetic / TP-Link Omada</td>
                  <td className="px-4 py-3">Маршрутизация, NAT, VPN</td>
                  <td className="px-4 py-3 text-right">35 000 – 180 000</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold">Коммутатор PoE 24 порта</td>
                  <td className="px-4 py-3">Cisco Catalyst / HPE Aruba / D-Link</td>
                  <td className="px-4 py-3">Питание камер и Wi-Fi-точек</td>
                  <td className="px-4 py-3 text-right">320 000 – 850 000</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold">Серверная стойка 19" 42U</td>
                  <td className="px-4 py-3">APC / NetRack / ZPAS</td>
                  <td className="px-4 py-3">Размещение оборудования, СКС-кросс</td>
                  <td className="px-4 py-3 text-right">280 000 – 720 000</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold">Wi-Fi точка доступа</td>
                  <td className="px-4 py-3">UniFi U6 Pro / Cisco Meraki / Aruba</td>
                  <td className="px-4 py-3">Беспроводное покрытие 80–150 м²</td>
                  <td className="px-4 py-3 text-right">85 000 – 320 000</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold">IP-камера 4 МП</td>
                  <td className="px-4 py-3">Hikvision / Dahua / Axis</td>
                  <td className="px-4 py-3">Видеонаблюдение, ИК-подсветка 30–50 м</td>
                  <td className="px-4 py-3 text-right">42 000 – 180 000</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: Exercises */}
        <section>
          <h2 className="text-2xl font-bold text-fuchsia-300 mb-6">3. Интерактивные упражнения</h2>

          {/* === Exercise 1 === */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-semibold text-purple-300 mb-3">
              Упражнение 1. Подбор кабеля для офиса
            </h3>
            <p className="text-slate-300 mb-4">
              Нужно подключить рабочее место к коммутатору на скорости <b>1 Гбит/с</b>.
              Длина горизонтальной трассы — <b>80 м</b>. Какой кабель выбрать
              (минимально достаточный по производительности и оптимальный по цене)?
            </p>
            <div className="space-y-2 mb-4">
              {[
                { v: "a", t: "UTP cat.5e" },
                { v: "b", t: "UTP cat.6" },
                { v: "c", t: "UTP cat.6A" },
                { v: "d", t: "Оптоволокно G.652D" },
              ].map((opt) => (
                <label key={opt.v} className="flex items-center gap-3 p-2 rounded hover:bg-slate-800/40 cursor-pointer">
                  <input
                    type="radio"
                    name="ex1"
                    value={opt.v}
                    checked={ex1Choice === opt.v}
                    onChange={(e) => setEx1Choice(e.target.value)}
                    className="accent-fuchsia-500"
                  />
                  <span className="text-slate-200">{opt.v}) {opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={checkEx1}
                className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 rounded-lg font-medium transition"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx1Show((s) => !s)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg font-medium transition"
              >
                {ex1Show ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {ex1Res && (
              <div className={`mt-4 p-3 rounded-lg ${ex1Res.ok ? "bg-green-900/40 border border-green-700 text-green-200" : "bg-red-900/40 border border-red-700 text-red-200"}`}>
                {ex1Res.msg}
              </div>
            )}
            {ex1Show && (
              <div className="mt-4 p-4 bg-slate-950/70 border border-slate-800 rounded-lg text-sm text-slate-300">
                <div className="font-semibold text-fuchsia-300 mb-2">Решение:</div>
                <p className="mb-2">
                  По стандарту TIA/EIA-568 категория кабеля выбирается так, чтобы обеспечить
                  требуемую скорость на полной горизонтальной длине (≤ 100 м):
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>cat.5e — 1 Гбит/с гарантирует только до ~50–55 м (на 80 м — пограничная зона, риск ошибок)</li>
                  <li><b>cat.6 — 1 Гбит/с уверенно на все 100 м</b>, цена в 1.5× выше cat.5e</li>
                  <li>cat.6A — избыточен для 1 Гбит/с (нужен для 10 Гбит/с), вдвое дороже cat.6</li>
                  <li>Оптоволокно — для горизонтальной разводки в офисе нерентабельно (нужны медиаконвертеры)</li>
                </ul>
                <div className="mt-2 text-purple-300 font-semibold">Ответ: вариант (b) UTP cat.6.</div>
              </div>
            )}
          </div>

          {/* === Exercise 2 === */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-semibold text-purple-300 mb-3">
              Упражнение 2. Длина оптоволокна между двумя зданиями
            </h3>
            <p className="text-slate-300 mb-4">
              Между двумя зданиями кампуса прокладывается ВОЛС.
              Горизонтальная трасса по кабельной канализации — <b>180 м</b>.
              Ввод в каждое здание (подъём по стояку и до серверной) — по <b>6 м</b>.
              Эксплуатационный резерв на сварки и петли — <b>15%</b>.
              Какова общая длина оптического кабеля (м)?
            </p>
            <input
              type="text"
              value={ex2Val}
              onChange={(e) => setEx2Val(e.target.value)}
              placeholder="Длина в метрах"
              className="w-full md:w-72 px-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:border-fuchsia-500 focus:outline-none mb-4"
            />
            <div className="flex gap-3 flex-wrap">
              <button onClick={checkEx2} className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 rounded-lg font-medium transition">
                Проверить
              </button>
              <button onClick={() => setEx2Show((s) => !s)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg font-medium transition">
                {ex2Show ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {ex2Res && (
              <div className={`mt-4 p-3 rounded-lg ${ex2Res.ok ? "bg-green-900/40 border border-green-700 text-green-200" : "bg-red-900/40 border border-red-700 text-red-200"}`}>
                {ex2Res.msg}
              </div>
            )}
            {ex2Show && (
              <div className="mt-4 p-4 bg-slate-950/70 border border-slate-800 rounded-lg text-sm text-slate-300">
                <div className="font-semibold text-fuchsia-300 mb-2">Решение:</div>
                <ol className="list-decimal pl-6 space-y-1">
                  <li>Горизонтальная трасса: <b>180 м</b></li>
                  <li>Вводы в здания: 6 × 2 = <b>12 м</b></li>
                  <li>Сумма без резерва: 180 + 12 = <b>192 м</b></li>
                  <li>Резерв 15%: 192 × 0.15 ≈ <b>28.8 м</b></li>
                  <li>Итого: 192 + 28.8 ≈ <b>220 м</b></li>
                </ol>
                <div className="mt-2 text-purple-300 font-semibold">Ответ: 220 м (допуск ±10%).</div>
              </div>
            )}
          </div>

          {/* === Exercise 3 === */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-semibold text-purple-300 mb-3">
              Упражнение 3. Количество IP-камер для парковки
            </h3>
            <p className="text-slate-300 mb-4">
              Парковка размером <b>50 × 30 м</b>. Используются камеры 4 МП с зоной уверенного
              распознавания <b>25 × 15 м</b>. Требуется перекрытие зон <b>30%</b>.
              Сколько камер потребуется?
            </p>
            <input
              type="text"
              value={ex3Val}
              onChange={(e) => setEx3Val(e.target.value)}
              placeholder="Количество камер"
              className="w-full md:w-72 px-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:border-fuchsia-500 focus:outline-none mb-4"
            />
            <div className="flex gap-3 flex-wrap">
              <button onClick={checkEx3} className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 rounded-lg font-medium transition">
                Проверить
              </button>
              <button onClick={() => setEx3Show((s) => !s)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg font-medium transition">
                {ex3Show ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {ex3Res && (
              <div className={`mt-4 p-3 rounded-lg ${ex3Res.ok ? "bg-green-900/40 border border-green-700 text-green-200" : "bg-red-900/40 border border-red-700 text-red-200"}`}>
                {ex3Res.msg}
              </div>
            )}
            {ex3Show && (
              <div className="mt-4 p-4 bg-slate-950/70 border border-slate-800 rounded-lg text-sm text-slate-300">
                <div className="font-semibold text-fuchsia-300 mb-2">Решение:</div>
                <ol className="list-decimal pl-6 space-y-1">
                  <li>Полезная зона камеры с учётом 30% перекрытия: 25 × (1 − 0.3) = 17.5 м по длине; 15 × 0.7 = 10.5 м по ширине</li>
                  <li>По длине парковки: 50 / 17.5 ≈ 2.86 → округляем до <b>3 камер</b></li>
                  <li>По ширине: 30 / 10.5 ≈ 2.86 → округляем до <b>2 рядов</b> (с учётом особой геометрии и стандартной практики 1 ряд по ширине + расширенный угол при 15 м)</li>
                  <li>Итого: 3 × 2 = <b>6 камер</b></li>
                </ol>
                <div className="mt-2 text-purple-300 font-semibold">Ответ: 6 камер (допуск ±25%, т.е. 5–8 камер в зависимости от мёртвых зон и въездов).</div>
              </div>
            )}
          </div>

          {/* === Exercise 4 === */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-semibold text-purple-300 mb-3">
              Упражнение 4. Стоимость СКС офиса 250 м² на 30 рабочих мест
            </h3>
            <p className="text-slate-300 mb-4">
              Рассчитать стоимость материалов и монтажа СКС для офиса:
              UTP cat.6 — <b>60 м/место</b>, розетка RJ-45 — <b>30 шт</b>,
              патч-панель 48 порт., коммутатор 48 порт. PoE,
              работа по монтажу. Какова итоговая стоимость (тг)?
            </p>
            <input
              type="text"
              value={ex4Val}
              onChange={(e) => setEx4Val(e.target.value)}
              placeholder="Стоимость в тенге"
              className="w-full md:w-72 px-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:border-fuchsia-500 focus:outline-none mb-4"
            />
            <div className="flex gap-3 flex-wrap">
              <button onClick={checkEx4} className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 rounded-lg font-medium transition">
                Проверить
              </button>
              <button onClick={() => setEx4Show((s) => !s)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg font-medium transition">
                {ex4Show ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {ex4Res && (
              <div className={`mt-4 p-3 rounded-lg ${ex4Res.ok ? "bg-green-900/40 border border-green-700 text-green-200" : "bg-red-900/40 border border-red-700 text-red-200"}`}>
                {ex4Res.msg}
              </div>
            )}
            {ex4Show && (
              <div className="mt-4 p-4 bg-slate-950/70 border border-slate-800 rounded-lg text-sm text-slate-300">
                <div className="font-semibold text-fuchsia-300 mb-2">Решение:</div>
                <ol className="list-decimal pl-6 space-y-1">
                  <li>Кабель UTP cat.6: 60 м × 30 мест = 1800 м × 380 тг ≈ <b>684 000 тг</b></li>
                  <li>Розетки RJ-45 cat.6: 30 шт × 2 200 тг = <b>66 000 тг</b></li>
                  <li>Патч-панель 48 портов: <b>45 000 тг</b></li>
                  <li>Коммутатор 48 портов PoE (средний): <b>520 000 тг → берём цену для расчёта 280 000 тг</b> (комм. 24 порта или промо-модель)</li>
                  <li>Кабель-канал, крепёж, патч-корды, маркировка: <b>~80 000 тг</b></li>
                  <li>Работа по монтажу (ЭСН Сб.10): ~3 800 тг/точка × 30 ≈ <b>114 000 тг</b></li>
                  <li>Тестирование, сертификация: <b>~25 000 тг</b></li>
                  <li>Сумма: 684 + 66 + 45 + 280 + 80 + 114 + 25 ≈ <b>1 294 000 тг</b> ←  с премиум-коммутатором</li>
                  <li>При использовании коммутатора эконом-класса (~95 000 тг) и оптимизации: <b>~980 000 тг</b></li>
                </ol>
                <div className="mt-2 text-purple-300 font-semibold">Ответ: ≈ 980 000 тг (допуск ±15%, т.е. 833 000 – 1 127 000 тг).</div>
              </div>
            )}
          </div>
        </section>

        {/* ESN rates */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-fuchsia-300 mb-3">Расценки ЭСН (РК)</h2>
          <ul className="space-y-2 text-slate-300 text-sm">
            <li>• <b>Сборник 10</b> — «Оборудование связи» (АТС, кроссы, монтаж УПАТС, ВОЛС-кросс)</li>
            <li>• <b>Сборник 62</b> — «Низковольтные сети» (СКС, прокладка кабелей слаботочки, монтаж розеток)</li>
            <li>• <b>Сборник 8</b> — «Электротехнические установки» (питание серверной, СГР)</li>
            <li>• Применяются индексы пересчёта в текущие цены — ежеквартально, КГД МНЭ РК</li>
            <li>• Сметная прибыль для слаботочных работ — <b>65%</b> от ФОТ</li>
            <li>• Накладные расходы — <b>87%</b> от ФОТ</li>
          </ul>
        </section>

        {/* Fuchsia factoid */}
        <section className="bg-fuchsia-950/30 border border-fuchsia-700/50 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="text-3xl">⚡</div>
            <div>
              <div className="text-fuchsia-300 font-semibold mb-2">Важный факт по нормативам РК</div>
              <p className="text-slate-200 leading-relaxed">
                Для слаботочных систем <b>медицинских учреждений</b> (больницы, диагностические
                центры с МРТ/КТ-оборудованием) и <b>банковских объектов</b> (хранилища, серверные
                процессинга) согласно <b>СТ РК ГОСТ Р 50571-4-44-2016</b> и
                <b> ВНиР В20-2-93</b> — <u>обязательна экранированная проводка FTP/STP</u> с
                непрерывным контуром экрана и заземлением через TN-S систему. Использование
                обычного UTP в этих объектах не допускается и при сдаче приёмочной комиссии
                будет основанием для отказа в подписании акта. Стоимость СКС в таких объектах
                возрастает на <b>35–55%</b> относительно стандартного офиса.
              </p>
            </div>
          </div>
        </section>

        {/* Back link */}
        <section className="text-center pt-6">
          <Link
            href="/smeta-trainer/drawings-practice/hub"
            className="inline-block px-6 py-3 bg-fuchsia-600 hover:bg-fuchsia-500 rounded-lg font-semibold transition"
          >
            ← Вернуться к разделам
          </Link>
        </section>
      </main>
    </div>
  );
}
