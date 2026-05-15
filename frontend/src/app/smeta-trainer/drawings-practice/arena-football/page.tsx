"use client";
import Link from "next/link";
import { useState } from "react";

export default function ArenaFootballPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 7140) <= 600;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 195_000_000_000) <= 18_000_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Футбольные арены</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">⚽ Футбольные арены и стадионы</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #221. Проектирование и расчёт смет футбольных арен РК: Astana Arena
            (30 000 мест, открыта 2009, ретракт. крыша), Центральный стадион Алматы (25 000),
            «Ертыс» Павлодар, «Кайрат» Алматы. UEFA Stadium Categories Cat. 3-4, поле
            105×68 м гибрид Desso GrassMaster, освещение 2400 лк EBU HDR (для 4K-трансляций),
            медиа-куб, акустика крыши, СП РК 3.02-08, FIFA Stadium Guide 2020.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав современной арены</h2>
          <p className="text-slate-300 leading-relaxed">
            UEFA Stadium Categories + FIFA Stadium Guide 2020:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li>Игровое поле 105×68 м (UEFA), гибрид Desso 95% натур. + 5% синтетич. волокно (армирование).</li>
            <li>Дренажная система (Ø100 мм через 5-6 м) + подпольный обогрев (Cu-трубы Ø20 мм с шагом 200 мм, t°грунта +12°C зимой).</li>
            <li>Зона безопасности 4 м от линий + ров глубиной 1.5 м между трибуной и полем.</li>
            <li>Трибуны: верхний/средний/нижний ярус. Линии видимости C-value ≥90 мм (минимум по UEFA), 0.5 м²/зритель.</li>
            <li>VIP-ложи (3-5% от вместимости), пресс-зона (2%), скайбоксы.</li>
            <li>Раздевалки команд (2× на 30 чел + тренерская), судейская, допинг-контроль.</li>
            <li>Медиа-зона: 200-300 мест микс. зоны, ТВ-студия, монтажные пультовые.</li>
            <li>Кейтеринг: точки на трибунах (1 на 100-200 зрит.), VIP-рестораны.</li>
            <li>Эвакуация: 30 м/100 чел через 4-6 секторов, время эвак. ≤8 мин.</li>
            <li>Парковка: 1 м/м на 4-5 зрителей (UEFA Cat 4 — обяз. подвоз обществ. транспортом).</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Крыша и покрытие поля</h2>
          <p className="text-slate-300">
            Astana Arena имеет ретрактивную (раздвижную) крышу — арена работает круглый год.
            Какое инженерное решение для крыши и покрытия поля по UEFA Cat. 4 + FIFA?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Стационарная мембранная крыша из ПТФЭ + натуральная трава" },
              { v: "b", t: "Стационарная стальная ферменная конструкция без раздвижки" },
              { v: "c", t: "Раздвижная крыша из 2 секций откатывающихся вдоль продольной оси, материал ПТФЭ-стеклоткань 1100 г/м², светопроницаемость 12-15%" },
              { v: "d", t: "Раздвижная крыша 2-секционная (вес 2×800 т, ход 100 м, время раздвижки 20-25 мин), материал ПТФЭ-фторопласт мембрана + защитное остекление наклонных рам, светопрозрачность 15% (трава получает 4-5 ч прямого солнца), приводы Demag 12×30 кВт на тележках по рельсам Р50, климат-контроль арены: t°=+8…+22°C, RH=45-65%, поле гибридное Desso GrassMaster (натур. + полипропилен волокно — выдерживает 50+ матчей/сезон), подогрев Cu-трубы Ø20 мм с гликолевым раствором, FIFA Stadium Guide 2020 + UEFA Cat. 4 + СП РК 3.02-08" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Площадь трибун</h2>
          <p className="text-slate-300">
            Арена 30 000 зрителей. UEFA Cat. 4: норма 0.5 м²/зрит. (сиденья + проходы),
            +25% на лестничные шахты/ВИП/обслуж. помещ. на каждом ярусе.
            Какая суммарная площадь трибун (м²)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            S_зрит = N × 0.5 м²; S_трибун = S_зрит × 1.25<br />
            +концентр. секторы 15-20% (для прохода и эвакуации)
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Площадь трибун, м²"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: 30_000 × 0.5 = 15_000 м² зрительские; ×1.25 = 18_750 м² с обслуж. Но это горизонтальная проекция — фактическая поверхность ступеней трибуны с углом наклона 32-38° (UEFA C-value): площадь ~7140 м² на каждый ярус (3 яруса = 21 420 м²). Уровень введите для верхнего яруса × число секций (общая трибуна разделена на сектора).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет арены 30 000 мест</h2>
          <p className="text-slate-300">
            ССЦ + импорт: монолитный ж/б каркас стадиона + перекрытия трибун — 28 млрд тг,
            стальная ферменная конструкция крыши + ретрактивная система — 48 млрд тг,
            мембрана ПТФЭ 28 000 м² + остекление наклонное — 12 млрд тг,
            поле гибрид Desso GrassMaster + дренаж + подогрев — 4.2 млрд тг,
            VIP-ложи и скайбоксы (отделка premium) — 12 млрд тг, посадочные места + кейтеринг — 8 млрд тг,
            освещение 2400 лк (240 прожекторов Musco HID + LED) — 6.4 млрд тг,
            медиа-куб 4K LED 12×8 м + ТВ-инфра + камеры — 8.8 млрд тг,
            HVAC + АХУ + климат-зона для поля — 14 млрд тг,
            АУПС + СОУЭ 5-го типа + СОТ + СКУД турникеты — 8.6 млрд тг,
            благоустройство + парковки 6000 м/мест + ТП — 14 млрд тг,
            раздевалки + допинг + медицина + пресс-центр — 6.8 млрд тг,
            проектирование + аудит UEFA + FIFA сертиф. — 23.2 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~195 млрд тг (допуск ±10%). 28+48+12+4.2+12+8+6.4+8.8+14+8.6+14+6.8+23.2 = 194 млрд тг. Astana Arena (2006-2009) стоила ~$200 млн ≈ 90 млрд тг (без учёта инфляции). С раздвижной крышей и Cat. 4 фактор удвоения — 195 млрд тг.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Освещение арены</h2>
          <p className="text-slate-300">
            Освещение арены для трансляций 4K HDR (UEFA Cat. 4, EBU R.118).
            Какие параметры обязательны?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Достаточно 600-800 лк ровного освещения по полю — это стандарт для тренировок" },
              { v: "b", t: "Освещение мачтами с углами наклона 50° от вертикали — типовое решение" },
              { v: "c", t: "Освещение Ev≥2400 лк на главные камеры и Ev≥1800 лк на низкие камеры по EBU R.118, равномерность U2≥0.7, цветовая температура 5600±200 K (дневной свет), индекс цветопередачи Ra≥90 (для 4K HDR трансляций), мерцание ≤0.1% (для замедленного повтора 1000 fps), 240-320 LED-прожекторов Musco TLC-LED-1500 на крыше по контуру и снизу, мгновенное включение, диммирование 1-100% сценариями (матч/ТВ-репетиция/тренировка/чистка поля), резерв N+1 на ДГУ-питание, UV-обработка газона (для роста травы под крышей), FIFA Stadium Lighting + UEFA Cat. 4" },
              { v: "d", t: "Только LED-прожектора без расчёта равномерности" },
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
                {score === 4 ? "Отлично — готовы к проектированию арены UEFA Cat. 4" : score >= 2 ? "Перечитайте FIFA Stadium Guide + UEFA Cat. 4" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> СП РК 3.02-08 (Зрелищные), FIFA Stadium Guide 2020, UEFA Stadium Categories 1-4, EBU R.118 (Освещение), ГОСТ Р 56193 (Спортсооружения).</p>
          <p><strong>Реальные объекты РК:</strong> Astana Arena (30 000 мест, UEFA Cat. 4, открыта 2009), Центральный стадион Алматы (25 000), Ертыс Павлодар, FC Astana Arena.</p>
        </section>
      </main>
    </div>
  );
}
