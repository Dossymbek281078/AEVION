"use client";
import Link from "next/link";
import { useState } from "react";

export default function CementPlantsPage() {
  const [ex1, setEx1] = useState<string | null>(null);
  const [ex2, setEx2] = useState<string | null>(null);
  const [ex3, setEx3] = useState<string>("");
  const [ex3Checked, setEx3Checked] = useState(false);
  const [ex4, setEx4] = useState<string | null>(null);

  const ex3Target = 240_000_000_000;
  const ex3Tolerance = 20_000_000_000;
  const ex3Value = parseFloat(ex3.replace(/[\s_]/g, ""));
  const ex3Correct =
    !Number.isNaN(ex3Value) && Math.abs(ex3Value - ex3Target) <= ex3Tolerance;

  const optionClass = (
    state: string | null,
    value: string,
    correct: string,
  ) => {
    if (state === null) {
      return "border-slate-700 bg-slate-900/40 hover:border-blue-500/60 hover:bg-slate-800/60";
    }
    if (value === correct) {
      return "border-emerald-500/80 bg-emerald-900/30 text-emerald-100";
    }
    if (state === value) {
      return "border-rose-500/80 bg-rose-900/30 text-rose-100";
    }
    return "border-slate-800 bg-slate-900/30 text-slate-500";
  };

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
            AEVION Smeta Trainer · Цементные заводы
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            🏭 Цементные заводы
          </h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Цементный завод — крупнейший и самый энергоёмкий объект
            промышленности стройматериалов. Технологическая цепочка: карьер
            известняка → дробление → помол сырья → обжиг клинкера во вращающейся
            печи при 1450°C → помол клинкера с гипсом → силосы цемента →
            отгрузка. Сметчик работает с типовыми проектами «Гипроцемент» и
            современными FLSmidth / KHD / Polysius, нормами СН РК 2.04-03
            (атмосфера) и индексами ССЦ РК. В этом модуле — ключевые параметры
            оборудования и бенчмарки заводов РК.
          </p>
        </section>

        {/* Section 1: Технология */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">
            1. Технологическая цепочка производства цемента
          </h2>
          <p className="mt-3 text-slate-400 leading-relaxed">
            Цикл начинается с{" "}
            <span className="text-slate-200">добычи известняка</span> в карьере
            (буровзрывной способ), затем известняк, глина и корректирующие
            добавки идут на дробление и помол сырья. Полученная сырьевая мука
            (сухой способ) или шлам (мокрый способ) поступает во вращающуюся
            печь, где при температуре 1450°C образуется{" "}
            <span className="text-slate-200">клинкер</span>. Клинкер охлаждается
            в холодильнике и далее измельчается с добавкой гипса (3–5%) и
            активных минеральных добавок — на выходе портландцемент.
          </p>
          <div className="mt-4 grid md:grid-cols-3 gap-4 text-sm">
            <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-4">
              <div className="text-slate-200 font-medium mb-2">
                Сухой способ
              </div>
              <p className="text-slate-400">
                Влажность сырья &lt;1%. Расход тепла 3.0–3.5 ГДж/т клинкера.
                Современный стандарт, все новые заводы.
              </p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-4">
              <div className="text-slate-200 font-medium mb-2">
                Мокрый способ
              </div>
              <p className="text-slate-400">
                Шлам 35–45% влажности. Расход тепла 5.5–6.5 ГДж/т. Устаревший,
                остался на старых заводах СССР.
              </p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-4">
              <div className="text-slate-200 font-medium mb-2">
                Комбинированный
              </div>
              <p className="text-slate-400">
                Шлам частично обезвоживается на фильтре-прессе перед печью.
                Расход тепла 4.0–4.5 ГДж/т.
              </p>
            </div>
          </div>
        </section>

        {/* Section 2: Вращающаяся печь */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">
            2. Вращающаяся печь и циклонные теплообменники
          </h2>
          <p className="mt-3 text-slate-400 leading-relaxed">
            Главный агрегат завода —{" "}
            <span className="text-slate-200">вращающаяся печь</span>: стальной
            барабан длиной 70–100 м, диаметром 5–6 м, наклон 3–4%, частота
            вращения 2–4 об/мин. Футеровка магнезитохромитовым и шамотным
            кирпичом. Перед печью устанавливаются{" "}
            <span className="text-slate-200">циклонные теплообменники</span>{" "}
            (Pyroclon / SLC) на 4–6 ступеней и кальцинатор — там происходит
            предварительный нагрев и до 95% декарбонизации сырья. Сжигание
            топлива (уголь, мазут, газ, RDF) — в главной горелке.
          </p>
          <div className="mt-4 grid md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-4">
              <div className="text-slate-200 font-medium mb-2">
                Параметры печи (сухой способ)
              </div>
              <ul className="space-y-1 text-slate-400">
                <li>Длина: 70–100 м</li>
                <li>Диаметр: 5–6 м</li>
                <li>Температура обжига: 1450°C</li>
                <li>Производительность: 3000–5000 т клинкера/сутки</li>
                <li>Удельный расход тепла: 3.0–3.5 ГДж/т</li>
              </ul>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-4">
              <div className="text-slate-200 font-medium mb-2">
                Зоны обжига в печи
              </div>
              <ul className="space-y-1 text-slate-400">
                <li>Зона подогрева: 200–700°C</li>
                <li>Зона декарбонизации: 700–1100°C</li>
                <li>Зона экзотермических реакций: 1100–1300°C</li>
                <li>Зона спекания: 1300–1450°C</li>
                <li>Зона охлаждения: 1450 → 1100°C</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 3: Мельницы */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">
            3. Сырьевая и цементная мельницы
          </h2>
          <p className="mt-3 text-slate-400 leading-relaxed">
            Помол сырья и клинкера осуществляется в шаровых или валковых
            мельницах. Классические{" "}
            <span className="text-slate-200">шаровые мельницы</span> диаметром
            4–5 м, длиной 15–20 м с двумя-тремя камерами и шаровой загрузкой
            150–250 т. Современные{" "}
            <span className="text-slate-200">валковые (ролико-маятниковые)</span>{" "}
            мельницы Loesche, Polysius QMR², FLSmidth ATOX — компактнее, на
            30–40% энергоэффективнее.
          </p>
          <div className="mt-4 grid md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-4">
              <div className="text-slate-200 font-medium mb-2">
                Сырьевая мельница
              </div>
              <ul className="space-y-1 text-slate-400">
                <li>Производительность: 200–400 т/час</li>
                <li>Тонина помола: остаток на 0.08 мм — 8–12%</li>
                <li>Расход электроэнергии: 12–18 кВт·ч/т</li>
                <li>Привод: 2500–4500 кВт</li>
              </ul>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-4">
              <div className="text-slate-200 font-medium mb-2">
                Цементная мельница
              </div>
              <ul className="space-y-1 text-slate-400">
                <li>Производительность: 80–200 т/час</li>
                <li>Удельная поверхность: 3000–4500 см²/г (по Блейну)</li>
                <li>Расход электроэнергии: 30–45 кВт·ч/т</li>
                <li>Привод: 3500–6500 кВт</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 4: Силосы */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">
            4. Силосы клинкера и цемента
          </h2>
          <p className="mt-3 text-slate-400 leading-relaxed">
            Между переделами устанавливаются{" "}
            <span className="text-slate-200">силосы</span> — крупные
            железобетонные ёмкости для хранения и буферизации. Конструктивно —
            монолитные ж/б цилиндры со скользящей опалубкой или сборные из
            крупных панелей. Загрузка через{" "}
            <span className="text-slate-200">башенный распределитель</span>{" "}
            (труба со шнеками или аэрожёлобами), выгрузка — пневматическая
            (аэрация днища) или механическая (шнеки, цепные конвейеры).
          </p>
          <div className="mt-4 grid md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-4">
              <div className="text-slate-200 font-medium mb-2">
                Силос клинкера
              </div>
              <ul className="space-y-1 text-slate-400">
                <li>Диаметр: 25–40 м</li>
                <li>Высота: 30–50 м</li>
                <li>Объём: 30 000–80 000 т</li>
                <li>Запас 7–14 суток производства</li>
                <li>Возможна купольная (Dome) конструкция</li>
              </ul>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-4">
              <div className="text-slate-200 font-medium mb-2">
                Силосы цемента
              </div>
              <ul className="space-y-1 text-slate-400">
                <li>Диаметр: 15–25 м</li>
                <li>Высота: 25–40 м</li>
                <li>Объём: 5000–15 000 т каждый</li>
                <li>4–8 силосов по маркам цемента</li>
                <li>Аэрационные подушки на днище для выгрузки</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 5: Холодильник клинкера */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">
            5. Холодильник клинкера
          </h2>
          <p className="mt-3 text-slate-400 leading-relaxed">
            После выхода из печи клинкер с температурой 1450°C поступает в{" "}
            <span className="text-slate-200">холодильник</span>, где быстро
            охлаждается до 80–100°C. Современный стандарт — колосниковый
            холодильник{" "}
            <span className="text-slate-200">CIS (Clinker Industrial System)</span>{" "}
            от FLSmidth или Cross-Bar от KHD: подвижные ряды колосников
            прогоняют клинкер через зоны охлаждения вентиляторным потоком.
            Альтернатива — планетарный холодильник (барабаны вокруг печи) на
            старых линиях. Горячий воздух от охлаждения возвращается в печь и
            калькулятор (рекуперация тепла 70–80%).
          </p>
          <div className="mt-4 grid md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-4">
              <div className="text-slate-200 font-medium mb-2">
                Колосниковый холодильник
              </div>
              <ul className="space-y-1 text-slate-400">
                <li>Длина решётки: 25–40 м</li>
                <li>Ширина: 3.5–5 м</li>
                <li>Удельная нагрузка: 40–55 т/(м²·сутки)</li>
                <li>Расход воздуха: 1.8–2.3 нм³/кг клинкера</li>
              </ul>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-4">
              <div className="text-slate-200 font-medium mb-2">
                Эффект рекуперации
              </div>
              <ul className="space-y-1 text-slate-400">
                <li>Возврат тепла в печь и кальцинатор</li>
                <li>Снижение удельного расхода топлива на 20–25%</li>
                <li>Температура вторичного воздуха: 950–1100°C</li>
                <li>Температура третичного воздуха: 700–900°C</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 6: Электрофильтры */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">
            6. Электрофильтры и рукавные фильтры
          </h2>
          <p className="mt-3 text-slate-400 leading-relaxed">
            Цементное производство — крупный источник пыли (сырьевая,
            клинкерная, цементная). На всех узлах аспирации устанавливаются
            фильтры:{" "}
            <span className="text-slate-200">электрофильтры</span> (ESP) на
            больших потоках печи и сырьевой мельницы либо{" "}
            <span className="text-slate-200">рукавные фильтры</span> на узлах
            помола, силосов, упаковки. Производители: FLSmidth Airtech, Lurgi,
            Wheelabrator, Scheuch, Beumer.
          </p>
          <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-950/20 p-4 text-sm">
            <div className="text-amber-200 font-medium mb-2">
              Норматив СН РК 2.04-03
            </div>
            <p className="text-amber-100/80">
              Концентрация пыли в выбросах в атмосферу — не более{" "}
              <span className="text-amber-50 font-medium">30 мг/м³</span> (для
              новых установок). Для печей и сушильных установок — не более 50
              мг/м³ по согласованию. Без современных фильтров эксплуатация
              невозможна.
            </p>
          </div>
          <div className="mt-4 grid md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-4">
              <div className="text-slate-200 font-medium mb-2">
                Электрофильтр (ESP)
              </div>
              <ul className="space-y-1 text-slate-400">
                <li>Производительность: 500 000–2 500 000 нм³/ч</li>
                <li>Степень очистки: 99.8–99.95%</li>
                <li>4–6 электрических полей</li>
                <li>Габариты: 30×25×15 м, масса 700–1200 т</li>
              </ul>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-4">
              <div className="text-slate-200 font-medium mb-2">
                Рукавный фильтр
              </div>
              <ul className="space-y-1 text-slate-400">
                <li>Производительность: до 1 200 000 нм³/ч</li>
                <li>Степень очистки: 99.99% (&lt;10 мг/м³)</li>
                <li>Импульсная регенерация сжатым воздухом</li>
                <li>Рукава Nomex / PTFE / стекловолокно</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 7: Карьер */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">
            7. Карьер сырья
          </h2>
          <p className="mt-3 text-slate-400 leading-relaxed">
            Цементный завод привязан к{" "}
            <span className="text-slate-200">карьеру известняка</span>{" "}
            (обычно &lt;5 км). Добыча — буровзрывным способом: бурение скважин
            Atlas Copco, заряжание ВВ (граммонит, эмульсионные), массовый
            взрыв 50–200 тыс. т породы. Погрузка экскаваторами{" "}
            <span className="text-slate-200">ЭКГ-4у, ЭКГ-5А, ЭКГ-8И</span>,
            вывозка карьерными самосвалами{" "}
            <span className="text-slate-200">БелАЗ 30–45 т</span> на дробильную
            установку (ДКД, конусные, молотковые).
          </p>
          <div className="mt-4 grid md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-4">
              <div className="text-slate-200 font-medium mb-2">
                Качество сырья (известняк)
              </div>
              <ul className="space-y-1 text-slate-400">
                <li>CaO: ≥45% (предпочт. 50–54%)</li>
                <li>MgO: &lt;5% (выше — портит цемент)</li>
                <li>SiO₂: 12–18% (для смеси)</li>
                <li>Al₂O₃: 3–5%</li>
                <li>Fe₂O₃: 1.5–3%</li>
              </ul>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-4">
              <div className="text-slate-200 font-medium mb-2">
                Дробление известняка
              </div>
              <ul className="space-y-1 text-slate-400">
                <li>I ступень: щёковая или молотковая, до 250 мм</li>
                <li>II ступень: конусная, до 25–50 мм</li>
                <li>Производительность ДКД: 800–1500 т/час</li>
                <li>Склад дроблёного известняка: запас 5–10 суток</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 8: Энергоэффективность */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">
            8. Энергоэффективность и собственная ТЭС
          </h2>
          <p className="mt-3 text-slate-400 leading-relaxed">
            Цементный завод —{" "}
            <span className="text-slate-200">очень энергоёмкое производство</span>.
            На 1 тонну цемента уходит 3.0–3.5 ГДж тепла (топливо) и 90–110
            кВт·ч электроэнергии. Крупные заводы (от 1.5 млн т/год) имеют
            собственную ТЭС-2 на угле/газе мощностью 25–60 МВт для
            автономного снабжения и продажи излишков в сеть. Резерв питания
            через подстанцию 110/35/10 кВ от РЭК.
          </p>
          <div className="mt-4 grid md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-4">
              <div className="text-slate-200 font-medium mb-2">
                Структура расхода энергии
              </div>
              <ul className="space-y-1 text-slate-400">
                <li>Обжиг (топливо): 60–70%</li>
                <li>Помол цемента (эл.): 18–22%</li>
                <li>Помол сырья (эл.): 8–12%</li>
                <li>Вспомогательное: 5–8%</li>
              </ul>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-4">
              <div className="text-slate-200 font-medium mb-2">
                Виды топлива печи
              </div>
              <ul className="space-y-1 text-slate-400">
                <li>Природный газ — чистый, дорогой</li>
                <li>Уголь (карагандинский, экибастузский) — массовый в РК</li>
                <li>Мазут — резерв при перебоях газа</li>
                <li>RDF / альтернативные топлива — современный тренд (10–30%)</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 9: Бенчмарки РК */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">
            9. Бенчмарки цементных заводов РК
          </h2>
          <p className="mt-3 text-slate-400 leading-relaxed">
            В Казахстане действует около 10 цементных заводов суммарной
            мощностью ~13 млн т/год. Крупнейшие игроки —{" "}
            <span className="text-slate-200">HeidelbergCement Kazakhstan</span>{" "}
            (ранее Holcim/Lafarge, бывший ССК Шымкент),{" "}
            <span className="text-slate-200">Шымкентцемент</span>,{" "}
            <span className="text-slate-200">Састобе Цемент</span>,{" "}
            <span className="text-slate-200">Стандарт Цемент</span>{" "}
            (Хантау/Жамбылская обл.).
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-300">
                  <th className="text-left py-2 px-3">Завод</th>
                  <th className="text-left py-2 px-3">Регион</th>
                  <th className="text-right py-2 px-3">Мощность, млн т/год</th>
                  <th className="text-left py-2 px-3">Способ</th>
                </tr>
              </thead>
              <tbody className="text-slate-400">
                <tr className="border-b border-slate-800">
                  <td className="py-2 px-3">HeidelbergCement (Шымкент)</td>
                  <td className="py-2 px-3">Шымкент</td>
                  <td className="py-2 px-3 text-right">1.6</td>
                  <td className="py-2 px-3">Сухой</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="py-2 px-3">Састобе Цемент</td>
                  <td className="py-2 px-3">Туркестанская</td>
                  <td className="py-2 px-3 text-right">1.0</td>
                  <td className="py-2 px-3">Сухой</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="py-2 px-3">Стандарт Цемент (Хантау)</td>
                  <td className="py-2 px-3">Жамбылская</td>
                  <td className="py-2 px-3 text-right">2.0</td>
                  <td className="py-2 px-3">Сухой</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="py-2 px-3">Карагандинский ЦЗ</td>
                  <td className="py-2 px-3">Карагандинская</td>
                  <td className="py-2 px-3 text-right">1.4</td>
                  <td className="py-2 px-3">Мокрый/комб.</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="py-2 px-3">Семейцемент</td>
                  <td className="py-2 px-3">ВКО</td>
                  <td className="py-2 px-3 text-right">1.0</td>
                  <td className="py-2 px-3">Мокрый</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="py-2 px-3">Усть-Каменогорский ЦЗ</td>
                  <td className="py-2 px-3">ВКО</td>
                  <td className="py-2 px-3 text-right">1.0</td>
                  <td className="py-2 px-3">Сухой</td>
                </tr>
                <tr>
                  <td className="py-2 px-3">Бухтарминская цем.компания</td>
                  <td className="py-2 px-3">ВКО</td>
                  <td className="py-2 px-3 text-right">1.0</td>
                  <td className="py-2 px-3">Сухой</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-4 rounded-lg border border-blue-500/40 bg-blue-950/20 p-4 text-sm">
            <div className="text-blue-200 font-medium mb-2">
              Бенчмарк строительства
            </div>
            <p className="text-blue-100/80">
              Стоимость нового завода под ключ (сухой способ, циклоны, валковые
              мельницы, склад и ТЭС) — ориентир{" "}
              <span className="text-blue-50 font-medium">
                80–130 млрд тг на 1 млн т годовой мощности
              </span>{" "}
              (среднее ~120 млрд тг/млн т, цены 2025–2026 гг.). Срок
              реализации проекта 3–4 года. Включает карьер, переделы, ТЭС,
              склады, ж/д ветку, инфраструктуру.
            </p>
          </div>
        </section>

        {/* Exercises */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-100">
            Контроль знаний
          </h2>

          {/* Exercise 1 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <div className="text-sm text-slate-500 mb-2">Упражнение 1 из 4</div>
            <div className="text-slate-100 font-medium">
              При какой температуре обжигается клинкер во вращающейся печи
              цементного завода?
            </div>
            <div className="mt-4 grid md:grid-cols-2 gap-2">
              {[
                { v: "a", t: "800°C" },
                { v: "b", t: "1000°C" },
                { v: "c", t: "1450°C" },
                { v: "d", t: "2000°C" },
              ].map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => ex1 === null && setEx1(opt.v)}
                  disabled={ex1 !== null}
                  className={`text-left rounded-lg border px-4 py-3 text-sm transition ${optionClass(ex1, opt.v, "c")}`}
                >
                  <span className="font-medium mr-2">
                    {opt.v.toUpperCase()})
                  </span>
                  {opt.t}
                </button>
              ))}
            </div>
            {ex1 !== null && (
              <div
                className={`mt-4 text-sm ${ex1 === "c" ? "text-emerald-300" : "text-rose-300"}`}
              >
                {ex1 === "c"
                  ? "Верно. Спекание клинкера происходит при 1450°C — это ключевая температура в зоне обжига вращающейся печи."
                  : "Неверно. Правильный ответ — 1450°C. Это температура спекания клинкера в зоне обжига вращающейся печи."}
              </div>
            )}
          </div>

          {/* Exercise 2 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <div className="text-sm text-slate-500 mb-2">Упражнение 2 из 4</div>
            <div className="text-slate-100 font-medium">
              Какая типовая длина вращающейся печи современного цементного
              завода сухого способа с циклонными теплообменниками?
            </div>
            <div className="mt-4 grid md:grid-cols-2 gap-2">
              {[
                { v: "a", t: "30–40 м" },
                { v: "b", t: "70–100 м" },
                { v: "c", t: "150–200 м" },
                { v: "d", t: "500 м" },
              ].map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => ex2 === null && setEx2(opt.v)}
                  disabled={ex2 !== null}
                  className={`text-left rounded-lg border px-4 py-3 text-sm transition ${optionClass(ex2, opt.v, "b")}`}
                >
                  <span className="font-medium mr-2">
                    {opt.v.toUpperCase()})
                  </span>
                  {opt.t}
                </button>
              ))}
            </div>
            {ex2 !== null && (
              <div
                className={`mt-4 text-sm ${ex2 === "b" ? "text-emerald-300" : "text-rose-300"}`}
              >
                {ex2 === "b"
                  ? "Верно. Современные печи сухого способа короче (70–100 м), потому что предварительный нагрев и декарбонизация идут в циклонных теплообменниках и кальцинаторе."
                  : "Неверно. Длина 70–100 м. Печи мокрого способа были до 230 м, но сухой способ с циклонами позволил сократить печь."}
              </div>
            )}
          </div>

          {/* Exercise 3 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <div className="text-sm text-slate-500 mb-2">Упражнение 3 из 4</div>
            <div className="text-slate-100 font-medium">
              Оцените стоимость строительства нового цементного завода
              мощностью 2 млн т/год по бенчмарку 120 млрд тг на 1 млн т
              годовой мощности. Ответ — в тенге.
            </div>
            <div className="mt-3 text-sm text-slate-400">
              Подсказка: 2 × 120 000 000 000 = ?
            </div>
            <div className="mt-4 flex gap-3">
              <input
                value={ex3}
                onChange={(e) => {
                  setEx3(e.target.value);
                  setEx3Checked(false);
                }}
                placeholder="240000000000"
                className="flex-1 rounded-lg border border-slate-700 bg-slate-950/40 px-4 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none"
              />
              <button
                onClick={() => setEx3Checked(true)}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-500 transition"
              >
                Проверить
              </button>
            </div>
            {ex3Checked && (
              <div
                className={`mt-4 text-sm ${ex3Correct ? "text-emerald-300" : "text-rose-300"}`}
              >
                {ex3Correct
                  ? "Верно. Около 240 млрд тг (240 000 000 000) — типовая капстоимость завода 2 млн т/год по бенчмарку РК 2025–2026 гг."
                  : "Неверно. Ожидается ≈ 240 000 000 000 тг (240 млрд). Расчёт: 2 млн т × 120 млрд тг/млн т = 240 млрд тг."}
              </div>
            )}
          </div>

          {/* Exercise 4 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <div className="text-sm text-slate-500 mb-2">Упражнение 4 из 4</div>
            <div className="text-slate-100 font-medium">
              Какой норматив максимальной концентрации пыли в выбросах
              цементного завода в атмосферу установлен СН РК 2.04-03 для
              современных установок?
            </div>
            <div className="mt-4 grid md:grid-cols-2 gap-2">
              {[
                { v: "a", t: "Без ограничений" },
                { v: "b", t: "500 мг/м³" },
                { v: "c", t: "200 мг/м³" },
                {
                  v: "d",
                  t: "≤30 мг/м³ (рукавные/электрофильтры обязательны)",
                },
              ].map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => ex4 === null && setEx4(opt.v)}
                  disabled={ex4 !== null}
                  className={`text-left rounded-lg border px-4 py-3 text-sm transition ${optionClass(ex4, opt.v, "d")}`}
                >
                  <span className="font-medium mr-2">
                    {opt.v.toUpperCase()})
                  </span>
                  {opt.t}
                </button>
              ))}
            </div>
            {ex4 !== null && (
              <div
                className={`mt-4 text-sm ${ex4 === "d" ? "text-emerald-300" : "text-rose-300"}`}
              >
                {ex4 === "d"
                  ? "Верно. Для новых установок норматив ≤30 мг/м³. Это требует обязательной установки современных рукавных фильтров или многопольных электрофильтров — учитываем при сметировании."
                  : "Неверно. Современный норматив ≤30 мг/м³. Без рукавных фильтров или электрофильтров высокой эффективности эксплуатация невозможна."}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">
            Что запомнить сметчику
          </h2>
          <ul className="mt-3 space-y-2 text-slate-400 text-sm leading-relaxed">
            <li>
              Стоимость завода под ключ — 80–130 млрд тг на 1 млн т/год
              мощности (среднее ~120). Сроки 3–4 года.
            </li>
            <li>
              Без современных фильтров (≤30 мг/м³) проект не пройдёт ГЭЭ.
              Электрофильтры/рукавные — отдельная крупная строка ЛСР.
            </li>
            <li>
              Карьер известняка и дробление — отдельный объект (5–8% от стоимости
              завода). Учитывать землеотвод и лицензию на недропользование.
            </li>
            <li>
              Современный стандарт — сухой способ с циклонными теплообменниками,
              кальцинатором, валковыми мельницами и колосниковым холодильником.
              Мокрый способ — только модернизация старых линий.
            </li>
            <li>
              Собственная ТЭС-2 на 25–60 МВт — обязательна для крупных заводов.
              Включается в сметную стоимость как отдельный титул.
            </li>
            <li>
              Силосы — крупный ж/б объём (5000–80 000 т каждый). Скользящая
              опалубка, специальные расценки ЭСН РК на монолитные ёмкости.
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}
