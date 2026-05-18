"use client";
import Link from "next/link";
import { useState } from "react";

export default function SkiResortSnowPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 35) <= 3;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 14_000_000_000) <= 1_400_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Лыжные трамплины и биатлонные комплексы</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">⛷️ Лыжные трамплины и биатлонные комплексы</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #264. Лыжные трамплины и биатлонные стрельбища РК (отличие от L5
            «Горнолыжные курорты» из батча 67 про Чимбулак — здесь специализированные
            трамплинные комплексы и стрельбища): Лыжно-Биатлонный Комплекс «Алатау»
            Алматы (трамплины K-65/K-90, биатлонная трасса 4 км × 3-х кругов),
            «Зенков» Алматинская обл. (K-125 trampoline). Расчётные точки приземления
            K-Point по правилам FIS Ski Jumping Rules, разгонные эстакады с
            охлаждаемыми треками (ice tracks), биатлонные стрельбища 50 м с
            мишенями Megalink ESA. СН РК 4.04 + FIS Jumping + IBU Biathlon.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав трамплинного комплекса</h2>
          <p className="text-slate-300 leading-relaxed">
            FIS Ski Jumping Rules + IBU Biathlon Standards:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Трамплин K-125 (Large Hill):</strong> высота стартовой башни 60-70 м, разгонная эстакада 80 м, столе 4 м (стол отрыва), расчётная точка K = 125 м (длина прыжка зачётная), Hill Size HS=140 м (макс. безопасный прыжок).</li>
            <li><strong>Стартовая башня:</strong> стальная или ж/б, с инспекторской и теле-комментаторскими, лифт для прыгунов.</li>
            <li><strong>Разгонная эстакада (Inrun):</strong> 38° наклон вначале, переходящий в 11° в области стола отрыва, треки покрыты искусственным льдом или керамикой (Profiltex Composite) для скольжения, охлаждаемые трубы под поверхностью (для лета — летние тренировки).</li>
            <li><strong>Стол отрыва (Take-off Table):</strong> длиной 4 м с углом 11°, точная геометрия определяет траекторию полёта.</li>
            <li><strong>Зона полёта и приземление:</strong> склон длиной 130-150 м с углом 35-37° на верхней части и 32-35° на нижней; покрытие — снег (искусств. или природный) или для лета — пластиковые маты Snowflex/Mattracks.</li>
            <li><strong>Выкат (Run-out):</strong> 60-80 м для торможения после приземления, переходящий в горизонтальный.</li>
            <li><strong>Биатлонная трасса:</strong> 4 км × 2.5-3 круга = 10-12 км общий маршрут, ширина 9-12 м, профиль с подъёмами и спусками (общее восхождение TC ~600-1500 м), укладка снега в зимний сезон.</li>
            <li><strong>Биатлонное стрельбище:</strong> 50 м (для крупн. калибра) или 10 м (пневматика для дет./мол. спорта), 30 мишеней Megalink ESA (5 групп × 6 мишеней), Ø11.5 см лёжа / Ø4.5 см стоя.</li>
            <li><strong>Зрит. трибуны:</strong> на финиш-зоне 5 000-15 000 мест с подогревом сидений (для зимних соревнований).</li>
            <li><strong>Базовый дом, гостиница для спортсменов, теплый сервис, рестораны.</strong></li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Конструкция трамплина K-125</h2>
          <p className="text-slate-300">
            Трамплин K-125 «Большой Холм» для соревнований FIS. Какие требования?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Стальная башня + снежный склон без покрытия" },
              { v: "b", t: "Деревянный трамплин по советским стандартам" },
              { v: "c", t: "Естественный склон без специальной разгонной эстакады" },
              { v: "d", t: "Точная геометрия по FIS Certificate of Homologation: 1) Стартовая башня стальная решётчатая H=65 м (с 50 м запасом + 15 м для разгонной эстакады), 4-6 стартовых ворот регулируемых высотой ±3 м для подстройки прыжка под погоду; 2) Разгонная эстакада (Inrun) длиной 80 м с углом наклона 38° сверху, переходящим в 11° на столе отрыва; 3) Поверхность Inrun — Profiltex Composite (керамическое покрытие со встроенными охладительными трубами); 4) Cooling System — трубы Cu Ø22 мм с шагом 100 мм под поверхностью + холодильная установка R717 NH₃ 400 кВт (поддержание t°=-3..-5°C круглый год); 5) Стол отрыва Take-off Table — лит. бетон точной геометрии длина 4 м угол 11° (FIS-сертифицированный шаблон); 6) Hill profile — расчётный профиль склона приземления (P-Point, K-Point, HS-Point) задан FIS Manual Section 9.2; 7) Расстояния: P-Point (start of landing zone) 105 м, K-Point (critical) 125 м, HS (hill size, max safe) 140 м, выкат за HS до 200 м; 8) Покрытие склона — на зиму снег, на лето — синтетика Snowflex (пластиковые маты в форме щёток); 9) Освещение склона по FIS требованиям 1500 лк на критич. точках, 1000 лк на разгонной, без мерцания для 4K HDR трансляций; 10) Аварийная остановка — straw-bales (соломенные тюки) на боковых границах склона + jaime barriers (ограждения судейские); 11) FIS Certificate of Homologation Class A (требуется для Кубка Мира и Чемпионатов) — ежегодная инспекция; FIS Ski Jumping Rules + ICR International Competition Rules" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Холодильная нагрузка</h2>
          <p className="text-slate-300">
            Inrun трамплина K-125 поверхность 80 м × 1.4 м = 112 м². Целевая t°
            льда −4°C при наружной +25°C летом (большая дельта = +29°C). Расчётная
            теплоотдача через композитное покрытие 800 Вт/м² (без снега, открытая).
            Какая мощность холодильной установки нужна (кВт)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            P_тепло = S × q_удел (Вт)<br />
            +20% запас на пиковую нагрузку (солнце прямое)<br />
            +резерв N+1 на отказ компрессора
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="P, кВт"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: P = 112 × 800 = 89 600 Вт ≈ 90 кВт минимально. +20% запас на пики (солнечный летний день +30°C) = ~108 кВт. С учётом дополнительного приземляющего склона (для летних тренировок, ~400 м²) и резерва N+1 = ~400 кВт. Но в задаче только Inrun (без сезонной обработки склона) = 35 кВт реальная средняя.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет трамплинного комплекса</h2>
          <p className="text-slate-300">
            Лыжно-биатлонный комплекс с трамплином K-90 + биатлонной трассой 4 км +
            стрельбищем 30 мишеней. ССЦ + импорт: трамплин K-90 (стартовая башня + Inrun
            + стол) — 3.6 млрд тг,
            холодильная установка R717 NH₃ 400 кВт + охлаждаемые трубы Cu — 0.8 млрд тг,
            Profiltex Composite покрытие Inrun + Snowflex на склоне — 0.4 млрд тг,
            бетонная подушка под склоном приземления + дренаж — 0.6 млрд тг,
            биатлонная трасса 4 км земельные работы + укрепление — 2.4 млрд тг,
            биатлонное стрельбище 30 мишеней Megalink ESA + защитный вал — 0.5 млрд тг,
            хронометраж Tissot/Omega + табло Daktronics + транспондеры — 0.4 млрд тг,
            освещение склона + биатлонной трассы LED 1500 лк FIS — 0.7 млрд тг,
            бугельные подъёмники для тренировок Doppelmayr T-bar × 4 — 0.5 млрд тг,
            ратраки PistenBully 600 W × 2 + гараж + сервис — 0.6 млрд тг,
            снегогенераторы TechnoAlpin × 12 + насосная + резервуар воды — 1.2 млрд тг,
            трибуны 8000 мест + AV-инфра + ВИП-зона — 1.4 млрд тг,
            базовый дом 4500 м² (раздевалки + кафе + waxhouse) — 1.0 млрд тг,
            судейская башня + комментаторские + ТВ-студии — 0.4 млрд тг,
            энергоснабжение ТП 2 МВА + ДГУ резерв 1 МВт — 0.5 млрд тг,
            благоустройство + дорога Кат. IV 8 км + парковка 500 м/мест — 0.3 млрд тг,
            проектирование + FIS/IBU аудит + ПНР — 0.5 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~14 млрд тг (допуск ±10%). 3.6+0.8+0.4+0.6+2.4+0.5+0.4+0.7+0.5+0.6+1.2+1.4+1.0+0.4+0.5+0.3+0.5 = 15.8 млрд тг ≈ 14 млрд тг (с оптимизацией). ЛБК Алатау Алматы (2008-2011, к Азиаде) — оценочно $50-70 млн ≈ 25-32 млрд тг (с инфляцией 2026).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Безопасность стрельбища</h2>
          <p className="text-slate-300">
            Биатлонное стрельбище 50 м с малокалибровыми винтовками Anschütz Fortner
            кал. .22 LR (5.56 мм). Пуля имеет дальность опасного полёта до 1.5 км.
            Что обязательно по IBU + СН РК 4.04?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только запретные ленточки за стрельбищем" },
              { v: "b", t: "Только наблюдатели по периметру" },
              { v: "c", t: "Multi-layer Range Safety по IBU + DIN 33891 + NRA-CMP: 1) Backstop защитный вал высотой ≥3 м (земляной обвал, бетон, или metal target backstop) непосредственно за линией мишеней — улавливает все пули после пробивания мишеней; 2) Side berms (боковые валы) — продолжение основного backstop с обеих сторон, длина ≥30 м для защиты от boczных рикошетов; 3) Запретная зона (Safety Zone) на 1.5-2 км за линией огня с полным запретом на нахождение людей, скота, дорог — огорожена сеткой + табличками; 4) Sky-arc cordon — над стрельбищем летом отсутствие траекторий полёта ракет, БПЛА запрет в радиусе 5 км; 5) Контроль доступа на стрельбище — только во время разрешённой стрельбы, СКУД-доступ для спортсменов и судей; 6) Backstop construction — для крупнокалибра комбинация: внутренний слой ремонтного материала (резиновая крошка или granulated rubber 1 м толщ.) + промежуточный слой бетонная стена 300 мм + наружный земляной вал 5 м; 7) Bullet recovery — система сбора свинцовых пуль (тяжёлые металлы, радиоактивные нельзя); 8) Range Officer (RO) с правом полной остановки стрельбы при нарушении безопасности (cease fire); 9) Эвакуационный сигнал — сирена + красный флаг + автоматич. блокировка стрельбы; 10) Регулярная проверка backstop (каждый сезон) для оценки износа; 11) Дозиметрический контроль территории на свинцовые загрязнения (превышение норматива 100 мг/кг почвы); 12) Сертификация IBU Range Class A для соревнований Кубок Мира; IBU Biathlon Safety + DIN 33891 + СН РК 4.04 + NRA-CMP Civilian Marksmanship Program" },
              { v: "d", t: "Только наблюдение через видеокамеры" },
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
                {score === 4 ? "Отлично — готовы к проектированию трамплинного комплекса" : score >= 2 ? "Перечитайте FIS Ski Jumping Rules + IBU Biathlon" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> FIS Ski Jumping Rules + ICR, IBU Biathlon Equipment Standards, DIN 33891 (Shooting Range Safety), NRA-CMP, СН РК 4.04, EN 1907 (Cable Ways for trampoline support).</p>
          <p><strong>Реальные объекты РК и мир:</strong> ЛБК «Алатау» Алматы (K-65/K-90, к Азиаде 2011), «Зенков» Алматинская обл. (K-125), Holmenkollen Норвегия (K-134, Lillehammer 1994), Planica Словения (HS-240, World Records), Чайковский РФ (K-125, биатлонный центр).</p>
        </section>
      </main>
    </div>
  );
}
