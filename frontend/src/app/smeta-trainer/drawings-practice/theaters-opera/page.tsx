"use client";

import Link from "next/link";
import { useState } from "react";

export default function TheatersOperaPage() {
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
    const v = parseFloat(ex3);
    if (!isFinite(v)) return setEx3Res("bad");
    setEx3Res(Math.abs(v - 972000000) <= 30000000 ? "ok" : "bad");
  };
  const checkEx4 = () => setEx4Res(ex4 === "d" ? "ok" : "bad");

  const acousticsData = [
    { genre: "Драматический театр (речь)", rt60: "1.1–1.4 с", notes: "Разборчивость речи важнее реверберации. Среднечастотный диапазон 500–2000 Гц." },
    { genre: "Мюзикл / оперетта", rt60: "1.3–1.6 с", notes: "Компромисс: речь + музыка. Часто применяют регулируемые панели." },
    { genre: "Опера (акустический, без усиления)", rt60: "1.6–2.2 с", notes: "Итальянская «подкова» — классическая форма зала для максимального RT60. Ранние отражения важны." },
    { genre: "Симфонический концертный зал", rt60: "2.2–2.8 с", notes: "Прямоугольный зал (shoe-box) даёт наилучшие характеристики. Пример: зал Zig Zag, Амстердам (2.0 с)." },
    { genre: "Орган / хоровая музыка", rt60: "2.5–3.5 с", notes: "Максимальный RT60 для слияния гармоник. Жёсткие отражающие поверхности." },
    { genre: "Многофункциональный зал", rt60: "1.4–1.8 с (регулируемый)", notes: "Переменные акустические кулисы, подъёмные панели. Компромиссное решение." },
  ];

  const stageMechanics = [
    { system: "Поворотный круг", detail: "Диаметр 15–25 м. Электропривод 7.5–22 кВт, скорость вращения 1–4 об/мин. Грузоподъёмность: 30–80 т. Применяется для быстрой смены декораций." },
    { system: "Штанкеты (подъём задников)", detail: "50–120 штанкетов высотой подъёма до 25–35 м. Электромоторы 2.2–7.5 кВт каждый. Скорость: 0.1–1.2 м/с. Грузоподъёмность: 200–800 кг." },
    { system: "Оркестровая яма", detail: "Глубина 2–3 м. Подъёмная платформа для трансформации: яма ↔ дополнительные ряды зрителей ↔ просцениум. Электропривод 15–30 кВт." },
    { system: "Осветительные мостики", detail: "3–5 ярусов над залом и сценой. Нагрузка ≥ 300 кг/м.п. для профессионального осветительного оборудования. Безопасное обслуживание с платформ." },
    { system: "Сценическое электрооборудование", detail: "Диммерная стойка 200–600 каналов по 2.5–6 кВА. DMX-512 управление. Резервное питание от ДГУ. Разделение цепей: сцена / зал / аварийное." },
  ];

  const auditoriumParams = [
    { param: "Уклон пола партера", value: "5–10°", note: "Обеспечивает видимость сцены из любого ряда без зеркального экрана" },
    { param: "Расстояние между рядами", value: "85–90 см", note: "Увеличенное vs кино (80 см) — театр предполагает более длительное пребывание" },
    { param: "Ширина кресла", value: "50–55 см", note: "Минимум по СН РК 3.02-27, для премиум-зон — 60–70 см" },
    { param: "Покрытие кресел", value: "Звукопоглощающее, μ ≥ 0.5", note: "Коэффициент поглощения должен быть близок к занятому человеку — зал звучит одинаково при разной заполненности" },
    { param: "Угол видимости сцены", value: "≤ 30° от оси", note: "Крайние места не должны смотреть под углом > 30° к оси сцены" },
    { param: "Уровень фонового шума", value: "NC-25 / NR-25", note: "Максимально допустимый фоновый шум для драм. театра. Для оперы — NC-20 или ниже" },
  ];

  const examplesRK = [
    {
      name: "Астана Опера",
      city: "Астана",
      seats: "1 250 мест (основная сцена)",
      note: "Открыт 2013. Итальянский стиль зала. RT60 ≈ 1.8–2.0 с. Поворотный круг Ø 18 м. Бюджет строительства ≈ 120 млрд тг.",
    },
    {
      name: "Казахский Национальный театр им. М.О. Ауэзова",
      city: "Алматы",
      seats: "≈ 1 000 мест",
      note: "Основан 1926. Здание 1980 г. Реконструкция 2010-х. Сейсмостойкость 9 баллов. Оснащён современной сценической механикой.",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-sky-300 hover:text-sky-200 transition">
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Театры и опера</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            🎭 Театры и оперные здания
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            Театральные здания — сложнейший тип общественных зданий. Главные вызовы:{" "}
            <strong className="text-rose-300">акустика зала</strong>,{" "}
            <strong className="text-rose-300">сценическая механика</strong> и инженерные
            системы под конкретный жанр. Ошибка в RT60 на 0.3–0.5 секунды — полностью
            меняет восприятие спектакля. Стоимость: 400–900 тыс. тг/м² (зависит от
            уровня механизации сцены и акустической отделки). В РК флагманы —
            Астана Опера и театры Алматы.
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-rose-900/50 rounded-lg p-3 bg-rose-950/20">
              <div className="text-rose-400 uppercase tracking-wider mb-1">Акустика (опера)</div>
              <div className="text-slate-300">RT60 = 1.6–2.2 секунды</div>
            </div>
            <div className="border border-rose-900/50 rounded-lg p-3 bg-rose-950/20">
              <div className="text-rose-400 uppercase tracking-wider mb-1">Фоновый шум</div>
              <div className="text-slate-300">NC-20 / NR-20 (опера)</div>
            </div>
            <div className="border border-rose-900/50 rounded-lg p-3 bg-rose-950/20">
              <div className="text-rose-400 uppercase tracking-wider mb-1">Бенчмарк</div>
              <div className="text-slate-300">400–900 тыс. тг/м²</div>
            </div>
          </div>
        </section>

        {/* Section 1: Акустика */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🔊 Section 1. Акустика — RT60 по жанрам
          </h2>
          <p className="text-slate-400 text-sm max-w-3xl">
            RT60 (время реверберации) — время, за которое уровень звука снижается на 60 дБ после прекращения
            источника. Рассчитывается по формуле Сэбина: RT60 = 0.161 × V / A,
            где V — объём зала (м³), A — суммарное звукопоглощение (м²).
          </p>
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Жанр</th>
                  <th className="text-left px-4 py-3 w-32">RT60</th>
                  <th className="text-left px-4 py-3">Пояснение</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {acousticsData.map((row) => (
                  <tr key={row.genre} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 text-rose-300 font-medium text-sm">{row.genre}</td>
                    <td className="px-4 py-3 text-slate-100 font-mono text-xs font-bold">{row.rt60}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{row.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border border-rose-900/40 bg-rose-950/20 rounded-lg p-4 text-xs text-slate-300">
            <strong className="text-rose-300">Акустические элементы:</strong> отражающие панели
            (создают ранние отражения в 20–80 мс), поглощающие облицовки (управляют RT60),
            диффузоры (предотвращают flutter echo и «фокусировку» звука), регулируемые кулисы
            (смена RT60 без реконструкции). Расчёт — в программах CATT-Acoustic, EASE, Odeon.
          </div>
        </section>

        {/* Section 2: Сценическая механика */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            ⚙️ Section 2. Сценическая механика
          </h2>
          <div className="space-y-3">
            {stageMechanics.map((s) => (
              <div key={s.system} className="border border-rose-800/40 bg-rose-950/20 rounded-xl p-4">
                <h3 className="font-semibold text-rose-300 text-sm mb-1">{s.system}</h3>
                <p className="text-xs text-slate-300">{s.detail}</p>
              </div>
            ))}
          </div>
          <div className="border border-slate-800 rounded-lg p-4 bg-slate-900/40 text-xs text-slate-400">
            <strong className="text-slate-300">Производители:</strong> Waagner-Biro Stage Systems (Австрия),
            Bosch Rexroth (Германия), Trekwerk (Нидерланды). В РК: поставка преимущественно из Европы.
            Стоимость полного оснащения сцены: 500 млн – 3 млрд тг (для театра 800–1500 мест).
          </div>
        </section>

        {/* Section 3: Зрительный зал */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🪑 Section 3. Параметры зрительного зала
          </h2>
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Параметр</th>
                  <th className="text-left px-4 py-3 w-36">Значение</th>
                  <th className="text-left px-4 py-3">Примечание</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {auditoriumParams.map((row) => (
                  <tr key={row.param} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 text-rose-300 text-sm">{row.param}</td>
                    <td className="px-4 py-3 text-slate-100 font-mono text-xs">{row.value}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 4: Примеры РК */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🇰🇿 Section 4. Примеры в Казахстане
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {examplesRK.map((ex) => (
              <div key={ex.name} className="border border-rose-800/40 bg-rose-950/20 rounded-xl p-5">
                <h3 className="font-semibold text-rose-300 text-base mb-1">{ex.name}</h3>
                <div className="text-xs text-slate-400 mb-2">{ex.city} · {ex.seats}</div>
                <p className="text-xs text-slate-300">{ex.note}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Упражнения */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Упражнения</h2>

          {/* Упр.1 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 1 / 4 — Время реверберации RT60
            </div>
            <div className="text-slate-200 mb-4">
              При акустическом проектировании нового зала измеренное время реверберации
              RT60 составило <strong>2.5 секунды</strong>. Для какого жанра такой зал
              подходит оптимально?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Драматический театр (речь) — RT60 = 1.1–1.4 с" },
                { v: "b", t: "Мюзикл / оперетта — RT60 = 1.3–1.6 с" },
                { v: "c", t: "Симфоническая музыка и орган — RT60 = 2.2–3.0 с (включает 2.5 с как оптимум)" },
                { v: "d", t: "Опера без усиления — RT60 = 1.6–2.2 с (2.5 с уже слишком долго для вокала)" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex1 === opt.v ? "border-rose-600 bg-rose-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex1" value={opt.v} checked={ex1 === opt.v} onChange={() => setEx1(opt.v)} className="accent-rose-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx1} className="px-4 py-2 bg-rose-700 hover:bg-rose-600 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx1Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex1Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex1Res === "ok" && <span className="px-3 py-2 bg-rose-900/40 text-rose-300 rounded text-sm">✅ Верно — симфонический зал</span>}
              {ex1Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-rose-300">Решение:</strong> RT60 = 2.5 с оптимален для
                симфонической музыки. При таком времени реверберации:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Инструменты «сливаются» в единое звучание — эффект warmth и envelopment</li>
                  <li>Орган «дышит» — подходящая длительность затухания</li>
                  <li>Для оперы — слишком много: вокал теряет разборчивость при 2.5 с</li>
                  <li>Для речи — катастрофа: разборчивость практически нулевая при RT60 &gt; 1.5 с</li>
                </ul>
                Знаменитые залы с RT60 ≈ 2.0–2.5 с: Musikverein (Вена, 2.05 с),
                Concertgebouw (Амстердам, 2.0 с), Boston Symphony Hall (1.8 с).
                Для Астана Опера при RT60 ≈ 1.9 с — это компромисс между оперой и симфоний.
              </div>
            )}
          </div>

          {/* Упр.2 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Оркестровая яма
            </div>
            <div className="text-slate-200 mb-4">
              В оперном театре оркестровая яма спроектирована с возможностью опускания
              платформы на 2–3 метра ниже уровня пола. Какова главная акустическая
              причина этого конструктивного решения?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Для удобства музыкантов — они лучше видят дирижёра" },
                { v: "b", t: "Чтобы слышимость оркестра не перекрывала голоса певцов — баланс акустики: яма «накрывает» прямое звучание оркестра, смешивая его с отражённым звуком зала" },
                { v: "c", t: "Для экономии места в зрительном зале" },
                { v: "d", t: "Для защиты зрителей от громкого звука духовых инструментов" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex2 === opt.v ? "border-rose-600 bg-rose-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex2" value={opt.v} checked={ex2 === opt.v} onChange={() => setEx2(opt.v)} className="accent-rose-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx2} className="px-4 py-2 bg-rose-700 hover:bg-rose-600 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx2Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex2Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex2Res === "ok" && <span className="px-3 py-2 bg-rose-900/40 text-rose-300 rounded text-sm">✅ Верно — баланс голос/оркестр</span>}
              {ex2Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-rose-300">Решение:</strong> Концепция «опущенной ямы» —
                изобретение Вагнера, реализованное в Байройтском Фестшпильхаусе (1876):
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Оркестр 80–120 музыкантов производит уровень звука 90–105 дБ (SPL)</li>
                  <li>Человеческий голос (сопрано) — максимум 80–90 дБ без микрофона</li>
                  <li>Яма глубиной 2–3 м «накрывается» сверху нависающим просцениумом — прямой звук оркестра к зрителю приглушается на 6–12 дБ</li>
                  <li>Зрители слышат смешанный звук: голоса (сцена) + отражённый оркестр (зал)</li>
                  <li>Баланс достигается: оркестр слышен как фон, вокал — как главная партия</li>
                </ul>
                Глубина ямы: 2 м (мюзикл) → 2.5–3 м (опера) → 3–4 м (Вагнер, большой оркестр).
                Регулируемая яма Астана Опера: 3 уровня (яма / пол / сцена).
              </div>
            )}
          </div>

          {/* Упр.3 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — Бюджет театра
            </div>
            <div className="text-slate-200 mb-4">
              Планируется городской драматический театр. Исходные данные:
              зрительный зал <strong>800 мест × 1.2 м²/зрителя = 960 м²</strong>;
              сцена — <strong>800 м²</strong>; фойе и технические помещения — <strong>400 м²</strong>.
              Итого основной объём <strong>2 160 м²</strong>. Бенчмарк —
              <strong> 450 тыс. тг/м²</strong>. Рассчитайте бюджет СМР в <strong>тенге</strong>.
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Бюджет СМР, тг</span>
              <input
                value={ex3}
                onChange={(e) => setEx3(e.target.value)}
                type="number"
                className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100"
                placeholder="972000000"
              />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx3} className="px-4 py-2 bg-rose-700 hover:bg-rose-600 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx3Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex3Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex3Res === "ok" && <span className="px-3 py-2 bg-rose-900/40 text-rose-300 rounded text-sm">✅ Верно — 972 000 000 тг</span>}
              {ex3Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Перепроверь</span>}
            </div>
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-rose-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Площадь = зал 960 + сцена 800 + фойе/техн. 400 = 2 160 м²

Бюджет = 2 160 × 450 000 = 972 000 000 тг (≈ 972 млн тг)

Это только основной объём. Полный проект включает также:
• Репетиционные залы, гримёрки, цеха декораций: +30–40%
  → доп. +291–389 млн тг
• Сценическое оборудование (механика, свет):
  отдельно 500 млн – 2 млрд тг
• Акустическая отделка зала (специальные панели):
  +8–15% от стоимости зала → +70–140 млн тг

Полный бюджет (с оборудованием сцены):
≈ 1.8 – 2.5 млрд тг для театра 800 мест

Для сравнения: Астана Опера (1 250 мест, 2013) —
≈ 120 млрд тг (Флагман, международный класс)`}
                </pre>
              </div>
            )}
          </div>

          {/* Упр.4 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — Акустические панели
            </div>
            <div className="text-slate-200 mb-4">
              При проектировании драматического театра заказчик предлагает покрыть все
              стены зала максимально поглощающими акустическими панелями, чтобы
              «убрать эхо». Что должен ответить инженер-акустик?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Хорошая идея — чем больше поглощения, тем лучше слышна речь" },
                { v: "b", t: "Нужно только отражать звук, поглощение вредит зрительному залу" },
                { v: "c", t: "Тип панелей не имеет значения — главное их количество" },
                { v: "d", t: "Панели должны поглощать И отражать звук в нужных пропорциях: полное поглощение даст «мёртвый» зал с RT60 < 0.5 с, где речь воспринимается как в глухой комнате — утомляет, теряет «объём» и теплоту" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex4 === opt.v ? "border-rose-600 bg-rose-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex4" value={opt.v} checked={ex4 === opt.v} onChange={() => setEx4(opt.v)} className="accent-rose-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx4} className="px-4 py-2 bg-rose-700 hover:bg-rose-600 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx4Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex4Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex4Res === "ok" && <span className="px-3 py-2 bg-rose-900/40 text-rose-300 rounded text-sm">✅ Верно — баланс поглощения и отражения</span>}
              {ex4Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex4Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-rose-300">Решение:</strong> «Мёртвый зал» (anechoic) так же
                плох для спектакля, как и зал с длинным эхо. Правильный подход:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li><strong>Отражающие панели</strong> (дерево, гипс) — создают ранние отражения в 20–80 мс, добавляют «теплоту» и объём звука</li>
                  <li><strong>Поглощающие панели</strong> (минвата, перфорация) — управляют RT60, устраняют хвосты реверберации выше нормы</li>
                  <li><strong>Диффузоры</strong> (QRD, поверхности с рельефом) — рассеивают звук равномерно, убирают flutter echo и звуковые фокусы</li>
                  <li><strong>Низкочастотные ловушки</strong> — corner bass traps для устранения «бубнения» в углах зала</li>
                </ul>
                Целевой RT60 для драматического театра: 1.1–1.4 с (на частоте 500–1000 Гц).
                Проектировщик управляет этим балансом через расчёт в CATT-Acoustic или EASE,
                подбирая коэффициенты поглощения отделочных материалов на разных частотах.
              </div>
            )}
          </div>
        </section>

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">
          ISO 3382-1:2009 (Acoustics — Measurement of room acoustic parameters, Performance spaces).
          CIBSE Guide A (Environmental Design). СН РК 3.02-27 (Общественные здания и сооружения).
          Beranek L. «Concert Halls and Opera Houses» (Springer, 2004).
          Waagner-Biro Stage Systems. Астана Опера (2013). Театр им. М.О. Ауэзова (Алматы).
        </div>
      </main>
    </div>
  );
}
