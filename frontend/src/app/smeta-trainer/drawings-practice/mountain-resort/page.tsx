"use client";
import Link from "next/link";
import { useState } from "react";

export default function MountainResortPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 2400) <= 200;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 28_000_000_000) <= 2_700_000_000;

  const correct = {
    ex1: ex1 === "d",
    ex2: ex2Correct,
    ex3: ex3Correct,
    ex4: ex4 === "c",
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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Горнолыжные курорты</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🎿 Горнолыжные курорты</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #226. Проектирование горнолыжных курортов РК: Чимбулак (Алматинская обл.,
            7 трасс 21 км, 6-кресельный подъёмник Doppelmayr, h=2200-3163 м), Tabagan
            (Алматы, 5 трасс), Akbulak (Талгар, 4 трассы), курорт «Парк Тау» Кокшетау.
            Канатные дороги Doppelmayr/Leitner 6-кресельные D-LINE 3 м/с пропускная
            3200 чел/ч, снегогенераторы TechnoAlpin TR-V, лавинные галереи Daher,
            СН РК 4.04 + FIS Equipment + ANSI B77.1 + EN 1907.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав горнолыжного курорта</h2>
          <p className="text-slate-300 leading-relaxed">
            EN 1907 + ANSI B77.1 + FIS Equipment Standards:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li>Канатные дороги: 6-кресельные D-LINE Doppelmayr (или 8-кресельные с куполом), кабинные гондольные 8-15 чел.</li>
            <li>Тяговые подъёмники (для начальных трасс): T-bar, button-lift, ленточные «магические ковры».</li>
            <li>Трассы (FIS classification): зелёные (&lt;25%), синие (25-40%), красные (40-55%), чёрные (&gt;55%).</li>
            <li>Снегогенераторы TechnoAlpin TR-V/TF10 на каждых 50-80 м трассы (10-12 м³/ч искусств. снега при t°≤−2°C).</li>
            <li>Ратраки PistenBully 600 W (для подготовки трасс ночью), 1-2 ед. на 10 км трасс.</li>
            <li>Снежные пушки воздушно-водяные (high pressure) + башенные (low pressure).</li>
            <li>Лавинная защита: галереи Daher из армоген. железобетона, мешки Defender Galmar, активные взрывные системы Gazex.</li>
            <li>База курорта: ресепшен, прокат снаряжения, инструкторская школа, медпункт, кафе.</li>
            <li>Парковка многоуровневая (1 м/м на 3 лыжников), теплопункт с прогревом.</li>
            <li>Связь GSM/Wi-Fi покрытие всех трасс + аварийные пункты SOS на трассах через 500 м.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Канатная дорога</h2>
          <p className="text-slate-300">
            Канатная дорога нижняя станция h=2200 м, верхняя h=3163 м (как на Чимбулаке),
            длина по горизонту 2.8 км, перепад высот 963 м. Какое решение?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Бугельный подъёмник T-bar — экономично" },
              { v: "b", t: "Кресельная 4-местная без купола — стандарт" },
              { v: "c", t: "Гондольная кабинная 8-местная — слишком дорого для таких длин" },
              { v: "d", t: "6-кресельная D-LINE Doppelmayr с защитным куполом-капотом + подогрев кресел: канат стальной Ø60 мм (несущий+тяговый) длина 5800 м контурно, опоры стальные Y/Y-bracket H=12-25 м (15 опор интервалом 180-200 м), на криволинейных участках — дополнит. опоры, привод верхней станции 1.2 МВт (асинхр. двигатель + ваттметрический контроль натяжения), скорость 6 м/с, пропускная 3200 чел/ч, гондола (capot top-roof) против ветра/снега, время подъёма 11 мин, аварийная эвакуация через подвес. блоки и спускательные верёвки с обучением персонала, контроль натяжения с тензометрами + ультразвуковые дефектоскопы каната 1 раз/6 мес, EN 1907 + ANSI B77.1" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Снегогенераторы</h2>
          <p className="text-slate-300">
            Трасса L=2.5 км × ширина 30 м (площадь 75 000 м²). Норма слоя искусств. снега
            к началу сезона — 30 см (0.3 м), плотность снежного покрова 400 кг/м³,
            производительность снегогенератора TR-V — 10 м³/ч искусств. снега. Работа
            10 часов в сутки в течение 30 ночей предсезонной подготовки (t°≤−2°C).
            Сколько снегогенераторов нужно?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            V_снега = S × h_слоя; время полн. = V_снега / производ.<br />
            n = V_снега / (10 м³/ч × 10 ч × 30 ночей × коэф. эффект. 0.8)
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Кол-во ×100 (для 24 → 2400)"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: V_снега = 75000 × 0.3 = 22 500 м³ за сезон. С учётом 50% эффект. (часть в воздух, ветер) ~45 000 м³. С учётом 10 ч × 30 дней = 300 ч работы × 10 м³/ч × 0.8 = 2400 м³/генератор/сезон. n = 45000/2400 ≈ 19 шт ≈ 2400 (×100). Для всех 7 трасс Чимбулака ~80-120 снегогенераторов.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет курорта</h2>
          <p className="text-slate-300">
            ССЦ + импорт: 6-кресельная канатная дорога Doppelmayr 6CLD 2.8 км — 8.5 млрд тг,
            7 трасс с подготовкой склонов 21 км общей длины + лесорубные работы — 2.4 млрд тг,
            20 снегогенераторов TR-V + насосная + резервуар 5000 м³ + трубопровод — 3.6 млрд тг,
            3 ратрака PistenBully 600 W + гараж + сервис — 980 млн тг,
            лавинная защита: 3 галереи Daher на критических участках — 2.4 млрд тг,
            активная защита Gazex (взрывные) 8 точек + детонаторы — 480 млн тг,
            база курорта 3000 м² (ресепшен, прокат, школа, медпункт) — 1.8 млрд тг,
            гостиничный фонд 200 номеров (4-звёзд категория) — 4.2 млрд тг,
            парковка многоур. 800 м/мест с обогревом — 1.4 млрд тг,
            энергоснабжение (ВЛ 10 кВ 8 км + 2 ТП 1000 кВА + резерв ДГУ 600 кВт) — 1.2 млрд тг,
            водоснабжение + канализация + очистные — 580 млн тг,
            связь GSM-репитеры + Wi-Fi покрытие + SOS-пункты — 220 млн тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~28 млрд тг (допуск ±10%). 8.5+2.4+3.6+0.98+2.4+0.48+1.8+4.2+1.4+1.2+0.58+0.22 = 27.76 млрд тг. Реальный Чимбулак (модернизация 2008-2011) обошёлся ~$220 млн ≈ 100 млрд тг (с учётом инфляции и расширений).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Лавинная защита</h2>
          <p className="text-slate-300">
            Чимбулак расположен в зоне риска лавин (исторически — лавина 2 января 1966 г.
            убила 12 человек). Какая защита по СН РК + опыту Швейцарии (SLF Davos)?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только информационные щиты «Опасность лавин» и предупреждения для туристов" },
              { v: "b", t: "Достаточно полностью закрытой канатной дороги без галерей на критических участках" },
              { v: "c", t: "Многослойная защита: 1) Пассивная — лавинные галереи Daher из преднапряжённого ж/б B40 H=8-12 м над дорогой/канатной дорогой на участках высокого риска (Lavinen Schutzgalerie тип Toggwiler); 2) Снегоудерживающие конструкции на склонах (металлические сети Geobrugg D&D или деревянные щиты-«ёлочки» через 25-35 м по высоте) общая площадь 5-10 га; 3) Активная защита — система Gazex (Gazex Ranger) газо-кислородные пушки на ключевых снегосборах для контролируемого спуска лавин; 4) Профессиональная лавинная служба (LSP) с радарным мониторингом, RECCO-приёмопередатчиками у каждого посетителя, обученной командой и собаками; 5) Прогноз и закрытие трасс при индексе риска ≥3 по 5-балльной EAWS шкале; 6) Учёт климатич. изменения — переоценка карты опасностей каждые 5 лет; СН РК + Swiss Federal Institute SLF Davos + EAWS European Avalanche Warning Services" },
              { v: "d", t: "Только сети-«улавливатели» внизу склонов без активной защиты" },
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
                {score === 4 ? "Отлично — готовы к проектированию горнолыжного курорта" : score >= 2 ? "Перечитайте EN 1907 + ANSI B77.1 + FIS" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> EN 1907 (Cable Ways), ANSI B77.1 (USA Ropeways), FIS Equipment Standards, СН РК 4.04, EAWS Avalanche Warning, Swiss SLF Davos Guidelines.</p>
          <p><strong>Реальные объекты РК:</strong> Чимбулак (Алматинская обл., 21 км трасс, 6-кресельная Doppelmayr), Tabagan (Алматы), Akbulak (Талгар), горнолыжный курорт Парк Тау (Кокшетау), Шеджем-Сай (Шымкент).</p>
        </section>
      </main>
    </div>
  );
}
