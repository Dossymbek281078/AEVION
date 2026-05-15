"use client";
import Link from "next/link";
import { useState } from "react";

type McqState = "idle" | "correct" | "wrong";

export default function GasProcessingPlantsPage() {
  const [ex1, setEx1] = useState<McqState>("idle");
  const [ex1Pick, setEx1Pick] = useState<string | null>(null);
  const [ex2, setEx2] = useState<McqState>("idle");
  const [ex2Pick, setEx2Pick] = useState<string | null>(null);
  const [ex3Val, setEx3Val] = useState<string>("");
  const [ex3, setEx3] = useState<McqState>("idle");
  const [ex4, setEx4] = useState<McqState>("idle");
  const [ex4Pick, setEx4Pick] = useState<string | null>(null);

  const checkMcq = (pick: string, correct: string, setState: (s: McqState) => void) => {
    setState(pick === correct ? "correct" : "wrong");
  };

  const checkNumeric = () => {
    const v = Number(ex3Val.replace(/\s+/g, "").replace(/,/g, "."));
    if (!Number.isFinite(v)) {
      setEx3("wrong");
      return;
    }
    const target = 1_200_000_000;
    const tol = 100_000_000;
    setEx3(Math.abs(v - target) <= tol ? "correct" : "wrong");
  };

  const optionClass = (state: McqState, picked: string | null, value: string, correct: string) => {
    const base =
      "w-full text-left px-4 py-3 rounded-lg border transition flex items-start gap-3";
    if (state === "idle" || picked !== value) {
      return `${base} border-slate-700 bg-slate-900/40 hover:bg-slate-800/60 hover:border-slate-600 text-slate-200`;
    }
    if (value === correct) {
      return `${base} border-emerald-500 bg-emerald-900/30 text-emerald-100`;
    }
    return `${base} border-rose-500 bg-rose-900/30 text-rose-100`;
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
            AEVION Smeta Trainer · ГПЗ
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            🔥 Газоперерабатывающие заводы (ГПЗ)
          </h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль для сметчиков объектов газопереработки Казахстана:
            Карачаганакский ГПЗ (KPO), Жанажолский ГПЗ (CNPC-Актобемунайгаз),
            Тенгизский комплекс ТШО, Кашаганский KGFP, Атырауский ГПЗ. Темы —
            подготовка газа от H₂S и меркаптанов, отбор СУГ и стабильного
            конденсата, серная установка Клауса, шарообразные резервуары,
            антикоррозионная защита C5-M, DCS и SIS. Нормативы: СН РК 1.03-08,
            СН РК 2.05-32 (магистральные газопроводы), ГОСТ Р 53682-2009
            (теплообменное оборудование), API 650/620, ISO 12944.
          </p>
        </section>

        {/* Section 1: ГПЗ Казахстана */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
          <h2 className="text-xl font-semibold text-amber-300">
            1. Основные ГПЗ Казахстана
          </h2>
          <ul className="text-sm text-slate-300 space-y-2 list-disc list-inside">
            <li>
              <strong>Карачаганакский ГПЗ (KPO)</strong> — 18 млрд м³/год
              сернистого газа + газовый конденсат. Установки KPC, DGCS,
              сероулавливание SRU Клауса. Расширение Phase 3 — $5+ млрд.
            </li>
            <li>
              <strong>Жанажолский ГПЗ (Актобе, CNPC-Актобемунайгаз)</strong> —
              3 очереди суммарно ~6 млрд м³/год. Очистка от H₂S и меркаптанов
              аминами (MDEA), отбор СУГ и стабильного конденсата.
            </li>
            <li>
              <strong>Тенгизский комплекс ТШО (FGP + WPMP)</strong> — $45 млрд,
              запуск 2024–2025. Установки сепарации, обессеривания, закачки
              кислых газов в пласт (SGI).
            </li>
            <li>
              <strong>Кашаганский KGFP</strong> — $1,5+ млрд установка
              переработки попутного нефтяного газа.
            </li>
            <li>
              <strong>Атырауский ГПЗ</strong> и <strong>Орьский «Жайык-Гарантия»</strong>{" "}
              — малотоннажные комплексы региональной подачи.
            </li>
          </ul>
          <p className="text-xs text-slate-500">
            Назначение ГПЗ — подготовка газа от сероводорода (H₂S) и
            меркаптанов до товарной кондиции, отбор СУГ (пропан-бутана) и
            стабильного газового конденсата, выработка элементарной серы.
          </p>
        </section>

        {/* Section 2: Установки */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
          <h2 className="text-xl font-semibold text-cyan-300">
            2. Технологические установки ГПЗ
          </h2>
          <ul className="text-sm text-slate-300 space-y-2 list-disc list-inside">
            <li>
              <strong>DGCS (Deep Gas Conditioning System)</strong> — глубокая
              подготовка газа с криогенным извлечением C2+.
            </li>
            <li>
              <strong>ОППГ</strong> — установка очистки попутного нефтяного
              газа от тяжёлых углеводородов и механических примесей.
            </li>
            <li>
              <strong>УОВ</strong> — узел осушки газа от воды на
              триэтиленгликоле (ТЭГ), точка росы −20…−40 °C.
            </li>
            <li>
              <strong>УОС</strong> — узел осушки от сероводорода и CO₂
              аминовыми растворами <strong>DGA / MDEA</strong>{" "}
              (диэтаноламин/метилдиэтаноламин).
            </li>
            <li>
              <strong>SRU (Sulfur Recovery Unit)</strong> — серная установка
              <strong> Клауса</strong> в 2–3 ступени, выход элементарной серы
              95–99,8 %.
            </li>
            <li>
              <strong>Фракционирование</strong> — деэтанизатор, депропанизатор,
              дебутанизатор для разделения СУГ на товарные фракции.
            </li>
          </ul>
        </section>

        {/* Section 3: Колонные аппараты */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
          <h2 className="text-xl font-semibold text-violet-300">
            3. Колонные аппараты ГПЗ
          </h2>
          <p className="text-sm text-slate-300">
            Деэтанизатор, депропанизатор, дебутанизатор — ректификационные
            колонны H = <strong>30–50 м</strong>, Ø <strong>2–3 м</strong>,
            рабочее давление до 3,5 МПа. Внутренние устройства — клапанные или
            ситчатые тарелки 40–80 шт. Монтаж по{" "}
            <strong>ЭСН Сб. 6 «Тепломонтажные работы»</strong> на свайные
            ростверки с анкерными болтами М48–М64. Теплоизоляция —
            <strong> Rockwool 150–200 мм</strong> + защитный кожух из
            оцинкованной стали 0,7 мм. Внутренние тарелки — нержавеющая
            12Х18Н10Т / AISI 304L при наличии H₂S.
          </p>
        </section>

        {/* Section 4: Теплообменники */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">
            4. Теплообменное оборудование
          </h2>
          <ul className="text-sm text-slate-300 space-y-1 list-disc list-inside">
            <li>
              <strong>Пластинчатые теплообменники Alfa Laval</strong> — для
              рекуперации тепла продукта и охлаждения аминов.
            </li>
            <li>
              <strong>Кожухотрубные горизонтальные/вертикальные</strong> по
              ГОСТ Р 53682-2009 — конденсаторы-холодильники колонн.
            </li>
            <li>
              <strong>Воздушные АВО (Air-cooled)</strong> — для климатической
              зоны Западного Казахстана и Атырау.
            </li>
            <li>
              Монтаж по <strong>ЭСН Сб. 36 «Оборудование общего назначения»</strong>{" "}
              с обвязкой технологическими трубопроводами Сб. 38.
            </li>
            <li>
              Рекуперация тепла продукта снижает энергопотребление установки на
              25–40 %.
            </li>
          </ul>
        </section>

        {/* Section 5: Резервуарный парк */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
          <h2 className="text-xl font-semibold text-indigo-300">
            5. Резервуарный парк ГПЗ
          </h2>
          <ul className="text-sm text-slate-300 space-y-1 list-disc list-inside">
            <li>
              <strong>РВС-5000 м³</strong> — для стабильного газового
              конденсата и нефти. Конструкция по ГОСТ 31385-2016.
            </li>
            <li>
              <strong>Шарообразные пропан-бутановые резервуары (Sphere)</strong>{" "}
              — Ø <strong>10–22 м</strong>, объём 1000–5000 м³, рабочее
              давление 1,8 МПа, опоры на 8–12 стойках с противопожарным
              орошением.
            </li>
            <li>
              <strong>Факельные водоотливные ёмкости (КО — конденсатоотводчики)</strong>{" "}
              — приём капельной жидкости перед факельным оголовком.
            </li>
            <li>
              <strong>Изотермические СУГ</strong> — для крупных терминалов:
              пропан −42 °C, бутан −5 °C, объём 10–60 тыс. м³.
            </li>
            <li>
              Обвалование с гидротвозвозвратом, противопожарное орошение
              интенсивностью ≥ 10 л/м²·мин по СН РК 2.04-29.
            </li>
          </ul>
        </section>

        {/* Section 6: Серный участок */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
          <h2 className="text-xl font-semibold text-yellow-300">
            6. Серный участок (SRU)
          </h2>
          <p className="text-sm text-slate-300">
            <strong>Процесс Клауса</strong> — каталитическое окисление
            сероводорода до элементарной серы по уравнению{" "}
            <code className="text-amber-200">
              2 H₂S + O₂ → 2 S + 2 H₂O
            </code>
            . В 2–3 ступени выход серы 95–99,8 %. Хвостовые газы доочищаются на
            установках <strong>SCOT / Sulfreen / Clauspol</strong>. Охладители
            расплавленной серы — <strong>Sandvik</strong>, формование в чешую
            (flaking) или комки (granulation, прилл). На Карачаганаке и Тенгизе
            склады серы — открытые блоки объёмом до 100 тыс. т.
          </p>
        </section>

        {/* Section 7: Антикоррозионная защита */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
          <h2 className="text-xl font-semibold text-rose-300">
            7. Антикоррозионная защита
          </h2>
          <ul className="text-sm text-slate-300 space-y-1 list-disc list-inside">
            <li>
              Категория <strong>C5-M по ISO 12944</strong> (морская атмосфера с
              сероводородом) — для прибрежных объектов Каспия (Кашаган,
              Тенгиз).
            </li>
            <li>
              Системы <strong>Hempel / Jotun / PPG</strong>: трёхслойное
              покрытие — Zn-эпокси-грунт 80 мкм + эпоксидная промежуточная 240
              мкм + полиуретановая эмаль 80 мкм; общая толщина DFT{" "}
              <strong>320–540 мкм</strong>.
            </li>
            <li>
              <strong>Горячее цинкование</strong> опор металлоконструкций по
              ГОСТ 9.307 — слой 85–120 мкм.
            </li>
            <li>
              Корр. защита подземных технологических трубопроводов —
              <strong> ВУЗ-1, ВУМП</strong> (изоляционные ленты), плюс активная
              защита: <strong>СКЗ</strong> (станции катодной защиты) с
              анодными заземлителями.
            </li>
            <li>
              Внутренняя футеровка аппаратов с H₂S — гуммирование 4–6 мм или
              эмалирование стеклоэмалью.
            </li>
          </ul>
        </section>

        {/* Section 8: КИПиА */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
          <h2 className="text-xl font-semibold text-teal-300">
            8. Контроль и системы управления
          </h2>
          <ul className="text-sm text-slate-300 space-y-1 list-disc list-inside">
            <li>
              <strong>DCS (Distributed Control System)</strong> — Honeywell
              Experion PKS, Yokogawa CENTUM VP, Emerson DeltaV. Программируемые
              контуры регулирования, человеко-машинный интерфейс операторных.
            </li>
            <li>
              <strong>SIS (Safety Instrumented System)</strong> до{" "}
              <strong>SIL3</strong> по IEC 61511 — аварийная остановка, сброс
              на факел, продувка азотом.
            </li>
            <li>
              <strong>Газоанализ</strong> — метан CH₄ (LEL), сероводород H₂S
              (мг/м³), CO₂, O₂. Точечные и линейные (открытый путь, IR)
              детекторы.
            </li>
            <li>
              <strong>Азотные продувочные щиты</strong> — для безопасного пуска
              и остановки технологических линий.
            </li>
            <li>
              Кабельные эстакады, кабель-канал, монтаж по ЭСН Сб. 8 «Электротехнические
              установки» и Сб. 11 «Приборы и средства автоматизации».
            </li>
          </ul>
        </section>

        {/* Section 9: Бенчмарки РК */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
          <h2 className="text-xl font-semibold text-orange-300">
            9. Бенчмарки РК — мегапроекты ГПЗ
          </h2>
          <ul className="text-sm text-slate-300 space-y-2 list-disc list-inside">
            <li>
              <strong>KPO Карачаганак — расширение Phase 3</strong> — $5+ млрд,
              рост мощности переработки газа.
            </li>
            <li>
              <strong>TCO FGP-WPMP (Тенгиз)</strong> — $45 млрд, крупнейший
              нефтегазовый проект РК последних 10 лет.
            </li>
            <li>
              <strong>Кашаган KGFP</strong> — $1,5+ млрд установка
              переработки попутного газа, синхронизирована с морским
              месторождением.
            </li>
            <li>
              <strong>Жанажол (CNPC-Актобемунайгаз)</strong> — III очередь, ~$1
              млрд.
            </li>
            <li>
              Себестоимость <strong>ГПЗ мощностью 5 млрд м³/год</strong> ≈{" "}
              <strong>$1–2 млрд</strong> (~500 млрд – 1 трлн тг по курсу 500
              тг/USD), включая SRU, аминовую очистку, осушку и резервуарный
              парк.
            </li>
            <li>
              Себестоимость одной шарообразной ёмкости пропан-бутана Ø 16 м
              (2000 м³) с обвязкой — <strong>~3–4 млрд тг</strong>.
            </li>
          </ul>
        </section>

        {/* === EXERCISES === */}
        <section className="rounded-2xl border border-blue-900/60 bg-blue-950/20 p-6 space-y-8">
          <h2 className="text-2xl font-bold text-blue-200">
            🧪 Интерактивные упражнения
          </h2>

          {/* EX1 */}
          <div className="space-y-3">
            <p className="font-semibold text-slate-100">
              1. Какой газ перерабатывает Карачаганакский ГПЗ?
            </p>
            <div className="grid md:grid-cols-1 gap-2">
              {[
                { k: "a", t: "Метан без примесей, готовый к подаче в магистраль." },
                {
                  k: "b",
                  t: "Сернистый газ с H₂S и меркаптанами + газовый конденсат — требует глубокой очистки и сероулавливания.",
                },
                { k: "c", t: "Только сжиженный природный газ (СПГ) из импорта." },
                { k: "d", t: "Только сжиженный углеводородный газ (СУГ)." },
              ].map((o) => (
                <button
                  key={o.k}
                  onClick={() => {
                    setEx1Pick(o.k);
                    checkMcq(o.k, "b", setEx1);
                  }}
                  className={optionClass(ex1, ex1Pick, o.k, "b")}
                >
                  <span className="font-mono text-xs text-slate-400 mt-1">
                    {o.k})
                  </span>
                  <span>{o.t}</span>
                </button>
              ))}
            </div>
            {ex1 === "correct" && (
              <p className="text-emerald-300 text-sm">
                ✓ Верно. Карачаганакское месторождение даёт сернистый газ
                (~4–5 % H₂S) и газовый конденсат, поэтому ГПЗ имеет мощные узлы
                аминовой очистки и серную установку Клауса.
              </p>
            )}
            {ex1 === "wrong" && (
              <p className="text-rose-300 text-sm">
                ✗ Неверно. Правильный ответ — b) сернистый газ с H₂S и
                меркаптанами + конденсат.
              </p>
            )}
          </div>

          {/* EX2 */}
          <div className="space-y-3">
            <p className="font-semibold text-slate-100">
              2. Что такое <strong>процесс Клауса</strong>?
            </p>
            <div className="grid md:grid-cols-1 gap-2">
              {[
                { k: "a", t: "Технология сжижения природного газа при −162 °C." },
                { k: "b", t: "Гидрокрекинг тяжёлых нефтяных фракций под давлением." },
                {
                  k: "c",
                  t: "Технология получения элементарной серы из H₂S через каталитическое окисление: 2 H₂S + O₂ → 2 S + 2 H₂O.",
                },
                { k: "d", t: "Метод удаления CO₂ из дымовых газов амино-абсорбцией." },
              ].map((o) => (
                <button
                  key={o.k}
                  onClick={() => {
                    setEx2Pick(o.k);
                    checkMcq(o.k, "c", setEx2);
                  }}
                  className={optionClass(ex2, ex2Pick, o.k, "c")}
                >
                  <span className="font-mono text-xs text-slate-400 mt-1">
                    {o.k})
                  </span>
                  <span>{o.t}</span>
                </button>
              ))}
            </div>
            {ex2 === "correct" && (
              <p className="text-emerald-300 text-sm">
                ✓ Верно. Процесс Клауса — основа SRU. В 2–3 ступени даёт выход
                серы 95–99,8 %; хвостовые газы доочищаются (SCOT, Sulfreen).
              </p>
            )}
            {ex2 === "wrong" && (
              <p className="text-rose-300 text-sm">
                ✗ Неверно. Правильный ответ — c) каталитическое окисление H₂S
                до элементарной серы.
              </p>
            )}
          </div>

          {/* EX3 */}
          <div className="space-y-3">
            <p className="font-semibold text-slate-100">
              3. Резервуарный парк ГПЗ состоит из <strong>60 шт. РВС-5000 м³</strong>{" "}
              для стабильного конденсата. Цена одного резервуара под ключ —{" "}
              <strong>20 млн тг</strong> (учебный расчёт, упрощённо без
              обвалования и КИПиА). Какова стоимость парка в тенге?
            </p>
            <p className="text-xs text-slate-500">
              Подсказка: 60 × 20 000 000 = ?
            </p>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                value={ex3Val}
                onChange={(e) => setEx3Val(e.target.value)}
                placeholder="введите число в тенге"
                className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 min-w-[260px]"
              />
              <button
                onClick={checkNumeric}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition"
              >
                Проверить
              </button>
            </div>
            {ex3 === "correct" && (
              <p className="text-emerald-300 text-sm">
                ✓ Верно. 60 × 20 000 000 = <strong>1 200 000 000 тг</strong>{" "}
                (1,2 млрд тг ≈ $2,4 млн по курсу 500 тг/USD).
              </p>
            )}
            {ex3 === "wrong" && (
              <p className="text-rose-300 text-sm">
                ✗ Не совпадает. Ожидаемый ответ ≈ 1 200 000 000 тг (1,2 млрд).
              </p>
            )}
          </div>

          {/* EX4 */}
          <div className="space-y-3">
            <p className="font-semibold text-slate-100">
              4. Какая антикоррозионная категория по ISO 12944 применяется для
              металлоконструкций ГПЗ на побережье Каспия (Кашаган, Тенгиз)?
            </p>
            <div className="grid md:grid-cols-2 gap-2">
              {[
                { k: "a", t: "C2 — городская атмосфера (умеренное загрязнение)." },
                { k: "b", t: "C3 — городская/промышленная средней агрессивности." },
                { k: "c", t: "C4 — промышленная высокой агрессивности." },
                {
                  k: "d",
                  t: "C5-M — морская атмосфера с сероводородом (максимальная категория для прибрежной нефтехимии).",
                },
              ].map((o) => (
                <button
                  key={o.k}
                  onClick={() => {
                    setEx4Pick(o.k);
                    checkMcq(o.k, "d", setEx4);
                  }}
                  className={optionClass(ex4, ex4Pick, o.k, "d")}
                >
                  <span className="font-mono text-xs text-slate-400 mt-1">
                    {o.k})
                  </span>
                  <span>{o.t}</span>
                </button>
              ))}
            </div>
            {ex4 === "correct" && (
              <p className="text-emerald-300 text-sm">
                ✓ Верно. C5-M (Marine) — морская атмосфера с H₂S, требует
                3-слойной системы Hempel/Jotun/PPG общей толщиной DFT 320–540
                мкм с цинковым грунтом.
              </p>
            )}
            {ex4 === "wrong" && (
              <p className="text-rose-300 text-sm">
                ✗ Неверно. Правильный ответ — d) C5-M (морская атмосфера с
                сероводородом).
              </p>
            )}
          </div>
        </section>

        <section className="text-center pt-6">
          <Link
            href="/smeta-trainer/drawings-practice"
            className="inline-block px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition"
          >
            ← Вернуться к разделам
          </Link>
        </section>
      </main>
    </div>
  );
}
