"use client";
import Link from "next/link";
import { useState } from "react";

export default function MetallurgyPlantsPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [show, setShow] = useState<boolean>(false);

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Ok = !isNaN(ex3Num) && Math.abs(ex3Num - 350_000_000_000) <= 30_000_000_000;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300 hover:text-blue-200 transition">← К разделам</Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Металлургические заводы</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🏭 Металлургические заводы</h1>
          <p className="mt-3 text-slate-400 max-w-4xl leading-relaxed">
            Модуль #193. Металлургические заводы — крупнейшие промышленные объекты с непрерывным циклом
            производства чёрных и цветных металлов. В Казахстане работают АрселорМиттал Темиртау (АМТ),
            Казахмыс, Казцинк, Алюминий Казахстана, Аксуский ферросплавный завод (КЭЗ), KAZ Minerals.
            Сметчик должен понимать огнеупорные футеровки, газоочистку, водоохлаждение, электроснабжение
            на десятки МВА и специфические нормы ССЦ РК для металлургических объектов.
          </p>
        </section>

        {/* Section 1: Полный цикл чёрной металлургии */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-amber-300">1. Чёрная металлургия — полный цикл</h2>
          <p className="mt-2 text-slate-300 leading-relaxed">
            Полный передел железной руды в сталь идёт по цепочке: ГОК (горно-обогатительный комбинат) →
            аглофабрика (агломерация мелочи) → коксохимическое производство (КХП) → доменная печь
            (производство чугуна) → кислородный конвертер BOF или электропечь EAF (производство стали) →
            МНЛЗ (машина непрерывного литья заготовок) → прокатные станы (горячая и холодная прокатка).
          </p>
          <ul className="mt-3 text-sm text-slate-400 space-y-1 list-disc list-inside">
            <li>Аглофабрика: спекание руды и флюсов на конвейерных машинах, агломерат — основное сырьё домны</li>
            <li>Коксохимия: коксовые батареи на 50-80 печей, кокс для доменного процесса</li>
            <li>Передельный цикл: руда → чугун → сталь → прокат, тысячи тонн в сутки</li>
          </ul>
        </section>

        {/* Section 2: Доменная печь */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-orange-300">2. Доменная печь</h2>
          <p className="mt-2 text-slate-300 leading-relaxed">
            Доменная печь — высота 30-40 м, полезный объём 2000-5000 м³, выпуск чугуна 8000-15000 т/сутки.
            Загрузка сверху агломератом, коксом и флюсами; дутьё снизу подогретым воздухом (1100-1200°C)
            через фурмы. Огнеупорная футеровка — периклаз-углеродистый кирпич, водоохлаждаемые холодильники
            (плиты с медными трубками), кампания печи 15-20 лет между капремонтами.
          </p>
          <ul className="mt-3 text-sm text-slate-400 space-y-1 list-disc list-inside">
            <li>Воздухонагреватели (каупера): 3-4 регенератора Ø8-10 м, греют дутьё до 1100-1200°C</li>
            <li>Колошниковый газ: очистка скруббером и электрофильтром, ценное топливо для прокатки</li>
            <li>Литейный двор: чугуновозы и шлаковозы, выпуск каждые 1-2 часа</li>
            <li>Засыпной аппарат: бесконусный лотковый (Paul Wurth) или конусный двухконусный</li>
          </ul>
        </section>

        {/* Section 3: Кислородный конвертер BOF */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-rose-300">3. Кислородный конвертер (BOF — Basic Oxygen Furnace)</h2>
          <p className="mt-2 text-slate-300 leading-relaxed">
            BOF — кислородный конвертер ёмкостью 250-380 т плавка, цикл 35-45 минут. Жидкий чугун из домны
            заливается в грушевидный сосуд с огнеупорной футеровкой; через водоохлаждаемую фурму сверху
            подаётся технический кислород 2-2.5 МПа (99.5%). Углерод чугуна окисляется до CO/CO₂, шлак
            формируется добавкой извести (CaO). На выходе — сталь с C &lt; 0.1% и шлак.
          </p>
          <ul className="mt-3 text-sm text-slate-400 space-y-1 list-disc list-inside">
            <li>Газоотводящий тракт: котёл-утилизатор + газоочистка (мокрая или сухая)</li>
            <li>Кислородная станция: производительность 50-100 тыс. м³/ч O₂</li>
            <li>Футеровка: смолодоломитовый кирпич, стойкость 2500-5000 плавок</li>
          </ul>
        </section>

        {/* Section 4: Электропечь EAF */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-yellow-300">4. Электродуговая печь (EAF — Electric Arc Furnace)</h2>
          <p className="mt-2 text-slate-300 leading-relaxed">
            EAF — дуговая печь 100-200 т, плавит металлолом или губчатое железо DRI (Direct Reduced Iron).
            Три графитовых электрода Ø600-700 мм опускаются сверху, дуга между электродом и шихтой даёт
            температуру &gt; 3000°C. Мощность печного трансформатора 100-200 МВА, удельный расход
            электроэнергии 380-450 кВт·ч/т. Цикл tap-to-tap 45-60 мин. Основа мини-заводов.
          </p>
          <ul className="mt-3 text-sm text-slate-400 space-y-1 list-disc list-inside">
            <li>Электроды: расход 1.5-2 кг/т стали, наращиваются по мере выгорания</li>
            <li>Эркер (EBT — Eccentric Bottom Tapping): донный выпуск без шлака</li>
            <li>Газоотсос: dog house + рукавные фильтры, пыль 15-25 кг/т (ценная Zn/Pb)</li>
            <li>Кислородные фурмы и горелки: интенсификация плавки</li>
          </ul>
        </section>

        {/* Section 5: МНЛЗ */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-cyan-300">5. МНЛЗ — машина непрерывного литья заготовок</h2>
          <p className="mt-2 text-slate-300 leading-relaxed">
            МНЛЗ заменяет разливку в изложницы: жидкая сталь из сталь-ковша через промковш поступает в
            медный водоохлаждаемый кристаллизатор, формирует корочку, затем — тянущие ролики, зона
            вторичного охлаждения (форсунки воды и воздуха), газокислородная резка на мерные длины.
            Длина агрегата 30-50 м, скорость литья 1-3 м/мин для слябов толщиной 200-300 мм.
          </p>
          <ul className="mt-3 text-sm text-slate-400 space-y-1 list-disc list-inside">
            <li>Слябовые (плоский прокат), сортовые (балки/арматура), блюмовые (крупное сечение)</li>
            <li>Криволинейная или вертикально-изогнутая компоновка, радиус 8-12 м</li>
            <li>Промковш: огнеупорный, разделяет потоки, шлакообразующая смесь (ШОС)</li>
            <li>Электромагнитное перемешивание (EMS) — улучшение структуры заготовки</li>
          </ul>
        </section>

        {/* Section 6: Прокатные станы */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-blue-300">6. Прокатные станы</h2>
          <p className="mt-2 text-slate-300 leading-relaxed">
            Горячая прокатка: сляб 250 мм греется в методической печи до 1200-1250°C, затем реверсивная
            черновая клеть (1-2 прохода) и непрерывная чистовая группа (6-7 клетей) — выход горячекатаный
            рулон 1.5-25 мм. Холодная прокатка: травление в HCl, 4-5 клетей кварто, толщина 0.18-3 мм,
            рекристаллизационный отжиг в колпаковых печах. Финиш — оцинковка (горячая или электролитическая),
            лужение, дрессировка, нанесение покрытий.
          </p>
          <ul className="mt-3 text-sm text-slate-400 space-y-1 list-disc list-inside">
            <li>Hot strip mill (HSM): производительность 4-5 млн т/год</li>
            <li>Сортовые: арматура, балки, уголки, швеллер (А500С, А600С — ГОСТ)</li>
            <li>Линия горячего цинкования: ванна Zn 460°C, толщина покрытия 100-275 г/м²</li>
          </ul>
        </section>

        {/* Section 7: Цветная металлургия РК */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-emerald-300">7. Цветная металлургия Казахстана</h2>
          <p className="mt-2 text-slate-300 leading-relaxed">
            РК — лидер по цветной металлургии в СНГ. Казцинк (Усть-Каменогорск) — цинк и свинец, шахтные
            и взвешенной плавки печи Imperial Smelting (ISP), вельц-печи. Казахмыс (Жезказган, Балхаш) —
            медь, флэш-печи Outotec, конвертеры Пирса-Смита, анодная плавка, электролитическое рафинирование.
            Алюминий Казахстана: Павлодарский глинозёмный (Al₂O₃ методом Байера) + ЭГПК (Экибастуз) —
            электролиз глинозёма в криолит-глинозёмном расплаве при 950°C, ванны 300-500 кА.
          </p>
          <ul className="mt-3 text-sm text-slate-400 space-y-1 list-disc list-inside">
            <li>KAZ Minerals — Бозшаколь и Актогай, открытая добыча и обогатительные фабрики меди</li>
            <li>Электролиз Al: анод предобожжённый или Содерберга, удельный расход 13-14 МВт·ч/т Al</li>
            <li>Конвертер Пирса-Смита: горизонтальный для штейна Cu, продувка воздухом обогащённым O₂</li>
          </ul>
        </section>

        {/* Section 8: Ферросплавы */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-violet-300">8. Ферросплавы</h2>
          <p className="mt-2 text-slate-300 leading-relaxed">
            Аксуский завод ферросплавов (КЭЗ, г. Аксу) — крупнейший в мире производитель феррохрома и
            ферросилиция. Таразский металлургический завод — ферросиликомарганец и силикомарганец.
            Технология — руднотермические закрытые электропечи (РТП) мощностью 30-80 МВА, графитовые
            самоспекающиеся электроды Ø1.5-2.0 м (Содерберга). Шихта: хромит/кварцит/марганцевая руда +
            кокс + железная стружка. Газоочистка — циклоны + рукавные фильтры.
          </p>
          <ul className="mt-3 text-sm text-slate-400 space-y-1 list-disc list-inside">
            <li>FeCr (феррохром): С &gt; 60%, для нержавеющих сталей</li>
            <li>FeSi (ферросилиций): 45/65/75% Si, раскислитель стали</li>
            <li>Расход электроэнергии 3500-9000 кВт·ч/т сплава, отсюда привязка к ТЭС</li>
          </ul>
        </section>

        {/* Section 9: Бенчмарки РК */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-pink-300">9. Бенчмарки РК — стоимость и проекты</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800">
                  <th className="text-left py-2 pr-4">Объект</th>
                  <th className="text-left py-2 pr-4">Локация</th>
                  <th className="text-left py-2 pr-4">Параметры / стоимость</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                <tr className="border-b border-slate-800/60">
                  <td className="py-2 pr-4">АрселорМиттал Темиртау (АМТ)</td>
                  <td className="py-2 pr-4">Темиртау</td>
                  <td className="py-2 pr-4">Полный цикл, 4-5 млн т стали/год, домна №3 объём 3200 м³</td>
                </tr>
                <tr className="border-b border-slate-800/60">
                  <td className="py-2 pr-4">Аксуский завод ферросплавов (КЭЗ)</td>
                  <td className="py-2 pr-4">Аксу</td>
                  <td className="py-2 pr-4">~1.5 млн т FeCr/FeSi/год, 24 РТП</td>
                </tr>
                <tr className="border-b border-slate-800/60">
                  <td className="py-2 pr-4">Казцинк</td>
                  <td className="py-2 pr-4">Усть-Каменогорск, Риддер</td>
                  <td className="py-2 pr-4">Pb-Zn, ~300 тыс. т Zn/год</td>
                </tr>
                <tr className="border-b border-slate-800/60">
                  <td className="py-2 pr-4">Казахмыс</td>
                  <td className="py-2 pr-4">Жезказган, Балхаш</td>
                  <td className="py-2 pr-4">Медь катодная ~250-300 тыс. т/год</td>
                </tr>
                <tr className="border-b border-slate-800/60">
                  <td className="py-2 pr-4">KAZ Minerals Бозшаколь/Актогай</td>
                  <td className="py-2 pr-4">Павлодарская / Восточно-Каз. обл.</td>
                  <td className="py-2 pr-4">Медный концентрат ~250 тыс. т Cu/год</td>
                </tr>
                <tr className="border-b border-slate-800/60">
                  <td className="py-2 pr-4">ЭГПК (Алюминий Казахстана)</td>
                  <td className="py-2 pr-4">Экибастуз</td>
                  <td className="py-2 pr-4">Первичный Al ~250 тыс. т/год, электролиз 320 кА</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Мини-завод EAF 1 млн т/год</td>
                  <td className="py-2 pr-4">бенчмарк</td>
                  <td className="py-2 pr-4">250-400 млрд тг (типично ~350 млрд тг)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Exercises */}
        <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6">
          <h2 className="text-2xl font-bold text-slate-50">Упражнения</h2>

          <div className="mt-6 space-y-6">
            {/* Ex1 */}
            <div>
              <p className="text-slate-200 font-medium">1. Где находится единственный полный цикл чёрной металлургии в РК?</p>
              <div className="mt-2 space-y-1 text-sm">
                {[
                  { v: "a", t: "Алматы" },
                  { v: "b", t: "Шымкент" },
                  { v: "c", t: "Темиртау (АрселорМиттал Темиртау, АМТ — домна №3 объём 3200 м³)" },
                  { v: "d", t: "Атырау" },
                ].map((o) => (
                  <label key={o.v} className="flex items-start gap-2 cursor-pointer text-slate-300 hover:text-slate-100">
                    <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={(e) => setEx1(e.target.value)} className="mt-1" />
                    <span>{o.t}</span>
                  </label>
                ))}
              </div>
              {show && (
                <p className={"mt-2 text-sm " + (ex1 === "c" ? "text-emerald-400" : "text-rose-400")}>
                  {ex1 === "c" ? "Верно: АМТ в Темиртау — единственный полный цикл (домна + конвертер + МНЛЗ + прокат)." : "Правильный ответ: c — Темиртау (АМТ)."}
                </p>
              )}
            </div>

            {/* Ex2 */}
            <div>
              <p className="text-slate-200 font-medium">2. Что такое BOF в чёрной металлургии?</p>
              <div className="mt-2 space-y-1 text-sm">
                {[
                  { v: "a", t: "Blast Outflow Furnace" },
                  { v: "b", t: "Basic Oxygen Furnace — кислородный конвертер, продувает кислородом плавку чугуна для получения стали" },
                  { v: "c", t: "Bottom Operated Forge" },
                  { v: "d", t: "Bulk Ore Feeder" },
                ].map((o) => (
                  <label key={o.v} className="flex items-start gap-2 cursor-pointer text-slate-300 hover:text-slate-100">
                    <input type="radio" name="ex2" value={o.v} checked={ex2 === o.v} onChange={(e) => setEx2(e.target.value)} className="mt-1" />
                    <span>{o.t}</span>
                  </label>
                ))}
              </div>
              {show && (
                <p className={"mt-2 text-sm " + (ex2 === "b" ? "text-emerald-400" : "text-rose-400")}>
                  {ex2 === "b" ? "Верно: BOF — Basic Oxygen Furnace, кислородный конвертер." : "Правильный ответ: b — Basic Oxygen Furnace."}
                </p>
              )}
            </div>

            {/* Ex3 */}
            <div>
              <p className="text-slate-200 font-medium">
                3. Оцените стоимость мини-завода EAF мощностью 1 млн т стали/год (в тенге). Бенчмарк ~350 млрд тг.
              </p>
              <input
                type="text"
                inputMode="numeric"
                value={ex3}
                onChange={(e) => setEx3(e.target.value)}
                placeholder="например, 350000000000"
                className="mt-2 w-full md:w-80 rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-slate-100 focus:border-blue-400 outline-none"
              />
              {show && (
                <p className={"mt-2 text-sm " + (ex3Ok ? "text-emerald-400" : "text-rose-400")}>
                  {ex3Ok
                    ? "Верно: ~350 000 000 000 тг (допуск ±30 млрд тг)."
                    : "Правильный ответ: ~350 000 000 000 тг (250-400 млрд тг диапазон)."}
                </p>
              )}
            </div>

            {/* Ex4 */}
            <div>
              <p className="text-slate-200 font-medium">4. Какие электроды используются в дуговой электропечи EAF?</p>
              <div className="mt-2 space-y-1 text-sm">
                {[
                  { v: "a", t: "угольные стержни" },
                  { v: "b", t: "медные" },
                  { v: "c", t: "вольфрамовые" },
                  { v: "d", t: "графитовые Ø600-700 мм" },
                ].map((o) => (
                  <label key={o.v} className="flex items-start gap-2 cursor-pointer text-slate-300 hover:text-slate-100">
                    <input type="radio" name="ex4" value={o.v} checked={ex4 === o.v} onChange={(e) => setEx4(e.target.value)} className="mt-1" />
                    <span>{o.t}</span>
                  </label>
                ))}
              </div>
              {show && (
                <p className={"mt-2 text-sm " + (ex4 === "d" ? "text-emerald-400" : "text-rose-400")}>
                  {ex4 === "d" ? "Верно: графитовые электроды Ø600-700 мм." : "Правильный ответ: d — графитовые Ø600-700 мм."}
                </p>
              )}
            </div>
          </div>

          <div className="mt-8 flex gap-3">
            <button
              onClick={() => setShow(true)}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition"
            >
              Проверить ответы
            </button>
            <button
              onClick={() => {
                setEx1(""); setEx2(""); setEx3(""); setEx4(""); setShow(false);
              }}
              className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 font-medium transition"
            >
              Сбросить
            </button>
          </div>
        </section>

        <div className="pt-4 text-center">
          <Link href="/smeta-trainer/drawings-practice" className="text-blue-300 hover:text-blue-200 text-sm">
            ← Вернуться к разделам drawings-practice
          </Link>
        </div>
      </main>
    </div>
  );
}
