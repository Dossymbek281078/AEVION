"use client";
import Link from "next/link";
import { useState } from "react";

export default function TechParkIncubatorPage() {
  const [ex1, setEx1] = useState<string>("");
  const [ex2, setEx2] = useState<string>("");
  const [ex3, setEx3] = useState<string>("");
  const [ex4, setEx4] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const ex2Num = parseFloat(ex2.replace(/\s/g, "").replace(",", "."));
  const ex2Correct = !isNaN(ex2Num) && Math.abs(ex2Num - 2600) <= 250;

  const ex3Num = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
  const ex3Correct = !isNaN(ex3Num) && Math.abs(ex3Num - 28_000_000_000) <= 2_800_000_000;

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
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Технопарки и IT-инкубаторы</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">💻 Технопарки и IT-инкубаторы</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-3xl">
            Модуль #269. Технопарки и IT-инкубаторы РК: Astana Hub 26 000 м²
            (флагман, 1500+ резидентов, открыт 2018), Almaty Park IT-кампус 18 000 м²,
            Astana International Financial Centre (МФЦА) AIFC + Tech Hub. Флекси-офисы
            для стартапов, резиденты Kaspi.kz, CodaPay, Cerebrasense, Higgs Field AI,
            BTS Digital. Акустика open-space + изолированные переговорные boxes,
            цифровые экспозиции + maker-space + 3D-принтеры Stratasys F900,
            STEM-лаборатории. СН РК 3.02-115, WELL Building Standard v2, LEED Gold/Platinum.
          </p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-300">1. Состав технопарка</h2>
          <p className="text-slate-300 leading-relaxed">
            WELL Building Standard + IASP International Association of Science Parks:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
            <li><strong>Open-space зоны:</strong> 60-70% общей площади, гибкие рабочие места hot-desk Steelcase Roam / Herman Miller Cosm, мобильные перегородки.</li>
            <li><strong>Изолированные офисы стартапов:</strong> 15-50 м² для команд 4-12 чел, modular system (можно расширить или объединить).</li>
            <li><strong>Переговорные boxes:</strong> 4-10 чел акустически изолированные кабины Framery O / Phone Booth для звонков, видеоконференций, deep-work.</li>
            <li><strong>Auditorium / Demo Day Hall:</strong> 200-500 мест для презентаций для инвесторов (Pitch Deck Sessions), TED-style амфитеатр.</li>
            <li><strong>Maker-space / Innovation Lab:</strong> 3D-принтеры Stratasys F900, CNC-фрезер Haas TM-1, лазерные резаки Trotec Speedy 400, электроника + IoT прототипирование.</li>
            <li><strong>VR/AR Lab:</strong> Oculus Quest 3 + Varjo XR-4 для иммерсивных стартапов.</li>
            <li><strong>Корпоративные представительства:</strong> Google Cloud, Microsoft Azure, Amazon AWS, Tinkoff GreenAtom присутствие для менторства.</li>
            <li><strong>Кафе и фуд-корт:</strong> Premium-питание (Healthy Bar) + кофе Specialty (Onyx, Stumptown).</li>
            <li><strong>Cпорт-зона:</strong> мини-фитнес 200 м² + йога-комната + nap-room для отдыха.</li>
            <li><strong>Children center:</strong> для детей резидентов (3-6 лет) — соответствие work-life balance.</li>
          </ul>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 1 — Гибкая инженерия (Floor Box System)</h2>
          <p className="text-slate-300">
            Open-space 4000 м² для 300-400 рабочих мест с возможностью гибкой
            перестановки. Какое решение по WELL Building?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Розетки в стенах через каждые 3 м — стандарт" },
              { v: "b", t: "Только потолочные кабели с торчащими шнурами" },
              { v: "c", t: "Только мобильные удлинители с пола" },
              { v: "d", t: "Modular Floor Box System по WELL v2 + LEED Gold: 1) Фальшпол Knauf Sandtex 250-300 мм над несущим перекрытием — пространство для прокладки всех инженерных коммуникаций (силовые кабели + Cat6A + оптоволокно + HVAC-воздуховоды); 2) Floor boxes Hubbell PT3 / Wiremold AMR с разъёмами размещены сеткой 1.5×1.5 м (как розетки в офисе плитки на полу): 220 В + USB-C 65 Вт + Cat6A + HDMI; 3) Закрывающиеся крышки заподлицо с полом (можно ходить по верх) когда не нужны; 4) Каждый floor box имеет 6-12 разъёмов для подключения столов/мониторов; 5) Цена флекси-системы — каждое рабочее место можно переместить на 1.5 м без затрат на электрика; 6) Освещение Office IoT — потолочные LED-светильники Logoele с DMX-управлением через мобильное приложение (нагревать/охлаждать оттенки 2700-6500 K, диммирование 1-100%), индивидуальные предпочтения для каждого рабочего места; 7) Раздача воздуха через перфорированный фальшпол (Underfloor Air Distribution UFAD) — индивидуальная регуляция t° в зоне 1×1 м, comfort 70% выше чем при обычной потолочной раздаче; 8) Звуковое маскирование (Sound Masking) Cambridge Sound Q-1 — pink noise 47 дБ для подавления отвлекающих звуков (privacy effective); 9) Wi-Fi 7 mesh-сеть Cisco Catalyst CW9300W (covering 4000 м² без мёртвых зон); 10) Контроль качества воздуха (CO₂, VOC, формальдегид) — Awair Element датчики каждые 200 м²; WELL v2 + LEED Gold + WELL Air + WELL Light + WELL Comfort" },
            ].map((o) => (
              <label key={o.v} className={`block px-4 py-3 rounded-lg border cursor-pointer transition ${optClass(ex1, o.v, correct.ex1)}`}>
                <input type="radio" name="ex1" value={o.v} checked={ex1 === o.v} onChange={() => setEx1(o.v)} className="mr-3" />
                {o.t}
              </label>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 2 — Кол-во floor boxes</h2>
          <p className="text-slate-300">
            Open-space 4000 м² с сеткой floor box каждые 1.5×1.5 м (как розетки в
            полу). Сколько floor boxes нужно (с допуском на 20% дополнит. для
            переговорных и общих зон)?
          </p>
          <div className="bg-slate-950/60 rounded p-3 text-sm text-slate-400 font-mono">
            N = S / (1.5 × 1.5) = S / 2.25 м²<br />
            +20% дополнит. для переговорных и спец. зон
          </div>
          <input
            type="text"
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            placeholder="Кол-во floor boxes"
            className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Подсказка: 4000 / 2.25 = 1778 шт; +20% = 2133 шт; +дополнит. в переговорных и кафе = ~2600 floor boxes. Это огромная инсталляция (стоимость floor box ~$200/шт = $520 000 = 240 млн тг). Astana Hub имеет сопоставимое количество.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 3 — Бюджет технопарка 18 000 м²</h2>
          <p className="text-slate-300">
            Almaty Park IT-кампус 18 000 м² на 1500 резидентов. ССЦ + импорт:
            монолит каркас + перекрытия 18 000 м² + панорамные витражи — 5.4 млрд тг,
            фальшполы Knauf Sandtex 250 мм для гибкой системы — 1.8 млрд тг,
            2600 Floor Box Hubbell PT3 + проводка Cat6A + питание — 1.2 млрд тг,
            мебель Steelcase Roam + Herman Miller Cosm + Framery O × 24 boxes — 2.4 млрд тг,
            potolочные LED Logoele DMX + Light Tuning + Comfort sensors — 0.8 млрд тг,
            Wi-Fi 7 Cisco Catalyst CW9300W + Edge серверы — 0.6 млрд тг,
            УФД UFAD под фальшполами с индивид. зональной регуляц. — 1.6 млрд тг,
            HVAC прецизионная (контроль CO₂/VOC + точка росы) — 1.4 млрд тг,
            Maker-space лаборатории (Stratasys F900 + Haas TM-1 + Trotec) — 0.8 млрд тг,
            VR/AR Lab Oculus Quest 3 + Varjo XR-4 + 3D-сканеры — 0.4 млрд тг,
            Auditorium 500 мест + AV-инфра + студии трансляции — 1.2 млрд тг,
            маленький фитнес-зал 200 м² + йога + nap-room — 0.2 млрд тг,
            кафе-фудкорт + кофе-станции Premium — 0.4 млрд тг,
            СОУЭ + СОТ + СКУД биометрия + цифровая экспозиция — 0.6 млрд тг,
            энергоснабжение ТП + резерв ДГУ + UPS для серверной — 0.8 млрд тг,
            children-center с воспитателями (для резидентов) — 0.3 млрд тг,
            благоустройство + парковка с EV-charging — 0.6 млрд тг,
            проектирование + WELL/LEED аудит + сертификация Platinum — 0.5 млрд тг. Стоимость?
          </p>
          <input
            type="text"
            value={ex3}
            onChange={(e) => setEx3(e.target.value)}
            placeholder="Итого, тенге"
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Цель: ~28 млрд тг (допуск ±10%). 5.4+1.8+1.2+2.4+0.8+0.6+1.6+1.4+0.8+0.4+1.2+0.2+0.4+0.6+0.8+0.3+0.6+0.5 = 21 млрд тг + резерв и фит-аут = 28 млрд тг (с оптимизацией). Удельная стоимость ~1.56 млн тг/м² — премиум-класс. Astana Hub (26 000 м², 2018) — оценочно $30 млн = 14 млрд тг (по ценам 2018), сейчас (с инфляцией+апгрейд WELL) = ~30 млрд тг.</p>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-amber-300">Упражнение 4 — WELL v2 Certification</h2>
          <p className="text-slate-300">
            WELL Building Standard v2 — самый строгий стандарт здорового рабочего
            пространства. Что обязательно для Platinum-сертификации?
          </p>
          <div className="space-y-2">
            {[
              { v: "a", t: "Только хорошая вентиляция и солнечный свет" },
              { v: "b", t: "Только эргономичные стулья и регулир. столы" },
              { v: "c", t: "WELL Building Standard v2 Platinum (10 концепций): 1) **Air** — расчётная вентиляция ≥30% больше ASHRAE 62.1, фильтрация MERV-13 + активир. уголь VOC; запрет курения в радиусе 10 м; СО₂ &lt;1000 ppm, формальдегид &lt;27 мкг/м³, твёрдые частицы PM2.5 &lt;15 мкг/м³; 2) **Water** — TDS &lt;500 мг/л, бактериол. чистота 100%, фторид &lt;1.5 мг/л, свинец &lt;0.005 мг/л; кулеры с обеззараживанием каждые 200 м²; 3) **Nourishment** — здоровая еда в кафе (≥50% фрукты/овощи/whole grains), доступ к воде ≤30 м от любого рабочего места; 4) **Light** — естест. освещение ≥75% workspace (большие окна + light shelves), искусств. circadian rhythm tuning (2700-6500 K в течение дня), биодинамические LED светильники; 5) **Movement** — лестницы в визуальном фокусе (а не лифты), регулир. столы Stand-up (50% мест), фитнес-зоны на каждом этаже; 6) **Thermal Comfort** — индивидуальная регулировка ±2°C через UFAD, RH 30-60%; 7) **Sound** — RT60 &lt;0.6 с в общих зонах, ≤45 дБ background noise в открытом, ≤35 дБ в фокусированных зонах, sound masking; 8) **Materials** — все материалы Cradle-to-Cradle certified, low-VOC краски Sherwin-Williams Harmony, ковры NSF-140 Platinum, без формальдегида; 9) **Mind** — nap-rooms, биофильный дизайн (растения + природные текстуры), психологическая поддержка резидентам; 10) **Community** — программы для семей резидентов (children center), inclusion accessibility ADA, обзор обратной связи 2 раза/год; WELL v2 Platinum + LEED Gold + Fitwel" },
              { v: "d", t: "Только наличие зон отдыха и фитнес-зала" },
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
                {score === 4 ? "Отлично — готовы к проектированию технопарка" : score >= 2 ? "Перечитайте WELL v2 + LEED Gold + ASHRAE 62.1" : "Изучите модуль и пройдите снова"}
              </div>
            </div>
          )}
        </section>

        <section className="text-xs text-slate-500 border-t border-slate-800 pt-6 space-y-1">
          <p><strong>Нормативы:</strong> WELL Building Standard v2 (Platinum 10 concepts), LEED Gold/Platinum, ASHRAE 62.1 + 90.1, IASP International Association of Science Parks, СН РК 3.02-115, Fitwel.</p>
          <p><strong>Реальные объекты РК:</strong> Astana Hub (26 000 м², 2018, 1500+ резидентов), Almaty Park IT-кампус, AIFC Tech Hub Astana, MOST Hub Атырау, Атамекен Стартап Алматы.</p>
        </section>
      </main>
    </div>
  );
}
