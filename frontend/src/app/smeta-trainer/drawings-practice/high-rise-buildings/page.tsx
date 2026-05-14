"use client";

import Link from "next/link";
import { useState } from "react";

export default function HighRiseBuildingsPage() {
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
  const checkEx2 = () => setEx2Res(ex2 === "d" ? "ok" : "bad");
  const checkEx3 = () => {
    const v = parseFloat(ex3);
    if (!isFinite(v)) return setEx3Res("bad");
    setEx3Res(Math.abs(v - 25_000_000_000) <= 500_000_000 ? "ok" : "bad");
  };
  const checkEx4 = () => setEx4Res(ex4 === "b" ? "ok" : "bad");

  const loads = [
    {
      factor: "Ветровая нагрузка",
      norm: "СП РК 2.03-30 (нагрузки и воздействия)",
      value: "Алматы Wo = 0.38 кПа (III район), Астана Wo = 0.48 кПа (IV район)",
      note: "Динамический расчёт при H > 40 м обязателен",
    },
    {
      factor: "Осадка и крен",
      norm: "СП РК 5.01-102 (основания и фундаменты)",
      value: "Допуст. крен высотного здания ≤ 0.001 (H/1000)",
      note: "Свайные ростверки, плитные фундаменты, мониторинг при стройке",
    },
    {
      factor: "Сейсмика",
      norm: "СП РК 2.03-30 (сейсм.), карта ОСР РК",
      value: "Алматы — 9 баллов MSK-64; Астана — 6 баллов",
      note: "При 7+ баллах — спец. расчёт, при 9 баллах — сейсмоизоляция",
    },
    {
      factor: "Пожарная эвакуация",
      norm: "СП РК 2.02-05 (пожарная безопасность)",
      value: "Незадымляемые лестницы Н3, 2 пути эвакуации, лифт-каре",
      note: "Пожарный лифт каждые 20 этажей, выход на незадымл. лестницу ≤ 15 м",
    },
  ];

  const systems = [
    {
      name: "Ядро жёсткости",
      desc: "Железобетонное ядро (лестнично-лифтовой блок) принимает горизонтальные нагрузки. Монолитный ж/б, класс B35-B45. Применяется в большинстве башен до 60 этажей.",
      examples: "Жилые башни «Нурлы Тау» (Алматы), «Highvill» Астана",
    },
    {
      name: "Рамно-связевая система",
      desc: "Периметральные рамы + жёсткий ядро + диагональные связи. Оптимальна для 40-80 этажей. Позволяет свободную планировку этажей.",
      examples: "Офисные башни «Алатау» (Алматы), «Абу Даби Плаза» Астана (комбинир.)",
    },
    {
      name: "Трубчатая конструкция",
      desc: "Наружные колонны с шагом 1-3 м образуют трубу, воспринимающую ветровой момент. Эффективна для зданий 60-110 этажей. Подходит при дефиците пространства для ядра.",
      examples: "Башня «Казмунайгаз» Астана (аналог), мировой пример — Williss Tower (Sears), Чикаго",
    },
    {
      name: "Ствол с перекрёстной решёткой",
      desc: "Диагональная мегарешётка из стальных элементов по фасаду — распределяет ветровые и сейсмические нагрузки равномерно. Для супервысоток 100+ этажей.",
      examples: "Мировые: Джон Хэнкок Сентер (Чикаго), CCTV Tower (Пекин). В РК не реализовано пока.",
    },
  ];

  const benchmarks = [
    { type: "Жильё 30 эт. (РК)", cost: "350–500 тыс. тг/м²", notes: "Монолит, стандартн. инженерия, Алматы/Астана" },
    { type: "Жильё 50 эт. (РК)", cost: "550–750 тыс. тг/м²", notes: "+сейсмоизол., спец. лифты, ИТП на каждые 20 эт." },
    { type: "Офис Tower 100 эт. (РК)", cost: "900–1 500 тыс. тг/м²", notes: "Спец. фасад, автоматика, BMS, VRF, зонированные лифты" },
    { type: "Аналог: США (мировой)", cost: "$3 000–8 000/фут² = ~3–7 млн тг/м²", notes: "Небоскрёбы NYC/Chicago — другая лига" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-violet-300 hover:text-violet-200 transition">
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Многоэтажные здания</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            🏢 Многоэтажные здания 30+ этажей
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            Высотное строительство — один из наиболее технически сложных и дорогостоящих
            видов строительства. Здания выше 30 этажей требуют специальных конструктивных
            систем, инженерных решений и значительного удорожания сметы относительно
            типовых 9-этажных домов. Сметчик высотных зданий — редкая специализация в РК.
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-violet-900/40 rounded-lg p-3 bg-violet-950/20">
              <div className="text-violet-500 uppercase tracking-wider mb-1">Порог «высотное здание»</div>
              <div className="text-slate-300">≥ 75 м (≈ 25 эт.) по СП РК / МГСН</div>
            </div>
            <div className="border border-violet-900/40 rounded-lg p-3 bg-violet-950/20">
              <div className="text-violet-500 uppercase tracking-wider mb-1">Удорожание vs 9 эт.</div>
              <div className="text-slate-300">+40–120% при 30+ этажах</div>
            </div>
            <div className="border border-violet-900/40 rounded-lg p-3 bg-violet-950/20">
              <div className="text-violet-500 uppercase tracking-wider mb-1">Высочайшее здание РК</div>
              <div className="text-slate-300">Абу Даби Плаза (Астана) — 382 м, 88 эт.</div>
            </div>
          </div>
        </section>

        {/* Section 1 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🌬 Section 1. Особенности проектирования
          </h2>
          <p className="text-sm text-slate-400">
            Четыре ключевых фактора определяют сложность и удорожание высотного строительства:
          </p>
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 w-48">Фактор</th>
                  <th className="text-left px-4 py-3 w-56">Норматив РК</th>
                  <th className="text-left px-4 py-3">Параметры / Значения</th>
                  <th className="text-left px-4 py-3 w-48">Примечания</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loads.map((r) => (
                  <tr key={r.factor} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 text-violet-300 font-medium text-xs">{r.factor}</td>
                    <td className="px-4 py-3 font-mono text-slate-400 text-xs">{r.norm}</td>
                    <td className="px-4 py-3 text-slate-200 text-xs">{r.value}</td>
                    <td className="px-4 py-3 text-amber-300 text-xs italic">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 2 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            🏗 Section 2. Конструктивные системы высотных зданий
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {systems.map((s) => (
              <div key={s.name} className="border border-violet-900/30 bg-violet-950/10 rounded-xl p-5">
                <h3 className="text-base font-semibold text-violet-300 mb-2">{s.name}</h3>
                <p className="text-sm text-slate-300 mb-3">{s.desc}</p>
                <div className="text-xs text-amber-300 italic">
                  <span className="text-slate-500 not-italic">Примеры: </span>{s.examples}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            ⚙️ Section 3. Специальные инженерные системы
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/30">
              <h3 className="text-base font-semibold text-violet-200 mb-2">❄️ Фасадное кондиционирование</h3>
              <p className="text-sm text-slate-300">
                Системы <strong>VRF/VRV</strong> (инверторные мультисплиты) — для жилья и небольших башен.
                Системы <strong>чиллер + фанкойл</strong> — для офисных башен и отелей 40+ этажей.
                Фасадное кондиционирование занимает 8–15% от общей стоимости здания.
              </p>
            </div>
            <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/30">
              <h3 className="text-base font-semibold text-violet-200 mb-2">🔥 ИТП на каждые 30 этажей</h3>
              <p className="text-sm text-slate-300">
                Индивидуальные тепловые пункты (ИТП) устанавливаются каждые 20–30 этажей
                для зонирования давления в системе отопления. Без зонирования — давление
                в подвале превысило бы 10-15 бар, что разрушает трубопроводы нижних этажей.
              </p>
            </div>
            <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/30">
              <h3 className="text-base font-semibold text-violet-200 mb-2">🛗 Зонирование лифтов</h3>
              <p className="text-sm text-slate-300">
                Здания 60+ этажей делятся на <strong>зоны</strong>:
                низкая (1–20), средняя (21–40), высокая (41–60).
                В каждой зоне — своя группа лифтов. Скоростные экспресс-лифты
                доставляют до пересадочных этажей (sky lobby). Скорость: 3–10 м/с.
              </p>
            </div>
            <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/30">
              <h3 className="text-base font-semibold text-violet-200 mb-2">🚒 Пожаротушение под давлением</h3>
              <p className="text-sm text-slate-300">
                Система водяного пожаротушения (спринклеры) в высотных зданиях требует
                насосных станций повышения давления каждые 20–25 этажей (иначе вода
                не поднимается). Отдельная система сухотрубов для пожарных машин.
                Газовое тушение серверных и электрощитовых.
              </p>
            </div>
          </div>
        </section>

        {/* Section 4 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">
            💰 Section 4. Бенчмарки стоимости
          </h2>
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Тип здания</th>
                  <th className="text-left px-4 py-3 w-56">Стоимость строительства</th>
                  <th className="text-left px-4 py-3">Комментарий</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {benchmarks.map((b) => (
                  <tr key={b.type} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 text-violet-300 font-medium text-xs">{b.type}</td>
                    <td className="px-4 py-3 font-mono text-emerald-300 text-xs">{b.cost}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{b.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">
            * Бенчмарки актуальны на 2024–2025 гг. для Алматы/Астаны. Индивидуальные
            проекты могут значительно отличаться в зависимости от класса здания,
            архитектурной сложности фасада и набора инженерных систем.
          </p>
        </section>

        {/* Упражнения */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">🧩 Упражнения</h2>

          {/* Упр.1 */}
          <div className="border border-violet-900/40 rounded-xl p-5 bg-violet-950/10">
            <div className="text-xs text-violet-500 uppercase tracking-wider mb-2">
              Упражнение 1 / 4 — Демпфер ТМД
            </div>
            <div className="text-slate-200 mb-4">
              Демпфер <strong>Tuned Mass Damper (ТМД)</strong> — устройство, применяемое
              в строительстве высотных зданий. Для чего он предназначен?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Защита от сейсмики путём изоляции фундамента от грунта" },
                { v: "b", t: "Поглощение тепловой нагрузки на фасад здания летом" },
                { v: "c", t: "Гашение колебаний высотных зданий от ветра (вибрации и раскачки башни)" },
                { v: "d", t: "Балансировка нагрузки между лифтовыми кабинами" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex1 === opt.v
                      ? "border-violet-600 bg-violet-950/30"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex1"
                    value={opt.v}
                    checked={ex1 === opt.v}
                    onChange={() => setEx1(opt.v)}
                    className="accent-violet-500"
                  />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button
                onClick={checkEx1}
                className="px-4 py-2 bg-violet-700 hover:bg-violet-600 text-white rounded transition text-sm"
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
                  ✅ Верно — гашение ветровых колебаний
                </span>
              )}
              {ex1Res === "bad" && (
                <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">
                  ❌ Неверно — попробуй ещё раз
                </span>
              )}
            </div>
            {ex1Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-violet-300">Решение:</strong> ТМД (Tuned Mass Damper) —
                массивный маятник (100–1000 тонн стали или воды), подвешенный на верхних этажах
                башни. Настроен в резонанс с частотой колебаний здания от ветра и движется
                в противофазе, гася раскачку.
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Тайбэй 101 — ТМД 660 т на 87-91 этажах</li>
                  <li>Шанхай Тауэр — жидкостный демпфер 1000 т</li>
                  <li>Снижает амплитуду раскачки до 30–40%</li>
                  <li>Стоимость: $5–30 млн для здания 50+ этажей</li>
                </ul>
                В Казахстане ТМД применяется в башне «Абу Даби Плаза» (Астана, 88 эт., 382 м).
                От сейсмики ТМД не защищает — для этого нужны сейсмоизоляционные опоры.
              </div>
            )}
          </div>

          {/* Упр.2 */}
          <div className="border border-violet-900/40 rounded-xl p-5 bg-violet-950/10">
            <div className="text-xs text-violet-500 uppercase tracking-wider mb-2">
              Упражнение 2 / 4 — Сейсмика Алматы
            </div>
            <div className="text-slate-200 mb-4">
              Башня <strong>50 этажей</strong> строится в Алматы (зона <strong>9 баллов</strong>
              по шкале MSK-64). Какой дополнительный конструктив обязателен по сравнению
              с аналогичной башней в сейсмически спокойном регионе (5 баллов)?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Только утолщение несущих стен на 15 см" },
                { v: "b", t: "Замена бетона B25 на B30 по всему каркасу" },
                { v: "c", t: "Установка противопожарных клапанов на каждом этаже" },
                {
                  v: "d",
                  t: "Сейсмоизоляционные опоры под несущие конструкции + динамический расчёт по СП РК 2.03-30 (аналог ASCE 7) с учётом спектра ускорений",
                },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex2 === opt.v
                      ? "border-violet-600 bg-violet-950/30"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex2"
                    value={opt.v}
                    checked={ex2 === opt.v}
                    onChange={() => setEx2(opt.v)}
                    className="accent-violet-500"
                  />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button
                onClick={checkEx2}
                className="px-4 py-2 bg-violet-700 hover:bg-violet-600 text-white rounded transition text-sm"
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
                  ✅ Верно — сейсмоизоляция + динамический расчёт
                </span>
              )}
              {ex2Res === "bad" && (
                <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">
                  ❌ Неверно — это недостаточно
                </span>
              )}
            </div>
            {ex2Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-violet-300">Решение:</strong> При 9 баллах в Алматы для
                здания 50+ этажей требуется комплекс мероприятий:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>
                    <strong>Сейсмоизоляционные опоры</strong> — свинцово-резиновые (LRB) или
                    фрикционные маятниковые (FPS) под колоннами. Отрезают здание от горизонтальных
                    движений грунта. Стоимость: +15–25% к фундаменту.
                  </li>
                  <li>
                    <strong>Динамический расчёт</strong> — модальный анализ, учёт спектра
                    ускорений грунта (карта ОСР РК), 3D-модель МКЭ с историями акселерограмм.
                  </li>
                  <li>
                    <strong>Усиленное армирование</strong> — в узлах рамы, зонах пластических
                    шарниров. Расход арматуры выше на 30–40% vs несейсмический.
                  </li>
                  <li>
                    <strong>Особый бетон</strong> — B35-B45 в ядре жёсткости с высокой
                    пластичностью (специальные добавки).
                  </li>
                </ul>
                Удорожание за счёт сейсмоизоляции для здания 50 эт. в Алматы: +8–18% к общей
                стоимости. В смете выделяется отдельным разделом «Сейсмоизоляция».
              </div>
            )}
          </div>

          {/* Упр.3 */}
          <div className="border border-violet-900/40 rounded-xl p-5 bg-violet-950/10">
            <div className="text-xs text-violet-500 uppercase tracking-wider mb-2">
              Упражнение 3 / 4 — Бюджет башни
            </div>
            <div className="text-slate-200 mb-4">
              Заказчик планирует строительство <strong>60-этажной жилой башни</strong> в Алматы.
              Общая площадь здания <strong>S = 50 000 м²</strong>. Средний бенчмарк стоимости
              строительства — <strong>500 тыс. тг/м²</strong>. Рассчитайте ориентировочный
              бюджет строительства (в тенге).
            </div>
            <label className="flex flex-col text-sm max-w-xs">
              <span className="text-slate-400 text-xs mb-1">Бюджет, тенге</span>
              <input
                value={ex3}
                onChange={(e) => setEx3(e.target.value)}
                type="number"
                className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100"
                placeholder="25000000000"
              />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              <button
                onClick={checkEx3}
                className="px-4 py-2 bg-violet-700 hover:bg-violet-600 text-white rounded transition text-sm"
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
                  ✅ Верно — 25 млрд тг
                </span>
              )}
              {ex3Res === "bad" && (
                <span className="px-3 py-2 bg-red-900/40 text-red-300 rounded text-sm">
                  ❌ Перепроверь расчёт
                </span>
              )}
            </div>
            {ex3Sol && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-slate-300">
                <strong className="text-violet-300">Решение:</strong>
                <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-slate-300">
{`Бюджет = S × Стоимость/м²
       = 50 000 м² × 500 000 тг/м²
       = 25 000 000 000 тг = 25 млрд тг

Это ≈ $55 млн по курсу 450 тг/$.

Для сравнения:
• Башня «Нурлы Тау» (А, 30 эт.) ≈ 8–12 млрд тг
• «Абу Даби Плаза» (Астана, 88 эт.) > 400 млрд тг
  (с учётом офисов, отеля, торгового центра)

Структура бюджета 60-этажной башни:
• Фундамент + подземная часть:   15–20%
• Конструктив (каркас, перекрытия): 25–30%
• Сейсмоизоляция:                 5–8%
• Фасад + кровля:                 8–12%
• Инженерные системы:             20–25%
• Отделка общих зон:              8–12%
• Лифты (зонирование):            4–6%
• Непредвиденные + ПИР:           5–7%`}
                </pre>
              </div>
            )}
          </div>

          {/* Упр.4 */}
          <div className="border border-violet-900/40 rounded-xl p-5 bg-violet-950/10">
            <div className="text-xs text-violet-500 uppercase tracking-wider mb-2">
              Упражнение 4 / 4 — Зонирование лифтов
            </div>
            <div className="text-slate-200 mb-4">
              В <strong>60-этажном здании</strong> запроектирована система лифтов.
              Как правильно зонировать лифты для обеспечения оптимального
              вертикального транспорта?
            </div>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Один общий лифт на всё здание с остановками на каждом этаже" },
                { v: "b", t: "3 зоны (1–20 / 21–40 / 41–60) с скоростными лифтами-экспрессами до пересадочных этажей (sky lobby)" },
                { v: "c", t: "Два лифта: один только нечётные этажи, второй только чётные" },
                { v: "d", t: "Зонирование не нужно — современные лифты справляются с 60 этажами без остановок" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition ${
                    ex4 === opt.v
                      ? "border-violet-600 bg-violet-950/30"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="ex4"
                    value={opt.v}
                    checked={ex4 === opt.v}
                    onChange={() => setEx4(opt.v)}
                    className="accent-violet-500"
                  />
                  <span className="text-slate-200">{opt.t}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <button
                onClick={checkEx4}
                className="px-4 py-2 bg-violet-700 hover:bg-violet-600 text-white rounded transition text-sm"
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
                  ✅ Верно — 3 зоны со sky lobby
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
                <strong className="text-violet-300">Решение:</strong> 3-зонное зонирование с
                пересадочными этажами (sky lobby) — стандартная практика для 50–80-этажных зданий.
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>
                    <strong>Экспресс-лифты</strong> поднимают с 1 этажа до sky lobby на 20 и 40
                    этажах, минуя промежуточные. Скорость: 6–8 м/с.
                  </li>
                  <li>
                    <strong>Местные лифты</strong> ходят внутри своей зоны. Скорость: 2–4 м/с.
                  </li>
                  <li>
                    <strong>Эффект:</strong> время ожидания сокращается с 4–6 мин до 60–90 сек.
                    Удовлетворённость жильцов — ключевой показатель.
                  </li>
                  <li>
                    <strong>В смете:</strong> лифты 60-этажного здания — 4–6% от бюджета.
                    Каждый скоростной лифт KONE/Otis/Schindler: 50–150 млн тг.
                  </li>
                </ul>
                Для 100+ этажей применяется система двухэтажных кабин (double-deck) — две
                кабины на одном канате, обслуживают нечётные и чётные этажи одновременно.
              </div>
            )}
          </div>
        </section>

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-800">
          СП РК 2.03-30 (нагрузки, сейсмика), СП РК 5.01-102 (основания), СП РК 2.02-05
          (пожарная безопасность). Бенчмарки: Алматы/Астана 2024–2025. Примеры: Абу Даби Плаза
          (Астана, 382 м), Нурлы Тау (Алматы), Highvill (Астана). ТМД: Тайбэй 101, Шанхай Тауэр.
        </div>
      </main>
    </div>
  );
}
