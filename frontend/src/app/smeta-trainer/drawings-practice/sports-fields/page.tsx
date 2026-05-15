"use client";

import Link from "next/link";
import { useState } from "react";

export default function SportsFieldsPage() {
  const [ex1, setEx1] = useState<string | null>(null);
  const [ex1Res, setEx1Res] = useState<null | "ok" | "bad">(null);
  const [ex1Sol, setEx1Sol] = useState(false);

  const [ex2, setEx2] = useState<string | null>(null);
  const [ex2Res, setEx2Res] = useState<null | "ok" | "bad">(null);
  const [ex2Sol, setEx2Sol] = useState(false);

  const [ex3, setEx3] = useState("");
  const [ex3Res, setEx3Res] = useState<null | "ok" | "bad">(null);
  const [ex3Sol, setEx3Sol] = useState(false);

  const [ex4, setEx4] = useState<string | null>(null);
  const [ex4Res, setEx4Res] = useState<null | "ok" | "bad">(null);
  const [ex4Sol, setEx4Sol] = useState(false);

  const checkEx1 = () => setEx1Res(ex1 === "c" ? "ok" : "bad");
  const checkEx2 = () => setEx2Res(ex2 === "b" ? "ok" : "bad");
  const checkEx3 = () => {
    const v = parseFloat(ex3.replace(/\s/g, "").replace(",", "."));
    if (!isFinite(v)) return setEx3Res("bad");
    setEx3Res(Math.abs(v - 102000000) <= 8000000 ? "ok" : "bad");
  };
  const checkEx4 = () => setEx4Res(ex4 === "d" ? "ok" : "bad");

  const footballPie = [
    { layer: "Искусственный газон (ворс PE)", thickness: "50–60 мм", note: "FIFA Quality Pro / Quality, ворс монофиламент PE" },
    { layer: "Засыпка: кварц. песок + EPDM/пробка", thickness: "25–35 мм", note: "Песок 18–22 кг/м² + резина EPDM 8–14 кг/м²" },
    { layer: "Эластичная подложка (Shock-Pad)", thickness: "10–25 мм", note: "Латексная EPDM-крошка, амортизация HIC ≤ 0,8" },
    { layer: "Асфальтобетон или ЩПС закрытая", thickness: "60–80 мм", note: "Жёсткое основание под укладку газона" },
    { layer: "Песок крупный (фильтрующий)", thickness: "100 мм", note: "Дренажный слой" },
    { layer: "Щебень фр. 20–40", thickness: "200–250 мм", note: "Основной несущий + дренажный слой" },
    { layer: "Геотекстиль 200 г/м²", thickness: "—", note: "Разделяющий, поверх уплотнённого грунта" },
  ];

  const athleticsClasses = [
    { cls: "IAAF Class 1", use: "Мировые рекорды, Олимпиада, ЧМ", req: "9 дорожек, толщина 13–15 мм, sandwich + spray" },
    { cls: "IAAF Class 2", use: "Национальные старты, региональные", req: "6–8 дорожек, толщина 12–13 мм, sandwich" },
    { cls: "Тренировочный", use: "Клубы, школы, ВУЗы", req: "4–6 дорожек, EPDM 10–13 мм, без сертификата" },
  ];

  const tennisCourts = [
    { type: "Hard (бетон + акрил)", pace: "ITF Pace 3–4 (medium-fast)", layers: "Бетон 100 мм + асфальт 50 мм + акрил Plexipave/Decoturf 4 слоя", price: "18–28 тыс. тг/м²" },
    { type: "Clay (грунт)", pace: "ITF Pace 1–2 (slow)", layers: "Дренаж 200 мм + теннизит 25 мм + молотый кирпич 4 мм", price: "9–14 тыс. тг/м²" },
    { type: "Grass (трава)", pace: "ITF Pace 5 (fast)", layers: "Плотный песок 100 мм + райграс многолетний, стрижка 8 мм", price: "22–32 тыс. тг/м²" },
    { type: "Carpet (синтетика)", pace: "ITF Pace 3 (medium)", layers: "ЩПС + резиновый ковёр + текстильное покрытие", price: "14–20 тыс. тг/м²" },
  ];

  const golfZones = [
    { zone: "Tee (стартовая площадка)", grass: "Бентграсс/семидвордовка", note: "Стрижка 8–12 мм, плотное покрытие" },
    { zone: "Fairway (фарвей)", grass: "Bermuda / Kentucky bluegrass", note: "Стрижка 12–16 мм, ширина 30–55 м" },
    { zone: "Rough (полугрубое)", grass: "Fescue mix", note: "Стрижка 40–80 мм, штрафная зона" },
    { zone: "Green (грин)", grass: "Bentgrass / Seashore paspalum", note: "Стрижка 3–4 мм, песчаное основание USGA" },
    { zone: "Bunker (бункер)", grass: "Песок кварц. отмытый", note: "Глубина 100–200 мм, дренажный пирог" },
  ];

  const universalLayers = [
    { type: "Каучуковая крошка EPDM 15 мм", use: "Детские, мульти-площадки", price: "8–13 тыс. тг/м²" },
    { type: "Каучуковая крошка SBR 20 мм", use: "Школьные, бюджет", price: "5–8 тыс. тг/м²" },
    { type: "Бесшовный полиуретан 12–18 мм", use: "Бег, фитнес, баскетбол", price: "11–17 тыс. тг/м²" },
    { type: "Резиновая плитка 30×30 см", use: "Тренажёрные зоны, лёгкий монтаж", price: "9–12 тыс. тг/м²" },
  ];

  const lightingClasses = [
    { en: "EN 12193 Class III (трен.)", lux: "75–150 лк", uniformity: "U2 ≥ 0,5", use: "Тренировки, школы" },
    { en: "EN 12193 Class II (нац.)", lux: "200–300 лк", uniformity: "U2 ≥ 0,6", use: "Региональные соревнования" },
    { en: "EN 12193 Class I (междунар.)", lux: "500–800 лк", uniformity: "U2 ≥ 0,7", use: "ЧМ, телетрансляция HD" },
    { en: "UEFA Cat 4 / FIFA", lux: "1400–2400 лк", uniformity: "U2 ≥ 0,8", use: "Финал ЛЧ, 4K HDR" },
  ];

  const benchmarksKZ = [
    { obj: "Astana Arena (футбол)", capacity: "30 000 мест", cost: "≈ 28 млрд тг (2009)", note: "Раздвижная крыша, FIFA-сертификат" },
    { obj: "Almaty Arena (хоккей)", capacity: "12 000 мест", cost: "≈ 24 млрд тг (2016)", note: "Универсал. ледовая, IIHF" },
    { obj: "Halyk Arena (конькобежный)", capacity: "8 000 мест", cost: "≈ 17 млрд тг (2016)", note: "ISU long track 400 м" },
    { obj: "Burabay Golf Resort", capacity: "18 лунок, 72 par", cost: "≈ 2,8 млрд тг", note: "Бентграсс, ирригация Toro" },
    { obj: "Zeyly Tennis Center (Алматы)", capacity: "12 кортов hard + 4 clay", cost: "≈ 4,5 млрд тг", note: "ATP Challenger" },
  ];

  const Card = ({ children }: { children: React.ReactNode }) => (
    <div className="border border-slate-800 rounded-2xl bg-slate-900/30 p-5 md:p-6">{children}</div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/smeta-trainer/drawings-practice"
            className="text-sm text-blue-300 hover:text-blue-200 transition"
          >
            ← К разделам
          </Link>
          <div className="text-xs text-slate-500">AEVION Smeta Trainer · Спортивные поля и гольф</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">
            ⚽ Спортивные поля и гольф
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-4xl">
            Спортивные объекты — отдельная инженерная категория со своими стандартами FIFA,
            UEFA, IAAF, ITF, IIHF, USGA. Покрытия, основания, дренаж, освещение проектируются
            по международным регламентам, но сметы и индексы — местные, по{" "}
            <strong className="text-blue-300">ССЦ РК и СН РК 2.04-08</strong>. В РК наиболее
            активные программы: реконструкция стадионов в областных центрах,
            школьные ФОКи, гольф-курорты вокруг Алматы и Бурабая.
          </p>
          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-emerald-900/40 rounded-lg p-3 bg-emerald-950/20">
              <div className="text-emerald-500 uppercase tracking-wider mb-1">Сертификация</div>
              <div className="text-slate-300">FIFA / UEFA / IAAF / ITF / USGA — обязательна для офиц. турниров</div>
            </div>
            <div className="border border-emerald-900/40 rounded-lg p-3 bg-emerald-950/20">
              <div className="text-emerald-500 uppercase tracking-wider mb-1">Срок службы покрытий</div>
              <div className="text-slate-300">Искусств. газон 8–12 лет, тартан 12–15 лет, hard 6–10 лет</div>
            </div>
            <div className="border border-emerald-900/40 rounded-lg p-3 bg-emerald-950/20">
              <div className="text-emerald-500 uppercase tracking-wider mb-1">Нормативы РК</div>
              <div className="text-slate-300">СН РК 3.06-03, СП РК 3.06-101, ГОСТ 33602-2015</div>
            </div>
          </div>
        </section>

        {/* Раздел 1. Футбольное поле */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-emerald-300">
            🥅 Раздел 1. Футбольное поле FIFA — конструкция «пирога»
          </h2>
          <p className="text-sm text-slate-400">
            Стандартный размер: <strong className="text-emerald-300">105 × 68 м</strong> (поле игры) +{" "}
            <strong className="text-emerald-300">3–5 м</strong> зона безопасности по периметру.
            FIFA Quality Pro допускает оба покрытия — натуральный травостой и искусственный газон 3-го поколения.
            Себестоимость «пирога» искусств. поля FIFA Quality Pro в РК — <strong className="text-emerald-300">12 000–18 000 тг/м²</strong>{" "}
            (без освещения и инфраструктуры).
          </p>
          <div className="overflow-x-auto border border-emerald-900/30 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Слой</th>
                  <th className="text-left px-4 py-3 w-32">Толщина</th>
                  <th className="text-left px-4 py-3">Комментарий</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {footballPie.map((row) => (
                  <tr key={row.layer} className="hover:bg-slate-900/50">
                    <td className="px-4 py-3 text-emerald-200 font-medium">{row.layer}</td>
                    <td className="px-4 py-3 text-slate-300">{row.thickness}</td>
                    <td className="px-4 py-3 text-slate-400">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Card>
            <div className="text-xs text-emerald-400 uppercase tracking-wider mb-2">⚠️ Частая ошибка</div>
            <p className="text-sm text-slate-300">
              В смете занижают толщину shock-pad или пропускают засыпку EPDM/пробкой, что лишает поле
              FIFA-сертификата. EPDM-крошка должна быть <strong>сертифицирована REACH</strong>{" "}
              (отсутствие тяж. металлов), её цена 1500–2200 тг/кг — серьёзная статья бюджета.
            </p>
          </Card>
        </section>

        {/* Раздел 2. Лёгкоатлетическая дорожка */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-emerald-300">
            🏃 Раздел 2. Лёгкоатлетическая дорожка IAAF
          </h2>
          <p className="text-sm text-slate-400">
            Полная дорожка: 400 м, 8–9 беговых дорожек по 1,22 м. Покрытие — синтетический каучук
            (тартан) систем <strong className="text-emerald-300">Mondotrack, Polytan, Conica</strong>.
            Толщина 13–15 мм. Цена сертифицированной IAAF Class 1 системы под ключ —{" "}
            <strong className="text-emerald-300">28 000–42 000 тг/м²</strong> вместе с разметкой.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {athleticsClasses.map((c) => (
              <Card key={c.cls}>
                <div className="text-emerald-300 font-semibold">{c.cls}</div>
                <div className="text-xs text-slate-500 uppercase mt-2">Применение</div>
                <div className="text-sm text-slate-300">{c.use}</div>
                <div className="text-xs text-slate-500 uppercase mt-3">Требования</div>
                <div className="text-sm text-slate-300">{c.req}</div>
              </Card>
            ))}
          </div>
          <Card>
            <div className="text-xs text-emerald-400 uppercase tracking-wider mb-2">💡 Особенность сметы</div>
            <p className="text-sm text-slate-300">
              Sandwich-система (предварит. слой EPDM + спрей PU сверху) считается двумя отдельными
              позициями ССЦ. Spray-PU слой 2–3 мм даёт top-finish и «зеркальную» поверхность для IAAF.
              Без него — только тренировочная категория.
            </p>
          </Card>
        </section>

        {/* Раздел 3. Теннисные корты */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-emerald-300">
            🎾 Раздел 3. Теннисные корты — 4 типа покрытий
          </h2>
          <p className="text-sm text-slate-400">
            Размер игровой зоны: <strong className="text-emerald-300">23,77 × 10,97 м</strong> (одиночный 8,23 м).
            Общая площадь корта с забегами и зонами безопасности — <strong className="text-emerald-300">36,6 × 18,3 м</strong>.
            ITF классифицирует корты по индексу скорости отскока (Pace): от 1 (медленный, Clay) до 5 (быстрый, Grass).
          </p>
          <div className="overflow-x-auto border border-emerald-900/30 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 w-44">Тип</th>
                  <th className="text-left px-4 py-3 w-40">ITF Pace</th>
                  <th className="text-left px-4 py-3">Конструкция</th>
                  <th className="text-left px-4 py-3 w-28">Цена</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {tennisCourts.map((c) => (
                  <tr key={c.type} className="hover:bg-slate-900/50">
                    <td className="px-4 py-3 text-emerald-200 font-medium">{c.type}</td>
                    <td className="px-4 py-3 text-slate-300">{c.pace}</td>
                    <td className="px-4 py-3 text-slate-400">{c.layers}</td>
                    <td className="px-4 py-3 text-slate-300 font-mono text-xs">{c.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Раздел 4. Гольф-поля */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-emerald-300">
            ⛳ Раздел 4. Гольф-поля — 9/18 лунок, USGA
          </h2>
          <p className="text-sm text-slate-400">
            Стандартное гольф-поле PGA — <strong className="text-emerald-300">18 лунок</strong>,
            par 70–72, длина 5500–6500 м, площадь <strong className="text-emerald-300">50–90 га</strong>.
            Каждая лунка — отдельная инженерная единица: tee → fairway → rough → green с обязательными
            элементами рельефа. Стоимость поля «под ключ» в РК — <strong className="text-emerald-300">1,5–3,5 млрд тг</strong>{" "}
            (без клубного дома, парковки, кадров).
          </p>
          <div className="overflow-x-auto border border-emerald-900/30 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 w-44">Зона</th>
                  <th className="text-left px-4 py-3 w-56">Травостой</th>
                  <th className="text-left px-4 py-3">Особенности</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {golfZones.map((z) => (
                  <tr key={z.zone} className="hover:bg-slate-900/50">
                    <td className="px-4 py-3 text-emerald-200 font-medium">{z.zone}</td>
                    <td className="px-4 py-3 text-slate-300">{z.grass}</td>
                    <td className="px-4 py-3 text-slate-400">{z.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Card>
            <div className="text-xs text-emerald-400 uppercase tracking-wider mb-2">💧 Ирригация</div>
            <p className="text-sm text-slate-300">
              На 18 лунок устанавливается <strong>800–1400 спринклеров Toro / Rain Bird</strong>,
              протяжённость магистралей 18–28 км, объём резервуара 3000–6000 м³.
              Доля ирригации в смете гольф-поля — <strong>22–30 %</strong>.
              В РК с учётом дефицита воды — артезианские скважины + замкнутая система рециркуляции.
            </p>
          </Card>
        </section>

        {/* Раздел 5. Хоккейные коробки */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-emerald-300">
            🏒 Раздел 5. Хоккейные коробки и ледовые арены
          </h2>
          <p className="text-sm text-slate-400">
            Стандартный лёд IIHF: <strong className="text-emerald-300">60 × 30 м</strong> (1800 м²),
            NHL: 60,96 × 25,9 м (1580 м²). Толщина льда 25–35 мм. Бортовая система —{" "}
            <strong className="text-emerald-300">Crystaplex / Athletica</strong> H=1,07 м + защитное стекло 1,6–2,4 м.
            Холодильное оборудование — чиллеры на <strong>аммиаке (NH₃)</strong> или гликоле,
            рабочая температура хладоносителя <strong>−10 … −12 °C</strong>.
          </p>
          <Card>
            <div className="text-xs text-emerald-400 uppercase tracking-wider mb-2">💰 Себестоимость льда</div>
            <p className="text-sm text-slate-300">
              Под ключ: <strong>280–450 тыс. тг/м²</strong> площади льда (включая холодильную станцию,
              разводку под плитой, борта, освещение). Холодильное оборудование — 35–45 % сметы,
              плита с трубками рассольной системы — 18–22 %. Эксплуатация 1 м² льда в год —{" "}
              <strong>9–14 тыс. тг</strong> (электричество, обслуживание).
            </p>
          </Card>
        </section>

        {/* Раздел 6. Универсальные площадки */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-emerald-300">
            🏀 Раздел 6. Универсальные спорт-площадки (school/community)
          </h2>
          <p className="text-sm text-slate-400">
            Школьные и придомовые площадки 20×40 м с разметкой под баскетбол, волейбол, мини-футбол.
            Покрытие — <strong className="text-emerald-300">каучуковая крошка SBR/EPDM 12–25 мм</strong> или
            бесшовный полиуретан. Разметка — термопластиком или двухкомпонентной краской по сертификату EN 14904.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {universalLayers.map((u) => (
              <Card key={u.type}>
                <div className="text-emerald-300 font-semibold">{u.type}</div>
                <div className="text-xs text-slate-500 uppercase mt-2">Применение</div>
                <div className="text-sm text-slate-300">{u.use}</div>
                <div className="text-xs text-slate-500 uppercase mt-2">Цена</div>
                <div className="text-sm text-slate-300 font-mono">{u.price}</div>
              </Card>
            ))}
          </div>
        </section>

        {/* Раздел 7. Лыжные/биатлонные трассы */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-emerald-300">
            🎿 Раздел 7. Лыжные и биатлонные трассы
          </h2>
          <p className="text-sm text-slate-400">
            Биатлонные трассы FIS/IBU — <strong className="text-emerald-300">2,5/3,3/5,0 км</strong> с
            перепадом высот 30–80 м, шириной 6–9 м. Покрытие: естественный снег зимой, искусств. снег{" "}
            <strong className="text-emerald-300">Mr.Snow / Snowflex</strong> летом. Стрельбище: 30 установок,
            дистанция <strong>50 м</strong>, безопасная зона за мишенями 100 м, ловушка пуль.
          </p>
          <Card>
            <div className="text-xs text-emerald-400 uppercase tracking-wider mb-2">🇰🇿 Кейс</div>
            <p className="text-sm text-slate-300">
              «Алатау» (Алматы) и «Щучинский» (Бурабай) — основные базы. Алматинский лыжно-биатлонный
              комплекс реконструировался в 2018 г. со сметой <strong>≈ 8,2 млрд тг</strong> (стрельбище,
              трассы, освещение, ратрак-парк, сервисные постройки).
            </p>
          </Card>
        </section>

        {/* Раздел 8. Освещение */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-emerald-300">
            💡 Раздел 8. Освещение спортивных полей по EN 12193
          </h2>
          <p className="text-sm text-slate-400">
            Светильники: LED 1000–2000 Вт (новые проекты) или MH (металлогалогенные) 1000–2000 Вт
            (легаси). Мачты высотой <strong className="text-emerald-300">H = 20–35 м</strong>, по 4 углам
            поля. Расчёт ведётся в <strong className="text-emerald-300">DIALux Evo / Relux</strong> по
            UEFA/FIFA для футбола, по EN 12193 — для остального.
          </p>
          <div className="overflow-x-auto border border-emerald-900/30 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 w-56">Класс</th>
                  <th className="text-left px-4 py-3 w-32">Освещённость</th>
                  <th className="text-left px-4 py-3 w-32">Равномерность</th>
                  <th className="text-left px-4 py-3">Применение</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {lightingClasses.map((l) => (
                  <tr key={l.en} className="hover:bg-slate-900/50">
                    <td className="px-4 py-3 text-emerald-200 font-medium">{l.en}</td>
                    <td className="px-4 py-3 text-slate-300 font-mono">{l.lux}</td>
                    <td className="px-4 py-3 text-slate-300 font-mono">{l.uniformity}</td>
                    <td className="px-4 py-3 text-slate-400">{l.use}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Раздел 9. Бенчмарки */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-emerald-300">
            🏛 Раздел 9. Бенчмарки РК — стоимость крупных спорт-объектов
          </h2>
          <p className="text-sm text-slate-400">
            Себестоимость одного посадочного места в стадионе 30–50 тыс. вместимости в РК —{" "}
            <strong className="text-emerald-300">700 000 – 1 200 000 тг</strong>. Общая стоимость
            «нового» FIFA-стадиона на 50 000 мест — <strong className="text-emerald-300">35–55 млрд тг</strong>{" "}
            (без транспортной инфраструктуры).
          </p>
          <div className="overflow-x-auto border border-emerald-900/30 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 w-52">Объект</th>
                  <th className="text-left px-4 py-3 w-44">Вместимость</th>
                  <th className="text-left px-4 py-3 w-40">Стоимость</th>
                  <th className="text-left px-4 py-3">Особенности</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {benchmarksKZ.map((b) => (
                  <tr key={b.obj} className="hover:bg-slate-900/50">
                    <td className="px-4 py-3 text-emerald-200 font-medium">{b.obj}</td>
                    <td className="px-4 py-3 text-slate-300">{b.capacity}</td>
                    <td className="px-4 py-3 text-slate-300 font-mono text-xs">{b.cost}</td>
                    <td className="px-4 py-3 text-slate-400">{b.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Упражнения */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-blue-300">📝 Практика</h2>

          {/* Ex 1 */}
          <Card>
            <div className="text-xs text-blue-400 uppercase tracking-wider mb-2">Задача 1 · FIFA-размер поля</div>
            <p className="text-sm text-slate-300 mb-3">
              Какие размеры стандартного футбольного поля FIFA?
            </p>
            <div className="space-y-2 text-sm">
              {[
                { id: "a", label: "90 × 60 м" },
                { id: "b", label: "120 × 80 м" },
                { id: "c", label: "105 × 68 м" },
                { id: "d", label: "100 × 50 м" },
              ].map((opt) => (
                <label key={opt.id} className="flex items-center gap-2 cursor-pointer hover:text-blue-200">
                  <input
                    type="radio"
                    name="ex1"
                    value={opt.id}
                    checked={ex1 === opt.id}
                    onChange={() => setEx1(opt.id)}
                    className="accent-blue-500"
                  />
                  <span className="text-slate-300">
                    <strong className="text-slate-100">{opt.id})</strong> {opt.label}
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={checkEx1}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm transition"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx1Sol(!ex1Sol)}
                className="px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-600 text-slate-300 text-sm transition"
              >
                {ex1Sol ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {ex1Res === "ok" && <p className="mt-3 text-emerald-400 text-sm">✓ Верно. 105 × 68 м — рекомендованный FIFA стандарт.</p>}
            {ex1Res === "bad" && <p className="mt-3 text-rose-400 text-sm">✗ Неверно. FIFA рекомендует 105 × 68 м.</p>}
            {ex1Sol && (
              <div className="mt-3 text-xs text-slate-400 border-l-2 border-blue-700 pl-3">
                Регламент FIFA: длина 100–110 м, ширина 64–75 м для офиц. матчей. Рекомендованный
                стандарт UEFA/FIFA для топ-турниров — 105 × 68 м. Площадь = 7140 м².
              </div>
            )}
          </Card>

          {/* Ex 2 */}
          <Card>
            <div className="text-xs text-blue-400 uppercase tracking-wider mb-2">Задача 2 · Покрытие IAAF Class 1</div>
            <p className="text-sm text-slate-300 mb-3">
              Чем покрывают лёгкоатлетическую дорожку IAAF Class 1?
            </p>
            <div className="space-y-2 text-sm">
              {[
                { id: "a", label: "Асфальтобетон с разметкой" },
                { id: "b", label: "Синтетический каучук Mondotrack/Polytan, 13–15 мм" },
                { id: "c", label: "Бетон с акриловым покрытием Plexipave" },
                { id: "d", label: "Уплотнённый грунт + щебень мелкой фракции" },
              ].map((opt) => (
                <label key={opt.id} className="flex items-center gap-2 cursor-pointer hover:text-blue-200">
                  <input
                    type="radio"
                    name="ex2"
                    value={opt.id}
                    checked={ex2 === opt.id}
                    onChange={() => setEx2(opt.id)}
                    className="accent-blue-500"
                  />
                  <span className="text-slate-300">
                    <strong className="text-slate-100">{opt.id})</strong> {opt.label}
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={checkEx2}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm transition"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx2Sol(!ex2Sol)}
                className="px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-600 text-slate-300 text-sm transition"
              >
                {ex2Sol ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {ex2Res === "ok" && <p className="mt-3 text-emerald-400 text-sm">✓ Верно. Только сертифицированный sandwich-EPDM + spray-PU даёт Class 1.</p>}
            {ex2Res === "bad" && <p className="mt-3 text-rose-400 text-sm">✗ Неверно. Это синтет. каучук (тартан).</p>}
            {ex2Sol && (
              <div className="mt-3 text-xs text-slate-400 border-l-2 border-blue-700 pl-3">
                Для Class 1 нужна <strong>full-PU sandwich</strong> система: базовый слой EPDM-крошки +
                связующий PU + верхний spray-coat с EPDM-гранулами 1–3 мм. Толщина 13–15 мм. Бренды —
                Mondo (Mondotrack WS), Polytan (Rekortan), Conica.
              </div>
            )}
          </Card>

          {/* Ex 3 */}
          <Card>
            <div className="text-xs text-blue-400 uppercase tracking-wider mb-2">Задача 3 · Смета FIFA-поля</div>
            <p className="text-sm text-slate-300 mb-3">
              Футбольное поле FIFA Quality Pro размером 105 × 68 м при средневзвешенной цене{" "}
              <strong className="text-emerald-300">14 250 тг/м²</strong> (с учётом «пирога», но без
              освещения и инфраструктуры). Какова стоимость покрытия поля? Введите ответ в тенге.
            </p>
            <input
              type="text"
              value={ex3}
              onChange={(e) => setEx3(e.target.value)}
              placeholder="например, 102 000 000"
              className="w-full md:w-80 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-sm focus:border-blue-500 focus:outline-none"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={checkEx3}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm transition"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx3Sol(!ex3Sol)}
                className="px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-600 text-slate-300 text-sm transition"
              >
                {ex3Sol ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {ex3Res === "ok" && <p className="mt-3 text-emerald-400 text-sm">✓ Верно. Около 102 млн тг.</p>}
            {ex3Res === "bad" && <p className="mt-3 text-rose-400 text-sm">✗ Неверно. Перепроверьте: площадь × цена.</p>}
            {ex3Sol && (
              <div className="mt-3 text-xs text-slate-400 border-l-2 border-blue-700 pl-3">
                Площадь = 105 × 68 = 7140 м². Стоимость = 7140 × 14 250 ={" "}
                <strong className="text-emerald-300">101 745 000 тг ≈ 102 млн тг</strong>. Допуск ±8 млн на
                разброс цены EPDM и геотекстиля.
              </div>
            )}
          </Card>

          {/* Ex 4 */}
          <Card>
            <div className="text-xs text-blue-400 uppercase tracking-wider mb-2">Задача 4 · Гольф-стандарт PGA</div>
            <p className="text-sm text-slate-300 mb-3">
              Сколько лунок на стандартном гольф-поле для PGA Championship?
            </p>
            <div className="space-y-2 text-sm">
              {[
                { id: "a", label: "9 (executive course)" },
                { id: "b", label: "12 (par-3 course)" },
                { id: "c", label: "6 (driving range)" },
                { id: "d", label: "18 (championship standard)" },
              ].map((opt) => (
                <label key={opt.id} className="flex items-center gap-2 cursor-pointer hover:text-blue-200">
                  <input
                    type="radio"
                    name="ex4"
                    value={opt.id}
                    checked={ex4 === opt.id}
                    onChange={() => setEx4(opt.id)}
                    className="accent-blue-500"
                  />
                  <span className="text-slate-300">
                    <strong className="text-slate-100">{opt.id})</strong> {opt.label}
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={checkEx4}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm transition"
              >
                Проверить
              </button>
              <button
                onClick={() => setEx4Sol(!ex4Sol)}
                className="px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-600 text-slate-300 text-sm transition"
              >
                {ex4Sol ? "Скрыть решение" : "Показать решение"}
              </button>
            </div>
            {ex4Res === "ok" && <p className="mt-3 text-emerald-400 text-sm">✓ Верно. 18 лунок — championship standard.</p>}
            {ex4Res === "bad" && <p className="mt-3 text-rose-400 text-sm">✗ Неверно. Стандарт PGA — 18 лунок (par 70–72).</p>}
            {ex4Sol && (
              <div className="mt-3 text-xs text-slate-400 border-l-2 border-blue-700 pl-3">
                Полное гольф-поле — 18 лунок, общая длина 5500–6500 м, par 70–72. 9-луночные форматы (executive,
                par-3) допустимы для тренировочных и любительских курсов, но не сертифицируются для
                PGA / European Tour.
              </div>
            )}
          </Card>
        </section>

        {/* Ключевые выводы */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-emerald-300">🎯 Ключевые выводы</h2>
          <Card>
            <ul className="space-y-2 text-sm text-slate-300 list-disc list-inside">
              <li>FIFA-поле 105 × 68 м: пирог толщиной ~400 мм со сертифицированной EPDM-засыпкой; 12–18 тыс. тг/м².</li>
              <li>IAAF Class 1 — только sandwich-PU 13–15 мм; spray-coat сверху обязателен.</li>
              <li>Теннис: hard (Plexipave) — самый частый формат в РК; clay требует ежедневного полива.</li>
              <li>Гольф: 18 лунок = 50–90 га; ирригация — 22–30 % бюджета (Toro / Rain Bird).</li>
              <li>Лёд IIHF 60×30 м: чиллер аммиак/гликоль, плита с рассольной системой −10 °C, борта Crystaplex.</li>
              <li>Универсальные площадки SBR/EPDM 12–25 мм — самая массовая позиция в школьных сметах РК.</li>
              <li>Освещение EN 12193: от 75 лк (трен.) до 2400 лк (UEFA Cat 4); DIALux обязателен.</li>
              <li>Стадион 50 тыс. мест в РК = 35–55 млрд тг; место — 700 000–1 200 000 тг.</li>
            </ul>
          </Card>
        </section>

        <div className="pt-6 border-t border-slate-800 text-center">
          <Link
            href="/smeta-trainer/drawings-practice"
            className="inline-block px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm transition"
          >
            ← Вернуться к разделам
          </Link>
        </div>
      </main>
    </div>
  );
}
