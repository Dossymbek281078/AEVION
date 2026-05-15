"use client";
import Link from "next/link";
import { useState } from "react";

export default function DesertObjectsPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 8500) <= 800;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 4_200_000_000) <= 400_000_000;

  const correct = {
    ex1: ex1 === "c",
    ex2: ex2Correct,
    ex3: ex3Correct,
    ex4: ex4 === "d",
  };
  const score = Object.values(correct).filter(Boolean).length;

  const optClass = (state: string, value: string, ok: boolean) => {
    if (!showResults || state !== value) return state === value ? "border-blue-500 bg-blue-500/20" : "border-slate-700 hover:border-slate-500";
    return ok ? "border-emerald-500 bg-emerald-500/20" : "border-rose-500 bg-rose-500/20";
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/smeta-trainer/drawings-practice" className="text-sm text-blue-300 hover:text-blue-200 transition">← К разделам</Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Объекты в пустынной зоне</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🏜️ Объекты в пустынной зоне РК</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #225. Проектирование объектов в зонах Кызылкум, Бетпак-Дала, Муюнкум,
            пустыня Кызылкум (юг Кызылординской/Алматинской/Жамбылской обл.). Климат
            экстремальный: t° +45°C летом, песчаные бури «Афганец» (порывы 25-35 м/с),
            влажность 10-20%, осадки 50-150 мм/год. Фундаменты на песке с виброуплотн.,
            водосбор по системе «русло-катушка» с водохранилищем, солнцезащита фасадов,
            кондиционирование адиабатич. + сплит. СП РК 4.04, СН РК 2.04-04.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Особенности пустынного строительства</h2>
          <p className="text-slate-300 leading-relaxed">
            СП РК 4.04 + опыт ОАЭ, Саудовской Аравии, Туркменистана:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li>Грунт: сыпучий мелкозернистый песок, ε=0.6-0.8, R=120-180 кПа после уплотнения.</li>
            <li>Фундамент: плитный 600-800 мм на песчаной подушке +щебень виброуплотнённый Купр=0.95.</li>
            <li>Защита от выветривания: блоки из песка цементно-минерализованные, бетон с добавками алюмосиликатных пуццоланов.</li>
            <li>Фасад с теплоотражающим покрытием (Cool Roof, R&gt;75%), цвет светлый.</li>
            <li>Окна с солнцезащитным остеклением (G-value 0.25-0.35), двойные жалюзи внутр./нар.</li>
            <li>Кондиционирование: адиабатич. охладители + сплиты + чиллеры (COP&gt;3.5 в пустыне).</li>
            <li>Водосбор крыш ливнями (10-15 мин/год очень интенсивные) в подземное водохранилище.</li>
            <li>«Русло-катушка» (катаавджан) — каналы сбора стока в радиусе 1-3 км в подземную галерею.</li>
            <li>Защита от песчаных заносов: дюнообразование купированием посадками + ветроломы.</li>
            <li>Дороги с асфальт. покрытием с песчаной фракцией &gt;0.5 мм + полимеры (Mc-Cookoo).</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Фундамент</h2>
          <p className="text-slate-300">
            Малоэтажное здание 30×20 м (1-2 этажа) в Кызылкуме на сыпучих песках
            ε=0.7, R=150 кПа (после виброуплотн.). Какой фундамент?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Свайный из забивных свай С30-12 — лучше для слабых грунтов" },
              { v: "b", t: "Ленточный мелкозаглубл. h=1.5 м — традиционный" },
              { v: "c", t: "Плитный фундамент 30×20×0.6 м на подушке из щебня и крупного песка: виброуплотнение песчаной подушки (1.5-2 м толщ.) до плотности γ=1.65-1.80 т/м³ слойками 200 мм, плита ж/б B25 с двойной арматурной сеткой A-III Ø12-16 мм шагом 200 мм, отмостка ширина 1.5 м с антифильтрационной мембраной HDPE 1.5 мм (защита от подъёма солей и фильтрации стока), дренаж по периметру в перфорированной трубе Ø160 мм в геотекстиле, обмазочная гидроизоляция фундамента битум-полимер + защитная мембрана, СП РК 4.04 + ГОСТ 30412 (Песок)" },
              { v: "d", t: "Только заглубл. подвал с подпорными стенами" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Водосбор</h2>
          <p className="text-slate-300">
            Объект в Кызылкуме: жилой посёлок 40 чел, потребление воды 150 л/чел/сутки.
            Осадки 80 мм/год (60% в марте-апреле дождями интенсивн.). Какая площадь
            водосбора (крыши+площадки+«катушка») нужна для 100% обеспечения?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            V_год = N × норма × 365<br />
            S = V × коэф. потерь / (h_осадков × коэф. стока)<br />
            коэф. стока крыш 0.85, тверд. покрытий 0.7, грунта пустыни 0.15
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Площадь водосбора, м²"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: V = 40×150×365 = 2 190 000 л = 2190 м³. Эффективный сбор: S × 0.08 × 0.7 (коэф. стока площадки) = 0.056 × S. S = 2190/0.056 ≈ 39 100 м². С учётом 30% испарения и фильтрации S_расчётная ≈ 8500 м² при многоуровневой системе крыш+площадок+«русла-катушки» в каменистых ложбинах вокруг посёлка.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет посёлка в пустыне</h2>
          <p className="text-slate-300">
            ССЦ + специфика: фундамент плитный + подушка щебневая 30×20 м — 280 млн тг,
            монолит каркас + стены сэндвич-панели 1500 м² — 720 млн тг,
            фасад НВФ Cool Roof с теплоотражением + теплоизоляция 200 мм — 280 млн тг,
            окна с солнцезащ. остеклением + жалюзи внутр./нар. — 145 млн тг,
            кровля наклонная с водосбором + ливнёвая канализация — 165 млн тг,
            подземное водохранилище 1500 м³ + насосная + очистные — 580 млн тг,
            «русло-катушка» 8500 м² водосбора с каналами — 380 млн тг,
            автономная СЭС 50 кВт + ДГУ + аккумуляторы LiFePO₄ — 480 млн тг,
            кондиционирование чиллеры + сплиты + адиабатич. охладители — 320 млн тг,
            благоустройство пыле-ветрозащ. (барханные дюны+ветроломы из насаждений джидды) — 240 млн тг,
            проектирование + геол.изыскания + ОЭВ — 240 млн тг,
            НР+СП +30% от удельной за счёт логистики и сезонности — 372 млн тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~4.2 млрд тг (допуск ±10%). 0.28+0.72+0.28+0.145+0.165+0.58+0.38+0.48+0.32+0.24+0.24+0.372 = 4.2 млрд тг. Удельная стоимость ~2.8 млн тг/м² — в 4 раза выше городского строительства из-за логистики и автономии.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Защита от песчаных бурь</h2>
          <p className="text-slate-300">
            Песчаные бури «Афганец» в Кызылкуме (порывы 25-35 м/с, длительность до 7 дней).
            Какие защитные меры?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Достаточно укрытий и противопыльных фильтров на вентиляции" },
              { v: "b", t: "Только ветрозащ. насаждения с подветренной стороны" },
              { v: "c", t: "Окна с защитными ставнями на петлях наружу — закрываются при штормовом ветре" },
              { v: "d", t: "Комплексная защита: 1) Снижение пылевой нагрузки фасадов — закруглённая обтекаемая архитектура «аэродинамической формы» (без перепадов и террас, где скапливается пыль); 2) Окна с двойными ставнями: внешние стальные с автоматич. закрытием по сигналу анемометра при V>15 м/с + внутренние стандартные; 3) Вентиляция с многоступ. фильтрацией: предфильтр G4 (крупная пыль) → F7 (средняя) → F9 (мелкая до 1 мкм), вход воздуха через циклон-сепаратор первичной очистки сверху от заборного устройства; 4) Уплотнения дверей/окон ПВХ с минимальными зазорами ≤0.2 мм; 5) Барханные дюны зелёные (саксаул+джидда+тамариск) в радиусе 50-100 м с подветренной стороны для замедления ветра; 6) Защита электрооборудования IP65, кабельные муфты герметизированные; 7) Альтернативные пути эвакуации с заветренной стороны зданий; СП РК 4.04 + СН РК 2.04-04 + опыт Туркменистана" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex4, o.v, correct.ex4)}`}>
                <input type="radio" name="ex4" value={o.v} checked={ex4 === o.v} onChange={() => setEx4(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-between bg-slate-900/60 border border-slate-700 rounded-xl p-6">
          <button
            onClick={() => setShowResults(true)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition"
          >
            Проверить ответы
          </button>
          {showResults && (
            <div className="text-right">
              <div className={`text-2xl font-bold ${score === 4 ? "text-emerald-400" : score >= 2 ? "text-amber-400" : "text-rose-400"}`}>
                {score} / 4
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {score === 4 ? "Отлично — готовы к проектированию в пустыне" : score >= 2 ? "Перечитайте СП РК 4.04 + СН РК 2.04-04" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> СП РК 4.04, СН РК 2.04-04, ГОСТ 30412 (Песок), СН РК 1.04-26 (Водозабор), Cool Roof Council, опыт ОАЭ Estidama Pearl.</p>
          <p><strong>Реальные объекты:</strong> Город Кызылорда (на границе с Кызылкум), нефт. месторожд. Кашаган (Каспий пустыни Атырау), Жанаозен (Мангистау), посёлки Шортанды-Бостандык в Бетпак-Дала.</p>
        </section>
      </main>
    </div>
  );
}
