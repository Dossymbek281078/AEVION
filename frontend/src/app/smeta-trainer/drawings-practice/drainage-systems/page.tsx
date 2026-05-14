"use client";

import Link from "next/link";
import { useState } from "react";

export default function DrainageSystemsPage() {
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

  const checkEx1 = () => setEx1Res(ex1 === "b" ? "ok" : "bad");
  const checkEx2 = () => setEx2Res(ex2 === "c" ? "ok" : "bad");
  const checkEx3 = () => {
    const v = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
    if (!isFinite(v)) return setEx3Res("bad");
    setEx3Res(Math.abs(v - 80) <= 5 ? "ok" : "bad");
  };
  const checkEx4 = () => setEx4Res(ex4 === "d" ? "ok" : "bad");

  const drainageTypes = [
    {
      type: "Вертикальный дренаж",
      design: "Скважины с насосами, откачивающими грунтовые воды",
      use: "Понижение УГВ на больших территориях, аэродромы, с/х поля",
    },
    {
      type: "Горизонтальный пластовый",
      design: "Слой щебня/гравия под фундаментной плитой, дренирует снизу вверх",
      use: "Защита подвалов и фундаментных плит при высоком УГВ",
    },
    {
      type: "Горизонтальный трубчатый",
      design: "Перфорированная ПВХ/HDPE труба в геотекстиле, в гравийной обсыпке",
      use: "Дренаж по периметру зданий, дороги, спортивные поля",
    },
    {
      type: "«Сухой» засыпной",
      design: "Траншея, заполненная щебнем без трубы, с геотекстилем по контуру",
      use: "Малые участки, садовый дренаж, ограниченный бюджет",
    },
    {
      type: "Гравийный пристенный",
      design: "Полоса щебня вдоль стены фундамента с профильной мембраной",
      use: "Защита стен подвала от капиллярной влаги и бокового давления воды",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/smeta-trainer/drawings-practice"
            className="text-sm text-blue-300 hover:text-blue-200 transition"
          >
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Дренажные системы</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            🌊 Дренажные системы
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            Дренаж — система отвода грунтовых и поверхностных вод от фундаментов, дорог
            и территорий. Правильно спроектированный дренаж увеличивает срок службы
            фундамента в <strong className="text-blue-300">2–3 раза</strong> и
            предотвращает затопление подвалов. В РК особенно актуален в Алматы (высокий
            УГВ весной) и в северных районах (таяние снега).
          </p>
          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-blue-900/40 rounded-lg p-3 bg-blue-950/20">
              <div className="text-blue-500 uppercase tracking-wider mb-1">Минимальный уклон</div>
              <div className="text-slate-300">1‰ (1 мм/м) — для самотёка</div>
            </div>
            <div className="border border-blue-900/40 rounded-lg p-3 bg-blue-950/20">
              <div className="text-blue-500 uppercase tracking-wider mb-1">Материал трубы</div>
              <div className="text-slate-300">Гофр ПВХ/HDPE с перфорацией + геотекстиль</div>
            </div>
            <div className="border border-blue-900/40 rounded-lg p-3 bg-blue-950/20">
              <div className="text-blue-500 uppercase tracking-wider mb-1">Нормативная база РК</div>
              <div className="text-slate-300">СН РК 4.01-43, СНиП 3.04-01-87</div>
            </div>
          </div>
        </section>

        {/* Раздел 1 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-blue-300">
            📊 Раздел 1. Виды дренажных систем
          </h2>
          <p className="text-sm text-slate-400">
            Выбор типа дренажа зависит от уровня грунтовых вод (УГВ), типа грунта,
            назначения объекта и бюджета.
          </p>
          <div className="overflow-x-auto border border-blue-900/30 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 w-44">Тип дренажа</th>
                  <th className="text-left px-4 py-3">Конструкция</th>
                  <th className="text-left px-4 py-3">Применение</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {drainageTypes.map((r) => (
                  <tr key={r.type} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 font-bold text-blue-300 text-sm whitespace-nowrap">
                      {r.type}
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{r.design}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{r.use}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Раздел 2 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-blue-300">
            🏗 Раздел 2. Применение дренажных систем
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                icon: "🏠",
                title: "Защита фундаментов от УГВ",
                desc: "Трубчатый дренаж по периметру здания + пластовый под плитой. Обязателен при УГВ выше подошвы фундамента. В Алматы весной УГВ поднимается до 0.5–1.5 м от поверхности.",
              },
              {
                icon: "🛣",
                title: "Дренаж под дорогами",
                desc: "Горизонтальный трубчатый дренаж по обочинам или под проезжей частью. Предотвращает пучение грунта зимой и разрушение дорожного полотна. СН РК 3.03-01 (автодороги).",
              },
              {
                icon: "⚽",
                title: "Спортивные поля",
                desc: "Решётчатая система трубчатого дренажа с шагом 5–10 м. Обеспечивает быстрый отвод воды после дождя (норма: поле готово к игре через 1 час после 15 мм/ч осадков).",
              },
              {
                icon: "🌱",
                title: "Осушение участков",
                desc: "Открытые или закрытые дренажные каналы для сельскохозяйственных угодий и застройки на заболоченных территориях. Проектируется по СН РК 4.01-43.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="border border-blue-900/30 bg-blue-950/10 rounded-xl p-5"
              >
                <h3 className="text-base font-semibold text-blue-300 mb-2">
                  {f.icon} {f.title}
                </h3>
                <p className="text-sm text-slate-300">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Раздел 3 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-blue-300">
            🔧 Раздел 3. Конструкция дренажной трубы и расчёт
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-blue-900/30 bg-blue-950/10 rounded-xl p-5">
              <h3 className="text-base font-semibold text-blue-300 mb-3">
                Стандартная дренажная труба
              </h3>
              <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside">
                <li>
                  Материал: гофрированная труба ПВХ или HDPE с перфорацией (диаметр
                  110–200 мм для зданий)
                </li>
                <li>
                  Обмотка: геотекстиль (нетканый полипропилен, плотность 100–150 г/м²) —
                  фильтрует грунт, не даёт забиться перфорации
                </li>
                <li>
                  Гравийная обсыпка: фракция 20–40 мм, толщина 150–200 мм вокруг трубы
                </li>
                <li>
                  Уклон: не менее 1‰ (1 мм/м), рекомендуется 2–3‰ для надёжного
                  самотёка
                </li>
                <li>
                  Ревизионные колодцы: через каждые 30–50 м и в точках поворота
                </li>
              </ul>
            </div>
            <div className="border border-slate-800 bg-slate-900/30 rounded-xl p-5">
              <h3 className="text-base font-semibold text-slate-300 mb-3">
                Гидравлический расчёт
              </h3>
              <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside">
                <li>
                  Формула расхода: <span className="font-mono text-amber-300">Q = V × F</span>, где
                  Q — расход (м³/с), V — скорость (м/с), F — площадь сечения трубы (м²)
                </li>
                <li>
                  Скорость самотёка в дренаже: 0.2–1.0 м/с (минимум — чтобы не заиливало)
                </li>
                <li>
                  Диаметр 110 мм: до 5 л/с; диаметр 160 мм: до 12 л/с; диаметр 200 мм:
                  до 20 л/с
                </li>
                <li>
                  Расчётные осадки для Алматы: 0.7–1.2 мм/мин (ливень 1% обеспеченности)
                </li>
                <li>
                  Глубина заложения дренажа: ниже подошвы фундамента на 0.3–0.5 м, но
                  выше глубины промерзания
                </li>
              </ul>
            </div>
          </div>
          <div className="border border-blue-900/20 bg-blue-950/10 rounded-xl p-4 text-sm">
            <strong className="text-blue-300">Стоимость дренажных работ в смете (РК, 2024–2025):</strong>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
              {[
                ["Трубчатый дренаж Ø110", "3 500–6 000 тг/м.п.", "С геотекстилем и гравием"],
                ["Трубчатый дренаж Ø160", "5 000–8 500 тг/м.п.", "Для бОльших водосборных площадей"],
                ["Пластовый под плитой", "2 500–4 000 тг/м²", "Щебёночная подготовка + геотекстиль"],
              ].map(([type, price, note]) => (
                <div
                  key={type}
                  className="border border-blue-900/30 rounded-lg p-3 bg-slate-900/40"
                >
                  <div className="text-blue-300 font-semibold text-xs mb-1">{type}</div>
                  <div className="font-mono text-emerald-300 text-sm">{price}</div>
                  <div className="text-xs text-slate-500 mt-1 italic">{note}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Раздел 4 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-blue-300">
            📚 Раздел 4. Нормативная база СН РК
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                icon: "📋",
                title: "СН РК 4.01-43 «Водоотведение»",
                desc: "Основной нормативный документ по дренажным системам в РК. Устанавливает требования к проектированию, уклонам, глубинам заложения, материалам труб и колодцам.",
              },
              {
                icon: "🏗",
                title: "СНиП 3.04-01-87 «Изоляция и отделка»",
                desc: "Содержит требования к укладке геотекстиля и гидроизоляционных мембран в составе дренажных систем и защиты фундаментов. Действует в РК как нормативный документ.",
              },
              {
                icon: "📏",
                title: "Расстояние от фундамента",
                desc: "Дренажная труба по периметру: на расстоянии 0.5–1.0 м от фундамента. Заложение: ниже подошвы фундамента на 0.3–0.5 м. Уклон направляется к водосборному колодцу.",
              },
              {
                icon: "⚠",
                title: "Правила укладки",
                desc: "Геотекстиль укладывается с нахлёстом 200 мм. Гравий фракции 20–40 мм (не песок!). Запрещается засыпка глинистым грунтом непосредственно под трубу. Ревизионные колодцы — обязательны.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="border border-blue-900/30 bg-blue-950/10 rounded-xl p-5"
              >
                <h3 className="text-base font-semibold text-blue-300 mb-2">
                  {f.icon} {f.title}
                </h3>
                <p className="text-sm text-slate-300">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Упражнения */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Упражнения</h2>

          {/* Упр. 1 */}
          <div className="border border-blue-900/30 rounded-xl p-5 bg-blue-950/10">
            <div className="text-xs text-blue-600 uppercase tracking-wider mb-2">
              Упражнение 1 / 4 — Минимальный уклон дренажа
            </div>
            <div className="text-slate-200 mb-4">
              Минимальный уклон горизонтального трубчатого дренажа по СН РК для
              самотёчного движения воды?
            </div>
            <div className="space-y-2 text-sm">
              {[
                {
                  v: "a",
                  t: "0.1‰ (0.1 мм/м) — достаточно для любого грунта",
                },
                {
                  v: "b",
                  t: "1‰ (1 мм/м) — обеспечивает самотёчное движение воды без застоя и заиливания",
                },
                {
                  v: "c",
                  t: "10‰ (10 мм/м) — минимальный уклон для нормальной работы",
                },
                {
                  v: "d",
                  t: "Уклон не нормируется — достаточно горизонтального положения трубы",
                },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-start gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex1 === opt.v
                      ? "border-blue-600 bg-blue-950/30"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex1"
                    value={opt.v}
                    checked={ex1 === opt.v}
                    onChange={() => setEx1(opt.v)}
                    className="accent-blue-500 mt-0.5"
                  />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button
                onClick={checkEx1}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded transition text-sm"
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
                  ❌ Неверно — см. раздел 3
                </span>
              )}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-blue-300">Решение:</strong> Правильный ответ —{" "}
                <strong>б</strong>. Минимальный уклон 1‰ = 1 мм/м.
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>
                    СН РК 4.01-43 устанавливает минимальный уклон 1‰ для самотёчного дренажа
                  </li>
                  <li>
                    На практике рекомендуется 2–3‰ для надёжности и предотвращения заиливания
                  </li>
                  <li>
                    При уклоне 0‰ (горизонталь) вода застаивается в трубе — эффект теряется
                  </li>
                  <li>
                    Уклон 10‰ — это уклон для ливневой канализации, а не дренажа
                  </li>
                  <li>
                    При уклоне 1‰ на 100 м трубы: перепад высот = 100 × 0.001 = 0.1 м = 100 мм
                  </li>
                </ul>
              </div>
            )}
          </div>

          {/* Упр. 2 */}
          <div className="border border-blue-900/30 rounded-xl p-5 bg-blue-950/10">
            <div className="text-xs text-blue-600 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Роль геотекстиля
            </div>
            <div className="text-slate-200 mb-4">
              Геотекстиль в дренажной системе — для чего он применяется?
            </div>
            <div className="space-y-2 text-sm">
              {[
                {
                  v: "a",
                  t: "Гидроизоляция — полностью перекрывает доступ воды к трубе",
                },
                {
                  v: "b",
                  t: "Армирование грунта — увеличивает несущую способность основания",
                },
                {
                  v: "c",
                  t: "Фильтрация — пропускает воду, но задерживает частицы грунта, не позволяя забиться перфорации трубы",
                },
                {
                  v: "d",
                  t: "Теплоизоляция — защищает трубу от промерзания зимой",
                },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-start gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex2 === opt.v
                      ? "border-blue-600 bg-blue-950/30"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex2"
                    value={opt.v}
                    checked={ex2 === opt.v}
                    onChange={() => setEx2(opt.v)}
                    className="accent-blue-500 mt-0.5"
                  />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button
                onClick={checkEx2}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded transition text-sm"
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
                <strong className="text-blue-300">Решение:</strong> Правильный ответ —{" "}
                <strong>в</strong>. Геотекстиль выполняет функцию фильтра.
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>
                    Нетканый геотекстиль 100–150 г/м² — стандарт для дренажа. Поры 0.05–0.2 мм
                    задерживают частицы грунта, но пропускают воду
                  </li>
                  <li>
                    Без геотекстиля: за 2–5 лет перфорация трубы забивается мелкими
                    частицами (заиливание) — дренаж перестаёт работать
                  </li>
                  <li>
                    Укладка: геотекстиль оборачивает и трубу, и гравийную обсыпку
                    целиком с нахлёстом 200 мм
                  </li>
                  <li>
                    Стоимость геотекстиля 150 г/м²: 120–200 тг/м² (ССЦ РК); укладка
                    входит в стоимость дренажных работ по ЭСН Сб.16
                  </li>
                </ul>
              </div>
            )}
          </div>

          {/* Упр. 3 */}
          <div className="border border-blue-900/30 rounded-xl p-5 bg-blue-950/10">
            <div className="text-xs text-blue-600 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — Расчёт перепада высот
            </div>
            <div className="text-slate-200 mb-4">
              Горизонтальный дренаж вокруг здания: периметр <strong>80 м</strong>, уклон{" "}
              <strong>1‰ (1 мм/м)</strong>. Рассчитайте перепад высот от начальной точки
              до конца трубы в миллиметрах.
            </div>
            <div className="text-xs text-slate-400 italic mb-3">
              💡 Перепад (мм) = длина (м) × уклон (мм/м)
            </div>
            <div className="flex gap-3 items-center flex-wrap">
              <input
                type="text"
                value={ex3}
                onChange={(e) => setEx3(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && checkEx3()}
                placeholder="Введите число (мм)..."
                className="flex-1 min-w-[200px] border border-slate-700 rounded px-3 py-2 text-sm font-mono bg-slate-900 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={checkEx3}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded transition text-sm"
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
                <strong className="text-blue-300">Решение:</strong> 80 м × 0.001 =
                0.08 м ={" "}
                <strong className="text-emerald-300">80 мм</strong>.
                <p className="text-xs mt-2 text-slate-400">
                  Допуск ±5 мм. Перепад в 80 мм (8 см) на 80 метров трубы — это
                  практически незаметно на глаз, но достаточно для самотёчного движения
                  воды. При разметке это означает: начало трубы выше конца на 1 кирпич.
                  На практике такой малый уклон создаётся лазерным нивелиром при укладке.
                </p>
              </div>
            )}
          </div>

          {/* Упр. 4 */}
          <div className="border border-blue-900/30 rounded-xl p-5 bg-blue-950/10">
            <div className="text-xs text-blue-600 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — Дренаж при высоком УГВ
            </div>
            <div className="text-slate-200 mb-4">
              Для дренажа заглублённых подвалов при высоком уровне грунтовых вод (УГВ)
              применяется:
            </div>
            <div className="space-y-2 text-sm">
              {[
                {
                  v: "a",
                  t: "Только наружная обмазочная гидроизоляция фундаментных стен — этого достаточно",
                },
                {
                  v: "b",
                  t: "Трубчатый дренаж по периметру — единственно необходимая мера",
                },
                {
                  v: "c",
                  t: "Вертикальный дренаж (насосные скважины) — всегда самое экономичное решение",
                },
                {
                  v: "d",
                  t: "Комбинация: пластовый дренаж под фундаментной плитой + трубчатый по периметру + гидроизоляция фундамента + водоотводный колодец с насосом",
                },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-start gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex4 === opt.v
                      ? "border-blue-600 bg-blue-950/30"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex4"
                    value={opt.v}
                    checked={ex4 === opt.v}
                    onChange={() => setEx4(opt.v)}
                    className="accent-blue-500 mt-0.5"
                  />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button
                onClick={checkEx4}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded transition text-sm"
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
                <strong className="text-blue-300">Решение:</strong> Правильный ответ —{" "}
                <strong>г</strong>. При высоком УГВ нужна комплексная система.
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>
                    <strong>Пластовый дренаж под плитой</strong>: щебень 200–300 мм +
                    геотекстиль — отводит воду снизу (гидростатическое давление)
                  </li>
                  <li>
                    <strong>Трубчатый по периметру</strong>: перехватывает воду до того,
                    как она достигает стен подвала
                  </li>
                  <li>
                    <strong>Гидроизоляция фундамента</strong>: обмазочная + рулонная
                    (2 слоя), профильная мембрана на стенах подвала
                  </li>
                  <li>
                    <strong>Водосборный колодец с насосом</strong>: собирает воду из
                    дренажной системы и откачивает в ливневую канализацию
                  </li>
                  <li>
                    Стоимость комплексной системы для подвала 200 м²: 3–6 млн тг (ЭСН
                    Сб.16 + Сб.22 гидроизоляция)
                  </li>
                </ul>
              </div>
            )}
          </div>
        </section>

        {/* Нормативная база */}
        <section className="border border-blue-900/20 bg-blue-950/10 rounded-xl p-5 space-y-2">
          <h2 className="text-base font-bold text-blue-300">
            📑 Расценки ЭСН РК (дренажные системы)
          </h2>
          <ul className="text-xs text-slate-400 space-y-1.5">
            <li>
              <strong className="text-blue-300">ЭСН Сб.16 «Трубопроводы внутренние»</strong>{" "}
              — укладка дренажных труб, ревизионные колодцы
            </li>
            <li>
              <strong className="text-blue-300">ЭСН Сб.22 «Водопонижение»</strong> —
              водосборные колодцы, насосные установки
            </li>
            <li>
              <strong className="text-blue-300">ЭСН Сб.1 «Земляные работы»</strong> —
              разработка траншей под дренажные трубы
            </li>
            <li>
              <strong className="text-blue-300">СН РК 4.01-43 «Водоотведение»</strong> —
              нормы проектирования дренажных и ливневых систем РК
            </li>
            <li>
              <strong className="text-blue-300">ССЦ РК</strong> — трубы ПВХ/HDPE
              перфорированные, геотекстиль, щебень, ревизионные колодцы ПП
            </li>
          </ul>
        </section>

        {/* Факт сметчика */}
        <section className="bg-slate-900 border border-slate-700 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <h3 className="text-sm font-bold mb-1 text-blue-300">Факт сметчика</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Дренажная система — один из наиболее часто исключаемых разделов при
                оптимизации бюджета. Однако её отсутствие приводит к затоплению подвалов
                уже в первый же паводковый сезон. Стоимость дренажа — около{" "}
                <strong className="text-blue-300">1–3%</strong> от стоимости здания, тогда
                как ремонт затопленного подвала обходится в{" "}
                <strong>5–15%</strong> стоимости объекта. В Алматы дренаж обязателен для
                любого здания с подвалом — УГВ весной поднимается критически.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
