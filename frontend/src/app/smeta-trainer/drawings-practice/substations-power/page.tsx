"use client";
import Link from "next/link";
import { useState } from "react";

export default function SubstationsPowerPage() {
  const [ex1, setEx1] = useState<string | null>(null);
  const [ex2, setEx2] = useState<string | null>(null);
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);

  const ex1Correct = "b";
  const ex2Correct = "c";
  const ex3Target = 17_000_000_000;
  const ex3Tolerance = 2_000_000_000;
  const ex4Correct = "d";

  const ex3Num = parseFloat(ex3.replace(/[,\s]/g, "").replace(/_/g, ""));
  const ex3Ok = !isNaN(ex3Num) && Math.abs(ex3Num - ex3Target) <= ex3Tolerance;

  const score =
    (ex1 === ex1Correct ? 1 : 0) +
    (ex2 === ex2Correct ? 1 : 0) +
    (ex3Ok ? 1 : 0) +
    (ex4 === ex4Correct ? 1 : 0);

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
            AEVION Smeta Trainer · Подстанции 110-1150 кВ
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            ⚡ Подстанции 110-1150 кВ
          </h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Электрические подстанции — ключевые узлы Единой национальной электросети РК (KEGOC).
            Модуль покрывает классификацию ПС, силовые трансформаторы, РУ (ОРУ/ЗРУ/КРУЭ),
            элегазовые выключатели, защиту РЗА, заземление и молниезащиту, общеподстанционные
            здания и бенчмарки сметной стоимости по РК для класса напряжения 110-1150 кВ.
          </p>
        </section>

        {/* Section 1: Классификация ПС */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-amber-300">
            1. Классификация подстанций
          </h2>
          <p className="text-slate-300 text-sm">
            <span className="text-slate-100 font-semibold">По напряжению:</span> 6 / 10 / 35 /
            110 / 220 / 330 / 500 / 750 / 1150 кВ. Высший класс в РК — 1150 кВ (транзит
            Север-Юг: Экибастуз — Кокшетау — Костанай).
          </p>
          <ul className="text-sm text-slate-400 list-disc list-inside space-y-1">
            <li>
              <span className="text-slate-200">ОРУ</span> — открытое распределительное
              устройство (под открытым небом, оборудование на опорах)
            </li>
            <li>
              <span className="text-slate-200">ЗРУ</span> — закрытое распределительное
              устройство (внутри здания, для городских ПС и сурового климата)
            </li>
            <li>
              <span className="text-slate-200">КРУЭ</span> — комплектное распред. устройство с
              элегазовой изоляцией SF₆ (compact gas-insulated switchgear)
            </li>
          </ul>
          <p className="text-slate-300 text-sm">
            <span className="text-slate-100 font-semibold">По назначению:</span> понизительные
            (от ВЛ к потребителю), повысительные (от генератора в сеть),
            транзитные/переключательные (узловые).
          </p>
        </section>

        {/* Section 2: Силовые трансформаторы */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-amber-300">
            2. Силовые трансформаторы
          </h2>
          <ul className="text-sm text-slate-400 list-disc list-inside space-y-1">
            <li>
              <span className="text-slate-200">ТРДЦН-250000/220</span> — трёхфазный с
              расщеплённой обмоткой, дутьевое охлаждение, 250 МВА, 220 кВ
            </li>
            <li>
              <span className="text-slate-200">АТДЦТН-250000/500</span> — автотрансформатор
              трёхфазный, дутьевое + циркуляционное охлаждение, 500 кВ
            </li>
            <li>
              <span className="text-slate-200">АОДЦТН-417000/1150</span> — однофазный
              автотрансформатор для класса 1150 кВ (KEGOC)
            </li>
          </ul>
          <p className="text-slate-300 text-sm">
            <span className="text-slate-100 font-semibold">Системы охлаждения:</span> ONAN
            (естеств. масляное + естеств. возд.), ONAF (с дутьём), OFAF (форсированное масло +
            дутьё), ODAF (направленное масло + дутьё).
          </p>
          <p className="text-slate-300 text-sm">
            <span className="text-slate-100 font-semibold">Заводы РК / производство:</span>{" "}
            Кентауский трансформаторный завод, Hyundai HEC (южнокорейский, поставки в РК).
          </p>
          <p className="text-slate-300 text-sm">
            <span className="text-slate-100 font-semibold">Бенчмарк цены:</span> ТДТН-25000/110
            = <span className="text-emerald-300">380-580 млн тг</span> (масляный, с
            расширительным баком).
          </p>
        </section>

        {/* Section 3: РУ — ОРУ и КРУЭ */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-amber-300">
            3. Распределительные устройства (ОРУ / КРУЭ)
          </h2>
          <p className="text-slate-300 text-sm">
            <span className="text-slate-100 font-semibold">ОРУ 110-500 кВ:</span> сборные
            шинопроводы (алюминиевые/сталеалюминиевые), П-образные и портальные опоры,
            разъединители <span className="text-slate-200">РНДЗ</span> (наружные), элегазовые
            выключатели <span className="text-slate-200">ВГБ-110 / 220 / 500</span>.
          </p>
          <p className="text-slate-300 text-sm">
            <span className="text-slate-100 font-semibold">КРУЭ:</span> компактная компоновка
            в SF₆-камерах — ABB ELK, Siemens 8DN8 / 8DQ1, Areva (GE) — для городских и горных
            ПС, где недостаточно площадки для ОРУ.
          </p>
        </section>

        {/* Section 4: Выключатели */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-amber-300">4. Выключатели</h2>
          <ul className="text-sm text-slate-400 list-disc list-inside space-y-1">
            <li>
              <span className="text-slate-200">Масляные</span> — устаревшие, замещаются
            </li>
            <li>
              <span className="text-slate-200">Элегазовые SF₆</span> — основные для 110+ кВ:
              ABB LTB / HPL, Siemens 3AP, GE GL
            </li>
            <li>
              <span className="text-slate-200">Вакуумные</span> — 6-35 кВ, ремонтопригодные
            </li>
            <li>
              <span className="text-slate-200">Воздушные</span> — устаревшие, для специальных
              задач
            </li>
          </ul>
          <p className="text-slate-300 text-sm">
            <span className="text-slate-100 font-semibold">Отключающая способность:</span>{" "}
            50-80 кА для класса 110-500 кВ.
          </p>
        </section>

        {/* Section 5: РЗА */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-amber-300">
            5. Релейная защита и автоматика (РЗА)
          </h2>
          <ul className="text-sm text-slate-400 list-disc list-inside space-y-1">
            <li>
              <span className="text-slate-200">Siemens SIPROTEC 5</span> — цифровые терминалы
            </li>
            <li>
              <span className="text-slate-200">GE Multilin</span> — T60 (трансформаторная),
              D60 (дистанционная), F60 (фидерная)
            </li>
            <li>
              <span className="text-slate-200">ABB REL / REF / RET</span> — линейная,
              фидерная, трансформаторная защиты
            </li>
            <li>
              <span className="text-slate-200">Виды защит:</span> дифференциальная,
              дистанционная, токовая (МТЗ), АПВ (автоматич. повторное включение), АЧР
              (автоматич. частотная разгрузка)
            </li>
          </ul>
        </section>

        {/* Section 6: Заземление и молниезащита */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-amber-300">
            6. Заземление и молниезащита
          </h2>
          <p className="text-slate-300 text-sm">
            Контур заземления — горячецинкованная сталь{" "}
            <span className="text-slate-200">⌀ 12-16 мм</span>, заглубление{" "}
            <span className="text-slate-200">0.5-0.8 м</span>. Норма{" "}
            <span className="text-emerald-300">R ≤ 0.5 Ом</span> для ПС 110+ кВ.
            Молниеотводы — стержневые и тросовые согласно{" "}
            <span className="text-slate-200">СН РК 3.04-01</span>.
          </p>
        </section>

        {/* Section 7: ОПУ, маслохозяйство, аккумуляторные */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-amber-300">
            7. Здания ОПУ, маслохозяйство, аккумуляторные
          </h2>
          <ul className="text-sm text-slate-400 list-disc list-inside space-y-1">
            <li>
              <span className="text-slate-200">ОПУ</span> — общеподстанционный пункт
              управления (щиты, СКАДА, связь, охрана)
            </li>
            <li>
              <span className="text-slate-200">Компрессорная</span> — воздух для пневмо-
              приводов и продувки КРУЭ
            </li>
            <li>
              <span className="text-slate-200">Маслохозяйство</span> — маслоприёмные ямы
              ёмкостью <span className="text-emerald-300">110% объёма масла</span> наибольшего
              трансформатора (норма пожаробезопасности)
            </li>
            <li>
              <span className="text-slate-200">Аккумуляторная</span> — DC шины 110 / 220 В для
              оперативного тока РЗА и приводов
            </li>
          </ul>
        </section>

        {/* Section 8: КРУЭ vs ОРУ */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-amber-300">8. КРУЭ vs ОРУ</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-200 border-b border-slate-700">
                  <th className="text-left py-2 pr-4">Параметр</th>
                  <th className="text-left py-2 pr-4">ОРУ</th>
                  <th className="text-left py-2 pr-4">КРУЭ</th>
                </tr>
              </thead>
              <tbody className="text-slate-400">
                <tr className="border-b border-slate-800">
                  <td className="py-2 pr-4">Площадь</td>
                  <td className="py-2 pr-4">×1 (база)</td>
                  <td className="py-2 pr-4 text-emerald-300">×0.10 - ×0.12</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="py-2 pr-4">Стоимость</td>
                  <td className="py-2 pr-4">×1 (база)</td>
                  <td className="py-2 pr-4 text-amber-300">×2 - ×4</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="py-2 pr-4">Климат</td>
                  <td className="py-2 pr-4">Любой</td>
                  <td className="py-2 pr-4">Город, горы, тесные площадки</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Производители</td>
                  <td className="py-2 pr-4">Любые</td>
                  <td className="py-2 pr-4">ABB ELK, Siemens 8DN8</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 9: Бенчмарки РК */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-amber-300">
            9. Бенчмарки РК (KEGOC, НЭС)
          </h2>
          <ul className="text-sm text-slate-400 list-disc list-inside space-y-1">
            <li>
              <span className="text-slate-200">KEGOC НЭС:</span> 25 ПС 500 кВ + 4 ПС 1150 кВ
              на транзите Север-Юг (Экибастуз — Кокшетау — Костанай)
            </li>
            <li>
              <span className="text-slate-200">Передача Север-Юг:</span> до 1500 МВт
            </li>
            <li>
              <span className="text-slate-200">ПС 500 кВ:</span>{" "}
              <span className="text-emerald-300">12-22 млрд тг</span> (среднее ~17 млрд тг)
            </li>
            <li>
              <span className="text-slate-200">ПС 220 кВ:</span>{" "}
              <span className="text-emerald-300">5-9 млрд тг</span>
            </li>
          </ul>
        </section>

        {/* Exercises */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-6">
          <h2 className="text-2xl font-bold text-slate-50">Практика</h2>

          {/* Ex1 */}
          <div className="space-y-2">
            <p className="text-slate-200 font-semibold">
              1. Какое самое высокое напряжение в Единой национальной электросети РК?
            </p>
            <div className="space-y-1 text-sm">
              {[
                { k: "a", t: "500 кВ" },
                { k: "b", t: "1150 кВ (4 ПС на транзите Север-Юг)" },
                { k: "c", t: "220 кВ" },
                { k: "d", t: "750 кВ" },
              ].map((o) => (
                <label
                  key={o.k}
                  className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-slate-100"
                >
                  <input
                    type="radio"
                    name="ex1"
                    value={o.k}
                    checked={ex1 === o.k}
                    onChange={() => setEx1(o.k)}
                    className="accent-amber-400"
                  />
                  <span>
                    {o.k}) {o.t}
                  </span>
                </label>
              ))}
            </div>
            {showResults && (
              <p
                className={
                  ex1 === ex1Correct ? "text-emerald-400 text-sm" : "text-rose-400 text-sm"
                }
              >
                {ex1 === ex1Correct
                  ? "✓ Верно — 1150 кВ, транзит Север-Юг"
                  : "✗ Правильно: b) 1150 кВ"}
              </p>
            )}
          </div>

          {/* Ex2 */}
          <div className="space-y-2">
            <p className="text-slate-200 font-semibold">2. Что такое КРУЭ?</p>
            <div className="space-y-1 text-sm">
              {[
                { k: "a", t: "Котловое распределительное устройство" },
                { k: "b", t: "Кабельное распределительное устройство" },
                {
                  k: "c",
                  t: "Комплектное распред. устройство с элегазовой изоляцией SF₆ — компактная компоновка",
                },
                { k: "d", t: "Капсульное реакторное устройство" },
              ].map((o) => (
                <label
                  key={o.k}
                  className="flex items-start gap-2 cursor-pointer text-slate-300 hover:text-slate-100"
                >
                  <input
                    type="radio"
                    name="ex2"
                    value={o.k}
                    checked={ex2 === o.k}
                    onChange={() => setEx2(o.k)}
                    className="accent-amber-400 mt-1"
                  />
                  <span>
                    {o.k}) {o.t}
                  </span>
                </label>
              ))}
            </div>
            {showResults && (
              <p
                className={
                  ex2 === ex2Correct ? "text-emerald-400 text-sm" : "text-rose-400 text-sm"
                }
              >
                {ex2 === ex2Correct
                  ? "✓ Верно — gas-insulated switchgear (GIS)"
                  : "✗ Правильно: c) Комплектное РУ с элегазом SF₆"}
              </p>
            )}
          </div>

          {/* Ex3 */}
          <div className="space-y-2">
            <p className="text-slate-200 font-semibold">
              3. Новая подстанция 500/220/110 кВ. Сметная стоимость по среднему бенчмарку РК
              (KEGOC)? Введите сумму в тенге (например 17000000000 для 17 млрд тг).
            </p>
            <input
              type="text"
              inputMode="numeric"
              value={ex3}
              onChange={(e) => setEx3(e.target.value)}
              placeholder="17000000000"
              className="w-full md:w-80 px-3 py-2 rounded-md bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
            {showResults && (
              <p
                className={
                  ex3Ok ? "text-emerald-400 text-sm" : "text-rose-400 text-sm"
                }
              >
                {ex3Ok
                  ? "✓ Верно — около 17 млрд тг (диапазон 12-22 млрд тг для ПС 500 кВ)"
                  : "✗ Правильно: ~17 000 000 000 тг (диапазон 12-22 млрд тг)"}
              </p>
            )}
          </div>

          {/* Ex4 */}
          <div className="space-y-2">
            <p className="text-slate-200 font-semibold">
              4. Какой набор защит РЗА штатно применяется для линии 220 кВ?
            </p>
            <div className="space-y-1 text-sm">
              {[
                { k: "a", t: "только токовая отсечка" },
                { k: "b", t: "только МТЗ" },
                { k: "c", t: "только дистанционная" },
                {
                  k: "d",
                  t: "дифференциальная + дистанционная + АПВ + резервная токовая",
                },
              ].map((o) => (
                <label
                  key={o.k}
                  className="flex items-start gap-2 cursor-pointer text-slate-300 hover:text-slate-100"
                >
                  <input
                    type="radio"
                    name="ex4"
                    value={o.k}
                    checked={ex4 === o.k}
                    onChange={() => setEx4(o.k)}
                    className="accent-amber-400 mt-1"
                  />
                  <span>
                    {o.k}) {o.t}
                  </span>
                </label>
              ))}
            </div>
            {showResults && (
              <p
                className={
                  ex4 === ex4Correct ? "text-emerald-400 text-sm" : "text-rose-400 text-sm"
                }
              >
                {ex4 === ex4Correct
                  ? "✓ Верно — полный комплект: основная дифф. + дистанц. + АПВ + резервная"
                  : "✗ Правильно: d) дифференциальная + дистанционная + АПВ + резервная"}
              </p>
            )}
          </div>

          <div className="flex items-center gap-4 pt-2">
            <button
              onClick={() => setShowResults(true)}
              className="px-5 py-2 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold transition"
            >
              Проверить
            </button>
            {showResults && (
              <span className="text-slate-300">
                Результат:{" "}
                <span className="text-amber-300 font-bold">{score} / 4</span>
              </span>
            )}
          </div>
        </section>

        <section className="text-center pt-4">
          <Link
            href="/smeta-trainer/drawings-practice"
            className="inline-block px-6 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 transition"
          >
            ← Назад к разделам
          </Link>
        </section>
      </main>
    </div>
  );
}
