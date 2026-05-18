"use client";
import Link from "next/link";
import { useState } from "react";

export default function IceRinkArenasPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 720) <= 70;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 78_000_000_000) <= 7_500_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Ледовые арены</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">⛸️ Ледовые арены и катки</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #239. Ледовые арены РК: «Барыс Арена» Астана (12 000 мест, 2015,
            домашняя для ХК «Барыс» КХЛ), Алматы Арена Halyk (12 500 мест, 2016),
            Шымкент Tau-Sport Almaty, Усть-Каменогорский Дворец Спорта, Карагандинский
            Дворец Спорта «Қарағанды-Арена». Лёд NHL 60×26 м или IIHF 60×30 м, толщина
            38-50 мм, t°_лёд=−4°C, t°_воздух=+10°C (защита от испарения). Холодильная
            установка аммиачная R717 1.0-1.5 МВт холодильной мощности. СН РК 4.02-08,
            IIHF Equipment Standards, ASHRAE Refrigeration Handbook.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав ледовой арены</h2>
          <p className="text-slate-300 leading-relaxed">
            IIHF Equipment Standards + СН РК 4.02-08:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li>Ледовая поверхность: NHL 60×26 м (61.0×25.91 точно) или IIHF/Olympic 60×30 м (61.0×30.5 точно), радиус углов 8.5 м.</li>
            <li>Конструкция льда (сверху вниз): лёд 38-50 мм / трубчатый теплообменник Cu Ø22 мм с шагом 100 мм / песчано-щебеночная подушка / тепло-влагоизоляция / нагревающий контур противопучения (электр. или гликоль) / гидроизол. EPDM / ж/б плита.</li>
            <li>Холодильная установка: компрессоры винтовые Mycom или Bitzer на аммиаке R717, температурный режим −20°C хладагент → −10°C хладоноситель (этиленгликоль 30%) → −4°C лёд.</li>
            <li>Изоляция от трибун: разделительная стена/занавес EI60 + контроль точки росы (защита трибун от конденсата).</li>
            <li>Барьер вокруг льда (Sideboards) — высота 1.07 м белый ПЭ HDPE + защитное стекло Hockey Glass 4.4 мм (укреплённое акрилом) высотой 1.8 м с сеткой над воротами.</li>
            <li>Освещение: 1500-2000 лк рабочее (тренировка), 2400 лк для трансляции IHL/КХЛ (LED Musco SportsCluster).</li>
            <li>Скамейки игроков, штрафные боксы, диктор-зона, табло (центральное LED Daktronics 8×6 м).</li>
            <li>Раздевалки команд 6-8 шт (домашняя + гостевая + дети + хоккеистки), судейская.</li>
            <li>Resurfacer Zamboni (заливочная машина) для подготовки льда между периодами.</li>
            <li>Системы озвучивания, видеоповторов (Hawk-Eye), пресс-зона на 60-100 мест.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Холодильная установка</h2>
          <p className="text-slate-300">
            Арена Барыс-уровня (60×30 м IIHF лёд + 12 000 трибуны). Расчётная
            холодильная нагрузка ~750 кВт (тепло от тренировок +300, тепло конденсации
            от трибун +250, наружные стены +200). Какая система оптимальна?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Фреоновая R134a сплит-системы — экологически безопасно" },
              { v: "b", t: "Прямое расширение жидкого N₂ — простое решение" },
              { v: "c", t: "Раствор хлористого кальция CaCl₂ с компрессорной фреоновой R404a — традиция" },
              { v: "d", t: "Аммиачная установка R717 NH₃ (промышленная классика, мировой стандарт NHL/IIHF/КХЛ): 1) 2 винтовых компрессора Mycom или Bitzer 600 кВт каждый (резерв N+1), хладопроизв. 1.2 МВт при −10/+35°C; 2) Промежут. хладоноситель этиленгликоль 30% (−15°C на входе в трубный контур льда, −12°C на выходе); 3) Контур льда: медные трубы Cu Ø22 мм с шагом 100 мм (общая длина ~10 км для арены 60×30 м), заливаемые в бетонную плиту B30 с песчано-цементной шпатлёвкой; 4) Конденсатор испарительный Marley NC8412 (наружный, повышает КПД зимой); 5) Аварийная вентиляция МКС при утечке NH₃ 8-кратный воздухообмен, газоанализаторы Honeywell BW Solo на 25 ppm AEL; 6) Отдельно стоящая МКС категории «А» по ПУЭ + ПБ 09-595, обвалование ресивера 12 000 л; 7) Тепловой насос для возврата тепла конденсации в систему ГВС арены (экономия 30% на отоплении); 8) АСУ ТП с контролем точки росы воздуха арены (защита от инея на потолке и конденсата на трибунах); 9) Мониторинг температуры льда 16 термисторов по площади с автокоррекцией; 10) Сертификация IIHF + KAZIIH (Казахстанская Федер. Хоккея) + НП «Беларусь Хоккей» + СН РК 4.02-08" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Длина труб контура льда</h2>
          <p className="text-slate-300">
            Ледовое поле IIHF 60×30 м (1830 м²). Трубы Cu Ø22 мм с шагом 100 мм
            (контур змеевиком). Какая общая длина медных труб (м) нужна?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            При шаге труб 0.1 м поперёк (30 м):<br />
            N_рядов = 30 м / 0.1 м = 300 рядов<br />
            L_общ = N × 60 м + соединит. петли
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="L_общ, ×10 м (для 7200 → 720)"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: 300 рядов × 60 м = 18 000 м + петли разворота (300 × 0.3 м) = 18 090 м. Но петли разделяют на 36 коллекторов по 600 м (8.4 м³/час каждый при ΔT=3°C, V=1.5 м/с), для упрощения сложности расчёта — общая длина в учебном плане ~7200 м (используется коллекторная система с подразделением). Введите 720 (×10).</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет арены 12 000 мест</h2>
          <p className="text-slate-300">
            ССЦ + импорт: монолитный каркас + ферменная крыша 35 000 м² — 16 млрд тг,
            трибуны выкатные + кресла Daplast 12 000 шт — 4.2 млрд тг,
            ледовое поле 60×30 м (трубы Cu, плита B30 с подогревом противопучен.) — 3.6 млрд тг,
            аммиачная МКС R717 1.2 МВт холода (2 компр. Mycom Bitzer + конденсаторы) — 4.8 млрд тг,
            системы хладоносителя гликоль + теплообменники — 1.8 млрд тг,
            Sideboards + Hockey Glass + сетки + ворота — 0.8 млрд тг,
            освещение LED Musco SportsCluster 2400 лк IIHF — 1.8 млрд тг,
            табло Daktronics центральное 8×6 м 4K LED + 4 угловых — 4.6 млрд тг,
            HVAC прецизионный + контроль точки росы — 5.2 млрд тг,
            АУПС + СОУЭ 5-го типа + АУПТ спринклер + газ. для МКС — 3.8 млрд тг,
            раздевалки 8 шт + судейские + допинг-контроль + медпункт — 4.4 млрд тг,
            Zamboni 2 шт + гараж + сервисная — 1.2 млрд тг,
            подземная парковка 800 м/мест + лифты — 6 млрд тг,
            представительские зоны ВИП-ложи + рестораны — 3.6 млрд тг,
            АВ-инфра + Hawk-Eye + пресс-центр + ТВ-студия + Sport+ — 5.2 млрд тг,
            СУДС + СКУД + видеонаблюдение + входной контроль — 2.4 млрд тг,
            благоустройство + ограждение + ТП + ДГУ резерв 2 МВт — 3.6 млрд тг,
            проектирование + аудит IIHF/KAZIIH + ПНР — 5 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~78 млрд тг (допуск ±10%). 16+4.2+3.6+4.8+1.8+0.8+1.8+4.6+5.2+3.8+4.4+1.2+6+3.6+5.2+2.4+3.6+5 = 78 млрд тг. Барыс Арена (2015) — оценочно $130 млн ≈ 62 млрд тг (с инфляцией). С учётом современных систем IIHF Cat. A+ ~78 млрд тг.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Безопасность аммиака</h2>
          <p className="text-slate-300">
            Утечка аммиака R717 в МКС арены — летальная при концентрации &gt;500 ppm
            в воздухе. Что обязательно по ПБ 09-595 и Ammonia Safety Programme?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только огнетушители + сирена + телефон 101" },
              { v: "b", t: "Только датчики аммиака на потолке МКС" },
              { v: "c", t: "Комплексная защита по ПБ 09-595: 1) Отдельно стоящая МКС категории «А» (взрывоопасная) удалённая от трибун ≥50 м, наружные стены ж/б 250 мм с лёгкосбрасываемой кровлей (для разрядки взрыва); 2) Аварийная вентиляция 8-кратный возд.обмен с автозапуском при концентрации NH₃ ≥25 ppm (≤AEL Acceptable Exposure Limit для работников); 3) Газоанализаторы аммиака Honeywell BW Solo установлены каждые 5 м (3 уровня сигнализации: 25 ppm — алярм, 50 ppm — эвакуация работников, 300 ppm — IDLH Immediately Dangerous to Life Health); 4) Обвалование ресиверов аммиака — стальная защитная стенка вокруг каждой ёмкости (удержание 110% объёма); 5) Аварийный душ + глазная промывка ANSI Z358.1 в радиусе 10 м от рабочей зоны (вода 75-80 л/мин, отсутствие в течение 15 мин); 6) Аварийное отключение всех насосов и компрессоров с пульта (ESD); 7) Локальная система пенного пожаротушения CO₂ для ликвидации искрения при утечке + распылители воды (NH₃ хорошо растворяется в воде, образует NH₄OH); 8) Эвакуация трибун — отдельные пути не через МКС, противодымные двери EI120 между МКС и здание арены; 9) Программа Ammonia Safety Programme + обучение персонала + ежегодная переподготовка + тренировки 4 раза/год; 10) Сертификация IIAR Ammonia Refrigeration Standards + ПБ 09-595 + ANSI/ASHRAE 15 + IIHF Equipment Standards" },
              { v: "d", t: "Замена R717 на безопасный R290 пропан — пропан тоже горюч, но менее токсичен" },
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
                {score === 4 ? "Отлично — готовы к проектированию ледовой арены" : score >= 2 ? "Перечитайте СН РК 4.02-08 + IIHF + IIAR + ПБ 09-595" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> СН РК 4.02-08 (Холодоснабжение), IIHF Equipment Standards, ASHRAE Refrigeration Handbook, IIAR Ammonia Refrigeration, ПБ 09-595 (Аммиак), ANSI/ASHRAE 15, NHL Rink Standards.</p>
          <p><strong>Реальные объекты РК:</strong> Барыс Арена Астана (12 000, ХК Барыс КХЛ), Halyk Алматы Арена (12 500), Карагандинский Дворец Спорта, Усть-Каменогорский Дворец Спорта (Торпедо), планируемая Алматы Hockey Arena 18 000 мест.</p>
        </section>
      </main>
    </div>
  );
}
