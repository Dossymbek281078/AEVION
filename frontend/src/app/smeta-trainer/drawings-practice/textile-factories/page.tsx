"use client";
import Link from "next/link";
import { useState } from "react";

export default function TextileFactoriesPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 50000000000) <= 5000000000;

  const correct = {
    ex1: ex1 === "c",
    ex2: ex2 === "b",
    ex3: ex3Correct,
    ex4: ex4 === "d",
  };
  const score = Object.values(correct).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300 hover:text-blue-200 transition">← К разделам</Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Текстильные и швейные фабрики</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🧵 Текстильные и швейные фабрики</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #194. Сметы и проектирование промышленных объектов текстильной и швейной
            отрасли РК: хлопкоперерабатывающие заводы, прядильно-ткацкие комбинаты, трикотажные
            и швейные фабрики. Особенности климат-контроля, аспирации, пожарной безопасности
            и расценок по ССЦ/ЭСН РК для расчёта стоимости фабрик 30–60 млрд тг.
          </p>
        </section>

        {/* Section 1 */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Полный цикл текстильной продукции</h2>
          <p className="text-slate-300 leading-relaxed">
            Согласно СН РК 3.06-29 технологическая цепочка хлопковой ткани:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-slate-300 pl-2">
            <li>Хлопкоприёмный пункт (склад хлопка-сырца, влагозащита, фумигация).</li>
            <li>Очистка и трёпка (удаление мусора, листьев, семян).</li>
            <li>Чесание (карды, гребнечесальные машины) — образование ленты.</li>
            <li>Прядение (вытяжка, кручение → пряжа).</li>
            <li>Ткачество (или вязание для трикотажа) — формирование полотна.</li>
            <li>Крашение и отбеливание (барк-, джиггер-, джет-машины).</li>
            <li>Отделка (мерсеризация, каландрование, аппретирование).</li>
            <li>Готовая ткань → раскрой → швейное производство.</li>
          </ol>
        </section>

        {/* Section 2 */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-amber-300">2. Хлопкоперерабатывающие заводы</h2>
          <p className="text-slate-300 leading-relaxed">
            Приёмка хлопка-сырца (раузой и мехуборкой), очистка от семян джином-волокноотделителем.
            Соотношение выхода: <span className="text-amber-200">1 ц волокна ≈ 3 ц хлопка-сырца</span>
            (33–35% выхода длинного волокна, остальное — линт, делинт и улюк).
          </p>
          <p className="text-slate-300 leading-relaxed">
            После джина — кардочесание и формирование ленты, прессование волокна в кипы 220 кг.
            Знаковые объекты РК: <span className="text-amber-200">Шымкентский ХБК</span>,
            «Мырзакент», Сарыагашский хлопзавод, кластеры Туркестанской и Кызылординской областей.
          </p>
        </section>

        {/* Section 3 */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-sky-300">3. Прядильное производство</h2>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><span className="text-sky-200">Кардная система</span> — для средних номеров пряжи (Nm 20–50).</li>
            <li><span className="text-sky-200">Гребенная система</span> — тонкая высококачественная пряжа (Nm 50–120).</li>
            <li><span className="text-sky-200">Пневмомеханическая (ОПМ)</span> — производит толстую пряжу с высокой скоростью.</li>
          </ul>
          <p className="text-slate-300 leading-relaxed">
            Оборудование: веретёна <span className="text-sky-200">Toyota RX300</span>, ленточные машины
            <span className="text-sky-200"> Rieter D75/D77</span>, пневмопрядильные
            <span className="text-sky-200"> Schlafhorst Autocoro</span> — по 1000–1500 веретён на машину.
            На прядильную фабрику 30 тыс. м² ставят 30–80 тыс. веретён.
          </p>
        </section>

        {/* Section 4 */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-rose-300">4. Ткацкое производство</h2>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><span className="text-rose-200">Рапирные / пневморапирные</span> — Picanol GTMax, Vamatex, Sulzer (универсальные, плотные ткани).</li>
            <li><span className="text-rose-200">Пневматические</span> — Toyota JAT810, Tsudakoma ZAX9100 (хлопок, лёгкие ткани).</li>
            <li><span className="text-rose-200">Гидравлические</span> — синтетика, скоростные.</li>
            <li><span className="text-rose-200">Проекционные / челночные</span> — устаревшие, для специальных тканей.</li>
          </ul>
          <p className="text-slate-300 leading-relaxed">
            Производительность 60–1200 уточных нитей/мин. Уровень шума 90–95 дБА — обязательны
            акустические экраны, СИЗ органов слуха, эпюры по СН РК 4.01-41 «Защита от шума».
          </p>
        </section>

        {/* Section 5 */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-violet-300">5. Трикотажные машины</h2>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><span className="text-violet-200">Кругловязальные</span> — Mayer &amp; Cie Relanit, Terrot S296 (футболки, нательное бельё).</li>
            <li><span className="text-violet-200">Плосковязальные</span> — Stoll CMS, Shima Seiki Mach2X (свитера, верхний трикотаж).</li>
            <li><span className="text-violet-200">Основовязальные</span> — Karl Mayer (тюль, кружево, спортивный и bedding-трикотаж).</li>
          </ul>
          <p className="text-slate-300 leading-relaxed">
            Производительность кругловязальной машины: 12–20 кг готового полотна в смену.
            Для трикотажного цеха — отдельные климатические условия (30–40°C, 50% влажности).
          </p>
        </section>

        {/* Section 6 */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-teal-300">6. Швейное производство</h2>
          <p className="text-slate-300 leading-relaxed">
            Потоковые линии на швейных машинах <span className="text-teal-200">Juki, Brother, Jack</span>
            (промышленные с автоматической обрезкой нити). Раскройные комплексы
            <span className="text-teal-200"> Lectra Vector, Gerber CutWorks, Gemini</span> — настил тканей
            до 150 слоёв, скорость 60 м/мин.
          </p>
          <p className="text-slate-300 leading-relaxed">
            Утюжильные столы <span className="text-teal-200">Veit, Macpi</span>, конвейерные системы на
            30–150 рабочих мест. Бенчмарки РК: <span className="text-teal-200">БТК-Гульдер</span> (Шымкент),
            <span className="text-teal-200"> «Тиграхауд»</span> (Шымкент), швейные кластеры Алматы,
            Семея, Караганды.
          </p>
        </section>

        {/* Section 7 */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-cyan-300">7. Климат-контроль</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-700">
                <th className="py-2 pr-3">Цех</th>
                <th className="py-2 pr-3">Температура</th>
                <th className="py-2 pr-3">Отн. влажность</th>
                <th className="py-2">Система</th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              <tr className="border-b border-slate-800">
                <td className="py-2 pr-3">Прядильно-ткацкий (хлопок)</td>
                <td className="py-2 pr-3">25–30 °C</td>
                <td className="py-2 pr-3">55–65 %</td>
                <td className="py-2">паровые увлажнители, центробежные форсунки</td>
              </tr>
              <tr className="border-b border-slate-800">
                <td className="py-2 pr-3">Трикотажный</td>
                <td className="py-2 pr-3">30–40 °C</td>
                <td className="py-2 pr-3">40–50 %</td>
                <td className="py-2">осушители + кондиционеры</td>
              </tr>
              <tr>
                <td className="py-2 pr-3">Швейный</td>
                <td className="py-2 pr-3">20–24 °C</td>
                <td className="py-2 pr-3">40–55 %</td>
                <td className="py-2">общеобменная приточно-вытяжная</td>
              </tr>
            </tbody>
          </table>
          <p className="text-slate-400 text-sm">
            Расценки по ЭСН РК Сб. 20 «Вентиляция и кондиционирование», Сб. 21 «Холодильные установки».
          </p>
        </section>

        {/* Section 8 */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-orange-300">8. Пожарная безопасность</h2>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li>Категория помещений по СН РК 2.02-15: <span className="text-orange-200">«В» (пожароопасная)</span> для прядильно-ткацких и
              <span className="text-orange-200"> «Б» (взрывоопасная)</span> — в местах высокой концентрации пыли волокон.</li>
            <li>Спринклерное пожаротушение с шагом <span className="text-orange-200">6 × 6 м</span>, расход 0,24 л/с·м².</li>
            <li>Аспирационные системы постоянного действия, циклоны и фильтры — съём пыли с машин.</li>
            <li>Снятие статического электричества — заземление машин, ионизаторы воздуха.</li>
            <li>Огнезащита металлоконструкций R 45 — R 60, пути эвакуации не менее 1,4 м.</li>
          </ul>
        </section>

        {/* Section 9 */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-lime-300">9. Бенчмарки РК</h2>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><span className="text-lime-200">БТК-Гульдер</span> (Шымкент) — швейная фабрика спецодежды и формы.</li>
            <li><span className="text-lime-200">СКФ «Алматы Текстайл»</span> — прядильно-ткацкий комбинат.</li>
            <li><span className="text-lime-200">«Тиграхауд»</span> (Шымкент) — хлопкопрядильный завод полного цикла.</li>
            <li>Фабрики <span className="text-lime-200">Каратал, Кызылорда, «Жибек жолы»</span> (Семей).</li>
          </ul>
          <p className="text-slate-300 leading-relaxed">
            Ориентировочная стоимость прядильно-ткацкой фабрики 50 тыс. м² —
            <span className="text-lime-200"> 35–65 млрд тг</span> с оборудованием. Удельная стоимость
            1 м² корпуса (без основного оборудования) — 350–520 тыс. тг (ССЦ РК 2026, индексация
            new-shop.ksm.kz). С оборудованием — около <span className="text-lime-200">1 000 тыс. тг/м²</span>.
          </p>
        </section>

        {/* Exercises */}
        <section className="bg-slate-900/60 border border-blue-900/40 rounded-xl p-6 space-y-6">
          <h2 className="text-2xl font-bold text-blue-300">🎯 Практика</h2>

          {/* Ex1 */}
          <div className="space-y-2">
            <p className="font-semibold text-slate-100">1. Какие параметры микроклимата требуются в прядильно-ткацком цехе для хлопка?</p>
            {[
              { v: "a", t: "18–22 °C, 40 % относит. влажности" },
              { v: "b", t: "35–40 °C, 80 % относит. влажности" },
              { v: "c", t: "25–30 °C, 55–65 % относит. влажности" },
              { v: "d", t: "5–10 °C, 30 % относит. влажности" },
            ].map((o) => (
              <label key={o.v} className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={(e) => setEx1(e.target.value)} />
                <span>{o.t}</span>
              </label>
            ))}
            {showResults && (
              <p className={correct.ex1 ? "text-emerald-400 text-sm" : "text-rose-400 text-sm"}>
                {correct.ex1 ? "✓ Верно" : "✗ Правильный ответ: c) 25–30 °C, 55–65 % относит. влажности"}
              </p>
            )}
          </div>

          {/* Ex2 */}
          <div className="space-y-2">
            <p className="font-semibold text-slate-100">2. Что такое джин в хлопкопереработке?</p>
            {[
              { v: "a", t: "ткацкий станок" },
              { v: "b", t: "машина-волокноотделитель — отделяет хлопковое волокно от семян хлопка-сырца" },
              { v: "c", t: "красильный аппарат" },
              { v: "d", t: "трепальная машина" },
            ].map((o) => (
              <label key={o.v} className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input type="radio" name="ex2" value={o.v} checked={ex2 === o.v} onChange={(e) => setEx2(e.target.value)} />
                <span>{o.t}</span>
              </label>
            ))}
            {showResults && (
              <p className={correct.ex2 ? "text-emerald-400 text-sm" : "text-rose-400 text-sm"}>
                {correct.ex2 ? "✓ Верно" : "✗ Правильный ответ: b) машина-волокноотделитель"}
              </p>
            )}
          </div>

          {/* Ex3 */}
          <div className="space-y-2">
            <p className="font-semibold text-slate-100">
              3. Прядильно-ткацкая фабрика 50 тыс. м² при бенчмарке 1 000 тыс. тг/м² (с оборудованием).
              Какова ориентировочная стоимость, тг?
            </p>
            <input
              type="text"
              value={ex3}
              onChange={(e) => setEx3(e.target.value)}
              placeholder="например, 50000000000"
              className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-100 w-72"
            />
            {showResults && (
              <p className={correct.ex3 ? "text-emerald-400 text-sm" : "text-rose-400 text-sm"}>
                {correct.ex3
                  ? "✓ Верно (≈ 50 млрд тг)"
                  : "✗ Правильный ответ: 50 000 × 1 000 000 = 50 000 000 000 тг (50 млрд тг), допуск ±5 млрд тг"}
              </p>
            )}
          </div>

          {/* Ex4 */}
          <div className="space-y-2">
            <p className="font-semibold text-slate-100">4. Какая категория помещения по пожарной безопасности у прядильно-ткацкого цеха?</p>
            {[
              { v: "a", t: "Д (негорючие материалы)" },
              { v: "b", t: "Г (горячие процессы)" },
              { v: "c", t: "А (только взрывоопасная)" },
              { v: "d", t: "В (пожароопасная) и местами Б (взрывоопасная пыль волокон)" },
            ].map((o) => (
              <label key={o.v} className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input type="radio" name="ex4" value={o.v} checked={ex4 === o.v} onChange={(e) => setEx4(e.target.value)} />
                <span>{o.t}</span>
              </label>
            ))}
            {showResults && (
              <p className={correct.ex4 ? "text-emerald-400 text-sm" : "text-rose-400 text-sm"}>
                {correct.ex4 ? "✓ Верно" : "✗ Правильный ответ: d) В (пожароопасная) и местами Б (взрывоопасная пыль волокон)"}
              </p>
            )}
          </div>

          <div className="flex items-center gap-4 pt-2">
            <button
              onClick={() => setShowResults(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg font-medium transition"
            >
              Проверить ответы
            </button>
            {showResults && (
              <span className="text-slate-300">
                Результат: <span className="text-blue-300 font-semibold">{score} / 4</span>
              </span>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
