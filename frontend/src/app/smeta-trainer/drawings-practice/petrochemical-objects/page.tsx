"use client";
import Link from "next/link";
import { useState } from "react";

type McqState = "idle" | "correct" | "wrong";

export default function PetrochemicalObjectsPage() {
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
    const target = 60_000_000_000;
    const tol = 5_000_000_000;
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
            AEVION Smeta Trainer · Нефтехимия и НПЗ
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            ⚗️ Нефтехимические объекты, НПЗ, резервуары
          </h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль для сметчиков нефтегазовых и нефтехимических объектов
            Казахстана: НПЗ, резервуарные парки, эстакады трубопроводов,
            факельные системы, колонные аппараты. Нормативная база — СН РК
            1.03-08, СН РК 2.04-29, СНиП 5.04-25 РК, ГОСТ 31385-2016.
          </p>
        </section>

        {/* Section 1: НПЗ РК */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
          <h2 className="text-xl font-semibold text-amber-300">
            1. НПЗ Казахстана — действующие активы
          </h2>
          <ul className="text-sm text-slate-300 space-y-2 list-disc list-inside">
            <li>
              <strong>Атырауский НПЗ (АНПЗ)</strong> — 5,5 млн т/год после
              модернизации (КГПН, ПГПН). Установки ELOU-AVT, гидрокрекинг,
              MTBE, каталитический риформинг.
            </li>
            <li>
              <strong>Павлодарский ПНХЗ</strong> — 5,5 млн т/год.
              Перерабатывает преимущественно западносибирскую нефть, имеет
              CDU/VDU, FCC, гидроочистку дизеля.
            </li>
            <li>
              <strong>ПКОП (Шымкентский НПЗ)</strong> — 6 млн т/год.
              Модернизирован в 2018 г., установки CCR, гидрокрекинг, изомеризация.
            </li>
            <li>
              <strong>Каспийский битумный завод (Актау)</strong> — 1 млн т/год,
              специализация — дорожный битум БНД 60/90, 70/100, ПБВ.
            </li>
          </ul>
          <p className="text-xs text-slate-500">
            Ключевые установки: ELOU (электрообессоливание), ATR (атмосферная
            трубчатка), CDU/VDU (атмосферно-вакуумные колонны), FCC
            (каткрекинг), гидрокрекинг, риформинг, изомеризация.
          </p>
        </section>

        {/* Section 2: РВС */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
          <h2 className="text-xl font-semibold text-cyan-300">
            2. Резервуары РВС (вертикальные стальные)
          </h2>
          <p className="text-sm text-slate-300">
            Типоразмеры по ГОСТ 31385-2016 и СНиП 5.04-25 РК:
          </p>
          <div className="grid md:grid-cols-3 gap-3 text-sm">
            {[
              { v: "РВС-100", h: "5–6 м", d: "4,73 м", use: "АЗС, нефтебазы малые" },
              { v: "РВС-400", h: "6 м", d: "8,5 м", use: "нефтебазы" },
              { v: "РВС-1000", h: "9 м", d: "10,4 м", use: "нефтебазы средние" },
              { v: "РВС-5000", h: "12 м", d: "22,8 м", use: "товарные парки" },
              { v: "РВС-10 000", h: "12 м", d: "34,2 м", use: "магистральные ТП" },
              { v: "РВС-20 000", h: "18 м", d: "39,9 м", use: "крупные парки" },
              { v: "РВС-50 000", h: "18 м", d: "60,7 м", use: "терминалы экспорт" },
              { v: "РВСПК", h: "—", d: "—", use: "плавающая крыша, для лёгких фракций" },
              { v: "РВСП", h: "—", d: "—", use: "понтон, бензин/керосин" },
            ].map((r) => (
              <div
                key={r.v}
                className="rounded-lg border border-slate-700 bg-slate-900/60 p-3"
              >
                <div className="font-semibold text-slate-100">{r.v}</div>
                <div className="text-xs text-slate-400">
                  H: {r.h} · Ø {r.d}
                </div>
                <div className="text-xs text-slate-300 mt-1">{r.use}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: РГС */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">
            3. Резервуары РГС (горизонтальные стальные)
          </h2>
          <p className="text-sm text-slate-300">
            Применяются для СУГ (пропан-бутан), бензина, дизтоплива на АЗС и
            малых нефтебазах. Типоразмеры: 5 / 10 / 25 / 50 / 75 / 100 м³.
            Установка — подземная или надземная на опорах-сёдлах. СН РК
            2.04-29 регламентирует противопожарные расстояния (минимум 15–40 м
            до зданий в зависимости от ёмкости).
          </p>
        </section>

        {/* Section 4: Изотермические */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
          <h2 className="text-xl font-semibold text-indigo-300">
            4. Изотермические резервуары
          </h2>
          <ul className="text-sm text-slate-300 space-y-1 list-disc list-inside">
            <li>
              <strong>СПГ (LNG)</strong> — рабочая температура −162 °C, объём
              до 200 000 м³.
            </li>
            <li>
              <strong>СО₂ жидкий</strong> — −56 °C.
            </li>
            <li>
              <strong>Аммиак (NH₃)</strong> — −33 °C, объём 10–50 тыс. м³.
            </li>
          </ul>
          <p className="text-sm text-slate-400">
            Конструкция: внутренний стальной резервуар (9% Ni-сталь для СПГ),
            наружная преднапряжённая железобетонная оболочка, межстенное
            пространство заполнено перлитом или вспененным стеклом
            (теплопроводность λ ≤ 0,05 Вт/м·К). Заглубление основания на
            свайном поле с электрообогревом грунта.
          </p>
        </section>

        {/* Section 5: Эстакады */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
          <h2 className="text-xl font-semibold text-orange-300">
            5. Эстакады технологических трубопроводов (pipe racks)
          </h2>
          <p className="text-sm text-slate-300">
            Стальные открытые многоярусные конструкции H = 6–8 м с шагом колонн
            6–12 м. Несут технологические, паровые, водяные, кабельные линии.
            Расчёт на сейсмику <strong>8–9 баллов</strong> (для запада РК — зона
            Каспия). Антикоррозийная защита по классу <strong>C5-M</strong>{" "}
            (морская атмосфера) — Zn-грунт 80 мкм + эпоксидная грунтовка 160
            мкм + полиуретановая эмаль 80 мкм.
          </p>
        </section>

        {/* Section 6: Факелы */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
          <h2 className="text-xl font-semibold text-rose-300">
            6. Факельные системы
          </h2>
          <ul className="text-sm text-slate-300 space-y-1 list-disc list-inside">
            <li>
              <strong>Высотные факелы</strong> — H = 80–120 м, диаметр оголовка
              0,8–2,4 м, тросовые оттяжки или самонесущая башня.
            </li>
            <li>
              <strong>Нижние (наземные) факелы</strong> — горизонтальные,
              огороженный контур, для штатных сбросов.
            </li>
            <li>
              Контур безопасности — 60–150 м (по тепловому потоку q ≤ 4,5
              кВт/м²).
            </li>
            <li>
              КИПиА: пилотная горелка, ионизационный контроль пламени, узел
              подачи азота/пара (для бездымного горения), узел сепарации
              жидких фракций (КО — конденсатоотводчик).
            </li>
          </ul>
        </section>

        {/* Section 7: Колонные аппараты */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
          <h2 className="text-xl font-semibold text-violet-300">
            7. Колонные аппараты
          </h2>
          <p className="text-sm text-slate-300">
            Ректификационные / абсорбционные колонны: H до 80 м, Ø 2–6 м,
            рабочее давление 0,1–4,0 МПа. Внутренние устройства — клапанные или
            ситчатые тарелки (40–70 шт.) либо насадка (кольца Рашига, Палля,
            структурированная Mellapak). Теплоизоляция — маты Rockwool 100–200
            мм с оцинкованным кожухом 0,55–0,8 мм. Опора — юбочная стальная,
            крепление на анкерных болтах М48–М72 в свайный ростверк.
          </p>
        </section>

        {/* Section 8: Технологические трубопроводы */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
          <h2 className="text-xl font-semibold text-teal-300">
            8. Технологические трубопроводы
          </h2>
          <ul className="text-sm text-slate-300 space-y-1 list-disc list-inside">
            <li>
              Углеродистая сталь <strong>09Г2С, ст.20</strong> — для нефти,
              газа, пара до +450 °C.
            </li>
            <li>
              Нержавеющая <strong>AISI 316L / 321 (12Х18Н10Т)</strong> — для
              агрессивных сред, кислот, щелочей.
            </li>
            <li>
              Сварка с УЗК / РК-контролем <strong>100 %</strong> для
              ответственных категорий I–III (СН РК 1.03-08).
            </li>
            <li>
              Теплоизоляция: минвата (Rockwool, Paroc), пеностекло
              (Foamglas), фольгированные маты.
            </li>
            <li>
              Антикоррозийное покрытие, гидроиспытания на 1,25–1,5 Pраб.
            </li>
          </ul>
        </section>

        {/* Section 9: Бенчмарки РК */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
          <h2 className="text-xl font-semibold text-yellow-300">
            9. Бенчмарки РК — мегапроекты
          </h2>
          <ul className="text-sm text-slate-300 space-y-2 list-disc list-inside">
            <li>
              <strong>Тенгизшевройл, проект FGP (Future Growth Project)</strong>{" "}
              — $45 млрд, завершён 2024–2025, расширение добычи до 39 млн т/год.
            </li>
            <li>
              <strong>Кашаган</strong> — морское месторождение, искусственный
              остров D, КПК.
            </li>
            <li>
              <strong>Карачаганакский конденсатопровод</strong> — экспорт КГПЗ,
              КТК-Расширение.
            </li>
            <li>
              <strong>Каспийский битумный завод</strong> — модернизация
              2022–2024.
            </li>
            <li>
              <strong>Атырауский комплекс ПКЛ, MTBE, ароматики</strong> — 2020-е.
            </li>
            <li>
              Себестоимость НПЗ <strong>6 млн т/год = $3–5 млрд</strong>{" "}
              (~1,5–2,5 трлн тг по курсу 500 тг/USD).
            </li>
            <li>
              Себестоимость <strong>РВС-5000 м³</strong> с обвалованием,
              понтоном и КИПиА — ~4,5–5,5 млрд тг (на 2025 г.).
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
              1. Сколько действующих НПЗ в Казахстане?
            </p>
            <div className="grid md:grid-cols-2 gap-2">
              {[
                { k: "a", t: "1" },
                { k: "b", t: "2" },
                { k: "c", t: "4 — Атырау, Павлодар, Шымкент, Каспийский битумный" },
                { k: "d", t: "7" },
              ].map((o) => (
                <button
                  key={o.k}
                  onClick={() => {
                    setEx1Pick(o.k);
                    checkMcq(o.k, "c", setEx1);
                  }}
                  className={optionClass(ex1, ex1Pick, o.k, "c")}
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
                ✓ Верно. Четыре основных НПЗ обеспечивают всю переработку нефти
                в РК.
              </p>
            )}
            {ex1 === "wrong" && (
              <p className="text-rose-300 text-sm">
                ✗ Неверно. Правильный ответ — c) 4 НПЗ.
              </p>
            )}
          </div>

          {/* EX2 */}
          <div className="space-y-3">
            <p className="font-semibold text-slate-100">
              2. Какой объём типового резервуара РВС применяется для нефтебазы
              средней мощности?
            </p>
            <div className="grid md:grid-cols-2 gap-2">
              {[
                { k: "a", t: "РВС-100 м³" },
                { k: "b", t: "РВС-5000 или РВС-10 000 м³" },
                { k: "c", t: "РВС-100 000 м³" },
                { k: "d", t: "РВС-500 000 м³" },
              ].map((o) => (
                <button
                  key={o.k}
                  onClick={() => {
                    setEx2Pick(o.k);
                    checkMcq(o.k, "b", setEx2);
                  }}
                  className={optionClass(ex2, ex2Pick, o.k, "b")}
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
                ✓ Верно. РВС-5000 и РВС-10 000 м³ — рабочая лошадка товарных
                парков и нефтебаз средней мощности.
              </p>
            )}
            {ex2 === "wrong" && (
              <p className="text-rose-300 text-sm">
                ✗ Неверно. Стандартные объёмы для нефтебаз — РВС-5000 / 10 000
                м³.
              </p>
            )}
          </div>

          {/* EX3 */}
          <div className="space-y-3">
            <p className="font-semibold text-slate-100">
              3. Резервуарный парк состоит из <strong>12 шт. РВС-5000 м³</strong>.
              Себестоимость одного резервуара под ключ (с обвалованием, КИПиА,
              понтоном, противопожарной системой) — <strong>5 млрд тг</strong>.
              Какова общая стоимость парка в тенге?
            </p>
            <p className="text-xs text-slate-500">
              Подсказка: 12 × 5 000 000 000 = ?
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
                ✓ Верно. 12 × 5 млрд = <strong>60 млрд тг</strong> (~$120 млн
                по курсу 500 тг/USD).
              </p>
            )}
            {ex3 === "wrong" && (
              <p className="text-rose-300 text-sm">
                ✗ Не совпадает. Ожидаемый ответ ≈ 60 000 000 000 тг (60 млрд).
              </p>
            )}
          </div>

          {/* EX4 */}
          <div className="space-y-3">
            <p className="font-semibold text-slate-100">
              4. Что такое <strong>плавающая крыша</strong> резервуара РВСПК?
            </p>
            <div className="grid md:grid-cols-1 gap-2">
              {[
                { k: "a", t: "Декоративная крыша для архитектурного оформления." },
                { k: "b", t: "Разборная крыша, демонтируемая на время ремонта." },
                { k: "c", t: "Светопропускающий фонарь для естественного освещения." },
                {
                  k: "d",
                  t: "Внутренняя крыша на поплавках, перемещающаяся вертикально по уровню нефти — уменьшает испарения лёгких фракций и риск возгорания.",
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
                ✓ Верно. Плавающая крыша (РВСПК) лежит непосредственно на
                поверхности нефтепродукта и движется с её уровнем, исключая
                паровое пространство — снижает потери от «дыхания» резервуара
                на 80–95 %.
              </p>
            )}
            {ex4 === "wrong" && (
              <p className="text-rose-300 text-sm">
                ✗ Неверно. Правильный ответ — d).
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
