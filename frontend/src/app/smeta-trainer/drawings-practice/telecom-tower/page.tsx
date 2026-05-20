"use client";
import Link from "next/link";
import { useState } from "react";

export default function TelecomTowerPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 4200) <= 400;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 28_000_000_000) <= 2_700_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Телебашни и радиовышки</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">📡 Телебашни и радиовышки</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #234. Телебашни и базовые станции РК: Алматинская телебашня
            (Кок-Тобе) 372 м высоты (стальная решётчатая, 1983 г.), Бородинская
            башня в Кызылорде, башня Туркестан 110 м, базовые станции операторов
            Kcell/Beeline/Tele2/Altel 30-100 м. Антенны DAB+/DVB-T2/LTE+5G, FM/AM,
            микроволновые радиорелейные линии (MMWAVE), Wi-Fi 6/7. Освещение
            FAA L-810/L-864 (для авиабезопасности), молниезащита, СНиП II-23
            «Стальные конструкции», ТУ KEGOC, ITU-R BS.706, FCC OET-65, FAA AC 70/7460.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Типы радиобашен</h2>
          <p className="text-slate-300 leading-relaxed">
            СНиП II-23 + EN 1993-3-1 (Lattice Towers):
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Self-supporting (свободностоящая):</strong> 3-4 граней (трёхгранная, четырёхгранная), без растяжек, высота до 400 м.</li>
            <li><strong>Guyed (с растяжками):</strong> 3-х опорная башня с растяжками-вантами на 3-5 уровнях, до 600 м (Останкино 540 м, Варшавская 646 м снесена).</li>
            <li><strong>Monopole (моноопора):</strong> стальная труба Ø1-2.5 м без решётки, до 60-80 м (для базовых станций в городе).</li>
            <li><strong>Roof-top (на крыше):</strong> до 30 м, антенны прикреплены к высотке.</li>
            <li><strong>Hybrid concrete (ж/б ядро + стальная надстройка):</strong> Toronto CN Tower 553 м, Алматинская Кок-Тобе 372 м, Burj Khalifa 828 м (антенна).</li>
            <li>Сечения профилей: уголки L-100/120/160 для решётки, трубы Ø168-426 мм для главных стоек.</li>
            <li>Соединения: высокопрочные болты M20-M30 класса 10.9 с двойной затяжкой и контролем момента.</li>
            <li>Антикоррозия: горячее цинкование толщ. 80-100 мкм + полимерное покрытие красно-белое в шахматке (Aviation Marking FAA).</li>
            <li>Освещение FAA L-810/L-864: красные синхр. мигающие огни на верхушке и промежут. уровнях.</li>
            <li>Молниеотвод: стержень Cu Ø20 мм на верхушке + 4 токоотвода вниз с заземлением R≤2 Ом.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Расчёт ветровой нагрузки</h2>
          <p className="text-slate-300">
            Башня 120 м в зоне ветрового района II РК (нормативный ветр q₀=0.30 кПа).
            Какая методика расчёта по СНиП II-23 + EN 1993-3-1?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Статический расчёт с равномерным ветром по всей высоте — упрощённо" },
              { v: "b", t: "Только динамический расчёт без учёта пульсаций — недостаточно" },
              { v: "c", t: "Поэтапный расчёт: 1) Высотный градиент ветра по СНиП II-23 — давление q(z) = q₀ × k(z), где k(z) для местности B (открытая) — от 0.5 на z=10 м до 1.85 на z=120 м; 2) Аэродинамический коэф. сопротивления решётки C_x = 1.4-1.8 (для квадратной башни) или 2.5-2.8 (для треугольной) с учётом плотности решётки (заполнение 15-25%); 3) Пульсационная (динамическая) составляющая ζ_dyn = 1.5-2.5 для высоких сооружений (резонансные эффекты); 4) Гололёд +50% к нагрузке на нав. оборудование; 5) Антенны парусность считается отдельно как «загрузка» с эфф. площадью S_eff; 6) Нелинейный анализ устойчивости (для башен >100 м обяз. учёт P-Δ эффекта 2-го порядка); 7) Сочетания нагрузок: ветер + гололёд + температура (от −40 до +50°C); 8) Усталостный расчёт сварных соединений для 50-летнего срока службы; СНиП II-23 + EN 1993-3-1 + ITU-R BS.706" },
              { v: "d", t: "Только сейсмический расчёт без учёта ветра" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Масса стальной решётки</h2>
          <p className="text-slate-300">
            Четырёхгранная решётчатая башня 120 м, основание 12×12 м у фундамента,
            сужающаяся до 3×3 м на вершине. Удельная масса стальной решётки
            (с учётом главных стоек, диагональных распорок, горизонт. поясов,
            антенн. площадок, лестниц) — типично 35-45 кг/м³ от объёма «огибающей».
            Какая масса стальных конструкций (т)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            V_огибающ. = ∫S(z)dz (усреднён. трапеция)<br />
            S_сред = (S_низ + S_верх)/2; V = S_сред × H<br />
            M = V × γ (плотность 40 кг/м³ объёма огибающей)
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Масса, ×10 кг (для 420 т → 4200)"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: S_низ = 144 м², S_верх = 9 м², S_сред ≈ 65 м² (но т.к. сужение нелинейно, лучше 50 м²); V = 50 × 120 = 6000 м³ × 40 кг/м³ = 240 000 кг = 240 т. С учётом площадок, лестниц, кабельных мостов и оборудования ~420 т.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет телебашни 120 м</h2>
          <p className="text-slate-300">
            ССЦ РК 2026Q2: фундамент плитный 18×18×3 м (бетон B30) + бурозабивн. сваи — 1.8 млрд тг,
            стальная решётка ~420 т (горячее цинкование 80 мкм + полимер) — 6.4 млрд тг,
            монтаж стрелой Liebherr LTM 1750-9.1 (1500 т) + крепление высокопрочн. болтами — 3.2 млрд тг,
            антенные площадки 4 уровня (60/80/100/115 м) + ограждения — 480 млн тг,
            антенны: DVB-T2 4 шт. сектор. + LTE/5G 12 шт. + микроволновые радиорелейн. + FM-передатчики — 4.8 млрд тг,
            кабельные мосты (фидеры коаксиальные 7/8" / 1-5/8") + волноводы — 1.2 млрд тг,
            аппаратная радиопередач у основания 800 м² (Equipment Shelter) + охлаждение — 1.8 млрд тг,
            энергоснабжение 2 ввода + ДГУ 600 кВт резерв + UPS 200 кВА — 2.4 млрд тг,
            FAA L-810/L-864 освещение + молниезащита Cu 50 мм² + заземление R≤2 Ом — 580 млн тг,
            пассажирский лифт грузопассажирский (если в стволе) Schindler 1000 кг — 1.6 млрд тг,
            подъездная дорога + ограждение периметра + охрана — 380 млн тг,
            проектирование + изыскания + ВОЗ Анализ электромагн. полей — 720 млн тг,
            сертификация ITU-R + KEGOC + Минцифр РК — 240 млн тг,
            НР+СП и резерв — 2.4 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~28 млрд тг (допуск ±10%). 1.8+6.4+3.2+0.48+4.8+1.2+1.8+2.4+0.58+1.6+0.38+0.72+0.24+2.4 = 28 млрд тг. Удельная стоимость ~233 млн тг/м высоты — соответствует мировым телебашням такого класса.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — ЭМП-безопасность</h2>
          <p className="text-slate-300">
            На башне DVB-T2 передатчики мощностью 20 кВт, LTE+5G сектора мощностью
            до 80 Вт каждый, микроволновые радиорелейные 1 Вт. Что обязательно
            для ЭМП-безопасности по FCC OET-65 / ICNIRP / СН РК?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Достаточно ограждения 5 м вокруг основания башни" },
              { v: "b", t: "Только запрет нахождения на верхних 20 м без специального разрешения" },
              { v: "c", t: "Только ежегодная проверка излучения раз в год" },
              { v: "d", t: "Многоуровневая защита: 1) Расчёт зон ограничения по ЭМП в соответствии с FCC OET-65 / ICNIRP 1998 (для общего населения: 4.5 Вт/м² при 1800 МГц, 9.2 Вт/м² при 2600 МГц LTE; для проф. персонала — в 5× больше); 2) Зонирование: «контролируемая зона» (Restricted, для персонала с обучением) 0-15 м от антенн, «зона ограничения общего населения» 15-50 м, «свободная зона» >50 м; 3) Знаки запрета FCC W-Signs «Caution: Beyond This Point Radio Frequency Fields» на расстоянии >ПДУ; 4) Антенны DVB-T2 направлены горизонтально (не вниз) — основной лепесток на 0.5-2° от горизонта, плотность поля на земле минимальна; 5) Регулярные измерения индекса излучения дозиметрами Narda NBM-550 каждые 6 мес (по периметру + жилые дома в радиусе 200 м); 6) Подъём на башню только в режиме отключения передатчиков (или с маской и защитной одеждой Sieger TX); 7) Сертификация Минздрава РК + СанПиН 4.01-007 + СЭС; 8) Информирование жителей в радиусе 500 м с публикацией результатов измерений; 9) Защитные экраны для антенн в сторону жилых зданий (металлические или RAM-материалы); 10) Аварийный выключатель передатчиков с кнопки у основания и в дисп. центре; FCC OET-65 + ICNIRP 1998 + ITU-T K.52 + СанПиН 4.01-007 РК" },
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
                {score === 4 ? "Отлично — готовы к проектированию телебашни" : score >= 2 ? "Перечитайте СНиП II-23 + EN 1993-3-1 + FCC OET-65" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> СНиП II-23 (Стальные конструкции), EN 1993-3-1 (Lattice Towers), ITU-R BS.706 (Broadcasting), FCC OET-65 (RF Exposure), FAA AC 70/7460 (Lighting), ICNIRP 1998, ISO 1461 (Galvanizing).</p>
          <p><strong>Реальные объекты РК:</strong> Алматинская телебашня Кок-Тобе 372 м (1983), Бородинская в Кызылорде, башня Туркестан 110 м, ~17 000 базовых станций операторов Kcell/Beeline/Tele2/Altel, Радиовышка Алматы Кок-Жайлау.</p>
        </section>
      </main>
    </div>
  );
}
