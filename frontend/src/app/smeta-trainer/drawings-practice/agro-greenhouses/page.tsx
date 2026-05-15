"use client";
import Link from "next/link";
import { useState } from "react";

export default function AgroGreenhousesPage() {
  const [ex1, setEx1] = useState<string | null>(null);
  const [ex2, setEx2] = useState<string | null>(null);
  const [ex3, setEx3] = useState<string>("");
  const [ex3Checked, setEx3Checked] = useState(false);
  const [ex4, setEx4] = useState<string | null>(null);

  const ex3Value = parseFloat(ex3.replace(/[\s,]/g, ""));
  const ex3Correct = !isNaN(ex3Value) && Math.abs(ex3Value - 4_200_000_000) <= 300_000_000;

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
            AEVION Smeta Trainer · Агрокомплексы и теплицы
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        {/* HERO */}
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            🌱 Агрокомплексы, теплицы и элеваторы
          </h1>
          <p className="mt-3 text-slate-400 max-w-3xl leading-relaxed">
            Сметная стоимость АПК-объектов в РК — теплицы Venlo с гидропоникой,
            овощехранилища с регулируемой газовой средой, зерновые элеваторы,
            молочные комплексы и птицефабрики. Здесь нормативы СН РК 3.06,
            технологическое оборудование (досветка, климат, доение, аспирация)
            и бенчмарки тенге/га, тенге/тонна, тенге/голова.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-1 rounded bg-emerald-900/40 text-emerald-300 border border-emerald-800">
              Модуль #180
            </span>
            <span className="px-2 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
              СН РК 3.06-23, 3.06-26
            </span>
            <span className="px-2 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
              ЕНиР Е24, ССЦ-15
            </span>
          </div>
        </section>

        {/* SECTION 1 — Теплицы Venlo */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">
            1. Промышленные теплицы Venlo
          </h2>
          <p className="text-slate-300 leading-relaxed">
            Голландский стандарт Venlo — каркас оцинкованный, шаг ферм{" "}
            <span className="text-emerald-200">4–5 м</span>, ширина пролёта 8 / 9.6 / 12.8 м,
            высота до водостока{" "}
            <span className="text-emerald-200">6–7 м</span> (для дренажа CO₂ и циркуляции).
            Покрытие — стекло закалённое{" "}
            <span className="text-emerald-200">4 мм</span> (диффузное AR/AGC Klaas)
            либо поликарбонат сотовый{" "}
            <span className="text-emerald-200">16 мм</span> (овощехранилища и рассадные).
          </p>
          <ul className="text-sm text-slate-400 list-disc list-inside space-y-1">
            <li>Карта (блок): 25 × 50 га; стандарт промышленной плантации в РК — 5–15 га.</li>
            <li>Цена «под ключ» с климатом и оборудованием: <span className="text-emerald-200">45–85 млн тг/га</span> (бенчмарк 70 млн тг/га).</li>
            <li>Поставщики каркаса: Bom Group, Certhon, Dalsem, KUBO, Van der Hoeven.</li>
            <li>Снеговая нагрузка для I–II районов РК: расчёт по СН РК EN 1991-1-3.</li>
          </ul>
        </section>

        {/* SECTION 2 — Гидропоника */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-lime-300">
            2. Гидропоника и субстраты
          </h2>
          <p className="text-slate-300 leading-relaxed">
            Три основные технологии: <span className="text-lime-200">NFT</span>{" "}
            (Nutrient Film — листовая зелень, салаты),{" "}
            <span className="text-lime-200">DWC</span> (Deep Water Culture),{" "}
            <span className="text-lime-200">Drip</span> (капельный полив по
            минеральной вате — томат, огурец, перец). Субстрат — маты Grodan
            или Cultilene 100 × 20 × 7.5 см.
          </p>
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <div className="bg-slate-950/40 border border-slate-800 rounded p-3">
              <div className="text-lime-200 font-medium">Параметры раствора</div>
              <div className="text-slate-400 mt-1">
                EC = 1.5–3.5 мСм/см · pH = 5.5–6.5 · t° = 18–22°C
              </div>
            </div>
            <div className="bg-slate-950/40 border border-slate-800 rounded p-3">
              <div className="text-lime-200 font-medium">Урожайность</div>
              <div className="text-slate-400 mt-1">
                Томат 85–110 кг/м²/год · Огурец 110–140 · Салат 35–45 (по
                циклам)
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Расход воды: 8–12 л/м²/сут летом. Узел растворного приготовления
            (МСТУ): Priva NutriJet или Codema.
          </p>
        </section>

        {/* SECTION 3 — Климат */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-cyan-300">
            3. Климат-контроль и отопление
          </h2>
          <p className="text-slate-300 leading-relaxed">
            Расчётная мощность отопления для РК (Алматы, Шымкент, Тараз) — 250–350
            Вт/м² (II–III зимняя зона). Котельная газовая или угольная{" "}
            <span className="text-cyan-200">1–3 МВт</span> на 1 га. Рекуперация
            дымовых газов даёт СО₂{" "}
            <span className="text-cyan-200">800–1000 ppm</span> в зону растения
            (Bosch CO₂-фильтр).
          </p>
          <ul className="text-sm text-slate-400 list-disc list-inside space-y-1">
            <li>Туманообразование Mistmaker / Lubing — снижение t° на 8–12°C летом.</li>
            <li>Энергосберегающий экран Phormium Solarweave / Svensson XLS — экономия 50–70% тепла ночью.</li>
            <li>Контроллер климата: Priva Connext, Hoogendoorn iSii, Argus Titan.</li>
            <li>Форточная вентиляция (10–25% площади кровли) или принудительный обдув.</li>
          </ul>
        </section>

        {/* SECTION 4 — Досветка */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-yellow-300">
            4. Ассимиляционная досветка
          </h2>
          <p className="text-slate-300 leading-relaxed">
            Для тома и огурца в условиях РК (декабрь–февраль) нужен PPFD{" "}
            <span className="text-yellow-200">200–400 мкмоль/м²·с</span> при
            16–18 ч светового дня. Натриевые лампы{" "}
            <span className="text-yellow-200">HPS 600–1000 Вт</span> Philips
            GreenPower / Gavita — дёшево, но 60% энергии в тепло.{" "}
            <span className="text-yellow-200">LED</span> Philips
            GreenPower Toplighting, Heliospectra, Valoya — точный спектр
            (красный 660 нм / синий 450 нм), <span className="text-yellow-200">экономия 30–50%</span> электроэнергии.
          </p>
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <div className="bg-slate-950/40 border border-slate-800 rounded p-3">
              <div className="text-yellow-200 font-medium">HPS</div>
              <div className="text-slate-400 mt-1">
                Цена 6–10 тыс. тг/м² · 1.7–2.0 мкмоль/Дж · ресурс 10 000 ч
              </div>
            </div>
            <div className="bg-slate-950/40 border border-slate-800 rounded p-3">
              <div className="text-yellow-200 font-medium">LED</div>
              <div className="text-slate-400 mt-1">
                Цена 18–32 тыс. тг/м² · 2.8–3.6 мкмоль/Дж · ресурс 50 000 ч
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 5 — Овощехранилища РГС */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-blue-300">
            5. Овощехранилища с РГС
          </h2>
          <p className="text-slate-300 leading-relaxed">
            Регулируемая газовая среда (РГС / CA storage) даёт хранение яблока
            до <span className="text-blue-200">10 месяцев</span> без потери
            тургора и аромата. Условия:{" "}
            <span className="text-blue-200">O₂ 1–3%, CO₂ 3–5%, t° = 0–2°C, RH = 90–95%</span>.
            Камеры герметичные (утечка ≤ 0.1%/сут), уплотнение Gastite или ПВХ
            мембрана 1.5 мм.
          </p>
          <ul className="text-sm text-slate-400 list-disc list-inside space-y-1">
            <li>Холодильные машины Bitzer / Bock / Sabroe, хладагент R449A / R744 (CO₂).</li>
            <li>Азотные мембраны Parker / Air Products — генератор N₂ из атмосферы.</li>
            <li>Скрубберы CO₂ — известковый или молекулярные сита.</li>
            <li>Ёмкость камеры РГС: 200–800 т / контейнер; модульная сборка.</li>
            <li>Цена «под ключ» — <span className="text-blue-200">35–55 тыс. тг/т</span> единовременной ёмкости.</li>
          </ul>
        </section>

        {/* SECTION 6 — Элеваторы */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-amber-300">
            6. Зерновые элеваторы
          </h2>
          <p className="text-slate-300 leading-relaxed">
            Силосные банки: сборные оцинкованные{" "}
            <span className="text-amber-200">SCAFCO / Brock / GSI / AGI</span> либо
            монолитные ж/б. Диаметр{" "}
            <span className="text-amber-200">Ø 6–12 м</span>, высота{" "}
            <span className="text-amber-200">H = 20–30 м</span>, ёмкость одной
            банки 600–3500 т. Пропускная способность башни{" "}
            <span className="text-amber-200">200–500 т/ч</span>.
          </p>
          <ul className="text-sm text-slate-400 list-disc list-inside space-y-1">
            <li>Норийная башня — нории Riela / Cimbria, скорость 2.5–4 м/с.</li>
            <li>Аспирация — циклоны UCY, рукавные фильтры (взрывобезопасность ATEX).</li>
            <li>Сушка зерна — шахтные сушилки Petkus / Bühler 30–80 т/ч.</li>
            <li>Очистка — сепараторы БИС-100, БЦС, триеры цилиндрические.</li>
            <li>Бенчмарк строительства: <span className="text-amber-200">22–35 тыс. тг/т</span> ёмкости элеватора.</li>
          </ul>
        </section>

        {/* SECTION 7 — Молочные комплексы */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-rose-300">
            7. Молочно-товарные фермы (МТФ)
          </h2>
          <p className="text-slate-300 leading-relaxed">
            Современный стандарт — беспривязное содержание на матах /
            подстилке, объёмные коровники 24–32 м ширина × 90–180 м длина,
            кубарь (boxstall) 1.25 × 2.5 м на голову. По СН РК 3.06-23
            нормативы по микроклимату, навозоудалению, освещённости.
          </p>
          <ul className="text-sm text-slate-400 list-disc list-inside space-y-1">
            <li>Доильные роботы <span className="text-rose-200">Lely Astronaut A5 / DeLaval VMS V300</span> — 60–70 голов на робот.</li>
            <li>Доильные залы «Ёлочка» 2×12, «Параллель» 2×24, «Карусель» 60–80 мест.</li>
            <li>Лагуны навозохранения с ПЭ мембраной 1.5 мм, объём 8–12 м³/голову.</li>
            <li>Кормосмеси TMR — миксер кормораздатчик Trioliet / DeLaval / Storti.</li>
            <li>Стоимость стойломеста «под ключ»: <span className="text-rose-200">3.5–6 млн тг/голову</span> (с роботами 6–9).</li>
          </ul>
        </section>

        {/* SECTION 8 — Птицефабрики */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-orange-300">
            8. Птицефабрики
          </h2>
          <p className="text-slate-300 leading-relaxed">
            СН РК 3.06-26. Клеточное содержание (яичное) или напольное
            (бройлер) — современный стандарт. Корпус 18–24 м ширина × 96–144 м
            длина, ёмкость 30–60 тыс. голов. Вентиляция отрицательного
            давления (тоннель), приточные клапаны Munters / SKOV / Fancom.
          </p>
          <ul className="text-sm text-slate-400 list-disc list-inside space-y-1">
            <li>Кормораздача — спираль NorthBrook / Big Dutchman / Roxell, бункеры по 10–25 т.</li>
            <li>Поение — ниппельные системы Plasson / Lubing с регуляторами.</li>
            <li>Подогрев — газовые брудеры Cumberland AGC, инфракрасные.</li>
            <li>Подстилка — древесная стружка / лузга подсолнечника 7–10 см.</li>
            <li>Бенчмарк: <span className="text-orange-200">2.8–4.5 тыс. тг/голову</span> мощности бройлерника (одноразовая посадка).</li>
          </ul>
        </section>

        {/* SECTION 9 — Бенчмарки РК */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-teal-300">
            9. Бенчмарки реализованных АПК-объектов РК
          </h2>
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <div className="bg-slate-950/40 border border-slate-800 rounded p-3">
              <div className="text-teal-200 font-medium">Green Capital (Алматинская обл.)</div>
              <div className="text-slate-400 mt-1">
                Тепличный комплекс 60 га, томат/огурец, голландская Venlo
                Certhon, досветка LED. Стоимость ≈ 4.2 млрд тг.
              </div>
            </div>
            <div className="bg-slate-950/40 border border-slate-800 rounded p-3">
              <div className="text-teal-200 font-medium">Иволга-Холдинг (Кустанай)</div>
              <div className="text-slate-400 mt-1">
                Элеватор 200 тыс. т ёмкости, силосы SCAFCO Ø 12 м H = 25 м,
                сушилки Petkus.
              </div>
            </div>
            <div className="bg-slate-950/40 border border-slate-800 rounded p-3">
              <div className="text-teal-200 font-medium">НПК Айдабол (СКО)</div>
              <div className="text-slate-400 mt-1">
                Элеватор и комбикормовый завод, ёмкость 150 тыс. т, аспирация ATEX.
              </div>
            </div>
            <div className="bg-slate-950/40 border border-slate-800 rounded p-3">
              <div className="text-teal-200 font-medium">Зенченко и К (СКО)</div>
              <div className="text-slate-400 mt-1">
                Молочный комплекс на 4 500 голов, доильные залы Карусель 60,
                лагуны 280 тыс. м³.
              </div>
            </div>
          </div>
        </section>

        {/* EXERCISES */}
        <section className="bg-gradient-to-br from-emerald-950/50 to-slate-900/40 border border-emerald-900/40 rounded-xl p-6 space-y-6">
          <h2 className="text-2xl font-bold text-emerald-200">
            ✏️ Практика: 4 упражнения
          </h2>

          {/* EX1 */}
          <div className="space-y-2">
            <div className="font-medium text-slate-100">
              1. Какая высота промышленной теплицы Venlo (до водостока)?
            </div>
            {[
              ["a", "3–4 м"],
              ["b", "4–5 м"],
              ["c", "6–7 м"],
              ["d", "10–12 м"],
            ].map(([k, v]) => (
              <button
                key={k}
                onClick={() => setEx1(k)}
                className={`block w-full text-left px-3 py-2 rounded border transition text-sm ${
                  ex1 === k
                    ? k === "c"
                      ? "bg-emerald-900/40 border-emerald-600 text-emerald-100"
                      : "bg-rose-900/30 border-rose-700 text-rose-100"
                    : "bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-600"
                }`}
              >
                {k}) {v}
              </button>
            ))}
            {ex1 && (
              <div
                className={`text-sm ${
                  ex1 === "c" ? "text-emerald-300" : "text-rose-300"
                }`}
              >
                {ex1 === "c"
                  ? "✓ Верно. Venlo стандарт — 6–7 м до водостока, для CO₂-стратификации и циркуляции."
                  : "✗ Правильно: c) 6–7 м. Высокая теплица даёт стабильный микроклимат."}
              </div>
            )}
          </div>

          {/* EX2 */}
          <div className="space-y-2">
            <div className="font-medium text-slate-100">
              2. Какие параметры регулируемой газовой среды для длительного
              хранения яблок?
            </div>
            {[
              ["a", "O₂ 20%, t° +5°C (как в холодильнике)"],
              ["b", "O₂ 1–3%, CO₂ 3–5%, t° = 0–2°C, RH = 90–95%"],
              ["c", "Только холод t° = −2°C, без газов"],
              ["d", "Азот 100%, без кислорода"],
            ].map(([k, v]) => (
              <button
                key={k}
                onClick={() => setEx2(k)}
                className={`block w-full text-left px-3 py-2 rounded border transition text-sm ${
                  ex2 === k
                    ? k === "b"
                      ? "bg-emerald-900/40 border-emerald-600 text-emerald-100"
                      : "bg-rose-900/30 border-rose-700 text-rose-100"
                    : "bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-600"
                }`}
              >
                {k}) {v}
              </button>
            ))}
            {ex2 && (
              <div
                className={`text-sm ${
                  ex2 === "b" ? "text-emerald-300" : "text-rose-300"
                }`}
              >
                {ex2 === "b"
                  ? "✓ Верно. РГС: пониженный O₂ замедляет дыхание плодов, CO₂ ингибирует этилен."
                  : "✗ Правильно: b) O₂ 1–3%, CO₂ 3–5%, t° = 0–2°C. Это и есть Controlled Atmosphere storage."}
              </div>
            )}
          </div>

          {/* EX3 */}
          <div className="space-y-2">
            <div className="font-medium text-slate-100">
              3. Рассчитайте стоимость теплицы 60 га при бенчмарке 70 млн тг/га
              (в тенге).
            </div>
            <div className="text-xs text-slate-500">
              Подсказка: 60 × 70 000 000 = ?
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={ex3}
                onChange={(e) => {
                  setEx3(e.target.value);
                  setEx3Checked(false);
                }}
                placeholder="введите сумму в тенге"
                className="flex-1 px-3 py-2 rounded bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-600"
              />
              <button
                onClick={() => setEx3Checked(true)}
                className="px-4 py-2 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium transition"
              >
                Проверить
              </button>
            </div>
            {ex3Checked && (
              <div
                className={`text-sm ${
                  ex3Correct ? "text-emerald-300" : "text-rose-300"
                }`}
              >
                {ex3Correct
                  ? "✓ Верно (~4.2 млрд тг). Реальный кейс Green Capital — именно такого порядка."
                  : "✗ Правильный ответ: 4 200 000 000 тг (4.2 млрд тг). Допуск ±300 млн."}
              </div>
            )}
          </div>

          {/* EX4 */}
          <div className="space-y-2">
            <div className="font-medium text-slate-100">
              4. Что даёт LED-досветка в теплице по сравнению с HPS?
            </div>
            {[
              ["a", "Ничего, только маркетинг"],
              ["b", "Только дешевле в закупке"],
              ["c", "Только белый свет"],
              [
                "d",
                "Точный спектр (красный/синий), экономия 30–50% электроэнергии, меньше тепла",
              ],
            ].map(([k, v]) => (
              <button
                key={k}
                onClick={() => setEx4(k)}
                className={`block w-full text-left px-3 py-2 rounded border transition text-sm ${
                  ex4 === k
                    ? k === "d"
                      ? "bg-emerald-900/40 border-emerald-600 text-emerald-100"
                      : "bg-rose-900/30 border-rose-700 text-rose-100"
                    : "bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-600"
                }`}
              >
                {k}) {v}
              </button>
            ))}
            {ex4 && (
              <div
                className={`text-sm ${
                  ex4 === "d" ? "text-emerald-300" : "text-rose-300"
                }`}
              >
                {ex4 === "d"
                  ? "✓ Верно. LED дороже в закупке, но окупается за 2–4 года за счёт электроэнергии и точного спектра."
                  : "✗ Правильно: d) Точный спектр, экономия 30–50% электроэнергии, меньше тепловой нагрузки на климат."}
              </div>
            )}
          </div>
        </section>

        {/* FOOTER NAV */}
        <section className="flex justify-between items-center pt-4 border-t border-slate-800">
          <Link
            href="/smeta-trainer/drawings-practice"
            className="text-sm text-slate-400 hover:text-slate-200 transition"
          >
            ← Все модули
          </Link>
          <div className="text-xs text-slate-600">
            Модуль #180 · AEVION Smeta Trainer
          </div>
        </section>
      </main>
    </div>
  );
}
