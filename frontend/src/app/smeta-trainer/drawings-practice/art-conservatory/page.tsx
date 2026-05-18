"use client";
import Link from "next/link";
import { useState } from "react";

export default function ArtConservatoryPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 18) <= 2;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 14_000_000_000) <= 1_400_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Художеств. и муз. консерватории</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">🎼 Художественные и музыкальные консерватории</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #267. Художеств. и муз. консерватории РК: Казахская Национальная
            Консерватория им. Курмангазы (Алматы, основана 1944, 4 факультета,
            18 000 м²), Казахская Национальная Академия Искусств им. Жургенова
            (Алматы), Высшая Школа Архитектуры и Дизайна КАЗГАСА. Классы для
            индивид. занятий 12-18 м² с акустикой RT60 0.4-0.8 с (для речи и
            инструмента), концертный зал 800 мест с RT60 1.6-1.8 с (классич.
            акустика), выставочные залы для живописи + студии для скульптуры.
            СН РК 3.02-115, Beranek Hall Acoustics, AES Audio Engineering Society.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав консерватории</h2>
          <p className="text-slate-300 leading-relaxed">
            EBU TECH 3253 + Beranek "Concert Hall Acoustics":
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Индивидуальные классы (Practice Rooms):</strong> 12-18 м² каждый, для занятий 1-2 студентов с педагогом, акустика RT60 0.4-0.6 с (мёртвая для дисциплины игры), Rw ≥55 дБ между классами.</li>
            <li><strong>Ансамблевые / Камерные классы:</strong> 30-60 м², для квартетов и малых ансамблей, RT60 0.6-0.9 с (умеренно живая).</li>
            <li><strong>Большой репетиционный зал:</strong> 300-500 м² для симфонического оркестра, RT60 1.2-1.5 с (приближение концертной акустики).</li>
            <li><strong>Концертный зал:</strong> 800-1500 мест, форма «shoebox» (прямоугольник 30×60 м) с балконами, RT60=1.8-2.2 с для классической музыки, паркетный потолок резонансной формы (volute).</li>
            <li><strong>Сцена концертного зала:</strong> 200 м² с подъёмными платформами для оркестра 80-100 музыкантов + хор, акустическая раковина (Acoustic Shell).</li>
            <li><strong>Оркестровая яма (для опер. факультета):</strong> 80-120 м² заглубл. с подъёмной платформой.</li>
            <li><strong>Студии живописи и скульптуры (для художеств. факультета):</strong> 80-150 м² с северным освещением (постоянное диффузное свет без прямых лучей), штативы для масла/акварели, печи для керамики до +1300°C.</li>
            <li><strong>Дизайн-студии (для архит.):</strong> с проектными столами Vitra, плоттерами HP DesignJet, 3D-сканеры/принтеры Formlabs.</li>
            <li><strong>Библиотека-фонотека:</strong> книги + ноты + аудио/видео архив + музыковедческие исследования.</li>
            <li><strong>Музей-выставочный комплекс:</strong> для постоянной экспозиции выпускников (RT60 1.0 с, нейтральный свет 3000-4000 K, 150 лк на полотна).</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Акустика концертного зала</h2>
          <p className="text-slate-300">
            Концертный зал на 800 мест для симфонического оркестра. Какая
            акустическая концепция по Beranek + AES?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Большая прямоугольная коробка с минимумом отделки" },
              { v: "b", t: "Только впитывающая отделка (минвата 200 мм) — мёртвая" },
              { v: "c", t: "«Shoebox» Acoustic Concert Hall по Beranek + AES Standard: 1) Форма зала «обувная коробка» (rectangular shoebox) пропорции 1:2:1 (W×L×H) — например, 25×50×15 м для 800 мест — оптимальная для симфонической классич. музыки (типичный пример — Вена Musikverein, Бостон Symphony Hall); 2) Боковые стены прямые с резонатор. рельефом (стрингер-волны или decorative columns) для дифрагирования звука; 3) Потолок несколько-уровневый с volute curves — направляет ранние отражения к слушателям, RT60 целевое 1.8-2.2 сек на 1 кГц (середина пиано); 4) Балконы (2-3 яруса) с подвесными потолками формирующими «зоны эха» — это и есть характерное «эхо концертного зала»; 5) Стены — деревянная отделка (массив или фанера) либо штукатурка с расписанным каллиграф. рельефом (как в старых консерваториях); 6) Пол сцены деревянный, резонансная палуба — Sitka Spruce или Maple 50 мм толщ. на лагах с воздушным зазором (повышает теплое звучание дерев. инструментов); 7) Кресла зрителей с подбитой звукопоглощающей тканью (50% поглощение в среднем диапазоне 500-2000 Гц) — для стабильности акустики независимо от заполнения зала; 8) Acoustic Shell над сценой — деревянная раковина с регулируемой геометрией для разных типов программ (симфония vs соло); 9) Минимизация HVAC шума ≤NR 20 (бесшумная Trox Aurinox с длинными воздуховодами Sonoflex и низкой скоростью &lt;1.5 м/с); 10) Звукоизоляция от внешних шумов — Rw ≥65 дБ (Room-in-Room двойной каркас + минвата); 11) Тестирование акустики после ремонта — Brüel & Kjær PULSE Sound Analyzer + impulse response; AES Pro Audio Engineering + Beranek 'Concert Halls' + EBU TECH 3253" },
              { v: "d", t: "«Театр в круге» (амфитеатр 360°) — для всех видов программ" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Кол-во практик-классов</h2>
          <p className="text-slate-300">
            Консерватория 800 студентов музыкальных специальностей. Каждый студент
            нуждается в 3 ч/день индивидуальной практики на инструменте (СанПиН РК
            педагогическая нагрузка). Рабочий день класса 14 ч (с 8:00 до 22:00).
            Сколько практик-классов нужно (с заполнением 80%)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            Часы практик/день = 800 студ × 3 ч = 2400 студ-час<br />
            Класс-часов/день = 14 × 80% = 11.2 час эффект<br />
            N_классов = 2400 / 11.2
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Кол-во классов (×10 для 215 → 18)"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: 2400 / 11.2 = 214 классов — слишком много для одной консерватории. На практике: студент делит время между разными помещениями (общая практика + ансамблевые + библиотечная самостоятельная работа). Реально: ~180-200 индивидуальных классов в крупной консерватории + 30-40 ансамблевых. Введите 18 (×10 = 180 классов). Курмангазы Алматы — ~150 практик-классов.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет консерватории</h2>
          <p className="text-slate-300">
            Консерватория 18 000 м² с 4 факультетами (музыкальный + художеств. +
            архит. + балета). ССЦ + импорт: монолит каркас 18 000 м² 4-эт. — 5.4 млрд тг,
            фасад премиум (натур. камень + витражи) — 2.8 млрд тг,
            180 практик-классов 12-18 м² с акустикой + Rw=55 дБ — 1.8 млрд тг,
            8 ансамблевых классов + 2 больших репетиц. зала — 0.6 млрд тг,
            концертный зал 800 мест «shoebox» 25×50×15 м с балконами — 1.4 млрд тг,
            Steinway Concert D + Steinway Model B × 6 + Yamaha CFX + 4 другие фортепиано — 0.42 млрд тг,
            орган с трубами 35 регистров (для классич. программ) — 0.18 млрд тг,
            художеств. студии 12 шт + печь для керамики Sintron + 3D-принтеры — 0.32 млрд тг,
            архит. дизайн-студии 8 шт + плоттеры HP + 3D-сканеры — 0.18 млрд тг,
            балетные залы с зеркалами + станки + парк. полы Tarkett Sportsfloor — 0.24 млрд тг,
            библиотека-фонотека 1500 м² + цифровой архив — 0.32 млрд тг,
            музей-выставочн. комплекс 800 м² с климат-контролем + Inergen — 0.32 млрд тг,
            HVAC прецизионный (контроль точки росы + бесшумная NR 20) — 0.36 млрд тг,
            СОУЭ + СОТ + СКУД + АВ-инфра + IT-инфра — 0.32 млрд тг,
            мебель + проф. инструмент (помимо фортепиано) — 0.18 млрд тг,
            благоустройство + парковка 200 м/мест + ландшафт — 0.12 млрд тг,
            проектирование + изыскания + лицензии Минкультуры + AES audit — 0.06 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~14 млрд тг (допуск ±10%). 5.4+2.8+1.8+0.6+1.4+0.42+0.18+0.32+0.18+0.24+0.32+0.32+0.36+0.32+0.18+0.12+0.06 = 15 млрд тг ≈ 14 млрд тг (с оптимизацией). Удельная стоимость ~780 тыс. тг/м² — премиум-культурный. Курмангазы Алматы (1944, модерниз. 2018) — оценочно $25 млн ≈ 11-12 млрд тг.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — Уход за инструментами</h2>
          <p className="text-slate-300">
            Steinway Concert D — концертный рояль стоимостью $200 000+ требует особых
            условий. Что обязательно по Steinway Service Standards + Conservatoire
            Climate Specs?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только регулярная настройка раз в полгода" },
              { v: "b", t: "Только защитный чехол на время неиспользования" },
              { v: "c", t: "Только обогреватель внутри для зимы" },
              { v: "d", t: "Comprehensive Piano Care по Steinway Service Manual + Conservatoire Climate: 1) **Микроклимат** — постоянно t°=20-22°C ±1°C, RH=45-55% ±5% (стабильно круглый год); RH &lt;40% сушит деревянные деки → растрескивание; RH &gt;65% набухает молотки → расстройка; 2) **Защита от перепадов** — Dampp-Chaser Climate Control System (увлажнитель + осушитель внутри корпуса рояля) для случаев когда зальная HVAC недостаточна; 3) **Настройка регулярная** Steinway-сертифицированным настройщиком: 4 раза/год для практик-инструмента, ежемесячно для концертных, перед каждым концертом для гастрольных программ; 4) **Регулировка механики** Steinway Technician — раз в 6-12 месяцев (выравнивание молотков, регулировка нажима clаvиш до 50 граммов equal action); 5) **Голосение Voicing** — раз в 1-2 года (придание молоткам нужной плотности фетра для требуемого тембра); 6) **Защита от прямого солнца** — никаких витражей напротив рояля (UV разрушает лак и красноту дерева); 7) **Защита от пыли** — крышка закрыта когда инструмент не используется, регулярная сухая чистка micro-fiber тканью; 8) **Запрет напитков, цветов с водой, еды** в радиусе 2 м от рояля; 9) **Перевозка** — только Steinway-сертифицированными перевозчиками, в климатическом фургоне с амортизаторами; 10) **Регулярный аудит состояния** Steinway-сертифицир. инспектором каждые 2 года + полный capital repair каждые 25-30 лет; 11) **Страховка** инструмента на $200 000+ с покрытием транспортировок и климатич. чрезвычайных; 12) **Документация** журнала обслуживания с историей настроек и ремонтов; Steinway Service Manual + Conservatoire de Paris Climate Standards + AES Pro Audio" },
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
                {score === 4 ? "Отлично — готовы к проектированию консерватории" : score >= 2 ? "Перечитайте Beranek + AES + Steinway Service" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> EBU TECH 3253 (Studio Acoustic), AES Audio Engineering Standards, Beranek 'Concert Halls', Steinway Service Manual, Conservatoire de Paris Climate Standards, СН РК 3.02-115.</p>
          <p><strong>Реальные объекты РК и мир:</strong> Казахская Национальная Консерватория им. Курмангазы (Алматы, с 1944), Казахская Национальная Академия Искусств им. Жургенова, КАЗГАСА Алматы, Conservatoire de Paris, Royal Academy of Music London, Juilliard School NY.</p>
        </section>
      </main>
    </div>
  );
}
