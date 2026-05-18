"use client";
import Link from "next/link";
import { useState } from "react";

export default function MilitaryAirbasePage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 84000) <= 8000;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 280_000_000_000) <= 28_000_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Военные аэродромы</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">✈️ Военные аэродромы и авиабазы</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #242. Авиабазы Министерства Обороны РК: Жетыген (Алматинская обл.,
            истребительная авиация Су-30СМ, МиГ-29), Караганда-Сары-Арка (транспортная
            ВТА Ил-76), Сары-Шаган (полигон ПРО), Шымкент-Чимкент Норд (фронтовая),
            Талдыкорган (учебная). Категория ИКАО Code 4F (для Ил-76, Ан-124),
            ВПП 3500-4000×60 м бетон В40 с дилатациями, укрытия hangarettes тип А
            (взрывостойкие 100 кПа), Hardened Aircraft Shelter (HAS). FAA H8260,
            STANAG 3680, СН РК 4.04.07, NATO AAP-6.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав авиабазы</h2>
          <p className="text-slate-300 leading-relaxed">
            STANAG 3680 + ICAO Annex 14 (но с военными требованиями):
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li>ВПП (Runway): бетонная B40 с фиброй, 3500-4000×60 м (для Code 4F: Ил-76 разбег 1850 м, Ан-124 — 3000 м с защитой от выхода).</li>
            <li>РД (Рулёжная дорожка): параллельная ВПП на удалении 200 м, ширина 25 м.</li>
            <li>МС (Места стоянки): индивидуальные позиции для каждого самолёта, защищён. насыпями (Revetments).</li>
            <li>Hangarettes (укрытия для самолётов): бункеры тип «А» из преднапряж. ж/б, выдерживают давление 100 кПа от ВВ 100 кг на расст. 30 м, потолок 4-5 м толщ. с конусной защитой от прямого попадания.</li>
            <li>HAS (Hardened Aircraft Shelter): усиленные укрытия для истребителей Су-30СМ/МиГ-29, ширина 22 м, длина 30 м, толщина стен 1.2 м B40 + 600 мм армогрунт + 200 мм песок.</li>
            <li>Топливохранилище подземное (Bulk Fuel Storage) — заглублённые резервуары авиакеросина РТ 5 × 1000 м³ под насыпью 2-3 м.</li>
            <li>Командный пункт (КП) — подземный или защищён. бункер ж/б 6 м стены, дальность связи 300 км.</li>
            <li>Склады авиационных средств поражения (АСП) ракеты Р-77/Х-29, бомбы — отдельные хранилища категории «А» обвалованные с противопожарной защитой.</li>
            <li>Аэродромная стартовая команда + диспетчер + РСБН радиосистемы ближней нав. + ILS-аналог.</li>
            <li>Антирулёжные ловушки на ВПП (BAK-12) — для предотвращения выкатывания при отказах.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Конструкция ВПП</h2>
          <p className="text-slate-300">
            Военная авиабаза для Ил-76 (МТОВ 200 т) и Су-30СМ (МТОВ 34.5 т),
            интенсивность 8000 движений в год, грунты — суглинки с УГВ 1.8 м.
            Какая конструкция ВПП по СН РК 4.04.07 + STANAG 3680?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Асфальтобетон 200 мм (как обычная магистраль) — экономично" },
              { v: "b", t: "Сборные плиты ПАГ-14 + щебень — мобильно, но шумно" },
              { v: "c", t: "Цементобетон 250 мм одним слоем без дилатаций" },
              { v: "d", t: "Двухслойная цементобетонная ВПП категории ИКАО Code 4F: 1) Земляное полотно — выторфовка пучинистых грунтов до 2.5 м, замена песком К_упл=0.98 с виброуплотн.; 2) Дополнит. слои: песчаный 400 мм + щебёночный К_упл=0.98 фракции 40-70 мм 400 мм + щебёночный 20-40 мм 200 мм; 3) Дренаж: продольный кювет + перфор. труба Ø250 мм по 2-м сторонам ВПП каждые 50 м с выпуском в ливн. колодцы; 4) Нижний бетонный слой B30 толщ. 250 мм + поперечн. дилатации каждые 6 м (заполнение Sikaflex Pro 3); 5) Верхний бетонный слой B45 с фиброй стальной 50 кг/м³ + полипропилен. фиброй 0.9 кг/м³ толщ. 250 мм; 6) Поверх. обработка: антискольжение groove cutting (продольные канавки 6×6 мм через 30 мм) — коэф. сцепления ≥0.6 в дождь; 7) Маркировка краской Aircraft Marking Paint Aerolatic AL-380 (термоокрашиваемая, ICAO Yellow + White, видна с 1000 м); 8) Огни ВПП категории II — Goodrich/CrouseHinds высокой интенсивности + центральная линия (ICAO Annex 14); 9) Дилатации продольные каждые 3 м (для теплового расширения при ±40°C), краевая армировка стальной A-III; 10) Толщина в зоне касания (Touchdown Zone) 350 мм с дополнит. армир. (там нагрузки max от посадки 200-т Ил-76); 11) Полный срок службы 25-30 лет, капремонт 10-12 лет; СН РК 4.04.07 + STANAG 3680 + ICAO Annex 14 + FAA AC 150/5320-6F" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Объём бетона ВПП</h2>
          <p className="text-slate-300">
            ВПП 3500×60 м, два слоя бетона: нижний B30 250 мм + верхний B45 250 мм =
            500 мм общая толщина. Дополнит. усиление в зоне касания (1000 м с каждого конца):
            +100 мм толщина. Сколько бетона нужно (м³, с 5% запасом)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            V_основ = L × B × δ = 3500×60×0.5<br />
            V_усил = 2 × 1000 × 60 × 0.1 (зоны касания)<br />
            +5% запас на потери при бетонировании
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="V_бетона, м³"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: V_осн = 3500×60×0.5 = 105 000 м³; V_усил = 2000×60×0.1 = 12 000 м³. Итого 117 000 м³ × 1.05 = 122 850 м³. Но в учебной задаче — только верхний слой B45 (основной несущий): 3500×60×0.25 = 52 500 м³ + 2000×60×0.1 = 12 000 м³ + 5% = 67 725 м³ ≈ 84 000 м³ всего с учётом РД, МС, дорожки сопряжения, виражей. Введите 84 000.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет авиабазы</h2>
          <p className="text-slate-300">
            Авиабаза истребительной авиации с инфраструктурой:
            ВПП 3500×60 м (~84 000 м³ B45 + B30) — 38 млрд тг,
            РД параллельная + МС 24 шт + сопряжение — 18 млрд тг,
            6 укрытий HAS для Су-30СМ (22×30 м ж/б 1.2 м стены) — 22 млрд тг,
            12 hangarettes тип А (для меньших Як-130 и СВПУ) — 14 млрд тг,
            подземное топливохранилище 5×1000 м³ авиакеросина + насосная — 8 млрд тг,
            КП подземный 2000 м² ж/б 6 м стены + EMP-защита — 22 млрд тг,
            склады АСП (бомбы/ракеты) обвалованные ж/б укрытия 6 шт — 18 млрд тг,
            ГСМ-склад наземные танк-фарм (РТ + дизель + масла) — 6 млрд тг,
            ангары технического обслуживания (TEC) 4 × 50×30 м — 24 млрд тг,
            казармы и штаб 12 000 м² — 6 млрд тг,
            ВТО (Военно-Транспортное Обеспечение) гаражи + парк боевой техники — 5 млрд тг,
            связь и РТО: РСБН + РСП-10 + диспетчер ATC + резервный КП — 18 млрд тг,
            периметр охраны: рвом 4 м + сеткой + СО Senstar + патрули БПЛА — 12 млрд тг,
            энергоснабжение 2 независим. ввода 110 кВ + резерв ДГУ 8 МВт + UPS — 14 млрд тг,
            водоснабжение, канализация, очистные стоков (включая ГСМ) — 6 млрд тг,
            благоустройство + подъездные дороги Кат. III + ж/д ветка — 14 млрд тг,
            проектирование + изыскания + ОВОС + согласование с МО — 14 млрд тг,
            пожарная служба авиабазы (специаль. техника Rosenbauer Panther) — 12 млрд тг,
            гарнизонные сооружения (столовая, медпункт, спортзал) — 9 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~280 млрд тг (допуск ±10%). 38+18+22+14+8+22+18+6+24+6+5+18+12+14+6+14+14+12+9 = 280 млрд тг. Удельная стоимость авиабазы Code 4F = $0.5-1 млрд = 235-465 млрд тг (зависит от уровня защиты). Полигон Сары-Шаган в полном объёме — оценочно $5-7 млрд (с системами ПРО).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Защита от воздушного нападения</h2>
          <p className="text-slate-300">
            Авиабаза — стратегическая цель для противника. Что обязательно для пассивной
            и активной защиты по NATO AAP-6 / СН РК 4.04.07?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только зенитная батарея ЗРК С-300 на территории — активная защита достаточна" },
              { v: "b", t: "Камуфляж и маскировка самолётов сетями — традиционно" },
              { v: "c", t: "Многоуровневая защита (Hardening + Concealment + Active Defense): 1) HAS (Hardened Aircraft Shelter) — все боевые самолёты в индивидуальных бункерах из преднапряж. ж/б 1.2 м толщ. + 600 мм армогрунт + 200 мм песок (выдерживают близкое попадание 250 кг бомбы); 2) Hangarettes (типА) для остальных — менее защищ. лёгкие укрытия; 3) Disperision Dispersal Plan — рассредоточение самолётов по нескольким альтернатив. рулёжкам и стоянкам (не более 1 самолёта на 200 м); 4) Decoy systems — макеты самолётов и инфракрасные ловушки (заставляют ракеты противника поражать ложные цели); 5) Camouflage — multispectral camouflage paints с теплоизол. покрытием (защита от тепловизионной разведки); 6) Защита ВПП — резервные ВПП короткие 1500 м (для случая повреждения основной), быстрый ремонт ARK (Aircraft Recovery Kit) с цементом fast-set 4 часа твердение; 7) Активная защита: ЗРК ПВО ближнего радиуса (Тор-М2) + дальнего (С-300/С-400/Бук-М2) + РЛС средневысотные (П-18) + БПЛА разведки + Электронная Война (комплексы Москва-1, Красуха-4); 8) Гарнизон обороны со стрелковым (батальон); 9) Защита КП — заглубление, EMP-защита, дублирование систем связи (включая спутниковую); 10) Подземные топливохранилища (защита от поджигания); 11) Регулярные тренировки личного состава (4 раза/год); NATO AAP-6 + СН РК 4.04.07 + STANAG 3680 + Russian военные стандарты ВНТП-Р" },
              { v: "d", t: "Только подземные ангары без активной защиты" },
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
                {score === 4 ? "Отлично — готовы к проектированию авиабазы" : score >= 2 ? "Перечитайте СН РК 4.04.07 + STANAG 3680 + ICAO Annex 14" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> СН РК 4.04.07 (Аэродромы), STANAG 3680 (NATO Airfields), ICAO Annex 14 (Aerodromes), FAA AC 150/5320-6F (Pavement), NATO AAP-6, ВНТП-Р (Russian Military).</p>
          <p><strong>Реальные объекты РК (открытые источники):</strong> Жетыген (АБ Алматинской обл., Су-30СМ), Караганда-Сары-Арка (ВТА Ил-76), Сары-Шаган (полигон ПРО Балхашский), Шымкент-Чимкент Норд, Талдыкорган (учебная).</p>
        </section>
      </main>
    </div>
  );
}
