"use client";
import Link from "next/link";
import { useState } from "react";

export default function SeaportsHarborsPage() {
  const [ex1, setEx1] = useState<string | null>(null);
  const [ex2, setEx2] = useState<string | null>(null);
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string | null>(null);

  const ex1Correct = ex1 === "c";
  const ex2Correct = ex2 === "b";
  const ex3Value = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Value) && Math.abs(ex3Value - 36_000_000_000) <= 3_000_000_000;
  const ex4Correct = ex4 === "d";

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
          <div className="text-xs text-slate-500">
            AEVION Smeta Trainer · Морские и речные порты
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            ⚓ Морские и речные порты
          </h1>
          <p className="mt-3 text-slate-400 max-w-3xl leading-relaxed">
            Модуль #187 — проектирование, строительство и реконструкция портовой
            инфраструктуры: причальные сооружения, гидротехнические защитные
            объекты, перегрузочное оборудование, контейнерные и нефтеналивные
            терминалы. Учитываем особенности РК — Каспийское море (Актау, Курык)
            и речные порты на Иртыше, Урале, Или.
          </p>
        </section>

        {/* Section 1: Типы причальных сооружений */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-cyan-300 mb-3">
            1. Типы причальных сооружений
          </h2>
          <ul className="text-sm text-slate-300 space-y-2 list-disc list-inside">
            <li>
              <span className="text-slate-100 font-medium">Гравитационные</span> —
              массивные ж/б блоки или массивы-гиганты, удерживаются за счёт
              собственного веса. Применяются при прочных основаниях.
            </li>
            <li>
              <span className="text-slate-100 font-medium">Свайные</span> —
              шпунтовые (Larssen, ШК-1) или свайно-ростверковые. Для слабых
              грунтов и больших глубин.
            </li>
            <li>
              <span className="text-slate-100 font-medium">Эстакадные</span> на
              буронабивных сваях Ø1200–1800 мм с ж/б ростверком —
              универсальный вариант для глубоководных причалов.
            </li>
          </ul>
        </section>

        {/* Section 2: Гидротехнические защитные сооружения */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-cyan-300 mb-3">
            2. Гидротехнические защитные сооружения
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Молы и волноломы защищают акваторию от штормового волнения. Причальная
            стенка проектируется на глубину{" "}
            <span className="text-amber-300 font-medium">8–15 м</span> (для морских
            судов), заглубление шпунта Larssen —{" "}
            <span className="text-amber-300 font-medium">18–22 м</span> ниже
            проектного дна. Расчёт ведётся по СНиП 2.06.04 (нагрузки от волн, льда,
            судов).
          </p>
        </section>

        {/* Section 3: Дноуглубление */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-cyan-300 mb-3">
            3. Дноуглубительные работы
          </h2>
          <ul className="text-sm text-slate-300 space-y-2 list-disc list-inside">
            <li>
              Землесосные снаряды (например, «Иртыш-260»), производительность до
              2500 м³/ч по грунту.
            </li>
            <li>
              Грейферные ковши объёмом до{" "}
              <span className="text-amber-300 font-medium">25 м³</span> — для
              плотных грунтов и скальных пород после рыхления.
            </li>
            <li>
              Глубина судоходных каналов морских портов —{" "}
              <span className="text-amber-300 font-medium">9–15 м</span> в
              зависимости от класса судов.
            </li>
            <li>
              Грунт укладывается в подводные отвалы или используется для намыва
              территорий портового тыла.
            </li>
          </ul>
        </section>

        {/* Section 4: Перегрузочное оборудование */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-cyan-300 mb-3">
            4. Перегрузочное оборудование
          </h2>
          <div className="text-sm text-slate-300 space-y-2">
            <p>
              <span className="text-slate-100 font-medium">
                Портальные краны Liebherr LHM 600
              </span>{" "}
              — грузоподъёмность до 208 т, вылет 58 м. Цена —{" "}
              <span className="text-amber-300 font-medium">5–12 млн евро</span> в
              зависимости от комплектации.
            </p>
            <p>
              <span className="text-slate-100 font-medium">STS-краны</span>{" "}
              (Ship-To-Shore) для контейнеров — грузоподъёмность 65–100 т, длина
              стрелы рассчитана на ширину судна Post-Panamax.
            </p>
            <p>
              Вспомогательная техника: ричстакеры (для контейнеров вне линии STS),
              тельферы, мобильные краны для генеральных грузов.
            </p>
          </div>
        </section>

        {/* Section 5: Контейнерные терминалы */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-cyan-300 mb-3">
            5. Контейнерные терминалы
          </h2>
          <ul className="text-sm text-slate-300 space-y-2 list-disc list-inside">
            <li>
              <span className="text-slate-100 font-medium">STS-краны</span> на
              причальной линии + <span className="text-slate-100 font-medium">RTG</span>{" "}
              (Rubber-Tyred Gantry) — штабелёры в зоне хранения.
            </li>
            <li>
              <span className="text-slate-100 font-medium">AGV</span>{" "}
              (Automated Guided Vehicles) — автоматические транспортёры между
              причалом и складом.
            </li>
            <li>
              Норматив плотности склада —{" "}
              <span className="text-amber-300 font-medium">800–1500 TEU/га</span>{" "}
              (Twenty-foot Equivalent Unit — стандартный 20-фут. контейнер).
            </li>
          </ul>
        </section>

        {/* Section 6: Нефтеналивные причалы */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-cyan-300 mb-3">
            6. Нефтеналивные причалы
          </h2>
          <ul className="text-sm text-slate-300 space-y-2 list-disc list-inside">
            <li>
              <span className="text-slate-100 font-medium">Стендеры</span> —
              загрузочные рукава Marine Loading Arms (FMC, SVT) для перекачки
              нефти и нефтепродуктов.
            </li>
            <li>
              <span className="text-slate-100 font-medium">QRH</span>{" "}
              (Quick Release Hooks) — аварийные быстроотдающие крюки для
              экстренной отшвартовки.
            </li>
            <li>
              Нефтеулавливающие боны по периметру акватории причала, аварийные
              комплекты сорбентов и скиммеров.
            </li>
          </ul>
        </section>

        {/* Section 7: Зерновые/насыпные терминалы */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-cyan-300 mb-3">
            7. Зерновые и насыпные терминалы
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Силосы вместимостью{" "}
            <span className="text-amber-300 font-medium">50–80 тыс. т</span>,
            вертикальные ленточные и норийные элеваторы, ленточные конвейеры с
            пневмоаспирацией пыли. Загрузка судна — через судопогрузочные машины
            (СПМ) производительностью 1500–3000 т/ч. Бенчмарк РК — терминал
            «Ак-Бидай» в Актау.
          </p>
        </section>

        {/* Section 8: Системы безопасности */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-cyan-300 mb-3">
            8. Системы безопасности
          </h2>
          <ul className="text-sm text-slate-300 space-y-2 list-disc list-inside">
            <li>
              <span className="text-slate-100 font-medium">VTS</span>{" "}
              (Vessel Traffic Service) — береговые радары и АИС для управления
              движением судов в акватории.
            </li>
            <li>
              <span className="text-slate-100 font-medium">ISPS Code</span>{" "}
              (International Ship and Port Facility Security) — обязательный
              международный код безопасности.
            </li>
            <li>
              <span className="text-slate-100 font-medium">MARSEC уровни 1–3</span>{" "}
              — градация угроз: от штатного режима до повышенной готовности.
            </li>
            <li>
              Антитеррор-ограждения, СКУД, видеонаблюдение по периметру и в зонах
              грузовых операций.
            </li>
          </ul>
        </section>

        {/* Section 9: Бенчмарки РК */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-cyan-300 mb-3">
            9. Бенчмарки РК
          </h2>
          <ul className="text-sm text-slate-300 space-y-2 list-disc list-inside">
            <li>
              <span className="text-slate-100 font-medium">Актау Sea Port</span>{" "}
              — пропускная способность ~10 млн т/год, ввод в эксплуатацию 1963,
              реконструкция 2015–2020.
            </li>
            <li>
              <span className="text-slate-100 font-medium">Курык (КТЗМ Сарыжа)</span>{" "}
              — паромный и Ro-Ro комплекс, ключевой узел Транскаспийского
              маршрута.
            </li>
            <li>
              <span className="text-slate-100 font-medium">Атырау (река Урал)</span>{" "}
              — речной порт для перевалки нефтегруза и стройматериалов.
            </li>
            <li>
              Себестоимость причала длиной 150 м при глубине 9 м —{" "}
              <span className="text-amber-300 font-medium">25–45 млрд тг</span>{" "}
              (бенчмарк ~240 млн тг/п.м.).
            </li>
          </ul>
        </section>

        {/* Exercises */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-50">Практические задания</h2>

          {/* ex1 */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
            <p className="text-slate-100 font-medium mb-3">
              1. Какой тип причального сооружения опирается на свайное основание с
              ж/б плитой на буронабивных сваях Ø1200–1800 мм?
            </p>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Гравитационный (массивные ж/б блоки)" },
                { v: "b", t: "Намывной" },
                { v: "c", t: "Эстакадный (свайно-ростверковый)" },
                { v: "d", t: "Шпунтовый сплошной" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className="flex items-center gap-2 text-slate-300 cursor-pointer hover:text-slate-100"
                >
                  <input
                    type="radio"
                    name="ex1"
                    value={opt.v}
                    onChange={(e) => setEx1(e.target.value)}
                    className="accent-cyan-400"
                  />
                  <span>{opt.t}</span>
                </label>
              ))}
            </div>
            {ex1 && (
              <p
                className={`mt-3 text-sm ${
                  ex1Correct ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {ex1Correct
                  ? "✅ Верно. Эстакадный причал на буронабивных сваях — наиболее распространённое решение для глубоководных причалов в РК."
                  : "❌ Неверно. Правильный ответ — эстакадный (свайно-ростверковый) на буронабивных сваях Ø1200–1800 мм."}
              </p>
            )}
          </div>

          {/* ex2 */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
            <p className="text-slate-100 font-medium mb-3">
              2. Что обозначает аббревиатура STS-кран в контейнерных терминалах?
            </p>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Statistical Transport System" },
                {
                  v: "b",
                  t: "Ship-To-Shore — контейнерный портальный кран с судна на берег",
                },
                { v: "c", t: "Steel Tube System" },
                { v: "d", t: "Slow Transit Service" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className="flex items-center gap-2 text-slate-300 cursor-pointer hover:text-slate-100"
                >
                  <input
                    type="radio"
                    name="ex2"
                    value={opt.v}
                    onChange={(e) => setEx2(e.target.value)}
                    className="accent-cyan-400"
                  />
                  <span>{opt.t}</span>
                </label>
              ))}
            </div>
            {ex2 && (
              <p
                className={`mt-3 text-sm ${
                  ex2Correct ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {ex2Correct
                  ? "✅ Верно. STS = Ship-To-Shore — портальные краны на причальной линии для перегрузки контейнеров с судна на берег."
                  : "❌ Неверно. STS расшифровывается как Ship-To-Shore."}
              </p>
            )}
          </div>

          {/* ex3 */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
            <p className="text-slate-100 font-medium mb-3">
              3. Рассчитайте ориентировочную стоимость причала длиной 150 м при
              бенчмарке 240 млн тг/п.м. (введите сумму в тенге).
            </p>
            <input
              type="text"
              value={ex3}
              onChange={(e) => setEx3(e.target.value)}
              placeholder="например: 36000000000"
              className="w-full md:w-80 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-cyan-500"
            />
            {ex3 && (
              <p
                className={`mt-3 text-sm ${
                  ex3Correct ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {ex3Correct
                  ? "✅ Верно. 150 × 240 000 000 = 36 000 000 000 тг (≈ 36 млрд тг). Допуск ±3 млрд тг учитывает диапазон 25–45 млрд тг."
                  : "❌ Пересчитайте: 150 × 240 000 000 = 36 000 000 000 тг."}
              </p>
            )}
          </div>

          {/* ex4 */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
            <p className="text-slate-100 font-medium mb-3">
              4. Что такое TEU в контейнерных портах?
            </p>
            <div className="space-y-2 text-sm">
              {[
                { v: "a", t: "Тонна груза" },
                { v: "b", t: "Тип портального крана" },
                { v: "c", t: "Граница территории терминала" },
                {
                  v: "d",
                  t: "Twenty-foot Equivalent Unit — стандартный 20-фут. контейнер, единица грузооборота",
                },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className="flex items-center gap-2 text-slate-300 cursor-pointer hover:text-slate-100"
                >
                  <input
                    type="radio"
                    name="ex4"
                    value={opt.v}
                    onChange={(e) => setEx4(e.target.value)}
                    className="accent-cyan-400"
                  />
                  <span>{opt.t}</span>
                </label>
              ))}
            </div>
            {ex4 && (
              <p
                className={`mt-3 text-sm ${
                  ex4Correct ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {ex4Correct
                  ? "✅ Верно. TEU = Twenty-foot Equivalent Unit — стандартный 20-футовый контейнер, базовая единица измерения грузооборота контейнерных портов."
                  : "❌ Неверно. TEU — это Twenty-foot Equivalent Unit, единица измерения грузооборота в эквиваленте 20-футового контейнера."}
              </p>
            )}
          </div>
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6">
          Модуль #187 · AEVION Smeta Trainer · Drawings Practice ·
          Морские и речные порты
        </section>
      </main>
    </div>
  );
}
