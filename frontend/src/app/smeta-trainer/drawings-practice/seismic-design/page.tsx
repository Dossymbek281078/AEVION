"use client";

import Link from "next/link";
import { useState } from "react";

export default function SeismicDesignPage() {
  // Упр.1 — балльность Алматы
  const [ex1, setEx1] = useState<string | null>(null);
  const [ex1Res, setEx1Res] = useState<null | "ok" | "bad">(null);
  const [ex1Sol, setEx1Sol] = useState(false);

  // Упр.2 — расчёт антисейсмического пояса
  const [ex2H, setEx2H] = useState("");
  const [ex2L, setEx2L] = useState("");
  const [ex2Res, setEx2Res] = useState<null | "ok" | "bad">(null);
  const [ex2Sol, setEx2Sol] = useState(false);

  // Упр.3 — коэффициент K1 (демпфирование)
  const [ex3, setEx3] = useState<string | null>(null);
  const [ex3Res, setEx3Res] = useState<null | "ok" | "bad">(null);
  const [ex3Sol, setEx3Sol] = useState(false);

  // Упр.4 — стоимость антисейсмических мер
  const [ex4Area, setEx4Area] = useState("");
  const [ex4Res, setEx4Res] = useState<null | "ok" | "bad">(null);
  const [ex4Sol, setEx4Sol] = useState(false);

  const checkEx1 = () => setEx1Res(ex1 === "c" ? "ok" : "bad");
  const checkEx2 = () => {
    const h = parseFloat(ex2H);
    const l = parseFloat(ex2L);
    if (!isFinite(h) || !isFinite(l)) return setEx2Res("bad");
    // Бетон В20: V = 0.15 * h/1000 * 0.5 * l = объём пояса (h в мм, b=150 мм, hп=500 мм)
    // По СП РК 2.03-30 высота пояса = 150 мм минимум, ширина = ширине стены
    // Объём = 0.15м * (h/1000)м * lм. Для h=400мм b=150мм длина 24м → V=0.15*0.4*24=1.44 м³
    const expected = 0.15 * (h / 1000) * l;
    const tol = 0.05 * Math.abs(expected);
    setEx2Res(Math.abs(expected - 1.44) < tol && Math.abs(h - 400) < 20 && Math.abs(l - 24) < 1 ? "ok" : "bad");
  };
  const checkEx3 = () => setEx3Res(ex3 === "b" ? "ok" : "bad");
  const checkEx4 = () => {
    const a = parseFloat(ex4Area);
    if (!isFinite(a)) return setEx4Res("bad");
    // Алматы 9 баллов: +12-15% к стоимости каркаса (~25 тыс тг/м² надбавка)
    const expected = a * 25_000;
    setEx4Res(Math.abs(expected - 1_500 * 25_000) < 50_000 && Math.abs(a - 1500) < 50 ? "ok" : "bad");
  };

  const zones = [
    { city: "Алматы", intensity: "9 баллов", risk: "Очень высокий", note: "Зона Заилийского разлома, цикл крупных событий 80-100 лет" },
    { city: "Талдыкорган / Текели", intensity: "8-9", risk: "Высокий", note: "Близость к Заилийскому Алатау" },
    { city: "Жамбыл (Тараз)", intensity: "8", risk: "Высокий", note: "Тянь-Шаньская сейсмическая провинция" },
    { city: "Шымкент / Туркестан", intensity: "7-8", risk: "Средний-высокий", note: "Каратау и Угамский хребет" },
    { city: "Кызылорда", intensity: "7", risk: "Средний", note: "Сейсмика средней силы" },
    { city: "Усть-Каменогорск / Семей", intensity: "6-7", risk: "Средний", note: "Зайсанский регион" },
    { city: "Астана / Караганда", intensity: "5-6", risk: "Низкий", note: "Платформенный режим" },
    { city: "Атырау / Актау", intensity: "6", risk: "Низкий", note: "Прикаспийская впадина" },
  ];

  const measures = [
    { name: "Антисейсмические пояса", what: "Монолитные ж/б пояса по периметру всех несущих стен на каждом этаже", where: "В уровне перекрытий и под покрытием", norm: "СП РК 2.03-30 п.6.3, B15-B20, армир. 4Ø10-12 А400" },
    { name: "Усиление углов и пересечений", what: "Дополнительная арматура в углах и Т-пересечениях стен", where: "На длину 1 м в каждую сторону от угла", norm: "СП РК 2.03-30 п.6.5, сетка 4Ø8 А240 с шагом 700 мм по высоте" },
    { name: "Антисейсмические швы", what: "Вертикальные швы между блоками здания шириной 30-150 мм", where: "На длинных или разноэтажных зданиях", norm: "Ширина шва = 30+(H-5)*10 мм, где H — этажность" },
    { name: "Связи стен и перекрытий", what: "Анкеровка плит перекрытий в кладку стен", where: "По периметру каждого перекрытия", norm: "Анкеры Ø10 А240 через 1.5 м, длина заделки 30Ø" },
    { name: "Ограничение этажности кладки", what: "Каменные здания ≤ 4 этажей при 8 баллах, ≤ 3 при 9", where: "Несущие стены из кладки", norm: "СП РК 2.03-30 табл. 9, для 9 баллов H ≤ 12 м" },
    { name: "Демпфирующие подушки", what: "Резинометаллические опоры в основании (сейсмоизоляция)", where: "Между фундаментом и надземной частью", norm: "Сложные объекты — школы, больницы, высотки. Снижают сейсм. нагрузки в 3-5 раз" },
  ];

  const formula = [
    { label: "S — сейсмическая сила", v: "S = K₀ · K₁ · K₂ · K_ψ · A · β · Q" },
    { label: "K₀ — коэф. ответственности", v: "1.5 для школ/больниц, 1.2 для жилья, 1.0 для пром-я" },
    { label: "K₁ — коэф. допущ. повреждений", v: "0.25 (без повр.) … 0.4 (трещины) … 1.0 (разрушения)" },
    { label: "K₂ — конструктивный коэф.", v: "1.0 для каркаса, 1.3 для кладки, 0.8 для жёсткой схемы" },
    { label: "A — сейсм. ускорение", v: "0.05·g (5б) … 0.1·g (7б) … 0.2·g (8б) … 0.4·g (9б)" },
    { label: "β — коэф. динамичности", v: "f(период T) — 0.8 до 2.5, спектральный график" },
    { label: "Q — вес здания", v: "Постоянная + длительная временная + 0.5·кратковр." },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-sky-300 hover:text-sky-200 transition">
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Сейсмостойкость</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            🌋 Сейсмостойкость зданий РК
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            Казахстан — одна из наиболее сейсмоактивных территорий СНГ. <strong className="text-rose-300">Алматы и Алматинская
            область — зона 9 баллов</strong> по шкале MSK-64 (вероятность 10% за 50 лет). Все
            проекты подлежат сейсморасчёту по{" "}
            <span className="text-sky-300 font-medium">СП РК 2.03-30-2017</span> «Строительство в
            сейсмических районах»{" "}
            (актуализация СНиП РК 2.03-30-2006). Сейсмика добавляет к стоимости каркаса 8-18% и
            требует отдельной экспертизы.
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Норматив</div>
              <div className="text-slate-300">СП РК 2.03-30-2017 + ОСН РК 2.03-30-2006</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Балльность Алматы</div>
              <div className="text-slate-300">9 баллов MSK-64, ускорение A=0.4·g</div>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40">
              <div className="text-slate-500 uppercase tracking-wider mb-1">Удорожание</div>
              <div className="text-slate-300">+8-12% (7 баллов), +12-18% (9 баллов)</div>
            </div>
          </div>
        </section>

        {/* Section 1: Сейсмическое районирование */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🗺 Section 1. Сейсмическое районирование РК
          </h2>
          <p className="text-slate-400 text-sm max-w-4xl">
            Карта сейсморайонирования ОСР-2006 (актуализация — 2017) делит территорию РК на 5 зон
            интенсивности. Балльность по MSK-64 для конкретной площадки уточняется
            микрорайонированием (детальное обследование грунтов 1-й категории, рыхлые насыпные
            грунты добавляют +1-2 балла).
          </p>

          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Регион / город</th>
                  <th className="text-left px-4 py-3 w-32">Интенсивность</th>
                  <th className="text-left px-4 py-3 w-32">Риск</th>
                  <th className="text-left px-4 py-3">Геологическая обстановка</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {zones.map((z) => (
                  <tr key={z.city} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 font-medium text-slate-100">{z.city}</td>
                    <td className="px-4 py-3 text-rose-300 font-mono">{z.intensity}</td>
                    <td className="px-4 py-3 text-slate-300">{z.risk}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{z.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 2: Формула */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            📐 Section 2. Формула сейсмической нагрузки
          </h2>
          <p className="text-slate-400 text-sm max-w-4xl">
            Спектральный метод по СП РК 2.03-30. Расчёт ведётся для каждой формы собственных
            колебаний и по горизонтальным X, Y и вертикальной Z составляющим. Базовая формула —
            произведение коэффициентов на ускорение и массу.
          </p>

          <div className="border border-sky-800/60 bg-sky-950/30 rounded-xl p-5">
            <div className="text-sky-300 font-mono text-lg mb-3 text-center">
              S = K₀ · K₁ · K₂ · K_ψ · A · β · Q
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {formula.map((f) => (
                <div key={f.label} className="border border-slate-800 rounded p-2 bg-slate-900/60">
                  <div className="text-sky-300 font-mono">{f.label}</div>
                  <div className="text-slate-300 mt-1">{f.v}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 3: Антисейсмические меры */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🛡 Section 3. Шесть обязательных антисейсмических мер
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {measures.map((m) => (
              <div key={m.name} className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
                <h3 className="text-base font-semibold text-amber-300 mb-2">{m.name}</h3>
                <dl className="text-sm space-y-2">
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Что</dt>
                    <dd className="text-slate-300">{m.what}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Где</dt>
                    <dd className="text-slate-300">{m.where}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Норматив</dt>
                    <dd className="text-slate-400 text-xs">{m.norm}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* Упражнения */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Section 4. Упражнения</h2>

          {/* Упр.1 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 1 / 4 — Балльность Алматы
            </div>
            <div className="text-slate-200 mb-4">
              По карте сейсмического районирования ОСР-2006 территория Алматы относится к зоне
              интенсивностью:
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "7 баллов" },
                { v: "b", t: "8 баллов" },
                { v: "c", t: "9 баллов" },
                { v: "d", t: "10 баллов" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex1 === opt.v ? "border-sky-600 bg-sky-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex1" value={opt.v} checked={ex1 === opt.v} onChange={() => setEx1(opt.v)} className="accent-sky-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx1} className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx1Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex1Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex1Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 9 баллов</span>}
              {ex1Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-sky-300">Решение:</strong> Алматы находится в зоне Заилийского разлома (длина 280 км),
                карта ОСР-2006 относит город к зоне 9 баллов MSK-64 (расчётное ускорение 0.4·g, что
                соответствует ~400 см/с²). Микрорайонирование внутри города выделяет участки 8-10
                баллов (низменности у Каскелена — до 10 баллов, склоны Алатау — 8). Все
                ответственные здания рассчитываются на 9 баллов с возможным повышением для I и II
                категории сложности.
              </div>
            )}
          </div>

          {/* Упр.2 — расчёт пояса */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Объём антисейсмического пояса
            </div>
            <div className="text-slate-200 mb-4">
              Кирпичное двухэтажное здание 6×12 м (наружные стены 360 мм, внутренних
              продольных нет). Антисейсмический пояс по СП РК 2.03-30 на уровне перекрытия:
              высота h = <strong>400 мм</strong>, ширина b = 150 мм по верху стены. Длина пояса по
              периметру L = 2·(6+12) = <strong>24 м</strong>. Сколько м³ бетона на один пояс
              (один этаж)? Округление до 2 знаков. Введите параметры:
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <label className="flex flex-col">
                <span className="text-slate-400 text-xs mb-1">Высота h, мм</span>
                <input value={ex2H} onChange={(e) => setEx2H(e.target.value)} type="number" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="400" />
              </label>
              <label className="flex flex-col">
                <span className="text-slate-400 text-xs mb-1">Длина пояса L, м</span>
                <input value={ex2L} onChange={(e) => setEx2L(e.target.value)} type="number" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="24" />
              </label>
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx2} className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx2Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex2Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex2Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — V ≈ 1.44 м³</span>}
              {ex2Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Проверь параметры. Ожидается h=400, L=24</span>}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-sky-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`V = b × h × L
V = 0.15 м × 0.40 м × 24 м
V = 1.44 м³ бетона B15

Армирование: 4Ø12 А400 продольно + хомуты Ø6 А240 шаг 200 мм
Расход арматуры ≈ 4 × 0.888 кг/м × 24 м = 85 кг (продольная)
Расценка ЭСН Сб.6 РК — обычно 5-6-3 (монолитный пояс).
На 2 этажа = 2.88 м³ бетона + ≈170 кг арматуры на здание.`}
                </pre>
              </div>
            )}
          </div>

          {/* Упр.3 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — Коэффициент K₁ (допускаемые повреждения)
            </div>
            <div className="text-slate-200 mb-4">
              Здание относится к категории сооружений, для которых при расчётном землетрясении
              допускаются трещины в несущих конструкциях, но обеспечивается сохранность жизни
              людей (рядовое жильё, школа в обычном режиме эксплуатации). Какое значение
              коэффициента K₁ по СП РК 2.03-30 следует принять?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "K₁ = 0.12 — без повреждений, упругая работа" },
                { v: "b", t: "K₁ = 0.25-0.40 — допустимы трещины, сохранение жизни" },
                { v: "c", t: "K₁ = 1.0 — допускается частичное обрушение" },
                { v: "d", t: "K₁ = 1.5 — здание не подлежит расчёту на сейсмику" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex3 === opt.v ? "border-sky-600 bg-sky-950/30" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input type="radio" name="ex3" value={opt.v} checked={ex3 === opt.v} onChange={() => setEx3(opt.v)} className="accent-sky-500" />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx3} className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx3Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex3Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex3Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно</span>}
              {ex3Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Неверно</span>}
            </div>
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-sky-300">Решение:</strong> По СП РК 2.03-30 п.5.2.6
                принят двухуровневый расчёт: ПЗ (проектное землетрясение) и МРЗ (макс.
                расчётное). Для МРЗ при категории II по ответственности (жильё, школы) K₁ = 0.25.
                Для I (больницы, штабы ГО, спасательные станции) K₁ = 0.12 — упругая работа без
                трещин. K₁ = 1.0 — категория III (склады, временные сооружения), допускается
                разрушение без угрозы жизни. Значения от 0.25 до 0.40 — выбор зависит от
                конкретной схемы.
              </div>
            )}
          </div>

          {/* Упр.4 */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — Удорожание от сейсмики
            </div>
            <div className="text-slate-200 mb-4">
              Жилой дом в Алматы, S = <strong>1 500 м²</strong> общей площади, монолитный
              ж/б каркас. Удельная надбавка за антисейсмические мероприятия (антисейсм. пояса,
              усиленная арматура, шаг хомутов, демпфирование) — <strong>~25 000 тг/м²</strong> для
              9 баллов (~12% от стоимости каркаса 200 тыс тг/м²). Чему равна суммарная надбавка
              в тыс. тг? Введите площадь:
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Общая площадь S, м²</span>
              <input value={ex4Area} onChange={(e) => setEx4Area(e.target.value)} type="number" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100" placeholder="1500" />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={checkEx4} className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded transition text-sm">Проверить</button>
              <button onClick={() => setEx4Sol((v) => !v)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition text-sm">
                {ex4Sol ? "Скрыть решение" : "Показать решение"}
              </button>
              {ex4Res === "ok" && <span className="px-3 py-2 bg-emerald-900/40 text-emerald-300 rounded text-sm">✅ Верно — 37 500 тыс тг</span>}
              {ex4Res === "bad" && <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">❌ Проверь S=1500</span>}
            </div>
            {ex4Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-sky-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Надбавка = S × 25 000 тг/м²
Надбавка = 1 500 × 25 000
Надбавка = 37 500 000 тг = 37.5 млн тг ≈ 12% от каркаса

Состав надбавки (типовой для 9 баллов):
• Антисейсмические пояса (2 этажа+чердак) — 35%
• Усиленная арматура (Ø12-16 вместо Ø10) — 25%
• Усиление узлов и связей — 20%
• Расчёт + экспертиза специализированная — 8%
• Антисейсмический шов (если есть) — 7%
• Прочее (антипанические замки, ограждения) — 5%

Для 7 баллов надбавка ≈ 10 тыс тг/м², для 8 баллов — 17 тыс тг/м².`}
                </pre>
              </div>
            )}
          </div>
        </section>

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">
          СП РК 2.03-30-2017 — Строительство в сейсмических районах. ОСР-2006 — карта
          сейсморайонирования. Карта МСР (микрорайонирование) Алматы — Постановление акимата
          № 4-1198. Расчёты ведутся в ЛИРА-САПР / SCAD / Stark ES.
        </div>
      </main>
    </div>
  );
}
