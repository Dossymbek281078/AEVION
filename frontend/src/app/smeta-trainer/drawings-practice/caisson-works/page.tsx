"use client";

import Link from "next/link";
import { useState } from "react";

export default function CaissonWorksPage() {
  const [ex1, setEx1] = useState<string | null>(null);
  const [ex2, setEx2] = useState<string | null>(null);
  const [ex3, setEx3] = useState<string>("");
  const [ex3Submitted, setEx3Submitted] = useState(false);
  const [ex4, setEx4] = useState<string | null>(null);

  const ex3Value = parseFloat(ex3.replace(/[\s,]/g, ""));
  const ex3Correct = !isNaN(ex3Value) && Math.abs(ex3Value - 11500000) <= 800000;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300 hover:text-blue-200 transition">← К разделам</Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Кессонные работы</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🌊 Кессонные и подводные работы</h1>
          <p className="mt-3 text-slate-400 max-w-3xl leading-relaxed">
            Кессонные, опускные и подводные технологии применяются при устройстве опор мостов, КНС, шахт метро,
            гидротехнических сооружений и портовых причалов. Это специальный раздел сметного дела РК, требующий знания
            ЭСН Сб.45 (водолазные работы), СНиП РК 5.01-101 (шпунтовые ограждения) и нормативов по водопонижению.
          </p>
        </section>

        {/* 1. Что такое кессон */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">1. Что такое кессон</h2>
          <p className="mt-3 text-slate-300 leading-relaxed">
            <strong>Кессон</strong> — это герметичная железобетонная или металлическая конструкция, в которую подаётся
            сжатый воздух под избыточным давлением. Это давление вытесняет грунтовую воду из рабочей камеры и позволяет
            производить разработку грунта насухо на глубинах до 30–40 м. Применяется при строительстве:
          </p>
          <ul className="mt-3 ml-6 list-disc text-slate-400 space-y-1">
            <li>опор мостов в руслах рек (мосты через Иртыш, Урал, Сырдарью)</li>
            <li>фундаментов гидротехнических сооружений (плотины, причалы)</li>
            <li>шахт глубокого заложения, тоннелей метрополитена</li>
            <li>КНС и водозаборов на больших глубинах</li>
          </ul>
        </section>

        {/* 2. Опускные колодцы */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">2. Опускные колодцы</h2>
          <p className="mt-3 text-slate-300 leading-relaxed">
            <strong>Опускной колодец</strong> — железобетонная монолитная или сборная конструкция (цилиндр, прямоугольник),
            которая погружается в грунт под собственным весом по мере разработки грунта внутри. По мере опускания
            стенки наращиваются сверху. Толщина стенки 0,6–1,5 м, диаметр от 4 до 30 м.
          </p>
          <p className="mt-3 text-slate-400 text-sm">
            Применение в РК: канализационные насосные станции (КНС) Атырау, Шымкент; шахты лифтов и эскалаторов в метро Алматы;
            фундаменты под опоры мостов и эстакад.
          </p>
        </section>

        {/* 3. Шпунтовые ограждения */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">3. Шпунтовые ограждения котлованов</h2>
          <p className="mt-3 text-slate-300 leading-relaxed">
            Стальной шпунт — основное средство ограждения глубоких котлованов в обводнённых грунтах. Профили:
          </p>
          <ul className="mt-3 ml-6 list-disc text-slate-400 space-y-1">
            <li><strong>Larssen L4, L5, L607</strong> — корытного типа, наиболее распространён в РК</li>
            <li><strong>AZ-серия</strong> (ArcelorMittal) — Z-образный профиль, повышенная жёсткость</li>
            <li><strong>Омега-профили</strong> — для лёгких ограждений</li>
          </ul>
          <p className="mt-3 text-slate-400 text-sm">
            Погружение: вибропогружатели ICE, PVE; ударная забивка дизель-молотом для плотных грунтов.
            Нормативная база — СНиП РК 5.01-101 «Свайные фундаменты».
          </p>
        </section>

        {/* 4. Подводное бетонирование ВПТ */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">4. Подводное бетонирование</h2>
          <p className="mt-3 text-slate-300 leading-relaxed">
            <strong>Метод ВПТ</strong> (вертикально-перемещающаяся труба) — основной способ укладки бетона под водой.
            Бетонолитная труба Ø 200–300 мм опускается до дна, верх трубы поднимают по мере набора бетона так, чтобы
            нижний конец был погружён в свежий бетон не менее чем на 1,2 м. Это исключает контакт нового бетона с водой
            и вымывание цемента.
          </p>
          <p className="mt-3 text-slate-400 text-sm">
            Бетон: класс не ниже В30, ОК 18–22 см, добавка против вымывания цемента (Cofradry, Sika UCS). Применяется при
            устройстве буросекущихся свай, фундаментов опор мостов, заделке днищ опускных колодцев.
          </p>
        </section>

        {/* 5. Водопонижение */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">5. Строительное водопонижение</h2>
          <p className="mt-3 text-slate-300 leading-relaxed">
            Понижение уровня грунтовых вод (УГВ) для работы в сухом котловане:
          </p>
          <ul className="mt-3 ml-6 list-disc text-slate-400 space-y-1">
            <li><strong>Иглофильтры</strong> ЛИУ-6, УВВ-3А — понижение УГВ до 4–5 м одним ярусом</li>
            <li><strong>Глубинные насосы</strong> Grundfos SP, Pleuger — понижение до 15 м и более</li>
            <li><strong>Эжекторные иглофильтры</strong> ЭИ — для слабопроницаемых грунтов</li>
          </ul>
          <p className="mt-3 text-slate-400 text-sm">
            Нормативы: СНиП РК 1.02-08 «Инженерные изыскания», СП РК 5.01-102 «Земляные работы».
          </p>
        </section>

        {/* 6. Водолазные работы */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">6. Водолазные работы — ЭСН Сб.45</h2>
          <p className="mt-3 text-slate-300 leading-relaxed">
            Все подводные работы в РК расцениваются по <strong>сборнику ЭСН №45 «Подводно-технические (водолазные) работы»</strong>.
            Классы водолазов:
          </p>
          <ul className="mt-3 ml-6 list-disc text-slate-400 space-y-1">
            <li><strong>Водолаз 3 класса</strong> — глубины до 20 м, простые работы</li>
            <li><strong>Водолаз 2 класса</strong> — глубины до 45 м, сварка, резка, бетонирование</li>
            <li><strong>Водолаз 1 класса</strong> — глубины свыше 45 м, аварийно-спасательные работы</li>
          </ul>
          <p className="mt-3 text-slate-400 text-sm">
            Схемы снабжения: поверхностное (шланговое) и автономное (акваланг). Лицензирование — Постановление Правительства РК №340.
          </p>
        </section>

        {/* 7. Опоры мостов */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">7. Фундаменты опор мостов</h2>
          <p className="mt-3 text-slate-300 leading-relaxed">
            Типовые решения для русловых и пойменных опор мостов в РК:
          </p>
          <ul className="mt-3 ml-6 list-disc text-slate-400 space-y-1">
            <li><strong>Буросекущиеся сваи</strong> Ø 1000–2000 мм, глубина 25–60 м, бетонирование методом ВПТ</li>
            <li><strong>Опускные колодцы</strong> под русловые опоры больших мостов</li>
            <li><strong>Ростверки</strong> монолитные ж/б, объединяющие свайное поле</li>
            <li><strong>Кессоны</strong> для опор на глубинах с плотными несжимаемыми грунтами</li>
          </ul>
        </section>

        {/* 8. Безопасность */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">8. Безопасность и декомпрессия</h2>
          <p className="mt-3 text-slate-300 leading-relaxed">
            Работа в условиях избыточного давления требует строгого соблюдения режимов декомпрессии (таблицы ВМФ, ГОСТ Р).
            Риски:
          </p>
          <ul className="mt-3 ml-6 list-disc text-slate-400 space-y-1">
            <li><strong>Кессонная (декомпрессионная) болезнь</strong> — при быстром подъёме на поверхность</li>
            <li><strong>Баротравма</strong> уха, лёгких при резком перепаде давления</li>
            <li><strong>Азотное опьянение</strong> на глубинах свыше 30 м</li>
          </ul>
          <p className="mt-3 text-slate-400 text-sm">
            Обязательно: барокамера на объекте, медицинский контроль до и после смены, страхование водолазов.
          </p>
        </section>

        {/* 9. Бенчмарки РК */}
        <section className="rounded-2xl border border-blue-900/40 bg-blue-950/20 p-6">
          <h2 className="text-xl font-semibold text-blue-200">9. Бенчмарки РК (2024–2026)</h2>
          <ul className="mt-3 ml-6 list-disc text-slate-300 space-y-2">
            <li>Подводное бетонирование методом ВПТ — <strong>35 000–65 000 тг/м³</strong> (зависит от глубины, удалённости)</li>
            <li>Шпунт Larssen L5, погружение вибропогружателем — <strong>95 000–145 000 тг/м²</strong></li>
            <li>Водолазные работы (поверхностное снабжение) — <strong>28 000–55 000 тг/ч</strong> рабочего времени водолаза</li>
            <li>Опускной колодец Ø 8 м, глубина 12 м (КНС) — <strong>120–180 млн тг</strong> «под ключ»</li>
            <li>Иглофильтровое водопонижение, аренда комплекта ЛИУ-6 — <strong>450 000–680 000 тг/мес</strong></li>
          </ul>
          <p className="mt-3 text-blue-300/80 text-sm">
            Объекты-референсы: мост через Иртыш в Семее, мост через Урал в Атырау, мост через Сырдарью в Кызылорде,
            КНС-1 Атырау, тоннели метро Алматы (станции «Райымбек батыра», «Жибек жолы»).
          </p>
        </section>

        {/* === Упражнения === */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-50">🧠 Проверь себя</h2>

          {/* Ex1 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <p className="font-semibold text-slate-100">Задача 1. Что такое метод ВПТ при подводном бетонировании?</p>
            <div className="mt-4 space-y-2">
              {[
                { k: "a", t: "Вибропогружение бетонной смеси" },
                { k: "b", t: "Вакуумное всасывание воды из опалубки" },
                { k: "c", t: "Вертикально-перемещающаяся труба для подачи бетона без вымывания цемента" },
                { k: "d", t: "Винтовое прессование бетона под давлением" },
              ].map((opt) => {
                const selected = ex1 === opt.k;
                const correct = opt.k === "c";
                const showResult = ex1 !== null;
                return (
                  <button
                    key={opt.k}
                    onClick={() => setEx1(opt.k)}
                    className={`block w-full text-left px-4 py-2 rounded-lg border transition ${
                      showResult && selected && correct
                        ? "border-emerald-500 bg-emerald-900/30 text-emerald-100"
                        : showResult && selected && !correct
                        ? "border-rose-500 bg-rose-900/30 text-rose-100"
                        : showResult && correct
                        ? "border-emerald-700/50 bg-emerald-900/10 text-emerald-200"
                        : "border-slate-700 bg-slate-800/40 text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    <span className="font-mono text-xs mr-2 text-slate-500">{opt.k})</span>
                    {opt.t}
                  </button>
                );
              })}
            </div>
            {ex1 !== null && (
              <p className={`mt-3 text-sm ${ex1 === "c" ? "text-emerald-300" : "text-rose-300"}`}>
                {ex1 === "c"
                  ? "✓ Верно. ВПТ — вертикально-перемещающаяся труба, нижний конец всегда в свежем бетоне, что исключает контакт с водой."
                  : "✗ Неверно. Правильный ответ — c) вертикально-перемещающаяся труба."}
              </p>
            )}
          </div>

          {/* Ex2 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <p className="font-semibold text-slate-100">Задача 2. По какому сборнику ЭСН РК расцениваются водолазные работы?</p>
            <div className="mt-4 space-y-2">
              {[
                { k: "a", t: "Сб.36 «Земляные работы»" },
                { k: "b", t: "Сб.45 «Подводно-технические (водолазные) работы»" },
                { k: "c", t: "Сб.30 «Мосты и трубы»" },
                { k: "d", t: "Сб.9 «Строительные металлические конструкции»" },
              ].map((opt) => {
                const selected = ex2 === opt.k;
                const correct = opt.k === "b";
                const showResult = ex2 !== null;
                return (
                  <button
                    key={opt.k}
                    onClick={() => setEx2(opt.k)}
                    className={`block w-full text-left px-4 py-2 rounded-lg border transition ${
                      showResult && selected && correct
                        ? "border-emerald-500 bg-emerald-900/30 text-emerald-100"
                        : showResult && selected && !correct
                        ? "border-rose-500 bg-rose-900/30 text-rose-100"
                        : showResult && correct
                        ? "border-emerald-700/50 bg-emerald-900/10 text-emerald-200"
                        : "border-slate-700 bg-slate-800/40 text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    <span className="font-mono text-xs mr-2 text-slate-500">{opt.k})</span>
                    {opt.t}
                  </button>
                );
              })}
            </div>
            {ex2 !== null && (
              <p className={`mt-3 text-sm ${ex2 === "b" ? "text-emerald-300" : "text-rose-300"}`}>
                {ex2 === "b"
                  ? "✓ Верно. Сб.45 — специализированный сборник для всех подводно-технических работ в РК."
                  : "✗ Неверно. Правильный ответ — b) Сб.45."}
              </p>
            )}
          </div>

          {/* Ex3 numeric */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <p className="font-semibold text-slate-100">Задача 3. Расчёт стоимости шпунтового ограждения</p>
            <p className="mt-2 text-slate-300 text-sm leading-relaxed">
              Периметр котлована — <strong>100 м</strong>. Применяется шпунт Larssen глубиной <strong>1 м</strong> (упрощение для расчёта).
              Цена погружённого шпунта — <strong>115 000 тг/м²</strong>. Какова общая стоимость шпунтового ограждения?
            </p>
            <div className="mt-4 flex flex-wrap gap-3 items-center">
              <input
                type="text"
                inputMode="numeric"
                value={ex3}
                onChange={(e) => {
                  setEx3(e.target.value);
                  setEx3Submitted(false);
                }}
                placeholder="введите сумму в тенге"
                className="flex-1 min-w-[220px] px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={() => setEx3Submitted(true)}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition"
              >
                Проверить
              </button>
            </div>
            {ex3Submitted && (
              <p className={`mt-3 text-sm ${ex3Correct ? "text-emerald-300" : "text-rose-300"}`}>
                {ex3Correct
                  ? "✓ Верно. 100 м × 1 м × 115 000 тг/м² = 11 500 000 тг."
                  : "✗ Не сходится. Расчёт: периметр × глубина × цена = 100 × 1 × 115 000 = 11 500 000 тг."}
              </p>
            )}
          </div>

          {/* Ex4 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <p className="font-semibold text-slate-100">Задача 4. Что такое опускной колодец?</p>
            <div className="mt-4 space-y-2">
              {[
                { k: "a", t: "Ж/б монолитная или сборная конструкция, погружающаяся под собственным весом по мере разработки грунта внутри" },
                { k: "b", t: "Скважина для водозабора из подземных горизонтов" },
                { k: "c", t: "Сборный канализационный колодец КК-1000" },
                { k: "d", t: "Водозаборный колодец-каптаж родниковой воды" },
              ].map((opt) => {
                const selected = ex4 === opt.k;
                const correct = opt.k === "a";
                const showResult = ex4 !== null;
                return (
                  <button
                    key={opt.k}
                    onClick={() => setEx4(opt.k)}
                    className={`block w-full text-left px-4 py-2 rounded-lg border transition ${
                      showResult && selected && correct
                        ? "border-emerald-500 bg-emerald-900/30 text-emerald-100"
                        : showResult && selected && !correct
                        ? "border-rose-500 bg-rose-900/30 text-rose-100"
                        : showResult && correct
                        ? "border-emerald-700/50 bg-emerald-900/10 text-emerald-200"
                        : "border-slate-700 bg-slate-800/40 text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    <span className="font-mono text-xs mr-2 text-slate-500">{opt.k})</span>
                    {opt.t}
                  </button>
                );
              })}
            </div>
            {ex4 !== null && (
              <p className={`mt-3 text-sm ${ex4 === "a" ? "text-emerald-300" : "text-rose-300"}`}>
                {ex4 === "a"
                  ? "✓ Верно. Опускной колодец погружается под собственным весом — это его принципиальное отличие от обычных колодцев."
                  : "✗ Неверно. Правильный ответ — a) ж/б конструкция, опускающаяся под собственным весом."}
              </p>
            )}
          </div>
        </section>

        <div className="pt-6 border-t border-slate-800 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300 hover:text-blue-200 transition">
            ← Вернуться к разделам
          </Link>
          <div className="text-xs text-slate-600">Модуль #175 · Кессонные работы</div>
        </div>
      </main>
    </div>
  );
}
