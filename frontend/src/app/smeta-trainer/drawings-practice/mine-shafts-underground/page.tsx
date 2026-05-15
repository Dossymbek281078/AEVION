"use client";
import Link from "next/link";
import { useState } from "react";

export default function MineShaftsUndergroundPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex1Done, setEx1Done] = useState(false);
  const [ex2, setEx2] = useState<string>("");
  const [ex2Done, setEx2Done] = useState(false);
  const [ex3, setEx3] = useState<string>("");
  const [ex3Done, setEx3Done] = useState(false);
  const [ex4, setEx4] = useState<string>("");
  const [ex4Done, setEx4Done] = useState(false);

  const ex3Correct = (() => {
    const v = parseFloat(ex3.replace(/\s|_/g, "").replace(",", "."));
    if (isNaN(v)) return false;
    return Math.abs(v - 9_600_000_000) <= 800_000_000;
  })();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300 hover:text-blue-200 transition">← К разделам</Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Шахты и подземные выработки</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        {/* Intro */}
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">⛏️ Шахты и подземные горные выработки</h1>
          <p className="mt-3 text-slate-400 leading-relaxed">
            Подземные горные работы — самые капиталоёмкие и опасные объекты строительства. Стоимость одного ствола
            может достигать 8–15 млрд тенге, а проектирование требует учёта геомеханики, газового режима, водопритоков,
            подъёма, вентиляции и аварийных путей выхода. В РК — крупнейшие угольные (Карагандинский бассейн),
            медные (Жезказган) и полиметаллические (Жайрем) шахты. Модуль покрывает классификацию выработок, способы
            проходки, крепи, подъёмные комплексы и нормативные требования ПБ.
          </p>
        </section>

        {/* Section 1: Виды выработок */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-2xl font-semibold text-amber-300">1. Виды горных выработок</h2>
          <div className="mt-4 grid md:grid-cols-2 gap-4 text-sm text-slate-300">
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
              <div className="font-semibold text-slate-100 mb-2">Вскрывающие выработки (с поверхности)</div>
              <ul className="space-y-1 list-disc list-inside">
                <li><span className="text-slate-100">Вертикальный ствол</span> — главный (скиповой/клетевой), вспомогательный, вентиляционный</li>
                <li><span className="text-slate-100">Наклонный ствол</span> — угол 8–30°, для конвейерной выдачи</li>
                <li><span className="text-slate-100">Штольня</span> — горизонтальная, с поверхности через борт горы</li>
              </ul>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
              <div className="font-semibold text-slate-100 mb-2">Подготовительные (внутри массива)</div>
              <ul className="space-y-1 list-disc list-inside">
                <li><span className="text-slate-100">Квершлаг</span> — горизонтальная, вкрест простирания пластов</li>
                <li><span className="text-slate-100">Штрек</span> — горизонтальная, по простиранию пласта</li>
                <li><span className="text-slate-100">Уклон / бремсберг</span> — наклонная вспомогательная</li>
                <li><span className="text-slate-100">Гезенк / восстающий</span> — вертикальная между горизонтами</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 2: Проходка ствола */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-2xl font-semibold text-orange-300">2. Проходка вертикального ствола</h2>
          <p className="mt-3 text-sm text-slate-400">Диаметр Ø 6–8 м в свету, глубина 500–1500 м. Скорость проходки 30–80 м/мес.</p>
          <div className="mt-4 grid md:grid-cols-3 gap-4 text-sm text-slate-300">
            <div className="rounded-lg border border-orange-900/40 bg-orange-950/20 p-4">
              <div className="font-semibold text-orange-200">Буровзрывная</div>
              <p className="mt-2 text-slate-400">Заходка 3–4.5 м, перфораторы СБУ-2 или БУЭ-2, ВВ — аммонит № 6ЖВ, погрузка КС-2у/2КС-2у.</p>
            </div>
            <div className="rounded-lg border border-orange-900/40 bg-orange-950/20 p-4">
              <div className="font-semibold text-orange-200">Бурошнековая / комбайнами</div>
              <p className="mt-2 text-slate-400">Комбайны Wirth SB-VI / Herrenknecht SBR — непрерывная проходка в мягких породах f ≤ 6.</p>
            </div>
            <div className="rounded-lg border border-orange-900/40 bg-orange-950/20 p-4">
              <div className="font-semibold text-orange-200">Замораживание (Frieden-Foraky)</div>
              <p className="mt-2 text-slate-400">Для водоносных горизонтов: 30–40 замораж. скважин по периметру, рассол CaCl₂ при −25 °C, ледопородный цилиндр 2–4 м.</p>
            </div>
          </div>
        </section>

        {/* Section 3: Крепи */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-2xl font-semibold text-yellow-300">3. Крепи подземных выработок</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="text-left py-2 px-3">Тип крепи</th>
                  <th className="text-left py-2 px-3">Где применяется</th>
                  <th className="text-left py-2 px-3">Особенности</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                <tr className="border-b border-slate-800/50">
                  <td className="py-2 px-3 text-slate-100">Деревянная</td>
                  <td className="py-2 px-3">Запасные/временные выработки</td>
                  <td className="py-2 px-3 text-slate-400">Сосна Ø 18–28 см, срок службы 2–3 года</td>
                </tr>
                <tr className="border-b border-slate-800/50">
                  <td className="py-2 px-3 text-slate-100">Металлическая арочная СВП</td>
                  <td className="py-2 px-3">Горизонтальные/наклонные выработки</td>
                  <td className="py-2 px-3 text-slate-400">СВП-22/27/33 — Сегмент Взаимозаменяемого Профиля, 3 сегмента, шаг 0.5–1 м</td>
                </tr>
                <tr className="border-b border-slate-800/50">
                  <td className="py-2 px-3 text-slate-100">Сборная ж/б ТУ-ПЖБ</td>
                  <td className="py-2 px-3">Длительные капитальные выработки</td>
                  <td className="py-2 px-3 text-slate-400">Тюбинги/панели, бетон В25–В35, срок 50+ лет</td>
                </tr>
                <tr className="border-b border-slate-800/50">
                  <td className="py-2 px-3 text-slate-100">Анкерная + набрызг-бетон</td>
                  <td className="py-2 px-3">Устойчивые породы f ≥ 6</td>
                  <td className="py-2 px-3 text-slate-400">Анкеры AT/RDM L=1.8–3 м, набрызг 50–100 мм</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-slate-100">Монолитная бетонная</td>
                  <td className="py-2 px-3">Стволы, камеры, сопряжения</td>
                  <td className="py-2 px-3 text-slate-400">В30–В40, толщина 300–600 мм</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 4: Подъёмные комплексы */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-2xl font-semibold text-lime-300">4. Подъёмные комплексы</h2>
          <div className="mt-4 grid md:grid-cols-2 gap-4 text-sm text-slate-300">
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
              <div className="font-semibold text-slate-100 mb-2">Копёр</div>
              <ul className="space-y-1 list-disc list-inside text-slate-400">
                <li><span className="text-slate-200">Башенный</span> — H = 60–120 м, ж/б, многоканатная схема</li>
                <li><span className="text-slate-200">Укосный (станковый)</span> — стальная решётка, до 40 м, для глубин &lt; 600 м</li>
              </ul>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
              <div className="font-semibold text-slate-100 mb-2">Подъёмная установка</div>
              <ul className="space-y-1 list-disc list-inside text-slate-400">
                <li><span className="text-slate-200">Скиповая</span> — выдача угля/руды, ёмкость скипа 10–50 т</li>
                <li><span className="text-slate-200">Клетьевая</span> — люди и оборудование, клеть 2–4 этажа</li>
                <li><span className="text-slate-200">Машины МК-4 / МК-5</span> — многоканатные (4–5 канатов Ø 50–60 мм)</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 5: Вентиляция */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-2xl font-semibold text-cyan-300">5. Вентиляция шахт</h2>
          <p className="mt-3 text-sm text-slate-400">
            Главные вентустановки центробежные <span className="text-slate-200">ВЦ-32 / ВЦД-47</span> — производительность 600–1200 м³/сек,
            депрессия 300–600 даПа. Схемы: всасывающая (основная), нагнетательная, комбинированная.
          </p>
          <div className="mt-4 rounded-lg border border-red-900/40 bg-red-950/20 p-4 text-sm">
            <div className="font-semibold text-red-300">⚠ ПБ 03-553-03 — газовый режим угольных шахт</div>
            <ul className="mt-2 space-y-1 list-disc list-inside text-slate-300">
              <li>Метан в исходящей струе забоя <span className="text-red-300 font-semibold">≤ 1%</span> — превышение = эвакуация</li>
              <li>Метан в струе участка ≤ 0.75%, общешахтной ≤ 0.5%</li>
              <li>CO₂ ≤ 0.5%, CO ≤ 0.0017%, O₂ ≥ 20%</li>
              <li>Категории шахт по газу: I (≤ 5 м³/т), II (≤ 10), III (≤ 15), сверхкатегорийные (&gt; 15 или суфляры)</li>
            </ul>
          </div>
        </section>

        {/* Section 6: Водоотлив */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-2xl font-semibold text-blue-300">6. Водоотлив</h2>
          <p className="mt-3 text-sm text-slate-400">
            Главные водоотливные установки на каждом горизонте. Насосы секционные <span className="text-slate-200">ЦНС-300 / 600 / 1000</span>
            (подача 300/600/1000 м³/ч), типовые ЦНСК-300×600 — 1 м³/сек при напоре 600 м. Отстойники-зумпфы V = 200–500 м³,
            водосборники = 4-часовой приток. Резерв: 1 рабочий + 1 резервный + 1 ремонтный насос.
          </p>
        </section>

        {/* Section 7: Электроснабжение */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-2xl font-semibold text-violet-300">7. Электроснабжение шахт</h2>
          <p className="mt-3 text-sm text-slate-400">
            В угольных шахтах — взрывозащищённое исполнение <span className="text-slate-200">РВ-Ex (РВ-И, РО-И)</span>. Напряжения: 6 кВ (ввод
            на горизонт), 3.3 / 1.14 / 0.66 кВ (распределение и забой). Кабели <span className="text-slate-200">КГЭШ</span> — гибкий
            экранированный шахтный, шланговая оболочка. Освещение — светодиодные взрывозащищённые светильники РВЛ/РВО,
            индивидуальные головные «Кузбасс-2М» / «СГГ-1».
          </p>
        </section>

        {/* Section 8: Безопасность */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-2xl font-semibold text-rose-300">8. Безопасность и аварийные системы</h2>
          <div className="mt-4 grid md:grid-cols-2 gap-4 text-sm text-slate-300">
            <ul className="space-y-1 list-disc list-inside">
              <li>Групповой газоанализ: CH₄ / CO / CO₂ / H₂S / O₂ (стац. датчики + индивид. М-02)</li>
              <li>Система оповещения <span className="text-slate-100">АИО / СУБР</span> — громкоговорящая в забоях</li>
              <li>Аварийные респираторы <span className="text-slate-100">ШСС-Т / ШСМ-30</span> — 30–60 мин</li>
              <li>Изолирующие самоспасатели на каждом рабочем</li>
            </ul>
            <ul className="space-y-1 list-disc list-inside">
              <li>Реверсивная вентиляция — переключение за ≤ 10 мин</li>
              <li>Маркировка путей выхода светоотражающая, через каждые 10 м</li>
              <li>Камеры-убежища (КУШ) с автономным жизнеобеспечением 96 ч</li>
              <li>План ликвидации аварий (ПЛА) — обновление 1 раз в 6 мес</li>
            </ul>
          </div>
        </section>

        {/* Section 9: Бенчмарки РК */}
        <section className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-6">
          <h2 className="text-2xl font-semibold text-emerald-300">9. Бенчмарки РК</h2>
          <div className="mt-4 grid md:grid-cols-2 gap-4 text-sm text-slate-300">
            <div>
              <div className="font-semibold text-slate-100">Уголь</div>
              <p className="mt-1 text-slate-400">АО «АрселорМиттал Темиртау» — Карагандинский угольный бассейн, 8 шахт (им. Костенко, Шахтинская, Тентекская и др.). Глубины до 800 м, сверхкатегорийные по газу.</p>
            </div>
            <div>
              <div className="font-semibold text-slate-100">Медь</div>
              <p className="mt-1 text-slate-400">Жезказганский ГОК (Kazakhmys) — крупнейшее медное месторождение РК, камерно-столбовая система, рудники Восточный/Анненский/Жомарт.</p>
            </div>
            <div>
              <div className="font-semibold text-slate-100">Полиметаллы</div>
              <p className="mt-1 text-slate-400">Жайремский ГОК (Kazzinc) — Pb-Zn-Cu-Ba, открыто-подземная отработка, центральный ствол Ø 7 м H = 620 м.</p>
            </div>
            <div>
              <div className="font-semibold text-slate-100">Стоимость ствола</div>
              <p className="mt-1 text-slate-400">Ø 6 м, H = 1000 м — <span className="text-emerald-300 font-semibold">8–15 млрд тг</span> «под ключ» (проходка + крепь + копёр + ПУ + вентиляция).</p>
            </div>
          </div>
        </section>

        {/* Exercises */}
        <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-6">
          <h2 className="text-2xl font-semibold text-slate-100">Практика · 4 задачи</h2>

          {/* Exercise 1 */}
          <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950/40 p-5">
            <div className="text-sm text-slate-500">Задача 1 · Терминология</div>
            <div className="mt-1 text-slate-100">Что такое квершлаг?</div>
            <div className="mt-3 space-y-2 text-sm">
              {[
                { v: "a", t: "Вертикальный ствол с поверхности" },
                { v: "b", t: "Штольня — горизонтальная выработка с поверхности через борт горы" },
                { v: "c", t: "Горизонтальная подземная выработка вкрест простирания пластов — соединяет ствол с очистными забоями" },
                { v: "d", t: "Угол наклона шахтного ствола" },
              ].map((opt) => (
                <label key={opt.v} className="flex items-start gap-2 cursor-pointer text-slate-300 hover:text-slate-100">
                  <input type="radio" name="ex1" value={opt.v} checked={ex1 === opt.v} onChange={(e) => setEx1(e.target.value)} className="mt-1" />
                  <span><span className="text-slate-500">{opt.v})</span> {opt.t}</span>
                </label>
              ))}
            </div>
            <button onClick={() => setEx1Done(true)} className="mt-3 px-3 py-1.5 text-xs rounded bg-blue-600 hover:bg-blue-500 transition text-white">Проверить</button>
            {ex1Done && (
              <div className={`mt-3 text-sm ${ex1 === "c" ? "text-emerald-400" : "text-rose-400"}`}>
                {ex1 === "c" ? "✓ Верно. Квершлаг проходит вкрест простирания пластов и связывает ствол с очистными забоями." : "✗ Неверно. Правильный ответ — (c): квершлаг — горизонтальная выработка вкрест простирания пластов."}
              </div>
            )}
          </div>

          {/* Exercise 2 */}
          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/40 p-5">
            <div className="text-sm text-slate-500">Задача 2 · Газовый режим</div>
            <div className="mt-1 text-slate-100">Какое максимальное содержание метана допускается в исходящей струе забоя угольной шахты по ПБ 03-553?</div>
            <div className="mt-3 space-y-2 text-sm">
              {[
                { v: "a", t: "0.1%" },
                { v: "b", t: "1% (превышение — экстренное прекращение работ и эвакуация)" },
                { v: "c", t: "5%" },
                { v: "d", t: "15% (нижний предел взрываемости)" },
              ].map((opt) => (
                <label key={opt.v} className="flex items-start gap-2 cursor-pointer text-slate-300 hover:text-slate-100">
                  <input type="radio" name="ex2" value={opt.v} checked={ex2 === opt.v} onChange={(e) => setEx2(e.target.value)} className="mt-1" />
                  <span><span className="text-slate-500">{opt.v})</span> {opt.t}</span>
                </label>
              ))}
            </div>
            <button onClick={() => setEx2Done(true)} className="mt-3 px-3 py-1.5 text-xs rounded bg-blue-600 hover:bg-blue-500 transition text-white">Проверить</button>
            {ex2Done && (
              <div className={`mt-3 text-sm ${ex2 === "b" ? "text-emerald-400" : "text-rose-400"}`}>
                {ex2 === "b" ? "✓ Верно. CH₄ ≤ 1% в забое, ≤ 0.75% на участке, ≤ 0.5% общешахтно. Нижний предел взрыва — 5%." : "✗ Неверно. Правильный ответ — (b) 1%."}
              </div>
            )}
          </div>

          {/* Exercise 3 */}
          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/40 p-5">
            <div className="text-sm text-slate-500">Задача 3 · Стоимость ствола</div>
            <div className="mt-1 text-slate-100">
              Главный вертикальный ствол Ø 6 м, глубина 800 м. Удельная стоимость проходки (под ключ с крепью) —
              12 млн тг/п.м. Рассчитайте полную стоимость, тенге.
            </div>
            <input
              type="text"
              inputMode="decimal"
              value={ex3}
              onChange={(e) => setEx3(e.target.value)}
              placeholder="например 9600000000"
              className="mt-3 w-64 px-3 py-1.5 text-sm rounded bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-blue-500"
            />
            <button onClick={() => setEx3Done(true)} className="ml-2 px-3 py-1.5 text-xs rounded bg-blue-600 hover:bg-blue-500 transition text-white">Проверить</button>
            {ex3Done && (
              <div className={`mt-3 text-sm ${ex3Correct ? "text-emerald-400" : "text-rose-400"}`}>
                {ex3Correct
                  ? "✓ Верно. 800 × 12 000 000 = 9 600 000 000 тг ≈ 9.6 млрд тг (укладывается в диапазон 8–15 млрд тг для ствола такого типоразмера)."
                  : "✗ Неверно. 800 м × 12 000 000 тг/м = 9 600 000 000 тг (допуск ±0.8 млрд)."}
              </div>
            )}
          </div>

          {/* Exercise 4 */}
          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/40 p-5">
            <div className="text-sm text-slate-500">Задача 4 · Аббревиатура крепи</div>
            <div className="mt-1 text-slate-100">Что означает аббревиатура «СВП» в подземной горной крепи (СВП-22 / СВП-27 / СВП-33)?</div>
            <div className="mt-3 space-y-2 text-sm">
              {[
                { v: "a", t: "Сборная Виброуплотнённая Плита" },
                { v: "b", t: "Свайно-Винтовая Подвеска" },
                { v: "c", t: "Сегмент Винтовой Пилы" },
                { v: "d", t: "Сегмент Взаимозаменяемого Профиля — арочная металлическая крепь СВП-22/27/33 для горизонтальных выработок" },
              ].map((opt) => (
                <label key={opt.v} className="flex items-start gap-2 cursor-pointer text-slate-300 hover:text-slate-100">
                  <input type="radio" name="ex4" value={opt.v} checked={ex4 === opt.v} onChange={(e) => setEx4(e.target.value)} className="mt-1" />
                  <span><span className="text-slate-500">{opt.v})</span> {opt.t}</span>
                </label>
              ))}
            </div>
            <button onClick={() => setEx4Done(true)} className="mt-3 px-3 py-1.5 text-xs rounded bg-blue-600 hover:bg-blue-500 transition text-white">Проверить</button>
            {ex4Done && (
              <div className={`mt-3 text-sm ${ex4 === "d" ? "text-emerald-400" : "text-rose-400"}`}>
                {ex4 === "d"
                  ? "✓ Верно. СВП — Сегмент Взаимозаменяемого Профиля, спецпрофиль номеров 22/27/33 (кг/п.м), арка из 3 сегментов."
                  : "✗ Неверно. Правильный ответ — (d): Сегмент Взаимозаменяемого Профиля."}
              </div>
            )}
          </div>
        </section>

        <div className="pt-4 text-center">
          <Link href="/smeta-trainer/drawings-practice" className="inline-block px-5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition text-sm text-slate-200">← Вернуться к разделам</Link>
        </div>
      </main>
    </div>
  );
}
