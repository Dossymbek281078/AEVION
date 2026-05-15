"use client";
import Link from "next/link";
import { useState } from "react";

export default function TunnelsVehiclePage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 24) <= 2;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 165_000_000_000) <= 15_000_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Автомобильные тоннели</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🚗 Автомобильные тоннели в горных условиях</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #219. Проектирование и расчёт смет автодорожных тоннелей РК:
            Кокпекский тоннель 6 км (планируемый, дублёр перевала на ВДНХ-Чимбулак),
            тоннель Көк-Жайлау 4 км (концепция). Метод НАТМ (Новый Австрийский Тоннельный Метод),
            обделка ж/б B40 с гидроизоляцией ПВХ 2-3 мм, вентиляция продольная Jet-fan,
            эвакуационные сбойки каждые 250 м. СНиП 32-04 «Тоннели автодорожные»,
            СН РК 3.06-08, PIARC, EU Directive 2004/54/EC.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Категории тоннелей и оборудование</h2>
          <p className="text-slate-300 leading-relaxed">
            По СНиП 32-04 + EU Directive 2004/54/EC классификация по длине:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li>Малые &lt;500 м: продольная естественная вентиляция, базовое освещение.</li>
            <li>Средние 500-1000 м: вентиляция активная Jet-fan, эвакуац. освещ., СОУЭ.</li>
            <li>Большие 1-3 км: 2 раздельных тоннеля, эвакуац. сбойки каждые 250-300 м, СКУД, СОТ.</li>
            <li>Сверхдлинные &gt;3 км: + центральная вентиляц. шахта, центр управления (TOC), система мониторинга загрязнения CO/NOx/SO₂/задымление, противопожарный режим, центр диспетчерский.</li>
            <li>Геометрия: габарит «Г» (6.0+4.5+6.0 м), пешеходный сб. 1.5 м с двух сторон.</li>
            <li>Уклоны продольные ≤5%, виражи R≥350 м для 100 км/ч.</li>
            <li>Аварийные ниши/карманы каждые 150 м (для стоянки до прибытия эвакуатора).</li>
            <li>Шкафы с гидрантами и кранами через каждые 50 м, ПСК (пож. сухой стояк).</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Метод проходки в скальных грунтах</h2>
          <p className="text-slate-300">
            Кокпекский тоннель 6 км в скальных породах Заилийского Алатау
            (граниты, прочн. 80-150 МПа, трещиноватые зоны). Какой метод?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "ТБМ с двойным щитом — максимально быстро, но дорого для скал" },
              { v: "b", t: "Открытый способ — снять гору слой за слоем (нереально для горных условий)" },
              { v: "c", t: "Метод НАТМ (New Austrian Tunnelling Method): буровзрывная разработка калотта/штросса/обратный свод по очереди, торкрет-бетон класс B40 с фиброй 200-300 мм первичная обделка, анкерная крепь СПА Ø25 мм L=4-6 м (1.5×1.5 м сетка), металлические арки I-22a через 1.0-1.5 м, мониторинг конвергенции тахеометрами, после стабилизации — вторичная ж/б обделка B40 толщиной 350-500 мм с гидроизоляцией ПВХ 3 мм. Темп проходки 3-5 м/сутки на каждом из 2 забоев" },
              { v: "d", t: "Только буровзрыв без анкерной крепи (опасно — обрушения)" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Вентиляция Jet-fan</h2>
          <p className="text-slate-300">
            Тоннель 6 км, 2 трубы по 3-полосы, расчётный поток 2000 авт/ч.
            Расход воздуха ВНРБ 100 м³/ч на автомобиль легк. + 300 на грузовой
            (10% грузовых). Скорость потока в тоннеле ≤6 м/с (норма безопасности).
            Сколько Jet-fan вентиляторов длиной по 3 м, тяга 1500 Н каждый, нужно?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            L_приток = N×L_легк + N×L_груз; ΔP_сопротивления тоннеля = f(L,V)<br />
            n_jetfan = L × ΔP / (тяга × η × 1000) +50% резерв
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Кол-во Jet-fan, шт"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: для 6 км тоннеля типично 12-15 jet-fan на трубу. С учётом резерва (N+1 при отказе и режима пожара с реверсом) — 24-28 единиц на обе трубы. Производительность одного Jet-fan AVK-1000 ≈ 35 м³/с при ΔP=300 Па.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет тоннеля 6 км</h2>
          <p className="text-slate-300">
            ССЦ + импорт: 2 трубы НАТМ 6 км × 2 (туда+обратно) — 78 млрд тг,
            гидроизоляция ПВХ 240 000 м² + дренаж — 8.4 млрд тг,
            эвакуационные сбойки 12 шт через 250 м + вспомогательные сооружения — 6.2 млрд тг,
            дорожное покрытие асфальтобетон A1 36 000 м² с обустройством — 4.2 млрд тг,
            вентиляция Jet-fan 28 шт + венткиоски + газоанализ — 12.6 млрд тг,
            освещение LED Philips с диммированием + аварийное — 3.8 млрд тг,
            СОУЭ 5-го типа + АУПС + СОТ + СКУД + связь GSM-R — 6.4 млрд тг,
            центр диспетчерский (TOC) + SCADA + IT-инфра — 4.8 млрд тг,
            подъездные дороги порталы + укрепление склонов сетками+анкерами — 28 млрд тг,
            ПС электрические 35/10 кВ + резерв ДГУ + UPS — 12.4 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~165 млрд тг (допуск ±10%). 78+8.4+6.2+4.2+12.6+3.8+6.4+4.8+28+12.4 = 164.8 млрд тг. Удельная стоимость 27.5 млрд тг/км — соответствует мировым проектам в горных условиях.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Пожарная защита тоннеля</h2>
          <p className="text-slate-300">
            Тоннель 6 км категории D (по EU Directive 2004/54/EC) с грузовыми авто.
            Какая система пожаротушения?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Достаточно эвакуац. освещ. + порошковых огнетушителей в нишах" },
              { v: "b", t: "Спринклер по всему тоннелю на воде — заливает пробку" },
              { v: "c", t: "Газовое пожаротушение CO₂ — стандарт для тоннелей" },
              { v: "d", t: "Многослойная система: 1) Обделка с пассивной защитой R120 (фиброцементные плиты Promatect или Heat Resistant Concrete для предотвращ. отслоения spalling при +1200°C — RABT/HCM кривая); 2) Активное пожаротушение водяной завесой high-pressure water mist FOGTEC 80-100 бар, форсунки через 4-5 м, тушение секцией 50-100 м, расход 6 л/мин·м²; 3) Линейные пож. детекторы Listec FibroLaser DTS (термокабель оптоволокно по всей длине, обнаруж. за 30 сек); 4) Реверсивная продольная вентиляция в режиме «дым в сторону низового портала»; 5) СОУЭ 5-го типа с радиовещанием на FM, перехватом FM-диктора и аварийным светофором; 6) Аварийный мостик пешеходный 1.5 м с двух сторон + сбойки 250 м EI120; PIARC + EU Directive 2004/54/EC" },
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
                {score === 4 ? "Отлично — готовы к проектированию тоннелей" : score >= 2 ? "Перечитайте СНиП 32-04 + PIARC + EU 2004/54/EC" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> СНиП 32-04 (Автодорожные тоннели), СН РК 3.06-08, EU Directive 2004/54/EC, PIARC Tunnel Operations, NFPA 502 (Road Tunnels), ITA Working Groups.</p>
          <p><strong>Реальные объекты РК и СНГ:</strong> Кокпекский (проект), Көк-Жайлау (концепция), тоннель «Высокогорный» р. Сау Ставрополь, Северо-Муйский БАМ, Гонконг Lantau Tunnel.</p>
        </section>
      </main>
    </div>
  );
}
