"use client";
import Link from "next/link";
import { useState } from "react";

export default function TunnelingWorksPage() {
  const [ex1, setEx1] = useState<string | null>(null);
  const [ex2, setEx2] = useState<string | null>(null);
  const [ex3, setEx3] = useState<string>("");
  const [ex3Checked, setEx3Checked] = useState<boolean>(false);
  const [ex4, setEx4] = useState<string | null>(null);

  const ex3Value = Number(ex3.replace(/[\s_]/g, ""));
  const ex3Correct = !Number.isNaN(ex3Value) && Math.abs(ex3Value - 113_000_000_000) <= 10_000_000_000;

  const optionClass = (selected: string | null, value: string, correct: string) => {
    if (!selected) return "border-slate-700 hover:border-slate-500 bg-slate-900/60";
    if (value === correct) return "border-emerald-500 bg-emerald-500/10 text-emerald-100";
    if (value === selected) return "border-rose-500 bg-rose-500/10 text-rose-100";
    return "border-slate-800 bg-slate-900/40 text-slate-400";
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300 hover:text-blue-200 transition">← К разделам</Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Тоннелепроходка</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🚇 Тоннелепроходка (TBM, НАТМ, микротоннели)</h1>
          <p className="mt-3 text-slate-400 max-w-3xl leading-relaxed">
            Подземные работы — один из самых дорогих и технологически сложных разделов сметы. Сметчик должен различать
            методы проходки (открытый, щитовой TBM, НАТМ, микротоннелирование), типы обделки и комплекс вспомогательных
            работ (водопонижение, замораживание, цементация). Модуль ориентирован на объекты РК: метро Алматы, гидротехнические
            тоннели, коллекторы и переходы под автодорогами и реками.
          </p>
        </section>

        {/* Section 1: Методы проходки */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">1. Методы проходки</h2>
          <ul className="mt-4 space-y-2 text-slate-300 text-sm leading-relaxed">
            <li><b className="text-slate-100">Открытый способ (cut &amp; cover)</b> — котлован с креплением стен, монтаж конструкции, обратная засыпка. До 15–20 м глубины. Дёшево, но требует освобождения трассы.</li>
            <li><b className="text-slate-100">Щитовая проходка (TBM — Tunnel Boring Machine)</b> — механизированный комплекс с ротором-фрезой, монтажом тюбингов в защите хвостовой части щита.</li>
            <li><b className="text-slate-100">НАТМ (Новый Австрийский Метод)</b> — поэтапная разработка с временной крепью (набрызг-бетон + анкеры + сетка) и последующей капитальной обделкой. Применяется в скальных и полускальных грунтах.</li>
            <li><b className="text-slate-100">Микротоннелирование</b> — продавливание стальных/ж/б труб Ø 500–3000 мм на длину до 1000 м. Для коллекторов, дюкеров, подходов под дороги и реки.</li>
          </ul>
        </section>

        {/* Section 2: TBM EPB */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">2. TBM EPB (Earth Pressure Balance)</h2>
          <p className="mt-3 text-slate-300 text-sm leading-relaxed">
            Щит с уравновешиванием давления грунта в забое — применяется в мягких связных грунтах (глины, суглинки, супеси).
            Грунт, разрабатываемый ротором, удерживает забой собственным давлением и выгружается через шнековый конвейер
            с регулируемой производительностью.
          </p>
          <ul className="mt-3 space-y-1 text-slate-400 text-sm">
            <li>• Диаметр от 3 до 17.6 м (рекорд — Bertha, Seattle SR-99, Hitachi Zosen).</li>
            <li>• Скорость проходки 8–15 м/сутки в благоприятных условиях.</li>
            <li>• Производители: Herrenknecht (Германия), Robbins (США), Mitsubishi/Hitachi (Япония), CREG (Китай).</li>
            <li>• Длина тоннелепроходческого комплекса 80–150 м (щит + back-up trolleys).</li>
          </ul>
        </section>

        {/* Section 3: TBM Slurry */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">3. TBM Slurry (гидропригруз)</h2>
          <p className="mt-3 text-slate-300 text-sm leading-relaxed">
            Для водонасыщенных песков, плывунов и подрусловых участков. В забой подаётся бентонитовая суспензия
            под избыточным давлением, удерживающая стенки и фильтрующая воду. Разработанный шлам откачивается по
            пульпопроводу на сепарационную станцию на поверхности, где отделяется песок и регенерируется бентонит.
          </p>
          <ul className="mt-3 space-y-1 text-slate-400 text-sm">
            <li>• Сепарация: гидроциклоны, виброгрохоты, центрифуги.</li>
            <li>• Расход бентонита 50–80 кг/м³ суспензии.</li>
            <li>• Применение: подводные тоннели, метро под реками (Темза, Сена, Или).</li>
          </ul>
        </section>

        {/* Section 4: НАТМ */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">4. НАТМ — Новый Австрийский Метод</h2>
          <p className="mt-3 text-slate-300 text-sm leading-relaxed">
            Поэтапная разработка забоя (top heading + bench + invert) с устройством временной крепи и последующей
            капитальной обделкой. Основан на принципе включения породного массива в работу несущей системы.
          </p>
          <ul className="mt-3 space-y-1 text-slate-400 text-sm">
            <li>• <b className="text-slate-200">Временная крепь:</b> набрызг-бетон C25/30 толщиной 100–250 мм + анкеры SN/IBO/Swellex длиной 3–6 м + арматурная сетка Ø 6–8 мм + стальные арки (lattice girders или двутавр).</li>
            <li>• <b className="text-slate-200">Постоянная обделка:</b> монолитный ж/б 350–500 мм с гидроизоляцией (ПВХ-мембрана + геотекстиль).</li>
            <li>• Шаг заходки 1.0–2.5 м в зависимости от категории породы (RMR/Q-system).</li>
            <li>• Применяется в скальных и полускальных грунтах, для станций метро мелкого заложения сложной формы.</li>
          </ul>
        </section>

        {/* Section 5: Обделка */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">5. Обделка тоннеля</h2>
          <div className="mt-3 grid md:grid-cols-3 gap-4 text-sm">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="text-slate-100 font-semibold">Тюбинги (TBM)</div>
              <div className="mt-2 text-slate-400">Сборные ж/б сегменты 1.5×1.5 м, толщина 300–400 мм. Кольцо из 6–8 сегментов + замковый. Монтируются эректором в защите хвостовой части щита, болтовые/штифтовые соединения, ЭПДМ-уплотнения.</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="text-slate-100 font-semibold">Монолитная ж/б (НАТМ)</div>
              <div className="mt-2 text-slate-400">Бетон C25/30…C40/50, толщина 350–500 мм, армирование Ø 16–25 А500С. Опалубка передвижная секционная, шаг бетонирования 10–12 м.</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="text-slate-100 font-semibold">Сборные блоки</div>
              <div className="mt-2 text-slate-400">Для коллекторов и небольших тоннелей — сборные ж/б блоки или чугунные тюбинги (исторические станции метро). Применяются всё реже.</div>
            </div>
          </div>
        </section>

        {/* Section 6: Микротоннелирование */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">6. Микротоннелирование</h2>
          <p className="mt-3 text-slate-300 text-sm leading-relaxed">
            Продавливание стальных или ж/б труб Ø 500–3000 мм с дистанционно управляемым микрощитом. Из стартового
            котлована труба за трубой задавливается домкратами в массив. Применяется для коллекторов канализации,
            водопроводов, дюкеров, газопроводов, переходов под автодорогами, ж/д и реками.
          </p>
          <ul className="mt-3 space-y-1 text-slate-400 text-sm">
            <li>• Длина участка между котлованами до 200–1000 м (с промежуточными домкратными станциями).</li>
            <li>• Точность позиционирования ±25 мм по лазерному ведению.</li>
            <li>• Производители: Herrenknecht AVN, Iseki Unclemole, Akkerman.</li>
            <li>• Без вскрытия дорожного покрытия — критично для городов и охраняемых зон.</li>
          </ul>
        </section>

        {/* Section 7: Вспомогательные работы */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">7. Вспомогательные работы и закрепление грунтов</h2>
          <ul className="mt-3 space-y-1 text-slate-300 text-sm leading-relaxed">
            <li>• <b className="text-slate-100">Водопонижение</b> — иглофильтры, эжекторные системы, скважины-водопонизители с погружными насосами.</li>
            <li>• <b className="text-slate-100">Замораживание грунта</b> — азотное (жидкий N₂, −196 °C, локально и быстро) или рассольное (CaCl₂, −25 °C, для длительных проектов).</li>
            <li>• <b className="text-slate-100">Химическое закрепление</b> — jet-grouting (струйная цементация), силикатизация, смолизация. Колонны Ø 600–2000 мм.</li>
            <li>• <b className="text-slate-100">Компенсационное цементирование</b> — закачка раствора между тоннелем и охраняемыми зданиями для компенсации осадок.</li>
            <li>• <b className="text-slate-100">Геомониторинг</b> — нивелирование марок, инклинометры, экстензометры, мониторинг зданий в зоне влияния.</li>
          </ul>
        </section>

        {/* Section 8: Безопасность и вентиляция */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">8. Безопасность и вентиляция</h2>
          <ul className="mt-3 space-y-1 text-slate-300 text-sm leading-relaxed">
            <li>• <b className="text-slate-100">ВПС вентиляция</b> — приток ≥ 6 м³/с на 100 м тоннеля, гибкие воздуховоды Ø 1000–1800 мм, осевые вентиляторы 75–250 кВт.</li>
            <li>• <b className="text-slate-100">Газоанализ</b> — стационарные и носимые анализаторы CH₄, CO, H₂S, O₂. Тревожные пороги: CH₄ 1.0%, CO 20 ppm, H₂S 10 ppm.</li>
            <li>• <b className="text-slate-100">Нормативная база РК:</b> СНиП РК 5.04-27 «Подземные горные выработки», ППБ для тоннелей, EN 1997/EN 12110 (TBM safety).</li>
            <li>• <b className="text-slate-100">Аварийные средства</b> — спасательные капсулы (refuge chambers), самоспасатели изолирующие СПИ-50, эвакуационные тележки.</li>
            <li>• <b className="text-slate-100">Освещение</b> — рабочее 50 лк, эвакуационное 5 лк, светильники во взрывозащищённом исполнении при наличии метана.</li>
          </ul>
        </section>

        {/* Section 9: Бенчмарки РК */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-slate-100">9. Бенчмарки РК</h2>
          <div className="mt-3 grid md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="text-slate-100 font-semibold">Метро Алматы</div>
              <div className="mt-2 text-slate-400">9 станций, 11.3 км глубокого заложения. ТБМ Lovat (Канада) Ø 6.4 м, EPB. Запуск 1-й очереди 2011 г., продление 2015/2022. Себестоимость ~ 8–15 млрд тг/км в ценах разных лет.</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="text-slate-100 font-semibold">Шу-Балхашский тоннель</div>
              <div className="mt-2 text-slate-400">Гидротехнический канал переброски стока. НАТМ + cut &amp; cover на отдельных участках.</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="text-slate-100 font-semibold">Мойнакская ГЭС</div>
              <div className="mt-2 text-slate-400">Деривационный тоннель Ø 5.4 м, длина ~ 9.2 км в скальных грунтах. НАТМ с набрызг-бетонной крепью и ж/б обделкой.</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="text-slate-100 font-semibold">Ж/д тоннели Шар — Усть-Каменогорск</div>
              <div className="mt-2 text-slate-400">Реконструкция перегонных тоннелей буро-взрывным способом и НАТМ. Длины 0.4–1.5 км.</div>
            </div>
          </div>
        </section>

        {/* Exercises */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-50">🎯 Упражнения</h2>

          {/* Ex 1 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <div className="text-slate-100 font-semibold">Упражнение 1. Что такое TBM EPB?</div>
            <div className="mt-3 space-y-2">
              {[
                { v: "a", label: "НАТМ метод с анкерами" },
                { v: "b", label: "Earth Pressure Balance — TBM с уравновешиванием давления грунта в забое для мягких грунтов" },
                { v: "c", label: "Микротоннелирование" },
                { v: "d", label: "Cut & cover (открытый способ)" },
              ].map((o) => (
                <button
                  key={o.v}
                  onClick={() => setEx1(o.v)}
                  className={`w-full text-left rounded-lg border px-4 py-3 text-sm transition ${optionClass(ex1, o.v, "b")}`}
                >
                  <span className="font-mono mr-2 text-slate-500">{o.v})</span> {o.label}
                </button>
              ))}
            </div>
            {ex1 && (
              <div className={`mt-3 text-sm ${ex1 === "b" ? "text-emerald-300" : "text-rose-300"}`}>
                {ex1 === "b"
                  ? "Верно. EPB удерживает давление грунта в забойной камере и выгружает разработанный материал шнеком."
                  : "Неверно. Правильный ответ — b) Earth Pressure Balance."}
              </div>
            )}
          </div>

          {/* Ex 2 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <div className="text-slate-100 font-semibold">Упражнение 2. Какая обделка применяется в TBM-проходке?</div>
            <div className="mt-3 space-y-2">
              {[
                { v: "a", label: "Арматурная сетка + набрызг-бетон" },
                { v: "b", label: "Монолитная ж/б крепь 350 мм" },
                { v: "c", label: "Сборные ж/б тюбинги (сегменты кольца), монтируемые в защите щита" },
                { v: "d", label: "Деревянные крепи" },
              ].map((o) => (
                <button
                  key={o.v}
                  onClick={() => setEx2(o.v)}
                  className={`w-full text-left rounded-lg border px-4 py-3 text-sm transition ${optionClass(ex2, o.v, "c")}`}
                >
                  <span className="font-mono mr-2 text-slate-500">{o.v})</span> {o.label}
                </button>
              ))}
            </div>
            {ex2 && (
              <div className={`mt-3 text-sm ${ex2 === "c" ? "text-emerald-300" : "text-rose-300"}`}>
                {ex2 === "c"
                  ? "Верно. TBM монтирует сборные ж/б тюбинги эректором сразу за щитом."
                  : "Неверно. Правильный ответ — c) сборные ж/б тюбинги."}
              </div>
            )}
          </div>

          {/* Ex 3 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <div className="text-slate-100 font-semibold">
              Упражнение 3. Метро Алматы — 11.3 км при средней себестоимости 10 млрд тг/км.
              Какова ориентировочная сметная стоимость (тг)?
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input
                inputMode="numeric"
                value={ex3}
                onChange={(e) => { setEx3(e.target.value); setEx3Checked(false); }}
                placeholder="например: 113000000000"
                className="w-72 rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none"
              />
              <button
                onClick={() => setEx3Checked(true)}
                className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-medium text-white transition"
              >
                Проверить
              </button>
              <span className="text-xs text-slate-500">допуск ± 10 млрд тг</span>
            </div>
            {ex3Checked && ex3 !== "" && (
              <div className={`mt-3 text-sm ${ex3Correct ? "text-emerald-300" : "text-rose-300"}`}>
                {ex3Correct
                  ? "Верно. 11.3 × 10 000 000 000 = 113 000 000 000 тг ≈ 113 млрд тг."
                  : "Неверно. Ожидается ≈ 113 000 000 000 тг (113 млрд тг)."}
              </div>
            )}
          </div>

          {/* Ex 4 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <div className="text-slate-100 font-semibold">
              Упражнение 4. Какой метод подходит для прокладки коллектора Ø 1200 мм под автодорогой длиной 200 м?
            </div>
            <div className="mt-3 space-y-2">
              {[
                { v: "a", label: "НАТМ" },
                { v: "b", label: "TBM EPB" },
                { v: "c", label: "Cut & cover" },
                { v: "d", label: "Микротоннелирование (продавливание ж/б труб)" },
              ].map((o) => (
                <button
                  key={o.v}
                  onClick={() => setEx4(o.v)}
                  className={`w-full text-left rounded-lg border px-4 py-3 text-sm transition ${optionClass(ex4, o.v, "d")}`}
                >
                  <span className="font-mono mr-2 text-slate-500">{o.v})</span> {o.label}
                </button>
              ))}
            </div>
            {ex4 && (
              <div className={`mt-3 text-sm ${ex4 === "d" ? "text-emerald-300" : "text-rose-300"}`}>
                {ex4 === "d"
                  ? "Верно. Для коротких переходов под дорогами Ø ≤ 3 м микротоннелирование оптимально: без вскрытия покрытия, быстро, точно."
                  : "Неверно. Для коллектора Ø 1200 мм длиной 200 м под автодорогой оптимально микротоннелирование (d)."}
              </div>
            )}
          </div>
        </section>

        <div className="pt-6 text-center text-xs text-slate-600">
          AEVION Smeta Trainer · Модуль 181 · Тоннелепроходка (TBM / НАТМ / микротоннели)
        </div>
      </main>
    </div>
  );
}
