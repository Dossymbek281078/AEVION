"use client";

import Link from "next/link";
import { useState } from "react";

export default function LabControlPage() {
  // Упр.1 — частота отбора кубиков
  const [ex1, setEx1] = useState<string | null>(null);
  const [ex1Res, setEx1Res] = useState<null | "ok" | "bad">(null);
  const [ex1Sol, setEx1Sol] = useState(false);

  // Упр.2 — расчёт класса бетона по прочности кубиков
  const [ex2R, setEx2R] = useState("");
  const [ex2Res, setEx2Res] = useState<null | "ok" | "bad">(null);
  const [ex2Sol, setEx2Sol] = useState(false);

  // Упр.3 — приёмка арматуры
  const [ex3, setEx3] = useState<string | null>(null);
  const [ex3Res, setEx3Res] = useState<null | "ok" | "bad">(null);
  const [ex3Sol, setEx3Sol] = useState(false);

  // Упр.4 — стоимость лабораторного контроля
  const [ex4Vol, setEx4Vol] = useState("");
  const [ex4Res, setEx4Res] = useState<null | "ok" | "bad">(null);
  const [ex4Sol, setEx4Sol] = useState(false);

  const checkEx1 = () => setEx1Res(ex1 === "b" ? "ok" : "bad");
  const checkEx2 = () => {
    // B25: нормативная прочность куба 327 кгс/см² (B класс*100×0.78×1.66 при KV=13.5%)
    // Упрощённо: B = R_куба × Kt × Kv ≈ R/14.5 (R в кгс/см² → B в МПа)
    // Если R_среднее=37.5 МПа (382 кгс/см²) → B = R × (1-1.64·0.135) ≈ R × 0.778 ≈ 29.2 → B25 (т.к. ближайший)
    // Правильный ответ: класс B25 (или 25-30 МПа)
    const r = parseFloat(ex2R);
    if (!isFinite(r)) return setEx2Res("bad");
    setEx2Res(Math.abs(r - 25) <= 2 ? "ok" : "bad");
  };
  const checkEx3 = () => setEx3Res(ex3 === "d" ? "ok" : "bad");
  const checkEx4 = () => {
    // V=1000 м³ бетона, серий = 1 на 100 м³ = 10 серий, 1 серия = 3 куба × 3000 тг = 9000 тг
    // Итого: 10 × 9000 + поездки лаборанта ~30000 + журнал ≈ 130 000 тг
    const v = parseFloat(ex4Vol);
    if (!isFinite(v)) return setEx4Res("bad");
    setEx4Res(Math.abs(v - 130_000) <= 15_000 ? "ok" : "bad");
  };

  const tests = [
    {
      mat: "Бетон",
      what: "Кубики 100×100×100 или 150×150×150 мм",
      freq: "1 серия (3 куба) на 100 м³ бетона или на каждую захватку (партию)",
      norm: "ГОСТ 10180-2012, ГОСТ 18105-2018, СН РК 1.03-00",
      lab: "Сжатие после 28 сут. (R28). Прочность класса: B = R_среднее × (1 − 1.64·Kv)",
      cost: "1 серия — 8-12 тыс. тг (отбор + испытание)",
    },
    {
      mat: "Арматура",
      what: "Образцы по 3 шт. на каждые 60 т из партии",
      freq: "При поступлении партии и при сомнении",
      norm: "ГОСТ 12004-81, ГОСТ 28207-2018 (растяжение), ГОСТ 9012 (HB)",
      lab: "Предел текучести σ_т, временное сопротивление σ_в, относит. удлинение δ₅",
      cost: "Растяжение 3 обр. — 5-8 тыс. тг",
    },
    {
      mat: "Грунт основания",
      what: "Пробы из шурфа/скважины (нарушенные + ненарушенные)",
      freq: "1 проба на 100-300 м² и на каждую инженерно-геол. разновидность",
      norm: "ГОСТ 5180-2015, ГОСТ 22733, ГОСТ 12248, СН РК 1.02-07",
      lab: "Плотность ρ, влажность w, гранулометрия, e0, c, φ, E",
      cost: "Базовый комплекс на пробу — 15-25 тыс. тг",
    },
    {
      mat: "Кладочный раствор",
      what: "Кубики 70×70×70 мм или образцы из шва",
      freq: "1 серия (3 куба) на 100 м³ кладки",
      norm: "ГОСТ 5802-86, СН РК 1.03-00",
      lab: "Прочность на сжатие M25 / M50 / M75 / M100",
      cost: "Серия — 4-6 тыс. тг",
    },
    {
      mat: "Стяжка пола",
      what: "Контрольные образцы или сверления",
      freq: "1 серия на каждые 500 м² или захватку",
      norm: "ГОСТ 5802-86, СП РК 3.02-101",
      lab: "Прочность сжатие, влажность, ровность 2 мм/2 м",
      cost: "Серия — 4-6 тыс. тг",
    },
    {
      mat: "Сварные соединения",
      what: "УЗК / рентген / визуальный контроль (см. weld-control модуль)",
      freq: "100% швов категории I, 25% II, 10% III",
      norm: "ГОСТ 14782, СН РК 5.04-23",
      lab: "Отсутствие непроваров, пор, шлаковых включений",
      cost: "1 шов УЗК — 3-5 тыс. тг, рентген — 8-12 тыс. тг",
    },
    {
      mat: "Тепло-, гидро-, звукоизоляция",
      what: "Образцы из рулона / плиты, контроль толщины",
      freq: "1 проба на 1000 м² + контроль входной партии",
      norm: "ГОСТ Р 56590, ГОСТ 17177-94",
      lab: "Толщина, плотность, теплопроводность, водопоглощение",
      cost: "1 испытание — 6-10 тыс. тг",
    },
    {
      mat: "Асфальтобетон",
      what: "Керны (вырубки) Ø100 мм после устройства",
      freq: "1 керн на 7 000 м² или 1 раз в смену",
      norm: "ГОСТ 12801, ГОСТ 9128",
      lab: "Толщина, плотность, водонасыщение, прочность",
      cost: "1 керн с испытаниями — 8-15 тыс. тг",
    },
  ];

  const documents = [
    { name: "Журнал лабораторного контроля", who: "Лаборатория", note: "Подшит, прошнурован, ведётся по ходу работ" },
    { name: "Акты отбора образцов (по форме ГОСТ)", who: "Лаборант + Прораб", note: "Двусторонние, с маркировкой партии" },
    { name: "Протоколы испытаний", who: "Лаборатория", note: "Выдаются через 28 сут. для бетона, 1-3 дня для арматуры" },
    { name: "Паспорта на материалы (от поставщика)", who: "Поставщик", note: "Сертификат соответствия, паспорт качества" },
    { name: "Заключения о пригодности", who: "Лаборатория + Авт. надзор", note: "При отклонениях — решение о применении" },
    { name: "Акт скрытых работ (АОСР) на этапе", who: "ТН + Авт. надзор + Подрядчик", note: "Со ссылками на протоколы испытаний" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-sky-300 hover:text-sky-200 transition">
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Лабораторный контроль</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            🧪 Лабораторный контроль качества
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            Контроль прочности бетона, арматуры, грунта основания и других материалов —{" "}
            <strong className="text-orange-300">обязательная часть строительного процесса</strong>{" "}
            по СН РК 1.03-00. Без протоколов испытаний приёмка АОСР невозможна, КС-2 не
            подписывается. Лаборатория — собственная или аккредитованная по ISO/IEC 17025
            (Госстандарт РК — Казахстанский институт стандартизации). Услуги входят в смету
            строкой «лабораторный контроль» в составе НР (~0.2-0.5% от СМР).
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Норматив</div>
              <div className="text-slate-300">СН РК 1.03-00 + серия ГОСТ 10180/12004/5180</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Аккредитация</div>
              <div className="text-slate-300">ISO/IEC 17025 + реестр НЦА РК</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Стоимость в смете</div>
              <div className="text-slate-300">0.2-0.5% от СМР (входит в НР)</div>
            </div>
          </div>
        </section>

        {/* Section 1: Виды испытаний */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🔬 Section 1. Виды лабораторного контроля
          </h2>
          <div className="space-y-3">
            {tests.map((t) => (
              <div key={t.mat} className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
                <div className="flex items-baseline justify-between gap-4 mb-2">
                  <h3 className="text-base font-semibold text-orange-300">{t.mat}</h3>
                  <span className="text-xs text-slate-500 italic">{t.cost}</span>
                </div>
                <dl className="text-sm grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Что отбирается</dt>
                    <dd className="text-slate-300">{t.what}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Частота</dt>
                    <dd className="text-slate-300">{t.freq}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Норматив</dt>
                    <dd className="text-slate-400 text-xs">{t.norm}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Что определяется</dt>
                    <dd className="text-slate-300 text-xs">{t.lab}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Формула класса бетона */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            📐 Section 2. Расчёт класса бетона по результатам испытаний
          </h2>
          <p className="text-slate-400 text-sm max-w-4xl">
            По ГОСТ 18105-2018 класс прочности бетона B (в МПа) рассчитывается с учётом
            статистического разброса серии. Чем больше партий и стабильнее производство — тем
            выше коэффициент использования R_среднего.
          </p>

          <div className="border border-orange-800/60 bg-orange-950/30 rounded-xl p-5">
            <div className="text-orange-300 font-mono text-lg mb-3 text-center">
              B = R̄ × (1 − 1.64 · K_v)
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="border border-slate-800 rounded p-3 bg-slate-900/60">
                <div className="text-orange-300 font-mono mb-1">R̄</div>
                <div className="text-slate-300 text-xs">Средняя прочность серии (МПа). Получается из протокола испытания трёх кубов на сжатие в возрасте 28 суток.</div>
              </div>
              <div className="border border-slate-800 rounded p-3 bg-slate-900/60">
                <div className="text-orange-300 font-mono mb-1">K_v</div>
                <div className="text-slate-300 text-xs">Коэффициент вариации прочности: 0.135 — обычная, 0.10 — стабильное произв-во, 0.07 — заводское (BSU).</div>
              </div>
              <div className="border border-slate-800 rounded p-3 bg-slate-900/60">
                <div className="text-orange-300 font-mono mb-1">1.64</div>
                <div className="text-slate-300 text-xs">Квантиль обеспеченности 95% (значения t-Стьюдента для нормального распределения).</div>
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-500">
            Маркировка: <span className="text-orange-300">B25</span> = 25 МПа = класс прочности.
            Эквивалент М350 в старой системе. Шкала: B7.5 / B10 / B12.5 / B15 / B20 / <span className="text-orange-300">B25</span> / B30 / B35 / B40 / B45 / B50 / B55 / B60.
          </div>
        </section>

        {/* Section 3: Документация */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            📋 Section 3. Документация по лабораторному контролю
          </h2>
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Документ</th>
                  <th className="text-left px-4 py-3 w-48">Кто оформляет</th>
                  <th className="text-left px-4 py-3">Особенности</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {documents.map((d) => (
                  <tr key={d.name} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 text-slate-100">{d.name}</td>
                    <td className="px-4 py-3 text-orange-300">{d.who}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{d.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Упражнения */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Section 4. Упражнения</h2>

          {/* Упр.1 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 1 / 4 — Частота отбора кубиков бетона
            </div>
            <div className="text-slate-200 mb-4">
              Залит фундамент V = 250 м³ бетоном B25 (М350). Сколько серий кубиков (по 3
              куба в серии) необходимо отобрать для контроля прочности по ГОСТ 18105?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "1 серия (3 куба) — общий контроль партии" },
                { v: "b", t: "3 серии (9 кубов) — на каждые 100 м³" },
                { v: "c", t: "5 серий — на каждые 50 м³" },
                { v: "d", t: "10 серий — на каждые 25 м³" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex1 === opt.v ? "border-orange-600 bg-orange-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex1" value={opt.v} checked={ex1 === opt.v} onChange={() => setEx1(opt.v)} className="accent-orange-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx1} className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx1Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex1Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex1Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 3 серии</span>}
              {ex1Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-orange-300">Решение:</strong> По ГОСТ 18105-2018 п.5.2 для
                бетона монолитных конструкций — <strong>1 серия (3 куба) на каждые 100 м³</strong>,
                но не реже одной серии в смену укладки и не реже одной серии на захватку.
                Для V = 250 м³ → ceil(250/100) = 3 серии (= 9 кубов). Часть кубиков испытывают
                в промежуточные сроки (7, 14 сут) для прогноза, основной контроль — 28 сут.
                Дополнительно — образцы из конструкции (керны Ø100 мм) при сомнении в результатах.
              </div>
            )}
          </div>

          {/* Упр.2 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Расчёт класса бетона
            </div>
            <div className="text-slate-200 mb-4">
              Лаборатория испытала серию из 3 кубов 100×100×100 мм в возрасте 28 суток.
              Результаты разрушения: R₁ = <strong>37.0</strong>, R₂ = <strong>38.5</strong>,
              R₃ = <strong>37.0</strong> МПа. Среднее R̄ = <strong>37.5</strong> МПа. Коэф. вариации
              K_v = <strong>0.135</strong> (обычное производство). Какому классу B соответствует?
              (Ответ в МПа, ближайший стандартный.)
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Класс B, МПа</span>
              <input value={ex2R} onChange={(e) => setEx2R(e.target.value)} type="number" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="25" />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx2} className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx2Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex2Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex2Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — B25</span>}
              {ex2Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Перепроверь формулу</span>}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-orange-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Шаг 1. R̄ = (37.0 + 38.5 + 37.0) / 3 = 37.5 МПа

Шаг 2. Поправка на форму куба 100×100 (по ГОСТ 10180):
       k_размер = 0.95 (для кубов 100 мм vs 150 мм базовых)
       R̄_приведённое = 37.5 × 0.95 = 35.6 МПа

Шаг 3. Класс по обеспеченности 95%:
       B = R̄ × (1 − 1.64 × K_v)
       B = 35.6 × (1 − 1.64 × 0.135)
       B = 35.6 × (1 − 0.221)
       B = 35.6 × 0.779
       B ≈ 27.7 МПа

Шаг 4. Ближайший стандартный класс (с округлением ВНИЗ):
       B25 (т.к. B30 не обеспечен)

Бетон соответствует проектному классу B25. ✓
Если результат был бы 27 МПа → проблема, нужна
повторная серия или керны из конструкции.`}
                </pre>
              </div>
            )}
          </div>

          {/* Упр.3 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — Документы на арматуру
            </div>
            <div className="text-slate-200 mb-4">
              На объект поступила арматура А500С Ø12 (партия 5 т). Поставщик предъявил
              сертификат соответствия и паспорт качества. Что ещё <strong>обязательно
              сделать</strong> до укладки в конструкцию?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Ничего не нужно — сертификата достаточно" },
                { v: "b", t: "Только визуальный осмотр на коррозию" },
                { v: "c", t: "Сверка геометрии (диаметр, длина) с накладной" },
                { v: "d", t: "Отбор образцов (3 шт.) и испытание на разрыв в аккредит. лаборатории" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex3 === opt.v ? "border-orange-600 bg-orange-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex3" value={opt.v} checked={ex3 === opt.v} onChange={() => setEx3(opt.v)} className="accent-orange-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx3} className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx3Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex3Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex3Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно</span>}
              {ex3Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-orange-300">Решение:</strong> По ГОСТ 12004-81 и
                СН РК 1.03-00 при поступлении партии арматуры свыше 60 т (или при сомнении
                в качестве — независимо от размера) — обязательны входной контроль и
                испытания. Сертификат поставщика не заменяет испытание. Отбирается 3 образца
                на разрыв (длина 0.6-1 м), определяется σ_т (предел текучести), σ_в (временное
                сопротивление), δ₅ (относит. удлинение). По А500С: σ_т ≥ 500 МПа, σ_в ≥ 600
                МПа, δ₅ ≥ 14%. Без протокола испытаний АОСР на скрытую арматуру не подписывается.
              </div>
            )}
          </div>

          {/* Упр.4 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — Стоимость лаб. контроля бетона
            </div>
            <div className="text-slate-200 mb-4">
              Объект: жилой дом, объём монолитного бетона V = <strong>1 000 м³</strong>.
              Контроль по ГОСТ 18105: <strong>1 серия (3 куба) на 100 м³</strong>.
              Стоимость 1 серии (отбор + испытание): <strong>9 000 тг</strong>. Сопутствующие
              расходы: 10 выездов лаборанта × 3 000 тг + журнал и протоколы ≈ 10 000 тг.
              Какая суммарная стоимость лабораторного контроля бетона на объекте?
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Стоимость, тг</span>
              <input value={ex4Vol} onChange={(e) => setEx4Vol(e.target.value)} type="number" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="130000" />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx4} className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx4Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex4Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex4Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — ~130 000 тг</span>}
              {ex4Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Перепроверь</span>}
            </div>
            {ex4Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-orange-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Шаг 1. Количество серий:
       n = V / 100 = 1000 / 100 = 10 серий

Шаг 2. Стоимость испытаний:
       10 × 9 000 = 90 000 тг

Шаг 3. Выезды лаборанта:
       10 × 3 000 = 30 000 тг

Шаг 4. Журнал, оформление, протоколы:
       ≈ 10 000 тг

ИТОГО: 90 000 + 30 000 + 10 000 = 130 000 тг

Доля в смете: 130 000 / (1000 × 35 000 тг/м³ В25) ≈ 0.37%
— укладывается в типовые 0.2-0.5% от стоимости СМР.

Если арматура (50 т) + грунты (5 проб) + раствор → +
80-150 тыс. тг = итог ~280 тыс. тг лаб. контроля на объект.`}
                </pre>
              </div>
            )}
          </div>
        </section>

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">
          СН РК 1.03-00 — Контроль качества строительства. ГОСТ 10180-2012 (методы определения
          прочности бетона по контр. образцам). ГОСТ 18105-2018 (правила контроля прочности).
          ГОСТ 12004-81 (методы испытания арматурной стали на растяжение). ГОСТ 5180-2015
          (физические характеристики грунтов). Реестр лабораторий — НЦА РК (nca.kz).
        </div>
      </main>
    </div>
  );
}
