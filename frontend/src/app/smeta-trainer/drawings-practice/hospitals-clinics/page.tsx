"use client";
import Link from "next/link";
import { useState } from "react";

export default function HospitalsClinicsPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 540) <= 50;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 36_000_000_000) <= 3_500_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Больницы и клиники</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🏥 Больницы, клиники и медцентры</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #212. Проектирование и расчёт смет лечебных учреждений РК:
            Республиканская клиническая больница (РКБ Алматы), Национальный научный
            центр онкологии (Астана), Центральная клиническая больница УДП РК,
            КазНИИ онкологии. СП РК 3.02-07 «Здания лечебных учреждений»,
            СанПиН 9.02.020.10, ВОЗ-стандарты по реанимации.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Структура многопрофильной больницы</h2>
          <p className="text-slate-300 leading-relaxed">
            СП РК 3.02-07 + СанПиН 9.02.020.10 «Санитарно-эпидемиологические требования к ЛПО»:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li>Приёмное отделение (триаж, шок-зал, кабинеты осмотра, изоляторы).</li>
            <li>Стационар: 7 м²/койка (терапия), 13 м²/койка (хирургия), 18 м²/койка (ОРИТ).</li>
            <li>Операционный блок (зонирование «чистая/грязная», шлюзы, ламин. поток).</li>
            <li>ОРИТ (реанимация): отдельные боксы, газовые сети O₂/N₂O/CO₂/Воздух/Вакуум.</li>
            <li>Диагностика: КТ Siemens, МРТ 3T Philips (клетка Фарадея), УЗИ, рентген.</li>
            <li>Лаборатории (3-4 уровень БЗ для инфекционных).</li>
            <li>ЦСО (центральная стерилизационная) с автоклавами 660 л.</li>
            <li>Морг, патолого-анат. отделение (с холодильными камерами +4°C).</li>
            <li>Прачечная, пищеблок с цех для диет (вегетар./диабет./безглют.).</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Класс чистоты операционной</h2>
          <p className="text-slate-300">
            Операционная для эндопротезирования суставов и пересадки органов.
            Какой класс чистоты по ГОСТ Р 52539 / ISO 14644-1 требуется?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Класс «А» (ISO 8, 352 000 частиц 0.5 мкм/м³) — общеоперационные" },
              { v: "b", t: "Класс «Б» (ISO 7, 35 200 частиц) — для хирургии общего профиля" },
              { v: "c", t: "Класс «В» (ISO 6, 3520 частиц) — кардиоохирургия и онкология" },
              { v: "d", t: "Класс «А» по ГОСТ Р 52539 (ISO 5: ≤3 520 частиц 0.5 мкм/м³): ламинарный поток над операционным столом 2.4×2.4 м, скорость 0.25-0.35 м/с, фильтры HEPA H14 (99.995%), пред-фильтры F7+F9, +20-25 Па избыточного давления, шлюз с дезматами, t°=20-24°C, RH=40-60%, СН РК 4.02-08" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Кислородная сеть</h2>
          <p className="text-slate-300">
            Больница 600 коек: 80 коек ОРИТ + 60 коек хирургии + 460 общесоматич.
            Норма расхода O₂ (HTM 02-01 / ВОЗ): ОРИТ 5 л/мин, хирургия 1.5 л/мин,
            общая 0.3 л/мин. Какой суммарный расход в L/min при 100% занятости?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            Q = 80×5 + 60×1.5 + 460×0.3<br />
            +30% запас на пики и испарение в магистрали
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Расход O₂, л/мин"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: 400+90+138 = 628 л/мин. С запасом 30% и неравномерностью → ~540 л/мин расчётный (при ~85% нагрузке среднеcуточно). Кислородная станция криогенная (жидкий O₂) или генератор PSA с резервом.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет больницы 600 коек</h2>
          <p className="text-slate-300">
            ССЦ РК 2026Q2 + импорт: монолит каркас 50 000 м² — 12.5 млрд тг,
            фасад НВФ + кровля — 2.8 млрд тг, отделка медицинская (антибакт. покрытия) — 4.2 млрд тг,
            оборудование медицинское (КТ 128 срезов, МРТ 3T, ангиограф, УЗИ, лаб.) — 8.5 млрд тг,
            HVAC прецизионный + чистые помещения + АХУ — 3.6 млрд тг,
            медицинские газы O₂/N₂O/CO₂/Воздух/Вакуум — 0.9 млрд тг,
            СКС + IT-инфра + СКУД + СОТ + СОУЭ — 1.4 млрд тг,
            благоустройство + парковка + вертолётная площадка — 2.1 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~36 млрд тг (допуск ±10%). 12500+2800+4200+8500+3600+900+1400+2100 = 36 000 млн тг.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Изоляция инфекционных боксов</h2>
          <p className="text-slate-300">
            Инфекционный бокс на 1 койку для пациентов с воздушно-капельной инфекцией
            (туберкулёз, COVID-19, корь). Какое решение по СанПиН 9.02.020.10?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Обычная палата + маски персоналу — этого достаточно" },
              { v: "b", t: "Только вытяжная вентиляция в коридор без шлюза" },
              { v: "c", t: "Бокс Мельцера (изолированный): отдельный наружный вход + шлюз с двойной дверью + санузел и душ внутри + вытяжка с УФ-обеззараживанием 12-15 крат/ч + отрицательное давление −15 Па, приток через HEPA-фильтр, переговорное устройство, передаточный шкаф, СанПиН 9.02.020.10 разд. 5" },
              { v: "d", t: "Положительное давление в боксе для защиты пациента" },
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
                {score === 4 ? "Отлично — готовы к проектированию больницы" : score >= 2 ? "Перечитайте СП РК 3.02-07 и СанПиН 9.02.020.10" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> СП РК 3.02-07 (Лечебные учреждения), СанПиН 9.02.020.10 (Санэпид. требования), ГОСТ Р 52539 (Чистота), HTM 02-01 (Мед. газы), ВОЗ Hospital Safety Index.</p>
          <p><strong>Реальные объекты РК:</strong> Республиканская клиническая больница Алматы, Национальный научный центр онкологии (Астана), КазНИИ онкологии, Городская клиническая больница №7 Алматы.</p>
        </section>
      </main>
    </div>
  );
}
